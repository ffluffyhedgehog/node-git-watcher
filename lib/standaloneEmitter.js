'use strict';

const EventEmitter = require('events').EventEmitter;

module.exports = new EventEmitter();

const emitter = module.exports;

emitter.childProcess = null;

emitter.on('fetch.start', () => {
  if (emitter.childProcess) {
    emitter.childProcess.kill('SIGTERM');
  }
  console.log('fetch started');
});
emitter.on('fetch.end', () => console.log('fetch ended'));
emitter.on('fetch.err', () => console.log('fetch err'));
emitter.on('build.start', () => console.log('build started'));
emitter.on('build.err', (err) => console.log('build error:', err));
emitter.on('build.end', (output) => console.log('build finished:', output));
emitter.on('test.start', () => console.log('running tests'));
emitter.on('test.err', (err) => console.log('testing error: ', err));
emitter.on('test.end', (output) => console.log('testing finished: ', output));
emitter.on('deploy.start', () => console.log('starting application'));
emitter.on('deploy.err', (err) => console.log('failed to start application:',
  err));
emitter.on('deploy.end', (result) => {
  console.log('application running');
  result.stdout.on('data', (data) => {
    emitter.emit('run.stdout', data);
  });
  result.stderr.on('data', (data) => {
    emitter.emit('run.stderr', data);
  });
  result.on('close', (code) => {
    if (code !== 0) {
      emitter.emit('run.err', code);
    } else {
      emitter.emit('run.end');
    }
  });
  emitter.childProcess = result;
});
emitter.on('run.stdout', (data) => console.log('[APPLOG]:', data));
emitter.on('run.stderr', (data) => console.log('[APPERR]:', data));
emitter.on('run.end', () => console.log('application closed gracefully'));
