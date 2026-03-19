SUMMARY = "SIMPAT Raspberry Pi TFTP boot image with RAMFS rootfs"
DESCRIPTION = "TFTP netboot image with initramfs loaded entirely in RAM"
LICENSE = "MIT"

require recipes-core/images/core-image-minimal.bb

# Enable TFTP boot file deployment (auto-detects RAMFS via INITRAMFS_IMAGE)
inherit tftp-deploy

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
    dhcp \
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
