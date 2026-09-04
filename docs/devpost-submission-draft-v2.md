# Devpost submission draft v2

This is a working draft for the OpenReceipt submission. Nothing has been entered into Devpost.
Replace bracketed values before pasting. The character limits below match the visible form.

## Project overview

### Project name

`OpenReceipt`

60 characters maximum.

### Elevator pitch

`Print beautiful, takeaway thermal receipts with OpenReceipt – an open-source editor and bridge for printing receipts to go`

94 characters.

## Project details

### About the project

~~~markdown
## What we built

OpenReceipt is a local-first receipt editor and thermal printer bridge, designed for human-agent collaboration via WebMCP. It gives
agents a structured way to draft clean, crisp paper slips that you can take away to go, all while keeping the user in control of the content and the final print.

Suppose you're heading out to the grocery store. Simply tell your agent what you want to cook and ask it to
draft a shopping list in OpenReceipt. The agent will then use its in-app browser to open the site, call WebMCP tools that enable easy receipt construction, and prepare a first draft for your review. Under the hood, it selects from a suite of plug-and-play blocks – think checklists, reminders, even weather reports – that it then stacks together like bricks to form a cohesive receipt. 

The best part is that it's a shared human-agent experience. You can edit the receipt yourself, ask the agent to make changes, or do both together on the same shared canvas. When everything looks right, you review the exact print preview, approve it, and boom - a physical receipt! 

The same flow works for a packing list, a morning brief, a reminder, meeting notes, or any short
document that is more useful on paper than on a screen. OpenReceipt turns a chat into something you
can carry, keep by the door, or write on while you work.

## Why WebMCP fits

WebMCP gives agents an easy way to draft structured receipts from unstructured user prompts. Here, the OpenReceipt app exposes 14 WebMCP tools that allow for agents to quickly design, iterate, and print paper receipts. Humans stay in the loop by reviewing a shared canvas in the browser, with flexibility to make direct edits to the receipt before giving the greenlight to print.

This opens the door for next-level human-agent conveinence. Agents can now draft limitless receipt combinations all from a simple text prompt or voice chat, making the human's job as easy as saying what's on their mind and letting their agent do all the work.

## How it works

The browser registers the tools through `document.modelContext` when WebMCP is available. The same tool
definitions also power the headless MCP server, so the browser and agent use the same receipt model
and operations.

The local bridge stores the receipt, settings, events, and print jobs in SQLite. OpenReceipt renders
the approved document as an SVG and monochrome PNG at the selected paper width, then the bridge sends
it to the thermal printer over USB (e.g., Epson TM-L90). Printing stays on the local machine and requires explicit approval
by default, unless they select the "Allow agent to print autonomously" option.

The public browser build works without a printer, so anyone can explore the editor and WebMCP tools.
Physical printing uses the same app served locally beside the printer. I've tested the project with my trusty Epson TM-L90 over USB using 80 mm and 58 mm paper. A Raspberry Pi can also run the bridge beside the printer as a permanent local host, which is my preferred home setup so I can send receipts to the printer while on the go.

## What we learned

1. WebMCP is awesome! I can think of so many ways where this might enhance my other hobbyist projects for more seamless human-agent collaboration. It makes this project even more valuable because now I don't need to manually construct receipts for whatever one-off use case I have at a given moment; I just ask my agent to draft it and it's magically done.

2. It's difficult to keep the human-visble browser, agent, preview, and printer aligned on the same document. I needed to iteration on my revision and state processes such that humans and agents can effortlessly collaborate on the same slip simultaneously without erasing each other's work.

The difficult part was keeping the browser, agent, preview, and printer aligned on the same document.
Revision checks make concurrent edits visible and prevent an old print request from reaching the
printer. Rendering the preview and the paper from the same document state makes the preview useful.
Approval keeps a consequential action in the person’s hands.

We also learned that small editing tools matter. Replacing an entire checklist when someone only
wants to check one item can erase work. Item-level operations let the agent make a precise change and
leave the rest of the person’s receipt alone.

## Built with

