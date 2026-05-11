#!/usr/bin/env python3
"""
Diagnostic pas-à-pas pour la matrice LED 8x8 (2x 74HC595).

Lancer chaque test individuellement :
  python3 led_matrix_test.py <numéro_test>

Tests disponibles :
  1 - Vérifie que les fichiers sysfs existent
  2 - Toggle DATA pin 10 fois (mesurable au multimètre / oscilloscope)
  3 - Toggle CLOCK pin 10 fois
  4 - Toggle LATCH pin 10 fois
  5 - Allume TOUTES les LEDs (rows actifs LOW=0x00, cols HIGH=0xFF)
  6 - Allume TOUTES les LEDs ordre INVERSÉ (test si chips U1/U2 câblés à l'envers)
  7 - Une seule LED : ligne 0, colonne 0
  8 - Une seule LED ordre INVERSÉ (test chip order)
  9 - Chaque ligne une par une (2 s chacune)
  10 - Chaque colonne une par une (2 s chacune)
  11 - Multiplex normal (comme led_matrix.py) — motif croix
  12 - Multiplex SANS _clear() entre cycles (correction du bug de clignotement)
"""

import os
import signal
import sys
import time

# ── GPIO mapping ─────────────────────────────────────────────────────────────
_GPIO_TO_LED = {
    4:0, 5:1, 6:2, 12:3, 13:4, 17:5, 18:6,
    22:7, 23:8, 24:9, 25:10, 26:11, 27:12
}
_SYSFS = "/sys/class/leds/freenove:led{}/brightness"

DATA_GPIO  = 22   # DS   → led7
LATCH_GPIO = 27   # STCP → led12
CLOCK_GPIO = 17   # SHCP → led5

_fds = {}

# ── Helpers bas niveau ────────────────────────────────────────────────────────

def _open_pins():
    for gpio, name in [(DATA_GPIO, "data"), (LATCH_GPIO, "latch"), (CLOCK_GPIO, "clk")]:
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
    """MSB-first dans le 74HC595."""
    for i in range(7, -1, -1):
        _w("data", (byte_val >> i) & 1)
        _w("clk", 1)
        _w("clk", 0)

def _latch(row_byte, col_byte):
    """Envoie les 2 octets et pulse le latch."""
    _w("latch", 0)
    _shift_out(row_byte)
    _shift_out(col_byte)
    _w("latch", 1)

def _latch_inverted(row_byte, col_byte):
    """Ordre inversé : col d'abord → test si U1/U2 câblés dans l'autre sens."""
    _w("latch", 0)
    _shift_out(col_byte)
    _shift_out(row_byte)
    _w("latch", 1)

def _all_off():
    _latch(0xFF, 0x00)  # rows inactifs (actifs LOW), cols éteints

# ── Tests ─────────────────────────────────────────────────────────────────────

def test_1_sysfs():
    print("=== TEST 1 : Vérification des fichiers sysfs ===")
    ok = True
    for gpio, name in [(DATA_GPIO, "DATA"), (LATCH_GPIO, "LATCH"), (CLOCK_GPIO, "CLOCK")]:
        path = _SYSFS.format(_GPIO_TO_LED[gpio])
        exists = os.path.exists(path)
        status = "OK  " if exists else "MANQUANT"
        print(f"  GPIO{gpio} ({name}) → {path} : {status}")
        if not exists:
            ok = False
    if ok:
        print("  → Tous les fichiers sysfs sont présents.\n")
    else:
        print("  → ERREUR : fichier(s) manquant(s). Vérifiez le driver freenove.\n")


def test_2_toggle_data():
    print("=== TEST 2 : Toggle DATA (GPIO22) × 10 — mesure au multimètre ===")
    _open_pins()
    for i in range(10):
        _w("data", 1)
        print(f"  [{i+1}] DATA=1")
        time.sleep(0.5)
        _w("data", 0)
        print(f"  [{i+1}] DATA=0")
        time.sleep(0.5)
    _close_pins()
    print("  → Si la tension alterne entre 0V et 3.3V, le pin fonctionne.\n")


