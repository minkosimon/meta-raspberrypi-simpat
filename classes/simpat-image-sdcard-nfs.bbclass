# Build a Raspberry Pi SD card image that only contains boot files.
# The kernel/rootfs command line is configured for NFS boot.
# Bootloader (U-Boot or EEPROM) is selected automatically via DISTRO_FEATURES.

inherit simpat-image-sdcard

# Configure for NFS boot
SIMPAT_ROOTFS_TYPE = "nfs"
WKS_FILE ?= "sdcard-nfs.wks.in"
BOOT_ROOTFS_OVER_NFS := "1"

# NFS server configuration
IP_SERVER_NFS ?= "192.168.10.20"
FOLDER_NFS_SERVER ?= "/srv/nfsroot"

# Keep a rootfs archive artifact that can be exported over NFS
IMAGE_FSTYPES += " tar.gz"