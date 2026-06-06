#!/usr/bin/env python3
"""Read the Freenove PIR infrared motion sensor (HC-SR501) via sysfs GPIO."""

import json
import sys
import time
from pathlib import Path


SYSFS_GPIO_DIR = Path("/sys/class/gpio")
RP1_LABEL = "pinctrl-rp1"


def _rp1_gpio_base() -> int:
    for chip in SYSFS_GPIO_DIR.glob("gpiochip*"):
        label_path = chip / "label"
        base_path = chip / "base"
        if not label_path.exists() or not base_path.exists():
            continue
        if label_path.read_text(encoding="utf-8").strip() == RP1_LABEL:
            return int(base_path.read_text(encoding="utf-8").strip())
    raise RuntimeError(f"GPIO chip label '{RP1_LABEL}' not found")


GPIO_BASE = _rp1_gpio_base()


def _global_gpio(bcm_pin: int) -> int:
    return GPIO_BASE + int(bcm_pin)


def _gpio_dir(global_pin: int) -> Path:
    return SYSFS_GPIO_DIR / f"gpio{global_pin}" / "direction"


def _gpio_value(global_pin: int) -> Path:
    return SYSFS_GPIO_DIR / f"gpio{global_pin}" / "value"


def _export_gpio(global_pin: int) -> None:
    gpio_dir = SYSFS_GPIO_DIR / f"gpio{global_pin}"
    if gpio_dir.exists():
        return
    (SYSFS_GPIO_DIR / "export").write_text(f"{global_pin}\n", encoding="utf-8")


def _unexport_gpio(global_pin: int) -> None:
    gpio_dir = SYSFS_GPIO_DIR / f"gpio{global_pin}"
    if not gpio_dir.exists():
        return
    (SYSFS_GPIO_DIR / "unexport").write_text(f"{global_pin}\n", encoding="utf-8")


def _set_direction(global_pin: int, direction: str) -> None:
    _gpio_dir(global_pin).write_text(direction, encoding="utf-8")


def _read_value(global_pin: int) -> int:
    return int(_gpio_value(global_pin).read_text(encoding="utf-8").strip() or "0")


def main() -> int:
    pin = int(sys.argv[1]) if len(sys.argv) > 1 else 24
    settle_ms = int(sys.argv[2]) if len(sys.argv) > 2 else 20
    global_pin = _global_gpio(pin)

    try:
        _export_gpio(global_pin)
        _set_direction(global_pin, "in")
        time.sleep(max(0, settle_ms) / 1000.0)
        value = _read_value(global_pin)
        print(
            json.dumps(
                {
                    "pin": pin,
                    "global_pin": global_pin,
                    "value": value,
                    "detected": bool(value),
                    "active_high": True,
                    "sensor": "HC-SR501",
                    "warmup_seconds": 60,
                    "backend": "sysfs-gpio",
                }
            )
        )
        return 0
    finally:
        _unexport_gpio(global_pin)


if __name__ == "__main__":
    raise SystemExit(main())
