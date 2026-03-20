import asyncio
import httpx
from prisma import Prisma
import json

base_url = "http://127.0.0.1:8000"

async def main():
    db = Prisma()
    await db.connect()
    
    # Check health
    print("\n--- 1. Testing GET /health ---")
    resp = httpx.get(f"{base_url}/health")
    print(resp.json())
    assert resp.status_code == 200

    # Ingest source
    print("\n--- 2. Testing POST /api/ingest ---")
    resp = httpx.post(f"{base_url}/api/ingest", json={
        "sourceId": "test_document.txt",
        "contentHash": "5A4B3C",
        "versionTs": "2026-03-20T10:00:00Z",
        "pipelineId": "v1.0"
    })
    print(resp.json())
    assert resp.status_code == 200
    source_id = resp.json()["id"]

    # Inject an embedding directly so we can use it in the trace
    print("\n--- Injecting Manual Embedding for trace test ---")
    emb = await db.embedding.create(data={
        "chunkIndex": 1,
        "parentSourceRecordId": source_id,
        "vectorDbId": "v123",
        "embeddingModel": "local-hf-model"
    })
    print(emb.model_dump_json(indent=2))

    # Test POST /api/response
    print("\n--- 3. Testing POST /api/response ---")
    resp = httpx.post(f"{base_url}/api/response", json={
        "sessionId": "session_888",
        "queryText": "What does the document say?",
        "retrievedEmbeddingIds": [emb.id],
        "promptHash": "p_hash",
        "responseText": "It says hello world.",
        "responseHash": "r_hash",
        "modelVersion": "gpt-4o"
    })
    print(resp.json())
    assert resp.status_code == 200

    # Test GET /api/sources
    print("\n--- 4. Testing GET /api/sources ---")
    resp = httpx.get(f"{base_url}/api/sources")
    print(f"Found {len(resp.json())} sources")
    assert resp.status_code == 200

    # Test GET /api/sources/{id}
    print(f"\n--- 5. Testing GET /api/sources/{source_id} ---")
    resp = httpx.get(f"{base_url}/api/sources/{source_id}")
    print(json.dumps(resp.json(), indent=2))
    assert resp.status_code == 200

    # Test GET /api/trace/{session_id}
    print("\n--- 6. Testing GET /api/trace/session_888 ---")
    resp = httpx.get(f"{base_url}/api/trace/session_888")
    print(json.dumps(resp.json(), indent=2))
    assert resp.status_code == 200

    await db.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
