describe('#options.method', function () {
    var client = new HttpClient();

    describe('#callback API', function () {
        it('The default http method is GET', function (done) {
            client.send({
                url: '/api/all/echo/options.method.GET.callback',
            }, function (response) {
                var data = response.json();
                expect(data.method).toBe('GET');
                done();
            }, function (error) {
                done.fail(error.code + ' ' + error.message);
            });
        });

        it('Should set the http method to POST', function (done) {
            client.send({
                method: 'POST',
                url: '/api/all/echo/options.method.POST.callback',
            }, function (response) {
                var data = response.json();
                expect(data.method).toBe('POST');
                done();
            }, function (error) {
                done.fail(error.code + ' ' + error.message);
            });
        });
    });

    describe('#promise API', function () {
        it('The default http method is GET', function (done) {
            client.fetch({
                url: '/api/all/echo/options.method.GET.promise',
            }).then(function (response) {
                var data = response.json();
                expect(data.method).toBe('GET');
                done();
            }, function (error) {
                done.fail(error.code + ' ' + error.message);
            });
        });

        it('Should set the http method to POST', function (done) {
            client.fetch({
                method: 'POST',
                url: '/api/all/echo/options.method.POST.promise',
            }).then(function (response) {
                var data = response.json();
                expect(data.method).toBe('POST');
                done();
            }, function (error) {
                done.fail(error.code + ' ' + error.message);
            });
        });
    });
});
