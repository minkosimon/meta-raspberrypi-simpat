#!/usr/bin/env python3
"""RGB LED control — set colour via software PWM (FNK0054).
Usage: led_rgb.py <r_pin> <g_pin> <b_pin> <r_val 0-255> <g_val> <b_val>
Output: JSON
"""
import json
import sys
import time

import RPi.GPIO as GPIO

GPIO.setwarnings(False)
GPIO.setmode(GPIO.BCM)

PWM_FREQ = 1000  # Hz


def set_color(r_pin, g_pin, b_pin, r, g, b):
    for pin in (r_pin, g_pin, b_pin):
        GPIO.setup(pin, GPIO.OUT)

    pr = GPIO.PWM(r_pin, PWM_FREQ)
    pg = GPIO.PWM(g_pin, PWM_FREQ)
    pb = GPIO.PWM(b_pin, PWM_FREQ)

    # Common anode LED: duty = 100 - pct ; common cathode: duty = pct
    # FNK0054 uses common anode -> invert
    pr.start(100 - r * 100 / 255)
    pg.start(100 - g * 100 / 255)
    pb.start(100 - b * 100 / 255)

    print(json.dumps({"r": r, "g": g, "b": b, "pins": [r_pin, g_pin, b_pin]}))
    time.sleep(3)

    pr.stop()
    pg.stop()
    pb.stop()
    GPIO.cleanup([r_pin, g_pin, b_pin])


if __name__ == "__main__":
    r_pin = int(sys.argv[1]) if len(sys.argv) > 1 else 17
    g_pin = int(sys.argv[2]) if len(sys.argv) > 2 else 27
    b_pin = int(sys.argv[3]) if len(sys.argv) > 3 else 22
    r = int(sys.argv[4]) if len(sys.argv) > 4 else 0
    g = int(sys.argv[5]) if len(sys.argv) > 5 else 0
    b = int(sys.argv[6]) if len(sys.argv) > 6 else 0
    set_color(r_pin, g_pin, b_pin, r, g, b)
