#!/usr/bin/env python3
"""LED Matrix 8x8 via two 74HC595 shift registers — sysfs only, no RPi.GPIO.

Usage: led_matrix.py <row0,row1,...,row7>
    Each row is a byte (0-255) representing 8 columns (MSB = col 1).
    Runs as a daemon (infinite multiplex loop) until killed (SIGTERM/SIGINT).

Hardware (FNK0054 / BCM), aligned with Freenove's Pi4J example:
    - DS   (data)  = GPIO22 → freenove:led7
    - STCP (latch) = GPIO27 → freenove:led12
    - SHCP (clock) = GPIO17 → freenove:led5
    Row data is shifted first, then the selected column is enabled active LOW.
"""
import json
import os
import signal
import sys
import time

# freenove kernel driver: GPIO → LED index
_GPIO_TO_LED = {4:0, 5:1, 6:2, 12:3, 13:4, 17:5, 18:6, 22:7, 23:8, 24:9, 25:10, 26:11, 27:12}
_SYSFS = "/sys/class/leds/freenove:led{}/brightness"

DATA_GPIO  = 22   # DS   → led7
LATCH_GPIO = 27   # STCP → led12
CLOCK_GPIO = 17   # SHCP → led5

SCAN_DELAY = 0.002  # 2 ms per row

# File descriptors kept open for speed
_fds = {}


def _open_pins():
    for gpio, name in [(DATA_GPIO, "data"), (LATCH_GPIO, "latch"), (CLOCK_GPIO, "clk")]:
        path = _SYSFS.format(_GPIO_TO_LED[gpio])
        _fds[name] = os.open(path, os.O_WRONLY)


def _w(name, val):
    """Write a single GPIO bit via sysfs (seek to 0 each time)."""
    fd = _fds[name]
    os.lseek(fd, 0, os.SEEK_SET)
    os.write(fd, b"1" if val else b"0")


def _shift_out(byte_val):
    """Shift 8 bits MSB-first into the 74HC595."""
    for i in range(7, -1, -1):
        _w("data", (byte_val >> i) & 1)
        _w("clk", 1)
        _w("clk", 0)


def _rows_to_cols(pattern_rows):
    """Convert 8 input rows (MSB = col 1) to 8 scan columns (MSB = row 1)."""
    columns = []
    for col in range(8):
        col_mask = 1 << (7 - col)
        row_bits = 0
        for row in range(8):
            if pattern_rows[row] & col_mask:
                row_bits |= 1 << (7 - row)
        columns.append(row_bits)
    return columns


def _display_column(col_index, row_data):
    col_byte = ~(1 << (7 - col_index)) & 0xFF  # active LOW column select
    _w("latch", 0)
    _shift_out(row_data)   # row data FIRST → pushed through U1 into far chip U2 (rows)
    _shift_out(col_byte)   # column select SECOND → stays in near chip U1 (cols)
    _w("latch", 1)


def _clear():
    _w("latch", 0)
    _shift_out(0x00)  # rows all LOW (off)
    _shift_out(0xFF)  # columns all HIGH (inactive)
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
        pattern = [0] * 8
    else:
        try:
            pattern = [max(0, min(255, int(v, 0) if v.startswith("0x") or v.startswith("0X") else int(v))) for v in sys.argv[1].split(",")]
        except ValueError:
            print(json.dumps({"error": "invalid pattern — expected 8 comma-separated ints"}))
            sys.exit(1)

    if len(pattern) != 8:
        print(json.dumps({"error": f"expected 8 rows, got {len(pattern)}"}))
        sys.exit(1)

    scan_columns = _rows_to_cols(pattern)

    _open_pins()
    signal.signal(signal.SIGTERM, _cleanup)
    signal.signal(signal.SIGINT, _cleanup)

    # Init all pins LOW
    _w("data", 0)
    _w("latch", 0)
    _w("clk", 0)

    # Daemon multiplex loop — runs until killed
    while True:
        for col in range(8):
            _display_column(col, scan_columns[col])
            time.sleep(SCAN_DELAY)


if __name__ == "__main__":
    main()
