"""Vercel Services entrypoint; local development still uses app.main:app."""

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.main import app as backend_app


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Mounted ASGI apps do not receive lifespan events automatically.
    async with backend_app.router.lifespan_context(backend_app):
        yield


app = FastAPI(lifespan=lifespan)
app.mount("/api", backend_app)
