# Quick Start Guide - Network Configuration Class

## 🎯 30-Second Quick Start

### 1. Copy the entire `recipes-network/` directory to your layer:

```bash
cp -r recipes-network your-meta-layer/
```

### 2. Create your network config file (e.g., `network.json`):

```json
{
  "interfaces": [
    {
      "name": "eth0",
      "dhcp4": true
    }
  ]
}
```

### 3. Update your recipe to use it:

```bitbake
inherit network-config

SRC_URI += "file://network.json"
NETWORK_CONFIG_JSON = "network.json"
```

### 4. Build:

```bash
bitbake your-image
```

### 5. Result:

Generated files appear in `/etc/systemd/network/` on your device.

---

## 📚 Core Files

| File | Purpose |
|------|---------|
| `network-config.bbclass` | Main Python class for Yocto (does all the work) |
| `schema.json` | Validation schema (what's allowed in config) |
| `templates/*.j2` | Jinja2 templates (output formatting) |
| `validate-network-config.py` | Standalone validator tool |
| `test-network-config.py` | Unit tests for validation logic |

---

## 🧪 Validation

### Validate before building:

```bash
python3 validate-network-config.py your-network.json schema.json
```

### Run tests:

```bash
python3 test-network-config.py
```

---

## 📋 Configuration Examples

### DHCP (Simple)
```json
{
  "interfaces": [
    {"name": "eth0", "dhcp4": true}
  ]
}
```

### Static IP
```json
{
  "interfaces": [
    {
      "name": "eth0",
      "ipv4": ["192.168.1.100/24"],
      "gateway4": "192.168.1.1"
    }
  ]
}
```

### VLAN
```json
{
  "interfaces": [
    {"name": "eth0"},
    {
      "name": "vlan10",
      "kind": "vlan",
      "id": 10,
      "link": "eth0",
      "dhcp4": true
    }
  ]
}
```

### Bridge
```json
{
  "interfaces": [
    {"name": "eth0"},
    {"name": "eth1"},
    {
      "name": "br0",
      "kind": "bridge",
      "members": ["eth0", "eth1"],
      "dhcp4": true
    }
  ]
}
```

### Bond (Redundancy)
```json
{
  "interfaces": [
    {"name": "eth0"},
    {"name": "eth1"},
    {
      "name": "bond0",
      "kind": "bond",
      "mode": "active-backup",
      "members": ["eth0", "eth1"],
      "primary": "eth0",
      "dhcp4": true
    }
  ]
}
```

---

## 🏗️ Integration in Your Layer

### Option 1: Direct in Core Image

```bitbake
# my-image.bb

require recipes-core/images/core-image-minimal.bb

inherit network-config

SRC_URI += "file://network.json"
NETWORK_CONFIG_JSON = "network.json"

IMAGE_INSTALL:append = "systemd-networkd-configuration"
```

### Option 2: Separate Recipe

```bitbake
# recipes-network/my-network/my-network-config_1.0.bb

inherit network-config

SRC_URI += "file://network.json"
NETWORK_CONFIG_JSON = "network.json"

FILES:${PN} = "${systemd_system_unitdir}/network/*"
RDEPENDS:${PN} += "systemd"
```

Then in image:
```bitbake
IMAGE_INSTALL:append = "my-network-config"
```

### Option 3: Multi-Machine Support

```bitbake
# recipes-network/network-config/network-config_1.0.bb

inherit network-config

SRC_URI += " \
    file://schema.json \
    file://templates/network.j2 \
    file://templates/netdev.j2 \
    file://templates/link.j2 \
    file://configs/net-rpi4.json \
    file://configs/net-rpi5.json \
"

NETWORK_CONFIG_JSON:rpi4 = "net-rpi4.json"
NETWORK_CONFIG_JSON:rpi5 = "net-rpi5.json"
NETWORK_CONFIG_JSON ?= "net-rpi4.json"
```

Build:
```bash
MACHINE=rpi4 bitbake your-image
MACHINE=rpi5 bitbake your-image
```

---

## ✅ What You Get

### At Build Time:
- Validates JSON configuration
- Generates systemd-networkd files
- Includes files in image

### At Runtime:
- systemd-networkd reads files
- Network configured automatically
- No runtime processing overhead

### Files Generated:
```
/etc/systemd/network/
├── 10-eth0.network      # Physical interface config
├── 20-vlan10.netdev     # VLAN device definition
├── 20-vlan10.network    # VLAN networking config
└── ... etc
```

---

## 🐛 Debugging

### Check validation errors:
```bash
python3 validate-network-config.py config.json schema.json
```

### View generated files during build:
```bash
find tmp/work/*/network-config-*/WORKDIR/networkd-config/
```

### Check final image files:
```bash
ssh root@device
ls -la /etc/systemd/network/
cat /etc/systemd/network/10-eth0.network
```

### Monitor at runtime:
```bash
journalctl -u systemd-networkd -f
networkctl status
```

---

## 🎓 Full Documentation

- **README.md** - Complete reference
- **INTEGRATION.md** - All integration methods
- **USECASES.md** - Real-world examples
- **SUMMARY.md** - Overview

---

## 📊 What's Included

```
recipes-network/network-config/
├── network-config_1.0.bb        [Main recipe]
├── example-core-image-network.bb [Image example]
├── classes/network-config.bbclass [BitBake class - 367 lines]
├── validate-network-config.py    [Validator tool]
├── test-network-config.py        [Unit tests - 11 tests]
├── demo-generation.py            [Demonstration]
├── README.md                      [7KB documentation]
├── INTEGRATION.md                 [6KB integration guide]
├── USECASES.md                    [8KB real-world examples]
├── SUMMARY.md                     [7KB overview]
└── files/
    ├── schema.json                [JSON Schema validation]
    ├── templates/
    │   ├── network.j2             [Network file template]
    │   ├── netdev.j2              [Virtual interface template]
    │   └── link.j2                [Link parameters template]
    └── configs/
        ├── network-board-a.json   [DHCP simple]
        ├── network-board-b.json   [VLAN + bridge]
        ├── network-board-c.json   [Bond redundancy]
        └── network-advanced.json  [Complex multi-VLAN]
```

---

## ✨ Key Features

✅ **Build-time processing** - No runtime overhead  
✅ **JSON-based configuration** - Human-readable, version-controllable  
✅ **Validation at build time** - Catch errors early  
✅ **Template flexibility** - Easy to customize outputs  
✅ **Multi-machine support** - Different configs per board  
✅ **Reusable across projects** - Copy and use anywhere  
✅ **Production-ready** - Error handling, logging, documentation  

---

## 🚀 Next Steps

1. **Copy** the `recipes-network/` directory to your layer
2. **Create** a `network.json` configuration file
3. **Enable** the class in your recipe/image
4. **Build** and test
5. **Deploy** to your devices

---

## 💡 Tips

- Use `validate-network-config.py` in CI/CD pipelines
- Keep configurations in git for version control
- Test locally with `validate-network-config.py` before building
- Use machine-specific configs for different devices
- Template files are optional (defaults provided)

---

**Status**: ✅ Production Ready | **Version**: 1.0 | **License**: MIT
