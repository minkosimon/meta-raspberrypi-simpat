#include <linux/module.h>
#include <linux/kernel.h>
#include <linux/init.h>
#include <linux/fs.h> // For alloc_chrdev_region and unregister_chrdev_region
#include <linux/kdev_t.h> // For MAJOR and MINOR macros
#include <linux/cdev.h> // For cdev structure and functions

static dev_t dev; // Device number for dynamic allocation
static struct cdev c_dev; // Character device structure
static unsigned int major; /* major number for device */
static struct class *dummy_class;
static struct cdev dummy_cdev;
static unsigned int major_number; /* Major number for the device */
static unsigned int minor_number; /* Minor number for the device */


static int dummy_open(struct inode *inode, struct file *file) {
    pr_info(KERN_INFO "Dummy device opened\n");
    return 0; // Return 0 for successful open
}

static int dummy_release(struct inode *inode, struct file *file) {
    pr_info(KERN_INFO "Dummy device closed\n");
    return 0; // Return 0 for successful release
}

static ssize_t dummy_read(struct file *file, char __user *buf, size_t count, loff_t *ppos) {
    pr_info(KERN_INFO "Dummy device read\n");
    return 0; // Return 0 for end of file
}

static ssize_t dummy_write(struct file *file, const char __user *buf, size_t count, loff_t *ppos) {
    pr_info(KERN_INFO "Dummy device write\n");
    return count; // Return the number of bytes written
}

static struct file_operations fops = {
    .owner = THIS_MODULE,
    .open = dummy_open,
    .release = dummy_release,
    .read = dummy_read,
    .write = dummy_write,
};  


static int __init dummy_init(void) {

    struct device *dummy_device;
    int error;
    

    /* Allocation Major Number */
    error = alloc_chrdev_region(&dev, 0, 1, "dummy");
    if (error < 0) {
        pr_err(KERN_ERR "Failed to allocate a major number\n");
        return error;
    }
    
    major_number = MAJOR(dev);
    minor_number = MINOR(dev);
    pr_info("Major = %d Minor = %d \n", major_number, minor_number);
    
    cdev_init(&c_dev, &fops);
    
    if (cdev_add(&c_dev, dev, 1) == -1) {
        unregister_chrdev_region(dev, 1);
        pr_err(KERN_ERR "Failed to add cdev\n");
        return -1;
    }
    
    /* Create device class */
    dummy_class = class_create(THIS_MODULE, "dummy_class_simon");
    if (IS_ERR(dummy_class)) {
        cdev_del(&c_dev);
        unregister_chrdev_region(MKDEV(major_number, minor_number), 1);
        pr_err(KERN_ERR "Failed to create class\n");
        return PTR_ERR(dummy_class);
    }
    
    /* Create device */
    cdev_init(&dummy_cdev, &fops);
    dummy_cdev.owner = THIS_MODULE;

    if (cdev_add(&dummy_cdev, MKDEV(major_number, minor_number), 1) == -1) {
        class_destroy(dummy_class);
        unregister_chrdev_region(MKDEV(major_number, minor_number), 1);
        pr_err(KERN_ERR "Failed to add cdev for dummy device\n");
        return -1;
    }

    dummy_device = device_create(  dummy_class, 
                    NULL, /* no parent device */
                    dev, /* device number */
                    NULL, /* no additional data */
                    "dummy_device" ); /* device name */

    if (IS_ERR(dummy_device)) {
        cdev_del(&dummy_cdev);
        class_destroy(dummy_class);
        unregister_chrdev_region(MKDEV(major_number, minor_number), 1);
        pr_err(KERN_ERR "Failed to create device\n");
        return PTR_ERR(dummy_device);
    }
    
    pr_info(KERN_INFO "Dummy device driver loaded successfully\n");
    return 0; // Return 0 for successful initialization
}

static void __exit dummy_exit(void) {
    device_destroy(dummy_class, dev);
    class_destroy(dummy_class);
    cdev_del(&c_dev);
    unregister_chrdev_region(dev, 1);
    pr_info(KERN_INFO "Dummy device driver unloaded\n");
}

module_init(dummy_init);
module_exit(dummy_exit);

MODULE_LICENSE("GPL");
MODULE_AUTHOR("Simon MINKO - minkosimon@gmail.com");
MODULE_DESCRIPTION("A simple dummy character device driver");
MODULE_VERSION("1.0");