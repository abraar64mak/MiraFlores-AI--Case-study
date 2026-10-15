# Okafor-Lindqvist 2025 tax workpaper

**Live site:** https://abraar64mak.github.io/MiraFlores-AI--Case-study/

A working, web-native workpaper for one complex household's return. It loads `data/packet.json` exactly as delivered.

**Run it**
- Open `dist/workpaper.html` (single file, works offline), or
- `python3 -m http.server 8000` in this folder and open `http://localhost:8000/` (uses `index.html`, `js/`, `css/`, `data/packet.json`).
- Rebuild the single file: `node tools/build-single.mjs`.

**Use it**: press **Ctrl K** to search or jump anywhere. Switch roles at the top right (each role gets its own navigation, home desk and colour); on a fresh file use **Load demo activity** on the home screen (or Ctrl K) so the reviewer and partner desks have work in them. Switch roles at the top right. Staff: Priya (preparer), Daniel (reviewer), Helen (partner), Marcus (preparer, no sensitive-data clearance), Jo (administrator), Sam (quality reviewer, active only after filing). Clients: Ngozi and Erik. State is saved in the browser; Activity > Reset returns to the packet as delivered. Open a second tab as another role to see changes arrive live.

**Public website with the AI helpers**: see `docs/DEPLOY.md` (Vercel hosts the static site and `api/ai.js`, which keeps the API key out of the browser).

**How AI was used** (as the brief asks): see `docs/AI_AND_TOOLS.md`.

**Hand-in documents** (`docs/`): `ONE_PAGER.md` (core idea and data model), `ERRORS_FOUND.md`, `AI_AND_TOOLS.md`, `VIDEO_SCRIPT.md`, `DESIGN_NOTES.md` (design references, model, roadmap).

**Tests**: `node tools/logic-test.mjs`; with the server running, `node tools/e2e.mjs` (every route) and `node tools/flow.mjs` (a whole season through the real app code).
