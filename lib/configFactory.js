'use strict';
const args = require('./arguments').args;

args.mode = 'standalone';

// TODO: Read config from file, including info about deploys

module.exports = {
  cookConfig: () => args,
};
