#!/usr/bin/env node
'use strict';
const configFactory = require('./lib/configFactory');
const standalone = require('./lib/standalone');
const centered = require('./lib/centered');

const config = configFactory.cookConfig();
let application = {};

//console.log(config);
if (config.mode === 'standalone') {
  application = standalone.createApplication(config);
} else if (config.mode === 'centered') {
  application = centered.createApplication(config);
}
//console.log(application);
application.start((err) => {
  if (err) {
    console.log('Failed to start application: ', err);
  } else {
    console.log('Deploy node running');
  }
});
