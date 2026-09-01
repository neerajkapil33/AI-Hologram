import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export type AvatarCommand =
  | { type: 'expression'; value: 'neutral' | 'happy' | 'thinking' | 'speaking' }
  | { type: 'viseme'; value: string; amount?: number }
  | { type: 'gesture'; value: 'wave' | 'nod' | 'idle' };

type FaceMesh = THREE.Mesh & { morphTargetDictionary?: Record<string, number>; morphTargetInfluences?: number[] };

export function AvatarEngine({ apiRef, onStatus }: { apiRef: React.MutableRefObject<{ command: (c: AvatarCommand) => void } | null>; onStatus: (s: string) => void }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020609, 0.045);
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    camera.position.set(0, 1.7, 6.2);
    camera.lookAt(0, 1.55, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0x9bf8ff, 0x031014, 1.8));
    const key = new THREE.DirectionalLight(0xc8ffff, 3.2); key.position.set(2, 5, 4); key.castShadow = true; scene.add(key);
    const rim = new THREE.PointLight(0x2beaff, 10, 10); rim.position.set(-2.5, 2.5, -2); scene.add(rim);
    const avatar = new THREE.Group(); scene.add(avatar);
    const clock = new THREE.Clock();
    let mixer: THREE.AnimationMixer | null = null;
    let model: THREE.Object3D | null = null;
    let fallback: THREE.Group | null = null;
    let expression = 'neutral';
    let speaking = false;
    let gesture = 'idle';
    let blinkClock = 1.2;
    let blinkPhase = 0;

    const fallbackAvatar = () => {
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: 0x174654, emissive: 0x063740, emissiveIntensity: 1.35, transparent: true, opacity: 0.91, roughness: 0.5, metalness: 0.18 });
      const skin = new THREE.MeshStandardMaterial({ color: 0x4e7780, emissive: 0x062a31, emissiveIntensity: 0.8, transparent: true, opacity: 0.95 });
      const glow = new THREE.MeshBasicMaterial({ color: 0x54f7ff, transparent: true, opacity: 0.9 });
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.57, 1.0, 8, 18), mat); torso.position.y = 1.55; torso.userData.part = 'body'; g.add(torso);
      const pelvis = new THREE.Mesh(new THREE.CapsuleGeometry(.48, .38, 8, 16), mat); pelvis.position.y = .85; pelvis.userData.part = 'body'; g.add(pelvis);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(.18,.2,.27,16), skin); neck.position.y = 2.2; g.add(neck);
      const head = new THREE.Mesh(new THREE.SphereGeometry(.44,32,24), skin); head.scale.set(.92,1.08,.9); head.position.y = 2.63; head.userData.part = 'head'; g.add(head);
      for (const x of [-.15,.15]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(.047,14,10), glow); eye.position.set(x,2.69,.39); eye.userData.part='eye'; g.add(eye); }
      const mouth = new THREE.Mesh(new THREE.BoxGeometry(.18,.025,.025), glow); mouth.position.set(0,2.48,.405); mouth.userData.part='mouth'; g.add(mouth);
      for (const x of [-.66,.66]) { const shoulder = new THREE.Mesh(new THREE.SphereGeometry(.16,14,10),mat); shoulder.position.set(x,1.92,0); shoulder.userData.part=x<0?'leftShoulder':'rightShoulder'; g.add(shoulder); const arm=new THREE.Mesh(new THREE.CapsuleGeometry(.13,.75,7,12),mat); arm.position.set(x*1.02,1.48,0); arm.rotation.z=x<0?-.12:.12; arm.userData.part=x<0?'leftArm':'rightArm'; g.add(arm); const hand=new THREE.Mesh(new THREE.SphereGeometry(.14,12,10),skin); hand.position.set(x*1.08,1.02,0); hand.userData.part=x<0?'leftHand':'rightHand'; g.add(hand); }
      for (const x of [-.25,.25]) { const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.17,1.05,7,12),mat); leg.position.set(x,.25,0); leg.userData.part=x<0?'leftLeg':'rightLeg'; g.add(leg); }
      return g;
    };

    const morph = (name: string, amount: number) => {
      if (!model) return;
      model.traverse((obj) => { const mesh = obj as FaceMesh; if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return; const key = Object.keys(mesh.morphTargetDictionary).find(n => n.toLowerCase().includes(name.toLowerCase())); if (key) mesh.morphTargetInfluences[mesh.morphTargetDictionary[key]] = THREE.MathUtils.clamp(amount,0,1); });
    };
    const blink = (amount: number) => { morph('blink',amount); morph('eyelid',amount); morph('eyeclose',amount); };
    const setExpression = (value: 'neutral'|'happy'|'thinking'|'speaking') => { expression=value; speaking=value==='speaking'; if(value==='happy'){morph('smile',.72);morph('mouthSmile',.72);} else {morph('smile',0);morph('mouthSmile',0);} if(value==='thinking')morph('brow',.35); else morph('brow',0); };

    apiRef.current = { command: (c) => { if(c.type==='expression') setExpression(c.value); if(c.type==='viseme') morph(c.value,c.amount??.8); if(c.type==='gesture') gesture=c.value; } };

    const load = async () => {
      try {
        const gltf = await new GLTFLoader().loadAsync('/avatar/avatar.glb');
        model=gltf.scene;
        const box=new THREE.Box3().setFromObject(model), size=box.getSize(new THREE.Vector3()), center=box.getCenter(new THREE.Vector3());
        model.position.sub(center); model.position.y+=size.y/2; model.scale.setScalar(3/Math.max(size.y,.001));
        model.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh){m.castShadow=true;m.receiveShadow=true;}}); avatar.add(model);
        if(gltf.animations.length){mixer=new THREE.AnimationMixer(model);const idle=gltf.animations.find(a=>/idle|breath|stand/i.test(a.name))??gltf.animations[0];mixer.clipAction(idle).play();}
        onStatus(`REAL AVATAR ONLINE • ${gltf.animations.length} BODY ANIMATIONS`);
      } catch { fallback=fallbackAvatar(); avatar.add(fallback); onStatus('AVATAR TEST MODE • REAL GLB REQUIRED'); }
    };
    void load();

    const resize=()=>{const w=mount.clientWidth||1,h=mount.clientHeight||1;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);}; resize(); const ro=new ResizeObserver(resize); ro.observe(mount);
    renderer.setAnimationLoop(()=>{const dt=Math.min(clock.getDelta(),.05); mixer?.update(dt); blinkClock+=dt; if(blinkClock>3.5+Math.random()*2.5){blinkClock=0;blinkPhase=1;} if(blinkPhase>0){blinkPhase-=dt/.16;const amount=Math.sin(Math.PI*(1-Math.max(blinkPhase,0)));blink(amount);if(blinkPhase<=0)blink(0);} if(fallback){const t=performance.now()*.001;fallback.position.y=Math.sin(t*1.35)*.035;fallback.rotation.y=THREE.MathUtils.lerp(fallback.rotation.y,Math.sin(t*.35)*.055,.025);fallback.traverse(o=>{const p=o.userData.part as string|undefined;if(p==='mouth')o.scale.x=speaking?1.2+Math.abs(Math.sin(t*11))*1.8:1;if(p==='rightArm')o.rotation.z=.12+(gesture==='wave'?Math.sin(t*7)*.55:Math.sin(t*1.2)*.02);if(p==='leftArm')o.rotation.z=-.12+(expression==='thinking'?Math.sin(t*1.5)*.12:0);if(p==='head')o.rotation.z=expression==='thinking'?Math.sin(t*1.5)*.035:Math.sin(t*.7)*.012;});if(gesture!=='idle'&&Math.abs(Math.sin(t*1.5))<.03)gesture='idle';} renderer.render(scene,camera);});
    return ()=>{renderer.setAnimationLoop(null);ro.disconnect();apiRef.current=null;mixer?.stopAllAction();renderer.dispose();if(renderer.domElement.parentElement===mount)mount.removeChild(renderer.domElement);};
  }, [apiRef,onStatus]);
  return <div ref={mountRef} className="avatar-engine" />;
}
