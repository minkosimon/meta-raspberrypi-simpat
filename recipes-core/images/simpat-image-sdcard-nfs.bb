SUMMARY = "SIMPAT Raspberry Pi SD card boot image for NFS rootfs"
LICENSE = "MIT"

require recipes-core/images/core-image-minimal.bb

inherit image-support

# Configure for sdcard boot with rootfs in RAM
SUPPORT_BOOT := "sdcard"
SUPPORT_IMG_TYPE = "nfs"

# NFS server configuration
IP_SERVER_NFS = "192.168.1.100"
FOLDER_NFS_SERVER = "/tmp/nfs/rootfs"

# set WKS 
WKS_FILE = "sdcard-nfs.wks.in"

# Keep a rootfs archive artifact that can be exported over NFS
IMAGE_FSTYPES:append = " tar.gz wic.bz2"
