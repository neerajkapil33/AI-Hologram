#!/usr/bin/env python3
"""Production gate for the Neeraj full-body GLB contract."""
from __future__ import annotations

import json
import struct
import sys
from pathlib import Path

PATH = Path(sys.argv[1] if len(sys.argv) > 1 else "public/avatar/avatar.glb")
if not PATH.is_file() or PATH.stat().st_size == 0:
    raise SystemExit(f"Missing avatar GLB: {PATH}")
data = PATH.read_bytes()
if data[:4] != b"glTF" or len(data) < 20:
    raise SystemExit("Invalid GLB header")
version, declared_length = struct.unpack_from("<II", data, 4)
if version != 2 or declared_length != len(data):
    raise SystemExit(f"Invalid GLB version/length: version={version} declared={declared_length} actual={len(data)}")
json_length, json_type = struct.unpack_from("<II", data, 12)
if json_type != 0x4E4F534A or 20 + json_length > len(data):
    raise SystemExit("Invalid GLB JSON chunk")
root = json.loads(data[20:20 + json_length].decode("utf-8").rstrip(" \t\r\n\x00"))
meshes = root.get("meshes", [])
nodes = root.get("nodes", [])
skins = root.get("skins", [])
anims = root.get("animations", [])
if not meshes: raise SystemExit("Production avatar has no meshes")
if not skins: raise SystemExit("Production avatar is not rigged: no skin/skeleton")

names = [str(n.get("name", "")).lower() for n in nodes]
bone_names = [n for n in names if any(k in n for k in ("hip", "pelvis", "spine", "chest", "neck", "head", "arm", "forearm", "hand", "thigh", "leg", "foot"))]
core = {
    "hips/pelvis": any("hip" in n or "pelvis" in n for n in names),
    "spine": any("spine" in n for n in names),
    "neck": any("neck" in n for n in names),
    "head": any("head" in n for n in names),
    "arms": any("leftupperarm" in n or "left_arm" in n for n in names) and any("rightupperarm" in n or "right_arm" in n for n in names),
    "legs": any("leftthigh" in n or "leftupleg" in n for n in names) and any("rightthigh" in n or "rightupleg" in n for n in names),
}
missing = [k for k, ok in core.items() if not ok]
if missing:
    raise SystemExit("Production avatar missing humanoid core bones: " + ", ".join(missing))

morph_names: list[str] = []
morph_sets = 0
skinned_meshes = 0
for mesh in meshes:
    for primitive in mesh.get("primitives", []):
        targets = primitive.get("targets", [])
        if targets:
            morph_sets += 1
            # glTF targets don't contain names; mesh extras/exporter metadata sometimes does.
    if mesh.get("weights") is not None or any(p.get("targets") for p in mesh.get("primitives", [])):
        pass
for node in nodes:
    extras = node.get("extras") or {}
    for key in ("morphTargetNames", "blendShapeNames"):
        value = extras.get(key)
        if isinstance(value, list): morph_names.extend(str(x).lower() for x in value)
for skin in skins:
    if skin.get("joints"): skinned_meshes += 1

# Require facial deformation geometry. Names are preferred, but a morph target
# set is accepted because many GLB exporters omit target labels at glTF level.
target_count = sum(len(p.get("targets", [])) for m in meshes for p in m.get("primitives", []))
if target_count == 0:
    raise SystemExit("Production avatar has no facial morph targets")
arkit_hits = sum(1 for n in morph_names if n in {"jawopen", "mouthsmileleft", "mouthsmileright", "eyeblinkleft", "eyeblinkright", "browinnerup"})
viseme_hits = sum(1 for n in morph_names if "viseme" in n)

print(f"Validated production avatar: {PATH} ({len(data):,} bytes)")
print(f"meshes={len(meshes)} nodes={len(nodes)} skins={len(skins)} skin-joint sets={skinned_meshes} morph-targets={target_count} animations={len(anims)}")
print(f"humanoid-core={sum(core.values())}/{len(core)} arkit-hints={arkit_hits} viseme-hints={viseme_hits}")
if morph_names and arkit_hits == 0 and viseme_hits == 0:
    raise SystemExit("Facial morph targets exist but no ARKit/viseme-compatible names were found in exporter metadata")
if not anims:
    print("NOTE: no baked animations; runtime procedural motion is allowed.")
print("PRODUCTION AVATAR GATE: PASS")
