# OpenReceipt — WebMCP Challenge demo

**Target 2:40. Hard ceiling 2:59.** Under three minutes is a rule, not a preference.

One situation, told once, all the way through: a surf trip to Portugal, a week out. A person asks an agent for help, the agent builds a real document through named WebMCP tools, the person and the agent both edit it, and it ends up as paper that goes in the board bag.

The emotional spine is one sentence: **the trip is the easy part; remembering everything is not.** The admin between you and the water gets handled, and then it leaves the screen. Everything in the cut either serves that or comes out.

The receipt is real and already built — `video/assets/generated/surfing-trip.json`, drafted live through the tools and saved as **Surfing Trip**. Its measurements are **576 dots wide, 277 mm of paper** at revision 7. Reconfirm both after the final rehearsal and burn in whatever the capture actually says; live blocks bump the revision on their own.

## Shape

| Section | Time | Job |
| --- | --- | --- |
| Sizzle | 0:00–0:18 | The whole product with no explanation. Beat-cut. Ends on the wordmark. |
| Situation | 0:18–0:32 | Why anyone would want this. The only slow part. |
| Collaboration | 0:32–2:04 | The proof. Named tools, one shared document, both hands on it. |
| Object | 2:04–2:42 | Approval, the printer, and the paper doing its job. |
| End card | 2:42–2:50 | Name, line, links. |

The challenge notes say the first 15 seconds must carry the agent-to-paper payoff, because judges may not watch further. The sizzle is that insurance: it shows the ending before the story starts.

## The cut

| Time | Picture | Voice | On screen |
| --- | --- | --- | --- |
| 0:00–0:04 | Black. Printer motor alone. Hard cut to paper feeding, macro. | — | — |
| 0:04–0:16 | Beat-cut montage, one image per beat: prompt being typed, blocks landing, `draft_receipt`, the surf chart drawing itself, approval panel, approve click, paper feeding, hand tearing, pen ticking a box. | — | Tool names flash with the images |
| 0:16–0:20 | Ground. Shapes settle. | — | **OpenReceipt** / A printer your agent can reach. |
| 0:20–0:32 | The real desk. Printer idle. Slow — let it breathe after the sizzle. | "A week from Thursday I fly to Lisbon, pick up a car, and drive up the coast to Ericeira to surf. The trip is the easy part. Remembering everything is not." | — |
| 0:32–0:50 | Screen: the prompt typed into the agent, then real tool activity. | "So I asked. And the agent isn't clicking around my page or scraping the DOM — this page registers eleven tools through WebMCP, so it can ask OpenReceipt what a trip receipt is actually made of." | `list_receipt_recipes` / WebMCP connected |
| 0:50–1:14 | The receipt assembling. Punch: the countdown, then the arrival rows, then the weather, then **the surf chart drawing itself**. | "One call. A countdown. Where the car is and how far the drive is. The forecast where I'm actually going, not where I live. And a swell chart, which I didn't ask for — but the page knows a surf block exists, so the agent used it." | `draft_receipt` |
| 1:14–1:32 | He clicks into a line and retypes it himself, in the editor. | "The rental desk is wrong. I fix that myself, on the same document. I don't have to ask." | One shared document |
| 1:32–1:54 | Second prompt. One line changes. Agent highlight and Undo visible. | "And when I do ask, it changes one line. It doesn't replace the block I was just typing in. We're both working against the same revision, and it's checked both ways — if my copy is stale, the edit is refused." | `get_receipt` → `edit_receipt` |
| 1:54–2:04 | He ticks two boxes in the editor. | "I can tick things off right here." | — |
| 2:04–2:24 | Preview response with the real numbers. Then the approval panel, held long enough to read every field. | "Before anything physical happens it reads back the exact print — 576 dots wide, 282 millimetres of paper. Then it stops and asks. Printing is the one thing the agent can't do on its own." | `preview_receipt` · 576 dots · 282 mm / `request_receipt_print` |
| 2:24–2:32 | Approve click. Match cut to the real printer. | "Approval is bound to this exact revision. If I edit now, the request dies — an approved draft can't drift." | Human approval required |
| 2:32–2:44 | Printer running, paper emerging, hand tears it. Then a pen ticking a box on the printed list. | "…and then it's paper. Which is what I want in a board bag, on a beach, with wet hands and no signal." | — |
| 2:44–2:52 | The receipt tucked into the board bag or by the door. End card. | "A conversation became something I can hold. That's new." | **OpenReceipt** / A printer your agent can reach. / Built with WebMCP · MIT · [live URL] |

