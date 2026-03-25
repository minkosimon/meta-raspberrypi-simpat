# Example recipe showing how to use the network-config class
# This demonstrates how to integrate network configuration into a core-image

SUMMARY = "Network-configured core image"
DESCRIPTION = "Core image with automatic systemd-networkd configuration generation"

require recipes-core/images/core-image-minimal.bb

# ============================================================================
# Inherit network configuration support
# ============================================================================
inherit network-config

# ============================================================================
# Additional packages for networking
# ============================================================================
IMAGE_INSTALL:append = " \
    iproute2 \
    iputils-ping \
"

# ============================================================================
# Per-Machine Network Configuration
# ============================================================================
NETWORK_CONFIG_JSON:raspberrypi5 = "network-${MACHINE}.json"
#NETWORK_CONFIG_JSON:board-b = "network-board-b.json"
#NETWORK_CONFIG_JSON:board-c = "network-board-c.json"
#NETWORK_CONFIG_JSON ?= "network-board-a.json"

# Ensure network files are in final image
do_install:append() {
    if [ -d "${NETWORKD_CONFIG_DIR}" ]; then
        install -d ${D}${systemd_system_unitdir}/network
        install -m 0644 ${NETWORKD_CONFIG_DIR}/* ${D}${systemd_system_unitdir}/network/ 2>/dev/null || true
    fi
}
