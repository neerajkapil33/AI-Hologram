from datetime import datetime, timezone
from typing import Dict

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="NEERAJ AI System Engine Core", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TelemetryPayload(BaseModel):
    session_id: str = Field(min_length=1)
    domain: str = Field(min_length=1)
    client_timestamp: str
    system_metrics: Dict[str, int]


@app.get("/health")
async def health():
    return {"status": "OK", "service": "NEERAJ AI", "server_time": datetime.now(timezone.utc).isoformat()}


@app.post("/api/v1/analyze")
async def analyze_telemetry_vectors(payload: TelemetryPayload):
    selected_track = payload.domain
    recommended_speed = 1200
    if "Opportunities" in selected_track:
        recommended_speed = 1500
    elif "Interview" in selected_track:
        recommended_speed = 900

    return {
        "status": "SUCCESS",
        "processed_session": payload.session_id,
        "active_domain": selected_track,
        "recommended_speed": recommended_speed,
        "system_action": "ENGAGE_HOLOGRAPHIC_STREAM",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
