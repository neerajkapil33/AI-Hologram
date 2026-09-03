import re
from dataclasses import dataclass, asdict


@dataclass
class Performance:
    """Presentation state for the full-body Neeraj digital human.

    These are presentation/emotional states inferred from the generated
    dialogue, not claims about the user's private biological emotions.
    The same contract is consumed by facial animation, gaze, body pose,
    hand gestures and future full-body motion clips.
    """

    emotion: str = "neutral"
    expression: str = "neutral"
    gesture: str = "idle"
    head: str = "neutral"
    body: str = "idle"
    gaze: str = "camera"
    intensity: float = 0.35


class PerformanceDirector:
    """Turn dialogue meaning into natural full-body human performance.

    The vocabulary is intentionally richer than a simple happy/thinking
    switch. It gives the avatar runtime explicit states for warmth, kindness,
    sadness, confusion, concern, anger/aggression, confidence, intelligence,
    romance/affection, excitement, empathy and listening.
    """

    NUMBER_WORDS = r"(?:one|two|three|four|five|six|first|second|third|next)"

    def direct(self, text: str) -> Performance:
        t = (text or "").strip().lower()
        p = Performance()

        if not t:
            return p

        # Strong emotional/context cues are evaluated first so a sentence
        # such as "I am sorry this happened" does not become generic advice.
        if re.search(r"\b(i'm sorry|i am sorry|that's difficult|that sounds hard|i understand|i hear you|makes sense|you are not alone|take your time)\b", t):
            p.emotion, p.expression, p.gesture, p.head, p.body, p.gaze = (
                "empathetic", "warm", "acknowledge", "small_nod", "open_posture", "camera"
            )
        elif re.search(r"\b(love|lovely|romantic|affection|dear|wonderful to have you|i appreciate you)\b", t):
            p.emotion, p.expression, p.gesture, p.head, p.body, p.gaze = (
                "affectionate", "warm_smile", "open_hand", "soft_tilt", "open_posture", "camera"
            )
        elif re.search(r"\b(sad|sadness|unfortunate|heartbreaking|disappointed|loss|grief|miss|hurt)\b", t):
            p.emotion, p.expression, p.gesture, p.head, p.body, p.gaze = (
                "sad", "sad", "reassure", "downward_soft", "softened", "camera"
            )
        elif re.search(r"\b(angry|anger|furious|unacceptable|outrage|aggressive|aggression|frustrating|frustrated|absolutely not)\b", t):
            p.emotion, p.expression, p.gesture, p.head, p.body, p.intensity = (
                "assertive", "firm", "emphasis", "firm", "grounded", 0.72
            )
        elif re.search(r"\b(confused|confusing|unclear|not sure|don't understand|do not understand|ambiguous|mixed signals)\b", t):
            p.emotion, p.expression, p.gesture, p.head, p.body = (
                "confused", "confused", "question", "slight_tilt", "curious_shift"
            )
        elif re.search(r"\b(think|thinking|consider|let me think|reflect|perspective|trade-off|tradeoff)\b", t):
            p.emotion, p.expression, p.gesture, p.head, p.body, p.gaze = (
                "thoughtful", "thinking", "chin_touch", "slight_tilt", "thoughtful_shift", "soft_focus"
            )
        elif re.search(r"\b(smart|insight|strategic|strategy|logic|data|evidence|pattern|analysis|analytical|here's the key|here is the key)\b", t):
            p.emotion, p.expression, p.gesture, p.head, p.body = (
                "intelligent", "smart", "explain", "neutral", "grounded"
            )
        elif re.search(r"\b(excited|exciting|fantastic|amazing|brilliant|great news|congratulations|well done)\b", t):
            p.emotion, p.expression, p.gesture, p.head, p.body, p.intensity = (
                "excited", "happy", "open_hand", "small_nod", "upright", 0.62
            )
        elif re.search(r"\b(kind|kindly|gentle|nice|welcome|thank you|thanks|appreciate|please)\b", t):
            p.emotion, p.expression, p.gesture, p.head, p.body = (
                "kind", "kind_smile", "acknowledge", "small_nod", "open_posture"
            )
        elif re.search(r"\b(important|critical|key|remember|don't miss|must|risk|warning)\b", t):
            p.emotion, p.expression, p.gesture, p.head, p.body, p.intensity = (
                "focused", "focused", "emphasis", "firm", "forward_lean", 0.55
            )
        elif re.search(r"\b(my advice|i recommend|i would|you should|focus on|the best move)\b", t):
            p.emotion, p.expression, p.gesture, p.head, p.body = (
                "confident", "confident", "explain", "neutral", "grounded"
            )
        elif re.search(rf"\b{PerformanceDirector.NUMBER_WORDS}\b", t) or re.search(r"\b(three things|steps|areas|priorities)\b", t):
            p.emotion, p.expression, p.gesture, p.body = (
                "confident", "engaged", "enumerate", "upright"
            )
        elif "?" in t or re.search(r"\b(what|why|how|which|where|when)\b", t):
            p.emotion, p.expression, p.gesture, p.head, p.body = (
                "curious", "curious", "question", "slight_tilt", "curious_shift"
            )
        else:
            p.emotion, p.expression, p.gesture, p.body = (
                "calm", "engaged", "explain", "natural_shift"
            )

        if len(t) > 220 and p.body == "idle":
            p.body = "natural_shift"
        if len(t) > 500:
            p.intensity = min(0.78, p.intensity + 0.05)
        return p
