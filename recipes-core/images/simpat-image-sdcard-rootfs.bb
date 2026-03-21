SUMMARY = "SIMPAT Raspberry Pi SD card image with local rootfs"
LICENSE = "MIT"

require recipes-core/images/core-image-minimal.bb

inherit image-support support-img-type

# Configure for standard SD card boot with local rootfs
SUPPORT_IMG_TYPE = "rootfs"

# Configure for TFTP boot with rootfs in RAM
SUPPORT_BOOT := "sdcard"
SUPPORT_IMG_TYPE := "rootfs"