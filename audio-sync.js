/**
 * AUDIO VISUALIZATION & FACIAL VISEME SYNC ENGINE
 * Uses Web Audio API analyzer vectors and the React audio pipeline.
 */

let audioContextInstance = null;
let audioAnalyserNode = null;
let audioSourceNode = null;
let isVoicePlaying = false;

const visualizerCanvas = document.getElementById('volume-spectrum-track');
const canvasContext = visualizerCanvas ? visualizerCanvas.getContext('2d') : null;
let latestSpectrumBytes = new Uint8Array(0);
let latestAmplitude = 0;

function resizeVisualizer() {
    if (!visualizerCanvas || !canvasContext) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, visualizerCanvas.clientWidth);
    const height = Math.max(1, visualizerCanvas.clientHeight);
    const targetWidth = Math.floor(width * ratio);
    const targetHeight = Math.floor(height * ratio);
    if (visualizerCanvas.width !== targetWidth || visualizerCanvas.height !== targetHeight) {
        visualizerCanvas.width = targetWidth;
        visualizerCanvas.height = targetHeight;
    }
    canvasContext.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function renderVolumeSpectrumBars() {
    if (!visualizerCanvas || !canvasContext) return;
    resizeVisualizer();
    const width = visualizerCanvas.clientWidth;
    const height = visualizerCanvas.clientHeight;
    canvasContext.clearRect(0, 0, width, height);

    if (!latestSpectrumBytes.length) {
        canvasContext.strokeStyle = 'rgba(6,182,212,0.16)';
        canvasContext.lineWidth = 1;
        canvasContext.beginPath();
        canvasContext.moveTo(0, height - 1);
        canvasContext.lineTo(width, height - 1);
        canvasContext.stroke();
        requestAnimationFrame(renderVolumeSpectrumBars);
        return;
    }

    const count = Math.min(latestSpectrumBytes.length, 64);
    const gap = 2;
    const barWidth = Math.max(1, (width - gap * (count - 1)) / count);
    const gradient = canvasContext.createLinearGradient(0, height, 0, 0);
    gradient.addColorStop(0, '#0f2042');
    gradient.addColorStop(0.55, '#06b6d4');
    gradient.addColorStop(1, '#00f2fe');
    canvasContext.fillStyle = gradient;

    for (let i = 0; i < count; i += 1) {
        const sourceIndex = Math.floor((i / count) * latestSpectrumBytes.length);
        const magnitude = latestSpectrumBytes[sourceIndex] / 255;
        const barHeight = Math.max(1, magnitude * height * 0.92);
        const x = i * (barWidth + gap);
        canvasContext.fillRect(x, height - barHeight, barWidth, barHeight);
    }

    canvasContext.fillStyle = 'rgba(0,242,254,0.08)';
    canvasContext.fillRect(0, height - Math.max(1, latestAmplitude * 2), width, 1);
    requestAnimationFrame(renderVolumeSpectrumBars);
}

window.addEventListener('resize', resizeVisualizer);
window.addEventListener('neeraj:audio-spectrum', (event) => {
    const detail = event.detail || {};
    if (detail.bytes instanceof Uint8Array) latestSpectrumBytes = detail.bytes;
    latestAmplitude = Number(detail.amplitude || 0);
    if (detail.ended) latestSpectrumBytes = new Uint8Array(0);
});
requestAnimationFrame(renderVolumeSpectrumBars);

function initAudioPipeline() {
    if (audioContextInstance) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
        console.warn('[AUDIO] Web Audio API is not supported in this browser.');
        return;
    }
    audioContextInstance = new AudioContextClass();
    audioAnalyserNode = audioContextInstance.createAnalyser();
    audioAnalyserNode.fftSize = 256;
    audioAnalyserNode.connect(audioContextInstance.destination);
}

