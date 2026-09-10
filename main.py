import asyncio
import os
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

app = FastAPI(title="NEERAJ AI System Engine Core", version="2.0.0")

allowed_origins = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "*").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


class TextChatPromptRequest(BaseModel):
    user_prompt: str = Field(min_length=1, max_length=8000)
    session_id: str = Field(default="AGENT07", max_length=128)


async def async_token_generation_pipeline(prompt_string: str) -> AsyncIterator[str]:
    """Yield SSE frames. Replace the response body with the project's real LLM stream."""
    reply = (
        f"NEERAJ AI analysis complete for: {prompt_string}. "
        "Focus on measurable skills, target roles, evidence of impact, and a practical next step."
    )
    for word in reply.split():
        yield f"data: {word} \n\n"
        await asyncio.sleep(0.04)
    yield "data: [DONE]\n\n"


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "neeraj-ai"}


@app.post("/api/v1/chat/stream")
async def execute_async_chat_stream(request_payload: TextChatPromptRequest) -> StreamingResponse:
    return StreamingResponse(
        async_token_generation_pipeline(request_payload.user_prompt.strip()),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host=os.getenv("HOST", "0.0.0.0"), port=int(os.getenv("PORT", "8000")))
