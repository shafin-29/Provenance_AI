"""Shield API routes — aggregated stats and activity from ShieldEvent table.

Provides three read-only endpoints used by the dashboard:
  GET /api/shield/stats         — today's shield activity summary
  GET /api/shield/activity      — daily buckets for bar chart
  GET /api/shield/events/recent — latest events for live pipeline view
"""

import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Query

from app.core.db import prisma

logger = logging.getLogger("provenance.shield")

router = APIRouter(tags=["shield"])


def _today_midnight_utc() -> datetime:
    """Return midnight UTC for today."""
    now = datetime.now(timezone.utc)
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


# ── GET /api/shield/stats ────────────────────────────────────────────────────
@router.get("/shield/stats")
async def get_shield_stats():
    """Returns aggregated shield stats for the dashboard hero and stat cards."""
    today = _today_midnight_utc()

    try:
        # All events today
        all_today = await prisma.shieldevent.find_many(
            where={"createdAt": {"gte": today}}
        )

        chunks_inspected_today = len(all_today)
        chunks_quarantined_today = sum(
            1 for e in all_today if e.eventType == "shield.chunk.quarantined"
        )
        chunks_substituted_today = sum(
            1 for e in all_today if e.eventType == "shield.chunk.substituted"
        )
        responses_protected_today = sum(
            1 for e in all_today if e.eventType == "shield.response.protected"
        )
        responses_blocked_today = sum(
            1 for e in all_today if e.eventType == "shield.response.blocked"
        )

        # All-time count
        all_time_count = await prisma.shieldevent.count()

        # Most recent event
        latest = await prisma.shieldevent.find_first(
            order={"createdAt": "desc"}
        )

        return {
            "chunksInspectedToday": chunks_inspected_today,
            "chunksQuarantinedToday": chunks_quarantined_today,
            "chunksSubstitutedToday": chunks_substituted_today,
            "responsesProtectedToday": responses_protected_today,
            "responsesBlockedToday": responses_blocked_today,
            "chunksInspectedAllTime": all_time_count,
            "lastEventAt": latest.createdAt if latest else None,
        }
    except Exception as e:
        logger.error("Failed to fetch shield stats: %s", e)
        return {
            "chunksInspectedToday": 0,
            "chunksQuarantinedToday": 0,
            "chunksSubstitutedToday": 0,
            "responsesProtectedToday": 0,
            "responsesBlockedToday": 0,
            "chunksInspectedAllTime": 0,
            "lastEventAt": None,
        }


# ── GET /api/shield/activity ─────────────────────────────────────────────────
@router.get("/shield/activity")
async def get_shield_activity(days: int = Query(7, ge=1, le=30)):
    """Returns daily buckets of shield events for the activity bar chart."""
    try:
        now = datetime.now(timezone.utc)
        start = (now - timedelta(days=days - 1)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )

        events = await prisma.shieldevent.find_many(
            where={"createdAt": {"gte": start}},
            order={"createdAt": "asc"},
        )

        # Build daily buckets
        day_labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        buckets = {}
        for i in range(days):
            day = start + timedelta(days=i)
            day_str = day.strftime("%Y-%m-%d")
            buckets[day_str] = {
                "date": day_str,
                "label": day_labels[day.weekday()],
                "clean": 0,
                "intercepted": 0,
            }

        intercepted_types = {
            "shield.chunk.stale",
            "shield.chunk.quarantined",
            "shield.chunk.substituted",
            "shield.response.blocked",
        }

        for event in events:
            evt_date = event.createdAt
            if evt_date.tzinfo is None:
                evt_date = evt_date.replace(tzinfo=timezone.utc)
            day_key = evt_date.strftime("%Y-%m-%d")
            if day_key in buckets:
                if event.eventType in intercepted_types:
                    buckets[day_key]["intercepted"] += 1
                else:
                    buckets[day_key]["clean"] += 1

        return list(buckets.values())
    except Exception as e:
        logger.error("Failed to fetch shield activity: %s", e)
        return []


# ── GET /api/shield/events/recent ────────────────────────────────────────────
@router.get("/shield/events/recent")
async def get_recent_shield_events(limit: int = Query(50, ge=1, le=200)):
    """Returns most recent shield events for the live pipeline view."""
    try:
        events = await prisma.shieldevent.find_many(
            order={"createdAt": "desc"},
            take=limit,
        )

        return [
            {
                "id": e.id,
                "eventType": e.eventType,
                "pipelineId": e.pipelineId,
                "sessionId": e.sessionId,
                "sourceId": e.sourceId,
                "payload": e.payload,
                "createdAt": e.createdAt,
            }
            for e in events
        ]
    except Exception as e:
        logger.error("Failed to fetch recent shield events: %s", e)
        return []
