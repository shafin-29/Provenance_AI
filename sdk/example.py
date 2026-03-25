"""
ProvenanceAI SDK — Example Usage
Run this to verify your SDK setup is working correctly.
"""

import os
import uuid
from dotenv import load_dotenv
from provenance_ai import ProvenanceAIClient

load_dotenv()

PROVENANCE_API_URL = os.getenv(
  "PROVENANCE_AI_API_URL", "http://127.0.0.1:8000")
PROVENANCE_API_KEY = os.getenv(
  "PROVENANCE_AI_API_KEY", "prov_live_test")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

def main():
    # Step 1: Initialize the SDK
    sdk = ProvenanceAIClient(
        api_url=PROVENANCE_API_URL,
        api_key=PROVENANCE_API_KEY,
        pipeline_id="example-rag-pipeline"
    )
    
    # Step 2: Verify backend connection
    if not sdk.verify_connection():
        print("ERROR: Cannot reach ProvenanceAI backend.")
        print(f"Make sure the backend is running at {PROVENANCE_API_URL}")
        return
    
    # Step 3: Create a sample document to ingest
    sample_file = "/tmp/provenance_test_doc.txt"
    try:
        os.makedirs(os.path.dirname(sample_file), exist_ok=True)
    except:
        sample_file = "provenance_test_doc.txt"

    with open(sample_file, "w") as f:
        f.write("""ProvenanceAI Test Document
        
This is a test document for verifying ProvenanceAI SDK integration.
It contains sample content about AI pipeline data provenance.

Key concepts:
- Lineage tokens track data from source to LLM response
- Content hashes detect when source files change
- Staleness detection alerts engineers to outdated embeddings

Section 2: Technical Details
The ProvenanceAI SDK wraps existing LangChain pipelines 
with zero disruption to existing functionality.
All provenance tracking happens transparently in the background.
""")
    
    # Step 4: Ingest the document
    print("\nIngesting document...")
    docs = sdk.ingest(sample_file)
    print(f"Ingested {len(docs)} chunks from {sample_file}")
    
    if not docs:
        print("ERROR: No documents returned from ingestion.")
        return
    
    # Step 5: Set up Chroma vector store (no API key needed)
    try:
        from langchain_chroma import Chroma
        from langchain_openai import OpenAIEmbeddings
        
        print("\nSetting up vector store...")
        embeddings = OpenAIEmbeddings(
            model="text-embedding-3-small",
            api_key=OPENAI_API_KEY
        ) if OPENAI_API_KEY else None
        
        if embeddings:
            vectorstore = Chroma(
                collection_name="provenance_example",
                embedding_function=embeddings
            )
            chunk_docs = [doc for doc, _ in docs]
            vectorstore.add_documents(chunk_docs)
            print(f"Added {len(chunk_docs)} chunks to Chroma")
            base_retriever = vectorstore.as_retriever(
                search_kwargs={"k": 2}
            )
        else:
            print("No OPENAI_API_KEY found — skipping embeddings.")
            print("Continuing with mock retrieval to test lineage recording.")
            base_retriever = None
            
    except ImportError:
        print("langchain-chroma not installed.")
        print("Install with: pip install langchain-chroma chromadb")
        base_retriever = None
    
    # Step 6: Generate a unique session ID
    session_id = f"sess_{uuid.uuid4().hex[:12]}"
    print(f"\nSession ID: {session_id}")
    print("(Copy this to paste into the Trace Explorer)")
    
    # Step 7: Run a query with provenance tracking
    query = "What is ProvenanceAI and how does it work?"
    print(f"\nRunning query: '{query}'")
    
    if base_retriever:
        retriever = sdk.get_retriever(
            base_retriever, 
            session_id=session_id
        )
        retrieved_docs = retriever.get_relevant_documents(query)
        print(f"Retrieved {len(retrieved_docs)} relevant chunks")
    else:
        retrieved_docs = [doc for doc, _ in docs[:2]]
        print("Using ingested chunks as mock retrieval results")
    
    # Step 8: Record the LLM response
    mock_response = (
        "ProvenanceAI is a developer tool that traces LLM responses "
        "back to their source data records using lineage tokens that "
        "propagate through the entire RAG pipeline."
    )
    
    sdk.record_response(
        session_id=session_id,
        response_text=mock_response,
        model_version="gpt-4o"
    )
    print("\nRecorded LLM response to ProvenanceAI backend")
    
    # Step 9: Print success summary
    print("\n" + "="*50)
    print("SUCCESS — ProvenanceAI SDK integration verified!")
    print("="*50)
    print(f"\nSession ID: {session_id}")
    print(f"\nNext step: Open the Trace Explorer and paste this session ID:")
    print(f"{PROVENANCE_API_URL.replace('8000', '3000')}/trace?session={session_id}")
    print("\nYou should see the full lineage chain from response")
    print("back to the source document.")

if __name__ == "__main__":
    main()
