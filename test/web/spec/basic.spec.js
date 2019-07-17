describe('basic', function () {

    var client = new HttpClient();

    it('send http GET request to get JSON', function (done) {
        client.send({
            url: '/api/get/greeting'
        }, function (response) {
            var data = response.json();
            expect(data.message).toBe('hello');
            done();
        }, function (error) {
            done.fail(error.code + ' ' + error.message);
        });
    });

    it('send http POST request to get JSON', function (done) {
        client.send({
            method: 'post',
            url: '/api/post/greeting'
        }, function (response) {
            var data = response.json();
            expect(data.message).toBe('hello');
            done();
        }, function (error) {
            done.fail(error.code + ' ' + error.message);
        });
    });

});
