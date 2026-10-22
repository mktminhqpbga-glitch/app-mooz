#!/bin/sh
set -eu
cd "$(dirname "$0")"
if [ ! -d .venv ]; then python3 -m venv .venv; fi
if ! .venv/bin/python -c 'import yt_dlp' 2>/dev/null; then .venv/bin/python -m pip install -r requirements.txt; fi
exec .venv/bin/python server.py
