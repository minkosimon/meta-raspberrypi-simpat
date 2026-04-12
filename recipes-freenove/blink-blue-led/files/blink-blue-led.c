/*
 * blink-blue-led.c - Linux kernel driver to blink a blue LED on GPIO17
 *
 * Circuit: GPIO17 -> 220 Ohm resistor -> Blue LED (525nm) -> GND
 *
 * RPi 5: GPIOs are on the RP1 chip (PCIe). We use the modern gpiod
 * descriptor API with a device-tree overlay so the kernel resolves
 * the correct GPIO chip automatically.
 *
 * Character device interface (/dev/blink_blue_led):
 *   write "1"    -> start blinking
 *   write "0"    -> stop blinking (LED off)
 *   write "<ms>" -> set blink period in milliseconds (50-10000)
 *   read         -> "blinking <period_ms>\n" or "off\n"
 */

#include <linux/module.h>
#include <linux/kernel.h>
#include <linux/init.h>
#include <linux/fs.h>
#include <linux/cdev.h>
#include <linux/device.h>
#include <linux/gpio/consumer.h>
#include <linux/timer.h>
#include <linux/uaccess.h>
#include <linux/platform_device.h>
#include <linux/of.h>
#include <linux/mod_devicetable.h>

#define DRIVER_NAME     "blink_blue_led"
#define DEVICE_NAME     "blink_blue_led"
#define CLASS_NAME      "blink_blue_led_class"
#define DEFAULT_PERIOD  500      /* Default blink period in ms */

static unsigned int blink_period_ms = DEFAULT_PERIOD;
module_param(blink_period_ms, uint, 0644);
MODULE_PARM_DESC(blink_period_ms, "LED blink period in milliseconds (default: 500)");

/* Driver state */
static struct gpio_desc *led_gpio;
static dev_t dev_num;
static struct cdev blink_cdev;
static struct class *blink_class;
static struct timer_list blink_timer;
static bool led_state;
static bool blinking;

/* ---------- Timer callback: toggle LED ---------- */
static void blink_timer_callback(struct timer_list *t)
{
	led_state = !led_state;
	gpiod_set_value(led_gpio, led_state);

	if (blinking)
		mod_timer(&blink_timer,
			  jiffies + msecs_to_jiffies(blink_period_ms));
}

/* ---------- Start / stop helpers ---------- */
static void blink_start(void)
{
	if (blinking)
		return;
	blinking = true;
	led_state = true;
	gpiod_set_value(led_gpio, led_state);
	mod_timer(&blink_timer,
		  jiffies + msecs_to_jiffies(blink_period_ms));
	pr_info(DRIVER_NAME ": blinking started (period %u ms)\n",
		blink_period_ms);
}

static void blink_stop(void)
{
	blinking = false;
	del_timer_sync(&blink_timer);
	gpiod_set_value(led_gpio, 0);
	led_state = false;
	pr_info(DRIVER_NAME ": blinking stopped\n");
}

/* ---------- File operations ---------- */
static int blink_open(struct inode *inode, struct file *file)
{
	return 0;
}

static int blink_release(struct inode *inode, struct file *file)
{
	return 0;
}

static ssize_t blink_read(struct file *file, char __user *buf,
			   size_t count, loff_t *ppos)
{
	char status[64];
	int len;

	if (*ppos > 0)
		return 0;

	if (blinking)
		len = snprintf(status, sizeof(status),
			       "blinking %u\n", blink_period_ms);
	else
		len = snprintf(status, sizeof(status), "off\n");

	if (len > count)
		len = count;

	if (copy_to_user(buf, status, len))
		return -EFAULT;

	*ppos += len;
	return len;
}

static ssize_t blink_write(struct file *file, const char __user *buf,
			    size_t count, loff_t *ppos)
{
	char kbuf[32];
	unsigned int val;
	size_t len = min(count, sizeof(kbuf) - 1);

	if (copy_from_user(kbuf, buf, len))
		return -EFAULT;
	kbuf[len] = '\0';

	if (kstrtouint(kbuf, 0, &val) == 0) {
		if (val == 0) {
			blink_stop();
		} else if (val == 1) {
			blink_start();
		} else if (val >= 50 && val <= 10000) {
			blink_period_ms = val;
			pr_info(DRIVER_NAME ": period set to %u ms\n", val);
			if (blinking) {
				del_timer_sync(&blink_timer);
				mod_timer(&blink_timer,
					  jiffies + msecs_to_jiffies(blink_period_ms));
			}
		} else {
			pr_warn(DRIVER_NAME ": value %u out of range (0, 1, or 50-10000)\n", val);
			return -EINVAL;
		}
	} else {
		pr_warn(DRIVER_NAME ": invalid input\n");
		return -EINVAL;
	}

	return count;
}

