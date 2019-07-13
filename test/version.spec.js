var fs = require('fs');
var path = require('path');
var assert = require('assert');
var HttpClient = require('../lib/class/HttpClient');
var package = require('../package.json');

describe('version', function () {
    it('version is ' + HttpClient.version, function () {
        assert.deepStrictEqual(HttpClient.version, package.version);
    });
});
