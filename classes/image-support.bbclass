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
    
    # Detect if this is a TFTP/network deployment
    # Check if U-Boot is enabled and update IMAGE_BOOT_FILES accordingly
    has_uboot = bb.utils.contains('DISTRO_FEATURES', 'uboot', True, False, d)
    
    if has_uboot:
        bb.debug(1, "U-Boot support detected in DISTRO_FEATURES")
        # Add U-Boot files to IMAGE_BOOT_FILES
        current_boot_files = d.getVar('IMAGE_BOOT_FILES') or ""
        uboot_files = "u-boot.bin u-boot.img u-boot-${MACHINE}.bin"
        if uboot_files not in current_boot_files:
            d.setVar('IMAGE_BOOT_FILES', current_boot_files + " " + uboot_files)
            bb.debug(1, f"Updated IMAGE_BOOT_FILES with U-Boot files: {d.getVar('IMAGE_BOOT_FILES')}")

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

# Ensure kernel is deployed before WIC image creation
do_image_wic[depends] += " \
    virtual/kernel:do_deploy \
    rpi-bootfiles:do_deploy \
    ${@bb.utils.contains('RPI_USE_U_BOOT', '1', 'u-boot:do_deploy', '', d)} \
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
IP_SERVER_NFS ?= ""

# ============================================================================
# cmdline.txt Configuration
# ============================================================================
# Image type: rootfs, tftp, nfs, uboot
SUPPORT_IMG_TYPE ?= "rootfs"

# Boot files directory (relative to DEPLOYDIR)
BOOTFILES_DIR_NAME ?= "bootfiles"

# ============================================================================
# Bootloader Configuration
# ============================================================================
# Automatically detect U-Boot support from DISTRO_FEATURES
RPI_USE_U_BOOT ?= "${@'1' if 'uboot' in d.getVar('DISTRO_FEATURES').split() else '0'}"


# ============================================================================
# cmdline.txt Deployment Task
# ============================================================================

do_deploy_cmdline[nostamp] = "1"
addtask do_deploy_cmdline after do_image_complete before do_build

python do_deploy_cmdline() {
    import os

    cmdline = ""


    # check uboot support from DISTRO_FEATURES
    has_uboot = bb.utils.contains('DISTRO_FEATURES', 'uboot', True, False, d)

    #  SUPPORT_IMG_TYPE can be "rootfs", "nfs" ,"ramfs"
    support_img_type = d.getVar('SUPPORT_IMG_TYPE') or "rootfs"
    
    # Get NFS server variables
    ip_server_nfs = d.getVar('IP_SERVER_NFS') or "192.168.1.100"
    folder_nfs_server = d.getVar('FOLDER_NFS_SERVER') or "/nfs/rootfs"

    # SUPPORT_BOOT can be "sdcard", "emmc", "tftp", "nfs", or "uboot"
    mode_boot = d.getVar('SUPPORT_BOOT') or ""

    # folder where cmdline.txt is saved in tmp/deploy/images/${MACHINE}/bootfiles/
    deploy_dir_image = d.getVar('DEPLOY_DIR_IMAGE')
    bootfiles_dir_name = d.getVar('BOOTFILES_DIR_NAME') or "bootfiles"
    bootfiles_dir = os.path.join(deploy_dir_image, bootfiles_dir_name)

    if has_uboot:
        bb.warning(1, "U-Boot support detected, skipping cmdline.txt deployment (U-Boot handles cmdline)")
        return

    elif mode_boot == "sdcard" and support_img_type == "rootfs":
        cmdline = "console=serial0,115200 console=tty1 root=/dev/mmcblk0p2 rootwait"
        bb.plain("[cmdline] : SD Card mode without U-Boot (rootfs) ")
        bb.debug(1, f"[cmdline] Generated cmdline: {cmdline}")

    elif mode_boot == "sdcard" and support_img_type == "ramfs":
        cmdline = "console=serial0,115200 rdinit=/init"
        bb.plain("[cmdline] : SD Card mode without U-Boot (ramfs) ")
        bb.debug(1, f"[cmdline] Generated cmdline: {cmdline}")
    
    elif mode_boot == "sdcard" and support_img_type == "nfs":
        cmdline = f"console=serial0,115200 console=tty1 root=/dev/nfs nfsroot={ip_server_nfs}:{folder_nfs_server},vers=3 rw ip=dhcp"
        bb.plain("[cmdline] : SD Card mode with NFS rootfs ")
        bb.debug(1, f"[cmdline] Generated cmdline: {cmdline}")

    elif  mode_boot == "emmc" and support_img_type == "rootfs":
        cmdline = "console=serial0,115200 console=tty1 root=/dev/mmcblk1p2 rootwait"
        bb.plain("[cmdline] : eMMC mode without U-Boot (rootfs) ")
        bb.debug(1, f"[cmdline] Generated cmdline: {cmdline}")

    elif mode_boot == "emmc" and support_img_type == "nfs":
        cmdline = f"console=serial0,115200 console=tty1 root=/dev/nfs nfsroot={ip_server_nfs}:{folder_nfs_server},vers=3 rw ip=dhcp"
        bb.plain("[cmdline] : eMMC mode without U-Boot (nfs) ")
        bb.warning(1, f"[cmdline] Generated cmdline: {cmdline} has no effect on uboot ")
    
    elif mode_boot == "emmc" and support_img_type == "ramfs":
        cmdline = f"console=serial0,115200 rdinit=/init"
        bb.plain("[cmdline] : eMMC mode without U-Boot (ramfs) ")
        bb.warning(1, f"[cmdline] Generated cmdline: {cmdline} has no effect on uboot ")

        
    elif mode_boot == "tftp" and support_img_type == "nfs":
        cmdline = f"console=ttyAMA0,115200 console=tty1 root=/dev/nfs nfsroot={ip_server_nfs}:{folder_nfs_server},vers=3 rw ip=dhcp"
        bb.plain("[cmdline] : TFTP mode with NFS rootfs ")
        bb.debug(1, f"[cmdline] Generated cmdline: {cmdline}")

    elif mode_boot == "tftp" and support_img_type == "ramfs":
        cmdline = "console=serial0,115200 rdinit=/init"
        bb.plain("[cmdline] : TFTP mode with RAMFS rootfs ")
        bb.debug(1, f"[cmdline] Generated cmdline: {cmdline}")

    else:
        bb.fatal(f"[cmdline] Unsupported combination: SUPPORT_BOOT={mode_boot} with SUPPORT_IMG_TYPE={support_img_type}")
        return
        
    try:
        cmdline_file = os.path.join(bootfiles_dir, "cmdline.txt")
        
        # Ensure the bootfiles directory exists
        os.makedirs(bootfiles_dir, exist_ok=True)
        bb.debug(1, f"[cmdline] Ensured bootfiles directory: {bootfiles_dir}")
        
        # Check if file cmdline.txt already exists and warn if it does
        if os.path.exists(cmdline_file):
            bb.plain(f"[cmdline] cmdline.txt already exists at {cmdline_file}, overwriting")
        else:
            bb.debug(1, f"[cmdline] Creating new cmdline.txt file at {cmdline_file}")
        
        # Write cmdline.txt
        with open(cmdline_file, 'w') as f:
            f.write(cmdline)
        
        bb.plain(f"[cmdline] Successfully deployed cmdline.txt to {cmdline_file}")
                
    except Exception as e:
        bb.fatal(f"[cmdline] Error deploying cmdline.txt: {e}")
}

