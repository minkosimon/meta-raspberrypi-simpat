#!/usr/bin/env python3
"""ADC read — ADS7830 (I2C) 8-channel 8-bit ADC (FNK0054).
Usage: adc_read.py [channel 0-7]
Default: channel 0
The ADS7830 default I2C address is 0x4b.
Output: JSON
"""
import json
import sys

try:
    import smbus2 as smbus
except ImportError:
    import smbus

ADS7830_ADDR = 0x4B
I2C_BUS = 1


def read_channel(channel: int = 0):
    bus = smbus.SMBus(I2C_BUS)
    # ADS7830 command byte: single-ended, channel selection
    cmd = 0x84 | ((channel & 0x07) << 4)
    try:
        bus.write_byte(ADS7830_ADDR, cmd)
        raw = bus.read_byte(ADS7830_ADDR)
        voltage = round(raw * 3.3 / 255, 3)
        print(json.dumps({
            "channel": channel,
            "raw": raw,
            "voltage": voltage,
            "percent": round(raw * 100 / 255, 1),
        }))
    except OSError as e:
        print(json.dumps({"error": str(e), "hint": "ADS7830 not found at 0x4B"}))
    finally:
        bus.close()


if __name__ == "__main__":
    ch = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    read_channel(ch)
