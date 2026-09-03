---
slug: epson-tm-l90-ai-printer-setup
title: Set up an Epson TM-L90 with OpenReceipt
description: Connect the tested TM-L90 by USB, choose 58 mm or 80 mm paper, run the local bridge, and make your first print.
published: 2026-08-31
updated: 2026-09-03
summary: Connect the TM-L90 by USB, start OpenReceipt beside it, choose the paper width, and print one test slip before handing the printer to an agent.
topics:
  - Epson TM-L90
  - thermal printer setup
  - USB printing
  - OpenReceipt
---

OpenReceipt has one tested hardware path: an Epson TM-L90 connected directly by USB. A small local
bridge runs beside the printer, keeps the receipt and print job on that machine, and serves the app
at `http://127.0.0.1:8731`.

You can run the bridge on a laptop while you work, or on a Raspberry Pi that stays beside the
printer after the laptop is turned off. When the bridge runs on your laptop, the live OpenReceipt app
can connect to it through loopback. A Pi setup uses the Pi-hosted app or an SSH tunnel because the
live site does not reach across your network.

## Before you start

You will need:

- an Epson TM-L90 with a USB interface and its 24 V power supply;
- an 80 mm or 58 mm thermal roll;
- Node.js 22 or newer and Python 3.12 or newer;
- permission for your user account to access the USB printer.

The tested adapter expects vendor/product ID `04b8:0202`, interface `0`, OUT endpoint `01`, and IN
endpoint `82`. TM-L90 interface boards can vary, so check the device in front of you if
those values do not match.

## Install and run it

From the repository directory:

~~~bash
npm install
python3 -m venv bridge/.venv
. bridge/.venv/bin/activate
pip install -e './bridge[dev]'
npm run build
petes-printer --web-dist ./dist
~~~

Open `http://127.0.0.1:8731`. The setup screen detects the bridge and printer, lets you choose the
loaded paper width, and offers a **Test connection** slip. After the test succeeds, open the
editor, draft or edit a receipt, and approve the print.

To test the editor without hardware, use the virtual transport instead:

~~~bash
PETES_PRINTER_TRANSPORT=dummy petes-printer --web-dist ./dist
~~~

Dummy mode writes printer bytes to a local file. It checks the software flow, but it cannot test
paper feed or cutting.

## Paper width

Choose the profile that matches the roll loaded in the printer:

| Profile | Roll | Drawing width |
| --- | --- | --- |
| `80mm-576` | 80 mm | 576 dots |
| `58mm-420` | 58 mm | 420 dots |

OpenReceipt draws the narrow layout at 420 dots instead of squeezing the 80 mm image. The preview
should therefore wrap like the printed paper. See the [thermal paper guide](/guides/58mm-vs-80mm-thermal-paper)
for roll material and width choices.

## Raspberry Pi

For a permanent setup, connect the TM-L90 to the Pi, install the project with the commands above,
and leave `petes-printer --web-dist ./dist` running. Install libusb first on Debian-based systems:

~~~bash
sudo apt update
sudo apt install libusb-1.0-0
~~~

Linux may require a udev rule for the confirmed Epson USB ID. Use the rule to grant the bridge user
access to the device; do not run the bridge as root. The [python-escpos USB installation guide](https://github.com/python-escpos/python-escpos/blob/master/doc/user/installation.rst)
shows the permission pattern.

For the tested device, the rule can contain:

~~~text
SUBSYSTEM=="usb", ATTR{idVendor}=="04b8", ATTR{idProduct}=="0202", MODE="0660", GROUP="plugdev"
~~~

Then reload udev and reconnect the printer:

~~~bash
sudo usermod -aG plugdev "$USER"
sudo udevadm control --reload-rules
sudo udevadm trigger
~~~

Log out and back in after changing group membership.

Open the editor in a browser on the Pi to complete setup and print the test slip. If you need to
operate that editor from a laptop, tunnel the Pi's loopback port over SSH:

~~~bash
ssh -N -L 8731:127.0.0.1:8731 pi@raspberrypi.local
~~~

Then open `http://127.0.0.1:8731` on the laptop. Do not expose the bridge directly on the LAN or
the public internet; v1 has no remote-access authentication.

For an agent that runs locally on the Pi, the headless MCP server can use the same bridge for
drafting and previewing without an open browser. The default print policy still requires approval
in the local editor. See [bridge/README.md](../../bridge/README.md) for token and MCP configuration.

## First real print

1. Load the roll with the coated side facing the print head and power on the TM-L90.
2. Start the bridge without `PETES_PRINTER_TRANSPORT=dummy`.
3. Open setup, select the detected Epson, and choose the loaded paper width.
4. Press **Test connection** and check the slip.
5. Draft a receipt, review the preview, and approve the print.

The bridge sends one black-and-white image, then feed and cut commands. The printer does not lay
out the receipt text itself.

## Troubleshooting

**The bridge is unavailable.** Start the bridge and open the app on the same machine. A public site
cannot reach a local laptop or Pi bridge.

**The printer is not detected.** Check power and USB, then compare `lsusb` with `04b8:0202` and the
interface and endpoint values above.

**It works only as root on Linux.** Add a device-specific udev rule and keep the bridge under an
unprivileged user.

**The receipt is clipped.** Match the selected profile to the loaded roll and the printer's paper
guide. The layout is measured in printer dots.

**The cutter does not fire.** Confirm that the unit has a cutter and that its self-test activates it.

**The result is unknown.** Check the paper before retrying. Transmission may have completed even
if the bridge lost the final response, so retrying automatically could print a duplicate.

## Sources

- [Epson TM-L90 user manual](https://files.support.epson.com/pdf/pos/bulk/tm-l90_4-um_en_tc_01.pdf)
- [python-escpos USB usage guide](https://github.com/python-escpos/python-escpos/blob/master/doc/user/usage.rst)
- [python-escpos USB installation and udev guidance](https://github.com/python-escpos/python-escpos/blob/master/doc/user/installation.rst)
