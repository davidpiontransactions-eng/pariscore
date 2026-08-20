const fs = require('fs');
const cp = require('child_process');
const r = cp.execSync('node -e "const fs=require(\'fs\');fs.readdirSync(\'src\',{recursive:true}).filter(f=>/\.(tsx|ts)$/.test(f)).forEach(f=>{const s=fs.readFileSync(\'src/\'+f,\'utf8\');if(/StatRow/.test(s))console.log(f,\'\',(s.match(/StatRow/g)||[]).length)})"').toString();
console.log(r);