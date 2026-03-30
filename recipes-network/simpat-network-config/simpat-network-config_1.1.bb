# Network Configuration Package
# This recipe generates systemd-networkd configuration files from JSON templates

LICENSE = "MIT"
SUMMARY = "Network configuration for systemd-networkd"
DESCRIPTION = "Generates systemd-networkd configuration files from JSON templates"

# Package version
PV = "1.0"

# Use the common MIT license from poky
LIC_FILES_CHKSUM = "file://${COMMON_LICENSE_DIR}/MIT;md5=0835ade698e0bcf8506ecda2f7b4f302"

# Source files: templates and configuration
SRC_URI = " \
    file://templates/network.j2 \
    file://templates/netdev.j2 \
    file://templates/link.j2 \
    file://network-${MACHINE}.json \
"

# ============================================================================
# Network Configuration Selection
# ============================================================================
NETWORK_CONFIG_JSON:raspberrypi5 = "network-${MACHINE}.json"

# ============================================================================
# Inherit network configuration support
# ============================================================================
inherit network-config

# ============================================================================
# Package Dependencies
# ============================================================================
RDEPENDS:${PN} += "systemd"

# ============================================================================
# Package Definition
# ============================================================================
FILES:${PN} = "${sysconfdir}/systemd/network/*"
