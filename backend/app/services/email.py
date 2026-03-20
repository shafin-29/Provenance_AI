import os
import logging
from datetime import datetime
import resend

logger = logging.getLogger("provenance.email")

def init_resend():
    api_key = os.environ.get("RESEND_API_KEY")
    if api_key:
        resend.api_key = api_key
        return True
    return False

def _build_alert_html(stale_records: list, run_id: str) -> str:
    app_url = os.environ.get("APP_URL", "http://localhost:3000")
    
    html = f"""
    <div style="font-family: monospace; background-color: #0a0a0a; color: #f4f4f5; padding: 20px; line-height: 1.6;">
        <h2 style="color: #ef4444; border-bottom: 1px solid #27272a; padding-bottom: 10px;">ProvenanceAI Staleness Detection Report</h2>
        <p style="color: #a1a1aa; font-size: 12px;">Timestamp: {datetime.utcnow().isoformat()}Z</p>
        <p style="font-weight: bold; margin-top: 20px;">{len(stale_records)} source records were marked stale during the latest staleness check.</p>
    """
    
    for r in stale_records:
        source_id = r.get("sourceId", "unknown")
        pipeline_id = r.get("pipelineId", "unknown")
        embeddings = r.get("embeddingsMarked", 0)
        sessions = r.get("affectedSessions", 0)
        
        html += f"""
        <div style="background-color: #111113; border: 1px solid #27272a; border-left: 4px solid #ef4444; padding: 15px; margin: 15px 0; border-radius: 4px;">
            <p style="margin: 0 0 10px 0;"><strong>Source ID:</strong> {source_id}</p>
            <p style="margin: 0 0 5px 0; font-size: 13px; color: #d4d4d8;"><strong style="color: #a1a1aa;">Pipeline ID:</strong> {pipeline_id}</p>
            <p style="margin: 0 0 5px 0; font-size: 13px; color: #d4d4d8;"><strong style="color: #a1a1aa;">Stale Embeddings:</strong> {embeddings}</p>
            <p style="margin: 0 0 10px 0; font-size: 13px; color: #d4d4d8;"><strong style="color: #a1a1aa;">Affected Sessions:</strong> <span style="color: #ef4444; font-weight: bold;">{sessions}</span></p>
            <a href="{app_url}/sources/{r.get('id')}" style="color: #06b6d4; text-decoration: none; font-size: 13px; font-weight: bold;">View Source Record &rarr;</a>
        </div>
        """
        
    html += f"""
        <div style="margin-top: 30px; border-top: 1px solid #27272a; padding-top: 15px; font-size: 11px; color: #52525b;">
            <p>This alert was generated automatically by ProvenanceAI staleness detection.</p>
            <p>Run ID: {run_id}</p>
        </div>
    </div>
    """
    return html

def send_staleness_alert_email(stale_records: list, run_id: str):
    if not init_resend():
        logger.warning("RESEND_API_KEY not configured. Skipping staleness alert email.")
        return False
        
    if not stale_records:
        logger.info("No stale records found — no email sent.")
        return False
        
    to_email = os.environ.get("ALERT_EMAIL_TO")
    from_email = os.environ.get("ALERT_EMAIL_FROM", "onboarding@resend.dev")
    
    if not to_email:
        logger.warning("ALERT_EMAIL_TO not configured. Skipping staleness alert email.")
        return False
        
    try:
        subject = f"ProvenanceAI Staleness Alert — {len(stale_records)} records stale as of {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}"
        html_content = _build_alert_html(stale_records, run_id)
        
        response = resend.Emails.send({
            "from": from_email,
            "to": to_email,
            "subject": subject,
            "html": html_content
        })
        logger.info(f"Staleness alert email sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send staleness alert email: {e}")
        return False

def send_test_email():
    if not init_resend():
        logger.warning("RESEND_API_KEY not configured. Skipping test email.")
        return {"sent": False, "error": "RESEND_API_KEY not configured"}
        
    to_email = os.environ.get("ALERT_EMAIL_TO")
    from_email = os.environ.get("ALERT_EMAIL_FROM", "onboarding@resend.dev")
    
    if not to_email:
        return {"sent": False, "error": "ALERT_EMAIL_TO not configured"}
        
    try:
        html_content = """
        <div style="font-family: monospace; background-color: #0a0a0a; color: #f4f4f5; padding: 20px; line-height: 1.6; border-left: 4px solid #06b6d4;">
            <h2 style="color: #06b6d4;">ProvenanceAI — Test Alert Email</h2>
            <p>This is a test alert from ProvenanceAI.</p>
            <p>Your email alerts are configured correctly.</p>
        </div>
        """
        
        resend.Emails.send({
            "from": from_email,
            "to": to_email,
            "subject": "ProvenanceAI — Test Alert Email",
            "html": html_content
        })
        return {"sent": True}
    except Exception as e:
        logger.error(f"Failed to send test email: {e}")
        return {"sent": False, "error": str(e)}
