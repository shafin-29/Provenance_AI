<div align="center">
  
  # ProvenanceAI
  
  **Distributed tracing for AI pipelines.**

**Distributed tracing for AI pipelines.** ProvenanceAI traces LLM and RAG pipeline outputs back to their source data records — giving ML engineers and data engineers full lineage visibility from query response back to raw ingested content.

---

## Architecture Overview

- **Frontend**: Next.js 14+ (App Router), light theme, violet accent, Clerk authentication
- **Backend**: FastAPI + Prisma + Neon PostgreSQL, structured JSON error responses
- **Python SDK**: Pip-installable interceptor for LangChain pipelines
- **Staleness Detection**: Background APScheduler job with email alerts via Resend
- **Schema**: SourceRecord → Embedding → RetrievalEvent → PromptContext → LLMResponse

---

## Prerequisites

- Node.js 18+
- Python 3.8+
- [Neon](https://neon.tech) PostgreSQL account
- [Clerk](https://clerk.com) account (for authentication)
- [Resend](https://resend.com) account (for email alerts)

---

## Local Setup

### 1. Clone the repository
```bash
git clone <repo-url>
cd provenance_ai
```

### 2. Install frontend dependencies
```bash
cd web
npm install
```

### 3. Install backend dependencies
```bash
cd ../backend
python -m venv .venv
.venv\Scripts\activate       # Windows
# source .venv/bin/activate  # Mac/Linux
pip install -r requirements.txt
pip install prisma apscheduler resend python-dotenv
```

### 4. Copy and fill in environment variables
```bash
# Root
cp .env.example .env

# Frontend
cp web/.env.example web/.env.local

# Backend
cp backend/.env.example backend/.env
```
Fill in `DATABASE_URL`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, and `RESEND_API_KEY`.

### 5. Run Prisma migration
```bash
cd backend
npx prisma generate
npx prisma db push
```

### 6. Start the backend
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

### 7. Start the frontend
```bash
cd web
npm run dev
```

### 8. Open the app
Visit [http://localhost:3000](http://localhost:3000)

---

## SDK Quickstart

```python
from provenance_ai import ProvenanceAIClient

sdk = ProvenanceAIClient(
    api_url="http://localhost:8000",
    api_key="prov_live_your_api_key_here",
    pipeline_id="my-rag-pipeline"
)

docs = sdk.ingest("path/to/document.txt")  # Ingests and returns chunked docs
```

Generate your API key at `/sdk` in the dashboard.

---

## Running the E2E Test Suite

Make sure the backend is running, then:

```bash
# Install test dependency
pip install requests

# Run the suite
PROVENANCE_AI_API_URL=http://localhost:8000 python tests/e2e_test.py
```

Expected output: `10/10 tests passed`

---

## Key Pages

| URL | Description |
|-----|-------------|
| `/` | Dashboard overview with stats |
| `/trace` | Lineage trace explorer — paste a session ID |
| `/sources` | All ingested source records with staleness status |
| `/alerts` | Staleness alerts and detection history |
| `/sdk` | SDK setup guide and API key management |
