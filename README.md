<div align="center">
  
  # ProvenanceAI
  
  **Distributed tracing for AI pipelines.**

  ProvenanceAI traces every LLM response back through the exact data records that produced it — from source file to chunk to embedding to retrieval to prompt to output. Think Datadog APM, but for RAG systems.

</div

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

---

## Features

**🧬 End-to-End RAG Lineage**  
Track every piece of data from its source file to the final LLM response. Provenance tokens capture source IDs, version timestamps, transformation logs, and content hashes automatically embedded into your vector DB metadata.

**📡 Full Pipeline Visibility**  
Reconstruct the entire chain: source → transformations → chunks → embeddings → retrieval events → prompt contexts → model outputs. Instead of guessing why an answer was wrong, you can see the exact root cause.

**🔗 Zero-Refactor Integration**  
Drop-in wrappers for LangChain, LlamaIndex, and custom retrievers. You keep your existing pipeline ProvenanceAI instruments it transparently with only a few lines of SDK code.

**🧭 Real-Time Staleness Detection**  
Daily source polling automatically identifies outdated embeddings and runs forward graph traversal to mark all dependent responses. Know instantly what needs to be refreshed.

**💡 Attribution & Influence Ranking**  
Counterfactual scoring highlights which retrieved chunk contributed most to a hallucination. Debug multi-source answers with clarity instead of guesswork.

**🚨 Human-in-the-Loop Controls**  
One-click quarantine lets you tombstone bad embeddings on demand removed from all future retrievals at the vector wrapper layer without a reindex.

**⚙️ Auto-Remediation Workflows**  
Trigger Airflow DAGs or LlamaIndex refresh hooks via webhook when staleness or conflicts are detected. Go from hours of manual cleanup to seconds of automated recovery.

---

## Current Limitations

**⏱️ Initial Index Scan Overhead**  
On large vector stores (50M+ embeddings), the first provenance sync may take several hours. Incremental syncs afterward are near-instant.

**📊 Heavy Metadata Usage**  
Provenance tokens add structured metadata to each vector. Most managed vector DBs handle this seamlessly, but extremely metadata-limited configurations may require pruning.

**🔍 Requires Consistent Source Identifiers**  
If upstream systems mutate filenames or primary keys unpredictably, lineage quality degrades. Stable IDs yield dramatically better traceability.

**📈 DAG Growth Over Time**  
The provenance graph expands with retrieval volume. For extremely high-traffic workloads (20k+ RPS), periodic compaction or archival is recommended.

**🛠️ Wrapper-Based Interception**  
Although the SDK avoids pipeline refactors, fully custom retrieval implementations may need lightweight adapter wiring.

**🔒 Best for Mature RAG Pipelines**  
ProvenanceAI provides the most value in production environments with stable ingestion flows. Rapidly evolving experimental pipelines may produce more noise than insights initially.

---

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

| Category | Technology |
|----------|-----------|
| Framework | Next.js | 
| Language | TypeScript | 
| Styling | Tailwind CSS |
| Backend | Python, Fast API |
| Authentication | Clerk |
| Database | PostgreSQL | 
| ORM | Prisma | 

## License

Private — all rights reserved.
