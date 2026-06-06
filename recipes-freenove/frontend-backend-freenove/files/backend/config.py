"""Configuration for the Freenove FNK0054 test backend."""

import os
from pathlib import Path


def _parse_origins(value: str) -> tuple[str, ...]:
    return tuple(origin.strip().rstrip("/") for origin in value.split(",") if origin.strip())


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

# WebSocket / HTTP server
WS_HOST = os.environ.get("FNK_WS_HOST", "0.0.0.0")
WS_PORT = int(os.environ.get("FNK_WS_PORT", "8080"))
WS_TLS_ENABLED = os.environ.get("FNK_WS_TLS", "0").lower() in {"1", "true", "yes", "on"}
WS_TLS_CERT = os.environ.get("FNK_WS_TLS_CERT", "")
WS_TLS_KEY = os.environ.get("FNK_WS_TLS_KEY", "")
WS_ALLOWED_ORIGINS = _parse_origins(os.environ.get("FNK_WS_ALLOWED_ORIGINS", ""))

# SSH connection to the board
SSH_HOST = os.environ.get("FNK_SSH_HOST", "192.168.10.22")
SSH_PORT = int(os.environ.get("FNK_SSH_PORT", "22"))
SSH_USER = os.environ.get("FNK_SSH_USER", "root")
SSH_PASSWORD = os.environ.get("FNK_SSH_PASSWORD", "")
SSH_KEY_FILE = os.environ.get("FNK_SSH_KEY", "")

# Board scripts location (on the target board)
BOARD_SCRIPTS_DIR = os.environ.get("FNK_SCRIPTS_DIR", "/opt/freenove/scripts")

# Static frontend directory
FRONTEND_DIR = os.environ.get(
    "FNK_FRONTEND_DIR",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend"),
)

# Available GPIO pins on Raspberry Pi (BCM numbering)
AVAILABLE_GPIO_PINS = [
    2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
    14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27,
]

# PWM-capable pins
PWM_PINS = [12, 13, 18, 19]

# I2C bus number for the user-facing I2C controller on this image.
# The runtime device tree overlay is the source of truth; the environment stays
# as a fallback for development hosts or images without the overlay applied.
I2C_BUS = _resolve_i2c_bus()
