#!/bin/sh
# Lance le deploy avec FORCE_BUILD=1 sans dependre du quoting cmd/ssh.
cd /home/ubuntu/pariscore || exit 1
FORCE_BUILD=1 nohup bash /tmp/pariscore-deploy-raw.sh > /tmp/pariscore-deploy.log 2>&1 &
echo LAUNCHED_PID_$!
