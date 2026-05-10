#!/usr/bin/env python3
"""I2C LCD 1602 driver via PCF8574 backpack (HD44780, 4-bit mode).

Writes two text lines to a 16x2 LCD connected via I2C PCF8574 expander.
Stdlib only — no smbus2/smbus required. Uses /dev/i2c-N via fcntl.ioctl.

PCF8574 backpack wiring (standard):
  P0 = RS   (register select: 0=cmd, 1=data)
  P1 = RW   (always 0 = write)
  P2 = EN   (enable pulse)
  P3 = BL   (backlight, active-high)
  P4 = DB4
  P5 = DB5
  P6 = DB6
  P7 = DB7

LCD I2C addresses:
  PCF8574  : 0x27 (default)
  PCF8574A : 0x3F (alternative)

Usage: lcd_write.py <line1> <line2> [bus] [addr_hex]
Output: JSON
"""
import fcntl
import json
import os
import sys
import time

_I2C_SLAVE = 0x0703

# PCF8574 bit positions
_RS = 0x01
_RW = 0x02
_EN = 0x04
_BL = 0x08  # backlight

# HD44780 commands
_CMD_CLEAR      = 0x01
_CMD_HOME       = 0x02
_CMD_ENTRY      = 0x06  # increment, no shift
_CMD_DISPLAY_ON = 0x0C  # display on, cursor off, blink off
_CMD_FUNC_SET   = 0x28  # 4-bit, 2 lines, 5x8 font
_CMD_LINE1      = 0x80  # DDRAM address for row 0
_CMD_LINE2      = 0xC0  # DDRAM address for row 1


def _write_byte(fd: int, data: int) -> None:
    os.write(fd, bytes([data & 0xFF]))


def _pulse_enable(fd: int, data: int) -> None:
    _write_byte(fd, data | _EN)
    time.sleep(0.0005)
    _write_byte(fd, data & ~_EN)
    time.sleep(0.0001)


def _write4(fd: int, nibble: int, flags: int) -> None:
    """Send one 4-bit nibble (upper nibble of nibble) + flags."""
    data = (nibble & 0xF0) | flags | _BL
    _pulse_enable(fd, data)


def _send(fd: int, value: int, mode: int) -> None:
    """Send a full byte in 4-bit mode. mode=0 command, mode=RS data."""
    _write4(fd, value & 0xF0, mode)
    _write4(fd, (value << 4) & 0xF0, mode)


def _cmd(fd: int, value: int) -> None:
    _send(fd, value, 0)
    time.sleep(0.002)


def _char(fd: int, value: int) -> None:
    _send(fd, value, _RS)


def _init(fd: int) -> None:
    """HD44780 4-bit initialisation sequence."""
    time.sleep(0.05)
    # Force 8-bit mode 3 times (wakes up from any state)
    for _ in range(3):
        _write4(fd, 0x30, 0)
        time.sleep(0.005)
    # Switch to 4-bit mode
    _write4(fd, 0x20, 0)
    time.sleep(0.001)
    # Now in 4-bit: configure function, display, entry
    _cmd(fd, _CMD_FUNC_SET)
    _cmd(fd, _CMD_DISPLAY_ON)
    _cmd(fd, _CMD_CLEAR)
    _cmd(fd, _CMD_ENTRY)


def lcd_write(line1: str, line2: str, bus_number: int = 12, addr: int = 0x27) -> None:
    dev = f"/dev/i2c-{bus_number}"
    try:
        fd = os.open(dev, os.O_RDWR)
    except OSError as e:
        raise RuntimeError(f"Cannot open {dev}: {e}")

    try:
        # Set I2C slave address
        fcntl.ioctl(fd, _I2C_SLAVE, addr)
        # Check device is present (read 1 byte)
        try:
            os.read(fd, 1)
        except OSError:
            raise RuntimeError(
                f"LCD not found on i2c-{bus_number} at 0x{addr:02x}. "
                f"Check wiring (SDA=GPIO2, SCL=GPIO3) and address."
            )

        _init(fd)

        # Write line 1 (max 16 chars)
        _cmd(fd, _CMD_LINE1)
        for ch in line1[:16].ljust(16):
            _char(fd, ord(ch))

        # Write line 2 (max 16 chars)
        _cmd(fd, _CMD_LINE2)
        for ch in line2[:16].ljust(16):
            _char(fd, ord(ch))
    finally:
        os.close(fd)


def main() -> None:
    line1 = sys.argv[1] if len(sys.argv) > 1 else ""
    line2 = sys.argv[2] if len(sys.argv) > 2 else ""
    bus_number = int(sys.argv[3]) if len(sys.argv) > 3 else 12
    addr = int(sys.argv[4], 16) if len(sys.argv) > 4 else 0x27

    lcd_write(line1, line2, bus_number, addr)
    print(json.dumps({
        "line1": line1[:16],
        "line2": line2[:16],
        "bus": bus_number,
        "addr": f"0x{addr:02x}",
    }))


if __name__ == "__main__":
    main()
