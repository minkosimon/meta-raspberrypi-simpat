SUMMARY = "Custom package group for network feature"
DESCRIPTION = "Networking utilities and services"
LICENSE = "MIT"

inherit packagegroup

RDEPENDS:${PN} = " \
busybox \
dropbear \
curl \
wget \
"