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

const execCommand = (path, config, command) =>
  new Promise((resolve, reject) => {
    shell.cd(path);
    if (!shell.which(command.split(' ')[0])) {
      return reject(new Error('command not found'));
    }
    const result = shell.exec(command, { silent: true });
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
  });

// Reads build script from config and runs it
const build = (path, config, emitter) => {
  emitter.emit('build.start');
  return execCommand(path, config, config.build)
    .then((log) => {
      emitter.emit('build.end', log);
      return true;
    })
    .catch((err) => {
      emitter.emit('build.err', err);
      return false;
    });
};

const test = (path, config, emitter) => {
  if (config.test) {
    emitter.emit('test.start');
    return execCommand(path, config, config.test)
      .then((log) => {
        emitter.emit('test.end', log);
        return true;
      })
      .catch((err) => {
        emitter.emit('test.err', err);
        return false;
      });
  } else return true;
};

const run = (path, config, emitter) => {
  return new Promise((resolve, reject) => {
    emitter.emit('deploy.start');
    shell.cd(path);
    const command = config.run;
    if (!shell.which(command.split(' ')[0])) {
      return reject(new Error('command not found'));
    }
    const result = shell.exec(command, { silent: true, async: true });
    return resolve(result);
  })
  .then((result) => {
    emitter.emit('deploy.end', result);
  })
  .catch((err) => {
    emitter.emit('deploy.err', err);
  });
};

const fetchAndDeploy = (config, repo, emitter) => {
  emitter.emit('fetch.start');
  fetchUpdates(config, repo)
    .then((isChanged) => {
      emitter.emit('fetch.end');
      console.log('isChanged: ', isChanged);
      if (!isChanged) {
        let deployConfig = {};
        return cookDeployConfig(config.path)
          .then((cookedConfig) => {
            deployConfig = cookedConfig;
            return build(config.path, deployConfig, emitter);
          })
          .then((buildSuccess) => {
            // Testing is optional
            console.log('buildSuccess: ', buildSuccess);
            if (buildSuccess) {
              return test(config.path, deployConfig, emitter)
                .then(() => run(config.path, deployConfig, emitter));
            }
          });
      }
    })
    .catch((err) => {
      emitter.emit('fetch.err', err);
    });
};

const timerWatcher = (config, repo, interval, emitter) => {
  setInterval(fetchAndDeploy, interval, config, repo, emitter);
  console.log('Watch started with interval ', interval);
};

const watchOnTimer = (config, emitter) => new Promise((resolve, reject) => {
  git.Repository.open(path.resolve(__dirname, config.path))
    .then((repo) => {
      // Start watching
      timerWatcher(config, repo, config.time * 60000, emitter);
      resolve();
    })
    .catch((err) => reject(err));
});

module.exports.fetchAndDeploy = fetchAndDeploy;
module.exports.watchOnTimer = watchOnTimer;
