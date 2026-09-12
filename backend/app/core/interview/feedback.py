"""
Interview Feedback — structured final report.

The feedback LLM emits JSON (score + sections) which is rendered into the
markdown format the frontend already expects. A structured score means the
regex score-extractor becomes a fallback, not the primary path — eliminating
the silent default-75 problem.

The final score blends the holistic report score with the per-phase average so
the grade is grounded in per-answer evidence.
"""
from __future__ import annotations

import re
from typing import Any

from loguru import logger
from pydantic import BaseModel, Field

from app.core.interview.prompts import build_scoring_rubric
from app.core.interview.schemas import _coerce_string_list, _coerce_score


def build_structured_feedback_prompt(role: str, company: str, interview_type: str = "technical", role_level: str = "fresher") -> str:
    """System prompt for the JSON-mode final report.

    The feedback agent is grounded by (a) the same rubric as the legacy path and
    (b) the per-phase scoring table computed during the interview. Output is a
    single JSON object parsed by `parse_feedback_report`.
    """
    rubric = build_scoring_rubric(role, interview_type, role_level)
    return (
        "You are a Senior Hiring Manager producing the final written evaluation for a mock interview.\n"
        f"Company: {company}\nRole: {role}\nInterview type: {interview_type.upper()}\nExperience level: {role_level}\n\n"
        f"SCORING RUBRIC:\n{rubric}\n\n"
        "You will receive the interview transcript AND a per-phase scoring table computed by the system.\n"
        "Use the phase scores to ground your judgment, but write like a human reviewer — the report is shown to the "
        "candidate, so give specific, actionable advice rather than reciting numbers.\n"
        "Return ONLY a single valid JSON object with exactly these keys:\n"
        '{\n'
        '  "overall_score": 78,\n'
        '  "executive_summary": "one or two sentences",\n'
        '  "strengths": ["max 3 items"],\n'
        '  "improvements": ["max 3 items"],\n'
        '  "advice": ["max 3 actionable study topics"]\n'
        '}'
    )


class FeedbackReport(BaseModel):
    overall_score: float = Field(ge=0, le=100)
    executive_summary: str = ""
    strengths: list[str] = Field(default_factory=list)
    improvements: list[str] = Field(default_factory=list)
    advice: list[str] = Field(default_factory=list)


def parse_feedback_report(raw: Any) -> FeedbackReport | None:
    """Tolerant parser for the structured feedback JSON. Returns None if unusable."""
    if isinstance(raw, str):
        import json
        text = raw.strip()
        # strip fences
        m = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL)
        if m:
            text = m.group(1).strip()
        # lift outermost { ... }
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end > start:
            text = text[start : end + 1]
        try:
            raw = json.loads(text)
        except Exception:
            return None
    if not isinstance(raw, dict):
        return None

    try:
        overall = _coerce_score(
            raw.get("overall_score", raw.get("score", raw.get("final_score", raw.get("rating", ""))))
        )
    except Exception:
        return None

    return FeedbackReport(
        overall_score=round(max(0.0, min(100.0, overall)), 1),
        executive_summary=str(raw.get("executive_summary", raw.get("summary", "")) or "").strip(),
        strengths=_coerce_string_list(raw.get("strengths", []))[:4],
        improvements=_coerce_string_list(raw.get("improvements", raw.get("areas_of_improvement", [])))[:4],
        advice=_coerce_string_list(raw.get("advice", raw.get("actionable_advice", [])))[:4],
    )


def render_feedback_markdown(report: FeedbackReport) -> str:
    """Render a structured report into the exact markdown the frontend renders.

    Mirrors the output contract of the legacy feedback prompt
    (`_build_feedback_system_prompt`) so the client needs no changes.
    """
    def bullets(items: list[str], default: str) -> str:
        items = [str(i).strip() for i in items if str(i).strip()]
        if not items:
            return f"- {default}"
        return "\n".join(f"- {i[:120]}" for i in items)

    summary = report.executive_summary or "The candidate demonstrated a generally solid performance with clear areas to focus on."

    return (
        "That concludes our interview today. Thank you for your time. "
        "Here is your detailed performance analysis.\n\n"
        f"**Executive Summary:** {summary}\n\n"
        "**Strengths:**\n"
        f"{bullets(report.strengths, 'Clear communication and structured answers')}\n\n"
        "**Areas of Improvement:**\n"
        f"{bullets(report.improvements, 'Could deepen technical depth on core topics')}\n\n"
        "**Actionable Advice:**\n"
        f"{bullets(report.advice, 'Practice the listed topics with hands-on projects')}\n\n"
        f"OVERALL SCORE : {int(round(report.overall_score))}/100"
    )


def average_phase_scores(phase_scores: list[float]) -> float | None:
    """Mean of recorded per-phase scores, or None when no phases are scored."""
    if not phase_scores:
        return None
    return round(sum(phase_scores) / len(phase_scores), 1)


def combine_final_score(report_score: float | None, phase_scores: list[float]) -> float:
    """Blend holistic report score with per-phase evidence.

    - Phase average exists and report exists → 60% report, 40% phase average.
    - Only one source → that source.
    - Neither → 75.0 fallback (logged; should be near-impossible now).
    """
    phase_avg = average_phase_scores(phase_scores)

    if report_score is not None and phase_avg is not None:
        blended = round(0.6 * report_score + 0.4 * phase_avg, 1)
        logger.info(
            f"[interview] Final score = 0.6*report({report_score}) + 0.4*phase_avg({phase_avg}) → {blended}"
        )
        return blended
    if report_score is not None:
        logger.info(f"[interview] Final score from report only → {report_score}")
        return report_score
    if phase_avg is not None:
        logger.info(f"[interview] Final score from phase average only → {phase_avg}")
        return phase_avg

    logger.warning("[interview] No report score and no phase scores — falling back to 75.0")
    return 75.0