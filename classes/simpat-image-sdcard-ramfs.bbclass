# Build a Raspberry Pi SD card image that boots from a bundled initramfs.
# The SD card only contains the firmware, DTBs and the bundled kernel image.

inherit simpat-image-sdcard

WKS_FILE ?= "sdcard-ramfs.wks.in"

SIMPAT_INITRAMFS_IMAGE ?= ""
INITRAMFS_IMAGE ?= "${SIMPAT_INITRAMFS_IMAGE}"
INITRAMFS_IMAGE_BUNDLE ?= "1"

# The kernel boots directly from the bundled initramfs, so no persistent rootfs
# command line must be injected in cmdline.txt.
CMDLINE_ROOTFS = ""

# A bundled kernel+initramfs is larger than a plain kernel image.
SIMPAT_WIC_BOOT_PARTITION_SIZE ?= "128"

# meta-raspberrypi's default IMAGE_BOOT_FILES points to the plain kernel image.
# For the ramfs case we want the bundled kernel artifact to be copied into the
# boot partition instead.
IMAGE_BOOT_FILES = "${BOOTFILES_DIR_NAME}/* \
                 ${@make_dtb_boot_files(d)} \
                 ${@bb.utils.contains('RPI_USE_U_BOOT', '1', \
                    'u-boot.bin;${SDIMG_KERNELIMAGE} boot.scr ${KERNEL_IMAGETYPE}-${INITRAMFS_LINK_NAME}.bin;${KERNEL_IMAGETYPE}', \
                    '${KERNEL_IMAGETYPE}-${INITRAMFS_LINK_NAME}.bin;${SDIMG_KERNELIMAGE}', d)} \
                 "