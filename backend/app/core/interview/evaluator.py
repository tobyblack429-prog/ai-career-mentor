"""
Interview Evaluator — the private per-answer judge.

Runs AFTER the candidate answers but BEFORE the interviewer speaks, producing a
structured `AnswerEvaluation`. This is the foundation of accurate scoring and
real adaptive difficulty: the visible interviewer no longer has to evaluate,
decide, AND question in a single call.

Two tiers:
  1. LLM judge (cheap, non-streaming, JSON) — provider fallback chain.
  2. Deterministic rules fallback — never blocks the user when keys are missing
     or the provider fails.
"""
from __future__ import annotations

from loguru import logger

from app.core.config import settings
from app.core.observability import track_llm_call
from app.core.interview.llm import _get_openai_client, _is_under_cooldown, _apply_provider_cooldown
from app.core.interview.schemas import AnswerEvaluation
from app.core.llm_config import LLMConfigManager


# Process-lifetime telemetry: how often the LLM judge is unavailable and the
# deterministic heuristic carries scoring. Detects provider/accuracy regressions.
RULE_FALLBACK_USED = {"count": 0}


EVALUATOR_SYSTEM_PROMPT = """You are an expert interviewer EVALUATOR. Your job is to judge a candidate's answer to an interview question — you are NOT the interviewer and you do not ask questions.

Judge the answer for correctness, depth, structure, and communication against the expected level for the phase. Output ONLY a single valid JSON object with exactly these keys:
{
  "score": <0-100>,
  "verdict": "weak" | "acceptable" | "strong",
  "off_topic": <bool, true if the answer does not address the question>,
  "hint_needed": <bool, true if the candidate is clearly stuck or gave a very shallow answer>,
  "next_action": "hint" | "followup" | "advance",
  "weak_areas": ["<max 3 short tags, e.g. 'time complexity'>"],
  "strong_areas": ["<max 3 short tags>"]
}
Rules:
- score 0-49 reject-level, 50-74 needs improvement, 75-89 strong, 90-100 exceptional (relative to the candidate's experience level).
- next_action: "hint" if verdict is weak (give guidance and let them retry), "followup" if verdict is strong (probe deeper), otherwise "advance".
- Empty arrays are allowed; never invent concepts the candidate did not mention.
"""


def _build_evaluator_user_prompt(
    phase: int,
    question: str,
    answer: str,
    experience_level: str,
    candidate_context: str = "",
) -> str:
    context_block = f"Candidate profile so far:\n{candidate_context}\n\n" if candidate_context else ""
    return (
        f"{context_block}"
        f"Phase: {phase}\n"
        f"Experience level: {experience_level}\n\n"
        f"QUESTION ASKED:\n{question}\n\n"
        f"CANDIDATE ANSWER:\n{answer}\n\n"
        "Evaluate this single answer and return the JSON object."
    )


def _rule_based_evaluation(question: str, answer: str) -> AnswerEvaluation:
    """Deterministic heuristic evaluation used when the LLM judge is unavailable.

    Length-relative heuristics only — gives the engine a safe, non-blocking
    signal (weak answers get a hint) so adaptive difficulty still functions
    without an API key.
    """
    if not answer or not answer.strip():
        return AnswerEvaluation(score=25.0, verdict="weak", hint_needed=True, next_action="hint")

    words = len(str(answer).split())
    q_words = max(1, len(str(question).split()))
    ratio = words / q_words

    if words < 12:
        return AnswerEvaluation(score=32.0, verdict="weak", hint_needed=True, next_action="hint",
                                weak_areas=["very short answer"])
    if words < 25 or ratio < 0.5:
        return AnswerEvaluation(score=55.0, verdict="weak", hint_needed=True, next_action="hint",
                                weak_areas=["lacks depth / detail"])
    if words < 60:
        return AnswerEvaluation(score=72.0, verdict="acceptable", next_action="advance")
    return AnswerEvaluation(score=84.0, verdict="strong", next_action="followup")


async def evaluate_answer(
    question: str,
    answer: str,
    phase: int,
    experience_level: str = "fresher",
    candidate_context: str = "",
    provider: str = "groq",
) -> AnswerEvaluation:
    """Evaluate one answer. Returns a valid `AnswerEvaluation` — never raises.

    Prefers the LLM judge; falls back to deterministic heuristics on any
    provider failure or malformed output.
    """
    config = LLMConfigManager.get_agent_config("interview_evaluator")
    fallback_chain = config["fallback_chain"]

    if provider and provider not in fallback_chain:
        chain = [provider] + fallback_chain
    elif provider:
        chain = [provider] + [p for p in fallback_chain if p != provider]
    else:
        chain = fallback_chain

    user_prompt = _build_evaluator_user_prompt(phase, question or "", answer or "", experience_level, candidate_context)

    import time
    last_err: Exception | None = None

    for provider_name in chain:
        if _is_under_cooldown(provider_name):
            continue
        try:
            client = _get_openai_client(provider_name)
            start = time.time()
            if provider_name == "nvidia":
                model_name = settings.NVIDIA_MODEL
            elif provider_name in ("gemini", "google"):
                model_name = settings.GOOGLE_MODEL
            else:
                model_name = LLMConfigManager.get_model_for_agent("interview_evaluator")
            resp = await client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": EVALUATOR_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0.2,
                max_tokens=512,
            )
            content = (resp.choices[0].message.content or "").strip()
            latency = time.time() - start
            input_tokens = max(1, (len(EVALUATOR_SYSTEM_PROMPT) + len(user_prompt)) // 4)
            output_tokens = max(1, len(content) // 4)
            try:
                track_llm_call(provider_name, latency, input_tokens, output_tokens)
            except Exception:
                pass

            if not content:
                raise ValueError("Evaluator returned empty content")

            ev = AnswerEvaluation.from_raw(content)
            logger.info(
                f"[interview] Evaluator → phase={phase} score={ev.score} "
                f"verdict={ev.verdict} action={ev.next_action} (provider={provider_name})"
            )
            return ev
        except Exception as e:
            logger.warning(f"[interview] Evaluator LLM failed for {provider_name}: {e}")
            last_err = e
            msg_lower = str(e).lower()
            try:
                if "429" in msg_lower or "rate" in msg_lower:
                    _apply_provider_cooldown(provider_name)
            except Exception:
                pass

    if last_err:
        logger.warning(f"[interview] Evaluator used rule-based fallback ({last_err.__class__.__name__})")
    RULE_FALLBACK_USED["count"] += 1

    ev = _rule_based_evaluation(question or "", answer or "")
    logger.info(f"[interview] Evaluator (rule-based) → phase={phase} score={ev.score} verdict={ev.verdict}")
    return ev