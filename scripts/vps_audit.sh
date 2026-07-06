#!/bin/bash
# =============================================================================
# PariScore — Audit VPS complet (à exécuter sur le VPS en SSH)
# =============================================================================
# Usage :
#   ssh ubuntu@<VPS_IP> 'bash -s' < vps_audit.sh > vps_audit_output.txt 2>&1
# OU (plus simple) :
#   scp vps_audit.sh ubuntu@<VPS_IP>:/tmp/
#   ssh ubuntu@<VPS_IP> 'bash /tmp/vps_audit.sh' > vps_audit_output.txt 2>&1
# Puis collez-moi le contenu de vps_audit_output.txt
#
# Le script est SÉCURISÉ :
# - ne modifie rien (read-only)
# - masque les secrets (.env affiché avec valeurs remplacées par ***)
# - n'envoie rien vers l'extérieur
# =============================================================================

set +e   # on ne s'arrête pas sur erreur, on veut toutes les sections
umask 077

echo "############################################################"
echo "#  PARISCORE VPS AUDIT — $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "############################################################"
echo

# ---------------------------------------------------------------------------
echo "===== [01] SYSTÈME — OS / KERNEL / UPTIME / LOAD ====="
echo "--- uname / etc / issue ---"
uname -a
echo
cat /etc/os-release 2>/dev/null
echo
echo "--- uptime / load ---"
uptime
echo
echo "--- CPU info (résumé) ---"
nproc
lscpu | head -25
echo
echo "--- memory ---"
free -h
echo
echo "--- disk usage ---"
df -hT | grep -vE '^(tmpfs|udev|overlay)'
echo
echo "--- iostat (si disponible) ---"
iostat -x 1 3 2>/dev/null | tail -20 || echo "(iostat non installé)"
echo

# ---------------------------------------------------------------------------
echo "===== [02] RÉSEAU — PORTS ÉCOUTE / FIREWALL / FAIL2BAN ====="
echo "--- ports en écoute (IPv4 + IPv6) ---"
ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null
echo
echo "--- connexions établies (top 20) ---"
ss -tn state established 2>/dev/null | head -20
echo
echo "--- ufw status ---"
sudo ufw status verbose 2>/dev/null || echo "(ufw non disponible ou pas sudo)"
echo
echo "--- iptables (résumé) ---"
sudo iptables -L -n --line-numbers 2>/dev/null | head -40 || echo "(iptables non accessible)"
echo
echo "--- fail2ban status ---"
sudo fail2ban-client status 2>/dev/null || echo "(fail2ban non installé)"
sudo fail2ban-client status sshd 2>/dev/null || true
echo
echo "--- nftables ---"
sudo nft list ruleset 2>/dev/null | head -30 || echo "(nft non disponible)"
echo

# ---------------------------------------------------------------------------
echo "===== [03] SSH CONFIG — SÉCURITÉ ACCÈS ====="
echo "--- sshd_config (options critiques) ---"
sudo grep -E '^(PermitRootLogin|PasswordAuthentication|PubkeyAuthentication|AllowUsers|AllowGroups|Port|X11Forwarding|PermitEmptyPasswords|ChallengeResponseAuthentication|KbdInteractiveAuthentication|UsePAM)' /etc/ssh/sshd_config 2>/dev/null
sudo grep -hRE '^(PermitRootLogin|PasswordAuthentication|PubkeyAuthentication|AllowUsers|AllowGroups|Port)' /etc/ssh/sshd_config.d/ 2>/dev/null
echo
echo "--- utilisateurs avec shell ---"
awk -F: '$7 ~ /(bash|sh|zsh)$/ {print $1":"$3":"$7}' /etc/passwd
echo
echo "--- sudoers ---"
sudo cat /etc/sudoers 2>/dev/null | grep -vE '^(#|$)' | head -30
sudo ls /etc/sudoers.d/ 2>/dev/null
echo
echo "--- dernières connexions (last) ---"
last -a -n 20 2>/dev/null
echo
echo "--- dernières authentifications échouées (lastb) ---"
sudo lastb -n 20 2>/dev/null || echo "(lastb non accessible)"
echo

