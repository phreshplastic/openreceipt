# Capture manifest

Record picture without live narration. Hold every important state two seconds before and after the action, because those handles let the edit breathe and make agent-generated zooms reliable.

## Screen capture

Set the display and browser to the exact state used in the submission. Record at 1440p or higher, hide notifications and unrelated tabs, keep the agent tool names readable, and preserve the real cursor.

| Asset ID | File name | Required content | Done |
| --- | --- | --- | --- |
| `screen-editor` | `assets/screen/screen-01-editor-human-edit.mov` | Receipt canvas, block selection, and one small direct edit | [ ] |
| `screen-agent-prompt` | `assets/screen/screen-02-agent-prompt-tools.mov` | Prepared Lisbon prompt and visible `list_receipt_recipes` activity | [ ] |
| `screen-draft` | `assets/screen/screen-03-draft-lisbon.mov` | `draft_receipt` and the complete Lisbon receipt appearing | [ ] |
| `screen-granular-edit` | `assets/screen/screen-04-granular-edit.mov` | Add earbuds, mark Passport packed, highlight/Undo state | [ ] |
| `screen-preview` | `assets/screen/screen-05-preview.mov` | `preview_receipt` with real dot dimensions and paper length | [ ] |
| `screen-approval` | `assets/screen/screen-06-approval-panel.mov` | Print request and the untouched approval panel held long enough to read | [ ] |
| `screen-approve-feed` | `assets/screen/screen-07-approve-and-feed.mov` | Approval click and on-screen feed animation | [ ] |
| `screen-safety` | `assets/screen/screen-99-complete-safety-take.mov` | One uninterrupted run from prompt through approval | [ ] |

## Physical footage

Shoot horizontal 4K at 30 fps with stable support and locked focus/exposure. Record natural printer sound on every take, then capture 20 seconds of room tone and one isolated print for sound design.

| Asset ID | File name | Required content | Done |
| --- | --- | --- | --- |
| `physical-cold-open` | `assets/physical/physical-01-cold-open-macro.mov` | Printer wakes, paper begins, Lisbon receipt emerges | [ ] |
| `physical-wide` | `assets/physical/physical-02-wide-desk.mov` | Laptop, printer, and enough negative space for a title | [ ] |
| `physical-full-print` | `assets/physical/physical-03-full-print-side.mov` | Complete print from a side or three-quarter angle | [ ] |
| `physical-tear` | `assets/physical/physical-04-tear-and-lift.mov` | Hand tears and lifts the finished receipt cleanly | [ ] |
| `physical-match` | `assets/physical/physical-05-paper-beside-screen.mov` | Readable paper beside the matching on-screen receipt for at least five seconds | [ ] |
| `physical-use` | `assets/physical/physical-06-by-the-door.mov` | Receipt placed by a bag, door, or other believable point of use | [ ] |
| `printer-sfx` | `assets/audio/sfx-printer-isolated.wav` | One clean printer run without speech or music | [ ] |
| `room-tone` | `assets/audio/sfx-room-tone.wav` | Twenty seconds of the recording space | [ ] |

## Voice and music

Record the rough read first so an agent can cut to cadence. Record the final voice after the rough picture exists, matching its pacing rather than trying to hit every screenplay timestamp blindly.

| Asset ID | File name | Required content | Done |
| --- | --- | --- | --- |
| `vo-scratch` | `assets/audio/vo-scratch.wav` | Full screenplay read, conversational and unprocessed | [ ] |
| `vo-final` | `assets/audio/vo-final.wav` | Approved read with retakes left as separate files if needed | [ ] |
| `vo-clean` | `assets/audio/vo-final-clean.wav` | Restrained cleanup of the approved read | [ ] |
| `music` | `assets/audio/music-jazz.wav` | Licensed instrumental track with license record | [ ] |

Before handing off, play every file once, confirm it contains the named event, and leave failed takes outside these final asset names. The editing agent should be able to trust that each named slot contains the best available take.