def test_3_toggle_clock():
    print("=== TEST 3 : Toggle CLOCK (GPIO17) × 10 ===")
    _open_pins()
    for i in range(10):
        _w("clk", 1)
        print(f"  [{i+1}] CLK=1")
        time.sleep(0.5)
        _w("clk", 0)
        print(f"  [{i+1}] CLK=0")
        time.sleep(0.5)
    _close_pins()
    print("  → Si la tension alterne entre 0V et 3.3V, le pin fonctionne.\n")


def test_4_toggle_latch():
    print("=== TEST 4 : Toggle LATCH (GPIO27) × 10 ===")
    _open_pins()
    for i in range(10):
        _w("latch", 1)
        print(f"  [{i+1}] LATCH=1")
        time.sleep(0.5)
        _w("latch", 0)
        print(f"  [{i+1}] LATCH=0")
        time.sleep(0.5)
    _close_pins()
    print("  → Si la tension alterne entre 0V et 3.3V, le pin fonctionne.\n")


def test_5_all_on_normal():
    print("=== TEST 5 : TOUTES les LEDs allumées (ordre normal) — 5 secondes ===")
    print("  row_byte=0x00 (actifs LOW tous), col_byte=0xFF (cols tous HIGH)")
    _open_pins()
    _latch(0x00, 0xFF)
    time.sleep(5)
    _all_off()
    _close_pins()
    print("  → Si AUCUNE LED ne s'allume, passez au test 6 (ordre inversé).\n")


def test_6_all_on_inverted():
    print("=== TEST 6 : TOUTES les LEDs allumées (ordre chips INVERSÉ) — 5 secondes ===")
    print("  Test si U1/U2 sont câblés dans l'autre sens que prévu.")
    _open_pins()
    _latch_inverted(0x00, 0xFF)
    time.sleep(5)
    _latch_inverted(0xFF, 0x00)
    _close_pins()
    print("  → Si les LEDs s'allument ici mais pas au test 5 : l'ordre dans _display_row est inversé.\n")


def test_7_single_led_normal():
    print("=== TEST 7 : UNE seule LED — ligne 0, colonne 0 (ordre normal) — 5 secondes ===")
    print("  row_byte = ~(1<<0) & 0xFF = 0xFE,  col_byte = 0x80 (bit 7, MSB first)")
    row_byte = ~(1 << 0) & 0xFF  # 0xFE : seule ligne 0 active (LOW)
    col_byte = 0x80               # seule colonne 0 active (MSB = col 0)
    _open_pins()
    _latch(row_byte, col_byte)
    time.sleep(5)
    _all_off()
    _close_pins()
    print("  → Si aucune LED : essayez col_byte=0x01 ou le test 8 (ordre inversé).\n")


def test_8_single_led_inverted():
    print("=== TEST 8 : UNE seule LED (ordre chips INVERSÉ) — 5 secondes ===")
    row_byte = ~(1 << 0) & 0xFF
    col_byte = 0x80
    _open_pins()
    _latch_inverted(row_byte, col_byte)
    time.sleep(5)
    _latch_inverted(0xFF, 0x00)
    _close_pins()
    print("  → Compare avec test 7 pour identifier quel ordre allume une LED.\n")


def test_9_rows():
    print("=== TEST 9 : Chaque LIGNE une par une (2 s chacune, toutes colonnes ON) ===")
    _open_pins()
    for r in range(8):
        row_byte = ~(1 << r) & 0xFF
        col_byte = 0xFF
        print(f"  Ligne {r} : row_byte=0x{row_byte:02X}, col_byte=0xFF")
        _latch(row_byte, col_byte)
        time.sleep(2)
    _all_off()
    _close_pins()
    print("  → Chaque ligne doit allumer 8 LEDs l'une après l'autre.\n")


