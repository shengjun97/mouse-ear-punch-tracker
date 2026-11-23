# Mouse Ear Punch Tracker

Local-first web app for recording and looking up mouse ear punch patterns.
No backend; all data stays on the device (IndexedDB). Installable, and works
fully offline once opened. Built with React, TypeScript, and Vite.

**Live app:** https://shengjun97.github.io/mouse-ear-punch-tracker/

## Run on this computer

Node.js is installed per-user at `~/.local/node` (no system changes).

```bash
export PATH="$HOME/.local/node/bin:$PATH"
npm run dev      # dev server at http://localhost:5173 (no offline support in dev)
npm test         # unit tests (Vitest)
npm run build    # production build in dist/
npm run preview  # serve the production build at http://localhost:4173
```

## Publish an update

The site is on GitHub Pages. Every push to `main` runs the tests, builds, and
redeploys automatically (`.github/workflows/deploy.yml`):

```bash
git add -A && git commit -m "Describe the change" && git push
```

## Deploy elsewhere (optional)

`dist/` is a plain static site. Copy it to any static web host that serves
**HTTPS** (for example GitHub Pages, Netlify, or a lab/university web server).
Paths are relative, so it also works from a sub-folder such as
`https://example.org/ear-punch/`.

HTTPS is required for offline use and installing: browsers only run the
offline service worker on `https://` or `localhost`. Opening
`dist/index.html` directly as a file does not give offline support.

After each new build, upload the new `dist/` contents. Open copies of the app
show "A new version of the app is ready" and switch only when you tap
"Reload now", so nothing reloads in the middle of an edit. Data is not
affected by updates.

## Install and use offline

1. Open the app's HTTPS address once while online.
2. Install it:
   - **iPad / iPhone (Safari):** Share → Add to Home Screen.
   - **Android (Chrome):** menu → Install app (or Add to Home screen).
   - **Desktop Chrome / Edge:** the install icon in the address bar.
3. From then on it opens and works with no network. An "Offline" badge shows in
   the header when there is no connection.

Data lives only in that browser on that device. Use **Backup and restore** on
the home page to keep a copy and to move data between devices. Creating your
first experiment asks the browser to keep the data permanently (persistent
storage); the backup panel shows whether it agreed.

## Orientation and coordinates

Diagrams are always the dorsal view, nose up: the mouse's left ear (L) is on
the left of the screen. Each mark is stored in its ear's own normalized frame:
`u` 0 = inner (medial) to 1 = outer (lateral), `v` 0 = top (anterior, toward
the nose) to 1 = bottom (posterior). The left ear is mirrored when drawn.

## Scripts

- `scripts/make_icons.py` regenerates the PNG app icons in `public/icons/` (no dependencies).
- `scripts/verify_offline.mjs` checks the production build offline in a separate
  headless Chrome with a temporary profile: run `online` with `npm run preview`
  running, stop the server, then run `offline` with the same profile folder.
  For the deployed site, `live <profileDir> <url>` loads it, then cuts the
  browser's network and reloads.

## Status

| Stage | State |
| --- | --- |
| 1. Ear editor | Done: tap to add, edge snap to notch, drag, select/delete, undo/redo, snap to zones, add by position, keyboard |
| 2. Patterns and labels | Done: experiments, groups, patterns in IndexedDB with autosave; duplicate pattern/experiment; similar/identical warnings with side-by-side compare |
| 3. Legend | Done: grid of all patterns with diagram, label, color, description; search; group filter; card sizes; tap to enlarge with prev/next |
| 4. Lookup | Done: tap observed marks, live ranked results with explanations of differences, ambiguity warning, group limit, tap tolerance, pinned result bar on phones |
| 5. Animals and cages | Done: animal records with validation, Animals list with search/status/group filters, Cages view, same-cage confusion warnings, animals shown in legend, lookup and pattern editor |
| 6. Print / export / templates | Done: A4 legend sheet, cage cards, pattern cards (B/W safe, PDF via print); legend PNG/SVG; animals CSV; experiment JSON; full backup and restore (merge or replace); built-in numbering schemes (JAX 1–99, with zero, 1–399) and custom schemes with a digit editor; numbered patterns; saved pattern-set templates |
| 7. PWA / offline | Done: installable (manifest, icons), offline precache of the whole app, update prompt, offline badge, light/dark/auto theme, persistent-storage request |

See `docs/decisions.md` for design decisions.
