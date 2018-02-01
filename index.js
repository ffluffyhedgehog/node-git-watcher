#!/usr/bin/env node
'use strict';
const shell = require('shelljs');
const path = require('path');
const git = require('nodegit');
const args = require('./arguments').args;
const argsparser = require('./arguments').parser;
const logger = require('./logger').logger();

const runPreUpdate = () => new Promise((resolve, reject) => {
  // TODO: Pipe stdout and stderr to logger
  const runResult = shell.exec(path.resolve(__dirname, args.script_before));
  if (runResult.code === 0) {
    console.log('Pre-update script executed');
    return resolve();
  } else {
    return reject(new Error(`Pre-update script exited with non-zero code\
        :${runResult.code}`));
  }
});

const runPostUpdate = () => new Promise((resolve, reject) => {
  // TODO: Pipe stdout and stderr to logger
  const runResult = shell.exec(path.resolve(__dirname, args.script_after));
  if (runResult.code === 0) {
    console.log('Post-update script executed');
    return resolve();
  } else {
    return reject(new Error(`Post-update script exited with non-zero code\
        :${runResult.code}`));
  }
});

const checkout = (repo) => new Promise((resolve, reject) => {
  repo.getCurrentBranch()
    .then((reference) => {
      if (reference.shorthand() !== args.branch) {
        // Checkout branch
        return repo.checkoutBranch(args.branch);
      }
    })
    .then(() => resolve())
    .catch((err) => reject(err));
});

const fetchAndUpdate = (repo) => {
  repo.fetchAll({
    callbacks: {
      credentials: (url, userName) => {
        // TODO: Pass credentials
        console.log('Credentials required');
        return git.Cred.sshKeyFromAgent(userName);
      },
      certificateCheck: () => 1
    }
  })
    .then(() =>
    // Execute pre-update script
      runPreUpdate()
    )
    .then(() =>
    // Fetch done, merge branches
      repo.mergeBranches(args.branch, `origin/${args.branch}`)
    )
    .then(() =>
    // Branches merged, switch branch if neccessary and run post-update
    // script
      checkout(repo)
        .then(() => runPostUpdate())
    )
    .then(() => {
    // Update successfull
      console.log('Updated');
    })
    .catch((err) => console.log(err.message));
};

const watcher = (repo, interval) => {
  console.log('Watch started with interval ', interval);
  setInterval(fetchAndUpdate, interval, repo);
};

if (args.script_before === null || args.script_after === null) {
  // Display help and exit
  argsparser.printHelp();
  process.exit();
}

git.Repository.open(path.resolve(__dirname, args.path))
  .then((repo) => {
    // Start watching
    watcher(repo, args.time * 60000);
  })
  .catch((err) => console.log(err.message));
