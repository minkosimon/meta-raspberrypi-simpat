# Use Cases and Practical Examples

## Use Case 1: Simple Embedded Device (IoT Node)

**Scenario**: Single Ethernet, DHCP from corporate network

**network.json**:
```json
{
  "version": "1.0",
  "hostname": "iot-node-01",
  "interfaces": [
    {
      "name": "eth0",
      "dhcp4": true,
      "dns": ["8.8.8.8", "8.8.4.4"],
      "mtu": 1500
    }
  ]
}
```

**Recipe Integration**:
```bitbake
inherit network-config
SRC_URI += "file://network.json"
NETWORK_CONFIG_JSON = "network.json"
```

---

## Use Case 2: Industrial Gateway (Multi-Network)

**Scenario**: 
- WAN: DHCP from ISP
- LAN1: Static IP for factory automation
- LAN2: VLAN for remote monitoring

**network.json**:
```json
{
  "version": "1.0",
  "hostname": "factory-gateway",
  "interfaces": [
    {
      "name": "eth0",
      "kind": "ethernet",
      "description": "WAN (ISP Link)",
      "dhcp4": true,
      "mtu": 1500
    },
    {
      "name": "eth1",
      "kind": "ethernet",
      "description": "LAN1 (Factory)",
      "ipv4": ["192.168.1.1/24"],
      "mtu": 1500
    },
    {
      "name": "vlan50",
      "kind": "vlan",
      "description": "Remote VPN VLAN",
      "id": 50,
      "link": "eth0",
      "ipv4": ["10.0.50.1/24"],
      "mtu": 1500
    }
  ]
}
```

**Recipe**:
```bitbake
inherit network-config
SRC_URI += "file://network.json"
NETWORK_CONFIG_JSON = "network.json"
RDEPENDS:${PN} += "iproute2 iptables"
```

---

## Use Case 3: Redundant Network (HA Setup)

**Scenario**: High-availability system with bond + bridge

**network.json**:
```json
{
  "version": "1.0",
  "hostname": "ha-server",
  "global": {
    "dns": ["8.8.8.8", "1.1.1.1"],
    "ntp": ["pool.ntp.org"]
  },
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
      "name": "eth2",
      "kind": "ethernet"
    },
    {
      "name": "bond0",
      "kind": "bond",
      "description": "LACP Bond",
      "mode": "802.3ad",
      "members": ["eth0", "eth1"],
      "miimon": 100
    },
    {
      "name": "br0",
      "kind": "bridge",
      "description": "Management Bridge",
      "members": ["vlan1"],
      "stp": true,
      "forward_delay": 15
    },
    {
      "name": "vlan1",
      "kind": "vlan",
      "id": 1,
      "link": "bond0",
      "ipv4": ["192.168.1.100/24"],
      "gateway4": "192.168.1.1",
      "dns": ["8.8.8.8"]
    }
  ]
}
```

---

## Use Case 4: Multi-Machine Support

**Directory Structure**:
```
meta-production/
 ├── conf/
 │    ├── layer.conf
 │    └── machine/
 │         ├── server-v1.conf
 │         ├── server-v2.conf
 │         └── gateway.conf
 └── recipes-network/
      └── network-config/
           ├── network-config_1.0.bb
           ├── files/
           │    ├── schema.json
           │    ├── templates/
           │    │    ├── network.j2
           │    │    ├── netdev.j2
           │    │    └── link.j2
           │    └── configs/
           │         ├── net-server-v1.json
           │         ├── net-server-v2.json
           │         └── net-gateway.json
```

**Recipe** (recipes-network/network-config/network-config_1.0.bb):
```bitbake
inherit network-config

SRC_URI += " \
    file://schema.json \
    file://templates/network.j2 \
    file://templates/netdev.j2 \
    file://templates/link.j2 \
    file://configs/net-server-v1.json \
    file://configs/net-server-v2.json \
    file://configs/net-gateway.json \
"

# Machine configuration selection
NETWORK_CONFIG_JSON:server-v1 = "net-server-v1.json"
NETWORK_CONFIG_JSON:server-v2 = "net-server-v2.json"
NETWORK_CONFIG_JSON:gateway = "net-gateway.json"

# Default
NETWORK_CONFIG_JSON ?= "net-server-v1.json"

FILES:${PN} = "${systemd_system_unitdir}/network/*"
RDEPENDS:${PN} += "systemd"
```

---

## Use Case 5: Development vs Production

**Scenario**: Different network configs for dev and prod builds

**Recipe approach**:
```bitbake
# network-config-dev_1.0.bb
inherit network-config
SRC_URI += "file://network-dev.json"
NETWORK_CONFIG_JSON = "network-dev.json"

# network-config-prod_1.0.bb
inherit network-config
SRC_URI += "file://network-prod.json"
NETWORK_CONFIG_JSON = "network-prod.json"
```

