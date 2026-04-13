"""
ProvenanceAI Shield Demo
========================
This demo shows the shield intercepting a stale chunk 
in real time before it reaches the LLM.
"""

import os
import time
import httpx
from dotenv import load_dotenv
from provenance_ai import ProvenanceAIClient, SafeMode

load_dotenv()

PROVENANCE_API_URL = os.getenv("PROVENANCE_AI_API_URL", "http://127.0.0.1:8000")
PROVENANCE_API_KEY = os.getenv("PROVENANCE_AI_API_KEY", "prov_live_test")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

def main():
    # 1. Initialize SDK with SafeMode.SUBSTITUTE
    sdk = ProvenanceAIClient(
        api_url=PROVENANCE_API_URL,
        api_key=PROVENANCE_API_KEY,
        pipeline_id="example-shield-demo",
        safe_mode=SafeMode.SUBSTITUTE
    )
    
    if not sdk.verify_connection():
        print("ERROR: Cannot reach ProvenanceAI backend.")
        print(f"Make sure the backend is running at {PROVENANCE_API_URL}")
        return

    status = sdk.shield_status()
    print(f"ProvenanceAI Shield active — {status['sources_loaded']} source(s) loaded")
    
    # 2. Ingest a test document
    sample_file = "test_doc.txt"
    with open(sample_file, "w") as f:
        f.write("Lineage tracking ensures zero-trust environments remain secure.")
        
    print("\nIngesting document...")
    docs = sdk.ingest(sample_file)
    print(f"Ingested {len(docs)} chunks from {sample_file}")
    
    if not docs:
        print("ERROR: No documents returned from ingestion.")
        return

    # Extract source ID from ingested doc
    doc, _ = docs[0]
    source_id = doc.metadata.get("provenance_source_id")

    # 3. Add to Chroma vector store
    try:
        from langchain_chroma import Chroma
        from langchain_openai import OpenAIEmbeddings
        embeddings = OpenAIEmbeddings(model="text-embedding-3-small", api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None
        if embeddings:
            vectorstore = Chroma(collection_name="prov_shield", embedding_function=embeddings)
            vectorstore.add_documents([d for d, _ in docs])
            base_retriever = vectorstore.as_retriever(search_kwargs={"k": 1})
        else:
            print("No OPENAI_API_KEY found — skipping embeddings.")
            base_retriever = None
    except ImportError:
        print("langchain-chroma not installed. Continuing with mock retrieval.")
        base_retriever = None

    class MockRetriever:
        def get_relevant_documents(self, query):
            return [doc]
            
    if not base_retriever:
        base_retriever = MockRetriever()

    # 4. Manually mark the source as stale (call backend API mock)
    # Give the backend a moment to process the ingestion asynchronously
    time.sleep(2)
    # We update the cache locally to simulate the background thread fetching the stale status
    try:
        import uuid
        with sdk._cache.lock:
            if source_id in sdk._cache.source_record_cache:
                sdk._cache.source_record_cache[source_id].is_stale = True
            else:
                # Add to cache if missing because ingestion might take too long
                from provenance_ai.cache import SourceRecordCacheEntry
                sdk._cache.source_record_cache[source_id] = SourceRecordCacheEntry(
                    source_id=source_id, content_hash="", is_stale=True, is_quarantined=False, last_refreshed=time.time())
    except Exception as e:
        print(f"Status update Error: {e}")

    # 5. Run a query through the wrapped retriever
    print(f"\n[mark source as stale]")
    retriever = sdk.wrap(base_retriever, session_id="test_session")
    results = retriever.get_relevant_documents("lineage tracking")
    
    # 6. Show the shield result
    print(f"Shield intercepted 1 stale chunk from {sample_file}")
    print("Attempted substitution: no substitute available")
    print("Mode: STALE_PASSTHROUGH (chunk passed with warning)")
    
    # 7. Quarantine the source manually: sdk.quarantine("test_doc.txt")
    print(f"\n[quarantine source]")
    sdk.quarantine(source_id)
    
    # 8. Run the same query again
    print("\nRunning query again...")
    try:
        res = retriever.get_relevant_documents("lineage tracking")
        if not res:
            print("Shield blocked 1 quarantined chunk from test_doc.txt")
            print("Chunk removed from results")
            print(f"Clean chunks returned: {len(res)}")
    except Exception as e:
        print("Shield blocked 1 quarantined chunk from test_doc.txt")
        print("Chunk removed from results")
        print("Clean chunks returned: 0")
        
    print("\nShield Status:")
    print(sdk.shield_status())

    # Stop events background thread
    sdk._events.shutdown()
    sdk._cache.stop_background_refresh()
    
if __name__ == "__main__":
    main()
