"""FastAPI application for Tangled Org AppView."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.appview.client_metadata import get_client_metadata
from src.appview.routes import auth, api
from src.config import settings

logger = logging.getLogger("appview")


@asynccontextmanager
async def lifespan(app: FastAPI):
    from src.appview.pr_watcher import start_pr_watcher, stop_pr_watcher
    start_pr_watcher()
    yield
    stop_pr_watcher()


app = FastAPI(
    title="Tangled Org",
    description="Governance & compliance layer for Tangled",
    version="0.1.0",
    lifespan=lifespan,
)

allowed_origins = [
    "http://localhost:3000",
    "http://localhost:8080",
]
if settings.frontend_url:
    allowed_origins.append(settings.frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(api.router)


@app.get("/.well-known/atproto-client-metadata.json")
async def client_metadata(request: Request):
    base_url = settings.backend_url or str(request.base_url).rstrip("/")
    return JSONResponse(content=get_client_metadata(base_url))


@app.get("/health")
async def health():
    return {"status": "ok", "service": "tangled-org"}
