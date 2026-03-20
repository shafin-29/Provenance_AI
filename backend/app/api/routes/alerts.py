import asyncio
import logging
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.core.db import prisma

logger = logging.getLogger("provenance.alerts")

router = APIRouter()


class MarkStaleRequest(BaseModel):
    sourceRecordId: str


# ──────────────────────────────────────────────
# FIX 1 — Correct blast-radius computation
# ──────────────────────────────────────────────
@router.get("/api/alerts")
async def get_alerts():
    """Return all stale SourceRecords with correct blast-radius counts."""
    records = await prisma.sourcerecord.find_many(
        where={"isStale": True},
        include={
            "embeddings": {
                "where": {"isStale": True},
                "include": {
                    "retrievalEvents": {
                        "include": {
                            "retrievalEvent": True
                        }
                    }
                }
            }
        },
        order={"updatedAt": "desc"},
    )

    results = []
    for record in records:
        stale_embedding_count = len(record.embeddings) if record.embeddings else 0

        affected_sessions: set[str] = set()
        most_recent_session: str | None = None
        most_recent_time = None

        for emb in (record.embeddings or []):
            for rev_emb in (emb.retrievalEvents or []):
                re = rev_emb.retrievalEvent
                if re and re.sessionId:
                    affected_sessions.add(re.sessionId)
                    if most_recent_time is None or re.retrievedAt > most_recent_time:
                        most_recent_time = re.retrievedAt
                        most_recent_session = re.sessionId

        results.append({
            "id": record.id,
            "sourceId": record.sourceId,
            "contentHash": record.contentHash,
            "versionTs": record.versionTs.isoformat() if record.versionTs else None,
            "pipelineId": record.pipelineId,
            "updatedAt": record.updatedAt.isoformat() if record.updatedAt else None,
            "staleEmbeddingCount": stale_embedding_count,
            "affectedSessionCount": len(affected_sessions),
            "mostRecentSessionId": most_recent_session,
        })

    return results


# ──────────────────────────────────────────────
# POST /api/alerts/mark-stale  (manual trigger)
# ──────────────────────────────────────────────
@router.post("/api/alerts/mark-stale")
async def mark_stale(request: MarkStaleRequest):
    record = await prisma.sourcerecord.find_unique(
        where={"id": request.sourceRecordId}
    )
    if not record:
        raise HTTPException(status_code=404, detail="SourceRecord not found")

    await prisma.sourcerecord.update(
        where={"id": request.sourceRecordId},
        data={"isStale": True},
    )

    result = await prisma.embedding.update_many(
        where={"parentSourceRecordId": request.sourceRecordId},
        data={"isStale": True},
    )
    count = result if isinstance(result, int) else getattr(result, "count", 0)

    return {"updated": True, "embeddingsMarked": count}


# ──────────────────────────────────────────────
# GET /api/alerts/history
# ──────────────────────────────────────────────
@router.get("/api/alerts/history")
async def get_alert_history():
    """Return all StalenessAlert records ordered by detectedAt desc."""
    alerts = await prisma.stalenessalert.find_many(
        include={"sourceRecord": True},
        order={"detectedAt": "desc"},
    )

    return [
        {
            "id": a.id,
            "sourceId": a.sourceRecord.sourceId if a.sourceRecord else "unknown",
            "detectedAt": a.detectedAt.isoformat(),
            "previousHash": a.previousHash,
            "currentHash": a.currentHash,
            "embeddingsMarked": a.embeddingsMarked,
            "resolvedAt": a.resolvedAt.isoformat() if a.resolvedAt else None,
        }
        for a in alerts
    ]


# ──────────────────────────────────────────────
# POST /api/alerts/run-check  (manual job trigger)
# ──────────────────────────────────────────────
@router.post("/api/alerts/run-check")
async def run_staleness_check_now():
    """Run the staleness detection job immediately."""
    from app.jobs.staleness import run_staleness_check

    result = await run_staleness_check()
    return result

# ──────────────────────────────────────────────
# GET /api/alerts/settings
# ──────────────────────────────────────────────
@router.get("/api/alerts/settings")
async def get_alert_settings():
    """Return email configuration settings."""
    email_to = os.environ.get("ALERT_EMAIL_TO", "")
    api_key = os.environ.get("RESEND_API_KEY", "")
    interval = int(os.environ.get("STALENESS_CHECK_INTERVAL_HOURS", "24"))
    
    return {
        "alertEmailTo": email_to,
        "emailConfigured": bool(api_key),
        "checkIntervalHours": interval,
        "lastCheckRan": None
    }

# ──────────────────────────────────────────────
# POST /api/alerts/test-email
# ──────────────────────────────────────────────
@router.post("/api/alerts/test-email")
async def trigger_test_email():
    """Send a test email using the resend service."""
    from app.services.email import send_test_email
    result = send_test_email()
    return result
