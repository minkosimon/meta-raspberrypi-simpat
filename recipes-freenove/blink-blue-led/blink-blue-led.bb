SUMMARY = "GPIO17 blue LED blink kernel module for Raspberry Pi 5"
DESCRIPTION = "Linux kernel driver to blink a blue LED connected to GPIO17 \
via a 220 Ohm resistor. Uses gpiod API + DT overlay for RPi 5 RP1 chip. \
Exposes /dev/blink_blue_led for userspace control."
LICENSE = "CLOSED"

inherit module deploy

DEPENDS += "dtc-native"

SRC_URI = " \
    file://blink-blue-led.c \
    file://Makefile \
    file://blink-blue-led-overlay.dts \
"

S = "${WORKDIR}"

# Compile the device tree overlay
do_compile:append() {
    dtc -@ -I dts -O dtb -o ${WORKDIR}/blink-blue-led.dtbo ${WORKDIR}/blink-blue-led-overlay.dts
}

# Deploy the overlay to DEPLOY_DIR_IMAGE so TFTP deploy picks it up
do_deploy() {
    install -m 0644 ${WORKDIR}/blink-blue-led.dtbo ${DEPLOYDIR}/blink-blue-led.dtbo
}

addtask deploy after do_compile before do_build

RPROVIDES:${PN} += "kernel-module-blink-blue-led"
