var CancelController = require('../../../lib/class/CancelController');

describe('class.CancelController', function () {
    it('CancelController#isCanceled', function () {
        var cc = new CancelController();

        expect(cc.isCanceled()).toBe(false);
    });

    it('CancelController#cancel', function () {
        var cc = new CancelController();

        cc.cancel();
        expect(cc.isCanceled()).toBe(true);
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

        expect(count).toBe(0);

        cc.cancel();
        expect(count).toBe(2);
    });
});