**Image recipe**:
```bitbake
require recipes-core/images/core-image-minimal.bb

# Development build
IMAGE_INSTALL:append = "network-config-dev"

# OR for production (uncomment for prod build)
# IMAGE_INSTALL:append = "network-config-prod"
```

**Build commands**:
```bash
# Development
bitbake my-image

# Production
grep -q network-config-dev my-image.bb && sed -i 's/network-config-dev/network-config-prod/' my-image.bb
bitbake my-image
```

---

## Use Case 6: Container Host Network

**Scenario**: Docker/Kubernetes host with custom networking

**network.json**:
```json
{
  "version": "1.0",
  "hostname": "k3s-node",
  "interfaces": [
    {
      "name": "eth0",
      "description": "Primary (Kubernetes)",
      "dhcp4": true,
      "mtu": 1500
    },
    {
      "name": "docker0",
      "description": "Docker bridge (auto-managed)",
      "ipv4": ["172.17.0.1/16"],
      "mtu": 1500
    },
    {
      "name": "cni0",
      "description": "CNI bridge (Kubernetes)",
      "ipv4": ["10.42.0.1/24"],
      "mtu": 1500
    }
  ]
}
```

---

## Use Case 7: VPN Gateway Setup

**Scenario**: OpenVPN/WireGuard gateway with multiple VLANs

**network.json**:
```json
{
  "version": "1.0",
  "hostname": "vpn-gateway",
  "interfaces": [
    {
      "name": "eth0",
      "dhcp4": true,
      "description": "WAN"
    },
    {
      "name": "vlan10",
      "kind": "vlan",
      "id": 10,
      "link": "eth0",
      "ipv4": ["10.0.10.1/24"],
      "description": "Internal VPN Network"
    },
    {
      "name": "vlan20",
      "kind": "vlan",
      "id": 20,
      "link": "eth0",
      "ipv4": ["10.0.20.1/24"],
      "description": "DMZ"
    },
    {
      "name": "tun0",
      "kind": "ethernet",
      "ipv4": ["10.8.0.1/24"],
      "description": "OpenVPN TUN"
    }
  ]
}
```

---

## Testing and Validation

### Pre-Build Validation

```bash
# Validate configuration before build
python3 validate-network-config.py network.json schema.json

# Verbose check
python3 validate-network-config.py network.json schema.json -v

# Check multiple files
python3 validate-network-config.py --check-all *.json
```

### Post-Build Verification

```bash
# After flashing to device
ssh root@device

# Check generated files
ls -la /etc/systemd/network/
file /etc/systemd/network/*.network

# Verify contents
cat /etc/systemd/network/10-eth0.network

# Network status
networkctl status
networkctl list-links

# Debug
journalctl -u systemd-networkd -f
```

### CI/CD Integration

```bash
#!/bin/bash
# ci-validate-network.sh

set -e

echo "Validating network configurations..."
for config in recipes-network/*/files/configs/*.json; do
    echo "  Checking $config..."
    python3 validate-network-config.py "$config" \
        recipes-network/*/files/schema.json || exit 1
done

echo "✅ All configurations valid"
```

---

## Troubleshooting Guide

### Config Not Applied

**Symptom**: Files generated but not applied at boot

**Solutions**:
```bash
# Verify systemd-networkd is enabled
systemctl is-enabled systemd-networkd
systemctl enable systemd-networkd

# Restart service
systemctl restart systemd-networkd

# Check logs
journalctl -u systemd-networkd -n 100
```

### Invalid Interface Name

**Symptom**: `ValidationError: name must match pattern`

**Solution**: Interface names must be alphanumeric + dash/underscore/dot
- ✅ Valid: `eth0`, `vlan10`, `bond0`, `br-mgmt`
- ❌ Invalid: `eth@0`, `VLAN-10`, `my eth`

### DHCP + Static Conflict

**Symptom**: Build succeeds but interface won't configure

**Solution**: Cannot mix DHCP and static addressing on same interface
```json
{
  "interfaces": [
    {
      "name": "eth0",
      "dhcp4": true           // Either DHCP
      // OR
      // "ipv4": ["192.168.1.10/24"]  // OR static, not both
    }
  ]
}
```

---

## Performance Tips

1. **Build once, deploy many**: Generate config at build time, not runtime
2. **Template reuse**: Share netdev.j2 for all virtual interfaces
3. **Validation offline**: Run validate-network-config.py before committing
4. **No circular dependencies**: Keep network-config independent

---

**Questions? Check:**
- README.md - Feature documentation
- INTEGRATION.md - Integration methods
- Files/schema.json - Allowed config options
