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
                expect(error.code).toBe('ERR_CANCELED');
                done();
            });

            controller.cancel();
        });

        it('Request can be canceled before calling send', function (done) {
            var controller = client.createCancelController();

            controller.cancel();

            client.fetch({
                url: '/api/all/echo/options.controller.promise.2',
                controller: controller
            }).then(function (response) {
                done.fail('Should not call the success callback');
            }).catch(function (error) {
                expect(error.code).toBe('ERR_CANCELED');
                done();
            });
        });

        it('Request can be canceled after timeout', function (done) {
            var controller = client.createCancelController();

            client.fetch({
                url: '/api/all/echo/options.controller.promise.3',
                query: {
                    timeout: 100
                },
                controller: controller
            }).then(function (response) {
                done.fail('Should not call the success callback');
            }).catch(function (error) {
                expect(error.code).toBe('ERR_CANCELED');
                done();
            });

            setTimeout(function () {
                controller.cancel();
            }, 30);
        });

        it('Single controller can be used to cancel multiple requests', function (done) {
            var controller = client.createCancelController();
            var finishCount = 0;
            var finish = function () {
                finishCount += 1;
                if (finishCount >= 2) {
                    done();
                }
            };

            client.fetch({
                url: '/api/all/echo/options.controller.promise.4',
                query: {
                    timeout: 100
                },
                controller: controller
            }).then(function (response) {
                done.fail('Should not call the success callback');
            }).catch(function (error) {
                expect(error.code).toBe('ERR_CANCELED');
                finish();
            });

            client.fetch({
                url: '/api/all/echo/options.controller.promise.5',
                query: {
                    timeout: 100
                },
                controller: controller
            }).then(function (response) {
                done.fail('Should not call the success callback');
            }).catch(function (error) {
                expect(error.code).toBe('ERR_CANCELED');
                finish();
            });

            setTimeout(function () {
                controller.cancel();
            }, 30);
        });
    });
});
