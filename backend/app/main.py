import os
import asyncio
import logging
import time
from datetime import datetime, timezone
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from apscheduler.schedulers.background import BackgroundScheduler

from app.core.config import settings
from app.api.routes import health, ingest, sources, trace, response, alerts, keys, dashboard, test_helpers, events, quarantine, incidents, shield
from app.core.db import prisma
from app.core.auth import get_auth
from fastapi import Depends

# ── Logging ──────────────────────────────────────────────────────────────────
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("provenance")

# APScheduler instance
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


def _check_env_vars():
    """Validate required environment variables on startup."""
    required = {
        "DATABASE_URL": "Database connection will fail.",
    }
    optional = {
        "CLERK_SECRET_KEY": "Authentication may not work if SKIP_AUTH=false.",
        "RESEND_API_KEY": "Email alerts will not be sent.",
    }

    for var, consequence in required.items():
        if not os.environ.get(var):
            logger.error("FATAL: %s is not set. %s", var, consequence)

    for var, consequence in optional.items():
        if not os.environ.get(var):
            logger.warning("WARNING: %s is not set. %s", var, consequence)


def _print_startup_banner(db_ok: bool):
    """Print startup summary box."""
    skip_auth = os.environ.get("SKIP_AUTH", "true").lower() == "true"
    auth_str = "SKIP_AUTH mode" if skip_auth else "Clerk enabled"
    email_ok = bool(os.environ.get("RESEND_API_KEY"))
    interval_hours = int(os.environ.get("STALENESS_CHECK_INTERVAL_HOURS", "24"))

    db_icon = "OK" if db_ok else "ERR"
    auth_icon = "OK"
    email_icon = "OK" if email_ok else "ERR (RESEND_API_KEY missing)"
    stale_str = f"Every {interval_hours}h"

    lines = [
        "-----------------------------------------",
        "  ProvenanceAI Backend v0.1.0            ",
        f"  Database:     {db_icon} {'Connected' if db_ok else 'DISCONNECTED':23}",
        f"  Auth:         {auth_icon} {auth_str:23}",
        f"  Email:        {email_icon:31}",
        f"  Staleness:    OK {stale_str:21}",
        "-----------------------------------------",
    ]
    for line in lines:
        logger.info(line)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Check env vars before startup
    _check_env_vars()

    # Connect to database
    db_ok = False
    try:
        await prisma.connect()
        # Quick health ping
        await prisma.query_raw("SELECT 1")
        db_ok = True
        logger.info("Database connection established.")
    except Exception as e:
        logger.error("FATAL: Cannot connect to database. Check DATABASE_URL environment variable. Error: %s", e)

    if not db_ok:
        # Still allow startup but operations will fail
        logger.error("Starting without database connection — all DB operations will fail.")

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

    _print_startup_banner(db_ok)

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


# ── Request Logging Middleware ────────────────────────────────────────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response_obj = await call_next(request)
    duration_ms = round((time.perf_counter() - start) * 1000)
    logger.info(
        "%s %s → %d (%dms)",
        request.method,
        request.url.path,
        response_obj.status_code,
        duration_ms,
    )
    return response_obj


# ── Global Exception Handlers ─────────────────────────────────────────────────
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": str(exc.detail),
            "code": _status_to_code(exc.status_code),
            "detail": None,
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    field_errors = []
    for err in exc.errors():
        loc = " → ".join(str(x) for x in err.get("loc", []))
        field_errors.append(f"{loc}: {err.get('msg')}")
    return JSONResponse(
        status_code=422,
        content={
            "error": "Request validation failed",
            "code": "VALIDATION_ERROR",
            "detail": "; ".join(field_errors),
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "code": "INTERNAL_ERROR",
            "detail": None,  # Never expose stack traces in production
        },
    )


def _status_to_code(status: int) -> str:
    mapping = {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        409: "CONFLICT",
        422: "VALIDATION_ERROR",
        429: "RATE_LIMITED",
        500: "INTERNAL_ERROR",
        503: "SERVICE_UNAVAILABLE",
    }
    return mapping.get(status, "HTTP_ERROR")


# ── CORS ──────────────────────────────────────────────────────────────────────
_raw_origins = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001"
)
allowed_origins = [o.strip().rstrip("/") for o in _raw_origins.split(",") if o.strip()]

# If allowing everything, credentials cannot be True
is_wildcard = "*" in allowed_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=not is_wildcard,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(health.router)
app.include_router(keys.router, prefix="/api/keys")
app.include_router(ingest.router, prefix="/api", dependencies=[Depends(get_auth)])
app.include_router(sources.router, prefix="/api", dependencies=[Depends(get_auth)])
app.include_router(trace.router, prefix="/api", dependencies=[Depends(get_auth)])
app.include_router(response.router, prefix="/api", dependencies=[Depends(get_auth)])
app.include_router(alerts.router, prefix="/api", dependencies=[Depends(get_auth)])
app.include_router(dashboard.router, prefix="/api", dependencies=[Depends(get_auth)])
app.include_router(test_helpers.router, prefix="/api", dependencies=[Depends(get_auth)])
app.include_router(events.router, prefix="/api", dependencies=[Depends(get_auth)])
app.include_router(quarantine.router, prefix="/api", dependencies=[Depends(get_auth)])
app.include_router(incidents.router, prefix="/api", dependencies=[Depends(get_auth)])
app.include_router(shield.router, prefix="/api", dependencies=[Depends(get_auth)])


@app.get("/")
async def root():
    return {
        "service": settings.app_name,
        "docs": "/docs",
    }
