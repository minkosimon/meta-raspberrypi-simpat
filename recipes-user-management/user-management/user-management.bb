SUMMARY = "User management application for Raspberry Pi OS"
DESCRIPTION = "Gestion centralisée des utilisateurs et groupes via JSON"
LICENSE = "CLOSED"

inherit users-management

SRC_URI = "file://users-groups-management.json"

S = "${WORKDIR}"

# Configuration JSON
USER_JSON_FILE = "${THISDIR}/files/users-groups-management.json"

# Fichiers à packager
FILES:${PN} = "/home"

# Runtime dependencies
RDEPENDS:${PN} = "openssh"

# Assurer que les utilisateurs sont créés
USERADD_PACKAGES = "${PN}"
GROUPADD_PACKAGES = "${PN}"