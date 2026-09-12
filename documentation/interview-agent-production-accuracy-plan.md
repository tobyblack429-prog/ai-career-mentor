# Interview Agent — Production Accuracy Plan

**Scope:** Backend mock-interview engine (`backend/app/core/interview/*`)
**Goal:** Make question quality, evaluation, scoring, and context handling accurate and reliable in production — not just "an LLM that talks."
**Date:** 2026-09-12

---

## 1. Architecture & Detailed Context

### 1.1 Where it lives

| File | Role | Size |
|------|------|------|
| `backend/app/api/interview.py` | WebSocket endpoint `/ws/{session_id}`, REST history/details/delete | 3.1 KB |
| `backend/app/core/interview/websocket_manager.py` | **Orchestration engine** — session lifecycle, phase transitions, streaming, feedback, DB persistence | 23 KB |
| `backend/app/core/interview/state.py` | FSM — 8 phases (`INTRO → CORE_THEORY → HANDS_ON_CHALLENGE → PAST_EXPERIENCE → ARCHITECTURE_DESIGN → BUSINESS_DOMAIN → CLOSING → FEEDBACK → COMPLETED`) + per-phase prompt instructions | 15 KB |
| `backend/app/core/interview/prompts.py` | System-prompt builder — role category, difficulty matrix, question selection, personas, resume injection | 37 KB |
| `backend/app/core/interview/constants.py` | Question banks, company profiles, design scenarios, phase names/topics | **207 KB** |
| `backend/app/core/interview/llm.py` | Streaming LLM helper (word-stream + incremental TTS) + non-stream feedback generator; provider fallback | 12 KB |
| `backend/app/core/interview/session.py` | Resume summary builder, rolling-memory updater, **regex score extraction** | 7.5 KB |
| `backend/app/core/llm_config.py` | Per-agent provider/model/temperature/router | 7.4 KB |

### 1.2 Interview flow (as implemented)

```
Client connects  →  /ws/{session_id}?role=&company=&type=&provider=&role_level=
        │
        ▼
active_sessions[user:session]  (in-memory dict: history, question_count, system_prompt, rolling_summary)
        │
        ▼  Phase 1
Interviewer system prompt = _build_interview_system_prompt(...)
   • role → ROLE_CATEGORIES (swe/data_ai/infra_cloud/security/product_design/gaming/specialized)
   • difficulty = role_level base (intern/fresher=EASY, mid=MEDIUM, senior=HARD) + company_tier bump
   • question selected randomly from constants banks (seeded by session_id)
   • resume summary injected when present (technical interviews)
        │
        ▼  Loop (each candidate message)
1. Append candidate answer to history (full, in-memory + DB)
2. Build LLM messages = Intro exchange + last 8 turns   ← CONTEXT TRUNCATION
3. next_phase_num = question_count + 1  → FSM.get_prompt_instruction(...)
4. _stream_llm_response(...)  → streams word chunks + TTS batches to client
5. Save interviewer question, question_count += 1
6. Fire-and-forget background task _update_rolling_memory(...)   ← RACE / NO VALIDATION
7. If question_count > 7 → build condensed transcript → _generate_feedback_non_stream(...)
           → _extract_interview_score(feedback)  ← REGEX
           → persist score + status=completed → send feedback → close
```

### 1.3 Providers & models (LLMConfigManager)

| Agent | Provider | Model | Temp | Fallback chain |
|-------|----------|-------|------|----------------|
| `interview` | groq | `openai/gpt-oss-20b` | 0.65 | groq → nvidia |
| `interview_feedback` | groq | `openai/gpt-oss-120b` | 0.6 | groq → nvidia |

Streaming: `max_tokens=800`, temperature 0.65, `stream=True`. All clients are OpenAI-compatible `AsyncOpenAI` (groq / nvidia / gemini base URLs). TTS (Eleven-Labs-style `voice_engine.generate_audio_base64`) is driven per-sentence from the same stream.

### 1.4 What is *already* done well

