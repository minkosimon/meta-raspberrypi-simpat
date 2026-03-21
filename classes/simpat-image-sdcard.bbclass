# Common settings for Raspberry Pi SD-card images generated with WIC.
# Automatically supports:
#   - EEPROM boot (default)
#   - U-Boot boot (if RPI_USE_U_BOOT = "1" or "uboot" in DISTRO_FEATURES)
#   - NFS boot (if BOOT_ROOTFS_OVER_NFS = "1")
#   - RAMFS boot (via INITRAMFS_IMAGE)
#
# The correct bootloader and partitioning is selected automatically.
# U-Boot dependencies are managed by meta-raspberrypi (do_image_wic[depends])

IMAGE_FSTYPES += " wic wic.bmap"

# Base WIC dependencies (U-Boot deps are handled by rpi-base.inc)
WKS_FILE_DEPENDS += " \
    virtual/kernel \
    rpi-bootfiles \
"

# Common WIC settings
SIMPAT_WIC_DISK_DEV ?= "mmcblk0"
SIMPAT_WIC_PARTITION_ALIGN ?= "4096"

SIMPAT_WIC_BOOT_PARTITION_LABEL ?= "boot"
SIMPAT_WIC_BOOT_PARTITION_SIZE ?= "64"

SIMPAT_WIC_ROOTFS_PARTITION_LABEL ?= "root"
SIMPAT_WIC_ROOTFS_PARTITION_FSTYPE ?= "ext4"

SIMPAT_WIC_EXTRA_ARGS ?= ""
WIC_CREATE_EXTRA_ARGS += " ${SIMPAT_WIC_EXTRA_ARGS}"