OpenReceipt is a Vite and TypeScript web app with React, WebMCP, a Python FastAPI bridge, SQLite,
SVG rendering, monochrome PNG rasterization, and `python-escpos`. The supported printer is an Epson TM-L90
connected by USB.
~~~

### Built with

Suggested tags:

`TypeScript`, `React`, `Vite`, `Python`, `FastAPI`, `WebMCP`, `MCP`, `SQLite`,
`python-escpos`, `Epson TM-L90`, `USB`, `Raspberry Pi`

Devpost allows up to 25 tags.

### Try it out links

| Link field | Draft value |
| --- | --- |
| Live demo | `[LIVE_URL]` |
| Public repository | `https://github.com/phreshplastic/openreceipt` |
| Demo video | `[YOUTUBE_URL]` |

### Project media

Suggested gallery order:

1. Landing page showing what OpenReceipt makes.
2. The editor with the agent drafting beside the receipt.
3. A human edit on the shared canvas.
4. The approval panel and exact preview.
5. The Epson TM-L90 producing the finished paper.

Use a strong 3:2 thumbnail, ideally the final receipt beside the matching editor view. Devpost
allows up to 15 JPG, PNG, or GIF images, with a 5 MB limit per image.

### Video demo link

`[YOUTUBE_URL]`

## Additional info for judges and organizers

These fields are not part of the public project page, but the form requires them.

### Submitter type

`Individual`

### Country of residence

`[SELECT YOUR COUNTRY]`

### Organization name

Leave blank unless submitting on behalf of an organization.

### App status

Recommended choice: `New`.

The submitted OpenReceipt repository begins on August 27, 2026, during the August 25–September 3
submission period. The current product, WebMCP surface, local bridge, and physical printer path
were built during that period. Select `Existing` only if OpenReceipt is materially a continuation
of an earlier project rather than a new project built during the submission period.

### If Existing, explain what you updated during the submission period

Leave blank if `New` is selected.

~~~text
The project began as an earlier thermal-printer prototype, but the submission-period work added the
WebMCP-powered collaboration layer and the current OpenReceipt experience. We added browser tool
registration, the shared revision-checked receipt model, structured drafting and item-level editing,
exact preview and rasterization, approval-gated printing, the local FastAPI bridge, the public browser
build, and the Epson TM-L90 USB path shown in the demo. The dated commit history separates the earlier
printer work from the WebMCP extension.
~~~

### Live URL accessible with WebMCP

`[LIVE_URL]`

### Testing instructions

~~~text
Open the live URL in ChatGPT’s in-app browser or Google Chrome 149+ with WebMCP enabled. No account
is required. Ask the agent to draft a grocery list or packing list, make a small edit, and preview
the receipt. The public site demonstrates the browser and WebMCP path. Physical printing requires
the local bridge and an Epson TM-L90, so that part is shown in the video.
~~~

### Public code repository

`https://github.com/phreshplastic/openreceipt`

### Agent or client used to test WebMCP tools

~~~text
Chrome with WebMCP enabled, the project’s local WebMCP test host, and the Playwright end-to-end
harness. The same tool definitions were also exercised through the headless MCP server during
development.
~~~

Replace this with the exact public agent or client you personally tested before submitting.

### AI tools leveraged while working on the project

~~~text
ChatGPT and Codex were used for implementation support, debugging, code review, documentation, and
test planning. The project author reviewed the product, tested the printer, recorded the demo, and
made the final product and submission decisions.
~~~

Adjust this to match the actual workflow.

### Level of learning

Recommended choice: `Significant`

### AI value for your career

Recommended choice: `Yes`

## Before manual submission

- Replace `[LIVE_URL]` and `[YOUTUBE_URL]`.
- Choose the accurate country, submitter type, app status, learning level, and AI-career answer.
- Confirm the public GitHub repository works in an incognito window and exposes `LICENSE`.
- Upload the thumbnail and 3–5 strong stills.
- Watch the public YouTube upload signed out and confirm it is under three minutes with narration.
- Test the live URL in ChatGPT or Chrome with WebMCP enabled.
- Review the final Devpost page and submit manually. This draft does not submit anything.
