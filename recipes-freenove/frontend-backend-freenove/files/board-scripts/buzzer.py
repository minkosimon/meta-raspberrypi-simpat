#!/usr/bin/env python3
"""Buzzer control — active/passive buzzer (FNK0054).
Usage: buzzer.py <pin> <on|off|tone> [frequency] [duration_s]
Output: JSON
"""
import json
import sys
import time

import RPi.GPIO as GPIO

GPIO.setwarnings(False)
GPIO.setmode(GPIO.BCM)


def buzzer_on(pin: int):
    GPIO.setup(pin, GPIO.OUT)
    GPIO.output(pin, GPIO.HIGH)
    print(json.dumps({"pin": pin, "state": "on"}))


def buzzer_off(pin: int):
    GPIO.setup(pin, GPIO.OUT)
    GPIO.output(pin, GPIO.LOW)
    GPIO.cleanup(pin)
    print(json.dumps({"pin": pin, "state": "off"}))


def buzzer_tone(pin: int, freq: int, duration: float):
    GPIO.setup(pin, GPIO.OUT)
    pwm = GPIO.PWM(pin, freq)
    pwm.start(50)
    time.sleep(duration)
    pwm.stop()
    GPIO.cleanup(pin)
    print(json.dumps({"pin": pin, "frequency": freq, "duration": duration, "state": "done"}))


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
