#!/usr/bin/env python3
"""HC-SR04 ultrasonic distance sensor (FNK0054) via sysfs GPIO.

Usage: ultrasonic.py [trig_pin] [echo_pin]
Defaults: trig=20, echo=21
Output: JSON {"distance_cm": float}

On this Raspberry Pi 5 image, RPi.GPIO fails with "Mmap of GPIO registers
failed". The user-facing RP1 GPIOs remain accessible through `/sys/class/gpio`,
so this reader uses sysfs like the PIR and keypad scripts.
"""

import json
import os
import sys
import time
from pathlib import Path


SYSFS_GPIO_DIR = Path("/sys/class/gpio")
RP1_LABEL = "pinctrl-rp1"
SPEED_OF_SOUND_CM_S = 34300
TRIGGER_PULSE_SECONDS = 0.00001
SETTLE_SECONDS = 0.05
EDGE_TIMEOUT_SECONDS = 0.1


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


def _write_value(global_pin: int, value: int) -> None:
    _gpio_value(global_pin).write_text("1\n" if value else "0\n", encoding="utf-8")


def _open_value_fd(global_pin: int) -> int:
    return os.open(_gpio_value(global_pin), os.O_RDONLY)


def _read_value_fd(fd: int) -> int:
    os.lseek(fd, 0, os.SEEK_SET)
    return 1 if os.read(fd, 1) == b"1" else 0


def measure_distance(trig: int, echo: int) -> dict:
    trig_global = _global_gpio(trig)
    echo_global = _global_gpio(echo)
    echo_fd = -1

    try:
        _export_gpio(trig_global)
        _export_gpio(echo_global)
        _set_direction(trig_global, "out")
        _set_direction(echo_global, "in")
        _write_value(trig_global, 0)
        time.sleep(SETTLE_SECONDS)

        echo_fd = _open_value_fd(echo_global)

        _write_value(trig_global, 1)
        time.sleep(TRIGGER_PULSE_SECONDS)
        _write_value(trig_global, 0)

        start_ns = 0
        deadline = time.monotonic() + EDGE_TIMEOUT_SECONDS
        while time.monotonic() < deadline:
            if _read_value_fd(echo_fd) == 1:
                start_ns = time.monotonic_ns()
                break
        if not start_ns:
            return {"error": "timeout_waiting_for_echo_start", "trig_pin": trig, "echo_pin": echo}

        end_ns = 0
        deadline = time.monotonic() + EDGE_TIMEOUT_SECONDS
        while time.monotonic() < deadline:
            if _read_value_fd(echo_fd) == 0:
                end_ns = time.monotonic_ns()
                break
        if not end_ns:
            return {"error": "timeout_waiting_for_echo_end", "trig_pin": trig, "echo_pin": echo}

        elapsed_seconds = (end_ns - start_ns) / 1_000_000_000
        distance_cm = round((elapsed_seconds * SPEED_OF_SOUND_CM_S) / 2, 2)
        return {
            "distance_cm": distance_cm,
            "trig_pin": trig,
            "echo_pin": echo,
            "backend": "sysfs-gpio",
        }
    finally:
        if echo_fd >= 0:
            os.close(echo_fd)
        _write_value(trig_global, 0)
        _unexport_gpio(trig_global)
        _unexport_gpio(echo_global)


if __name__ == "__main__":
    trig = int(sys.argv[1]) if len(sys.argv) > 1 else 20
    echo = int(sys.argv[2]) if len(sys.argv) > 2 else 21
    print(json.dumps(measure_distance(trig, echo)))
