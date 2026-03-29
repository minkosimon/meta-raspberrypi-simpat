# Network Configuration Management Class

## Overview

The `network-config` class provides a complete solution for managing systemd-networkd configuration in Yocto builds. It enables:

- **Declarative Configuration**: Define network interfaces in JSON format
- **Validation**: Automatic JSON Schema validation
- **Template Rendering**: Jinja2 templates for flexibility
- **Multi-Machine Support**: Different configs per machine/board
- **Type Support**: Ethernet, VLAN, Bridge, Bond, Loopback

## Architecture

```
network.json (user config)
        ↓
    [Validation: schema.json]
        ↓
    Python:expand_network_config()
        ↓
    [Jinja2 Template Rendering]
        ↓
    Generated systemd-networkd files
        ↓
    rootfs:/etc/systemd/network/
```

## Quick Start

### 1. Create Network Configuration

Create a JSON file (e.g., `network.json`):

```json
{
  "version": "1.0",
  "hostname": "my-device",
  "interfaces": [
    {
      "name": "eth0",
      "kind": "ethernet",
      "dhcp4": true,
      "mtu": 1500
    }
  ]
}
```

### 2. Use in Recipe

```bitbake
inherit network-config

SRC_URI += "file://network.json"
NETWORK_CONFIG_JSON = "network.json"
```

### 3. Build

```bash
bitbake your-image
```

## Configuration Examples

### Simple DHCP

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

### Static IP

```json
{
  "interfaces": [
    {
      "name": "eth0",
      "ipv4": ["192.168.1.100/24"],
      "gateway4": "192.168.1.1",
      "dns": ["8.8.8.8", "8.8.4.4"]
    }
  ]
}
```

### VLAN

```json
{
  "interfaces": [
    {
      "name": "eth0",
      "kind": "ethernet"
    },
    {
      "name": "vlan10",
      "kind": "vlan",
      "id": 10,
      "link": "eth0",
      "ipv4": ["192.168.10.100/24"]
    }
  ]
}
```

### Bridge

```json
{
  "interfaces": [
    {
      "name": "eth0",
      "kind": "ethernet"
    },
    {
      "name": "eth1",
      "kind": "ethernet"
    },
    {
      "name": "br0",
      "kind": "bridge",
      "members": ["eth0", "eth1"],
      "dhcp4": true,
      "stp": true
    }
  ]
}
```

### Bond (Active-Backup)

```json
{
  "interfaces": [
    {
      "name": "eth0",
      "kind": "ethernet"
    },
    {
      "name": "eth1",
      "kind": "ethernet"
    },
    {
      "name": "bond0",
      "kind": "bond",
      "mode": "active-backup",
      "members": ["eth0", "eth1"],
      "primary": "eth0",
      "miimon": 100,
      "dhcp4": true
    }
  ]
}
```

### Complex Multi-VLAN Setup

```json
{
  "version": "1.0",
  "hostname": "industrial-device",
  "global": {
    "dns": ["8.8.8.8", "1.1.1.1"],
    "ntp": ["pool.ntp.org"]
  },
  "interfaces": [
    {
      "name": "eth0",
      "kind": "ethernet",
      "description": "Primary Link"
    },
    {
      "name": "vlan1",
      "kind": "vlan",
      "id": 1,
      "link": "eth0",
      "description": "Management VLAN",
      "dhcp4": true
    },
    {
      "name": "vlan100",
      "kind": "vlan",
      "id": 100,
      "link": "eth0",
      "description": "Data VLAN",
      "ipv4": ["192.168.100.10/24"],
      "gateway4": "192.168.100.1"
    },
    {
      "name": "vlan200",
      "kind": "vlan",
      "id": 200,
      "link": "eth0",
      "description": "IoT VLAN",
      "ipv4": ["10.0.0.10/24"],
      "gateway4": "10.0.0.1"
    }
  ]
}
```

## Multi-Machine Setup

### Directory Structure

