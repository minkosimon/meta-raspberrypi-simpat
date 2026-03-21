# DEPRECATED: This helper class is no longer needed.
#
# The bootloader selection logic is now integrated directly into
# simpat-image-sdcard.bbclass with automatic detection based on DISTRO_FEATURES.
#
# All image classes (simpat-image-sdcard-rootfs, simpat-image-sdcard-nfs,
# simpat-image-sdcard-ramfs) now automatically support:
# - EEPROM boot (default, when "uboot" NOT in DISTRO_FEATURES)
# - U-Boot boot (when "uboot" in DISTRO_FEATURES)
#
# No explicit bootloader class selection is needed anymore.