async function streamClonedVoice(audioUrl) {
    initAudioPipeline();
    if (!audioContextInstance || !audioAnalyserNode) return;
    if (audioContextInstance.state === 'suspended') await audioContextInstance.resume();
    if (isVoicePlaying && audioSourceNode) {
        try { audioSourceNode.stop(); } catch { /* already stopped */ }
    }
    try {
        const response = await fetch(audioUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContextInstance.decodeAudioData(arrayBuffer);
        audioSourceNode = audioContextInstance.createBufferSource();
        audioSourceNode.buffer = audioBuffer;
        audioSourceNode.connect(audioAnalyserNode);
        audioSourceNode.start(0);
        isVoicePlaying = true;
        updateFacialVisemesFromAudio();
        audioSourceNode.onended = () => {
            isVoicePlaying = false;
            resetAvatarMouthInfluences();
            window.dispatchEvent(new CustomEvent('neeraj:audio-spectrum', { detail: { bytes: new Uint8Array(0), amplitude: 0, ended: true } }));
        };
    } catch (error) {
        console.error('[AUDIO] Failed to decode cloned voice:', error);
        isVoicePlaying = false;
        resetAvatarMouthInfluences();
    }
}

function updateFacialVisemesFromAudio() {
    if (!isVoicePlaying || !audioAnalyserNode) return;
    requestAnimationFrame(updateFacialVisemesFromAudio);
    const dataArray = new Uint8Array(audioAnalyserNode.frequencyBinCount);
    audioAnalyserNode.getByteFrequencyData(dataArray);
    let rawTotalAmplitude = 0;
    for (let i = 0; i < dataArray.length; i += 1) rawTotalAmplitude += dataArray[i];
    const normalizedSpeechIntensity = rawTotalAmplitude / (dataArray.length * 255);
    animateAvatarMouthMesh(normalizedSpeechIntensity);
    window.dispatchEvent(new CustomEvent('neeraj:audio-spectrum', { detail: { bytes: new Uint8Array(dataArray), amplitude: normalizedSpeechIntensity } }));
}

function animateAvatarMouthMesh(intensity) {
    const root = window.NeerajAvatarRoot;
    if (!root || !window.THREE) return;
    const speechMovementFactor = intensity * 2.2;
    root.traverse((childNode) => {
        if (!childNode.isMesh || !childNode.morphTargetInfluences || !childNode.morphTargetDictionary) return;
        const dict = childNode.morphTargetDictionary;
        const openMouthIndex = dict.mouthOpen ?? dict.viseme_O_M ?? dict.mb_lab_mouth_open;
        const jawOpenIndex = dict.jawOpen ?? dict.viseme_Jaw_Drop ?? dict.mb_lab_jaw_v;
        if (openMouthIndex !== undefined) childNode.morphTargetInfluences[openMouthIndex] = window.THREE.MathUtils.lerp(childNode.morphTargetInfluences[openMouthIndex], Math.min(speechMovementFactor, 0.85), 0.25);
        if (jawOpenIndex !== undefined) childNode.morphTargetInfluences[jawOpenIndex] = window.THREE.MathUtils.lerp(childNode.morphTargetInfluences[jawOpenIndex], Math.min(speechMovementFactor * 0.5, 0.45), 0.2);
    });
}

function resetAvatarMouthInfluences() {
    const root = window.NeerajAvatarRoot;
    if (!root) return;
    root.traverse((childNode) => {
        if (!childNode.isMesh || !childNode.morphTargetInfluences || !childNode.morphTargetDictionary) return;
        const dict = childNode.morphTargetDictionary;
        const openMouthIndex = dict.mouthOpen ?? dict.viseme_O_M ?? dict.mb_lab_mouth_open;
        const jawOpenIndex = dict.jawOpen ?? dict.viseme_Jaw_Drop ?? dict.mb_lab_jaw_v;
        if (openMouthIndex !== undefined) childNode.morphTargetInfluences[openMouthIndex] = 0;
        if (jawOpenIndex !== undefined) childNode.morphTargetInfluences[jawOpenIndex] = 0;
    });
}

window.NeerajAudioSync = {
    initAudioPipeline,
    streamClonedVoice,
    animateAvatarMouthMesh,
    resetAvatarMouthInfluences,
};
