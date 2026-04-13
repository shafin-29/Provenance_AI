<div align="center">
  
  # ProvenanceAI

  **Active safety layer for AI pipelines.**

  Like Cloudflare for RAG pipelines — always-on, invisible, automatic. ProvenanceAI intercepts every retrieval in real time, blocks stale or quarantined data before it reaches the LLM, and traces every response back to its exact source.

</div>

  <div align="center">

![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Clerk](https://img.shields.io/badge/Clerk-6C47FF?style=for-the-badge&logo=clerk&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)

</div>

---

## What It Does

ProvenanceAI sits between your RAG retriever and your LLM. Every chunk that comes back from your vector store passes through the **ProvenanceShield** before it reaches the prompt. Stale data gets flagged, quarantined data gets blocked, and every decision is logged — all in under 20ms.

```
Vector DB → ProvenanceShield → [CLEAN / STALE / QUARANTINE / BLOCK] → LLM
```

---

## Features

**🛡️ Real-Time Shield Interception**  
Four safety modes — `PASS`, `WARN`, `SUBSTITUTE`, `BLOCK` — control how the shield handles stale or quarantined chunks. Configurable per-pipeline, enforced at retrieval time with sub-20ms latency.

**🔬 Automated Remediation Engine**  
When source content changes, the engine runs semantic diff analysis, classifies the change type (FORMATTING → ADDITIVE → MODIFIED → CONTRADICTORY), computes blast radius across all affected LLM responses, and takes automatic action — from monitoring to emergency quarantine.

**📡 End-to-End Lineage Tracing**  
Track every piece of data from source file → chunks → embeddings → retrieval events → prompt contexts → LLM responses. Reconstruct the full chain for any answer your system has ever produced.

**🚨 Multi-Channel Incident Alerts**  
Severity-aware notifications via email (Resend) and Slack with rich formatting, blast radius metrics, and direct links to the incident dashboard.

**🔒 One-Click Quarantine**  
Instantly block any source from being retrieved — from the dashboard or via SDK. Quarantined sources are enforced at the Shield layer with zero pipeline changes required.

**🧬 Staleness Detection**  
Automated background checks compare source file hashes against stored records. When content changes, all downstream embeddings are marked stale and the remediation pipeline fires.

**⚙️ Zero-Refactor Integration**  
Drop-in Python SDK wraps your existing LangChain retriever. Two lines of code to instrument your entire pipeline:

```python
sdk = ProvenanceAIClient(api_url="...", api_key="...", pipeline_id="...")
retriever = sdk.wrap(your_retriever, session_id="sess_001")
```

---

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Python SDK │────▶│  FastAPI API  │────▶│  Neon PostgreSQL │
│  (Shield)   │     │  (Backend)   │     │  (Prisma ORM)   │
└─────────────┘     └──────────────┘     └─────────────────┘
                           │
                    ┌──────┴──────┐
                    │  Next.js    │
                    │  Dashboard  │
                    └─────────────┘
```

| Component | Stack |
|-----------|-------|
| **SDK** | Python, httpx, threading |
| **Backend** | FastAPI, Prisma, APScheduler |
| **Frontend** | Next.js 16, React 19, Tailwind CSS 4 |
| **Auth** | Clerk |
| **Database** | PostgreSQL (Neon) |
| **Alerts** | Resend (email), Slack (webhooks) |

---

## Quick Start

### Prerequisites

- **Node.js** ≥ 18
- **Python** ≥ 3.11
- **npm** (comes with Node.js)
- **pip** (comes with Python)

### 1. Clone & configure

```bash
cp .env.example .env
# Edit .env with your DATABASE_URL, CLERK_SECRET_KEY, etc.
```

### 2. Backend (FastAPI)

```bash
cd backend

# Setup virtual environment
python -m venv .venv
# Windows
.\.venv\Scripts\activate
# macOS / Linux
# source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
pip install prisma

# Install Node deps (for Prisma CLI)
npm install

# Push schema to database
npx prisma db push

# Generate Prisma client
npx prisma generate

# Run the server
uvicorn app.main:app --reload --port 8000   # → http://localhost:8000
```

#### Verify

```bash
curl http://localhost:8000/health
# → {"status":"ok","service":"provenance-ai","database":"connected","timestamp":"..."}
```

Interactive docs at **http://localhost:8000/docs**.

### 3. Frontend (Next.js)

```bash
cd web
npm install        # first time only
npm run dev        # → http://localhost:3000
```

### 4. SDK

```bash
cd sdk
pip install -e .   # editable install for development
python example.py  # run shield demo
```

---

## E2E Test Suite

Run the full integration test suite against a live backend:

```bash
PROVENANCE_AI_API_URL=http://localhost:8000 python tests/e2e_test.py
```

Tests cover: health check, API key CRUD, source ingestion, embedding creation, response chain, lineage trace, staleness detection, re-ingestion, dashboard stats, and cleanup.

---

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for step-by-step production deployment instructions covering Neon, Render, Vercel, and SDK distribution.

---

## License

Private — all rights reserved.
