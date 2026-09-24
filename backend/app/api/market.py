"""
Market API & Agent Logic.

Responsibilities:
  GET /market/config   → Dynamic config for all wizards
  GET /market/trends   → Deterministic market intelligence + LLM summary

Agent logic (run_market_agent) is the single source of truth for market
analysis prompts and is imported by workflow.py for the LangGraph pipeline.
"""
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from loguru import logger
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.activity import log_activity
from app.core.database import get_db
from app.core.market.service import (
    get_market_intelligence,
    CITY_TO_COUNTRY,
    EXPERIENCE_MULTIPLIERS,
)
from app.core.market.history import save_market_analysis
from app.core.rate_limit import check_daily_limit, increment_usage
from app.models.models import MarketAnalysis, User
from app.models.validation import MarketTrendsModel

router = APIRouter()

# ─────────────────────────────────────────────────────────────────────────────
# Market Agent — owned here, imported by workflow.py
# ─────────────────────────────────────────────────────────────────────────────

_MARKET_SYSTEM_PROMPT = """\
You are a Tech Market Intelligence Analyst.
Your task: take the deterministic market data and produce a polished, professional
structured JSON output for a job-seeker.

RULES:
- 'hiring_volume': Use the value from deterministic data. If it says "Active openings" or similar, keep it. Never return null.
- 'salary_range': Use the value from deterministic data. Pass through min, max, formatted as-is.
- 'hiring_companies': Use the companies from deterministic data. Each must have {name, hiring_volume}.
- 'top_skills_freq': Use the skills from deterministic data. Each must have {skill, frequency}.
- 'market_trend': Derive from the data — 'High demand' if many companies hiring, 'Stable demand' if moderate.
- 'summary': Write a professional 2-3 sentence market summary combining salary, demand, and skills.
- Output ONLY valid JSON — no markdown, no explanation.

Required JSON schema:
{
  "role": "",
  "location": "",
  "salary_range": {"min": null, "max": null, "formatted": ""},
  "market_trend": "",
  "hiring_volume": "",
  "hiring_companies": [{"name": "", "hiring_volume": ""}],
  "top_skills_freq": [{"skill": "", "frequency": 0}],
  "summary": ""
}
"""


def run_market_agent(
    role: str,
    location: str,
    deterministic_data: dict,
    provider: Optional[str] = None,
) -> dict:
    """
    Market Intelligence Agent.

    Takes deterministic market data and enriches it with LLM-formatted
    summaries, trend narratives, and structured hiring company info.

    Returns validated dict. Falls back to deterministic_data on failure.
    """
    user_content = (
        f"ROLE: {role}\n"
        f"LOCATION: {location}\n\n"
        f"DETERMINISTIC MARKET DATA:\n{json.dumps(deterministic_data, indent=2)}"
    )

    from app.core import llm_client
    system_prompt = _MARKET_SYSTEM_PROMPT
    if "china" in location.lower():
        system_prompt += (
            "\nThe location is in China. Write summary, market_trend, hiring_volume, and hiring "
            "descriptions in Simplified Chinese. Preserve only technical terms and standard abbreviations."
        )
    result = llm_client.run_market_agent(
        system_prompt=system_prompt,
        user_content=user_content,
        response_model=MarketTrendsModel,
    )

    if not result:
        logger.warning("Market agent returned no result — using deterministic fallback.")
        return deterministic_data

    # Merge result back into a copy of deterministic_data so that we NEVER lose any fields
    # like seniority, is_live, sources, summary, etc.
    final_result = {**deterministic_data}
    if isinstance(result, dict):
        for k, v in result.items():
            if v not in (None, "", [], {}):
                final_result[k] = v
            # Ensure summary is overwritten if the LLM produced one
            if k == "summary" and v:
                final_result["summary"] = v
    else:
        logger.warning("Market agent returned non-dict result.")

    return final_result


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/config")
async def get_market_config():
    """Returns dynamic configuration for all Wizards (Market, Interview, Analysis)."""
    from app.core.interview.constants import TARGET_ROLES, COMPANY_PROFILES, TARGET_LOCATIONS

    seniorities = []
    for s in EXPERIENCE_MULTIPLIERS.keys():
        if s == "mid":
            seniorities.append("Middle")
        else:
            seniorities.append(s.capitalize())

    return {
        "locations": TARGET_LOCATIONS,
        "roles": TARGET_ROLES,
        "companies": COMPANY_PROFILES,
        "seniorities": seniorities,
    }


@router.get("/history", summary="Fetch saved market intelligence history")
async def get_market_history(
    limit: int = Query(10, ge=1, le=50, description="Maximum number of saved market analyses to return"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    records = (
        db.query(MarketAnalysis)
        .filter(MarketAnalysis.user_id == current_user.id)
        .order_by(MarketAnalysis.created_at.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "id": record.id,
            "target_role": record.target_role,
            "location": record.location,
            "analysis": record.analysis or {},
            "created_at": record.created_at.isoformat() if record.created_at else None,
        }
        for record in records
    ]


@router.get("/trends", summary="Fetch deterministic, region-aware job market trends")
async def get_market_trends(
    role: str = Query(..., description="Target job role, e.g., 'Data Scientist'"),
    location: str = Query(..., description="Target location, e.g., 'Bangalore, India'"),
    seniority: str | None = Query(None, description="Experience level, e.g., 'Senior'"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    try:
        check_daily_limit(current_user.id, "market")

        data = await get_market_intelligence(role, location, None, seniority)

        save_market_analysis(db, current_user.id, role, location, data)
        increment_usage(current_user.id, "market")
        log_activity(db, current_user.id, f"Researched Market for {role}", "market")

        return data
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Market trends pipeline failed")
        raise HTTPException(status_code=500, detail=f"Market error: {exc}")


@router.delete("/{analysis_id}", summary="Delete a saved market analysis")
async def delete_market_analysis(
    analysis_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Delete a specific market analysis."""
    analysis = db.query(MarketAnalysis).filter(
        MarketAnalysis.id == analysis_id,
        MarketAnalysis.user_id == current_user.id
    ).first()
    
    if not analysis:
        raise HTTPException(status_code=404, detail="Market analysis not found")
        
    db.delete(analysis)
    db.commit()
    return {"message": "Market analysis deleted successfully"}
