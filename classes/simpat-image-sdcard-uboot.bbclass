# DEPRECATED: This class is no longer needed.
#
# U-Boot support is now automatically handled by simpat-image-sdcard.bbclass
# based on DISTRO_FEATURES detection. Simply add "uboot" to DISTRO_FEATURES
# in your local.conf to enable U-Boot boot mode for ALL image types.
#
# The base class now:
# - Detects if "uboot" is in DISTRO_FEATURES
# - Automatically selects the correct WKS file (with or without U-Boot partition)
# - Adds virtual/bootloader to dependencies when needed
# - Updates kernel cmdline for correct rootfs partition
#
# Migration: Remove any explicit inheritance of this class.
