# AI Career Mentor — Technical Q&A (Interview Prep)

> A complete technical guide to the project. Read these questions + answers to understand the
> full architecture: backend, AI agents, LLM providers, RAG/embeddings, the mock interviewer,
> Docker/CI-CD, observability, and key frontend concepts. Answers are in simple English but use
> the correct technical terms. Content is verified against `README.md`, `ARCHITECTURE.md`,
> `API.md`, and `DOCKER_GUIDE.md`.

---

## 1. Project Overview & Architecture

**Q1. What is this project?**
It is a full-stack AI career platform ("Career Orchestration Operating System"). A user uploads
their resume, and the backend runs AI agents to analyze it (ATS score, skills, gaps), generate an
8-week learning roadmap, build LinkedIn strategy, gather market intelligence, and then lets the
user practise in a live AI mock interview that streams questions over WebSocket with voice output.

**Q2. What are the two core "pillars" of the product?**
Pillar 1 is the Full Career Analysis Orchestrator — a parallel LangGraph DAG that runs Resume ATS
Auditing, Market Intelligence, LinkedIn SEO Optimization, and an 8-week RAG Roadmap in ~60 seconds
with SSE streaming. Pillar 2 is the Streaming Technical Mock Interviewer — a 7-phase Finite State
Machine (FSM) over a full-duplex WebSocket with a Monaco code sandbox, many role levels, 164 company
profiles, and automated performance scorecards.

**Q3. What is the overall architecture?**
A 5-tier decoupled system: (1) Presentation — Next.js 14 SPA on Vercel; (2) Gateway — FastAPI on
Render with middleware (CORS, SlowAPI, JWT, bcrypt, Loguru); (3) Orchestration — LangGraph DAG +
7-phase interview FSM; (4) Inference — Groq/Gemini/NVIDIA with ChromaDB RAG + web search;
(5) Persistence — PostgreSQL (Neon) + Upstash Redis, plus an Observability tier (Prometheus/Sentry).

**Q4. Which LLM providers are used and why multiple?**
Groq Cloud (`openai/gpt-oss-120b` / `gpt-oss-20b`), Google Gemini (`gemini-3.5-flash`), and NVIDIA
NIM (`nvidia/nemotron-3-super-120b-a12b`). Multiple providers give zero-downtime reliability: if one
rate-limits (429) or fails, the next provider in the fallback chain takes over automatically. Each
has a free tier, and some are better for different tasks (Gemini has high TPM for token-hungry
synthesis; Groq is fast for streaming chat).

**Q5. What is a fallback chain?**
An ordered list of providers, e.g. `["groq", "gemini", "nvidia"]`. The system tries the first one;
if it fails or is rate-limited, it automatically moves to the next, then the next, until one works
or all fail. Each agent has its own chain defined in `llm_config.py`.

**Q6. How are providers assigned to agents?**
Through a central config file (`llm_config.py`) with an `AGENT_PROFILES` dict. Each agent has a
capability (structured_json, reasoning, creative, fast_streaming, cheap) and a default
provider + model + temperature + fallback chain. This is the "Model Router".

**Q7. How is the repo structured?**
A dual-workspace monorepo. `backend/` is the FastAPI app (`app/` with agents, api, core, models,
data), tests, Alembic migrations, and Dockerfile. `frontend/` is the Next.js client. Root holds
`docker-compose.yml`, `render.yaml`, `ci.yml`, `start.bat`, and the Postman collection.

**Q8. What helper scripts exist at the root?**
`start.bat` (Windows launcher that boots backend + frontend), `clear_cache.py` (Redis cache
eviction), `clear_db.py` (database reset/purge utility), and `backend/scripts/validate_resources.py`
(validates seed-resource links and format).

---

## 2. Backend & API Layer

**Q9. Why FastAPI instead of Flask/Django?**
FastAPI is async-native (great for SSE and WebSockets), auto-generates OpenAPI/Swagger docs, has
built-in Pydantic request validation, and performs very well. It fits real-time AI streaming well.

**Q10. What is the request flow?**
A request hits FastAPI middleware (CORS check → request duration logger → SlowAPI rate limiter →
JWT verification), then routes to an endpoint, which calls an agent via the LLM client, and returns
a JSON/SSE/WebSocket response.

**Q11. What middleware is used?**
CORS middleware (allowed origins from `.env`), a custom `log_requests` middleware that logs every
request with duration and origin, SlowAPI for per-IP throttling, and a JWT auth dependency for
protected routes.

**Q12. What is SSE and where is it used?**
Server-Sent Events is a one-way HTTP stream where the server pushes chunks of text to the client.
It is used in `/career/full-analysis/stream` to send live progress logs while the 4 agents run in
parallel, so the user sees the analysis happening in real time instead of waiting with a spinner.

**Q13. Why SSE for the analysis but WebSocket for the interview?**
SSE is one-way (server → client) and is perfect for progress logs. The interview is two-way
(candidate answers → interviewer responds → streaming voice), so it needs the full-duplex
WebSocket protocol.

