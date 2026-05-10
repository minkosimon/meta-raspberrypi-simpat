#!/usr/bin/env python3
"""RGB LED control via freenove kernel driver sysfs interface (RPi5 compatible).

The freenove driver claims the RGB GPIO pins and exposes them as
/sys/class/leds/freenove:ledX with max_brightness=1 (on/off only).
RPi.GPIO cannot be used on RPi5.

Because the sysfs brightness write is persistent, this script simply
writes the values and exits — no daemon, no PWM thread needed.

Color accuracy: since max_brightness=1 only 8 colours are supported
(binary R/G/B). Each channel: >= 128 → ON, < 128 → OFF.

GPIO pin → LED index (from freenove-overlay.dts):
  4→led0  5→led1  6→led2  12→led3  13→led4
  17→led5 18→led6 22→led7 23→led8  24→led9  25→led10 26→led11 27→led12

RGB LED (FNK0054 common-anode):
  R = GPIO5 → freenove:led1
  G = GPIO6 → freenove:led2
  B = GPIO13 → freenove:led4

Usage: led_rgb.py <r_pin> <g_pin> <b_pin> <r 0-255> <g 0-255> <b 0-255>
Output: JSON
"""
import json
import sys

_GPIO_TO_LED_IDX = {
    4: 0, 5: 1, 6: 2, 12: 3, 13: 4,
    17: 5, 18: 6, 22: 7, 23: 8, 24: 9,
    25: 10, 26: 11, 27: 12,
}

_SYSFS_BRIGHTNESS = "/sys/class/leds/freenove:led{}/brightness"


def _write(gpio_pin: int, value: int) -> None:
    idx = _GPIO_TO_LED_IDX.get(gpio_pin)
    if idx is None:
        raise ValueError(f"GPIO {gpio_pin} not managed by freenove driver")
    with open(_SYSFS_BRIGHTNESS.format(idx), "w") as f:
        f.write(str(value))


def main() -> None:
    r_pin = int(sys.argv[1]) if len(sys.argv) > 1 else 5
    g_pin = int(sys.argv[2]) if len(sys.argv) > 2 else 6
    b_pin = int(sys.argv[3]) if len(sys.argv) > 3 else 13
    r     = int(sys.argv[4]) if len(sys.argv) > 4 else 0
    g     = int(sys.argv[5]) if len(sys.argv) > 5 else 0
    b     = int(sys.argv[6]) if len(sys.argv) > 6 else 0

    # Common-anode: brightness=0 → LED ON, brightness=1 → LED OFF
    _write(r_pin, 0 if r >= 128 else 1)
    _write(g_pin, 0 if g >= 128 else 1)
    _write(b_pin, 0 if b >= 128 else 1)

    print(json.dumps({"r": r, "g": g, "b": b, "pins": [r_pin, g_pin, b_pin]}))


if __name__ == "__main__":
    main()
