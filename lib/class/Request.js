var uuid = require('../shared/uuid');
var hasOwn = Object.prototype.hasOwnProperty;

/**
 * The base Reqeust class.
 *
 * @class
 * @param {string} type The type of request, can be `HTTP_REQUEST` or `JSONP_REQUEST`.
 * @param {RequestOptions} options The request options.
 * @param {RequestSuccessCallback} onsuccess The callback to call on success.
 * @param {RequestErrorCallback} onerror The callback to call on error.
 */
function Request(type, options, onsuccess, onerror) {
    /**
     * If there is an error happend, the `errorCode` is a string reprsengting the type of type error. If there is no
     * error, the value of `errorCode` is `null`.
     */
    this.errorCode = null;

    /**
     * The `XMLHttpRequest` we use when sending http request.
     */
    this.xhr = null;

    /**
     * The `HTMLScriptElement` we use when sending json request.
     */
    this.script = null;

    /**
     * Whether the request is finished.
     */
    this.finished = false;

    /**
     * The response JSON data of the JSONP request.
     */
    this.responseJSON = null;

    /**
     * The `CancelController` that used to cancel this request. We never use this property internally, just holding the
     * information in case that the user needs.
     */
    this.controller = null;

    /**
     * The name of the function that create this request. Can be `send`, `fetch`, `getJOSNP`, `fetchJSONP`. This value
     * is set by the libray itself.
     */
    this.requestFunctionName = null;

    /**
     * An unique id for this request.
     */
    this.requestId = uuid();

    /**
     * The type of request, can be `HTTP_REQUEST` or `JSONP_REQUEST`.
     */
    this.requestType = type;

    /**
     * The request options.
     */
    this.options = options || null;

    /**
     * The callback to call on success.
     */
    this.onsuccess = onsuccess || null;

    /**
     * The callback to call on error.
     */
    this.onerror = onerror || null;

    // Set the request type.
    if (this.options) {
        this.options.requestType = type;
        this.requestFunctionName = this.options.requestFunctionName;
        this.controller = this.options.controller;
    }
}

/**
 * Cancel the current request. When the request is cancelled, the `onerror` callback will be called with the error named
 * `ERR_CANCELLED`.
 */
Request.prototype.cancel = function () {
    // The `cancel` method must be overwritten in the subclass. In case that user call the function with
    // `Function.prototype.apply(...)` or `Function.prototype.call(...)`, we should call the right function directly.
    // The overwritten `cancel` method must not throw any errors.
    if (hasOwn.call(this, 'cancel')) {
        if (isFunction(this.cancel)) {
            // if `this` is an instance of `Request`, no errors will be thrown.
            this.cancel();
        } else {
            throw new Error('this.cancel() is not a function');
        }
    } else {
        throw Error('The cancel method is not found as its own property');
    }
};

module.exports = Request;
