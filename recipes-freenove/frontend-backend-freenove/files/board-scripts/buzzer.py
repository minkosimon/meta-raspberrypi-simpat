#!/usr/bin/env python3
"""Buzzer control — active/passive buzzer (FNK0054).
Usage: buzzer.py <pin> <on|off|tone> [frequency] [duration_s]
Output: JSON
"""
import json
import sys
import time
from pathlib import Path

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


def _led_dir_for_pin(pin: int) -> Path:
    led_index = GPIO_TO_LED.get(pin)
    if led_index is None:
        raise RuntimeError(f"Unsupported buzzer pin GPIO{pin}")
    led_dir = Path(f"/sys/class/leds/freenove:led{led_index}")
    if not led_dir.is_dir():
        raise RuntimeError(f"Missing Freenove LED sysfs node for GPIO{pin}: {led_dir}")
    return led_dir


def _set_led_state(pin: int, value: int) -> None:
    led_dir = _led_dir_for_pin(pin)
    (led_dir / "trigger").write_text("none", encoding="utf-8")
    (led_dir / "brightness").write_text("1" if value else "0", encoding="utf-8")


def buzzer_on(pin: int):
    _set_led_state(pin, 1)
    print(json.dumps({"pin": pin, "state": "on"}))


def buzzer_off(pin: int):
    _set_led_state(pin, 0)
    print(json.dumps({"pin": pin, "state": "off"}))


def buzzer_tone(pin: int, freq: int, duration: float):
    half_period = max(0.0005, 0.5 / max(1, freq))
    deadline = time.monotonic() + max(0.0, duration)
    while time.monotonic() < deadline:
        _set_led_state(pin, 1)
        time.sleep(half_period)
        _set_led_state(pin, 0)
        time.sleep(half_period)
    _set_led_state(pin, 0)
    print(json.dumps({"pin": pin, "frequency": freq, "duration": duration, "state": "done"}))


if __name__ == "__main__":
    pin = int(sys.argv[1]) if len(sys.argv) > 1 else 25
    state = sys.argv[2] if len(sys.argv) > 2 else "off"
    freq = int(sys.argv[3]) if len(sys.argv) > 3 else 440
    duration = float(sys.argv[4]) if len(sys.argv) > 4 else 0.5

    if state == "on":
        buzzer_on(pin)
    elif state == "tone":
        buzzer_tone(pin, freq, duration)
    else:
        buzzer_off(pin)
