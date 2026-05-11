#!/usr/bin/env python3
"""4-digit 7-segment display via two 74HC595 shift registers.

Usage: seven_segment.py <value>
  Displays up to 4 decimal digits using a continuous multiplex loop.

Hardware (FNK0054 / BCM), aligned with Freenove's Pi4J example:
  - DS   (data)  = GPIO22 → freenove:led7
  - STCP (latch) = GPIO27 → freenove:led12
  - SHCP (clock) = GPIO17 → freenove:led5
  Segment outputs are active LOW, digit select is active HIGH.
"""
import json
import os
import signal
import sys
import time

_GPIO_TO_LED = {4: 0, 5: 1, 6: 2, 12: 3, 13: 4, 17: 5, 18: 6, 22: 7, 23: 8, 24: 9, 25: 10, 26: 11, 27: 12}
_SYSFS = "/sys/class/leds/freenove:led{}/brightness"

DATA_GPIO = 22
LATCH_GPIO = 27
CLOCK_GPIO = 17

SCAN_DELAY = 0.001
SEGMENTS = {
    "0": 0xC0,
    "1": 0xF9,
    "2": 0xA4,
    "3": 0xB0,
    "4": 0x99,
    "5": 0x92,
    "6": 0x82,
    "7": 0xF8,
    "8": 0x80,
    "9": 0x90,
    " ": 0xFF,
}
DIGIT_SELECT = (0x01, 0x02, 0x04, 0x08)

_fds = {}


def _open_pins():
    for gpio, name in ((DATA_GPIO, "data"), (LATCH_GPIO, "latch"), (CLOCK_GPIO, "clk")):
        _fds[name] = os.open(_SYSFS.format(_GPIO_TO_LED[gpio]), os.O_WRONLY)


def _w(name, val):
    fd = _fds[name]
    os.lseek(fd, 0, os.SEEK_SET)
    os.write(fd, b"1" if val else b"0")


def _shift_out(byte_val):
    for bit in range(7, -1, -1):
        _w("data", (byte_val >> bit) & 1)
        _w("clk", 1)
        _w("clk", 0)


def _display_digit(index, char):
    _w("latch", 0)
    _shift_out(DIGIT_SELECT[index])
    _shift_out(SEGMENTS.get(char, SEGMENTS[" "]))
    _w("latch", 1)


def _clear():
    _w("latch", 0)
    _shift_out(0x00)
    _shift_out(0xFF)
    _w("latch", 1)


def _cleanup(sig=None, frame=None):
    try:
        _clear()
        _w("data", 0)
        _w("latch", 0)
        _w("clk", 0)
        for fd in _fds.values():
            os.close(fd)
    except Exception:
        pass
    sys.exit(0)


def main():
    if len(sys.argv) < 2:
        digits = "0000"
    else:
        digits = "".join(ch for ch in sys.argv[1] if ch.isdigit())[-4:]
        if not digits:
            print(json.dumps({"error": "invalid value - expected up to 4 decimal digits"}))
            sys.exit(1)
        digits = digits.rjust(4, "0")

    _open_pins()
    signal.signal(signal.SIGTERM, _cleanup)
    signal.signal(signal.SIGINT, _cleanup)

    _w("data", 0)
    _w("latch", 0)
    _w("clk", 0)

    while True:
        for index, char in enumerate(digits):
            _display_digit(index, char)
            time.sleep(SCAN_DELAY)


if __name__ == "__main__":
    main()