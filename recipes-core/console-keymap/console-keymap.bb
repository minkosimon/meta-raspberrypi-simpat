SUMMARY = "Configure console keyboard layout to French AZERTY"
LICENSE = "MIT"
LIC_FILES_CHKSUM = "file://${COMMON_LICENSE_DIR}/MIT;md5=0835ade698e0bcf8506ecda2f7b4f302"

SRC_URI = "file://vconsole.conf"

S = "${WORKDIR}"

RDEPENDS:${PN} = "kbd keymaps"

do_install() {
    install -d ${D}${sysconfdir}
    install -m 0644 ${WORKDIR}/vconsole.conf ${D}${sysconfdir}/vconsole.conf
}

FILES:${PN} = "${sysconfdir}/vconsole.conf"
