# Prose Force and Rhythm run — 2026-09-01

This is the working record for the four public guides. The drafts are explanatory workshop pieces for curious makers who may know software or hardware, but not necessarily printers. Risk class is **HIGH** for the run because it includes USB safety, printer compatibility, and thermal-paper chemistry; the claim-strength invariant is therefore a hard block.

```yaml
# derived operational defaults, not published Hart figures
register: explanatory
audience: curious makers and first-time thermal-printer buyers
risk_class: HIGH
sentence_length_mean: [14, 21]
sentence_length_sd_min: 7
short_sentence_per_words: 150
long_sentence_ceiling: 45
consecutive_similar_max: 2
brevity_cut_target: [0.10, 0.20]
brevity_cut_alarm_low: 0.05
brevity_cut_alarm_high: 0.30
numbers_per_sentence_max: 2
numbers_per_paragraph_max: 4
readability_target: general readership; technical terms defined on first use
```

The thresholds above are derived operational defaults, not figures published by Jack Hart. They diagnose the prose; they are not targets to optimize.

## Claim ledger before line editing

The table records every material claim class in the drafts. Repeated instructions that restate the same sourced fact share an ID.

| ID | Claim before editing | S | Strength marker | Source | Status after edit |
| --- | --- | --- | --- | --- | --- |
| P1 | “The best thermal printer for an AI project is a dependable ESC/POS receipt printer…” | S2 | editorial recommendation | Product constraints and tested hardware | Reframed; no universal “best” claim |
| P2 | Pete’s Printer’s physically tested choice is the Epson TM-L90 over native USB. | S5 | “physically tested” | Shipped adapter and workshop unit | Preserved |
| P3 | The TM-L90 prints at 203 dpi and exposes a 576-dot width on 80 mm paper. | S5 | exact specifications | Epson TM-L90 manual | Preserved |
| P4 | ESC/POS support varies by command, endpoint, code page, cutter, and image mode. | S5 | scoped technical fact | Epson documentation and printer profiles | Cut; the buying guide no longer needs the protocol inventory |
| P5 | Native USB or Ethernet is easier to automate than consumer Bluetooth or a serial adapter. | S2 | comparative judgment | Transport behavior; no benchmark | Narrowed to workshop preference |
| P6 | An 80 mm canvas gives structured output more room than 58 mm. | S2 | design judgment | Pete’s Printer layouts | Preserved |
| P7 | Cheap anonymous printers may change internals without changing their listing name. | S1 | “often” implied, no cited sample | None | Cut; reporting gap left open |
| P8 | Raster printing is a useful common path for agent-created receipts. | S2 | “useful” | Current renderer and driver libraries | Preserved, with “black-and-white image” explanation |
| P9 | The shipped adapter uses python-escpos, bitImageRaster, feed, and cut. | S5 | code-level assertion | Repository source | Preserved, jargon reduced |
| P10 | python-escpos supports USB, serial, network, and file transports. | S5 | repository feature list | python-escpos repository | Cut; it did not help the product-first choice |
| P11 | A printer profile is a hint, not a guarantee that a model works. | S5 | attributed limitation | python-escpos documentation | Replaced by explicit supported/unsupported wording for each named model |
| P12 | Pete’s Printer currently has one TM-L90 USB adapter and no network adapter. | S5 | current-state assertion | Repository source | Preserved with date/current wording |
| P13 | The Epson TM-U220 is an impact kitchen printer with heat- and moisture-resistant media. | S5 | named product specification | Epson TM-U220II product page | Added from new reporting |
| P14 | Brother documents raster and template integration routes for parts of its QL label line. | S5 | named vendor support | Brother developer program | Added from new reporting |
| T1 | Pete’s Printer lays out 80 mm at 576 dots and 58 mm at 420 dots. | S5 | exact current profiles | Repository source | Preserved |
| T2 | The nominal paper width differs from the printable width. | S5 | technical distinction | Epson manual | Preserved |
| T3 | 80 mm paper suits tables and multi-section output; 58 mm suits short notes and smaller objects. | S2 | editorial recommendation | Workshop layouts | Preserved, softened to use cases |
| T4 | Scaling a 576-dot image down can shrink strokes and lose one-pixel detail. | S5 | rendering behavior | Renderer geometry | Cut; the shorter article explains that the app reflows instead |
| T5 | Pete’s Printer reflows blocks separately at 420 and 576 dots. | S5 | code behavior | Repository source | Preserved |
| T6 | BPA has been restricted in EU thermal paper since January 2020. | S5 | dated regulatory fact | ECHA | Added from new reporting |
| T7 | BPS commonly replaced BPA and is also a health concern. | S5 | attributed regulatory finding | ECHA | Added with attribution intact |
| T8 | “BPA-free” does not necessarily mean phenol-free. | S5 | substitution distinction | ECHA | Added |
| T9 | Developer-free Blue4est paper is sold in 48 and 52 gsm stocks. | S5 | named product specification | Koehler Paper | Added |
| T10 | A heavier roll feels more substantial, but paper thickness and roll diameter must fit the printer. | S2/S5 | subjective feel plus manual constraint | Workshop judgment; Epson manual | Added with the two claims separated |
| S1 | The tested setup expects USB ID 04b8:0202, interface 0, OUT 01, and IN 82. | S5 | exact code values | Shipped adapter | Preserved |
| S2 | TM-L90 interface boards can differ. | S5 | scoped model variation | Epson interface documentation | Preserved |
| S3 | The bridge binds to 127.0.0.1 and stores receipt and job state locally. | S5 | current architecture | Repository source | Preserved; “bridge” defined first |
| S4 | Dummy mode proves rendering and application flow but not USB, feed, or cutter behavior. | S5 | bounded test claim | Repository source | Preserved |
| S5 | Linux may need a device-specific udev rule for unprivileged USB access. | S1/S5 | conditional “may”; standard mechanism | python-escpos installation guide | Preserved |
| S6 | A failure after transmission begins is recorded as unknown to avoid duplicate printing. | S5 | current state-machine behavior | Repository source | Preserved |
| A1 | Browser WebMCP and headless MCP use the same receipt tool definitions. | S5 | architecture assertion | Repository source | Preserved; terms defined |
| A2 | Every receipt edit advances a revision, and approval binds to one revision. | S5 | current state behavior | Repository source | Preserved; “revision” explained as version number |
| A3 | The default policy confirms every agent print. | S5 | current default | Repository source | Preserved |
| A4 | Weather, news, and market text cannot become printer commands. | S5 | validation boundary | Repository source | Preserved |
| A5 | A post-transmission timeout cannot distinguish a partial, complete, or absent physical print. | S2 | uncertainty inference | Transport semantics | Preserved without stronger wording |

