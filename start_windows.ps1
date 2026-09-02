Copy-Item .env.example .env -ErrorAction SilentlyContinue

# Backend (FastAPI) — runs in the background
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
Start-Process -NoNewWindow .\.venv\Scripts\python.exe `
  -ArgumentList "-m uvicorn backend.main:app --host 0.0.0.0 --port 8000"

# Frontend (Vite) — runs in this window; open the printed localhost URL
npm install
npm run dev
