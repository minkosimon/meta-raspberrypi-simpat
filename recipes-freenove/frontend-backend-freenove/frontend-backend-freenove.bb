SUMMARY = "Freenove FNK0054 Test Dashboard — Frontend + Backend"
DESCRIPTION = "Web-based test dashboard for the Freenove FNK0054 kit on Raspberry Pi 5. \
Includes a Python WebSocket/HTTP backend, a React frontend, and board-side \
hardware control scripts (GPIO, PWM, I2C, ADC, DHT11, ultrasonic, servo, buzzer)."
LICENSE = "CLOSED"

SRC_URI = " \
    file://backend/app.py \
    file://backend/config.py \
    file://backend/ssh_bridge.py \
    file://backend/requirements.txt \
    file://board-scripts/gpio_control.py \
    file://board-scripts/pwm_control.py \
    file://board-scripts/servo_control.py \
    file://board-scripts/led_rgb.py \
    file://board-scripts/i2c_scan.py \
    file://board-scripts/adc_read.py \
    file://board-scripts/dht_read.py \
    file://board-scripts/ultrasonic.py \
    file://board-scripts/buzzer.py \
    file://board-scripts/system_info.py \
    file://frontend/index.html \
    file://frontend/app.js \
    file://frontend/style.css \
"

S = "${WORKDIR}"

# Runtime dependencies
RDEPENDS:${PN} = " \
    python3 \
    python3-core \
    python3-json \
    python3-asyncio \
    python3-aiohttp \
    python3-paramiko \
    python3-rpi-gpio \
    python3-smbus2 \
"

do_install() {
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
    install -m 0644 ${WORKDIR}/frontend/index.html ${D}/opt/freenove/frontend/
    install -m 0644 ${WORKDIR}/frontend/app.js     ${D}/opt/freenove/frontend/
    install -m 0644 ${WORKDIR}/frontend/style.css  ${D}/opt/freenove/frontend/

    # Systemd service
    install -d ${D}${systemd_system_unitdir}
    cat > ${D}${systemd_system_unitdir}/freenove-dashboard.service << 'EOF'
[Unit]
Description=Freenove FNK0054 Test Dashboard
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/freenove/backend
ExecStart=/usr/bin/python3 /opt/freenove/backend/app.py
Restart=on-failure
RestartSec=5
Environment=FNK_FRONTEND_DIR=/opt/freenove/frontend
Environment=FNK_SCRIPTS_DIR=/opt/freenove/scripts
Environment=FNK_SSH_HOST=127.0.0.1

[Install]
WantedBy=multi-user.target
EOF
}

inherit systemd
SYSTEMD_SERVICE:${PN} = "freenove-dashboard.service"
SYSTEMD_AUTO_ENABLE = "enable"

FILES:${PN} = " \
    /opt/freenove \
    ${systemd_system_unitdir}/freenove-dashboard.service \
"
