var merge = require('x-common-utils/merge');
var isFunction = require('x-common-utils/isFunction');
var isPlainObject = require('x-common-utils/isPlainObject');
var createDefaultOptions = require('../shared/createDefaultOptions');
var createCancelController = require('../shared/createCancelController');
var version = require('../version');
var HttpRequest = require('./HttpRequest');
var JSONPRequest = require('./JSONPRequest');
var hasOwn = Object.prototype.hasOwnProperty;

/**
 * @class
 *
 * @param {RequestOptions} [defaultOptions] The default options to use when sending requests with the created http
 * client. This default options will be merged into the internal default options that `createDefaultOptions()` returns.
 *
 * @param {HandleOptionsFunction} [handleOptions] The handler function to process the merged default options. The merged
 * default options will be passed into the function as the first argument. You can make changes to it as you want. This
 * function must return synchronously. The return value of this function is ignored.
 */
function HttpClient(defaultOptions, handleOptions) {
    var options = createDefaultOptions();

    if (isPlainObject(defaultOptions)) {
        merge(options, defaultOptions);
    }

    if (isFunction(handleOptions)) {
        handleOptions(options);
        // Deep copy the chagned options
        options = merge({}, options);
    }

    // Rewrite the `copyDefaultOptions()` method, make the `options` private.
    this.copyDefaultOptions = function () {
        return merge({}, options);
    };
}

/**
 * Get a copy of the default options this http client uses.
 *
 * @returns {RequestOptions}
 */
HttpClient.prototype.copyDefaultOptions = function () {
    // This function will be rewritten in the constructor. if this function is called with
    // `Function.prototype.apply(...)` or `Function.prototype.call(...)`, we try to call the correct one,
    if (hasOwn.call(this, 'copyDefaultOptions')) {
        return this.copyDefaultOptions();
    } else {
        throw new Error('this.copyDefaultOptions() is not a function');
    }
};

/**
 * Send an http request.
 *
 * @param {RequestOptions} options The request options to use, which will be merged into a copy of the default options.
 * @param {RequestSuccessCallback} onsuccess The callback to call on success.
 * @param {RequestErrorCallback} onerror The callback to call on error.
 * @returns {HttpRequest} Returns an instance of `HttpRequest`.
 */
HttpClient.prototype.send = function (options, onsuccess, onerror) {
    var defaultOptions = this.copyDefaultOptions();
    var requestOptions = merge(defaultOptions, options);

    requestOptions.requestFunctionName = 'send';
    requestOptions.controller = null;

    return new HttpRequest(requestOptions, onsuccess, onerror);
};

/**
 * Send an http request and return a promise.
 *
 * @param {RequestOptions} options The request options to use, which will be merged into a copy of the default options.
 * @returns {Promise} Returns an instance of `Promise`.
 */
HttpClient.prototype.fetch = function (options) {
    var defaultOptions = this.copyDefaultOptions();
    var requestOptions = merge(defaultOptions, options);
    var controller = requestOptions.controller;

    requestOptions.requestFunctionName = 'fetch';

    return new Promise(function (resolve, reject) {
        var request = new HttpRequest(requestOptions, function (response) {
            if (controller) {
                if (!controller.isCancelled()) {
                    resolve(response);
                }
            } else {
                resolve(response);
            }
        }, reject);

        if (controller) {
            // Trigger the `ERR_CANCELLED` error.
            if (controller.isCancelled()) {
                request.cancel();
            } else {
                controller.registerCancelCallback(function () {
                    request.cancel();
                });
            }
        }
    });
};

/**
 * Send a jsonp request.
 *
 * @param {RequestOptions} options The request options to use, which will be merged into a copy of the default options.
 * @param {RequestSuccessCallback} onsuccess The callback to call on success.
 * @param {RequestErrorCallback} onerror The callback to call on error.
 * @returns {JSONPRequest} Returns an instance of `JSONPRequest`.
 */
HttpClient.prototype.getJSONP = function (options, onsuccess, onerror) {
    var defaultOptions = this.copyDefaultOptions();
    var requestOptions = merge(defaultOptions, options);

    requestOptions.requestFunctionName = 'getJSONP';
    requestOptions.controller = null;

    return new JSONPRequest(requestOptions, onsuccess, onerror);
};

/**
 * Send a jsonp request and return a promise.
 *
 * @param {RequestOptions} options The request options to use, which will be merged into a copy of the default options.
 * @returns {Promise} Returns an instance of `Promise`.
 */
HttpClient.prototype.fetchJSONP = function (options) {
    var defaultOptions = this.copyDefaultOptions();
    var requestOptions = merge(defaultOptions, options);
    var controller = requestOptions.controller;

    requestOptions.requestFunctionName = 'fetchJSONP';

    return new Promise(function (resolve, reject) {
        var request = new JSONPRequest(requestOptions, function (response) {
            if (controller) {
                if (!controller.isCancelled()) {
                    resolve(response);
                }
            } else {
                resolve(response);
            }
        }, reject);

        if (controller) {
            // Trigger the `ERR_CANCELLED` error.
            if (controller.isCancelled()) {
                request.cancel();
            } else {
                controller.registerCancelCallback(function () {
                    request.cancel();
                });
            }
        }
    });
};

/**
 * Create a new instance of `CancelController`.
 *
 * @returns {CancelController} Returns an new instance of `CancelController`.
 */
HttpClient.prototype.createCancelController = createCancelController;

/**
 * Create a new instance of `CancelController`.
 *
 * @returns {CancelController} Returns an new instance of `CancelController`.
 */
HttpClient.createCancelController = createCancelController;

// The version.
HttpClient.version = version;
HttpClient.prototype.version = version;

module.exports = HttpClient;