**Q14. What is a WebSocket and how does the project use it?**
WebSocket is a persistent, full-duplex TCP-based protocol. The mock interview opens a WebSocket at
`/interview/ws/{session_id}`. The interviewer streams questions token-by-token, the candidate sends
answers and code updates, and the server keeps the connection alive with `__ping__`/`__pong__`
heartbeats.

**Q15. What are the main REST endpoints?**
Auth (`POST /auth/register|login|google|refresh`), Resume (`POST /resume/upload|analyze`), Roadmap
(`POST /roadmap/generate`, `GET /roadmap/history`, `PUT /roadmap/{id}/toggle-week/{week}`,
`DELETE /roadmap/{id}`), Market (`GET /market/config|trends|history`, `DELETE /market/{id}`),
LinkedIn (`POST /linkedin/optimize`), Career (`POST /career/full-analysis/stream`), Interview
(`WS /interview/ws/{session_id}`, `GET /interview/history`, `GET|DELETE /interview/{session_id}`),
User (`GET /user/stats`), Health (`GET /health|/ping|/`), and Admin (`GET /admin/metrics`,
`GET /admin/prometheus-metrics`).

**Q16. What are the health endpoints?**
`GET /health` (open — reports database/Redis connectivity), `GET /ping` (open — liveness check),
and `GET /` (root). They let load balancers and uptime monitors verify the API is alive.

**Q17. How are API endpoints protected?**
Most routes require a JWT access token in the `Authorization: Bearer <token>` header. Admin routes
additionally check that the user's email is in a whitelist. Google OAuth and email+password both
issue the JWT.

**Q18. What does the `log_requests` middleware do?**
It logs every HTTP request (method, path, origin, status, response time) using loguru, and also
feeds request counts to the observability metrics system.

**Q19. What is the admin-only observability endpoint?**
`GET /admin/metrics` returns active users, active WebSockets, per-provider latency arrays, error
logs with tracebacks, historical daily rollups, and cost breakdowns. `GET /admin/prometheus-metrics`
exposes raw Prometheus-format metrics. Both are restricted to the whitelisted admin email.

**Q20. What is the difference between `/user/stats` and `/admin/metrics`?**
`/user/stats` returns the current user's usage, remaining daily feature limits, and gap-lock
cooldowns ("unlocks in Xd Xh"). `/admin/metrics` is platform-wide telemetry visible only to admins.

---

## 3. LLM Multi-Provider System & AI Agents

**Q21. What is the Agent Registry?**
`registry.py` is the single "LLM execution layer". It exposes `call_llm()` which handles retries,
circuit breaking, provider selection, and structured JSON parsing. No agent calls an LLM directly;
every agent goes through the registry.

**Q22. How does `call_llm` work step by step?**
1. Build the fallback chain from the agent config.
2. Filter out providers whose API keys are not configured.
3. Skip providers whose circuit breaker is open.
4. Try the active provider up to 2 times.
5. On failure, trip its circuit breaker and move to the next provider.
6. On success, reset the breaker and optionally parse the response into a Pydantic model.

**Q23. What is a circuit breaker?**
A safety pattern. When a provider fails repeatedly, the breaker "opens" and stops sending requests
to it for a while so it can recover. Our breaker trips after failures, disables the provider for an
exponential window (20s base, up to 120s cap), then goes half-open and tries one probe request.

**Q24. What are the retry settings?**
Each provider is tried up to 2 times with a small sleep between attempts. Retries continue across
the whole fallback chain, so a request can hit groq twice, then gemini twice, then nvidia twice.

**Q25. What happens on 401/402/403 errors?**
These are permanent errors (wrong key / no payment / forbidden). Retrying never fixes them, so the
registry does a "fail-fast": it raises `ProviderAuthError`, disables that provider for 1 hour, and
immediately moves to the next provider instead of wasting retries.

**Q26. What is `ProviderAuthError`?**
A custom exception used to signal billing/authentication failures (401 Unauthorized, 402 Payment
Required, 403 Forbidden). It is checked by `_is_permanent_provider_error` to trigger fail-fast.

**Q27. How does JSON mode work?**
When an agent passes a Pydantic `response_model`, the registry sends the request with `json_mode`
enabled so the model returns JSON. The response is then extracted, cleaned, normalized, and
validated against the Pydantic model before being returned.

**Q28. What is `parse_json` used for?**
It is a resilient JSON extractor. It strips markdown fences (```json ... ```), extracts the first
JSON object/array from surrounding text, fixes trailing commas and bad backslash escapes, and only
then tries to parse it. This handles LLM output that is not perfectly clean.

**Q29. How are the three providers actually called?**
`_call_groq` uses the Groq SDK, `_call_nvidia` uses the OpenAI-compatible NVIDIA endpoint, and
`_call_gemini` calls Google's OpenAI-compatible endpoint
(`https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`). All of them return
`(text, input_tokens, output_tokens)`.

