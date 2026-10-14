"""Regenerate Node/browser font data from the checked-in static Inter fonts."""
from pathlib import Path
import base64
import json

root = Path(__file__).resolve().parents[1]
fonts = [root / f"src/assets/fonts/inter-{weight}.ttf" for weight in ("regular", "medium", "bold")]
data = ["data:font/ttf;base64," + base64.b64encode(path.read_bytes()).decode() for path in fonts]
italic = ["data:font/ttf;base64," + base64.b64encode((root / f"src/assets/fonts/inter-{weight}-italic.ttf").read_bytes()).decode() for weight in ("regular", "medium", "bold")]
marks = []
for family in ("Serif", "Sans", "Mono"):
    for weight, name in ((400, "Regular"), (700, "Bold")):
        path = root / f"src/assets/fonts/Liberation{family}-{name}.ttf"
        marks.append({"family": f"Liberation {family}", "weight": weight, "data": "data:font/ttf;base64," + base64.b64encode(path.read_bytes()).decode()})
(root / "src/receipt/font-data.ts").write_text("// Generated from bundled fonts by scripts/generate-receipt-font-data.py.\nexport const bodyFontData = " + json.dumps(data) + ";\nexport const italicFontData = " + json.dumps(italic) + ";\nexport const wordmarkFontData = " + json.dumps(marks) + ";\n")
