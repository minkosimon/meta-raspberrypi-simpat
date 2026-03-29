SUMMARY = "SIMPAT Raspberry Pi SD card image with local rootfs"
LICENSE = "MIT"

require recipes-core/images/core-image-minimal.bb

inherit image-support

# Configure for standard SD card boot with local rootfs
SUPPORT_IMG_TYPE = "rootfs"

# set WKS 
WKS_FILE = "sdcard-rootfs.wks.in"

# Configure for TFTP boot with rootfs in RAM
SUPPORT_BOOT := "sdcard"
SUPPORT_IMG_TYPE := "rootfs"

# WiFi and Bluetooth firmware
IMAGE_INSTALL:append = " \
    linux-firmware-rpidistro-bcm43455 \
    bluez-firmware-rpidistro-bcm4345c0-hcd \
"