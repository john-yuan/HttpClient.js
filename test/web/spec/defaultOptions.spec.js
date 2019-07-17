describe('defaultOptions', function () {

    var client = new HttpClient();

    it('default http method is GET', function (done) {
        client.send({
            url: '/api/all/echo/{ post.id }',
            model: {
                post: {
                    id: 1
                }
            }
        }, function (response) {
            var data = response.json();
            expect(data.method).toBe('GET');
            done();
        });
    });

    it('should compile url correctly', function (done) {
        client.send({
            url: '/api/all/echo/{ post.id }',
            model: {
                post: {
                    id: 1
                }
            }
        }, function (response) {
            var data = response.json();
            expect(data.path).toBe('/api/all/echo/1');
            done();
        });
    });

});
