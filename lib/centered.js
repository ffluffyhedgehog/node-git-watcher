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

let appRef = null;

module.exports = {
  createApplication: config => ({
    _proxy: null,
    _deploysEmmiters: new Map(),
    _application: new jstp.Application('clientRPC',
      // RPC methods init, deploy, start\stop etc.)
      {
        clientService: {
          // deploy - Object { url, deployId, <branch>, <credentials> }
          initDeploy(connection, deploy, callback) {
            console.log('Starting deploy init');
            callback(null);
            const newEmmiter = centeredEmitter(appRef._proxy, deploy);
            newEmmiter.emit('init');
            appRef._deploysEmmiters.set(deploy.deployId, newEmmiter);
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
      });
    },
    start: function(cb) {
      // Connect to jstp server and start all active deploys
      // TODO: Architectural template, implement
      try {
        this.connectToJstp(config.jstpUrl);
        this.startDeploys();
        return cb();
      } catch (e) {
        return cb(e);
      }
    },
    connectToJstp: function(jstpUrl) {
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
      } else {
        throw new Error('jstp url wrong or malformed');
      }
    },
    startDeploys: () => {
      console.log('Loading deploys');
      // TODO: Implement
    },
  }),
};
