from __future__ import annotations

from io import BytesIO
from pathlib import Path
from typing import Protocol

from PIL import Image
from escpos.printer import Dummy, Usb


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
            self.printer.image(image.convert("1"), impl="bitImageRaster", center=False)
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
    return EscposTransport(Usb(0x04B8, 0x0202, interface=0, in_ep=0x82, out_ep=0x01, timeout=30_000))


def create_dummy_transport(output_path: Path) -> PrintTransport:
    return DummyFileTransport(output_path)
