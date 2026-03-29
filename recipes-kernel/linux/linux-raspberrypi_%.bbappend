# Build bundled kernel+initramfs for SD card boot when simpat-image-sdcard-ramfs is used

INITRAMFS_IMAGE = "core-image-minimal-initramfs"
INITRAMFS_IMAGE_BUNDLE = "1"

# Systemd kernel configuration fragments
FILESEXTRAPATHS:prepend := "${THISDIR}/files:"
SRC_URI += "file://systemd.cfg"

# Ensure kernel Image is deployed for WIC image creation
do_deploy:append() {
    # Copy kernel Image to deploy directory
    if [ -f "${B}/arch/${ARCH}/boot/Image" ]; then
        install -m 0644 "${B}/arch/${ARCH}/boot/Image" "${DEPLOYDIR}/Image"
        # Create kernel8.img symlink for Raspberry Pi
        ln -sf Image "${DEPLOYDIR}/kernel8.img" || true
    fi
}
