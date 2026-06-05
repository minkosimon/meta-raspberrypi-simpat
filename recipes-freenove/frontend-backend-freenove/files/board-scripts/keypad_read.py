#!/usr/bin/env python3
"""Read a Freenove 4x4 matrix keypad using sysfs GPIO on Raspberry Pi 5.

Wiring from the Freenove tutorial / board schematic:
    rows = GPIO16, GPIO20, GPIO21, GPIO26
    cols = GPIO19, GPIO13, GPIO6, GPIO5

On this Pi 5 image, RPi.GPIO fails with "Mmap of GPIO registers failed".
The header GPIOs are exposed through the RP1 controller (`pinctrl-rp1`) and
remain available via `/sys/class/gpio`, so the keypad scanner uses sysfs.
"""

import json
import sys
import time
from collections import Counter
from pathlib import Path


SYSFS_GPIO_DIR = Path("/sys/class/gpio")
RP1_LABEL = "pinctrl-rp1"
ROW_PINS = [16, 20, 21, 26]
COL_PINS = [19, 13, 6, 5]
KEYS = [
    ["1", "2", "3", "A"],
    ["4", "5", "6", "B"],
    ["7", "8", "9", "C"],
    ["*", "0", "#", "D"],
]


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


def _read_value(global_pin: int) -> int:
    return int(_gpio_value(global_pin).read_text(encoding="utf-8").strip() or "0")


def _configure_gpio() -> tuple[list[int], list[int]]:
    row_globals = [_global_gpio(pin) for pin in ROW_PINS]
    col_globals = [_global_gpio(pin) for pin in COL_PINS]

    for global_pin in row_globals + col_globals:
        _export_gpio(global_pin)

    for global_pin in row_globals:
        _set_direction(global_pin, "in")

    for global_pin in col_globals:
        _set_direction(global_pin, "out")
        _write_value(global_pin, 1)

    return row_globals, col_globals


def _scan_once(row_globals: list[int], col_globals: list[int]):
    for col_index, col_global in enumerate(col_globals):
        _write_value(col_global, 0)
        time.sleep(0.001)

        for row_index, row_global in enumerate(row_globals):
            if _read_value(row_global) == 0:
                return {
                    "key": KEYS[row_index][col_index],
                    "row_index": row_index,
                    "col_index": col_index,
                    "row_pin": ROW_PINS[row_index],
                    "col_pin": COL_PINS[col_index],
                }

        _write_value(col_global, 1)

    return None


def _restore_columns_high(col_globals: list[int]) -> None:
    for col_global in col_globals:
        _write_value(col_global, 1)


def _confirm_press(
    initial: dict,
    debounce_ms: int,
    row_globals: list[int],
    col_globals: list[int],
):
    samples = [initial]
    deadline = time.monotonic() + (max(10, debounce_ms) / 1000.0)

    while time.monotonic() < deadline:
        detected = _scan_once(row_globals, col_globals)
        _restore_columns_high(col_globals)
        if detected:
            samples.append(detected)
        time.sleep(0.004)

    if not samples:
        return None

    counts = Counter(sample["key"] for sample in samples)
    key, seen = counts.most_common(1)[0]
    if seen < 2:
        return None

    for sample in reversed(samples):
        if sample["key"] == key:
            return sample

    return None


def read_key(timeout_ms: int, debounce_ms: int, row_globals: list[int], col_globals: list[int]) -> dict:
    deadline = time.monotonic() + (max(1, timeout_ms) / 1000.0)

    while time.monotonic() < deadline:
        detected = _scan_once(row_globals, col_globals)
        _restore_columns_high(col_globals)

        if detected:
            confirmed = _confirm_press(
                detected,
                debounce_ms,
                row_globals,
                col_globals,
            )
            if confirmed:
                return {
                    "pressed": True,
                    **confirmed,
                    "timeout_ms": timeout_ms,
                    "debounce_ms": debounce_ms,
                }

        time.sleep(0.005)

    return {
        "pressed": False,
        "key": "",
        "timeout_ms": timeout_ms,
        "debounce_ms": debounce_ms,
    }


def main() -> int:
    timeout_ms = int(sys.argv[1]) if len(sys.argv) > 1 else 120
    debounce_ms = int(sys.argv[2]) if len(sys.argv) > 2 else 50
    row_globals = []
    col_globals = []

    try:
        row_globals, col_globals = _configure_gpio()
        print(json.dumps(read_key(timeout_ms, debounce_ms, row_globals, col_globals)))
        return 0
    finally:
        _restore_columns_high(col_globals)
        for global_pin in row_globals + col_globals:
            _unexport_gpio(global_pin)


if __name__ == "__main__":
    sys.exit(main())