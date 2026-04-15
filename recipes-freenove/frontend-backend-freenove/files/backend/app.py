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

    # --- GPIO ---
    if action == "gpio_setup":
        pin = int(params["pin"])
        direction = params.get("direction", "out")
        return await bridge.run_script("gpio_control.py", f"setup {pin} {direction}")

    if action == "gpio_write":
        pin = int(params["pin"])
        value = int(params["value"])
        return await bridge.run_script("gpio_control.py", f"write {pin} {value}")

    if action == "gpio_read":
        pin = int(params["pin"])
        return await bridge.run_script("gpio_control.py", f"read {pin}")

    # --- PWM ---
    if action == "pwm_start":
        pin = int(params["pin"])
        freq = int(params.get("frequency", 1000))
        duty = float(params.get("duty", 50))
        return await bridge.run_script("pwm_control.py", f"start {pin} {freq} {duty}")

    if action == "pwm_set":
        pin = int(params["pin"])
        duty = float(params["duty"])
        return await bridge.run_script("pwm_control.py", f"set {pin} {duty}")

    if action == "pwm_stop":
        pin = int(params["pin"])
        return await bridge.run_script("pwm_control.py", f"stop {pin}")

    # --- Servo ---
    if action == "servo_set":
        pin = int(params.get("pin", 18))
        angle = float(params["angle"])
        return await bridge.run_script("servo_control.py", f"{pin} {angle}")

    # --- LED RGB ---
    if action == "led_rgb":
        r_pin = int(params.get("r_pin", 17))
        g_pin = int(params.get("g_pin", 27))
        b_pin = int(params.get("b_pin", 22))
        r = int(params.get("r", 0))
        g = int(params.get("g", 0))
        b = int(params.get("b", 0))
        return await bridge.run_script(
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
        return await bridge.run_script("led_matrix.py", arg)

    # --- I2C ---
    if action == "i2c_scan":
        bus = int(params.get("bus", config.I2C_BUS))
        return await bridge.run_script("i2c_scan.py", str(bus))

    # --- ADC ---
    if action == "adc_read":
        channel = int(params.get("channel", 0))
        return await bridge.run_script("adc_read.py", str(channel))

    # --- DHT11 ---
    if action == "dht_read":
        pin = int(params.get("pin", 17))
        return await bridge.run_script("dht_read.py", str(pin))

    # --- Ultrasonic HC-SR04 ---
    if action == "ultrasonic_read":
        trig = int(params.get("trig_pin", 23))
        echo = int(params.get("echo_pin", 24))
        return await bridge.run_script("ultrasonic.py", f"{trig} {echo}")

    # --- Buzzer ---
    if action == "buzzer":
        pin = int(params.get("pin", 25))
        state = params.get("state", "off")
        freq = int(params.get("frequency", 440))
        duration = float(params.get("duration", 0.5))
        return await bridge.run_script(
            "buzzer.py", f"{pin} {state} {freq} {duration}"
        )

    # --- System info ---
    if action == "system_info":
        return await bridge.run_script("system_info.py", "")

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