No claim was promoted during line editing. New S5 claims entered only after new primary-source reporting; they are marked “Added from new reporting.”

## Pass 1 — Structure

### Escalations

1. **Defect:** the printer article promised a single “best” answer before asking what the reader wants to make. **Real class:** structure. **Why the line pass cannot fix it:** the organizing question and section order are wrong. **Target:** article brief. **Status:** resolved by a product-first decision tree covering desk receipts, small objects, kitchens, and labels.
2. **Defect:** the paper article treated width as the whole purchase and omitted coating chemistry and stock feel. **Real class:** reporting and structure. **Why the line pass cannot fix it:** the missing material needs sources and new sections. **Target:** primary-source research and article brief. **Status:** resolved with ECHA, Koehler, and Epson material.
3. **Defect:** four large guide cards made the landing page read like a search-content block. **Real class:** information architecture. **Why the line pass cannot fix it:** this is page hierarchy, not prose. **Target:** landing layout. **Status:** resolved by moving one workshop link to the footer.

### Reporting gaps

- No other printer bridge has been physically tested in Pete’s Printer. Other models remain future adapter candidates, not compatibility claims.
- GSM alone does not establish whether a roll fits. The printer’s paper-thickness and roll-diameter limits remain the controlling specifications.
- The previous warning about anonymous printers changing internals had no cited sample and was removed.

## Pass 2 — Force

The pass moved actions back onto named subjects: Pete’s Printer draws at a paper width, the bridge stores and sends a job, and the TM-L90 feeds and cuts it. It removed abstract or personified subjects such as “the current path owns the safety model” and “a wide receipt asks for room.” The passive construction around USB permissions stayed where the actor varies by operating system; inventing an administrator would have changed the claim.

No verb was strengthened past its source. The pass declined to turn “plausible future bridge” into “compatible printer,” because an upstream profile is evidence of an ecosystem candidate rather than Pete’s Printer support.

## Pass 3 — Brevity

Captured body-word snapshots moved as follows: paper 570 → 518 (-9.1%), printer 732 → 516 (-29.5%), setup 669 → 701 (+4.8%), and agent workflow 676 → 678 (+0.3%). Aggregate copy fell 8.8%. Two files received newer concurrent drafts during the run, so these figures describe the editorial snapshots rather than a clean single-pass diff.

The printer guide approaches the 30% proposition-diff alarm. Its removed material was checked against the ledger: volatile prices, anonymous-printer generalizations, and protocol inventory were cut; the tested TM-L90 claim, future-driver boundary, and purchase checks remain. The setup and agent guides triggered the low-cut diagnostic because definitions and safety boundaries added necessary words. The pass declined to cut those claims or any load-bearing qualifier to reach a percentage.

