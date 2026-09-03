#!/usr/bin/env python3
"""Validate a production avatar GLB without requiring AvatarSDK credentials.

This is the credential-free ingestion gate: a GLB generated/exported by an
external avatar tool can be placed at public/avatar/avatar.glb and validated
locally or in GitHub Actions. The runtime supplies procedural gestures and
viseme/expression driving, so baked animation clips are optional.
"""
from __future__ import annotations

import struct
import sys
from pathlib import Path

PATH = Path(sys.argv[1] if len(sys.argv) > 1 else "public/avatar/avatar.glb")

if not PATH.is_file() or PATH.stat().st_size == 0:
    raise SystemExit(f"Missing avatar GLB: {PATH}")

data = PATH.read_bytes()
if data[:4] != b"glTF":
    raise SystemExit("Invalid GLB: missing glTF magic header")
if len(data) < 20:
    raise SystemExit("Invalid GLB: file is too small")

version, declared_length = struct.unpack_from("<II", data, 4)
if version != 2:
    raise SystemExit(f"Unsupported GLB version: {version}")
if declared_length != len(data):
    raise SystemExit(f"Invalid GLB length: header={declared_length}, actual={len(data)}")

json_length, json_type = struct.unpack_from("<II", data, 12)
if json_type != 0x4E4F534A:
    raise SystemExit("Invalid GLB: first chunk is not JSON")
json_start = 20
json_end = json_start + json_length
if json_end > len(data):
    raise SystemExit("Invalid GLB: JSON chunk exceeds file size")

import json
root = json.loads(data[json_start:json_end].decode("utf-8").rstrip(" \t\r\n\x00"))
meshes = root.get("meshes", [])
nodes = root.get("nodes", [])
skins = root.get("skins", [])
animations = root.get("animations", [])

morph_count = 0
for mesh in meshes:
    for primitive in mesh.get("primitives", []):
        morph_count += len(primitive.get("targets", []))

if not meshes:
    raise SystemExit("Invalid avatar GLB: no meshes found")
if not skins:
    raise SystemExit("Avatar GLB is not rigged: no skin/skeleton found")

print(f"Validated avatar GLB: {PATH} ({len(data):,} bytes)")
print(f"meshes={len(meshes)} nodes={len(nodes)} skins={len(skins)} morph-target sets={morph_count} animations={len(animations)}")
if morph_count == 0:
    raise SystemExit("Avatar GLB has no facial morph targets; lip-sync/expression support cannot be production-ready")
if not animations:
    print("NOTE: no baked animation clips; this is acceptable because AI-Hologram drives gestures procedurally at runtime.")
