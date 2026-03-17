# meta-raspberrypi-simpat

**Presentation**

This meta-layer will allow us to apply some concepts in YOCTO.
We can learn how to build the simplest C/C++ code, Linux drivers, and Python 3 applications.
For many of you, when you start to build a Linux system, you use an SD card to store the Linux OS.
You waste time burning SD cards instead of using a boot system like TFTP or NFS.


**Electronic Board** 

* Raspberrypi5
* Raspbberypi4
* Raspberrypi3

# Depencies with others layers

layer meta-raspberrypi get dependance with layers:

* meta-raspberrypi
* core.  

[link layer.conf](conf/layer.conf)

## SD card image classes with WIC

This layer now provides reusable classes to generate Raspberry Pi SD card images with `wic`:

* `simpat-image-sdcard-rootfs`
	* SD card with `boot` + local rootfs partition
* `simpat-image-sdcard-nfs`
	* SD card with only the boot partition, Linux rootfs exported over NFS
* `simpat-image-sdcard-ramfs`
	* SD card with only the boot partition, Linux booting from a bundled initramfs

The WKS templates are stored in [wic/](wic/).

### Example usage in an image recipe

```bitbake
require recipes-core/images/core-image-minimal.bb

inherit simpat-image-sdcard-rootfs
```

For an NFS boot image:

```bitbake
require recipes-core/images/core-image-minimal.bb

inherit simpat-image-sdcard-nfs

IP_SERVER_NFS = "192.168.1.10"
FOLDER_NFS_SERVER = "/srv/nfs/rpi-rootfs"
```

For an initramfs boot image:

```bitbake
require recipes-core/images/core-image-minimal.bb

inherit simpat-image-sdcard-ramfs

SIMPAT_INITRAMFS_IMAGE = "core-image-minimal-initramfs"
```

### Tunable variables

You can override these variables in your image recipe, machine, distro or `local.conf`:

* `SIMPAT_WIC_DISK_DEV`
* `SIMPAT_WIC_PARTITION_ALIGN`
* `SIMPAT_WIC_BOOT_PARTITION_LABEL`
* `SIMPAT_WIC_BOOT_PARTITION_SIZE`
* `SIMPAT_WIC_ROOTFS_PARTITION_LABEL`
* `SIMPAT_WIC_ROOTFS_PARTITION_FSTYPE`
* `SIMPAT_WIC_EXTRA_ARGS`

For the NFS variant, the existing layer variables are reused:

* `BOOT_ROOTFS_OVER_NFS`
* `IP_SERVER_NFS`
* `FOLDER_NFS_SERVER`

For the RAMFS variant:

* `SIMPAT_INITRAMFS_IMAGE`
* `INITRAMFS_IMAGE`
* `INITRAMFS_IMAGE_BUNDLE`