```
recipes-network/
 ├── network-config/
 │    ├── network-config_1.0.bb
 │    ├── files/
 │    │    ├── schema.json
 │    │    ├── templates/
 │    │    │    ├── network.j2
 │    │    │    ├── netdev.j2
 │    │    │    └── link.j2
 │    │    └── configs/
 │    │         ├── network-board-a.json
 │    │         ├── network-board-b.json
 │    │         └── network-board-c.json
```

### Recipe Configuration

```bitbake
inherit network-config

SRC_URI += "file://schema.json \
            file://templates/network.j2 \
            file://templates/netdev.j2 \
            file://templates/link.j2 \
            file://configs/network-board-a.json \
            file://configs/network-board-b.json \
            file://configs/network-board-c.json"

# Machine-specific selection
NETWORK_CONFIG_JSON:board-a = "network-board-a.json"
NETWORK_CONFIG_JSON:board-b = "network-board-b.json"
NETWORK_CONFIG_JSON:board-c = "network-board-c.json"

# Default fallback
NETWORK_CONFIG_JSON ?= "network-board-a.json"
```

### Build for Specific Machine

```bash
# Build for board-a
MACHINE=board-a bitbake your-image

# Build for board-b
MACHINE=board-b bitbake your-image
```

## Debugging

### Check Generated Files

```bash
# During build, check the WORKDIR
find tmp/work/*/network-config-*/WORKDIR/networkd-config/

# Or after installation
systemctl --root=/path/to/rootfs list-unit-files --type=network
```

### View Generated Configuration

```bash
cat /etc/systemd/network/10-eth0.network
cat /etc/systemd/network/20-vlan10.netdev
```

### Validate Configuration at Runtime

```bash
# Check networkd unit files (requires systemd)
networkctl status
networkctl list

# Debug networkd
journalctl -u systemd-networkd -f
```

### BitBake Debug

```bash
# Enable verbose output
bitbake -vDDD network-config

# Check Python task execution
bitbake -b network-config -e | grep -A 5 do_generate_networkd_config
```

## Schema Reference

### Interface Types

| Kind | Purpose | Members | Parent |
|------|---------|---------|--------|
| `ethernet` | Physical NIC | - | - |
| `vlan` | Virtual LAN | - | eth0 |
| `bridge` | Bridge device | Interfaces | - |
| `bond` | Bonded links | Interfaces | - |
| `loopback` | Loopback | - | - |

### Bond Modes

- `balance-rr`: Round-robin (default)
- `active-backup`: Active-backup (one link active at a time)
- `balance-xor`: XOR-based (static aggregation)
- `broadcast`: Broadcast (all links)
- `802.3ad`: LACP (IEEE 802.3ad)
- `balance-tlb`: Transmit load balancing
- `balance-alb`: Adaptive load balancing

### IPv4/IPv6 Addressing

Addresses must be in CIDR notation:
- IPv4: `192.168.1.100/24`
- IPv6: `2001:db8::1/64`

## Customization

### Add Custom Template

1. Create new template file: `templates/custom.j2`
2. Modify bbclass to process it
3. Example: Create firewall rules template

### Extend JSON Schema

Modify `schema.json` to add custom properties:

```json
{
  "properties": {
    "firewall": {
      "type": "object",
      "description": "Custom firewall settings"
    }
  }
}
```

## Performance Considerations

- Generation happens at **build time** (not runtime)
- No runtime parsing overhead
- Pre-generated files included in image
- Schema validation at build time catches errors early

## Troubleshooting

### Validation Fails

Check JSON syntax and schema constraints:
- All required fields present
- Correct data types
- Valid enum values (bond modes, interface kinds)

### Files Not Generated

1. Verify `NETWORK_CONFIG_JSON` is set
2. Check file exists in SRC_URI
3. Inspect BitBake log: `bitbake -vv network-config`

### Configuration Not Applied at Runtime

1. Ensure `systemd-networkd` is enabled: `systemctl enable systemd-networkd`
2. Check file permissions in `/etc/systemd/network/`
3. Restart networkd: `systemctl restart systemd-networkd`
4. Monitor: `journalctl -u systemd-networkd -f`

## License

MIT License - See COPYING.MIT
