'use strict';
const git = require('nodegit');
const path = require('path');
const EventEmitter = require('events');

const checkout = (repo, branch) => new Promise((resolve, reject) => {
  repo.getCurrentBranch()
    .then((reference) => {
      if (reference.shorthand() !== branch) {
        // Checkout branch
        return repo.checkoutBranch(branch);
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

const fetchUpdates = (config, repo) => {
  return new Promise((resolve, reject) => {
    repo.fetchAll({
      callbacks: {
        credentials: (url, userName) => {
          if (!config.user || !config.password) {
            return git.Cred.sshKeyFromAgent(userName);
          }
          if (attempts < 3) {
            attempts++;
            return git.Cred.userpassPlaintextNew(config.user, config.password);
          }
          attempts = 0;
          return new Error('Wrong credentials');
        },
        certificateCheck: () => 1
      }
    })
      .then(() =>
        checkChanges(repo, config.branch)
      )
      .then((runUpdate) => {
        if (runUpdate) {
          return repo.mergeBranches(config.branch, `origin/${config.branch}`)
            .then(() =>
              // Branches merged, switch branch if neccessary
              checkout(repo, config.branch)
            )
            .then(() => {
              // Update successfull
              return resolve(true);
            });
        } else {
          return resolve(false);
        }
      })
      .catch((err) => reject(err));
  });
};

const fetchAndDeploy = (config, repo, emitter) => {
  fetchUpdates(config, repo)
    .then((isChanged) => {
      emitter.emit('fetch.end');
      if (isChanged) {
        // TODO: Build,test,deploy
      }
    })
    .catch((err) => {
      emitter.emit('fetch.err', err);
    });
};

const timerWatcher = (config, repo, interval) => {
  console.log('Watch started with interval ', interval);
  const emitter = new EventEmitter; // TODO: pass from standalone.js
  emitter.on('fetch.end', () => console.log('fetch ended'));
  setInterval(fetchAndDeploy, interval, config, repo, emitter);
};

const watchOnTimer = (config) => {
  return new Promise((resolve, reject) => {
    git.Repository.open(path.resolve(__dirname, config.path))
      .then((repo) => {
        // Start watching
        timerWatcher(config, repo, config.time * 60000);
        resolve();
      })
      .catch((err) => reject(err));
  });
};

module.exports.fetchAndDeploy = fetchAndDeploy;
module.exports.watchOnTimer = watchOnTimer;