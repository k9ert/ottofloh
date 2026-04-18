#!/usr/bin/env python3
"""Download confirmed registrations from Airtable and produce a
Google-My-Maps-ready CSV in ./build/.

Usage:
    python scripts/airtable_export.py

Requires AIRTABLE_API_KEY as env var or in secrets.yaml.
"""

import csv
import os
import re
import sys
import urllib.request
import json

BASE_ID = "appbtLFYW5FJqeDj2"
TABLE_NAME = "Registrations"
CITY_SUFFIX = ", 85521 Ottobrunn"

BUILD_DIR = os.path.join(os.path.dirname(__file__), "..", "build")
RAW_CSV = os.path.join(BUILD_DIR, "airtable_raw.csv")
CLEAN_CSV = os.path.join(BUILD_DIR, "airtable_export.csv")


def get_api_key():
    key = os.environ.get("AIRTABLE_API_KEY")
    if key:
        return key
    # fall back to secrets.yaml
    try:
        import yaml
        with open(os.path.join(os.path.dirname(__file__), "..", "secrets.yaml")) as f:
            data = yaml.safe_load(f)
            key = data.get("airtable_api_key")
            if key:
                return key
    except Exception:
        pass
    print("Error: set AIRTABLE_API_KEY env var or airtable_api_key in secrets.yaml")
    sys.exit(1)


def fetch_records(api_key):
    """Fetch all confirmed registrations via Airtable REST API (pagination-aware)."""
    records = []
    url = (
        f"https://api.airtable.com/v0/{BASE_ID}/{TABLE_NAME}"
        f"?filterByFormula=%7BStatus%7D%3D%22confirmed%22"
    )
    while url:
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {api_key}"})
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read())
        records.extend(data.get("records", []))
        offset = data.get("offset")
        url = (
            f"https://api.airtable.com/v0/{BASE_ID}/{TABLE_NAME}"
            f"?filterByFormula=%7BStatus%7D%3D%22confirmed%22&offset={offset}"
        ) if offset else None
    return records


def normalize_address(addr):
    """Ensure address ends with ', 85521 Ottobrunn' and fix common issues."""
    addr = addr.strip()
    # collapse whitespace
    addr = re.sub(r"\s+", " ", addr)
    # strip trailing commas
    addr = addr.rstrip(",").strip()
    # remove existing city/postal suffix variants so we can re-append cleanly
    addr = re.sub(r",?\s*85521\s*,?\s*Ottobrunn\s*$", "", addr, flags=re.IGNORECASE).rstrip(",").strip()
    addr = re.sub(r",?\s*Ottobrunn\s*$", "", addr, flags=re.IGNORECASE).rstrip(",").strip()
    return addr + CITY_SUFFIX


def write_raw(records):
    """Write raw Airtable fields to CSV."""
    fields_to_export = ["Name", "Address", "Notes", "Status"]
    with open(RAW_CSV, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fields_to_export, extrasaction="ignore")
        w.writeheader()
        for r in records:
            w.writerow(r.get("fields", {}))
    print(f"Raw CSV: {RAW_CSV} ({len(records)} records)")


def write_clean(records):
    """Produce a cleaned CSV ready for Google My Maps import.

    Columns: Address, Name (mapped from Airtable 'Notes' field).
    'Name' in My Maps becomes the pin description.
    """
    by_addr = {}  # normalized addr -> list of (raw_addr, name_field)
    skipped_blank = 0
    rows = []
    for r in records:
        fields = r.get("fields", {})
        raw_addr = fields.get("Address", "").strip()
        if not raw_addr:
            skipped_blank += 1
            continue
        addr = normalize_address(raw_addr)
        name_field = fields.get("Name", "")
        if addr not in by_addr:
            by_addr[addr] = []
            rows.append({"Address": addr, "Name": fields.get("Notes", "")})
        by_addr[addr].append((raw_addr, name_field))

    with open(CLEAN_CSV, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=["Address", "Name"])
        w.writeheader()
        for row in rows:
            w.writerow(row)

    dupe_groups = {addr: entries for addr, entries in by_addr.items() if len(entries) > 1}
    total_dupes = sum(len(entries) - 1 for entries in dupe_groups.values())
    print(f"Clean CSV: {CLEAN_CSV} ({len(rows)} addresses, {total_dupes} deduped, {skipped_blank} blank)")

    if dupe_groups:
        print(f"\n--- Duplicates ({len(dupe_groups)} address(es), {total_dupes} extra row(s)) ---")
        for addr, entries in dupe_groups.items():
            print(f"  {addr}")
            for raw_addr, name in entries:
                print(f"    - {name!r:30s}  raw: {raw_addr!r}")


def main():
    os.makedirs(BUILD_DIR, exist_ok=True)
    api_key = get_api_key()
    print("Fetching confirmed registrations from Airtable...")
    records = fetch_records(api_key)
    print(f"Fetched {len(records)} confirmed records")
    write_raw(records)
    write_clean(records)
    print(f"\nNext: import {CLEAN_CSV} into Google My Maps")
    print("  - Position placemarks by: Address")
    print("  - Title markers by: Address")


if __name__ == "__main__":
    main()
