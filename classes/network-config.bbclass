# Network Configuration Management Class for systemd-networkd
# 
# This class provides:
# - JSON parsing and validation (JSON Schema)
# - Network interface configuration logic
# - Support for: DHCP, static IP, VLAN, bridges, bonds
# - Jinja2 template rendering to systemd-networkd format
#
# Usage:
#   inherit network-config
#   NETWORK_CONFIG_JSON = "network-config.json"

# ============================================================================
# BitBake Task: do_generate_networkd_config
# ============================================================================

python do_generate_networkd_config() {
    """
    Main task to generate systemd-networkd configuration files.
    """
    import json
    from pathlib import Path
    from jinja2 import Template, Environment, FileSystemLoader
    
    def validate_network_config(config_path, schema_path):
        """Validate network configuration against JSON Schema."""
        try:
            import jsonschema
        except ImportError:
            bb.warn("jsonschema not available, skipping validation")
            with open(config_path, 'r') as f:
                return json.load(f)
        
        with open(config_path, 'r') as f:
            config = json.load(f)
        
        with open(schema_path, 'r') as f:
            schema = json.load(f)
        
        try:
            jsonschema.validate(instance=config, schema=schema)
            bb.debug(3, f"Network config validated successfully: {config_path}")
            return config
        except jsonschema.exceptions.ValidationError as e:
            bb.error(f"Network config validation failed: {e.message}")
            raise
    
    def expand_network_config(config):
        """Expand network configuration with computed values."""
        interfaces = config.get('interfaces', [])
        iface_map = {iface['name']: iface for iface in interfaces}
        
        for iface in interfaces:
            if iface.get('kind') == 'vlan':
                iface.setdefault('vlan_id', iface.get('id', 0))
                iface.setdefault('link', 'eth0')
            elif iface.get('kind') == 'bridge':
                members = iface.get('members', iface.get('interfaces', []))
                iface['members'] = members
                iface.setdefault('stp', False)
                iface.setdefault('cost', {})
            elif iface.get('kind') == 'bond':
                members = iface.get('members', iface.get('interfaces', []))
                iface['members'] = members
                iface.setdefault('mode', 'balance-alb')
                iface.setdefault('miimon', 100)
            
            iface.setdefault('dhcp4', False)
            iface.setdefault('dhcp6', False)
            iface.setdefault('mtu', 1500)
        
        return config
    
    def render_interface_config(interface, template_dir, output_dir, index):
        """Render configuration files for a single interface."""
        name = interface.get('name')
        kind = interface.get('kind', 'ethernet')
        
        # Look for templates in WORKDIR and THISDIR
        for search_dir in [template_dir, Path(d.getVar('WORKDIR')) / 'templates']:
            if search_dir.exists():
                try:
                    env = Environment(loader=FileSystemLoader(str(search_dir)))
                    break
                except:
                    continue
        else:
            bb.warn(f"Template directory not found: {template_dir}")
            return
        
        # Generate .network file
        network_template_path = template_dir / 'network.j2'
        if network_template_path.exists():
            try:
                template = env.get_template('network.j2')
                content = template.render(interface=interface, index=index, kind=kind)
                output_file = output_dir / f'{index:02d}-{name}.network'
                output_file.write_text(content)
                bb.debug(1, f"Generated: {output_file.name}")
            except Exception as e:
                bb.warn(f"Failed to render network template for {name}: {e}")
        
        # Generate .netdev file for virtual interfaces
        if kind in ('vlan', 'bridge', 'bond'):
            netdev_template_path = template_dir / 'netdev.j2'
            if netdev_template_path.exists():
                try:
                    template = env.get_template('netdev.j2')
                    content = template.render(interface=interface, index=index, kind=kind)
                    output_file = output_dir / f'{index:02d}-{name}.netdev'
                    output_file.write_text(content)
                    bb.debug(1, f"Generated: {output_file.name}")
                except Exception as e:
                    bb.warn(f"Failed to render netdev template for {name}: {e}")
        
        # Generate .link file
        link_template_path = template_dir / 'link.j2'
        if link_template_path.exists():
            try:
                template = env.get_template('link.j2')
                content = template.render(interface=interface, index=index)
                output_file = output_dir / f'{index:02d}-{name}.link'
                output_file.write_text(content)
                bb.debug(1, f"Generated: {output_file.name}")
            except Exception as e:
                bb.debug(2, f"No .link file for {name}: {e}")
    
    # Main task logic
    workdir = Path(d.getVar('WORKDIR'))
    staging = workdir / 'networkd-config'
    staging.mkdir(parents=True, exist_ok=True)
    
    config_file = d.getVar('NETWORK_CONFIG_JSON')
    if not config_file:
        bb.warn("NETWORK_CONFIG_JSON not set, skipping network config generation")
        return
    
    # Look for config file in WORKDIR first (fetched from SRC_URI)
    config_path = workdir / config_file
    schema_path = workdir / 'schema.json'
    template_dir = workdir / 'templates'
    
    # Fallback to THISDIR for local files
    if not config_path.exists():
        config_path = Path(d.getVar('THISDIR')) / 'files' / config_file
    if not schema_path.exists():
        schema_path = Path(d.getVar('THISDIR')) / 'files' / 'schema.json'
    if not template_dir.exists():
        template_dir = Path(d.getVar('THISDIR')) / 'files' / 'templates'
    
    if not config_path.exists():
        bb.error(f"Network config not found: {config_path}")
        raise Exception(f"Missing network config: {config_path}")
    
    
    if not schema_path.exists():
        bb.warn(f"Schema not found, skipping validation: {schema_path}")
        config = json.loads(config_path.read_text())
    else:
        config = validate_network_config(str(config_path), str(schema_path))
    
    config = expand_network_config(config)
    
    iface_index = 10
    for interface in config.get('interfaces', []):
        render_interface_config(interface, template_dir, staging, iface_index)
        iface_index += 1
    
    d.setVar('NETWORKD_CONFIG_DIR', str(staging))
    bb.debug(1, f"Network config generated in: {staging}")

}

# ============================================================================
# BitBake Task: do_install
# ============================================================================

do_install() {
    # Only install if network config was generated
    if [ -d "${WORKDIR}/networkd-config" ] && [ "$(ls -A ${WORKDIR}/networkd-config)" ]; then
        install -d ${D}${systemd_system_unitdir}/network
        install -m 0644 ${WORKDIR}/networkd-config/* ${D}${systemd_system_unitdir}/network/
        bbnote "Installed network configuration files to ${D}${systemd_system_unitdir}/network/"
    fi
}

# ============================================================================
# Package Dependencies
# ============================================================================
RDEPENDS:${PN} += "systemd"

# ============================================================================
# Task Flags and Dependencies
# ============================================================================

addtask do_generate_networkd_config before do_install

# Don't create RPMS/DEBS for this
INHIBIT_DEFAULT_LIBS = "1"
INHIBIT_PACKAGE_STRIP = "1"
INHIBIT_SYSROOT_STAGING = "1"

# Files to include in packages
FILES:${PN} = "${systemd_system_unitdir}/network/*"

# Package metadata
SUMMARY = "Network configuration for systemd-networkd"
DESCRIPTION = "Generates systemd-networkd configuration files from JSON templates"