static const struct file_operations blink_fops = {
	.owner   = THIS_MODULE,
	.open    = blink_open,
	.release = blink_release,
	.read    = blink_read,
	.write   = blink_write,
};

/* ---------- Platform driver probe / remove ---------- */
static int blink_led_probe(struct platform_device *pdev)
{
	int ret;
	struct device *dev_ret;

	/* Get GPIO descriptor from device tree ("led-gpios" property) */
	led_gpio = devm_gpiod_get(&pdev->dev, "led", GPIOD_OUT_LOW);
	if (IS_ERR(led_gpio)) {
		ret = PTR_ERR(led_gpio);
		dev_err(&pdev->dev, "failed to get LED GPIO (err %d)\n", ret);
		return ret;
	}
	dev_info(&pdev->dev, "LED GPIO acquired successfully\n");

	/* Allocate char device region */
	ret = alloc_chrdev_region(&dev_num, 0, 1, DRIVER_NAME);
	if (ret < 0) {
		dev_err(&pdev->dev, "failed to allocate chrdev region\n");
		return ret;
	}

	/* Init and add cdev */
	cdev_init(&blink_cdev, &blink_fops);
	blink_cdev.owner = THIS_MODULE;
	ret = cdev_add(&blink_cdev, dev_num, 1);
	if (ret < 0) {
		dev_err(&pdev->dev, "failed to add cdev\n");
		goto err_region;
	}

	/* Create device class */
	blink_class = class_create(THIS_MODULE, CLASS_NAME);
	if (IS_ERR(blink_class)) {
		ret = PTR_ERR(blink_class);
		dev_err(&pdev->dev, "failed to create class\n");
		goto err_cdev;
	}

	/* Create device node /dev/blink_blue_led */
	dev_ret = device_create(blink_class, NULL, dev_num, NULL, DEVICE_NAME);
	if (IS_ERR(dev_ret)) {
		ret = PTR_ERR(dev_ret);
		dev_err(&pdev->dev, "failed to create device\n");
		goto err_class;
	}

	/* Setup timer */
	timer_setup(&blink_timer, blink_timer_callback, 0);
	blinking = false;
	led_state = false;

	dev_info(&pdev->dev, "driver ready — /dev/%s\n", DEVICE_NAME);
	return 0;

err_class:
	class_destroy(blink_class);
err_cdev:
	cdev_del(&blink_cdev);
err_region:
	unregister_chrdev_region(dev_num, 1);
	return ret;
}

static int blink_led_remove(struct platform_device *pdev)
{
	blink_stop();
	del_timer_sync(&blink_timer);

	device_destroy(blink_class, dev_num);
	class_destroy(blink_class);
	cdev_del(&blink_cdev);
	unregister_chrdev_region(dev_num, 1);

	/* devm handles gpiod_put automatically */

	dev_info(&pdev->dev, "driver removed\n");
	return 0;
}

/* ---------- Device tree match table ---------- */
static const struct of_device_id blink_led_of_match[] = {
	{ .compatible = "simpat,blink-blue-led" },
	{ /* sentinel */ }
};
MODULE_DEVICE_TABLE(of, blink_led_of_match);

static struct platform_driver blink_led_platform_driver = {
	.probe  = blink_led_probe,
	.remove = blink_led_remove,
	.driver = {
		.name           = DRIVER_NAME,
		.of_match_table = blink_led_of_match,
		.owner          = THIS_MODULE,
	},
};

module_platform_driver(blink_led_platform_driver);

MODULE_LICENSE("GPL");
MODULE_AUTHOR("simpat");
MODULE_DESCRIPTION("GPIO17 blue LED blink driver for Raspberry Pi 5 (gpiod + DT overlay)");
MODULE_VERSION("2.0");
