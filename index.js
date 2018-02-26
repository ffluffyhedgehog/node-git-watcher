#!/usr/bin/env node
'use strict';
const shell = require('shelljs');
const path = require('path');
const git = require('nodegit');
const configFactory = require('./lib/configFactory');
const standalone = require('./lib/standalone');
const argsparser = require('./lib/arguments').parser;
const logger = require('./lib/logger').logger();

const config = configFactory.cookConfig();
let application = {};

console.log(config);
if (config.mode === 'standalone') {
  application = standalone.createApplication(config);
} else if (config.mode === 'centered') {
  application = centered.createApplication(config);
}
console.log(application);
application.start(() => console.log('Deploy node running'));
