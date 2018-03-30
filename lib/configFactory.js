'use strict';
const fs = require('fs');
const path = require('path');
const args = require('./arguments').args;

const DEFAULT_CONFIG_PATH = '.config.json';
const DEFAULT_REPO_PATH = './';
const DEFAULT_BRANCH = 'master';
const DEFAULT_WATCH_TIME = 10;
const DEFAULT_DEPLOY_CONFIG_NAME = '.deploy.json';
const DEPLOYS_FILE_PATH = path.join(__dirname, '../.deploys.json');

const languageConfigs = {};

// Read config from file
const readJSONFromFile = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));

const saveJSONToFileAsync = (path, json) => {
  return new Promise((resolve, reject) => {
    const StringifiedJson = JSON.stringify(json);
    fs.writeFile(path, StringifiedJson, 'utf8', (err) => {
      console.log(path);
      if (err) {
        return reject(err);
      }
      return resolve();
    });
  });
};

const readLanguageConfigs = () => {
  const configsPath = path.join(__dirname, '../configs/');
  fs.readdirSync(configsPath).forEach((file) => {
    languageConfigs[file.split('.')[0]] =
     readJSONFromFile(configsPath + file);
  });
};

const readJSONFromFileAsync = (path) => new Promise((resolve, reject) => {
  fs.readFile(path, (err, data) => {
    if (err) {
      return reject(err);
    }
    return resolve(JSON.parse(data));
  });
});

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

const mergeDefaultConfigs = (config) => new Promise((resolve, reject) => {
  if (!config.language) {
    // No information about language
    return resolve(config);
  }
  if (!languageConfigs[config.language]) {
    return reject(new Error('language not supported'));
  }
  // Mixin default language config
  const defaultConfig = languageConfigs[config.language];
  for (const k in defaultConfig) {
    if (!config[k]) {
      // Don't override config`s records
      config[k] = defaultConfig[k];
    }
  }
  return resolve(config);
});

readLanguageConfigs();
console.log(languageConfigs);

module.exports = {
  cookConfig: () => {
    if (!args.config) {
      args.config = DEFAULT_CONFIG_PATH;
    }
    try {
      return mergeConfigs(readJSONFromFile(args.config));
    } catch (e) {
      console.log('Error reading config from file:', e.message);
      console.log('Using command line arguments');
      return mergeConfigs({});
    }
  },
  cookDeployConfig: (path) => new Promise((resolve, reject) => {
    readJSONFromFileAsync(path + DEFAULT_DEPLOY_CONFIG_NAME)
      .then((config) => mergeDefaultConfigs(config))
      .then((config) => resolve(config))
      .catch((err) => reject(err));
  }),
  saveDeployToConfig: (deploy) => {
    return new Promise((resolve, reject) => {
      const deploys = readDeploysFromFile({})['deploys'];
      deploys[deploy.deployId] = deploy;
      saveJSONToFileAsync(DEPLOYS_FILE_PATH, deploys)
        .then(() => resolve())
        .catch((err) => reject(err));
    });
  },
};
