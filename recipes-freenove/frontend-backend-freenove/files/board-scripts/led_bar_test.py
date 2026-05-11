#!/usr/bin/env python3
"""Step-by-step diagnostics for the 10-segment LED bar graph.

Run one test at a time:
  python3 led_bar_test.py <test_number>

Available tests:
  1 - Verify sysfs brightness files exist
  2 - Toggle DATA pin 10 times
  3 - Toggle CLOCK pin 10 times
  4 - Toggle LATCH pin 10 times
  5 - Sweep levels 0..10 with normal byte order
  6 - Sweep levels 10..0 with normal byte order
  7 - Sweep levels 0..10 with inverted byte order

Hardware (FNK0054 / BCM), aligned with Freenove Project 15.1:
  - DS   (data)  = GPIO22 -> freenove:led7
  - STCP (latch) = GPIO27 -> freenove:led12
  - SHCP (clock) = GPIO17 -> freenove:led5
  Outputs are active HIGH.
"""

import os
import sys
import time

_GPIO_TO_LED = {
    4: 0, 5: 1, 6: 2, 12: 3, 13: 4, 17: 5, 18: 6,
    22: 7, 23: 8, 24: 9, 25: 10, 26: 11, 27: 12,
}
_SYSFS = "/sys/class/leds/freenove:led{}/brightness"

DATA_GPIO = 22
LATCH_GPIO = 27
CLOCK_GPIO = 17

_fds = {}


def _open_pins():
    for gpio, name in ((DATA_GPIO, "data"), (LATCH_GPIO, "latch"), (CLOCK_GPIO, "clk")):
        path = _SYSFS.format(_GPIO_TO_LED[gpio])
        _fds[name] = os.open(path, os.O_WRONLY)


def _close_pins():
    for fd in _fds.values():
        try:
            os.close(fd)
        except Exception:
            pass
    _fds.clear()


def _w(name, val):
    fd = _fds[name]
    os.lseek(fd, 0, os.SEEK_SET)
    os.write(fd, b"1" if val else b"0")


def _shift_out(byte_val):
    for bit in range(7, -1, -1):
        _w("data", (byte_val >> bit) & 1)
        _w("clk", 1)
        _w("clk", 0)


def _latch_bytes(first_byte, second_byte):
    _w("latch", 0)
    _shift_out(first_byte)
    _shift_out(second_byte)
    _w("latch", 1)


def _level_to_bytes(level):
    mask = (1 << level) - 1 if level > 0 else 0
    low_byte = mask & 0xFF
    high_byte = (mask >> 8) & 0xFF
    return high_byte, low_byte


def _apply_level(level, inverted=False):
    high_byte, low_byte = _level_to_bytes(level)
    if inverted:
        _latch_bytes(low_byte, high_byte)
    else:
        _latch_bytes(high_byte, low_byte)
    return high_byte, low_byte


def test_1_sysfs():
    print("=== TEST 1 : Vérification des fichiers sysfs ===")
    ok = True
    for gpio, name in ((DATA_GPIO, "DATA"), (LATCH_GPIO, "LATCH"), (CLOCK_GPIO, "CLOCK")):
        path = _SYSFS.format(_GPIO_TO_LED[gpio])
        exists = os.path.exists(path)
        print(f"  GPIO{gpio} ({name}) -> {path} : {'OK' if exists else 'MANQUANT'}")
        if not exists:
            ok = False
    if ok:
        print("  -> Tous les fichiers sysfs sont présents.\n")
    else:
        print("  -> ERREUR : driver Freenove absent ou pins indisponibles.\n")


def test_2_toggle_data():
    print("=== TEST 2 : Toggle DATA (GPIO22) x 10 ===")
    _open_pins()
    try:
        for i in range(10):
            _w("data", 1)
            print(f"  [{i + 1}] DATA=1")
            time.sleep(0.3)
            _w("data", 0)
            print(f"  [{i + 1}] DATA=0")
            time.sleep(0.3)
    finally:
        _close_pins()
    print("  -> Vérifier une alternance 0V / 3.3V.\n")


def test_3_toggle_clock():
    print("=== TEST 3 : Toggle CLOCK (GPIO17) x 10 ===")
    _open_pins()
    try:
        for i in range(10):
            _w("clk", 1)
            print(f"  [{i + 1}] CLOCK=1")
            time.sleep(0.3)
            _w("clk", 0)
            print(f"  [{i + 1}] CLOCK=0")
            time.sleep(0.3)
    finally:
        _close_pins()
    print("  -> Vérifier une alternance 0V / 3.3V.\n")


def test_4_toggle_latch():
    print("=== TEST 4 : Toggle LATCH (GPIO27) x 10 ===")
    _open_pins()
    try:
        for i in range(10):
            _w("latch", 1)
            print(f"  [{i + 1}] LATCH=1")
            time.sleep(0.3)
            _w("latch", 0)
            print(f"  [{i + 1}] LATCH=0")
            time.sleep(0.3)
    finally:
        _close_pins()
    print("  -> Vérifier une alternance 0V / 3.3V.\n")


def _sweep(levels, inverted=False, label="normal"):
    print(f"=== SWEEP {label} ===")
    _open_pins()
    try:
        _w("data", 0)
        _w("latch", 0)
        _w("clk", 0)
        for level in levels:
            high_byte, low_byte = _apply_level(level, inverted=inverted)
            print(
                f"  level={level:02d} high=0x{high_byte:02X} low=0x{low_byte:02X} inverted={inverted}"
            )
            time.sleep(0.8)
    finally:
        _close_pins()
    print("  -> Observer si la barre suit les niveaux attendus.\n")


def test_5_sweep_up():
    print("=== TEST 5 : Niveaux 0 -> 10 (ordre normal) ===")
    _sweep(range(0, 11), inverted=False, label="0..10 normal")


def test_6_sweep_down():
    print("=== TEST 6 : Niveaux 10 -> 0 (ordre normal) ===")
    _sweep(range(10, -1, -1), inverted=False, label="10..0 normal")


def test_7_sweep_inverted():
    print("=== TEST 7 : Niveaux 0 -> 10 (ordre inversé) ===")
    print("  Utiliser ce test si rien ne s'allume avec le test 5.")
    _sweep(range(0, 11), inverted=True, label="0..10 inversé")


TESTS = {
    "1": test_1_sysfs,
    "2": test_2_toggle_data,
    "3": test_3_toggle_clock,
    "4": test_4_toggle_latch,
    "5": test_5_sweep_up,
    "6": test_6_sweep_down,
    "7": test_7_sweep_inverted,
}


def main():
    if len(sys.argv) != 2 or sys.argv[1] not in TESTS:
        print(__doc__.strip())
        sys.exit(1)

    TESTS[sys.argv[1]]()


if __name__ == "__main__":
    main()