**Q30. What is `llm_client.py` for?**
It is a thin wrapper that reads the per-agent config from `LLMConfigManager` and calls
`registry.call_llm` with the right provider, model, temperature, and fallback chain. It keeps the
agents' code clean.

**Q31. Which agent uses which provider by default?**
`resume` → groq, `market` → gemini, `market_intelligence` → gemini, `linkedin` → gemini,
`roadmap_structure` → groq, `roadmap_details` → groq, `interview` → groq (fast streaming),
`interview_feedback` → groq. Gemini is used where high token-per-minute capacity matters.

**Q32. What is a temperature parameter?**
It controls creativity. Low temperature (0.2-0.3) gives focused, deterministic answers — good for
structured JSON. High temperature (0.7) gives more varied, creative output — good for LinkedIn
headlines.

**Q33. How is cost measured?**
Every successful call returns token counts. `observability.py` computes estimated cost using a
per-provider pricing table and accumulates it per provider (groq_cost, nvidia_cost, google_cost,
openrouter_cost) in memory, Redis, and the `DailyAnalytics` table.

---

## 4. RAG & Embeddings

**Q34. What does RAG stand for and what does it mean here?**
Retrieval-Augmented Generation. Instead of the LLM answering from memory alone, we first "retrieve"
relevant documents from a knowledge base, then "augment" the prompt with them, then "generate" the
answer. Here it supplies gold-standard learning resources for the roadmap.

**Q35. Which embedding model is used?**
`all-MiniLM-L6-v2` — a sentence-transformer model that converts text into a 384-dimensional vector.
It is the default embedding function of ChromaDB, auto-downloaded and run locally via ONNX.

**Q36. Which vector database is used?**
ChromaDB, as a `PersistentClient`. It is a local, on-disk vector database — there is no cloud
vector service. The collection is named `resource_kb`.

**Q37. Where are the embeddings stored?**
On disk in the `./chroma_db` folder (with a `/tmp/chroma_db` fallback). ChromaDB persists the
vectors, documents, and metadata in that directory.

**Q38. What is the seed data for the vector DB?**
`backend/app/data/curated_resources.json` — around 200 gold-standard resources, each with a topic,
title, and article/github/doc/youtube URLs (GeeksforGeeks, official docs, GitHub repos, etc.).

**Q39. How does the seeding process work?**
At startup, `rag_engine.auto_seed()` runs (`main.py`). For each resource it builds the document
text `"Topic: {topic} | Title: {title}"`, stores the URLs as metadata, and calls
`collection.add()`. ChromaDB automatically embeds every document with all-MiniLM-L6-v2. If the
collection already has the same count, seeding is skipped to avoid duplicates.

**Q40. How does retrieval (query) work?**
`rag_engine.query_similarity(topic, n_results=5)` embeds the query with the same model and runs a
cosine-similarity search (`collection.query`). The distance is converted to a similarity score
(`1 - distance`), and the top matches with their metadata are returned.

**Q41. What happens if ChromaDB is unavailable?**
Two fallbacks. On Render (low memory) ChromaDB is disabled at startup to avoid an OOM crash, and a
simple keyword-matcher scores the JSON resources in memory. In `search_engine.py`, if the RAG miss
or fails, it falls back to real web search (DuckDuckGo + Dev.to) with URL validation and scoring.

**Q42. What is the OOM prevention strategy on Render?**
Render runs on 512MB RAM, so loading the embedding model in memory can crash the app. The system
detects low memory at startup and switches from ChromaDB vector similarity to an in-memory keyword
matcher so the roadmap still gets resources without the crash.

**Q43. What extra matching rules run on top of the vector search?**
The roadmap's `fetch_resources_for_topic` re-checks each candidate with
`SequenceMatcher` similarity ≥ 0.50, substring match, or ≥60% word-overlap. This makes sure the
chosen resource really matches the week's topic even if the embedding is weak.

**Q44. Is the resume agent also vector RAG?**
No. The resume agent's "RAG" is actually role-benchmark injection. It loads
`resume_rag_pipeline.json`, which has per-role gold-standard skills, toolchains, action verbs, and
core concepts, and injects them into the LLM prompt so the model evaluates the resume against the
right benchmarks. No embeddings are involved there.

**Q45. How does the roadmap prompt stay aligned with the vector DB?**
The roadmap prompt includes an "RAG alignment rule" listing the exact pre-seeded topic strings and
tells the LLM to reuse them as the `topic` field. This way the generated weeks match the seeded
topics and the vector search actually finds resources.

---

## 5. Resume Agent & ATS Engine

**Q46. How does the resume agent work?**
It is a hybrid: a deterministic ATS engine computes a structural score (keywords, achievements,
action verbs, formatting), and then an LLM agent extracts skills, experience, strengths, and gaps,
producing a Pydantic-validated `ResumeAnalysisModel` that combines both.

