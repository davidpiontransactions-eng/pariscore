#!/bin/bash
set -e
export DEBIAN_FRONTEND=noninteractive
echo '[boot]' > /etc/wsl.conf
echo 'systemd=true' >> /etc/wsl.conf
sysctl -w vm.max_map_count=262144
echo 'vm.max_map_count=262144' >> /etc/sysctl.conf
apt-get update -qq
apt-get install -y -qq docker.io docker-compose-v2 curl ca-certificates
echo "SETUP_DONE"