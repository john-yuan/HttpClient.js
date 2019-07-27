describe('#options.controller', function () {
    var client = new HttpClient();

    describe('#promise API', function () {
        it('Should cancel the request by controller', function (done) {
            var controller = client.createCancelController();

            client.fetch({
                url: '/api/all/echo/options.controller.promise.1',
                controller: controller
            }).then(function (response) {
                done.fail('Should not call the success callback');
            }).catch(function (error) {
                expect(error.code).toBe('ERR_CANCELLED');
                done();
            });

            controller.cancel();
        });

        it('Request can be canceled before sending', function (done) {
            var controller = client.createCancelController();

            controller.cancel();

            client.fetch({
                url: '/api/all/echo/options.controller.promise.2',
                controller: controller
            }).then(function (response) {
                done.fail('Should not call the success callback');
            }).catch(function (error) {
                expect(error.code).toBe('ERR_CANCELLED');
                done();
            });
        });

        it('Request can be canceled after timeout', function (done) {
            var controller = client.createCancelController();

            client.fetch({
                url: '/api/all/echo/options.controller.promise.3',
                query: {
                    timeout: 500
                },
                controller: controller
            }).then(function (response) {
                done.fail('Should not call the success callback');
            }).catch(function (error) {
                expect(error.code).toBe('ERR_CANCELLED');
                done();
            });

            setTimeout(function () {
                controller.cancel();
            }, 300);
        });
    });
});
