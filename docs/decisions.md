# Decisions

## 2026-11-13

- Project lives in its own folder, separate from other research projects (user choice).
- Node.js v26.13.1 (LTS) installed per-user to `~/.local/node` from nodejs.org, SHA-256 verified (user choice).
- "Top" means anterior (toward the nose), matching the user's cage cards.
- Holes and notches are strictly different marks: never matched or flagged as
  confusable with each other. Left and right ears are never compared with each other.
- Snap zones: 8 named positions plus "bottom" (posterior edge), which the
  JAX/universal numbering scheme needs (marks 3/6/9 and 30/60/90).
  Notches have 8 edge positions; holes have 8 ring positions plus center.
- Confusion threshold default 0.15 (normalized ear units), adjustable per experiment (stage 2).
- A centre hole converted to a notch goes to the top edge (no meaningful direction).

- Stage 2 data rules:
  - New pattern label = group name (group mode) or "Group #n" (individual mode); color = group color.
  - Renaming/recoloring a group, or moving a pattern to another group, updates the pattern's label/color only if it still matched the old group's (customized values are kept).
  - Duplicating an experiment copies groups and patterns, not animals.
  - Deleting a group deletes its patterns; animals linked to a deleted pattern keep their record but lose the link.
  - Hash routing (#/...) so the static build works from any folder and offline.

- Stage 3 legend: search matches label, group name, text description, and notes (every word must match);
  cage and animal ID search will be added with animal records in stage 5. View preferences
  (card size, group headings, show notes) are remembered per device in localStorage; experiment data never is.

- Stage 4 lookup: separate "tap tolerance" (default 25% of ear size, per device) from the
  confusion-warning threshold, because taps on a live animal are less precise than placement in the editor.
  Ranking: match (same marks, all within tolerance) > same marks in a different spot > different marks; ties by cost.
  When several patterns match, all are shown with a "too similar to tell apart" warning instead of picking one.
  Holes vs notches and left vs right ears must always match exactly.

- Stage 5 animals:
  - Animal ID required and unique per experiment (case-insensitive). Warnings (punch before birth, birth in the future) never block saving and show while typing.
  - In individual mode, the form offers "+ New pattern named after this animal" and flags patterns already used by another live animal.
  - Same-cage warnings: live animals in one cage that share a pattern or have identical/confusable patterns. In group mode, same-group animals share a pattern by design, so only animals from different groups are flagged.
  - Deleting a group now also deletes its animal records (the confirmation states the count). Moving a pattern to another group moves its animals with it. Deleting a pattern keeps the animals but unlinks them.
  - Search syntax shared by Animals, Cages and Legend: "cage 10"/"cage:10" = exact cage; "animal M12"/"id M12" = exact ID; other words must all appear.

- Stage 6 print/export/templates:
  - Built-in schemes: JAX 1–99; JAX 1–99 with center-hole zero; universal 1–399 (center holes = hundreds, as in Queen's SOP 7.13).
    Mark positions follow JAX Fig. 3-2: holes 1/2/3 and notches 4/5/6 at top/outer/bottom, double notches 7/8/9 (two notches ±14° apart).
    All 99 two-digit patterns were checked to be mutually distinguishable at the default threshold (unit test).
    The UConn/Hogan scheme is not built in: its ear sides can't be read from the published diagram.
  - Built-in schemes are read-only; "Make an editable copy" creates a custom scheme. The scheme editor warns when numbers become indistinguishable.
  - PDF output uses the browser's print dialog ("Save as PDF"); no PDF library, so it works offline.
  - CSV: UTF-8 with BOM (Excel), formula-like cells neutralized but genotypes such as "+/-" kept as typed.
  - Restore: "merge" adds records whose ids are new and keeps existing ones unchanged; "replace" wipes this device first (confirmation required).

- Stage 7 PWA:
  - vite-plugin-pwa 2.0.0 (generateSW, Workbox). The whole app shell is precached; hash routing means only index.html is ever navigated to.
  - registerType "prompt": a new version waits until the user taps "Reload now", so a form is never reloaded mid-edit.
  - Icons drawn by scripts/make_icons.py (no image libraries); maskable icon keeps the drawing in the safe zone.
  - Persistent storage is requested when the first experiment is created (a user action), not on page load.
  - Theme: auto (follows the device) / light / dark, remembered per device; applied before first paint.
  - Dark-mode ear colors lightened so holes and notches stay visible at small sizes.
  - Offline verified with a separate headless Chrome and temporary profile: app and saved data load with the server stopped.
    The Claude desktop browser pane refuses to register service workers, so it can't be used for this check.

## Numbering scheme sources (for built-in templates, stage 6)

- JAX Green Book, chapter 3, Figure 3-2 (dorsal view): right ear units, left ear tens.
  Holes 1/2/3 (upper/outer/lower), notches 4/5/6 (top/outer/bottom edge),
  double notches 7/8/9; tens the same on the left ear. Optional center hole = 0.
  Multiples of 100 omitted. https://informatics.jax.org/greenbook/chapters/chapter3.shtml
- Queen's University UACC SOP 7.13 ("universal numbering system"): same 1–9 / 10–90 layout,
  plus center hole right = 100, left = 200 (both = 300), max 399.
  https://www.queensu.ca/animals-in-science/policies-procedures/sop/mice/7-13
- UConn CMGM (Hogan et al., Manipulating the Mouse Embryo, 1994): 1–99 with
  5 = 1+4, 8 = 1+2, 9 = 2+3, etc. Ear side not readable from the published diagram; not built in unless confirmed.
  https://health.uconn.edu/mouse-genome-modification/mouse-colony-management/ear-notch-system