**Q47. What is the 4-layer PDF validation?**
Every uploaded PDF is checked in order: file extension must be `.pdf` → MIME type must be
`application/pdf` → magic bytes must start with `%PDF-` → file size must be ≤ 5MB. Any failure
rejects the upload before it is parsed. This prevents malicious/non-PDF uploads.

**Q48. How is text extracted from the PDF?**
Using `pdfplumber` — a Python library that parses the PDF structure and extracts the text layer.
No heavy OCR is needed because resumes are digital text PDFs.

**Q49. What does the ATS scorer check?**
It checks the resume against role data: presence of gold-standard skills, tools, and core concepts
(keywords, using 120+ skill aliases), quantified achievements, action verbs, and formatting/length.
The four sub-scores sum to the final ATS score.

**Q50. What is date-range merging in the ATS engine?**
The engine parses work-experience date ranges and merges overlapping/adjacent ranges so the total
experience years are computed correctly instead of double-counting parallel jobs. It also
normalizes experience into a consistent format.

**Q51. What does "ATS cap enforcement" mean?**
The ATS score is capped/normalized so an extremely keyword-dense resume cannot game the system —
the score stays meaningful and comparable across candidates. Experience is also normalized per role
level before scoring.

**Q52. How is resume text handled before the LLM sees it?**
It is sanitized (braces and code fences removed, whitespace normalized), truncated to a max length
(6000 chars), and marked as untrusted input in the prompt to prevent prompt injection.

**Q53. What is injected from `resume_rag_pipeline.json`?**
When a target role is specified, the pipeline injects gold-standard skills, common toolchains,
action verbs, and experience benchmarks for that role into the LLM prompt, so the evaluation is
benchmarked against real expectations for the role.

**Q54. What does the final resume output contain?**
A Pydantic-validated analysis: overall ATS score, per-section scores, extracted skills, experience
breakdown, strengths, skill gaps, and role-match recommendations. It is saved to the database and
cached.

---

## 6. Roadmap Agent

**Q55. What does the roadmap agent generate?**
An 8-week personalized learning plan built from the candidate's skill gaps. It first creates a
skeleton (roadmap_structure), then expands each week with details (roadmap_details), and finally
enriches every week with real learning resources via the RAG/web-search engine.

**Q56. What is the 3-phase LLM generation?**
Phase 1 generates the 8-week topic skeleton. Phase 2 fills in detail in batches of 3+3+2 weeks
(a chunking pattern for token efficiency so the LLM never processes all 8 weeks at once). Phase 3
enriches each week with resources.

**Q57. How is resource enrichment done in parallel?**
Using `ThreadPoolExecutor`, the system searches DuckDuckGo concurrently for YouTube, GitHub,
articles, and official docs across all 8 weeks — this is much faster than searching week by week
sequentially.

**Q58. What is quality-weighted search scoring?**
Each candidate URL is scored against a domain quality map (e.g. `roadmap.sh: 40`, `github.com: 25`,
`medium.com: 5`), validated for HTTP reachability, and deduplicated so lower-quality or broken links
are filtered out and the same link is never suggested twice.

**Q59. What does each roadmap week contain?**
Topic, learning objectives, `prerequisites` (skills you must know first), a hands-on `mini_project`
with `success_criteria`, and resource links split into `youtube_resources`, `article_resources`,
`github_resources`, and `official_docs`.

**Q60. How is progress tracked?**
The user toggles week completion with `PUT /roadmap/{id}/toggle-week/{week}`. Completion is stored
in the database and the roadmap shows which weeks are done, with completion scoring flags.

**Q61. How does the roadmap know which topics to use?**
The prompt includes the curated topic list and the candidate's skill gaps. The LLM maps each week's
subject to a pre-seeded topic (for RAG matching) or generates a short clean search keyword.

**Q62. How does the roadmap pipeline run inside the full analysis?**
In `workflow.py` there are nodes: `resume_node`, `market_node`, `linkedin_node`, and
`roadmap_aggregator_node`. Resume and market run in parallel, then LinkedIn and roadmap run with
the results — a LangGraph-style parallel DAG.

---

## 7. Market Intelligence Agent

**Q63. What does the market agent do?**
It scrapes live job boards for a target role + location, normalizes salary ranges to local currency,
identifies top hiring companies, and surfaces the most in-demand skills for that region. Endpoint:
`GET /market/trends`.

**Q64. What is the search fallback chain?**
Tavily API (primary, agentic search) → Serper API (Google search fallback) → DuckDuckGo (free,
zero-key fallback). If a key is missing or the call fails, the system moves to the next engine so
market data is still produced.

**Q65. What is URL classification?**
Each scraped URL is classified as `job_portal`, `blog`, or `other`. Job-portal results get priority
weighting because they are the most authoritative source of real hiring data.

**Q66. How does salary normalization work?**
The location is mapped to a region and currency (INR, USD, GBP, EUR, AED, SGD, AUD). Deterministic
region-based salary bands and seniority-level multipliers are computed, then merged with LLM-extracted
hiring trends (temperature 0.2 for deterministic output) and validated with Pydantic.

