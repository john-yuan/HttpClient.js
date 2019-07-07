var isFunction = require('x-common-utils/isFunction');

/**
 * Cancel controller is used to cancel actions. One controller can bind any number of actions.
 *
 * @class
 */
function CancelController() {
    /**
     * @type {boolean} Whether the controller is cancelled.
     */
    this.cancelled = false;

    /**
     * @type {Function[]} The callbacks to call on cancel.
     */
    this.callbacks = [];
}

/**
 * Cancel the actions that bind with this cancel controller.
 */
CancelController.prototype.cancel = function () {
    var callbacks = this.callbacks;
    var i = 0;
    var l = callbacks.length;

    if (this.cancelled === false) {
        this.cancelled = true;

        for ( ; i < l; i += 1) {
            try {
                callbacks[i]();
            } catch (e) {
                // Throw the error later for debuging.
                (function (e) {
                    setTimeout(function () {
                        throw e;
                    })
                })(e);
            }
        }
    }
};

/**
 * Check whether the controller is cancelled.
 *
 * @returns {boolean} Returns `true` if the controller is cancelled, otherwise `false` is returned.
 */
CancelController.prototype.isCancelled = function () {
    return this.cancelled;
};

/**
 * Register a callback, which will be called when the `cancel()` method is called.
 *
 * @param {Function} callback The callback function to call on cancel.
 */
CancelController.prototype.registerCancelCallback = function (callback) {
    if (isFunction(callback)) {
        this.callbacks.push(callback);
    }
};

module.exports = CancelController;
