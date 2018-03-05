'use strict';
const git = require('./git');
const argsparser = require('./arguments').parser;
const logger = require('./logger').logger();
const standaloneEmitter = require('./standaloneEmitter');

module.exports = {
  createApplication: (config) => ({
    start: (cb) => {
      if (config.script_before === null || config.script_after === null) {
        // Display help and exit
        argsparser.printHelp();
        process.exit();
      }
      git.watchOnTimer(config, standaloneEmitter)
        .catch((err) => {
          console.log(err.message);
          process.exit();
        });
      return cb();
    },
  }),
};