def test_10_cols():
    print("=== TEST 10 : Chaque COLONNE une par une (2 s chacune, toutes lignes ON) ===")
    _open_pins()
    for c in range(8):
        row_byte = 0x00         # toutes lignes actives
        col_byte = 1 << (7 - c)  # MSB = col 0
        print(f"  Colonne {c} : row_byte=0x00, col_byte=0x{col_byte:02X}")
        _latch(row_byte, col_byte)
        time.sleep(2)
    _all_off()
    _close_pins()
    print("  → Chaque colonne doit allumer 8 LEDs l'une après l'autre.\n")


def test_11_multiplex_with_clear():
    """Multiplex comme led_matrix.py (avec _clear() — bug potentiel)."""
    print("=== TEST 11 : Multiplex AVEC _clear() entre cycles — motif croix (10 s) ===")
    print("  Comportement original : potentiellement très sombre ou invisible.")
    pattern = [
        0b10000001,
        0b01000010,
        0b00100100,
        0b00011000,
        0b00011000,
        0b00100100,
        0b01000010,
        0b10000001,
    ]
    _open_pins()
    signal.signal(signal.SIGINT, lambda s, f: None)
    end = time.time() + 10
    while time.time() < end:
        for row in range(8):
            row_byte = ~(1 << row) & 0xFF
            _latch(row_byte, pattern[row])
            time.sleep(0.002)
        _latch(0xFF, 0x00)  # ← BUG : éteint la matrice entre chaque cycle
    _all_off()
    _close_pins()
    print("  → Comparez la luminosité avec le test 12.\n")


def test_12_multiplex_without_clear():
    """Multiplex SANS _clear() entre cycles (version corrigée)."""
    print("=== TEST 12 : Multiplex SANS _clear() — motif croix (10 s) ===")
    print("  Version corrigée : pas d'extinction entre les cycles.")
    pattern = [
        0b10000001,
        0b01000010,
        0b00100100,
        0b00011000,
        0b00011000,
        0b00100100,
        0b01000010,
        0b10000001,
    ]
    _open_pins()
    signal.signal(signal.SIGINT, lambda s, f: None)
    end = time.time() + 10
    while time.time() < end:
        for row in range(8):
            row_byte = ~(1 << row) & 0xFF
            _latch(row_byte, pattern[row])
            time.sleep(0.002)
        # PAS de _clear() ici
    _all_off()
    _close_pins()
    print("  → Si plus lumineux que le test 11, le bug est confirmé.\n")


def test_13_inverted_gpio_all_on():
    """Test avec logique GPIO INVERSÉE : write 0 = GPIO HIGH, write 1 = GPIO LOW.
    Le driver freenove semble inverser la logique sur RPi5.
    Si ce test allume les LEDs alors que les tests 5/6 ne le font pas,
    la correction dans led_matrix.py est d'inverser _w()."""
    print("=== TEST 13 : Logique GPIO INVERSÉE — TOUTES LEDs (5 s) ===")
    print("  write 0 -> GPIO HIGH, write 1 -> GPIO LOW (inversion du driver RPi5)")

    def _w_inv(name, val):
        fd = _fds[name]
        os.lseek(fd, 0, os.SEEK_SET)
        os.write(fd, b"0" if val else b"1")  # INVERTED

    def _shift_out_inv(byte_val):
        for i in range(7, -1, -1):
            _w_inv("data", (byte_val >> i) & 1)
            _w_inv("clk", 1)
            _w_inv("clk", 0)

    def _latch_inv(row_byte, col_byte):
        _w_inv("latch", 0)
        _shift_out_inv(row_byte)
        _shift_out_inv(col_byte)
        _w_inv("latch", 1)

    _open_pins()
    # Init pins LOW (avec logique inversée : write 1 = LOW)
    _w_inv("data", 0)
    _w_inv("latch", 0)
    _w_inv("clk", 0)

    # Toutes LEDs : rows=0x00 (all active LOW), cols=0xFF (all HIGH)
    _latch_inv(0x00, 0xFF)
    time.sleep(5)
    # Clear
    _latch_inv(0xFF, 0x00)
    _close_pins()
    print("  → Si les LEDs s'allument ici, confirme l'inversion GPIO dans le driver.\n")


