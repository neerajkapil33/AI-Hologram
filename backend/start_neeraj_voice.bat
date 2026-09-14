@echo off
setlocal
cd /d "%~dp0.."

rem Keep the private voice reference on the local PC. It is NOT committed to Git.
set "NEERAJ_VOICE_REFERENCE=C:\Users\Neeraj\Pictures\AI-Hologram\assets_private\neeraj-voice-reference.wav"

if not exist "%NEERAJ_VOICE_REFERENCE%" (
  echo ERROR: Neeraj voice reference not found:
  echo %NEERAJ_VOICE_REFERENCE%
  pause
  exit /b 1
)

python -m uvicorn backend.chatterbox_server:app --host 127.0.0.1 --port 8000
