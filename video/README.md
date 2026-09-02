# Pete's Printer demo video

This folder is the production handoff for the WebMCP Challenge video. The target is a 2:35-2:45 launch-style film built from real screen capture, real printer footage, Pete's voice, restrained motion graphics, and licensed jazz.

The story and wording already exist. Treat [`../docs/demo-video-screenplay.md`](../docs/demo-video-screenplay.md) as the narrative source of truth and [`shot-plan.json`](shot-plan.json) as the machine-readable edit map. The current tool research and licensing notes live in [`../docs/research/ai-video-tools-2026.md`](../docs/research/ai-video-tools-2026.md).

## Start here

1. **Finish the setup check.** Work through [`SETUP.md`](SETUP.md) before recording, because discovering a watermark, missing export option, or music restriction after capture costs the most time.
2. **Record into the named asset slots.** Follow [`CAPTURE.md`](CAPTURE.md) and place files under `assets/`; consistent names let an agent assemble the first cut without another sorting pass.
3. **Hand the folder to an agent.** Start Claude Code, Cursor, Codex, or Kimi at the repository root and paste [`HANDOFF.md`](HANDOFF.md). The scoped [`AGENTS.md`](AGENTS.md) gives it the production constraints.
4. **Review stills before video.** The agent should apply [`LOOK.md`](LOOK.md), render one representative frame per sequence, get Pete's approval on framing and typography, and only then spend time on complete renders.
5. **Use the fallback early.** If a coherent Remotion rough cut does not exist after the first assembly session, make the two-minute Screen Studio cut described in the screenplay. The real printer reveal and WebMCP explanation remain mandatory.

## What Pete supplies

- Clean software recordings of the rehearsed Lisbon flow.
- Four to six phone clips showing the real printer and finished receipt.
- Rough narration for timing, followed by a final narration recording.
- A licensed jazz track or a saved license record for generated music.
- Taste decisions on the key-frame review and final cut.

## What the agent owns

- Media inspection, proxies, transcript/timing data, and the Remotion project under `edit/`.
- Assembly, large UI crops, tool-call labels, transitions, captions, audio ducking, and renders.
- A factual-continuity pass against the captured product and the challenge rules.
- Exporting a final MP4 and SRT under `exports/` without changing the product application.

## Directory contract

```text
video/
  assets/       Human-supplied recordings, audio, and approved stills
  edit/         Separate Remotion package created by the editing agent
  exports/      Review and final renders
  AGENTS.md     Scoped rules for any continuation agent
  CAPTURE.md    Exact recording checklist and file names
  HANDOFF.md    Copy-paste continuation prompt
  LOOK.md       Visual, motion, typography, and sound direction
  SETUP.md      Accounts, software, skills, and licensing check
  shot-plan.json  Timing and asset map derived from the screenplay
```

`ffmpeg` 8.1.2, Node 26, and npm 11 are already available on this machine. The Remotion package has deliberately not been initialized yet, so the next agent can use the current official starter after footage exists and keep its dependencies isolated from the product app.
