"""
Roadmap Helpers — JSON parsing, week normalisation, and fallback generation.

Pure utility functions with no LLM calls or API dependencies.
"""
import json
import re
from loguru import logger


def parse_agent_json(raw: str) -> list[dict]:
    """
    Robustly extract a JSON array from the agent reply using regex if needed.
    """
    cleaned = raw.strip()

    # Try regular parsing first
    if "```json" in cleaned:
        cleaned = cleaned.split("```json")[1].split("```")[0].strip()
    elif "```" in cleaned:
        cleaned = cleaned.split("```")[1].split("```")[0].strip()

    # Remove trailing commas (common LLM JSON issue)
    cleaned = re.sub(r',\s*([\]}])', r'\1', cleaned)

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        # REGEX FALLBACK: find the first '[' and last ']'
        match = re.search(r"\[\s*\{.*\}\s*\]", cleaned, re.DOTALL)
        if not match:
            # Try on raw string as well
            raw_cleaned = re.sub(r',\s*([\]}])', r'\1', raw)
            match = re.search(r"\[\s*\{.*\}\s*\]", raw_cleaned, re.DOTALL)

        if match:
            try:
                parsed = json.loads(match.group(0))
            except Exception:
                raise ValueError("Could not repair JSON array from agent response.")
        else:
            raise ValueError("Agent response contained no valid JSON array.")

    # Agent might return {"weeks": [...]} instead of a bare array
    if isinstance(parsed, dict):
        for key in ("weeks", "roadmap", "plan", "learning_plan"):
            if key in parsed and isinstance(parsed[key], list):
                return parsed[key]
        raise ValueError(f"Agent returned a dict but no expected list key.")

    if not isinstance(parsed, list):
        raise ValueError("Agent output is not a list.")

    return parsed


def normalise_week(raw_week: dict, idx: int) -> dict:
    """
    Coerce a raw dict from the agent into a validated dict matching RoadmapWeek.
    Handles alternate key names the agent sometimes uses.
    """
    # week number
    week_num = int(raw_week.get("week", idx + 1))

    # topic — also called 'title', 'subject'
    topic = (
        raw_week.get("topic")
        or raw_week.get("title")
        or raw_week.get("subject")
        or f"Week {week_num}"
    )

    # Extract resource_search_queries
    queries = raw_week.get("resource_search_queries", [])
    if not isinstance(queries, list):
        queries = [str(queries)]

    # Extract explore_more_questions
    explore = raw_week.get("explore_more_questions", [])
    if not isinstance(explore, list):
        explore = [str(explore)]

    # estimated_hours — also called 'hours', 'time', 'duration'
    hours_raw = (
        raw_week.get("estimated_hours")
        or raw_week.get("hours")
        or raw_week.get("time")
        or raw_week.get("duration")
        or 8
    )
    try:
        estimated_hours = int(float(str(hours_raw).split()[0]))
    except (ValueError, TypeError):
        estimated_hours = 8

    # mini_project — also called 'project', 'task', 'assignment', 'practice'
    mini_project = (
        raw_week.get("mini_project")
        or raw_week.get("project")
        or raw_week.get("task")
        or raw_week.get("assignment")
        or raw_week.get("practice")
        or "Build a small hands-on project using the week's skill."
    )

    raw_week["week"] = week_num
    raw_week["topic"] = str(topic)
    raw_week["estimated_hours"] = estimated_hours
    raw_week["mini_project"] = str(mini_project)
    raw_week["resource_search_queries"] = queries
    raw_week["explore_more_questions"] = [str(q) for q in explore if q]
    raw_week["skill_gap_addressed"] = raw_week.get("skill_gap_addressed", "General Knowledge")
    sc = raw_week.get("success_criteria", "Complete the project successfully")
    if isinstance(sc, dict):
        # LLM sometimes returns {"can_do_x": True, "can_do_y": True} format
        parts = []
        for k, v in sc.items():
            key_readable = k.replace("_", " ").capitalize()
            if isinstance(v, bool):
                if v:
                    parts.append(key_readable)
            elif v:
                parts.append(f"{key_readable}: {v}")
        sc = ". ".join(parts) if parts else "Complete the project successfully"
    elif isinstance(sc, list):
        # LLM sometimes returns ["criteria1", "criteria2"] format
        sc = ". ".join(str(item) for item in sc if item)
    raw_week["success_criteria"] = str(sc).strip() if sc else "Complete the project successfully"
    raw_week["why_it_matters"] = str(raw_week.get("why_it_matters") or raw_week.get("explanation") or f"Developing deep competency in {topic} is highly relevant for building production-grade systems.")

    # prerequisites — normalize to a clean list of strings
    prereqs = raw_week.get("prerequisites", [])
    if isinstance(prereqs, str):
        prereqs = [prereqs] if prereqs.strip() else []
    elif not isinstance(prereqs, list):
        prereqs = []
    raw_week["prerequisites"] = [str(p).strip() for p in prereqs if p]

    raw_week["completed"] = raw_week.get("completed", False)
    return raw_week
