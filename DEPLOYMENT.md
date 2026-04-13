# ProvenanceAI — Deployment Guide

Production deployment instructions for the ProvenanceAI pipeline safety layer.

> **Architecture:** Neon PostgreSQL → Render (FastAPI backend) → Vercel (Next.js frontend) → SDK (pip install)

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Database — Neon PostgreSQL](#2-database--neon-postgresql)
3. [Backend — Render](#3-backend--render)
4. [Frontend — Vercel](#4-frontend--vercel)
5. [SDK Distribution](#5-sdk-distribution)
6. [Production Checklist](#6-production-checklist)
7. [Monitoring & Operations](#7-monitoring--operations)

---

## 1. Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | ≥ 18 | Frontend build, Prisma CLI |
| Python | ≥ 3.11 | Backend runtime |
| Git | any | Source control |
| Neon account | — | [neon.tech](https://neon.tech) |
| Render account | — | [render.com](https://render.com) |
| Vercel account | — | [vercel.com](https://vercel.com) |
| Clerk account | — | [clerk.com](https://clerk.com) |
| Resend account | — | [resend.com](https://resend.com) (optional, for email alerts) |

---

## 2. Database — Neon PostgreSQL

### 2.1. Create database

1. Sign up at [neon.tech](https://neon.tech)
2. Create a new project (e.g. `provenance-ai-prod`)
3. Copy the **pooled connection string** — it looks like:
   ```
   postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. Save this as your `DATABASE_URL`

### 2.2. Run Prisma migrations

From your local machine:

```bash
cd backend

# Set the database URL
export DATABASE_URL="postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require"

# Push the schema to the database
npx prisma db push

# Verify tables were created
npx prisma studio
```

This creates all tables: `SourceRecord`, `Embedding`, `RetrievalEvent`, `Incident`, `QuarantineRecord`, `ShieldEvent`, `ApiKey`, etc.

---

## 3. Backend — Render

### 3.1. Create a Web Service

1. Go to [render.com](https://render.com) → **New** → **Web Service**
2. Connect your GitHub repository
3. Configure:

| Setting | Value |
|---------|-------|
| **Name** | `provenance-ai` |
| **Root Directory** | `backend` |
| **Runtime** | Python |
| **Build Command** | `pip install -r requirements.txt && npm install && npx prisma generate` |
| **Start Command** | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| **Instance Type** | Starter ($7/mo) or higher |

### 3.2. Set environment variables

In Render's dashboard → Environment tab, add:

| Variable | Value | Required |
|----------|-------|----------|
| `DATABASE_URL` | Your Neon connection string | ✅ |
| `CLERK_SECRET_KEY` | From Clerk dashboard → API Keys | ✅ |
| `SKIP_AUTH` | `false` | ✅ |
| `ALLOWED_ORIGINS` | `https://your-app.vercel.app` | ✅ |
| `LOG_LEVEL` | `INFO` | ✅ |
| `STALENESS_CHECK_INTERVAL_HOURS` | `24` | ✅ |
| `RESEND_API_KEY` | From Resend dashboard | Optional |
| `ALERT_EMAIL_TO` | Your alert email | Optional |
| `ALERT_EMAIL_FROM` | `alerts@your-domain.com` | Optional |
| `SLACK_WEBHOOK_URL` | Slack incoming webhook URL | Optional |
| `APP_URL` | `https://your-app.vercel.app` | Optional |

### 3.3. Verify deployment

```bash
curl https://provenance-ai.onrender.com/health
# Expected: {"status":"ok","service":"provenance-ai","database":"connected","timestamp":"..."}
```

```bash
curl https://provenance-ai.onrender.com/docs
# Opens Swagger UI
```

> **Note:** Render free tier spins down after inactivity. Use Starter ($7/mo) for always-on.

---

## 4. Frontend — Vercel

### 4.1. Deploy via Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New** → **Project**
2. Import your GitHub repository
3. Configure:

| Setting | Value |
|---------|-------|
| **Framework Preset** | Next.js |
| **Root Directory** | `web` |
| **Build Command** | `next build` |
| **Output Directory** | `.next` |
| **Node.js Version** | 18.x or 20.x |

### 4.2. Set environment variables

In Vercel's dashboard → Settings → Environment Variables:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://provenance-ai.onrender.com` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | From Clerk dashboard |
| `CLERK_SECRET_KEY` | From Clerk dashboard |

### 4.3. Configure Clerk

In Clerk dashboard:
1. Go to **Domains** → Add your Vercel domain
2. Go to **Sessions** → Set session token lifetime
3. Go to **Webhooks** (optional) → Configure if needed

### 4.4. Verify deployment

Visit your Vercel URL. You should see:
- Landing page loads without errors
- Sign-in redirects to Clerk
- Dashboard loads with Shield Status after authentication

---

## 5. SDK Distribution

### Option A: Install from GitHub (recommended for design partner)

```bash
pip install git+https://github.com/your-org/provenance-ai.git#subdirectory=sdk
```

### Option B: Build a wheel (.whl)

```bash
cd sdk
python setup.py bdist_wheel
# Distributes: dist/provenance_ai-0.1.0-py3-none-any.whl
```

Send the `.whl` to your design partner:

```bash
pip install provenance_ai-0.1.0-py3-none-any.whl
```

### Option C: PyPI (future)

```bash
cd sdk
python -m build
twine upload dist/*
```

### SDK usage for design partner

```python
from provenance_ai import ProvenanceAIClient, SafeMode

sdk = ProvenanceAIClient(
    api_url="https://provenance-ai.onrender.com",
    api_key="prov_live_...",            # Generate at /sdk page
    pipeline_id="my-rag-pipeline",
    safe_mode=SafeMode.SUBSTITUTE,      # PASS | WARN | SUBSTITUTE | BLOCK
)

# Verify connection
assert sdk.verify_connection(), "Cannot reach ProvenanceAI backend"

# Ingest documents
docs = sdk.ingest("path/to/document.pdf")

# Wrap your retriever
retriever = sdk.wrap(base_retriever, session_id="sess_001")
results = retriever.get_relevant_documents("your query")

# Record LLM response
sdk.record_response(
    session_id="sess_001",
    response_text="The LLM said...",
    model_version="gpt-4o"
)
```

---

## 6. Production Checklist

Run through this before going live:

### Security

- [ ] `SKIP_AUTH=false` in backend environment
- [ ] `ALLOWED_ORIGINS` locked to your Vercel domain only
- [ ] All API keys generated through the `/sdk` page (not hardcoded)
- [ ] Clerk publishable key is the **production** key, not development
- [ ] `DATABASE_URL` uses SSL (`?sslmode=require`)

### Reliability

- [ ] Health endpoint returns `{"status":"ok","database":"connected"}`
- [ ] Staleness check interval is configured (`STALENESS_CHECK_INTERVAL_HOURS`)
- [ ] Alert channels configured (email and/or Slack)
- [ ] Render instance is Starter tier or higher (not free tier)

### Verification

- [ ] Run `next build` locally — 0 errors
- [ ] Run E2E test suite against production:
  ```bash
  PROVENANCE_AI_API_URL=https://provenance-ai.onrender.com python tests/e2e_test.py
  ```
- [ ] Sign in through Clerk on the Vercel URL
- [ ] Navigate all dashboard pages (Shield, Incidents, Quarantine, Pipeline, Sources, Alerts, SDK)
- [ ] Generate an API key and verify it appears in the dashboard

---

## 7. Monitoring & Operations

### Health monitoring

Set up an uptime monitor (e.g., UptimeRobot, Render's built-in) pointing at:

```
GET https://provenance-ai.onrender.com/health
```

Expected response: `200 OK` with `"database": "connected"`.

### Log access

- **Render:** Dashboard → Logs tab (real-time streaming)
- **Vercel:** Dashboard → Functions tab → Logs

### Database management

```bash
# Open Prisma Studio to inspect data
DATABASE_URL="..." npx prisma studio

# Reset database (DESTRUCTIVE)
DATABASE_URL="..." npx prisma db push --force-reset
```

### Incident response

1. Check `/incidents` dashboard for active incidents
2. Review severity and blast radius
3. For critical incidents: check email/Slack alerts
4. Resolve via dashboard or API: `POST /api/incidents/{id}/resolve`

### Staleness job

The staleness check runs automatically every `STALENESS_CHECK_INTERVAL_HOURS` hours via APScheduler. To trigger manually:

```bash
curl -X POST https://provenance-ai.onrender.com/api/alerts/mark-stale \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"sourceRecordId": "<id>"}'
```

---

## Environment Variables Reference

### Backend (Render)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | — | Neon PostgreSQL connection string |
| `CLERK_SECRET_KEY` | ✅ | — | Clerk API secret key |
| `SKIP_AUTH` | ✅ | `true` | Set to `false` in production |
| `ALLOWED_ORIGINS` | ✅ | `localhost` | Comma-separated CORS origins |
| `LOG_LEVEL` | — | `INFO` | `DEBUG`, `INFO`, `WARNING`, `ERROR` |
| `STALENESS_CHECK_INTERVAL_HOURS` | — | `24` | Hours between staleness checks |
| `RESEND_API_KEY` | — | — | Resend API key for email alerts |
| `ALERT_EMAIL_TO` | — | — | Alert recipient email |
| `ALERT_EMAIL_FROM` | — | `onboarding@resend.dev` | Alert sender email |
| `SLACK_WEBHOOK_URL` | — | — | Slack incoming webhook for alerts |
| `APP_URL` | — | `http://localhost:3000` | Frontend URL (used in alert links) |
| `SEMANTIC_DIFF_THRESHOLD_FORMATTING` | — | `0.95` | Formatting change threshold |
| `SEMANTIC_DIFF_THRESHOLD_ADDITIVE` | — | `0.70` | Additive change threshold |
| `SEMANTIC_DIFF_THRESHOLD_MODIFIED` | — | `0.40` | Modified change threshold |

### Frontend (Vercel)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | ✅ | Backend URL (e.g. `https://provenance-ai.onrender.com`) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✅ | Clerk publishable key |
| `CLERK_SECRET_KEY` | ✅ | Clerk secret key |
