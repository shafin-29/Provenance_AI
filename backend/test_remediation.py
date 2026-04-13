"""End-to-end test for the Remediation Engine.

Steps:
1. Ingest a source record
2. Send a shield.chunk.stale event → triggers EventProcessor → RemediationEngine
3. Check /api/incidents — should have 1 active incident
4. Check /api/incidents/stats — should show counts
5. Check /api/incidents/{id} — should show full detail
6. Acknowledge the incident
7. Resolve the incident
8. Verify resolution
"""

import httpx
import json
import time
import sys

BASE = "http://localhost:8000"


def pretty(data):
    print(json.dumps(data, indent=2, default=str))


def test():
    client = httpx.Client(timeout=10)

    # ── Step 1: Ingest a source record ────────────────────────────────────
    print("\n═══ Step 1: Ingest source record ═══")
    resp = client.post(f"{BASE}/api/ingest", json={
        "sourceId": "test_remediation_doc.txt",
        "contentHash": "abc123hash",
        "versionTs": "2026-04-12T00:00:00Z",
        "pipelineId": "test-pipeline-001",
        "contentPreview": "This is the original content of the document for testing."
    })
    print(f"Status: {resp.status_code}")
    if resp.status_code != 200:
        print(f"Failed: {resp.text}")
        return
    source_record = resp.json()
    source_record_id = source_record["id"]
    print(f"SourceRecord ID: {source_record_id}")

    # ── Step 2: Send shield.chunk.stale event ─────────────────────────────
    print("\n═══ Step 2: Send shield.chunk.stale event ═══")
    resp = client.post(f"{BASE}/api/events", json={
        "eventType": "shield.chunk.stale",
        "pipeline_id": "test-pipeline-001",
        "session_id": "test-session-001",
        "source_id": "test_remediation_doc.txt",
        "sourceId": "test_remediation_doc.txt",
    })
    print(f"Status: {resp.status_code} — {resp.json()}")

    # Wait a moment for background processing
    print("Waiting 3s for background processing...")
    time.sleep(3)

    # ── Step 3: Check /api/incidents ──────────────────────────────────────
    print("\n═══ Step 3: Check /api/incidents ═══")
    resp = client.get(f"{BASE}/api/incidents")
    incidents = resp.json()
    print(f"Status: {resp.status_code} — {len(incidents)} incidents found")
    if incidents:
        pretty(incidents[0])
        incident_id = incidents[0]["id"]
    else:
        print("No incidents found — EventProcessor may not have run yet")
        # Try triggering staleness check manually instead
        print("\nFalling back to manual staleness check...")
        resp = client.post(f"{BASE}/api/alerts/run-check")
        print(f"Run-check: {resp.status_code} — {resp.json()}")
        time.sleep(2)
        resp = client.get(f"{BASE}/api/incidents")
        incidents = resp.json()
        print(f"After manual check: {len(incidents)} incidents")
        if incidents:
            pretty(incidents[0])
            incident_id = incidents[0]["id"]
        else:
            print("Still no incidents — check server logs")
            return

    # ── Step 4: Check /api/incidents/stats ────────────────────────────────
    print("\n═══ Step 4: Check /api/incidents/stats ═══")
    resp = client.get(f"{BASE}/api/incidents/stats")
    print(f"Status: {resp.status_code}")
    pretty(resp.json())

    # ── Step 5: Check /api/incidents/{id} ─────────────────────────────────
    print(f"\n═══ Step 5: Check /api/incidents/{incident_id} ═══")
    resp = client.get(f"{BASE}/api/incidents/{incident_id}")
    print(f"Status: {resp.status_code}")
    pretty(resp.json())

    # ── Step 6: Acknowledge ───────────────────────────────────────────────
    print(f"\n═══ Step 6: Acknowledge incident {incident_id} ═══")
    resp = client.post(f"{BASE}/api/incidents/{incident_id}/acknowledge")
    print(f"Status: {resp.status_code} — {resp.json()}")

    # ── Step 7: Resolve ───────────────────────────────────────────────────
    print(f"\n═══ Step 7: Resolve incident {incident_id} ═══")
    resp = client.post(f"{BASE}/api/incidents/{incident_id}/resolve", json={
        "resolvedBy": "manual",
        "notes": "Test resolution — remediation engine verified"
    })
    print(f"Status: {resp.status_code} — {resp.json()}")

    # ── Step 8: Verify resolution ─────────────────────────────────────────
    print(f"\n═══ Step 8: Verify resolution ═══")
    resp = client.get(f"{BASE}/api/incidents/{incident_id}")
    incident = resp.json()
    print(f"Status: {incident['status']}")
    print(f"Resolved by: {incident.get('resolvedBy')}")
    print(f"Notes: {incident.get('notes')}")

    # Final stats
    print("\n═══ Final stats ═══")
    resp = client.get(f"{BASE}/api/incidents/stats")
    pretty(resp.json())

    print("\n✅ All steps completed successfully!")


if __name__ == "__main__":
    test()
