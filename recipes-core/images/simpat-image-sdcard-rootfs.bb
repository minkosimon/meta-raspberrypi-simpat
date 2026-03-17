SUMMARY = "SIMPAT Raspberry Pi SD card image with local rootfs"
LICENSE = "MIT"

require recipes-core/images/core-image-minimal.bb

inherit simpat-image-sdcard-rootfs
