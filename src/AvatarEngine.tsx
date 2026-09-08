import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export type AvatarCommand =
  | { type: 'expression'; value: string }
  | { type: 'viseme'; value: string; weight?: number }
  | { type: 'gesture'; value: string }
  | { type: 'performance'; value: any };

type AvatarApi = { command: (cmd: AvatarCommand) => void };
type Props = { onStatus?: (s: string) => void; onApi?: (api: AvatarApi) => void };

const STANDING_IMAGE = '/avatar/neeraj-stage.jpg';
const STAGE_CENTER_X = -0.60;
const PRESENTATION_Y = 1.67;
const PRESENTATION_HEIGHT = 2.25;
const PRESENTATION_WIDTH = 1.42;

function placeholderTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 768;
  const x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, 0, 768);
  g.addColorStop(0, '#151c25'); g.addColorStop(1, '#05080d');
  x.fillStyle = g; x.fillRect(0, 0, 512, 768);
  x.strokeStyle = 'rgba(170,225,235,.25)'; x.strokeRect(24, 24, 464, 720);
  x.textAlign = 'center'; x.fillStyle = 'rgba(220,240,245,.78)'; x.font = '600 20px Arial';
  x.fillText('STANDING IMAGE', 256, 372); x.font = '14px Arial'; x.fillStyle = 'rgba(190,215,225,.6)';
  x.fillText('Add /avatar/neeraj-stage.jpg', 256, 402);
  return new THREE.CanvasTexture(c);
}

