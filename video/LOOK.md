# Visual and sound direction

The film is a **product launch sizzle reel** staged on paper. Warm ground, real capture in cards that travel and settle, geometric shapes carrying the rhythm, hard punches into detail, and cuts that land on the beat.

Two references, and they do different jobs. The **material** comes from the layered-paper treatment on Cognition's blog thumbnails: a warm ground, real stock, real contact shadow. The **energy** comes from a feature-announcement film: shapes moving, type arriving on the beat, a card flying in and snapping flat, a punch into the thing being named, a ring on the click that mattered.

We take the medium from one and the pacing from the other. We take nobody's palette, marks, layout, or soundtrack. Nothing here should be recognisable as another company's.

## Cut to the music

Time is measured in **beats, not seconds**. `music.bpm` in `shot-plan.json` sets the grid; `beat(n)` in `edit/src/theme.ts` converts. Every arrival, every cut, every shape entrance takes a beat number. Retiming the film to a different track is a change to one value, not a pass over every delay.

100 BPM is the provisional grid because it lands on exactly 18 frames at 30 fps, so nothing drifts a half-frame per beat. Choose a track near it.

Rhythm rules that make it read as cut-to-music rather than merely fast:

- Arrivals land **on** the beat, not near it. Something should happen on most downbeats.
- Vary the density. The `structured-draft` passage cuts every two beats; the approval holds for a whole bar and a half. A reel at one speed throughout stops registering as rhythm.
- Transitions are a **solid edge wiping through**, on the beat. A dissolve reads as filler; a wipe reads as a decision.
- Nothing important arrives between beats. If a tool name or a measurement lands off-grid, the eye reads it as an accident.

## The frame is a card, until it isn't

`shot-plan.json` gives every sequence a `fill` value: how much of the frame the capture occupies. `<Card fill>` in `edit/src/plate/Card.tsx` is the only thing that reads it.

| Beat | `fill` | What it looks like |
| --- | --- | --- |
| Cold open, premise | 0.55 → 0.6 | Shapes and type carry the claim; the card drops in on the bar. |
| Editor → preview | 0.68 → 0.9 | Cards travelling and settling, growing as the software takes over. |
| Approval | 0.62 | Card pulls **back** and tilts, so the type gets ground of its own. Longest hold in the film. |
| Print | **1.0** | Bare. No card, no shapes, no type. Nothing between the viewer and the proof. |
| Resolution | 0.6 | Shapes return; the end card is the wordmark on the ground. |

A card arriving is rarely square to frame; a card at rest always is. It travels in from a tilt and an offset, then snaps flat on the beat.

## Two materials, never one

Parchment is the world. Thermal receipt is the product. The difference is load-bearing: when the on-screen strip cuts to the physical strip, they have to be visibly the same material.

| | Parchment (the world) | Thermal receipt (the product) |
| --- | --- | --- |
| Colour | `#EFEBE2`, warm, mottled | `#FDFDFE`, bright, faint cool cast |
| Surface | Fibrous, cloudy, matte relief | Smooth coated, near-flat, faint sheen |
| Noise | Two-octave turbulence plus mottling | Almost none — a whisper of coating grain |
| Edges | Torn (fibrous, light inner rim) and cut, mixed | **Serrated** tear-off, dead-straight slit sides |
| Form | Flat sheet, slight corner warp | Curls — lifts at the ends, never dead flat |
| Shadow | 2px contact plus wide warm ambient | Tight contact that releases where the strip lifts |

**The receipt never wears parchment.** No fibre, no mottling, no warm cast, no torn edge. If a frame makes the receipt look like the ground it sits on, the frame is wrong.

Stock choices live in `edit/src/paper/filters.tsx` as named variants (`laid`, `cartridge`, `kraft`, `vellum`; `coated`, `matte`). Render the `Paper-Study` still to compare them at full size — paper that survives a thumbnail often dies at 100%, and the reverse.

## Making software paper look real

Nothing here is photographed or licensed; it is all generated. The failure mode is a noise overlay that reads as digital grain. What actually works:

**Parchment** — fibre *and* cloudy mottling combined into a height field, then `feDiffuseLighting` with a **low** `elevation` raking across it. The lighting pass is the step people skip, and it is the one that turns a texture into a surface; a light from overhead flattens paper into card. The result then needs a `feComponentTransfer` contrast expansion before it is blended, or `overlay` has nothing to bite on. Add sparse dark flecks, a lighter inner rim on torn edges, per-sheet rotation of a fraction of a degree, and a mirrored show-through where one sheet lies over another.

**Thermal** — restraint. Single-octave coating grain at 1–2%, no mottling, no fibre. Over-texturing here is what makes CG receipts look like paper towels. The realism lives in the serrated edge and in the curl, and the curl is shading rather than geometry: the sheet turns away from the light at the ends, so it darkens there and catches a highlight just inside.

