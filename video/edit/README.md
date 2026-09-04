# Remotion edit

The launch film is assembled here, isolated from the product app so video tooling never
touches the application's dependency graph. Install and preview from inside this directory:

```bash
npm install
npx remotion studio
```

`src/` holds the compositions, `scripts/` the voiceover, caption and verification helpers,
and `../shot-plan.json` is the source of truth for shot timings.

Heavy media is deliberately not in git: capture footage, the licensed music bed, the
voiceover, standin frames, and the `whisper.cpp` checkout used for caption timing are all
local-only (see `../.gitignore`). A fresh clone gets the edit's source, not the rushes. The
finished film is the published YouTube cut linked from the top-level README.
