"""Explicit physical smoke check: run with the bridge's Python environment."""
import argparse
import base64
import hashlib
import json
import time
from uuid import uuid4

import httpx

parser = argparse.ArgumentParser(description="Print short, numbered 80 mm verification slips and check deduplication.")
parser.add_argument("--url", default="http://127.0.0.1:8731")
parser.add_argument("--count", type=int, default=1)
args = parser.parse_args()
if not 1 <= args.count <= 10:
    parser.error("count must be between 1 and 10")

with httpx.Client(base_url=args.url, timeout=40) as client:
    session = client.post("/api/v1/session").json()
    headers = {"X-CSRF-Token": session["csrfToken"], "X-Bridge-Session": session["sessionToken"]}
    capabilities = client.get("/api/v1/capabilities").json()
    if capabilities["transport"] != "usb" or not capabilities["connected"]:
        raise SystemExit(f"A real USB printer must be selected and ready: {capabilities['detail']}")
    for number in range(1, args.count + 1):
        document = {"schemaVersion": 2, "id": str(uuid4()), "title": f"Reliability {number:02}",
                    "page": {"paperWidthMm": 80, "printableWidthDots": 576, "paddingDots": 28},
                    "blocks": [{"id": str(uuid4()), "type": "heading", "text": f"OpenReceipt {number:02} / {args.count}", "level": "heading", "weight": "bold", "italic": False, "underline": False, "align": "left"},
                               {"id": str(uuid4()), "type": "text", "text": "USB queue check · 80 mm", "size": "small", "weight": "regular", "italic": False, "underline": False, "align": "left"}]}
        response = client.post("/api/v1/render", headers=headers, json={"document": document})
        response.raise_for_status()
        rendered = response.json()
        artifact = base64.b64decode(rendered["png"])
        metadata = {"id": str(uuid4()), "checksum": hashlib.sha256(artifact).hexdigest(),
                    "rendererVersion": rendered["rendererVersion"], "document": document,
                    "width": 576, "height": rendered["height"], "feedLines": 4, "cutMode": "full"}
        def submit():
            value = client.post("/api/v1/print-jobs", headers=headers, data={"metadata": json.dumps(metadata)}, files={"artifact": ("receipt.png", artifact, "image/png")})
            value.raise_for_status()
            return value
        submit()
        for _ in range(300):
            job = client.get(f"/api/v1/print-jobs/{metadata['id']}").json()
            if job["status"] in {"succeeded", "failed", "unknown", "waiting_for_printer"}:
                break
            time.sleep(.1)
        if job["status"] != "succeeded":
            raise SystemExit(f"Stopped: {job['status']}: {job.get('error')}. Check the paper before retrying.")
        assert submit().headers["x-idempotent-replay"] == "true"
        print(f"{number:02}/{args.count} transmitted; duplicate submission suppressed", flush=True)
