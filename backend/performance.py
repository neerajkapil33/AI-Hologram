import re
from dataclasses import dataclass, asdict


@dataclass
class Performance:
    emotion: str = "neutral"
    expression: str = "neutral"
    gesture: str = "idle"
    head: str = "neutral"
    body: str = "idle"
    gaze: str = "camera"
    intensity: float = 0.35

    def json(self) -> dict:
        return asdict(self)


class PerformanceDirector:
    """Deterministic, lightweight speech-meaning-to-performance director.

    It deliberately does not attempt to infer private emotions. It only maps
    linguistic cues to restrained presentation behavior for the digital human.
    A future animation runtime can consume this same contract for face, IK,
    hand gestures, posture and locomotion.
    """

    NUMBER_WORDS = r"(?:one|two|three|four|five|six|first|second|third|next)"

    def direct(self, text: str) -> Performance:
        t = (text or "").strip().lower()
        p = Performance()

        if not t:
            return p

        if re.search(r"\b(understand|hear you|makes sense|i see)\b", t):
            p.emotion, p.expression, p.gesture, p.head = "empathetic", "warm", "acknowledge", "small_nod"
        elif re.search(r"\b(great|excellent|congratulations|well done|good news)\b", t):
            p.emotion, p.expression, p.gesture, p.head = "positive", "smile", "open_hand", "small_nod"
        elif re.search(r"\b(however|but|on the other hand|instead|rather)\b", t):
            p.emotion, p.gesture, p.head = "thoughtful", "thoughtful", "contrast", "slight_tilt"
        elif re.search(r"\b(important|critical|key|remember|don't miss|must)\b", t):
            p.emotion, p.expression, p.gesture, p.body, p.intensity = "focused", "focused", "emphasis", "forward_lean", 0.55
        elif re.search(r"\b(my advice|i recommend|i would|you should|focus on)\b", t):
            p.emotion, p.expression, p.gesture, p.body = "confident", "confident", "explain", "natural_shift"
        elif re.search(rf"\b{PerformanceDirector.NUMBER_WORDS}\b", t) or re.search(r"\b(three things|steps|areas|priorities)\b", t):
            p.emotion, p.expression, p.gesture = "confident", "engaged", "enumerate"
        elif "?" in t or re.search(r"\b(what|why|how|which|where|when)\b", t):
            p.emotion, p.expression, p.gesture, p.head = "curious", "curious", "question", "slight_tilt"
        else:
            p.emotion, p.expression, p.gesture, p.body = "calm", "engaged", "explain", "natural_shift"

        if len(t) > 220:
            p.body = "natural_shift"
        if len(t) > 500:
            p.intensity = min(0.65, p.intensity + 0.05)
        return p
