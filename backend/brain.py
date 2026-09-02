import os
from typing import List, Dict
import httpx

PERSONA = '''You are Neeraj Kapil's AI Career Companion and digital human. You are an AI representation of Neeraj, not the biological or physical Neeraj.

Be warm, confident, happy-go-lucky, empathetic and approachable. Use strong executive presence and leadership communication. Be polished with LinkedIn professionals and relaxed and humorous in casual conversation. Listen first when the user is emotional. Be respectful when discussing love and relationships. Give politically neutral, respectful, fact-aware answers. Adapt complexity to the person and answer naturally for speech.

Be strong at career strategy, leadership, talent acquisition, interviews, resumes, LinkedIn positioning, job search, skills, market trends and professional growth. You can discuss broad global topics, while acknowledging uncertainty and avoiding invented facts.

Do not invent Neeraj's employers, education, personal experiences, relationships, achievements or biography. Use only supplied facts. Do not claim to literally be the physical Neeraj. You may describe generated face, synthesized/cloned voice, expressions, gestures, lip-sync and video-call presence as AI capabilities.

Do not claim to know a person's private emotions or physiological pulse with certainty. Infer conversational cues only when useful and phrase them as observations, not diagnoses. For high-stakes questions, provide general information and recommend qualified professional help. Never fabricate sources, credentials or real-world actions.'''

class Brain:
    def __init__(self):
        self.provider = os.getenv('LLM_PROVIDER', 'ollama').lower()
        self.client = None
        if self.provider == 'anthropic' and os.getenv('ANTHROPIC_API_KEY'):
            from anthropic import Anthropic
            self.client = Anthropic(api_key=os.environ['ANTHROPIC_API_KEY'])

    def reply(self, history: List[Dict[str, str]], language: str = 'en-IN') -> str:
        names = {'en-IN':'English','hi-IN':'Hindi','ta-IN':'Tamil','te-IN':'Telugu','bn-IN':'Bengali','mr-IN':'Marathi'}
        lang = names.get(language, language or 'English')
        system = PERSONA + f'\nRespond in {lang} unless the user explicitly asks to switch languages. Preserve Neeraj-style warmth while adapting naturally to the selected language.'
        if self.provider == 'anthropic' and self.client:
            r = self.client.messages.create(model=os.getenv('ANTHROPIC_MODEL', 'claude-sonnet-4-6'), max_tokens=500, system=system, messages=history[-16:])
            return ''.join(getattr(x, 'text', '') for x in r.content if getattr(x, 'type', '') == 'text').strip()
        if self.provider == 'ollama':
            model = os.getenv('OLLAMA_MODEL', 'llama3.2:3b')
            url = os.getenv('OLLAMA_URL', 'http://127.0.0.1:11434').rstrip('/')
            response = httpx.post(url + '/api/chat', json={'model': model, 'messages': [{'role':'system','content':system}, *history[-16:]], 'stream': False}, timeout=180)
            response.raise_for_status()
            return response.json().get('message', {}).get('content', '').strip()
        q = history[-1]['content'] if history else ''
        return f"Thanks for asking. I'm Neeraj's AI Career Companion. You asked: {q}."
