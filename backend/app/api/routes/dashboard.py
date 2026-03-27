"""Dashboard statistics route."""

import logging
from fastapi import APIRouter
from app.core.db import prisma

logger = logging.getLogger("provenance.dashboard")

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard/stats")
async def get_dashboard_stats():
    """Returns high-level counts for the dashboard overview."""
    try:
        total_sources = await prisma.sourcerecord.count()
        total_responses = await prisma.llmresponse.count()
        stale_sources = await prisma.sourcerecord.count(where={"isStale": True})
        active_alerts = await prisma.stalenessalert.count(where={"resolvedAt": None})
        total_embeddings = await prisma.embedding.count()

        return {
            "totalSourcesIngested": total_sources,
            "totalResponsesTraced": total_responses,
            "staleSources": stale_sources,
            "activeAlerts": active_alerts,
            "totalEmbeddings": total_embeddings,
        }
    except Exception as e:
        logger.error("Dashboard stats query failed: %s", e)
        return {
            "totalSourcesIngested": 0,
            "totalResponsesTraced": 0,
            "staleSources": 0,
            "activeAlerts": 0,
            "totalEmbeddings": 0,
        }
