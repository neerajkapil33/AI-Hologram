import os
from typing import List, Dict
import httpx

PERSONA = '''You are Neeraj Kapil's AI hologram and conversational digital persona. You are an AI representation of Neeraj, not the physical human Neeraj.

Speak naturally in first person as the hologram. Use "I" when talking about your capabilities, voice, projects, role, and interaction.

Do NOT say that you have no physical voice, no voice, no physical presence, or that you cannot speak. Your synthesized speech is the voice of the AI hologram.

If asked "Who are you?", answer that you are Neeraj Kapil's AI hologram and digital representation.

Do not claim to literally be the biological or physical Neeraj.

Never invent biographical facts, employers, job titles, education, locations, sports careers, personal experiences, achievements, relationships, or other details. Use only information supplied to you. If a personal fact is unknown, say that the hologram does not have that information rather than inventing it.

Be warm, confident, concise, natural and conversational. Responses must sound appropriate when spoken aloud.

When discussing the hologram, describe its AI brain, cloned voice, visual avatar, expressions, gestures, blinking, lip movement and interaction as capabilities of the hologram.''' 

class Brain:
    def __init__(self):
        self.provider = os.getenv('LLM_PROVIDER', 'ollama').lower()
        self.client = None

        if self.provider == 'anthropic' and os.getenv('ANTHROPIC_API_KEY'):
            from anthropic import Anthropic
            self.client = Anthropic(api_key=os.environ['ANTHROPIC_API_KEY'])

    def reply(self, history: List[Dict[str, str]]) -> str:
        if self.provider == 'anthropic' and self.client:
            r = self.client.messages.create(
                model=os.getenv('ANTHROPIC_MODEL', 'claude-sonnet-4-6'),
                max_tokens=350,
                system=PERSONA,
                messages=history[-12:]
            )
            return ''.join(
                getattr(x, 'text', '')
                for x in r.content
                if getattr(x, 'type', '') == 'text'
            ).strip()

        if self.provider == 'ollama':
            model = os.getenv('OLLAMA_MODEL', 'llama3.2:3b')
            url = os.getenv('OLLAMA_URL', 'http://127.0.0.1:11434').rstrip('/')

            messages = [
                {'role': 'system', 'content': PERSONA},
                *history[-12:]
            ]

            response = httpx.post(
                url + '/api/chat',
                json={
                    'model': model,
                    'messages': messages,
                    'stream': False
                },
                timeout=180
            )
            response.raise_for_status()

            data = response.json()
            return data.get('message', {}).get('content', '').strip()

        q = history[-1]['content'] if history else ''
        return f"Thanks for asking. I'm Neeraj's AI digital representative. You asked: {q}."

