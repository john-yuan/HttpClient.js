var HttpClient = require('../../../lib/class/HttpClient');
var package = require('../../../package.json');

describe('version', function () {
    it('version is ' + HttpClient.version, function () {
        expect(HttpClient.version).toBe(package.version);
    });
});
