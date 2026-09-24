import json
import asyncio
from datetime import datetime, timezone
import time as _time
from loguru import logger
from fastapi import WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState
from sqlalchemy.orm import Session

from app.core.rate_limit import check_daily_limit, increment_usage
from app.core.activity import log_activity
from app.core.interview.session import (
    _get_user_from_token,
    build_compressed_resume_summary,
    _extract_interview_score,
    active_sessions,
    _purge_stale_sessions,
)
from app.core.interview.state import (
    InterviewStateMachine,
    PHASE_LABELS,
    build_evaluation_guidance,
    build_hint_instruction,
    build_followup_instruction,
)
from app.core.interview.prompts import _build_interview_system_prompt, _build_feedback_system_prompt
from app.core.interview.llm import (
    _stream_llm_response,
    _generate_feedback_non_stream,
    _generate_json_non_stream,
    _generate_interview_text_non_stream,
)
from app.core.interview.constants import get_role_category
from app.core.interview.schemas import PhaseScore
from app.core.interview.memory import reset_profile, update_candidate_profile
from app.core.interview.evaluator import evaluate_answer, RULE_FALLBACK_USED
from app.core.interview.guardrails import (
    validate_question_turn,
    validate_interviewer_text,
    validate_clean_spoken_turn,
    build_fallback_question,
)
from app.core.interview.feedback import (
    build_structured_feedback_prompt,
    parse_feedback_report,
    render_feedback_markdown,
    combine_final_score,
)


# ── Interview tuning knobs ───────────────────────────────────────────────────
TOTAL_INTERVIEW_QUESTIONS = 10
# Questions 1-9 are evaluated technical/behavioral answers.
# Question 10 is the candidate's closing Q&A ("Do you have any questions for me?"),
# and Phase 11 is the concluding response + final evaluation generation.
EVALUATED_PHASES = frozenset(range(1, 10))
MAX_HINTS_PER_PHASE = 1
MAX_FOLLOWUPS_PER_PHASE = 1
CONTEXT_RECENT_TURNS = 8       # raw last-N turns kept in the LLM context

FEEDBACK_CONCLUDING_TEMPLATE = (
    "Thank you for your time today. I've heard everything I need — I'll now put "
    "together your performance report. Have a great day!"
)


# ── Safe WebSocket Send & Close Helpers ─────────────────────────────────────

async def _safe_send_json(ws: WebSocket, payload: dict) -> bool:
    """Send JSON payload safely, return False if client disconnected."""
    try:
        if ws.client_state != WebSocketState.CONNECTED:
            return False
        await ws.send_json(payload)
        return True
    except Exception as e:
        logger.warning(f"WS send failed (client gone): {type(e).__name__}")
        return False


async def _safe_send_text(ws: WebSocket, text: str) -> bool:
    """Send raw text safely, return False if client disconnected."""
    try:
        if ws.client_state != WebSocketState.CONNECTED:
            return False
        await ws.send_text(text)
        return True
    except Exception:
        return False


async def _safe_close(ws: WebSocket, code: int = 1000) -> None:
    """Close WebSocket connection safely."""
    try:
        if ws.client_state == WebSocketState.CONNECTED:
            await ws.close(code=code)
    except Exception:
        pass


# ── Short-Lived Database Connection Helpers ─────────────────────────────────

