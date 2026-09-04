# B-roll manifest

Editorial rule this session held to: most beats stay pure product UI. Only two beats in the whole film get B-roll — everything else is real screen capture, real physical footage, or nothing. B-roll exists to create contrast at the two places the story genuinely leaves the screen, not to decorate the whole cut.

Sourced via Pexels MCP. All clips landscape HD (1920×1080), downloaded to `edit/public/broll/`. Pexels attribution is optional under their license but included here as good practice.

## Beat 1 — `hook` (0.00s–1.81s), before any UI appears

One quiet, observational shot — the aspiration, before the product. Used 1–2s, then hard cut to the real agent prompt.

| File | Source | Creator |
| --- | --- | --- |
| `surf-aerial.mp4` | [pexels.com/video/2867957](https://www.pexels.com/video/people-surfing-2867957/) | Evgenia Kirpichnikova |

Replaced an earlier wax-closeup pick — Pete's call, the aerial reads better as the opening image than a tight hands-on-board close-up does.

## Beat 2 — `same-flow` (56.64s–65.68s), "grocery list, morning brief, reminder, meeting notes"

The one place a quick montage genuinely serves the line, instead of more UI. Three clips, ~1.5s each, hard cuts, no crossfades.

| File | Source | Creator | Line it covers |
| --- | --- | --- | --- |
| `grocery-cloth-bag.mp4` | [pexels.com/video/4828738](https://www.pexels.com/video/using-reusable-cloth-bags-in-buying-fruits-4828738/) | Ketut Subiyanto | "a grocery list" |
| `coffee-pour-morning.mp4` | [pexels.com/video/7594672](https://www.pexels.com/video/person-pouring-coffee-into-a-cup-7594672/) | Mikhail Nilov | "a morning brief" |
| `sticky-note-writing.mp4` | [pexels.com/video/10797881](https://www.pexels.com/video/close-up-on-writing-on-sticky-notes-10797881/) | Ramon Hughley | "a reminder" |

Left out a fourth clip for "meeting notes" deliberately — every candidate that matched showed people at a table (staged office/teamwork territory, on the brief's avoid list). Three clean clips beat four with one weak link.

## `end-card` (75.31s–78.18s) — the site's own hero recipe, not new B-roll language

| File | Source | Creator |
| --- | --- | --- |
| `street-murals-walk.mp4` | [pexels.com/video/12886093](https://www.pexels.com/video/a-narrow-street-decorated-with-murals-and-garlands-12886093/) | Matthias Groeneveld |

Full-bleed lifestyle shot with the real receipt overlaid on top — this is exactly the landing page's `.moments-hero` treatment (full-bleed photo, multi-stop dark scrim for legibility, receipt to one side with a drop-shadow, no other chrome), reused rather than a new look invented for the film. See `Direction-End-Card` in `edit/src/studies/DirectionStudy.tsx`; confirmation still rendered.

## Deliberately no B-roll

`ask-agent` through `preview` (the entire WebMCP proof — draft, edit, preview): pure product UI, this is the technical evidence and B-roll would dilute it.
`print` / `autonomous-aside`: Pete's own real printer footage, not stock — more authentic than anything sourced.
`carry-it` / `badges`: Pete's own real physical payoff (tear, carry, use) — same reasoning.
