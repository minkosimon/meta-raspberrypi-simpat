#!/usr/bin/env python3
"""Buzzer control — active/passive buzzer (FNK0054).
Usage: buzzer.py <pin> <on|off|tone> [frequency] [duration_s]
Output: JSON
"""
import json
import sys
import time
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


def _led_dir_for_pin(pin: int) -> Path:
    led_index = GPIO_TO_LED.get(pin)
    if led_index is None:
        raise RuntimeError(f"Unsupported buzzer pin GPIO{pin}")
    led_dir = Path(f"/sys/class/leds/freenove:led{led_index}")
    if not led_dir.is_dir():
        raise RuntimeError(f"Missing Freenove LED sysfs node for GPIO{pin}: {led_dir}")
    return led_dir


def _write_node(path: Path, value: str) -> None:
    path.write_text(value, encoding="utf-8")


def _set_trigger(led_dir: Path, trigger: str) -> None:
    _write_node(led_dir / "trigger", trigger)


def _set_brightness(led_dir: Path, value: int) -> None:
    _write_node(led_dir / "brightness", "1\n" if value else "0\n")


def _set_timer_period(led_dir: Path, delay_ms: int) -> None:
    safe_delay = max(1, int(delay_ms))
    _write_node(led_dir / "delay_on", f"{safe_delay}\n")
    _write_node(led_dir / "delay_off", f"{safe_delay}\n")


def _half_period_ms(freq: int) -> int:
    return max(1, round(500 / max(1, int(freq))))


def buzzer_on(pin: int):
    led_dir = _led_dir_for_pin(pin)
    _set_trigger(led_dir, "none")
    _set_brightness(led_dir, 1)
    print(json.dumps({"pin": pin, "state": "on"}))


def buzzer_off(pin: int):
    led_dir = _led_dir_for_pin(pin)
    _set_trigger(led_dir, "none")
    _set_brightness(led_dir, 0)
    print(json.dumps({"pin": pin, "state": "off"}))


def buzzer_tone(pin: int, freq: int, duration: float):
    led_dir = _led_dir_for_pin(pin)
    half_period_ms = _half_period_ms(freq)
    effective_freq = round(1000 / (half_period_ms * 2), 2)

    try:
        _set_trigger(led_dir, "none")
        _set_brightness(led_dir, 0)
        _set_timer_period(led_dir, half_period_ms)
        _set_trigger(led_dir, "timer")
        time.sleep(max(0.0, duration))
    finally:
        _set_trigger(led_dir, "none")
        _set_brightness(led_dir, 0)
    print(json.dumps({
        "pin": pin,
        "frequency": freq,
        "effective_frequency": effective_freq,
        "duration": duration,
        "state": "done",
    }))


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
