import bpy, sys, json, os, math, traceback
from mathutils import Vector, Quaternion

def cli():
    """Return (fbx, report) for command-line mode, or (None, None) for open-scene mode."""
    if "--" not in sys.argv:
        return None, None
    a = sys.argv[sys.argv.index("--")+1:]
    if len(a) < 2:
        raise SystemExit("Missing FBX/report paths")
    return os.path.abspath(a[0]), os.path.abspath(a[1])

def find_open_scene_inputs():
    """Use the already imported FBX scene in Blender."""
    arms = [o for o in bpy.context.scene.objects if o.type == "ARMATURE"]
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if not arms:
        raise RuntimeError("No armature found in the open Blender scene. Import model.fbx first.")
    if not meshes:
        raise RuntimeError("No mesh found in the open Blender scene. Import model.fbx first.")
    return arms, meshes

def default_scene_report_path():
    base = bpy.data.filepath
    if base:
        folder = os.path.dirname(os.path.abspath(base))
    else:
        folder = os.path.expanduser("~/Desktop")
    return os.path.join(folder, "blender-root-cause-report.json")

def norm(s): return s.lower().replace("_","").replace("-","").replace(" ","")

ALIASES = {
 "hips":["hips","pelvis"],
 "spine":["spine","spine1","spine2","spine3"],
 "neck":["neck"],
 "head":["head","skull"],
 "jaw":["jaw","mandible","lowerjaw"],
 "eye_left":["lefteye","leye","eyel"],
 "eye_right":["righteye","reye","eyer"],
 "shoulder_left":["leftshoulder","lshoulder","leftclavicle","lclavicle"],
 "shoulder_right":["rightshoulder","rshoulder","rightclavicle","rclavicle"],
 "upper_arm_left":["leftupperarm","lupperarm","leftarm","larm"],
 "upper_arm_right":["rightupperarm","rupperarm","rightarm","rarm"],
 "forearm_left":["leftforearm","lforearm","leftlowerarm","llowerarm"],
 "forearm_right":["rightforearm","rforearm","rightlowerarm","rlowerarm"],
 "hand_left":["lefthand","lhand"],
 "hand_right":["righthand","rhand"],
 "thigh_left":["leftthigh","lthigh","leftupleg","lupleg"],
 "thigh_right":["rightthigh","rthigh","rightupleg","rupleg"],
 "calf_left":["leftcalf","lcalf","leftleg","lleg"],
 "calf_right":["rightcalf","rcalf","rightleg","rleg"],
 "foot_left":["leftfoot","lfoot","leftankle","lankle"],
 "foot_right":["rightfoot","rfoot","rightankle","rankle"],
}
def classify(name):
    n=norm(name)
    for k, vals in ALIASES.items():
        if any(v in n for v in vals): return k
    return None

def v3(v): return [round(float(x),6) for x in v]

def mesh_state(mesh, depsgraph):
    depsgraph.update()
    obj=mesh.evaluated_get(depsgraph)
    try: me=obj.to_mesh()
    except Exception: return None
    verts=[obj.matrix_world @ v.co for v in me.vertices]
    if not verts:
        obj.to_mesh_clear(); return {"count":0,"mean":0,"max":0}
    # compact geometric signature: centroid + bounding box
    c=sum(verts, Vector())/len(verts)
    mn=Vector((min(v.x for v in verts),min(v.y for v in verts),min(v.z for v in verts)))
    mx=Vector((max(v.x for v in verts),max(v.y for v in verts),max(v.z for v in verts)))
    obj.to_mesh_clear()
    return {"count":len(verts),"centroid":v3(c),"min":v3(mn),"max":v3(mx)}

def deformation_delta(mesh, base, depsgraph):
    depsgraph.update()
    obj=mesh.evaluated_get(depsgraph)
    try: me=obj.to_mesh()
    except Exception: return {"mean":0,"max":0,"changed":False}
    verts=[obj.matrix_world @ v.co for v in me.vertices]
    if len(verts)!=len(base):
        obj.to_mesh_clear(); return {"mean":-1,"max":-1,"changed":True}
    ds=[(v-b).length for v,b in zip(verts,base)]
    obj.to_mesh_clear()
    mean=sum(ds)/len(ds) if ds else 0
    mx=max(ds) if ds else 0
    return {"mean":round(mean,6),"max":round(mx,6),"changed":mx>1e-5}

