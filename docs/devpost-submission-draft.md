# Devpost submission draft

This is a working draft for the OpenReceipt submission. Nothing has been entered into Devpost.
Replace bracketed values before pasting. The character limits below match the visible form.

## Submission checklist

- [ ] Project name
- [ ] Elevator pitch
- [ ] About the project
- [ ] Built with tags
- [ ] Demo, repository, and live URL
- [ ] Thumbnail and image gallery
- [ ] Video link
- [ ] Judge-only fields
- [ ] Final review and manual submission

## Project overview

### Project name

`OpenReceipt`

60 characters maximum.

### Elevator pitch

`OpenReceipt lets an AI agent and a person shape the same receipt, then approve a real thermal print.`

99 characters.

## Project details

### About the project

```markdown
## What we built

OpenReceipt is a local-first receipt editor where a person and an AI agent make the same piece of
paper together. The agent can turn a situation—a trip, a morning, a reminder, or a shopping run—into
a structured receipt. The person can edit the receipt directly, see the exact printer preview, and
approve the physical print.

The result is a small document that can leave the screen. It can sit by the door, go into a pocket,
or stay beside a task while someone works through it.

## Why WebMCP fits

The useful action here is not asking an agent to click buttons. It is giving the agent a clear,
structured interface for making a document with a person. OpenReceipt registers WebMCP tools for
the receipt operations an agent actually needs: checking the app state, choosing a receipt recipe,
drafting a receipt, editing a block or individual checklist item, renaming the receipt, previewing
the exact output, undoing an agent edit, and requesting a print.

The person and the agent operate on one revision-checked receipt. If the person changes the paper
while a print request is waiting, that request becomes stale rather than printing an older version.
The agent can update one item inside a checklist or grouped list without replacing the whole block,
so a small agent edit does not erase a person’s work.

## How it works

The browser exposes the tools through `document.modelContext` when WebMCP is available. The same
tool definitions also power the headless MCP server. Both surfaces use the same receipt model and
renderer.

The local bridge stores the active receipt, settings, events, and print jobs in SQLite. OpenReceipt
renders the approved document as an SVG and monochrome PNG at the selected printer width, then the
bridge sends that image to an Epson TM-L90 over USB. Printing stays local and requires explicit
approval by default; there is no account or cloud print queue in this release.

The public browser experience works without the bridge, so people can explore the editor and WebMCP
tools without hardware. Physical printing uses the same app served locally beside the printer. The
tested hardware path is an Epson TM-L90 over USB with 80 mm or 58 mm paper. A Raspberry Pi can run
the local bridge beside the printer as a permanent host.

## What we learned

The hard part was not drawing text on receipt paper. It was keeping the browser, agent, renderer,
and printer honest about which version of a document they were handling. Revision checks make
concurrent human and agent edits explicit. Rendering from the same document state makes the preview
meaningful. Approval turns printing into a deliberate action instead of an irreversible side effect
hidden behind an agent call.

We also learned that tool granularity matters. A tool that rewrites an entire checklist is easy to
implement but unsafe when a person is editing the same receipt. Item-level operations preserve the
surrounding work and make the collaboration feel like editing one document rather than handing the
agent a separate copy.

## Built with

OpenReceipt is a Vite and TypeScript web app with React, WebMCP, a Python FastAPI bridge,
`python-escpos`, SQLite, SVG rendering, and monochrome PNG rasterization. The supported printer is
an Epson TM-L90 connected by USB.
```

### Built with

Suggested tags:

`TypeScript`, `React`, `Vite`, `Python`, `FastAPI`, `WebMCP`, `MCP`, `SQLite`, `python-escpos`, `Epson TM-L90`, `USB`, `Raspberry Pi`

Devpost allows up to 25 tags.

### Try it out links

| Link field | Draft value |
| --- | --- |
| Live demo | `[LIVE_URL]` |
| Public repository | `https://github.com/phreshplastic/openreceipt` |
| Demo video | `[YOUTUBE_URL]` |

### Project media

Suggested gallery order:

1. Landing page showing the receipt-first product experience.
2. Editor with the agent activity visible beside the receipt.
3. Human edit and approval panel.
4. Exact preview beside the final receipt.
5. Epson TM-L90 producing the physical paper.

Use a strong 3:2 thumbnail, preferably the final paper beside the matching editor view. Devpost
allows up to 15 JPG, PNG, or GIF images, with a 5 MB limit per image.

### Video demo link

`[YOUTUBE_URL]`

## Additional info for judges and organizers

These fields are not part of the public project page, but they are required by the form.

### Submitter type

`Individual`

Change this only if the submission includes other team members.

### Country of residence

`[SELECT YOUR COUNTRY]`

### Organization name

Leave blank unless submitting on behalf of an organization.

### App status

Recommended draft choice: `New`.

The submitted OpenReceipt repository begins on August 27, 2026, during the August 25–September 3
submission period, and its current product, WebMCP surface, local bridge, and physical printer path
were built in that period. Select `Existing` only if OpenReceipt is materially a continuation of an
earlier project rather than a new project built during the period; Devpost evaluates pre-existing
projects only on work added during the submission period.

### If Existing, explain what you updated during the submission period

```text
The project began as an earlier thermal-printer prototype, but the submission-period work added the
WebMCP-powered collaboration layer and the current OpenReceipt experience. We added the browser tool
registration, the shared revision-checked receipt model, structured drafting and item-level editing,
exact preview and rasterization, approval-gated printing, the local FastAPI bridge, the public browser
build, and the Epson TM-L90 USB path shown in the demo. The dated commit history separates the earlier
printer work from the WebMCP extension.
```

Use this only if `Existing` is selected; otherwise leave it blank. The official rules require a clear
distinction between prior work and the WebMCP work added during the submission period for an existing
project: https://webmcp.devpost.com/rules

### Live URL accessible with WebMCP

`[LIVE_URL]`

### Testing instructions

```text
Open the live URL in ChatGPT’s in-app browser or Google Chrome with WebMCP enabled. No account is
required. Try the browser editor, then ask the agent to draft a receipt, make a small edit, preview it,
and request a print. The public site demonstrates the browser and WebMCP path; physical printing is
shown in the video because it requires an Epson TM-L90 and the local bridge.
```

### Public code repository

`https://github.com/phreshplastic/openreceipt`

### Agent or client used to test WebMCP tools

```text
Chrome with the WebMCP origin-trial/runtime support, plus the project’s local WebMCP test host and
Playwright end-to-end harness. The same tool definitions were also exercised through the headless MCP
server during development.
```

Edit this to name the exact public agent or client you personally tested before submitting.

### AI tools leveraged while working on the project

```text
ChatGPT and Codex were used for implementation support, code review, debugging, documentation, and
test planning. The final product, hardware testing, screen capture, voice, and submission decisions
were reviewed and made by the project author.
```

Add or remove tools so this reflects the actual workflow.

### Level of learning

Recommended selection: `Significant`

### AI value for your career

Recommended selection: `Yes`

## Before manual submission

- Replace `[LIVE_URL]` and `[YOUTUBE_URL]`.
- Choose the accurate submitter type, country, app status, learning level, and AI-career answer.
- Confirm the public GitHub repository is visible in an incognito window and still contains `LICENSE`.
- Upload the thumbnail and 3–5 strong stills.
- Watch the YouTube upload signed out and confirm it is public, under three minutes, and has narration.
- Open the live URL in ChatGPT or Chrome with WebMCP enabled and verify the judge instructions.
- Review the exact final submission in Devpost, then submit manually. This draft does not submit anything.
