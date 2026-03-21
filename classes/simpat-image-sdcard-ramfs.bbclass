# Build a Raspberry Pi SD card image that boots from a bundled initramfs.
# The SD card only contains the firmware, DTBs and the bundled kernel image.
# Bootloader (U-Boot or EEPROM) is selected automatically via DISTRO_FEATURES.

inherit simpat-image-sdcard

# Configure for RAMFS boot
SIMPAT_ROOTFS_TYPE = "ramfs"
WKS_FILE ?= "sdcard-ramfs.wks.in"

# Initramfs configuration
SIMPAT_INITRAMFS_IMAGE ?= ""
INITRAMFS_IMAGE ?= "${SIMPAT_INITRAMFS_IMAGE}"
INITRAMFS_IMAGE = "core-image-minimal-initramfs"
INITRAMFS_IMAGE_BUNDLE ?= "1"

# No persistent rootfs on cmdline for ramfs boot
CMDLINE_ROOTFS = ""

# Bundled kernel+initramfs is larger than plain kernel
SIMPAT_WIC_BOOT_PARTITION_SIZE ?= "128"

# Use bundled kernel artifact for boot
IMAGE_BOOT_FILES = "${BOOTFILES_DIR_NAME}/* \
                 ${@make_dtb_boot_files(d)} \
                 ${@bb.utils.contains('RPI_USE_U_BOOT', '1', \
                    'u-boot.bin;${SDIMG_KERNELIMAGE} boot.scr ${KERNEL_IMAGETYPE}-${INITRAMFS_LINK_NAME}.bin;${KERNEL_IMAGETYPE}', \
                    '${KERNEL_IMAGETYPE}-${INITRAMFS_LINK_NAME}.bin;${SDIMG_KERNELIMAGE}', d)} \
                 "