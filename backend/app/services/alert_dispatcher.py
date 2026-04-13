"""Alert Dispatcher — multi-channel notification system for ProvenanceAI incidents.

Handles all outbound notifications via email (Resend) and Slack (webhooks).
Replaces the basic email-only alerting from services/email.py with
severity-aware, richly formatted incident reports.
"""

import logging
import os
from datetime import datetime, timezone, timedelta

import httpx
import resend

from app.core.db import prisma

logger = logging.getLogger("provenance.alerts")

# ── Slack timeout ──────────────────────────────────────────────────────────────
SLACK_TIMEOUT = 5.0  # seconds — fail silently if Slack is down


def _severity_color(severity: str) -> str:
    """Map severity to hex color for email header band."""
    return {
        "low": "#3b82f6",       # blue
        "medium": "#f59e0b",    # amber
        "high": "#f97316",      # orange
        "critical": "#ef4444",  # red
    }.get(severity, "#6b7280")


def _severity_emoji(severity: str) -> str:
    """Map severity to Slack emoji."""
    return {
        "low": "🟡",
        "medium": "🟠",
        "high": "🔴",
        "critical": "🚨",
    }.get(severity, "⚪")


def _action_description(action: str | None) -> str:
    """Human-readable action description."""
    return {
        "LOW_PRIORITY_ALERT": "Monitoring — no quarantine applied",
        "MONITOR": "Stale embeddings flagged — monitoring for changes",
        "QUARANTINE_AND_REINGEST": "Embeddings quarantined — re-ingestion required",
        "EMERGENCY_QUARANTINE": "EMERGENCY quarantine — immediate action required",
    }.get(action or "", "Unknown action")


def _action_required(action: str | None, source_id: str) -> str:
    """Action required text for the report."""
    if action == "LOW_PRIORITY_ALERT":
        return "No action required — monitoring"
    elif action == "MONITOR":
        return f"Review recommended — run sdk.ingest('{source_id}') when ready"
    elif action == "QUARANTINE_AND_REINGEST":
        return f"Re-ingestion required — run: sdk.ingest('{source_id}')"
    elif action == "EMERGENCY_QUARANTINE":
        return f"IMMEDIATE action required — past responses may contain incorrect data. Run: sdk.ingest('{source_id}')"
    return "Review the incident in the dashboard"


def _build_email_subject(severity: str, source_id: str) -> str:
    """Build email subject based on severity."""
    prefix_map = {
        "low": "ProvenanceAI — Low priority",
        "medium": "ProvenanceAI — Review needed",
        "high": "ProvenanceAI — Action required",
        "critical": "🚨 ProvenanceAI — CRITICAL",
    }
    prefix = prefix_map.get(severity, "ProvenanceAI — Alert")
    return f"{prefix}: {source_id}"


