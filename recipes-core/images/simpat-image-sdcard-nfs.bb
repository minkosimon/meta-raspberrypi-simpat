SUMMARY = "SIMPAT Raspberry Pi SD card boot image for NFS rootfs"
LICENSE = "MIT"

require recipes-core/images/core-image-minimal.bb

inherit simpat-image-sdcard-nfs
