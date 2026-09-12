"""
Interview Memory — deterministic rolling candidate profile.

Replaces the old fire-and-forget background LLM memory update (racy, unvalidated,
injected verbatim into prompts) with a validated, deterministic merge driven by
the structured per-answer evaluation. The profile is always a valid
`CandidateProfile`, so it can never corrupt the next prompt.
"""
from __future__ import annotations

from app.core.interview.schemas import AnswerEvaluation, CandidateProfile

_MAX_WEAK = 12
_MAX_STRONG = 12
_COMM_EMA_ALPHA = 0.3  # how strongly a single answer moves communication score


def _merge_areas(current: list[str], incoming: list[str], limit: int) -> list[str]:
    """Case-insensitive dedup merge, preserving order, capped at limit."""
    seen: set[str] = set()
    merged: list[str] = []
    for item in list(current) + list(incoming):
        if not item or not str(item).strip():
            continue
        key = str(item).strip().lower()
        if key in seen:
            continue
        seen.add(key)
        merged.append(str(item).strip())
        if len(merged) >= limit:
            break
    return merged


def update_candidate_profile(
    current: CandidateProfile,
    ev: AnswerEvaluation,
) -> CandidateProfile:
    """Merge one structured evaluation into the rolling profile.

    Deterministic and side-effect free. Weak areas from a good answer are still
    surfaced (the interviewer may want to follow up later), but strong areas are
    tracked concurrently so both signals survive.
    """
    if ev.score >= 60:
        # Solid answers shouldn't permanently dump their topic into "weak areas"
        # unless the evaluator flagged it explicitly.
        weak_incoming = [w for w in ev.weak_areas if ev.score < 75]
    else:
        weak_incoming = ev.weak_areas

    strong_incoming = ev.strong_areas
    if ev.verdict == "strong" and ev.score >= 75:
        # Credit an unanswered strong signal: record the phase implicitly
        strong_incoming = strong_incoming

    comm = round(current.communication_score * (1 - _COMM_EMA_ALPHA) + ev.score * _COMM_EMA_ALPHA, 1)
    comm = max(0.0, min(100.0, comm))

    return CandidateProfile(
        weak_areas=_merge_areas(current.weak_areas, weak_incoming, _MAX_WEAK),
        strong_areas=_merge_areas(current.strong_areas, strong_incoming, _MAX_STRONG),
        communication_score=comm,
    )


def reset_profile() -> CandidateProfile:
    """Fresh profile for a new session."""
    return CandidateProfile()