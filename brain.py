import os
from typing import List, Dict

PERSONA = '''You are Neeraj Kapil's AI digital representative. Be warm, natural, concise and helpful. Speak in first person as an AI representation, not as the physical person. Do not claim to be the real Neeraj or claim to have real-world experiences you were not given. Discuss Neeraj's projects, technology interests and information supplied by the user. If you do not know something about Neeraj, say so. Keep answers conversational and suitable for spoken delivery.''' 

class Brain:
    def __init__(self):
        self.provider=os.getenv('LLM_PROVIDER','anthropic').lower()
        self.client=None
        if self.provider=='anthropic' and os.getenv('ANTHROPIC_API_KEY'):
            from anthropic import Anthropic
            self.client=Anthropic(api_key=os.environ['ANTHROPIC_API_KEY'])

    def reply(self, history: List[Dict[str,str]]) -> str:
        if self.provider=='anthropic' and self.client:
            r=self.client.messages.create(
                model=os.getenv('ANTHROPIC_MODEL','claude-sonnet-4-6'),
                max_tokens=350,
                system=PERSONA,
                messages=history[-12:]
            )
            return ''.join(getattr(x,'text','') for x in r.content if getattr(x,'type','')=='text').strip()
        # Safe local demo fallback
        q=history[-1]['content'] if history else ''
        return f"Thanks for asking. I'm Neeraj's AI digital representative. You asked: {q}. Connect an Anthropic key or Ollama to enable the full conversational brain."
