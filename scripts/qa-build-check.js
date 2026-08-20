const { execSync } = require('child_process');
function run(cmd) {
  try { return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' }); }
  catch (e) { return (e.stdout || '') + (e.stderr || '').slice(0, 300); }
}
const out = run('bun run build 2>&1');
const ok = /Compiled successfully|✓ Compiled|route\s*\(app\)|Generating static/.test(out);
const hasErr = /Failed to compile|Error:|Type error/.test(out);
console.log('BUILD_OK=', ok, 'HAS_ERR=', hasErr);
if (hasErr) {
  console.log(out.split(/\r?\n/).filter((l) => /Error|error/.test(l)).slice(0, 12).join('\n'));
} else {
  console.log(out.split(/\r?\n/).slice(-8).join('\n'));
}