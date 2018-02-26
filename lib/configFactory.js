'use strict';
const fs = require('fs');
const args = require('./arguments').args;

const DEFAULT_CONFIG_PATH = '.config.json';
const DEFAULT_REPO_PATH = './';
const DEFAULT_BRANCH = 'master';
const DEFAULT_WATCH_TIME = 10;
const DEPLOYS_FILE_PATH = '.deploys.json';

// Read config from file
const readFromFile = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));

// Read deploy info from file and mixin with config
const readDeploysFromFile = (config) => {
  config.deploys = JSON.parse(fs.readFileSync(DEPLOYS_FILE_PATH, 'utf8'));
  return config;
};

// Merge file config data with cmd arguments and default values
const mergeConfigs = (config) => {
  if (!args.path && !config.path) {
    args.path = DEFAULT_REPO_PATH;
  }
  if (!args.branch && !config.branch) {
    args.branch = DEFAULT_BRANCH;
  }
  if (!args.time && !config.time) {
    args.time = DEFAULT_WATCH_TIME;
  }
  if (!args.mode && !config.mode) {
    args.mode = 'centered';
  }
  for (const k in args) {
    if (args[k] !== null) {
      config[k] = args[k];
    }
  }
  // Read info about deploys if running in centered mode
  if (config.mode === 'centered') {
    return readDeploysFromFile(config);
  }
  return config;
};

module.exports = {
  cookConfig: () => {
    if (!args.config) {
      args.config = DEFAULT_CONFIG_PATH;
    }
    try {
      return mergeConfigs(readFromFile(args.config));
    } catch (e) {
      console.log('Error reading config from file:', e.message);
      console.log('Using command line arguments');
      return mergeConfigs({});
    }
  },
};
