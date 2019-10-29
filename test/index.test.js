import run from 'ava';
import data from './data';
import pageCompiler from '../src/index';

pageCompiler.prebuilt.prebuilt = '<div></div>';

run('build prebuilt', (test) => {
  const name = 'prebuilt';
  const dynamicContent = 'test';
  const result = pageCompiler.build(name, dynamicContent);
  const expectedResult = pageCompiler.startText +
    pageCompiler.prebuilt.head.replace('XXX', name) +
    pageCompiler.openText +
    pageCompiler.prebuilt.prebuilt +
    pageCompiler.closeText;

  test.is(result, expectedResult);
});

run('build error', (test) => {
  const name = 'error';
  const dynamicContent = 'test';
  const result = pageCompiler.build(name, dynamicContent);
  const expectedResult = pageCompiler.startText +
    pageCompiler.prebuilt.head.replace('XXX', name) +
    pageCompiler.openText +
    pageCompiler.prebuilt.error.replace('YYY', dynamicContent).replace('// includes error.js error.css', '') +
    pageCompiler.closeText;

  test.is(result, expectedResult);
});

run('build one', (test) => {
  const name = 'one';
  const result = pageCompiler.build(name);
  const expectedResult = pageCompiler.startText +
    pageCompiler.prebuilt.head.replace('XXX', name) + '<script>\n' +
    data['two.js'] +
    '\n' +
    data['one.js'] +
    '</script><style>\n' +
    data['two.css'] +
    data['one.css'].replace('// includes two', '').replace('@extend .extendTest;\n', 'position: absolute;') +
    '</style>' +
    pageCompiler.openText +
    '\n' +
    data['two.html'].replace('// includes two.js one.css', '') +
    data['one.html'].replace('// includes two one.js one.css', '') +
    pageCompiler.closeText;

  test.is(result, expectedResult);
});

run('build two', (test) => {
  const name = 'two';
  const result = pageCompiler.build(name);
  const expectedResult = pageCompiler.startText +
    pageCompiler.prebuilt.head.replace('XXX', name) +
    '<script>\n' +
    data['two.js'] +
    '</script><style>\n' +
    data['two.css'] +
    data['one.css'].replace('// includes two', '').replace('@extend .extendTest;\n', 'position: absolute;') +
    '</style>' +
    pageCompiler.openText +
    data['two.html'].replace('// includes two.js one.css', '') +
    pageCompiler.closeText;

  test.is(result, expectedResult);
});