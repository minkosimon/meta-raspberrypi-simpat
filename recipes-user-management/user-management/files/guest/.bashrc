# ~/.bashrc

# --- Sécurité ---
umask 027

# --- Prompt sécurisé ---
PS1='\u@\h:\w\$ '

# --- Éviter erreurs dangereuses ---
set -o noclobber   # empêche d'écraser fichiers avec >
set -o ignoreeof   # empêche exit via Ctrl+D accidentel

# --- Historique amélioré ---
#shopt -s histappend
#export PROMPT_COMMAND="history -a; history -c; history -r"

# --- Variables d'environnement globales ---
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export LANG="C"
export LC_ALL="C"

# --- Alias utiles (safe) ---
alias ll='ls -alF'
alias la='ls -A'
alias l='ls -CF'
alias rm='rm -i'
alias cp='cp -i'
alias mv='mv -i'

# --- Debug embarqué ---
alias dmesg='dmesg | tail -50'
alias logs='journalctl -xe'

# --- Vérification PATH (anti injection) ---
case ":$PATH:" in
    *::*) echo "WARNING: empty PATH entry detected" ;;
esac

# --- Désactiver core dump ---
ulimit -c 0

# --- Message léger (optionnel) ---
echo "Welcome $(whoami) on $(hostname)"