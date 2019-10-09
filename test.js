const run = require('ava');

const pageCompiler = require('./src/index');

pageCompiler.prebuilt.prebuilt = '<div></div>';

run('build prebuilt', (test) => {
	var page = pageCompiler.build('prebuilt');

	test.is(page.length, 104);
});

run('build error', (test) => {
	var page = pageCompiler.build('error', 'test');

	test.is(page.length, 199);
});

run('build one', (test) => {
	var page = pageCompiler.build('one');

	test.is(page.length, 303);
});

run('build two', (test) => {
	var page = pageCompiler.build('two');

	test.is(page.length, 268);
});