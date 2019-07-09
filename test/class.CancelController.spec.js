var CancelController = require('../lib/class/CancelController');
var assert = require('assert');

describe('class.CancelController', function () {
    it('CancelController#isCancelled', function () {
        var cc = new CancelController();

        assert.deepStrictEqual(cc.isCancelled(), false);
    });

    it('CancelController#cancel', function () {
        var cc = new CancelController();

        cc.cancel();
        assert.deepStrictEqual(cc.isCancelled(), true);
    });

    it('CancelController#registerCancelCallback', function () {
        var cc = new CancelController();
        var count = 0;

        cc.registerCancelCallback(function () {
            count += 1;
        });

        cc.registerCancelCallback(function () {
            count += 1;
        });

        assert.deepStrictEqual(count, 0);

        cc.cancel();

        assert.deepStrictEqual(count, 2);
    });
});
