"""Semantic motor-planning layer for the browser FBX avatar.

This is not a neural motor cortex simulation. It is a deterministic, testable
motor-planning model that converts natural-language physical commands into
task phases and posture constraints. AvatarEngine.tsx remains the single
execution controller for the production FBX rig.
"""

import re
from dataclasses import dataclass, asdict
from typing import Any


@dataclass
class MotorPlan:
    command: str = "idle"
    phase: str = "idle"
    target: str = "none"
    posture: str = "natural"
    support: str = "none"
    hands: str = "rest"
    feet: str = "balanced"
    trunk: str = "upright"
    gaze: str = "camera"
    duration_ms: int = 1800


class MotorBrain:
    """Plan human-like goal-directed movement without owning the 3D rig."""

    KNOWLEDGE = {
        "standing": "upright trunk, balanced feet, small anticipatory postural adjustments",
        "sitting": "pelvis settles onto seat, hips and knees flex, feet remain supported, trunk stabilizes",
        "sit_transfer": "locate chair, approach open side, contact/support, controlled hip-knee descent, settle pelvis",
        "supported_sitting": "hands can use bilateral armrests for support while trunk remains organized",
        "reaching": "stabilize trunk and proximal joints while distal hand moves to target",
        "writing": "shoulder/elbow stabilize; wrist and fingers perform fine pen control",
        "walking": "alternating leg support, pelvic counter-rotation, foot clearance and balance",
        "object_interaction": "localize target, choose hand, reach, contact/grasp, manipulate, release",
    }

    @staticmethod
    def _match(text: str, pattern: str) -> bool:
        return bool(re.search(pattern, text))

    def plan(self, text: str) -> MotorPlan:
        t = re.sub(r"\s+", " ", (text or "").strip().lower())
        if not t:
            return MotorPlan()

        if self._match(t, r"\b(hold|grab|use)\s+(the\s+)?chair\b.*\b(sit|sitting)\b|\b(sit|sitting)\b.*\b(hold|grab|use)\s+(the\s+)?chair\b"):
            return MotorPlan("sit-chair-human", "approach_contact", "chair", "seated", "bilateral_armrests", "both_hands_support", "feet_flat", "upright", "chair", 4200)
        if self._match(t, r"\b(find|locate|go to|sit on|sit in)\b.*\bchair\b|\bchair\b.*\b(sit|seat)\b"):
            return MotorPlan("sit-chair-human", "locate_approach", "chair", "seated", "bilateral_armrests", "both_hands_support", "feet_flat", "upright", "chair", 4200)
        if self._match(t, r"\bstand\b|\bget up\b|\brise\b"):
            return MotorPlan("stand", "stabilize", "floor", "standing", "none", "rest", "balanced", "upright", "forward", 2600)
        if self._match(t, r"\bwalk\b|\bmove\b|\bgo\b"):
            return MotorPlan("walk", "locomotion", "environment", "standing", "none", "natural_swing", "alternating", "upright", "forward", 3000)
        if self._match(t, r"\b(write|take notes|note taking)\b"):
            return MotorPlan("write-notepad", "manipulate", "notepad", "seated", "table", "right_hand_pen_left_hand_stabilize", "feet_flat", "forward_lean", "notepad", 6200)
        if self._match(t, r"\b(read|book)\b"):
            return MotorPlan("read-book", "manipulate", "book", "seated", "chair", "both_hands_book", "feet_flat", "slight_forward", "book", 5200)
        if self._match(t, r"\b(cross\s*[- ]?legs|leg over thigh)\b"):
            return MotorPlan("cross-sit", "settle", "chair", "seated", "seat", "rest", "one_leg_crossed", "upright", "camera", 4200)
        if self._match(t, r"\b(rest|relax)\b"):
            return MotorPlan("idle", "settle", "none", "natural", "none", "rest", "balanced", "upright", "camera", 1800)
        return MotorPlan()

    def apply(self, text: str, performance: Any) -> Any:
        plan = self.plan(text)
        if plan.command != "idle":
            performance.gesture = plan.command
            performance.body = plan.posture
            performance.posture = plan.posture
            performance.hands = plan.hands
            performance.movement = plan.phase
            performance.gaze = plan.gaze
            performance.activity = f"motor_{plan.target}"
            performance.duration_ms = plan.duration_ms
            performance.priority = max(performance.priority, 3)
        return performance

    def as_dict(self, text: str) -> dict:
        return asdict(self.plan(text))
