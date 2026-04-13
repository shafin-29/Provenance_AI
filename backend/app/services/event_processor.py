"""Event Processor — routes incoming shield events to the right handlers.

This runs ASYNCHRONOUSLY after the HTTP response is returned to the SDK.
Events are processed via FastAPI BackgroundTasks — the SDK never waits.
"""

import logging
from datetime import datetime, timezone

from app.core.db import prisma

logger = logging.getLogger("provenance.event_processor")


class EventProcessor:
    """Processes shield events and routes them to appropriate handlers.

    Supported event types:
    - shield.chunk.stale → handle_stale_chunk
    - shield.chunk.quarantined → handle_quarantine_event
    - shield.response.blocked → handle_blocked_response
    - ingestion.complete → handle_ingestion_complete
    - quarantine.added → handle_quarantine_added
    """

    @staticmethod
    async def process(event_type: str, payload: dict) -> None:
        """Route an event to the correct handler. Never raises — all errors logged.

        Args:
            event_type: The type of shield event.
            payload: The full event payload dict.
        """
        try:
            handler_map = {
                "shield.chunk.stale": EventProcessor.handle_stale_chunk,
                "shield.chunk.quarantined": EventProcessor.handle_quarantine_event,
                "shield.response.blocked": EventProcessor.handle_blocked_response,
                "ingestion.complete": EventProcessor.handle_ingestion_complete,
                "quarantine.added": EventProcessor.handle_quarantine_added,
            }

            handler = handler_map.get(event_type)
            if handler:
                logger.info("EventProcessor: processing %s", event_type)
                await handler(payload)
            else:
                logger.debug("EventProcessor: unhandled event type %s — ignored", event_type)

        except Exception as e:
            logger.error(
                "EventProcessor.process failed for %s: %s",
                event_type, e, exc_info=True
            )

    @staticmethod
    async def handle_stale_chunk(payload: dict) -> None:
        """Handle shield.chunk.stale — staleness detected on a chunk.

        1. Look up SourceRecord by sourceId
        2. Check for active incident (deduplication)
        3. If new: call RemediationEngine.handle_staleness()
        """
        source_id = payload.get("sourceId") or payload.get("source_id", "")
        if not source_id:
            logger.warning("handle_stale_chunk: missing sourceId in payload")
            return

        record = await prisma.sourcerecord.find_first(where={"sourceId": source_id})
        if not record:
            logger.warning("handle_stale_chunk: SourceRecord not found for %s", source_id)
            return

        # Check for active incident (deduplication)
        active_incident = await prisma.incident.find_first(
            where={
                "sourceRecordId": record.id,
                "status": {"not": "resolved"}
            }
        )

        if active_incident:
            # Link this event to the existing incident
            logger.info(
                "Active incident %s already exists for %s — deduplicating",
                active_incident.id, source_id
            )
            # Try to link the shield event to the incident
            try:
                # Find the most recent shield event for this source
                latest_event = await prisma.shieldevent.find_first(
                    where={"sourceId": source_id},
                    order={"createdAt": "desc"}
                )
                if latest_event and not latest_event.incidentId:
                    await prisma.shieldevent.update(
                        where={"id": latest_event.id},
                        data={"incidentId": active_incident.id}
                    )
            except Exception as e:
                logger.debug("Failed to link shield event to incident: %s", e)
            return

        # No active incident — trigger remediation
        from app.services.remediation import RemediationEngine
        await RemediationEngine.handle_staleness(record.id)

    @staticmethod
    async def handle_quarantine_event(payload: dict) -> None:
        """Handle shield.chunk.quarantined — a chunk was quarantined by the shield."""
        source_id = payload.get("sourceId") or payload.get("source_id", "")
        logger.info("Quarantine event received for source: %s", source_id)
        # This is informational — the actual quarantine was already applied by the shield

    @staticmethod
    async def handle_blocked_response(payload: dict) -> None:
        """Handle shield.response.blocked — pipeline was blocked (CRITICAL severity).

        This is the most severe event — a pipeline could not produce a response
        because stale/quarantined data was the only data available.
        """
        source_id = payload.get("sourceId") or payload.get("source_id", "")
        session_id = payload.get("sessionId") or payload.get("session_id", "")
        stale_count = payload.get("staleCount", 0)
        total_count = payload.get("totalCount", 0)

        if not source_id:
            logger.warning("handle_blocked_response: missing sourceId")
            return

        record = await prisma.sourcerecord.find_first(where={"sourceId": source_id})
        if not record:
            logger.warning("handle_blocked_response: SourceRecord not found for %s", source_id)
            return

        # Look up or create incident
        active_incident = await prisma.incident.find_first(
            where={
                "sourceRecordId": record.id,
                "status": {"not": "resolved"}
            }
        )

        if active_incident:
            # Escalate to critical if not already
            if active_incident.severity != "critical":
                await prisma.incident.update(
                    where={"id": active_incident.id},
                    data={"severity": "critical"}
                )
            incident_id = active_incident.id
        else:
            # Create new critical incident
            incident = await prisma.incident.create(
                data={
                    "sourceRecordId": record.id,
                    "status": "active",
                    "severity": "critical",
                    "changeType": "BLOCKED",
                    "action": "EMERGENCY_QUARANTINE",
                    "notes": f"Pipeline blocked: session={session_id}, stale={stale_count}/{total_count}",
                }
            )
            incident_id = incident.id

        logger.warning(
            "CRITICAL: Pipeline blocked — source=%s session=%s stale=%d/%d",
            source_id, session_id, stale_count, total_count
        )

        # Fire immediate alert (don't batch — blocked pipelines are urgent)
        try:
            from app.services.alert_dispatcher import AlertDispatcher
            await AlertDispatcher.fire(incident_id, immediate=True)
        except Exception as e:
            logger.error("Failed to dispatch blocked response alert: %s", e)

    @staticmethod
    async def handle_quarantine_added(payload: dict) -> None:
        """Handle quarantine.added — a source was added to quarantine.

        1. Look up SourceRecord
        2. Mark all embeddings stale
        3. Create incident if needed
        """
        source_id = payload.get("sourceId") or payload.get("source_id", "")
        reason = payload.get("reason", "quarantine_event")

        if not source_id:
            logger.warning("handle_quarantine_added: missing sourceId")
            return

        record = await prisma.sourcerecord.find_first(where={"sourceId": source_id})
        if not record:
            logger.warning("handle_quarantine_added: SourceRecord not found for %s", source_id)
            return

        # Mark all embeddings stale
        result = await prisma.embedding.update_many(
            where={"parentSourceRecordId": record.id},
            data={"isStale": True}
        )
        emb_count = result if isinstance(result, int) else getattr(result, "count", 0)

        logger.info(
            "Source quarantined: %s — %d embeddings marked stale",
            source_id, emb_count
        )

        # Create incident if no active one exists
        active_incident = await prisma.incident.find_first(
            where={
                "sourceRecordId": record.id,
                "status": {"not": "resolved"}
            }
        )
        if not active_incident:
            await prisma.incident.create(
                data={
                    "sourceRecordId": record.id,
                    "status": "active",
                    "severity": "high",
                    "action": "QUARANTINE_AND_REINGEST",
                    "embeddingsAffected": emb_count,
                    "notes": f"Quarantine event: {reason}",
                }
            )

    @staticmethod
    async def handle_ingestion_complete(payload: dict) -> None:
        """Handle ingestion.complete — source was re-ingested with new content.

        If the content hash changed, clear staleness and resolve incidents.
        """
        source_id = payload.get("sourceId") or payload.get("source_id", "")
        content_hash = payload.get("contentHash") or payload.get("content_hash", "")

        if not source_id:
            logger.warning("handle_ingestion_complete: missing sourceId")
            return

        record = await prisma.sourcerecord.find_first(where={"sourceId": source_id})
        if not record:
            logger.warning("handle_ingestion_complete: SourceRecord not found for %s", source_id)
            return

        if content_hash and record.contentHash != content_hash:
            # Source was re-ingested with new content — clear staleness
            await prisma.sourcerecord.update(
                where={"id": record.id},
                data={
                    "isStale": False,
                    "isQuarantined": False,
                    "pendingReingest": False,
                    "contentHash": content_hash,
                }
            )

            # Resolve any active incidents for this source
            active_incidents = await prisma.incident.find_many(
                where={
                    "sourceRecordId": record.id,
                    "status": {"not": "resolved"}
                }
            )
            for incident in active_incidents:
                await prisma.incident.update(
                    where={"id": incident.id},
                    data={
                        "status": "resolved",
                        "resolvedAt": datetime.now(timezone.utc),
                        "resolvedBy": "reingest",
                    }
                )

            logger.info(
                "Re-ingestion confirmed for %s — staleness cleared, %d incidents resolved",
                source_id, len(active_incidents)
            )
