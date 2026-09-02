# Copy-paste agent handoff

Paste the following into Claude Code, Cursor, Codex, or Kimi from the repository root:

> Build the Pete's Printer WebMCP Challenge demo video from the production package under `video/`. Read `video/AGENTS.md`, `video/README.md`, `video/CAPTURE.md`, `video/LOOK.md`, `video/shot-plan.json`, and `docs/demo-video-screenplay.md` before making changes. Keep all video dependencies and outputs inside `video/`; do not modify the product app or root package files.
>
> First inventory `video/assets/` with `ffprobe`, match files to the asset IDs in `video/shot-plan.json`, and write any gaps to `video/assets/MISSING.md`. Then initialize a current Remotion TypeScript project in `video/edit/`, install or load the official Remotion agent skills, and create a 1920x1080, 30 fps composition. Keep timing in one data module and build reusable components for full-bleed UI crops, warm paper backgrounds, tool-call labels, restrained camera movement, captions, and the final physical-print reveal.
>
> Use real footage for every product claim. The edit must visibly prove named WebMCP tool use, human and agent editing the same revision-checked receipt, exact preview, revision-bound approval, and the matching physical print. Use the supplied screenplay wording and shot plan rather than inventing a new product story.
>
> Work through two review gates. First render one representative still per sequence into `video/exports/stills/` and summarize the visual choices and any missing media. After those frames are approved, render a complete rough cut with scratch narration into `video/exports/review/`. Only after rough-cut approval should you mix final narration, licensed music, printer sound, and reviewed captions. Put the final MP4, SRT, and release checklist in `video/exports/final/`.
>
> If media is missing, use clearly labeled placeholders and continue elsewhere; never generate fake UI, fake tool calls, or fake printer footage. If a coherent Remotion rough cut cannot be completed promptly, make the screenplay's two-minute fallback from the same real media and preserve the physical print payoff.

## When footage has not been recorded yet

Give the agent the same prompt, then add:

> No final media exists yet. Create only the Remotion structure, design tokens, shot timing, placeholder components, and automated still-render commands. Use obvious slate placeholders named after missing asset IDs. Stop before polishing animation so real footage can determine crops and pacing.

## Review prompt after the first stills

> Review the rendered sequence stills as a product-launch film at phone playback size. Report only problems that change the edit: unreadable UI, weak hierarchy, inconsistent framing, copied-looking Anthropic details, false product claims, or missing physical continuity. Propose exact crop, size, color, or timing changes, then wait for my taste decisions before producing the full render.
