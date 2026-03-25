import os
import asyncio
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from apscheduler.schedulers.background import BackgroundScheduler

from app.api.routes import health, ingest, sources, trace, response, alerts, keys
from app.core.config import settings
from app.core.db import prisma
from app.core.auth import get_auth
from fastapi import Depends

logger = logging.getLogger("provenance")
logging.basicConfig(level=logging.INFO)

# APScheduler instance (background thread — does not block FastAPI)
scheduler = BackgroundScheduler()


def _run_staleness_job():
    """Wrapper to run async staleness check from sync APScheduler thread."""
    from app.jobs.staleness import run_staleness_check
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(prisma.connect())
        result = loop.run_until_complete(run_staleness_check())
        logger.info("Scheduled staleness check result: %s", result)
        loop.run_until_complete(prisma.disconnect())
    finally:
        loop.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await prisma.connect()

    # Register scheduled staleness job
    interval_hours = int(os.environ.get("STALENESS_CHECK_INTERVAL_HOURS", "24"))
    scheduler.add_job(
        _run_staleness_job,
        "interval",
        hours=interval_hours,
        id="staleness_check",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("APScheduler started — staleness check every %d hours", interval_hours)

    yield

    # Shutdown
    scheduler.shutdown(wait=False)
    await prisma.disconnect()


app = FastAPI(
    title="ProvenanceAI API",
    description="Distributed tracing for AI pipelines.",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(health.router)
app.include_router(keys.router, prefix="/api/keys")
app.include_router(ingest.router, prefix="/api", dependencies=[Depends(get_auth)])
app.include_router(sources.router, prefix="/api", dependencies=[Depends(get_auth)])
app.include_router(trace.router, prefix="/api", dependencies=[Depends(get_auth)])
app.include_router(response.router, prefix="/api", dependencies=[Depends(get_auth)])
app.include_router(alerts.router, prefix="/api", dependencies=[Depends(get_auth)])

@app.get("/")
async def root():
    return {
        "service": settings.app_name,
        "docs": "/docs",
    }
