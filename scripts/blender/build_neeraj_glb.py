"""Build/validate the Neeraj AI production GLB in Blender.

This script is intentionally an asset-processing pipeline, not a fake photo-to-mesh
converter. It accepts a real humanoid source model (for example a Ready Player Me
compatible GLB), lets an artist/asset-generation step provide the Neeraj-specific
mesh, and then performs deterministic scene cleanup, humanoid/animation discovery,
reference metadata, and GLB export.

Usage (Blender 4.x):
  blender -b --python scripts/blender/build_neeraj_glb.py -- \
    --input /path/to/neeraj_source.glb \
    --output public/avatar/avatar.glb \
    --reference /path/to/Neeraj.png

Optional:
  --reference /path/to/full-body-reference.jpeg  (repeatable)
  --animation-dir /path/to/animations
  --validate-only
  --apply-transform

The source model must already be a genuine 3D humanoid mesh. A photograph alone
cannot be converted into an accurate rigged GLB by Blender without a 3D modelling
or avatar-generation stage.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Iterable

import bpy


DEFAULT_BONE_NAMES = {
    "hips": {"hips", "pelvis", "mixamorig:hips", "armature:hips"},
    "spine": {"spine", "spine1", "mixamorig:spine", "armature:spine"},
    "head": {"head", "mixamorig:head", "armature:head"},
    "neck": {"neck", "mixamorig:neck", "armature:neck"},
    "left_upper_arm": {"leftarm", "leftupperarm", "mixamorig:leftarm"},
    "right_upper_arm": {"rightarm", "rightupperarm", "mixamorig:rightarm"},
    "left_hand": {"lefthand", "mixamorig:lefthand"},
    "right_hand": {"righthand", "mixamorig:righthand"},
    "left_upper_leg": {"leftupleg", "leftthigh", "mixamorig:leftupleg"},
    "right_upper_leg": {"rightupleg", "rightthigh", "mixamorig:rightupleg"},
    "left_foot": {"leftfoot", "mixamorig:leftfoot"},
    "right_foot": {"rightfoot", "mixamorig:rightfoot"},
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Process Neeraj AI humanoid GLB")
    parser.add_argument("--input", required=True, help="Source GLB/GLTF humanoid")
    parser.add_argument("--output", default="public/avatar/avatar.glb")
    parser.add_argument("--reference", action="append", default=[])
    parser.add_argument("--animation-dir", default=None)
    parser.add_argument("--validate-only", action="store_true")
    parser.add_argument("--apply-transform", action="store_true")
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else [])


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)


def import_model(path: Path) -> None:
    if path.suffix.lower() == ".glb":
        bpy.ops.import_scene.gltf(filepath=str(path))
    elif path.suffix.lower() in {".gltf", ".glb"}:
        bpy.ops.import_scene.gltf(filepath=str(path))
    else:
        raise ValueError(f"Unsupported source model: {path}")


def import_animations(directory: Path) -> list[str]:
    imported: list[str] = []
    if not directory or not directory.exists():
        return imported

    # Animation GLBs are imported into the current scene. Existing objects are kept;
    # callers can then inspect and retarget actions in Blender as needed.
    for path in sorted(directory.glob("*.glb")):
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(path), loglevel=0)
        after = set(bpy.data.objects)
        imported.extend(obj.name for obj in after - before)
    return imported


def normalize_name(value: str) -> str:
    return value.lower().replace(" ", "").replace("_", "").replace("-", "")


def find_armature() -> bpy.types.Object | None:
    armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    if not armatures:
        return None
    # Prefer the armature with the largest bone count.
    return max(armatures, key=lambda obj: len(obj.data.bones))


def bone_inventory(armature: bpy.types.Object | None) -> dict[str, str | None]:
    if not armature:
        return {key: None for key in DEFAULT_BONE_NAMES}
    lookup = {normalize_name(b.name): b.name for b in armature.data.bones}
    result: dict[str, str | None] = {}
    for role, candidates in DEFAULT_BONE_NAMES.items():
        result[role] = next((lookup[normalize_name(c)] for c in candidates if normalize_name(c) in lookup), None)
    return result


def mesh_stats() -> dict[str, int]:
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    vertices = sum(len(obj.data.vertices) for obj in meshes)
    polygons = sum(len(obj.data.polygons) for obj in meshes)
    shape_keys = sum(len(obj.data.shape_keys.key_blocks) - 1 for obj in meshes if obj.data.shape_keys)
    return {
        "mesh_objects": len(meshes),
        "vertices": vertices,
        "polygons": polygons,
        "facial_shape_keys": max(0, shape_keys),
    }


def animation_inventory() -> list[str]:
    names: list[str] = []
    for action in bpy.data.actions:
        if action.name and action.name not in names:
            names.append(action.name)
    return sorted(names)


def collect_identity_metadata(references: Iterable[str]) -> dict:
    refs = [str(Path(p)) for p in references if p]
    return {
        "identity": "Neeraj Kapil AI Digital Human",
        "identity_lock": True,
        "source_references": refs,
        "reference_roles": {
            "full_body": True,
            "face": True,
            "body_proportions": True,
            "hands": True,
            "feet_and_shoes": True,
            "wardrobe": True,
        },
        "processing": {
            "humanoid_rig": True,
            "facial_morphs": True,
            "animation_retargeting": True,
            "gltf2_glb_export": True,
        },
    }


def apply_transforms() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)


def validate(armature: bpy.types.Object | None) -> tuple[bool, list[str]]:
    errors: list[str] = []
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        errors.append("No mesh objects found")
    if not armature:
        errors.append("No armature found; production avatar must be humanoid-rigged")
    else:
        bones = bone_inventory(armature)
        required = ["hips", "spine", "head", "left_hand", "right_hand", "left_foot", "right_foot"]
        missing = [role for role in required if not bones.get(role)]
        if missing:
            errors.append("Missing humanoid bones: " + ", ".join(missing))

    if not animation_inventory():
        errors.append("No animation actions found")

    stats = mesh_stats()
    if stats["facial_shape_keys"] == 0:
        errors.append("No facial shape keys/morph targets found")

    return not errors, errors


def export_glb(output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        use_selection=False,
        export_apply=False,
        export_animations=True,
        export_morph=True,
        export_materials="EXPORT",
        export_texcoords=True,
        export_normals=True,
        export_tangents=False,
    )


def write_manifest(output: Path, metadata: dict, valid: bool, errors: list[str]) -> None:
    manifest = output.with_suffix(".manifest.json")
    armature = find_armature()
    payload = {
        **metadata,
        "status": "ready_for_web_validation" if valid else "asset_validation_failed",
        "validation": {
            "valid": valid,
            "errors": errors,
            "armature": armature.name if armature else None,
            "bones": bone_inventory(armature),
            "mesh": mesh_stats(),
            "animations": animation_inventory(),
        },
        "output": str(output),
    }
    manifest.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def main() -> int:
    args = parse_args()
    source = Path(args.input).expanduser().resolve()
    output = Path(args.output).expanduser().resolve()
    if not source.exists():
        raise FileNotFoundError(source)

    reset_scene()
    import_model(source)
    if args.animation_dir:
        import_animations(Path(args.animation_dir).expanduser().resolve())
    if args.apply_transform:
        apply_transforms()

    armature = find_armature()
    metadata = collect_identity_metadata(args.reference)
    valid, errors = validate(armature)
    write_manifest(output, metadata, valid, errors)

    print(json.dumps({
        "valid": valid,
        "errors": errors,
        "mesh": mesh_stats(),
        "animations": animation_inventory(),
        "armature": armature.name if armature else None,
        "output": str(output),
    }, indent=2))

    if args.validate_only:
        return 0 if valid else 2

    if not valid:
        print("Refusing to export a production GLB because validation failed.", file=sys.stderr)
        return 2

    export_glb(output)
    print(f"Exported production GLB: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
