#!/bin/bash
# Deploy script for pariscore VPS
# Fixes: BSD_API_KEY propagation via .env sourcing + PORT=3005 (nginx proxy_pass)
export PATH=/home/ubuntu/.bun/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
cd /home/ubuntu/pariscore

echo "=== 1/3 BUN INSTALL ==="
bun install || exit 1

echo "=== 2/3 BUN BUILD ==="
bun run build || exit 1

echo "=== 3/3 CREATE START WRAPPER ==="
# Wrapper qui source .env (BSD_API_KEY) + force PORT=3005 (nginx proxy_pass attend 3005)
cat > scripts/start-vps.sh << 'WRAPPER'
#!/bin/bash
set -a
source /home/ubuntu/pariscore/.env
set +a
export PORT=3005
cd /home/ubuntu/pariscore
export PATH=/home/ubuntu/.bun/bin:/usr/bin:/bin
exec node scripts/run-bun.js .next/standalone/server.js
WRAPPER
chmod +x scripts/start-vps.sh
echo "Wrapper created."

echo "=== 4/3 PM2 RESTART ==="
pm2 delete pariscore-next 2>/dev/null || true
pm2 start scripts/start-vps.sh --name pariscore-next || exit 1
pm2 save || exit 1
echo "=== DONE ==="