**Q67. Why is the market agent a "deterministic + LLM hybrid"?**
Currency detection, salary bands, and multipliers are computed deterministically (no hallucination
risk), while hiring trends, company lists, and skills are extracted by the LLM from the scraped
content. Merging both gives accurate numbers with rich context.

**Q68. How is market data cached and stored?**
Results are saved to the database (`MarketAnalysis` records, browsable via `GET /market/history`,
deletable via `DELETE /market/{id}`). Redis caches scraped outputs for 12 hours so repeated requests
don't re-scrape.

**Q69. What does `GET /market/config` return?**
The available roles, locations, and currencies the frontend dropdowns use, so the UI stays in sync
with what the backend supports.

---

## 8. LinkedIn Optimizer

**Q70. How does the LinkedIn agent work?**
`POST /linkedin/optimize` takes a target role, loads the user's latest resume analysis from the
database automatically, and generates a personalized LinkedIn strategy — headlines, About section,
skills, and keywords — instead of generic advice.

**Q71. What does "resume-aware" mean here?**
The agent queries the DB for the latest `ResumeAnalysisModel` and injects the user's actual skills,
strengths, gaps, and experience into the LLM prompt. The strategy is tailored to the real profile.

**Q72. What is ATS keyword injection?**
The output surfaces high-frequency recruiter search terms (e.g. "Scalability", "Distributed
Systems", "CI/CD") and tells the user to inject them into their profile for maximum LinkedIn search
visibility.

**Q73. How many headlines does it generate?**
Three optimized headline variants, each with emoji, action verbs, and high-converting keyword
density patterns used by top LinkedIn profiles.

**Q74. What is the programmatic fallback?**
If the LLM call fails, a deterministic fallback generates a basic strategy from the resume skills +
target-role keywords, so the user always gets something useful even during an outage.

---

## 9. Full Career Analysis (LangGraph DAG)

**Q75. What is the Full Career Analysis?**
`POST /career/full-analysis/stream` runs all 4 agents (resume, market, linkedin, roadmap) in one
SSE stream. The user pastes resume text + target role + location and gets a complete career report
after ~45-60 seconds.

**Q76. How does the LangGraph DAG orchestration work?**
Phase 1 fans out the Resume and Market nodes concurrently (latency = `max(resume, market)`). Phase 2
fans in and triggers the LinkedIn + Roadmap nodes concurrently. This makes total latency ~45-60
seconds instead of ~3-4 minutes sequential.

**Q77. How is state shared safely across parallel nodes?**
LangGraph's `CareerState` uses `Annotated[List[str], operator.add]` for the `logs` and `errors`
fields, allowing parallel nodes to safely append without race conditions.

**Q78. What is the Pydantic repair loop?**
Each agent's output is validated against its Pydantic model (`ResumeAnalysisModel`,
`MarketTrendsModel`, `LinkedInStrategyModel`, `RoadmapModel`). On validation failure, a repair loop
retries with corrective instructions until valid output is produced.

