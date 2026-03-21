SUMMARY = "SIMPAT Raspberry Pi TFTP boot image with RAMFS rootfs"
DESCRIPTION = "TFTP netboot image with initramfs loaded entirely in RAM"
LICENSE = "MIT"

# Image format for network deployment
IMAGE_FSTYPES = "cpio.gz"

SUPPORT_BOOT := "tftp"
SUPPORT_IMG_TYPE := "ramfs"


require recipes-core/images/core-image-minimal.bb

# TFTP deployment with RAMFS (rootfs loaded in RAM)
inherit image-support

TFTP_BOOT_FOLDER ?= "/tmp/srv/tftp"

# RAMFS configuration
# Bundle initramfs into kernel
INITRAMFS_IMAGE = "core-image-minimal-initramfs"
KERNEL_IMAGETYPE = "Image"

# Generate both separate initramfs and bundled kernel
IMAGE_FSTYPES = "cpio.gz"

# Minimal packages for RAMFS boot
IMAGE_INSTALL:append = " \
    base-files \
    base-passwd \
    bash \
    coreutils \
    grep \
    sed \
    findutils \
    udev \
    openssh \
    openssh-sftp-server \
"

# Enable systemd for boot management
DISTRO_FEATURES:append = " systemd"
VIRTUAL-RUNTIME_init_manager = "systemd"
VIRTUAL-RUNTIME_initcalls = ""

# Keep image size minimal for RAMFS
IMAGE_ROOTFS_SIZE = "32768"

# Enable SSH support for remote access
EXTRA_IMAGE_FEATURES:append = " ssh-server-openssh"