def _build_email_html(incident, source_record, app_url: str) -> str:
    """Build HTML email body with dark-styled incident report."""
    severity = incident.severity or "medium"
    color = _severity_color(severity)
    source_id = source_record.sourceId if source_record else "unknown"
    change_type = incident.changeType or "UNKNOWN"
    score = incident.semanticDiffScore
    score_str = f"{score:.4f}" if score is not None else "N/A"

    what_happened = f"Source <strong>{source_id}</strong> was detected with a <strong>{change_type}</strong> change (severity: {severity})."
    what_was_done = _action_description(incident.action)
    action_required = _action_required(incident.action, source_id)

    html = f"""
    <div style="font-family: 'Segoe UI', monospace; background-color: #0a0a0a; color: #f4f4f5; padding: 0; line-height: 1.6; max-width: 600px; margin: 0 auto;">
        <!-- Severity color band -->
        <div style="background-color: {color}; padding: 16px 24px;">
            <h2 style="color: #ffffff; margin: 0; font-size: 18px;">{_severity_emoji(severity)} ProvenanceAI Incident Report</h2>
            <p style="color: rgba(255,255,255,0.85); margin: 4px 0 0 0; font-size: 13px;">Severity: {severity.upper()} &middot; {change_type}</p>
        </div>

        <div style="padding: 24px;">
            <!-- WHAT HAPPENED -->
            <div style="margin-bottom: 20px;">
                <h3 style="color: {color}; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px 0;">What Happened</h3>
                <p style="margin: 0; font-size: 14px;">{what_happened}</p>
            </div>

            <!-- WHAT WAS DONE AUTOMATICALLY -->
            <div style="margin-bottom: 20px;">
                <h3 style="color: {color}; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px 0;">What Was Done Automatically</h3>
                <ul style="margin: 0; padding-left: 20px; font-size: 14px;">
                    <li>{what_was_done}</li>
                    <li>{incident.embeddingsAffected} embeddings affected</li>
                </ul>
            </div>

            <!-- BLAST RADIUS -->
            <div style="background-color: #111113; border: 1px solid #27272a; border-left: 4px solid {color}; padding: 12px 16px; margin-bottom: 20px; border-radius: 4px;">
                <h3 style="color: {color}; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 4px 0;">Blast Radius</h3>
                <p style="margin: 0; font-size: 20px; font-weight: bold;">{incident.blastRadius} <span style="font-size: 13px; color: #a1a1aa; font-weight: normal;">past LLM responses affected</span></p>
            </div>

            <!-- ACTION REQUIRED -->
            <div style="margin-bottom: 20px;">
                <h3 style="color: {color}; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px 0;">Action Required</h3>
                <p style="margin: 0; font-size: 14px; background-color: #111113; padding: 12px; border-radius: 4px; border: 1px solid #27272a;">{action_required}</p>
            </div>

            <!-- SEMANTIC DIFF -->
            <div style="margin-bottom: 24px;">
                <h3 style="color: {color}; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px 0;">Semantic Diff</h3>
                <p style="margin: 0; font-size: 14px;">Score: <strong>{score_str}</strong> ({change_type} &mdash; {"high similarity" if (score or 0) > 0.7 else "significant changes"})</p>
            </div>

            <!-- CTA BUTTON -->
            <div style="text-align: center; margin-top: 24px;">
                <a href="{app_url}/incidents/{incident.id}" style="display: inline-block; background-color: {color}; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">View Full Incident &rarr;</a>
            </div>
        </div>

        <div style="border-top: 1px solid #27272a; padding: 16px 24px; font-size: 11px; color: #52525b;">
            <p style="margin: 0;">This report was generated automatically by ProvenanceAI Remediation Engine.</p>
            <p style="margin: 4px 0 0 0;">Incident ID: {incident.id} &middot; {datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")}</p>
        </div>
    </div>
    """
    return html


def _build_slack_payload(incident, source_record, app_url: str) -> dict:
    """Build Slack Block Kit payload for incident notification."""
    severity = incident.severity or "medium"
    emoji = _severity_emoji(severity)
    source_id = source_record.sourceId if source_record else "unknown"
    change_type = incident.changeType or "UNKNOWN"
    score = incident.semanticDiffScore
    score_str = f"{score:.4f}" if score is not None else "N/A"

    return {
        "blocks": [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"{emoji} ProvenanceAI — {severity.upper()} Incident",
                    "emoji": True
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": (
                        f"*Source:* `{source_id}`\n"
                        f"*Change type:* {change_type}\n"
                        f"*Action taken:* {_action_description(incident.action)}"
                    )
                }
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*Blast Radius:*\n{incident.blastRadius} responses"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Embeddings:*\n{incident.embeddingsAffected} affected"
                    }
                ]
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": f"Semantic diff: {score_str} · Incident: {incident.id}"
                    }
                ]
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "View Incident"
                        },
                        "url": f"{app_url}/incidents/{incident.id}",
                        "style": "primary"
                    }
                ]
            }
        ]
    }


