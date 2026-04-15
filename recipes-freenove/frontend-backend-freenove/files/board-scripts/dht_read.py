#!/usr/bin/env python3
"""DHT11 temperature + humidity sensor (FNK0054).
Usage: dht_read.py [gpio_pin]
Default pin: 17
Output: JSON  {"temperature": °C, "humidity": %}
Requires: adafruit-circuitpython-dht  or  dht11 library
"""
import json
import sys
import time

# Try Adafruit CircuitPython DHT first, fallback to bit-bang
try:
    import adafruit_dht
    import board

    _PIN_MAP = {
        4: board.D4, 17: board.D17, 18: board.D18, 22: board.D22,
        23: board.D23, 24: board.D24, 25: board.D25, 27: board.D27,
    }

    def read_dht(pin: int):
        bp = _PIN_MAP.get(pin)
        if bp is None:
            print(json.dumps({"error": f"Pin {pin} not mapped for adafruit_dht"}))
            return
        sensor = adafruit_dht.DHT11(bp)
        for _ in range(5):
            try:
                t = sensor.temperature
                h = sensor.humidity
                if t is not None and h is not None:
                    print(json.dumps({"temperature": t, "humidity": h, "pin": pin}))
                    sensor.exit()
                    return
            except RuntimeError:
                time.sleep(1)
        print(json.dumps({"error": "timeout reading DHT11"}))
        sensor.exit()

except ImportError:
    def read_dht(pin: int):
        """Fallback: use command-line tool or raw GPIO read."""
        print(json.dumps({"error": "adafruit_dht not installed", "pin": pin}))


if __name__ == "__main__":
    pin = int(sys.argv[1]) if len(sys.argv) > 1 else 17
    read_dht(pin)
