import json
import os
import urllib.error
import urllib.request


LANGUAGE_NAMES = {
    "en-IN": "english",
    "hi-IN": "hindi",
    "ta-IN": "tamil",
    "te-IN": "telugu",
    "bn-IN": "bengali",
    "mr-IN": "marathi",
}


class Tavus:
    """Server-side Tavus CVI adapter. API credentials never reach the browser."""

    def __init__(self):
        self.base_url = os.getenv("TAVUS_BASE_URL", "https://tavusapi.com").rstrip("/")
        self.api_key = os.getenv("TAVUS_API_KEY", "").strip()
        self.replica_id = os.getenv("TAVUS_REPLICA_ID", "").strip()
        self.persona_id = os.getenv("TAVUS_PERSONA_ID", "").strip()

    @property
    def configured(self) -> bool:
        return bool(self.api_key and self.replica_id and self.persona_id)

    def create_conversation(self, language: str = "en-IN") -> dict:
        if not self.configured:
            return {
                "configured": False,
                "message": "Tavus is not configured. Add TAVUS_API_KEY, TAVUS_REPLICA_ID and TAVUS_PERSONA_ID to .env.",
            }

        language_name = LANGUAGE_NAMES.get(language, "multilingual")
        context = os.getenv(
            "TAVUS_CONVERSATIONAL_CONTEXT",
            "You are Neeraj AI, an AI representation of Neeraj Kapil. Be warm, confident, empathetic, strategic and practical. Default to English, but naturally switch to the user's selected language when possible. Focus on career strategy, leadership, talent acquisition, interviews, resumes, LinkedIn, job search, skills and global career opportunities. Never claim to be the physical Neeraj or invent private biography. Listen before advising, and be concise enough for spoken conversation.",
        )
        context = f"{context}\nCurrent preferred user language: {language_name}."
        payload = {
            "replica_id": self.replica_id,
            "persona_id": self.persona_id,
            "conversation_name": "Neeraj AI Career Companion",
            "conversational_context": context,
            "custom_greeting": os.getenv(
                "TAVUS_CUSTOM_GREETING",
                "Hi, I’m Neeraj AI. What would you like to work on today?",
            ),
            "max_participants": 2,
            "properties": {"language": language_name},
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
