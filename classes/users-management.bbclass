inherit useradd

# Parse the JSON at variable-expansion time (not in an anonymous function)
# so the values are available when useradd's anonymous check runs.
def _users_mgmt_parse(d, section):
    import json, os
    json_file = d.getVar("USER_JSON_FILE")
    if not json_file or not os.path.exists(json_file):
        return ""
    with open(json_file) as f:
        data = json.load(f)

    defined_groups = set(data.get("groups", []))

    if section == "groupadd":
        return " ; ".join("-r %s" % g for g in data.get("groups", []))
    elif section == "useradd":
        params = []
        for user in data.get("users", []):
            name = user["name"]
            password = user["password"]
            # Escape $ signs to survive BitBake → shell double-quote expansion
            escaped_password = password.replace("$", r'\$')
            user_groups = user.get("groups", [])
            for g in user_groups:
                if g not in defined_groups:
                    bb.fatal("User '%s' references group '%s' which is not defined in the 'groups' list. "
                             "Add it to the 'groups' array in %s" % (name, g, json_file))
            groups = ",".join(user_groups)
            params.append("-m -p '%s' -G %s %s" % (escaped_password, groups, name))
        return " ; ".join(params)
    elif section == "ssh":
        ssh_data = []
        for user in data.get("users", []):
            name = user["name"]
            
            # Traiter les clés SSH depuis les fichiers
            if "ssh_key" in user:
                ssh_keys = user["ssh_key"]
                if isinstance(ssh_keys, str):
                    ssh_keys = [ssh_keys]
                
                for key_path in ssh_keys:
                    if os.path.exists(key_path):
                        try:
                            with open(key_path, 'r') as f:
                                key_content = f.read().strip()
                                if key_content:
                                    ssh_data.append("%s|%s" % (name, key_content))
                        except Exception as e:
                            bb.fatal("Impossible de lire la clé SSH %s: %s" % (key_path, str(e)))
                    else:
                        bb.fatal("Fichier de clé SSH non trouvé: %s" % key_path)
            
            # Traiter le fichier authorized_keys si spécifié
            if "authorized_key" in user:
                auth_file = user["authorized_key"]
                if os.path.exists(auth_file):
                    try:
                        with open(auth_file, 'r') as f:
                            for line in f:
                                line = line.strip()
                                if line and not line.startswith('#'):
                                    ssh_data.append("%s|%s" % (name, line))
                    except Exception as e:
                        bb.warn("Impossible de lire authorized_keys %s: %s" % (auth_file, str(e)))
                else:
                    bb.warn("Fichier authorized_keys non trouvé: %s" % auth_file)
            
            # Traiter les clés autorisées individuelles (rétrocompatibilité)
            for key in user.get("authorized_keys", []):
                if not key.startswith('/'):  # Si ce n'est pas un chemin
                    ssh_data.append("%s|%s" % (name, key))
        
        return " ".join(ssh_data)
    return ""

USERADD_PACKAGES = "${PN}"
GROUPADD_PACKAGES = "${PN}"
USERADD_PARAM:${PN} = "${@_users_mgmt_parse(d, 'useradd')}"
GROUPADD_PARAM:${PN} = "${@_users_mgmt_parse(d, 'groupadd')}"
USER_JSON_FILE_EXPANDED = "${USER_JSON_FILE}"

fakeroot python do_install_ssh_keys() {
    import json, os

    json_file = d.getVar("USER_JSON_FILE_EXPANDED")
    if not json_file or not os.path.exists(json_file):
        bb.fatal("Aucun fichier JSON de configuration utilisateur")
        return

    try:
        with open(json_file) as f:
            data = json.load(f)
    except Exception as e:
        bb.fatal("Impossible de lire le JSON: %s" % str(e))
        return

    dest = d.getVar("D")
    
    bb.debug(1, "Installation des clés SSH pour les utilisateurs définis dans %s" % json_file)  
    for user in data.get("users", []):
        username = user["name"]
        home_dir = os.path.join(dest, "home", username)
        ssh_dir = os.path.join(home_dir, ".ssh")
        
        import shutil

        os.makedirs(ssh_dir, exist_ok=True)

        # Copier les fichiers de clés SSH (privée et publique)
        if "ssh_key" in user:
            ssh_keys = user["ssh_key"]
            if isinstance(ssh_keys, str):
                ssh_keys = [ssh_keys]

            for key_path in ssh_keys:
                if os.path.exists(key_path):
                    dest_path = os.path.join(ssh_dir, os.path.basename(key_path))
                    shutil.copy2(key_path, dest_path)
                    if key_path.endswith(".pub"):
                        os.chmod(dest_path, 0o644)
                    else:
                        os.chmod(dest_path, 0o600)
                else:
                    bb.warn("Fichier de clé SSH non trouvé: %s" % key_path)

        # Copier le fichier authorized_keys
        if "authorized_key" in user:
            auth_file = user["authorized_key"]
            if os.path.exists(auth_file):
                dest_auth = os.path.join(ssh_dir, "authorized_keys")
                shutil.copy2(auth_file, dest_auth)
                os.chmod(dest_auth, 0o600)
            else:
                bb.warn("Fichier authorized_keys non trouvé: %s" % auth_file)

        os.chmod(ssh_dir, 0o700)

        # Copier le fichier .bashrc
        if "bashrc" in user:
            bashrc_src = user["bashrc"]
            if os.path.exists(bashrc_src):
                dest_bashrc = os.path.join(home_dir, ".bashrc")
                shutil.copy2(bashrc_src, dest_bashrc)
                os.chmod(dest_bashrc, 0o644)
            else:
                bb.warn("Fichier .bashrc non trouvé: %s" % bashrc_src)

        # Copier le fichier .bash_profile
        if "bash_profile" in user:
            bash_profile_src = user["bash_profile"]
            if os.path.exists(bash_profile_src):
                dest_profile = os.path.join(home_dir, ".bash_profile")
                shutil.copy2(bash_profile_src, dest_profile)
                os.chmod(dest_profile, 0o644)
            else:
                bb.warn("Fichier .bash_profile non trouvé: %s" % bash_profile_src)
}
do_install_ssh_keys[nostamp] = "1"
addtask do_install_ssh_keys after do_install before do_package

RDEPENDS:${PN} = "openssh"