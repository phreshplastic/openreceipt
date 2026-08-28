from __future__ import annotations

import argparse
import os
from pathlib import Path

import uvicorn
from platformdirs import user_data_path

from .app import create_app


def main() -> None:
    parser = argparse.ArgumentParser(description="Pete's Printer local web and printer bridge")
    parser.add_argument("--host", default=os.environ.get("PETES_PRINTER_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("PETES_PRINTER_PORT", "8731")))
    parser.add_argument("--data-dir", type=Path, default=user_data_path("petes-printer"))
    parser.add_argument("--web-dist", type=Path)
    args = parser.parse_args()
    app = create_app(args.data_dir, args.web_dist)
    uvicorn.run(app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
