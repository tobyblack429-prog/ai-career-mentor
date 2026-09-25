<div align="center">

# 🐳 **AI Career Mentor — Docker Quick Start Guide**

**Complete Containerization & Deployment Reference**

![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker)
![Python](https://img.shields.io/badge/Python-3.11-009688?style=for-the-badge)
![Node](https://img.shields.io/badge/Node-20--Alpine-339933?style=for-the-badge)
![Redis](https://img.shields.io/badge/Redis-7--Alpine-DC382D?style=for-the-badge)

[![📖 Architecture](https://img.shields.io/badge/📖%20Architecture-ARCHITECTURE.md-8B5CF6?style=for-the-badge)](./ARCHITECTURE.md)
[![⚙️ API Reference](https://img.shields.io/badge/⚙️%20API%20Reference-API.md-06B6D4?style=for-the-badge)](./API.md)

</div>

---

## 📑 **Table of Contents**

| # | Section |
|---|---------|
| 1 | [🚀 Quick Start](#1-quick-start) |
| 2 | [🔧 Environment Variables](#2-environment-variables) |
| 3 | [📦 Docker Image Details](#3-docker-image-details) |
| 4 | [🏗️ Architecture Overview](#4-architecture-overview) |
| 5 | [🔍 Troubleshooting](#5-troubleshooting) |
| 6 | [📝 Notes & Best Practices](#6-notes--best-practices) |

---

## 1. 🚀 **Quick Start**

### 🛠️ **Development Mode (with hot-reload)**

```bash
# 1. Copy example env file and fill in your API keys
cp .env.example .env

# 2. Start all services (builds + launches)
docker-compose up --build

# Or run in background (detached mode)
docker-compose up -d --build
```

### 🌍 **Production Mode**

```bash
# Uses production overrides (no source mounts, APP_ENV=production)
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

### 🛑 **Stop Services**

```bash
# Stop gracefully (preserve volumes)
docker-compose down

# Stop and remove volumes (clean slate — deletes Redis data & backend cache)
docker-compose down -v
```

### 📋 **View Logs**

```bash
# All services (follow mode)
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f redis
```

### 🌐 **Access Services**

| Service | URL |
|---------|-----|
| 🖥️ **Frontend** | http://localhost:3000 |
| 🔙 **Backend API** | http://localhost:8000 |
| 📖 **Swagger Docs** | http://localhost:8000/docs |
| 🏥 **Health Check** | http://localhost:8000/health |
| 🏓 **Ping** | http://localhost:8000/ping |
| 🔴 **Redis** | localhost:6379 |

---

## 2. 🔧 **Environment Variables**

Create a `.env` file in the project root directory with these variables:

### 🤖 **AI Providers (Required)**

```env
# ── Groq (Primary LLM — FREE) ──────────────────────────
# Get key from: https://console.groq.com/
GROQ_API_KEY=gsk_your_groq_key_here
GROQ_MODEL=openai/gpt-oss-120b

# ── Google AI Studio (Gemini — Fallback) ─────────────
# Get key from: https://aistudio.google.com/
GOOGLE_API_KEY=your_google_ai_studio_key_here
GOOGLE_MODEL=gemini-3.5-flash

# ── NVIDIA NIM (Fallback LLM + Interview Primary) ────
# Get key from: https://build.nvidia.com/ → API Keys
NVIDIA_API_KEY=nvapi-your_nvidia_key_here
NVIDIA_MODEL=nvidia/nemotron-3-super-120b-a12b
```

### 🗃️ **Database**

```env
# SQLite (default for local development)
DATABASE_URL=sqlite:///./dev.db

# PostgreSQL (recommended for Docker — uncomment postgres service in docker-compose.yml)
# DATABASE_URL=postgresql://<DB_USER>:<DB_PASSWORD>@postgres:5432/ai_career_mentor
```

### 🔐 **Authentication**

```env
SECRET_KEY=your_super_secret_jwt_key_minimum_32_chars
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=30
APP_ENV=development
```

### 🌐 **Google OAuth 2.0**

```env
# Get from: https://console.cloud.google.com/apis/credentials
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### 🔴 **Redis**

```env
# Docker local Redis (auto-configured via docker-compose)
REDIS_URL=redis://redis:6379/0
```

### 🌐 **CORS & Frontend**

```env
CORS_ORIGINS=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

### 🔍 **Search Engines (Optional — for Market Intelligence)**

```env
# Tavily (primary live search for market analysis)
TAVILY_API_KEY=tvly-your_tavily_key_here

# Serper (fallback search engine)
SERPER_API_KEY=your_serper_key_here
```

### 📊 **Observability (Optional)**

```env
# Sentry error monitoring (production only)
SENTRY_DSN=

# Enable Prometheus metrics endpoint
ENABLE_OBSERVABILITY=true

# Admin whitelist email for /admin/metrics access
ADMIN_EMAIL=admin@example.com
```

---

## 3. 📦 **Docker Image Details**

### 🔙 **Backend Dockerfile** — Multi-Stage Build

Located at [`backend/Dockerfile`](../backend/Dockerfile):

| Stage | Base Image | Purpose |
|-------|-----------|---------|
| **Builder** | `python:3.11-slim` | Installs `gcc`, `libpq-dev`, creates venv, installs all pip dependencies |
| **Production** | `python:3.11-slim` | Copies venv from builder, runs as non-root `appuser`, auto-migrates DB on startup |

**Startup Command:**
```bash
alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 \
  --proxy-headers --forwarded-allow-ips='*' --ws-ping-interval 20 --ws-ping-timeout 20
```

**Health Check:**
```bash
python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health', timeout=5)"
```

---

### 🖥️ **Frontend Dockerfile** — 3-Stage Build

Located at [`frontend/Dockerfile`](../frontend/Dockerfile):

| Stage | Base Image | Purpose |
|-------|-----------|---------|
| **Deps** | `node:20-alpine` | Installs npm dependencies from lockfile (`npm ci`) |
| **Builder** | `node:20-alpine` | Copies deps, builds Next.js production bundle (`npm run build`) |
| **Production** | `node:20-alpine` | Copies standalone output, runs as non-root `nextjs` user via `dumb-init` |

**Build Args (injected at build time):**
- `NEXT_PUBLIC_API_URL` — Backend API base URL
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — Google OAuth client ID

**Startup Command:**
```bash
dumb-init node server.js
```

**Health Check:**
```bash
wget --no-verbose --tries=1 --spider http://localhost:3000
```

---

### 🔴 **Redis Service**

| Setting | Value |
|---------|-------|
| **Image** | `redis:7-alpine` |
| **Port** | `6379` |
| **Persistence** | AOF (Append-Only File) via `--appendonly yes` |
| **Volume** | `redis-data` (persists rate-limit counters across restarts) |

---

### 📦 **Build Individual Services**

```bash
# Backend only
docker build -t ai-career-mentor-backend ./backend

# Frontend only
docker build -t ai-career-mentor-frontend ./frontend
```

### ▶️ **Run Individual Containers**

```bash
# Backend (requires .env or -e flags for API keys)
docker run -d -p 8000:8000 --env-file .env --name backend ai-career-mentor-backend

# Frontend
docker run -d -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL=http://localhost:8000 \
  --name frontend ai-career-mentor-frontend
```

---

## 4. 🏗️ **Architecture Overview**

```
┌──────────────────────────────────────────────────────────────┐
│                       User Browser                           │
└──────────────────────────┬───────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
┌─────────────────────┐       ┌─────────────────────┐
│     Frontend         │       │      Backend         │
│     Next.js 14       │◄─────►│     FastAPI          │
│     Port: 3000       │       │     Port: 8000       │
│  (node:20-alpine)    │       │  (python:3.11-slim)  │
└─────────────────────┘       └──────────┬───────────┘
                                          │
                            ┌─────────────┼─────────────┐
                            │             │             │
                            ▼             ▼             ▼
                   ┌───────────┐  ┌───────────┐  ┌─────────────┐
                   │   Redis   │  │  Database  │  │  LLM APIs   │
                   │  7-Alpine │  │  SQLite /  │  │  Groq       │
│  Port:6379│  │  Postgres  │  │  Groq       │
                    │  (cache & │  │  (Neon in  │  │  Gemini     │
                   │  rate lim)│  │   prod)    │  │  API        │
                   └───────────┘  └───────────┘  └─────────────┘
```

### 🔗 **Docker Network**

All services communicate over the internal `ai-career-network` bridge network:

| Service | Container Name | Internal Hostname |
|---------|---------------|-------------------|
| Backend | `ai-career-mentor-backend` | `backend` |
| Frontend | `ai-career-mentor-frontend` | `frontend` |
| Redis | `ai-career-mentor-redis` | `redis` |

### 📦 **Docker Volumes**

| Volume | Mount | Purpose |
|--------|-------|---------|
| `backend-data` | `/app/data` | Persists ChromaDB vector store and curated resources |
| `redis-data` | `/data` | Persists Redis AOF for rate-limit state across restarts |

### 🔄 **Service Dependency Graph**

```
redis (starts first, healthcheck: redis-cli ping)
  └── backend (waits for redis healthy, healthcheck: /health endpoint)
        └── frontend (waits for backend healthy, healthcheck: wget localhost:3000)
```

---

## 5. 🔍 **Troubleshooting**

### ❌ Container won't start

```bash
# Check logs for error details
docker-compose logs backend

# Rebuild without Docker layer cache
docker-compose build --no-cache
```

### 🗃️ Database migration issues

```bash
# Access backend container shell
docker-compose exec backend bash

# Run migrations manually
alembic upgrade head

# Check current migration head
alembic current
```

### 🔌 Port already in use

```bash
# Find process using port 8000 or 3000
# Linux/macOS:
lsof -i :8000
lsof -i :3000

# Windows (PowerShell):
netstat -ano | findstr :8000
netstat -ano | findstr :3000

# Kill the process
kill -9 <PID>          # Linux/macOS
taskkill /PID <PID> /F  # Windows
```

### 🔴 Redis connection errors

```bash
# Verify Redis is running
docker-compose exec redis redis-cli ping
# Expected: PONG

# Check Redis logs
docker-compose logs redis
```

### 🧹 Clear all Docker resources

```bash
# ⚠️ WARNING: Removes ALL containers, networks, images, and volumes
docker system prune -a --volumes
```

---

## 6. 📝 **Notes & Best Practices**

### 🔒 **Security**

- **Non-root users**: Both backend (`appuser`) and frontend (`nextjs`) containers run as non-root users for security hardening
- **Secret management**: Never commit `.env` files — use `.env.example` as a template
- **Production validation**: The backend enforces `SECRET_KEY` change and PostgreSQL requirement when `APP_ENV=production`

### ⚡ **Performance**

- **Multi-stage builds**: Both Dockerfiles use multi-stage builds to minimize final image size (no build tools in production)
- **Layer caching**: Dependencies (`requirements.txt` / `package.json`) are copied first for optimal Docker build cache utilization
- **Signal handling**: Frontend uses `dumb-init` for proper PID 1 signal handling (graceful shutdown)
- **Health checks**: All services include built-in health monitoring with configurable intervals

### 🔄 **Development vs Production**

| Aspect | Development | Production |
|--------|-------------|------------|
| **APP_ENV** | `development` | `production` |
| **Rate Limits** | Bypassed (DEBUG=true) | Enforced via Redis |
| **Database** | SQLite (local file) | PostgreSQL (Neon) |
| **Redis** | Local container | Upstash Redis |
| **Source Code** | Volume mount (hot-reload) | Baked into image |
| **CORS** | `localhost:3000` | Vercel domain(s) |
| **Sentry** | Disabled | Enabled with `SENTRY_DSN` |

### 📦 **Optional PostgreSQL Setup (Local)**

To use PostgreSQL locally instead of SQLite, uncomment the `postgres` service in `docker-compose.yml` and update your `.env`:

```env
DATABASE_URL=postgresql://<DB_USER>:<DB_PASSWORD>@postgres:5432/ai_career_mentor
```

---

<div align="center">

---

**Built with 🧠 by [Anil Pradhan](https://github.com/Anil-Pradhan-web)**

| 📘 README | 🏗️ Architecture | ⚙️ API Reference |
|:---------:|:---------------:|:----------------:|
| [README.md](../README.md) | [ARCHITECTURE.md](./ARCHITECTURE.md) | [API.md](./API.md) |

---

</div>
