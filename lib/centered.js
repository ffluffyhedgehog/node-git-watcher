'use strict';
//const git = require('./git');
const argsparser = require('./arguments').parser;
const logger = require('./logger').logger();
const centeredEmitter = require('./centeredEmitter');
const url = require('url');
const jstp = require('metarhia-jstp');

const DEFAULT_JSTP_PORT = 3228;

const application = new jstp.Application('rpc',
  // RPC methods init, deploy, start\stop etc.)
  {
    clientService: {
      initDeploy(connection, deploy, callback) {
        console.log('Starting deploy init');
        return callback(null);
        // TODO: Implement
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
  }
);

// TODO: Panic if connection could not be established
const handleConnect = (error, connection, app) => {
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
};

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

const connectToJstp = jstpUrl => {
  // Parse jstp url for server address and login
  // credentials
  const options = parseUrl(jstpUrl);
  if (options) {
    // Connect to jstp server
    const connectPolicy = new jstp.SimpleConnectPolicy(options.login,
     options.password);

    jstp.net.connectAndInspect(
      'rpc',
      { application, connectPolicy },
      ['serverService'],
      { host: options.host, port: options.port },
      handleConnect
    );
  } else {
    throw new Error('jstp url wrong or malformed');
  }
};

const startDeploys = () => {
  console.log('Loading deploys');
  // TODO: Implement
};

module.exports = {
  createApplication: config => ({
    start: cb => {
      // Connect to jstp server and start all active deploys
      // TODO: Architectural template, implement
      try {
        connectToJstp(config.jstpUrl);
        startDeploys();
        return cb();
      } catch (e) {
        return cb(e);
      }
    },
  }),
};
