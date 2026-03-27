#!/usr/bin/env python3
"""
ProvenanceAI E2E Test Suite
Runs against a live backend and verifies the full lineage chain works end-to-end.
Usage:
    PROVENANCE_AI_API_URL=http://localhost:8000 python tests/e2e_test.py
"""

import os
import sys
import time
import tempfile
import requests
from datetime import datetime, timezone

# ── Config ────────────────────────────────────────────────────────────────────
API_URL = os.environ.get("PROVENANCE_AI_API_URL", "http://localhost:8000")
BASE = API_URL.rstrip("/")

# ANSI colors (disabled for cross-platform log compatibility)
GREEN = ""
RED = ""
RESET = ""
BOLD = ""

# Test state
results: list[tuple[str, bool, str]] = []
start_time = time.time()

# ── Helpers ───────────────────────────────────────────────────────────────────

def ok(test_name: str):
    results.append((test_name, True, ""))

def fail(test_name: str, message: str):
    results.append((test_name, False, message))


def assert_eq(label: str, actual, expected):
    if actual != expected:
        raise AssertionError(f"Expected {label}={expected!r}, got {actual!r}")


def assert_true(label: str, value):
    if not value:
        raise AssertionError(f"Expected {label} to be truthy, got {value!r}")


def assert_ge(label: str, actual, minimum):
    if actual < minimum:
        raise AssertionError(f"Expected {label}>={minimum}, got {actual}")


def run_test(idx: int, name: str, func):
    try:
        func()
        ok(name)
        print(f"|  TEST {idx:<2}  {name:<30} PASSED    |")
    except AssertionError as e:
        fail(name, str(e))
        print(f"|  TEST {idx:<2}  {name:<30} FAILED    |")
        print(f"|    -> {e}")
        print("+---------------------------------------------+")
        sys.exit(1)
    except Exception as e:
        fail(name, str(e))
        print(f"|  TEST {idx:<2}  {name:<30} ERROR     |")
        print(f"|    -> {e}")
        print("+---------------------------------------------+")
        sys.exit(1)


# ── Test State ────────────────────────────────────────────────────────────────
state = {}


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_health():
    r = requests.get(f"{BASE}/health", timeout=10)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    data = r.json()
    assert data.get("status") == "ok", f"Expected status=ok, got {data.get('status')}"
    assert data.get("database") == "connected", f"Expected database=connected, got {data.get('database')}"


def test_api_key_creation():
    r = requests.post(
        f"{BASE}/api/keys",
        json={"name": "e2e-test", "pipelineId": "test-pipeline"},
        headers={"Authorization": "Bearer mock"},
        timeout=10,
    )
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    data = r.json()
    key = data.get("key", "")
    assert key.startswith("prov_live_"), f"Expected key to start with 'prov_live_', got {key!r}"
    state["api_key"] = key
    state["key_id"] = data["id"]


def test_file_ingestion():
    content = "This is e2e test content. " * 10
    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
        f.write(content)
        tmp_path = f.name

    import hashlib
    content_hash = hashlib.sha256(content.encode()).hexdigest()
    content_preview = content[:200]

    r = requests.post(
        f"{BASE}/api/ingest",
        json={
            "sourceId": f"e2e-test-file-{int(time.time())}.txt",
            "contentHash": content_hash,
            "versionTs": datetime.now(timezone.utc).isoformat(),
            "pipelineId": "test-pipeline",
            "contentPreview": content_preview,
        },
        headers={"Authorization": "Bearer mock"},
        timeout=10,
    )
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    data = r.json()
    assert "id" in data, "Expected 'id' in response"
    state["source_record_id"] = data["id"]
    state["content_preview"] = content_preview


def test_embedding_creation():
    r = requests.post(
        f"{BASE}/api/test/embedding",
        json={"parentSourceRecordId": state["source_record_id"]},
        headers={"Authorization": "Bearer mock"},
        timeout=10,
    )
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    data = r.json()
    assert "id" in data, "Expected 'id' in response"
    state["embedding_id"] = data["id"]


def test_response_chain():
    r = requests.post(
        f"{BASE}/api/response",
        json={
            "sessionId": "e2e_test_session_001",
            "queryText": "What does the document say?",
            "retrievedEmbeddingIds": [state["embedding_id"]],
            "promptHash": "testhash123",
            "responseText": "The document says this is a test.",
            "modelVersion": "gpt-4o-test",
        },
        headers={"Authorization": "Bearer mock"},
        timeout=15,
    )
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    data = r.json()
    assert "id" in data, "Expected 'id' in response"
    state["llm_response_id"] = data["id"]


