# Pete’s Printer — WebMCP Challenge demo

Make a 2:35–2:45 hybrid launch reel. Use clean screen capture for the working proof, a phone or camera for the printer, and voiceover throughout. A short founder shot can replace the second beat, but a Loom face bubble should not stay on-screen: it takes space from the receipt and makes the piece feel like a walkthrough instead of a small product film.

The whole story is one Lisbon trip receipt. One situation becomes a designed draft, the person and agent refine the same document, the agent previews the physical output, the person approves the consequential action, and the paper appears.

## The cut

| Time | Picture | Voiceover / live audio | On-screen copy |
| --- | --- | --- | --- |
| 0:00–0:08 | Macro shot of the final Lisbon receipt emerging from the real printer. Let the motor start the film; jazz enters after the first second. Tear the receipt and hold it briefly. | “A browser agent made this. It didn’t click around a webpage.” | “A website, an agent, and a real printer.” |
| 0:08–0:22 | Wide desk shot with laptop and printer. Optional: cut to a clean, full-frame founder shot beside the printer. | “I built Pete’s Printer, a local-first receipt canvas where a person and an agent make something together, then send it to a thermal printer.” | “Pete’s Printer” / “Make a little something.” |
| 0:22–0:36 | Screen capture of the editor. Move across the receipt, select one block, and make a tiny inline edit so it is plainly a working canvas. | “The receipt is the interface. What you see is drawn at the printer’s exact dot width, and I can edit it myself like any document.” | “One shared receipt” |
| 0:36–0:54 | Show the agent beside the app. Enter the prepared travel prompt. Let the real tool activity remain visible; use a subtle editorial label only if the host does not name the call clearly. | “But this page also registers ten structured tools through WebMCP. Instead of guessing at buttons or scraping the DOM, the agent asks Pete’s Printer what belongs on a trip receipt.” | `list_receipt_recipes` / “WebMCP connected” |
| 0:54–1:15 | The app changes live into the Lisbon receipt. Hold on the countdown, flight facts, weather, and grouped packing list as they appear. | “One `draft_receipt` call creates a countdown, flight details, destination weather, and packing grouped by where things live. The app supplies the printable vocabulary and constraints; the agent supplies the intelligence.” | `draft_receipt` / “Situation → finished paper” |
| 1:15–1:36 | Ask the agent to add earbuds and mark Passport packed. Show the single checklist line change and the app’s agent highlight/Undo affordance. If possible, make one direct human edit immediately before this. | “We are editing the same revision-checked document. I can change it by hand, and the agent can update one line without replacing the block I might be touching.” | `get_receipt` → `edit_receipt` / “Granular, revision-checked edits” |
| 1:36–1:50 | Ask, “How long will this be?” Show the real preview response and briefly frame the digital receipt. Replace the bracketed value below after the final rehearsal. | “Before anything physical happens, `preview_receipt` reads back the exact print, its dot dimensions, and its [actual] millimetres of paper.” | `preview_receipt` / “[actual width] dots · [actual length] mm” |
| 1:50–2:09 | Ask, “Print it.” Show the print request and the full approval panel, including revision, output dimensions, destination, and the note about edits cancelling the request. Do not approve immediately; give the judge time to read it. | “Printing is consequential, so `request_receipt_print` pauses for human approval bound to this exact revision. If I edit the receipt now, the request cancels; an approved draft cannot drift.” | `request_receipt_print` / “Human approval required” |
| 2:09–2:27 | Click “Approve and print.” Show the on-screen feed animation, then match-cut to the physical printer producing the same design. Bring up the printer sound and duck the music. | “I approve once. The browser renders that same document, and a local bridge sends it to the Epson over USB. There is no account or cloud print queue.” | “Exact preview → local USB print” |
| 2:27–2:42 | Hold the finished paper beside the matching screen. Fold it, put it near a bag, or tape it by the door so its purpose is tangible. End on the printer and wordmark. | “A conversation became something I can keep by the door, fold into a pocket, and write on. Pete’s Printer makes the web a place where people and agents can create a real thing together.” | “Pete’s Printer” / “Make a little something.” / “Built with WebMCP” |

## Prepared live prompt

Use one prompt with enough detail for a fast, visually rich first draft:

> I’m flying to Lisbon Thursday at 8:20 AM for four days, carry-on only. My flight is TP 204 and my seat is 14A. Make me something I can keep by the door.

Then use these short follow-ups:

> Add earbuds to my carry-on and mark Passport packed.

> How long will this be on paper?

> Looks good. Print it.

The final receipt should contain a display heading, countdown, flight facts, destination weather, grouped packing, and a short “before the door” group. Keep it short enough that the whole paper can be read in the editor and held comfortably in the final shot.

## What each judging criterion sees

- **WebMCP leverage:** actual named tool calls, structured situation-to-receipt composition, granular item editing, exact preview, and permission-gated printing show a deep tool surface rather than a single novelty action.
- **Execution:** the same document moves from a finished editor to an exact preview and then to real paper, which proves the product is coherent end to end.
- **Potential impact:** the receipt leaves the screen and becomes a useful, glanceable object near the door, in a pocket, or wherever another screen would be distracting.
- **Creativity and ambition:** a web page and an agent collaborate on a physical artifact, while revision-bound approval makes the unusual output trustworthy.

## Capture plan

1. **Lock the demo state.** Use the real WebMCP host you will name in the submission, the real bridge, and the real printer. Rehearse the exact prompts until the tool sequence and final paper are stable. Record one clean safety take before experimenting.
2. **Record the screen separately.** Capture at 1440p or higher with notifications, bookmarks, debug panels, and unrelated tabs hidden. Keep the app and agent large enough to read on a phone. Leave tool calls and the approval panel on-screen longer than feels necessary while recording; the edit can shorten them.
3. **Record four physical shots.** Get the cold-open macro, a wide laptop-and-printer shot, a side angle of the full print, and a five-second hold of the finished receipt beside the matching screen. Lock focus and exposure on the white paper so it does not pulse while printing.
4. **Record voiceover after the picture edit.** Speak conversationally at roughly 135–145 words per minute. Keep the printer’s real sound at the opening and payoff. Use only original or explicitly licensed jazz, mixed low enough that every technical sentence is effortless to hear.
5. **Finish for judging, not social media.** Burn in accurate English captions, export 16:9 at 1080p or better, and keep the final runtime below 2:45. Upload to YouTube as **Public**, watch the uploaded version once with headphones and once on a phone, then verify that the Devpost link opens while signed out.

## If time collapses

Make a clean two-minute walkthrough with voiceover and one physical cutaway. Start on the final print, show the travel prompt and real draft, make the single-line edit, preview, request approval, approve, and end on the real paper. Cut the landing page, setup flow, block library, headless MCP server, architecture tour, and most code; they are good supporting material for the repository, but they dilute the one interaction the video needs to prove.

## Deadline guardrail

The final video must be public on YouTube and strictly under three minutes. Freeze the submitted video, repository commit, live build, and Devpost entry before **September 3, 2026 at 4:00 p.m. Eastern** and leave the submitted versions unchanged during judging. Use only music and visual assets you have permission to publish; borrow the warm pacing of a product launch film, not another company’s marks, footage, interface, or soundtrack.