export default function AvatarEngine({ onStatus, onApi }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current; if (!mount) return;
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x03070c, 0.06);
    const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 100);
    camera.position.set(0, 1.35, 4.8);
    camera.lookAt(0, 1.15, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x02050a, 0);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xc8d5df, 0x080b10, 1.25));
    const key = new THREE.DirectionalLight(0xffffff, 1.7); key.position.set(1.8, 3.2, 3.5); scene.add(key);
    const rim = new THREE.DirectionalLight(0x9bb7c7, 0.45); rim.position.set(-2, 2.5, -2); scene.add(rim);

    const stage = new THREE.Group(); scene.add(stage);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1.12, 96), new THREE.MeshStandardMaterial({ color: 0x071019, metalness: 0.35, roughness: 0.5 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = 0.01; stage.add(floor);

    const floorRing = new THREE.Mesh(new THREE.RingGeometry(0.78, 0.795, 128), new THREE.MeshBasicMaterial({ color: 0x8bd6e4, transparent: true, opacity: 0.45, side: THREE.DoubleSide }));
    floorRing.rotation.x = -Math.PI / 2; floorRing.position.y = 0.025; stage.add(floorRing);

    const stageRing = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.008, 8, 128), new THREE.MeshBasicMaterial({ color: 0xa5e0e8, transparent: true, opacity: 0.34, side: THREE.DoubleSide }));
    stageRing.rotation.x = Math.PI / 2; stageRing.position.y = 0.04; stage.add(stageRing);

    const particleCount = 80, positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const a = Math.random() * Math.PI * 2, r = 0.8 + Math.random() * 0.55;
      positions[i * 3] = Math.cos(a) * r; positions[i * 3 + 1] = 0.08 + Math.random() * 2.45; positions[i * 3 + 2] = Math.sin(a) * r;
    }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xc5e8ee, size: 0.008, transparent: true, opacity: 0.28, depthWrite: false }));
    stage.add(particles);

    const presentation = new THREE.Group();
    presentation.position.set(STAGE_CENTER_X, PRESENTATION_Y, 0);
    stage.add(presentation);

    const placeholder = placeholderTexture();
    const imageMat = new THREE.MeshBasicMaterial({ map: placeholder, transparent: true, opacity: 0.98, depthWrite: false, side: THREE.DoubleSide });
    const depthMat = new THREE.MeshBasicMaterial({ map: placeholder, transparent: true, opacity: 0.09, color: 0xa9dfe7, depthWrite: false, side: THREE.DoubleSide });
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0xa9e6ed, transparent: true, opacity: 0.04, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide });

    const image = new THREE.Mesh(new THREE.PlaneGeometry(PRESENTATION_WIDTH, PRESENTATION_HEIGHT), imageMat); image.position.z = 0.02; presentation.add(image);
    const depth = new THREE.Mesh(new THREE.PlaneGeometry(PRESENTATION_WIDTH + 0.03, PRESENTATION_HEIGHT + 0.03), depthMat); depth.position.z = -0.045; presentation.add(depth);
    const edge = new THREE.Mesh(new THREE.PlaneGeometry(PRESENTATION_WIDTH + 0.05, PRESENTATION_HEIGHT + 0.05), edgeMat); edge.position.z = -0.06; presentation.add(edge);

    new THREE.TextureLoader().load(STANDING_IMAGE, texture => {
      texture.colorSpace = THREE.SRGBColorSpace;
      imageMat.map = texture; imageMat.needsUpdate = true;
      depthMat.map = texture; depthMat.needsUpdate = true;
      onStatus?.('STEP 1 • FULL-LENGTH STANDING HUMAN HOLOGRAM READY');
    }, undefined, () => onStatus?.('STEP 1 • IMAGE LOAD ERROR'));

    let autoRotate = true, targetRotation = 0, speaking = false, intensity = 0.25;
    const clock = new THREE.Clock();
    const command = (cmd: AvatarCommand) => {
      if (cmd.type === 'performance') { intensity = Math.max(0, Math.min(1, Number(cmd.value?.intensity ?? intensity))); if (typeof cmd.value?.speaking === 'boolean') speaking = cmd.value.speaking; }
      if (cmd.type === 'gesture') {
        const v = cmd.value.toLowerCase();
        if (v.includes('left')) targetRotation = -0.20;
        else if (v.includes('right')) targetRotation = 0.20;
        else if (v.includes('front') || v.includes('camera') || v.includes('idle')) targetRotation = 0;
      }
      if (cmd.type === 'expression' && cmd.value.toLowerCase() === 'auto-rotate') autoRotate = !autoRotate;
    };
    onApi?.({ command });

    const resize = () => {
      const w = mount.clientWidth || 640, h = mount.clientHeight || 640;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();

    renderer.setAnimationLoop(() => {
      const dt = Math.min(clock.getDelta(), 0.05), t = performance.now() / 1000;
      if (autoRotate) targetRotation = Math.sin(t * 0.34) * 0.20;
      presentation.rotation.y = THREE.MathUtils.lerp(presentation.rotation.y, targetRotation, 0.035);
      presentation.position.x = STAGE_CENTER_X + Math.sin(t * 0.72) * 0.004;
      presentation.position.y = PRESENTATION_Y + Math.sin(t * 1.1) * (0.006 + intensity * 0.008);
      presentation.scale.setScalar(1 + Math.sin(t * 1.5) * 0.002 + (speaking ? 0.003 : 0));
      floorRing.rotation.z += dt * 0.08; stageRing.rotation.z -= dt * 0.045; particles.rotation.y += dt * 0.025;
      (floorRing.material as THREE.MeshBasicMaterial).opacity = 0.38 + intensity * 0.10;
      (stageRing.material as THREE.MeshBasicMaterial).opacity = 0.28 + intensity * 0.08;
      (edge.material as THREE.MeshBasicMaterial).opacity = 0.035 + intensity * 0.02;
      resize(); renderer.render(scene, camera);
    });

    return () => { renderer.setAnimationLoop(null); renderer.dispose(); placeholder.dispose(); if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement); };
  }, [onApi, onStatus]);

  return <div ref={mountRef} style={{ width: '100%', height: '100%', minHeight: 0, position: 'relative', overflow: 'hidden' }} />;
}
