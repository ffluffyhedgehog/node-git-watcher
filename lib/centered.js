'use strict';
const git = require('./git');
const argsparser = require('./arguments').parser;
const logger = require('./logger').logger();
const centeredEmitter = require('./centeredEmitter');
const url = require('url');
const jstp = require('metarhia-jstp');

const DEFAULT_JSTP_PORT = 3228;

const parseUrl = jstpUrl => {
  const result = url.parse(jstpUrl);
  if (result && result.protocol === 'jstp:') {
    return {
      host: result.hostname,
      port: result.port || DEFAULT_JSTP_PORT,
      login: result.auth.split(':')[0],
      password: result.auth.split(':')[1],
    };
  }
  return null;
};

const pushDeployEmitter = (emitters, deploy, proxy) => {
  const newEmitter = centeredEmitter(proxy, deploy);
  emitters.set(deploy.deployId, newEmitter);
};

let appRef = null;

module.exports = {
  createApplication: config => ({
    _proxy: null,
    _deploysEmitters: new Map(),
    _application: new jstp.Application('clientRPC',
      // RPC methods init, deploy, start\stop etc.)
      {
        clientService: {
          // deploy - Object { url, deployId, <branch>, <credentials> }
          // Error codes: 1 - already exists, 2 - missing field
          initDeploy(connection, deploy, callback) {
            console.log('Starting deploy init');
            if (!deploy || !deploy.url || !deploy.deployId) {
              return callback({ code: 2, message: 'bad deploy config'});
            }
            if (appRef._deploysEmitters.get(deploy.deployId)) {
              console.log('RPC Error: deploy already exists');
              return callback({ code: 1, message: 'deploy already exists' });
            } else {
              callback(null);
              pushDeployEmitter(appRef._deploysEmitters, deploy, appRef._proxy);
              appRef._deploysEmitters.get(deploy.deployId).emit('init');
            }
          },
          // Error codes: 1 - already running, 2 - deploy not found
          startApp(connection, deployId, callback) {
            console.log('Starting deploy application');
            const deploy = appRef._deploysEmitters.get(deployId);
            if (deploy) {
              if (deploy.childProcess) {
                return callback({ code: 1, message: 'already running'});
              }
              deploy.emit('start');
              return callback(null);
            } else {
              return callback({ code: 2, message: 'deploy not found'});
            }
          },
          // Error codes: 1 - already stopped, 2 - deploy not found
          stopApp(connection, deployId, callback) {
            console.log('Stopping deploy application');
            const deploy = appRef._deploysEmitters.get(deployId);
            if (deploy) {
              if (!deploy.childProcess) {
                return callback({ code: 1, message: 'already stopped'});
              }
              deploy.emit('stop');
              return callback(null);
            } else {
              return callback({ code: 2, message: 'deploy not found'});
            }
          },
          // Error codes: 1 - deploy not found
          removeApp(connection, deployId, callback) {
            console.log('Removing application');
            const deploy = appRef._deploysEmitters.get(deployId);
            if (deploy) {
              deploy.emit('remove', (ok) => {
                if (ok) {
                  appRef._deploysEmitters.delete(deployId);
                }
              });
              return callback(null);
            } else {
              return callback({ code: 1, message: 'deploy not found'});
            }
          },
          // Error codes: 1 - deploy not found
          fetch(connection, deployId, callback) {
            console.log('Fetching changes');
            const deploy = appRef._deploysEmitters.get(deployId);
            if (deploy) {
              deploy.emit('fetch', (err) => {
                if (err) {
                  return callback(err.message);
                }
                return callback(null);
              });
            } else {
              return callback({ code: 1, message: 'deploy not found'});
            }
          },
          // Error codes: 1 - deploy not found
          getStatus(connection, deployId, callback) {
            console.log('Getting deploy status');
            const deploy = appRef._deploysEmitters.get(deployId);
            if (deploy) {
              return callback(null, { lastState: deploy.lastState,
                running: deploy.isAppRunning() });
            } else {
              return callback({ code: 1, message: 'deploy not found'});
            }
          },
          isInitialized(connection, deployId, callback) {
            console.log('Getting deploy init status');
            const deploy = appRef._deploysEmitters.get(deployId);
            if (deploy) {
              return callback(null, deploy.isInitialized);
            } else {
              return callback(null, false);
            }
          },
        },
      },

      // Event handlers (optional)
      {
        clientService: {
          someEvent(connection, data) {
            console.log(`Got an event from server: ${jstp.stringify(data)}`);
          },
        },
      },
    ),
    _handleConnect: function(error, connection, app) {
      if (error) {
        console.error(`Could not connect to the server: ${error}`);
        return;
      }

      app.serverService.subscribe((error) => {
        if (error) {
          console.error(`Something went wrong: ${error}`);
          return;
        }
        console.log('Subscribed to server events');
      });

      connection.inspectInterface('serverService', (err, proxy) => {
        if (err) {
          console.log(`Failed to inspect interface: ${err}`);
          return;
        }

        this._proxy = proxy;
        appRef = this;
        this.startDeploys();
      });
    },
    start: function(cb) {
      // Connect to jstp server and start all active deploys
      this.connectToJstp(config.jstpUrl)
        .then(() => cb())
        .catch(err => cb(e));
    },
    connectToJstp: function(jstpUrl) {
      return new Promise((resolve, reject) => {
        // Parse jstp url for server address and login
        // credentials
        const options = parseUrl(jstpUrl);
        if (options) {
          // Connect to jstp server
          const connectPolicy = new jstp.SimpleConnectPolicy(options.login,
           options.password);

          const application = this._application;

          jstp.net.connectAndInspect(
            'serverRPC',
            { application, connectPolicy },
            ['serverService'],
            { host: options.host, port: options.port },
            this._handleConnect.bind(this)
          );
          return resolve();
        } else {
          return reject(new Error('jstp url wrong or malformed'));
        }
      });
    },
    startDeploys: function() {
      return new Promise((resolve, reject) => {
        console.log('Loading deploys');
        for (const i in config.deploys) {
          pushDeployEmitter(this._deploysEmitters,
           config.deploys[i], this._proxy);
          this._deploysEmitters.get(config.deploys[i].deployId)
            .emit('start');
        }
        console.log(this._deploysEmitters);
        return resolve();
      });
    },
  }),
};
