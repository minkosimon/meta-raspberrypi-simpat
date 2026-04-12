SUMMARY = "Dummy character device module for Raspberry Pi"
LICENSE = "CLOSED"

inherit module
SRC_URI = "file://dummy-driver-char.c file://Makefile"
S = "${WORKDIR}"


