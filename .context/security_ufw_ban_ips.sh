#!/bin/bash
# SECURITY — Ban IPs scanner + attaquant (bd ParisScorebis-c8m)
# Usage VPS OVH : sudo bash security_ufw_ban_ips.sh
# Source : audit nginx logs 2026-05-20

set -e

echo "═══ UFW BAN — IPs malveillantes incident 2026-05-20 ═══"

# Attaquant principal — telecharge server.js 196356 bytes
sudo ufw deny from 37.65.65.25 to any comment 'breach 2026-05-20 server.js exfil'

# Scanner secondaire — retry attempts 403
sudo ufw deny from 78.153.140.0/24 to any comment 'scanner recurrent post-breach'

# Reload + verify
sudo ufw reload
sudo ufw status numbered | grep -E "37\.65|78\.153"

echo ""
echo "═══ FAIL2BAN — Activation si pas deja fait ═══"
if ! systemctl is-active --quiet fail2ban; then
  sudo apt-get install -y fail2ban
  sudo systemctl enable --now fail2ban
fi

# Jail nginx-noscript (bloque scan .js/.env/.bak/.sql/.zip)
sudo tee /etc/fail2ban/jail.d/pariscore-noscript.conf > /dev/null <<'EOF'
[nginx-noscript]
enabled  = true
filter   = nginx-noscript
action   = iptables-multiport[name=NoScript, port="http,https"]
logpath  = /var/log/nginx/access.log
maxretry = 3
bantime  = 86400
findtime = 600
EOF

sudo tee /etc/fail2ban/filter.d/nginx-noscript.conf > /dev/null <<'EOF'
[Definition]
failregex = ^<HOST> -.*GET.*(\.env|\.git|server\.js|\.bak|\.sql|\.zip|database\.json|history\.json|pariscore\.db).* HTTP.*$
ignoreregex =
EOF

sudo systemctl restart fail2ban
sudo fail2ban-client status nginx-noscript

echo ""
echo "═══ DONE — verifier sudo fail2ban-client status + sudo ufw status ═══"
