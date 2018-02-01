#!/usr/bin/env node
'use strict';
const shell = require('shelljs');
const git = require('simple-git');
const args = require('./arguments.js').args();
const logger = require('./logger.js').logger();
// console.log(args)
shell.cd(args.path);
// console.log(shell.exec(args.script_before));
const repo = git(args.path);

function watcher() {
	setTimeout(() => {

	}, 0);
}



repo.checkIsRepo((err, isRepo) => {
	if (isRepo) {
		watcher();
		setInterval(watcher, args.time*60000);
	} else {
		logger.error(args.path + ' is not a git repository');
		process.exit(1);
	}
})