"""Health-check route with actual database connectivity check."""

from datetime import datetime, timezone
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from app.core.db import prisma

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check():
    """Return service health status including database connectivity."""
    try:
        await prisma.query_raw("SELECT 1")
        return {
            "status": "ok",
            "service": "provenance-ai",
            "database": "connected",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={
                "status": "degraded",
                "service": "provenance-ai",
                "database": "disconnected",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )
