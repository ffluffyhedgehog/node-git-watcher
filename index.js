#!/usr/bin/env node
'use strict';
const shell = require('shelljs');
const path = require('path');
const git = require('nodegit');
const args = require('./arguments').args;
const argsparser = require('./arguments').parser;
const logger = require('./logger').logger();

const runPreUpdate = () => new Promise((resolve, reject) => {
  const runResult = shell.exec(path.resolve(__dirname, args.script_before),
    { silent: true });
  logger.log(runResult.stdout).error(runResult.stderr).flush();
  if (runResult.code === 0) {
    console.log('Pre-update script executed');
    return resolve();
  } else {
    return reject(new Error(`Pre-update script exited with non-zero code\
        :${runResult.code}`));
  }
});

const runPostUpdate = () => new Promise((resolve, reject) => {
  const runResult = shell.exec(path.resolve(__dirname, args.script_after),
    { silent: true });
  logger.log(runResult.stdout).error(runResult.stderr).flush();
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

// Check if there is difference between local and remote
// branch resolves with boolean
const checkChanges = (repo, branch) => new Promise((resolve, reject) => {
  const localPromise = repo.getBranchCommit(branch);
  const remotePromise = repo.getBranchCommit(`origin/${branch}`);

  Promise.all([localPromise, remotePromise])
    .then(commits => {
      if (commits[0].id().toString() === commits[1].id().toString()) {
        resolve(false);
      }
      resolve(true);
    })
    .catch(err => reject(err));
});

let attempts = 0;

const fetchAndUpdate = (repo) => {
  repo.fetchAll({
    callbacks: {
      credentials: (url, userName) => {
        if (!args.user || !args.password) {
          return git.Cred.sshKeyFromAgent(userName);
        }
        if (attempts < 3) {
          attempts++;
          return git.Cred.userpassPlaintextNew(args.user, args.password);
        }
        return new Error('Wrong credentials');
      },
      certificateCheck: () => 1
    }
  })
    .then(() =>
      checkChanges(repo, args.branch)
    )
    .then((runUpdate) => {
      if (runUpdate) {
        // Execute pre-update script
        return runPreUpdate()
          .then(() => repo.mergeBranches(args.branch, `origin/${args.branch}`))
          .then(() =>
            // Branches merged, switch branch if neccessary and run post-update
            // script
            checkout(repo)
              .then(() => runPostUpdate())
          )
          .then(() => {
            // Update successfull
            console.log('Updated');
          });
      } else {
        console.log('No updates');
      }
    })
    .catch((err) => console.log(err));
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
