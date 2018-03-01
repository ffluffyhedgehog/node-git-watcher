'use strict';

const m = module.exports = {};

m.logger = () => {
  const log = {
    _log: '',
    log(...args) {
      args.forEach((el) => {
        this._log += el + '\n';
      });
      return this;
    },
    error(...args) {
      this._log += '\x1b[1m\x1b[31m';
      this.log(...args);
      this._log += '\x1b[0m';
      return this;
    },
    warn(...args) {
      this._log += '\x1b[1m\x1b[33m';
      this.log(...args);
      this._log += '\x1b[0m';
      return this;
    },
    important(...args) {
      this._log += '\x1b[1m';
      this.log(...args);
      this._log += '\x1b[0m';
      return this;
    },
    flush() {
      console.log(this._log);
      this._log = '';
    }
  };
  process.on('exit', code => {
    log.error('Process exiting with code: ' + code);
    log.flush();
  });
  return log;
};



/*const aaa = m.logger();

aaa.log('one\n', 'two\n');
aaa.warn('one\n', 'two\n');
aaa.error('one\n', 'two\n');
aaa.log('one\n', 'two\n');
aaa.important('one\n', 'two\n');
aaa.release();*/
