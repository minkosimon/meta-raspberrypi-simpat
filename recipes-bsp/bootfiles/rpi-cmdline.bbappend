FILESEXTRAPATHS:prepend := "${THISDIR}/files:"

# Global parameter
BOOT_ROOTFS_OVER_NFS ?= "0"

# Default SERVER nfs
IP_SERVER_NFS ?= ""

# Default FOLDER nfs
FOLDER_NFS_SERVER ?= ""

# if BOOT_ROOTFS_OVER_NFS is set , adapt the command line
# if RPI_USE_U_BOOT or "uboot" in DISTRO_FEATURES, handle U-Boot specific boot configuration

def setup_boot_over_ethernet(d):
    """
    Configure kernel command line based on boot mode.
    Supports NFS boot, U-Boot boot, and EEPROM boot.
    
    Priority: NFS > U-Boot > EEPROM
    """
    BOOT_ROOTFS_OVER_NFS = d.getVar('BOOT_ROOTFS_OVER_NFS')
    rpi_use_uboot = d.getVar('RPI_USE_U_BOOT') or "0"
    distro_features = d.getVar('DISTRO_FEATURES') or ""
    has_uboot = rpi_use_uboot == "1" or "uboot" in distro_features.split()
    
    if BOOT_ROOTFS_OVER_NFS == "1":
        bb.note("cmdline : NFS boot mode")
        ip_server_nfs = d.getVar('IP_SERVER_NFS')
        folder_nfs_server = d.getVar('FOLDER_NFS_SERVER')
        
        # Verify NFS configuration is complete
        if ip_server_nfs == "":
            bb.fatal("cmdline : IP_SERVER_NFS is not set")
        
        if folder_nfs_server == "":
            bb.fatal("cmdline : FOLDER_NFS_SERVER is not set")
        
        # Return NFS boot configuration
        nfs_root = "root=/dev/nfs nfsroot=" + ip_server_nfs + ":" + folder_nfs_server + " rw ip=dhcp"
        bb.note("cmdline nfs_root: " + nfs_root)
        return nfs_root
    
    # If U-Boot is enabled, use partition 3 for rootfs
    if has_uboot:
        bb.note("cmdline : U-Boot boot mode (partition 3)")
        return "root=/dev/mmcblk0p3 rootfstype=ext4 rootwait"
    
    # Default: EEPROM boot with rootfs on partition 2
    bb.note("cmdline : EEPROM boot mode (partition 2)")
    return "root=/dev/mmcblk0p2 rootfstype=ext4 rootwait"

CMDLINE_ROOTFS = "${@setup_boot_over_ethernet(d)}"

