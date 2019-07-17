describe('basic', function () {
    it('send http GET request to get JSON', function (done) {
        var client = new HttpClient();

        client.send({
            url: '/api/greeting'
        }, function (response) {
            var data = response.json();
            expect(data.message).toBe('hello');
            done();
        });
    });
});
