# Demo video production

This directory is a separate video-production surface inside the OpenReceipt repository. Keep all editing dependencies, generated files, and renders under `video/`; leave the product application and its package files unchanged unless Pete separately asks for product work.

Before editing, read `README.md`, `LOOK.md`, `CAPTURE.md`, `shot-plan.json`, and `../docs/demo-video-screenplay.md`. Read `../docs/research/ai-video-tools-2026.md` when choosing software, music, generated assets, or third-party skills. For Remotion work, load `../.agents/skills/remotion-best-practices` (router for all twelve vendored Remotion skills) and follow `SETUP.md` for agent-specific plugin notes.

The composition is 1920x1080 at 30 fps, 2:35–2:45. Use real capture as evidence: the interface, WebMCP calls, approval state, physical printer, and receipt must come from supplied media. Paper, crops, labels and pacing may frame that evidence. Generated product behaviour and generated printer footage are outside the cut.

`shot-plan.json` holds sequence IDs, timing, asset slots, `music.bpm`, and the `fill` value per sequence. `edit/src/timing.ts` reads that file directly, so the plan is the single source of timing — change timing there, not in component code. Preserve the screenplay's causal story: agent drafts through named WebMCP tools, human and agent edit one revision-checked receipt, preview reports physical output, printing pauses for revision-bound approval, then the real printer produces the matching paper.

## Direction the code already encodes

`LOOK.md` is the direction; these are the three rules an agent is most likely to break by accident.

- **The film is cut to a beat grid.** `music.bpm` in `shot-plan.json`, `beat(n)` in `edit/src/theme.ts`. Never write a delay in frames or seconds — every arrival, cut and shape entrance takes a beat number, so retiming to a real track is one value. Something should happen on most downbeats, and nothing important may land off-grid.
- **`fill` is the frame's arc.** It lives in `shot-plan.json` and is read by exactly one component, `edit/src/plate/Card.tsx`. Cards through the story, then **exactly 1.0** at `approve-and-print` — bare, no card, no shapes, no type. Do not decorate the proof sequence to make it "consistent"; its bareness is the point.
- **Inter only, weight for hierarchy.** No display face, no monospace. The product and the printed receipt are both Inter.
- **Two paper stocks, never one.** Parchment is the world; thermal receipt is the product. The receipt gets no fibre, no mottling, no warm cast, no torn edge. A frame where the receipt looks like the ground it sits on is a bug.
- **The accent is inherited, not chosen.** `#0071E3` appears only where the captured UI already uses it. Never invent something in that blue.

Paper is generated, not photographed or licensed. If a paper surface stops looking real, the fix is almost always the lighting pass (`feDiffuseLighting` elevation and the contrast expansion after it), not more noise.

## Structure

The Remotion package lives in `edit/` with its own `package.json`. Keep timing in `edit/src/timing.ts`, reusable treatment in `edit/src/paper`, `edit/src/type`, `edit/src/camera` and `edit/src/plate`, and media references relative to `video/assets/`. Generate proxies and caches inside `edit/.cache/`. Render review stills into `exports/stills/`, review movies into `exports/review/`, and approved deliverables into `exports/final/`.

## Gates

1. One representative still per sequence in `shot-plan.json`, with legible UI at phone playback size and a coherent paper treatment.
2. A complete rough cut with scratch narration and no missing evidence.
3. A final MP4 under 2:45 plus a reviewed English SRT, audible narration, licensed music, and a signed-out YouTube playback check recorded in `exports/final/release-check.md`.

If required footage is absent, use `edit/src/plate/Placeholder.tsx`, which carries the exact missing asset ID, and continue on sequences that have media. Report the gap in `assets/MISSING.md`. Never fabricate the proof — a placeholder that looks finished is how fake evidence gets into a cut. If the Remotion path cannot reach a complete rough cut promptly, assemble the screenplay's two-minute fallback from the same real media.
