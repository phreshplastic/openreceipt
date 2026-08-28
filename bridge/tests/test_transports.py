import io

from PIL import Image

from petes_printer_bridge.transports import EscposTransport


class FakePrinter:
    def __init__(self):
        self.calls = []

    def image(self, image, **options):
        self.calls.append(("image", image.size, options))

    def text(self, value):
        self.calls.append(("text", value))

    def cut(self, **options):
        self.calls.append(("cut", options))


def test_raster_transport_feeds_once_and_cuts_without_extra_feed():
    artifact = io.BytesIO()
    Image.new("1", (16, 8), 1).save(artifact, format="PNG")
    printer = FakePrinter()
    EscposTransport(printer).print_image(artifact.getvalue(), 4, "full")
    assert printer.calls[-2] == ("text", "\n" * 4)
    assert printer.calls[-1] == ("cut", {"mode": "FULL", "feed": False})
