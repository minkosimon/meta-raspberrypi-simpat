SUMMARY = "Freenove dashboard TLS certificate bundle"
DESCRIPTION = "Generates a self-signed TLS certificate at build time for the Freenove dashboard and installs the dashboard TLS environment file."
LICENSE = "CLOSED"

DEPENDS += "openssl-native"

FNK_TLS_COMMON_NAME ?= "raspberrypi5"
FNK_TLS_SUBJECT_ALT_NAME ?= "DNS:localhost,IP:127.0.0.1,DNS:${FNK_TLS_COMMON_NAME}"
FNK_TLS_ALLOWED_ORIGINS ?= "https://localhost:8080,https://127.0.0.1:8080,https://${FNK_TLS_COMMON_NAME}:8080"

do_install() {
    install -d ${D}${sysconfdir}/default
    install -d ${D}${sysconfdir}/ssl/freenove

    chmod 700 ${D}${sysconfdir}/ssl/freenove

    ${STAGING_BINDIR_NATIVE}/openssl req -x509 -newkey rsa:2048 -sha256 -days 3650 -nodes \
        -keyout ${D}${sysconfdir}/ssl/freenove/freenove-dashboard.key \
        -out ${D}${sysconfdir}/ssl/freenove/freenove-dashboard.crt \
        -subj "/CN=${FNK_TLS_COMMON_NAME}" \
        -addext "subjectAltName=${FNK_TLS_SUBJECT_ALT_NAME}"

    chmod 600 ${D}${sysconfdir}/ssl/freenove/freenove-dashboard.key
    chmod 644 ${D}${sysconfdir}/ssl/freenove/freenove-dashboard.crt

    cat > ${D}${sysconfdir}/default/freenove-dashboard-tls <<EOF
FNK_WS_TLS=1
FNK_WS_TLS_CERT=/etc/ssl/freenove/freenove-dashboard.crt
FNK_WS_TLS_KEY=/etc/ssl/freenove/freenove-dashboard.key
FNK_WS_ALLOWED_ORIGINS=${FNK_TLS_ALLOWED_ORIGINS}
EOF

    chmod 600 ${D}${sysconfdir}/default/freenove-dashboard-tls
}

FILES:${PN} += " \
    ${sysconfdir}/default/freenove-dashboard-tls \
    ${sysconfdir}/ssl/freenove \
"