'use strict';
// LOCAL-ONLY (gitignored, jamais committé — TOS). Bridge le hook optionnel
// `require('./wom.local')` de server.js vers la solution locale de scrape WOM.
// Voir betwatchService.js + tools/scrape-betwatch-wom.js + .context/betwatch-wom-analysis.md
module.exports = require('./betwatchService');
