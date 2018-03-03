'use strict';

const EventEmitter = require('events').EventEmitter;

module.exports = new EventEmitter();

console.log(module.exports);

// TODO: move all these on's to object and iterate over them in loop
// TODO: do something with that module.exports.* mess
// TODO: save child process so it can be closed before restart
// TODO: on fetch.start

module.exports.on('fetch.end', () => console.log('fetch ended'));
module.exports.on('fetch.err', () => console.log('fetch err'));
module.exports.on('build.start', () => console.log('build started'));
module.exports.on('build.err', (err) => console.log('build error:', err));
module.exports.on('build.end', (output) => console.log('build finished:', output));
module.exports.on('test.start', () => console.log('running tests'));
module.exports.on('test.err', (err) => console.log('testing error: ', err));
module.exports.on('test.end', (output) => console.log('testing finished: ', output));
module.exports.on('deploy.start', () => console.log('starting application'));
module.exports.on('deploy.err', (err) => console.log('failed to start application:', err));
module.exports.on('deploy.end', (result) => {
  console.log('application running');
  result.stdout.on('data', (data) => {
    module.exports.emit('run.stdout', data);
  });
  result.stderr.on('data', (data) => {
    module.exports.emit('run.stderr', data);
  });
  result.on('close', (code) => {
    if (code !== 0) {
      module.exports.emit('run.err', code);
    } else {
      module.exports.emit('run.end');
    }
  });
});
module.exports.on('run.stdout', (data) => console.log('[APPLOG]:', data));
module.exports.on('run.stderr', (data) => console.log('[APPERR]:', data));
module.exports.on('run.end', () => console.log('application closed gracefully'));