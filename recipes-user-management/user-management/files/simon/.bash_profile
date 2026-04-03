# ~/.bash_profile

# --- Sécurité de base ---
umask 027

# --- Variables d'environnement globales ---
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export LANG="C"
export LC_ALL="C"

# --- Historique sécurisé ---
export HISTSIZE=1000
export HISTFILESIZE=2000
export HISTCONTROL=ignoredups:erasedups
export HISTFILE=~/.bash_history

# --- Timeout automatique (sécurité) ---
export TMOUT=600   # logout après 10 min d'inactivité

# --- Vérifier environnement minimal ---
if [ -z "$PS1" ]; then
    return
fi

# --- Charger bashrc si présent ---
if [ -f ~/.bashrc ]; then
    . ~/.bashrc
fi