## Pass 4 — Clarity

The pass defined “bridge” before using it, translated revisions into version numbers, and separated printer-dot widths from nominal paper widths. It also split compound evidence claims so one citation does not appear to prove more than it does.

### Clarity split log

- Brother’s developer documentation and the maintained `brother-ql` driver now support separate sentences.
- ECHA’s dated BPA restriction and its report on BPS substitution now appear as separate claims.
- Koehler’s developer-free process and its 48/52 gsm product options now appear as separate claims.
- The bridge’s “printed” result now says that sending finished without an error; it does not claim the printer physically confirmed the paper.

## Pass 5 — Rhythm

```text
RHYTHM DIAGNOSTICS (prose paragraphs only; derived defaults, not published Hart figures)
paper:   27 sentences, mean 15.4 words, SD 6.2, 1 under 8, 0 over 45
printer: 30 sentences, mean 13.3 words, SD 7.2, 9 under 8, 0 over 45
setup:   45 sentences, mean 12.6 words, SD 5.7, 10 under 8, 0 over 45
agent:   39 sentences, mean 14.1 words, SD 5.0, 6 under 8, 0 over 45
```

Read as: the procedural guides use short sentences and genuine lists, while the paper guide carries more connected explanation. The pass merged one adjacent pair in the paper discussion and one in the agent workflow, then varied clause shape around the most technical explanations. It did not merge anything in the clarity split log. It also declined to pad sentences, add fragments, or smooth the four guides into identical cadence.

## Pass 6 — Humanity

The guides now name the workshop unit, Epson, Brother, Koehler, `python-escpos`, and the person beside the printer. First-person details appear only where the material supports them: the tested USB path, the preferred dummy-mode check, the desk roll, and the short approval chain. A second system-protagonist sweep removed intent from paper, bridges, and layouts.

## Pass 7 — Color

The pass kept concrete details that carry evidence: the USB ID, 420/576-dot profiles, the plastic paper spacer, the 24 V power brick, a roll in the printer and two in the drawer, and the kitchen printer’s ribbon and plain paper. It added no decorative sensory detail and declined to invent original photos, print speeds, used-market prices, or durability anecdotes.

## Pass 8 — Voice

All four guides now use the same explanatory workshop voice: direct answer first, ordinary language before protocol names, first person for tested experience, and firm boundaries around future support. The pass did not “add personality” with jokes, forced slang, or extra asides.

## Pass 9 — Mechanics

The pass standardized American spelling, sentence-case headings, model names, units, link punctuation, and the use of “phenol-free” versus “BPA-free.” It also corrected subject agreement and rechecked every changed source claim after Voice.

## Pass 10 — Slop audit

The 13 internal checks ran in order. The lexical and signpost sweeps found none of the forbidden stock phrases. Excess negated contrasts were rewritten as direct statements; genuine classifications and procedures stayed as lists. Parallel threes were broken where they sounded performed, while the three paper-buying dimensions and three print outcomes stayed because the material is actually list-shaped. The participial-tail and hedge-stack scans were clean. Specificity came from named models, dates, widths, and sources; no missing detail was invented. Burstiness remained diagnostic, affect stayed calm but not flat, pull-quote closures were removed, and formatting stayed sentence case without decorative headings.

The meaning recheck caught one overstatement and reverted it: “the printer confirmed the complete job” became “the bridge finished sending the job without an error.” Mechanics was re-run on every audit edit. No epistemic hedge or attribution was removed.

### Slop signatures

| Signature | Result |
| --- | --- |
| S1 meta-framing opener | Clean |
| S2 list-carrying argument | Clean; lists are product classes, checks, actions, or ordered steps |
| S3 zombie nouns | Clean; each guide is below one suffix hit per 100 words |
| S4 generic examples | Clean; the examples name printers, widths, and a specific packing receipt |
| S5 no first-person | Clean; the rule is not required for these how-to pieces, and workshop experience is present |
| S6 prompt residue | Clean |
| S7 outline-shaped paragraphs | Clean; paragraph shapes and lengths vary |
| S8 hedge cluster | Clean; no sentence contains two rhetorical weakness hedges |
| S9 buzzword stuffing | Clean |
| S10 flattened uncertainty | Skipped because there is no `corpus/drafts/notes/` input |

## Claim-strength diff and rubric check

No claim rose on the S1–S5 ladder. One silent strength move around physical print confirmation was reverted, sourced facts were not padded with new hedges, and every future printer remains labeled as unsupported today. No rounding occurred.

Weighted rubric self-score: Pass Order 5, Claim Strength 5, Hedge Protection 5, Escalation 5, Metrics 5, Provenance 4, System Protagonists 5, Slop Audit 5. Weighted average: **4.9/5**, above the required 3.5.
