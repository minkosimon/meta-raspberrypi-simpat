# Build a Raspberry Pi SD card image that only contains boot files.
# The kernel/rootfs command line is configured for NFS by the existing
# rpi-cmdline.bbappend in this layer.

inherit simpat-image-sdcard

WKS_FILE ?= "sdcard-nfs.wks.in"

BOOT_ROOTFS_OVER_NFS = "1"

# Keep a rootfs archive artifact that can be exported over NFS.
IMAGE_FSTYPES += " tar.gz"