def load_initial_interview_data(session_id: str, current_user_id: int, current_user_name: str, role: str, type: str):
    from app.core.database import SessionLocal
    from app.models.models import InterviewSession, Resume
    db = SessionLocal()
    try:
        session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
        if not session:
            try:
                check_daily_limit(current_user_id, "interview")
            except Exception as e:
                from fastapi import HTTPException
                detail = e.detail if isinstance(e, HTTPException) else str(e)
                return {"error": "limit_exceeded", "message": detail}
            session = InterviewSession(id=session_id, user_id=current_user_id, target_role=role)
            db.add(session)
            db.commit()
            db.refresh(session)
        elif session.user_id != current_user_id:
            return {"error": "unauthorized", "message": "This interview session does not belong to you."}

        chat_history = session.chat_history or []

        # Retrieve the latest resume to extract the candidate's name if available
        latest_resume = db.query(Resume).filter(
            Resume.user_id == current_user_id
        ).order_by(Resume.uploaded_at.desc()).first()

        candidate_name = current_user_name
        if latest_resume:
            if latest_resume.parsed_content and isinstance(latest_resume.parsed_content, dict):
                extracted_name = latest_resume.parsed_content.get("name") or latest_resume.parsed_content.get("candidate_name")
                if extracted_name and isinstance(extracted_name, str) and len(extracted_name.strip()) > 1:
                    candidate_name = extracted_name.strip()
            elif latest_resume.raw_text:
                for line in latest_resume.raw_text.splitlines()[:15]:
                    line_clean = line.strip()
                    if line_clean and len(line_clean) < 40:
                        lower_line = line_clean.lower()
                        if any(kw in lower_line for kw in ["@", "+1", "+91", "resume", "curriculum vitae", "cv", "portfolio", "profile", "contact", "email", "phone"]):
                            continue
                        candidate_name = line_clean
                        break

        # Build compressed resume summary if technical interview
        resume_summary = None
        if type == "technical" and latest_resume:
            class DummyUser:
                def __init__(self, name):
                    self.name = name
            dummy_user = DummyUser(current_user_name)
            resume_summary = build_compressed_resume_summary(latest_resume, dummy_user, candidate_name=candidate_name)

        return chat_history, candidate_name, resume_summary
    finally:
        db.close()


def update_session_state(session_id: str, chat_history: list = None, status: str = None, completed_at=None, score: float = None):
    from app.core.database import SessionLocal
    from app.models.models import InterviewSession
    db = SessionLocal()
    try:
        session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
        if session:
            if chat_history is not None:
                session.chat_history = chat_history
            if status is not None:
                session.status = status
            if completed_at is not None:
                session.completed_at = completed_at
            if score is not None:
                session.score = score
            db.commit()
    finally:
        db.close()


def log_interview_start(current_user_id: int, role: str):
    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        log_activity(db, current_user_id, f"Started Mock Interview for {role}", "interview")
    finally:
        db.close()


# ── Context & Prompt Builders ────────────────────────────────────────────────

def _build_llm_messages(history: list) -> list:
    """Build the interviewer's raw message list.

    Keeps the Phase-1 intro exchange (the candidate's self-introduction carries
    background that matters across all phases) plus the most recent turns.
    Structural continuity for the middle of the interview is provided by
    `_build_phase_summaries` injected into the system prompt — this closes the
    old gap where genuinely mid-interview context was dropped entirely.
    """
    if len(history) > CONTEXT_RECENT_TURNS + 2:
        intro_exchange = [m for m in history[:2] if m.get("role") in ("interviewer", "candidate")]
        recent = [m for m in history[-CONTEXT_RECENT_TURNS:] if m.get("role") in ("interviewer", "candidate")]
        selected_history = intro_exchange + [m for m in recent if m not in intro_exchange]
    else:
        selected_history = [m for m in history if m.get("role") in ("interviewer", "candidate")]

    llm_messages = []
    for msg in selected_history:
        if msg.get("content"):
            r = "assistant" if msg["role"] == "interviewer" else "user"
            llm_messages.append({"role": r, "content": msg["content"]})
    return llm_messages


def _build_phase_summaries(answer_log: list) -> str:
    """Compact per-phase outcome summary (no scores) injected into the prompt.

    Answers the plan's callback "middle interview dropped by last-N truncation":
    the interviewer gets one grounded line per completed phase instead of losing
    it entirely. Deliberately number-free so the visible interviewer can't blurt
    a score.
    """
    if not answer_log:
        return ""
    seen = {}
    for entry in answer_log:
        seen[entry["phase"]] = entry  # last evaluation per phase
    lines = []
    for p in sorted(seen):
        entry = seen[p]
        ev = entry["evaluation"]
        weak = ", ".join(ev.weak_areas) or "none noted"
        strong = ", ".join(ev.strong_areas) or "good coverage"
        lines.append(f"- Phase {p} ({entry['name']}): covered well → {strong}; gaps → {weak}")
    return "\n".join(lines)


