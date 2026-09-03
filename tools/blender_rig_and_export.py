"""Blender 5.2 GLB preparation and humanoid rig export.

Usage from repository root:
    blender -b --python tools/blender_rig_and_export.py

Environment:
    AVATAR_RAW_GLB=build/avatar_raw.glb
    AVATAR_OUTPUT_GLB=build/neeraj_avatar.glb

The script imports the generated mesh, normalizes its scale/orientation, creates
an explicit humanoid armature, applies automatic weights when possible, adds
named animation-control bones, and exports a GLB suitable for Three.js.

This is a deterministic rigging/export stage. It does not invent facial identity
or claim that a single image can mathematically reproduce a real person.
"""
from __future__ import annotations

import os
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[2]
RAW = Path(os.getenv("AVATAR_RAW_GLB", ROOT / "build" / "avatar_raw.glb"))
OUT = Path(os.getenv("AVATAR_OUTPUT_GLB", ROOT / "build" / "neeraj_avatar.glb"))

BONES = {
    "root": (0, 0, 0),
    "pelvis": (0, 0, 1.0),
    "spine": (0, 0, 1.8),
    "chest": (0, 0, 2.6),
    "neck": (0, 0, 3.25),
    "head": (0, 0, 3.65),
    "upper_arm.L": (-0.45, 0, 2.55),
    "lower_arm.L": (-0.95, 0, 2.15),
    "hand.L": (-1.35, 0, 1.85),
    "upper_arm.R": (0.45, 0, 2.55),
    "lower_arm.R": (0.95, 0, 2.15),
    "hand.R": (1.35, 0, 1.85),
    "thigh.L": (-0.32, 0, 0.85),
    "shin.L": (-0.34, 0, 0.05),
    "foot.L": (-0.34, -0.22, -0.1),
    "thigh.R": (0.32, 0, 0.85),
    "shin.R": (0.34, 0, 0.05),
    "foot.R": (0.34, -0.22, -0.1),
    "eye.L": (-0.12, -0.08, 3.68),
    "eye.R": (0.12, -0.08, 3.68),
    "jaw": (0, -0.12, 3.48),
}

PARENT = {
    "pelvis": "root", "spine": "pelvis", "chest": "spine", "neck": "chest", "head": "neck",
    "upper_arm.L": "chest", "lower_arm.L": "upper_arm.L", "hand.L": "lower_arm.L",
    "upper_arm.R": "chest", "lower_arm.R": "upper_arm.R", "hand.R": "lower_arm.R",
    "thigh.L": "pelvis", "shin.L": "thigh.L", "foot.L": "shin.L",
    "thigh.R": "pelvis", "shin.R": "thigh.R", "foot.R": "shin.R",
    "eye.L": "head", "eye.R": "head", "jaw": "head",
}


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def import_mesh():
    if not RAW.exists():
        raise FileNotFoundError(f"Missing {RAW}. Run avatar_reconstruction.py with Hunyuan first.")
    bpy.ops.import_scene.gltf(filepath=str(RAW))
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if not meshes:
        raise RuntimeError("The imported GLB contains no mesh objects")
    # Put all meshes into a predictable collection and normalize the model to a
    # roughly human 3.7 Blender-unit height. Preserve proportions; don't stretch axes.
    bpy.context.view_layer.objects.active = meshes[0]
    for obj in meshes:
        obj.select_set(True)
    min_z = min((obj.matrix_world @ v.co).z for obj in meshes for v in obj.data.vertices)
    max_z = max((obj.matrix_world @ v.co).z for obj in meshes for v in obj.data.vertices)
    height = max(max_z - min_z, 1e-5)
    scale = 3.7 / height
    for obj in meshes:
        obj.scale *= scale
    bpy.ops.object.select_all(action="DESELECT")
    return meshes


def create_armature():
    bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
    arm = bpy.context.object
    arm.name = "Neeraj_Humanoid_Rig"
    arm.data.name = "Neeraj_Humanoid_Rig"
    edit = arm.data.edit_bones
    for bone in list(edit):
        edit.remove(bone)
    for name, head in BONES.items():
        b = edit.new(name)
        b.head = head
        b.tail = (head[0], head[1], head[2] + (0.18 if name.startswith("eye") or name == "jaw" else 0.35))
        if name in PARENT:
            b.parent = edit.get(PARENT[name])
    bpy.ops.object.mode_set(mode="POSE")
    # Animation-facing custom properties are intentionally stable names for the web client.
    for pbone in arm.pose.bones:
        if pbone.name in {"jaw", "eye.L", "eye.R"}:
            pbone["control_role"] = "face"
        elif pbone.name.startswith(("upper_arm", "lower_arm", "hand", "thigh", "shin", "foot")):
            pbone["control_role"] = "gesture"
        else:
            pbone["control_role"] = "body"
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm


def bind(meshes, arm):
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = arm
    for obj in meshes:
        try:
            bpy.context.view_layer.objects.active = arm
            bpy.ops.object.parent_set(type="ARMATURE_AUTO")
        except RuntimeError:
            # Keep the mesh usable even if Blender cannot calculate automatic weights.
            bpy.ops.object.select_all(action="DESELECT")
            arm.select_set(True)
            obj.select_set(True)
            bpy.context.view_layer.objects.active = arm
            bpy.ops.object.parent_set(type="ARMATURE_DEFORM")


def export():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=str(OUT),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_animations=True,
    )


def main():
    clear_scene()
    meshes = import_mesh()
    arm = create_armature()
    bind(meshes, arm)
    export()
    print(f"EXPORTED_GLB={OUT}")


main()
