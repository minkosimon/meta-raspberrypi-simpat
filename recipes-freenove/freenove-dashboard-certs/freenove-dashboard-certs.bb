SUMMARY = "Freenove dashboard TLS certificate bootstrap"
DESCRIPTION = "Generates a self-signed TLS certificate for the Freenove dashboard on first boot and writes the dashboard TLS environment file."
LICENSE = "CLOSED"

SRC_URI = " \
    file://freenove-dashboard-certgen \
    file://freenove-dashboard-certgen.service \
"

inherit systemd

RDEPENDS:${PN} = " \
    bash \
    openssl \
"

do_install() {
    install -d ${D}${sbindir}
    install -m 0755 ${WORKDIR}/freenove-dashboard-certgen ${D}${sbindir}/freenove-dashboard-certgen

    install -d ${D}${systemd_system_unitdir}
    install -m 0644 ${WORKDIR}/freenove-dashboard-certgen.service ${D}${systemd_system_unitdir}/

    install -d ${D}${sysconfdir}/default
    install -d ${D}${sysconfdir}/ssl/freenove
}

SYSTEMD_SERVICE:${PN} = "freenove-dashboard-certgen.service"
SYSTEMD_AUTO_ENABLE = "enable"

FILES:${PN} += " \
    ${sbindir}/freenove-dashboard-certgen \
    ${systemd_system_unitdir}/freenove-dashboard-certgen.service \
    ${sysconfdir}/default \
    ${sysconfdir}/ssl/freenove \
"