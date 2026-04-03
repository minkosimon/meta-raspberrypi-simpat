SUMMARY = "Hello World Kernel Module for Raspberry Pi"
LICENSE = "CLOSED"

inherit module
SRC_URI = "file://helloworld.c file://Makefile"

S = "${WORKDIR}"

# add compiler flags for conditional compilation
EXTRA_OEMAKE += "ccflags-y=-DWITH_DYN_ALLOC_MODULE"
