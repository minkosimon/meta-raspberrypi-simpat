SUMMARY = "TFTP/NFS boot files deployment"
DESCRIPTION = "BitBake recipe to deploy kernel, device tree, and rootfs files to TFTP and NFS directories"
LICENSE = "MIT"
LIC_FILES_CHKSUM = "file://${COREBASE}/meta/files/common-licenses/MIT;md5=0835ade40feb269b3b3356cb008cb11d"

inherit tftp-deploy

# Recipe dependencies
DEPENDS = "virtual/kernel"
RDEPENDS:${PN} = "virtual/kernel"

# This is a virtual recipe that triggers deployment
PROVIDES = "tftp-deploy"

# Don't create actual packages, just perform the deployment task
do_package[noexec] = "1"
do_packagedata[noexec] = "1"
do_package_write_rpm[noexec] = "1"
do_package_write_ipk[noexec] = "1"
do_package_write_deb[noexec] = "1"

# Configuration variables that can be set in local.conf
# TFTP_BOOT_FOLDER ?= "/srv/tftp"
# FOLDER_NFS_SERVER ?= "/srv/nfsroot"
