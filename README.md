# NEERAJ AI — Human Hologram

AURA / NEERAJ AI is a React + Vite + Three.js browser application with a single production full-body FBX avatar.

## Production avatar architecture

The production 3D avatar is:

- **Asset:** `public/avatar/model.fbx`
- **Loader:** Three.js `FBXLoader`
- **Runtime controller:** `src/AvatarEngine.tsx`
- **Backend performance layer:** `backend/performance.py`
- **Conversation backend:** `backend/main.py`
- **Voice adapter:** `backend/tts.py`
- **Optional voice conversion:** `backend/rvc.py`
- **Optional live video mode:** Tavus CVI through `backend/tavus.py`

The browser owns the FBX presentation: facial morphs, eyes, lip-sync, gestures, body motion and the render loop. The backend sends semantic performance metadata and audio; it does not render or replace the FBX avatar.

Three.js officially supports FBX loading and FBX animation clips through `FBXLoader` and its animation system. 

## Runtime flow

```
User text / microphone
        ↓
backend/main.py
        ↓
Brain + PerformanceDirector
        ↓
TTS audio + performance metadata
        ↓
React / useHologramBrain
        ↓
src/AvatarEngine.tsx
        ↓
public/avatar/model.fbx
```

## Optional modes

### Tavus live call
Tavus is an optional high-fidelity video-call mode. It is not the 3D FBX renderer. When configured, the UI can open the returned Tavus conversation inside the live-call stage.

### RVC
RVC is an optional external/local post-processing service consumed by `backend/rvc.py`. No RVC server implementation is included in this repository.

## Development

Install with npm:

```bash
npm install
npm run dev
npm run build
npm run check
```

Windows backend startup is provided by `start_windows.ps1`.

## Repository rule

There is one production avatar runtime and one production FBX asset path. Legacy GLB/glTF, MuseTalk and duplicate avatar-controller paths should not be reintroduced into the production pipeline.