# ---------------------------------------------------------------------------
echo "===== [04] PM2 — PROCESS / APP STATUS ====="
echo "--- pm2 list ---"
pm2 list 2>/dev/null || echo "(pm2 non trouvé dans PATH — essayez avec sudo / chemin absolu)"
echo
echo "--- pm2 jlist (détails JSON) ---"
pm2 jlist 2>/dev/null | head -200 || true
echo
echo "--- pm2 describe pariscore ---"
pm2 describe pariscore 2>/dev/null | head -60 || true
echo
echo "--- pm2 logs (50 dernières lignes) ---"
pm2 logs pariscore --nostream --lines 50 --err 2>/dev/null || true
echo
echo "--- pm2 logs (out, 50 dernières lignes) ---"
pm2 logs pariscore --nostream --lines 50 --out 2>/dev/null || true
echo

# ---------------------------------------------------------------------------
echo "===== [05] DOCKER — CONTAINERS / IMAGES / COMPOSE ====="
echo "--- docker ps ---"
sudo docker ps -a 2>/dev/null || docker ps -a 2>/dev/null || echo "(docker non accessible)"
echo
echo "--- docker images ---"
sudo docker images 2>/dev/null || docker images 2>/dev/null || true
echo
echo "--- docker compose (si pariscore-compose existe) ---"
cd /home/ubuntu/pariscore 2>/dev/null && sudo docker compose ls 2>/dev/null || true
echo

