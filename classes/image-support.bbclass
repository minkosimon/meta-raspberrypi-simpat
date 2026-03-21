# Base class for image support management
# Intelligently handles image deployment for:
#   - SD Card / eMMC (via WIC images) - when IMAGE_FSTYPES includes "wic"
#   - TFTP/NFS network boot - when IMAGE_FSTYPES is tar.bz2 or cpio.gz
#
# This class automatically detects the deployment type and configures
# WIC generation, TFTP deployment, and boot files accordingly.

inherit deploy

# ============================================================================
# Auto-Detection: Configure based on deployment type (SD Card vs TFTP)
# ============================================================================
python __anonymous() {
    import os
    
    fstypes = (d.getVar('IMAGE_FSTYPES') or "").split()
    support_boot = d.getVar('SUPPORT_BOOT') or ""
    
    
    # Detect if this is a TFTP/network deployment
    if support_boot == "tftp":
        bb.debug(1, "Auto-detected: TFTP deployment mode")

    else:
        bb.debug(1, "Auto-detected: SD Card deployment mode (WIC)")
        # Ensure WIC is added for SD Card images
        if 'wic' not in fstypes:
            current = d.getVar('IMAGE_FSTYPES:append') or ""
            if not current:
                d.setVar('IMAGE_FSTYPES:append', " wic wic.bmap")
}

# ============================================================================
# Support Media Configuration
# ============================================================================
# Supported media types: sdcard, emmc, ethernet
IMAGE_SUPPORT_MEDIA ?= "sdcard"

# ============================================================================
# WIC Configuration (for sdcard/emmc) - only applies if not TFTP
# ============================================================================
# Note: WIC is conditionally added via __anonymous() function above
# to avoid adding it for TFTP-only deployments

# Base WIC dependencies (U-Boot deps are handled by meta-raspberrypi)
WKS_FILE_DEPENDS += " \
    virtual/kernel \
    rpi-bootfiles \
"

# Common WIC settings for partitioning
SUPPORT_WIC_DISK_DEV ?= "mmcblk0"
SUPPORT_WIC_PARTITION_ALIGN ?= "4096"

SUPPORT_WIC_BOOT_PARTITION_LABEL ?= "boot"
SUPPORT_WIC_BOOT_PARTITION_SIZE ?= "64"

SUPPORT_WIC_ROOTFS_PARTITION_LABEL ?= "root"
SUPPORT_WIC_ROOTFS_PARTITION_FSTYPE ?= "ext4"

SUPPORT_WIC_EXTRA_ARGS ?= ""
WIC_CREATE_EXTRA_ARGS += " ${SUPPORT_WIC_EXTRA_ARGS}"

# ============================================================================
# Ethernet Deployment Configuration (TFTP/NFS)
# ============================================================================
TFTP_BOOT_FOLDER ?= "/tmp/srv/tftp"
FOLDER_NFS_SERVER ?= "/tmp/srv/nfsroot"

# ============================================================================
# Bootloader Configuration
# ============================================================================
# Automatically detect U-Boot support from DISTRO_FEATURES
RPI_USE_U_BOOT ?= "${@'1' if 'uboot' in d.getVar('DISTRO_FEATURES').split() else '0'}"

# ============================================================================
# Helper Python Functions
# ============================================================================

# Create DTB boot files from KERNEL_DEVICETREE
def make_dtb_boot_files(d):
    """Generate boot file entries for device tree binaries"""
    dtbs = d.getVar('KERNEL_DEVICETREE') or ""
    if not dtbs:
        return ""
    
    dtb_files = []
    for dtb in dtbs.split():
        # Handle both "bcm2711-rpi-5-b.dtb" and "broadcom/bcm2711-rpi-5-b.dtb"
        filename = dtb.split('/')[-1]
        dtb_files.append(filename)
    
    return ' '.join(dtb_files)

# ============================================================================
# TFTP Deployment Task (conditional - only for TFTP images)
# ============================================================================

# Always run the TFTP deploy task (no stamp file) 
do_tftp_deploy[nostamp] = "1"

# Register task AFTER image generation
addtask do_tftp_deploy after do_image_complete before do_build

