#!/usr/bin/env python3
"""Fan control helper for the FNK0054 board.

Usage:
    fan_control.py status
    fan_control.py set <on|off>
Output: JSON
"""
import json
import sys
from pathlib import Path


FAN_INPUT_PATH = Path("/sys/class/hwmon/hwmon1/fan1_input")
FAN_PWM_PATH = Path("/sys/class/hwmon/hwmon1/pwm1")


def read_rpm() -> int | None:
    try:
        return int(FAN_INPUT_PATH.read_text(encoding="utf-8").strip())
    except (FileNotFoundError, ValueError):
        return None


def status_payload() -> dict:
    rpm = read_rpm()
    return {
        "fan_available": rpm is not None,
        "fan_rpm": rpm,
        "fan_active": rpm is not None and rpm > 0,
    }


def set_fan(enabled: bool) -> dict:
    FAN_PWM_PATH.write_text("255\n" if enabled else "0\n", encoding="utf-8")
    payload = status_payload()
    payload["requested_pwm"] = 255 if enabled else 0
    payload["requested_state"] = "on" if enabled else "off"
    return payload


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("usage: fan_control.py <status|set> [on|off]")

    command = sys.argv[1]

    if command == "status":
        print(json.dumps(status_payload()))
        return

    if command == "set":
        if len(sys.argv) != 3 or sys.argv[2] not in {"on", "off"}:
            raise SystemExit("usage: fan_control.py set <on|off>")
        print(json.dumps(set_fan(sys.argv[2] == "on")))
        return

    raise SystemExit(f"unknown command: {command}")


if __name__ == "__main__":
    main()