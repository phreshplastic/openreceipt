---
name: openreceipt
description: Save or update persistent shopping lists and receipt drafts, show a paper preview, or print through an OpenReceipt MCP connection. Use for “add to my shopping list,” “add to my print list,” and requested or previously authorized receipt printing.
---

Use the connected OpenReceipt tools. The bridge owns the saved receipts and queue; the agent supplies the content and layout.

For a list update, call `list_receipts`, find the intended list, and read it with `get_receipt(receiptId)`. If it does not exist, call `select_receipt(title)` to create a distinctive named receipt. Carry its `receiptId` through every subsequent call. Draft a new list with `draft_receipt`, or use `edit_receipt` item operations to preserve the existing items and style. Adding an item finishes when it is saved; it does not print.

For a new receipt, use `list_receipt_recipes` for a suitable shape. Supply confirmed facts and a short distinctive title. Keep shopping lists grouped by aisle and reminders short. Use the existing wordmark, blocks, and typography rather than decorating the receipt with ASCII art.

For a preview, call `preview_receipt(receiptId)`. Show its returned image when the host supports it, otherwise share the editor URL and paper dimensions. The returned revision identifies the previewed content.

For an explicit print request or an already authorized routine, check `get_app_status`, preview the receipt, then call `request_receipt_print` with that `receiptId`, the previewed `expectedRevision`, a UUID `requestId`, and a short reason. Keep the same request ID if the same submission needs a network retry. Read the effective policy from status; the credential and bridge enforce automatic printing permission.

Report the returned job state accurately. For queued, waiting-for-printer, sending, or awaiting-approval states, follow up with `get_print_job_status` using the existing job ID. An unknown transmission requires the person to inspect the paper before a new print request. Refresh a stale receipt and preview it again before requesting its new revision.
