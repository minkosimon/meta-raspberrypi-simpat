#!/usr/bin/env python3
"""I2C bus scanner (FNK0054) — stdlib only, no smbus2 required.
Uses /dev/i2c-N directly via fcntl.ioctl.
Usage: i2c_scan.py [bus_number]
Default bus: 12  (RPi5 RP1 i2c1, GPIO2=SDA GPIO3=SCL)
Output: JSON list of detected addresses.
"""
import fcntl
import json
import struct
import sys

_I2C_SLAVE = 0x0703


def _probe(fd: int, addr: int) -> bool:
    """Try to set slave address and read 1 byte. Returns True if ACK."""
    try:
        fcntl.ioctl(fd, _I2C_SLAVE, addr)
        # 1-byte read — raises OSError(ENXIO/EREMOTEIO) if no device
        import os
        os.read(fd, 1)
        return True
    except OSError:
        return False


def scan(bus_number: int = 12):
    import os
    dev = f"/dev/i2c-{bus_number}"
    try:
        fd = os.open(dev, os.O_RDWR)
    except OSError as e:
        print(json.dumps({"error": f"Cannot open {dev}: {e}",
                          "bus": bus_number, "devices": [], "count": 0}))
        return
    devices = []
    for addr in range(0x03, 0x78):
        if _probe(fd, addr):
            devices.append({"address": addr, "hex": f"0x{addr:02x}"})
    os.close(fd)
    print(json.dumps({"bus": bus_number, "devices": devices, "count": len(devices)}))


if __name__ == "__main__":
    bus = int(sys.argv[1]) if len(sys.argv) > 1 else 12
    scan(bus)
