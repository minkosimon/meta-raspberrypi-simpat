SUMMARY = "SIMPAT Raspberry Pi SD card boot image for bundled initramfs"
LICENSE = "MIT"

require recipes-core/images/core-image-minimal.bb

inherit simpat-image-sdcard-ramfs
