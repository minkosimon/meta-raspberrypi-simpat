FILESEXTRAPATHS:prepend := "${THISDIR}/files:"

SRC_URI += " \
    file://chrony.conf \
    file://chrony-status.sh \
    file://chrony-status.service \
    file://chrony-status.timer \
"

do_install:append() {
    install -m 0644 ${WORKDIR}/chrony.conf ${D}${sysconfdir}/chrony.conf

    install -d ${D}${bindir}
    install -m 0755 ${WORKDIR}/chrony-status.sh ${D}${bindir}/chrony-status

    install -d ${D}${systemd_system_unitdir}
    install -m 0644 ${WORKDIR}/chrony-status.service ${D}${systemd_system_unitdir}/chrony-status.service
    install -m 0644 ${WORKDIR}/chrony-status.timer ${D}${systemd_system_unitdir}/chrony-status.timer
}

SYSTEMD_SERVICE:${PN} += " chrony-status.timer"
SYSTEMD_AUTO_ENABLE = "enable"

FILES:${PN} += " \
    ${bindir}/chrony-status \
    ${systemd_system_unitdir}/chrony-status.service \
    ${systemd_system_unitdir}/chrony-status.timer \
"