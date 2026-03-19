SUMMARY = "SIMPAT Raspberry Pi TFTP/NFS netboot image"
DESCRIPTION = "TFTP boot image with NFS rootfs for complete network boot"
LICENSE = "MIT"

require recipes-core/images/core-image-minimal.bb

# Enable TFTP and NFS deployment
inherit tftp-deploy

TFTP_BOOT_FOLDER := "/tmp/srv/tftp"
FOLDER_NFS_SERVER := "/tmp/srv/nfsroot"

# NFS server IP address
IP_SERVER_NFS ?= "192.168.1.100"

# Enable network boot from NFS
BOOT_ROOTFS_OVER_NFS = "1"

# Image type configuration - create tar archive for NFS extraction
IMAGE_FSTYPES = "tar.bz2"

# Core packages for network boot
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

# Allow SSH access for remote management
EXTRA_IMAGE_FEATURES:append = " ssh-server-openssh"
