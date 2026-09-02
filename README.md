# OpenReceipt

**A thermal printer your AI agent can reach — and a receipt the two of you edit together.**

Ask an agent for a packing list and it drafts a real receipt. You retitle a heading by hand while
it ticks a box. Nothing prints until you tap approve. Then it comes out of the printer on your desk.

- **Try it now:** _(live URL — replace before submitting)_
- **Watch the demo:** _(YouTube link — replace before submitting)_
- **Licence:** [MIT](LICENSE)

## For judges — start here

Open the live URL in ChatGPT's in-app browser or Chrome 149+ with WebMCP enabled. There is no
account and nothing to install. The site registers ten WebMCP tools on the landing page and in the
editor, so you can ask your agent to draft a receipt, edit it while it works, and watch it stop for
approval. **The browser is the whole judge path.** The physical printer needs a small local bridge
running beside real hardware — please take that part as demonstrated in the video rather than
installing anything.

If your browser has no WebMCP host, the site still works as an ordinary editor; the tools are
progressive enhancement, not a requirement.

## What it does

| You do | The agent does | Both share |
| --- | --- | --- |
| Type, drag, style, insert blocks | `draft_receipt`, `edit_receipt`, `undo_agent_edit` | One revision-checked receipt |
| Tap approve | `request_receipt_print` — and waits | An approval bound to the exact revision you read |
| Set the paper width and city | `get_app_status`, `preview_receipt` | The same renderer, to the dot |

Any edit you make while a print is pending invalidates it. An agent ticking one checklist item never
clobbers the line you are typing, because item-level edits reach a single line rather than rewriting
the block.

## Two ways to run it

**The public site** is browser-only. The receipt lives in that browser's storage, WebMCP tools are
registered, and nothing is sent anywhere — there is no server to send it to. Printing is the one
thing it cannot do.

**The local app** adds the bridge: a loopback-only FastAPI service that owns the receipt in SQLite,
holds approvals, and talks to the printer over USB. Same editor, same tools, plus paper.

## Hardware this is actually tested on

One printer: the **Epson TM-L90 over USB**, on 80 mm or 58 mm paper. That is the only device the
claims here cover. The bridge is `python-escpos` underneath, so other USB ESC/POS printers are
plausible — but untested, and not advertised.

The bridge is a small Python process, so a **Raspberry Pi** makes a good permanent home for it: put
the Pi next to the printer, run the bridge there, and leave it on. That is the same USB adapter on a
smaller host, not a separate port. See [the TM-L90 guide](content/guides/epson-tm-l90-ai-printer-setup.md).

## Clone and run it cold

Node.js 22+ and Python 3.12+.

```bash
git clone https://github.com/OWNER/printer-webmcp.git
cd printer-webmcp
npm install
python3 -m venv bridge/.venv
. bridge/.venv/bin/activate
pip install -e './bridge[dev]'
```

Then, in one terminal, run the bridge with no printer attached:

```bash
PETES_PRINTER_TRANSPORT=dummy petes-printer --data-dir ./bridge/data
```

And in a second:

