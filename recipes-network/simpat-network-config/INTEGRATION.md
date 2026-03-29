# Integration Guide: Using network-config in Your Meta-Layer

## Method 1: Direct Inheritance in Core Image

Modify your image recipe to inherit network-config:

```bitbake
require recipes-core/images/core-image-minimal.bb

inherit network-config

IMAGE_INSTALL:append = " \
    systemd-networkd-configuration \
    systemd \
    iproute2 \
    iputils-ping \
"

# Per-machine configuration
NETWORK_CONFIG_JSON:rpi4 = "network-rpi4.json"
NETWORK_CONFIG_JSON:rpi5 = "network-rpi5.json"
NETWORK_CONFIG_JSON ?= "network-default.json"

SRC_URI += " \
    file://network-rpi4.json \
    file://network-rpi5.json \
    file://network-default.json \
"
```

## Method 2: Via Separate Recipe Dependency

Create a simple wrapper recipe:

```bitbake
# recipes-network/network-config-my-device/network-config-my-device_1.0.bb

SUMMARY = "Network configuration for my device"
inherit network-config

SRC_URI += "file://my-network.json"
NETWORK_CONFIG_JSON = "my-network.json"
RDEPENDS:${PN} += "systemd"
```

Then require it in your image:

```bitbake
require recipes-network/network-config-my-device/network-config-my-device_1.0.bb
```

## Method 3: In a Custom Meta-Layer

Create machine-specific configurations:

```
meta-mydevices/
 ├── conf/
 │    └── machine/
 │         ├── device-a.conf
 │         └── device-b.conf
 └── recipes-network/
      └── network-config/
           ├── device-a/
           │    ├── network-config_1.0.bb
           │    └── files/
           │         ├── schema.json
           │         ├── templates/
           │         └── network.json
           └── device-b/
                ├── network-config_1.0.bb
                └── files/
                     ├── schema.json
                     ├── templates/
                     └── network.json
```

## Integration Checklist

1. **Add to SRC_URI**
   ```bitbake
   SRC_URI += "file://schema.json \
               file://templates/network.j2 \
               file://templates/netdev.j2 \
               file://templates/link.j2 \
               file://network.json"
   ```

2. **Set NETWORK_CONFIG_JSON**
   ```bitbake
   NETWORK_CONFIG_JSON = "network.json"
   ```

3. **Inherit class**
   ```bitbake
   inherit network-config
   ```

4. **Add dependencies**
   ```bitbake
   DEPENDS += "python3-jsonschema python3-jinja2"
   RDEPENDS:${PN} += "systemd"
   ```

5. **Add to IMAGE_INSTALL** (if using as separate recipe)
   ```bitbake
   IMAGE_INSTALL:append = "network-config-my-device"
   ```

## Verification

### 1. Build Log Check

```bash
bitbake your-image 2>&1 | grep -A 5 "Network config"
```

### 2. Generated Files Verification

```bash
# In WORKDIR during build
find tmp/work/ -name "*.network" -o -name "*.netdev" -o -name "*.link" | head -20

# Or in final image
file list/packages/machine-arch/network-config-*/
```

### 3. Runtime Verification

After flashing image to device:

```bash
# SSH to device
ssh root@device

# Check files exist
ls -la /etc/systemd/network/

# Check syntax
networkctl list

# Verify configurations
cat /etc/systemd/network/10-eth0.network

# Monitor systemd-networkd
journalctl -u systemd-networkd -n 50
```

## Common Integration Problems

### Problem: "inherit network-config not found"

**Solution**: Ensure the bbclass is in BBPATH:
```bitbake
# In bblayers.conf
BBLAYERS += "${TOPDIR}/../meta-raspberrypi-simpat"
```

### Problem: NETWORK_CONFIG_JSON not set

**Solution**: Add explicit assignment in recipe or conf:
```bitbake
NETWORK_CONFIG_JSON = "network.json"
```

### Problem: Validation fails at build time

**Solution**: 
1. Check JSON syntax: `python3 -m json.tool network.json`
2. Validate against schema: Use JSON Schema validator online
3. Enable debug output: `bitbake -vv network-config`

### Problem: Files not in final image

**Solution**: 
1. Verify recipe is in IMAGE_INSTALL or inherited by image
2. Check do_install task runs: `bitbake network-config -e | grep ^do_install`
3. Check FILES: `bitbake network-config -e | grep ^FILES`

## Build Examples

### Build with Custom Network Config

```bash
cd /var/embedded-dev/YOCTO

# Source environment
source PROJET-RPI-5/sources/poky/oe-init-build-env PROJET-RPI-5/sources/build-rpi5/

# Build with default config
bitbake -k your-image

# Build with specific machine
MACHINE=rpi4 bitbake -k your-image
MACHINE=rpi5 bitbake -k your-image
```

### Incremental Development

```bash
# Build just the network-config recipe
bitbake network-config -f

# Clean and rebuild
bitbake network-config -c clean
bitbake network-config

# Clean generated task only
bitbake network-config -c cleanall
```

## Advanced Customization

### Add Custom Validation Logic

In `network-config.bbclass`, extend `validate_network_config()`:

```python
def validate_custom_rules(config):
    # Your custom validation
    interfaces = config.get('interfaces', [])
    # Add rules...
    return validated_config
```

### Add Pre/Post Processing

```bitbake
python do_generate_networkd_config:prepend() {
    bb.note("Pre-processing network config...")
}

python do_generate_networkd_config:append() {
    bb.note("Post-processing complete")
}
```

### Generate Additional Files

Extend templates to create:
- Firewall rules
- DNS configurations
- Routing policies
- Interface monitoring scripts

## Performance Tips

1. **Pre-validate configurations**: Run validation offline
2. **Cache generated files**: Generated configs don't change per build
3. **Parallel builds**: network-config builds independently
4. **Minimal template**: Keep Jinja2 templates simple for faster rendering

## Security Considerations

1. File permissions: Generated files should be root:root 0644
2. No secrets in JSON: Use environment variables for sensitive data
3. Validate on runtime: Don't trust pre-generated configs
4. Monitor changes: Track config file modifications

---

**Next Steps:**
1. Create your network.json configuration
2. Add to your layer's recipes-network/
3. Test on development machine first
4. Deploy to production devices