class AlertDispatcher:
    """Dispatches incident alerts via email (Resend) and Slack (webhooks).

    Sends at most ONE alert per incident (checks alertSent flag).
    Exception: critical incidents re-send if >1 hour since last alert.
    """

    @staticmethod
    async def fire(incident_id: str, immediate: bool = False) -> bool:
        """Fire alerts for an incident to all configured channels.

        Args:
            incident_id: The Prisma ID of the Incident.
            immediate: If True, send immediately regardless of batching.

        Returns:
            True if at least one channel succeeded.
        """
        try:
            return await AlertDispatcher._dispatch(incident_id, immediate)
        except Exception as e:
            logger.error(
                "AlertDispatcher.fire failed for incident %s: %s",
                incident_id, e, exc_info=True
            )
            return False

    @staticmethod
    async def _dispatch(incident_id: str, immediate: bool) -> bool:
        """Internal: Dispatch alerts to all configured channels."""

        # 1. Load incident with source record
        incident = await prisma.incident.find_unique(
            where={"id": incident_id},
            include={"sourceRecord": True}
        )
        if not incident:
            logger.warning("AlertDispatcher: Incident %s not found", incident_id)
            return False

        source_record = incident.sourceRecord

        # 2. Check alertSent flag — deduplication
        if incident.alertSent:
            # Exception: critical incidents re-send if >1 hour since last alert
            if incident.severity == "critical" and incident.alertSentAt:
                time_since = datetime.now(timezone.utc) - incident.alertSentAt.replace(tzinfo=timezone.utc)
                if time_since < timedelta(hours=1):
                    logger.info("Alert already sent for incident %s (critical, <1h ago)", incident_id)
                    return True
                logger.info("Re-sending critical alert for incident %s (>1h since last)", incident_id)
            else:
                logger.info("Alert already sent for incident %s — skipping", incident_id)
                return True

        # 3. Determine channels from env vars
        email_to = os.environ.get("ALERT_EMAIL_TO")
        slack_url = os.environ.get("SLACK_WEBHOOK_URL")
        app_url = os.environ.get("APP_URL", "http://localhost:3000")

        email_ok = False
        slack_ok = False

        # 4. Send email via Resend
        if email_to:
            try:
                email_ok = AlertDispatcher._send_email(incident, source_record, email_to, app_url)
            except Exception as e:
                logger.error("Email alert failed for incident %s: %s", incident_id, e)

        # 5. Send Slack via webhook
        if slack_url:
            try:
                slack_ok = await AlertDispatcher._send_slack(incident, source_record, slack_url, app_url)
            except Exception as e:
                logger.error("Slack alert failed for incident %s: %s", incident_id, e)

        # 6. Update incident
        any_sent = email_ok or slack_ok
        if any_sent:
            await prisma.incident.update(
                where={"id": incident_id},
                data={
                    "alertSent": True,
                    "alertSentAt": datetime.now(timezone.utc),
                }
            )
            channels = []
            if email_ok:
                channels.append("email")
            if slack_ok:
                channels.append("Slack")
            logger.info("Alert sent for incident %s via: %s", incident_id, " + ".join(channels))
        else:
            if email_to or slack_url:
                # At least one channel was configured but both failed
                logger.error(
                    "ALERT FAILED — incident %s not delivered (email=%s, slack=%s)",
                    incident_id,
                    "configured" if email_to else "not configured",
                    "configured" if slack_url else "not configured"
                )
            else:
                logger.warning(
                    "No alert channels configured — incident %s not delivered. "
                    "Set ALERT_EMAIL_TO and/or SLACK_WEBHOOK_URL in .env",
                    incident_id
                )

        return any_sent

    @staticmethod
    def _send_email(incident, source_record, to_email: str, app_url: str) -> bool:
        """Send incident report email via Resend."""
        api_key = os.environ.get("RESEND_API_KEY")
        if not api_key:
            logger.warning("RESEND_API_KEY not configured — skipping email alert")
            return False

        resend.api_key = api_key
        from_email = os.environ.get("ALERT_EMAIL_FROM", "onboarding@resend.dev")

        source_id = source_record.sourceId if source_record else "unknown"
        subject = _build_email_subject(incident.severity or "medium", source_id)
        html = _build_email_html(incident, source_record, app_url)

        resend.Emails.send({
            "from": from_email,
            "to": to_email,
            "subject": subject,
            "html": html,
        })
        logger.info("Incident email sent to %s", to_email)
        return True

    @staticmethod
    async def _send_slack(incident, source_record, webhook_url: str, app_url: str) -> bool:
        """Send incident report to Slack via webhook."""
        if not webhook_url or not webhook_url.startswith("https://"):
            return False

        payload = _build_slack_payload(incident, source_record, app_url)

        async with httpx.AsyncClient(timeout=SLACK_TIMEOUT) as client:
            resp = await client.post(webhook_url, json=payload)
            if resp.status_code == 200:
                logger.info("Slack alert sent for incident %s", incident.id)
                return True
            else:
                logger.warning(
                    "Slack webhook returned %d for incident %s: %s",
                    resp.status_code, incident.id, resp.text[:200]
                )
                return False
