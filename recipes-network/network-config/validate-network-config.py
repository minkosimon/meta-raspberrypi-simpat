#!/usr/bin/env python3
"""
Network Configuration Validator Tool

Validates network.json files against schema.json before building.
Useful for development and CI/CD pipelines.

Usage:
    python3 validate-network-config.py network.json schema.json
    python3 validate-network-config.py --help
"""

import json
import sys
import argparse
from pathlib import Path


def load_json(filepath):
    """Load and parse JSON file."""
    try:
        with open(filepath, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Error: File not found: {filepath}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in {filepath}: {e}")
        sys.exit(1)


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
    
    # Validate each interface
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
    
    # Required fields
    if 'name' not in iface:
        errors.append(f"Interface {index}: missing 'name' field")
        return errors
    
    name = iface['name']
    
    # Name validation
    if not isinstance(name, str) or len(name) == 0:
        errors.append(f"Interface {index}: 'name' must be a non-empty string")
    
    # VLAN specific validation
    if iface.get('kind') == 'vlan':
        if 'id' not in iface and 'vlan_id' not in iface:
            errors.append(f"Interface {name}: VLAN must have 'id' field")
        if 'link' not in iface:
            errors.append(f"Interface {name}: VLAN must have 'link' (parent interface)")
    
    # Bridge/Bond specific validation
    if iface.get('kind') in ('bridge', 'bond'):
        members = iface.get('members', iface.get('interfaces', []))
        if not members:
            errors.append(f"Interface {name}: {iface.get('kind')} must have members")
    
    # IP addressing validation
    if iface.get('ipv4'):
        for addr in iface['ipv4']:
            if not isinstance(addr, str) or '/' not in addr:
                errors.append(f"Interface {name}: invalid IPv4 address '{addr}' (use CIDR: 192.168.1.0/24)")
    
    if iface.get('ipv6'):
        for addr in iface['ipv6']:
            if not isinstance(addr, str) or ':' not in addr:
                errors.append(f"Interface {name}: invalid IPv6 address '{addr}'")
    
    # Mutual exclusivity: dhcp vs static
    if (iface.get('dhcp4') or iface.get('dhcp6')) and (iface.get('ipv4') or iface.get('ipv6')):
        errors.append(f"Interface {name}: cannot mix DHCP and static addressing")
    
    # Gateway validation without static IP
    if iface.get('gateway4') and not iface.get('ipv4') and not iface.get('dhcp4'):
        errors.append(f"Interface {name}: gateway4 set but no IPv4 configuration")
    
    return errors


def validate_with_jsonschema(config, schema):
    """Validate config against JSON Schema."""
    try:
        import jsonschema
    except ImportError:
        print("Warning: jsonschema not installed, skipping schema validation")
        print("Install with: pip install jsonschema")
        return []
    
    errors = []
    try:
        jsonschema.validate(instance=config, schema=schema)
    except jsonschema.ValidationError as e:
        errors.append(f"Schema validation: {e.message}")
    except jsonschema.SchemaError as e:
        errors.append(f"Invalid schema: {e.message}")
    
    return errors


def print_interface_summary(config):
    """Print summary of interfaces in config."""
    print("\nInterface Summary:")
    print("-" * 60)
    
    for iface in config.get('interfaces', []):
        name = iface.get('name', '?')
        kind = iface.get('kind', 'ethernet')
        
        addressing = []
        if iface.get('dhcp4'):
            addressing.append('DHCPv4')
        if iface.get('dhcp6'):
            addressing.append('DHCPv6')
        if iface.get('ipv4'):
            addressing.extend(iface['ipv4'])
        if iface.get('ipv6'):
            addressing.extend(iface['ipv6'])
        
        addr_str = ', '.join(addressing) if addressing else 'None'
        
        print(f"  {name:12} | {kind:10} | {addr_str}")
    
    print("-" * 60)


def main():
    parser = argparse.ArgumentParser(
        description='Validate network configuration JSON files',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 validate-network-config.py network.json
  python3 validate-network-config.py network.json schema.json
  python3 validate-network-config.py --check-all *.json
        """
    )
    
    parser.add_argument('config', help='Network configuration JSON file')
    parser.add_argument('schema', nargs='?', help='JSON Schema file (optional)')
    parser.add_argument('-v', '--verbose', action='store_true', help='Verbose output')
    parser.add_argument('--check-all', nargs='+', help='Check multiple config files')
    
    args = parser.parse_args()
    
    # Handle multiple files
    if args.check_all:
        all_valid = True
        for config_file in args.check_all:
            print(f"\nChecking: {config_file}")
            valid = validate_file(config_file, args.schema, args.verbose)
            all_valid = all_valid and valid
        
        sys.exit(0 if all_valid else 1)
    
    # Single file validation
    valid = validate_file(args.config, args.schema, args.verbose)
    sys.exit(0 if valid else 1)


def validate_file(config_file, schema_file=None, verbose=False):
    """Validate a single configuration file."""
    print(f"Loading configuration: {config_file}")
    config = load_json(config_file)
    
    errors = []
    
    # Syntax validation
    print("Validating syntax...")
    syntax_errors = validate_syntax(config)
    errors.extend(syntax_errors)
    
    # Schema validation (if provided)
    if schema_file:
        print(f"Loading schema: {schema_file}")
        schema = load_json(schema_file)
        print("Validating against schema...")
        schema_errors = validate_with_jsonschema(config, schema)
        errors.extend(schema_errors)
    
    # Print summary
    print_interface_summary(config)
    
    # Results
    if errors:
        print("\n❌ VALIDATION FAILED\n")
        for i, error in enumerate(errors, 1):
            print(f"  {i}. {error}")
        return False
    else:
        print("\n✅ VALIDATION PASSED\n")
        if verbose:
            print(f"Configuration: {config_file}")
            print(f"Version: {config.get('version', 'unknown')}")
            print(f"Hostname: {config.get('hostname', 'not set')}")
            print(f"Interfaces: {len(config.get('interfaces', []))}")
        return True


if __name__ == '__main__':
    main()
