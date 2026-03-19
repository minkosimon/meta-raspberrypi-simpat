SUMMARY = "SIMPAT Raspberry Pi TFTP boot image"
DESCRIPTION = "Minimal image for TFTP netboot with kernel and device tree deployment"
LICENSE = "MIT"

require recipes-core/images/core-image-minimal.bb

# Enable TFTP boot file deployment
inherit tftp-deploy

TFTP_BOOT_FOLDER ?= "/tmp/srv/tftp"

# Image type configuration for TFTP boot
# Generate only necessary boot artifacts
IMAGE_FSTYPES = "tar.bz2"

# Minimal rootfs packages for boot functionality
IMAGE_INSTALL:append = " \
    kernel-modules \
    udev \
    base-files \
    base-passwd \
    netbase \
"

# Enable systemd for network configuration
DISTRO_FEATURES:append = " systemd"
VIRTUAL-RUNTIME_init_manager = "systemd"
VIRTUAL-RUNTIME_initcalls = ""

# U-Boot configuration for network boot (if applicable)
# This is automatically handled by rpi-bootfiles for Raspberry Pi
