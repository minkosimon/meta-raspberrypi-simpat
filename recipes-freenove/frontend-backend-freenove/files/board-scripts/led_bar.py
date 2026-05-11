#!/usr/bin/env python3
"""LED bar graph via two cascaded 74HC595 shift registers.

Usage: led_bar.py <level>
  level: integer 0..10

Hardware (FNK0054 / BCM), aligned with Freenove's Pi4J example:
  - DS   (data)  = GPIO22 → freenove:led7
  - STCP (latch) = GPIO27 → freenove:led12
  - SHCP (clock) = GPIO17 → freenove:led5
  LED outputs are active HIGH. The second 74HC595 (U2) must be shifted first,
  then the first 74HC595 (U1), because the chips are cascaded.
"""
import json
import os
import sys

_GPIO_TO_LED = {4: 0, 5: 1, 6: 2, 12: 3, 13: 4, 17: 5, 18: 6, 22: 7, 23: 8, 24: 9, 25: 10, 26: 11, 27: 12}
_SYSFS = "/sys/class/leds/freenove:led{}/brightness"

DATA_GPIO = 22
LATCH_GPIO = 27
CLOCK_GPIO = 17

_fds = {}


def _open_pins():
    for gpio, name in ((DATA_GPIO, "data"), (LATCH_GPIO, "latch"), (CLOCK_GPIO, "clk")):
        _fds[name] = os.open(_SYSFS.format(_GPIO_TO_LED[gpio]), os.O_WRONLY)


def _close_pins():
    for fd in _fds.values():
        try:
            os.close(fd)
        except Exception:
            pass
    _fds.clear()


def _w(name, val):
    fd = _fds[name]
    os.lseek(fd, 0, os.SEEK_SET)
    os.write(fd, b"1" if val else b"0")


def _shift_out(byte_val):
    for bit in range(7, -1, -1):
        _w("data", (byte_val >> bit) & 1)
        _w("clk", 1)
        _w("clk", 0)


def _latch(high_byte, low_byte):
    _w("latch", 0)
    _shift_out(high_byte)
    _shift_out(low_byte)
    _w("latch", 1)


def _level_to_bytes(level):
    mask = (1 << level) - 1 if level > 0 else 0
    low_byte = mask & 0xFF
    high_byte = (mask >> 8) & 0xFF
    return high_byte, low_byte


def main():
    if len(sys.argv) < 2:
        level = 0
    else:
        try:
            level = int(sys.argv[1], 0)
        except ValueError:
            print(json.dumps({"error": "invalid level - expected integer 0..10"}))
            sys.exit(1)

    if level < 0 or level > 10:
        print(json.dumps({"error": f"level out of range: {level} (expected 0..10)"}))
        sys.exit(1)

    high_byte, low_byte = _level_to_bytes(level)
    _open_pins()
    try:
        _w("data", 0)
        _w("latch", 0)
        _w("clk", 0)
        _latch(high_byte, low_byte)
        print(json.dumps({
            "status": "ok",
            "level": level,
            "high_byte": f"0x{high_byte:02x}",
            "low_byte": f"0x{low_byte:02x}",
        }))
    finally:
        _close_pins()


if __name__ == "__main__":
    main()