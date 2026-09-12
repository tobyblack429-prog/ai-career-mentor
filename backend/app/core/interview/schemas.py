"""
Interview Schemas — Pydantic models shared across the interview engine.

These give structured, validated shape to the previously freeform pieces:
  - CandidateProfile  → rolling candidate memory (was an unvalidated JSON blob)
  - AnswerEvaluation  → private per-answer evaluation (was implicit in the stream)
  - PhaseScore        → per-phase partial score, persisted for the final grade
"""
from __future__ import annotations

import json
import re
from typing import Any

from loguru import logger
from pydantic import BaseModel, Field


# Aliases a raw dict might use for each field, so LLM drift doesn't break us.
_VERDICT_ALIASES = {
    "strong": {"strong", "good", "excellent", "great", "pass", "correct", "hired"},
    "weak": {"weak", "poor", "bad", "fail", "incorrect", "wrong", "confused", "lost", "struggled", "off"},
    "acceptable": {"acceptable", "ok", "okay", "average", "fair", "adequate", "passable", "moderate", "partial"},
}
_ACTION_ALIASES = {
    "hint": {"hint", "simplify", "easier", "rephrase", "guide", "nudge", "help"},
    "followup": {"followup", "follow_up", "follow up", "deepen", "deep-dive", "deep dive", "probe", "dig", "dive"},
    "advance": {"advance", "next", "proceed", "continue", "move", "progress", "pass"},
}


def _first_of(data: dict, *keys: str, default: Any = "") -> Any:
    """Return the first non-empty value among the candidate keys."""
    for k in keys:
        v = data.get(k)
        if v is not None and v != "":
            return v
    return default


def _coerce_string_list(value: Any) -> list[str]:
    if not value:
        return []
    if isinstance(value, str):
        # Accept newline- or comma-delimited lists from the model
        return [s.strip() for s in re.split(r"[,;\n]", value) if s.strip()]
    if isinstance(value, list):
        out: list[str] = []
        for v in value:
            if isinstance(v, str) and v.strip():
                out.append(v.strip())
            elif isinstance(v, (int, float)):
                out.append(str(v))
        return out
    return []


def _coerce_score(value: Any) -> float:
    """Coerce score/rating to a 0-100 float from any common format."""
    if isinstance(value, (int, float)):
        val = float(value)
        if 10 < val <= 100:
            return round(val, 1)
        if 0 <= val <= 5:   # e.g. 4.5 out of 5
            return round(val * 20, 1)
        if 0 <= val <= 10:  # e.g. 8.5 out of 10
            return round(val * 10, 1)
        return 75.0
    if isinstance(value, str):
        text = value.strip()
        m = re.search(r"(\d+(?:\.\d+)?)\s*/\s*(\d+)", text)
        if m:
            num, denom = float(m.group(1)), float(m.group(2))
            if denom > 0:
                return round((num / denom) * 100, 1)
        m = re.search(r"(\d+(?:\.\d+)?)\s*%", text)
        if m:
            v = float(m.group(1))
            return round(v, 1) if v <= 100 else 75.0
        m = re.search(r"(\d+(?:\.\d+)?)", text)
        if m:
            return _coerce_score(float(m.group(1)))
    return 75.0


def _coerce_verdict(value: Any) -> str:
    """Map any model wording back to one of strong/acceptable/weak."""
    if isinstance(value, str):
        text = value.strip().lower()
        for verdict, alias_set in _VERDICT_ALIASES.items():
            if text in alias_set:
                return verdict
        # token overlap (e.g. "very weak", "quite strong")
        tokens = set(re.split(r"\W+", text)) - {""}
        if tokens & _VERDICT_ALIASES["weak"]:
            return "weak"
        if tokens & _VERDICT_ALIASES["strong"]:
            return "strong"
        if tokens & _VERDICT_ALIASES["acceptable"]:
            return "acceptable"
        # fallback by numeric score
        score = _coerce_score(text)
        if score >= 75:
            return "strong"
        if score >= 50:
            return "acceptable"
        return "weak"
    if isinstance(value, bool):
        return "strong" if value else "weak"
    return "acceptable"


def _coerce_action(value: Any, verdict: str) -> str:
    """Map model wording back to hint/followup/advance, defaulting from verdict."""
    if isinstance(value, str):
        text = value.strip().lower().replace("_", " ").replace("-", " ")
        for action, alias_set in _ACTION_ALIASES.items():
            if text in alias_set:
                return action
        tokens = set(re.split(r"\W+", text)) - {""}
        for action, alias_set in _ACTION_ALIASES.items():
            if tokens & alias_set:
                return action
    # Deterministic default from verdict:
    if verdict == "weak":
        return "hint"
    if verdict == "strong":
        return "advance"
    return "advance"


