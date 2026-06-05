#!/usr/bin/env python3
"""
Freenove FNK0054 Test Backend — WebSocket + HTTP server.

Architecture:
    React Frontend  <--WebSocket (8080)-->  Backend Bridge  <--SSH-->  Board
"""
import asyncio
import glob
import json
import logging
import os
import shlex
import ssl
import sys
import time
from urllib.parse import urlsplit


def _bootstrap_local_venv() -> None:
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    site_packages_glob = os.path.join(
        backend_dir, "venv", "lib*", "python*", "site-packages"
    )

    for site_packages in sorted(glob.glob(site_packages_glob)):
        if site_packages not in sys.path:
            sys.path.insert(0, site_packages)


_bootstrap_local_venv()

from aiohttp import web

from ssh_bridge import SSHBridge
import config

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("app")

bridge = SSHBridge()

LOCAL_SSH_HOSTS = {"127.0.0.1", "localhost", "::1"}
DISPLAY_DAEMON_PATTERNS = ("led_matrix.py", "seven_segment.py")
FREENOVE_DRIVER_MODULE = "freenove_driver"
MPU6050_STREAM_DEFAULT_INTERVAL_MS = 700
MPU6050_STREAM_MIN_INTERVAL_MS = 150
MPU6050_STREAM_MAX_INTERVAL_MS = 5000


mpu6050_stream_state = {
    "task": None,
    "streaming": False,
    "interval_ms": MPU6050_STREAM_DEFAULT_INTERVAL_MS,
    "bus": config.I2C_BUS,
    "addr": "0x68",
    "sample": None,
    "last_error": "",
    "updated_at": 0.0,
    "sample_monotonic": 0.0,
    "actual_hz": 0.0,
}


def _should_run_locally() -> bool:
    return config.SSH_HOST in LOCAL_SSH_HOSTS


def _build_ssl_context() -> ssl.SSLContext | None:
    if not config.WS_TLS_ENABLED:
        return None

    if not config.WS_TLS_CERT or not config.WS_TLS_KEY:
        raise RuntimeError(
            "TLS is enabled but FNK_WS_TLS_CERT or FNK_WS_TLS_KEY is missing"
        )

    ssl_context = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
    ssl_context.load_cert_chain(config.WS_TLS_CERT, config.WS_TLS_KEY)
    return ssl_context


def _normalize_origin(origin: str) -> str:
    return origin.strip().rstrip("/")


def _is_origin_allowed(request: web.Request) -> bool:
    origin = request.headers.get("Origin")
    if not origin:
        return True

    allowed_origins = set(config.WS_ALLOWED_ORIGINS)
    if not allowed_origins:
        allowed_origins.add(f"{request.scheme}://{request.host}".rstrip("/"))

    normalized_origin = _normalize_origin(origin)
    if normalized_origin in allowed_origins:
        return True

    try:
        parsed_origin = urlsplit(normalized_origin)
    except ValueError:
        return False

    if not parsed_origin.scheme or not parsed_origin.netloc:
        return False

    return parsed_origin.netloc.lower() == request.host.lower()


