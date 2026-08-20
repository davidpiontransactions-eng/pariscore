// scripts/patch-sw-guard.js - fix double-reload SW (SKIP_WAITING only on real update)
const fs = require('fs');
const p = require('path').join(__dirname, '..', 'src/components/sw-register.tsx');
const s = fs.readFileSync(p, 'utf8');

const old = `            if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
              // Il y a déjà un SW actif → un nouveau vient d'arriver.
              // On poste SKIP_WAITING pour forcer son activation.
              installingWorker.postMessage("SKIP_WAITING");
            }`;

const nw = `            if (installingWorker.state === "installed" && hadController) {
              // SKIP_WAITING uniquement pour une MISE À JOUR (un SW actif
              // est déjà présent, hadController=true). Au premier install le
              // SW s'active seul via son skipWaiting() (public/sw.js) —
              // poster ici créerait un controllerchange fantôme → double
              // reload de la page (bug observé en QA mobile 375px).
              installingWorker.postMessage("SKIP_WAITING");
            }`;

if (s.includes(old)) {
  fs.writeFileSync(p, s.replace(old, nw));
  console.log('PATCHED: SW guard now uses hadController');
} else {
  const fileLf = s.replace(/\r\n/g, '\n');
  if (fileLf.includes(old)) {
    fs.writeFileSync(p, fileLf.replace(old, nw));
    console.log('PATCHED (LF-normalized): SW guard now uses hadController');
  } else {
    console.log('ERROR: pattern not found — current block:');
    const i = s.indexOf('installingWorker.state');
    console.log(s.slice(i - 20, i + 220));
  }
}