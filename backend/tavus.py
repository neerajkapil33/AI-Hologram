import json
import os
import urllib.error
import urllib.request


LANGUAGE_CODES = {
    "en-IN": "en",
    "hi-IN": "hi",
    "ta-IN": "ta",
    "te-IN": "te",
    "bn-IN": "bn",
    "mr-IN": "mr",
}


class Tavus:
    """Server-side Tavus CVI adapter. API credentials never reach the browser."""

    def __init__(self):
        self.base_url = os.getenv("TAVUS_BASE_URL", "https://tavusapi.com").rstrip("/")
        self.api_key = os.getenv("TAVUS_API_KEY", "").strip()
        # Current Tavus API uses face_id + pal_id. Keep the older env names as
        # fallbacks so an existing local configuration can be migrated safely.
        self.face_id = os.getenv("TAVUS_FACE_ID", os.getenv("TAVUS_REPLICA_ID", "")).strip()
        self.pal_id = os.getenv("TAVUS_PAL_ID", os.getenv("TAVUS_PERSONA_ID", "")).strip()

    @property
    def configured(self) -> bool:
        return bool(self.api_key and self.face_id and self.pal_id)

    def create_conversation(self, language: str = "en-IN") -> dict:
        if not self.configured:
            return {
                "configured": False,
                "message": "Tavus is not configured. Add TAVUS_API_KEY, TAVUS_FACE_ID and TAVUS_PAL_ID to the backend environment.",
            }

        language_code = LANGUAGE_CODES.get(language, "en")
        context = os.getenv(
            "TAVUS_CONVERSATIONAL_CONTEXT",
            "You are Neeraj AI, an AI representation of Neeraj Kapil. Be warm, confident, empathetic, strategic and practical. Default to English, but naturally switch to the user's selected language. Focus on career strategy, leadership, talent acquisition, interviews, resumes, LinkedIn, job search, skills and global career opportunities. Listen before advising. Be concise and natural for spoken conversation. Never claim to be the physical Neeraj or invent private biography.",
        )
        payload = {
            "face_id": self.face_id,
            "pal_id": self.pal_id,
            "conversation_name": "Neeraj AI Career Companion",
            "conversational_context": f"{context}\nOpen this conversation in {language_code}.",
            "custom_greeting": os.getenv(
                "TAVUS_CUSTOM_GREETING",
                "Hi, I’m Neeraj AI. What would you like to work on today?",
            ),
            "max_participants": 2,
            "properties": {"languages": [language_code]},
        }
        request = urllib.request.Request(
            f"{self.base_url}/v2/conversations",
            data=json.dumps(payload).encode("utf-8"),
            headers={"x-api-key": self.api_key, "Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                result = json.loads(response.read().decode("utf-8"))
            return {"configured": True, **result}
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            return {"configured": True, "error": f"Tavus API {exc.code}: {detail}"}
        except Exception as exc:
            return {"configured": True, "error": f"Tavus connection failed: {exc}"}
