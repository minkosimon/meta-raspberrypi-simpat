#!/usr/bin/env python3
"""System information script for the FNK0054 board.
Usage: system_info.py
Output: JSON with CPU temp, memory, uptime, kernel, etc.
"""
import json
import os
import platform
import time
from datetime import datetime, timezone

from ntp_status import read_ntp_status

FAN_INPUT_PATH = "/sys/class/hwmon/hwmon1/fan1_input"


def read_kernel_cmdline() -> list[str]:
    try:
        with open("/proc/cmdline") as f:
            return f.read().split()
    except FileNotFoundError:
        return []


def read_kernel_arg(name: str, cmdline: list[str]) -> str | None:
    prefix = f"{name}="
    for token in cmdline:
        if token.startswith(prefix):
            return token.split("=", 1)[1]
    return None


def get_boot_mode() -> dict:
    cmdline = read_kernel_cmdline()
    root_arg = read_kernel_arg("root", cmdline)
    nfs_root = read_kernel_arg("nfsroot", cmdline)

    mode = "unknown"
    if root_arg == "/dev/nfs" or nfs_root:
        mode = "rootfs"
    elif root_arg and root_arg.startswith("/dev/mmcblk0"):
        mode = "sdcard"
    elif root_arg and root_arg.startswith("/dev/mmcblk1"):
        mode = "emmc"

    return {
        "mode": mode,
        "root_arg": root_arg,
        "nfs_root": nfs_root,
    }


def get_cpu_temp() -> float:
    try:
        with open("/sys/class/thermal/thermal_zone0/temp") as f:
            return round(int(f.read().strip()) / 1000, 1)
    except (FileNotFoundError, ValueError):
        return -1


def read_cpu_times() -> tuple[int, int] | None:
    try:
        with open("/proc/stat") as f:
            fields = f.readline().split()[1:]
    except FileNotFoundError:
        return None

    if len(fields) < 4:
        return None

    values = [int(value) for value in fields]
    idle = values[3] + (values[4] if len(values) > 4 else 0)
    total = sum(values)
    return idle, total


def get_cpu_usage_percent() -> float | None:
    start = read_cpu_times()
    if start is None:
        return None

    time.sleep(0.1)

    end = read_cpu_times()
    if end is None:
        return None

    idle_delta = end[0] - start[0]
    total_delta = end[1] - start[1]
    if total_delta <= 0:
        return None

    usage = 100.0 * (1.0 - (idle_delta / total_delta))
    return round(usage, 1)


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


def get_current_utc_time() -> str:
    return datetime.now(timezone.utc).strftime("%a %b %d %H:%M:%S %Y")


def main():
    fan_rpm = get_fan_rpm()
    info = {
        "hostname": platform.node(),
        "kernel": platform.release(),
        "arch": platform.machine(),
        "cpu_usage_percent": get_cpu_usage_percent(),
        "cpu_temp_c": get_cpu_temp(),
        "memory_kb": get_memory(),
        "uptime_s": get_uptime(),
        "disk": get_disk(),
        "current_utc_time": get_current_utc_time(),
        "boot_mode": get_boot_mode(),
        "fan_rpm": fan_rpm,
        "fan_active": fan_rpm is not None and fan_rpm > 0,
        "fan_available": fan_rpm is not None,
        "ntp": read_ntp_status(),
    }
    print(json.dumps(info))


if __name__ == "__main__":
    main()
