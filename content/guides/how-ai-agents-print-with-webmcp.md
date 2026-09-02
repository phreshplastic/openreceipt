---
slug: how-ai-agents-print-with-webmcp
title: How an AI agent gets a receipt onto paper
description: Follow a receipt from an AI conversation to the local preview, one-revision approval, and thermal printer through WebMCP or MCP.
published: 2026-08-31
updated: 2026-09-01
summary: The agent edits the same receipt you see, previews the paper, and asks to print one exact version. A local helper handles the physical printer.
topics:
  - WebMCP
  - Model Context Protocol
  - AI agents
  - thermal printing
---

An agent works on the same receipt you see in OpenReceipt. It checks the preview and asks before the paper moves, without poking at a print dialog or talking directly to the printer.

That last step matters because editing a line is easy to undo. Once a printer feeds and cuts a slip, the paper is already in the world.

## One receipt, shared by you and the agent

Someone might say, “I’m flying Thursday. Make me a packing receipt.” The agent can draft a countdown, flight details, weather, and a packing list. You can change a heading by hand, and the agent sees that change the next time it reads the receipt.

The app offers a small set of named actions rather than giving the agent control of the whole screen:

| Action | What it means in ordinary use |
| --- | --- |
| Read | See the title, blocks, and current version |
| Draft | Make a complete receipt from a request |
| Edit | Change one block or one line inside it |
| Preview | Check the text, width, length, and warnings |
| Ask to print | Submit the exact version that was previewed |

The code calls these actions tools. Their names—such as `draft_receipt` and `preview_receipt`—matter to the agent, but a person can think of them as the same moves available in the editor.

## Approval belongs to one version

OpenReceipt gives the receipt a new version number after every change. When an agent asks to print, the request carries the version it saw. If you edit the page while the approval is open, the old request expires.

This prevents an awkward mismatch: approving one receipt on screen and printing a newer one you have not read. The default setting asks for confirmation on every agent print. Other policies exist for deliberately trusted workflows, but they are local choices rather than the starting point.

## What happens after approval

A small program beside the printer—the bridge—handles the physical work. It stores the current receipt and print jobs, turns the approved page into a black-and-white image, and sends that image over USB. The browser never needs direct access to the printer.

The bridge records three outcomes:

1. **Failed:** it stopped before sending the page.
2. **Printed:** the bridge finished sending the job without an error.
3. **Unknown:** sending began, but the bridge lost a clear answer.

The bridge reports `unknown` rather than guessing. If a cable comes loose halfway through, the software cannot know whether the tray holds nothing, half a receipt, or a complete one. It tells the agent to check the paper instead of quietly printing a duplicate.

## The preview is the print

OpenReceipt draws the receipt at the loaded paper width: 576 dots for 80 mm or 420 dots for 58 mm. It uses the same layout for the browser preview and the image sent to the printer.

This lets the agent catch a long receipt or a cramped table before asking to print. It also keeps live text—weather, news, or market data—inside ordinary receipt blocks. That text can appear on paper, but it cannot turn itself into a printer command.

## WebMCP and MCP, without the alphabet soup

The app offers the same receipt actions in two places.

**WebMCP** is for an agent working with the page open in a compatible browser. The agent and the person are looking at the same editor.

**MCP**, the [Model Context Protocol](https://modelcontextprotocol.io/), is for an agent that connects to OpenReceipt as a local program instead. It can work without keeping the browser in front of it.

Both routes end at the same receipt and the same print rules. Only the way the agent connects changes.

## A normal conversation

The packing receipt might go like this:

1. You ask for a receipt for Thursday’s flight.
2. The agent asks for the missing details, then drafts it.
3. You change “Things to pack” to “Do not forget these.”
4. The agent previews the updated page and reports its paper length.
5. You ask to print, then approve that version in the local editor.

If you later say, “mark the passport packed,” the agent changes that one line. It does not rebuild the receipt or reach around the app to control the screen.

The agent helps shape the paper, while the person beside the printer keeps the final say.

## Sources

- [Model Context Protocol documentation](https://modelcontextprotocol.io/)
- [Vercel guide to agent-readable sites](https://vercel.com/kb/guide/make-your-documentation-readable-by-ai-agents)
