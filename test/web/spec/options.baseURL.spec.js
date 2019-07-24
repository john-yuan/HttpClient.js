describe('#options.baseURL', function () {
    var rootURL = location.href.split('/test/')[0];
    var rootURLWithoutProtocol = rootURL.split(':').slice(1).join(':');
    var client = new HttpClient({
        baseURL: rootURL + '/api/all'
    });

    describe('#callback API', function () {
        it('If the url is relative, baseURL should be prepended', function (done) {
            client.send({
                url: '/echo/options.baseURL.callback',
            }, function (response) {
                var data = response.json();
                expect(data.path).toBe('/api/all/echo/options.baseURL.callback');
                done();
            }, function (error) {
                done.fail(error.code + ' ' + error.message);
            });
        });

        it('If the url is absolute (start with http(s)://), baseURL should be ingored', function (done) {
            client.send({
                url: rootURL + '/api/all/echo/options.baseURL.absolute.with.protocol.callback'
            }, function (response) {
                var data = response.json();
                expect(data.path).toBe('/api/all/echo/options.baseURL.absolute.with.protocol.callback');
                done();
            }, function (error) {
                done.fail(error.code + ' ' + error.message);
            });
        });

        it('If the url is absolute (start with //), baseURL should be ingored', function (done) {
            client.send({
                url: rootURLWithoutProtocol + '/api/all/echo/options.baseURL.absolute.without.protocol.callback'
            }, function (response) {
                var data = response.json();
                expect(data.path).toBe('/api/all/echo/options.baseURL.absolute.without.protocol.callback');
                done();
            }, function (error) {
                done.fail(error.code + ' ' + error.message);
            });
        });
    });

    describe('#promise API', function () {
        it('If the url is relative, baseURL should be prepended', function (done) {
            client.fetch({
                url: '/echo/options.baseURL.promise',
            }).then(function (response) {
                var data = response.json();
                expect(data.path).toBe('/api/all/echo/options.baseURL.promise');
                done();
            }, function (error) {
                done.fail(error.code + ' ' + error.message);
            });
        });

        it('If the url is absolute (start with http(s)://), baseURL should be ingored', function (done) {
            client.fetch({
                url: rootURL + '/api/all/echo/options.baseURL.absolute.with.protocol.promise'
            }).then(function (response) {
                var data = response.json();
                expect(data.path).toBe('/api/all/echo/options.baseURL.absolute.with.protocol.promise');
                done();
            }, function (error) {
                done.fail(error.code + ' ' + error.message);
            });
        });

        it('If the url is absolute (start with //), baseURL should be ingored', function (done) {
            client.fetch({
                url: rootURLWithoutProtocol + '/api/all/echo/options.baseURL.absolute.without.protocol.promise'
            }).then(function (response) {
                var data = response.json();
                expect(data.path).toBe('/api/all/echo/options.baseURL.absolute.without.protocol.promise');
                done();
            }, function (error) {
                done.fail(error.code + ' ' + error.message);
            });
        });
    });
});
