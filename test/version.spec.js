var fs = require('fs');
var path = require('path');
var assert = require('assert');
var HttpClient = require('../lib/index');

describe('version', function () {
    it('version is ' + HttpClient.version, function () {
        var addr = path.resolve(__dirname, '../package.json');
        var json = fs.readFileSync(addr).toString();
        var data = JSON.parse(json);

        assert.deepStrictEqual(HttpClient.version, data.version);
    });
});
