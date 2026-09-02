# Demo video production

This directory is a separate video-production surface inside the Pete's Printer repository. Keep all editing dependencies, generated files, and renders under `video/`; leave the product application and its package files unchanged unless Pete separately asks for product work.

Before editing, read `README.md`, `CAPTURE.md`, `LOOK.md`, `shot-plan.json`, and `../docs/demo-video-screenplay.md`. Read `../docs/research/ai-video-tools-2026.md` when choosing software, music, generated assets, or third-party skills.

Build a 1920x1080, 30 fps Remotion composition lasting 2:35-2:45. Use real capture as evidence: the interface, WebMCP calls, approval state, physical printer, and receipt must come from supplied media. Motion graphics may frame, crop, label, connect, and pace that evidence. Generated product behavior or generated printer footage is outside the cut.

Use `shot-plan.json` for sequence IDs, timing targets, and asset slots. Preserve the screenplay's causal story: agent drafts through named WebMCP tools, human and agent edit one revision-checked receipt, preview reports physical output, printing pauses for revision-bound approval, then the real printer produces the matching paper.

Create the Remotion package under `edit/`. Keep timing in one data file, reusable visual treatment in components or tokens, and media references relative to `video/assets/`. Generate proxies and caches inside `edit/.cache/`. Render review stills into `exports/stills/`, review movies into `exports/review/`, and the approved deliverables into `exports/final/`.

The first completion gate is one representative still for every sequence in `shot-plan.json`, with legible UI at phone playback size and a coherent warm paper-and-ink treatment. The second gate is a complete rough cut with scratch narration and no missing evidence. The final gate is an MP4 under 2:45 plus a reviewed English SRT, audible narration, licensed music, and a signed-out YouTube playback check recorded in `exports/final/release-check.md`.

If required footage is absent, create placeholders carrying the exact missing asset ID and continue on sequences that have media. Report the capture gap in `assets/MISSING.md`; do not fabricate the proof. If the Remotion path cannot reach a complete rough cut promptly, assemble the screenplay's two-minute fallback from the same media.
