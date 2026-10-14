from __future__ import annotations

from io import BytesIO
from pathlib import Path
from typing import Protocol

from PIL import Image
from escpos.printer import Dummy, Usb
import usb.backend.libusb1


class PrintTransport(Protocol):
    def prepare(self) -> None: ...
    def print_image(self, image_bytes: bytes, feed_lines: int, cut_mode: str) -> None: ...
    def close(self) -> None: ...


class EscposTransport:
    def __init__(self, printer):
        self.printer = printer

    def prepare(self) -> None:
        self.printer.open()

    def print_image(self, image_bytes: bytes, feed_lines: int, cut_mode: str) -> None:
        with Image.open(BytesIO(image_bytes)) as image:
            # python-escpos owns the monochrome conversion and inversion needed
            # by ESC/POS. Pre-converting here can invert the receipt twice.
            self.printer.image(image, impl="bitImageRaster", center=False)
        if feed_lines:
            self.printer.text("\n" * feed_lines)
        self.printer.cut(mode="FULL" if cut_mode == "full" else "PART", feed=False)

    def close(self) -> None:
        self.printer.close()


class DummyFileTransport(EscposTransport):
    def __init__(self, output_path: Path):
        self.output_path = output_path
        super().__init__(Dummy())

    def prepare(self) -> None:
        self.output_path.parent.mkdir(parents=True, exist_ok=True)

    def close(self) -> None:
        self.output_path.write_bytes(self.printer.output)


def create_usb_transport() -> PrintTransport:
    cached = usb.backend.libusb1.get_backend()
    if cached is None:
        raise RuntimeError("The libusb backend is unavailable.")
    # libusb's cached context can miss host hotplug events inside Docker. PyUSB
    # exposes no public uncached factory; isolate this version-pinned seam here.
    # The Device retains the backend until its resources have been released.
    fresh = usb.backend.libusb1._LibUSB(cached.lib)
    return EscposTransport(Usb(0x04B8, 0x0202, interface=0, in_ep=0x82, out_ep=0x01, timeout=30_000, usb_args={"backend": fresh}))


def create_dummy_transport(output_path: Path) -> PrintTransport:
    return DummyFileTransport(output_path)