- **Session-seeded determinism** — question selection seeded by `session_id` so reloads don't re-randomise; different sessions stay random (`local_random = random.Random(session_id)`).
- **Provider fallback chains** — interview stream and feedback both attempt groq → nvidia before failing.
- **Difficulty matrix** — `role_level` primary, `company_tier` secondary bump; junior question banks (fundamentals + junior design scenarios) exist.
- **Rolling candidate memory** — a background LLM keeps a `{weak_areas, strong_areas, communication_score}` JSON.
- **Category-specific phases** — 7 role categories each get tailored Phase 4/5/6 instructions (swe=LLD, data_ai=ML design, security=threat modeling, etc.).
- **Observability** — `track_llm_call` records latency/tokens/cost per provider; Sentry wired.
- **Safe WS helpers** — `_safe_send_json` guards closed sockets everywhere.

---

## 2. Accuracy Problem Diagnosis (root causes)

Ranked by impact on "is this interviewer accurate / fair / reliable."

### 🔴 P0-1 — Scoring is a regex over freeform prose (fragile, silent default)

`_extract_interview_score()` (session.py:130-189) parses the feedback text with 6 regex patterns and **defaults to 75.0 when nothing matches**. The feedback prompt says `OVERALL SCORE : [X]/100` but the model is free to drift. Consequences:
- A model that writes "Overall: 8/10" → 80 ✓, but "Score is nine" → 75 ✗ silently.
- Two different formats score differently; the fallback masks a prompt/compliance failure.
- A **false-neutral 75** for every unparseable interview destroys ranking accuracy and user trust.
- No per-phase/per-question scoring at all — one holistic number.

### 🔴 P0-2 — One LLM does everything (evaluate + decide + generate), and there is no private evaluation

Each turn a single streaming call is asked to (a) review the prior answer, (b) decide the next question, (c) generate it, (d) respect voice rules — all in one pass. The model never produces a structured evaluation; the "review" is only what appears in visible text. You cannot:
- score an answer objectively,
- drive difficulty from evidence,
- know when the candidate is off-topic or hallucinating,
- separate "interviewer skill" from "evaluator skill" at the model level (use a different/cheaper model for eval).

### 🔴 P0-3 — Phase advancement is a counter, not a judgment (adaptive difficulty is advertised but not implemented)

`next_phase_num = question_count + 1` (websocket_manager.py:347). Regardless of answer quality the interview advances after every Q&A. The system prompt *claims* "ADAPTIVE QUESTIONING: if weak answer, ask simpler follow-up or provide hint" — but the state machine has no branch for that. Freshers who nail everything get the same easy path as those who fail; strong candidates never get challenged within a phase.

### 🔴 P0-4 — Context truncation drops the middle of the interview

`selected_history = intro_exchange + last 8 turns` (websocket_manager.py:332-338). Phase 4/5/6 instructions *explicitly* ask the interviewer to "review their Phase 3 response / project deep-dive" — but that content may already be dropped from context. The interviewer then fabricates or asks bland questions. The resume summary is injected into the system prompt, but the candidate's *actual* spoken answers mid-interview are lost.

### 🟡 P1-5 — Rolling memory is unvalidated, racy, and can corrupt context

`_update_rolling_memory` is fire-and-forget (`asyncio.create_task`), multiple tasks overwrite `rolling_summary`, and the JSON is injected verbatim into next-turn prompts. If the evaluator returns invalid JSON once, the candidate profile dump becomes garbage in every following prompt. No `response_format` validation beyond a prompt request, no schema.

### 🟡 P1-6 — Output is unvalidated freeform text (no guardrails)

"Exactly ONE question", "no markdown/emojis", "2-4 sentences" are *prompt instructions only*. Nothing verifies them. Real failures observed in this class of app: multiple `?` in one turn, markdown leaking, role-play slippage, overly long answers. There is no retry-with-corrected-prompt, no template fallback question, no metric for *invalid-response rate*.

### 🟡 P1-7 — Feedback/scoring pipeline has no structured output

Feedback uses freeform text + regex. If we switched the evaluator to **structured output (JSON / tool-call)**, scoring becomes deterministic, per-phase scores become possible, and the regex becomes a pure fallback.

### 🟢 P2-8 — Tests cover CRUD, not accuracy

