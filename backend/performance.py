import re
from dataclasses import dataclass, asdict


@dataclass
class Performance:
    """Presentation state for the persistent Neeraj full-body digital human."""
    emotion: str = "neutral"
    expression: str = "neutral"
    gesture: str = "idle"
    head: str = "neutral"
    body: str = "idle"
    gaze: str = "camera"
    wardrobe: str = "executive"
    environment: str = "studio"
    activity: str = "conversation"
    intensity: float = 0.35


class PerformanceDirector:
    """Map conversational context to identity-preserving avatar presentation.

    The director does not change the Neeraj identity. It selects presentation
    layers that a future rig/video renderer can execute: wardrobe, environment,
    facial emotion, gesture, body activity, gaze and intensity.
    """

    def direct(self, text: str) -> Performance:
        t = (text or "").strip().lower()
        p = Performance()
        if not t:
            return p

        # Context / activity first: these determine wardrobe + environment.
        if re.search(r"\b(gym|gymming|fitness|workout|exercise|calisthenics|push[- ]?ups?|squat|plank|stretch|muscle|training)\b", t):
            p.wardrobe, p.environment, p.activity = "fitness", "gym", "fitness_demo"
            p.emotion, p.expression, p.gesture, p.body = "energetic", "encouraging", "demonstrate", "athletic"
        elif re.search(r"\b(cricket|football|soccer|basketball|tennis|golf|boxing|badminton|hockey|baseball|volleyball|swimming|running|sport|sports)\b", t):
            p.wardrobe, p.environment, p.activity = "sport", "sports_arena", "sports_demo"
            p.emotion, p.expression, p.gesture, p.body = "energetic", "excited", "demonstrate", "athletic"
        elif re.search(r"\b(dance|dancing|choreograph|choreography)\b", t):
            p.wardrobe, p.environment, p.activity = "performance", "dance_studio", "dance"
            p.emotion, p.expression, p.gesture, p.body = "joyful", "happy", "dance", "dance"
        elif re.search(r"\b(date|romantic|romance|love|lover|flirt|flirting|sweetheart|darling|affection|kiss|kissing|flying kiss)\b", t):
            p.wardrobe, p.environment, p.activity = "romantic", "romantic_lounge", "romantic_conversation"
            p.emotion, p.expression, p.gesture, p.head, p.body, p.gaze = "affectionate", "warm_smile", "soft_wave", "soft_tilt", "relaxed", "camera"
        elif re.search(r"\b(movie|film|character|act like|roleplay|detective|hero|villain|actor)\b", t):
            p.wardrobe, p.environment, p.activity = "character_adaptive", "cinematic", "acting"
            p.emotion, p.expression, p.gesture, p.body = "dramatic", "engaged", "character_acting", "expressive"
        elif re.search(r"\b(class|lesson|teach|teacher|explain|learn|student|training|tutorial)\b", t):
            p.wardrobe, p.environment, p.activity = "smart_casual", "classroom", "teaching"
            p.emotion, p.expression, p.gesture, p.body = "patient", "kind_smile", "explain", "upright"
        elif re.search(r"\b(work|office|board|ceo|executive|interview|career|leadership|business|meeting|client|presentation|professional)\b", t):
            p.wardrobe, p.environment, p.activity = "executive", "executive_studio", "advising"

        # Emotion / delivery.
        if re.search(r"\b(i'm sorry|i am sorry|that's difficult|that sounds hard|i understand|i hear you|makes sense|you are not alone|take your time)\b", t):
            p.emotion, p.expression, p.gesture, p.head, p.body = "empathetic", "warm", "acknowledge", "small_nod", "open_posture"
        elif re.search(r"\b(sad|sadness|unfortunate|heartbreaking|disappointed|loss|grief|miss|hurt)\b", t):
            p.emotion, p.expression, p.gesture, p.head, p.body = "sad", "sad", "reassure", "downward_soft", "softened"
        elif re.search(r"\b(angry|anger|furious|unacceptable|outrage|aggressive|aggression|frustrating|frustrated|absolutely not)\b", t):
            p.emotion, p.expression, p.gesture, p.head, p.body, p.intensity = "assertive", "firm", "emphasis", "firm", "grounded", .72
        elif re.search(r"\b(confused|confusing|unclear|not sure|don't understand|do not understand|ambiguous|mixed signals)\b", t):
            p.emotion, p.expression, p.gesture, p.head, p.body = "confused", "confused", "question", "slight_tilt", "curious_shift"
        elif re.search(r"\b(think|thinking|consider|let me think|reflect|perspective|trade[- ]?off)\b", t):
            p.emotion, p.expression, p.gesture, p.head, p.body, p.gaze = "thoughtful", "thinking", "chin_touch", "slight_tilt", "thoughtful_shift", "soft_focus"
        elif re.search(r"\b(smart|insight|strategic|strategy|logic|data|evidence|pattern|analysis|analytical|key point)\b", t):
            p.emotion, p.expression, p.gesture, p.body = "intelligent", "smart", "explain", "grounded"
        elif re.search(r"\b(excited|exciting|fantastic|amazing|brilliant|great news|congratulations|well done)\b", t):
            p.emotion, p.expression, p.gesture, p.body, p.intensity = "excited", "happy", "open_hand", "upright", .62
        elif re.search(r"\b(kind|kindly|gentle|nice|welcome|thank you|thanks|appreciate|please)\b", t):
            p.emotion, p.expression, p.gesture, p.head, p.body = "kind", "kind_smile", "acknowledge", "small_nod", "open_posture"
        elif re.search(r"\b(important|critical|key|remember|don't miss|must|risk|warning)\b", t):
            p.emotion, p.expression, p.gesture, p.head, p.body, p.intensity = "focused", "focused", "emphasis", "firm", "forward_lean", .55
        elif re.search(r"\b(my advice|i recommend|i would|you should|focus on|the best move)\b", t):
            p.emotion, p.expression, p.gesture, p.head, p.body = "confident", "confident", "explain", "neutral", "grounded"
        elif "?" in t or re.search(r"\b(what|why|how|which|where|when)\b", t):
            p.emotion, p.expression, p.gesture, p.head, p.body = "curious", "curious", "question", "slight_tilt", "curious_shift"
        elif p.activity == "conversation":
            p.emotion, p.expression, p.gesture, p.body = "calm", "engaged", "explain", "natural_shift"

        # Explicit social gestures requested by the user.
        if re.search(r"\b(hello|hi|hey|greet|namaste)\b", t):
            p.gesture = "namaste" if "namaste" in t else "wave"
        elif re.search(r"\b(bye|goodbye|see you)\b", t):
            p.gesture = "bye_wave"
        elif re.search(r"\b(clap|clapping|applause)\b", t):
            p.gesture = "clap"
        elif re.search(r"\b(flying kiss)\b", t):
            p.gesture = "flying_kiss"
        elif re.search(r"\b(kiss|kiss me)\b", t):
            p.gesture = "kiss_gesture"

        if len(t) > 220 and p.body == "idle":
            p.body = "natural_shift"
        if len(t) > 500:
            p.intensity = min(.78, p.intensity + .05)
        return p

    def as_dict(self, text: str) -> dict:
        return asdict(self.direct(text))