# ---------------------------------------------------------------------------
echo "===== [06] APPLICATION — RÉPERTOIRE / GIT / FICHIERS ====="
PARIS_DIR="/home/ubuntu/pariscore"
[ -d "$PARIS_DIR" ] || PARIS_DIR=$(find /home /opt /var/www /srv -maxdepth 4 -type d -name 'pariscore' 2>/dev/null | head -1)
echo "PARIS_DIR=$PARIS_DIR"
echo
echo "--- ls -la (top level) ---"
ls -la "$PARIS_DIR" 2>/dev/null | head -60
echo
echo "--- taille totale du dossier ---"
sudo du -sh "$PARIS_DIR" 2>/dev/null
sudo du -sh "$PARIS_DIR"/* 2>/dev/null | sort -rh | head -25
echo
echo "--- git status / branch / dernier commit ---"
cd "$PARIS_DIR" 2>/dev/null && {
  echo "branch courante : $(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
  echo "HEAD commit    : $(git log -1 --format='%H %ai %s' 2>/dev/null)"
  echo
  echo "--- git status (court) ---"
  git status -s 2>/dev/null | head -40
  echo
  echo "--- 20 derniers commits ---"
  git log --oneline -20 2>/dev/null
  echo
  echo "--- fichiers modifiés localement (non commit) — taille ---"
  git status -s 2>/dev/null | awk '{print $NF}' | xargs -I{} ls -la "$PARIS_DIR/{}" 2>/dev/null | head -20
}
echo

# ---------------------------------------------------------------------------
echo "===== [07] CONFIG — .env (SANITISÉ) / ecosystem / nginx / caddy ====="
cd "$PARIS_DIR" 2>/dev/null
echo "--- .env (valeurs masquées) ---"
if [ -f .env ]; then
  awk -F= '/^[A-Z]/ {
    key=$1
    val=substr($0, index($0,"=")+1)
    if (val == "") print key "=<empty>"
    else if (length(val) < 8) print key "=***"
    else print key "=" substr(val,1,3) "***"  # ne montre que 3 chars
  }' .env
else
  echo "(pas de .env dans $PARIS_DIR)"
fi
echo
echo "--- ecosystem.config.js ---"
cat ecosystem.config.js 2>/dev/null | head -80
echo
echo "--- Caddyfile ---"
cat Caddyfile 2>/dev/null
echo
echo "--- nginx (sites activés) ---"
sudo ls /etc/nginx/sites-enabled/ 2>/dev/null
sudo cat /etc/nginx/sites-enabled/pariscore* 2>/dev/null | head -100
sudo cat /etc/nginx/conf.d/*.conf 2>/dev/null | head -100
echo
echo "--- /etc/hosts (réseau local) ---"
cat /etc/hosts
echo

# ---------------------------------------------------------------------------
echo "===== [08] BASE DE DONNÉES — SQLITE ====="
cd "$PARIS_DIR" 2>/dev/null
echo "--- fichiers *.db (tailles) ---"
find . -maxdepth 4 -name '*.db*' -type f -exec ls -lh {} \; 2>/dev/null
echo
echo "--- integrity check pariscore.db ---"
sqlite3 pariscore.db "PRAGMA integrity_check;" 2>/dev/null || echo "(sqlite3 non installé ou DB inaccessible)"
echo
echo "--- quick_check ---"
sqlite3 pariscore.db "PRAGMA quick_check;" 2>/dev/null || true
echo
echo "--- WAL / SHM files ---"
ls -lh pariscore.db* database.db* data/*.db* 2>/dev/null
echo
echo "--- journal_mode / WAL status ---"
sqlite3 pariscore.db "PRAGMA journal_mode;" 2>/dev/null || true
echo
echo "--- liste des tables (compte) ---"
sqlite3 pariscore.db "SELECT count(*) as table_count FROM sqlite_master WHERE type='table';" 2>/dev/null || true
echo
echo "--- top 20 tables par taille (row count) ---"
sqlite3 pariscore.db "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;" 2>/dev/null | head -50 | while read t; do
  c=$(sqlite3 pariscore.db "SELECT count(*) FROM \"$t\";" 2>/dev/null)
  echo "$c  $t"
done | sort -rn | head -20
echo
echo "--- Sample users table (count + 5 rows anonymisées) ---"
sqlite3 pariscore.db "SELECT count(*) as user_count FROM users;" 2>/dev/null || true
sqlite3 pariscore.db "SELECT id, username, role, plan, substr(email,1,3)||'***@***' as email_masked, created_at FROM users LIMIT 5;" 2>/dev/null || true
echo

# ---------------------------------------------------------------------------
echo "===== [09] LOGS — TAILLE / ERREURS RÉCENTES ====="
cd "$PARIS_DIR" 2>/dev/null
echo "--- fichiers de logs (tailles) ---"
find . -maxdepth 3 -name '*.log' -o -name '*.err' 2>/dev/null | xargs ls -lh 2>/dev/null | head -30
echo
echo "--- pm2 logs pariscore (chemins + tailles) ---"
ls -lh ~/.pm2/logs/pariscore* 2>/dev/null
echo
echo "--- 50 dernières erreurs (server.err / pm2 error) ---"
tail -100 ~/.pm2/logs/pariscore-error.log 2>/dev/null | head -50
echo
echo "--- compte des erreurs par type (top 20 patterns) ---"
grep -E 'Error|ERROR|err:|throw' ~/.pm2/logs/pariscore-error.log 2>/dev/null \
  | sed -E 's/[0-9]{4}-[0-9]{2}-[0-9]{2}//g; s/[0-9]{2}:[0-9]{2}:[0-9]{2}//g' \
  | sort | uniq -c | sort -rn | head -20
echo
echo "--- journalctl (50 dernières lignes pariscore) ---"
sudo journalctl -u pariscore --no-pager -n 50 2>/dev/null || true
echo
echo "--- systemd services parisc* ---"
sudo systemctl list-units --type=service --all 2>/dev/null | grep -i paris || true
echo

# ---------------------------------------------------------------------------
echo "===== [10] CRON — JOBS PLANIFIÉS ====="
echo "--- crontab user ubuntu ---"
crontab -l 2>/dev/null || echo "(pas de crontab user)"
echo
echo "--- crontab root ---"
sudo crontab -l 2>/dev/null || echo "(pas de crontab root)"
echo
echo "--- /etc/cron.d/ ---"
ls -la /etc/cron.d/ 2>/dev/null
sudo cat /etc/cron.d/*pariscore* 2>/dev/null
echo
echo "--- pm2 crons (depuis ecosystem) ---"
grep -A3 'cron_restart\|cron: ' "$PARIS_DIR/ecosystem.config.js" 2>/dev/null
echo
echo "--- systemd timers (pariscor*) ---"
sudo systemctl list-timers --all 2>/dev/null | grep -i paris || true
echo

# ---------------------------------------------------------------------------
echo "===== [11] SÉCURITÉ — KERNEL / SYSCTL / OPEN FILES ====="
echo "--- ulimit current process ---"
ulimit -a
echo
echo "--- sysctl (sécurité réseau) ---"
sudo sysctl net.ipv4.tcp_syncookies net.ipv4.ip_forward net.ipv4.conf.all.accept_redirects net.ipv4.conf.all.send_redirects net.ipv4.conf.all.accept_source_route kernel.randomize_va_space 2>/dev/null
echo
echo "--- fichiers SUID ---"
sudo find / -perm -4000 -type f 2>/dev/null | grep -vE '^/(usr|bin|sbin|lib|lib32|lib64)/' | head -20
echo
echo "--- /etc/passwd permissions ---"
ls -la /etc/passwd /etc/shadow /etc/sudoers
echo
echo "--- processus consommant le plus de mémoire ---"
ps aux --sort=-%mem | head -10
echo
echo "--- processus consommant le plus de CPU ---"
ps aux --sort=-%cpu | head -10
echo

# ---------------------------------------------------------------------------
echo "===== [12] CERTIFICATS TLS / HTTPS ====="
echo "--- certificats letsencrypt ---"
sudo ls /etc/letsencrypt/live/ 2>/dev/null
sudo certbot certificates 2>/dev/null | head -30 || true
echo
echo "--- test HTTPS (si domaine connu) ---"
for d in pariscore.fr www.pariscore.fr api.pariscore.fr; do
  echo "-- $d --"
  curl -sI --max-time 5 "https://$d/" 2>&1 | head -8
done
echo

# ---------------------------------------------------------------------------
echo "===== [13] VERSIONS LOGICIELLES INSTALLÉES ====="
echo "--- node / npm / bun ---"
node --version 2>/dev/null
npm --version 2>/dev/null
bun --version 2>/dev/null
which node npm bun
echo
echo "--- python ---"
python3 --version 2>/dev/null
which python3 pip3
echo
echo "--- sqlite ---"
sqlite3 --version 2>/dev/null
echo
echo "--- nginx / caddy ---"
nginx -v 2>&1
caddy version 2>/dev/null
echo
echo "--- git ---"
git --version
echo
echo "--- pm2 ---"
pm2 --version 2>/dev/null
echo

# ---------------------------------------------------------------------------
echo "===== [14] SANITY CHECK — ENDPOINTS LOCAUX ====="
echo "--- GET / (status + headers) ---"
curl -sI --max-time 5 http://localhost:3000/ 2>&1 | head -15
echo
echo "--- GET /api/v1/status ---"
curl -s --max-time 5 http://localhost:3000/api/v1/status 2>&1 | head -30
echo
echo "--- GET / (header X-Robots-Tag, CSP) ---"
curl -sI --max-time 5 http://localhost:3000/ 2>&1 | grep -iE 'content-security|x-robots|x-frame|x-content-type|strict-transport|referrer-policy|permissions-policy'
echo
echo "--- Test accès .jwt_secret (devrait être bloqué) ---"
curl -sI --max-time 5 http://localhost:3000/.jwt_secret 2>&1 | head -3
echo
echo "--- Test accès .env (devrait être bloqué) ---"
curl -sI --max-time 5 http://localhost:3000/.env 2>&1 | head -3
echo

# ---------------------------------------------------------------------------
echo "===== [15] RÉSUMÉ / AUTRES ====="
echo "--- fichiers récemment modifiés (24h) ---"
sudo find "$PARIS_DIR" -maxdepth 3 -type f -mtime -1 2>/dev/null | head -30
echo
echo "--- fichiers appartenant à root dans pariscore (suspect) ---"
sudo find "$PARIS_DIR" -maxdepth 3 -uid 0 2>/dev/null | head -20
echo
echo "--- espacio libre inode ---"
df -i | grep -vE 'tmpfs'
echo

echo
echo "############################################################"
echo "#  FIN AUDIT VPS — $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "############################################################"