# ─────────────────────────────────────────────────────────────────────────────
# Skill Gap ↔ Topic Relevance Utilities
# ─────────────────────────────────────────────────────────────────────────────

_STOPWORDS = {
    "and", "the", "for", "with", "of", "to", "in", "a", "an", "on", "using",
    "basics", "fundamentals", "skills", "skill", "learning", "advanced",
    "introduction", "intro",
}


def _tokenize(text: str) -> set[str]:
    """Lowercase, strip non-alphanumerics, drop common filler words."""
    words = re.findall(r"[a-z0-9+#.]+", text.lower())
    return {w for w in words if w and w not in _STOPWORDS and len(w) > 1}


def score_gap_topic_relevance(skill_gap: str, topic: str) -> float:
    """
    Score how relevant a curated topic is to a skill gap (0.0 - 1.0).
    Uses token overlap with partial (prefix) matching for compound terms.
    """
    gap_tokens = _tokenize(skill_gap)
    topic_tokens = _tokenize(topic)
    if not gap_tokens or not topic_tokens:
        return 0.0

    score = 0.0
    for g in gap_tokens:
        for t in topic_tokens:
            if g == t:
                score += 1.0
            elif len(g) >= 4 and (g.startswith(t) or t.startswith(g)):
                # Partial match, e.g. "authentication" ~ "auth"
                score += 0.6
    return min(score / len(gap_tokens), 1.0)


def filter_curated_topics_by_gaps(
    curated_topics: list[str],
    skill_gaps: list[str],
    top_n_per_gap: int = 3,
) -> dict[str, list[str]]:
    """
    Map each skill gap to its top-N most relevant curated topics.
    Returns {skill_gap: [topic1, topic2, ...]} — gaps with no relevant
    curated topic map to an empty list.
    """
    mapping: dict[str, list[str]] = {}
    for gap in skill_gaps:
        scored = [
            (topic, score_gap_topic_relevance(gap, topic))
            for topic in curated_topics
        ]
        scored = [(t, s) for t, s in scored if s > 0.0]
        scored.sort(key=lambda x: x[1], reverse=True)
        mapping[gap] = [t for t, _ in scored[:top_n_per_gap]]
    return mapping


def find_closest_skill_gap(skill_gap_field: str, skill_gaps: list[str]) -> str | None:
    """
    Find the input skill gap closest to whatever the LLM produced for
    `skill_gap_addressed`. Returns None if nothing is reasonably close.
    """
    if not skill_gaps:
        return None
    scored = sorted(
        skill_gaps,
        key=lambda g: score_gap_topic_relevance(g, skill_gap_field or ""),
        reverse=True,
    )
    best = scored[0]
    return best if score_gap_topic_relevance(best, skill_gap_field or "") > 0.0 else None