def main():
    fbx, out = cli()
    if fbx:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.fbx(filepath=fbx, automatic_bone_orientation=False)
        deps=bpy.context.evaluated_depsgraph_get()
        arms=[o for o in bpy.context.scene.objects if o.type=="ARMATURE"]
        meshes=[o for o in bpy.context.scene.objects if o.type=="MESH"]
    else:
        # One-click mode: inspect the FBX that is already open in Blender.
        deps=bpy.context.evaluated_depsgraph_get()
        arms, meshes = find_open_scene_inputs()
        out = default_scene_report_path()
        fbx = bpy.data.filepath or "<currently open/imported FBX scene>"
    report={"source":fbx,"blender":bpy.app.version_string,"summary":{}, "armatures":[], "movement_tests":[], "animation_analysis":[], "facial_analysis":[], "issues":[]}
    report["summary"]={"armatures":len(arms),"meshes":len(meshes),"actions":len(bpy.data.actions)}

    for m in meshes:
        keys=[k.name for k in m.data.shape_keys.key_blocks] if m.data.shape_keys else []
        report["facial_analysis"].append({"mesh":m.name,"shape_keys":keys,
          "mouth_keys":[k for k in keys if any(x in norm(k) for x in ["mouth","viseme","phoneme","lip","jaw","aa","ah","ao","oh","uh"])],
          "blink_keys":[k for k in keys if any(x in norm(k) for x in ["blink","eyelid","eyeclose","closeeye"])],
          "expression_keys":[k for k in keys if any(x in norm(k) for x in ["smile","happy","sad","frown","brow","cheek"]) ]})

    for arm in arms:
        bones=[]
        for b in arm.data.bones:
            ml=b.matrix_local.to_3x3()
            bones.append({"name":b.name,"parent":b.parent.name if b.parent else None,"children":[x.name for x in b.children],
              "length":round(b.length,6),"roll":round(float(b.roll),6),
              "head":v3(b.head_local),"tail":v3(b.tail_local),
              "axes":{"x":v3(ml.col[0].normalized()),"y":v3(ml.col[1].normalized()),"z":v3(ml.col[2].normalized())},
              "group":classify(b.name)})
        report["armatures"].append({"name":arm.name,"bones":bones})
        # required structure
        for group in ALIASES:
            found=[b.name for b in arm.data.bones if classify(b.name)==group]
            if not found:
                report["issues"].append({"severity":"WARN","type":"MISSING_BONE_GROUP","group":group})
        for b in arm.data.bones:
            if b.length < 0.001:
                report["issues"].append({"severity":"WARN","type":"ZERO_LENGTH_BONE","bone":b.name})
        # Automated local-axis movement/deformation test for high-value bones.
        for group in ALIASES:
            candidates=[b for b in arm.data.bones if classify(b.name)==group]
            for b in candidates[:1]:
                pb=arm.pose.bones.get(b.name)
                if not pb: continue
                originals={p.name:(p.rotation_mode,p.rotation_quaternion.copy(),p.rotation_euler.copy(),p.location.copy(),p.scale.copy()) for p in arm.pose.bones}
                base_by_mesh=[]
                for m in meshes:
                    eo=m.evaluated_get(deps); me=eo.to_mesh()
                    base_by_mesh.append([eo.matrix_world @ v.co for v in me.vertices]); eo.to_mesh_clear()
                axis_results=[]
                for ai,avec in enumerate((Vector((1,0,0)),Vector((0,1,0)),Vector((0,0,1)))):
                    # Quaternion rotation is expressed in the bone's local pose basis.
                    pb.rotation_mode='QUATERNION'
                    pb.rotation_quaternion=Quaternion(avec,math.radians(20))
                    deps.update()
                    deltas=[]
                    for mi,m in enumerate(meshes):
                        deltas.append(deformation_delta(m,base_by_mesh[mi],deps))
                    axis_results.append({"axis":"XYZ"[ai],"deltas":deltas})
                    # reset
                    for p,(mode,q,e,loc,sc) in originals.items():
                        x=arm.pose.bones[p]; x.rotation_mode=mode; x.rotation_quaternion=q; x.rotation_euler=e; x.location=loc; x.scale=sc
                    deps.update()
                report["movement_tests"].append({"group":group,"bone":b.name,"local_axis_tests":axis_results})
                # Restore once more
                for p,(mode,q,e,loc,sc) in originals.items():
                    x=arm.pose.bones[p]; x.rotation_mode=mode; x.rotation_quaternion=q; x.rotation_euler=e; x.location=loc; x.scale=sc

    for act in bpy.data.actions:
        targets=[]
        for fc in act.fcurves:
            if 'pose.bones["' in fc.data_path:
                targets.append({"path":fc.data_path,"array_index":fc.array_index,"keys":len(fc.keyframe_points)})
        report["animation_analysis"].append({"action":act.name,"bone_fcurves":targets})
    # Flag animation/procedural overlap against groups AURA currently manipulates.
    proc_groups=set(ALIASES)
    for a in report["animation_analysis"]:
        overlap=[]
        for t in a["bone_fcurves"]:
            p=t["path"].lower()
            for g in proc_groups:
                if any(norm(x) in norm(p) for x in ALIASES[g]):
                    overlap.append({"group":g,"path":t["path"]})
        if overlap: report["issues"].append({"severity":"INFO","type":"ANIMATION_PROCEDURAL_OVERLAP","action":a["action"],"targets":overlap[:100]})

    # Mesh binding checks
    for m in meshes:
        mods=[x for x in m.modifiers if x.type=="ARMATURE"]
        if not mods: report["issues"].append({"severity":"ERROR","type":"MISSING_ARMATURE_MODIFIER","mesh":m.name})
        for mod in mods:
            if not mod.object: report["issues"].append({"severity":"ERROR","type":"ARMATURE_MODIFIER_NO_OBJECT","mesh":m.name})
    report["summary"]["issue_counts"]={s:sum(1 for i in report["issues"] if i.get("severity")==s) for s in ["ERROR","WARN","INFO"]}
    report["summary"]["movement_groups_tested"]=len(report["movement_tests"])
    os.makedirs(os.path.dirname(out),exist_ok=True)
    with open(out,"w",encoding="utf-8") as f: json.dump(report,f,indent=2)
    print("ROOT_CAUSE_DIAGNOSTIC_COMPLETE")
    print(json.dumps(report["summary"],indent=2))

# One-click Blender Console usage:\n# exec(compile(open(r"C:\\path\\to\\blender_root_cause.py", encoding="utf-8").read(), "blender_root_cause.py", "exec"))\n# If Blender already contains the imported FBX, no CLI arguments are required.\n\nif __name__=="__main__":
    try: main()
    except Exception:
        traceback.print_exc()
        raise
