import re
from dataclasses import asdict, dataclass


@dataclass
class Performance:
    """Executable presentation command for the browser-side FBX avatar."""

    emotion: str = "neutral"
    expression: str = "neutral"
    gesture: str = "idle"
    head: str = "neutral"
    body: str = "idle"
    gaze: str = "camera"
    hands: str = "rest"
    posture: str = "natural"
    movement: str = "still"
    wardrobe: str = "executive"
    environment: str = "studio"
    activity: str = "conversation"
    intensity: float = 0.35
    duration_ms: int = 1800
    priority: int = 1
    speaking: bool = True
    speech_style: str = "conversational"


class PerformanceDirector:
    """Turn the AI answer into an executable performance for the real FBX rig.

    This layer is semantic: it does not manipulate Three.js objects. It emits
    safe commands that AvatarEngine.tsx executes against the authenticated
    production FBX skeleton, facial morphs and eyes.
    """

    @staticmethod
    def _has(text: str, pattern: str) -> bool:
        return bool(re.search(pattern, text))

    @staticmethod
    def _not_negated(text: str, pattern: str) -> bool:
        return not bool(
            re.search(
                rf"\b(?:not|never|don't|do not|isn't|is not|cannot|can't)\s+(?:\w+\s+){{0,2}}{pattern}\b",
                text,
            )
        )

    def direct(self, text: str) -> Performance:
        t = re.sub(r"\s+", " ", (text or "").strip().lower())
        p = Performance()
        if not t:
            return p

        if self._has(t, r"\b(gym|gymming|fitness|workout|exercise|calisthenics|push[- ]?ups?|squat|plank|stretch|muscle|training)\b"):
            p.wardrobe, p.environment, p.activity = "fitness", "gym", "fitness_demo"
            p.emotion, p.expression = "energetic", "excited"
            p.gesture, p.body, p.hands = "full-body", "athletic", "active"
            p.movement, p.intensity, p.duration_ms = "demonstrate", 0.72, 2400
        elif self._has(t, r"\b(cricket|football|soccer|basketball|tennis|golf|boxing|badminton|hockey|baseball|volleyball|swimming|running|sport|sports)\b"):
            p.wardrobe, p.environment, p.activity = "sport", "sports_arena", "sports_demo"
            p.emotion, p.expression = "energetic", "excited"
            p.gesture, p.body, p.hands = "full-body", "athletic", "active"
            p.movement, p.intensity, p.duration_ms = "demonstrate", 0.76, 2400
        elif self._has(t, r"\b(dance|dancing|choreograph|choreography)\b"):
            p.wardrobe, p.environment, p.activity = "performance", "dance_studio", "dance"
            p.emotion, p.expression = "joyful", "happy"
            p.gesture, p.body, p.hands = "full-body", "dance", "expressive"
            p.movement, p.intensity, p.duration_ms = "dance", 0.78, 3000
        elif self._has(t, r"\b(date|romantic|romance|love|lover|flirt|flirting|sweetheart|darling|affection|kiss|kissing|flying kiss)\b"):
            p.wardrobe, p.environment, p.activity = "romantic", "romantic_lounge", "romantic_conversation"
            p.emotion, p.expression = "affectionate", "warm"
            p.gesture, p.head, p.body = "smile", "soft_tilt", "relaxed"
            p.gaze, p.hands = "camera", "gentle"
            p.intensity = 0.30
        elif self._has(t, r"\b(movie|film|character|act like|roleplay|detective|hero|villain|actor)\b"):
            p.wardrobe, p.environment, p.activity = "character_adaptive", "cinematic", "acting"
            p.emotion, p.expression = "dramatic", "engaged"
            p.gesture, p.body, p.hands = "full-body", "expressive", "active"
            p.intensity = 0.68
        elif self._has(t, r"\b(class|lesson|teach|teacher|explain|learn|student|tutorial)\b"):
            p.wardrobe, p.environment, p.activity = "smart_casual", "classroom", "teaching"
            p.emotion, p.expression = "patient", "kind"
            p.gesture, p.body, p.hands = "present", "upright", "open"
            p.intensity = 0.42
        elif self._has(t, r"\b(work|office|board|ceo|executive|interview|career|leadership|business|meeting|client|presentation|professional)\b"):
            p.wardrobe, p.environment, p.activity = "executive", "executive_studio", "advising"
            p.gesture, p.body, p.hands = "present", "grounded", "open"

        if self._has(t, r"\b(i'm sorry|i am sorry|that's difficult|that sounds hard|i understand|i hear you|makes sense|you are not alone|take your time|i'm here)\b"):
            p.emotion, p.expression = "empathetic", "warm"
            p.gesture, p.head, p.body, p.gaze = "nod", "small_nod", "open_posture", "camera"
            p.hands, p.intensity = "gentle", 0.30
        elif self._has(t, r"\b(sad|sadness|unfortunate|heartbreaking|disappointed|loss|grief|miss|hurt)\b"):
            p.emotion, p.expression = "sad", "sad"
            p.gesture, p.head, p.body = "idle", "downward_soft", "softened"
            p.hands, p.intensity = "rest", 0.24
        elif self._not_negated(t, r"(angry|anger|furious|unacceptable|outrage|aggressive|aggression|frustrating|frustrated)"):
            p.emotion, p.expression = "assertive", "firm"
            p.gesture, p.head, p.body = "present", "firm", "grounded"
            p.hands, p.intensity = "emphasis", 0.68
        elif self._has(t, r"\b(confused|confusing|unclear|not sure|don't understand|do not understand|ambiguous|mixed signals)\b"):
            p.emotion, p.expression = "confused", "confused"
            p.gesture, p.head, p.body = "shrug", "slight_tilt", "curious_shift"
            p.intensity = 0.36
        elif self._has(t, r"\b(think|thinking|consider|let me think|reflect|perspective|trade[- ]?off)\b"):
            p.emotion, p.expression = "thoughtful", "thinking"
            p.gesture, p.head, p.body, p.gaze = "chin-touch", "slight_tilt", "thoughtful_shift", "soft_focus"
            p.hands, p.intensity = "thinking", 0.38
        elif self._has(t, r"\b(smart|insight|strategic|strategy|logic|data|evidence|pattern|analysis|analytical|key point)\b"):
            p.emotion, p.expression = "intelligent", "smart"
            p.gesture, p.body, p.hands = "present", "grounded", "open"
        elif self._has(t, r"\b(excited|exciting|fantastic|amazing|brilliant|great news|congratulations|well done)\b"):
            p.emotion, p.expression = "excited", "excited"
            p.gesture, p.head, p.body, p.hands = "present", "upright", "upright", "open"
            p.intensity = 0.62
        elif self._has(t, r"\b(kind|kindly|gentle|nice|welcome|thank you|thanks|appreciate|please)\b"):
            p.emotion, p.expression = "kind", "kind"
            p.gesture, p.head, p.body = "nod", "small_nod", "open_posture"
        elif self._has(t, r"\b(important|critical|key|remember|don't miss|must|risk|warning)\b"):
            p.emotion, p.expression = "focused", "firm"
            p.gesture, p.head, p.body, p.hands = "present", "firm", "forward_lean", "emphasis"
            p.intensity = 0.55
        elif self._has(t, r"\b(my advice|i recommend|i would|you should|focus on|the best move)\b"):
            p.emotion, p.expression = "confident", "confident"
            p.gesture, p.body = "present", "grounded"
        elif "?" in t or self._has(t, r"\b(what|why|how|which|where|when)\b"):
            p.emotion, p.expression = "curious", "curious"
            p.gesture, p.head, p.body = "shrug", "slight_tilt", "curious_shift"
        elif p.activity == "conversation":
            p.emotion, p.expression, p.gesture = "calm", "neutral", "present"
            p.body, p.hands = "natural_shift", "open"

        if self._has(t, r"\b(namaste)\b"):
            p.gesture = "namaste"
        elif self._has(t, r"\b(hello|hi|hey|greet|welcome)\b"):
            p.gesture = "wave"
        elif self._has(t, r"\b(bye|goodbye|see you)\b"):
            p.gesture = "bye-wave"
        elif self._has(t, r"\b(clap|clapping|applause)\b"):
            p.gesture = "clap"
        elif self._has(t, r"\b(flying kiss)\b"):
            p.gesture = "flying-kiss"
        elif self._has(t, r"\b(kiss|kiss me)\b"):
            p.gesture = "kiss-gesture"

        if len(t) > 220 and p.gesture == "idle":
            p.gesture = "present"
        if len(t) > 500:
            p.intensity = min(0.78, p.intensity + 0.05)
        p.intensity = max(0.15, min(0.85, p.intensity))
        return p

    def as_dict(self, text: str) -> dict:
        return asdict(self.direct(text))