`test_career_and_interview_apis.py` covers history/detail/delete only. Nothing tests `_extract_interview_score`, `InterviewStateMachine`, `_build_interview_system_prompt`, transcript building, or guardrail validation. Prompt changes are shipped **blind** — no golden set, no regression harness.

### 🟢 P2-9 — No accuracy telemetry

Metrics track cost/latency/fallbacks, but **not**: score distribution, per-phase score, invalid-response rate, hint/follow-up usage, off-topic rate. You cannot currently measure whether any change "improves accuracy."

### 🟢 P2-10 — Reliability edges

- When all providers fail mid-interview, WS closes with a generic apology; a partial interview is saved but there's no resume/recover on reconnect.
- Groq free-tier 429s: the fallback chain mitigates, but there is no per-provider backoff/cooldown (roadmap agent recently gained rate-limit hardening — interview has not).
- `TOTAL_INTERVIEW_QUESTIONS=7` is hardcoded at websocket_manager.py:26.

---

## 3. The Plan — phased, concrete, production-grade

### Phase A — Structured, verifiable evaluation & scoring (P0)

**A1. Central evaluator — a private per-answer scoring step.**
- New module `backend/app/core/interview/evaluator.py`.
- After every candidate answer, a **cheap, non-streaming** LLM call (reuse `interview_feedback` profile, temp ~0.3) returns **structured JSON**:
  ```json
  {
    "score": 72,                 // 0-100
    "verdict": "weak|acceptable|strong",
    "off_topic": false,
    "hint_needed": true,
    "next_action": "hint|followup|advance",
    "weak_areas": ["time complexity"],
    "strong_areas": ["approach clarity"]
  }
  ```
- `response_format={"type":"json_object"}` + `pydantic` validation; fall back to a rules-based pass (length, keyword targeting) if the call fails — never block the user.

**A2. Add per-phase partial scores → DB.**
- Extend `InterviewSession` or a new `interview_phase_scores` JSON column with `{phase: {score, verdict}}` accumulated through the session.
- Final score = weighted mean of phase scores (rubric weights in config), *not* a single holistic LLM number.

**A3. Keep the regex, demote it to fallback.**
- `_extract_interview_score` remains only for the legacy feedback path; log a warning + `track_error` metric whenever the fallback fires, so silent 75s become visible.

### Phase B — Split evaluation from questioning (prompt chaining) (P0)

**B1. Turn pipeline (replaces the single-stream "evaluate+ask" call):**

```
candidate answer
   │
   ├─► EVALUATOR (hidden, cheap, JSON)   → score, verdict, hint_needed, next_action
   ├─► MEMORY UPDATE (hidden)            → validated rolling profile (pydantic)
   │
   └─► INTERVIEWER (streamed to user)    → ONE focused job: generate the next question
        • input: prior EVALUATOR verdict + candidate's last answer + phase instruction
        • does NOT "decide difficulty" — the pipeline does
        • does NOT score — the pipeline does
```

**B2. Streaming interviewer prompt slims down** to: *"You are the interviewer, Phase N, topic X. Previous answer verdict: [brief]. Ask exactly one question. Stop."* This single-responsibility change is the highest-leverage accuracy fix.

**B3. Adaptive behavior becomes real:** when `next_action == "hint"`, insert a hint sub-step (one extra interviewer turn) before advancing — *within* the phase. When `followup`, the FSM stays on the same phase. This makes the advertised "ADAPTIVE QUESTIONING" actually work and fixes P0-3.

### Phase C — Integration: state machine + context (P0/P1)

**C1. Quality-gated advancement.** `InterviewStateMachine.transition_next()` takes the evaluator verdict; a "hint/followup" counter allows stay-on-phase turns. Bump `TOTAL_INTERVIEW_QUESTIONS` → config constant (env-overridable), since hints add turns.

**C2. Fix context truncation.** Replace `intro_exchange + last 8` with a **rolling per-phase summary**: keep intro (2 msgs) + the current phase's Q&A (full) + a compact one-line summary of each earlier phase (generated by the memory agent). The interviewer always has Phase-3 context when Phase 4/5/6 asks to reference it.

