#include <linux/module.h>
#include <linux/kernel.h>
#include <linux/init.h>
#include <linux/fs.h> // For alloc_chrdev_region and unregister_chrdev_region
#include <linux/kdev_t.h> // For MAJOR and MINOR macros


dev_t dev; // Device number for dynamic allocation

static int __init hello_init(void) {

#ifdef WITHOUT_DYN_ALLOC_MODULE
        pr_info(KERN_INFO "Hello, World! Module loaded.\n");
        return 0; // Return 0 for successful initialization
#elif WITH_DYN_ALLOC_MODULE
        /* Allocation Major Number */
        if ((alloc_chrdev_region(&dev,0,1,"helloworld")) < 0) {
            pr_err(KERN_ERR "Failed to allocate a major number\n");
            return -1;
        }
        
        pr_info("Major = %d Minor = %d \n",MAJOR(dev), MINOR(dev));
        pr_info("Kernel Module Inserted Successfully...\n");
        
        return 0;

#else
    pr_err(KERN_ERR "Hello, World! Module loaded with dynamic allocation.\n");
    return 0; // Return 0 for successful initialization
#endif
}

static void __exit hello_exit(void) {
#ifdef WITHOUT_DYN_ALLOC_MODULE
    pr_info(KERN_INFO "Goodbye, World! Module unloaded.\n");
#elif WITH_DYN_ALLOC_MODULE
    unregister_chrdev_region(dev, 1);
    pr_info(KERN_INFO "Goodbye, World! Module unloaded with dynamic allocation.\n");
#else
    pr_info(KERN_INFO "Goodbye, World! Module unloaded.\n");
#endif
}

module_init(hello_init);
module_exit(hello_exit);

MODULE_LICENSE("GPL");
MODULE_AUTHOR("Your Name");
MODULE_DESCRIPTION("A simple Hello World kernel module");
MODULE_VERSION("1.0");