async def _run_local_command(command: str, timeout: int = 30) -> dict:
    proc = await asyncio.create_subprocess_shell(
        command,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        return {"stdout": "", "stderr": "command timed out", "returncode": 124}

    return {
        "stdout": stdout.decode(errors="replace"),
        "stderr": stderr.decode(errors="replace"),
        "returncode": proc.returncode,
    }


async def _run_local_script(script_name: str, args: str = "") -> dict:
    script_path = os.path.join(config.BOARD_SCRIPTS_DIR, script_name)
    command = [sys.executable, script_path]
    if args:
        command.extend(shlex.split(args))

    proc = await asyncio.create_subprocess_exec(
        *command,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    return {
        "stdout": stdout.decode(errors="replace"),
        "stderr": stderr.decode(errors="replace"),
        "returncode": proc.returncode,
    }


async def _run_board_command(command: str, timeout: int = 30) -> dict:
    if bridge.connected:
        return await bridge.run(command, timeout=timeout)
    if _should_run_locally():
        return await _run_local_command(command, timeout=timeout)
    return {"error": "not_connected"}


async def _run_board_script(script_name: str, args: str = "") -> dict:
    if bridge.connected:
        return await bridge.run_script(script_name, args)
    if _should_run_locally():
        return await _run_local_script(script_name, args)
    return {"error": "not_connected"}


def _build_process_kill_command(patterns: tuple[str, ...]) -> str:
    commands = []
    for pattern in patterns:
        commands.append(
            "for _P in $(ps | grep -F {pattern} | grep -v grep | awk '{{print $1}}'); "
            "do kill $_P 2>/dev/null || true; done".format(
                pattern=shlex.quote(pattern)
            )
        )
    return "; ".join(commands) or "true"


async def _stop_display_daemons() -> dict:
    return await _run_board_command(
        _build_process_kill_command(DISPLAY_DAEMON_PATTERNS),
        timeout=5,
    )


async def _set_freenove_driver_enabled(enabled: bool) -> dict:
    if enabled:
        command = (
            f"if [ -d /sys/module/{FREENOVE_DRIVER_MODULE} ]; then "
            f"echo already_loaded; else modprobe {FREENOVE_DRIVER_MODULE}; fi"
        )
    else:
        command = (
            f"if [ -d /sys/module/{FREENOVE_DRIVER_MODULE} ]; then "
            f"modprobe -r {FREENOVE_DRIVER_MODULE}; else echo already_unloaded; fi"
        )

    result = await _run_board_command(command, timeout=10)
    loaded = False
    status_check = await _run_board_command(
        f"if [ -d /sys/module/{FREENOVE_DRIVER_MODULE} ]; then echo loaded; else echo unloaded; fi",
        timeout=5,
    )
    if isinstance(status_check, dict):
        loaded = status_check.get("stdout", "").strip() == "loaded"

    return {
        "enabled": enabled,
        "loaded": loaded,
        "result": result,
        "status_check": status_check,
    }


def _normalize_mpu6050_interval(interval_ms: object) -> int:
    value = int(interval_ms)
    return max(MPU6050_STREAM_MIN_INTERVAL_MS, min(MPU6050_STREAM_MAX_INTERVAL_MS, value))


def _parse_board_json(result: dict) -> dict | None:
    stdout = result.get("stdout", "") if isinstance(result, dict) else ""
    if not stdout:
        return None
    try:
        return json.loads(stdout)
    except json.JSONDecodeError:
        return None


def _build_mpu6050_status() -> dict:
    sample_age_ms = None
    if mpu6050_stream_state["sample_monotonic"]:
        sample_age_ms = round(
            (time.monotonic() - mpu6050_stream_state["sample_monotonic"]) * 1000,
            1,
        )

    return {
        "streaming": bool(mpu6050_stream_state["streaming"]),
        "interval_ms": int(mpu6050_stream_state["interval_ms"]),
        "actual_hz": round(float(mpu6050_stream_state["actual_hz"]), 2),
        "bus": int(mpu6050_stream_state["bus"]),
        "addr": str(mpu6050_stream_state["addr"]),
        "sample": mpu6050_stream_state["sample"],
        "last_error": str(mpu6050_stream_state["last_error"]),
        "updated_at": mpu6050_stream_state["updated_at"] or None,
        "sample_age_ms": sample_age_ms,
    }


async def _mpu6050_stream_loop() -> None:
    previous_sample_at = None
    try:
        while mpu6050_stream_state["streaming"]:
            loop_started = time.monotonic()
            result = await _run_board_script(
                "mpu6050_read.py",
                f"{mpu6050_stream_state['bus']} {mpu6050_stream_state['addr']}",
            )
            sample = _parse_board_json(result)
            finished_at = time.monotonic()

            if sample and "error" not in sample:
                mpu6050_stream_state["sample"] = sample
                mpu6050_stream_state["last_error"] = ""
                mpu6050_stream_state["updated_at"] = round(time.time(), 3)
                mpu6050_stream_state["sample_monotonic"] = finished_at
                if previous_sample_at is not None and finished_at > previous_sample_at:
                    mpu6050_stream_state["actual_hz"] = 1.0 / (finished_at - previous_sample_at)
                previous_sample_at = finished_at
            elif sample and sample.get("error"):
                mpu6050_stream_state["last_error"] = str(sample["error"])
            elif result.get("error"):
                mpu6050_stream_state["last_error"] = str(result["error"])
            elif result.get("stderr"):
                mpu6050_stream_state["last_error"] = str(result["stderr"]).strip()

            elapsed_ms = (time.monotonic() - loop_started) * 1000
            sleep_ms = max(0.0, mpu6050_stream_state["interval_ms"] - elapsed_ms)
            await asyncio.sleep(sleep_ms / 1000)
    except asyncio.CancelledError:
        raise
    finally:
        mpu6050_stream_state["task"] = None


async def _start_mpu6050_stream(params: dict) -> dict:
    interval_ms = _normalize_mpu6050_interval(
        params.get("interval_ms", mpu6050_stream_state["interval_ms"])
    )
    bus = int(params.get("bus", config.I2C_BUS))
    addr = str(params.get("addr", "0x68"))

    mpu6050_stream_state["interval_ms"] = interval_ms
    mpu6050_stream_state["bus"] = bus
    mpu6050_stream_state["addr"] = addr
    mpu6050_stream_state["streaming"] = True

    if mpu6050_stream_state["task"] is None or mpu6050_stream_state["task"].done():
        mpu6050_stream_state["task"] = asyncio.create_task(_mpu6050_stream_loop())

    return _build_mpu6050_status()


async def _stop_mpu6050_stream() -> dict:
    mpu6050_stream_state["streaming"] = False
    task = mpu6050_stream_state.get("task")
    if task is not None:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
    return _build_mpu6050_status()


# ---------------------------------------------------------------------------
#  WebSocket handler
# ---------------------------------------------------------------------------

async def websocket_handler(request: web.Request) -> web.WebSocketResponse:
    if not _is_origin_allowed(request):
        logger.warning(
            "Rejected WebSocket connection from origin=%s host=%s",
            request.headers.get("Origin"),
            request.host,
        )
        raise web.HTTPForbidden(text="origin not allowed")

    ws = web.WebSocketResponse()
    await ws.prepare(request)
    logger.info("WebSocket client connected from %s", request.remote)

    async for msg in ws:
        if msg.type == web.WSMsgType.TEXT:
            try:
                data = json.loads(msg.data)
            except json.JSONDecodeError:
                await ws.send_json({"type": "error", "message": "invalid JSON"})
                continue

            response = await handle_message(data)
            await ws.send_json(response)
        elif msg.type == web.WSMsgType.ERROR:
            logger.error("WebSocket error: %s", ws.exception())

    logger.info("WebSocket client disconnected")
    return ws


async def handle_message(data: dict) -> dict:
    """Route incoming WebSocket messages to the right handler."""
    action = data.get("action", "")
    params = data.get("params", {})
    msg_id = data.get("id", "")

    base = {"type": "response", "id": msg_id, "action": action}

    try:
        result = await dispatch(action, params)
        return {**base, "status": "ok", "data": result}
    except Exception as exc:
        logger.exception("Error handling action=%s", action)
        return {**base, "status": "error", "message": str(exc)}


async def dispatch(action: str, params: dict) -> dict:
    """Dispatch an action to the appropriate board command."""

    # --- Connection management ---
    if action == "connect":
        return await bridge.connect(
            host=params.get("host"),
            port=params.get("port"),
            user=params.get("user"),
            password=params.get("password"),
            key_file=params.get("key_file"),
        )

    if action == "disconnect":
        await _stop_mpu6050_stream()
        return await bridge.disconnect()

    if action == "status":
        return {"connected": bridge.connected}

    if action == "panel_change":
        previous_panel = str(params.get("previous_panel", ""))
        panel = str(params.get("panel", ""))
        result = await _stop_display_daemons()
        driver_result = None
        if previous_panel == "mpu6050" and panel != "mpu6050":
            await _stop_mpu6050_stream()
        if panel == "keypad":
            driver_result = await _set_freenove_driver_enabled(False)
        elif previous_panel == "keypad" and panel != "keypad":
            driver_result = await _set_freenove_driver_enabled(True)
        return {
            "previous_panel": previous_panel,
            "panel": panel,
            "stopped": list(DISPLAY_DAEMON_PATTERNS),
            "result": result,
            "driver": driver_result,
        }

    # --- Freenove driver LEDs (/sys/class/leds/freenove:ledX) ---
    if action == "freenove_led_status":
        led = int(params.get("led", 0))
        cmd = f"led-status {led}"
        result = await _run_board_script("manage_GPIO_led.py", cmd)
        return {"command": cmd, "led": led, "result": result}

    if action == "freenove_led_set":
        led = int(params.get("led", 0))
        value = int(params.get("value", 0))
        value = 1 if value else 0
        cmd = f"led-set {led} {value}"
        result = await _run_board_script("manage_GPIO_led.py", cmd)
        return {"command": cmd, "led": led, "value": value, "result": result}

    if action == "freenove_led_trigger":
        led = int(params.get("led", 0))
        trigger = str(params.get("trigger", "none"))
        if trigger not in {"none", "timer"}:
            return {"error": "trigger must be 'none' or 'timer'"}
        cmd = f"led-trigger {led} {trigger}"
        result = await _run_board_script("manage_GPIO_led.py", cmd)
        return {
            "command": cmd,
            "led": led,
            "trigger": trigger,
            "result": result,
        }

    # --- GPIO ---
    if action == "gpio_setup":
        pin = int(params["pin"])
        direction = params.get("direction", "out")
        return await _run_board_script("manage_GPIO_led.py", f"gpio-setup {pin} {direction}")

    if action == "gpio_write":
        pin = int(params["pin"])
        value = int(params["value"])
        return await _run_board_script("manage_GPIO_led.py", f"gpio-write {pin} {value}")

    if action == "gpio_read":
        pin = int(params["pin"])
        return await _run_board_script("manage_GPIO_led.py", f"gpio-read {pin}")

    if action == "gpio_read_many":
        pins = params.get("pins", config.AVAILABLE_GPIO_PINS)
        safe_pins = [str(int(pin)) for pin in pins]
        if not safe_pins:
            return {"error": "pins must not be empty"}
        return await _run_board_script(
            "manage_GPIO_led.py", f"gpio-read-many {' '.join(safe_pins)}"
        )

    # --- PWM ---
    if action == "pwm_start":
        pin = int(params["pin"])
        freq = int(params.get("frequency", 1000))
        duty = float(params.get("duty", 50))
        return await _run_board_script("pwm_control.py", f"start {pin} {freq} {duty}")

    if action == "pwm_set":
        pin = int(params["pin"])
        duty = float(params["duty"])
        return await _run_board_script("pwm_control.py", f"set {pin} {duty}")

    if action == "pwm_stop":
        pin = int(params["pin"])
        return await _run_board_script("pwm_control.py", f"stop {pin}")

    # --- Servo ---
    if action == "servo_set":
        pin = int(params.get("pin", 18))
        angle = float(params["angle"])
        return await _run_board_script("servo_control.py", f"{pin} {angle}")

    # --- LED RGB ---
    if action == "led_rgb":
        r_pin = int(params.get("r_pin", 5))
        g_pin = int(params.get("g_pin", 6))
        b_pin = int(params.get("b_pin", 13))
        r = int(params.get("r", 0))
        g = int(params.get("g", 0))
        b = int(params.get("b", 0))
        # Kill any leftover led_rgb.py instances (pkill absent on BusyBox).
        # The sysfs brightness write is persistent, so the new script just
        # writes and exits — no daemon needed.
        script = f"{config.BOARD_SCRIPTS_DIR}/led_rgb.py"
        kill_cmd = (
            "for _P in $(ps | grep led_rgb | grep -v grep | awk '{print $1}');"
            " do kill -9 $_P 2>/dev/null; done"
        )
        cmd = f"{kill_cmd}; python3 {script} {r_pin} {g_pin} {b_pin} {r} {g} {b}"
        return await _run_board_command(cmd, timeout=10)

    # --- LED Matrix 8x8 (74HC595) ---
    if action == "led_matrix":
        pattern = params.get("pattern", [0] * 8)
        # Validate: must be list of 8 ints 0-255
        if not isinstance(pattern, list) or len(pattern) != 8:
            return {"error": "pattern must be a list of 8 integers (0-255)"}
        safe = [max(0, min(255, int(v))) for v in pattern]
        arg = ",".join(str(v) for v in safe)
        kill_cmd = _build_process_kill_command(DISPLAY_DAEMON_PATTERNS)
        cmd = f"{kill_cmd}; sleep 0.1; nohup python3 {config.BOARD_SCRIPTS_DIR}/led_matrix.py {arg} > /dev/null 2>&1 &"
        await _run_board_command(cmd, timeout=5)
        return {"status": "ok", "pattern": safe}

    # --- 4-Digit 7-Segment Display (74HC595) ---
    if action == "seven_segment":
        value = str(params.get("value", "0"))
        safe = "".join(ch for ch in value if ch.isdigit())[-4:]
        if not safe:
            safe = "0"
        safe = safe.rjust(4, "0")
        kill_cmd = _build_process_kill_command(DISPLAY_DAEMON_PATTERNS)
        cmd = f"{kill_cmd}; sleep 0.1; nohup python3 {config.BOARD_SCRIPTS_DIR}/seven_segment.py {safe} > /dev/null 2>&1 &"
        await _run_board_command(cmd, timeout=5)
        return {"status": "ok", "value": safe}

    # --- LED Bar Graph (74HC595) ---
    if action == "led_bar":
        level = int(params.get("level", 0))
        safe = max(0, min(10, level))
        script = f"{config.BOARD_SCRIPTS_DIR}/led_bar.py"
        await _stop_display_daemons()
        cmd = f"python3 {script} {safe}"
        return await _run_board_command(cmd, timeout=10)

    # --- I2C ---
    if action == "i2c_scan":
        bus = int(params.get("bus", config.I2C_BUS))
        return await _run_board_script("i2c_scan.py", str(bus))

    if action == "lcd_write":
        line1 = str(params.get("line1", ""))[:16]
        line2 = str(params.get("line2", ""))[:16]
        bus = int(params.get("bus", config.I2C_BUS))
        addr = int(params.get("addr", "0x27"), 16) if isinstance(params.get("addr"), str) else int(params.get("addr", 0x27))
        return await _run_board_script("lcd_write.py", f'"{line1}" "{line2}" {bus} 0x{addr:02x}')

    # --- ADC ---
    if action == "adc_read":
        channel = int(params.get("channel", 0))
        return await _run_board_script("adc_read.py", str(channel))

    # --- DHT11 ---
    if action == "dht_read":
        pin = int(params.get("pin", 17))
        return await _run_board_script("dht_read.py", str(pin))

    # --- Matrix keypad 4x4 ---
    if action == "keypad_read":
        timeout_ms = int(params.get("timeout_ms", 120))
        debounce_ms = int(params.get("debounce_ms", 50))
        driver_result = await _set_freenove_driver_enabled(False)
        script_result = await _run_board_script(
            "keypad_read.py",
            f"{timeout_ms} {debounce_ms}",
        )
        return {
            "driver": driver_result,
            **script_result,
        }

    # --- Ultrasonic HC-SR04 ---
    if action == "ultrasonic_read":
        trig = int(params.get("trig_pin", 23))
        echo = int(params.get("echo_pin", 24))
        return await _run_board_script("ultrasonic.py", f"{trig} {echo}")

    # --- MPU6050 ---
    if action == "mpu6050_read":
        bus = int(params.get("bus", config.I2C_BUS))
        addr = params.get("addr", "0x68")
        return await _run_board_script("mpu6050_read.py", f"{bus} {addr}")

    if action == "mpu6050_stream_start":
        return await _start_mpu6050_stream(params)

    if action == "mpu6050_stream_status":
        return _build_mpu6050_status()

    if action == "mpu6050_stream_stop":
        return await _stop_mpu6050_stream()

    # --- Buzzer ---
    if action == "buzzer":
        pin = int(params.get("pin", 25))
        state = params.get("state", "off")
        freq = int(params.get("frequency", 440))
        duration = float(params.get("duration", 0.5))
        return await _run_board_script(
            "buzzer.py", f"{pin} {state} {freq} {duration}"
        )

    # --- System info ---
    if action == "system_info":
        return await _run_board_script("system_info.py", "")

    if action == "fan_set":
        enabled = bool(params.get("enabled", True))
        state = "on" if enabled else "off"
        result = await _run_board_script("fan_control.py", f"set {state}")
        return {"enabled": enabled, "state": state, "result": result}

    # --- Raw command ---
    if action == "run_command":
        cmd = params.get("command", "")
        if not cmd:
            return {"error": "empty command"}
        return await bridge.run(cmd)

    return {"error": f"unknown action: {action}"}


# ---------------------------------------------------------------------------
#  HTTP routes (serve frontend)
# ---------------------------------------------------------------------------

async def index_handler(request: web.Request) -> web.FileResponse:
    return web.FileResponse(os.path.join(config.FRONTEND_DIR, "index.html"))


def create_app() -> web.Application:
    app = web.Application()
    app.router.add_get("/ws", websocket_handler)
    app.router.add_get("/", index_handler)
    app.router.add_static("/static", config.FRONTEND_DIR, show_index=False)
    return app


def main():
    app = create_app()
    ssl_context = _build_ssl_context()
    public_scheme = "https" if ssl_context else "http"
    websocket_scheme = "wss" if ssl_context else "ws"
    logger.info(
        "Starting Freenove FNK0054 Backend on %s://%s:%d (WebSocket %s://%s:%d/ws)",
        public_scheme,
        config.WS_HOST,
        config.WS_PORT,
        websocket_scheme,
        config.WS_HOST,
        config.WS_PORT,
    )
    if config.WS_ALLOWED_ORIGINS:
        logger.info("Allowed WebSocket origins: %s", ", ".join(config.WS_ALLOWED_ORIGINS))
    web.run_app(app, host=config.WS_HOST, port=config.WS_PORT, ssl_context=ssl_context)


if __name__ == "__main__":
    main()
