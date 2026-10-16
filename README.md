# Okafor-Lindqvist 2025 tax workpaper

A web-native workpaper for one complex household's return, built for the Miraflores case study "Redesign the Tax Workpaper". It loads `data/packet.json` exactly as delivered.

- **Live app:** https://abraar64mak.github.io/MiraFlores-AI--Case-study/
- **Blog (how I approached it, start to finish):** https://abraar64mak.github.io/MiraFlores-AI--Case-study/blog/

## Hand-in

| Item | Where |
|---|---|
| Working workpaper (role switcher, saves everything) | the live app above |
| Core idea and data model, one page | `docs/ONE_PAGER.pdf` (source: `docs/ONE_PAGER.md`) |
| Errors found and how the design surfaced them | `docs/ERRORS_FOUND.pdf` (source: `docs/ERRORS_FOUND.md`) |
| How AI and other tools were used | `docs/AI_AND_TOOLS.md` |
| Design references and roadmap | `docs/DESIGN_NOTES.md` |
| Video walkthrough | linked in the submission |

## Using the app

- Press **Ctrl K** to search or jump anywhere.
- Switch roles with the selector at the top right. Each role has its own navigation, home desk and colour: Priya (preparer), Daniel (reviewer), Helen (partner), Marcus (preparer without sensitive-data clearance), Jo (firm administrator), Sam (quality reviewer, active after filing), and the clients Ngozi and Erik.
- Everything is saved in the browser. **Activity > Reset workpaper** (partner or administrator) returns it to the packet as delivered.
- Open a second tab as another role to watch changes arrive live.
- On a fresh file, **Load demo activity** on the home screen gives the reviewer and partner desks some work.

## Running it locally

The app is static files, so any web server works:

```
python3 -m http.server 8000      # then open http://localhost:8000/
```

`node tools/build-single.mjs` builds a single self-contained file at `dist/workpaper.html` that works offline. `node tools/build-blog.mjs` regenerates `blog/index.html` from `docs/BLOG.md` (needs `pandoc`).

## Tests

- `node tools/logic-test.mjs`: checks and reconciliations against the packet.
- `node tools/e2e.mjs`: opens every route in headless Chromium (serve the folder first).
- `node tools/flow.mjs`: runs a whole season through the real app code, from preparation to filing, including role rules, stale signatures, an e-file rejection, freeze and amendment.

## Publishing

The site is published with GitHub Pages from the repository root (`index.html`, `js/`, `css/`, `data/`). `.nojekyll` keeps Pages from reprocessing the files.
