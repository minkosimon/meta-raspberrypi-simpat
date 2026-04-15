#!/usr/bin/env python3
"""HC-SR04 ultrasonic distance sensor (FNK0054).
Usage: ultrasonic.py [trig_pin] [echo_pin]
Defaults: trig=23, echo=24
Output: JSON  {"distance_cm": float}
"""
import json
import sys
import time

import RPi.GPIO as GPIO

GPIO.setwarnings(False)
GPIO.setmode(GPIO.BCM)

SPEED_OF_SOUND_CM_S = 34300  # cm/s at ~20 °C


def measure_distance(trig: int, echo: int) -> float:
    GPIO.setup(trig, GPIO.OUT)
    GPIO.setup(echo, GPIO.IN)

    # Ensure trigger is low
    GPIO.output(trig, False)
    time.sleep(0.05)

    # Send 10µs pulse
    GPIO.output(trig, True)
    time.sleep(0.00001)
    GPIO.output(trig, False)

    # Wait for echo start
    start = time.time()
    timeout = start + 0.1
    while GPIO.input(echo) == 0:
        start = time.time()
        if start > timeout:
            return -1

    # Wait for echo end
    end = time.time()
    timeout = end + 0.1
    while GPIO.input(echo) == 1:
        end = time.time()
        if end > timeout:
            return -1

    elapsed = end - start
    distance = (elapsed * SPEED_OF_SOUND_CM_S) / 2
    return round(distance, 2)


if __name__ == "__main__":
    trig = int(sys.argv[1]) if len(sys.argv) > 1 else 23
    echo = int(sys.argv[2]) if len(sys.argv) > 2 else 24
    dist = measure_distance(trig, echo)
    GPIO.cleanup([trig, echo])
    if dist < 0:
        print(json.dumps({"error": "timeout", "trig_pin": trig, "echo_pin": echo}))
    else:
        print(json.dumps({"distance_cm": dist, "trig_pin": trig, "echo_pin": echo}))
