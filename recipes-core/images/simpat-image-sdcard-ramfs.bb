SUMMARY = "SIMPAT Raspberry Pi SD card boot image for bundled initramfs"
LICENSE = "MIT"

require recipes-core/images/core-image-minimal.bb

# Configure for sdcard boot with rootfs in RAM
SUPPORT_BOOT := "sdcard"
SUPPORT_IMG_TYPE := "ramfs"

inherit image-support 

# set WKS 
WKS_FILE = "sdcard-ramfs.wks.in"

# Initramfs configuration
INITRAMFS_IMAGE ?= "core-image-minimal-initramfs"

# Generate both separate initramfs and bundled kernel
IMAGE_FSTYPES = "cpio.gz"

# Bundle initramfs into kernel for simpler deployment
INITRAMFS_IMAGE = "core-image-minimal-initramfs"
INITRAMFS_IMAGE_BUNDLE = "1"
SUPPORT_WIC_BOOT_PARTITION_SIZE = "128"

