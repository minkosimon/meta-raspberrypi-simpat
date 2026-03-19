# Build a Raspberry Pi SD card image that only contains boot files.
# The kernel/rootfs command line is configured for NFS by the existing
# rpi-cmdline.bbappend in this layer.

inherit simpat-image-sdcard

WKS_FILE ?= "sdcard-nfs.wks.in"


# NFS roottfs fodler
IP_SERVER_NFS ?= "192.168.10.20"

# NFS folder on the server to export for the rootfs, this is used in the nfsroot configuration of the kernel cmdline
FOLDER_NFS_SERVER ?= "/srv/nfsroot"

BOOT_ROOTFS_OVER_NFS := "1"

# Keep a rootfs archive artifact that can be exported over NFS.
IMAGE_FSTYPES += " tar.gz"