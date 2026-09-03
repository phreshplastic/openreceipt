# Copy-paste agent handoff

The Remotion project already exists in `video/edit/`, the direction is settled in `video/LOOK.md`, and `video/shot-plan.json` drives the timing. Paste the following at the repository root:

> Continue the OpenReceipt WebMCP Challenge demo video in `video/`. Read `video/AGENTS.md`, `video/README.md`, `video/LOOK.md`, `video/CAPTURE.md`, `video/shot-plan.json`, and `docs/demo-video-screenplay.md` before changing anything. Keep all video dependencies and outputs inside `video/`; do not modify the product app or root package files.
>
> First inventory `video/assets/` with `ffprobe`, match files to the asset IDs in `video/shot-plan.json`, and write any gaps to `video/assets/MISSING.md`. Then build `video/edit/src/sequences/Film.tsx` from the ten sequences in the plan, using `Pilot.tsx` as the pattern — it is the approved look and rhythm, and every device the film needs already exists in `edit/src/motion`, `edit/src/plate`, `edit/src/camera` and `edit/src/type`.
>
> Use real footage for every product claim. The edit must visibly prove named WebMCP tool use, human and agent editing the same revision-checked receipt, exact preview, revision-bound approval, and the matching physical print. Use the supplied screenplay wording rather than inventing a new product story.
>
> Respect the direction the code already encodes. Time everything in beats via `beat(n)` — never in frames or seconds — so the film retimes to the real track from `music.bpm` alone. The `fill` value per sequence is the frame's arc and must stay 1.0 at `approve-and-print`, where the frame goes bare. Inter only, weight for hierarchy. Parchment and thermal receipt are two different materials, and the receipt never wears parchment. `#0071E3` appears only where the captured UI already uses it, plus the `ToolTag` pill.
>
> Work through the gates in `video/AGENTS.md`. First render one still per sequence into `video/exports/stills/` and summarise the choices and any missing media. After those are approved, render a complete rough cut with scratch narration into `video/exports/review/`. Only then mix final narration, licensed music, printer sound, and reviewed captions, and put the final MP4, SRT, and release checklist in `video/exports/final/`.
>
> If media is missing, keep the labelled `Placeholder` slates and continue elsewhere; never generate fake UI, fake tool calls, or fake printer footage. If a coherent rough cut cannot be completed promptly, make the screenplay's two-minute fallback from the same real media and preserve the physical print payoff.

## Review prompt after the stills

> Review the rendered sequence stills as a product-launch film at phone playback size. Report only problems that change the edit: unreadable UI, weak hierarchy, inconsistent framing, a receipt that has started to look like the parchment it sits on, false product claims, or missing physical continuity. Propose exact crop, size, colour, or timing changes, then wait for my taste decisions before producing the full render.

## If the cut stops feeling like music

Check that arrivals are on whole beats, that something happens on most downbeats, and that the density varies — a reel at one speed throughout stops registering as rhythm. Watch it once with the sound off: if the cuts feel arbitrary, they have drifted off the grid.

## If the paper stops looking real

Almost always the lighting pass, not the noise. Check `feDiffuseLighting`'s `elevation` (low rakes across the tooth; high flattens it) and the `feComponentTransfer` contrast expansion after it. Adding more turbulence makes it worse. See `LOOK.md`.
