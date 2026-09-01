#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [ ! -d third_party/MuseTalk ]; then
  git clone https://github.com/TMElyralab/MuseTalk.git third_party/MuseTalk
fi
cd third_party/MuseTalk
python -m pip install -r requirements.txt
# Official MuseTalk docs provide the model download/preparation steps.
# Keep model weights out of this repository.
echo "MuseTalk source installed. Follow its model preparation instructions, then set AVATAR_ENGINE=musetalk."
