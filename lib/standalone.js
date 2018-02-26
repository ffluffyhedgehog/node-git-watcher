'use strict';
const shell = require('shelljs');
const git = require('./git');
const argsparser = require('./arguments').parser;
const logger = require('./logger').logger();

module.exports = {
  createApplication: (config) => ({
    start: (cb) => {
      if (config.script_before === null || config.script_after === null) {
        // Display help and exit
        argsparser.printHelp();
        process.exit();
      }
      git.watchOnTimer(config)
        .catch((err) => {
          console.log(err.message);
          process.exit();
        });
      return cb();
    },
  }),
};
