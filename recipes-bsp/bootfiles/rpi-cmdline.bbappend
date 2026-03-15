FILESEXTRAPATHS:prepend := "${THISDIR}/files:"

# Global parameter
BOOT_ROOTFS_OVER_NFS ?= "0"

# Default SERVER nfs
IP_SERVER_NFS ?= ""

# Default FOLDER nfs
FOLDER_NFS_SERVER ?= ""

# if BOOT_ROOTFS_OVER_NFS is set , adapt the command line

def setup_boot_over_ethernet(d):
    """
    Vérifie BOOT_ROOTFS_OVER_NFS et configure le boot NFS si nécessaire.
    Si BOOT_ROOTFS_OVER_NFS == 1, vérifie que IP_SERVER_NFS et FOLDER_NFS_SERVER 
    ne sont pas null et retourne la nouvelle config CMDLINE_ROOTFS pour NFS boot.
    Sinon, retourne la config par défaut.
    """
    BOOT_ROOTFS_OVER_NFS = d.getVar('BOOT_ROOTFS_OVER_NFS')
    
    if BOOT_ROOTFS_OVER_NFS == "1":
        bb.note("cmdline : over Ethernet")
        ip_server_nfs = d.getVar('IP_SERVER_NFS')
        folder_nfs_server = d.getVar('FOLDER_NFS_SERVER')
        
        # Vérifier que les variables NFS ne sont pas vides
        if ip_server_nfs == "":
            bb.fatal("cmdline : IP_SERVER_NFS is not set")
            
        
        if folder_nfs_server == "":
            bb.fatal("cmdline : FOLDER_NFS_SERVER is not set")
            

        # Retourner la config NFS boot
        nfs_root = "root=/dev/nfs nfsroot=" + ip_server_nfs + ":" + folder_nfs_server + " rw ip=dhcp"
        bb.note("cmdline nfs_root: " + nfs_root)
        return nfs_root
    
    # Retourner la config par défaut (SD card boot)
    return "root=/dev/mmcblk0p2 rootfstype=ext4 rootwait"
    
CMDLINE_ROOTFS = "${@setup_boot_over_ethernet(d)}"

