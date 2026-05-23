#!/usr/bin/env python3
"""ADC read — ADS7830 (I2C) 8-channel 8-bit ADC (FNK0054).
Usage: adc_read.py [channel 0-7]
Default: channel 0
The ADS7830 is commonly exposed at 0x48 on this image, with 0x4B kept as a
fallback for alternate board wiring.
Output: JSON
"""
import fcntl
import json
import os
import sys

ADS7830_ADDRS = (0x48, 0x4B)
I2C_BUS = 1
I2C_SLAVE = 0x0703


def _open_i2c_device(bus_number: int, address: int) -> int:
    dev = f"/dev/i2c-{bus_number}"
    fd = os.open(dev, os.O_RDWR)
    fcntl.ioctl(fd, I2C_SLAVE, address)
    return fd


def _read_from_addr(fd: int, channel: int) -> int:
    # Match the Freenove ADS7830 channel selection used in the tutorial code.
    cmd = 0x84 | ((((channel << 2) | (channel >> 1)) & 0x07) << 4)
    os.write(fd, bytes((cmd & 0xFF,)))
    data = os.read(fd, 1)
    if len(data) != 1:
        raise RuntimeError(f"Short read from ADS7830: expected 1 byte, got {len(data)}")
    return data[0]


def read_channel(channel: int = 0):
    last_error = None
    for address in ADS7830_ADDRS:
        fd = None
        try:
            fd = _open_i2c_device(I2C_BUS, address)
            raw = _read_from_addr(fd, channel)
            voltage = round(raw * 3.3 / 255, 3)
            print(json.dumps({
                "channel": channel,
                "address": f"0x{address:02X}",
                "bus": I2C_BUS,
                "raw": raw,
                "voltage": voltage,
                "percent": round(raw * 100 / 255, 1),
                "resolution": 256,
            }))
            return
        except (OSError, RuntimeError) as exc:
            last_error = exc
        finally:
            if fd is not None:
                os.close(fd)

    hint = f"ADS7830 not found at 0x48 or 0x4B on i2c-{I2C_BUS}"
    if last_error is not None:
        print(json.dumps({"error": str(last_error), "hint": hint, "bus": I2C_BUS}))
    else:
        print(json.dumps({"error": "ADS7830 read failed", "hint": hint, "bus": I2C_BUS}))


if __name__ == "__main__":
    ch = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    read_channel(ch)
