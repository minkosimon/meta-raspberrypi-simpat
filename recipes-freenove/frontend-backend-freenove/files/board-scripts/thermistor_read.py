#!/usr/bin/env python3
"""Thermistor read via ADS7830 channel 0.

Implements the Freenove Chapter 9 thermometer formula:
  voltage = adc / 255 * 5.0
  Rt = 10 * voltage / (5.0 - voltage)
  tempK = 1 / (1 / (273.15 + 25) + ln(Rt / 10) / 3950)

Output: JSON
"""

import fcntl
import json
import math
import os
import sys
from pathlib import Path

ADS7830_ADDRS = (0x48, 0x4B)
I2C_SLAVE = 0x0703
ADC_CHANNEL = 0
SUPPLY_VOLTAGE = 5.0
NOMINAL_RESISTANCE_KOHM = 10.0
NOMINAL_TEMPERATURE_C = 25.0
BETA = 3950.0


def _read_dt_u32(path: str) -> int | None:
    dt_path = Path(path)
    try:
        data = dt_path.read_bytes()
    except OSError:
        return None
    if len(data) < 4:
        return None
    return int.from_bytes(data[:4], byteorder="big", signed=False)


def _resolve_i2c_bus() -> int:
    dt_bus = _read_dt_u32("/proc/device-tree/freenove_board/freenove,i2c-bus")
    if dt_bus is not None:
        return dt_bus
    return int(os.environ.get("FNK_I2C_BUS", "1"))


def _resolve_thermistor_channel() -> int:
    dt_channel = _read_dt_u32("/proc/device-tree/freenove_board/freenove,thermistor-channel")
    if dt_channel is not None:
        return dt_channel
    return ADC_CHANNEL


I2C_BUS = _resolve_i2c_bus()


def _open_i2c_device(bus_number: int, address: int) -> int:
    dev = f"/dev/i2c-{bus_number}"
    fd = os.open(dev, os.O_RDWR)
    fcntl.ioctl(fd, I2C_SLAVE, address)
    return fd


def _read_ads7830(fd: int, channel: int) -> int:
    cmd = 0x84 | ((((channel << 2) | (channel >> 1)) & 0x07) << 4)
    os.write(fd, bytes((cmd & 0xFF,)))
    data = os.read(fd, 1)
    if len(data) != 1:
        raise RuntimeError(f"Short read from ADS7830: expected 1 byte, got {len(data)}")
    return data[0]


def _read_raw_channel(channel: int, bus_number: int) -> tuple[int, int]:
    last_error = None
    for address in ADS7830_ADDRS:
        fd = None
        try:
            fd = _open_i2c_device(bus_number, address)
            return _read_ads7830(fd, channel), address
        except (OSError, RuntimeError) as exc:
            last_error = exc
        finally:
            if fd is not None:
                os.close(fd)

    hint = f"ADS7830 not found at 0x48 or 0x4B on i2c-{bus_number}"
    if last_error is not None:
        raise RuntimeError(f"{last_error}; {hint}") from last_error
    raise RuntimeError(hint)


def _thermistor_temperature_c(raw: int) -> tuple[float, float]:
    voltage = raw * SUPPLY_VOLTAGE / 255.0
    if voltage <= 0.0:
        raise RuntimeError("Thermistor voltage is zero; check wiring on ADS7830 A0")
    if voltage >= SUPPLY_VOLTAGE:
        raise RuntimeError("Thermistor voltage reached supply rail; check divider wiring")

    resistance_kohm = NOMINAL_RESISTANCE_KOHM * voltage / (SUPPLY_VOLTAGE - voltage)
    temp_k = 1.0 / (
        1.0 / (273.15 + NOMINAL_TEMPERATURE_C)
        + math.log(resistance_kohm / NOMINAL_RESISTANCE_KOHM) / BETA
    )
    return temp_k - 273.15, resistance_kohm


def main() -> None:
    channel = int(sys.argv[1]) if len(sys.argv) > 1 else _resolve_thermistor_channel()
    bus_number = int(sys.argv[2]) if len(sys.argv) > 2 else I2C_BUS
    try:
        raw, address = _read_raw_channel(channel, bus_number)
        temperature_c, resistance_kohm = _thermistor_temperature_c(raw)
        voltage = raw * SUPPLY_VOLTAGE / 255.0
        print(
            json.dumps(
                {
                    "channel": channel,
                    "address": f"0x{address:02X}",
                    "bus": bus_number,
                    "raw": raw,
                    "voltage_v": round(voltage, 3),
                    "resistance_kohm": round(resistance_kohm, 3),
                    "temperature_c": round(temperature_c, 2),
                    "beta": BETA,
                    "nominal_resistance_kohm": NOMINAL_RESISTANCE_KOHM,
                    "nominal_temperature_c": NOMINAL_TEMPERATURE_C,
                    "formula": "freenove_ch9_thermistor",
                    "refresh_supported": True,
                }
            )
        )
    except Exception as exc:
        print(
            json.dumps(
                {
                    "error": str(exc),
                    "channel": channel,
                    "bus": bus_number,
                }
            )
        )


if __name__ == "__main__":
    main()