class CandidateProfile(BaseModel):
    """Validated rolling candidate profile injected into interviewer prompts."""

    weak_areas: list[str] = Field(default_factory=list)
    strong_areas: list[str] = Field(default_factory=list)
    communication_score: float = Field(default=100.0, ge=0, le=100)

    # ── Coercion helpers ────────────────────────────────────────────────────
    @classmethod
    def from_raw(cls, raw: Any) -> "CandidateProfile":
        """Parse a raw LLM JSON blob (str or dict) into a valid profile.

        Never raises: corrupt output degrades to a default instead of poisoning
        the next prompt with garbage.
        """
        if isinstance(raw, str):
            try:
                raw = json.loads(raw)
            except Exception:
                logger.warning("[interview] Rolling profile was not valid JSON — using default.")
                return cls()
        if not isinstance(raw, dict):
            return cls()

        comm = raw.get("communication_score", raw.get("communication", 100))
        try:
            comm = float(comm)
        except (TypeError, ValueError):
            comm = 100.0
        comm = max(0.0, min(100.0, comm))

        return cls(
            weak_areas=_coerce_string_list(raw.get("weak_areas", raw.get("weak", [])))[:12],
            strong_areas=_coerce_string_list(raw.get("strong_areas", raw.get("strong", [])))[:12],
            communication_score=round(comm, 1),
        )

    def to_prompt_text(self) -> str:
        """Compact, safe representation for insertion into system prompts."""
        weak = ", ".join(self.weak_areas) or "none so far"
        strong = ", ".join(self.strong_areas) or "none so far"
        return (
            f"WEAK AREAS: {weak}\n"
            f"STRONG AREAS: {strong}\n"
            f"COMMUNICATION SCORE: {self.communication_score:.1f}/100"
        )


class AnswerEvaluation(BaseModel):
    """Structured private evaluation of a single candidate answer."""

    score: float = Field(ge=0, le=100)
    verdict: str = "acceptable"  # weak | acceptable | strong
    off_topic: bool = False
    hint_needed: bool = False
    next_action: str = "advance"  # hint | followup | advance
    weak_areas: list[str] = Field(default_factory=list)
    strong_areas: list[str] = Field(default_factory=list)

    @classmethod
    def from_raw(cls, raw: Any) -> "AnswerEvaluation":
        """Coerce a raw LLM JSON dict into a valid evaluation (tolerant)."""
        if isinstance(raw, str):
            try:
                raw = json.loads(raw)
            except Exception:
                return cls._error_default()
        if not isinstance(raw, dict):
            return cls._error_default()

        try:
            score = _coerce_score(_first_of(raw, "score", "rating", "marks", "grade", default=75))
        except Exception:
            score = 75.0

        verdict = _coerce_verdict(_first_of(raw, "verdict", "assessment", "result", "grade_level", default=""))
        action = _coerce_action(
            _first_of(raw, "next_action", "action", "next_step", "recommendation", default=""), verdict
        )

        off_topic = bool(raw.get("off_topic", raw.get("offtopic", False)))
        hint_needed = bool(raw.get("hint_needed", raw.get("needs_hint", raw.get("hint", False))))

        # overrides hint_needed if the model judged it weak/off-topic
        if verdict == "weak" and not hint_needed and action != "advance":
            hint_needed = True

        return cls(
            score=round(max(0.0, min(100.0, score)), 1),
            verdict=verdict,
            off_topic=off_topic,
            hint_needed=hint_needed,
            next_action=action,
            weak_areas=_coerce_string_list(raw.get("weak_areas", raw.get("weak", [])))[:6],
            strong_areas=_coerce_string_list(raw.get("strong_areas", raw.get("strong", [])))[:6],
        )

    @classmethod
    def _error_default(cls) -> "AnswerEvaluation":
        """Last-resort evaluation when the model output is unusable."""
        return cls(
            score=75.0,
            verdict="acceptable",
            off_topic=False,
            hint_needed=False,
            next_action="advance",
            weak_areas=[],
            strong_areas=[],
        )


class PhaseScore(BaseModel):
    """Per-phase partial score, used to weight the final grade."""

    phase: int = Field(ge=1, le=12)
    name: str = ""
    score: float = Field(ge=0, le=100)
    verdict: str = "acceptable"

    @classmethod
    def from_evaluation(cls, phase: int, name: str, ev: AnswerEvaluation) -> "PhaseScore":
        return cls(phase=phase, name=name, score=ev.score, verdict=ev.verdict)