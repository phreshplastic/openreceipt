# Missing capture

Every asset ID below is referenced by `../shot-plan.json` and currently stands in as a labelled `Placeholder` slate or a stand-in still from `../../docs/stills/`. Nothing here is faked in the cut — a missing shot shows up as a slate naming the file it wants.

Recorded 2026-09-02, before Pete's capture session.

## Screen — all missing

`screen-editor`, `screen-agent-prompt`, `screen-draft`, `screen-granular-edit`, `screen-preview`, `screen-approval`, `screen-approve-feed`, `screen-idle`, `screen-scroll`, `screen-safety`.

Standing in: `docs/stills/03-editor-agent-draft.png` and `docs/stills/04-approval.png`, which are real product screenshots but static and at the wrong aspect. They prove layout, not behaviour.

## Physical — all missing

`physical-cold-open`, `physical-wide`, `physical-full-print`, `physical-tear`, `physical-match`, `physical-use`.

No stand-in exists. These render as slates.

## Audio — all missing

`printer-sfx`, `room-tone`, `vo-scratch`, `vo-final`, `vo-clean`, `music`.

The pilot and rough cut are silent until these land.

## Values that must come from capture

`physical-preview` carries `actualDotWidth` and `actualPaperLengthMm`. The film currently shows a note in their place. **Do not ship a render with that note in it** — the whole sequence exists to show that the preview reports the real print.
