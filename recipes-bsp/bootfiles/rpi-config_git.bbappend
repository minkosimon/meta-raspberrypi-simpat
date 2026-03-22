# Force ENABLE_UART to ensure bootloader console output
ENABLE_UART = "1"

# Ensure this bbappend is applied to Raspberry Pi 5
COMPATIBLE_MACHINE = "^rpi$|^raspberrypi5$"
