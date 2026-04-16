#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -d .venv ]; then
    echo "Creating venv..."
    python3 -m venv .venv
    .venv/bin/pip install -r requirements.txt -q
fi

source .venv/bin/activate
python scripts/airtable_export.py
