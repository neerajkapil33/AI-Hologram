#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MT="$ROOT/third_party/MuseTalk"
PYTHON="${PYTHON:-python3}"

mkdir -p "$ROOT/third_party"
if [ ! -d "$MT/.git" ]; then
  git clone https://github.com/TMElyralab/MuseTalk.git "$MT"
else
  git -C "$MT" pull --ff-only
fi

"$PYTHON" -m pip install -U pip
"$PYTHON" -m pip install \
  torch torchvision torchaudio \
  diffusers accelerate transformers opencv-python soundfile librosa \
  einops omegaconf pyyaml imageio imageio-ffmpeg ffmpeg-python \
  moviepy mediapipe face-alignment safetensors timm huggingface_hub gdown

"$PYTHON" - <<PY
from huggingface_hub import snapshot_download
from pathlib import Path
mt = Path(r"$MT")
snapshot_download("TMElyralab/MuseTalk", local_dir=mt / "models", ignore_patterns=["*.md", "*.txt", "*.gitattributes"])
snapshot_download("openai/whisper-tiny", local_dir=mt / "models" / "whisper", ignore_patterns=["*.md", "*.gitattributes", "flax_model*", "tf_model*", "rust_model*"])
snapshot_download("stabilityai/sd-vae-ft-mse", local_dir=mt / "models" / "sd-vae", ignore_patterns=["*.md", "*.gitattributes"])
PY

echo "MuseTalk installed in $MT"
echo "Set AVATAR_ENGINE=musetalk and MUSETALK_DIR=third_party/MuseTalk"
