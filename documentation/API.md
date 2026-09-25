<div align="center">

# ⚙️ **AI Career Mentor — Complete API Reference**

**REST + SSE + WebSocket — Full Protocol Documentation**

![Swagger UI](https://img.shields.io/badge/Swagger%20UI-Live-46E3B7?style=for-the-badge&logo=swagger)
![REST](https://img.shields.io/badge/REST-JSON-06B6D4?style=for-the-badge)
![SSE](https://img.shields.io/badge/SSE-Streaming-f59e0b?style=for-the-badge)
![WebSocket](https://img.shields.io/badge/WebSocket-Full%20Duplex-ec4899?style=for-the-badge)

[![📖 Architecture](https://img.shields.io/badge/📖%20Architecture-ARCHITECTURE.md-8B5CF6?style=for-the-badge)](./ARCHITECTURE.md)
[![📘 README](https://img.shields.io/badge/📘%20README-README.md-818cf8?style=for-the-badge)](../README.md)

</div>

---

## 📑 **Table of Contents**

| # | Section | 🔗 |
|---|---------|-----|
| 1 | [🌐 Overview](#overview) |
| 2 | [🔐 Authentication](#authentication) |
| 3 | [📝 Auth Endpoints](#auth-endpoints) |
| 4 | [📄 Resume Endpoints](#resume-endpoints) |
| 5 | [🗺️ Roadmap Endpoints](#roadmap-endpoints) |
| 6 | [📈 Market Endpoints](#market-endpoints) |
| 7 | [🔗 LinkedIn Endpoints](#linkedin-endpoints) |
| 8 | [🧠 Career Full Analysis (SSE)](#career-full-analysis) |
| 9 | [🎤 Interview Endpoints (WebSocket)](#interview-endpoints) |
| 10 | [👤 User Endpoints](#user-endpoints) |
| 11 | [🏥 Health Endpoints](#health-endpoints) |
| 12 | [🛡️ Admin & Observability](#admin-observability) |
| 13 | [❌ Error Codes](#error-codes) |
| 14 | [🚦 Rate Limits](#rate-limits) |

---

<a id="overview"></a>
## 1. 🌐 **Overview**

### 📡 **Base URLs**

| Environment | Base URL | Docs |
|-------------|----------|------|
| 🌍 **Production** | `https://ai-career-mentor-rrpu.onrender.com` | `/docs` |
| 💻 **Local** | `http://localhost:8000` | `/docs` |

### 🚇 **Protocols**

| Protocol | Transport | Content Type | Use Cases |
|----------|-----------|:------------:|-----------|
| **REST** 📝 | HTTP/1.1 | `application/json` | CRUD operations, Auth, File upload |
| **SSE** 📡 | HTTP/1.1 | `text/event-stream` | Full career analysis streaming |
| **WebSocket** 🔌 | WS/WSS | JSON | Technical Mock interviews |

### 🔒 **Protected vs Public Routes**

| Icon | Meaning |
|:----:|---------|
| 🔓 | Public — No authentication required |
| 🔒 | Protected — Requires JWT Bearer token |

### 📮 **Postman Collection**

To quickly test all REST, SSE, and WebSocket endpoints, a comprehensive Postman Collection is provided in the repository root at [`ai_career_mentor_postman_collection.json`](./ai_career_mentor_postman_collection.json).

* **Authentication Automation**: The collection includes test scripts that automatically capture the `access_token` and `refresh_token` upon a successful login or registration, then populate the environment variables. Protected routes will authorize automatically.
* **Environment Configuration**: Comes configured with variables for switching base URLs, dynamically generating mock email/passwords, saving roadmap IDs, and session IDs.

---

<a id="authentication"></a>
## 2. 🔐 **Authentication**

### 📋 **Token Lifecycle**

| Token | Expiry | Storage | Usage |
|-------|:------:|:-------:|-------|
| **🔑 Access Token** | 60 minutes | `localStorage` | `Authorization: Bearer <token>` header |
| **🔄 Refresh Token** | 30 days | `localStorage` | `POST /auth/refresh` body |

### 📨 **Auth Header Format**

All protected endpoints (marked with 🔒) require:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### 🔄 **Auto-Refresh Flow**

```
1. Request with expired token → 401 Unauthorized
2. Axios interceptor catches 401
3. POST /auth/refresh { refresh_token }
4. Get new access_token + refresh_token
5. Retry original request with new token
6. If refresh fails → Redirect to /login
```

---

<a id="auth-endpoints"></a>
## 3. 📝 **Auth Endpoints**

### `POST /auth/register` 🔓

**📝 Create a new user account with email/password.**

```json
// Request
{
  "name": "Anil Pradhan",
  "email": "anil@example.com",
  "password": "securepassword123"
}

// Response 200
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "name": "Anil Pradhan"
}
```

| 🔴 Error | 💡 Detail |
|:--------:|-----------|
| `400` | Email already registered |

---

### `POST /auth/login` 🔓

**📝 Authenticate with email/password.**

```json
// Request
{
  "email": "anil@example.com",
  "password": "securepassword123"
}

// Response 200 — Same as register
```

| 🔴 Error | 💡 Detail |
|:--------:|-----------|
| `401` | Invalid credentials |

---

### `POST /auth/google` 🔓

**🌐 Authenticate via Google OAuth 2.0.** Accepts both ID Tokens (JWT) and Access Tokens (`ya29.`).

```json
// Request
{
  "credential": "ya29.A0AfH6SM..."
}

// Response 200 — Same as register. Creates new user on first login.
```

**🔐 Token Type Detection:**
| Token Type | Detection | Verification Method |
|-----------|:---------:|-------------------|
| **Access Token** `ya29.` | Starts with `ya29.` | Google UserInfo API |
| **ID Token** (JWT) | Contains 2+ dots | `verify_oauth2_token()` |

| 🔴 Error | 💡 Detail |
|:--------:|-----------|
| `401` | Google authentication failed |

---

### `POST /auth/refresh` 🔓

**🔄 Generate a new token pair using a refresh token.**

```json
// Request
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}

// Response 200 — Same as register
```

| 🔴 Error | 💡 Detail |
|:--------:|-----------|
| `401` | Could not validate refresh token |

---

<a id="resume-endpoints"></a>
## 4. 📄 **Resume Endpoints** 🔒

### `POST /resume/upload`

**📁 Upload a PDF resume and extract text only (no AI analysis).**

| 📥 Field | Type | 📋 Description |
|----------|------|---------------|
| `file` | File | PDF file (max 5MB, `.pdf` only) |

```json
// Response 200
{
  "filename": "anil_resume.pdf",
  "char_count": 3456,
  "preview": "First 500 characters of resume text...",
  "full_text": "Complete extracted text from PDF..."
}
```

**✅ Validation Pipeline:**
```
1. Extension check   → file.endswith('.pdf')
2. MIME type check   → Content-Type = application/pdf
3. Magic bytes check → starts with b'%PDF-'
4. Size limit check  → < 5,242,880 bytes
5. Text extraction   → pdfplumber per-page extraction
6. Temp file cleanup → finally block
```

| 🔴 Error | 💡 Detail |
|:--------:|-----------|
| `400` | Only PDF files accepted / Invalid file type |
| `400` | File too large. Max 5 MB |
| `400` | Invalid PDF file content |
| `422` | Could not extract text. Upload a text-based PDF |

---

### `POST /resume/analyze`

**🤖 Upload a PDF resume and run full AI analysis (Deterministic ATS + LLM).**

| 📥 Field | Type | 📋 Description |
|----------|------|---------------|
| `file` | File | PDF file (max 5MB) |

```json
// Response 200
{
  "filename": "anil_resume.pdf",
  "char_count": 3456,
  "cached": false,
  "analysis": {
    "technical_skills": ["Python", "FastAPI", "React", "PostgreSQL"],
    "soft_skills": ["Problem Solving", "Communication", "Team Collaboration"],
    "years_of_experience": 2.5,
    "experience_breakdown": ["SDE at Company X (Jan 2024 - Present)"],
    "top_strengths": [
      "Strong technical breadth across 4 technologies",
      "Professional experience of 2.5 years",
      "Strong action-oriented resume writing"
    ],
    "skill_gaps": ["Missing Cloud/DevOps stack exposure", "No CI/CD tooling experience"],
    "ats_score": 72,
    "ats_score_breakdown": {
      "keywords": 25,
      "achievements": 20,
      "action_verbs": 15,
      "formatting_and_length": 12
    }
  }
}
```

**🧠 Analysis Pipeline:**
```
PDF Upload → 4-Layer Validation → pdfplumber Extraction → 
  Sanitization (injection protection) → Cache Check →
    [Miss] Deterministic ATS (120+ skills, date merging, 4-factor score) → 
    LLM Analysis (NVIDIA NIM → Groq fallback, 120s timeout) → 
    Pydantic Validation (ATS capping, experience normalization) →
    Save to DB → Cache Update → Return Analysis
```

| 🔴 Error | 💡 Detail |
|:--------:|-----------|
| `429` | Daily limit reached or gap lock active (max 1 per day, 2-day gap lock) |
| `504` | Resume analysis timed out (exceeded 120s) |
| `500` | Error analyzing resume |

---

<a id="roadmap-endpoints"></a>
## 5. 🗺️ **Roadmap Endpoints** 🔒

### `POST /roadmap/generate`

**🎯 Generate an 8-week personalized learning roadmap with AI-powered resources.**

```json
// Request
{
  "target_role": "Backend Engineer",
  "skill_gaps": ["System Design", "Docker", "CI/CD"],
  "experience_level": "intermediate",
  "learning_style": "balanced"
}
```

| 📌 Param | Type | Default | 📋 Description |
|----------|------|:-------:|---------------|
| `target_role` | string | — | 🎯 Target job role (required) |
| `skill_gaps` | string[] | — | 🔧 Skills to address (required) |
| `experience_level` | string | `intermediate` | 📊 `beginner`, `intermediate`, `advanced` |
| `learning_style` | string | `balanced` | 📐 `balanced`, `theory`, `practical` |

```json
// Response 200
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "target_role": "Backend Engineer",
  "weeks": [
    {
      "week": 1,
      "topic": "System Design Fundamentals",
      "skill_gap_addressed": "System Design",
      "estimated_hours": 10,
      "mini_project": "Design a URL shortener architecture",
      "prerequisites": [
        "HTTP & REST fundamentals",
        "Basic data structures",
        "Load balancing concepts"
      ],
      "success_criteria": "Can draw a complete system diagram with trade-offs",
      "why_it_matters": "Foundation for all distributed systems interviews",
      "completed": false,
      "youtube_resources": [
        "https://youtube.com/watch?v=...",
        "https://youtube.com/watch?v=..."
      ],
      "article_resources": [
        "https://blog.example.com/system-design-primer"
      ],
      "github_resources": [
        "https://github.com/donnemartin/system-design-primer"
      ],
      "official_docs": [
        "https://docs.aws.amazon.com/..."
      ]
    }
    // ... 7 more weeks
  ]
}
```

**🧠 Generation Pipeline:**
```
Input → Cache Check → [Miss] → 
  Phase 1: Structure Generation (Groq/NVIDIA, 8-week skeleton) →
  Phase 2: Detail Batch (3 + 3 + 2 chunks, parallel LLM) →
  Phase 3: Resource Enrichment (DDG search → heuristic scoring → GitHub audit → URL validation → dedup) →
  Phase 4: Normalize (exactly 8 weeks, required fields) →
  Save to DB + Cache → Return Response
```

| 🔴 Error | 💡 Detail |
|:--------:|-----------|
| `400` | `target_role` must not be empty |
| `400` | `skill_gaps` list must not be empty |
| `429` | Daily limit reached / multi-day gap lock active |
| `500` | An error occurred while generating the roadmap |

---

### `GET /roadmap/history`

**📋 Fetch all previously generated roadmaps.**

```json
// Response 200
{
  "history": [
    {
      "id": "uuid-string",
      "target_role": "Backend Engineer",
      "created_at": "2026-05-29T10:00:00+00:00",
      "weeks": [
        {"week": 1, "topic": "System Design", "completed": true, ...},
        {"week": 2, "topic": "Docker & K8s", "completed": false, ...}
      ]
    }
  ]
}
```

---

### `PUT /roadmap/{roadmap_id}/toggle-week/{week_number}`

**✅ Toggle or explicitly set the completed status of a specific week.**

| 📌 Param | Type | Default | 📋 Description |
|----------|------|:-------:|---------------|
| `completed` | bool | `null` | Explicit value; if null, toggles current state |

```json
// Response 200
{
  "message": "Week 1 completion updated",
  "weeks": [
    {"week": 1, "topic": "System Design", "completed": true},
    ...
  ]
}
```

| 🔴 Error | 💡 Detail |
|:--------:|-----------|
| `404` | Roadmap not found |
| `404` | Week {n} not found in this roadmap |

---

### `DELETE /roadmap/{roadmap_id}`

**🗑️ Delete a specific roadmap.**

```json
// Response 200
{
  "message": "Roadmap deleted successfully"
}
```

| 🔴 Error | 💡 Detail |
|:--------:|-----------|
| `404` | Roadmap not found |

---

<a id="market-endpoints"></a>
## 6. 📈 **Market Endpoints** 🔒

### `GET /market/config`

**⚙️ Returns dynamic configuration for all wizards (Market, Interview, Analysis).**

```json
// Response 200
{
  "locations": [
    "Bangalore, India", "Hyderabad, India", "Mumbai, India",
    "San Francisco, USA", "New York, USA", "Seattle, USA",
    "London, UK", "Berlin, Germany", "Dubai, UAE",
    "Singapore", "Sydney, Australia", "Remote"
  ],
  "roles": [
    "Software Engineer", "Data Scientist", "ML Engineer",
    "DevOps Engineer", "Product Manager", "Security Engineer",
    "Full Stack Developer", "Backend Engineer", "Frontend Engineer"
  ],
  "companies": {
    "google": {"name": "Google", "style": "GCA", "tier": "tier_1"},
    "microsoft": {"name": "Microsoft", "style": "AZ", "tier": "tier_1"},
    "amazon": {"name": "Amazon", "style": "LP", "tier": "tier_1"},
    "meta": {"name": "Meta", "style": "Meta", "tier": "tier_1"},
    "startup": {"name": "Startup", "style": "general", "tier": "other"}
  },
  "seniorities": ["Junior", "Middle", "Senior", "Principal"]
}
```

---

### `GET /market/trends`

**🔍 Fetch real-time, region-aware job market intelligence with live search.**

| 📌 Param | Type | Required | 📋 Description |
|----------|------|:--------:|---------------|
| `role` | string | ✅ | Target job role (e.g., `Data Scientist`) |
| `location` | string | ✅ | Target location (e.g., `Bangalore, India`) |
| `seniority` | string | ❌ | Experience level (`intern`, `junior`, `mid`, `senior`) |

```json
// Response 200
{
  "role": "Data Scientist",
  "location": "Bangalore, India",
  "seniority": "mid",
  "salary_range": {
    "min": 1200000,
    "max": 3500000,
    "currency": "INR",
    "formatted": "₹12,00,000 – ₹35,00,000 per annum"
  },
  "market_trend": "High Growth",
  "hiring_volume": "2,500+ Active Roles",
  "hiring_companies": [
    {"name": "Google", "hiring_volume": "Active openings"},
    {"name": "Microsoft", "hiring_volume": "Hiring ML Engineers"},
    {"name": "Flipkart", "hiring_volume": "Growing team"}
  ],
  "top_skills_freq": [
    {"skill": "Python", "frequency": 92},
    {"skill": "TensorFlow", "frequency": 78},
    {"skill": "SQL", "frequency": 85},
    {"skill": "PyTorch", "frequency": 71}
  ],
  "summary": "Strong demand for Data Scientists in Bangalore with competitive salaries ranging from ₹12L to ₹35L. Python and deep learning frameworks dominate the skill requirements.",
  "sources": [
    "https://linkedin.com/jobs/...",
    "https://naukri.com/..."
  ],
  "provider": "groq",
  "is_live": true
}
```

**🧠 Intelligence Pipeline:**
```
Input → Role Classification (domain + seniority) → Region Mapping (currency + multipliers) →
  Live Search: Tavily (primary) → Serper (fallback) → Deep URL Scraping →
  URL Classification (job_portal / blog / other) →
  Deterministic Extraction (sources, region profile) →
  LLM Structured Extraction (Groq, temp=0.2) →
  Merge LLM + Deterministic → Pydantic Validation →
  Save to DB → Return Report
```

| 🔴 Error | 💡 Detail |
|:--------:|-----------|
| `429` | Daily limit reached for market research (max 1) |
| `500` | Market error: {detail} |

---

### `GET /market/history`

**📋 Fetch saved market intelligence history.**

| 📌 Param | Type | Default | 📋 Description |
|----------|------|:-------:|---------------|
| `limit` | int | `10` | Max results (1-50) |

```json
// Response 200
[
  {
    "id": "uuid-string",
    "target_role": "Data Scientist",
    "location": "Bangalore, India",
    "analysis": { ... full market report ... },
    "created_at": "2026-05-29T10:00:00+00:00"
  }
]
```

---

### `DELETE /market/{analysis_id}`

**🗑️ Delete a saved market analysis.**

```json
// Response 200
{
  "message": "Market analysis deleted successfully"
}
```

| 🔴 Error | 💡 Detail |
|:--------:|-----------|
| `404` | Market analysis not found |

---

<a id="linkedin-endpoints"></a>
## 7. 🔗 **LinkedIn Endpoints** 🔒

### `POST /linkedin/optimize`

**💼 Generate a LinkedIn profile optimization strategy with ATS keyword injection and recruiter trends.**

```json
// Request
{
  "target_role": "Backend Engineer"
}
```

```json
// Response 200
{
  "cached": false,
  "strategy": {
    "headlines": [
      "Backend Engineer | Building Scalable & Distributed Systems 💻 | Python & Cloud Enthusiast 🚀",
      "Software Engineer | Backend API Design & Cloud Architecture Specialist 🛠️",
      "Backend Engineer | Scalable Microservices & System Design Expert ⚙️ | Tech Career Mentor"
    ],
    "about_section": "👋 Hi there! I am a passionate Backend Engineer dedicated to crafting clean, efficient, and scalable software solutions.\n\n💻 With 3+ years of experience in designing and building distributed systems, I specialize in:\n• System Design & Microservices Architecture 🏗️\n• Cloud-Native Development (AWS, Docker, K8s) ☁️\n• RESTful API Design & Optimization 🔌\n\n🚀 I thrive in fast-paced environments where I can solve complex engineering challenges and mentor junior developers.\n\n📫 Let's connect if you're looking for a passionate backend engineer!",
    "demanding_skills": ["System Design", "PostgreSQL", "Docker", "REST APIs", "Microservices"],
    "ats_keywords_to_inject": [
      "Scalability", "Distributed Systems", "API Design",
      "Cloud Architecture", "CI/CD", "Database Optimization"
    ],
    "recruiter_search_trends": [
      "Increasing demand for backend engineers with microservices and containerization experience",
      "Recruiters prioritizing candidates with system design knowledge for senior roles"
    ],
    "profile_density_advice": "Ensure your headline uses high-converting keywords and your experience bullet points start with strong action verbs (Developed, Engineered, Architected). List at least 5 key skills with endorsements.",
    "certifications": [
      "AWS Certified Developer – Associate",
      "Docker Certified Associate",
      "Meta Backend Developer Certificate"
    ]
  }
}
```

| 🔴 Error | 💡 Detail |
|:--------:|-----------|
| `400` | Target role is required |
| `429` | Daily limit reached for LinkedIn optimization (max 4) |
| `500` | LinkedIn optimization failed: {detail} |

---

<a id="career-full-analysis"></a>
## 8. 🧠 **Career Full Analysis (SSE)** 🔒

### `POST /career/full-analysis/stream`

**🚀 Execute the complete LangGraph DAG pipeline via Server-Sent Events (SSE).**

This is the central orchestration endpoint of the Career AI Operating System. It runs a parallel multi-agent pipeline using a directed acyclic graph (DAG) in LangGraph, validates Pydantic models at each step, executes repair/fallback rules on error, and streams real-time logs and final results to the client.

#### 📡 **SSE Protocol & Connection Mechanics**
- **Transport**: `HTTP/1.1`
- **Headers**:
  - `Content-Type`: `text/event-stream`
  - `Cache-Control`: `no-cache`
  - `Connection`: `keep-alive`
- **Auth**: Requires JWT authorization. Because standard browser `EventSource` does not support custom headers natively, the client must use a `fetch` request with a stream reader (see [Client-Side Integration](#-client-side-integration-example) below).

#### 📊 **Pipeline Execution Flow (LangGraph DAG)**

```text
                   ┌───────────────┐
                   │    START      │
                   └──────┬────────┘
              ┌───────────┴────────────┐
              ▼                        ▼
   ┌────────────────────┐   ┌────────────────────┐
   │ RESUME NODE        │   │ MARKET NODE        │
   │  - ATS parser      │   │  - Live Scraper    │
   │  - LLM Analysis    │   │  - Groq Extraction │
   └──────┬──────┬──────┘   └──────┬──────┬──────┘
          │       │                │       │
          ▼       │                ▼       │
   ┌────────────────────┐   ┌────────────────────┐
   │ LINKEDIN NODE      │   │ ROADMAP NODE       │
   │  - Recruiter Trends│   │  - Week Structure  │
   │  - Profile Opt     │   │  - Batch RAG       │
   └──────┬──────┬──────┘   └──────┬──────┬──────┘
          │       └───────┬────────┘       │
          ▼               ▼                ▼
   ┌───────────────────────────────────────────────┐
   │              END NODE · Save to DB            │
   └───────────────────────────────────────────────┘
```

- **Phase 1 (Parallel)**: `Resume Node` and `Market Node` run concurrently. Latency = `max(resume, market)`.
- **Phase 2 (Parallel)**: `LinkedIn Node` and `Roadmap Node` wait for both Phase 1 nodes to finish, then execute concurrently. Latency = `max(linkedin, roadmap)`.
- **Total Latency**: ~45s - 60s depending on LLM response speeds.

#### 📨 **Request Payload**
- **Content-Type**: `application/json`

```json
{
  "target_role": "Full Stack Developer",
  "resume_text": "Experienced developer with Python, FastAPI, and React skills. Built several distributed systems and scaled databases...",
  "location": "Bangalore, India",
  "provider": null
}
```

#### 📡 **SSE Event Format & Types**

The server streams data in standard Event-Stream format (`data: <JSON>\n\n`). Every message is a JSON object containing a `type` field:

1. **`log`**: Real-time progress updates sent as soon as a graph node starts, runs fallbacks, or completes.
   ```json
   data: {"type": "log", "message": "[2026-06-07T01:30:00] Started Resume Analysis", "node": "resume"}
   ```
2. **`error`**: Emitted if a non-fatal error occurs inside a node (e.g., validation fail or API timeout) prompting a repair flow.
   ```json
   data: {"type": "error", "message": "Resume validation failed: years_of_experience out of range. Running fallback.", "node": "resume"}
   ```
3. **`result`**: The final aggregated pipeline output. It is sent as a single large payload when the graph reaches the `END` state.
4. **`close`**: Signifies the end of the stream. The client should close the connection upon receiving this.
   ```json
   data: {"type": "close"}
   ```

#### 📦 **Complete Final Result Payload Schema (`type: "result"`)**

```json
data: {
  "type": "result",
  "payload": {
    "status": "success",
    "output": {
      "resume_analysis": {
        "technical_skills": ["Python", "React", "Docker", "FastAPI"],
        "soft_skills": ["Problem Solving", "Team Collaboration"],
        "years_of_experience": 3.5,
        "experience_breakdown": [
          "SDE at Tech Solutions (Jan 2023 - Present)"
        ],
        "top_strengths": [
          "Strong backend experience with FastAPI",
          "Solid frontend capabilities"
        ],
        "skill_gaps": [
          "No Kubernetes container orchestration",
          "No AWS cloud deployment exposure"
        ],
        "ats_score": 85,
        "ats_score_breakdown": {
          "keywords": 30,
          "achievements": 25,
          "action_verbs": 15,
          "formatting_and_length": 15
        }
      },
      "market_trends": {
        "role": "Full Stack Developer",
        "location": "Bangalore, India",
        "seniority": "mid",
        "salary_range": {
          "min": 1200000,
          "max": 2500000,
          "currency": "INR",
          "formatted": "₹12,00,000 – ₹25,00,000 per annum"
        },
        "market_trend": "High Demand",
        "hiring_volume": "1,800+ Active Roles",
        "hiring_companies": [
          {"name": "Google", "hiring_volume": "Active openings"},
          {"name": "Flipkart", "hiring_volume": "Growing team"}
        ],
        "top_skills_freq": [
          {"skill": "React", "frequency": 90},
          {"skill": "Python", "frequency": 85}
        ],
        "summary": "High volume of open full-stack roles in Bangalore. Python + React developers command ₹12L-₹25L.",
        "sources": ["https://linkedin.com/jobs/"]
      },
      "roadmap": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "target_role": "Full Stack Developer",
        "weeks": [
          {
            "week": 1,
            "topic": "Containerization with Docker",
            "skill_gap_addressed": "No container orchestration",
            "estimated_hours": 12,
            "mini_project": "Dockerize a multi-container FastAPI + Postgres application",
            "success_criteria": "Can run docker-compose up and verify app communication",
            "why_it_matters": "Core skill for modern deployment pipelines",
            "completed": false,
            "youtube_resources": ["https://www.youtube.com/results?search_query=docker+tutorial"],
            "article_resources": ["https://docs.docker.com/get-started/"],
            "github_resources": ["https://github.com/docker/labs"],
            "official_docs": ["https://docs.docker.com"]
          }
          // ... Weeks 2-8 follow
        ]
      },
      "linkedin_strategy": {
        "headlines": [
          "Full Stack Developer | Python (FastAPI) & React Expert 💻 | Building Scalable Web Apps 🚀"
        ],
        "about_section": "👋 Hi, I am a Full Stack Developer specializing in FastAPI backends and React frontends...",
        "demanding_skills": ["FastAPI", "React", "Docker", "PostgreSQL"],
        "ats_keywords_to_inject": ["Scalability", "API Optimization", "CI/CD"],
        "recruiter_search_trends": ["Increasing searches for Python + React hybrid engineers"],
        "profile_density_advice": "Add key technical metrics to your experiences. List at least 5 backend skills.",
        "certifications": ["AWS Certified Developer"]
      }
    },
    "logs": [
      "[2026-06-07T01:30:00] Started Resume Analysis",
      "[2026-06-07T01:30:05] Resume Node Complete",
      "..."
    ],
    "errors": [],
    "metadata": {
      "execution_time": "Completed",
      "agents_involved": 4,
      "roadmap_weeks": 8
    }
  }
}
```

#### 🚦 **Rate Limits & Gap Locks**
- **Daily Limit**: **1 request / day** (Free tier).
- **Gap Lock**: A **7-day cooldown lock** is activated on successful completion. Any call within the gap period returns a `429 Too Many Requests` status.

#### 🔴 **Error Responses**

| Code | 💡 Detail |
|:----:|-----------|
| `401` | Not authenticated |
| `429` | Daily limit reached or multi-day gap lock active |
| `500` | Internal server error (Graph orchestration collapsed on all fallback nodes) |

---

#### 🔌 **Client-Side Integration Example (React / TypeScript)**

Since standard browser `EventSource` does not support adding custom authorization headers (`Authorization: Bearer <token>`), you must fetch the stream using standard HTTP fetch and parse the chunks manually:

```typescript
async function startCareerAnalysisStream(
  requestBody: { target_role: string; resume_text: string; location: string },
  jwtToken: string,
  onLogReceived: (log: string) => void,
  onResultReceived: (result: any) => void,
  onError: (err: string) => void
) {
  try {
    const response = await fetch("http://localhost:8000/career/full-analysis/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${jwtToken}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (response.status === 429) {
      onError("Rate limit exceeded or gap lock is active.");
      return;
    }
    if (!response.ok) {
      onError(`Server error: ${response.statusText}`);
      return;
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    if (!reader) throw new Error("ReadableStream not supported by browser.");

    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      
      // Save the last incomplete line back to the buffer
      buffer = lines.pop() || "";

      for (const line of lines) {
        const cleanLine = line.trim();
        if (!cleanLine.startsWith("data: ")) continue;

        const rawJson = cleanLine.substring(6).trim();
        if (!rawJson) continue;

        const event = JSON.parse(rawJson);

        if (event.type === "log") {
          onLogReceived(event.message);
        } else if (event.type === "error") {
          onError(event.message);
        } else if (event.type === "result") {
          onResultReceived(event.payload);
        } else if (event.type === "close") {
          reader.cancel();
          return;
        }
      }
    }
  } catch (err: any) {
    onError(`Stream read error: ${err.message}`);
  }
}
```

---

<a id="interview-endpoints"></a>
## 9. 🎤 **Interview Endpoints (WebSocket)**

### `WebSocket /interview/ws/{session_id}`

**🎯 Establishes a WebSocket connection for a real-time, custom-tailored mock interview session governed by a 7-Phase Finite State Machine (FSM).**

This is a highly interactive, stateful bidirectional connection. The system automatically loads your latest resume, customizes questions based on your background, adjusts the technical depth depending on the target company tier, and dynamically streams questions, evaluations, and final scoring.

#### 📡 **Connection URL**

```
ws://localhost:8000/interview/ws/{session_id}?role=Software+Engineer&company=Google&type=technical&token=JWT_TOKEN&provider=groq
```

| 📌 Param | Type | Default | 📋 Description |
|----------|------|:-------:|---------------|
| `role` | string | `Software Engineer` | 🎯 Target interview role. Used to categorize the interview questions (e.g. SWE vs Data/AI). |
| `company` | string | `A top tech company` | 🏢 Target company. Guides domain questions and company-specific design scenarios. |
| `company_style` | string | `null` | 🎭 Company interview style (e.g. `GCA` for Google, `LP` for Amazon, `AZ` for Microsoft, `Meta`). |
| `company_tier` | string | `other` | 🏅 Company tier (`FAANG`, `top-indian-product`, `fintech`, `mid-product`, `indian-service`, `hardware`, `gaming`, `security`, `hft`, `other`). Controls difficulty. |
| `token` | string | `null` | 🔐 JWT access token for authentication (strongly recommended in query to secure the WS). |
| `type` | string | `technical` | 🎪 Interview type (`technical` or `behavioral`). |
| `provider` | string | `groq` | ⚙️ LLM provider to power the interviewer logic (`groq` or `nvidia`). |

---

### 📄 **Resume-Aware Dynamic Personalization**

To mimic real-world interviewers who study your credentials beforehand, the backend parses and feeds your resume context directly into the system prompt:
1. **Dynamic DB Loading**: On connection request, the backend queries the `resumes` table for the authenticated user and retrieves the most recent record.
2. **Text-Efficient Compression**: The system extracts the candidate's name and constructs a token-efficient summary containing structured skills, identified strengths, gaps, and the **first 1500 characters** of the raw text. This keeps the prompt compact while capturing specific achievements.
3. **Experience Filtering**: The engine separates true professional/technical experience (such as software engineering internships or full-time roles) from student activities (campus ambassador, club memberships), ensuring you are only grilled on professional achievements.
4. **Targeted Deep-Dives (Phase 4)**: The AI selects **exactly one project** and **exactly two specific bullet points/achievements** from your resume and prompts you to explain the underlying architecture, implementation choices, and bottleneck trade-offs.

---

### 🎭 **The 7-Phase Interview State Machine (FSM)**

The interview progresses through a stateful linear machine. The transition to the next phase triggers automatically as the interviewer asks a question and the candidate responds.

```text
   INITIAL ──► INTRO ──► CORE_THEORY ──► HANDS_ON_CHALLENGE ──► PAST_EXPERIENCE
      │           │             │                 │                   │
  Connection   Answer Q1    Answer Q2         Answer Q3          Answer Q4
  Accepted

   ──► ARCHITECTURE_DESIGN ──► BUSINESS_DOMAIN ──► CLOSING ──► FEEDBACK ──► COMPLETED
            │                      │                │           │
        Answer Q5              Answer Q6       Answer Q7   Generate Report
                                                 (Q&A)      & Disconnect
```

#### **FSM Phase Breakdown & Timings**

| Phase | State Name | ⏱️ Duration | 🎯 Behavioral Focus | 💻 Technical Focus |
|:---:|------------|:---------:|---------------------|--------------------|
| **0** | `INITIAL` | — | Handshake and connection validation. | Token validation & Resume check. |
| **1** | `INTRO` | 2-3 min | Welcomes candidate, asks standard "tell me about yourself" question. | Discovers candidate's primary tech stack and learned skills. |
| **2** | `CORE_THEORY` | 3-5 min | Explores candidate's interest and motivation for the role/company. | Direct conceptual questions based on CS Focus area (e.g. OS, CN, DBMS). |
| **3** | `HANDS_ON_CHALLENGE` | 10-15 min | Situation-based question focusing on core behavior competencies. | Code logic presentation and complexity analysis of a specific coding problem. |
| **4** | `PAST_EXPERIENCE` | 3-5 min | Evaluates teamwork, collaboration, or handling peer conflicts. | Direct questions on technical architecture and decisions from the user's resume. |
| **5** | `ARCHITECTURE_DESIGN` | 8-12 min | Explores failure scenarios, past mistakes, or missed deadlines. | Scalable distributed design scenario aligned with the candidate's category. |
| **6** | `BUSINESS_DOMAIN` | 3-5 min | Details relocation preferences, onboarding availability. | High-fidelity business problem reflecting actual operations of target company. |
| **7** | `CLOSING` | 2-3 min | Prompt: *"Do you have any questions for me?"* | Opportunity for the candidate to ask questions to the mock interviewer. |
| **8** | `FEEDBACK` | — | Professional wrap-up and input blockade. | Dynamic LLM grading using a rubric; generates a scorecard in DB. |

---

### 🎯 **Role Category Adaptation Matrix**

The interviewer dynamically adjusts its persona, fundamental questions, coding challenges, and system design scenarios using **7 distinct categories** parsed from the user's target role:

| Category | Target Roles | 📚 CS Focus (Phase 2) | 💻 Coding/Scenario Challenge (Phase 3) | 🏗️ System/Architecture Design (Phase 5) |
|---|---|---|---|---|
| **💻 SWE** | Software Engineer, Frontend/Backend, Full Stack, Mobile Developer (iOS/Android) | Operating Systems (virtual memory, thread pools), Networks (HTTP/3, TCP/UDP), DBMS (indexing, ACID isolation levels). | **LeetCode Challenge**: Standard DSA problems (e.g., *Two Sum*, *Number of Islands*, *Trapping Rain Water*) with explicit LeetCode references. | **General System Design**: Caching layers, load balancers, database scaling, API architectures. |
| **🤖 Data/AI** | Data Scientist, ML Engineer, Deep Learning/GenAI/NLP/CV Engineer, MLOps, Data Engineer | ML theory (bias-variance, gradient descent), Statistics (A/B testing, p-values), Deep Learning (Transformers, attention mechanism). | **ML Case Study**: Practical analytics scenario (e.g. *Predicting churn with SMOTE + XGBoost*, *Design an A/B test for e-commerce homepage*). | **ML Pipeline Design**: End-to-end data ingestion, model training, feature stores, live inference rendering. |
| **☁️ Infra/Cloud** | DevOps Engineer, Site Reliability Engineer (SRE), Cloud Engineer, Cloud Architect | Container orchestration (K8s pods, Ingress), CI/CD flow, IaC (Terraform modules, locks), High Availability. | **Infrastructure Scenario**: Multistage build optimization, active rollback triggers, localized EKS `CrashLoopBackOff` troubleshooting. | **Cloud Infrastructure**: Scalable networks, multi-region routing configurations, disaster recovery setups, IAM policies. |
| **🔐 Security** | Cybersecurity Analyst, Security Engineer, Penetration Tester | Application Security (OWASP Top 10), Network Security (WAF, IDS/IPS), Cryptography (symmetric vs asymmetric, TLS). | **Threat Modeling/CTF**: SSRF remediation code, parameterized SQL queries, OAuth2 PKCE token storage configuration. | **Security Architecture**: Zero-trust access policies, encrypted transit channels, data isolation barriers, immutable audit logs. |
| **🎨 Product/Design** | Product Manager, Technical PM, UI/UX Designer | Product metrics (LTV/CAC, North Star, activation), User research, Priority matrices (RICE, MoSCoW), WCAG accessibility. | **Product/UX Case Study**: Wireframing decision pathways, user funnel drop-off diagnostics, customer journey layout. | **Product Strategy**: Monetization structures, MVP scoping rules, feature prioritization matrices, product launch plan. |
| **🎮 Gaming** | Game Developer, AR/VR Developer | Game loop architecture (delta time, interpolation), State machine logic, Collision algorithms (AABB), Graphics pipeline. | **Game Dev Challenge**: A* pathfinding on grid, draw call optimization via instancing, memory pool memory allocation. | **Game Systems Design**: Matchmaking queue algorithms, real-time entity state replication, lag compensation mechanisms. |
| **🛠️ Specialized** | Blockchain Developer, Embedded Systems/IoT, Robotics, QA/Test, Solutions Architect | Domain fundamentals (testing pyramid, Solidity mechanics, MQTT/CoAP telemetry, PID control loops). | **Domain Challenge**: Reentrancy bug detection/patching, complementary sensor fusion filter logic, Playwright wait-handling. | **Specialized Architecture**: IoT telemetry ingest, decentralized digital identity (DID), HIPAA isolated clinical records system. |

---

### 📨 **Client → Server Messages**

WebSocket communication uses JSON formatted text frames. The client can push the following inputs:

#### **1. Submit Candidate Answer**
Sent during most phases to submit a verbal/textual response to the interviewer.
```json
{
  "type": "response",
  "text": "To solve this problem, I would use a Hash Map to record previously visited elements and their indexes. This allows us to locate the pair in O(n) runtime complexity."
}
```

#### **2. Submit Code Update**
Sent during Phase 3 (LeetCode) to update code logic without advancing the state machine conversation.
```json
{
  "type": "code_update",
  "code": "def twoSum(nums, target):\n    prev_map = {}\n    for idx, val in enumerate(nums):\n        diff = target - val\n        if diff in prev_map:\n            return [prev_map[diff], idx]\n        prev_map[val] = idx\n    return []"
}
```

#### **3. Keepalive Connection Ping**
Sent periodically to prevent connection timeouts on Cloud provider deployments.
```
__ping__
```

---

### 📩 **Server → Client Messages**

The server streams interviewer feedback, questions, state updates, and metrics:

#### **1. Connection Setup / Initialization Status**
Emitted upon initial connection handshake.
```json
{
  "role": "system",
  "content": "Connected. Preparing your interview..."
}
```

#### **2. Real-Time Interviewer Text Stream (Word Tokens)**
The interviewer's response is streamed word-by-word (batched in chunks of 8 words) for a real-time conversational experience.
```json
{
  "role": "interviewer_stream",
  "content": "Perfect. Now let's move on to the coding "
}
```

#### **3. Incremental Audio TTS Fragments (Edge-TTS)**
As the text is generated, a background worker parses sentences and synthesizes them into base64 encoded MP3 audio fragments dynamically.
- **Audio Voice Profile**: `en-US-AndrewNeural` (Microsoft Edge-TTS Male Voice).
```json
{
  "role": "interviewer",
  "audio": "base64_encoded_MP3_audio_fragment...",
  "fragment": true
}
```

#### **4. Interviewer Question Frame**
Contains the final complete text of the question asked by the interviewer (useful for static layout synchronization).
```json
{
  "role": "interviewer",
  "type": "question",
  "content": "Perfect. Now let's move on to the coding challenge. I want you to write a function that finds the longest palindromic substring in a given string. Can you walk me through your logic first?"
}
```

#### **3. System Concluding Event**
Fires when entering the feedback phase. Warns the client to freeze input UI elements.
```json
{
  "role": "system",
  "content": "Interview Concluding..."
}
```

#### **4. Dynamic Performance Feedback**
Sent at the end of the session, providing structural analysis and score breakdowns.
```json
{
  "role": "interviewer",
  "type": "feedback",
  "content": "### Performance Feedback\n- **Executive Summary:** Highly analytical candidate with strong DSA foundation.\n- **Strengths:** Optimized sliding window complexity correctly.\n- **Areas of Improvement:** Needs deeper knowledge of DB transactions.\n- **Actionable Advice:** Review ACID isolation levels.\n\nOVERALL SCORE : 85/100"
}
```

#### **5. Final Session Completion Event**
Signal confirming data preservation in Postgres is complete. The client should close connection.
```json
{
  "role": "system",
  "content": "Interview Completed.",
  "score": 85.0
}
```

---

### `GET /interview/history` 🔒

**📋 Retrieves previous mock interview sessions registered for the authenticated user.**

```json
// Response 200
{
  "history": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "target_role": "Software Engineer",
      "created_at": "2026-06-07T01:30:00+00:00",
      "score": 85.0,
      "status": "completed"
    },
    {
      "id": "f81d4fae-7dec-11d0-a765-00a0c91e6bf6",
      "target_role": "Data Scientist",
      "created_at": "2026-06-06T14:20:00+00:00",
      "score": null,
      "status": "in_progress"
    }
  ]
}
```

---

### `GET /interview/{session_id}` 🔒

**📄 Retrieves full details of a specific interview session, including full message transcripts.**

```json
// Response 200
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "target_role": "Software Engineer",
  "score": 85.0,
  "status": "completed",
  "created_at": "2026-06-07T01:30:00+00:00",
  "chat_history": [
    {
      "role": "interviewer",
      "type": "question",
      "content": "Welcome! Tell me about yourself and your experience."
    },
    {
      "role": "candidate",
      "content": "I am a Full Stack Developer with 2 years of experience building Python and React applications."
    }
  ]
}
```

| 🔴 Error | 💡 Detail |
|:--------:|-----------|
| `404` | Interview session not found |

---

### `DELETE /interview/{session_id}` 🔒

**🗑️ Deletes a specific interview session from historical records.**

```json
// Response 200
{
  "message": "Interview deleted successfully"
}
```

| 🔴 Error | 💡 Detail |
|:--------:|-----------|
| `404` | Interview session not found |

---

### 🔌 **Client-Side Integration Example (React / TypeScript)**

Below is a complete, production-ready React hook implementation for managing real-time WebSocket connection to the mock interview engine. It handles token authorization, state FSM visualization, candidate code/text submission, heartbeat ping-pong, and automatic connection cleanup.

```typescript
import { useEffect, useRef, useState, useCallback } from "react";

export type MessageRole = "interviewer" | "candidate" | "system";
export type MessageType = "question" | "feedback" | "score";

export interface ChatMessage {
  role: MessageRole;
  type?: MessageType;
  content: string;
  score?: number;
  timestamp: string;
}

export interface UseMockInterviewOptions {
  sessionId: string;
  role: string;
  company: string;
  token: string;
  interviewType?: "technical" | "behavioral";
  companyTier?: string;
  provider?: "nvidia" | "groq";
  onSystemMessage?: (msg: string) => void;
  onSessionComplete?: (score: number, feedback: string) => void;
}

export function useMockInterview({
  sessionId,
  role,
  company,
  token,
  interviewType = "technical",
  companyTier = "other",
  provider = "nvidia",
  onSystemMessage,
  onSessionComplete,
}: UseMockInterviewOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isConcluding, setIsConcluding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (socketRef.current) return;

    const encodedRole = encodeURIComponent(role);
    const encodedCompany = encodeURIComponent(company);
    const wsUrl = `ws://localhost:8000/interview/ws/${sessionId}?role=${encodedRole}&company=${encodedCompany}&type=${interviewType}&company_tier=${companyTier}&token=${token}&provider=${provider}`;

    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setError(null);

      // Start keepalive heartbeat (every 30 seconds)
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send("__ping__");
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      const data = event.data;
      if (data === "__pong__") return; // Keepalive ack

      try {
        const payload = JSON.parse(data);
        
        // Handle raw system notification messages
        if (payload.role === "system") {
          if (payload.content.includes("Concluding")) {
            setIsConcluding(true);
          }
          if (payload.content.includes("Completed") && onSessionComplete) {
            onSessionComplete(payload.score || 0.0, payload.content);
          }
          onSystemMessage?.(payload.content);
          return;
        }

        // Handle standard chat frames (questions, feedback)
        const newMessage: ChatMessage = {
          role: payload.role || "interviewer",
          type: payload.type,
          content: payload.content,
          timestamp: new Date().toLocaleTimeString(),
        };

        setMessages((prev) => [...prev, newMessage]);
      } catch (err) {
        console.error("Failed to parse WebSocket message:", err);
      }
    };

    ws.onerror = (event) => {
      console.error("WebSocket error observed:", event);
      setError("An error occurred with the live interview stream.");
    };

    ws.onclose = (event) => {
      setIsConnected(false);
      socketRef.current = null;
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      if (event.code === 1008) {
        setError("Daily interview limit reached or unauthorized token.");
      }
    };
  }, [sessionId, role, company, token, interviewType, companyTier, provider, onSystemMessage, onSessionComplete]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close(1000, "User requested disconnect");
    }
  }, []);

  const sendAnswer = useCallback((text: string) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      setError("Cannot send response: WebSocket not connected.");
      return;
    }

    // Append client-side immediate message
    const userMessage: ChatMessage = {
      role: "candidate",
      content: text,
      timestamp: new Date().toLocaleTimeString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    socketRef.current.send(
      JSON.stringify({
        type: "response",
        text,
      })
    );
  }, []);

  const sendCodeUpdate = useCallback((code: string) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    
    socketRef.current.send(
      JSON.stringify({
        type: "code_update",
        code,
      })
    );
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.close(1000, "Component unmounted");
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };
  }, []);

  return {
    messages,
    isConnected,
    isConcluding,
    error,
    connect,
    disconnect,
    sendAnswer,
    sendCodeUpdate,
  };
}
```

---

<a id="user-endpoints"></a>
## 10. 👤 **User Endpoints** 🔒

### `GET /user/stats`

**📊 Fetch comprehensive dashboard statistics including activity, usage, and history.**

```json
// Response 200
{
  "lastResumeAnalysis": {
    "filename": "resume.pdf",
    "technical_skills": ["Python", "React", "Docker"],
    "ats_score": 72,
    "top_strengths": ["Strong technical breadth"],
    "skill_gaps": ["System Design", "Docker"],
    "analyzed_at": "2026-05-29T10:00:00+00:00"
  },
  "usageToday": {
    "resume": 1,
    "market": 0,
    "roadmap": 0,
    "linkedin": 1,
    "full_analysis": 0,
    "interview": 0,
    "voice": 0
  },
  "weeklyActivity": [
    {"day": "Mon", "actions": 3},
    {"day": "Tue", "actions": 5},
    {"day": "Wed", "actions": 2},
    {"day": "Thu", "actions": 7},
    {"day": "Fri", "actions": 4},
    {"day": "Sat", "actions": 1},
    {"day": "Sun", "actions": 0}
  ],
  "monthlyActivity": [
    {"week": "W1", "actions": 12},
    {"week": "W2", "actions": 18},
    {"week": "W3", "act---

<a id="health-endpoints"></a>
## 11. 🏥 **Health Endpoints**

### `GET /health` 🔓

**🏥 Full system health check (includes database connectivity test).**

```json
// Response 200
{
  "status": "ok",
  "database": "connected",
  "service": "AI Career Mentor",
  "version": "1.0.0",
  "provider": "hybrid",
  "model": "hybrid",
  "timestamp": "2026-05-29T18:00:00+00:00"
}
```

```json
// Response 503 (DB down)
{
  "status": "degraded",
  "database": "disconnected",
  "service": "AI Career Mentor",
  "version": "1.0.0",
  "provider": "hybrid",
  "model": "hybrid",
  "timestamp": "2026-05-29T18:00:00+00:00"
}
```

---

### `GET /ping` 🔓

**🏓 Lightweight keep-alive endpoint (used by Render free tier cron to prevent spin-down).**

```json
// Response 200
{
  "pong": true
}
```

---

### `GET /` 🔓

**🏠 Root endpoint with navigation links.**

```json
// Response 200
{
  "message": "Welcome to AI Career Mentor API 🚀",
  "docs": "/docs",
  "health": "/health"
}
```

---

<a id="admin-observability"></a>
## 12. 🛡️ **Admin & Observability Endpoints**

### `GET /admin/metrics` 🔒 (Admin Whitelist Only)

**📊 Retrieves all real-time observability telemetry (Active users/WS, LLM latency arrays, costs, daily rollups, and rolling error log exception feed).**

* **Header Requirements**: `Authorization: Bearer <Admin Token>` (Only email `admin@example.com` is whitelisted).
* **Response 200**:
```json
{
  "active_users": 1,
  "active_websockets": 0,
  "latencies": {
    "groq": [0.55, 0.62],
    "google": [0.15, 0.18],
    "openrouter": [0.45]
  },
  "error_logs": [
    {
      "timestamp": "2026-05-31T04:45:00Z",
      "message": "Redis connection timeout",
      "traceback": "Traceback (most recent call last):\n..."
    }
  ],
  "totals": {
    "resume": 45,
    "interview": 12,
    "roadmap": 28,
    "full_analysis": 8,
    "groq_cost": 0.0452,
    "google_cost": 0.0000,
    "openrouter_cost": 0.0000,
    "all_time_cost": 0.0452
  },
  "historical_chart": [
    {
      "date": "2026-05-31",
      "requests": 25,
      "tokens": 120500,
      "cost": 0.0825,
      "fallbacks": 1,
      "errors": 0,
      "resumes": 10,
      "interviews": 3,
      "roadmaps": 8,
      "full_analyses": 2,
      "groq_cost": 0.0124,
      "google_cost": 0.0000,
      "openrouter_cost": 0.0000
    }
  ],
  "settings": {
    "llm_provider": "hybrid",
    "active_model": "gpt-oss-120b"
  }
}
```

* **Response 403 (Standard User)**:
```json
{
  "detail": "Forbidden: Admin access required"
}
```

---

### `GET /admin/prometheus-metrics` 🔒 (Admin Whitelist Only)

**📈 Exposes standard Prometheus scrape format metrics for server status instrumentation.**

* **Header Requirements**: `Authorization: Bearer <Admin Token>`
* **Response 200**: Prometheus raw text metrics.

---

<a id="error-codes"></a>
## 13. ❌ **Error Codes**

### 📋 **Complete Error Reference**

| 🔴 Code | 🏷️ Meaning | 💡 Common Causes | 🛡️ Resolution |
|:-------:|:-----------:|------------------|---------------|
| **400** | Bad Request | Invalid input, missing fields, duplicate email, invalid PDF | Check request format and field requirements |
| **401** | Unauthorized | Invalid/expired JWT, bad Google OAuth token | Re-authenticate or refresh token |
| **404** | Not Found | Roadmap, interview, or market analysis not found | Verify resource ID exists for current user |
| **422** | Unprocessable Entity | Cannot extract text from scanned PDF | Upload a text-based PDF (not scanned/image) |
| **429** | Too Many Requests | Daily rate limit reached or multi-day gap lock active | Wait for daily reset or gap lock expiry |
| **500** | Internal Server Error | LLM provider failure, database error, unexpected exception | Retry; if persists, contact support |
| **504** | Gateway Timeout | Resume analysis exceeded 120s timeout | Try again with a shorter resume |

### 📨 **Error Response Format**

All errors follow a consistent JSON format:

```json
// Single error
{
  "detail": "Human-readable error message describing the issue"
}

// Validation error (multiple fields)
{
  "detail": [
    {
      "loc": ["body", "email"],
      "msg": "value is not a valid email address",
      "type": "value_error"
    },
    {
      "loc": ["body", "password"],
      "msg": "ensure this value has at least 6 characters",
      "type": "value_error"
    }
  ]
}
```

// Rate limit error
{
  "detail": "Daily limit reached for resume analysis (max 2 per day). Try again tomorrow."
}
```

### 🎯 **Error by Endpoint**

| Endpoint | 400 | 401 | 404 | 422 | 429 | 500 | 504 |
|----------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `/auth/register` | ✅ | — | — | ✅ | — | — | — |
| `/auth/login` | — | ✅ | — | — | — | — | — |
| `/auth/google` | — | ✅ | — | — | — | — | — |
| `/auth/refresh` | — | ✅ | — | — | — | — | — |
| `/resume/upload` | ✅ | — | — | ✅ | — | — | — |
| `/resume/analyze` | ✅ | — | — | — | ✅ | ✅ | ✅ |
| `/roadmap/generate` | ✅ | — | — | — | ✅ | ✅ | — |
| `/roadmap/{id}/toggle-week/{week}` | — | — | ✅ | — | — | — | — |
| `/market/trends` | — | — | — | — | ✅ | ✅ | — |
| `/career/full-analysis/stream` | — | — | — | — | ✅ | ✅ | — |
| `/linkedin/optimize` | ✅ | — | — | — | ✅ | ✅ | — |
| `/interview/*` | — | ✅ | ✅ | — | — | — | — |
| `/user/stats` | — | — | — | — | — | — | — |

---

<a id="rate-limits"></a>
## 14. 🚦 **Rate Limits**

### 🌐 **Global Rate Limits (per IP — SlowAPI)**

| Environment | Daily Limit | Hourly Limit | Backend |
|-------------|:-----------:|:------------:|---------|
| 💻 **Development** | 100,000 requests/day | Unlimited | `memory://` (no Redis needed) |
| 🌍 **Production** | 1,000 requests/day | 100 requests/hour | Redis (Upstash) |

### 📊 **Per-Feature Daily Caps (per user)**

| Feature | 🚦 Limit | ⏰ Gap Lock | 🔑 Redis Key Pattern |
|---------|:----------:|:-----------:|---------------------|
| **📄 Resume Analysis** | **1 / day** | ✅ (2-day) | `usage:{uid}:resume:{date}` + `usage_block:{uid}:resume` |
| **📈 Market Research** | **1 / day** | ❌ | `usage:{uid}:market:{date}` |
| **🔗 LinkedIn Optimization** | **1 / day** | ❌ | `usage:{uid}:linkedin:{date}` |
| **🗺️ Roadmap Generation** | **1 / day** | ✅ (5-day) | `usage:{uid}:roadmap:{date}` + `usage_block:{uid}:roadmap` |
| **🧠 Full Career Analysis** | **1 / day** | ✅ (7-day) | `usage:{uid}:full_analysis:{date}` + `usage_block:{uid}:full_analysis` |
| **🎤 Mock Interview** | **1 / day** | ✅ (7-day) | `usage:{uid}:interview:{date}` + `usage_block:{uid}:interview` |

### 🚦 **Rate Limit Error Response**

When a rate limit is exceeded, the API returns:

```json
// HTTP 429 Too Many Requests
{
  "detail": "Your daily limit for Resume has been reached (1 uses/day). Please try again tomorrow."
}

// HTTP 429 with multi-day gap lock
{
  "detail": "This feature can only be accessed once every 7 days. Please try again later."
}
```

### ⚠️ **Important Notes**

> - Rate limits are **bypassed** when `APP_ENV=development` (local development)
> - **Multi-day gap locks** use Redis TTL keys with dynamic expiry (2, 3, 5, or 7 days depending on the feature)
> - Rate limit counters **reset daily** at midnight UTC

---

<div align="center">

---

**Built with 🧠 by [Anil Pradhan](https://github.com/Anil-Pradhan-web)**

| 📘 README | 🏗️ Architecture | ⚙️ API Reference |
|:---------:|:---------------:|:----------------:|
| [README.md](../README.md) | [ARCHITECTURE.md](./ARCHITECTURE.md) | **You are here** |

---

</div>
