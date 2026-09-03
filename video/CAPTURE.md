# Capture manifest

Real audio and real timing now exist for the whole film. Everything below is timestamped against the actual 78.18s voiceover — record close to these durations so the edit doesn't have to stretch or cut your footage to fit.

## Recorder settings — unchanged, still load-bearing

- **Auto-zoom OFF, no baked-in camera moves.** All camera work happens in Remotion.
- **Export flat** — no rounded corners, drop shadow, padding, or wallpaper. The film's own frame (dark backdrop, rounded card, shadow) replaces whatever Screen Studio would add — a decorated export fights it.
- 2560×1600 or higher, fixed window size across every take.
- Notifications off, unrelated tabs hidden, real cursor visible.

## The physical printer shot — new guidance

You'll shoot this on your phone, and it does **not** need to be polished. It sits inside the exact same rounded, shadowed frame as the screen capture (`Card` component, `variant="phone"`) — the frame is doing the work of making it look intentional, not the camera work. Handheld is fine. Landscape or portrait both work; the frame crops to fit either way. What actually matters:

- Steady enough to read, not steady enough to look like a tripod.
- Real light — a window or lamp, not the phone's flash.
- Get the motor starting and the paper actually emerging in the same continuous shot if you can — that's the one match cut in the film (`print` scene, 47.28s–51.47s).

## Screen recording — timestamped to the real VO

Your receipt is already correct in the app (revision 40 — Pete's Printer, solid dividers, "Surf trip in Portugal") — nothing to fix there before recording.

| Scene | VO window | What's said | What to capture |
| --- | --- | --- | --- |
| hook + ask-agent | 0.06s–10.73s | "...you tell your agent about it...ask it to put together a list..." | The real prompt typed and sent, in whichever host you're actually using. ~11s. |
| real-tools + blocks-assemble | 10.81s–28.06s | "...real tools...beautiful, minimal, utilitarian...countdown, packing list, surf forecast..." | `list_receipt_recipes`/`draft_receipt` firing, then the receipt assembling. Hold on the surf block specifically for a beat — it's getting a punch-in. ~17s. |
| human-edit | 28.06s–34.48s | "...edit it yourself..." | You clicking into a real line and retyping it by hand. The single most important shot — two hands on one document. ~6s. |
| shared-canvas | 34.72s–42.97s | "...same shared canvas at the same time..." | The agent's own edit landing: one line changes, highlight + Undo visible. ~8s. |
| preview | 43.2s–47.08s | "...preview of the exact receipt." | `preview_receipt` on screen, real dot width and paper length — whatever it actually says. ~4s. |
| print (screen half) | 47.28s–51.47s | "...one button press to print..." | Approve click, then the on-screen print feed. Cuts to your phone shot here. ~4s. |
| same-flow | 56.64s–65.68s | "...grocery list, morning brief, reminder, meeting notes..." | Optional: a few seconds of the recipe/template list if you want it as a backup to the B-roll montage covering this line. Not required — B-roll may carry this beat entirely. |

Everything else (`autonomous-aside`, `carry-it`, `badges`, `end-card`) is your physical footage or the end card — no screen needed.

## Physical shots, by scene

| Scene | VO window | Capture |
| --- | --- | --- |
| print | 47.28s–56.52s | Printer motor starting, paper emerging — continuous if possible. ~9s total covers both `print` and the `autonomous-aside` line, which just stays on this shot. |
| carry-it | 65.92s–70.76s | Tear the receipt off, hold it or place it somewhere real — bag, door, dash. ~5s. |
| badges | 70.88s–75.27s | Can be a continuation of the carry-it shot, or a second calm moment — three short text badges land over whatever you give here, so it just needs to hold still enough to read text over. ~4s. |

## Audio — done, nothing needed from you here

VO and music are both ingested, transcribed, and mixed as a balance reference (sent separately). Once your footage is in, final loudness gets normalized to about −14 LUFS for YouTube.

## B-roll — I'm sourcing this, not you

Two beats (`hook` and `same-flow`) get short cinematic B-roll clips via Pexels — see `assets/broll-manifest.md` for the exact plan. Nothing needed from you unless you'd rather shoot those moments yourself instead of using stock.
