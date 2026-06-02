PariScore quick health check — run in order:

1. **Git state**
   ```bash
   git status && git log --oneline -5
   ```

2. **Active work** (authoritative)
   ```bash
   bd list --status=in_progress
   bd ready
   ```

3. **Syntax gates**
   ```bash
   node --check server.js
   ```

4. **Pending DG actions** — check CLAUDE.md table "ACTIONS OPS USER POST-SESSION" for unchecked items.

5. **VPS deploy lag** — compare local `git log --oneline -1` with last push. If diverged, remind user to `git push` + VPS `git pull && pm2 restart pariscore`.

Output: one-line status per check. Flag any RED items first.
