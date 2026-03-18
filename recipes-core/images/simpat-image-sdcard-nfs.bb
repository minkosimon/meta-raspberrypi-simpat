SUMMARY = "SIMPAT Raspberry Pi SD card boot image for NFS rootfs"
LICENSE = "MIT"

require recipes-core/images/core-image-minimal.bb

inherit simpat-image-sdcard-nfs

# Enable Yocto image to boot from NFS
BOOT_ROOTFS_OVER_NFS = "1"

# Set the IP address of the NFS server
IP_SERVER_NFS ?= "192.168.1.100"

# Set the folder on the NFS server where the root filesystem is located
FOLDER_NFS_SERVER ?= "/nfs/rootfs"
