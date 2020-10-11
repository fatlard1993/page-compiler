#!/usr/bin/env node

const util = require('js-util');
const yargs = require('yargs');
const rootFolder = require('find-root')(__dirname);

yargs.version(false);

yargs.alias({
	h: 'help',
	ver: 'version',
	v: 'verbosity',
	c: 'color',
	r: 'rootFolder'
});

yargs.boolean(['h', 'c', 'ver', 'overwriteWithBabel']);

yargs.default({
	v: 1
});

yargs.describe({
	h: 'This',
	v: '<level>',
	c: 'Enables colored logs',
	r: '<root folder>',
	overwriteWithBabel: 'Overwrite individual source JS files after running babel to reduce re-running babel <WARNING THIS IS INTENDED TO BE RUN ON A DEPLOYMENT - DO NOT RUN IN DEV ENVIRONMENT>'
});

var args = yargs.argv;

['_', '$0', 'v', 'c', 'r'].forEach((item) => { delete args[item]; });

var opts = Object.assign({ args: util.clone(args), rootFolder }, args, { verbosity: Number(args.verbosity) });

//log args polyfill
process.env.DBG = opts.verbosity;
process.env.COLOR = opts.version || opts.color;

const log = require('log');

log(1)('[page-compiler] Options: ', opts);

const pageCompiler = require('./pageCompiler');

pageCompiler.init(opts);

module.exports = pageCompiler;