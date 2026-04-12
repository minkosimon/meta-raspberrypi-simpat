# blink-blue-led — Linux Kernel Driver for GPIO17 LED

Linux kernel module (platform driver) to blink a blue LED connected to **GPIO17** on Raspberry Pi 5.
Uses the modern **gpiod descriptor API** with a **Device Tree overlay** for proper RP1 chip GPIO resolution.

---

## Hardware Circuit

```
GPIO17 (pin 11) ──── R1 (220Ω) ──── LED (Blue 525nm) ──── GND
```

| Component | Value | Role |
|-----------|-------|------|
| GPIO17 | BCM pin 17 (physical pin 11) | Digital output |
| R1 | 220Ω | Current limiting resistor |
| LED1 | Blue (525nm) | Indicator |
| GND | Ground | Return path |

---

## Architecture

### Driver Architecture

```mermaid
flowchart TB
    subgraph USERSPACE["Userspace"]
        APP["echo 1 > /dev/blink_blue_led"]
        READ["cat /dev/blink_blue_led"]
    end

    subgraph KERNEL["Kernel Space"]
        subgraph CHARDEV["Character Device"]
            WRITE["blink_write()"]
            READFN["blink_read()"]
        end

        subgraph CONTROL["Blink Control"]
            START["blink_start()"]
            STOP["blink_stop()"]
            TIMER["kernel timer\n(blink_timer_callback)"]
        end

        subgraph GPIOD["GPIO Descriptor API"]
            SET["gpiod_set_value()"]
        end
    end

    subgraph HARDWARE["Hardware (RP1 chip)"]
        GPIO["GPIO17"]
        LED["Blue LED"]
    end

    APP --> WRITE
    READ --> READFN
    WRITE -->|"val == 1"| START
    WRITE -->|"val == 0"| STOP
    WRITE -->|"val >= 50"| TIMER
    START --> TIMER
    TIMER -->|"toggle"| SET
    STOP -->|"off"| SET
    SET --> GPIO
    GPIO --> LED

    style USERSPACE fill:#e3f2fd,stroke:#01579b,stroke-width:2px
    style KERNEL fill:#fff9c4,stroke:#f57f17,stroke-width:2px
    style HARDWARE fill:#fce4ec,stroke:#c62828,stroke-width:2px
```

### Boot & Probe Flow

```mermaid
sequenceDiagram
    participant FW as RPi Firmware
    participant DT as Device Tree
    participant KRN as Kernel
    participant DRV as blink-blue-led.ko
    participant HW as GPIO17 / LED

    FW->>FW: Read config.txt
    FW->>DT: Load blink-blue-led.dtbo overlay
    DT->>DT: Merge node blink-blue-led<br/>compatible = "simpat,blink-blue-led"
    FW->>KRN: Boot kernel with merged DT

    KRN->>DRV: Auto-load module (OF match)
    DRV->>DRV: probe() called
    DRV->>HW: devm_gpiod_get("led", GPIOD_OUT_LOW)
    DRV->>KRN: alloc_chrdev_region()
    DRV->>KRN: class_create() + device_create()
    DRV->>KRN: /dev/blink_blue_led ready

    Note over DRV,HW: Driver ready — waiting for userspace commands
```

### Yocto Build & Deploy Flow

```mermaid
flowchart LR
    subgraph BUILD["bitbake blink-blue-led"]
        C1["Compile<br/>blink-blue-led.c → .ko"]
        C2["Compile<br/>overlay.dts → .dtbo"]
    end

    subgraph DEPLOY["Deploy"]
        D1["DEPLOY_DIR_IMAGE/<br/>blink-blue-led.dtbo"]
        D2["rootfs /lib/modules/<br/>blink-blue-led.ko.xz"]
    end

    subgraph IMAGE["bitbake simpat-image-tftp-nfs"]
        T1["TFTP: overlays/<br/>blink-blue-led.dtbo"]
        T2["NFS: /lib/modules/<br/>blink-blue-led.ko.xz"]
    end

    C1 --> D2
    C2 --> D1
    D1 -->|"IMAGE_BOOT_FILES"| T1
    D2 -->|"rootfs tar"| T2

    style BUILD fill:#e3f2fd,stroke:#01579b,stroke-width:2px
    style DEPLOY fill:#fff9c4,stroke:#f57f17,stroke-width:2px
    style IMAGE fill:#c8e6c9,stroke:#2e7d32,stroke-width:2px
```

---

## Files

| File | Description |
|------|-------------|
| `blink-blue-led.bb` | Yocto recipe — builds kernel module + DT overlay, deploys to TFTP |
| `files/blink-blue-led.c` | Platform driver source (gpiod API, char device, kernel timer) |
| `files/blink-blue-led-overlay.dts` | Device Tree overlay — declares GPIO17 for the driver |
| `files/Makefile` | Kernel module build Makefile |

---

## Device Tree Overlay

The overlay declares GPIO17 on the RP1 controller for our driver:

```dts
/ {
    compatible = "brcm,bcm2712";       /* RPi 5 SoC */
    fragment@0 {
        target-path = "/";
        __overlay__ {
            blink-blue-led {
                compatible = "simpat,blink-blue-led";  /* matches driver */
                led-gpios = <&gpio 17 0>;              /* GPIO17 active-high */
                status = "okay";
            };
        };
    };
};
```

The `compatible` string links the DT node to the kernel driver's `of_match_table`.

---

## Usage

### Build

```bash
# Build only the driver
bitbake blink-blue-led

# Build full image (includes driver + overlay + TFTP deploy)
bitbake simpat-image-tftp-nfs
```

### Control on target

```bash
# Start blinking (default 500ms period)
echo 1 > /dev/blink_blue_led

# Check status
cat /dev/blink_blue_led
# → "blinking 500"

# Change blink period to 200ms
echo 200 > /dev/blink_blue_led

# Stop blinking (LED off)
echo 0 > /dev/blink_blue_led

# Check status
cat /dev/blink_blue_led
# → "off"
```

### Module parameter

```bash
# Load with custom default period (1 second)
modprobe blink_blue_led blink_period_ms=1000

# Change at runtime via sysfs
echo 250 > /sys/module/blink_blue_led/parameters/blink_period_ms
```

### Diagnostics

```bash
# Check module is loaded
lsmod | grep blink

# Check dmesg for driver messages
dmesg | grep blink_blue_led

# Verify device node
ls -la /dev/blink_blue_led

# Check DT overlay was applied
ls /proc/device-tree/blink-blue-led/
```

---

## Chardev Interface

| Write | Action |
|-------|--------|
| `0` | Stop blinking, LED off |
| `1` | Start blinking with current period |
| `50`–`10000` | Set blink period in ms |

| Read | Output |
|------|--------|
| Blinking | `blinking <period_ms>\n` |
| Stopped | `off\n` |

---

## Key Design Choices

| Aspect | Choice | Reason |
|--------|--------|--------|
| GPIO API | `gpiod_*` (descriptor) | RPi 5 RP1 chip requires DT-based GPIO resolution |
| Driver model | Platform driver + DT overlay | Auto-probe at boot, no manual `insmod` needed |
| Timer | `timer_list` (kernel software timer) | Simple periodic toggle, no need for hrtimer |
| Char device | Manual `cdev` + `class_create` | Full control over `/dev/` node and permissions |
| Resource mgmt | `devm_gpiod_get()` | Automatic GPIO release on driver removal |
