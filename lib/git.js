'use strict';
const git = require('nodegit');
const path = require('path');

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

//TODO: Fetch and deploy
const fetchAndUpdate = (config, repo) => {
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
            console.log('Updated');
            // TODO: resolve true
          });
      } else {
        console.log('No updates');
        // TODO: Resolve false
      }
    })
    .catch((err) => console.log(err)); // TODO: Reject
};

const timerWatcher = (config, repo, interval) => {
  console.log('Watch started with interval ', interval);
  setInterval(fetchAndUpdate, interval, config, repo); // TODO: Run build and
  // other scripts
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

module.exports.fetchAndUpdate = fetchAndUpdate;
module.exports.watchOnTimer = watchOnTimer;