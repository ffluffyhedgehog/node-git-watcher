'use strict';
const git = require('nodegit');
const shell = require('shelljs');
const path = require('path');
const cookDeployConfig = require('./configFactory').cookDeployConfig;
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
        return resolve(false);
      }
      return resolve(true);
    })
    .catch(err => reject(err));
});

let attempts = 0;

const fetchUpdates = (config, repo) => new Promise((resolve, reject) => {
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
          ) // Update successfull
          .then(() => resolve(true));
      } else {
        return resolve(false);
      }
    })
    .catch((err) => reject(err));
});

// Reads build script from config and runs it
const build = (path, config) =>  // TODO: Can be reused for tests and run
  new Promise((resolve, reject) => {
    shell.cd(path);
    if (!shell.which(config.build.split(' ')[0])) {
      return reject(new Error('build command not found'));
    }
    const result = shell.exec(config.build, { silent: true });
    const output = {
      stdout: result.stdout,
      stderr: result.stderr,
      code: result.code,
    };
    if (result.code !== 0) {
      const err = new Error('command finished with non-zero exit code');
      err.output = output;
      return reject(err);
    }
    return resolve(output);
  })
;

const fetchAndDeploy = (config, repo, emitter) => {
  fetchUpdates(config, repo)
    .then((isChanged) => {
      emitter.emit('fetch.end');
      console.log('isChanged: ', isChanged);
      if (!isChanged) {
        emitter.emit('build.start');
        // TODO: test,deploy
        return cookDeployConfig(config.path)
          .then((deployConfig) => build(config.path, deployConfig))
          .then((log) => {
            emitter.emit('build.end', log);
          })
          .catch((err) => {
            emitter.emit('build.err', err);
          });
      }
    })
    .catch((err) => {
      emitter.emit('fetch.err', err);
    });
};

const timerWatcher = (config, repo, interval) => {
  console.log('Watch started with interval ', interval);
  const emitter = new EventEmitter(); // TODO: pass from standalone.js
  emitter.on('fetch.end', () => console.log('fetch ended'));
  emitter.on('fetch.err', () => console.log('fetch err'));
  emitter.on('build.start', () => console.log('build started'));
  emitter.on('build.err', (err) => console.log('build error:', err));
  emitter.on('build.end', (output) => console.log('build finished:', output));
  setInterval(fetchAndDeploy, interval, config, repo, emitter);
};

const watchOnTimer = (config) => new Promise((resolve, reject) => {
  git.Repository.open(path.resolve(__dirname, config.path))
    .then((repo) => {
      // Start watching
      timerWatcher(config, repo, config.time * 60000);
      resolve();
    })
    .catch((err) => reject(err));
});

module.exports.fetchAndDeploy = fetchAndDeploy;
module.exports.watchOnTimer = watchOnTimer;