def test_lineage_trace():
    t0 = time.time()
    r = requests.get(
        f"{BASE}/api/trace/e2e_test_session_001",
        headers={"Authorization": "Bearer mock"},
        timeout=10,
    )
    duration = time.time() - t0
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    assert duration < 5.0, f"Trace took {duration:.2f}s — expected under 5s"
    data = r.json()

    # Verify all lineage nodes present
    assert "id" in data, "Missing RetrievalEvent node"
    assert "promptContexts" in data and len(data["promptContexts"]) > 0, "Missing PromptContext node"
    assert data["promptContexts"][0].get("llmResponses") and len(data["promptContexts"][0]["llmResponses"]) > 0, \
        "Missing LLMResponse node"
    assert "embeddings" in data and len(data["embeddings"]) > 0, "Missing Embedding node"
    embedding_entry = data["embeddings"][0]
    assert embedding_entry.get("embedding"), "Missing Embedding data"
    assert embedding_entry["embedding"].get("parentSourceRecord"), "Missing SourceRecord node"


def test_staleness():
    r = requests.post(
        f"{BASE}/api/alerts/mark-stale",
        json={"sourceRecordId": state["source_record_id"]},
        headers={"Authorization": "Bearer mock"},
        timeout=10,
    )
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"

    time.sleep(1) # Ensure DB consistency/processing
    r2 = requests.get(
        f"{BASE}/api/alerts",
        headers={"Authorization": "Bearer mock"},
        timeout=10,
    )
    assert r2.status_code == 200, f"Expected 200, got {r2.status_code}"
    alerts = r2.json()
    matching = [a for a in alerts if a.get("sourceRecordId") == state["source_record_id"]]
    if len(matching) == 0:
        print(f"DEBUG: Alerts found: {alerts}")
        print(f"DEBUG: Looking for sourceRecordId: {state['source_record_id']}")
    assert len(matching) > 0, f"SourceRecord {state['source_record_id']} not found in alerts list ({len(alerts)} alerts total)"
    assert matching[0].get("daysStale", -1) >= 0, "Expected daysStale >= 0"


def test_reingest_clears_staleness():
    r = requests.post(
        f"{BASE}/api/sources/{state['source_record_id']}/reingest",
        headers={"Authorization": "Bearer mock"},
        timeout=10,
    )
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"

    r2 = requests.get(
        f"{BASE}/api/sources/{state['source_record_id']}",
        headers={"Authorization": "Bearer mock"},
        timeout=10,
    )
    assert r2.status_code == 200, f"Expected 200, got {r2.status_code}"
    src = r2.json()
    is_stale = src.get("isStale", True)
    assert is_stale is False, f"Expected isStale=false after reingest, got {is_stale}"


def test_dashboard_stats():
    r = requests.get(
        f"{BASE}/api/dashboard/stats",
        headers={"Authorization": "Bearer mock"},
        timeout=10,
    )
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    data = r.json()
    total = data.get("totalResponsesTraced", 0)
    assert total >= 1, f"Expected totalResponsesTraced >= 1, got {total}"


def test_cleanup():
    r = requests.delete(
        f"{BASE}/api/keys/{state['key_id']}",
        headers={"Authorization": "Bearer mock"},
        timeout=10,
    )
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    data = r.json()
    assert data.get("revoked") is True, f"Expected revoked=true, got {data}"


# ── Runner ─────────────────────────────────────────────────────────────────────

def main():
    print("+---------------------------------------------+")
    print("|  ProvenanceAI E2E Test Suite                |")
    print("+---------------------------------------------+")

    tests = [
        (1, "Backend health",         test_health),
        (2, "API key creation",       test_api_key_creation),
        (3, "File ingestion",         test_file_ingestion),
        (4, "Embedding creation",     test_embedding_creation),
        (5, "Response chain",         test_response_chain),
        (6, "Lineage trace",          test_lineage_trace),
        (7, "Staleness detection",    test_staleness),
        (8, "Re-ingest clears stale", test_reingest_clears_staleness),
        (9, "Dashboard stats",        test_dashboard_stats),
        (10, "Cleanup",               test_cleanup),
    ]

    for idx, name, func in tests:
        run_test(idx, name, func)

    duration = time.time() - start_time
    passed = sum(1 for _, p, _ in results if p)
    total = len(results)

    print("+---------------------------------------------+")
    color = GREEN if passed == total else RED
    print(f"|  {color}{passed}/{total} tests passed in {duration:.1f}s{RESET}{' ' * (28 - len(str(passed)) - len(str(total)) - len(f'{duration:.1f}'))}|")
    print("+---------------------------------------------+")

    if passed != total:
        sys.exit(1)


if __name__ == "__main__":
    main()
