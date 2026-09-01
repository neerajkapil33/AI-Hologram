import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export type AvatarCommand =
  | { type: 'expression'; value: 'neutral' | 'happy' | 'thinking' | 'speaking' }
  | { type: 'viseme'; value: string; amount?: number }
  | { type: 'gesture'; value: 'wave' | 'nod' };

export function AvatarEngine({ apiRef, onStatus }: { apiRef: React.MutableRefObject<{ command: (c: AvatarCommand) => void } | null>; onStatus: (s: string) => void }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020609, 0.055);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 1.7, 6.4);
    camera.lookAt(0, 1.55, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0x8cf7ff, 0x031014, 1.7));
    const key = new THREE.DirectionalLight(0x8ffaff, 3); key.position.set(2, 5, 4); scene.add(key);
    const rim = new THREE.PointLight(0x2beaff, 9, 9); rim.position.set(-2.5, 2.5, -2); scene.add(rim);
    const avatar = new THREE.Group(); scene.add(avatar);
    const clock = new THREE.Clock();
    let mixer: THREE.AnimationMixer | null = null;
    let model: THREE.Object3D | null = null;
    let fallback: THREE.Group | null = null;
    let expression = 'neutral';
    let blinkClock = 0;

    const fallbackAvatar = () => {
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: 0x174654, emissive: 0x063740, emissiveIntensity: 1.3, transparent: true, opacity: 0.9, roughness: 0.5, metalness: 0.2 });
      const glow = new THREE.MeshBasicMaterial({ color: 0x54f7ff, transparent: true, opacity: 0.8 });
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.48, 1.25, 8, 18), mat); torso.position.y = 1.45; g.add(torso);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(.18,.2,.25,16), mat); neck.position.y = 2.2; g.add(neck);
      const head = new THREE.Mesh(new THREE.SphereGeometry(.42,24,18), mat); head.scale.set(.9,1.08,.9); head.position.y = 2.62; g.add(head);
      for (const x of [-.14,.14]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(.045,12,8), glow); eye.position.set(x,2.67,.38); eye.userData.eye=true; g.add(eye); }
      for (const x of [-.62,.62]) { const arm = new THREE.Mesh(new THREE.CapsuleGeometry(.12,.78,6,10), mat); arm.position.set(x,1.55,0); arm.rotation.z=x<0?-.15:.15; arm.userData.arm=true; g.add(arm); }
      for (const x of [-.24,.24]) { const leg = new THREE.Mesh(new THREE.CapsuleGeometry(.16,.95,6,10), mat); leg.position.set(x,.45,0); g.add(leg); }
      return g;
    };
    const viseme = (name: string, amount=.8) => {
      if (!model) return;
      model.traverse((obj) => {
        const mesh = obj as THREE.Mesh & { morphTargetDictionary?: Record<string,number>; morphTargetInfluences?: number[] };
        if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;
        const key = Object.keys(mesh.morphTargetDictionary).find(n => n.toLowerCase()===name.toLowerCase() || n.toLowerCase().includes(name.toLowerCase()));
        if (key) mesh.morphTargetInfluences[mesh.morphTargetDictionary[key]] = THREE.MathUtils.clamp(amount,0,1);
      });
    };
    apiRef.current = { command: (c) => { if(c.type==='expression') expression=c.value; if(c.type==='viseme') viseme(c.value,c.amount); if(c.type==='gesture' && fallback){ if(c.value==='wave') fallback.rotation.y+=.2; if(c.value==='nod') fallback.rotation.x-=.08; } } };
    const load = async () => {
      try {
        const gltf = await new GLTFLoader().loadAsync('/avatar/avatar.glb');
        model=gltf.scene;
        const box=new THREE.Box3().setFromObject(model), size=box.getSize(new THREE.Vector3()), center=box.getCenter(new THREE.Vector3());
        model.position.sub(center); model.position.y+=size.y/2; model.scale.setScalar(3/Math.max(size.y,.001));
        model.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh){m.castShadow=true;m.receiveShadow=true;}}); avatar.add(model);
        if(gltf.animations.length){mixer=new THREE.AnimationMixer(model);const idle=gltf.animations.find(a=>/idle|breath|stand/i.test(a.name))??gltf.animations[0];mixer.clipAction(idle).play();}
        onStatus(`GLB ONLINE • ${gltf.animations.length} ANIMATIONS`);
      } catch { fallback=fallbackAvatar(); avatar.add(fallback); onStatus('DEMO AVATAR • ADD public/avatar/avatar.glb'); }
    };
    void load();
    const resize=()=>{const w=mount.clientWidth||1,h=mount.clientHeight||1;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);};
    resize(); const ro=new ResizeObserver(resize);ro.observe(mount);
    renderer.setAnimationLoop(()=>{const dt=Math.min(clock.getDelta(),.05);mixer?.update(dt);blinkClock+=dt;if(blinkClock>3.4+Math.random()*2.4)blinkClock=0;const blink=blinkClock<.13?Math.sin(blinkClock/.13*Math.PI):0;if(fallback){const t=performance.now()*.001;fallback.position.y=Math.sin(t*1.4)*.04;fallback.rotation.y=Math.sin(t*.35)*.07;fallback.children.filter(c=>c.userData.eye).forEach(e=>e.scale.y=1-blink);fallback.children.filter(c=>c.userData.arm).forEach((a,i)=>a.rotation.z+=Math.sin(t*1.2+i)*.0007);}renderer.render(scene,camera);});
    return ()=>{renderer.setAnimationLoop(null);ro.disconnect();apiRef.current=null;mixer?.stopAllAction();renderer.dispose();if(renderer.domElement.parentElement===mount)mount.removeChild(renderer.domElement);};
  }, [apiRef,onStatus]);
  return <div ref={mountRef} className="avatar-engine" />;
}