**Q79. What SSE event types are streamed?**
`log` events for every node start, fallback, and completion ("Started Resume Analysis...", "Market
Node Complete..."), plus a final `result` event carrying the complete career report.

**Q80. How are results persisted?**
On successful completion, ALL results (resume, market, roadmap, LinkedIn) are persisted to Postgres
in a single atomic transaction, so either everything is saved or nothing is.

**Q81. What is the gap lock on this feature?**
1 request/day with a 7-day Redis gap lock after success, to manage the heavy LangGraph token cost.

---

## 10. Interview System & WebSocket

**Q82. What is the Interview State Machine?**
A Finite State Machine with phases: INTRO, CORE_THEORY, HANDS_ON_CHALLENGE, PAST_EXPERIENCE,
ARCHITECTURE_DESIGN, BUSINESS_DOMAIN, CLOSING, FEEDBACK. Each phase injects different system
instructions into the LLM, and transitions happen automatically after each Q&A exchange.

**Q83. How are interview questions made role-specific?**
The role is mapped to a category (`swe`, `data_ai`, `infra_cloud`, `security`, `product_design`,
`gaming`, `specialized`) via `get_role_category`. Each category has its own phase-2 topic, coding
challenge bank, and system-design scenario. Phases 1–3 are universal; phases 4–6 are category-specific.

**Q84. How is difficulty chosen?**
Based on the role level (intern/fresher → EASY, mid → MEDIUM, senior → HARD). Role level is the
PRIMARY lever; premium company tiers (e.g. FAANG) bump difficulty up one step, capped at HARD.

**Q85. What are the 7 role categories and their phases 4–6?**
SWE → project deep-dive + system design + debugging; Data/AI → ML case study + pipeline design +
model optimization; Infra/Cloud → K8s troubleshooting + architecture + incident response; Security →
threat modeling + zero-trust design + forensics; plus product_design, gaming, and specialized.

**Q86. What are the 164 company profiles?**
A curated list of target companies (Google, Amazon, startups, etc.). Each has a company-specific
style (Google GCA, Amazon LP, Microsoft AZ) that customizes the behavioral focus, and FAANG-tier
companies get harder questions than startups.

**Q87. How is the candidate's resume used in the interview?**
On connection, the backend loads the latest resume from the database and injects skills, projects,
and experience into the interviewer's system prompt. Phase 4 (PAST_EXPERIENCE) specifically
deep-dives into YOUR projects.

**Q88. How does streaming work in the interview?**
`_stream_llm_response` streams tokens from the LLM and sends them over the WebSocket as they
arrive. The frontend renders them live, then the text is also sent to TTS to generate voice.

**Q89. How does the Monaco code editor work?**
During Phase 3 (Coding Challenge), the candidate writes code in an embedded VS Code editor (Monaco).
They submit via `code_update` messages, and the interviewer evaluates correctness and complexity.

**Q90. How does the edge-tts voice pipeline work?**
LLM text tokens are buffered into sentences (look-ahead regex on `. ! ? \n`), pushed to a
`tts_queue`, and processed by a persistent background worker. Cache hit → sends cached base64 audio;
cache miss → edge-tts generates MP3 (semaphore 2 limits concurrency), encodes to base64, caches it,
and streams it to the WebSocket as `fragment: true` audio using `en-US-AndrewNeural`.

**Q91. How is the TTS worker lifecycle managed?**
The TTS worker runs persistently across the whole session (not recreated per message), with a queue
drain + 120s idle timeout. This avoids re-initializing the engine every turn.

**Q92. What is the resilient audio queue on the client?**
Client-side audio chunks have `onerror` handlers so a failed chunk doesn't stall playback. The queue
drains automatically with retry logic, keeping speech continuous.

**Q93. How is the interview feedback scored?**
Level-aware: Intern/Fresher get a lenient bar ("clear reasoning, solid fundamentals"), Mid gets
standard, Senior gets strict ("production-grade reasoning, edge-case mastery"). The transcript is
cleaned to only Q&A pairs (no metadata) before sending to the LLM, to prevent prompt echoing.

**Q94. What is the rolling summary / token compression?**
As the interview progresses, earlier context is compressed into a rolling summary so the LLM
"remembers" the candidate without re-sending the entire transcript — saving tokens and keeping calls
fast (`session.py`).

**Q95. What is the keepalive ping-pong?**
Clients send `__ping__` every 30 seconds and the server replies with `__pong__`. This prevents cloud
proxies (Render) from timing out the idle WebSocket.

**Q96. What happens when the daily interview limit is hit?**
`websocket_manager` sends a `rate_limit` system message and closes the connection with code 1013.
The frontend shows a "Daily Limit Reached" blocked screen instead of silently failing.

**Q97. How are stale sessions cleaned?**
`_purge_stale_sessions` removes abandoned/expired sessions so the in-memory session store does not
grow forever.

---

## 11. Authentication, Rate Limiting & Security

**Q98. How does authentication work?**
Email+password (bcrypt-hashed) or Google OAuth. On success the server signs a JWT (access token
valid 60 minutes, refresh token 30 days). Protected endpoints verify the JWT signature and expiry.

**Q99. How does the token refresh flow work?**
When the access token expires, the client calls `POST /auth/refresh` with the refresh token to get
a new access token. The frontend axios client auto-refreshes expired tokens on 401 responses.

**Q100. What is SlowAPI?**
A middleware-based rate limiter that throttles per-IP request rates (100 req/hr). In development it
uses a `memory://` backend; in production it uses Redis.

**Q101. What is a gap lock?**
A cooldown period after the per-feature daily limit is reached. Each feature has a daily cap
(mostly 1/day) and a gap: full_analysis 7 days, resume 2 days, roadmap 5 days, interview 7 days,
market and linkedin 0. `/user/stats` returns `gapBlocks` with remaining seconds, and the dashboard
shows a countdown.

**Q102. How is Redis used?**
Upstash Redis stores rate-limit counters, gap locks, WebSocket session data, response caches, and
cost metrics. If Redis is unavailable, the system falls back to in-memory tracking so the app still
works (with weaker cross-worker guarantees).

**Q103. How is prompt injection prevented?**
User resume text is treated as untrusted: it is sanitized (braces/backticks stripped, whitespace
normalized), truncated, and labelled "RAW RESUME TEXT (UNTRUSTED USER INPUT)" in the prompt, and
the interviewer prompt strictly forbids roleplay/instruction-following from user input.

**Q104. How is admin access controlled?**
The `/admin/*` routes verify both a valid JWT and that the user's email is in the admin whitelist
(`ADMIN_EMAIL`, default `admin@example.com`). Only that account can view observability
metrics.

**Q105. How are rate limits bypassed in development?**
When `APP_ENV=development` and `DEBUG=True`, the rate-limit and gap-lock checks are automatically
skipped so developers can test features repeatedly.

---

## 12. Database & Persistence

**Q106. Which databases are used and why?**
PostgreSQL (Neon, serverless) in production and SQLite locally. Redis (Upstash) for fast
state/limits. ChromaDB for vectors. SQLAlchemy is the ORM and manages connection pooling.

**Q107. What is the SQLite production guard?**
SQLite is only allowed as a dev/CI database. The app raises an error if `DATABASE_URL` points to
SQLite in a production environment, forcing a real Postgres database.

**Q108. How is the connection pool tuned?**
SQLAlchemy is configured with `pool_size=3 / max_overflow=5` to fit Render's 512MB RAM while still
handling concurrent requests without exhausting connections.

**Q109. What is Alembic?**
The database migration tool. `backend/alembic/versions/*` hold versioned schema migrations, applied
with `alembic upgrade head`. It keeps local and production schemas in sync.

**Q110. What main tables exist?**
Users, resumes/analyses, roadmaps (with week completion), market analyses, interview sessions and
scorecards, and `DailyAnalytics` for cost/request rollups.

---

## 13. Observability & Admin

**Q111. What is tracked by observability?**
Active users, active WebSockets, per-provider latency arrays, error logs with tracebacks, historical
daily rollups, and cost breakdowns. Admin views these at `/admin/metrics`.

**Q112. What is the Loguru global error sink?**
A Loguru handler intercepts all `logger.error` and `logger.critical` events backend-wide, captures
the traceback, and pipes it directly into the Admin dashboard's error-log stream — no manual wiring
per module.

**Q113. How is Prometheus integrated?**
`prometheus-fastapi-instrumentator` exposes raw metrics at `/metrics` for Prometheus scraping,
alerting, and Grafana visualization. `/admin/prometheus-metrics` surfaces them to admins.

**Q114. How is Sentry integrated?**
`init_sentry()` runs at app startup with `SENTRY_DSN`; runtime crashes and exceptions are captured
for production error monitoring.

**Q115. How is cost data persisted?**
A `DailyAnalytics` table stores per-day request/token/cost columns for each provider. The admin
endpoint reconciles in-memory and Redis totals with the database to get the true all-time cost.

**Q116. What is `ENABLE_OBSERVABILITY`?**
A config toggle. Set to `false` to bypass Redis cost rollups entirely (for minimal deployments).

---

## 14. Docker & Deployment

**Q117. How is the backend containerized?**
A 2-stage Dockerfile on `python:3.11-slim`: a builder stage installs compile dependencies, then a
runner stage copies only runtime requirements, uses a non-root user, and exposes port 8000.

**Q118. How is the frontend containerized?**
A 3-stage Dockerfile: `deps` (npm ci caching) → `builder` (production compilation) → `runner`
(execution). It uses Next.js `output: standalone`, shrinking the final image by ~85%.

**Q119. What does docker-compose run?**
Three services: FastAPI backend (port 8000), Next.js frontend (port 3000), and Redis (port 6379).
`docker-compose.yml` is dev with hot-reload; `docker-compose.prod.yml` overrides for production.

**Q120. What are the Docker volumes used for?**
Volumes persist data across container restarts — e.g. the SQLite/dev database file and ChromaDB's
`chroma_db` vector directory, plus npm/node_modules caches.

**Q121. How is deployment done in production?**
Render deploys the FastAPI backend (containerized auto-deploy on `main` push, 512MB RAM) via
`render.yaml`. Vercel hosts the Next.js frontend with zero-config edge deployment. Neon is the
serverless Postgres and Upstash the serverless Redis.

---

## 15. CI/CD & Testing

**Q122. What does CI run on every push/PR?**
`.github/workflows/ci.yml` runs two parallel jobs. Frontend: Node 20, `npm ci`, strict ESLint, and a
Next.js production build. Backend: Python 3.11, dependency install, the full pytest suite, a
`pip-audit` vulnerability scan, and Newman Postman integration tests.

**Q123. How many tests are there and where?**
113 passing pytest tests across 12 files: test_agents_registry (28), test_roadmap_agents (24),
test_validation (16), test_features (13), test_main (9), test_career_and_interview_apis (6),
test_ats_engine (5), test_market_service (4), test_gamified_roadmap (2), test_linkedin (2),
test_observability (2), test_admin_metrics_fetch (2).

**Q124. What is the Postman/Newman setup?**
A committed collection (`ai_career_mentor_postman_collection.json`) is run by Newman in CI against
the live server. It covers auth (register/login/refresh/google), resume upload + ATS scoring,
roadmap generation, market triggers, WebSocket interview, and SSE career stream.

**Q125. How does the Postman JWT lifecycle work?**
Test scripts on Register and Login automatically extract the returned access/refresh tokens into
Postman environment variables, so all subsequent requests append the `Authorization: Bearer` header
automatically.

---

## 16. Frontend

**Q126. What is the frontend stack?**
Next.js 14 (App Router), React with TypeScript, TailwindCSS + CSS variables (dark premium theme),
Lucide icons, Recharts for charts, react-hot-toast for notifications, and react-markdown for AI
markdown output.

**Q127. What does the axios custom client do?**
Every API call goes through a shared axios instance that attaches the JWT header, and on a 401 it
auto-refreshes the expired token via `/auth/refresh` and retries the request.

**Q128. How does the frontend consume SSE?**
It uses `fetch` with `ReadableStream`, reads the stream chunks, and parses `data:` lines as JSON.
Each event updates the live analysis log and progress UI during the full-career analysis.

**Q129. How does the frontend handle the interview WebSocket?**
It opens a WebSocket, renders streamed tokens live, plays the incoming TTS audio chunks with an
error-tolerant queue, sends `__ping__` heartbeats, and detects the `rate_limit` message to show the
blocked screen and stop reconnecting.

**Q130. What is Lenis Smooth Scroll?**
A smooth-scroll library configured with inertial physics (`duration: 0.9s`, `wheelMultiplier: 1.8`,
`touchMultiplier: 2.0`) for buttery landing-page scrolling.

**Q131. What is the Viewport Fidelity Blocker?**
`MobileBlocker.tsx` overlays a glassmorphic warning on viewports below 1024px width, protecting the
dashboard, code sandbox, and data dashboards from mobile-resizing artifacts.

**Q132. How does Google sign-in work?**
The frontend uses `@react-oauth/google` one-tap sign-in, gets an ID token, and sends it to
`POST /auth/google`; the backend validates it against Google's tokeninfo endpoint and issues the app
JWT.

---

## 17. Configuration & Environment

**Q133. What are the key backend env vars?**
`LLM_PROVIDER` (default `groq`), `GROQ_API_KEY` + `GROQ_MODEL`, `GOOGLE_API_KEY` + `GOOGLE_MODEL`
(`gemini-3.5-flash`), `NVIDIA_API_KEY` + `NVIDIA_MODEL`, `DATABASE_URL` (default SQLite), `SECRET_KEY`,
`ACCESS_TOKEN_EXPIRE_MINUTES` (60), `REFRESH_TOKEN_EXPIRE_DAYS` (30), `GOOGLE_CLIENT_ID`,
`TAVILY_API_KEY`, `SERPER_API_KEY`, `REDIS_URL`, `APP_ENV`, `ADMIN_EMAIL`, `SENTRY_DSN`,
`ENABLE_OBSERVABILITY`.

**Q134. What are the frontend env vars?**
`NEXT_PUBLIC_API_URL` (backend URL, e.g. `http://localhost:8000`) and
`NEXT_PUBLIC_GOOGLE_CLIENT_ID` (Google OAuth client ID).

**Q135. What is `LLM_PROVIDER` used for?**
It selects the primary provider fallback option (`groq`, `gemini`, or `nvidia`) at the app level,
while each agent still has its own chain in `llm_config.py`.

**Q136. What is the local setup flow?**
Backend: create a venv, `pip install -r requirements.txt`, copy `.env.example` to `.env`, run
`alembic upgrade head`, then `uvicorn app.main:app --reload` (port 8000, Swagger at `/docs`).
Frontend: `npm install`, set the two env vars, then `npm run dev` (port 3000). On Windows,
`start.bat` does it all automatically.

---

## 18. Bonus Quick Recap (1-line answers)

- **Multi-provider system** → Groq / Gemini / NVIDIA with circuit breaker + fallback chains.
- **Embeddings** → `all-MiniLM-L6-v2` (384-dim), local ONNX, no API cost.
- **Vector DB** → ChromaDB `PersistentClient`, collection `resource_kb`, stored in `./chroma_db`.
- **Resume "RAG"** → role-benchmark JSON injection (no vectors).
- **Roadmap RAG** → ChromaDB cosine search + word-overlap filter + DDG/Dev.to web fallback.
- **PDF validation** → 4-layer check: extension → MIME → magic bytes → size (≤5MB).
- **Streaming analysis** → SSE; **interview** → WebSocket + edge-tts voice.
- **Market search** → Tavily → Serper → DuckDuckGo with salary normalization (7 currencies).
- **Roadmap generation** → 3-phase LLM (skeleton → 3+3+2 detail → parallel resource enrichment).
- **Full analysis** → LangGraph parallel DAG with `operator.add` state + Pydantic repair loop.
- **Interview** → 7-phase FSM, 4 levels, 7 categories, 164 companies, level-aware scoring.
- **Rate limiting** → Redis per-feature daily limits + gap blocks (2–7 days).
- **Deployment** → Render (FastAPI, 512MB) + Vercel (Next.js) + Neon (PG) + Upstash (Redis).
- **CI/CD** → GitHub Actions parallel jobs (ESLint, Next build, 113 pytest, pip-audit, Newman).
- **Admin** → JWT + email whitelist → `/admin/metrics` + Loguru error sink + Prometheus.
