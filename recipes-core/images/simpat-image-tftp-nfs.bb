SUMMARY = "SIMPAT Raspberry Pi TFTP/NFS netboot image"
DESCRIPTION = "TFTP boot image with NFS rootfs for complete network boot"
LICENSE = "MIT"

# Image format for network deployment
IMAGE_FSTYPES = "tar.bz2"



require recipes-core/images/core-image-minimal.bb

#  Configure for TFTP boot with NFS rootfs
SUPPORT_BOOT := "tftp"
SUPPORT_IMG_TYPE := "nfs"

# Enable TFTP and NFS deployment
inherit image-support

# TFTP/NFS deployment configuration
TFTP_BOOT_FOLDER ?= "/tmp/srv/tftp"
FOLDER_NFS_SERVER ?= "/tmp/srv/nfsroot"

# NFS server configuration
IP_SERVER_NFS ?= "192.168.1.100"

# Image format for network deployment
IMAGE_FSTYPES = "tar.bz2"

# Network boot packages
IMAGE_INSTALL:append = " \
    kernel-modules \
    udev \
    base-files \
    base-passwd \
    netbase \
    openssh \
    openssh-sftp-server \
"

# Enable systemd for network management
DISTRO_FEATURES:append = " systemd"
VIRTUAL-RUNTIME_init_manager = "systemd"
VIRTUAL-RUNTIME_initcalls = ""

# SSH server for remote management
EXTRA_IMAGE_FEATURES:append = " ssh-server-openssh"
