SUMMARY = "Systemd configuration overrides for NFS boot"
DESCRIPTION = "Masks systemd units and generators incompatible with NFS rootfs boot"
LICENSE = "MIT"

S = "${WORKDIR}"

# Serial console device for Raspberry Pi 5
SERIAL_CONSOLES_TTY ?= "ttyAMA0"

do_install() {
    # =========================================================================
    # 1. Mask systemd-gpt-auto-generator (no GPT partition table on NFS)
    # =========================================================================
    install -d ${D}${sysconfdir}/systemd/system-generators
    ln -sf /dev/null ${D}${sysconfdir}/systemd/system-generators/systemd-gpt-auto-generator

    # =========================================================================
    # 2. Mask mount units that fail on NFS rootfs
    # =========================================================================
    install -d ${D}${sysconfdir}/systemd/system
    ln -sf /dev/null ${D}${sysconfdir}/systemd/system/dev-mqueue.mount
    ln -sf /dev/null ${D}${sysconfdir}/systemd/system/sys-kernel-debug.mount
    ln -sf /dev/null ${D}${sysconfdir}/systemd/system/sys-kernel-tracing.mount
    ln -sf /dev/null ${D}${sysconfdir}/systemd/system/sys-fs-fuse-connections.mount
    ln -sf /dev/null ${D}${sysconfdir}/systemd/system/sys-kernel-config.mount
    ln -sf /dev/null ${D}${sysconfdir}/systemd/system/tmp.mount

    # =========================================================================
    # 3. Mask services not needed for NFS root
    # =========================================================================
    ln -sf /dev/null ${D}${sysconfdir}/systemd/system/systemd-remount-fs.service
    ln -sf /dev/null ${D}${sysconfdir}/systemd/system/systemd-fsck-root.service

    # =========================================================================
    # 4. Override local-fs.target: disable OnFailure=emergency.target
    #    (prevents maintenance mode when local mount units are masked)
    # =========================================================================
    install -d ${D}${sysconfdir}/systemd/system/local-fs.target.d
    echo '[Unit]'                     > ${D}${sysconfdir}/systemd/system/local-fs.target.d/override.conf
    echo 'OnFailure='                >> ${D}${sysconfdir}/systemd/system/local-fs.target.d/override.conf

    # =========================================================================
    # 5. Enable serial-getty on correct RPi5 serial port (ttyAMA0)
    # =========================================================================
    install -d ${D}${sysconfdir}/systemd/system/getty.target.wants
    ln -sf ${systemd_system_unitdir}/serial-getty@.service \
        ${D}${sysconfdir}/systemd/system/getty.target.wants/serial-getty@${SERIAL_CONSOLES_TTY}.service
}

FILES:${PN} += " \
    ${sysconfdir}/systemd/system-generators \
    ${sysconfdir}/systemd/system \
"

RDEPENDS:${PN} += "systemd"
