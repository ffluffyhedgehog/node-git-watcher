'use strict';

const git = require('./git');
const EventEmitter = require('events').EventEmitter;

const cookEmitPayload = (deploy, args) => Object.assign({ deployID: deploy.id },
args);

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

  emitter.stopApp = () => {
    if (emitter.childProcess) {
      emitter.childProcess.kill('SIGTERM');
      emitter.childProcess = null;
    }
  };

  emitter.emitToServer = (event, args) => {
    emitter.jstp.emit(event, cookEmitPayload(emitter.deploy, args));
  };

  emitter.on('init.start', () => {
    console.log('init started');
    emitter.emitToServer('initStart', null);
  });
  emitter.on('init.err', (err) => {
    console.log('init error: ', err);
    emitter.emitToServer('initErr', err.message);
  });
  emitter.on('fetch.start', () => {
    emitter.stopApp();
    console.log('fetch started');
    emitter.emitToServer('fetchStart', null);
  });
  emitter.on('fetch.end', () => {
    console.log('fetch ended');
    emitter.emitToServer('fetchEnd', null);
  });
  emitter.on('fetch.err', (err) => {
    console.log('fetch err:', err);
    emitter.emitToServer('fetchErr', err.message);
  });
  emitter.on('build.start', () => {
    console.log('build started');
    emitter.emitToServer('buildStart', null);
  });
  emitter.on('build.err', (err) => {
    console.log('build error:', err);
    emitter.emitToServer('buildErr', err.message);
  });
  emitter.on('build.end', (output) => {
    console.log('build finished:', output);
    emitter.emitToServer('buildEnd', output);
  });
  emitter.on('test.start', () => {
    console.log('running tests');
    emitter.emitToServer('testStart', null);
  });
  emitter.on('test.err', (err) => {
    console.log('testing error: ', err);
    emitter.emitToServer('testErr', err.message);
  });
  emitter.on('test.end', (output) => {
    console.log('testing finished: ', output);
    emitter.emitToServer('testEnd', output);
  });
  emitter.on('deploy.start', () => {
    console.log('starting application');
    emitter.emitToServer('deployStart', null);
  });
  emitter.on('deploy.err', (err) => {
    console.log('failed to start application:', err);
    emitter.emitToServer('deployErr', err.message);
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
    emitter.emitToServer('deployEnd', null);
  });
  emitter.on('run.stdout', (data) => {
    console.log('[APPLOG]:', data);
    emitter.emitToServer('runStdout', { stdout: data });
  });
  emitter.on('run.stderr', (data) => {
    console.log('[APPERR]:', data);
    emitter.emitToServer('runStderr', { stderr: data });
  });
  emitter.on('run.err', (data) => {
    console.log('application closed with non-zero exit code: ', data);
    emitter.emitToServer('runErr', { code: data });
  });
  emitter.on('run.end', () => {
    console.log('application closed gracefully');
    emitter.emitToServer('runEnd', null);
  });
  emitter.on('remove.end', () => {
    console.log('application removed');
    emitter.emitToServer('removeEnd', null);
  });
  emitter.on('remove.err', () => {
    console.log('failed to remove application: ', err);
    emitter.emitToServer('removeEnd', { err: err.message });
  });

  // Remote events

  emitter.on('init', () => {
    console.log('starting deploy init');
    git.initAndDeploy(deploy, emitter);
  });
  emitter.on('start', () => {
    console.log('starting application');
    git.startApp(emitter.deploy, emitter);
  });
  emitter.on('stop', () => {
    console.log('stopping application');
    emitter.stopApp();
  });
  emitter.on('remove', (cb) => {
    console.log('removing application');
    emitter.stopApp();
    git.removeDeploy(emitter.deploy.id, emitter, cb);
  });
  
  return emitter;
};
