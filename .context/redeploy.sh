cd /home/ubuntu/pariscore
git fetch origin main -q
git reset --hard 7aaf5eb8 -q
rm -f /tmp/vps_rebuild.log
nohup bash scripts/update_vps.sh > /tmp/vps_rebuild.log 2>&1 &
echo LAUNCHED
