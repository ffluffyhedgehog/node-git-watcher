'use strict';

const jstp = require('metarhia-jstp');

let localNodeProxy = null;

const app = new jstp.Application('rpc', {
  serverService: {
    sayHi(connection, name, callback) {
      callback(null, `Hi, ${name}, I am server!`);
    },

    subscribe(connection, callback) {
      connection.inspectInterface('clientService', (error, proxy) => {
        if (error) {
          console.error(`Something went wrong: ${error}`);
          return;
        }
        localNodeProxy = proxy;
        return callback();
      });
    },
  },
});

const auth = {
  authenticate: (connection, application, strategy, credentials, cb) => {
    console.log('Auth credentials: ', credentials);
    console.log('Strategy: ', strategy);
    if (credentials[0] !== 'vasya') {
      return cb(new Error('User not allowed'));
    }
    return cb(null, credentials[0]);
  }
};

const server = jstp.net.createServer({
  applications: [app],
  authPolicy: auth
});
//console.log(server);

server.listen(3228, () => {
  console.log('TCP server listening on port 5000 🚀');
  /*setInterval(() => {
    console.log('Sending broadcast');
    server.broadcast('clientService', 'broadcastEvent', 'some broadcasted shit');
    console.log('Vasya connected:', server.getClientsArray().find())
  }, 3000);*/
});
