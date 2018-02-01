'use strict';
const ArgumentParser = require('argparse').ArgumentParser;

const m = module.exports = {};

const parser = new ArgumentParser({
  version: '0.0.1',
  addHelp: true,
  description: 'Command line utility for watching and pulling changes in particular branch of repository.\n\nSee http://github.com/ffluffyhedgehog/node-git-watcher'
});
/*parser.addArgument(
  [ '-c', '--config' ],
  {
    help: 'Path to a config. Overrides all cli parameters.'
  }
);*/
parser.addArgument(
  [ '-p', '--path' ],
  {
    help: 'Specifies path to repository. ./ by default.'
  }
);
parser.addArgument(
  [ '-b', '--branch' ],
  {
    help: 'Specifies a branch to watch. Master by default'
  }
);
parser.addArgument(
  [ '-t', '--time' ],
  {
    help: 'Specifies how frequently check for changes, in minutes. -t 10 (once every ten minutes) is default.'
  }
);
parser.addArgument(
  [ '-sB', '--script-before' ],
  {
    help: 'Specifies command to execute before pulling. Will be executed in specified path.',
    required: false,
  }
);
parser.addArgument(
  [ '-sA', '--script-after' ],
  {
    help: 'Specifies command to execute after pulling. Will be executed in specified path.',
    required: false,
  }
);
const args = parser.parseArgs();

if (!args.path) {
	args.path = './';
}
if (!args.branch) {
	args.branch = 'master';
}
if (!args.time) {
	args.time = '10';
}

m.args = args;
m.parser = parser;