def validate_skill_gap_coverage(weeks: list[dict], skill_gaps: list[str]) -> tuple[list[dict], list[int]]:
    """
    Ensure every week's `skill_gap_addressed` references one of the user's
    input skill gaps. Repairs mismatches in-place by re-mapping to the closest
    gap (cycling through gaps for weeks that match nothing).

    Returns (repaired_weeks, indices_repaired).
    """
    if not skill_gaps:
        return weeks, []

    normalized_gaps = {g.lower().strip(): g for g in skill_gaps}
    repaired: list[int] = []

    for i, week in enumerate(weeks):
        raw = str(week.get("skill_gap_addressed", "") or "").strip()
        if raw.lower() in normalized_gaps:
            week["skill_gap_addressed"] = normalized_gaps[raw.lower()]
            continue

        closest = find_closest_skill_gap(raw, skill_gaps)
        if closest is None:
            # Cycle deterministically through the gaps for unmatched weeks
            closest = skill_gaps[i % len(skill_gaps)]
        week["skill_gap_addressed"] = closest
        repaired.append(i)
        logger.debug(
            f"Week {week.get('week', i + 1)}: skill gap '{raw or '(empty)'} "
            f"did not match input gaps — repaired to '{closest}'"
        )

    if repaired:
        logger.info(f"Skill gap coverage repair applied to {len(repaired)} week(s): {repaired}")
    return weeks, repaired



