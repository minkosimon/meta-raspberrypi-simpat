/* Driver for Freenove hardware, including initialization and control functions.
 * This driver is designed to work with the Freenove hardware platform, providing
 * a set of APIs for interacting with the hardware components.
    * The driver includes functions for initializing the hardware, controlling LEDs,
 * reading sensor data, and handling interrupts. It is structured to be modular and
 * maintainable, allowing for easy updates and extensions as needed.
 * Note: This is a simplified example and may not cover all aspects of a real driver.
*/
#include <linux/module.h>
#include <linux/kernel.h>
#include <linux/init.h>
#include <linux/platform_device.h>
#include <linux/of.h>
#include <linux/gpio/consumer.h>
#include <linux/leds.h>



/* define  freenove led */
struct freenove_led {
   struct led_classdev cdev;
   struct gpio_desc *gpio;
};

/* freenove private data structure */
struct freenove_priv {
   struct freenove_led *leds;
   int num_leds;
};

static void freenove_led_set(struct led_classdev *cdev,
                         enum led_brightness value)
{     
   struct freenove_led *led = container_of(cdev, struct freenove_led, cdev);
   gpiod_set_value(led->gpio, value ? 1 : 0);
}

static int freenove_probe(struct platform_device *pdev)
{
   struct freenove_priv *priv;
   struct gpio_descs *gpios;
   int i, ret;

   gpios = devm_gpiod_get_array(&pdev->dev, "leds", GPIOD_OUT_LOW);
   if (IS_ERR(gpios)) {
      dev_err(&pdev->dev, "Failed to get GPIOs for LEDs\n");
      return PTR_ERR(gpios);
   }

   priv = devm_kzalloc(&pdev->dev, sizeof(*priv), GFP_KERNEL);
    if (!priv)
        return -ENOMEM;
   
   priv->num_leds = gpios->ndescs;
   priv->leds = devm_kzalloc(&pdev->dev, sizeof(struct freenove_led) * priv->num_leds, GFP_KERNEL);
   
   if (!priv->leds)
      return -ENOMEM;

   for (i = 0; i < priv->num_leds; i++) {
      struct freenove_led *led = &priv->leds[i];
      led->gpio = gpios->desc[i];
      led->cdev.name = kasprintf(GFP_KERNEL, "freenove:led%d", i);

      if (!led->cdev.name)
         return -ENOMEM;

      led->cdev.brightness_set = freenove_led_set;
      led->cdev.max_brightness = 1;

      ret = devm_led_classdev_register(&pdev->dev, &led->cdev);
      if (ret) {
         dev_err(&pdev->dev, "Failed to register LED %d\n", i);
         return ret;
      }
   }
   platform_set_drvdata(pdev, priv);
   dev_info(&pdev->dev, "Freenove driver probed successfully\n");
   return 0;
}

static const struct of_device_id freenove_of_match[] = {
   { .compatible = "simpat,freenove-driver", },
   { /* sentinel */ }
};
MODULE_DEVICE_TABLE(of, freenove_of_match);

static struct platform_driver freenove_driver = {
   .probe = freenove_probe,
   .driver = {
      .name = "freenove-driver",
      .of_match_table = freenove_of_match,
   },
};
module_platform_driver(freenove_driver);
MODULE_LICENSE("GPL");
MODULE_AUTHOR("Simon MINKO");
MODULE_DESCRIPTION("Driver for Freenove hardware platform");