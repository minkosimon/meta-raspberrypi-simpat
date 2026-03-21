# Build a classic Raspberry Pi SD card image with:
#  - a VFAT boot partition (kernel, device trees, firmware)
#  - a rootfs partition (ext4)
# 
# Bootloader (U-Boot or EEPROM) is selected automatically via DISTRO_FEATURES.

inherit simpat-image-sdcard

# Configure for standard SD card boot with local rootfs
SIMPAT_ROOTFS_TYPE = "rootfs"
WKS_FILE ?= "sdcard-rootfs.wks.in"