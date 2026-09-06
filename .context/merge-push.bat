@echo off
cd /d C:\Users\David\ZCodeProject\pariscore
echo [1] fetch origin main
git fetch origin main
echo [2] merge origin/main (safe merge commit, no force)
git merge --no-ff -m "Merge remote main (cron sync) for cs2 build fix" origin/main
echo [3] push main
git push -u origin main
echo [4] move tag v0.3.3 to new HEAD
git tag -f v0.3.3
git push origin :refs/tags/v0.3.3
git push origin v0.3.3
echo [5] HEAD now:
git log --oneline -1


