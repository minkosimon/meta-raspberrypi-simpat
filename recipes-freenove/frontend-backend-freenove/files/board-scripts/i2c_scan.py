#!/usr/bin/env python3
"""I2C bus scanner (FNK0054).
Usage: i2c_scan.py [bus_number]
Default bus: 1
Output: JSON list of detected addresses.
"""
import json
import sys

try:
    import smbus2 as smbus
except ImportError:
    import smbus


def scan(bus_number: int = 1):
    bus = smbus.SMBus(bus_number)
    devices = []
    for addr in range(0x03, 0x78):
        try:
            bus.read_byte(addr)
            devices.append({"address": addr, "hex": f"0x{addr:02x}"})
        except OSError:
            pass
    bus.close()
    print(json.dumps({"bus": bus_number, "devices": devices, "count": len(devices)}))


if __name__ == "__main__":
    bus = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    scan(bus)
