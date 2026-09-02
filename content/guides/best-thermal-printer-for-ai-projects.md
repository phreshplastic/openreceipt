---
slug: best-thermal-printer-for-ai-projects
title: What kind of printer should you get for an AI project?
description: Choose between a desk receipt printer, a small 58 mm printer, a kitchen impact printer, or a label printer—and see where OpenReceipt works today.
published: 2026-08-31
updated: 2026-09-01
summary: Start with the object you want to make. A desk receipt, a tiny prompt, a kitchen ticket, and an adhesive label each point to different hardware.
topics:
  - thermal printer
  - Epson TM-L90
  - AI hardware
  - receipt printer
---

Start with the thing you want to make and where it will live. You need a different printer for a wide desk receipt, a tiny reminder, a kitchen ticket, or an adhesive label.

## The short answer

For OpenReceipt today, get a **direct-USB thermal receipt printer**. The model tested here is the **Epson TM-L90**, printing on 80 mm or 58 mm paper. It uses ordinary receipt rolls, has a cutter, and needs no ink or toner.

OpenReceipt is being built toward more than one bridge, so a kitchen printer or label printer can make sense when it suits the object you want to make. The app cannot drive those printers yet.

## The four kinds of printer you will consider

**Desk receipt printer, 80 mm.** This is the roomy option for morning briefs, schedules, and receipts with tables. Direct thermal means the roll is the only everyday consumable. A cutter gives you a finished slip. This is where OpenReceipt works today.

**Small receipt printer, 58 mm.** Choose this when the printer needs to disappear into an enclosure or the tiny paper is part of the charm. Text wraps sooner, so it works best for reminders and short lists rather than wide tables.

**Kitchen impact printer.** Direct thermal paper can darken in heat, so kitchens often use an ink ribbon and plain paper instead. Epson describes the [TM-U220II](https://epson.com/For-Work/POS-System-Devices/POS-Printers/TM-U220II-Kitchen-and-Receipt-Impact-Printer/p/C31CL27032) as an impact kitchen printer with media that stands up to heat and moisture. `python-escpos` has a TM-U220 profile, which makes it a plausible future bridge. OpenReceipt does not support it today.

**Label printer.** Pick one when the result needs to stick to a box, jar, or name badge. Brother documents raster and template routes for printers such as the QL-820NWB. The maintained [`thermal-label/brother-ql`](https://github.com/thermal-label/brother-ql) driver has verified that model. A label bridge would still need its own media and layout work in OpenReceipt.

## Why direct USB matters for agents

When an AI agent can request a print, I prefer a short chain: the app draws the receipt, the bridge holds the queue, and the printer beside it handles the paper. Approval stays on that machine.

USB makes the first bridge easy to understand because the cable points to one printer. Ethernet is still a good option when the printer belongs across the room or serves several local systems, but OpenReceipt does not ship a network bridge yet.

## What to check before buying used

- **USB interface.** The TM-L90 came with different interface boards. You want USB; the tested adapter looks for USB ID `04b8:0202`.
- **Power supply.** These printers use a 24 V brick. Make sure it is included.
- **Cutter.** Ask for a self-test or video that shows one clean cut.
- **Paper width.** The TM-L90 takes 80 mm rolls natively and 58 mm with a spacer — both are supported profiles in the app.

Once it is on your desk, the [setup guide](/guides/epson-tm-l90-ai-printer-setup) walks through the first print, and the [paper guide](/guides/58mm-vs-80mm-thermal-paper) helps you choose rolls for it.

## Sources

- [Epson TM-L90 user manual](https://files.support.epson.com/pdf/pos/bulk/tm-l90_4-um_en_tc_01.pdf)
- [Epson TM-U220II kitchen and receipt impact printer](https://epson.com/For-Work/POS-System-Devices/POS-Printers/TM-U220II-Kitchen-and-Receipt-Impact-Printer/p/C31CL27032)
- [Brother label-printer developer program](https://developerprogram.brother-usa.com/labelling-and-mobile-developer-program)
- [thermal-label Brother QL driver](https://github.com/thermal-label/brother-ql)
- [python-escpos repository](https://github.com/python-escpos/python-escpos)
