#!/usr/bin/env python3
"""System information script for the FNK0054 board.
Usage: system_info.py
Output: JSON with CPU temp, memory, uptime, kernel, etc.
"""
import json
import os
import platform


FAN_INPUT_PATH = "/sys/class/hwmon/hwmon1/fan1_input"


def get_cpu_temp() -> float:
    try:
        with open("/sys/class/thermal/thermal_zone0/temp") as f:
            return round(int(f.read().strip()) / 1000, 1)
    except (FileNotFoundError, ValueError):
        return -1


def get_memory() -> dict:
    mem = {}
    try:
        with open("/proc/meminfo") as f:
            for line in f:
                parts = line.split()
                if parts[0] in ("MemTotal:", "MemAvailable:", "MemFree:"):
                    mem[parts[0].rstrip(":")] = int(parts[1])  # kB
    except FileNotFoundError:
        pass
    return mem


def get_uptime() -> float:
    try:
        with open("/proc/uptime") as f:
            return float(f.read().split()[0])
    except (FileNotFoundError, ValueError):
        return -1


def get_disk() -> dict:
    st = os.statvfs("/")
    total = st.f_blocks * st.f_frsize
    free = st.f_bfree * st.f_frsize
    return {"total_mb": total // (1024 * 1024), "free_mb": free // (1024 * 1024)}


def get_fan_rpm() -> int | None:
    try:
        with open(FAN_INPUT_PATH) as f:
            return int(f.read().strip())
    except (FileNotFoundError, ValueError):
        return None


def main():
    fan_rpm = get_fan_rpm()
    info = {
        "hostname": platform.node(),
        "kernel": platform.release(),
        "arch": platform.machine(),
        "cpu_temp_c": get_cpu_temp(),
        "memory_kb": get_memory(),
        "uptime_s": get_uptime(),
        "disk": get_disk(),
        "fan_rpm": fan_rpm,
        "fan_active": fan_rpm is not None and fan_rpm > 0,
        "fan_available": fan_rpm is not None,
    }
    print(json.dumps(info))


if __name__ == "__main__":
    main()