# ============================================================================
# TFTP Deployment Task (conditional - only for TFTP images)
# ============================================================================

# Always run the TFTP deploy task (no stamp file) 
do_tftp_nfs_deploy[nostamp] = "1"

do_tftp_nfs_deploy[depends] += " \
    virtual/kernel:do_deploy \
    rpi-bootfiles:do_deploy \
    ${@bb.utils.contains('RPI_USE_U_BOOT', '1', 'u-boot:do_deploy', '',d)} \
    "

# Register task AFTER image generation
addtask do_tftp_nfs_deploy after do_image_complete before do_build

# function to deploy boot files to tftp folder


python do_tftp_nfs_deploy() {
    import os 
    import shutil
    import glob
    import tarfile

    
    support_boot = d.getVar('SUPPORT_BOOT') or ""
    support_img_type = d.getVar('SUPPORT_IMG_TYPE') or ""
    
    # Only run for TFTP/NFS images OR images with NFS rootfs
    if support_boot not in ["tftp", "nfs", "sdcard"] and support_img_type != "nfs": 
        bb.plain("Skipping TFTP/NFS deploy (not a TFTP/NFS or NFS rootfs image)")
        return
    
    # If sdcard boot but no NFS rootfs, skip this task
    if support_boot == "sdcard" and support_img_type != "nfs":
        bb.plain("Skipping TFTP/NFS deploy (SD card without NFS rootfs)")
        return
    
    bb.plain("[tftp]: Task started for TFTP/NFS deployment")
    
    tftp_folder = d.getVar('TFTP_BOOT_FOLDER')
    nfs_folder = d.getVar('FOLDER_NFS_SERVER')
    ip_nfs_server = d.getVar('IP_SERVER_NFS') or "192.168.10.20"
    image_boot_files = d.getVar('IMAGE_BOOT_FILES') or ""
    deploy_dir = d.getVar('DEPLOY_DIR_IMAGE')
    distro_features = d.getVar('DISTRO_FEATURES') or ""
    image_name = d.getVar('IMAGE_NAME') or ""
    machine = d.getVar('MACHINE') or ""
    has_uboot = "uboot" in distro_features.split()

        
    # ========================================================================
    # 1. Deploy all boot files from IMAGE_BOOT_FILES to TFTP (if TFTP image)
    # ========================================================================
    if support_boot == "tftp":
        try:

    # ========================================================================
    # Handle TFTP deployment (only for TFTP images)
    # ========================================================================
            try:
                os.makedirs(tftp_folder, exist_ok=True)
                bb.note(f"[TFTP] Created TFTP folder: {tftp_folder}")
            except Exception as e:
                bb.error(f"[TFTP] Failed to create TFTP folder: {e}")

            # First, copy cmdline.txt if it exists
            bootfiles_dir = os.path.join(deploy_dir, d.getVar('BOOTFILES_DIR_NAME') or "bootfiles")
            cmdline_src = os.path.join(bootfiles_dir, "cmdline.txt")
            if os.path.exists(cmdline_src):
                try:
                    cmdline_dst = os.path.join(tftp_folder, "cmdline.txt")
                    shutil.copy2(cmdline_src, cmdline_dst)
                    bb.note(f"[TFTP] Copied cmdline.txt to {tftp_folder}")
                except Exception as e:
                    bb.warn(f"[TFTP] Failed to copy cmdline.txt: {e}")
            else:
                bb.debug(1, f"[TFTP] cmdline.txt not found at {cmdline_src}")

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
                            bb.debug(1, f"Deployed: {src_path} -> {dst_path}")
                else:
                    if os.path.exists(src_path):
                        dst_path = os.path.join(tftp_folder, dst_file)
                        os.makedirs(os.path.dirname(dst_path), exist_ok=True)
                        shutil.copy2(src_path, dst_path)
                        bb.debug(1, f"Deployed: {src_path} -> {dst_path}")
                    else:
                        bb.debug(1, f"Boot file not found: {src_path}")
        except Exception as e:
            bb.error(f"Error deploying TFTP boot files: {e}")
    
    # ========================================================================
    # 2. Extract rootfs TAR to NFS folder (with proper NFS permissions)
    # ========================================================================
    if support_img_type == "nfs":
        try:
            
            try:
                os.makedirs(nfs_folder, exist_ok=True)
                bb.note(f"[NFS] Created NFS folder: {nfs_folder}")
            except Exception as e:
                bb.error(f"[NFS] Failed to create NFS folder: {e}")

            # Find rootfs TAR file (with or without timestamp)
            rootfs_tar = None
            
            # Search for rootfs files with glob pattern (handles timestamps)
            # Try multiple patterns - more general first
            patterns = [
                os.path.join(deploy_dir, f"{image_name}-{machine}-*.rootfs.tar.bz2"),
                os.path.join(deploy_dir, f"{image_name}-{machine}.rootfs.tar.bz2"),
                os.path.join(deploy_dir, f"{image_name}-*-{machine}-*.rootfs.tar.bz2"),
                os.path.join(deploy_dir, "*-{machine}-*.rootfs.tar.bz2"),
                os.path.join(deploy_dir, f"{image_name}*.rootfs.tar.bz2"),
                os.path.join(deploy_dir, "*.rootfs.tar.bz2"),
            ]
            
            for pattern in patterns:
                matches = glob.glob(pattern)
                if matches:
                    # Get the most recent file if multiple matches
                    rootfs_tar = max(matches, key=os.path.getctime)
                    bb.note(f"[NFS] Found rootfs using pattern: {pattern}")
                    bb.note(f"[NFS] Selected file: {os.path.basename(rootfs_tar)}")
                    break
            
            if rootfs_tar:
                bb.note(f"[NFS] Found rootfs: {rootfs_tar}")
                
                # Extract rootfs (THIS REQUIRES NFS FOLDER TO BE WORLD-WRITABLE)
                try:
                    import tarfile
                    bb.note(f"[NFS] Extracting rootfs to {nfs_folder}...")
                    
                    # Extract using Python tarfile to avoid sudo issues
                    with tarfile.open(rootfs_tar, 'r:bz2') as tar:
                        # Remove existing files first
                        for item in os.listdir(nfs_folder):
                            path = os.path.join(nfs_folder, item)
                            try:
                                if os.path.isdir(path):
                                    shutil.rmtree(path)
                                else:
                                    os.remove(path)
                            except:
                                pass
                        
                        # Extract new files
                        tar.extractall(path=nfs_folder)
                    
                    bb.plain(f"[NFS] Successfully extracted rootfs to {nfs_folder}")
                    
                    # List some directories to verify
                    entries = os.listdir(nfs_folder)[:5]
                    bb.plain(f"[NFS] Contents (first 5): {entries}")
                    
                except Exception as e:
                    bb.error(f"[NFS] Extraction failed: {e}")
            else:
                bb.error(f"[NFS] No rootfs TAR found in {deploy_dir}")
                
        except Exception as e:
            bb.error(f"[NFS] Error: {e}")
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