def generate_fallback_roadmap(
    target_role: str,
    skill_gaps: list[str],
    language: str = "en",
) -> list[dict]:
    """
    Generate a generic, structured 8-week roadmap as a fail-safe backup.
    """
    logger.info(f"Generating fallback roadmap programmatically for '{target_role}'")
    weeks = []

    gaps = skill_gaps if skill_gaps else ["Core Concepts"]

    for i in range(8):
        week_num = i + 1

        gap_index = min(i // 2, len(gaps) - 1)
        current_gap = gaps[gap_index]

        if week_num == 1:
            topic = f"Foundations of {current_gap} and {target_role} Architecture"
            mini_project = f"Setup environment and build a basic prototype focusing on {current_gap}."
            success_criteria = "Successfully compile, run, and test the initial prototype."
            hours = 10
        elif week_num == 2:
            topic = f"Advanced {current_gap} Patterns and Systems Integration"
            mini_project = f"Extend the prototype by implementing modular structure and core data layers."
            success_criteria = "Verify modular codebase structures and validate all integrated modules."
            hours = 11
        elif week_num == 3:
            topic = f"Implementing {current_gap} in Practical Applications"
            mini_project = f"Develop a functional backend service or application component incorporating {current_gap}."
            success_criteria = "App builds successfully and passes initial local component tests."
            hours = 12
        elif week_num == 4:
            topic = f"Production Hardening and Resiliency for {current_gap}"
            mini_project = f"Add error-handling, logging, and automated unit tests to the {current_gap} service."
            success_criteria = "Verify that system handles failure states gracefully and achieves test coverage."
            hours = 13
        elif week_num == 5:
            topic = f"Scalability and Load Considerations of {current_gap}"
            mini_project = f"Implement asynchronous tasks or simple event-driven architecture with {current_gap}."
            success_criteria = "Tasks process asynchronously and queue items are handled without blocking."
            hours = 14
        elif week_num == 6:
            topic = f"Performance Optimization and Caching for {current_gap}"
            mini_project = f"Integrate a caching layer or optimize hot code paths of {current_gap}."
            success_criteria = "Demonstrate reduction in data retrieval time via cache hits."
            hours = 15
        elif week_num == 7:
            topic = f"Securing {current_gap} Implementations and API Endpoints"
            mini_project = f"Add authentication, CORS settings, or basic data encryption to {current_gap} assets."
            success_criteria = "Verify security middleware blocks unauthorized access successfully."
            hours = 16
        else:
            topic = f"Capstone Deployment and CI/CD for {current_gap}"
            mini_project = f"Write Dockerfiles, build configurations, and deploy the {current_gap} capstone project."
            success_criteria = "Application is containerized and ready for CI/CD staging pipeline."
            hours = 18

        week = {
            "week": week_num,
            "topic": topic,
            "skill_gap_addressed": current_gap,
            "estimated_hours": hours,
            "why_it_matters": f"Mastering {current_gap} is critical for qualifying as a professional {target_role}.",
            "mini_project": mini_project,
            "success_criteria": success_criteria,
            "resource_search_queries": [
                f"{current_gap} best practices",
                f"{current_gap} tutorial",
                f"{target_role} {current_gap} project"
            ],
            "explore_more_questions": [
                f"How does {current_gap} apply to high-traffic {target_role} scenarios?",
                f"What are the top 3 best practices for {current_gap}?",
                f"How can I test or debug a {current_gap} implementation?"
            ]
        }
        if language == "zh":
            week.update({
                "topic": f"{current_gap}：第 {week_num} 周进阶主题",
                "why_it_matters": f"掌握 {current_gap} 是胜任目标岗位的重要基础。",
                "mini_project": f"围绕 {current_gap} 完成一个可运行、可测试的实践项目。",
                "success_criteria": "项目可以正常运行，并通过本周目标对应的验证与测试。",
                "resource_search_queries": [
                    f"{current_gap} 最佳实践",
                    f"{current_gap} 教程",
                    f"{target_role} {current_gap} 项目",
                ],
                "explore_more_questions": [
                    f"{current_gap} 如何用于高并发业务场景？",
                    f"{current_gap} 最重要的三项最佳实践是什么？",
                    f"如何测试或调试 {current_gap} 的实现？",
                ],
            })
        weeks.append(week)

    return weeks


def build_validated_weeks(raw_content: str) -> list[dict]:
    """Parse raw JSON content and normalise into exactly 8 validated weeks."""
    raw_weeks = parse_agent_json(raw_content)
    if not raw_weeks:
        raise ValueError("Agent returned an empty roadmap.")

    weeks = [normalise_week(w, idx) for idx, w in enumerate(raw_weeks)]

    # Robust length adjustment to guarantee exactly 8 weeks
    if len(weeks) != 8:
        logger.warning(f"Agent returned {len(weeks)} weeks instead of 8. Adjusting...")
        if len(weeks) < 8:
            # Pad with additional weeks
            last_week = weeks[-1] if weeks else {}
            while len(weeks) < 8:
                new_week = last_week.copy() if last_week else {}
                new_week["week"] = len(weeks) + 1
                new_week["topic"] = f"Advanced Deep Dive in {last_week.get('topic', 'Target Role')}"
                new_week["mini_project"] = f"Build an advanced capstone component expanding on: {last_week.get('mini_project', 'previous project')}"
                new_week["estimated_hours"] = max(8, last_week.get("estimated_hours", 10))
                new_week["why_it_matters"] = "Consolidating and extending your skills is critical for senior-level proficiency."
                new_week["success_criteria"] = "Extend the previous project with additional features."
                new_week["skill_gap_addressed"] = last_week.get("skill_gap_addressed", "Advanced Architecture")
                new_week["resource_search_queries"] = last_week.get("resource_search_queries", [])
                new_week["explore_more_questions"] = last_week.get("explore_more_questions", [])
                weeks.append(new_week)
        else:
            # Truncate to 8
            weeks = weeks[:8]

    # Re-normalize and validate fields
    for i, week in enumerate(weeks):
        week["week"] = i + 1

        # Ensure non-empty topic and mini_project
        if not str(week.get("topic", "")).strip():
            week["topic"] = f"Specialized Training in Target Role (Week {i + 1})"
        if not str(week.get("mini_project", "")).strip():
            week["mini_project"] = "Build a hands-on implementation project using the week's technology."

    return weeks
