# ProvenanceAI

**Distributed tracing for AI pipelines.**

ProvenanceAI traces every LLM response back through the exact data records that produced it — from source file to chunk to embedding to retrieval to prompt to output. Think Datadog APM, but for RAG systems.

---

## Repository Structure

```
provenance_ai/
├── web/              # Next.js 14+ frontend (App Router, TypeScript, Tailwind CSS)
├── backend/          # Python FastAPI backend
│   ├── app/
│   │   ├── api/
│   │   │   └── routes/    # API route modules
│   │   ├── core/          # Configuration, shared utilities
│   │   ├── models/        # Pydantic schemas & DB models
│   │   └── services/      # Business logic
│   └── requirements.txt
└── README.md
```

## Quick Start

### Prerequisites

- **Node.js** ≥ 18
- **Python** ≥ 3.11
- **npm** (comes with Node.js)
- **pip** (comes with Python)

### 1. Frontend (Next.js)

```bash
cd web
npm install        # first time only
npm run dev        # → http://localhost:3000
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

# Install Python dependencies
pip install -r requirements.txt
pip install prisma  # Required for the database client

# Install Node dependencies (for Prisma CLI)
npm install

# Generate Prisma client
npx prisma generate

# Run the server
uvicorn app.main:app --reload --port 8000   # → http://localhost:8000
```

#### Verify

```bash
curl http://localhost:8000/health
# → {"status":"ok","service":"provenance-ai"}
```

Interactive docs are available at **http://localhost:8000/docs**.

---

## Tech Stack

| Layer    | Technology                            |
| -------- | ------------------------------------- |
| Frontend | Next.js 14+, TypeScript, Tailwind CSS |
| Backend  | Python, FastAPI                       |
| Database | PostgreSQL (Neon) via Prisma — *TBD*  |

## License

Private — all rights reserved.
