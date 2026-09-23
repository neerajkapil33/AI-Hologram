import bpy, sys, json, math, os
from mathutils import Vector

def args():
    if "--" not in sys.argv:
        raise SystemExit("Expected: blender -b --python tools/rig_diagnostic.py -- <fbx> <report>")
    a = sys.argv[sys.argv.index("--")+1:]
    if len(a) < 2:
        raise SystemExit("Missing FBX/report paths")
    return a[0], a[1]

def classify(name):
    n = name.lower().replace("_","").replace("-","")
    groups = {
        "head": ["head","skull"],
        "neck": ["neck"],
        "jaw": ["jaw","mandible","lowerjaw"],
        "eye_left": ["leye","lefteye","eyel"],
        "eye_right": ["reye","righteye","eyer"],
        "shoulder_left": ["lshoulder","leftshoulder","lclavicle","leftclavicle"],
        "shoulder_right": ["rshoulder","rightshoulder","rclavicle","rightclavicle"],
        "upper_arm_left": ["lupperarm","leftupperarm","larm","leftarm"],
        "upper_arm_right": ["rupperarm","rightupperarm","rarm","rightarm"],
        "forearm_left": ["lforearm","leftforearm","llowerarm","leftlowerarm"],
        "forearm_right": ["rforearm","rightforearm","rlowerarm","rightlowerarm"],
        "hand_left": ["lhand","lefthand"],
        "hand_right": ["rhand","righthand"],
        "thigh_left": ["lthigh","leftthigh","lupleg","leftupleg"],
        "thigh_right": ["rthigh","rightthigh","rupleg","rightupleg"],
        "calf_left": ["lcalf","leftcalf","lleg","leftleg"],
        "calf_right": ["rcalf","rightcalf","rleg","rightleg"],
        "foot_left": ["lfoot","leftfoot","lankle","leftankle"],
        "foot_right": ["rfoot","rightfoot","rankle","rightankle"],
        "hips": ["hips","pelvis"],
        "spine": ["spine","spine1","spine2","spine3"],
    }
    for k, vals in groups.items():
        if any(v in n for v in vals):
            return k
    return None

def axis(v):
    return [round(float(x),6) for x in v]

def main():
    fbx, out = args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=os.path.abspath(fbx), automatic_bone_orientation=False)
    scene=bpy.context.scene
    arms=[o for o in scene.objects if o.type=="ARMATURE"]
    meshes=[o for o in scene.objects if o.type=="MESH"]
    report={"fbx":os.path.basename(fbx),"armatures":[],"meshes":[],"actions":[],"diagnostics":[]}
    for m in meshes:
        report["meshes"].append({
            "name":m.name,"vertices":len(m.data.vertices),
            "shape_keys":[k.name for k in m.data.shape_keys.key_blocks] if m.data.shape_keys else [],
            "armature_modifiers":[x.object.name for x in m.modifiers if x.type=="ARMATURE" and x.object]
        })
    for arm in arms:
        bones=[]
        for b in arm.data.bones:
            ml=b.matrix_local.to_3x3()
            bones.append({
                "name":b.name,"parent":b.parent.name if b.parent else None,
                "children":[c.name for c in b.children],"length":round(b.length,6),
                "head":axis(b.head_local),"tail":axis(b.tail_local),
                "local_x":axis(ml.col[0]),"local_y":axis(ml.col[1]),"local_z":axis(ml.col[2]),
                "roll":round(float(b.roll),6),"classification":classify(b.name)
            })
        report["armatures"].append({"name":arm.name,"bone_count":len(bones),"bones":bones})
    for act in bpy.data.actions:
        curves=[]
        for fc in act.fcurves:
            curves.append({"data_path":fc.data_path,"array_index":fc.array_index,"keyframes":len(fc.keyframe_points)})
        report["actions"].append({"name":act.name,"fcurves":curves})
    if not arms:
        report["diagnostics"].append({"severity":"ERROR","issue":"No armature found"})
    for arm in arms:
        names=[b.name.lower() for b in arm.data.bones]
        critical=["head","neck","jaw","hips","spine"]
        for c in critical:
            if not any(c in n for n in names):
                report["diagnostics"].append({"severity":"WARN","issue":f"Likely {c} bone not found by name"})
        for b in arm.data.bones:
            if b.length < 0.001:
                report["diagnostics"].append({"severity":"WARN","issue":"Near-zero bone","bone":b.name})
            s=b.matrix_local.to_3x3()
            # orthogonality check
            for i,j in [(0,1),(0,2),(1,2)]:
                if abs(s.col[i].normalized().dot(s.col[j].normalized())) > 0.05:
                    report["diagnostics"].append({"severity":"WARN","issue":"Non-orthogonal local axes","bone":b.name})
                    break
    # Explicit movement-risk report based on actual rig structure
    target_groups=["neck","head","jaw","eye_left","eye_right","upper_arm_left","upper_arm_right","forearm_left","forearm_right","hand_left","hand_right","thigh_left","thigh_right","calf_left","calf_right","foot_left","foot_right"]
    for g in target_groups:
        found=[]
        for arm in arms:
            for b in arm.data.bones:
                if classify(b.name)==g: found.append(b.name)
        report["diagnostics"].append({"severity":"INFO","movement_group":g,"bones":found,"status":"FOUND" if found else "MISSING"})
    os.makedirs(os.path.dirname(os.path.abspath(out)),exist_ok=True)
    with open(out,"w",encoding="utf-8") as fp: json.dump(report,fp,indent=2)
    print("RIG_DIAGNOSTIC_COMPLETE",out)
    print("ARMATURES",len(arms),"MESHES",len(meshes),"ACTIONS",len(bpy.data.actions))

if __name__=="__main__":
    main()
