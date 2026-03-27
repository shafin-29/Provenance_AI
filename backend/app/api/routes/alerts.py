import logging
import time
from collections import defaultdict
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from app.core.db import prisma
from datetime import datetime, timezone

logger = logging.getLogger("provenance.alerts")

router = APIRouter(tags=["alerts"])

# Simple in-memory rate limiter for ingest (imported from keys or duplicated here)
_rate_store: dict[str, list[float]] = defaultdict(list)


def _check_rate_limit(key: str, max_requests: int, window_seconds: int = 60) -> None:
    now = time.time()
    _rate_store[key] = [t for t in _rate_store[key] if now - t < window_seconds]
    if len(_rate_store[key]) >= max_requests:
        retry_after = int(window_seconds - (now - _rate_store[key][0]))
        raise HTTPException(
            status_code=429,
            detail={
                "error": "Rate limit exceeded",
                "code": "RATE_LIMITED",
                "retryAfter": max(retry_after, 1),
            },
        )
    _rate_store[key].append(now)


class MarkStaleRequest(BaseModel):
    sourceRecordId: str


@router.get("/alerts")
async def get_alerts():
    alerts = await prisma.stalenessalert.find_many(
        where={"resolvedAt": None},
        include={"sourceRecord": True}
    )
    results = []
    now = datetime.now(timezone.utc)
    for alert in alerts:
        # Standardize keys to camelCase for Next.js and E2E tests
        d = {
            "id": alert.id,
            "sourceRecordId": alert.sourceRecordId,
            "detectedAt": alert.detectedAt,
            "previousHash": alert.previousHash,
            "currentHash": alert.currentHash,
            "embeddingsMarked": alert.embeddingsMarked,
            "resolvedAt": alert.resolvedAt,
            "sourceRecord": alert.sourceRecord if hasattr(alert, "sourceRecord") else None
        }
        
        src = d.get("sourceRecord", {}) or {}
        # src is an object or a model, handle accordingly
        if hasattr(src, "dict"):
            src_dict = src.dict()
        else:
            src_dict = src

        vts = src_dict.get("versionTs") or src_dict.get("createdAt")
        days_stale = 0
        if vts:
            if isinstance(vts, str):
                vts = datetime.fromisoformat(vts.replace('Z', '+00:00'))
            elif vts.tzinfo is None:
                vts = vts.replace(tzinfo=timezone.utc)
            delta = now - vts
            days_stale = max(0, delta.days)

        d["daysStale"] = days_stale

        if days_stale >= 31:
            d["severity"] = "critical"
        elif days_stale >= 8:
            d["severity"] = "danger"
        else:
            d["severity"] = "warning"

        d["lastIngestedAt"] = src_dict.get("createdAt")
        results.append(d)

    return results


@router.get("/alerts/summary")
async def get_alerts_summary():
    alerts = await get_alerts()
    total_stale = len(alerts)
    critical_count = sum(1 for a in alerts if a.get("severity") == "critical")
    danger_count = sum(1 for a in alerts if a.get("severity") == "danger")
    warning_count = sum(1 for a in alerts if a.get("severity") == "warning")
    total_embeddings = sum(a.get("embeddingsMarked", 0) for a in alerts)

    return {
        "totalStale": total_stale,
        "criticalCount": critical_count,
        "dangerCount": danger_count,
        "warningCount": warning_count,
        "totalAffectedSessions": 0,
        "totalStaleEmbeddings": total_embeddings
    }


@router.post("/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: str):
    alert = await prisma.stalenessalert.update(
        where={"id": alert_id},
        data={"resolvedAt": datetime.now(timezone.utc)}
    )
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    return {"resolved": True, "resolvedAt": alert.resolvedAt}


@router.get("/alerts/history")
async def get_alerts_history():
    alerts = await prisma.stalenessalert.find_many(
        order={"detectedAt": "desc"},
        include={"sourceRecord": True}
    )
    return [a.model_dump() if hasattr(a, 'model_dump') else a.dict() for a in alerts]


@router.post("/alerts/run-check")
async def run_check():
    from app.jobs.staleness import run_staleness_check
    try:
        result = await run_staleness_check()
        logger.info("Manual staleness check ran: checked=%d stale=%d", result["checked"], result["markedStale"])
        return {"checked": result["checked"], "stale": result["markedStale"]}
    except Exception as e:
        logger.error("Manual staleness check failed: %s", e)
        return {"checked": 0, "stale": 0}


@router.post("/alerts/mark-stale")
async def mark_stale(req: MarkStaleRequest):
    """Mark a specific source record as stale and create a staleness alert."""
    record = await prisma.sourcerecord.find_unique(where={"id": req.sourceRecordId})
    if not record:
        raise HTTPException(status_code=404, detail="SourceRecord not found")

    await prisma.sourcerecord.update(
        where={"id": req.sourceRecordId},
        data={"isStale": True}
    )

    result = await prisma.embedding.update_many(
        where={"parentSourceRecordId": req.sourceRecordId},
        data={"isStale": True}
    )
    emb_count = result if isinstance(result, int) else getattr(result, "count", 0)

    alert = await prisma.stalenessalert.create(
        data={
            "sourceRecordId": req.sourceRecordId,
            "previousHash": record.contentHash,
            "currentHash": record.contentHash,  # Same hash for manual mark
            "embeddingsMarked": emb_count,
        }
    )

    logger.info("Manually marked stale: sourceRecordId=%s embeddings=%d", req.sourceRecordId, emb_count)
    return {"markedStale": True, "alertId": alert.id, "embeddingsMarked": emb_count}


@router.post("/alerts/test-email")
async def test_email():
    return {"success": True, "message": "Simulated email dispatch"}
