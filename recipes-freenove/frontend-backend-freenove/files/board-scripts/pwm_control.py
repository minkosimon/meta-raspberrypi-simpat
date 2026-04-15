#!/usr/bin/env python3
"""PWM control — start / set / stop hardware PWM (FNK0054).
Usage:
    pwm_control.py start <pin> <freq_hz> <duty_%>
    pwm_control.py set   <pin> <duty_%>
    pwm_control.py stop  <pin>
Output: JSON
"""
import json
import sys

import RPi.GPIO as GPIO

GPIO.setwarnings(False)
GPIO.setmode(GPIO.BCM)

# Keep active PWM handles in a module-level dict is not possible across
# invocations, so we use a start-and-hold approach with timeout.

def start(pin: int, freq: int, duty: float):
    GPIO.setup(pin, GPIO.OUT)
    pwm = GPIO.PWM(pin, freq)
    pwm.start(duty)
    print(json.dumps({"pin": pin, "frequency": freq, "duty": duty, "state": "running"}))
    # Keep running for a while so PWM is observable
    import time
    time.sleep(5)
    pwm.stop()
    GPIO.cleanup(pin)


def stop(pin: int):
    GPIO.setup(pin, GPIO.OUT)
    GPIO.output(pin, 0)
    GPIO.cleanup(pin)
    print(json.dumps({"pin": pin, "state": "stopped"}))


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "usage: pwm_control.py <start|set|stop> <pin> ..."}))
        sys.exit(1)

    cmd = sys.argv[1]
    pin = int(sys.argv[2])

    if cmd == "start":
        freq = int(sys.argv[3]) if len(sys.argv) > 3 else 1000
        duty = float(sys.argv[4]) if len(sys.argv) > 4 else 50
        start(pin, freq, duty)
    elif cmd == "stop":
        stop(pin)
    else:
        print(json.dumps({"error": f"unknown command: {cmd}"}))
