# BitBake class for TFTP boot file deployment
# Auto-detects deployment type based on image characteristics:
#   - If INITRAMFS_IMAGE is set: Deploy RAMFS (kernel + initramfs to TFTP)
#   - If rootfs image exists: Deploy to NFS folder
#   - Otherwise: Deploy boot files only to TFTP
# 
# Uses IMAGE_BOOT_FILES to get all required boot files automatically

inherit deploy

# Configuration variables
TFTP_BOOT_FOLDER ?= "/srv/tftp"
FOLDER_NFS_SERVER ?= "/srv/nfsroot"

# Create the deploy task for TFTP boot files
python do_tftp_deploy() {
    import os
    import shutil
    
    bb.note("=== TFTP Deploy Task Starting ===")
    
    tftp_folder = d.getVar('TFTP_BOOT_FOLDER')
    nfs_folder = d.getVar('FOLDER_NFS_SERVER')
    image_boot_files = d.getVar('IMAGE_BOOT_FILES') or ""
    image_name = d.getVar('IMAGE_BASENAME')
    initramfs_image = d.getVar('INITRAMFS_IMAGE')
    deploy_dir = d.getVar('DEPLOY_DIR_IMAGE')
    
    # Ensure TFTP folder exists
    if not tftp_folder:
        bb.error("TFTP_BOOT_FOLDER not set")
        return
    
    os.makedirs(tftp_folder, exist_ok=True)
    bb.note(f"TFTP boot folder: {tftp_folder}")
    
    # Auto-detect deployment type
    is_ramfs = initramfs_image and len(initramfs_image.strip()) > 0
    deploy_type = "ramfs" if is_ramfs else "nfs"
    
    bb.note(f"Auto-detected deployment type: {deploy_type}")
    
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
                    import glob
                    for src_path in glob.glob(src_path):
                        if os.path.exists(src_path):
                            filename = os.path.basename(src_path)
                            dst_path = os.path.join(tftp_folder, filename)
                            shutil.copy2(src_path, dst_path)
                            bb.note(f"Deployed boot file: {filename}")
                else:
                    if os.path.exists(src_path):
                        dst_path = os.path.join(tftp_folder, dst_file)
                        # Create parent directories if needed
                        os.makedirs(os.path.dirname(dst_path), exist_ok=True)
                        shutil.copy2(src_path, dst_path)
                        bb.note(f"Deployed boot file: {dst_file}")
                    else:
                        bb.debug(f"Boot file not found: {src_path}")
        except Exception as e:
            bb.error(f"Error deploying boot files: {e}")
            return
    
    # Deploy rootfs based on image type
    if is_ramfs:
        bb.note("RAMFS deployment - kernel is bundled with initramfs")
    else:
        # For standard rootfs: extract tarball to NFS folder
        if nfs_folder and deploy_dir and os.path.exists(deploy_dir):
            os.makedirs(nfs_folder, exist_ok=True)
            try:
                rootfs_deployed = False
                
                # Find and extract first rootfs tar file
                for deploy_file in os.listdir(deploy_dir):
                    if deploy_file.endswith(('.tar.bz2', '.tar.gz')):
                        src = os.path.join(deploy_dir, deploy_file)
                        bb.note(f"Extracting rootfs: {deploy_file}")
                        
                        # Extract tarball to NFS folder
                        import tarfile
                        if deploy_file.endswith('.tar.bz2'):
                            tar = tarfile.open(src, 'r:bz2')
                        else:
                            tar = tarfile.open(src, 'r:gz')
                        tar.extractall(path=nfs_folder)
                        tar.close()
                        bb.note(f"Rootfs extracted to {nfs_folder}")
                        rootfs_deployed = True
                        break
                
                if not rootfs_deployed:
                    bb.warn("No rootfs tarball found in deploy directory")
            except Exception as e:
                bb.error(f"Error deploying rootfs to NFS: {e}")
        else:
            bb.debug("NFS rootfs deployment skipped (FOLDER_NFS_SERVER or DEPLOY_DIR not set)")
    
    bb.note("=== TFTP Deploy Task Completed ===")
}


# Always run this task (no stamp file)
do_tftp_deploy[nostamp] = "1"

# Add the task to the build - ensure it always runs after image creation
addtask do_tftp_deploy after do_image
