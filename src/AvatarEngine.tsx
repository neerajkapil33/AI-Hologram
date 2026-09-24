import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

export type AvatarCommand =
  | { type: 'expression'; value: string }
  | { type: 'viseme'; value: string; weight?: number }
  | { type: 'gesture'; value: string }
  | { type: 'performance'; value: any };

type Props = {
  onStatus?: (status: string) => void;
  onApi?: (api: { command: (cmd: AvatarCommand) => void }) => void;
};

const SRC = `${import.meta.env.BASE_URL}avatar/model.fbx`;

/**
 * AURA Avatar — clean FBX baseline.
 *
 * IMPORTANT:
 * - The FBX is loaded and displayed exactly as authored.
 * - No bones are rotated.
 * - No IK, procedural body motion, locomotion, gesture, breathing,
 *   sitting, jumping, walking, running, arm, leg, hand or wrist controller.
 * - No root rotation or root translation is applied.
 * - Commands are intentionally no-ops for now.
 *
 * This is the clean baseline from which body movement will be rebuilt
 * one anatomical system at a time.
 */
export default function AvatarEngine({ onStatus, onApi }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef(onStatus);
  const onApiRef = useRef(onApi);

  useEffect(() => {
    statusRef.current = onStatus;
    onApiRef.current = onApi;
  }, [onApi, onStatus]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    mount.style.cssText =
      'position:relative;width:100%;height:100%;min-height:560px;overflow:hidden';

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 1000);
    camera.position.set(0, 1.0, 3.0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setClearColor(0, 0);

    renderer.domElement.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;display:block;z-index:2;pointer-events:none';

    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xd9f5ff, 0x10141b, 2.8));

    const key = new THREE.DirectionalLight(0xffffff, 3.4);
    key.position.set(3, 6, 5);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0x9beeff, 1.8);
    fill.position.set(-4, 3, 4);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 1.6);
    rim.position.set(0, 5, -5);
    scene.add(rim);

    // The model is attached directly to this scene group. The group itself
    // is never translated or rotated after the FBX has been loaded.
    const modelContainer = new THREE.Group();
    scene.add(modelContainer);

    const loader = new FBXLoader();
    let model: THREE.Object3D | null = null;
    let animationFrame = 0;
    let disposed = false;

    const resize = () => {
      const width = Math.max(mount.clientWidth, 1);
      const height = Math.max(mount.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    const fitCameraToModel = (object: THREE.Object3D) => {
      object.updateMatrixWorld(true);

      const box = new THREE.Box3().setFromObject(object);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      const height = Math.max(size.y, 0.001);
      const radius = Math.max(size.x, size.y, size.z, 0.001);

      // Only the camera is adjusted for presentation. The FBX transforms
      // themselves are left untouched.
      camera.position.set(
        center.x,
        center.y + height * 0.02,
        center.z + radius * 2.35,
      );
      camera.lookAt(center.x, center.y + height * 0.48, center.z);

      camera.near = Math.max(0.01, radius * 0.001);
      camera.far = Math.max(100, radius * 20);
      camera.updateProjectionMatrix();
    };

    statusRef.current?.('Loading original FBX...');

    loader.load(
      SRC,
      (loaded) => {
        if (disposed) return;

        model = loaded;

        // Do NOT normalize scale, rotate bones, reset poses, solve IK,
        // modify morphs, or otherwise alter the FBX. It is rendered as loaded.
        modelContainer.add(model);
        fitCameraToModel(model);

        statusRef.current?.('Original FBX loaded — body motion reset');
      },
      undefined,
      (error) => {
        console.error('AURA FBX load error:', error);
        statusRef.current?.('Unable to load original FBX');
      },
    );

    const command = (_cmd: AvatarCommand) => {
      // Intentionally empty. Movement is being rebuilt from this untouched
      // FBX baseline in subsequent steps.
    };

    const api = { command };
    onApiRef.current?.(api);

    const render = () => {
      if (disposed) return;
      animationFrame = window.requestAnimationFrame(render);
      renderer.render(scene, camera);
    };

    render();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();

      if (model) {
        modelContainer.remove(model);
        model.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          object.geometry.dispose();
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          materials.forEach((material) => material.dispose());
        });
      }

      renderer.dispose();

      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }

      onApiRef.current?.({ command: () => undefined });
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 560,
        overflow: 'hidden',
      }}
    />
  );
}