def _compose_prompt(system_prompt: str, phase_summaries: str, *, conclude: bool, phase: int = 0, state: str = "", turn_instr: str = "") -> str:
    """Assemble the active interviewer system prompt for one turn."""
    divider = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    parts = [system_prompt]
    if phase_summaries:
        parts.append(
            "EARLIER PROGRESS — internal reference only, never quote scores or these notes to the candidate:\n"
            + phase_summaries
        )
    if conclude:
        parts.append(
            f"{divider}\nCURRENT STAGE: CONCLUDING PHASE (Phase 11)\n{turn_instr}\n{divider}\n"
            "CRITICAL RULES:\n"
            "1. Answer the candidate's question politely and concisely (1-3 sentences).\n"
            "2. Thank them warmly and conclude the interview. State that you will now evaluate their performance.\n"
            "3. Do NOT ask any further questions. Stop generating immediately."
        )
    else:
        parts.append(
            f"{divider}\nCURRENT STAGE: Question {phase}/{TOTAL_INTERVIEW_QUESTIONS} ({state})\n{turn_instr}\n{divider}\n"
            "CRITICAL RULES FOR THIS TURN:\n"
            "1. Give a brief, direct review/acknowledgment of the candidate's previous response (1-2 sentences).\n"
            "2. Ask EXACTLY ONE question for this phase. Do not combine multiple questions.\n"
            "3. Stop generating immediately after asking your single question."
        )
    return "\n\n".join(parts)


# ── Feedback Generation ──────────────────────────────────────────────────────

async def _generate_feedback_report(websocket: WebSocket, session_id: str, session_data: dict, role: str, company: str, interview_type: str, provider: str) -> float:
    """Structured final report grounded in per-phase scores; legacy fallback.

    Returns the persisted final score. Sends all feedback frames to the client.
    """
    completed_at_now = datetime.now(timezone.utc)
    role_level = session_data.get("role_level", "fresher")
    language = session_data.get("language", "en")

    # Clean transcript — same filtering as the legacy path
    clean_transcript = []
    for msg in session_data["history"]:
        role_m = msg.get("role", "")
        content = msg.get("content", "")
        msg_type = msg.get("type", "")
        if role_m == "system" or not content or msg_type == "feedback":
            continue
        if role_m in ("interviewer", "interviewer_stream", "candidate"):
            display_content = content[:2500] + "..." if len(content) > 2500 else content
            label = "Interviewer" if "interviewer" in role_m else "Candidate"
            clean_transcript.append(f"{label}: {display_content}")
    transcript_text = "\n".join(clean_transcript)

    # Per-phase grounding table (last evaluation per scored phase)
    phase_rows = {}
    for entry in session_data["answer_log"]:
        ev = entry["evaluation"]
        phase_rows[entry["phase"]] = {
            "phase": entry["phase"],
            "name": entry.get("name", PHASE_LABELS.get(entry["phase"], "")),
            "score": round(ev.score, 1),
            "verdict": ev.verdict,
            "weak_areas": ev.weak_areas[:3],
            "strong_areas": ev.strong_areas[:3],
        }
    phase_table = [phase_rows[p] for p in sorted(phase_rows)]

    final_score = 75.0
    feedback_content = ""

    try:
        payload = {
            "role": role,
            "company": company,
            "interview_type": interview_type,
            "communication_score": round(session_data["profile"].communication_score, 1),
            "transcript": transcript_text[:12000],
            "phase_evaluations": phase_table,
        }
        user_content = json.dumps(payload, ensure_ascii=False)[:12000]

        feedback_prompt = build_structured_feedback_prompt(role, company, interview_type, role_level, language)
        raw = await _generate_json_non_stream(
            [{"role": "user", "content": user_content}],
            feedback_prompt,
            agent_name="interview_feedback",
            provider=provider,
            max_tokens=700,
        )
        report = parse_feedback_report(raw)
        if report is not None:
            feedback_content = render_feedback_markdown(report, language)
            score_values = [ps.score for ps in session_data["phase_scores"].values()]
            final_score = combine_final_score(report.overall_score, score_values)
            logger.info(f"[interview] Structured feedback OK — report {report.overall_score}, blended {final_score}")
        else:
            logger.warning("[interview] Structured feedback unusable — falling back to legacy markdown generator.")
    except Exception as e:
        logger.warning(f"[interview] Structured feedback raised {e.__class__.__name__} — falling back to legacy path.")

    if not feedback_content:
        feedback_prompt_legacy = _build_feedback_system_prompt(role, company, interview_type, role_level)
        if language == "zh":
            feedback_prompt_legacy += "\nWrite the complete report in Simplified Chinese. Keep code and standard technical abbreviations unchanged."
        feedback_content = await _generate_feedback_non_stream(
            [{"role": "user", "content": f"Interview transcript:\n{transcript_text}"}],
            feedback_prompt_legacy,
            provider=provider,
        )
        final_score = _extract_interview_score(feedback_content)

    session_data["history"].append({"role": "interviewer", "type": "feedback", "content": feedback_content})
    await asyncio.to_thread(
        update_session_state,
        session_id,
        chat_history=session_data["history"],
        status="completed",
        completed_at=completed_at_now,
        score=final_score,
    )

    await _safe_send_json(websocket, {"role": "interviewer", "type": "feedback", "content": feedback_content})
    await _safe_send_json(websocket, {"role": "system", "content": "Interview Completed.", "score": final_score})
    return final_score


