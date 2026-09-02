---
slug: epson-tm-l90-ai-printer-setup
title: Set up an Epson TM-L90 with OpenReceipt
description: Connect the tested TM-L90 by USB, choose 58 mm or 80 mm paper, run the local helper, and make your first print.
published: 2026-08-31
updated: 2026-09-02
summary: Connect the TM-L90 by USB, start OpenReceipt beside it, choose the paper width, and print one test slip before handing the printer to an agent.
topics:
  - Epson TM-L90
  - thermal printer setup
  - USB printing
  - OpenReceipt
---

I have tested one setup all the way through: an **Epson TM-L90 connected directly by USB**. OpenReceipt runs on the same computer, draws the receipt there, and sends it to the printer without a cloud print service.

The app uses a small local helper called the bridge. It keeps the receipt and print queue on your machine, talks to USB, and serves the editor at `http://127.0.0.1:8731`.

## Before you start

You will need:

- an Epson TM-L90 with a USB interface and its 24 V power supply;
- a computer to run the bridge on — a laptop, or a Raspberry Pi left beside the printer;
- an 80 mm or 58 mm thermal roll;
- Node.js 22 or newer and Python 3.12 or newer;
- permission for your user account to access the USB printer.

The adapter currently looks for USB ID `04b8:0202`. It uses interface `0`, sends data through endpoint `01`, and listens on endpoint `82`. Those numbers are simply the channels this particular printer reports over USB. TM-L90 interface boards vary, so check the machine in front of you if they do not match.

## Install the app and bridge

From the project directory:

```bash
npm install
python3 -m venv bridge/.venv
. bridge/.venv/bin/activate
pip install -e 'bridge[dev]'
npm run build
petes-printer --web-dist ./dist
```

Open `http://127.0.0.1:8731`. Setup will look for the printer, ask which roll is loaded, collect a couple of local defaults, and offer a test print.

I like to run the app once with its virtual printer before touching USB:

```bash
PETES_PRINTER_TRANSPORT=dummy petes-printer --web-dist ./dist
```

The virtual printer writes the outgoing printer bytes to a file. It proves that the app can draw and queue a receipt, but it cannot prove that the real printer will feed or cut.

## Choose the paper width

OpenReceipt offers two layouts:

| Setting | Roll | Drawing width | Works well for |
| --- | --- | --- | --- |
| `80mm-576` | 80 mm | 576 dots | Weather, agendas, tables, and longer receipts |
| `58mm-420` | 58 mm | 420 dots | Reminders, short lists, and compact objects |

The [Epson manual](https://files.support.epson.com/pdf/pos/bulk/tm-l90_4-um_en_tc_01.pdf) specifies 203 dpi output and a 576-dot print area for 80 mm receipt paper. OpenReceipt draws the narrow layout again at 420 dots instead of squeezing the wide image. That is why wrapping in the preview should match the paper.

If you are also choosing rolls, the [thermal paper guide](/guides/58mm-vs-80mm-thermal-paper) covers width, paper weight, and phenol-free stock.

## Check the USB connection on Linux

Ask Linux what it can see before changing permissions:

```bash
lsusb
lsusb -vvv -d 04b8:0202
```

Look for the same device ID, interface, and outgoing endpoint that the adapter expects. The [`python-escpos` USB guide](https://github.com/python-escpos/python-escpos/blob/master/doc/user/usage.rst) follows the same process because printers do not all expose identical USB channels.

If the printer appears only when you run the bridge as root, stop there. Add a narrowly scoped udev rule for the USB ID you confirmed, reload the rules, and keep the bridge under your normal user account. The [`python-escpos` installation guide](https://github.com/python-escpos/python-escpos/blob/master/doc/user/installation.rst) includes the permission pattern.

## Make the first real print

1. Load the roll with the coated side facing the print head, then power on the TM-L90.
2. Start the bridge without the `dummy` setting.
3. Open setup and wait for the printer to be detected.
4. Choose the width that matches the loaded roll.
5. Print the connection slip.

Look at the whole result. The image should use the expected width, the paper should feed cleanly, and the cutter should fire once. OpenReceipt sends one black-and-white image, then feed and cut commands; the printer does not lay out the text itself.

## Leave it running on a Raspberry Pi

The bridge is an ordinary Python process that needs USB and a loopback port, so it does not have to
live on your laptop. A Raspberry Pi sitting next to the printer is a good permanent home for it:
plug the TM-L90 into the Pi, install the bridge there the same way, and leave it powered on. Nothing
about the printer path changes — it is the same USB adapter on a smaller host.

Two details are worth knowing before you try it. The Pi is Linux, so the udev rule in the section
above applies; without it the bridge can only reach the printer as root. And the bridge binds to
loopback by default, which means the editor has to run on the Pi as well — open it from the Pi's own
browser, or reach `http://127.0.0.1:8731` through an SSH tunnel from your laptop:

```bash
ssh -N -L 8731:127.0.0.1:8731 pi@raspberrypi.local
```

Then open `http://127.0.0.1:8731` on your laptop as usual. Exposing the bridge on the network
instead is deliberately not supported: it holds your receipts and can make paper come out.

## If something goes wrong

**The app opens, but the printer is offline.** Check power and the cable first. Then compare the printer’s USB ID and channels with the values above. The current adapter only knows the tested TM-L90 path.

**It works only as root on Linux.** This usually means your user account cannot open the USB device. Add the device-specific rule rather than running the whole app as root.

**The receipt is clipped or strangely narrow.** Check that the selected width matches both the roll and the printer’s paper guide. Browser zoom will not fix it; the receipt is drawn in printer dots.

**The image prints, but the paper does not cut.** Confirm that your unit has a cutter and that the cutter works from the printer’s own self-test.

**The app says the result is unknown.** Look at the paper before pressing print again. Once the bridge starts sending data, a lost connection cannot tell it whether the printer stopped halfway through or finished the job. An automatic retry could give you two receipts.

## Sources

- [Epson TM-L90 user manual](https://files.support.epson.com/pdf/pos/bulk/tm-l90_4-um_en_tc_01.pdf)
- [python-escpos USB usage guide](https://github.com/python-escpos/python-escpos/blob/master/doc/user/usage.rst)
- [python-escpos USB installation and udev guidance](https://github.com/python-escpos/python-escpos/blob/master/doc/user/installation.rst)
