"""
Configuration for the Freenove FNK0054 Test Backend.
"""
import os


def _parse_origins(value: str) -> tuple[str, ...]:
    return tuple(origin.strip().rstrip("/") for origin in value.split(",") if origin.strip())

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

# I2C bus number
I2C_BUS = 1
