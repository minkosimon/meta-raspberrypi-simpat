#!/usr/bin/env python3
"""Servo motor control — set angle 0-180° (FNK0054 SG90 servo).
Usage: servo_control.py <pin> <angle>
Pin default: 18 (hardware PWM capable)
SG90 servo: 50 Hz, duty 2.5% (0°) to 12.5% (180°).
Output: JSON
"""
import json
import sys
import time

import RPi.GPIO as GPIO

GPIO.setwarnings(False)
GPIO.setmode(GPIO.BCM)

SERVO_FREQ = 50  # Hz


def angle_to_duty(angle: float) -> float:
    """Convert 0-180° angle to duty cycle % for SG90."""
    return 2.5 + (angle / 180.0) * 10.0


def set_angle(pin: int, angle: float):
    angle = max(0, min(180, angle))
    GPIO.setup(pin, GPIO.OUT)
    pwm = GPIO.PWM(pin, SERVO_FREQ)
    duty = angle_to_duty(angle)
    pwm.start(duty)
    time.sleep(0.5)
    pwm.stop()
    GPIO.cleanup(pin)
    print(json.dumps({"pin": pin, "angle": angle, "duty": round(duty, 2)}))


if __name__ == "__main__":
    pin = int(sys.argv[1]) if len(sys.argv) > 1 else 18
    angle = float(sys.argv[2]) if len(sys.argv) > 2 else 90
    set_angle(pin, angle)
