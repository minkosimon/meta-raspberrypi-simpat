SUMMARY = "Network configuration management for systemd-networkd"
DESCRIPTION = "Generates systemd-networkd configuration from JSON templates with validation"
AUTHOR = "Your Organization"
LICENSE = "MIT"

# Use the common MIT license from poky
LIC_FILES_CHKSUM = "file://${COMMON_LICENSE_DIR}/MIT;md5=0835ade698e0bcf8506ecda2f7b4f302"

SRC_URI = " \
    file://schema.json \
    file://templates/network.j2 \
    file://templates/netdev.j2 \
    file://templates/link.j2 \
    file://configs/network-board-a.json \
    file://configs/network-board-b.json \
    file://configs/network-board-c.json \
    file://configs/network-advanced.json \
"

# Inherit the network-config class
inherit network-config

PACKAGE_ARCH = "${MACHINE_ARCH}"

# ============================================================================
# Per-Machine Configuration Selection (optional)
# ============================================================================
# These can be overridden by recipes that inherit this
NETWORK_CONFIG_JSON ?= ""

# ============================================================================
# Runtime Dependencies (optional - only if systemd is available)
# ============================================================================
DEPENDS:append = " ${@oe.utils.conditional('DISTRO_FEATURES', 'systemd', 'python3-jsonschema python3-jinja2', '', d)}"
RDEPENDS:${PN}:append = " ${@oe.utils.conditional('DISTRO_FEATURES', 'systemd', 'systemd', '', d)}"

# ============================================================================
# Packaging
# ============================================================================
# Only package network configs if NETWORK_CONFIG_JSON is set
FILES:${PN} = "${@'${systemd_system_unitdir}/network/*' if d.getVar('NETWORK_CONFIG_JSON') else ''}"

# Configuration files are not user-editable (auto-generated)
CONFFILES:${PN} = ""

# ============================================================================
# Metadata
# ============================================================================
COMPATIBLE_MACHINE = ".*"

do_configure[noexec] = "1"
do_compile[noexec] = "1"
