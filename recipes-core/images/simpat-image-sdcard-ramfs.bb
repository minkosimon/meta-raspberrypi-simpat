SUMMARY = "SIMPAT Raspberry Pi SD card boot image for bundled initramfs"
LICENSE = "MIT"

require recipes-core/images/core-image-minimal.bb

# Configure for sdcard boot with rootfs in RAM
SUPPORT_BOOT := "sdcard"
SUPPORT_IMG_TYPE := "ramfs"

inherit image-support support-img-type


# Initramfs configuration
INITRAMFS_IMAGE ?= "core-image-minimal-initramfs"
