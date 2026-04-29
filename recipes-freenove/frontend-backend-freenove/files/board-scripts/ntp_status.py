#!/usr/bin/env python3
"""Read and parse the machine-readable Chrony status file."""

from __future__ import annotations

import json
from pathlib import Path


NTP_STATUS_PATH = Path("/tmp/ntp/status")


def read_ntp_status(path: Path = NTP_STATUS_PATH) -> dict:
    status = {
        "available": False,
        "sync_state": "UNAVAILABLE",
        "source_clock": None,
        "reference_time_utc": None,
        "update_interval": None,
        "last_offset": None,
    }

    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except FileNotFoundError:
        return status

    data = {}
    for raw_line in lines:
        line = raw_line.strip()
        if not line or "=" not in line:
            continue
        key, value = line.split("=", 1)
        data[key] = value

    source_clock = data.get("selected_source") or data.get("reference_source")
    sync_state = data.get("sync_state") or "UNAVAILABLE"

    status.update(
        {
            "available": True,
            "sync_state": sync_state,
            "source_clock": source_clock or None,
            "reference_time_utc": data.get("reference_time_utc") or None,
            "update_interval": data.get("update_interval") or None,
            "last_offset": data.get("last_offset") or None,
        }
    )
    return status


def main() -> None:
    print(json.dumps(read_ntp_status()))


if __name__ == "__main__":
    main()