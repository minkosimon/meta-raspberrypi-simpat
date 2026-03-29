SUMMARY = "Customize /etc/fstab for NFS root filesystem"

# Override the default fstab with NFS-aware configuration
FILESEXTRAPATHS:prepend := "${THISDIR}/base-files:"

# Add our custom fstab to the sources
SRC_URI:append = " file://fstab"

do_install:append() {
    # Use our custom NFS-optimized fstab
    install -m 0644 ${WORKDIR}/fstab ${D}${sysconfdir}/fstab
}
