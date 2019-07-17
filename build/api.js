/**
 * Define services for testing.
 *
 * @param {Express} app An instance of Express.
 */
function defineServices(app) {
    app.get('/api/greeting', function (req, res) {
        res.send({
            message: 'hello'
        });
    });
}

exports.defineServices = defineServices;