**Both** — two shadows per sheet, always. One shadow floats; two shadows sit. Use `filter: drop-shadow()` rather than `box-shadow` so a torn edge casts a torn shadow.

**Frame grain** over the whole composite at 3–5%, refreshed on 2s. Without it the composite stays vector-clean and every other trick collapses.

**Pin every noise filter** to `x/y/width/height = 0%/0%/100%/100%`. `feTurbulence` fills the entire filter region, which defaults to 120% of the box, and that overspill escapes as a dark ragged fringe around torn sheets.

## Frame language

Full-bleed interface footage for proof, then crop to the receipt or tool call when the narration names it. Keep the active detail inside the centre 80% so it stays readable on a phone. A crop settles before the important action and holds afterwards; constant drift makes the interaction harder to verify.

Move between digital and physical through visual matches: the tall white receipt on screen cuts to the tall white receipt leaving the printer; the approval button cuts to the printer waking. Prefer hard cuts, short dissolves, and motivated pushes. No decorative wipes, no synthetic depth, no floating glass, no generated B-roll — they make a working product look like a concept render.

**Footage is never tinted or graded to parchment.** The app stays cool grey-white; the thermal paper stays white. A cool screen on a warm ground is literally "screen sitting on a desk", and flattening the two would throw away the only place the worlds meet.

## Colour and type

| Token | Value | Use |
| --- | --- | --- |
| `ground` | `#EFEBE2` | Parchment |
| `groundSecond` | `#E4DFD3` | Layered sheet, shapes |
| `ink` | `#141210` | Type — never pure black, because printed ink never is |
| `graphite` | `#5B564E` | Secondary type, rules |
| `thermal` | `#FDFDFE` | Receipt stock |
| `tint` | `#0071E3` | **Inherited only** |

The blue is the product's own, and it appears only where the captured UI already uses it: the approval button, the agent chip, the name of a tool the agent just called. Nothing is invented in this colour. That restraint is what makes the accent mean "this is the actual software" every time it shows up.

**Inter, and nothing else.** Weight carries the hierarchy: 800 for the lines that shout, 700 for headlines over footage, 500 for support. Tracking tightens as size grows, the way it must for a grotesque set large.

No display face. The product and the printed receipt are both set in Inter (`src/receipt/layout.ts` sets every glyph on the paper), so the film shares their type rather than performing alongside it. There is no monospace anywhere in this product; do not invent one for the film.

Sentence case, six words or fewer, next to the evidence it names, gone once read. `Hero` is two or three words and never a sentence.

`ToolTag` is the one exception to everything above: a solid blue pill naming a WebMCP call. It is the only place the product blue appears outside captured UI, and only because the captured UI already uses it for exactly this. In a reel, a tool call is an event, so it snaps in with overshoot rather than fading.

## Motion

Shapes and cards travel on `arrive`, a sprung curve with a little overshoot. The camera **punches** rather than drifts — a crop that is still moving makes an interaction harder to verify, which defeats the point of showing it.

Shapes exist to carry rhythm. They enter on the beat, sit under or beside the evidence, and leave. They are drawn only from the ground tones and the product's blue: a shape in an invented colour reads as motion-graphics garnish stuck on top, while a shape in the film's own material reads as the film moving itself around.

Three devices earn their place because the capture cannot do them:

- **Punch** — `Camera` crops to the receipt, the tool call, the approval field, when the narration names it.
- **Click ring** — marks where a real click happened, then expires. The capture already has a real cursor; inventing a second one would be fabricating interface behaviour.
- **Spotlight** — dims everything but one rectangle, for a detail a crop cannot reach, like a single changed checklist line.

Named tools, the preview dimensions, and the approval panel each get at least a bar settled. The approval gets the longest hold, because it is the shot that proves the safety model.

## Sound

The music is structural here, not background: the whole film is cut to its grid, so pick the track before the final assembly and set `music.bpm` from it. Something with a clear, steady pulse — the cuts have to be able to land on something the ear can find.

Open on the printer motor alone for about a second, then bring the track in under the first line. Duck it whenever the narration explains WebMCP, preview, or approval, and let the real printer rise again at the match cut. Aim near −14 LUFS integrated with peaks below −1 dBTP, but keep natural speech dynamics rather than chasing the meter.

No transition needs a synthetic whoosh. Paper handling, button contact, printer startup and the motor are a more specific vocabulary — and tear and handling foley can be pulled from `physical-tear` and `printer-sfx` rather than recorded separately.

## Still-review test

Every representative frame must answer one question immediately: what changed, what tool acted, what the person approved, or what became physical. Reject a frame if the relevant UI cannot be read at phone size, if type collides with the capture it is meant to annotate, if the title repeats the narration instead of locating evidence, if the receipt has started to look like the ground it sits on, or if the treatment could belong to any generic AI product.

Then watch it once with the sound off and once at phone size. With the sound off, the cuts should still feel placed rather than arbitrary — if they do not, the arrivals have drifted off the grid.
