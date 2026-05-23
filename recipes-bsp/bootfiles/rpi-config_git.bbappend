# Force ENABLE_UART to ensure bootloader console output
ENABLE_UART = "1"

# Load the blink-blue-led DT overlay for GPIO17 LED control
RPI_EXTRA_CONFIG:append = "\ndtoverlay=blink-blue-led\n"

# Enable header I2C on GPIO2/GPIO3 for Freenove ADC/LCD/MPU6050 devices
RPI_EXTRA_CONFIG:append = "dtparam=i2c_arm=on\n"

# Load the Freenove hardware driver overlay
RPI_EXTRA_CONFIG:append = "dtoverlay=freenove-overlay\n"

# Ensure this bbappend is applied to Raspberry Pi 5
COMPATIBLE_MACHINE = "^rpi$|^raspberrypi5$"
