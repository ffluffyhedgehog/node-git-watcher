'use strict';

const git = require('./git');
const EventEmitter = require('events').EventEmitter;

const cookEmitPayload = (deploy, args) => ({
  deployID: deploy.id,
  args,
});

// TODO: Add procedure event listeners (init, deploy, start\stop etc.)

//
// childProcess - child_process/<ChildProcess>
// jstp - metarhia-jstp/<RemoteProxy>
// deploy - Object, populated with deploy`s config
//

module.exports = (jstp, deploy) => {
  const emitter = new EventEmitter();

  emitter.childProcess = null;
  emitter.deploy = deploy;
  emitter.jstp = jstp;

  emitter.emitToServer = (event, args) => {
  //emitter.jstp.emit(event, cookEmitPayload(args));
  // TODO: Only for debug
    emitter.jstp.emit('someEvent', cookEmitPayload(emitter.deploy, args));
  };

  emitter.on('init.start', () => {
    console.log('init started');
    emitter.emitToServer('init.start', null);
  });
  emitter.on('init.err', (err) => {
    console.log('init error: ', err);
    emitter.emitToServer('init.err', err.message);
  });
  emitter.on('fetch.start', () => {
    if (emitter.childProcess) {
      emitter.childProcess.kill('SIGTERM');
    }
    console.log('fetch started');
    emitter.emitToServer('fetch.start', null);
  });
  emitter.on('fetch.end', () => {
    console.log('fetch ended');
    emitter.emitToServer('fetch.end', null);
  });
  emitter.on('fetch.err', (err) => {
    console.log('fetch err:', err);
    emitter.emitToServer('fetch.err', err.message);
  });
  emitter.on('build.start', () => {
    console.log('build started');
    emitter.emitToServer('build.start', null);
  });
  emitter.on('build.err', (err) => {
    console.log('build error:', err);
    emitter.emitToServer('build.err', err.message);
  });
  emitter.on('build.end', (output) => {
    console.log('build finished:', output);
    emitter.emitToServer('build.end', output);
  });
  emitter.on('test.start', () => {
    console.log('running tests');
    emitter.emitToServer('test.start', null);
  });
  emitter.on('test.err', (err) => {
    console.log('testing error: ', err);
    emitter.emitToServer('test.err', err.message);
  });
  emitter.on('test.end', (output) => {
    console.log('testing finished: ', output);
    emitter.emitToServer('test.end', output);
  });
  emitter.on('deploy.start', () => {
    console.log('starting application');
    emitter.emitToServer('deploy.start', null);
  });
  emitter.on('deploy.err', (err) => {
    console.log('failed to start application:', err);
    emitter.emitToServer('deploy.err', err.message);
  });
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
    emitter.emitToServer('deploy.end', null);
  });
  emitter.on('run.stdout', (data) => {
    console.log('[APPLOG]:', data);
    emitter.emitToServer('run.stdout', data);
  });
  emitter.on('run.stderr', (data) => {
    console.log('[APPERR]:', data);
    emitter.emitToServer('run.stderr', data);
  });
  emitter.on('run.end', () => {
    console.log('application closed gracefully');
    emitter.emitToServer('run.end', null);
  });
  emitter.on('init', () => {
    console.log('starting deploy init');
    git.initAndDeploy(deploy, emitter);
  });
  emitter.on('start', () => {
    console.log('starting application');
    git.startApp(emitter.deploy, emitter);
  });

  return emitter;
};