# ── Core WebSocket Connection Handler ────────────────────────────────────────

async def handle_websocket_connection(
    websocket: WebSocket,
    session_id: str,
    role: str,
    company: str,
    company_style: str | None,
    company_tier: str | None,
    token: str | None,
    type: str,
    provider: str,
    role_level: str = "fresher",
    language: str = "en",
    db: Session = None
):
    """Orchestrates the WebSocket connection state, LLM generation, and memory sync."""
    active_session_key = None
    session_data = None

    from app.core.database import SessionLocal
    temp_db = SessionLocal()
    try:
        current_user = _get_user_from_token(token, temp_db)
        if current_user:
            current_user_id = current_user.id
            current_user_name = current_user.name
        else:
            current_user_id = None
            current_user_name = None
    finally:
        temp_db.close()

    if not current_user_id:
        await websocket.close(code=1008)
        return

    await websocket.accept()
    await _safe_send_json(websocket, {"role": "system", "content": "Connected. Preparing your interview..."})

    # Load initial data on-demand in a short-lived DB transaction
    res = await asyncio.to_thread(load_initial_interview_data, session_id, current_user_id, current_user_name, role, type)
    if isinstance(res, dict) and res.get("error") == "limit_exceeded":
        await _safe_send_json(websocket, {
            "role": "system",
            "type": "rate_limit",
            "content": res.get("message", "Your daily interview limit has been reached."),
        })
        await _safe_close(websocket, code=1013)
        return
    if isinstance(res, dict) and res.get("error") == "unauthorized":
        await _safe_send_json(websocket, {
            "role": "system",
            "type": "error",
            "content": res.get("message", "Unauthorized session access."),
        })
        await _safe_close(websocket, code=1008)
        return

    chat_history, candidate_name, resume_summary = res
    question_count = len([
        m for m in chat_history
        if (m["role"] == "interviewer" and m.get("type") == "question")
    ])
    active_session_key = f"{current_user_id}:{session_id}"

    system_prompt = _build_interview_system_prompt(
        role,
        company,
        company_style or "",
        company_tier or "other",
        type,
        resume_summary,
        candidate_name=candidate_name,
        session_id=session_id,
        role_level=role_level
    )
    if language == "zh":
        system_prompt += (
            "\n\nLANGUAGE REQUIREMENT: Conduct the entire interview in Simplified Chinese. "
            "All questions, acknowledgements, hints, transitions, and feedback must be Chinese. "
            "Keep only source code, technical names, and standard abbreviations in English."
        )

    _purge_stale_sessions()  # Auto-purge stale cached connections

    if active_session_key not in active_sessions:
        active_sessions[active_session_key] = {
            "history": chat_history,
            "question_count": question_count,
            "system_prompt": system_prompt,
            "profile": reset_profile(),
            # The question the candidate is currently answering (resume approx.).
            "current_phase": min(max(question_count, 1), 11),
            "last_question": "",
            "phase_hint_count": 0,
            "phase_followup_count": 0,
            "phase_scores": {},   # phase → PhaseScore (last eval in phase)
            "answer_log": [],     # {phase, name, question, answer, evaluation}
            "metrics": {"invalid_response": 0, "fallback_question": 0, "hint_usage": 0, "followup_usage": 0},
            "created_at": _time.time(),
            "role_level": role_level,
            "language": language,
        }

    session_data = active_sessions[active_session_key]
    # Normalize a session object created before this schema (live reconnect).
    session_data.setdefault("profile", reset_profile())
    session_data.setdefault("current_phase", min(max(question_count, 1), 11))
    session_data.setdefault("last_question", "")
    session_data.setdefault("phase_hint_count", 0)
    session_data.setdefault("phase_followup_count", 0)
    session_data.setdefault("phase_scores", {})
    session_data.setdefault("answer_log", [])
    session_data.setdefault("language", language)
    session_data.setdefault("metrics", {"invalid_response": 0, "fallback_question": 0, "hint_usage": 0, "followup_usage": 0})

    # ── Persistent TTS Worker (lives across all messages) ──────────────────
    persistent_tts_queue = asyncio.Queue()

    async def _persistent_tts_worker():
        """Single TTS worker that processes audio for ALL messages in this session."""
        while True:
            try:
                paragraph = await asyncio.wait_for(persistent_tts_queue.get(), timeout=180)
            except asyncio.TimeoutError:
                break  # No work for 3 min — session likely idle
            if paragraph is None:
                persistent_tts_queue.task_done()
                break
            if paragraph.strip():
                try:
                    from app.core.voice.voice_engine import generate_audio_base64
                    audio_result = await generate_audio_base64(paragraph)
                    if audio_result and audio_result.get("audio"):
                        await _safe_send_json(websocket, {
                            "role": "interviewer",
                            "audio": audio_result["audio"],
                            "fragment": True
                        })
                except Exception as e:
                    logger.error(f"Persistent TTS failed: {e}")
            persistent_tts_queue.task_done()

    tts_worker_task = asyncio.create_task(_persistent_tts_worker())

    # ── Send first question if new session ────────────────────────────────
    role_category = get_role_category(role)
    if not session_data["history"]:
        state_machine = InterviewStateMachine(1)  # Initial Phase 1: Intro
        first_msg = [{"role": "user", "content": f"I am a candidate for the {role} position at {company}. Start the interview. Ask me the first question."}]

        # Inject active state instruction into system prompt
        injected_system_prompt = f"{system_prompt}\n\n{state_machine.get_prompt_instruction('', interview_type=type, role_category=role_category)}"
        try:
            msg_content = await _stream_llm_response(first_msg, websocket, injected_system_prompt, provider=provider, tts_queue=persistent_tts_queue)
        except Exception as e:
            logger.error(f"Failed to generate first interview question: {e}")
            await _safe_send_json(websocket, {"role": "system", "content": "Sorry, I encountered an issue starting the interview. Please try again."})
            await _safe_close(websocket, code=1011)
            return

        if not msg_content:
            await _safe_send_json(websocket, {"role": "system", "content": "Sorry, I couldn't generate a question. Please try again."})
            await _safe_close(websocket, code=1011)
            return

        # Intro may legitimately be an imperative ("Tell me about yourself").
        ok, reasons = validate_clean_spoken_turn(msg_content)
        if not ok:
            session_data["metrics"]["invalid_response"] += 1
            logger.warning(f"[interview] First question invalid ({reasons}) — using intro fallback.")
            msg_content = build_fallback_question(1)

        phase_1_name = PHASE_LABELS.get(1, "Introduction & Background")
        session_data["history"].append({
            "role": "interviewer",
            "type": "question",
            "content": msg_content,
            "question_number": 1,
            "total_questions": TOTAL_INTERVIEW_QUESTIONS,
            "phase_name": phase_1_name,
        })
        session_data["question_count"] += 1
        session_data["current_phase"] = 1
        session_data["last_question"] = msg_content

        await asyncio.to_thread(update_session_state, session_id, chat_history=session_data["history"])

        # Stream complete message for offline/older clients with progress metadata
        await _safe_send_json(websocket, {
            "role": "interviewer",
            "type": "question",
            "content": msg_content,
            "question_number": 1,
            "total_questions": TOTAL_INTERVIEW_QUESTIONS,
            "phase_name": phase_1_name,
        })

        increment_usage(current_user_id, "interview")
        await asyncio.to_thread(log_interview_start, current_user_id, role)

    # ── Main conversation loop ────────────────────────────────────────────
    try:
        while True:
            data = await websocket.receive_text()

            if data == "__ping__":
                await _safe_send_text(websocket, "__pong__")
                continue

            data = data.strip()
            if not data:
                continue

            session_data["history"].append({"role": "candidate", "content": data})
            await asyncio.to_thread(update_session_state, session_id, chat_history=session_data["history"])

            answered_phase = session_data.get("current_phase", 1)
            last_question = session_data.get("last_question", "")
            current_q = session_data.get("question_count", 1)

            # ── 1. Private per-answer evaluation (hidden from the candidate) ─
            evaluation = None
            if answered_phase in EVALUATED_PHASES:
                candidate_profile = session_data["profile"]
                evaluation = await evaluate_answer(
                    last_question,
                    data,
                    answered_phase,
                    experience_level=session_data.get("role_level", role_level),
                    candidate_context=candidate_profile.to_prompt_text(),
                    provider=provider,
                )
                # Deterministic, validated memory merge — replaces the racy
                # fire-and-forget background LLM profile update.
                session_data["profile"] = update_candidate_profile(candidate_profile, evaluation)
                session_data["phase_scores"][answered_phase] = PhaseScore.from_evaluation(
                    answered_phase, PHASE_LABELS.get(answered_phase, ""), evaluation
                )
                session_data["answer_log"].append({
                    "phase": answered_phase,
                    "name": PHASE_LABELS.get(answered_phase, ""),
                    "question": last_question,
                    "answer": data,
                    "evaluation": evaluation,
                })

            # ── 2. Decide next turn: hint / followup / advance / conclude ───
            if current_q >= TOTAL_INTERVIEW_QUESTIONS or answered_phase >= 10:
                # The candidate just answered the 10th question (closing Q&A)
                next_mode = "conclude"
                asked_phase = 11
            elif evaluation is None:
                next_mode = "advance"
                asked_phase = min(current_q + 1, 10)
            else:
                hint_n = session_data.get("phase_hint_count", 0)
                fu_n = session_data.get("phase_followup_count", 0)
                if evaluation.next_action == "hint" and hint_n < MAX_HINTS_PER_PHASE and (current_q + 1) < TOTAL_INTERVIEW_QUESTIONS:
                    next_mode, asked_phase = "hint", answered_phase
                    session_data["phase_hint_count"] = hint_n + 1
                elif evaluation.next_action == "followup" and fu_n < MAX_FOLLOWUPS_PER_PHASE and (current_q + 1) < TOTAL_INTERVIEW_QUESTIONS:
                    next_mode, asked_phase = "followup", answered_phase
                    session_data["phase_followup_count"] = fu_n + 1
                else:
                    next_mode = "advance"
                    asked_phase = min(current_q + 1, 10)
                    session_data["phase_hint_count"] = 0
                    session_data["phase_followup_count"] = 0

                if asked_phase == 10:
                    next_mode = "closing"

            session_data["metrics"]["hint_usage"] += 1 if next_mode == "hint" else 0
            session_data["metrics"]["followup_usage"] += 1 if next_mode == "followup" else 0

            # ── 3. Build the interviewer prompt for the next turn ───────────
            state_machine = InterviewStateMachine(asked_phase)
            transcript_prompt = _build_llm_messages(session_data["history"])
            phase_summaries = _build_phase_summaries(session_data["answer_log"])
            profile_text = session_data["profile"].to_prompt_text()

            if next_mode == "conclude" or asked_phase >= 11:
                turn_instr = state_machine.get_prompt_instruction("", interview_type=type, role_category=role_category)
                active_system_prompt = _compose_prompt(
                    system_prompt, phase_summaries, conclude=True, turn_instr=turn_instr
                )
            else:
                base_instr = state_machine.get_prompt_instruction(profile_text, interview_type=type, role_category=role_category)
                guidance = ""
                if evaluation:
                    guidance = build_evaluation_guidance(
                        evaluation.weak_areas, evaluation.strong_areas, evaluation.verdict
                    )
                if next_mode == "hint":
                    turn_instr = build_hint_instruction(guidance) + "\n\nBASE PHASE CONTEXT (same phase, do not advance):\n" + base_instr
                elif next_mode == "followup":
                    turn_instr = build_followup_instruction(guidance) + "\n\nBASE PHASE CONTEXT (same phase, do not advance):\n" + base_instr
                elif next_mode == "closing":
                    turn_instr = base_instr
                else:
                    turn_instr = f"{guidance}\n{base_instr}" if guidance else base_instr

                active_system_prompt = _compose_prompt(
                    system_prompt,
                    phase_summaries,
                    conclude=False,
                    phase=asked_phase,
                    state=str(state_machine.state.value),
                    turn_instr=turn_instr,
                )

            # Send system concluding event to block input while wrapping up
            if asked_phase >= 11 or next_mode == "conclude":
                await _safe_send_json(websocket, {"role": "system", "content": "Interview Concluding..."})

            # ── 4. Stream the interviewer turn ──────────────────────────────
            try:
                msg_content = await _stream_llm_response(transcript_prompt, websocket, active_system_prompt, provider=provider, tts_queue=persistent_tts_queue)
            except Exception as e:
                logger.error(f"Failed to generate interview question: {e}")
                await _safe_send_json(websocket, {"role": "system", "content": "Sorry, I encountered an issue. Please try again."})
                break

            if not msg_content:
                await _safe_send_json(websocket, {"role": "system", "content": "Sorry, I couldn't generate a response. Please try again."})
                break

            # ── 5. Guardrails: validate, regenerate once, then fallback ─────
            if next_mode == "conclude" or asked_phase >= 11:
                ok, reasons = validate_interviewer_text(msg_content)
                if not ok:
                    session_data["metrics"]["invalid_response"] += 1
                    logger.warning(f"[interview] Concluding turn invalid ({reasons}) — using template.")
                    msg_content = FEEDBACK_CONCLUDING_TEMPLATE
            elif asked_phase == 1:
                ok, reasons = validate_clean_spoken_turn(msg_content)
                if not ok:
                    session_data["metrics"]["invalid_response"] += 1
                    logger.warning(f"[interview] Phase-1 question invalid ({reasons}) — using fallback.")
                    msg_content = build_fallback_question(1)
            elif asked_phase == 10:
                ok, reasons = validate_interviewer_text(msg_content)
                if not ok:
                    session_data["metrics"]["invalid_response"] += 1
                    logger.warning(f"[interview] Phase-10 closing question invalid ({reasons}) — using fallback.")
                    msg_content = build_fallback_question(10)
            else:
                ok, reasons = validate_question_turn(msg_content)
                if not ok:
                    session_data["metrics"]["invalid_response"] += 1
                    logger.warning(f"[interview] Question invalid (phase {asked_phase}, {reasons}) — regenerating.")
                    regen = None
                    try:
                        regen = await _generate_interview_text_non_stream(
                            transcript_prompt + [{"role": "assistant", "content": msg_content}],
                            active_system_prompt + "\n\nYour previous reply was rejected for: " + "; ".join(reasons)
                            + ". Reply again with one short, clean question and nothing else.",
                            provider=provider,
                        )
                    except Exception as e:
                        logger.warning(f"[interview] Question regeneration failed: {e}")
                    if regen and validate_question_turn(regen)[0]:
                        msg_content = regen
                    else:
                        session_data["metrics"]["fallback_question"] += 1
                        logger.warning(f"[interview] Regeneration failed — using fallback question for phase {asked_phase}.")
                        msg_content = build_fallback_question(asked_phase)

            # ── 6. Persist turn, then send to the client ────────────────────
            phase_display_name = PHASE_LABELS.get(asked_phase, "")
            is_concluding_turn = (next_mode == "conclude" or asked_phase >= 11)
            frame_type = "concluding" if is_concluding_turn else "question"

            session_data["history"].append({
                "role": "interviewer",
                "type": frame_type,
                "content": msg_content,
                "question_number": min(asked_phase, TOTAL_INTERVIEW_QUESTIONS),
                "total_questions": TOTAL_INTERVIEW_QUESTIONS,
                "phase_name": phase_display_name,
            })
            session_data["question_count"] += 1
            session_data["current_phase"] = asked_phase
            session_data["last_question"] = msg_content
            await asyncio.to_thread(update_session_state, session_id, chat_history=session_data["history"])

            # Send complete message text with progress metadata
            if not await _safe_send_json(websocket, {
                "role": "interviewer",
                "type": frame_type,
                "content": msg_content,
                "question_number": min(asked_phase, TOTAL_INTERVIEW_QUESTIONS),
                "total_questions": TOTAL_INTERVIEW_QUESTIONS,
                "phase_name": phase_display_name,
            }):
                break

            # ── 7. Feedback after the concluding turn ───────────────────────
            if is_concluding_turn:
                await asyncio.sleep(2)  # Allow time for speech audio to play

                final_score = await _generate_feedback_report(
                    websocket, session_id, session_data, role, company, type, provider
                )
                logger.info(
                    f"[interview] Session completed. final_score={final_score}, "
                    f"metrics={session_data['metrics']}, rule_fallback={RULE_FALLBACK_USED.get('count', 0)}"
                )

                await asyncio.sleep(2)
                await _safe_close(websocket, code=1000)
                break

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected normally for session {}", session_id)
    except Exception as e:
        logger.error("Unexpected WS error for session {}: {}: {}", session_id, e.__class__.__name__, str(e), exc_info=True)
    finally:
        # Stop persistent TTS worker
        try:
            if persistent_tts_queue:
                await persistent_tts_queue.put(None)
                await asyncio.wait_for(tts_worker_task, timeout=10)
        except Exception:
            if not tts_worker_task.done():
                tts_worker_task.cancel()
        try:
            if session_data and session_data.get("history"):
                await asyncio.to_thread(update_session_state, session_id, chat_history=session_data["history"])
        except Exception:
            pass
        try:
            if session_data:
                logger.info(
                    f"[interview] Session {session_id} ended. phases_scored={sorted(session_data.get('phase_scores', {}))}, "
                    f"metrics={session_data.get('metrics', {})}"
                )
        except Exception:
            pass
        try:
            if active_session_key and active_session_key in active_sessions:
                del active_sessions[active_session_key]
        except Exception:
            pass
        logger.info(f"WS cleanup complete for session {session_id}")
