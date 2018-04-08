'use strict';
const git = require('nodegit');
const shell = require('shelljs');
const path = require('path');
const fs = require('fs');
const cookDeployConfig = require('./configFactory').cookDeployConfig;
const saveDeployToConfig = require('./configFactory').saveDeployToConfig;
const removeDeployFromConfig = require('./configFactory')
  .removeDeployFromConfig;

const DEPLOYS_PATH = path.resolve('./deploys/');

// resolved with boolean - folder exists
//
const checkFolderAndCreate = (path) => new Promise((resolve, reject) => {
  fs.stat(path, (err) => {
    if (err && err.errno === -2) {
      fs.mkdir(path, (err) => {
        if (err) {
          return reject(err);
        }
        return resolve(false);
      });
    } else if (err) {
      return reject(err);
    } else {
      return resolve(true);
    }
  });
});

const removeDeployDir = (deployId) => new Promise((resolve, reject) => {
  shell.rm('-rf', DEPLOYS_PATH + deployId + '/*');
  return resolve();
});

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

let attempts = 0;

// Clone repo from url into deploys/folderName
//
const init = (url, deployId, branch, credentials) =>
 new Promise((resolve, reject) => {
  // Check if deploys folder exist
  const deployPath = path.join(DEPLOYS_PATH, deployId);
  checkFolderAndCreate(DEPLOYS_PATH)
    .then(() => checkFolderAndCreate(deployPath))
    .then((exists) => {
      if (exists) {
        return reject(new Error('deploy already exists'));
      }
      // Clone repo
      const cloneOptions = {};
      if (credentials) {
        cloneOptions.fetchOpts = {
          callbacks: {
            credentials: (url, userName) => {
              // TODO: Replace with oauth token
              if (!credentials.user || !credentials.password) {
                return git.Cred.sshKeyFromAgent(userName);
              }
              if (attempts < 3) {
                attempts++;
                return git
                  .Cred.userpassPlaintextNew(credentials.user,
                    credentials.password);
              }
              attempts = 0;
              return new Error('Wrong credentials');
            },
            certificateCheck: () => 1
          }
        };
      }
      return git.Clone.clone(url, deployPath, cloneOptions)
        .then((repo) => {
          // Switch branch if neccessary
          if (branch) {
            return checkout(repo, branch)
              .then(() => resolve());
          }
          return resolve();
        })
        .catch(err => reject(err));
    });
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


const fetchUpdates = (config, repo) => new Promise((resolve, reject) => {
  repo.fetchAll({
    callbacks: {
      credentials: (url, userName) => {
        // TODO: Replace with oauth token
        // TODO: config.credentials.*
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
    const currentPath = process.cwd();
    console.log('currentPath: ', currentPath);
    shell.cd(path);
    if (!shell.which(command.split(' ')[0])) {
      shell.cd(currentPath);
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
      shell.cd(currentPath);
      return reject(err);
    }
    shell.cd(currentPath);
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

const run = (path, config, emitter) => new Promise((resolve, reject) => {
  emitter.emit('deploy.start');
  const currentPath = process.cwd();
  shell.cd(path);
  const command = config.run;
  if (!shell.which(command.split(' ')[0])) {
    shell.cd(currentPath);
    return reject(new Error('command not found'));
  }
  const result = shell.exec(command, { silent: true, async: true });
  shell.cd(currentPath);
  return resolve(result);
})
  .then((result) => {
    emitter.emit('deploy.end', result);
  })
  .catch((err) => {
    emitter.emit('deploy.err', err);
  });

const deploy = (path, emitter) => {
  let deployConfig = {};
  return cookDeployConfig(path)
    .then((cookedConfig) => {
      deployConfig = cookedConfig;
      return build(path, deployConfig, emitter);
    })
    .then((buildSuccess) => {
      // Testing is optional
      console.log('buildSuccess: ', buildSuccess);
      if (buildSuccess) {
        return test(path, deployConfig, emitter)
        // TODO: Check if tests failed before running
          .then(() => run(path, deployConfig, emitter));
      }
    })
    .catch((err) => {
      if (err.errno === -2) {
        emitter.emit('build.err', new Error('deploy config not found'));
      }
    });
};

const startApp = (config, emitter) => {
  const appPath = path.join(DEPLOYS_PATH, config.deployId);
  return cookDeployConfig(appPath)
    .then((deployConfig) => run(appPath, deployConfig, emitter))
    .catch((err) => emitter.emit('deploy.err', err));
};

const fetchAndDeploy = (config, repo, emitter) => {
  emitter.emit('fetch.start');
  fetchUpdates(config, repo)
    .then((isChanged) => {
      emitter.emit('fetch.end');
      console.log('isChanged: ', isChanged);
      if (!isChanged) {
        return deploy(repo.path(), emitter);
      }
    })
    .catch((err) => {
      emitter.emit('fetch.err', err);
    });
};

const initAndDeploy = (config, emitter) => {
  emitter.emit('init.start');
  return init(config.url, config.deployId, config.branch, config.credentials)
    .then(() => saveDeployToConfig(config))
    .then(() => deploy(path.join(DEPLOYS_PATH, config.deployId), emitter))
    .catch((err) => emitter.emit('init.err', err));
};

const removeDeploy = (deployId, emitter, cb) => removeDeployDir(deployId)
  .then(removeDeployFromConfig(deployId))
  .then(() => {
    emitter.emit('remove.end');
    return cb(true);
  })
  .catch((err) => {
    emitter.emit('remove.err', err.message);
    return cb(false);
  });

const openRepoAndFetch = (deploy, emitter) => new Promise((resolve, reject) => {
  const repoPath = path.join(DEPLOYS_PATH, deploy.deployId);
  git.Repository.open(repoPath)
    .then((repo) => {
      // Start watching
      const adaptedConfig = Object.assign(deploy, {
        path: repoPath,
      });
      resolve();
      fetchAndDeploy(adaptedConfig, repo, emitter);
    })
    .catch((err) => reject(err));
});

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

module.exports.watchOnTimer = watchOnTimer;
module.exports.initAndDeploy = initAndDeploy;
module.exports.startApp = startApp;
module.exports.openRepoAndFetch = openRepoAndFetch;
module.exports.removeDeploy = removeDeploy;
