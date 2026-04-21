#!/usr/bin/env python3
"""GPIO control — setup / read / write GPIO pins (FNK0054).
Usage:
    gpio_control.py setup <pin> <in|out>
    gpio_control.py write <pin> <0|1>
    gpio_control.py read  <pin>
Output: JSON
"""
import json
import sys

import RPi.GPIO as GPIO

GPIO.setwarnings(False)
GPIO.setmode(GPIO.BCM)


def setup(pin: int, direction: str):
    d = GPIO.OUT if direction == "out" else GPIO.IN
    pud = GPIO.PUD_UP if direction == "in" else GPIO.PUD_OFF
    GPIO.setup(pin, d, pull_up_down=pud)
    print(json.dumps({"pin": pin, "direction": direction}))


def write(pin: int, value: int):
    GPIO.setup(pin, GPIO.OUT)
    GPIO.output(pin, value)
    print(json.dumps({"pin": pin, "value": value}))


def read(pin: int):
    GPIO.setup(pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)
    val = GPIO.input(pin)
    print(json.dumps({"pin": pin, "value": val}))


def read_many(pins):
    values = {}
    for pin in pins:
        GPIO.setup(pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)
        values[str(pin)] = GPIO.input(pin)
    print(json.dumps({"pins": values}))


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "usage: gpio_control.py <cmd> <pin> [value]"}))
        sys.exit(1)
    cmd = sys.argv[1]
    pin = int(sys.argv[2])
    if cmd == "setup":
        setup(pin, sys.argv[3] if len(sys.argv) > 3 else "out")
    elif cmd == "write":
        write(pin, int(sys.argv[3]) if len(sys.argv) > 3 else 0)
    elif cmd == "read":
        read(pin)
    elif cmd == "read-many":
        read_many([pin] + [int(arg) for arg in sys.argv[3:]])
    else:
        print(json.dumps({"error": f"unknown command: {cmd}"}))
