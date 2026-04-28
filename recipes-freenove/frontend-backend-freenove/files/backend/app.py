#!/usr/bin/env python3
"""
Freenove FNK0054 Test Backend — WebSocket + HTTP server.

Architecture:
    React Frontend  <--WebSocket (8080)-->  Backend Bridge  <--SSH-->  Board
"""
import asyncio
import json
import logging
import os
import shlex
import sys

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


def _should_run_locally() -> bool:
    return config.SSH_HOST in LOCAL_SSH_HOSTS


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


# ---------------------------------------------------------------------------
#  WebSocket handler
# ---------------------------------------------------------------------------

async def websocket_handler(request: web.Request) -> web.WebSocketResponse:
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
        return await bridge.disconnect()

    if action == "status":
        return {"connected": bridge.connected}

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
        r_pin = int(params.get("r_pin", 17))
        g_pin = int(params.get("g_pin", 27))
        b_pin = int(params.get("b_pin", 22))
        r = int(params.get("r", 0))
        g = int(params.get("g", 0))
        b = int(params.get("b", 0))
        return await _run_board_script(
            "led_rgb.py", f"{r_pin} {g_pin} {b_pin} {r} {g} {b}"
        )

    # --- LED Matrix 8x8 (74HC595) ---
    if action == "led_matrix":
        pattern = params.get("pattern", [0] * 8)
        # Validate: must be list of 8 ints 0-255
        if not isinstance(pattern, list) or len(pattern) != 8:
            return {"error": "pattern must be a list of 8 integers (0-255)"}
        safe = [max(0, min(255, int(v))) for v in pattern]
        arg = ",".join(str(v) for v in safe)
        return await _run_board_script("led_matrix.py", arg)

    # --- I2C ---
    if action == "i2c_scan":
        bus = int(params.get("bus", config.I2C_BUS))
        return await _run_board_script("i2c_scan.py", str(bus))

    # --- ADC ---
    if action == "adc_read":
        channel = int(params.get("channel", 0))
        return await _run_board_script("adc_read.py", str(channel))

    # --- DHT11 ---
    if action == "dht_read":
        pin = int(params.get("pin", 17))
        return await _run_board_script("dht_read.py", str(pin))

    # --- Ultrasonic HC-SR04 ---
    if action == "ultrasonic_read":
        trig = int(params.get("trig_pin", 23))
        echo = int(params.get("echo_pin", 24))
        return await _run_board_script("ultrasonic.py", f"{trig} {echo}")

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
    logger.info(
        "Starting Freenove FNK0054 Backend on %s:%d", config.WS_HOST, config.WS_PORT
    )
    web.run_app(app, host=config.WS_HOST, port=config.WS_PORT)


if __name__ == "__main__":
    main()
