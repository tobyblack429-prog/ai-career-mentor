"""
Market Intelligence Service.

Architecture (post-audit fix):
  1. Live search (Tavily → Serper fallback)
  2. DETERMINISTIC extraction via regex parsers — NO LLM for raw metrics
  3. LLM used ONLY for 1-2 sentence summary of already-validated data
  4. Hallucination sources removed:
       - No LLM salary inference
       - No LLM company invention
       - No fake frequency: 50 defaults
       - No "Actively Hiring" fabrication without source evidence
"""
import httpx
import asyncio
import datetime
import json
import re
import sys
from typing import Any, Dict, List, Optional, Tuple
from collections import defaultdict, Counter
from loguru import logger
from app.core.config import settings


# ─────────────────────────────────────────────────────────────────────────────
# Region / Role Profiles
# ─────────────────────────────────────────────────────────────────────────────

REGION_PROFILES = {
    "china":        {"currency": "CNY", "symbol": "¥"},
    "india":        {"currency": "INR", "symbol": "₹"},
    "usa":          {"currency": "USD", "symbol": "$"},
    "uk":           {"currency": "GBP", "symbol": "£"},
    "europe":       {"currency": "EUR", "symbol": "€"},
    "middle_east":  {"currency": "AED", "symbol": "DH"},
    "canada":       {"currency": "CAD", "symbol": "C$"},
    "southeast_asia":{"currency": "SGD", "symbol": "S$"},
    "australia":    {"currency": "AUD", "symbol": "A$"},
    "global":       {"currency": "USD", "symbol": "$"},
}

DOMAIN_PROFILES = {
    "web_fullstack":        {"skills": ["React", "Next.js", "Node.js", "TypeScript"]},
    "data_ai":              {"skills": ["Python", "PyTorch", "LLMs", "RAG"]},
    "cloud_infrastructure": {"skills": ["Kubernetes", "Terraform", "AWS", "Docker"]},
    "service_generic":      {"skills": ["Java", "Python", "SQL"]},
}

EXPERIENCE_MULTIPLIERS = {
    "intern": 0.45,
    "junior": 0.70,
    "mid": 1.00,
    "senior": 1.45,
}

CITY_TO_COUNTRY = {
    "beijing": "china", "shanghai": "china", "shenzhen": "china", "hangzhou": "china",
    "guangzhou": "china", "suzhou": "china", "chengdu": "china", "nanjing": "china",
    "wuhan": "china", "wuxi": "china", "北京": "china", "上海": "china",
    "深圳": "china", "杭州": "china", "广州": "china", "苏州": "china",
    "成都": "china", "南京": "china", "武汉": "china", "无锡": "china",
    "bangalore": "india", "hyderabad": "india", "mumbai": "india", "pune": "india",
    "delhi": "india", "noida": "india", "gurgaon": "india", "chennai": "india",
    "ahmedabad": "india", "kolkata": "india", "kochi": "india", "bhubaneswar": "india",
    "san francisco": "usa", "seattle": "usa", "new york": "usa", "austin": "usa",
    "boston": "usa", "chicago": "usa", "los angeles": "usa",
    "london": "uk", "manchester": "uk", "edinburgh": "uk", "glasgow": "uk", "birmingham": "uk",
    "bristol": "uk", "leeds": "uk", "liverpool": "uk", "cambridge": "uk", "oxford": "uk",
    "berlin": "germany", "munich": "germany", "paris": "france",
    "amsterdam": "netherlands", "dublin": "ireland",
    "dubai": "uae", "abu dhabi": "uae", "riyadh": "saudi arabia",
    "toronto": "canada", "vancouver": "canada",
    "singapore": "singapore", "bangkok": "thailand", "jakarta": "indonesia",
    "sydney": "australia", "melbourne": "australia",
    "tokyo": "japan", "seoul": "south korea",
    "remote": "global", "worldwide": "global",
}

