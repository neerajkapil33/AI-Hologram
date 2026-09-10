/**
 * AUDIO VISUALIZATION & FACIAL VISEME SYNC ENGINE
 * Uses Web Audio API Analyzer vectors to drive Three.js morph target influences.
 *
 * NOTE: The React/Three.js application currently owns the avatar instance,
 * so this standalone engine is provided as a reusable integration module.
 */

let audioContextInstance = null;
let audioAnalyserNode = null;
let audioSourceNode = null;
let isVoicePlaying = false;

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

    console.log('[AUDIO] Web Audio API pipeline successfully instantiated.');
}

async function streamClonedVoice(audioUrl) {
    initAudioPipeline();
    if (!audioContextInstance || !audioAnalyserNode) return;

    if (audioContextInstance.state === 'suspended') {
        await audioContextInstance.resume();
    }

    if (isVoicePlaying && audioSourceNode) {
        try { audioSourceNode.stop(); } catch { /* source may already be stopped */ }
    }

    try {
        console.log(`[AUDIO] Fetching cloned voice vector stream: ${audioUrl}`);
        const response = await fetch(audioUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContextInstance.decodeAudioData(arrayBuffer);

        audioSourceNode = audioContextInstance.createBufferSource();
        audioSourceNode.buffer = audioBuffer;
        audioSourceNode.connect(audioAnalyserNode);
        audioSourceNode.start(0);
        isVoicePlaying = true;

        console.log('[AUDIO] Playback tracking sequence engaged.');
        updateFacialVisemesFromAudio();

        audioSourceNode.onended = () => {
            isVoicePlaying = false;
            console.log('[AUDIO] Playback sequence closed. Resetting avatar facial track states.');
            resetAvatarMouthInfluences();
        };
    } catch (error) {
        console.error('[ERROR] Failed to compile voice buffer data array:', error);
        isVoicePlaying = false;
        resetAvatarMouthInfluences();
    }
}

function updateFacialVisemesFromAudio() {
    if (!isVoicePlaying || !audioAnalyserNode) return;

    requestAnimationFrame(updateFacialVisemesFromAudio);

    const bufferLength = audioAnalyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    audioAnalyserNode.getByteFrequencyData(dataArray);

    let rawTotalAmplitude = 0;
    for (let i = 0; i < bufferLength; i++) {
        rawTotalAmplitude += dataArray[i];
    }

    const normalizedSpeechIntensity = rawTotalAmplitude / (bufferLength * 255);
    animateAvatarMouthMesh(normalizedSpeechIntensity);
}

function animateAvatarMouthMesh(intensity) {
    if (typeof activeCharacterMesh === 'undefined' || !activeCharacterMesh) return;

    const speechMovementFactor = intensity * 2.2;

    activeCharacterMesh.traverse((childNode) => {
        if (!childNode.isMesh || !childNode.morphTargetInfluences || !childNode.morphTargetDictionary) return;

        const openMouthIndex = childNode.morphTargetDictionary.mouthOpen ?? childNode.morphTargetDictionary.viseme_O_M;
        const jawOpenIndex = childNode.morphTargetDictionary.jawOpen ?? childNode.morphTargetDictionary.viseme_Jaw_Drop;

        if (openMouthIndex !== undefined) {
            childNode.morphTargetInfluences[openMouthIndex] = THREE.MathUtils.lerp(
                childNode.morphTargetInfluences[openMouthIndex],
                Math.min(speechMovementFactor, 0.85),
                0.25
            );
        }

        if (jawOpenIndex !== undefined) {
            childNode.morphTargetInfluences[jawOpenIndex] = THREE.MathUtils.lerp(
                childNode.morphTargetInfluences[jawOpenIndex],
                Math.min(speechMovementFactor * 0.5, 0.45),
                0.2
            );
        }
    });
}

function resetAvatarMouthInfluences() {
    if (typeof activeCharacterMesh === 'undefined' || !activeCharacterMesh) return;

    activeCharacterMesh.traverse((childNode) => {
        if (!childNode.isMesh || !childNode.morphTargetInfluences || !childNode.morphTargetDictionary) return;

        const openMouthIndex = childNode.morphTargetDictionary.mouthOpen ?? childNode.morphTargetDictionary.viseme_O_M;
        const jawOpenIndex = childNode.morphTargetDictionary.jawOpen ?? childNode.morphTargetDictionary.viseme_Jaw_Drop;

        if (openMouthIndex !== undefined) childNode.morphTargetInfluences[openMouthIndex] = 0;
        if (jawOpenIndex !== undefined) childNode.morphTargetInfluences[jawOpenIndex] = 0;
    });
}

// Expose the engine for integration with the React avatar runtime without
// requiring a hard-coded ACTIVATE CHARACTER button in index.html.
window.NeerajAudioSync = {
    initAudioPipeline,
    streamClonedVoice,
    animateAvatarMouthMesh,
    resetAvatarMouthInfluences,
};
