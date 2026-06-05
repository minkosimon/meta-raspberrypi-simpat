SUMMARY = "Freenove FNK0054 Test Dashboard — Frontend + Backend + Driver"
DESCRIPTION = "Web-based test dashboard for the Freenove FNK0054 kit on Raspberry Pi 5. \
Includes a Python WebSocket/HTTP backend, a React frontend, board-side \
hardware control scripts (GPIO, PWM, I2C, ADC, DHT11, ultrasonic, servo, buzzer), \
and a Linux kernel module driver for hardware control."
LICENSE = "CLOSED"

SRC_URI = " \
    file://backend/app.py \
    file://backend/config.py \
    file://backend/ssh_bridge.py \
    file://backend/requirements.txt \
    file://board-scripts/manage_GPIO_led.py \
    file://board-scripts/gpio_control.py \
    file://board-scripts/pwm_control.py \
    file://board-scripts/servo_control.py \
    file://board-scripts/led_rgb.py \
    file://board-scripts/i2c_scan.py \
    file://board-scripts/adc_read.py \
    file://board-scripts/mpu6050_read.py \
    file://board-scripts/dht_read.py \
    file://board-scripts/keypad_read.py \
    file://board-scripts/ultrasonic.py \
    file://board-scripts/buzzer.py \
    file://board-scripts/fan_control.py \
    file://board-scripts/ntp_status.py \
    file://board-scripts/system_info.py \
    file://frontend/index.html \
    file://frontend/app-preview.js \
    file://frontend/app.js \
    file://frontend/style.css \
    file://frontend/react.min.js \
    file://frontend/react-dom.min.js \
    file://drivers/freenove-driver.c \
    file://drivers/Makefile \
    file://drivers/freenove-overlay.dts \
    file://freenove-dashboard.service \
    file://freenove-dashboard.env \
    file://freenove-driver.conf \
"

# Module source is in the drivers/ subdirectory
S = "${WORKDIR}/drivers"

inherit module systemd deploy

COMPATIBLE_MACHINE = "raspberrypi5"

DEPENDS += "dtc-native"

# Runtime dependencies
RDEPENDS:${PN} = " \
    python3 \
    python3-core \
    python3-json \
    python3-asyncio \
    python3-aiohttp \
    python3-paramiko \
    rpi-gpio \
    python3-smbus2 \
"

# Compile the device tree overlay after the kernel module
do_compile:append() {
    dtc -@ -I dts -O dtb -o ${S}/freenove-overlay.dtbo ${S}/freenove-overlay.dts
}

# Install frontend, backend, scripts, overlay and systemd service
# (kernel module is installed by the module class)
do_install:append() {
    # Device tree overlay
    install -d ${D}/boot/overlays
    install -m 0644 ${S}/freenove-overlay.dtbo ${D}/boot/overlays/

    # Backend
    install -d ${D}/opt/freenove/backend
    install -m 0644 ${WORKDIR}/backend/app.py          ${D}/opt/freenove/backend/
    install -m 0644 ${WORKDIR}/backend/config.py        ${D}/opt/freenove/backend/
    install -m 0644 ${WORKDIR}/backend/ssh_bridge.py    ${D}/opt/freenove/backend/
    install -m 0644 ${WORKDIR}/backend/requirements.txt ${D}/opt/freenove/backend/

    # Board scripts
    install -d ${D}/opt/freenove/scripts
    for f in ${WORKDIR}/board-scripts/*.py; do
        install -m 0755 "$f" ${D}/opt/freenove/scripts/
    done

    # Frontend
    install -d ${D}/opt/freenove/frontend
    install -m 0644 ${WORKDIR}/frontend/index.html      ${D}/opt/freenove/frontend/
    install -m 0644 ${WORKDIR}/frontend/app-preview.js  ${D}/opt/freenove/frontend/
    install -m 0644 ${WORKDIR}/frontend/app.js          ${D}/opt/freenove/frontend/
    install -m 0644 ${WORKDIR}/frontend/style.css       ${D}/opt/freenove/frontend/
    install -m 0644 ${WORKDIR}/frontend/react.min.js    ${D}/opt/freenove/frontend/
    install -m 0644 ${WORKDIR}/frontend/react-dom.min.js ${D}/opt/freenove/frontend/

    # Systemd service
    install -d ${D}${systemd_system_unitdir}
    install -m 0644 ${WORKDIR}/freenove-dashboard.service ${D}${systemd_system_unitdir}/

    # Runtime environment
    install -d ${D}${sysconfdir}/default
    install -m 0644 ${WORKDIR}/freenove-dashboard.env ${D}${sysconfdir}/default/freenove-dashboard

    # Module autoload
    install -d ${D}${sysconfdir}/modules-load.d
    install -m 0644 ${WORKDIR}/freenove-driver.conf ${D}${sysconfdir}/modules-load.d/
}

SYSTEMD_SERVICE:${PN} = "freenove-dashboard.service"
SYSTEMD_AUTO_ENABLE = "enable"

FILES:${PN} += " \
    /opt/freenove \
    ${systemd_system_unitdir}/freenove-dashboard.service \
    ${sysconfdir}/default/freenove-dashboard \
    /boot/overlays/freenove-overlay.dtbo \
    ${sysconfdir}/modules-load.d/freenove-driver.conf \
"

# Deploy the overlay to DEPLOY_DIR_IMAGE so TFTP deploy picks it up
do_deploy() {
    install -m 0644 ${S}/freenove-overlay.dtbo ${DEPLOYDIR}/freenove-overlay.dtbo
}

addtask deploy after do_compile before do_build
