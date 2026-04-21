#!/usr/bin/env python3
"""Unified GPIO + Freenove LED manager for FNK0054.

Usage examples:
  manage_GPIO_led.py led-status <index>
  manage_GPIO_led.py led-set <index> <0|1>
  manage_GPIO_led.py led-trigger <index> <none|timer>

  manage_GPIO_led.py gpio-setup <pin> <in|out>
  manage_GPIO_led.py gpio-write <pin> <0|1>
  manage_GPIO_led.py gpio-read <pin>
  manage_GPIO_led.py gpio-read-many <pin1> [pin2 ...]
"""

import json
import sys
from pathlib import Path

# Mapping extracted from freenove-overlay.dts (leds-gpios order).
GPIO_TO_LED = {
    4: 0,
    5: 1,
    6: 2,
    12: 3,
    13: 4,
    17: 5,
    18: 6,
    22: 7,
    23: 8,
    24: 9,
    25: 10,
    26: 11,
    27: 12,
}


def _led_dir(index: int) -> Path:
    return Path(f"/sys/class/leds/freenove:led{index}")


def _led_for_gpio(pin: int):
    return GPIO_TO_LED.get(pin)


def _led_exists(index: int) -> bool:
    return _led_dir(index).is_dir()


def _read_led_brightness(index: int) -> int:
    text = (_led_dir(index) / "brightness").read_text(encoding="utf-8").strip()
    return 1 if text == "1" else 0


def _write_led_brightness(index: int, value: int) -> None:
    (_led_dir(index) / "brightness").write_text(str(1 if value else 0), encoding="utf-8")


def led_status(index: int) -> int:
    led = _led_dir(index)
    if not led.is_dir():
        print("error=missing_led")
        return 2

    brightness = (led / "brightness").read_text(encoding="utf-8").strip()
    trigger = (led / "trigger").read_text(encoding="utf-8").strip()
    print(f"led=freenove:led{index}")
    print(f"brightness={brightness}")
    print(f"trigger={trigger}")
    return 0


def led_set(index: int, value: int) -> int:
    if not _led_exists(index):
        print("error=missing_led")
        return 2

    safe = 1 if int(value) else 0
    _write_led_brightness(index, safe)
    brightness = str(_read_led_brightness(index))
    print(f"brightness={brightness}")
    return 0


def led_trigger(index: int, trigger: str) -> int:
    led = _led_dir(index)
    if not _led_exists(index):
        print("error=missing_led")
        return 2

    if trigger not in {"none", "timer"}:
        print("error=invalid_trigger")
        return 2

    (led / "trigger").write_text(trigger, encoding="utf-8")
    current = (led / "trigger").read_text(encoding="utf-8").strip()
    print(f"trigger={current}")
    return 0


def gpio_setup(pin: int, direction: str) -> int:
    led_index = _led_for_gpio(pin)
    if led_index is None:
        print(json.dumps({"error": "gpio_not_mapped", "pin": pin}))
        return 1
    print(json.dumps({"pin": pin, "direction": direction, "led": led_index}))
    return 0


def gpio_write(pin: int, value: int) -> int:
    led_index = _led_for_gpio(pin)
    if led_index is None:
        print(json.dumps({"error": "gpio_not_mapped", "pin": pin}))
        return 1
    if not _led_exists(led_index):
        print(json.dumps({"error": "missing_led", "pin": pin, "led": led_index}))
        return 2

    safe = 1 if int(value) else 0
    _write_led_brightness(led_index, safe)
    print(json.dumps({"pin": pin, "value": safe, "led": led_index}))
    return 0


def gpio_read(pin: int) -> int:
    led_index = _led_for_gpio(pin)
    if led_index is None:
        print(json.dumps({"pin": pin, "value": 0, "mapped": False}))
        return 0
    if not _led_exists(led_index):
        print(json.dumps({"error": "missing_led", "pin": pin, "led": led_index}))
        return 2

    value = _read_led_brightness(led_index)
    print(json.dumps({"pin": pin, "value": value, "mapped": True, "led": led_index}))
    return 0


def gpio_read_many(pins) -> int:
    values = {}
    unmapped = []
    for pin in pins:
        led_index = _led_for_gpio(pin)
        if led_index is None:
            values[str(pin)] = 0
            unmapped.append(pin)
            continue
        if not _led_exists(led_index):
            print(json.dumps({"error": "missing_led", "pin": pin, "led": led_index}))
            return 2
        values[str(pin)] = _read_led_brightness(led_index)

    payload = {"pins": values}
    if unmapped:
        payload["unmapped"] = unmapped
    print(json.dumps(payload))
    return 0


def _usage() -> int:
    print(json.dumps({"error": "usage: manage_GPIO_led.py <command> [args...]"}))
    return 1


def main() -> int:
    if len(sys.argv) < 2:
        return _usage()

    cmd = sys.argv[1]

    if cmd == "led-status":
        if len(sys.argv) < 3:
            return _usage()
        return led_status(int(sys.argv[2]))

    if cmd == "led-set":
        if len(sys.argv) < 4:
            return _usage()
        return led_set(int(sys.argv[2]), int(sys.argv[3]))

    if cmd == "led-trigger":
        if len(sys.argv) < 4:
            return _usage()
        return led_trigger(int(sys.argv[2]), str(sys.argv[3]))

    if cmd == "gpio-setup":
        if len(sys.argv) < 4:
            return _usage()
        return gpio_setup(int(sys.argv[2]), str(sys.argv[3]))

    if cmd == "gpio-write":
        if len(sys.argv) < 4:
            return _usage()
        return gpio_write(int(sys.argv[2]), int(sys.argv[3]))

    if cmd == "gpio-read":
        if len(sys.argv) < 3:
            return _usage()
        return gpio_read(int(sys.argv[2]))

    if cmd == "gpio-read-many":
        if len(sys.argv) < 3:
            return _usage()
        pins = [int(p) for p in sys.argv[2:]]
        return gpio_read_many(pins)

    print(json.dumps({"error": f"unknown command: {cmd}"}))
    return 1


if __name__ == "__main__":
    sys.exit(main())
