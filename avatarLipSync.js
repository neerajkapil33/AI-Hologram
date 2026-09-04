// avatarLipSync.js
// Loads a rigged .gltf avatar (with morph targets / blendshapes) and drives
// mouth movement in real time based on the amplitude of playing TTS audio.
//
// Usage:
//   import { AvatarLipSync } from './avatarLipSync.js';
//   const avatar = new AvatarLipSync(scene);
//   await avatar.load('/models/avatar.gltf');
//   avatar.playAudioBuffer(audioArrayBuffer); // e.g. from your NVIGI TTS bridge
//   // in your render loop:
//   avatar.update();

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class AvatarLipSync {
  constructor(scene) {
    this.scene = scene;
    this.mesh = null;              // the SkinnedMesh holding morph targets
    this.mouthOpenIndex = -1;      // index into morphTargetInfluences
    this.audioCtx = null;
    this.analyser = null;
    this.dataArray = null;
    this.sourceNode = null;
    this.smoothedLevel = 0;        // for easing mouth movement frame to frame
  }

  // Loads the gltf model. Assumes the .bin and any textures sit alongside
  // the .gltf file (standard export layout) so GLTFLoader resolves them
  // automatically via relative paths.
  async load(gltfPath) {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(gltfPath);
    this.scene.add(gltf.scene);

    // Find the first mesh that actually has morph targets.
    gltf.scene.traverse((child) => {
      if (child.isMesh && child.morphTargetDictionary && !this.mesh) {
        this.mesh = child;
      }
    });

    if (!this.mesh) {
      console.warn('No mesh with morph targets found — lip-sync will be a no-op.');
      return;
    }

    // Try to find a mouth-open-ish morph target by common naming conventions.
    // Ready Player Me / ARKit names: "mouthOpen", "jawOpen", "viseme_aa", etc.
    const dict = this.mesh.morphTargetDictionary;
    const candidates = ['mouthOpen', 'jawOpen', 'viseme_aa', 'MouthOpen'];
    for (const name of candidates) {
      if (name in dict) {
        this.mouthOpenIndex = dict[name];
        break;
      }
    }

    if (this.mouthOpenIndex === -1) {
      console.warn(
        'Could not auto-detect a mouth-open morph target. ' +
        'Available targets:', Object.keys(dict),
        '— set avatar.mouthOpenIndex manually.'
      );
    }
  }

  // Connects to the NVIGI TTS bridge (see nvigi_tts_bridge.cpp) and plays
  // each PCM chunk as it arrives, keeping the mouth in sync in real time.
  connectToNVIGIBridge(url = 'ws://localhost:8787') {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.connect(this.audioCtx.destination);
    }

    this.sampleRate = 22050; // overwritten by the bridge's header message
    this.playhead = 0;       // audioCtx time at which the next chunk should start

    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        // Control message, e.g. {"type":"sampleRate","value":22050}
        const msg = JSON.parse(event.data);
        if (msg.type === 'sampleRate') this.sampleRate = msg.value;
        return;
      }
      this._schedulePCMChunk(event.data);
    };

    ws.onerror = (err) => console.error('NVIGI bridge WebSocket error:', err);
    ws.onclose = () => console.log('NVIGI bridge connection closed.');

    this.ws = ws;
    return ws;
  }

  // Converts one Int16 PCM chunk into an AudioBuffer and schedules it to
  // play immediately after whatever's currently queued, so chunks streamed
  // one at a time still sound continuous.
  _schedulePCMChunk(arrayBuffer) {
    const int16 = new Int16Array(arrayBuffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768; // int16 range -> [-1, 1]
    }

    const buffer = this.audioCtx.createBuffer(1, float32.length, this.sampleRate);
    buffer.copyToChannel(float32, 0);

    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.analyser);

    const now = this.audioCtx.currentTime;
    const startAt = Math.max(now, this.playhead);
    source.start(startAt);
    this.playhead = startAt + buffer.duration;
  }

  // Feed it a raw audio buffer (e.g. a full WAV file) and it will play it
  // while analysing amplitude. Use this for one-shot playback; use
  // connectToNVIGIBridge() for real-time streaming instead.
  async playAudioBuffer(arrayBuffer) {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    }

    const audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer.slice(0));

    if (this.sourceNode) {
      this.sourceNode.stop();
    }

    this.sourceNode = this.audioCtx.createBufferSource();
    this.sourceNode.buffer = audioBuffer;
    this.sourceNode.connect(this.analyser);
    this.analyser.connect(this.audioCtx.destination);
    this.sourceNode.start();
  }

  // Call this every frame from your render loop.
  update() {
    if (!this.mesh || this.mouthOpenIndex === -1 || !this.analyser) return;

    this.analyser.getByteTimeDomainData(this.dataArray);

    // Compute RMS amplitude of the current audio frame (0..1 range roughly).
    let sumSquares = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      const normalized = (this.dataArray[i] - 128) / 128;
      sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / this.dataArray.length);

    // Scale and clamp — tune the multiplier to taste for your voice's volume.
    const targetLevel = Math.min(1, rms * 4);

    // Ease toward the target so the mouth doesn't jitter frame to frame.
    this.smoothedLevel += (targetLevel - this.smoothedLevel) * 0.4;

    this.mesh.morphTargetInfluences[this.mouthOpenIndex] = this.smoothedLevel;
  }
}
