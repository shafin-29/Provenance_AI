# ProvenanceAI Python SDK

Trace any LLM response back to its source data in 3 lines of code.

## Installation

pip install provenance-ai

## Quick Start

from provenance_ai import ProvenanceAIClient

sdk = ProvenanceAIClient(
    api_url="https://your-backend.railway.app",
    api_key="prov_live_YOUR_KEY_HERE",
    pipeline_id="your-pipeline-id"
)

# Ingest a document
docs = sdk.ingest("path/to/document.pdf")

# Add to your vector store (metadata preserved automatically)
vectorstore.add_documents([doc for doc, _ in docs])

# Wrap your retriever
retriever = sdk.get_retriever(
    vectorstore.as_retriever(),
    session_id="unique-session-id"
)

# Record the response
sdk.record_response(
    session_id="unique-session-id",
    response_text=llm_response,
    model_version="gpt-4o"
)

## Supported Integrations

Vector Databases: Pinecone, Chroma
Orchestration: LangChain
File types: PDF, TXT, MD

## Environment Variables

PROVENANCE_AI_API_URL=https://your-backend.railway.app
PROVENANCE_AI_API_KEY=prov_live_YOUR_KEY_HERE
