import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .tavus import Tavus

app = FastAPI(title="Neeraj AI Live Companion")
frontend_origin = os.getenv("FRONTEND_ORIGIN", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_origin] if frontend_origin != "*" else ["*"],
    allow_credentials=frontend_origin != "*",
    allow_methods=["*"],
    allow_headers=["*"],
)

tavus = Tavus()


@app.get("/health")
async def health():
    return {"ok": True, "tavus": tavus.configured, "service": "neeraj-ai-live"}


@app.post("/api/tavus/conversation")
async def create_conversation(payload: dict = {}):
    language = str(payload.get("language", "en-IN"))
    return tavus.create_conversation(language)
