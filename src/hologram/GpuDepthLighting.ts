import tgpu, { d } from 'typegpu';

/** Shared TypeGPU light frame copied from gpu-depth-lighting and adapted to the hologram renderer. */
export const LightFrame = d.struct({
  position: d.vec3f,
  intensity: d.f32,
  ambient: d.f32,
  relief: d.f32,
  shadow: d.f32,
  occlusion: d.f32,
  color: d.vec3f,
  active: d.f32,
});

export const LIGHT_Z_MIN = 0.1;
export const LIGHT_Z_MAX = 1.25;
export const LIGHT_ORBIT_SPEED = 0.00024;
export const LIGHT_ORBIT_RADIUS = 0.26;

export function physicalFalloff(distance: number, radius: number): number {
  const d = Math.max(0.02, distance);
  return Math.min(8, (radius * radius) / (d * d));
}

export function smoothShadow(blocked: number, softness: number): number {
  const s = Math.max(0.001, softness);
  return 1 - Math.min(1, Math.max(0, blocked / s));
}

export function warmLight(): [number, number, number] {
  return [1.0, 0.88, 0.68];
}

/** Keeps TypeGPU attached to the same GPUDevice for a future WebGPU renderer. */
export function initTypeGPULighting(device: GPUDevice) {
  const root = tgpu.initFromDevice({ device });
  if (root.device !== device) throw new Error('TypeGPU must use the existing GPUDevice.');
  return root;
}

export function createTypeGPUDepthTexture(device: GPUDevice, size = 448) {
  return device.createTexture({
    size: [size, size, 1],
    format: 'r32float',
    usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC,
    label: `TypeGPU ${size}x${size} monocular depth`,
  });
}

export function orbitLight(timeMs: number): [number, number] {
  const phase = timeMs * LIGHT_ORBIT_SPEED;
  return [
    0.5 + Math.cos(phase) * LIGHT_ORBIT_RADIUS,
    0.44 + Math.sin(phase * 1.37) * LIGHT_ORBIT_RADIUS * 0.8,
  ];
}