```bash
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). Dummy prints write ESC/POS bytes to
`bridge/data/last-print.bin` instead of paper, so the whole flow — draft, approve, print — runs on a
machine with no printer at all. `npm run dev` also installs the WebMCP shim, so you can call every
tool by hand from the panel it adds.

To see it in a browser with no shim and no bridge, exactly as a judge would:

```bash
PETES_PRINTER_PUBLIC_URL=http://127.0.0.1:4174 npm run build:public
node scripts/serve-public.mjs
```

## What ships in v1

- A landing page, browser-only demo, two-step local printer setup, and receipt-first editor.
- Heading, text, checklist, key/value, table, and divider blocks, plus grouped lists, countdowns, agendas, habit grids, live weather, air quality, markets, news, and seven blank write-in forms.
- A logo block at the top of every receipt: six wordmarks — arch, bar, masthead, ticket, badge, block — set from the owner's first name during personalization and editable per receipt. Each is fitted to the paper from measured font metrics rather than estimates, so a long name never clips and a short one never floats.
- The arch is set in a subsetted, renamed Ultra (Apache 2.0) that rides inside the SVG as a data URI, because a receipt rasterizes through an `<img>` that no stylesheet reaches; the headless renderer, which ignores `@font-face`, is handed the same bytes. Every other mark uses families a machine already has. Regenerate the font modules with `node scripts/generate-sign-font.mjs`.
- Exact SVG preview and monochrome PNG rasterization from the same document state.
- Blank and checklist templates without a template-management system.
- Ten agent tools — situations, vocabulary, one-shot drafting, positional and item-level editing, a plain-text print preview, undo, and permission-gated printing — served identically over WebMCP in the browser and over conventional MCP headlessly.
- Confirm-each-print, approved-template, and autonomous-agent policies; confirmation is the default.
- A loopback-only FastAPI application with revision conflicts, scoped tokens, durable events, server-side approvals, checksum/idempotency protection, dummy output, and Epson TM-L90 USB delivery.

Accounts, cloud sync, routines, schedules, remote bridges, images, and QR codes are intentionally outside this release.

## Development

`npm run dev` is covered above. Two extra surfaces exist for design review only: the
[block playground](http://127.0.0.1:5173/blocks) presents receipt-native prototypes at 80 mm and
58 mm, and the linked [thermal chart lab](http://127.0.0.1:5173/blocks/charts) compares the five
shared chart primitives at both paper widths. Choosing a prototype there does not modify the receipt
schema or the saved document.

## Production-style local run

```bash
npm run build
petes-printer --web-dist ./dist
```

Open [http://127.0.0.1:8731](http://127.0.0.1:8731). The bridge binds to localhost by default and stores configuration, artifacts, and `printer.sqlite3` in the platform application-data directory. Set `PETES_PRINTER_TRANSPORT=dummy` to avoid touching USB hardware.

The TM-L90 adapter uses Epson USB IDs `04b8:0202`, interface `0`, OUT endpoint `01`, and IN endpoint `82`. Linux installations need ordinary libusb/udev access for the unprivileged bridge process.

## Public site build

The public build is a separate, crawlable site. It requires the final canonical origin, pre-renders the landing page and guides, creates Markdown mirrors and discovery files, and lazy-loads a browser-only editor that never contacts the local printer bridge.

```bash
PETES_PRINTER_PUBLIC_URL=https://openreceipt.example npm run build:public
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e:public
```

`e2e/public-webmcp.spec.ts` installs a stand-in WebMCP host the way Chrome 149+ would and asserts
that the deployed origin registers all eleven tools on `/` and on `/app`, drafts through them, and
refuses to print with an explanation. Run it against any build before deploying: it is the check
that the judge path still works. Set `PLAYWRIGHT_CHANNEL=chrome` to use an installed Chrome instead
of Playwright's download.

The output in `dist/` includes `/`, `/guides`, four guide routes, `llms.txt`, XML and Markdown sitemaps, Markdown page mirrors, `AGENTS.md`, and `robots.txt`. Replace the example origin at deployment, serve unknown paths as real 404 responses, and redirect every alternate host to the canonical origin in one hop.

## Checks

```bash
npm run check
npm run test:e2e
bridge/.venv/bin/pytest bridge/tests
```

For a design pass over the printed output, `npx tsx scripts/design-sheet.mts <prefix>` renders one
receipt containing every insertable block to SVG and PNG at both paper widths, with live data. It is
the fastest way to see whether a change reads well next to fifteen other blocks on one roll.

The receipt module is the shared test surface for human and agent mutations. The bridge treats a failure before transmission as `failed`; once sending begins, an uncertain result becomes `unknown` and is never retried automatically.

## Local API and headless tokens

The browser starts a same-origin HttpOnly session and sends a CSRF token for state changes. Headless clients use narrowly scoped bearer tokens; token secrets are written once to owner-readable files, while SQLite stores only their hashes.

```bash
petes-printer --create-token codex \
  --scope receipt:read --scope receipt:write --scope events:read \
  --scope print:request --scope print:status
