// tests are adapted from https://github.com/TooTallNate/node-plist

import { deepEqual, strictEqual } from 'node:assert';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { parseFile, parseFileSync } from '../dist/bplistParser.js';

const __dirname = dirname(fileURLToPath(new URL(import.meta.url)));

describe('bplist-parser', function () {
  it('iTunes Small', async function () {
    const file = join(__dirname, "iTunes-small.bplist");
    const startTime1 = new Date().getTime();

    /** @type {any} */
    const dict = (await parseFile(file))[0];
    const endTime = new Date().getTime();
    console.log('Parsed "' + file + '" in ' + (endTime - startTime1) + 'ms');
    strictEqual(dict['Application Version'], "9.0.3");
    strictEqual(dict['Library Persistent ID'], "6F81D37F95101437");
    deepEqual(dict, parseFileSync(file)[0]);
  });

  it('sample1', async function () {
    const file = join(__dirname, "sample1.bplist");
    const startTime = new Date().getTime();

    /** @type {any} */
    const dict = (await parseFile(file))[0];
    const endTime = new Date().getTime();
    console.log('Parsed "' + file + '" in ' + (endTime - startTime) + 'ms');

    strictEqual(dict['CFBundleIdentifier'], 'com.apple.dictionary.MySample');
    deepEqual(dict, parseFileSync(file)[0]);
  });

  it('sample2', async function () {
    const file = join(__dirname, "sample2.bplist");
    const startTime = new Date().getTime();

    /** @type {any} */
    const dict = (await parseFile(file))[0];
    const endTime = new Date().getTime();
    console.log('Parsed "' + file + '" in ' + (endTime - startTime) + 'ms');

    strictEqual(dict['PopupMenu'][2]['Key'], "\n        #import <Cocoa/Cocoa.h>\n\n#import <MacRuby/MacRuby.h>\n\nint main(int argc, char *argv[])\n{\n  return macruby_main(\"rb_main.rb\", argc, argv);\n}\n");
    deepEqual(dict, parseFileSync(file)[0]);
  });

  it('airplay', async function () {
    const file = join(__dirname, "airplay.bplist");
    const startTime = new Date().getTime();

    /** @type {any} */
    const dict = (await parseFile(file))[0];
    const endTime = new Date().getTime();
    console.log('Parsed "' + file + '" in ' + (endTime - startTime) + 'ms');

    strictEqual(dict['duration'], 5555.0495000000001);
    strictEqual(dict['position'], 4.6269989039999997);
    deepEqual(dict, parseFileSync(file)[0]);
  });

  it('utf16', async function () {
    const file = join(__dirname, "utf16.bplist");
    const startTime = new Date().getTime();

    /** @type {any} */
    const dict = (await parseFile(file))[0];
    const endTime = new Date().getTime();
    console.log('Parsed "' + file + '" in ' + (endTime - startTime) + 'ms');

    strictEqual(dict['CFBundleName'], 'sellStuff');
    strictEqual(dict['CFBundleShortVersionString'], '2.6.1');
    strictEqual(dict['NSHumanReadableCopyright'], '©2008-2012, sellStuff, Inc.');
    deepEqual(dict, parseFileSync(file)[0]);
  });

  it('utf16chinese', async function () {
    const file = join(__dirname, "utf16_chinese.plist");
    const startTime = new Date().getTime();

    /** @type {any} */
    const dict = (await parseFile(file))[0];
    const endTime = new Date().getTime();
    console.log('Parsed "' + file + '" in ' + (endTime - startTime) + 'ms');

    strictEqual(dict['CFBundleName'], '天翼阅读');
    strictEqual(dict['CFBundleDisplayName'], '天翼阅读');
    deepEqual(dict, parseFileSync(file)[0]);
  });

  it('uid', async function () {
    const file = join(__dirname, "uid.bplist");
    const startTime = new Date().getTime();

    /** @type {any} */
    const dict = (await parseFile(file))[0];
    const endTime = new Date().getTime();
    console.log('Parsed "' + file + '" in ' + (endTime - startTime) + 'ms');

    deepEqual(dict['$objects'][1]['NS.keys'], [{UID:2}, {UID:3}, {UID:4}]);
    deepEqual(dict['$objects'][1]['NS.objects'], [{UID: 5}, {UID:6}, {UID:7}]);
    deepEqual(dict['$top']['root'], {UID:1});
    deepEqual(dict, parseFileSync(file)[0]);
  });

  it('int64', async function () {
    const file = join(__dirname, "int64.bplist");
    const startTime = new Date().getTime();

    /** @type {any} */
    const dict = (await parseFile(file))[0];
    const endTime = new Date().getTime();
    console.log('Parsed "' + file + '" in ' + (endTime - startTime) + 'ms');

    strictEqual(dict['zero'], 0);
    strictEqual(dict['int32item'], 1234567890);
    strictEqual(dict['int32itemsigned'], -1234567890);
    strictEqual(dict['int64item'], 12345678901234567890n);
    deepEqual(dict, parseFileSync(file)[0]);
  });
});
