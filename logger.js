'use strict';

const m = module.exports = {};

m.logger = () => {
	return {
		_log: '',
		log: function(...args) {
			args.forEach((el) => {
				this._log += el;
			});
		},
		error: function(...args) {
			this._log += '\x1b[1m\x1b[31m';
			this.log(...args);
			this._log += '\x1b[0m';
		},
		warn: function(...args) {
			this._log += '\x1b[1m\x1b[33m';
			this.log(...args);
			this._log += '\x1b[0m';
		},
		important: function(...args) {
			this._log += '\x1b[1m';
			this.log(...args);
			this._log += '\x1b[0m';
		},
		release: function() {
			console.log(this._log);
			this._log = '';
		}
	}
}

/*const aaa = m.logger();

aaa.log('one\n', 'two\n');
aaa.warn('one\n', 'two\n');
aaa.error('one\n', 'two\n');
aaa.log('one\n', 'two\n');
aaa.important('one\n', 'two\n');
aaa.release();*/