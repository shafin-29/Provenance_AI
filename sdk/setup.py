from setuptools import setup, find_packages

setup(
    name="provenance-ai",
    version="0.1.0",
    description="Data provenance tracking for LangChain RAG pipelines",
    packages=find_packages(),
    python_requires=">=3.8",
    install_requires=[
        "httpx>=0.24.0",
        "langchain>=0.1.0",
        "langchain-community>=0.0.1",
        "pypdf>=3.0.0",
        "pydantic>=2.0.0",
    ],
    extras_require={
        "pinecone": ["langchain-pinecone>=0.0.1", "pinecone-client>=3.0.0"],
        "chroma": ["langchain-chroma>=0.0.1", "chromadb>=0.4.0"],
        "openai": ["langchain-openai>=0.0.1"],
    }
)
