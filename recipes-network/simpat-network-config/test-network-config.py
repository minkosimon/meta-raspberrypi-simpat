#!/usr/bin/env python3
"""
Unit tests for network configuration validation

Run with: python3 -m pytest test-network-config.py -v
"""

import json
import tempfile
from pathlib import Path
import sys

# Simple validation functions for tests
def validate_syntax(config):
    """Validate basic JSON syntax and structure."""
    errors = []
    
    if not isinstance(config, dict):
        errors.append("Config must be a JSON object")
        return errors
    
    if 'interfaces' not in config:
        errors.append("Missing required 'interfaces' key")
    elif not isinstance(config['interfaces'], list):
        errors.append("'interfaces' must be an array")
    elif len(config['interfaces']) == 0:
        errors.append("'interfaces' must contain at least one interface")
    
    for i, iface in enumerate(config.get('interfaces', [])):
        iface_errors = validate_interface(iface, i)
        errors.extend(iface_errors)
    
    return errors


def validate_interface(iface, index):
    """Validate individual interface configuration."""
    errors = []
    
    if not isinstance(iface, dict):
        errors.append(f"Interface {index}: must be an object")
        return errors
    
    if 'name' not in iface:
        errors.append(f"Interface {index}: missing 'name' field")
        return errors
    
    name = iface['name']
    if not isinstance(name, str) or len(name) == 0:
        errors.append(f"Interface {index}: 'name' must be a non-empty string")
    
    if iface.get('kind') == 'vlan':
        if 'id' not in iface and 'vlan_id' not in iface:
            errors.append(f"Interface {name}: VLAN must have 'id' field")
        if 'link' not in iface:
            errors.append(f"Interface {name}: VLAN must have 'link' (parent interface)")
    
    if iface.get('kind') in ('bridge', 'bond'):
        members = iface.get('members', iface.get('interfaces', []))
        if not members:
            errors.append(f"Interface {name}: {iface.get('kind')} must have members")
    
    if iface.get('ipv4'):
        for addr in iface['ipv4']:
            if not isinstance(addr, str) or '/' not in addr:
                errors.append(f"Interface {name}: invalid IPv4 address '{addr}' (use CIDR: 192.168.1.0/24)")
    
    if (iface.get('dhcp4') or iface.get('dhcp6')) and (iface.get('ipv4') or iface.get('ipv6')):
        errors.append(f"Interface {name}: cannot mix DHCP and static addressing")
    
    if iface.get('gateway4') and not iface.get('ipv4') and not iface.get('dhcp4'):
        errors.append(f"Interface {name}: gateway4 set but no IPv4 configuration")
    
    return errors


