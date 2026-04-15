#!/usr/bin/env python3
"""LED Matrix 8x8 control via two 74HC595 shift registers (FNK0054).

Usage: led_matrix.py <row0,row1,...,row7>
  Each row is a byte (0-255) representing 8 columns.

Hardware:
  - 74HC595 #1: column data (which LEDs in the row are ON)
  - 74HC595 #2: row select (active LOW — one row scanned at a time)
  - DS   (data)  = GPIO 17
  - STCP (latch) = GPIO 27
  - SHCP (clock) = GPIO 22

Output: JSON
"""
import json
import sys
import time

import RPi.GPIO as GPIO

# 74HC595 pin assignments (BCM)
DATA_PIN  = 17   # DS  — Serial data input
LATCH_PIN = 27   # STCP — Storage register clock (latch)
CLOCK_PIN = 22   # SHCP — Shift register clock

DISPLAY_DURATION = 3.0   # seconds to keep the pattern displayed
SCAN_DELAY = 0.002       # seconds between row scans (~2 ms)

GPIO.setwarnings(False)
GPIO.setmode(GPIO.BCM)


def setup():
    GPIO.setup(DATA_PIN, GPIO.OUT)
    GPIO.setup(LATCH_PIN, GPIO.OUT)
    GPIO.setup(CLOCK_PIN, GPIO.OUT)
    GPIO.output(DATA_PIN, GPIO.LOW)
    GPIO.output(LATCH_PIN, GPIO.LOW)
    GPIO.output(CLOCK_PIN, GPIO.LOW)


def shift_out(byte_val):
    """Shift 8 bits out (MSB first) through the 74HC595."""
    for i in range(7, -1, -1):
        GPIO.output(DATA_PIN, (byte_val >> i) & 1)
        GPIO.output(CLOCK_PIN, GPIO.HIGH)
        GPIO.output(CLOCK_PIN, GPIO.LOW)


def display_row(row_index, col_data):
    """Display one row: select the row (active LOW) and set column data."""
    # Row select: active LOW — only the target row is LOW
    row_byte = ~(1 << row_index) & 0xFF

    # Latch LOW while shifting data
    GPIO.output(LATCH_PIN, GPIO.LOW)
    # Shift column data first (goes to second 74HC595)
    shift_out(col_data)
    # Shift row select (goes to first 74HC595)
    shift_out(row_byte)
    # Latch HIGH to push data to output pins
    GPIO.output(LATCH_PIN, GPIO.HIGH)


def clear_display():
    """Turn off all LEDs."""
    GPIO.output(LATCH_PIN, GPIO.LOW)
    shift_out(0x00)  # columns all off
    shift_out(0xFF)  # rows all HIGH (inactive)
    GPIO.output(LATCH_PIN, GPIO.HIGH)


def display_pattern(pattern, duration=DISPLAY_DURATION):
    """Multiplex the 8x8 pattern for the given duration."""
    end_time = time.time() + duration
    while time.time() < end_time:
        for row in range(8):
            display_row(row, pattern[row])
            time.sleep(SCAN_DELAY)
        # Brief blanking to avoid ghosting
        clear_display()


def main():
    if len(sys.argv) < 2:
        pattern = [0] * 8
    else:
        try:
            pattern = [max(0, min(255, int(v))) for v in sys.argv[1].split(",")]
        except ValueError:
            print(json.dumps({"error": "invalid pattern — expected 8 comma-separated ints"}))
            return

    if len(pattern) != 8:
        print(json.dumps({"error": f"expected 8 rows, got {len(pattern)}"}))
        return

    setup()
    try:
        display_pattern(pattern)
        clear_display()
        print(json.dumps({"status": "ok", "pattern": pattern}))
    finally:
        GPIO.cleanup([DATA_PIN, LATCH_PIN, CLOCK_PIN])


if __name__ == "__main__":
    main()
