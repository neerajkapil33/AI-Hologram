"""Neeraj single-image -> 3D reconstruction orchestrator.

This pipeline intentionally keeps model weights out of Git. It uses the approved
reference image as the source of truth, verifies the OpenCV 5 YuNet detector,
and optionally invokes Tencent Hunyuan3D-2.1 for image-to-mesh generation.

Run from the repository root:
    python tools/avatar_reconstruction.py

Outputs:
    build/avatar_face_detection.json
    build/avatar_raw.glb   (when Hunyuan3D is installed/configured)

The script never modifies the reference image.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IMAGE = Path(os.getenv("NEERAJ_REFERENCE_IMAGE", ROOT / "assets_private" / "neeraj.jpg"))
MODEL = Path(os.getenv("YUNET_MODEL", ROOT / "models" / "face_detection_yunet_2023mar.onnx"))
BUILD = ROOT / "build"
BUILD.mkdir(exist_ok=True)


def detect_face() -> dict:
    import cv2
    import numpy as np

    if not IMAGE.exists():
        raise FileNotFoundError(f"Reference image not found: {IMAGE}")
    if not MODEL.exists():
        raise FileNotFoundError(
            f"YuNet model not found: {MODEL}. Download face_detection_yunet_2023mar.onnx into models/."
        )

    image = cv2.imread(str(IMAGE))
    if image is None:
        raise RuntimeError(f"OpenCV could not read {IMAGE}")
    h, w = image.shape[:2]
    detector = cv2.FaceDetectorYN_create(str(MODEL), "", (w, h), 0.9, 0.3, 5000)
    _, faces = detector.detect(image)
    detections = [] if faces is None else np.round(faces[:, :4], 2).tolist()
    result = {
        "image": str(IMAGE.relative_to(ROOT)).replace("\\", "/"),
        "image_size": [int(w), int(h)],
        "opencv": cv2.__version__,
        "detector": "YuNet 2023mar",
        "faces": len(detections),
        "detections_xywh": detections,
    }
    (BUILD / "avatar_face_detection.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    return result


def run_hunyuan() -> str | None:
    """Invoke an already-installed Hunyuan3D-2.1 checkout when configured.

    HUNYUAN_DIR points to a local checkout of Tencent-Hunyuan/Hunyuan3D-2.1.
    The exact CLI is intentionally delegated to the installed project because
    model/runtime flags vary by release. Set HUNYUAN_COMMAND to a complete
    command template containing {image} and {output} for deterministic use.
    """
    command = os.getenv("HUNYUAN_COMMAND")
    if not command:
        return None

    output = BUILD / "avatar_raw.glb"
    rendered = command.format(image=str(IMAGE), output=str(output))
    subprocess.run(rendered, shell=True, cwd=os.getenv("HUNYUAN_DIR") or str(ROOT), check=True)
    if not output.exists():
        raise RuntimeError("Hunyuan command completed but avatar_raw.glb was not created")
    return str(output)


def main() -> int:
    face = detect_face()
    print(json.dumps(face, indent=2))
    raw = run_hunyuan()
    if raw:
        print(f"RAW_GLB={raw}")
        print("NEXT=blender -b --python tools/blender_rig_and_export.py")
    else:
        print("HUNYUAN=not configured; face verification completed only")
        print("Set HUNYUAN_COMMAND and HUNYUAN_DIR after installing the Hunyuan3D-2.1 runtime.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
