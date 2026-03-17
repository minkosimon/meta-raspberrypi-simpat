# Common settings for Raspberry Pi SD-card images generated with WIC.

IMAGE_FSTYPES += " wic wic.bmap"

WKS_FILE_DEPENDS += " \
    virtual/kernel \
    rpi-bootfiles \
"

SIMPAT_WIC_DISK_DEV ?= "mmcblk0"
SIMPAT_WIC_PARTITION_ALIGN ?= "4096"

SIMPAT_WIC_BOOT_PARTITION_LABEL ?= "boot"
SIMPAT_WIC_BOOT_PARTITION_SIZE ?= "64"

SIMPAT_WIC_ROOTFS_PARTITION_LABEL ?= "root"
SIMPAT_WIC_ROOTFS_PARTITION_FSTYPE ?= "ext4"

SIMPAT_WIC_EXTRA_ARGS ?= ""
WIC_CREATE_EXTRA_ARGS += " ${SIMPAT_WIC_EXTRA_ARGS}"