petes-printer --list-tokens
petes-printer --revoke-token TOKEN_ID
```

The canonical endpoints are `/api/v1/receipt`, `/api/v1/settings`, `/api/v1/events`, and `/api/v1/print-requests`. Settings remain browser-session-only. Grant `print:approve` separately when an MCP host should be able to submit a decision after confirming in chat rather than in the browser; `print:direct` is reserved for the compatibility print-job route.

## Agents

The same eleven tools are registered in the browser through WebMCP and served headlessly through a conventional MCP server. Both bind one definition in `src/agent/tools.ts`, so a tool behaves identically wherever it is called from.

| Tool | What it is for |
| --- | --- |
| `get_app_status` | Editor URL, setup state, printer health, print policy, last print |
| `get_receipt` | Compact outline by default; `detail: text` for a stand-in of the print, `json` for the document |
| `list_receipt_blocks` | The block vocabulary, with when each one earns its place |
| `list_receipt_recipes` | Situations — the blocks a trip or a morning brief wants, and what to ask first |
| `draft_receipt` | Composes a whole receipt in one call from flat, id-free blocks. Give it a distinctive title. |
| `edit_receipt` | Positional block edits plus single-line changes anywhere a block has lines |
| `rename_receipt` | Sets the shelf/header title without changing the heading on the paper |
| `preview_receipt` | Dot dimensions, paper length in millimetres, warnings, and the text that will print |
| `undo_agent_edit` | Steps back the last change |
| `request_receipt_print` | Consequential; may wait for an explicit tap of approval |
| `open_receipt_editor` | Brings the visible editor up so a person can look first |

Blocks are not monoliths. `addItem`, `setItem`, `checkItem` and `removeItem` reach one line at a time
inside checklists, facts tables, tables, agendas, habit rows, countdown milestones, grouped lists,
meal plans, meeting notes and workout logs — declared once in `src/receipt/collections.ts`, so both
surfaces and the human panel agree on what a block's children are. `group` picks a section
("actions", "dinner"), and `fields` sets named attributes like `owner`, `due`, `sets` or `value`;
`list_receipt_blocks` names the legal fields per block, and a wrong guess is corrected by the error.
Sibling ids always survive, so an agent ticking one box never clobbers the line you are typing.

Every mutation and print request is revision-bound: printing uses an immutable snapshot, and any human edit during approval invalidates the request. Tools carry `readOnlyHint`, and anything that can surface third-party feed text carries `untrustedContentHint`.

### How a person talks a receipt into existence

The agent brings the intelligence; the app brings the taste. When someone describes a situation rather than naming blocks, `list_receipt_recipes` returns the blocks that belong on that paper and the details worth confirming first.

| Someone says | What happens |
| --- | --- |
| "I'm flying to Lisbon Thursday, international" | `list_receipt_recipes` → `travel_prep` → confirm the gaps → `draft_receipt`: countdown, flight facts, Lisbon's forecast, packing grouped by carry-on / clothes / before-the-door |
| "print my morning" | `daily_brief` → forecast, agenda, habit grid, one line of news |
| "remind me to call mom at 6" | `reminder` → one `draft_receipt` call |
| "mark the passport as packed" | `edit_receipt` `checkItem` — one item, no block rewrite |
| "add an action for Sam, due Friday" | `edit_receipt` `addItem` with `group: "actions"` and `fields: {owner, due}` |
| "put the weather for Porto instead" | `edit_receipt` `replace`, or change the city in the panel and tap Apply |
| "how long will that be?" | `preview_receipt` → paper length and overflow warnings |
| "actually, undo that" | `undo_agent_edit` |
| "looks good, print it" | `request_receipt_print` |

### Where "here" is

The app guesses a home city from the browser's timezone alone — no permission prompt, no IP sent to
any third party — and offers it as the starting point for every block that fetches weather, air
quality or surf. It is editable during setup and in the Print panel, and every block can point
somewhere else: changing a live block's city refetches, and a failed fetch changes nothing at all,
so you never get one city's numbers under another city's heading.

### WebMCP in the browser

Tools register against `document.modelContext`, falling back to `navigator.modelContext` for the Chrome 149–156 origin trial while the API finishes migrating. Browsers without either keep the full human interface — WebMCP is progressive enhancement.

They register on the pages a person actually lands on, in both builds: the landing page and the editor. On the public site the registration is a separate chunk loaded after the page paints, so the tools never sit in front of the first render, and a receipt drafted from the landing page is already on screen when `open_receipt_editor` moves the person to `/app` — both surfaces read the same browser storage.

The public site has no bridge, so `request_receipt_print` is the one tool that stops. It returns the finished receipt, says plainly that no printer is attached to that tab, and raises the setup sheet for the person. Everything before printing behaves exactly as it does locally.

To drive the tools without an origin trial, append `?webmcp=shim` (on by default in `npm run dev`). That installs a local host and a panel for calling any tool by hand. The public build never ships the shim — the public end-to-end spec installs a stand-in host from the outside instead, so what it exercises is the same code a real host would find.

### Headless MCP

`mcp/server.ts` is a thin adapter over the same tools, talking to the bridge over its HTTP API and rendering with the browser's own SVG renderer, so headless output matches the screen. It also serves the verbal cues as MCP prompts (`travel_receipt`, `daily_brief`, `reminder`, `packing_list`, `meeting_notes`, `grocery_run`) and exposes `receipt://current` and `receipt://recipes` as resources.

```bash
npm run build:mcp
petes-printer --create-token mcp \
  --scope receipt:read --scope receipt:write \
  --scope print:request --scope print:status
```

```json
{
  "mcpServers": {
    "petes-printer": {
      "command": "node",
      "args": ["/absolute/path/to/printer-webmcp/dist-mcp/server.mjs"],
      "env": {
        "PETES_PRINTER_URL": "http://127.0.0.1:8731",
        "PETES_PRINTER_TOKEN": "pp_..."
      }
    }
  }
}
```

For hosts that connect over a URL rather than spawning a process, `npm run mcp:http` serves the same tools over streamable HTTP on loopback, with host and origin checks on.

The handoff needs no new machinery: the server writes to the bridge, and any open editor tab picks the draft up over its existing event stream. Ask it to print and the browser raises its approval panel; the tool returns a job id straight away rather than holding the call open, and `get_print_job_status` reports where the job ended up.

OpenReceipt is available under the [MIT License](LICENSE).
