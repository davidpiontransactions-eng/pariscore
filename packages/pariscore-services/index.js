/* Runtime-only bridge to legacy services — keep as serverExternalPackages */
module.exports.getF1Drivers = require("../../services/f1Service").getF1Drivers;
module.exports.getF1Races = require("../../services/f1Service").getF1Races;