def test_14_inverted_gpio_single_led():
    """Une seule LED avec logique inversée."""
    print("=== TEST 14 : Logique GPIO INVERSÉE — 1 seule LED (5 s) ===")

    def _w_inv(name, val):
        fd = _fds[name]
        os.lseek(fd, 0, os.SEEK_SET)
        os.write(fd, b"0" if val else b"1")

    def _shift_out_inv(byte_val):
        for i in range(7, -1, -1):
            _w_inv("data", (byte_val >> i) & 1)
            _w_inv("clk", 1)
            _w_inv("clk", 0)

    def _latch_inv(row_byte, col_byte):
        _w_inv("latch", 0)
        _shift_out_inv(row_byte)
        _shift_out_inv(col_byte)
        _w_inv("latch", 1)

    _open_pins()
    _w_inv("data", 0); _w_inv("latch", 0); _w_inv("clk", 0)

    row_byte = ~(1 << 0) & 0xFF  # ligne 0 active
    col_byte = 0x80               # colonne 0 (MSB first)
    print(f"  row_byte=0x{row_byte:02X}  col_byte=0x{col_byte:02X}")
    _latch_inv(row_byte, col_byte)
    time.sleep(5)
    _latch_inv(0xFF, 0x00)
    _close_pins()
    print("  → Si 1 LED s'allume, la cause racine est confirmée.\n")


def test_15_verify_gpio_state():
    """Lit les registres RP1 via /dev/mem pour confirmer l'inversion GPIO."""
    print("=== TEST 15 : Lecture registres RP1 — vérification inversion ===")
    try:
        import mmap as _mmap, struct as _struct
        GPIO_PHYS = 0x1f000d0000
        fd = os.open("/dev/mem", os.O_RDWR | os.O_SYNC)
        m = _mmap.mmap(fd, 4096, _mmap.MAP_SHARED,
                       _mmap.PROT_READ | _mmap.PROT_WRITE, offset=GPIO_PHYS)

        def outtopad(gpio):
            s = _struct.unpack_from("I", m, gpio * 8)[0]
            return (s >> 9) & 1

        _open_pins()
        for label, name, gpio_n in [("DATA", "data", 17), ("LATCH", "latch", 27), ("CLOCK", "clk", 22)]:
            os.lseek(_fds[name], 0, os.SEEK_SET); os.write(_fds[name], b"0")
            time.sleep(0.05)
            v0 = outtopad(gpio_n)
            os.lseek(_fds[name], 0, os.SEEK_SET); os.write(_fds[name], b"1")
            time.sleep(0.05)
            v1 = outtopad(gpio_n)
            logic = "INVERSEE" if v0 == 1 and v1 == 0 else "NORMALE" if v0 == 0 and v1 == 1 else "INCONNUE"
            print(f"  GPIO{gpio_n} ({label}): write 0->OUTTOPAD={v0}, write 1->OUTTOPAD={v1}  [{logic}]")
        _close_pins()
        m.close(); os.close(fd)
    except Exception as e:
        print(f"  Erreur /dev/mem: {e}")
        print("  Essayez avec root ou vérifiez CONFIG_STRICT_DEVMEM.")
    print()


# ── Main ──────────────────────────────────────────────────────────────────────

TESTS = {
    1: test_1_sysfs,
    2: test_2_toggle_data,
    3: test_3_toggle_clock,
    4: test_4_toggle_latch,
    5: test_5_all_on_normal,
    6: test_6_all_on_inverted,
    7: test_7_single_led_normal,
    8: test_8_single_led_inverted,
    9: test_9_rows,
    10: test_10_cols,
    11: test_11_multiplex_with_clear,
    12: test_12_multiplex_without_clear,
    13: test_13_inverted_gpio_all_on,
    14: test_14_inverted_gpio_single_led,
    15: test_15_verify_gpio_state,
}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(0)
    try:
        n = int(sys.argv[1])
    except ValueError:
        print(f"Usage: {sys.argv[0]} <1-12>")
        sys.exit(1)
    if n not in TESTS:
        print(f"Test {n} inconnu. Choisir entre 1 et 12.")
        sys.exit(1)
    TESTS[n]()
