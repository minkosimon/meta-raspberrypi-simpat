SUMMARY = "SIMPAT Raspberry Pi TFTP/NFS netboot image"
DESCRIPTION = "TFTP boot image with NFS rootfs for complete network boot"
LICENSE = "MIT"

require recipes-core/images/core-image-minimal.bb

# Image format for network deployment (TAR for extraction to NFS)
IMAGE_FSTYPES = "tar.bz2"

# ============================================================================
# TFTP/NFS Network Boot Configuration
# ============================================================================
# Define deployment type: tftp = network boot instead of SD card
SUPPORT_BOOT = "tftp"

# Define image type: nfs = rootfs over NFS instead of local SD card
SUPPORT_IMG_TYPE = "nfs"

# Enable both image-support (for TFTP deployment) and support-img-type (for boot config)
inherit image-support

# TFTP/NFS deployment paths
TFTP_BOOT_FOLDER = "/home/patrick/SERVEUR/tftp-boot"
FOLDER_NFS_SERVER = "/home/patrick/SERVEUR/nfsroot"
IP_SERVER_NFS = "192.168.10.20"

# ==============================================
# 
# 
# 
# 
# 
# 
# 
# 
# 
# ==============================
# Force NFS boot parameters in kernel command line
# ============================================================================
# Override rpi-cmdline.bbappend to ensure NFS boot parameters are used
# Added: ip_auto_config timeout and nfsaddrs for better network stability
CMDLINE_ROOTFS = "root=/dev/nfs nfsroot=${IP_SERVER_NFS}:${FOLDER_NFS_SERVER},vers=3,nolock rw ip=dhcp ip_auto_config_timeout=30"

# ============================================================================
# Network Boot Packages
# ============================================================================
IMAGE_INSTALL:append = " \
    kernel-modules \
    udev \
    base-files \
    base-passwd \
    netbase \
    bash \
    openssh \
    openssh-sftp-server \
    linux-firmware-rpidistro-bcm43455 \
    bluez-firmware-rpidistro-bcm4345c0-hcd \
    systemd-nfsboot-config \
    simpat-network-config \
    user-management \
"

# ============================================================================
# Systemd and Network Management
# ============================================================================
DISTRO_FEATURES:append = " systemd"
VIRTUAL-RUNTIME_init_manager = "systemd"
VIRTUAL-RUNTIME_initcalls = ""

# SSH server for remote management
EXTRA_IMAGE_FEATURES:append = " ssh-server-openssh"

