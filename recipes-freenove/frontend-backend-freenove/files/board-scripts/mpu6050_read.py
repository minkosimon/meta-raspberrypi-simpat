#!/usr/bin/env python3
"""Read MPU6050 accelerometer and gyroscope data over I2C.

Usage:
    mpu6050_read.py [bus] [addr]

Defaults:
    bus  = 1
    addr = 0x68

Output: JSON
"""

import json
import math
import sys
import time

try:
    import smbus2 as smbus
except ImportError:
    import smbus

PWR_MGMT_1 = 0x6B
SMPLRT_DIV = 0x19
CONFIG = 0x1A
GYRO_CONFIG = 0x1B
ACCEL_CONFIG = 0x1C
ACCEL_XOUT_H = 0x3B
TEMP_OUT_H = 0x41
GYRO_XOUT_H = 0x43

ACCEL_SCALE = 16384.0
GYRO_SCALE = 65.5


def _signed_word(high: int, low: int) -> int:
    value = (high << 8) | low
    if value >= 0x8000:
        value -= 0x10000
    return value


def _round_map(values: dict[str, float], digits: int = 3) -> dict[str, float]:
    return {axis: round(value, digits) for axis, value in values.items()}


def read_sensor(bus_number: int = 1, address: int = 0x68) -> None:
    bus = smbus.SMBus(bus_number)

    try:
        bus.write_byte_data(address, PWR_MGMT_1, 0x00)
        bus.write_byte_data(address, SMPLRT_DIV, 0x00)
        bus.write_byte_data(address, CONFIG, 0x00)
        bus.write_byte_data(address, GYRO_CONFIG, 0x08)
        bus.write_byte_data(address, ACCEL_CONFIG, 0x00)
        time.sleep(0.05)

        accel_raw = bus.read_i2c_block_data(address, ACCEL_XOUT_H, 6)
        temp_raw = bus.read_i2c_block_data(address, TEMP_OUT_H, 2)
        gyro_raw = bus.read_i2c_block_data(address, GYRO_XOUT_H, 6)

        accel = {
            "x": _signed_word(accel_raw[0], accel_raw[1]) / ACCEL_SCALE,
            "y": _signed_word(accel_raw[2], accel_raw[3]) / ACCEL_SCALE,
            "z": _signed_word(accel_raw[4], accel_raw[5]) / ACCEL_SCALE,
        }
        gyro = {
            "x": _signed_word(gyro_raw[0], gyro_raw[1]) / GYRO_SCALE,
            "y": _signed_word(gyro_raw[2], gyro_raw[3]) / GYRO_SCALE,
            "z": _signed_word(gyro_raw[4], gyro_raw[5]) / GYRO_SCALE,
        }

        temperature = _signed_word(temp_raw[0], temp_raw[1]) / 340.0 + 36.53
        pitch = math.degrees(
            math.atan2(-accel["x"], math.sqrt(accel["y"] ** 2 + accel["z"] ** 2))
        )
        roll = math.degrees(math.atan2(accel["y"], accel["z"]))

        print(
            json.dumps(
                {
                    "bus": bus_number,
                    "address": f"0x{address:02x}",
                    "accel": _round_map(accel),
                    "gyro": _round_map(gyro),
                    "temp": round(temperature, 2),
                    "orientation": {
                        "pitch": round(pitch, 2),
                        "roll": round(roll, 2),
                    },
                }
            )
        )
    except OSError as exc:
        print(
            json.dumps(
                {
                    "error": str(exc),
                    "hint": f"MPU6050 not found at 0x{address:02x} on i2c-{bus_number}",
                    "bus": bus_number,
                    "address": f"0x{address:02x}",
                }
            )
        )
    finally:
        bus.close()


if __name__ == "__main__":
    bus_number = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    address = int(sys.argv[2], 0) if len(sys.argv) > 2 else 0x68
    read_sensor(bus_number, address)