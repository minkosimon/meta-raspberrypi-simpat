# Base class for image type management
# Handles different image type configurations:
#   - rootfs: Standard SD card with local ext4 rootfs partition
#   - ramfs: SD card with bundled initramfs (boot+kernel+initramfs only)
#   - nfs: SD card with NFS boot (boot files only, rootfs over network)
#
# This class manages type-specific configurations like rootfs filesystem type,
# kernel bundling, and command-line parameters.

inherit image-support

# ============================================================================
# WKS File Search Path Configuration
# ============================================================================
# Configure BitBake to search for .wks files in the wic/ subdirectory of this layer
# This allows a fully-qualified search path for wic kickstart files
WKS_FILE_SEARCH_PATH:prepend = "${LAYERDIR}/wic:"

# ============================================================================
# Image Type Configuration Variables
# ============================================================================
# Define the image type (rootfs, ramfs, nfs)
SUPPORT_IMG_TYPE ?= "rootfs"

# ============================================================================
# Type-specific Rootfs Configuration
# ============================================================================
# Type: rootfs - Standard SD card with local ext4 rootfs
# Type: ramfs  - Bundled initramfs (no persistent rootfs)
# Type: nfs    - NFS boot (no local rootfs)

# Rootfs filesystem type for non-ramfs/nfs images
SUPPORT_IMG_ROOTFS_FSTYPE ?= "ext4"

# Keep rootfs artifacts
IMAGE_FSTYPES:append = " tar.gz"

# ============================================================================
# Type-specific Configuration (consolidated)
# ============================================================================
# Unified configuration for all image types (rootfs, ramfs, nfs)
# Handles RAMFS bundling, NFS configuration, WKS file selection, and cmdline

python __anonymous() {
    import os
    
    img_type = d.getVar('SUPPORT_IMG_TYPE')
    layerdir = d.getVar('LAYERDIR')
    
    # ===== ROOTFS Configuration =====
    if img_type == "rootfs":
        bb.plain("[type img] : update ROOTFS image type")
        wks_filename = "sdcard-rootfs.wks.in"
        d.setVar('CMDLINE_ROOTFS', '/dev/mmcblk0p2 rw rootwait')
    
    # ===== RAMFS Configuration =====
    elif img_type == "ramfs":
        bb.plain("[type img] : RAMFS image type")
        
        # Set default initramfs image if not already set
        initramfs_image = d.getVar('INITRAMFS_IMAGE')
        if not initramfs_image or len(initramfs_image.strip()) == 0:
            d.setVar('INITRAMFS_IMAGE', 'core-image-minimal-initramfs')
            bb.plain(f"INITRAMFS_IMAGE set to: core-image-minimal-initramfs")
        
        # Bundle kernel with initramfs
        d.setVar('INITRAMFS_IMAGE_BUNDLE', '1')
        bb.debug(1, "INITRAMFS_IMAGE_BUNDLE enabled for bundled kernel")
        
        # Bundled kernel+initramfs is larger than plain kernel
        d.setVar('SUPPORT_WIC_BOOT_PARTITION_SIZE', '128')
        
        # No persistent rootfs on cmdline for ramfs boot
        d.setVar('CMDLINE_ROOTFS', '')
        bb.plain("[type img] : RAMFS configuration complete")
        
        wks_filename = "sdcard-ramfs.wks.in"
    
    # ===== NFS Configuration =====
    elif img_type == "nfs":
        bb.plain("[type img] : update NFS image type")
        wks_filename = "sdcard-nfs.wks.in"
        
        # NFS server configuration
        ip_server = d.getVar('IP_SERVER_NFS') or "192.168.10.20"
        folder_nfs = d.getVar('FOLDER_NFS_SERVER') or "/srv/nfsroot"
        d.setVar('CMDLINE_ROOTFS', f'/dev/nfs nfsroot={ip_server}:{folder_nfs} rw')
        bb.plain(f"[type img] : NFS server: {ip_server}, folder: {folder_nfs}")
    
    else:
        bb.fatal(f"Unknown SUPPORT_IMG_TYPE: {img_type}")
    
    # ===== Common: Set WKS_FILE with fully qualified path =====
    if wks_filename and layerdir:
        wks_path = os.path.join(layerdir, "wic", wks_filename)
        if os.path.exists(wks_path):
            d.setVar('WKS_FILE', wks_path)
            bb.plain(f"WKS_FILE set to: {wks_path}")
        else:
            bb.warn(f"WKS file not found at: {wks_path}")
}

# ============================================================================
# Type-specific IMAGE_BOOT_FILES Configuration
# ============================================================================

python image_boot_files_config() {
    import os
    
    img_type = d.getVar('SUPPORT_IMG_TYPE')
    has_uboot = d.getVar('RPI_USE_U_BOOT') == "1"
    
    # Build boot files based on image type and bootloader
    bootfiles_dir = d.getVar('BOOTFILES_DIR_NAME') or "bootfiles"
    dtb_files = d.getVar('make_dtb_boot_files(d)')
    
    boot_files = []
    
    # Common boot files
    boot_files.append(f'{bootfiles_dir}/*')
    if dtb_files:
        boot_files.append(dtb_files)
    
    # Add U-Boot or kernel configuration
    if has_uboot:
        boot_files.append('u-boot.bin;${SDIMG_KERNELIMAGE} boot.scr')
        if img_type == "ramfs":
            boot_files.append('${KERNEL_IMAGETYPE}-${INITRAMFS_LINK_NAME}.bin;${KERNEL_IMAGETYPE}')
        else:
            boot_files.append('${KERNEL_IMAGETYPE}')
    else:
        # EEPROM bootloader
        if img_type == "ramfs":
            boot_files.append('${KERNEL_IMAGETYPE}-${INITRAMFS_LINK_NAME}.bin;${KERNEL_IMAGETYPE}')
        else:
            boot_files.append('${KERNEL_IMAGETYPE}')
    
    boot_files_str = ' '.join(boot_files)
    d.setVar('IMAGE_BOOT_FILES', boot_files_str)
    bb.plain(f"image type: {img_type}")
}

addhandler image_boot_files_config
image_boot_files_config[eventmask] = "bb.event.RecipePreFinalise"
