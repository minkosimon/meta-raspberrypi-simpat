# Build a classic Raspberry Pi SD card image with:
#  - a VFAT boot partition
#  - a rootfs partition

inherit simpat-image-sdcard

WKS_FILE ?= "sdcard-rootfs.wks.in"