## The prompts to run on camera

Rehearse once, then record. These produce the receipt already saved as **Surfing Trip**.

> I'm flying to Lisbon on the 10th, then driving up to Ericeira for a week of surfing. Make me something I can keep in the board bag.

Then **make one direct edit by hand** — click into the `Car` row and change the desk number. This is the single most important shot in the film: it is what proves a person and an agent are working on the same document rather than taking turns with a chatbot.

> The evening session looks best — move sunscreen into the board bag and add a line to check the tide before dinner.

> How long will this be on paper?

> Looks good. Print it.

## What is on the paper

**PETE'S / PRINTER** as the wordmark, then **Surf trip** as the display heading, then a solid rule. After that, three sections separated by dashed rules:

1. **Countdown** — seven days to "Wheels up", with board bag, check-in and car as milestones.
2. **Packing** — grouped into board bag, wetsuit, carry-on, and before-the-door, with checkboxes.
3. **Getting there** — a section header over five facts: flight, landing, rental desk, the emphasised 50-minute drive, and when the keys are available.
4. **Surf window** — the swell chart, last.

The order is by when you actually use it: count the days, pack the bag, travel, then surf. A trip receipt read top to bottom should walk you through the trip.

Dashed rules separate the sections and a solid rule closes the masthead, so the strip has a visible rhythm instead of being one continuous column. `Getting there` is a `section` heading; `Packing` and `Surf window` carry their own headers from their blocks, so adding more would double up.

Everything on it has to be information. The heading says what the trip is, not where it is — a stranger reads "Surf trip" instantly and finds Ericeira in the drive row and the swell header. There is no subtitle line, because a line that only sets a mood is taking up paper someone has to carry.

**The weather block came out.** It and the surf block are both line charts with a three-column stat row underneath, and side by side on an 80 mm strip they read as the same block twice. Surf is the one that is distinctive, that is the reason for the trip, and that makes the WebMCP argument. The packing list already encodes the clothing decision the forecast would have informed. Putting it back is one `edit_receipt` call if the paper feels thin without it.

The surf block is the beat that sells WebMCP hardest, and it is worth the punch-in. The agent did not invent a chart: it asked the page what blocks exist, found `surf`, and used it. That is the whole argument for structured tools over DOM scraping, visible in one image.

The wordmark always prints in caps, whatever anyone types, and its face is the one chosen in personalisation rather than anything an agent picks. Both are enforced in the product now, so the paper cannot come out looking like it was signed by six different shops.

## Say something true

Speak at 135–145 words per minute, conversationally. The script is about 260 words, which leaves room to breathe. Do not read the on-screen copy aloud — titles locate evidence, the voice carries the story.

## What each judging criterion sees

- **WebMCP leverage** — named tools doing real work: recipe lookup, structured drafting, granular revision-checked editing, exact preview, permission-gated printing. Five distinct capabilities, not one novelty action. The stale-revision refusal is worth a sentence because almost nothing else in the field has it.
- **Execution** — the same document travels from a finished editor through an exact preview to real paper without a seam.
- **Potential impact** — the receipt leaves the screen and becomes useful where a screen is bad: wet hands, bright sun, no signal.
- **Creativity and ambition** — a web page and an agent collaborate on a physical object, and revision-bound approval is what makes an unusual output trustworthy.

## Rules that constrain the cut

- Under three minutes, public on YouTube, audio explaining what was built and how WebMCP was used.
- No third-party trademarks or copyrighted material without permission. The agent host's interface appears incidentally because that is where the tools run, which is nominative use of the thing we interoperate with — but keep its chrome incidental. No host logo in a title card, no host name in the end card, nothing implying endorsement.
- Music must be original or explicitly licensed for public promotional use, with the licence recorded in `video/assets/audio/`.
- Every product claim in the voice track must be visible in captured footage in the same breath.

## If time collapses

Cut the sizzle to eight seconds and the situation to one sentence. Never cut: the named tool call, the human's own edit, the approval panel, or the paper. Those four are the submission.