python do_tftp_deploy() {
    import os
    import shutil
    import glob
    
    support_boot = d.getVar('SUPPORT_BOOT') or ""
    
    # Only run for TFTP images
    if support_boot != "tftp":
        bb.debug(1, "Skipping TFTP deploy (not a TFTP image)")
        return
    
    bb.plain("[tftp]: Task started for TFTP image ")
    
    tftp_folder = d.getVar('TFTP_BOOT_FOLDER')
    nfs_folder = d.getVar('FOLDER_NFS_SERVER')
    image_boot_files = d.getVar('IMAGE_BOOT_FILES') or ""
    deploy_dir = d.getVar('DEPLOY_DIR_IMAGE')
    distro_features = d.getVar('DISTRO_FEATURES') or ""
    has_uboot = "uboot" in distro_features.split()

    
    if not tftp_folder:
        bb.error("TFTP_BOOT_FOLDER not set")
        return
    
    try:
        os.makedirs(tftp_folder, exist_ok=True)
        bb.note(f"Created TFTP folder: {tftp_folder}")
    except Exception as e:
        bb.error(f"Failed to create TFTP folder: {e}")
    
    # Deploy all boot files from IMAGE_BOOT_FILES to TFTP
    if deploy_dir and os.path.exists(deploy_dir) and image_boot_files:
        try:
            # Parse IMAGE_BOOT_FILES format: "file1 file2 src;dst"
            for boot_file in image_boot_files.split():
                if not boot_file.strip():
                    continue
                
                # Handle source;destination format
                if ';' in boot_file:
                    src_file, dst_file = boot_file.split(';', 1)
                else:
                    src_file = dst_file = boot_file
                
                src_path = os.path.join(deploy_dir, src_file)
                
                # Handle wildcards
                if '*' in src_file:
                    for src_path in glob.glob(src_path):
                        if os.path.exists(src_path):
                            filename = os.path.basename(src_path)
                            dst_path = os.path.join(tftp_folder, filename)
                            shutil.copy2(src_path, dst_path)
                            
                else:
                    if os.path.exists(src_path):
                        dst_path = os.path.join(tftp_folder, dst_file)
                        os.makedirs(os.path.dirname(dst_path), exist_ok=True)
                        shutil.copy2(src_path, dst_path)
                    else:
                        bb.debug(f"Boot file not found: {src_path}")
        except Exception as e:
            bb.error(f"Error deploying boot files: {e}")
            return
    
    # Deploy U-Boot bootloader if present
    if has_uboot and deploy_dir and os.path.exists(deploy_dir):
        try:
            uboot_files = ['u-boot-rpi5.bin', 'u-boot.bin', 'boot.scr']
            for uboot_file in uboot_files:
                src_path = os.path.join(deploy_dir, uboot_file)
                if os.path.exists(src_path):
                    dst_path = os.path.join(tftp_folder, uboot_file)
                    shutil.copy2(src_path, dst_path)
                    
        except Exception as e:
            bb.warn(f"Warning deploying U-Boot files: {e}")
    
    
}

# ============================================================================
# Backward Compatibility Layer
# ============================================================================
# Map old SIMPAT_ variable names to new SUPPORT_ names for legacy recipes

SIMPAT_WIC_DISK_DEV ?= "${SUPPORT_WIC_DISK_DEV}"
SIMPAT_WIC_PARTITION_ALIGN ?= "${SUPPORT_WIC_PARTITION_ALIGN}"
SIMPAT_WIC_BOOT_PARTITION_LABEL ?= "${SUPPORT_WIC_BOOT_PARTITION_LABEL}"
SIMPAT_WIC_BOOT_PARTITION_SIZE ?= "${SUPPORT_WIC_BOOT_PARTITION_SIZE}"
SIMPAT_WIC_ROOTFS_PARTITION_LABEL ?= "${SUPPORT_WIC_ROOTFS_PARTITION_LABEL}"
SIMPAT_WIC_ROOTFS_PARTITION_FSTYPE ?= "${SUPPORT_WIC_ROOTFS_PARTITION_FSTYPE}"
SIMPAT_WIC_EXTRA_ARGS ?= "${SUPPORT_WIC_EXTRA_ARGS}"
