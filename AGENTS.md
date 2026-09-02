# OpenReceipt WebMCP

This repository is the Vite/TypeScript web app, WebMCP surface, and Python printer bridge. Treat `/Users/petepete/Dev/printer-webmcp` as the project boundary. `/Users/petepete/Dev/petes-printer` is a separate repository; inspect or edit it only when the user explicitly asks for cross-repository work.

Keep work focused on the requested surface. Read source files and tests relevant to the change, and leave `node_modules/`, `bridge/.venv/`, `dist/`, `dist-mcp/`, `test-results/`, generated assets, and unrelated dirty files alone unless the task specifically targets them. Do not run the full `check` script for a narrow change unless its broader coverage is useful; prefer the smallest relevant lint, test, build, or e2e command.

Use the existing package scripts as the source of truth for commands. Before changing behavior, inspect the nearby implementation and its tests, then run a focused verification command. Preserve the local-first boundary: browser and agent operations share the revision-checked receipt, while physical printing remains explicitly approved.

For UI work, use plain sentence-case labels and establish hierarchy with size, weight, spacing, and proximity. Reserve uppercase or monospace eyebrow labels for rare metadata that genuinely needs that treatment.

Receipt titles (the name in the editor header and the drafts rail) are not the heading printed on the paper. New blank receipts are named Untitled, Untitled 2, and so on so the shelf is scannable. Agents must pick a short distinctive title when they draft (`draft_receipt`'s `title`) and use `rename_receipt` when the current name is generic. A shelf of receipts all called Today is a bug.

## Challenge sprint — submit Wednesday if possible

Logged 2026-09-01. Submissions close **Thursday, September 3 at 4:00 p.m. Eastern**. Target: freeze the product tonight, spend Wednesday on the video and the entry, keep Thursday morning as buffer. After you submit, do not change the Devpost entry, the submitted commit, or the live URL until winners are announced.

Judges may never click the live app. The video, the public repo, the live URL, and the written entry have to carry the case. Rank everything against that, not against how interesting the leftover product ideas are.

Existing notes to reuse, not rewrite: `docs/research/webmcp-challenge-requirements.md`, `docs/demo-video-screenplay.md`, `docs/research/ai-video-tools-2026.md`.

### How to spend the hours

1. **Tonight — lock the thing that appears on camera.** Name, editor chrome, first receipt, personalization bug, hero slips. Once capture starts, stop changing the product.
2. **Wednesday — video is the job.** Capture, edit with the AI/Remotion path, voice, captions, YouTube. Fill README, GitHub, and the live deploy in the gaps, not instead of the cut.
3. **Thursday morning — only if Wednesday slips.** Devpost submit, watch the uploaded video signed out, confirm the live URL and public repo, freeze. Do not open new product work.

Human vs agent: Pete writes the Devpost prose, records voice, shoots the printer, and makes taste calls. An agent can implement the product fixes, assemble the video project, draft README/setup copy, and produce a field checklist for the entry. Do not have an agent ghostwrite the submission.

### P0 — cannot submit without these

- [ ] **Launch video.** Required, under three minutes, public on YouTube, with audio that explains what was built and how WebMCP was used. Show the real product: agent drafts through named tools, human and agent edit the same receipt, approval, physical print. Screenplay is already in `docs/demo-video-screenplay.md`. Stack: Screen Studio for the app, phone for the printer, Pete's voice, Remotion for assembly/titles, licensed jazz only. Details in `docs/research/ai-video-tools-2026.md`. This is most of Wednesday. If time collapses, ship the two-minute walkthrough in the screenplay's fallback — do not skip the physical print.
- [ ] **Live URL.** The rules require a working site judges can open in ChatGPT's in-app browser or Chrome 149+ with WebMCP. Deploy the public build, set the canonical origin, and confirm `/` and `/app` actually load. The browser-only editor is the judge path; the local bridge is extra.
- [ ] **Public GitHub with LICENSE at the top.** MIT already lives in `LICENSE`. Create the public repo, push, put a one-line description and topics on the GitHub page, and make sure clone instructions in the README work from a cold machine.
- [ ] **README a stranger can follow.** First-time clone, dummy-mode run, public-site vs local-bridge distinction, how an agent uses WebMCP, how to print on the TM-L90, and a short Raspberry Pi note (the bridge already runs there; this is docs, not a new feature).
- [ ] **Devpost entry, written by Pete.** Cover why this is a WebMCP use case, what a person and an agent can now do together, and briefly how the tools are registered. Link the live URL, the public repo, and the YouTube video. English only. Include 3–5 stills: landing, editor, approval, paper in hand.
- [ ] **Judge instructions.** One short paragraph: open the live URL in ChatGPT or Chrome 149+, try the browser editor, and treat physical print as demonstrated in the video. No accounts. Do not make judges install the bridge.

### P1 — freeze tonight so Wednesday's video is honest

- [x] **Lock the name.** Visible product name is **OpenReceipt**, sourced from `content/site.json`. CLI, Python package, env vars, and localStorage keys stay `petes-printer` until after submit.
- [x] **Editor chrome wordmark.** Brand always reads OpenReceipt. The person’s mark lives on the paper, not in the app chrome.
- [x] **First receipt that opens.** Blank template revision 4: logo, “Today”, a date line, and a short checklist. No tutorial copy on the paper.
- [x] **Favorites insert must not reopen the library.** `favoriteInsertPlan` inserts with defaults (home city, starter countdown, etc.) and only opens the library when a required field is still empty.
- [x] **Personalization should read as naming the printer, not a second onboarding.** Two steps. Chrome stays OpenReceipt. Paper wordmark updates. Library “For you” opens only if they picked use cases.
- [x] **Hero receipts on the landing.** Hero slip, packing sample, and countdown sample rewritten; carousel overlays left as-is.
- [ ] **Rehearse the Lisbon flow on the real printer** before capture. Same prompts as the screenplay, same paper, notifications off, WebMCP host visible. One clean safety take first.

### P2 — in the story, but not a new product

- [ ] **Say the Raspberry Pi out loud.** The landing already treats the Pi as the local bridge. Add a short "run the bridge on a Pi beside the printer" section to the README and the TM-L90 guide. Do not build a Pi installer this week.
- [ ] **Hardware honesty.** The tested path is the Epson TM-L90 over USB, 80 mm or 58 mm. Keep claiming only that. Mention the Pi as a host for that same adapter.
- [ ] **Editor pass, not a redesign.** Once the wordmark, first receipt, and insert bug are done, walk the editor once: inspector, library, approval panel, empty favorites, welcome card. Fix only what looks unfinished on camera.
- [ ] **WebMCP visible on the live site.** Confirm tools register on the deployed origin. The shim is for local tests; judges in ChatGPT/Chrome should see the real surface.

### P3 — only after the video is uploaded

- [ ] **Broader printer support.** Tempting, and `python-escpos` can talk to other USB ESC/POS devices if you know vendor/product IDs. Do not ship an untested "works with any printer" claim. If leftover time exists after YouTube is public: an experimental "paste USB IDs" advanced setting, labeled untested, still defaulting to the TM-L90. No GitHub-driver shopping spree this week.
- [ ] **Generic printer picker in setup.** Same constraint: cannot test, easy to over-promise. Defer.
- [ ] **Rename the product.** Defer unless you already locked it in P1.

### Explicitly not this week

Block playground, chart lab, extra blocks, headless MCP polish, network/Ethernet bridge, Brother/label/kitchen printers, accounts, scheduling, and any landing-page redesign. They dilute the one interaction the video has to prove.

### Wednesday capture checklist

1. Lock demo state on the real host, real bridge, real TM-L90.
2. Screen-record the editor + agent at 1440p or higher.
3. Shoot four physical clips: cold-open macro, wide desk, full print, paper beside the matching screen.
4. Voiceover after the picture exists. Clean with Adobe Podcast if needed. Captions reviewed, not auto-only.
5. Export under 2:45. Upload YouTube as Public. Watch signed out on a phone.
6. Paste the link into Devpost. Freeze video, commit SHA, and live deploy.

### Required Devpost fields to fill (Pete writes)

Why WebMCP fits. What a person can do. What an agent can do. How the tools are implemented (browser `modelContext`, eleven tools including `rename_receipt`, revision-checked receipt, approval-gated print). Built during the challenge; dated commits are the evidence. Links: live URL, GitHub, YouTube. Testing notes. Stills.
