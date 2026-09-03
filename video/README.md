# OpenReceipt demo video

This folder is the production surface for the WebMCP Challenge video: a 2:35–2:45 launch-style film built from real screen capture, real printer footage, Pete's voice, generated paper, and licensed jazz.

The story already exists. [`../docs/demo-video-screenplay.md`](../docs/demo-video-screenplay.md) is the narrative source of truth, [`LOOK.md`](LOOK.md) is the art direction, and [`shot-plan.json`](shot-plan.json) is the machine-readable edit map that the Remotion project reads directly.

## The direction in one paragraph

The film is a **product launch sizzle reel staged on paper**. Warm ground, real capture in cards that travel and settle, geometric shapes carrying the rhythm, hard punches into detail, and cuts that land on the beat. Type is Inter throughout, weight for hierarchy.

Time is measured in beats, not seconds: `music.bpm` in the shot plan sets the grid, and everything in `edit/` is timed against it, so retiming to a real track is one number. The frame's own arc is the `fill` value per sequence — cards through the story, then exactly 1.0 for the print, where nothing sits between the viewer and the proof.

Two paper stocks, and the difference is load-bearing: parchment is the ground, thermal receipt is the product, and the receipt never wears parchment. All of it is generated — nothing photographed, nothing licensed. The recipe is in [`LOOK.md`](LOOK.md).

## Start here

1. **Look first.** Render `Paper-Study` and `Pilot` from `edit/` and settle the stock choice before capture, because the look changes what is worth recording.
2. **Check the setup.** Work through [`SETUP.md`](SETUP.md) before recording. Discovering a watermark or a music restriction after capture costs the most time.
3. **Record into the named slots.** Follow [`CAPTURE.md`](CAPTURE.md) and place files under `assets/`. The recorder settings at the top of that file matter as much as the shot list.
4. **Hand the folder to an agent.** Paste [`HANDOFF.md`](HANDOFF.md) at the repository root. [`AGENTS.md`](AGENTS.md) carries the production constraints.
5. **Use the fallback early.** If a coherent rough cut does not exist after the first assembly session, make the two-minute cut described in the screenplay. The real printer reveal and the WebMCP explanation stay mandatory either way.

## What Pete supplies

- Clean software recordings of the rehearsed Lisbon flow, exported flat with auto-zoom off.
- Six phone clips of the real printer and the finished receipt.
- Rough narration for timing, then a final narration recording.
- A licensed jazz track plus its licence record.
- Taste decisions on the look test and the final cut.

Not needed: any texture shoot, overhead rig, foley session, or titling and zooming inside the screen recorder.

## What the agent owns

- Media inspection, proxies, timing data, and the Remotion project under `edit/`.
- Assembly, paper, crops, tool labels, transitions, captions, audio ducking, renders.
- A factual-continuity pass against the captured product and the challenge rules.
- A final MP4 and SRT under `exports/`, without touching the product application.

## Directory contract

```text
video/
  assets/         Human-supplied recordings, audio, and approved stills
  edit/           The Remotion project (own package.json, isolated from the app)
  exports/        Review and final renders
  AGENTS.md       Scoped rules for any continuation agent
  CAPTURE.md      Recorder settings and the exact shot list
  HANDOFF.md      Copy-paste continuation prompt
  LOOK.md         Visual, material, motion, and sound direction
  SETUP.md        Accounts, software, skills, and licensing check
  shot-plan.json  Beat grid, fill arc, timing, and asset map
```

## Running the edit

```bash
cd video/edit && npm install && npm run studio
```

| Command | What it does |
| --- | --- |
| `npm run studio` | Remotion Studio, no browser auto-open |
| `npx remotion still Paper-Study out.png` | The paper look test — read it at 100% |
| `npm run pilot` | The 12-bar look test in motion, into `exports/review/` |
| `npm run lint` | ESLint plus `tsc` |

`ffmpeg` 8.1.2, Node 26 and npm 11 are already available on this machine.