**C3. Validate rolling memory.** Parse `_update_rolling_memory` output with pydantic; coerce failures to defaults; log corruption. Never inject unvalidated text into the next prompt. Race: serialize updates per-session via a lock or single-worker queue.

### Phase D — Guardrails & format enforcement (P1)

**D1. Post-stream validation pass** on the interviewer's finished text before sending the final `type=question` frame:
- exactly 1 question (`?` count), no markdown/emoji, length ≤ ~150 words, contains no "I'll give you..." role-play.
- On violation: 1 silent regeneration with a corrective suffix ("You violated the output rules: only one question, no markdown."); on second failure, fall back to a **template question** for the current phase (tiny bank in constants).
- New helper, fully unit-tested. Log every regeneration + fallback (`track_error`-style counter).

**D2. Feedback path:** have the feedback call emit structured JSON (score + sections), render to markdown for the user, and keep the regex as assertion-fallback. This guarantees the score is always present and derived from the structured field.

### Phase E — Reliability & hardening (P2)

**E1. Rate-limit backoff:** port the roadmap agent's 429 fix pattern into `_stream_llm_response` / fallback loop — per-provider cooldown (e.g., 20–30s after a 429 before retrying that provider), plus a short retry with jitter on 429 before falling through the chain.

**E2. Reconnect/resume:** persist the whole `active_sessions` entry (history, phase, rolling profile, per-phase scores) in the DB row so a reconnect after a crash can rebuild the session instead of starting over. At minimum, save phase + per-phase scores into `InterviewSession`.

**E3. Non-destructive failure UX:** when a provider chain exhausts mid-interview, send a typed error + offer "resume" rather than closing with a generic apology and losing the session.

### Phase F — Tests & evaluation harness (P1/P2 — the "how do we know it's more accurate" layer)

**F1. Unit tests** (pure, no API):
- `_extract_interview_score` — table-driven over all formats incl. failure → fallback 75 + warning.
- `InterviewStateMachine` — transitions, stay-on-phase with hints, completion.
- `_build_interview_system_prompt` — role mapping, difficulty matrix, resume injection, seeded determinism.
- New: `evaluator` JSON parsing/validation, guardrail validator, transcript reducer, rolling-memory pydantic coercion.

**F2. Golden eval set** `backend/tests/data/interview_cases.json` — 30–50 realistic Q&A pairs per category with an expected verdict/score band. CI runs evaluator over them nightly; report:
- evaluator agreement baseline,
- score regression test (mean |Δscore| vs golden),
- invalid-response rate.

**F3. Telemetry:** add counters for `interview.invalid_response`, `interview.fallback_question`, `interview.score_fallback`, per-phase score distribution, hint usage. These are the *only* way to prove accuracy improves — surface in the admin metrics endpoint.

---

## 4. Effort & sequencing (this session, realistically)

| Step | Est. effort | Depends on |
|------|-------------|-----------|
| A1 evaluator module + A3 fallback logging | ~2-3 h | — |
| A2 per-phase score persistence | ~1-1.5 h | A1 |
| B1-B3 pipeline rewire in websocket_manager | ~3-4 h | A1 |
| C1-C3 state machine + memory validation | ~2-3 h | B1 |
| D1-D2 guardrails + structured feedback | ~2-3 h | B1 |
| E1-E3 reliability | ~1-2 h | — (independent) |
| F1-F3 tests + eval + telemetry | ~3-4 h | A1-D2 |

**Recommended order:** A → B → C → D → F (accuracy core first, reliability in parallel), leaving E as follow-up session.

**Non-goals (this pass):** question-bank RAG/vectorisation (still fine in `constants.py`), multi-agent framework swap, event-driven rewrite, skill-graph visualisation, branching-tree interviews.

**Assumptions:**
- You keep Groq/NVIDIA/Gemini OpenAI-compatible clients (no new deps required for A–F except maybe `pydantic` — already present).
- WebSocket protocol stays backward-compatible: the client's existing `interviewer`, `interviewer_stream`, `feedback`, `system` frames are unchanged; new frames (e.g., `evaluator`, `hint`) are additive.
- The frontend can render a lightweight "hint" state; if not, hint sub-steps are still fine as normal `interviewer` questions (no frontend change needed).