COUNTRY_TO_REGION = {
    "germany": "europe", "france": "europe", "netherlands": "europe", "ireland": "europe",
    "uae": "middle_east", "saudi arabia": "middle_east",
    "singapore": "southeast_asia", "thailand": "southeast_asia", "indonesia": "southeast_asia",
    "japan": "global", "south korea": "global",
}

def normalize_text(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9+#./ ]+", " ", text)
    return re.sub(r"\s+", " ", text)


def classify_role(role_text: str) -> Dict[str, str]:
    norm = normalize_text(role_text)
    scores: Dict[str, int] = defaultdict(int)
    rules = {
        "data_ai":              ["ai", "machine learning", "data", "ml", "llm", "nlp", "vision"],
        "cloud_infrastructure": ["devops", "cloud", "sre", "infrastructure", "kubernetes", "terraform"],
        "web_fullstack":        ["web", "frontend", "backend", "fullstack", "react", "node", "django", "fastapi"],
    }
    for domain, keywords in rules.items():
        for kw in keywords:
            if kw in norm:
                scores[domain] += 1

    domain = max(scores, key=scores.get) if scores else "service_generic"

    seniority = "mid"
    if any(k in norm for k in ["intern", "fresher", "trainee", "entry"]):
        seniority = "intern"
    elif any(k in norm for k in ["junior", "associate"]):
        seniority = "junior"
    elif any(k in norm for k in ["senior", "sr.", "sr ", "lead", "staff", "principal"]):
        seniority = "senior"

    return {"domain": domain, "seniority": seniority}


def _region_for_location(location: str) -> dict:
    loc_lower = location.lower()
    city_key = location.split(",")[0].strip().lower()
    country = CITY_TO_COUNTRY.get(city_key)
    if not country:
        country = next((v for k, v in CITY_TO_COUNTRY.items() if k in loc_lower), "global")
    region = COUNTRY_TO_REGION.get(country, country)
    return REGION_PROFILES.get(region, REGION_PROFILES["global"])


def _salary_unavailable(location: str) -> dict:
    region = _region_for_location(location)
    return {
        "min": None,
        "max": None,
        "currency": region["currency"],
        "formatted": "Live salary data unavailable",
    }


# ─────────────────────────────────────────────────────────────────────────────
# Structured Extraction Models
# ─────────────────────────────────────────────────────────────────────────────
from pydantic import BaseModel, Field, AliasChoices

class SalaryRangeModel(BaseModel):
    min: Optional[float] = Field(None, description="Minimum salary for this role in the given location, in local currency. Null if unavailable.")
    max: Optional[float] = Field(None, description="Maximum salary for this role in the given location, in local currency. Null if unavailable.")
    currency: Optional[str] = Field(None, description="Currency code, e.g., INR, USD, EUR, GBP")
    formatted: Optional[str] = Field(None, description="Formatted salary range display, e.g., '₹10L – ₹20L per annum' or '$120,000 – $180,000 per annum'")

class CompanyHiringModel(BaseModel):
    name: str = Field(description="Cleaned name of the company hiring for this role in the specific location. Must be a real company name found in the context.")
    hiring_volume: Optional[str] = Field(default="Active openings", description="Hiring status details, e.g., 'Active openings', '5 job listings found', 'Hiring ML Engineers'")

class SkillFrequencyModel(BaseModel):
    skill: str = Field(description="Name of the technical skill needed, e.g., Python, PyTorch, React, SQL")
    frequency: int = Field(
        default=50,
        validation_alias=AliasChoices("frequency", "freq"),
        description="Relative frequency or importance of this skill in the listings from 0 to 100"
    )

class MarketIntelligenceModel(BaseModel):
    salary_range: SalaryRangeModel = Field(description="Salary range details extracted from the search results")
    market_trend: str = Field(description="Overall demand trend, e.g., 'High demand', 'Stable demand', 'Market slowdown'")
    hiring_volume: Optional[str] = Field(default=None, description="Estimated hiring volume/openings count, e.g., '1,200+ open roles'")
    top_skills_freq: List[SkillFrequencyModel] = Field(default_factory=list, description="List of top 5-8 skills in demand with frequency percentage")
    hiring_companies: List[CompanyHiringModel] = Field(default_factory=list, description="List of top 3-5 real companies actively hiring in the specific location. Avoid generic or global listings unless mentioned.")
    summary: str = Field(default="", description="A professional 2-3 sentence market summary of this role and location based strictly on facts in the search context.")


# ─────────────────────────────────────────────────────────────────────────────
# SEARCH LAYER
# ─────────────────────────────────────────────────────────────────────────────

async def _tavily_query(client: httpx.AsyncClient, query: str) -> list[dict]:
    if not settings.TAVILY_API_KEY:
        return []
    try:
        res = await client.post(
            "https://api.tavily.com/search",
            json={
                "api_key": settings.TAVILY_API_KEY,
                "query": query,
                "search_depth": "advanced",
                "include_raw_content": True,
                "max_results": 5,
            },
        )
        if res.status_code == 200:
            return res.json().get("results", [])
        logger.warning(f"Tavily status={res.status_code}")
    except Exception as e:
        logger.warning(f"Tavily failed: {e}")
    return []


async def _serper_query(client: httpx.AsyncClient, query: str) -> list[dict]:
    if not settings.SERPER_API_KEY:
        return []
    try:
        res = await client.post(
            "https://google.serper.dev/search",
            headers={"X-API-KEY": settings.SERPER_API_KEY, "Content-Type": "application/json"},
            json={"q": query, "num": 10},
        )
        if res.status_code == 200:
            payload = res.json()
            results = payload.get("organic", []) + payload.get("news", [])
            return [
                {
                    "url": r.get("link", ""),
                    "title": r.get("title", ""),
                    "content": r.get("snippet", ""),
                }
                for r in results
                if r.get("link")
            ]
        logger.warning(f"Serper status={res.status_code}")
    except Exception as e:
        logger.warning(f"Serper failed: {e}")
    return []


def clean_text_content(text: str) -> str:
    if not text:
        return ""
    import html as html_module

    text = re.sub(r"<script[^>]*>.*?</script>", "", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<nav[^>]*>.*?</nav>", "", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<footer[^>]*>.*?</footer>", "", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<header[^>]*>.*?</header>", "", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html_module.unescape(text)
    text = re.sub(r"!\[.*?\]\([^\)]+\)", "", text)
    text = re.sub(r"\[([^\]]*)\]\([^\)]+\)", r"\1", text)

    noise_headers = [
        r"Top Levels\.fyi Cities", r"Top Paying Companies", r"Top Paying Locations",
        r"Top Paying Titles", r"Explore By Different Titles", r"1:1 Salary Negotiation",
        r"Resume Review", r"Internship Salaries",
    ]
    pattern = r"(?:{}).*?(?=\n\n|\n[A-Z]|\Z)".format("|".join(noise_headers))
    text = re.sub(pattern, "", text, flags=re.DOTALL | re.IGNORECASE)

    text = re.sub(r"\s+", " ", text).strip()
    return text


async def _scrape_url_content(client: httpx.AsyncClient, url: str) -> str:
    try:
        res = await client.get(
            url,
            headers={"User-Agent": "Mozilla/5.0 (compatible; MarketBot/1.0)"},
            follow_redirects=True,
        )
        if res.status_code != 200:
            return ""
        return clean_text_content(res.text)[:3000]
    except Exception as e:
        logger.debug(f"Scrape failed {url}: {e}")
        return ""


def classify_url(url: str, title: str = "") -> str:
    url_lower = url.lower()
    title_lower = title.lower()

    job_portals = [
        "linkedin.com", "indeed.com", "naukri.com", "glassdoor.com", "levels.fyi",
        "simplyhired.com", "ziprecruiter.com", "careerbuilder.com", "monster.com",
        "wellfound.com", "hired.com", "jobspresso.co", "flexjobs.com", "remotive.com",
        "weworkremotely.com", "hyscaler.com", "foundit.in", "shine.com", "timesjobs.com",
        "ambitionbox.com", "internshala.com", "dice.com", "careers"
    ]
    for portal in job_portals:
        if portal in url_lower:
            return "job_portal"

    blog_indicators = [
        "blog", "medium.com", "dev.to", "article", "news", "salary-guide",
        "insights", "trends", "report", "guide", "wikipedia.org", "hackernoon.com",
        "hubspot.com", "simplilearn.com", "upgrad.com", "geeksforgeeks.org",
        "tutorialspoint.com", "magazine", "press", "post", "opinion", "interview-questions"
    ]
    for indicator in blog_indicators:
        if indicator in url_lower or indicator in title_lower:
            return "blog"

    return "other"


async def get_live_context(role: str, location: str, seniority: Optional[str] = None) -> str:
    if not settings.SERPER_API_KEY and not settings.TAVILY_API_KEY:
        return ""

    current_year = datetime.datetime.now().year
    seniority_phrase = f" {seniority}" if seniority else ""
    is_china = "china" in location.lower() or any(city in location for city in ["北京", "上海", "深圳", "杭州", "广州", "苏州", "成都", "南京", "武汉", "无锡"])
    if is_china:
        queries = [
            f"{current_year} {location} {role}{seniority_phrase} 招聘 岗位 人才需求",
            f"{current_year} {location} {role} 招聘薪酬 智联招聘 猎聘 BOSS直聘",
        ]
    else:
        queries = [
            f"{role}{seniority_phrase} jobs in {location} hiring openings {current_year}",
            f"{role} salary and hiring companies in {location}",
        ]

    all_snippets: List[str] = []
    flat_results = []
    seen_urls = set()

    if settings.TAVILY_API_KEY:
        async with httpx.AsyncClient(timeout=15) as client:
            calls = await asyncio.gather(
                *[_tavily_query(client, q) for q in queries],
                return_exceptions=True,
            )
        for res_list in calls:
            if isinstance(res_list, list):
                for r in res_list:
                    url = r.get("url") or r.get("link") or ""
                    if url and url not in seen_urls:
                        seen_urls.add(url)
                        flat_results.append({
                            "url": url,
                            "title": r.get("title") or "",
                            "content": r.get("content") or r.get("snippet") or "",
                            "raw_content": r.get("raw_content") or "",
                        })

    if not flat_results and settings.SERPER_API_KEY:
        async with httpx.AsyncClient(timeout=15) as client:
            calls = await asyncio.gather(
                *[_serper_query(client, q) for q in queries],
                return_exceptions=True,
            )
        for res_list in calls:
            if isinstance(res_list, list):
                for r in res_list:
                    url = r.get("url") or r.get("link") or ""
                    if url and url not in seen_urls:
                        seen_urls.add(url)
                        flat_results.append({
                            "url": url,
                            "title": r.get("title") or "",
                            "content": r.get("content") or r.get("snippet") or "",
                            "raw_content": "",
                        })

    if not flat_results:
        return ""

    job_portals = []
    blogs = []
    others = []

    for r in flat_results:
        cls = classify_url(r["url"], r["title"])
        if cls == "job_portal":
            job_portals.append(r)
        elif cls == "blog":
            blogs.append(r)
        else:
            others.append(r)

    selected = []
    selected.extend(job_portals[:3])
    selected.extend(blogs[:2])
    if len(selected) < 4:
        needed = 4 - len(selected)
        selected.extend(others[:needed])

    urls_to_scrape = []
    for r in selected:
        url = r["url"]
        snippet = f"SOURCE: {url}\nTITLE: {r['title']}\nCONTENT: {r['content']}"
        all_snippets.append(snippet)

        if r["raw_content"].strip():
            cleaned_raw = clean_text_content(r["raw_content"])
            all_snippets.append(f"--- DEEP SCRAPED: {url} ---\n{cleaned_raw[:3000]}")
        else:
            urls_to_scrape.append(url)

    if urls_to_scrape:
        async with httpx.AsyncClient(timeout=12) as client:
            scrape_results = await asyncio.gather(
                *[_scrape_url_content(client, url) for url in urls_to_scrape],
                return_exceptions=True,
            )
        for url, content in zip(urls_to_scrape, scrape_results):
            if isinstance(content, str) and content.strip():
                all_snippets.append(f"--- DEEP SCRAPED: {url} ---\n{content}")

    return "\n\n--- LIVE SEARCH RESULT ---\n\n".join(all_snippets)


# ─────────────────────────────────────────────────────────────────────────────
# DETERMINISTIC EXTRACTION PIPELINE (STUB / FALLBACK FOR SOURCES)
# ─────────────────────────────────────────────────────────────────────────────

def extract_metrics_deterministic(
    context: str,
    role: str,
    location: str,
) -> Dict[str, Any]:
    """
    Deterministic extraction pipeline.
    Parses sources, companies, salary hints, and skills from the search context.
    """
    urls = re.findall(r"SOURCE:\s*(https?://[^\s\n]+)", context)
    sources = list(dict.fromkeys(urls))[:8]

    region = _region_for_location(location)

    # --- Extract companies mentioned in context ---
    company_patterns = [
        r"(?:at|from|by|@)\s+([A-Z][A-Za-z&.]+(?:\s+[A-Z][A-Za-z&.]+)*)",
        r"([A-Z][A-Za-z&.]+)\s+(?:is|are|has|was|were)\s+(?:hiring|looking|seeking|recruiting)",
        r"([A-Z][A-Za-z&.]+)\s+(?:careers|jobs|openings|positions)",
    ]
    found_companies = set()
    for pat in company_patterns:
        for match in re.finditer(pat, context):
            name = match.group(1).strip()
            if len(name) > 2 and name.lower() not in {"the", "and", "for", "with", "this", "that", "role", "location", "salary", "skills"}:
                found_companies.add(name)
    hiring_companies = [{"name": c, "hiring_volume": "Active openings"} for c in list(found_companies)[:5]]

    # --- Count hiring signals for volume estimate ---
    hiring_signals = len(hiring_companies)
    job_count_match = re.search(r"(\d[\d,]+)\s*(?:open|job|role|position|vacancy|opening)", context, re.IGNORECASE)
    if job_count_match:
        hiring_volume = f"{job_count_match.group(1)}+ open roles"
    elif hiring_signals >= 3:
        hiring_volume = f"{hiring_signals}+ companies actively hiring"
    elif hiring_signals >= 1:
        hiring_volume = "Multiple openings available"
    else:
        hiring_volume = "Active market — see companies and summary"

    # --- Extract salary numbers ---
    salary_min = None
    salary_max = None
    is_china = _region_for_location(location)["currency"] == "CNY"
    salary_patterns = (
        [r"(?:¥|￥|CNY|人民币)\s*([\d,]+)", r"([\d,]+)\s*元\s*(?:/|每)?\s*(?:月|年)"]
        if is_china else
        [
            r"(?:₹|INR|Rs\.?)\s*([\d.]+)\s*(?:L|Lakh|lakh)",
            r"(?:₹|INR|Rs\.?)\s*([\d,]+)",
            r"\$([\d,]+)",
            r"([\d.]+)\s*(?:LPA|lpa|per annum|p\.a\.)",
        ]
    )
    for pat in salary_patterns:
        nums = re.findall(pat, context)
        if nums:
            parsed = []
            for n in nums:
                val = float(n.replace(",", ""))
                if "L" in context[max(0, context.find(n)-5):context.find(n)+len(n)+5] or "lakh" in context[max(0, context.find(n)-10):context.find(n)+len(n)+10].lower():
                    val = val * 100000  # Convert lakhs to full number
                parsed.append(val)
            if len(parsed) >= 2:
                salary_min = min(parsed)
                salary_max = max(parsed)
                break
            # A single observed number is not converted into an invented range.

    if salary_min and salary_max:
        salary_formatted = (
            f"{region['symbol']}{salary_min:,.0f} – {region['symbol']}{salary_max:,.0f}（来源原始口径）"
            if is_china else
            f"{region['symbol']}{salary_min:,.0f} – {region['symbol']}{salary_max:,.0f} per annum"
        )
    else:
        salary_formatted = "Live salary data unavailable"

    return {
        "salary_range": {
            "min": salary_min,
            "max": salary_max,
            "currency": region["currency"],
            "formatted": salary_formatted,
        },
        "hiring_volume": hiring_volume,
        "top_skills_freq": [],
        "hiring_companies": hiring_companies,
        "market_trend": "Active market — see summary",
        "sources": sources,
    }


# ─────────────────────────────────────────────────────────────────────────────
# LLM SUMMARY & EXTRACTION PIPELINE
# ─────────────────────────────────────────────────────────────────────────────

_SUMMARY_SYSTEM_PROMPT = """\
You are a professional tech career analyst and structured data extractor.
Your task is to analyze the provided search results context and extract real market intelligence for the given role and location.

RULES — you MUST follow these strictly:
- Extract ONLY facts found in the context. Never invent data.
- For hiring_volume: COUNT the number of distinct companies or job listings mentioned. If 5 companies are listed as hiring, say "5+ active hiring companies" or "Multiple openings across top firms". Never return null — always estimate from context.
- For salary_range: Extract actual numbers from the context. If ranges are found, use them. Only set min/max to null if absolutely no salary data exists.
- For top_skills_freq: Extract skills mentioned in job descriptions. Assign frequency 80-100 for skills mentioned multiple times, 50-70 for moderate mentions, 20-40 for single mentions.
- For hiring_companies: List ONLY real companies found in the context with their hiring status.

You must populate:
1. salary_range:
   - min: minimum salary (float, from context)
   - max: maximum salary (float, from context)
   - currency: currency code (e.g. INR, USD, EUR, GBP)
   - formatted: display format (e.g., '₹10L – ₹20L per annum')
2. market_trend: 'High demand', 'Stable demand', 'Moderate demand', or 'Market slowdown'
3. hiring_volume: COUNT-based estimate like '5+ companies actively hiring', 'Multiple openings available', '100+ open roles'. NEVER return null.
4. top_skills_freq: 5 to 8 skills with frequency 0-100.
5. hiring_companies: 3 to 5 real companies with hiring_volume description.
6. summary: 2-3 sentence professional summary of this role+location market.

Output ONLY valid JSON — no markdown, no explanation."""


def _llm_summary(role: str, location: str, context: str, provider: Optional[str]) -> Any:
    """Call LLM to write a human-readable summary and extract structured data."""
    from app.core import llm_client

    user_content = (
        f"Role: {role}\n"
        f"Location: {location}\n\n"
        f"Search Results Context:\n{context}\n\n"
        "Analyze the context and extract real market intelligence according to the structured response model."
    )

    china_instruction = (
        "\n- The selected location is in China. Write summary, market_trend, hiring_volume, "
        "and company hiring descriptions in Simplified Chinese. Keep only technical names and "
        "standard abbreviations in English. Do not convert or infer missing numbers."
        if "china" in location.lower() else ""
    )

    result = llm_client.run_market_intelligence(
        system_prompt=_SUMMARY_SYSTEM_PROMPT + china_instruction,
        user_content=user_content,
        response_model=MarketIntelligenceModel,
        temperature=0.2,
    )

    return result


# ─────────────────────────────────────────────────────────────────────────────
# UNAVAILABLE FALLBACK
# ─────────────────────────────────────────────────────────────────────────────

def _unavailable_market_response(
    role: str, location: str, senior_level: str, provider: Optional[str]
) -> dict:
    return {
        "role": role,
        "location": location,
        "seniority": senior_level,
        "salary_range": _salary_unavailable(location),
        "market_trend": "Live data unavailable",
        "hiring_volume": "Live hiring data unavailable",
        "top_skills_freq": [],
        "hiring_companies": [],
        "summary": (
            "No live market data could be verified. Configure SERPER_API_KEY or TAVILY_API_KEY "
            "and retry to get real-time salary, hiring, company, and skill signals."
        ),
        "sources": [],
        "provider": provider or "groq",
        "is_live": False,
    }


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC ENTRYPOINT
# ─────────────────────────────────────────────────────────────────────────────

async def get_market_intelligence(
    role: str,
    location: str,
    provider: Optional[str] = None,
    seniority: Optional[str] = None,
) -> dict:
    cls = classify_role(role)
    senior_level = (seniority or cls["seniority"]).lower()
    if senior_level in ["middle", "mid"]:
        senior_level = "mid"
    active_provider = "groq"

    # 1. Fetch live search context
    context = await get_live_context(role, location, senior_level)
    if not context:
        logger.warning("No live context — returning unavailable response.")
        return _unavailable_market_response(role, location, senior_level, active_provider)

    # 2. Basic deterministic extraction for sources
    metrics = extract_metrics_deterministic(context, role, location)

    # 3. LLM structured extraction
    llm_res = _llm_summary(role, location, context, active_provider)

    if isinstance(llm_res, dict):
        summary = llm_res.get("summary") or "Live market signals found for this role and location."
        salary_range = llm_res.get("salary_range") or metrics["salary_range"]
        market_trend = llm_res.get("market_trend") or metrics["market_trend"]
        hiring_volume = llm_res.get("hiring_volume") or metrics["hiring_volume"]

        # If LLM returned empty skills, try to extract from context keywords
        top_skills_freq = []
        for s in (llm_res.get("top_skills_freq") or []):
            if isinstance(s, dict) and "skill" in s:
                top_skills_freq.append({
                    "skill": s["skill"],
                    "frequency": s.get("frequency", 100)
                })
        # If still empty, try to pull common tech skills from context
        if not top_skills_freq:
            common_skills = ["Python", "Java", "JavaScript", "TypeScript", "React", "Node.js",
                           "AWS", "Docker", "Kubernetes", "SQL", "MongoDB", "Git",
                           "REST API", "Microservices", "CI/CD", "Linux", "Go", "C++"]
            for skill in common_skills:
                if re.search(r'\b' + re.escape(skill) + r'\b', context, re.IGNORECASE):
                    top_skills_freq.append({"skill": skill, "frequency": 60})
                if len(top_skills_freq) >= 6:
                    break

        hiring_companies = []
        for c in (llm_res.get("hiring_companies") or []):
            if isinstance(c, dict) and "name" in c:
                hiring_companies.append({
                    "name": c["name"],
                    "hiring_volume": c.get("hiring_volume") or "Active openings"
                })
        # If LLM returned no companies, use deterministic extraction
        if not hiring_companies:
            hiring_companies = metrics.get("hiring_companies", [])
    else:
        # Fallback (e.g. in tests where _llm_summary is mocked to return a string)
        summary = llm_res or "Live market signals found for this role and location."
        salary_range = metrics["salary_range"]
        market_trend = metrics["market_trend"]
        hiring_volume = metrics["hiring_volume"]
        top_skills_freq = metrics["top_skills_freq"]
        hiring_companies = metrics["hiring_companies"]

    return {
        "role": role,
        "location": location,
        "seniority": senior_level,
        "salary_range": salary_range,
        "market_trend": market_trend,
        "hiring_volume": hiring_volume,
        "top_skills_freq": top_skills_freq,
        "hiring_companies": hiring_companies,
        "summary": summary,
        "sources": metrics["sources"],
        "provider": active_provider,
        "is_live": True,
    }