class TestNetworkConfig:
    """Test network configuration validation."""
    
    def test_simple_dhcp_config(self):
        """Test basic DHCP configuration."""
        config = {
            "interfaces": [
                {
                    "name": "eth0",
                    "dhcp4": True
                }
            ]
        }
        errors = validate_syntax(config)
        assert len(errors) == 0, f"Unexpected errors: {errors}"
    
    def test_static_ip_config(self):
        """Test static IP configuration."""
        config = {
            "interfaces": [
                {
                    "name": "eth0",
                    "ipv4": ["192.168.1.100/24"],
                    "gateway4": "192.168.1.1"
                }
            ]
        }
        errors = validate_syntax(config)
        assert len(errors) == 0, f"Unexpected errors: {errors}"
    
    def test_vlan_config(self):
        """Test VLAN configuration."""
        config = {
            "interfaces": [
                {"name": "eth0", "kind": "ethernet"},
                {
                    "name": "vlan10",
                    "kind": "vlan",
                    "id": 10,
                    "link": "eth0",
                    "dhcp4": True
                }
            ]
        }
        errors = validate_syntax(config)
        assert len(errors) == 0, f"Unexpected errors: {errors}"
    
    def test_bridge_config(self):
        """Test bridge configuration."""
        config = {
            "interfaces": [
                {"name": "eth0", "kind": "ethernet"},
                {
                    "name": "br0",
                    "kind": "bridge",
                    "members": ["eth0"],
                    "dhcp4": True
                }
            ]
        }
        errors = validate_syntax(config)
        assert len(errors) == 0, f"Unexpected errors: {errors}"
    
    def test_bond_config(self):
        """Test bond configuration."""
        config = {
            "interfaces": [
                {"name": "eth0", "kind": "ethernet"},
                {"name": "eth1", "kind": "ethernet"},
                {
                    "name": "bond0",
                    "kind": "bond",
                    "mode": "active-backup",
                    "members": ["eth0", "eth1"],
                    "dhcp4": True
                }
            ]
        }
        errors = validate_syntax(config)
        assert len(errors) == 0, f"Unexpected errors: {errors}"
    
    def test_missing_interfaces(self):
        """Test error on missing interfaces."""
        config = {}
        errors = validate_syntax(config)
        assert any("interfaces" in e for e in errors), "Should error on missing interfaces"
    
    def test_vlan_without_id(self):
        """Test error on VLAN without ID."""
        config = {
            "interfaces": [
                {
                    "name": "vlan10",
                    "kind": "vlan",
                    "link": "eth0"
                    # Missing 'id'
                }
            ]
        }
        errors = validate_syntax(config)
        assert any("VLAN" in e and "id" in e for e in errors), "Should error on missing VLAN id"
    
    def test_bridge_without_members(self):
        """Test error on bridge without members."""
        config = {
            "interfaces": [
                {
                    "name": "br0",
                    "kind": "bridge"
                    # Missing members
                }
            ]
        }
        errors = validate_syntax(config)
        assert any("members" in e.lower() for e in errors), "Should error on missing bridge members"
    
    def test_invalid_ipv4_cidr(self):
        """Test error on invalid IPv4 CIDR."""
        config = {
            "interfaces": [
                {
                    "name": "eth0",
                    "ipv4": ["192.168.1.100"]  # Missing /24
                }
            ]
        }
        errors = validate_syntax(config)
        assert any("IPv4" in e for e in errors), "Should error on invalid IPv4 CIDR"
    
    def test_dhcp_and_static_conflict(self):
        """Test error on mixing DHCP and static IP."""
        config = {
            "interfaces": [
                {
                    "name": "eth0",
                    "dhcp4": True,
                    "ipv4": ["192.168.1.100/24"]  # Can't mix DHCP and static
                }
            ]
        }
        errors = validate_syntax(config)
        assert any("mix" in e.lower() for e in errors), "Should error on DHCP + static mix"
    
    def test_multiple_interfaces(self):
        """Test complex multi-interface config."""
        config = {
            "version": "1.0",
            "hostname": "test-device",
            "interfaces": [
                {"name": "eth0", "kind": "ethernet"},
                {"name": "eth1", "kind": "ethernet"},
                {
                    "name": "vlan10",
                    "kind": "vlan",
                    "id": 10,
                    "link": "eth0",
                    "dhcp4": True
                },
                {
                    "name": "bridge0",
                    "kind": "bridge",
                    "members": ["vlan10"],
                    "ipv4": ["192.168.1.1/24"]
                },
                {
                    "name": "bond0",
                    "kind": "bond",
                    "members": ["eth1"],
                    "mode": "active-backup",
                    "dhcp4": True
                }
            ]
        }
        errors = validate_syntax(config)
        assert len(errors) == 0, f"Unexpected errors: {errors}"


def run_tests():
    """Run all tests manually without pytest."""
    test_obj = TestNetworkConfig()
    tests = [
        (test_obj.test_simple_dhcp_config, "Simple DHCP config"),
        (test_obj.test_static_ip_config, "Static IP config"),
        (test_obj.test_vlan_config, "VLAN config"),
        (test_obj.test_bridge_config, "Bridge config"),
        (test_obj.test_bond_config, "Bond config"),
        (test_obj.test_missing_interfaces, "Missing interfaces error"),
        (test_obj.test_vlan_without_id, "VLAN without ID error"),
        (test_obj.test_bridge_without_members, "Bridge without members error"),
        (test_obj.test_invalid_ipv4_cidr, "Invalid IPv4 CIDR error"),
        (test_obj.test_dhcp_and_static_conflict, "DHCP + static conflict error"),
        (test_obj.test_multiple_interfaces, "Multiple interfaces config"),
    ]
    
    passed = 0
    failed = 0
    
    print("Running Network Configuration Tests\n" + "=" * 50)
    
    for test_func, test_name in tests:
        try:
            test_func()
            print(f"✅ {test_name}")
            passed += 1
        except AssertionError as e:
            print(f"❌ {test_name}")
            print(f"   Error: {e}")
            failed += 1
        except Exception as e:
            print(f"❌ {test_name}")
            print(f"   Exception: {e}")
            failed += 1
    
    print("=" * 50)
    print(f"Results: {passed} passed, {failed} failed\n")
    
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(run_tests())
