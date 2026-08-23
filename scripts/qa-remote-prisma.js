const { execSync } = require("child_process");
// Test du module L10 directement avec l'env du .env VPS (sans exposer les secrets)
const cmd = `cd /home/ubuntu/pariscore && set -a && . ./.env && set +a && NODE_PATH=/home/ubuntu/pariscore/node_modules node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const c = await prisma.tennisEloSnapshot.count();
  const m = await prisma.tennisPlayerMatch.count();
  console.log('snapshots:', c, '| matchs:', m);
  await prisma.\$disconnect();
})().catch(e => { console.error('ERR', e.message.slice(0, 200)); process.exit(1); });
"`;
try {
  console.log(execSync(cmd, { encoding: "utf8", timeout: 60000 }).trim());
} catch (e) {
  console.error("CMD FAILED:", (e.stdout || "") + (e.stderr || "").slice(0, 500));
}