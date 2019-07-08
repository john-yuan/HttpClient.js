(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.HttpClient = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
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

},{"x-common-utils/isFunction":39}],2:[function(require,module,exports){
var merge = require('x-common-utils/merge');
var isFunction = require('x-common-utils/isFunction');
var isPlainObject = require('x-common-utils/isPlainObject');
var QS = require('x-query-string');
var isAbsoluteURL = require('x-common-utils/isAbsoluteURL');
var defineExports = require('../shared/defineExports');
var createDefaultOptions = require('../shared/createDefaultOptions');
var createCancelController = require('../shared/createCancelController');
var HttpRequest = require('./HttpRequest');
var constants = require('../constants');
var version = require('../version');
var template = require('../shared/template');
var uuid = require('../shared/uuid');
var noop = require('../shared/noop');
var inherits = require('../shared/inherits');
var hasOwn = Object.prototype.hasOwnProperty;
var CancelController = require('./CancelController');
var HttpRequest = require('./HttpRequest');
var HttpResponse = require('./HttpResponse');
var HttpResponseError = require('./HttpResponseError');
var JSONPRequest = require('./JSONPRequest');
var JSONPResponse = require('./JSONPResponse');
var JSONPResponseError = require('./JSONPResponseError');
var Request = require('./Request');
var Response = require('./Response');
var ResponseError = require('./ResponseError');

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

// HttpClient.exports.classes
// HttpClient.prototype.exports.classes
defineExports(HttpClient, 'classes', {
    CancelController: CancelController,
    HttpClient: HttpClient,
    HttpRequest: HttpRequest,
    HttpResponse: HttpResponse,
    HttpResponseError: HttpResponseError,
    JSONPRequest: JSONPRequest,
    JSONPResponse: JSONPResponse,
    JSONPResponseError: JSONPResponseError,
    Request: Request,
    Response: Response,
    ResponseError: ResponseError
});

// HttpClient.exports.constants
// HttpClient.prototype.exports.constants
defineExports(HttpClient, 'constants', merge({}, constants));

// HttpClient.exports.functions
// HttpClient.prototype.exports.functions
defineExports(HttpClient, 'functions', {
    template: template,
    merge: merge,
    isAbsoluteURL: isAbsoluteURL,
    isFunction: isFunction,
    isPlainObject: isPlainObject,
    uuid: uuid,
    noop: noop,
    inherits: inherits,
    createDefaultOptions: createDefaultOptions
});

// HttpClient.exports.libs
// HttpClient.prototype.exports.libs
defineExports(HttpClient, 'libs', {
    QS: QS
});

module.exports = HttpClient;

/**
 * This callback is used to hanlde the merged default options. It must retrun the result synchronously.
 *
 * @callback HandleOptionsFunction
 * @param {RequestOptions} options The merged default options.
 */

/**
 * The callback to call on success.
 *
 * @callback RequestSuccessCallback
 * @param {HttpResponse|any} response The http response or the return value of `options.transformResponse(response)`.
 */

/**
 * The callback to call on error.
 *
 * @callback RequestErrorCallback
 * @param {HttpResponseError|any} error The http response error or the return value of `options.transformError(error)`.
 */

/**
 * The definiton of the request options.
 *
 * @typedef {Object.<string, *>} RequestOptions
 *
 * @property {string} [method] The http request method. The default method is `GET`.
 *
 * @property {string} [baseURL] The request base url. If the `url` is relative url, and the `baseURL` is not `null`, the
 * `baseURL` will be prepend to the `url`.
 *
 * @property {string} url The request url that can contain any number of placeholders, and will be compiled with the
 * data that passed in with `options.param`.
 *
 * @property {Object.<string, *>} [param] The data used to compile the request url.
 *
 * @property {Object.<string, *>} [query] The data that will be compiled to query string.
 *
 * @property {Object.<string, *>} [body] The object that contains the content which will be send to the server. This
 * object has only one property. The name of the property is the content type of the content, which will be used to find
 * a processor in `options.httpRequestBodyProcessor`. The processor is used to process the value of the property. The
 * processed value which the processor returns will be send to the server as the request body.
 *
 * @property {Object.<string, *>} [extra] The object to keep the extra information that the user passed in. The library
 * itself will not touch this property. You can use this property to hold any information that you want, when you extend
 * the functionality of your own instance of `HttpClient`. The default value of this property is an empty object.
 *
 * @property {Object.<string, *>} [headers] The object that contains the headers to set when sending the request. Only
 * the non-undefined and non-null headers are set.
 *
 * @property {CancelController} [controller] The `CancelController` used to cancel the request. It only works when using
 * `fetch` or `fetchJSONP` to send request. If the you send request using `send` or `getJSONP`, the `options.controller`
 * will be set to `null`.
 *
 * @property {string} [requestFunctionName] The name of the function that send the request. Can be `send`, `fetch`,
 * `getJSONP`, `fetchJSONP`. This value is set by the library, don't change it.
 *
 * @property {string} [requestType] The request type of this request. The value of it is set by the library itself, can
 * be `HTTP_REQUEST` or `JSONP_REQUEST`. Any other value the user passed in is ignored. You can use this property to get
 * the type of the current request.
 *
 * @property {boolean} [cors] Whether to set `withCredentials` property of the `XMLHttpRequest` to `true`. The default
 * value is `false`.
 *
 * @property {Object.<string, *>} [xhrProps] The object that contains the properties to set on the instance of the
 * `XMLHttpRequest`.
 *
 * @property {string} [username] The user name to use for authentication purposes. The defualt value is `null`.
 *
 * @property {string} [password] The password to use for authentication purposes. The defualt value is `null`.
 *
 * @property {number} [timeout] The number of milliseconds the request can take before it finished. If the timeout value
 * is `0`, no timer will be set. If the request does not finsihed within the given time, a timeout error will be thrown.
 * The default value is `0`.
 *
 * @property {boolean} [noCache] Whether to disable the cache. If the value is `true`, the headers in
 * `options.noCacheHeaders` will be set. The default value is `false`.
 *
 * @property {Object.<string, *>} [noCacheHeaders] The headers to set when `options.noCache` is set to `true`.
 *
 * @property {string} [jsonp] The query string key to hold the value of the callback name when sending JSONP request.
 * The default values is `callback`.
 *
 * @property {Object.<string, *>} [errorMessages] The object to config the error messages. The keys in the object are
 * error code such as `ERR_NETWORK`.
 *
 * @property {Object.<string, httpRequestBodyProcessor>} [httpRequestBodyProcessor] The object that contains the
 * http request body processors.
 *
 * @property {Object.<string, ResponseParseFunction>} [httpResponseParser] The object that contains the http response
 * parsers.
 *
 * @property {Object.<string, ResponseParseFunction>} [jsonpResponseParser] The object that contains the jsonp response
 * parsers.
 *
 * @property {Object.<string, ResponseErrorParseFunction>} [httpResponseErrorParser] The object that contains the http
 * response error parsers.
 *
 * @property {Object.<string, ResponseErrorParseFunction>} [jsonpResponseErrorParser] The object that contains the jsonp
 * response error parsers.
 *
 * @property {HanldeOptionsFunction} [handleOptions] The function to handle the options.
 *
 * @property {CreateXHRFunction} [createXHR] The function to create the `XMLHttpRequest` instance.
 *
 * @property {ScriptCreateFunction} [createScript] The function to create the `HTMLScriptElement` instance.
 *
 * @property {JSONPContainerFindFunction} [jsonpContainerNode] The function that returns the container node, which will
 * be used to append the script element when sending jsonp request.
 *
 * @property {JSONPCallbackNameGenerateFunction} [jsonpCallbackName] The function to generate the unique callback name
 * when sending jsonp request.
 *
 * @property {CompileURLFunction} [compileURL] The function to compile url.
 *
 * @property {EncodeQueryStringFunction} encodeQueryString The function to encode the query string.
 *
 * @property {XHRHookFunction} onXhrCreated The function to call on xhr created.
 *
 * @property {XHRHookFunction} onXhrOpened The functon to call on xhr opened.
 *
 * @property {XHRHookFunction} onXhrSent The function to call on xhr sent.
 *
 * @property {RequestCreatedFunction} onRequestCreated The function to call on request created.
 *
 * @property {CheckResponseOkFunction} isResponseOk The function to check whether the response is ok.
 *
 * @property {TransformErrorFunction} transformError The function to transfrom the response error. The return value of
 * this function will be passed to the `onerror` callback.
 *
 * @property {TransformResponseFunction} transformResponse The function to transfrom the response. The return value of
 * this function will be passed to the `onsuccess` callback.
 *
 * @property {CheckShouldCallErrorCallbackFunction} shouldCallErrorCallback The function to check whether to call the
 * error callback.
 *
 * @property {CheckShouldCallSuccessCallbackFunction} shouldCallSuccessCallback The function to check whether to call
 * the success callback.
 */

/**
 * The definiton of http request data processor.
 *
 * @typedef {Object.<string, *>} httpRequestBodyProcessor
 * @property {number} priority The priority of the processor.
 * @property {Object.<string, *>} [headers] The headers to set when this processor is used.
 * @property {HttpRequestContentProcessFunction} [processor] The function to process the request body.
 */

/**
 * The function to handle the options.
 *
 * @callback HanldeOptionsFunction
 * @param {RequestOptions} options The request options.
 */

/**
 * The function to process the request data.
 *
 * @callback HttpRequestContentProcessFunction
 * @param {Object.<string, *>} content The conent need to process.
 * @param {RequestOptions} options The request options of the current request.
 * @returns {any} Returns the value that will be send to the server.
 */

/**
 * The function to parse the response. This function will be mounted on the response instance, which made it a method
 * of the `Response` instance. The parameters and the return value is up on you.
 *
 * @callback ResponseParseFunction
 */

/**
 * The function to parse the response error. This function will be mounted on the response error instance, which made it
 * a method of the `ResponseError` instance. The parameters and the return value is up on you.
 *
 * @callback ResponseErrorParseFunction
 */

/**
 * The function to create the `XMLHttpRequest` instance.
 *
 * @callback CreateXHRFunction
 * @param {RequestOptions} options The request options.
 * @returns {XMLHttpRequest} Returns an instance of `XMLHttpRequest`.
 */

/**
 * The function to create the `HTMLScriptElement` instance.
 *
 * @callback ScriptCreateFunction
 * @param {RequestOptions} options The request options.
 * @returns {HTMLScriptElement} Returns an instance of `HTMLScriptElement`.
 */

/**
 * The function that returns the node to append the script element.
 *
 * @callback JSONPContainerFindFunction
 * @param {RequestOptions} options The request options.
 * @returns {Node} Returns the node to append the script element.
 */

/**
 * The function to generate the unique callback name.
 *
 * @callback JSONPCallbackNameGenerateFunction
 * @param {RequestOptions} options The request options.
 * @returns {string} Retruns a valid javascript identifier to hold the callbak.
 */

/**
 * The function to compile the request url.
 *
 * @callback CompileURLFunction
 * @param {string} url The url (with baseURL) to compile.
 * @param {Object.<string, *>} param The param to compile the url.
 * @param {RequestOptions} options The request options.
 * @returns {string} Returns the compiled url.
 */

/**
 * The function to encode the query string.
 *
 * @callback EncodeQueryStringFunction
 * @param {Object.<string, *>} data The data to be encoded to query string.
 * @param {RequestOptions} options The request options.
 * @returns {string} Returns the encoded query string.
 */

/**
 * The xhr hook function.
 *
 * @callback XHRHookFunction
 * @param {XMLHttpRequest} xhr The instance of `XMLHttpRequest`.
 * @param {RequestOptions} options The request options.
 */

/**
 * @callback RequestCreatedFunction
 * @param {HttpRequest|JSONPRequest} request The request instance, can be `HttpRequest` or `JSONPRequest`.
 */

/**
 * The function to check whether the response is ok.
 *
 * @callback CheckResponseOkFunction
 * @param {string} requestType The request type, `HTTP_REQUEST` or `JSONP_REQUEST`.
 * @param {Response} response The response instance.
 * @returns {boolean} Returns `true` if the response is ok, otherwise `false` is returned.
 */

/**
 * The function to check whether to call the error callback.
 *
 * @callback CheckShouldCallErrorCallbackFunction
 * @param {string} requestType The request type, `HTTP_REQUEST` or `JSONP_REQUEST`.
 * @param {any} transformedError The data that `options.transformError(...)` returns.
 * @param {HttpResponseError|JSONPResponseError} error The response error.
 */

/**
 * The function to check whether to call the success callback.
 *
 * @callback CheckShouldCallSuccessCallbackFunction
 * @param {string} requestType The request type, `HTTP_REQUEST` or `JSONP_REQUEST`.
 * @param {any} transformedResponse The data that `options.transformResponse(...)` returns.
 * @param {HttpResponse|JSONPResponse} response The response.
 */

/**
 * The function to transfrom the response. The return value of this function will be passed to the `onsuccess` callback.
 *
 * @callback TransformResponseFunction
 * @param {string} requestType The request type, `HTTP_REQUEST` or `JSONP_REQUEST`.
 * @param {HttpResponse|JSONPResponse} response The response.
 * @returns {any} Returns the transformed response.
 */

/**
 * The function to transfrom the response error. The return value of this function will be passed to the `onerror`
 * callback.
 *
 * @callback TransformErrorFunction
 * @param {string} requestType The request type, `HTTP_REQUEST` or `JSONP_REQUEST`.
 * @param {HttpResponseError|JSONPResponseError} error The response error.
 * @returns {any} Returns the transformed response error.
 */

},{"../constants":12,"../shared/createCancelController":27,"../shared/createDefaultOptions":28,"../shared/defineExports":29,"../shared/inherits":32,"../shared/noop":33,"../shared/template":34,"../shared/uuid":35,"../version":36,"./CancelController":1,"./HttpRequest":3,"./HttpResponse":4,"./HttpResponseError":5,"./JSONPRequest":6,"./JSONPResponse":7,"./JSONPResponseError":8,"./Request":9,"./Response":10,"./ResponseError":11,"x-common-utils/isAbsoluteURL":37,"x-common-utils/isFunction":39,"x-common-utils/isPlainObject":40,"x-common-utils/merge":41,"x-query-string":44}],3:[function(require,module,exports){
var Requeset = require('./Request');
var constants = require('../constants');
var inherits = require('../shared/inherits');
var buildURL = require('../shared/buildURL');
var handleOptions = require('../shared/handleOptions');
var callRequestCreatedCallback = require('../shared/callRequestCreatedCallback');
var addEventListeners = require('../http/addEventListeners');
var handleXhrProps = require('../http/handleXhrProps');
var handleHeaders = require('../http/handleHeaders');
var handleRequestBody = require('../http/handleRequestBody');
var callXhrHook = require('../http/callXhrHook');

/**
 * Represents an http request.
 *
 * @class
 * @extends {Requeset}
 * @param {RequestOptions} options The request options.
 * @param {RequestSuccessCallback} onsuccess The callback to call on success.
 * @param {RequestErrorCallback} onerror The callback to call on error.
 */
function HttpRequest(options, onsuccess, onerror) {
    var xhr;
    var content;
    var url;

    // Call the super constructor.
    Requeset.call(this, constants.HTTP_REQUEST, options, onsuccess, onerror);

    // Call `options.handleOptions` to handle options.
    handleOptions(options);

    this.xhr = xhr = options.createXHR.call(null, options);
    content = handleRequestBody(options);
    url = buildURL(options);

    // Set properties to the xhr.
    handleXhrProps(xhr, options);

    // Call onXhrCreated.
    callXhrHook(options.onXhrCreated, xhr, options);

    // Add event listeners. This function must overwrite the `cancel` method of this `HttpRequest` instance to cancel
    // this http request.
    addEventListeners(this);

    // Open the request.
    xhr.open(options.method || 'GET', url, true, options.username, options.password);

    // Call onXhrOpened.
    callXhrHook(options.onXhrOpened, xhr, options);

    // Hanlde headers.
    handleHeaders(xhr, options);

    // Send the content to the server.
    xhr.send(content);

    // Call onXhrSent.
    callXhrHook(options.onXhrSent, xhr, options);

    // Call onRequestCreated
    callRequestCreatedCallback(options, this);
}

inherits(HttpRequest, Requeset);

module.exports = HttpRequest;

},{"../constants":12,"../http/addEventListeners":13,"../http/callXhrHook":15,"../http/handleHeaders":16,"../http/handleRequestBody":17,"../http/handleXhrProps":18,"../shared/buildURL":25,"../shared/callRequestCreatedCallback":26,"../shared/handleOptions":31,"../shared/inherits":32,"./Request":9}],4:[function(require,module,exports){
/**
 * HttpResponse module.
 *
 * @module class/HttpResponse
 */

var Response = require('./Response');
var inherits = require('../shared/inherits');
var addCustomParser = require('../shared/addCustomParser');

/**
 * The HttpResponse class.
 *
 * @class
 * @param {HttpRequest} request The http request.
 */
function HttpResponse(request) {
    Response.call(this, request);
    addCustomParser(this, request.options, 'httpResponseParser');
}

inherits(HttpResponse, Response);

module.exports = HttpResponse;

},{"../shared/addCustomParser":24,"../shared/inherits":32,"./Response":10}],5:[function(require,module,exports){
var ResponseError = require('./ResponseError');
var inherits = require('../shared/inherits');
var addCustomParser = require('../shared/addCustomParser');

/**
 * @class
 * @param {string} code The error code.
 * @param {HttpRequest} request The http request.
 */
function HttpResponseError(code, request) {
    ResponseError.call(this, code, request);
    addCustomParser(this, request.options, 'httpResponseErrorParser');
}

inherits(HttpResponseError, ResponseError);

module.exports = HttpResponseError;

},{"../shared/addCustomParser":24,"../shared/inherits":32,"./ResponseError":11}],6:[function(require,module,exports){
var Requeset = require('./Request');
var constants = require('../constants');
var inherits = require('../shared/inherits');
var handleOptions = require('../shared/handleOptions');
var callRequestCreatedCallback = require('../shared/callRequestCreatedCallback');
var addEventListeners = require('../jsonp/addEventListeners');
var buildCallbackName = require('../jsonp/buildCallbackName');
var handleScriptCors = require('../jsonp/handleScriptCors');
var buildScriptSrc = require('../jsonp/buildScriptSrc');

/**
 * Represents an json request.
 *
 * @class
 * @extends {Requeset}
 * @param {RequestOptions} options The request options.
 * @param {RequestSuccessCallback} onsuccess The callback to call on success.
 * @param {RequestErrorCallback} onerror The callback to call on error.
 */
function JSONPRequest(options, onsuccess, onerror) {
    var src;
    var script;
    var callbackName;
    var containerNode;

    Requeset.call(this, constants.JSONP_REQUEST, options, onsuccess, onerror);

    // Call `options.handleOptions` to handle options.
    handleOptions(options);

    script = this.script = options.createScript.call(null, options);
    containerNode = options.jsonpContainerNode.call(null, options);
    callbackName = buildCallbackName(options);
    src = buildScriptSrc(options, callbackName);

    // Set the src attribute.
    script.setAttribute('src', src);

    // Handle `options.cors`
    handleScriptCors(script, options);

    // Add event listeners
    addEventListeners(this, callbackName);

    // Inject the script node
    containerNode.appendChild(script);

    // Call onRequestCreated
    callRequestCreatedCallback(options, this);
}

inherits(JSONPRequest, Requeset);

module.exports = JSONPRequest;

},{"../constants":12,"../jsonp/addEventListeners":20,"../jsonp/buildCallbackName":21,"../jsonp/buildScriptSrc":22,"../jsonp/handleScriptCors":23,"../shared/callRequestCreatedCallback":26,"../shared/handleOptions":31,"../shared/inherits":32,"./Request":9}],7:[function(require,module,exports){
/**
 * JSONPResponse module.
 *
 * @module class/JSONPResponse
 */

var Response = require('./Response');
var inherits = require('../shared/inherits');
var addCustomParser = require('../shared/addCustomParser');

/**
 * The JSONPResponse class.
 *
 * @class
 * @param {JSONRequest} request The http request.
 */
function JSONPResponse(request) {
    Response.call(this, request);
    addCustomParser(this, request.options, 'jsonpResponseParser');
}

inherits(JSONPResponse, Response);

module.exports = JSONPResponse;

},{"../shared/addCustomParser":24,"../shared/inherits":32,"./Response":10}],8:[function(require,module,exports){
var ResponseError = require('./ResponseError');
var inherits = require('../shared/inherits');
var addCustomParser = require('../shared/addCustomParser');

/**
 * @class
 * @param {string} code The error code.
 * @param {JSONPRequest} request The JSONP request.
 */
function JSONPResponseError(code, request) {
    ResponseError.call(this, code, request);
    addCustomParser(this, request.options, 'jsonpResponseErrorParser');
}

inherits(ResponseError, JSONPResponseError);

module.exports = JSONPResponseError;

},{"../shared/addCustomParser":24,"../shared/inherits":32,"./ResponseError":11}],9:[function(require,module,exports){
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
    this.jsonpResponse = null;

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

},{"../shared/uuid":35}],10:[function(require,module,exports){
/**
 * Represents a response.
 *
 * @param {Request} request The instance of `Request`.
 */
function Response(request) {
    /**
     * @type {Request}
     */
    this.request = request || null;
}

module.exports = Response;

},{}],11:[function(require,module,exports){
var isPlainObject = require('x-common-utils/isPlainObject');

/**
 * Represents response error.
 *
 * @constructor
 * @param {string} code The error code.
 * @param {Request} request The request.
 */
function ResponseError(code, request) {
    var options = request ? request.options : {};
    var errorMessages = options.errorMessages;
    var message;

    code = code || 'ERR_UNKNOWN';

    if (isPlainObject(errorMessages)) {
        if (errorMessages[code]) {
            message = errorMessages[code];
        }
    }

    if (!message) {
        message = 'Unknown error ' + code;
    }

    if (request) {
        request.errorCode = code;
    }

    this.code = code;
    this.request = request || null;
    this.message = message;
}

module.exports = ResponseError;

},{"x-common-utils/isPlainObject":40}],12:[function(require,module,exports){
exports.ERR_ABORTED = 'ERR_ABORTED';
exports.ERR_RESPONSE = 'ERR_RESPONSE';
exports.ERR_CANCELLED = 'ERR_CANCELLED';
exports.ERR_NETWORK = 'ERR_NETWORK';
exports.ERR_TIMEOUT = 'ERR_TIMEOUT';
exports.HTTP_REQUEST = 'HTTP_REQUEST';
exports.JSONP_REQUEST = 'JSONP_REQUEST';

},{}],13:[function(require,module,exports){
var isFunction = require('x-common-utils/isFunction');
var HttpResponse = require('../class/HttpResponse');
var addTimeoutListener = require('./addTimeoutListener');
var fireCallbacks = require('../shared/fireCallbacks');
var noop = require('../shared/noop');
var constants = require('../constants');
var ERR_ABORTED   = constants.ERR_ABORTED;
var ERR_CANCELLED = constants.ERR_CANCELLED;
var ERR_NETWORK   = constants.ERR_NETWORK;
var ERR_RESPONSE  = constants.ERR_RESPONSE;
var ERR_TIMEOUT   = constants.ERR_TIMEOUT;

/**
 * Add event listeners to the http request. This function will overwite the `cancel` method on the given `HttpReqest`
 * instance.
 *
 * @param {HttpRequest} request The http request to add event listeners.
 */
function addEventListeners(request) {
    var xhr = request.xhr;
    var options = request.options;
    var requestType = request.requestType;
    var response = new HttpResponse(request);
    var isResponseOk = options.isResponseOk;
    var clearTimeoutEvent = null;
    var timeout = parseInt(options.timeout || 0, 10);

    /**
     * Cancel the request.
     */
    var cancel = function () {
        clearEvents();
        if (xhr.abort) {
            try {
                xhr.abort();
            } catch (e) {}
        }
        finish(ERR_CANCELLED);
    };

    /**
     * The function to clear events.
     */
    var clearEvents = function () {
        // Set clearEvents to the noop function.
        clearEvents = noop;

        xhr.onabort = null;
        xhr.onerror = null;
        xhr.onreadystatechange = null;
        xhr.ontimeout = null;

        if (clearTimeoutEvent) {
            clearTimeoutEvent();
            clearTimeoutEvent = null;
        }
    };

    /**
     * The function finish the request.
     *
     * @param {string} code The error code on error. If no error occured, the code is `null`.
     */
    var finish = function (code) {
        // Set finish to the noop function.
        finish = noop;

        // Set cancel to the noop function.
        cancel = noop;

        // Mark this request as finished.
        request.finished = true;

        // Clear events.
        clearEvents();

        // Fire callbacks.
        fireCallbacks(code, response);
    };

    xhr.onabort = function () {
        finish(ERR_ABORTED);
    };

    xhr.onerror = function () {
        finish(ERR_NETWORK);
    };

    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
            if (isFunction(isResponseOk)) {
                if (isResponseOk(requestType, response)) {
                    finish(null);
                } else {
                    finish(ERR_RESPONSE);
                }
            } else {
                finish(null);
            }
        }
    };

    /**
     * Rewrite the `cancel` method.
     */
    request.cancel = function () {
        cancel();
    };

    // Add timeout listener
    if (!isNaN(timeout) && timeout > 0) {
        clearTimeoutEvent = addTimeoutListener(xhr, timeout, function () {
            clearEvents();
            if (xhr.abort) {
                try {
                    xhr.abort();
                } catch (e) {}
            }
            finish(ERR_TIMEOUT);
        });
    }
}

module.exports = addEventListeners;

},{"../class/HttpResponse":4,"../constants":12,"../shared/fireCallbacks":30,"../shared/noop":33,"./addTimeoutListener":14,"x-common-utils/isFunction":39}],14:[function(require,module,exports){
/**
 * Add timeout event listener on the XHR object.
 *
 * @param {XMLHttpRequest} xhr The XHR to add timeout event listener.
 * @param {number} timeout The time to wait in milliseconds.
 * @param {() => void} listener The timeout callback.
 * @returns {() => void)} Returns a function to remove the timeout event listener.
 */
function addTimeoutListener(xhr, timeout, listener) {
    var timeoutId = null;
    var supportTimeout = 'timeout' in xhr && 'ontimeout' in xhr;

    if (supportTimeout) {
        xhr.timeout = timeout;
        xhr.ontimeout = listener;
    } else {
        timeoutId = setTimeout(listener, timeout);
    }

    // Call this function to remove timeout event listener
    function clearTimeoutEvent() {
        if (xhr) {
            if (timeoutId === null) {
                xhr.ontimeout = null;
            } else {
                clearTimeout(timeoutId);
            }
            xhr = null;
            listener = null;
        }
    }

    return clearTimeoutEvent;
}

module.exports = addTimeoutListener;

},{}],15:[function(require,module,exports){
var isFunction = require('x-common-utils/isFunction');

/**
 * The function to call xhr hook function.
 *
 * @param {XHRHookFunction} func The hook function to call, if it is not function, this hook is skipped.
 * @param {XMLHttpReqeust} xhr The instance of `XMLHttpReqeust`.
 * @param {RequestOption} options The request options.
 */
function callXhrHook(func, xhr, options) {
    if (isFunction(func)) {
        func(xhr, options);
    }
}

module.exports = callXhrHook;

},{"x-common-utils/isFunction":39}],16:[function(require,module,exports){
var merge = require('x-common-utils/merge');
var isPlainObject = require('x-common-utils/isPlainObject');
var hasOwn = Object.prototype.hasOwnProperty;

/**
 * The function to set the request headers.
 *
 * 1. Merge the `options.noCacheHeaders` if needed.
 * 2. Set the request headers if needed.
 *
 * @param {XMLHttpReqeust} xhr The instance of `XMLHttpReqeust`.
 * @param {RequestOption} options The request options.
 */
function handleHeaders(xhr, options) {
    var name;
    var value;
    var headers = isPlainObject(options.headers) ? options.headers : {};

    if (options.noCache) {
        if (isPlainObject(options.noCacheHeaders)) {
            headers = merge(headers, options.noCacheHeaders);
        }
    }

    for (name in headers) {
        if (hasOwn.call(headers, name)) {
            value = headers[name];
            // Only the non-undefined and non-null headers are set
            if (value !== undefined && value !== null) {
                xhr.setRequestHeader(name, value);
            }
        }
    }

    // Set the headers back.
    options.headers = headers;
}

module.exports = handleHeaders;

},{"x-common-utils/isPlainObject":40,"x-common-utils/merge":41}],17:[function(require,module,exports){
var merge = require('x-common-utils/merge');
var isFunction = require('x-common-utils/isFunction');
var isPlainObject = require('x-common-utils/isPlainObject');
var hasOwn = Object.prototype.hasOwnProperty;

/**
 * Find a processor from `options.httpRequestBodyProcessor` to process the request body.
 *
 * @param {RequestOptions} options The request options.
 * @returns {any} Retruns the content that send to the server.
 */
function handleRequestBody(options) {
    var i;
    var l;
    var key;
    var content = null;
    var processor;
    var contentProcessor;
    var contentProcessors = [];
    var body = options.body;
    var processors = options.httpRequestBodyProcessor;
    var headers = isPlainObject(options.headers) ? options.headers : {};

    if (isPlainObject(body) && isPlainObject(processors)) {
        // Find all processors.
        for (key in processors) {
            if (hasOwn.call(processors, key)) {
                processor = processors[key];
                if (isPlainObject(processor)) {
                    contentProcessors.push({
                        key: key,
                        headers: processor.headers,
                        priority: processor.priority,
                        processor: processor.processor
                    });
                }
            }
        }

        // Sort the processors by its priority.
        contentProcessors.sort(function (a, b) {
            return b.priority - a.priority;
        });

        // Find the first non-undefined content.
        for (i = 0, l = contentProcessors.length; i < l; i += 1) {
            processor = contentProcessors[i];
            if (body[processor.key] !== undefined) {
                content = body[processor.key];
                contentProcessor = processor;
                break;
            }
        }

        // Use the processor to process the content.
        if (contentProcessor) {
            if (isPlainObject(contentProcessor.headers)) {
                headers = merge(headers, contentProcessor.headers);
            }
            processor = contentProcessor.processor;
            if (isFunction(processor)) {
                content = processor(content, options);
            }
        }
    }

    // Make sure that the headers is a plain object.
    options.headers = headers;

    return content;
}

module.exports = handleRequestBody;

},{"x-common-utils/isFunction":39,"x-common-utils/isPlainObject":40,"x-common-utils/merge":41}],18:[function(require,module,exports){
var isPlainObject = require('x-common-utils/isPlainObject');
var hasOwn = Object.prototype.hasOwnProperty;

/**
 * The function to hanlde XMLHttpRequest properties.
 *
 * @param {XMLHttpRequest} xhr The instance of `XMLHttpRequest`.
 * @param {RequestOptions} options The request options.
 */
function handleXhrProps(xhr, options) {
    var prop;
    var xhrProps = options.xhrProps;

    if (options.cors) {
        xhr.withCredentials = true;
    }

    if (isPlainObject(xhrProps)) {
        for (prop in xhrProps) {
            if (hasOwn.call(xhrProps, prop)) {
                xhr[prop] = xhrProps[prop];
            }
        }
    }
}

module.exports = handleXhrProps;

},{"x-common-utils/isPlainObject":40}],19:[function(require,module,exports){
module.exports = require('./class/HttpClient');

},{"./class/HttpClient":2}],20:[function(require,module,exports){
var isFunction = require('x-common-utils/isFunction');
var JSONPResponse = require('../class/JSONPResponse');
var fireCallbacks = require('../shared/fireCallbacks');
var noop = require('../shared/noop');
var constants = require('../constants');
var ERR_CANCELLED = constants.ERR_CANCELLED;
var ERR_NETWORK   = constants.ERR_NETWORK;
var ERR_RESPONSE  = constants.ERR_RESPONSE;
var ERR_TIMEOUT   = constants.ERR_TIMEOUT;

function addEventListeners(request, callbackName) {
    var script = request.script;
    var options = request.options;
    var requestType = request.requestType;
    var isResponseOk = options.isResponseOk;
    var response = new JSONPResponse(request);
    var timeout = parseInt(options.timeout || 0, 10);
    var timeoutId = null;

    /**
     * The function finish the request.
     *
     * @param {string} code The error code on error. If no error occured, the code is `null`.
     */
    var finish = function (code) {
        // Set finish to the no operation function.
        finish = noop;

        // Mark this request as finished.
        request.finished = true;

        // Clear listeners.
        window[callbackName] = noop;
        script.onerror = null;

        // Clear timeout.
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }

        // Fire callbacks.
        fireCallbacks(code, response);
    };

    // Define the callback function.
    window[callbackName] = function (responseJSON) {
        request.jsonpResponse = responseJSON;
        if (isFunction(isResponseOk)) {
            if (isResponseOk(requestType, response)) {
                finish(null);
            } else {
                finish(ERR_RESPONSE);
            }
        } else {
            finish(null);
        }
    };

    // Catch the error.
    script.onerror = function () {
        finish(ERR_NETWORK);
    };

    // Rewrite the `cancel` method.
    request.cancel = function () {
        finish(ERR_CANCELLED);
    };

    // Add timeout listener
    if (!isNaN(timeout) && timeout > 0) {
        timeoutId = setTimeout(function () {
            finish(ERR_TIMEOUT);
        }, timeout);
    }
}

module.exports = addEventListeners;

},{"../class/JSONPResponse":7,"../constants":12,"../shared/fireCallbacks":30,"../shared/noop":33,"x-common-utils/isFunction":39}],21:[function(require,module,exports){
/**
 * The function to create JSONP callback name.
 *
 * @param {RequestOptions} options The request options.
 * @returns {string} Returns the callback name.
 */
function buildCalllbackName(options) {
    var callbackName;

    do {
        callbackName = options.jsonpCallbackName.call(null, options);
    } while (callbackName in window);

    window[callbackName] = null;

    return callbackName;
}

module.exports = buildCalllbackName;

},{}],22:[function(require,module,exports){
var buildURL = require('../shared/buildURL');

/**
 * Build the JSONP script src.
 *
 * @param {RequestOptions} options The request opitons.
 * @param {string} callbackName The callback name of the JSONP.
 * @return {string} Returns the script src.
 */
function buildScriptSrc(options, callbackName) {
    // var username = options.username;
    // var password = options.password;
    // var link;
    var query = options.query;
    var key = options.jsonp;
    var url;

    if (!query) {
        query = {};
        options.query = query;
    }

    query[key] = callbackName;
    url = buildURL(options);

    return url;
}

module.exports = buildScriptSrc;

},{"../shared/buildURL":25}],23:[function(require,module,exports){
/**
 * The function to handle `options.cors` setting when sending JSONP requests. If `options.cors` is `true`, the
 * `crossorigin` attribute of the `script` element we using is set to `use-credentials`.
 *
 * @param {HTMLScriptElement} script The script element.
 * @param {RequestOptions} options The request options.
 */
function handleScriptCors(script, options) {
    if (options.cors) {
        script.setAttribute('crossorigin', 'use-credentials');
    }
}

module.exports = handleScriptCors;

},{}],24:[function(require,module,exports){
var isPlainObject = require('x-common-utils/isPlainObject');
var isFunction = require('x-common-utils/isFunction');
var hasOwn = Object.prototype.hasOwnProperty;

/**
 * The function to add custom parsers to the instance of `Response` or `ResponseError`.
 *
 * @param {Response|ResponseError} target The target to add the custome parsers.
 * @param {RequestOptions} options The request options.
 * @param {string} optionName The option name the parsers container.
 */
function addCustomParser(target, options, optionName) {
    var parsers = options[optionName];
    var name;
    var parser;

    if (isPlainObject(parsers)) {
        for (name in parsers) {
            if (hasOwn.call(parsers, name)) {
                parser = parsers[name];
                if (isFunction(parser)) {
                    if (name in target) {
                        throw new Error('The name "' + name + '" has already existed, can not add it as a parser');
                    }
                    target[name] = parser;
                }
            }
        }
    }
}

module.exports = addCustomParser;

},{"x-common-utils/isFunction":39,"x-common-utils/isPlainObject":40}],25:[function(require,module,exports){
var isFunction = require('x-common-utils/isFunction');
var isAbsoluteURL = require('x-common-utils/isAbsoluteURL');
var isPlainObject = require('x-common-utils/isPlainObject');

/**
 * The function to build request url.
 *
 * 1. Add baseURL if needed.
 * 2. Compile url if needed.
 * 3. Compile query string if needed.
 *
 * @param {RequestOptions} options The request options.
 * @returns {string} Returns the final url string.
 */
function buildURL(options) {
    var url = (typeof options.url === 'string') ? options.url : '';
    var baseURL = options.baseURL;
    var param = options.param;
    var query = options.query;
    var compileURL = options.compileURL;
    var encodeQueryString = options.encodeQueryString;
    var array;

    // If the url is not absolute url and the baseURL is defined,
    // prepend the baseURL to the url.
    if (!isAbsoluteURL(url)) {
        if (typeof baseURL === 'string') {
            url = baseURL + url;
        }
    }

    // Compile the url if needed.
    if (isPlainObject(param) && isFunction(compileURL)) {
        url = compileURL(url, param, options);
    }

    // Compile the query string.
    if (isPlainObject(query) && isFunction(encodeQueryString)) {
        query = encodeQueryString(query, options);
        array = url.split('#'); // There may be something hash string in the url.
        url = array[0];

        if (url.indexOf('?') > -1) {
            // Check whether the url is ending with a `&`.
            if (/&+$/.test(url)) {
                url = url + query;
            } else {
                url = url + '&' + query;
            }
        } else {
            url = url + '?' + query;
        }

        array[0] = url;
        url = array.join('#');
    }

    return url;
}

module.exports = buildURL;

},{"x-common-utils/isAbsoluteURL":37,"x-common-utils/isFunction":39,"x-common-utils/isPlainObject":40}],26:[function(require,module,exports){
var isFunction = require('x-common-utils/isFunction');

/**
 * The function to call `options.onRequestCreated` callback.
 *
 * @param {RequestOptions} options The request options.
 * @param {HttpRequest|JSONPRequest} request The request instance.
 */
function callRequestCreatedCallback(options, request) {
    var onRequestCreated = options.onRequestCreated;

    if (isFunction(onRequestCreated)) {
        onRequestCreated(request);
    }
}

module.exports = callRequestCreatedCallback;

},{"x-common-utils/isFunction":39}],27:[function(require,module,exports){
var CancelController = require('../class/CancelController');

/**
 * Create a new instance of `CancelController`.
 *
 * @returns {CancelController} Returns an new instance of `CancelController`.
 */
var createCancelController = function () {
    return new CancelController;
};

module.exports = createCancelController;

},{"../class/CancelController":1}],28:[function(require,module,exports){
var QS = require('x-query-string');
var constants = require('../constants');
var template = require('./template');
var uuid = require('./uuid');
var HTTP_REQUEST  = constants.HTTP_REQUEST;
var ERR_ABORTED   = constants.ERR_ABORTED;
var ERR_CANCELLED = constants.ERR_CANCELLED;
var ERR_NETWORK   = constants.ERR_NETWORK;
var ERR_RESPONSE  = constants.ERR_RESPONSE;
var ERR_TIMEOUT   = constants.ERR_TIMEOUT;

/**
 * Create a new default request options.
 *
 * @returns {RequestOptions} Returns a new default request opitons.
 */
function createDefaultOptions() {
    var errorMessages = {};

    errorMessages[ERR_ABORTED] = 'Request aborted';
    errorMessages[ERR_CANCELLED] = 'Request cancelled';
    errorMessages[ERR_NETWORK] = 'Network error';
    errorMessages[ERR_RESPONSE] = 'Response error';
    errorMessages[ERR_TIMEOUT] = 'Request timeout';

    /**
     * @type {RequestOptions}
     */
    var options = {
        method: 'GET',
        baseURL: null,
        url: null,
        param: null,
        query: null,
        headers: null,
        body: null,
        extra: {},
        controller: null,
        requestFunctionName: null,
        requestType: null,
        cors: false,
        xhrProps: null,
        username: null,
        password: null,
        timeout: 0,
        noCache: false,
        noCacheHeaders: {
            'Pragma': 'no-cache',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        },
        jsonp: 'callback',
        errorMessages: errorMessages,
        httpRequestBodyProcessor: {
            raw: {
                priority: 0,
                headers: null,
                processor: null,
            },
            form: {
                priority: 1,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
                },
                processor: function (data, options) {
                    return QS.encode(data);
                }
            },
            json: {
                priority: 2,
                headers: {
                    'Content-Type': 'application/json; charset=UTF-8'
                },
                processor: function (data, options) {
                    return JSON.stringify(data);
                }
            }
        },
        httpResponseParser: {
            json: function () {
                // `this` is point to the current instance of `HttpResponse`.
                var responseText = this.request.xhr.responseText;
                return responseText ? JSON.parse(responseText) : null;
            },
            text: function () {
                return this.request.xhr.responseText;
            },
            status: function () {
                return this.request.xhr.status;
            }
        },
        jsonpResponseParser: {
            json: function () {
                return this.request.jsonpResponse;
            }
        },
        httpResponseErrorParser: null,
        jsonpResponseErrorParser: null,
        handleOptions: null,
        createXHR: function (options) {
            return new XMLHttpRequest();
        },
        createScript: function (options) {
            var script = document.createElement('script');

            script.setAttribute('type', 'text/javascript');
            script.setAttribute('charset', 'utf-8');

            return script;
        },
        jsonpContainerNode: function (options) {
            return document.head || document.getElementsByName('head')[0];
        },
        jsonpCallbackName: function (options) {
            return 'jsonp_' + uuid() + '_' + (new Date().getTime());
        },
        compileURL: function (url, param, options) {
            return template(url, param);
        },
        encodeQueryString: function (data, options) {
            return QS.encode(data);
        },
        onXhrCreated: null,
        onXhrOpened: null,
        onXhrSent: null,
        onRequestCreated: null,
        isResponseOk: function (requestType, response) {
            var status;

            // Http reqest
            if (requestType === HTTP_REQUEST) {
                status = response.request.xhr.status;
                return (status >= 200 && status < 300) || status === 304;
            }

            // JSONP request
            return true;
        },
        transformError: null,
        transformResponse: null,
        shouldCallErrorCallback: null,
        shouldCallSuccessCallback: null
    };

    return options;
}

module.exports = createDefaultOptions;

},{"../constants":12,"./template":34,"./uuid":35,"x-query-string":44}],29:[function(require,module,exports){
/**
 * Define a static member on the given constructor and its prototype
 *
 * @param {Constructor} ctor The constructor to define the static member
 * @param {string} name The name of the static member
 * @param {any} value The value of the static member
 * @throws {Error} Throws error if the name has already existed, or the constructor is not a function
 */
function defineExports(ctor, name, value) {
    if (typeof ctor !== 'function' || !ctor.prototype) {
        throw new Error('The constructor is not a function or its prototype is not an object');
    }

    ctor.exports = ctor.exports || {};

    if (name in ctor.exports) {
        throw new Error('The name "' + name + '" has already existed in the constructor.exports');
    }

    if (ctor.prototype.exports && ctor.prototype.exports !== ctor.exports) {
        throw new Error('The name "exports" has already existed in the constructor.prototype');
    } else {
        ctor.prototype.exports = ctor.exports;
    }

    ctor.exports[name] = value;
}

module.exports = defineExports;

},{}],30:[function(require,module,exports){
var isFunction = require('x-common-utils/isFunction');
var HttpResponseError = require('../class/HttpResponseError');
var JSONPResponseError = require('../class/JSONPResponseError');
var constants = require('../constants');
var HTTP_REQUEST = constants.HTTP_REQUEST;

/**
 * Fire the callbacks.
 *
 * @param {string|null} code If there is an error, `code` should be a string. If there is no error, `code` is `null`.
 * @param {HttpResponse|JSONPResponse} response The response instance.
 */
function fireCallbacks(code, response) {
    var request = response.request;
    var requestType = request.requestType;
    var options = request.options;
    var onsuccess = request.onsuccess;
    var onerror = request.onerror;
    var shouldCallErrorCallback = options.shouldCallErrorCallback;
    var shouldCallSuccessCallback = options.shouldCallSuccessCallback;
    var transformError = options.transformError;
    var transformResponse = options.transformResponse;

    var error = null;
    var callErrorCallback = true;
    var callSuccessCallback = true;
    var transformedError = null;
    var transformedResponse = null;

    if (code) {
        if (requestType === HTTP_REQUEST) {
            error = new HttpResponseError(code, request);
        } else {
            error = new JSONPResponseError(code, request);
        }
        if (isFunction(transformError)) {
            transformedError = transformError(requestType, error);
        } else {
            transformedError = error;
        }
        if (isFunction(shouldCallErrorCallback)) {
            callErrorCallback = shouldCallErrorCallback(requestType, transformedError, error);
        }
        if (callErrorCallback) {
            if (isFunction(onerror)) {
                onerror(transformedError);
            }
        }
    } else {
        if (isFunction(transformResponse)) {
            transformedResponse = transformResponse(requestType, response);
        } else {
            transformedResponse = response;
        }
        if (isFunction(shouldCallSuccessCallback)) {
            callSuccessCallback = shouldCallSuccessCallback(requestType, transformedResponse, response);
        }
        if (callSuccessCallback) {
            if (isFunction(onsuccess)) {
                onsuccess(transformedResponse);
            }
        }
    }
}

module.exports = fireCallbacks;

},{"../class/HttpResponseError":5,"../class/JSONPResponseError":8,"../constants":12,"x-common-utils/isFunction":39}],31:[function(require,module,exports){
var isFunction = require('x-common-utils/isFunction');

/**
 * The function to process the request options. This function will call the function `options.handleOptions`.
 *
 * @param {RequestOptions} options The request options.
 * @returns {void}
 */
function handleOptions(options) {
    if (isFunction(options.handleOptions)) {
        options.handleOptions(options);
    }
}

module.exports = handleOptions;

},{"x-common-utils/isFunction":39}],32:[function(require,module,exports){
/**
 * Make `SubClass` extend `SuperClass`.
 *
 * @param {Function} SubClass The sub class constructor.
 * @param {Function} SuperClass The super class constructor.
 */
function inherits(SubClass, SuperClass) {
    var F = function() {};

    F.prototype = SuperClass.prototype;

    SubClass.prototype = new F();
    SubClass.prototype.constructor = SubClass;
}

module.exports = inherits;

},{}],33:[function(require,module,exports){
/**
 * The no operation function.
 */
function noop() {
    // nothing to do here.
}

module.exports = noop;

},{}],34:[function(require,module,exports){
/**
 * A simple template function
 *
 * @example
 * // Rreturns '/post/1'
 * template('/post/{postId}', { postId: 1 })
 *
 * @param {string} template The template text
 * @param {Object.<string, string>} data The data object
 * @returns {string} Returns the compiled text
 */
function template(template, data) {
    var str = [];
    var res = null;
    var regexp = /(^|[^\\])\{([^\{\}]*[^\\])?\}/;

    // make sure that the type is correct
    template = '' + template;
    data = data || {};

    while ( res = regexp.exec(template) ) {
        var index = res.index;
        var match = res[0];
        var prefix = res[1];
        var key = res[2];

        // trim white spaces
        key = (key || '').replace(/^\s+|\s+$/g, '');
        // save the content before the key
        str.push( template.substr( 0, index + prefix.length ) );
        // read the value of the key
        str.push( '' + data[key] );
        // update the template
        template = template.substr( index + match.length );
        // reset last index manually
        regexp.lastIndex = 0;
    }

    // save the content after last key
    str.push(template);

    // replace `\{` and `\}` with `{` and `}`
    str = str.join('');
    str = str.replace(/\\\{/g, '{');
    str = str.replace(/\\\}/g, '}');

    return str;
};

module.exports = template;

},{}],35:[function(require,module,exports){
var id = 0;

/**
 * Returns a number that greater than the privous one, starting form `1`.
 *
 * @returns {number}
 */
function uuid() {
    id += 1;
    return id;
}

module.exports = uuid;

},{}],36:[function(require,module,exports){
module.exports = '0.0.1-alpha.1';

},{}],37:[function(require,module,exports){
/**
 * Check whether the url is absolute url.
 *
 * @param {string} url The url string to check
 * @returns {boolean} Returns `true` if the url is abosolute, otherwise `false` is returned
 */
function isAbsoluteURL(url) {
    return /^(?:[a-z][a-z0-9\-\.\+]*:)?\/\//i.test(url);
}

module.exports = isAbsoluteURL;

},{}],38:[function(require,module,exports){
var toString = Object.prototype.toString;

/**
 * Check whether the variable is an instance of `Array`
 *
 * @param {any} it The variable to check
 * @returns {boolean} Returns `true` if the variable is an instance of `Array`, otherwise `false` is returned
 */
function isArray(it) {
    return toString.call(it) === '[object Array]';
}

module.exports = isArray;

},{}],39:[function(require,module,exports){
var toString = Object.prototype.toString;

/**
 * Check whether the variable is a function
 *
 * @param {any} it The variable to check
 * @returns {boolean} Returns `true` if the variable is a function, otherwise `false` is returned
 */
function isFunction(it) {
    return toString.call(it) === '[object Function]';
}

module.exports = isFunction;

},{}],40:[function(require,module,exports){
var toString = Object.prototype.toString;

/**
 * Check whether the variable is a plain object.
 *
 * @param {any} it The variable to check
 * @returns {boolean} Returns `true` if the variable is a plain object, otherwise `false` is returned
 */
function isPlainObject(it) {
    if (!it) {
        return false;
    }

    if (typeof window !== 'undefined' && it === window) {
        return false;
    }

    if (typeof global !== 'undefined' && it === global) {
        return false;
    }

    return toString.call(it) === '[object Object]';
}

module.exports = isPlainObject;

},{}],41:[function(require,module,exports){
var isArray = require('./isArray');
var isPlainObject = require('./isPlainObject');
var hasOwn = Object.prototype.hasOwnProperty;
var slice = Array.prototype.slice;

/**
 * Copy the non-undefined values of source to target. Overwrite the original values.
 * This function will modify the target
 *
 * @param {Object.<string, *>|any[]} target The target object or array
 * @param {Object.<string, *>|any[]} source The source object or array
 * @returns {Object.<string, *>|any[]} Returns the extended target object or array
 */
function extend(target, source) {
    var key, val;

    if ( target && ( isArray(source) || isPlainObject(source) ) ) {
        for ( key in source ) {
            if ( hasOwn.call(source, key) ) {
                val = source[key];
                if (val !== undefined) {
                    if ( isPlainObject(val) ) {
                        if ( ! isPlainObject(target[key]) ) {
                            target[key] = {};
                        }
                        merge(target[key], val);
                    } else if ( isArray(val) ) {
                        if ( ! isArray(target[key]) ) {
                            target[key] = [];
                        }
                        merge(target[key], val);
                    } else {
                        target[key] = val;
                    }
                }
            }
        }
    }

    return target;
}

/**
 * Copy any non-undefined values of source to target and overwrites the corresponding original values. This function
 * will modify the target object.
 *
 * @param {Object} target The target object
 * @param {...Object} args The source object
 * @returns {Object} Returns the modified target object
 */
function merge(target, args) {
    var i = 0;
    var l = arguments.length - 1;

    args = slice.call(arguments, 1);

    for (i = 0; i < l; i += 1) {
        extend(target, args[i]);
    }

    return target;
}

module.exports = merge;

},{"./isArray":38,"./isPlainObject":40}],42:[function(require,module,exports){
var util = require('./util');
var isArray = util.isArray;

/**
 * Decode the URI Component encoded query string to object
 *
 * @param {string} The URI Component encoded query string
 * @returns {Object.<string, string>} Returns the decoded object
 */
var decode = function (string) {
    var object = {};
    var cache = {};
    var keyValueArray;
    var index;
    var length;
    var keyValue;
    var key;
    var value;

    // do not decode empty string or something that is not string
    if (string && typeof string === 'string') {
        keyValueArray = string.split('&');
        index = 0;
        length = keyValueArray.length;

        while (index < length) {
            keyValue = keyValueArray[index].split('=');
            key = decodeURIComponent(keyValue[0]);
            value = keyValue[1];

            if (typeof value === 'string') {
                value = decodeURIComponent(value);
            } else {
                value = null;
            }

            decodeKey(object, cache, key, value);

            index += 1;
        }
    }

    return object;
};

/**
 * Decode the specefied key
 *
 * @param {Object.<string, string>} object The object to hold the decoded data
 * @param {Object.<string, *>} cache The object to hold cache data
 * @param {string} key The key name to decode
 * @param {any} value The value to decode
 */
var decodeKey = function (object, cache, key, value) {
    var rBracket = /\[([^\[]*?)?\]$/;
    var rIndex = /(^0$)|(^[1-9]\d*$)/;
    var indexOrKeyOrEmpty;
    var parentKey;
    var arrayOrObject;
    var keyIsIndex;
    var keyIsEmpty;
    var valueIsInArray;
    var dataArray;
    var length;

    // check whether key is something like `person[name]` or `colors[]` or
    // `colors[1]`
    if ( rBracket.test(key) ) {
        indexOrKeyOrEmpty = RegExp.$1;
        parentKey = key.replace(rBracket, '');
        arrayOrObject = cache[parentKey];

        keyIsIndex = rIndex.test(indexOrKeyOrEmpty);
        keyIsEmpty = indexOrKeyOrEmpty === '';
        valueIsInArray = keyIsIndex || keyIsEmpty;

        if (arrayOrObject) {
            // convert the array to object
            if ( (! valueIsInArray) && isArray(arrayOrObject) ) {
                dataArray = arrayOrObject;
                length = dataArray.length;
                arrayOrObject = {};

                while (length--) {
                    if (arrayOrObject[length] !== undefined) {
                        arrayOrObject[length] = dataArray[length];
                    }
                }
            }
        } else {
            arrayOrObject = valueIsInArray ? [] : {};
        }

        if ( keyIsEmpty && isArray(arrayOrObject) ) {
            arrayOrObject.push(value);
        } else {
            // arrayOrObject is array or object here
            arrayOrObject[indexOrKeyOrEmpty] = value;
        }

        cache[parentKey] = arrayOrObject;

        decodeKey(object, cache, parentKey, arrayOrObject);
    } else {
        object[key] = value;
    }
};

exports.decode = decode;

},{"./util":45}],43:[function(require,module,exports){
var util = require('./util');
var isArray = util.isArray;
var isObject = util.isObject;
var hasOwn = Object.prototype.hasOwnProperty;

/**
 * Encode the given object to URI Component encoded query string
 *
 * @param {Object.<string, *>} object The object to encode
 * @param {boolean} [keepArrayIndex] Whether to keep array index
 * @returns {string} Returns the URI Component encoded query string
 */
var encode = function (object, keepArrayIndex) {
    var key;
    var keyValueArray = [];

    keepArrayIndex = !!keepArrayIndex;

    if ( isObject(object) ) {
        for ( key in object ) {
            if ( hasOwn.call(object, key) ) {
                encodeKey(key, object[key], keyValueArray, keepArrayIndex);
            }
        }
    }

    return keyValueArray.join('&');
};


/**
 * Encode the speceifed key in the object
 *
 * @param {string} key The key name
 * @param {any} data The data of the key
 * @param {string[]} keyValueArray The array to store the key value string
 * @param {boolean} keepArrayIndex Whether to keep array index
 */
var encodeKey = function (key, data, keyValueArray, keepArrayIndex) {
    var prop;
    var index;
    var length;
    var value;
    var subKey;

    if ( isObject(data) ) {
        for ( prop in data ) {
            if ( hasOwn.call(data, prop) ) {
                value = data[prop];
                subKey = key + '[' + prop + ']';
                encodeKey(subKey, value, keyValueArray, keepArrayIndex);
            }
        }
    } else if ( isArray(data) ) {
        index = 0;
        length = data.length;

        while (index < length) {
            value = data[index];

            if ( keepArrayIndex || isArray(value) || isObject(value) ) {
                subKey = key + '[' + index + ']';
            } else {
                subKey = key + '[]';
            }

            encodeKey(subKey, value, keyValueArray, keepArrayIndex);

            index += 1;
        }
    } else {
        key = encodeURIComponent(key);
        // if data is null, no `=` is appended
        if (data === null) {
            value = key;
        } else {
            // if data is undefined, treat it as empty string
            if (data === undefined) {
                data = '';
            // make sure that data is string
            } else if (typeof data !== 'string') {
                data = '' + data;
            }
            value = key + '=' + encodeURIComponent(data);
        }

        keyValueArray.push(value);
    }
};

exports.encode = encode;

},{"./util":45}],44:[function(require,module,exports){
var encode = require('./encode').encode;
var decode = require('./decode').decode;

exports.encode = encode;
exports.decode = decode;
exports.version = '1.1.2';

},{"./decode":42,"./encode":43}],45:[function(require,module,exports){
var toString = Object.prototype.toString;

/**
 * Check whether the variable is an array
 *
 * @param {any} it The variable to check
 * @returns {boolean} Returns `true` if it is an array
 */
var isArray = function (it) {
    return '[object Array]' === toString.call(it);
};

/**
 * Check whether the variable is an object
 *
 * @param {any} it The variable to check
 * @returns {boolean} Returns `true` if it is an object
 */
var isObject = function (it) {
    return '[object Object]' === toString.call(it);
};

exports.isArray = isArray;
exports.isObject = isObject;

},{}]},{},[19])(19)
});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9fYnJvd3Nlci1wYWNrQDYuMS4wQGJyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsImxpYi9jbGFzcy9DYW5jZWxDb250cm9sbGVyLmpzIiwibGliL2NsYXNzL0h0dHBDbGllbnQuanMiLCJsaWIvY2xhc3MvSHR0cFJlcXVlc3QuanMiLCJsaWIvY2xhc3MvSHR0cFJlc3BvbnNlLmpzIiwibGliL2NsYXNzL0h0dHBSZXNwb25zZUVycm9yLmpzIiwibGliL2NsYXNzL0pTT05QUmVxdWVzdC5qcyIsImxpYi9jbGFzcy9KU09OUFJlc3BvbnNlLmpzIiwibGliL2NsYXNzL0pTT05QUmVzcG9uc2VFcnJvci5qcyIsImxpYi9jbGFzcy9SZXF1ZXN0LmpzIiwibGliL2NsYXNzL1Jlc3BvbnNlLmpzIiwibGliL2NsYXNzL1Jlc3BvbnNlRXJyb3IuanMiLCJsaWIvY29uc3RhbnRzLmpzIiwibGliL2h0dHAvYWRkRXZlbnRMaXN0ZW5lcnMuanMiLCJsaWIvaHR0cC9hZGRUaW1lb3V0TGlzdGVuZXIuanMiLCJsaWIvaHR0cC9jYWxsWGhySG9vay5qcyIsImxpYi9odHRwL2hhbmRsZUhlYWRlcnMuanMiLCJsaWIvaHR0cC9oYW5kbGVSZXF1ZXN0Qm9keS5qcyIsImxpYi9odHRwL2hhbmRsZVhoclByb3BzLmpzIiwibGliL2luZGV4LmpzIiwibGliL2pzb25wL2FkZEV2ZW50TGlzdGVuZXJzLmpzIiwibGliL2pzb25wL2J1aWxkQ2FsbGJhY2tOYW1lLmpzIiwibGliL2pzb25wL2J1aWxkU2NyaXB0U3JjLmpzIiwibGliL2pzb25wL2hhbmRsZVNjcmlwdENvcnMuanMiLCJsaWIvc2hhcmVkL2FkZEN1c3RvbVBhcnNlci5qcyIsImxpYi9zaGFyZWQvYnVpbGRVUkwuanMiLCJsaWIvc2hhcmVkL2NhbGxSZXF1ZXN0Q3JlYXRlZENhbGxiYWNrLmpzIiwibGliL3NoYXJlZC9jcmVhdGVDYW5jZWxDb250cm9sbGVyLmpzIiwibGliL3NoYXJlZC9jcmVhdGVEZWZhdWx0T3B0aW9ucy5qcyIsImxpYi9zaGFyZWQvZGVmaW5lRXhwb3J0cy5qcyIsImxpYi9zaGFyZWQvZmlyZUNhbGxiYWNrcy5qcyIsImxpYi9zaGFyZWQvaGFuZGxlT3B0aW9ucy5qcyIsImxpYi9zaGFyZWQvaW5oZXJpdHMuanMiLCJsaWIvc2hhcmVkL25vb3AuanMiLCJsaWIvc2hhcmVkL3RlbXBsYXRlLmpzIiwibGliL3NoYXJlZC91dWlkLmpzIiwibGliL3ZlcnNpb24uanMiLCJub2RlX21vZHVsZXMvX3gtY29tbW9uLXV0aWxzQDEuNC4wQHgtY29tbW9uLXV0aWxzL2lzQWJzb2x1dGVVUkwuanMiLCJub2RlX21vZHVsZXMvX3gtY29tbW9uLXV0aWxzQDEuNC4wQHgtY29tbW9uLXV0aWxzL2lzQXJyYXkuanMiLCJub2RlX21vZHVsZXMvX3gtY29tbW9uLXV0aWxzQDEuNC4wQHgtY29tbW9uLXV0aWxzL2lzRnVuY3Rpb24uanMiLCJub2RlX21vZHVsZXMvX3gtY29tbW9uLXV0aWxzQDEuNC4wQHgtY29tbW9uLXV0aWxzL2lzUGxhaW5PYmplY3QuanMiLCJub2RlX21vZHVsZXMvX3gtY29tbW9uLXV0aWxzQDEuNC4wQHgtY29tbW9uLXV0aWxzL21lcmdlLmpzIiwibm9kZV9tb2R1bGVzL194LXF1ZXJ5LXN0cmluZ0AxLjEuMkB4LXF1ZXJ5LXN0cmluZy9saWIvZGVjb2RlLmpzIiwibm9kZV9tb2R1bGVzL194LXF1ZXJ5LXN0cmluZ0AxLjEuMkB4LXF1ZXJ5LXN0cmluZy9saWIvZW5jb2RlLmpzIiwibm9kZV9tb2R1bGVzL194LXF1ZXJ5LXN0cmluZ0AxLjEuMkB4LXF1ZXJ5LXN0cmluZy9saWIvcXVlcnlzdHJpbmcuanMiLCJub2RlX21vZHVsZXMvX3gtcXVlcnktc3RyaW5nQDEuMS4yQHgtcXVlcnktc3RyaW5nL2xpYi91dGlsLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDamhCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3REQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNiQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNCQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDYkE7QUFDQTs7QUNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNiQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0dBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwidmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKCd4LWNvbW1vbi11dGlscy9pc0Z1bmN0aW9uJyk7XG5cbi8qKlxuICogQ2FuY2VsIGNvbnRyb2xsZXIgaXMgdXNlZCB0byBjYW5jZWwgYWN0aW9ucy4gT25lIGNvbnRyb2xsZXIgY2FuIGJpbmQgYW55IG51bWJlciBvZiBhY3Rpb25zLlxuICpcbiAqIEBjbGFzc1xuICovXG5mdW5jdGlvbiBDYW5jZWxDb250cm9sbGVyKCkge1xuICAgIC8qKlxuICAgICAqIEB0eXBlIHtib29sZWFufSBXaGV0aGVyIHRoZSBjb250cm9sbGVyIGlzIGNhbmNlbGxlZC5cbiAgICAgKi9cbiAgICB0aGlzLmNhbmNlbGxlZCA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0Z1bmN0aW9uW119IFRoZSBjYWxsYmFja3MgdG8gY2FsbCBvbiBjYW5jZWwuXG4gICAgICovXG4gICAgdGhpcy5jYWxsYmFja3MgPSBbXTtcbn1cblxuLyoqXG4gKiBDYW5jZWwgdGhlIGFjdGlvbnMgdGhhdCBiaW5kIHdpdGggdGhpcyBjYW5jZWwgY29udHJvbGxlci5cbiAqL1xuQ2FuY2VsQ29udHJvbGxlci5wcm90b3R5cGUuY2FuY2VsID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBjYWxsYmFja3MgPSB0aGlzLmNhbGxiYWNrcztcbiAgICB2YXIgaSA9IDA7XG4gICAgdmFyIGwgPSBjYWxsYmFja3MubGVuZ3RoO1xuXG4gICAgaWYgKHRoaXMuY2FuY2VsbGVkID09PSBmYWxzZSkge1xuICAgICAgICB0aGlzLmNhbmNlbGxlZCA9IHRydWU7XG5cbiAgICAgICAgZm9yICggOyBpIDwgbDsgaSArPSAxKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrc1tpXSgpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIC8vIFRocm93IHRoZSBlcnJvciBsYXRlciBmb3IgZGVidWdpbmcuXG4gICAgICAgICAgICAgICAgKGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgZTtcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICB9KShlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn07XG5cbi8qKlxuICogQ2hlY2sgd2hldGhlciB0aGUgY29udHJvbGxlciBpcyBjYW5jZWxsZWQuXG4gKlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSBjb250cm9sbGVyIGlzIGNhbmNlbGxlZCwgb3RoZXJ3aXNlIGBmYWxzZWAgaXMgcmV0dXJuZWQuXG4gKi9cbkNhbmNlbENvbnRyb2xsZXIucHJvdG90eXBlLmlzQ2FuY2VsbGVkID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLmNhbmNlbGxlZDtcbn07XG5cbi8qKlxuICogUmVnaXN0ZXIgYSBjYWxsYmFjaywgd2hpY2ggd2lsbCBiZSBjYWxsZWQgd2hlbiB0aGUgYGNhbmNlbCgpYCBtZXRob2QgaXMgY2FsbGVkLlxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIFRoZSBjYWxsYmFjayBmdW5jdGlvbiB0byBjYWxsIG9uIGNhbmNlbC5cbiAqL1xuQ2FuY2VsQ29udHJvbGxlci5wcm90b3R5cGUucmVnaXN0ZXJDYW5jZWxDYWxsYmFjayA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgIGlmIChpc0Z1bmN0aW9uKGNhbGxiYWNrKSkge1xuICAgICAgICB0aGlzLmNhbGxiYWNrcy5wdXNoKGNhbGxiYWNrKTtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IENhbmNlbENvbnRyb2xsZXI7XG4iLCJ2YXIgbWVyZ2UgPSByZXF1aXJlKCd4LWNvbW1vbi11dGlscy9tZXJnZScpO1xudmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKCd4LWNvbW1vbi11dGlscy9pc0Z1bmN0aW9uJyk7XG52YXIgaXNQbGFpbk9iamVjdCA9IHJlcXVpcmUoJ3gtY29tbW9uLXV0aWxzL2lzUGxhaW5PYmplY3QnKTtcbnZhciBRUyA9IHJlcXVpcmUoJ3gtcXVlcnktc3RyaW5nJyk7XG52YXIgaXNBYnNvbHV0ZVVSTCA9IHJlcXVpcmUoJ3gtY29tbW9uLXV0aWxzL2lzQWJzb2x1dGVVUkwnKTtcbnZhciBkZWZpbmVFeHBvcnRzID0gcmVxdWlyZSgnLi4vc2hhcmVkL2RlZmluZUV4cG9ydHMnKTtcbnZhciBjcmVhdGVEZWZhdWx0T3B0aW9ucyA9IHJlcXVpcmUoJy4uL3NoYXJlZC9jcmVhdGVEZWZhdWx0T3B0aW9ucycpO1xudmFyIGNyZWF0ZUNhbmNlbENvbnRyb2xsZXIgPSByZXF1aXJlKCcuLi9zaGFyZWQvY3JlYXRlQ2FuY2VsQ29udHJvbGxlcicpO1xudmFyIEh0dHBSZXF1ZXN0ID0gcmVxdWlyZSgnLi9IdHRwUmVxdWVzdCcpO1xudmFyIGNvbnN0YW50cyA9IHJlcXVpcmUoJy4uL2NvbnN0YW50cycpO1xudmFyIHZlcnNpb24gPSByZXF1aXJlKCcuLi92ZXJzaW9uJyk7XG52YXIgdGVtcGxhdGUgPSByZXF1aXJlKCcuLi9zaGFyZWQvdGVtcGxhdGUnKTtcbnZhciB1dWlkID0gcmVxdWlyZSgnLi4vc2hhcmVkL3V1aWQnKTtcbnZhciBub29wID0gcmVxdWlyZSgnLi4vc2hhcmVkL25vb3AnKTtcbnZhciBpbmhlcml0cyA9IHJlcXVpcmUoJy4uL3NoYXJlZC9pbmhlcml0cycpO1xudmFyIGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG52YXIgQ2FuY2VsQ29udHJvbGxlciA9IHJlcXVpcmUoJy4vQ2FuY2VsQ29udHJvbGxlcicpO1xudmFyIEh0dHBSZXF1ZXN0ID0gcmVxdWlyZSgnLi9IdHRwUmVxdWVzdCcpO1xudmFyIEh0dHBSZXNwb25zZSA9IHJlcXVpcmUoJy4vSHR0cFJlc3BvbnNlJyk7XG52YXIgSHR0cFJlc3BvbnNlRXJyb3IgPSByZXF1aXJlKCcuL0h0dHBSZXNwb25zZUVycm9yJyk7XG52YXIgSlNPTlBSZXF1ZXN0ID0gcmVxdWlyZSgnLi9KU09OUFJlcXVlc3QnKTtcbnZhciBKU09OUFJlc3BvbnNlID0gcmVxdWlyZSgnLi9KU09OUFJlc3BvbnNlJyk7XG52YXIgSlNPTlBSZXNwb25zZUVycm9yID0gcmVxdWlyZSgnLi9KU09OUFJlc3BvbnNlRXJyb3InKTtcbnZhciBSZXF1ZXN0ID0gcmVxdWlyZSgnLi9SZXF1ZXN0Jyk7XG52YXIgUmVzcG9uc2UgPSByZXF1aXJlKCcuL1Jlc3BvbnNlJyk7XG52YXIgUmVzcG9uc2VFcnJvciA9IHJlcXVpcmUoJy4vUmVzcG9uc2VFcnJvcicpO1xuXG4vKipcbiAqIEBjbGFzc1xuICpcbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IFtkZWZhdWx0T3B0aW9uc10gVGhlIGRlZmF1bHQgb3B0aW9ucyB0byB1c2Ugd2hlbiBzZW5kaW5nIHJlcXVlc3RzIHdpdGggdGhlIGNyZWF0ZWQgaHR0cFxuICogY2xpZW50LiBUaGlzIGRlZmF1bHQgb3B0aW9ucyB3aWxsIGJlIG1lcmdlZCBpbnRvIHRoZSBpbnRlcm5hbCBkZWZhdWx0IG9wdGlvbnMgdGhhdCBgY3JlYXRlRGVmYXVsdE9wdGlvbnMoKWAgcmV0dXJucy5cbiAqXG4gKiBAcGFyYW0ge0hhbmRsZU9wdGlvbnNGdW5jdGlvbn0gW2hhbmRsZU9wdGlvbnNdIFRoZSBoYW5kbGVyIGZ1bmN0aW9uIHRvIHByb2Nlc3MgdGhlIG1lcmdlZCBkZWZhdWx0IG9wdGlvbnMuIFRoZSBtZXJnZWRcbiAqIGRlZmF1bHQgb3B0aW9ucyB3aWxsIGJlIHBhc3NlZCBpbnRvIHRoZSBmdW5jdGlvbiBhcyB0aGUgZmlyc3QgYXJndW1lbnQuIFlvdSBjYW4gbWFrZSBjaGFuZ2VzIHRvIGl0IGFzIHlvdSB3YW50LiBUaGlzXG4gKiBmdW5jdGlvbiBtdXN0IHJldHVybiBzeW5jaHJvbm91c2x5LiBUaGUgcmV0dXJuIHZhbHVlIG9mIHRoaXMgZnVuY3Rpb24gaXMgaWdub3JlZC5cbiAqL1xuZnVuY3Rpb24gSHR0cENsaWVudChkZWZhdWx0T3B0aW9ucywgaGFuZGxlT3B0aW9ucykge1xuICAgIHZhciBvcHRpb25zID0gY3JlYXRlRGVmYXVsdE9wdGlvbnMoKTtcblxuICAgIGlmIChpc1BsYWluT2JqZWN0KGRlZmF1bHRPcHRpb25zKSkge1xuICAgICAgICBtZXJnZShvcHRpb25zLCBkZWZhdWx0T3B0aW9ucyk7XG4gICAgfVxuXG4gICAgaWYgKGlzRnVuY3Rpb24oaGFuZGxlT3B0aW9ucykpIHtcbiAgICAgICAgaGFuZGxlT3B0aW9ucyhvcHRpb25zKTtcbiAgICAgICAgLy8gRGVlcCBjb3B5IHRoZSBjaGFnbmVkIG9wdGlvbnNcbiAgICAgICAgb3B0aW9ucyA9IG1lcmdlKHt9LCBvcHRpb25zKTtcbiAgICB9XG5cbiAgICAvLyBSZXdyaXRlIHRoZSBgY29weURlZmF1bHRPcHRpb25zKClgIG1ldGhvZCwgbWFrZSB0aGUgYG9wdGlvbnNgIHByaXZhdGUuXG4gICAgdGhpcy5jb3B5RGVmYXVsdE9wdGlvbnMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBtZXJnZSh7fSwgb3B0aW9ucyk7XG4gICAgfTtcbn1cblxuLyoqXG4gKiBHZXQgYSBjb3B5IG9mIHRoZSBkZWZhdWx0IG9wdGlvbnMgdGhpcyBodHRwIGNsaWVudCB1c2VzLlxuICpcbiAqIEByZXR1cm5zIHtSZXF1ZXN0T3B0aW9uc31cbiAqL1xuSHR0cENsaWVudC5wcm90b3R5cGUuY29weURlZmF1bHRPcHRpb25zID0gZnVuY3Rpb24gKCkge1xuICAgIC8vIFRoaXMgZnVuY3Rpb24gd2lsbCBiZSByZXdyaXR0ZW4gaW4gdGhlIGNvbnN0cnVjdG9yLiBpZiB0aGlzIGZ1bmN0aW9uIGlzIGNhbGxlZCB3aXRoXG4gICAgLy8gYEZ1bmN0aW9uLnByb3RvdHlwZS5hcHBseSguLi4pYCBvciBgRnVuY3Rpb24ucHJvdG90eXBlLmNhbGwoLi4uKWAsIHdlIHRyeSB0byBjYWxsIHRoZSBjb3JyZWN0IG9uZSxcbiAgICBpZiAoaGFzT3duLmNhbGwodGhpcywgJ2NvcHlEZWZhdWx0T3B0aW9ucycpKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmNvcHlEZWZhdWx0T3B0aW9ucygpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcigndGhpcy5jb3B5RGVmYXVsdE9wdGlvbnMoKSBpcyBub3QgYSBmdW5jdGlvbicpO1xuICAgIH1cbn07XG5cbi8qKlxuICogU2VuZCBhbiBodHRwIHJlcXVlc3QuXG4gKlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zIHRvIHVzZSwgd2hpY2ggd2lsbCBiZSBtZXJnZWQgaW50byBhIGNvcHkgb2YgdGhlIGRlZmF1bHQgb3B0aW9ucy5cbiAqIEBwYXJhbSB7UmVxdWVzdFN1Y2Nlc3NDYWxsYmFja30gb25zdWNjZXNzIFRoZSBjYWxsYmFjayB0byBjYWxsIG9uIHN1Y2Nlc3MuXG4gKiBAcGFyYW0ge1JlcXVlc3RFcnJvckNhbGxiYWNrfSBvbmVycm9yIFRoZSBjYWxsYmFjayB0byBjYWxsIG9uIGVycm9yLlxuICogQHJldHVybnMge0h0dHBSZXF1ZXN0fSBSZXR1cm5zIGFuIGluc3RhbmNlIG9mIGBIdHRwUmVxdWVzdGAuXG4gKi9cbkh0dHBDbGllbnQucHJvdG90eXBlLnNlbmQgPSBmdW5jdGlvbiAob3B0aW9ucywgb25zdWNjZXNzLCBvbmVycm9yKSB7XG4gICAgdmFyIGRlZmF1bHRPcHRpb25zID0gdGhpcy5jb3B5RGVmYXVsdE9wdGlvbnMoKTtcbiAgICB2YXIgcmVxdWVzdE9wdGlvbnMgPSBtZXJnZShkZWZhdWx0T3B0aW9ucywgb3B0aW9ucyk7XG5cbiAgICByZXF1ZXN0T3B0aW9ucy5yZXF1ZXN0RnVuY3Rpb25OYW1lID0gJ3NlbmQnO1xuICAgIHJlcXVlc3RPcHRpb25zLmNvbnRyb2xsZXIgPSBudWxsO1xuXG4gICAgcmV0dXJuIG5ldyBIdHRwUmVxdWVzdChyZXF1ZXN0T3B0aW9ucywgb25zdWNjZXNzLCBvbmVycm9yKTtcbn07XG5cbi8qKlxuICogU2VuZCBhbiBodHRwIHJlcXVlc3QgYW5kIHJldHVybiBhIHByb21pc2UuXG4gKlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zIHRvIHVzZSwgd2hpY2ggd2lsbCBiZSBtZXJnZWQgaW50byBhIGNvcHkgb2YgdGhlIGRlZmF1bHQgb3B0aW9ucy5cbiAqIEByZXR1cm5zIHtQcm9taXNlfSBSZXR1cm5zIGFuIGluc3RhbmNlIG9mIGBQcm9taXNlYC5cbiAqL1xuSHR0cENsaWVudC5wcm90b3R5cGUuZmV0Y2ggPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgIHZhciBkZWZhdWx0T3B0aW9ucyA9IHRoaXMuY29weURlZmF1bHRPcHRpb25zKCk7XG4gICAgdmFyIHJlcXVlc3RPcHRpb25zID0gbWVyZ2UoZGVmYXVsdE9wdGlvbnMsIG9wdGlvbnMpO1xuICAgIHZhciBjb250cm9sbGVyID0gcmVxdWVzdE9wdGlvbnMuY29udHJvbGxlcjtcblxuICAgIHJlcXVlc3RPcHRpb25zLnJlcXVlc3RGdW5jdGlvbk5hbWUgPSAnZmV0Y2gnO1xuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgdmFyIHJlcXVlc3QgPSBuZXcgSHR0cFJlcXVlc3QocmVxdWVzdE9wdGlvbnMsIGZ1bmN0aW9uIChyZXNwb25zZSkge1xuICAgICAgICAgICAgaWYgKGNvbnRyb2xsZXIpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWNvbnRyb2xsZXIuaXNDYW5jZWxsZWQoKSkge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHJlc3BvbnNlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJlc29sdmUocmVzcG9uc2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LCByZWplY3QpO1xuXG4gICAgICAgIGlmIChjb250cm9sbGVyKSB7XG4gICAgICAgICAgICAvLyBUcmlnZ2VyIHRoZSBgRVJSX0NBTkNFTExFRGAgZXJyb3IuXG4gICAgICAgICAgICBpZiAoY29udHJvbGxlci5pc0NhbmNlbGxlZCgpKSB7XG4gICAgICAgICAgICAgICAgcmVxdWVzdC5jYW5jZWwoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29udHJvbGxlci5yZWdpc3RlckNhbmNlbENhbGxiYWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdC5jYW5jZWwoKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xufTtcblxuLyoqXG4gKiBTZW5kIGEganNvbnAgcmVxdWVzdC5cbiAqXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMgdG8gdXNlLCB3aGljaCB3aWxsIGJlIG1lcmdlZCBpbnRvIGEgY29weSBvZiB0aGUgZGVmYXVsdCBvcHRpb25zLlxuICogQHBhcmFtIHtSZXF1ZXN0U3VjY2Vzc0NhbGxiYWNrfSBvbnN1Y2Nlc3MgVGhlIGNhbGxiYWNrIHRvIGNhbGwgb24gc3VjY2Vzcy5cbiAqIEBwYXJhbSB7UmVxdWVzdEVycm9yQ2FsbGJhY2t9IG9uZXJyb3IgVGhlIGNhbGxiYWNrIHRvIGNhbGwgb24gZXJyb3IuXG4gKiBAcmV0dXJucyB7SlNPTlBSZXF1ZXN0fSBSZXR1cm5zIGFuIGluc3RhbmNlIG9mIGBKU09OUFJlcXVlc3RgLlxuICovXG5IdHRwQ2xpZW50LnByb3RvdHlwZS5nZXRKU09OUCA9IGZ1bmN0aW9uIChvcHRpb25zLCBvbnN1Y2Nlc3MsIG9uZXJyb3IpIHtcbiAgICB2YXIgZGVmYXVsdE9wdGlvbnMgPSB0aGlzLmNvcHlEZWZhdWx0T3B0aW9ucygpO1xuICAgIHZhciByZXF1ZXN0T3B0aW9ucyA9IG1lcmdlKGRlZmF1bHRPcHRpb25zLCBvcHRpb25zKTtcblxuICAgIHJlcXVlc3RPcHRpb25zLnJlcXVlc3RGdW5jdGlvbk5hbWUgPSAnZ2V0SlNPTlAnO1xuICAgIHJlcXVlc3RPcHRpb25zLmNvbnRyb2xsZXIgPSBudWxsO1xuXG4gICAgcmV0dXJuIG5ldyBKU09OUFJlcXVlc3QocmVxdWVzdE9wdGlvbnMsIG9uc3VjY2Vzcywgb25lcnJvcik7XG59O1xuXG4vKipcbiAqIFNlbmQgYSBqc29ucCByZXF1ZXN0IGFuZCByZXR1cm4gYSBwcm9taXNlLlxuICpcbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucyB0byB1c2UsIHdoaWNoIHdpbGwgYmUgbWVyZ2VkIGludG8gYSBjb3B5IG9mIHRoZSBkZWZhdWx0IG9wdGlvbnMuXG4gKiBAcmV0dXJucyB7UHJvbWlzZX0gUmV0dXJucyBhbiBpbnN0YW5jZSBvZiBgUHJvbWlzZWAuXG4gKi9cbkh0dHBDbGllbnQucHJvdG90eXBlLmZldGNoSlNPTlAgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgIHZhciBkZWZhdWx0T3B0aW9ucyA9IHRoaXMuY29weURlZmF1bHRPcHRpb25zKCk7XG4gICAgdmFyIHJlcXVlc3RPcHRpb25zID0gbWVyZ2UoZGVmYXVsdE9wdGlvbnMsIG9wdGlvbnMpO1xuICAgIHZhciBjb250cm9sbGVyID0gcmVxdWVzdE9wdGlvbnMuY29udHJvbGxlcjtcblxuICAgIHJlcXVlc3RPcHRpb25zLnJlcXVlc3RGdW5jdGlvbk5hbWUgPSAnZmV0Y2hKU09OUCc7XG5cbiAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICB2YXIgcmVxdWVzdCA9IG5ldyBKU09OUFJlcXVlc3QocmVxdWVzdE9wdGlvbnMsIGZ1bmN0aW9uIChyZXNwb25zZSkge1xuICAgICAgICAgICAgaWYgKGNvbnRyb2xsZXIpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWNvbnRyb2xsZXIuaXNDYW5jZWxsZWQoKSkge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHJlc3BvbnNlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJlc29sdmUocmVzcG9uc2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LCByZWplY3QpO1xuXG4gICAgICAgIGlmIChjb250cm9sbGVyKSB7XG4gICAgICAgICAgICAvLyBUcmlnZ2VyIHRoZSBgRVJSX0NBTkNFTExFRGAgZXJyb3IuXG4gICAgICAgICAgICBpZiAoY29udHJvbGxlci5pc0NhbmNlbGxlZCgpKSB7XG4gICAgICAgICAgICAgICAgcmVxdWVzdC5jYW5jZWwoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29udHJvbGxlci5yZWdpc3RlckNhbmNlbENhbGxiYWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdC5jYW5jZWwoKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xufTtcblxuLyoqXG4gKiBDcmVhdGUgYSBuZXcgaW5zdGFuY2Ugb2YgYENhbmNlbENvbnRyb2xsZXJgLlxuICpcbiAqIEByZXR1cm5zIHtDYW5jZWxDb250cm9sbGVyfSBSZXR1cm5zIGFuIG5ldyBpbnN0YW5jZSBvZiBgQ2FuY2VsQ29udHJvbGxlcmAuXG4gKi9cbkh0dHBDbGllbnQucHJvdG90eXBlLmNyZWF0ZUNhbmNlbENvbnRyb2xsZXIgPSBjcmVhdGVDYW5jZWxDb250cm9sbGVyO1xuXG4vKipcbiAqIENyZWF0ZSBhIG5ldyBpbnN0YW5jZSBvZiBgQ2FuY2VsQ29udHJvbGxlcmAuXG4gKlxuICogQHJldHVybnMge0NhbmNlbENvbnRyb2xsZXJ9IFJldHVybnMgYW4gbmV3IGluc3RhbmNlIG9mIGBDYW5jZWxDb250cm9sbGVyYC5cbiAqL1xuSHR0cENsaWVudC5jcmVhdGVDYW5jZWxDb250cm9sbGVyID0gY3JlYXRlQ2FuY2VsQ29udHJvbGxlcjtcblxuLy8gVGhlIHZlcnNpb24uXG5IdHRwQ2xpZW50LnZlcnNpb24gPSB2ZXJzaW9uO1xuSHR0cENsaWVudC5wcm90b3R5cGUudmVyc2lvbiA9IHZlcnNpb247XG5cbi8vIEh0dHBDbGllbnQuZXhwb3J0cy5jbGFzc2VzXG4vLyBIdHRwQ2xpZW50LnByb3RvdHlwZS5leHBvcnRzLmNsYXNzZXNcbmRlZmluZUV4cG9ydHMoSHR0cENsaWVudCwgJ2NsYXNzZXMnLCB7XG4gICAgQ2FuY2VsQ29udHJvbGxlcjogQ2FuY2VsQ29udHJvbGxlcixcbiAgICBIdHRwQ2xpZW50OiBIdHRwQ2xpZW50LFxuICAgIEh0dHBSZXF1ZXN0OiBIdHRwUmVxdWVzdCxcbiAgICBIdHRwUmVzcG9uc2U6IEh0dHBSZXNwb25zZSxcbiAgICBIdHRwUmVzcG9uc2VFcnJvcjogSHR0cFJlc3BvbnNlRXJyb3IsXG4gICAgSlNPTlBSZXF1ZXN0OiBKU09OUFJlcXVlc3QsXG4gICAgSlNPTlBSZXNwb25zZTogSlNPTlBSZXNwb25zZSxcbiAgICBKU09OUFJlc3BvbnNlRXJyb3I6IEpTT05QUmVzcG9uc2VFcnJvcixcbiAgICBSZXF1ZXN0OiBSZXF1ZXN0LFxuICAgIFJlc3BvbnNlOiBSZXNwb25zZSxcbiAgICBSZXNwb25zZUVycm9yOiBSZXNwb25zZUVycm9yXG59KTtcblxuLy8gSHR0cENsaWVudC5leHBvcnRzLmNvbnN0YW50c1xuLy8gSHR0cENsaWVudC5wcm90b3R5cGUuZXhwb3J0cy5jb25zdGFudHNcbmRlZmluZUV4cG9ydHMoSHR0cENsaWVudCwgJ2NvbnN0YW50cycsIG1lcmdlKHt9LCBjb25zdGFudHMpKTtcblxuLy8gSHR0cENsaWVudC5leHBvcnRzLmZ1bmN0aW9uc1xuLy8gSHR0cENsaWVudC5wcm90b3R5cGUuZXhwb3J0cy5mdW5jdGlvbnNcbmRlZmluZUV4cG9ydHMoSHR0cENsaWVudCwgJ2Z1bmN0aW9ucycsIHtcbiAgICB0ZW1wbGF0ZTogdGVtcGxhdGUsXG4gICAgbWVyZ2U6IG1lcmdlLFxuICAgIGlzQWJzb2x1dGVVUkw6IGlzQWJzb2x1dGVVUkwsXG4gICAgaXNGdW5jdGlvbjogaXNGdW5jdGlvbixcbiAgICBpc1BsYWluT2JqZWN0OiBpc1BsYWluT2JqZWN0LFxuICAgIHV1aWQ6IHV1aWQsXG4gICAgbm9vcDogbm9vcCxcbiAgICBpbmhlcml0czogaW5oZXJpdHMsXG4gICAgY3JlYXRlRGVmYXVsdE9wdGlvbnM6IGNyZWF0ZURlZmF1bHRPcHRpb25zXG59KTtcblxuLy8gSHR0cENsaWVudC5leHBvcnRzLmxpYnNcbi8vIEh0dHBDbGllbnQucHJvdG90eXBlLmV4cG9ydHMubGlic1xuZGVmaW5lRXhwb3J0cyhIdHRwQ2xpZW50LCAnbGlicycsIHtcbiAgICBRUzogUVNcbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEh0dHBDbGllbnQ7XG5cbi8qKlxuICogVGhpcyBjYWxsYmFjayBpcyB1c2VkIHRvIGhhbmxkZSB0aGUgbWVyZ2VkIGRlZmF1bHQgb3B0aW9ucy4gSXQgbXVzdCByZXRydW4gdGhlIHJlc3VsdCBzeW5jaHJvbm91c2x5LlxuICpcbiAqIEBjYWxsYmFjayBIYW5kbGVPcHRpb25zRnVuY3Rpb25cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIG1lcmdlZCBkZWZhdWx0IG9wdGlvbnMuXG4gKi9cblxuLyoqXG4gKiBUaGUgY2FsbGJhY2sgdG8gY2FsbCBvbiBzdWNjZXNzLlxuICpcbiAqIEBjYWxsYmFjayBSZXF1ZXN0U3VjY2Vzc0NhbGxiYWNrXG4gKiBAcGFyYW0ge0h0dHBSZXNwb25zZXxhbnl9IHJlc3BvbnNlIFRoZSBodHRwIHJlc3BvbnNlIG9yIHRoZSByZXR1cm4gdmFsdWUgb2YgYG9wdGlvbnMudHJhbnNmb3JtUmVzcG9uc2UocmVzcG9uc2UpYC5cbiAqL1xuXG4vKipcbiAqIFRoZSBjYWxsYmFjayB0byBjYWxsIG9uIGVycm9yLlxuICpcbiAqIEBjYWxsYmFjayBSZXF1ZXN0RXJyb3JDYWxsYmFja1xuICogQHBhcmFtIHtIdHRwUmVzcG9uc2VFcnJvcnxhbnl9IGVycm9yIFRoZSBodHRwIHJlc3BvbnNlIGVycm9yIG9yIHRoZSByZXR1cm4gdmFsdWUgb2YgYG9wdGlvbnMudHJhbnNmb3JtRXJyb3IoZXJyb3IpYC5cbiAqL1xuXG4vKipcbiAqIFRoZSBkZWZpbml0b24gb2YgdGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqXG4gKiBAdHlwZWRlZiB7T2JqZWN0LjxzdHJpbmcsICo+fSBSZXF1ZXN0T3B0aW9uc1xuICpcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbbWV0aG9kXSBUaGUgaHR0cCByZXF1ZXN0IG1ldGhvZC4gVGhlIGRlZmF1bHQgbWV0aG9kIGlzIGBHRVRgLlxuICpcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbYmFzZVVSTF0gVGhlIHJlcXVlc3QgYmFzZSB1cmwuIElmIHRoZSBgdXJsYCBpcyByZWxhdGl2ZSB1cmwsIGFuZCB0aGUgYGJhc2VVUkxgIGlzIG5vdCBgbnVsbGAsIHRoZVxuICogYGJhc2VVUkxgIHdpbGwgYmUgcHJlcGVuZCB0byB0aGUgYHVybGAuXG4gKlxuICogQHByb3BlcnR5IHtzdHJpbmd9IHVybCBUaGUgcmVxdWVzdCB1cmwgdGhhdCBjYW4gY29udGFpbiBhbnkgbnVtYmVyIG9mIHBsYWNlaG9sZGVycywgYW5kIHdpbGwgYmUgY29tcGlsZWQgd2l0aCB0aGVcbiAqIGRhdGEgdGhhdCBwYXNzZWQgaW4gd2l0aCBgb3B0aW9ucy5wYXJhbWAuXG4gKlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgKj59IFtwYXJhbV0gVGhlIGRhdGEgdXNlZCB0byBjb21waWxlIHRoZSByZXF1ZXN0IHVybC5cbiAqXG4gKiBAcHJvcGVydHkge09iamVjdC48c3RyaW5nLCAqPn0gW3F1ZXJ5XSBUaGUgZGF0YSB0aGF0IHdpbGwgYmUgY29tcGlsZWQgdG8gcXVlcnkgc3RyaW5nLlxuICpcbiAqIEBwcm9wZXJ0eSB7T2JqZWN0LjxzdHJpbmcsICo+fSBbYm9keV0gVGhlIG9iamVjdCB0aGF0IGNvbnRhaW5zIHRoZSBjb250ZW50IHdoaWNoIHdpbGwgYmUgc2VuZCB0byB0aGUgc2VydmVyLiBUaGlzXG4gKiBvYmplY3QgaGFzIG9ubHkgb25lIHByb3BlcnR5LiBUaGUgbmFtZSBvZiB0aGUgcHJvcGVydHkgaXMgdGhlIGNvbnRlbnQgdHlwZSBvZiB0aGUgY29udGVudCwgd2hpY2ggd2lsbCBiZSB1c2VkIHRvIGZpbmRcbiAqIGEgcHJvY2Vzc29yIGluIGBvcHRpb25zLmh0dHBSZXF1ZXN0Qm9keVByb2Nlc3NvcmAuIFRoZSBwcm9jZXNzb3IgaXMgdXNlZCB0byBwcm9jZXNzIHRoZSB2YWx1ZSBvZiB0aGUgcHJvcGVydHkuIFRoZVxuICogcHJvY2Vzc2VkIHZhbHVlIHdoaWNoIHRoZSBwcm9jZXNzb3IgcmV0dXJucyB3aWxsIGJlIHNlbmQgdG8gdGhlIHNlcnZlciBhcyB0aGUgcmVxdWVzdCBib2R5LlxuICpcbiAqIEBwcm9wZXJ0eSB7T2JqZWN0LjxzdHJpbmcsICo+fSBbZXh0cmFdIFRoZSBvYmplY3QgdG8ga2VlcCB0aGUgZXh0cmEgaW5mb3JtYXRpb24gdGhhdCB0aGUgdXNlciBwYXNzZWQgaW4uIFRoZSBsaWJyYXJ5XG4gKiBpdHNlbGYgd2lsbCBub3QgdG91Y2ggdGhpcyBwcm9wZXJ0eS4gWW91IGNhbiB1c2UgdGhpcyBwcm9wZXJ0eSB0byBob2xkIGFueSBpbmZvcm1hdGlvbiB0aGF0IHlvdSB3YW50LCB3aGVuIHlvdSBleHRlbmRcbiAqIHRoZSBmdW5jdGlvbmFsaXR5IG9mIHlvdXIgb3duIGluc3RhbmNlIG9mIGBIdHRwQ2xpZW50YC4gVGhlIGRlZmF1bHQgdmFsdWUgb2YgdGhpcyBwcm9wZXJ0eSBpcyBhbiBlbXB0eSBvYmplY3QuXG4gKlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgKj59IFtoZWFkZXJzXSBUaGUgb2JqZWN0IHRoYXQgY29udGFpbnMgdGhlIGhlYWRlcnMgdG8gc2V0IHdoZW4gc2VuZGluZyB0aGUgcmVxdWVzdC4gT25seVxuICogdGhlIG5vbi11bmRlZmluZWQgYW5kIG5vbi1udWxsIGhlYWRlcnMgYXJlIHNldC5cbiAqXG4gKiBAcHJvcGVydHkge0NhbmNlbENvbnRyb2xsZXJ9IFtjb250cm9sbGVyXSBUaGUgYENhbmNlbENvbnRyb2xsZXJgIHVzZWQgdG8gY2FuY2VsIHRoZSByZXF1ZXN0LiBJdCBvbmx5IHdvcmtzIHdoZW4gdXNpbmdcbiAqIGBmZXRjaGAgb3IgYGZldGNoSlNPTlBgIHRvIHNlbmQgcmVxdWVzdC4gSWYgdGhlIHlvdSBzZW5kIHJlcXVlc3QgdXNpbmcgYHNlbmRgIG9yIGBnZXRKU09OUGAsIHRoZSBgb3B0aW9ucy5jb250cm9sbGVyYFxuICogd2lsbCBiZSBzZXQgdG8gYG51bGxgLlxuICpcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbcmVxdWVzdEZ1bmN0aW9uTmFtZV0gVGhlIG5hbWUgb2YgdGhlIGZ1bmN0aW9uIHRoYXQgc2VuZCB0aGUgcmVxdWVzdC4gQ2FuIGJlIGBzZW5kYCwgYGZldGNoYCxcbiAqIGBnZXRKU09OUGAsIGBmZXRjaEpTT05QYC4gVGhpcyB2YWx1ZSBpcyBzZXQgYnkgdGhlIGxpYnJhcnksIGRvbid0IGNoYW5nZSBpdC5cbiAqXG4gKiBAcHJvcGVydHkge3N0cmluZ30gW3JlcXVlc3RUeXBlXSBUaGUgcmVxdWVzdCB0eXBlIG9mIHRoaXMgcmVxdWVzdC4gVGhlIHZhbHVlIG9mIGl0IGlzIHNldCBieSB0aGUgbGlicmFyeSBpdHNlbGYsIGNhblxuICogYmUgYEhUVFBfUkVRVUVTVGAgb3IgYEpTT05QX1JFUVVFU1RgLiBBbnkgb3RoZXIgdmFsdWUgdGhlIHVzZXIgcGFzc2VkIGluIGlzIGlnbm9yZWQuIFlvdSBjYW4gdXNlIHRoaXMgcHJvcGVydHkgdG8gZ2V0XG4gKiB0aGUgdHlwZSBvZiB0aGUgY3VycmVudCByZXF1ZXN0LlxuICpcbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gW2NvcnNdIFdoZXRoZXIgdG8gc2V0IGB3aXRoQ3JlZGVudGlhbHNgIHByb3BlcnR5IG9mIHRoZSBgWE1MSHR0cFJlcXVlc3RgIHRvIGB0cnVlYC4gVGhlIGRlZmF1bHRcbiAqIHZhbHVlIGlzIGBmYWxzZWAuXG4gKlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgKj59IFt4aHJQcm9wc10gVGhlIG9iamVjdCB0aGF0IGNvbnRhaW5zIHRoZSBwcm9wZXJ0aWVzIHRvIHNldCBvbiB0aGUgaW5zdGFuY2Ugb2YgdGhlXG4gKiBgWE1MSHR0cFJlcXVlc3RgLlxuICpcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbdXNlcm5hbWVdIFRoZSB1c2VyIG5hbWUgdG8gdXNlIGZvciBhdXRoZW50aWNhdGlvbiBwdXJwb3Nlcy4gVGhlIGRlZnVhbHQgdmFsdWUgaXMgYG51bGxgLlxuICpcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbcGFzc3dvcmRdIFRoZSBwYXNzd29yZCB0byB1c2UgZm9yIGF1dGhlbnRpY2F0aW9uIHB1cnBvc2VzLiBUaGUgZGVmdWFsdCB2YWx1ZSBpcyBgbnVsbGAuXG4gKlxuICogQHByb3BlcnR5IHtudW1iZXJ9IFt0aW1lb3V0XSBUaGUgbnVtYmVyIG9mIG1pbGxpc2Vjb25kcyB0aGUgcmVxdWVzdCBjYW4gdGFrZSBiZWZvcmUgaXQgZmluaXNoZWQuIElmIHRoZSB0aW1lb3V0IHZhbHVlXG4gKiBpcyBgMGAsIG5vIHRpbWVyIHdpbGwgYmUgc2V0LiBJZiB0aGUgcmVxdWVzdCBkb2VzIG5vdCBmaW5zaWhlZCB3aXRoaW4gdGhlIGdpdmVuIHRpbWUsIGEgdGltZW91dCBlcnJvciB3aWxsIGJlIHRocm93bi5cbiAqIFRoZSBkZWZhdWx0IHZhbHVlIGlzIGAwYC5cbiAqXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IFtub0NhY2hlXSBXaGV0aGVyIHRvIGRpc2FibGUgdGhlIGNhY2hlLiBJZiB0aGUgdmFsdWUgaXMgYHRydWVgLCB0aGUgaGVhZGVycyBpblxuICogYG9wdGlvbnMubm9DYWNoZUhlYWRlcnNgIHdpbGwgYmUgc2V0LiBUaGUgZGVmYXVsdCB2YWx1ZSBpcyBgZmFsc2VgLlxuICpcbiAqIEBwcm9wZXJ0eSB7T2JqZWN0LjxzdHJpbmcsICo+fSBbbm9DYWNoZUhlYWRlcnNdIFRoZSBoZWFkZXJzIHRvIHNldCB3aGVuIGBvcHRpb25zLm5vQ2FjaGVgIGlzIHNldCB0byBgdHJ1ZWAuXG4gKlxuICogQHByb3BlcnR5IHtzdHJpbmd9IFtqc29ucF0gVGhlIHF1ZXJ5IHN0cmluZyBrZXkgdG8gaG9sZCB0aGUgdmFsdWUgb2YgdGhlIGNhbGxiYWNrIG5hbWUgd2hlbiBzZW5kaW5nIEpTT05QIHJlcXVlc3QuXG4gKiBUaGUgZGVmYXVsdCB2YWx1ZXMgaXMgYGNhbGxiYWNrYC5cbiAqXG4gKiBAcHJvcGVydHkge09iamVjdC48c3RyaW5nLCAqPn0gW2Vycm9yTWVzc2FnZXNdIFRoZSBvYmplY3QgdG8gY29uZmlnIHRoZSBlcnJvciBtZXNzYWdlcy4gVGhlIGtleXMgaW4gdGhlIG9iamVjdCBhcmVcbiAqIGVycm9yIGNvZGUgc3VjaCBhcyBgRVJSX05FVFdPUktgLlxuICpcbiAqIEBwcm9wZXJ0eSB7T2JqZWN0LjxzdHJpbmcsIGh0dHBSZXF1ZXN0Qm9keVByb2Nlc3Nvcj59IFtodHRwUmVxdWVzdEJvZHlQcm9jZXNzb3JdIFRoZSBvYmplY3QgdGhhdCBjb250YWlucyB0aGVcbiAqIGh0dHAgcmVxdWVzdCBib2R5IHByb2Nlc3NvcnMuXG4gKlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgUmVzcG9uc2VQYXJzZUZ1bmN0aW9uPn0gW2h0dHBSZXNwb25zZVBhcnNlcl0gVGhlIG9iamVjdCB0aGF0IGNvbnRhaW5zIHRoZSBodHRwIHJlc3BvbnNlXG4gKiBwYXJzZXJzLlxuICpcbiAqIEBwcm9wZXJ0eSB7T2JqZWN0LjxzdHJpbmcsIFJlc3BvbnNlUGFyc2VGdW5jdGlvbj59IFtqc29ucFJlc3BvbnNlUGFyc2VyXSBUaGUgb2JqZWN0IHRoYXQgY29udGFpbnMgdGhlIGpzb25wIHJlc3BvbnNlXG4gKiBwYXJzZXJzLlxuICpcbiAqIEBwcm9wZXJ0eSB7T2JqZWN0LjxzdHJpbmcsIFJlc3BvbnNlRXJyb3JQYXJzZUZ1bmN0aW9uPn0gW2h0dHBSZXNwb25zZUVycm9yUGFyc2VyXSBUaGUgb2JqZWN0IHRoYXQgY29udGFpbnMgdGhlIGh0dHBcbiAqIHJlc3BvbnNlIGVycm9yIHBhcnNlcnMuXG4gKlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgUmVzcG9uc2VFcnJvclBhcnNlRnVuY3Rpb24+fSBbanNvbnBSZXNwb25zZUVycm9yUGFyc2VyXSBUaGUgb2JqZWN0IHRoYXQgY29udGFpbnMgdGhlIGpzb25wXG4gKiByZXNwb25zZSBlcnJvciBwYXJzZXJzLlxuICpcbiAqIEBwcm9wZXJ0eSB7SGFubGRlT3B0aW9uc0Z1bmN0aW9ufSBbaGFuZGxlT3B0aW9uc10gVGhlIGZ1bmN0aW9uIHRvIGhhbmRsZSB0aGUgb3B0aW9ucy5cbiAqXG4gKiBAcHJvcGVydHkge0NyZWF0ZVhIUkZ1bmN0aW9ufSBbY3JlYXRlWEhSXSBUaGUgZnVuY3Rpb24gdG8gY3JlYXRlIHRoZSBgWE1MSHR0cFJlcXVlc3RgIGluc3RhbmNlLlxuICpcbiAqIEBwcm9wZXJ0eSB7U2NyaXB0Q3JlYXRlRnVuY3Rpb259IFtjcmVhdGVTY3JpcHRdIFRoZSBmdW5jdGlvbiB0byBjcmVhdGUgdGhlIGBIVE1MU2NyaXB0RWxlbWVudGAgaW5zdGFuY2UuXG4gKlxuICogQHByb3BlcnR5IHtKU09OUENvbnRhaW5lckZpbmRGdW5jdGlvbn0gW2pzb25wQ29udGFpbmVyTm9kZV0gVGhlIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyB0aGUgY29udGFpbmVyIG5vZGUsIHdoaWNoIHdpbGxcbiAqIGJlIHVzZWQgdG8gYXBwZW5kIHRoZSBzY3JpcHQgZWxlbWVudCB3aGVuIHNlbmRpbmcganNvbnAgcmVxdWVzdC5cbiAqXG4gKiBAcHJvcGVydHkge0pTT05QQ2FsbGJhY2tOYW1lR2VuZXJhdGVGdW5jdGlvbn0gW2pzb25wQ2FsbGJhY2tOYW1lXSBUaGUgZnVuY3Rpb24gdG8gZ2VuZXJhdGUgdGhlIHVuaXF1ZSBjYWxsYmFjayBuYW1lXG4gKiB3aGVuIHNlbmRpbmcganNvbnAgcmVxdWVzdC5cbiAqXG4gKiBAcHJvcGVydHkge0NvbXBpbGVVUkxGdW5jdGlvbn0gW2NvbXBpbGVVUkxdIFRoZSBmdW5jdGlvbiB0byBjb21waWxlIHVybC5cbiAqXG4gKiBAcHJvcGVydHkge0VuY29kZVF1ZXJ5U3RyaW5nRnVuY3Rpb259IGVuY29kZVF1ZXJ5U3RyaW5nIFRoZSBmdW5jdGlvbiB0byBlbmNvZGUgdGhlIHF1ZXJ5IHN0cmluZy5cbiAqXG4gKiBAcHJvcGVydHkge1hIUkhvb2tGdW5jdGlvbn0gb25YaHJDcmVhdGVkIFRoZSBmdW5jdGlvbiB0byBjYWxsIG9uIHhociBjcmVhdGVkLlxuICpcbiAqIEBwcm9wZXJ0eSB7WEhSSG9va0Z1bmN0aW9ufSBvblhock9wZW5lZCBUaGUgZnVuY3RvbiB0byBjYWxsIG9uIHhociBvcGVuZWQuXG4gKlxuICogQHByb3BlcnR5IHtYSFJIb29rRnVuY3Rpb259IG9uWGhyU2VudCBUaGUgZnVuY3Rpb24gdG8gY2FsbCBvbiB4aHIgc2VudC5cbiAqXG4gKiBAcHJvcGVydHkge1JlcXVlc3RDcmVhdGVkRnVuY3Rpb259IG9uUmVxdWVzdENyZWF0ZWQgVGhlIGZ1bmN0aW9uIHRvIGNhbGwgb24gcmVxdWVzdCBjcmVhdGVkLlxuICpcbiAqIEBwcm9wZXJ0eSB7Q2hlY2tSZXNwb25zZU9rRnVuY3Rpb259IGlzUmVzcG9uc2VPayBUaGUgZnVuY3Rpb24gdG8gY2hlY2sgd2hldGhlciB0aGUgcmVzcG9uc2UgaXMgb2suXG4gKlxuICogQHByb3BlcnR5IHtUcmFuc2Zvcm1FcnJvckZ1bmN0aW9ufSB0cmFuc2Zvcm1FcnJvciBUaGUgZnVuY3Rpb24gdG8gdHJhbnNmcm9tIHRoZSByZXNwb25zZSBlcnJvci4gVGhlIHJldHVybiB2YWx1ZSBvZlxuICogdGhpcyBmdW5jdGlvbiB3aWxsIGJlIHBhc3NlZCB0byB0aGUgYG9uZXJyb3JgIGNhbGxiYWNrLlxuICpcbiAqIEBwcm9wZXJ0eSB7VHJhbnNmb3JtUmVzcG9uc2VGdW5jdGlvbn0gdHJhbnNmb3JtUmVzcG9uc2UgVGhlIGZ1bmN0aW9uIHRvIHRyYW5zZnJvbSB0aGUgcmVzcG9uc2UuIFRoZSByZXR1cm4gdmFsdWUgb2ZcbiAqIHRoaXMgZnVuY3Rpb24gd2lsbCBiZSBwYXNzZWQgdG8gdGhlIGBvbnN1Y2Nlc3NgIGNhbGxiYWNrLlxuICpcbiAqIEBwcm9wZXJ0eSB7Q2hlY2tTaG91bGRDYWxsRXJyb3JDYWxsYmFja0Z1bmN0aW9ufSBzaG91bGRDYWxsRXJyb3JDYWxsYmFjayBUaGUgZnVuY3Rpb24gdG8gY2hlY2sgd2hldGhlciB0byBjYWxsIHRoZVxuICogZXJyb3IgY2FsbGJhY2suXG4gKlxuICogQHByb3BlcnR5IHtDaGVja1Nob3VsZENhbGxTdWNjZXNzQ2FsbGJhY2tGdW5jdGlvbn0gc2hvdWxkQ2FsbFN1Y2Nlc3NDYWxsYmFjayBUaGUgZnVuY3Rpb24gdG8gY2hlY2sgd2hldGhlciB0byBjYWxsXG4gKiB0aGUgc3VjY2VzcyBjYWxsYmFjay5cbiAqL1xuXG4vKipcbiAqIFRoZSBkZWZpbml0b24gb2YgaHR0cCByZXF1ZXN0IGRhdGEgcHJvY2Vzc29yLlxuICpcbiAqIEB0eXBlZGVmIHtPYmplY3QuPHN0cmluZywgKj59IGh0dHBSZXF1ZXN0Qm9keVByb2Nlc3NvclxuICogQHByb3BlcnR5IHtudW1iZXJ9IHByaW9yaXR5IFRoZSBwcmlvcml0eSBvZiB0aGUgcHJvY2Vzc29yLlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgKj59IFtoZWFkZXJzXSBUaGUgaGVhZGVycyB0byBzZXQgd2hlbiB0aGlzIHByb2Nlc3NvciBpcyB1c2VkLlxuICogQHByb3BlcnR5IHtIdHRwUmVxdWVzdENvbnRlbnRQcm9jZXNzRnVuY3Rpb259IFtwcm9jZXNzb3JdIFRoZSBmdW5jdGlvbiB0byBwcm9jZXNzIHRoZSByZXF1ZXN0IGJvZHkuXG4gKi9cblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gaGFuZGxlIHRoZSBvcHRpb25zLlxuICpcbiAqIEBjYWxsYmFjayBIYW5sZGVPcHRpb25zRnVuY3Rpb25cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBwcm9jZXNzIHRoZSByZXF1ZXN0IGRhdGEuXG4gKlxuICogQGNhbGxiYWNrIEh0dHBSZXF1ZXN0Q29udGVudFByb2Nlc3NGdW5jdGlvblxuICogQHBhcmFtIHtPYmplY3QuPHN0cmluZywgKj59IGNvbnRlbnQgVGhlIGNvbmVudCBuZWVkIHRvIHByb2Nlc3MuXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMgb2YgdGhlIGN1cnJlbnQgcmVxdWVzdC5cbiAqIEByZXR1cm5zIHthbnl9IFJldHVybnMgdGhlIHZhbHVlIHRoYXQgd2lsbCBiZSBzZW5kIHRvIHRoZSBzZXJ2ZXIuXG4gKi9cblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gcGFyc2UgdGhlIHJlc3BvbnNlLiBUaGlzIGZ1bmN0aW9uIHdpbGwgYmUgbW91bnRlZCBvbiB0aGUgcmVzcG9uc2UgaW5zdGFuY2UsIHdoaWNoIG1hZGUgaXQgYSBtZXRob2RcbiAqIG9mIHRoZSBgUmVzcG9uc2VgIGluc3RhbmNlLiBUaGUgcGFyYW1ldGVycyBhbmQgdGhlIHJldHVybiB2YWx1ZSBpcyB1cCBvbiB5b3UuXG4gKlxuICogQGNhbGxiYWNrIFJlc3BvbnNlUGFyc2VGdW5jdGlvblxuICovXG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIHBhcnNlIHRoZSByZXNwb25zZSBlcnJvci4gVGhpcyBmdW5jdGlvbiB3aWxsIGJlIG1vdW50ZWQgb24gdGhlIHJlc3BvbnNlIGVycm9yIGluc3RhbmNlLCB3aGljaCBtYWRlIGl0XG4gKiBhIG1ldGhvZCBvZiB0aGUgYFJlc3BvbnNlRXJyb3JgIGluc3RhbmNlLiBUaGUgcGFyYW1ldGVycyBhbmQgdGhlIHJldHVybiB2YWx1ZSBpcyB1cCBvbiB5b3UuXG4gKlxuICogQGNhbGxiYWNrIFJlc3BvbnNlRXJyb3JQYXJzZUZ1bmN0aW9uXG4gKi9cblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gY3JlYXRlIHRoZSBgWE1MSHR0cFJlcXVlc3RgIGluc3RhbmNlLlxuICpcbiAqIEBjYWxsYmFjayBDcmVhdGVYSFJGdW5jdGlvblxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICogQHJldHVybnMge1hNTEh0dHBSZXF1ZXN0fSBSZXR1cm5zIGFuIGluc3RhbmNlIG9mIGBYTUxIdHRwUmVxdWVzdGAuXG4gKi9cblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gY3JlYXRlIHRoZSBgSFRNTFNjcmlwdEVsZW1lbnRgIGluc3RhbmNlLlxuICpcbiAqIEBjYWxsYmFjayBTY3JpcHRDcmVhdGVGdW5jdGlvblxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICogQHJldHVybnMge0hUTUxTY3JpcHRFbGVtZW50fSBSZXR1cm5zIGFuIGluc3RhbmNlIG9mIGBIVE1MU2NyaXB0RWxlbWVudGAuXG4gKi9cblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdGhhdCByZXR1cm5zIHRoZSBub2RlIHRvIGFwcGVuZCB0aGUgc2NyaXB0IGVsZW1lbnQuXG4gKlxuICogQGNhbGxiYWNrIEpTT05QQ29udGFpbmVyRmluZEZ1bmN0aW9uXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcmV0dXJucyB7Tm9kZX0gUmV0dXJucyB0aGUgbm9kZSB0byBhcHBlbmQgdGhlIHNjcmlwdCBlbGVtZW50LlxuICovXG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGdlbmVyYXRlIHRoZSB1bmlxdWUgY2FsbGJhY2sgbmFtZS5cbiAqXG4gKiBAY2FsbGJhY2sgSlNPTlBDYWxsYmFja05hbWVHZW5lcmF0ZUZ1bmN0aW9uXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBSZXRydW5zIGEgdmFsaWQgamF2YXNjcmlwdCBpZGVudGlmaWVyIHRvIGhvbGQgdGhlIGNhbGxiYWsuXG4gKi9cblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gY29tcGlsZSB0aGUgcmVxdWVzdCB1cmwuXG4gKlxuICogQGNhbGxiYWNrIENvbXBpbGVVUkxGdW5jdGlvblxuICogQHBhcmFtIHtzdHJpbmd9IHVybCBUaGUgdXJsICh3aXRoIGJhc2VVUkwpIHRvIGNvbXBpbGUuXG4gKiBAcGFyYW0ge09iamVjdC48c3RyaW5nLCAqPn0gcGFyYW0gVGhlIHBhcmFtIHRvIGNvbXBpbGUgdGhlIHVybC5cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEByZXR1cm5zIHtzdHJpbmd9IFJldHVybnMgdGhlIGNvbXBpbGVkIHVybC5cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBlbmNvZGUgdGhlIHF1ZXJ5IHN0cmluZy5cbiAqXG4gKiBAY2FsbGJhY2sgRW5jb2RlUXVlcnlTdHJpbmdGdW5jdGlvblxuICogQHBhcmFtIHtPYmplY3QuPHN0cmluZywgKj59IGRhdGEgVGhlIGRhdGEgdG8gYmUgZW5jb2RlZCB0byBxdWVyeSBzdHJpbmcuXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBSZXR1cm5zIHRoZSBlbmNvZGVkIHF1ZXJ5IHN0cmluZy5cbiAqL1xuXG4vKipcbiAqIFRoZSB4aHIgaG9vayBmdW5jdGlvbi5cbiAqXG4gKiBAY2FsbGJhY2sgWEhSSG9va0Z1bmN0aW9uXG4gKiBAcGFyYW0ge1hNTEh0dHBSZXF1ZXN0fSB4aHIgVGhlIGluc3RhbmNlIG9mIGBYTUxIdHRwUmVxdWVzdGAuXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKi9cblxuLyoqXG4gKiBAY2FsbGJhY2sgUmVxdWVzdENyZWF0ZWRGdW5jdGlvblxuICogQHBhcmFtIHtIdHRwUmVxdWVzdHxKU09OUFJlcXVlc3R9IHJlcXVlc3QgVGhlIHJlcXVlc3QgaW5zdGFuY2UsIGNhbiBiZSBgSHR0cFJlcXVlc3RgIG9yIGBKU09OUFJlcXVlc3RgLlxuICovXG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGNoZWNrIHdoZXRoZXIgdGhlIHJlc3BvbnNlIGlzIG9rLlxuICpcbiAqIEBjYWxsYmFjayBDaGVja1Jlc3BvbnNlT2tGdW5jdGlvblxuICogQHBhcmFtIHtzdHJpbmd9IHJlcXVlc3RUeXBlIFRoZSByZXF1ZXN0IHR5cGUsIGBIVFRQX1JFUVVFU1RgIG9yIGBKU09OUF9SRVFVRVNUYC5cbiAqIEBwYXJhbSB7UmVzcG9uc2V9IHJlc3BvbnNlIFRoZSByZXNwb25zZSBpbnN0YW5jZS5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgcmVzcG9uc2UgaXMgb2ssIG90aGVyd2lzZSBgZmFsc2VgIGlzIHJldHVybmVkLlxuICovXG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGNoZWNrIHdoZXRoZXIgdG8gY2FsbCB0aGUgZXJyb3IgY2FsbGJhY2suXG4gKlxuICogQGNhbGxiYWNrIENoZWNrU2hvdWxkQ2FsbEVycm9yQ2FsbGJhY2tGdW5jdGlvblxuICogQHBhcmFtIHtzdHJpbmd9IHJlcXVlc3RUeXBlIFRoZSByZXF1ZXN0IHR5cGUsIGBIVFRQX1JFUVVFU1RgIG9yIGBKU09OUF9SRVFVRVNUYC5cbiAqIEBwYXJhbSB7YW55fSB0cmFuc2Zvcm1lZEVycm9yIFRoZSBkYXRhIHRoYXQgYG9wdGlvbnMudHJhbnNmb3JtRXJyb3IoLi4uKWAgcmV0dXJucy5cbiAqIEBwYXJhbSB7SHR0cFJlc3BvbnNlRXJyb3J8SlNPTlBSZXNwb25zZUVycm9yfSBlcnJvciBUaGUgcmVzcG9uc2UgZXJyb3IuXG4gKi9cblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gY2hlY2sgd2hldGhlciB0byBjYWxsIHRoZSBzdWNjZXNzIGNhbGxiYWNrLlxuICpcbiAqIEBjYWxsYmFjayBDaGVja1Nob3VsZENhbGxTdWNjZXNzQ2FsbGJhY2tGdW5jdGlvblxuICogQHBhcmFtIHtzdHJpbmd9IHJlcXVlc3RUeXBlIFRoZSByZXF1ZXN0IHR5cGUsIGBIVFRQX1JFUVVFU1RgIG9yIGBKU09OUF9SRVFVRVNUYC5cbiAqIEBwYXJhbSB7YW55fSB0cmFuc2Zvcm1lZFJlc3BvbnNlIFRoZSBkYXRhIHRoYXQgYG9wdGlvbnMudHJhbnNmb3JtUmVzcG9uc2UoLi4uKWAgcmV0dXJucy5cbiAqIEBwYXJhbSB7SHR0cFJlc3BvbnNlfEpTT05QUmVzcG9uc2V9IHJlc3BvbnNlIFRoZSByZXNwb25zZS5cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byB0cmFuc2Zyb20gdGhlIHJlc3BvbnNlLiBUaGUgcmV0dXJuIHZhbHVlIG9mIHRoaXMgZnVuY3Rpb24gd2lsbCBiZSBwYXNzZWQgdG8gdGhlIGBvbnN1Y2Nlc3NgIGNhbGxiYWNrLlxuICpcbiAqIEBjYWxsYmFjayBUcmFuc2Zvcm1SZXNwb25zZUZ1bmN0aW9uXG4gKiBAcGFyYW0ge3N0cmluZ30gcmVxdWVzdFR5cGUgVGhlIHJlcXVlc3QgdHlwZSwgYEhUVFBfUkVRVUVTVGAgb3IgYEpTT05QX1JFUVVFU1RgLlxuICogQHBhcmFtIHtIdHRwUmVzcG9uc2V8SlNPTlBSZXNwb25zZX0gcmVzcG9uc2UgVGhlIHJlc3BvbnNlLlxuICogQHJldHVybnMge2FueX0gUmV0dXJucyB0aGUgdHJhbnNmb3JtZWQgcmVzcG9uc2UuXG4gKi9cblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gdHJhbnNmcm9tIHRoZSByZXNwb25zZSBlcnJvci4gVGhlIHJldHVybiB2YWx1ZSBvZiB0aGlzIGZ1bmN0aW9uIHdpbGwgYmUgcGFzc2VkIHRvIHRoZSBgb25lcnJvcmBcbiAqIGNhbGxiYWNrLlxuICpcbiAqIEBjYWxsYmFjayBUcmFuc2Zvcm1FcnJvckZ1bmN0aW9uXG4gKiBAcGFyYW0ge3N0cmluZ30gcmVxdWVzdFR5cGUgVGhlIHJlcXVlc3QgdHlwZSwgYEhUVFBfUkVRVUVTVGAgb3IgYEpTT05QX1JFUVVFU1RgLlxuICogQHBhcmFtIHtIdHRwUmVzcG9uc2VFcnJvcnxKU09OUFJlc3BvbnNlRXJyb3J9IGVycm9yIFRoZSByZXNwb25zZSBlcnJvci5cbiAqIEByZXR1cm5zIHthbnl9IFJldHVybnMgdGhlIHRyYW5zZm9ybWVkIHJlc3BvbnNlIGVycm9yLlxuICovXG4iLCJ2YXIgUmVxdWVzZXQgPSByZXF1aXJlKCcuL1JlcXVlc3QnKTtcbnZhciBjb25zdGFudHMgPSByZXF1aXJlKCcuLi9jb25zdGFudHMnKTtcbnZhciBpbmhlcml0cyA9IHJlcXVpcmUoJy4uL3NoYXJlZC9pbmhlcml0cycpO1xudmFyIGJ1aWxkVVJMID0gcmVxdWlyZSgnLi4vc2hhcmVkL2J1aWxkVVJMJyk7XG52YXIgaGFuZGxlT3B0aW9ucyA9IHJlcXVpcmUoJy4uL3NoYXJlZC9oYW5kbGVPcHRpb25zJyk7XG52YXIgY2FsbFJlcXVlc3RDcmVhdGVkQ2FsbGJhY2sgPSByZXF1aXJlKCcuLi9zaGFyZWQvY2FsbFJlcXVlc3RDcmVhdGVkQ2FsbGJhY2snKTtcbnZhciBhZGRFdmVudExpc3RlbmVycyA9IHJlcXVpcmUoJy4uL2h0dHAvYWRkRXZlbnRMaXN0ZW5lcnMnKTtcbnZhciBoYW5kbGVYaHJQcm9wcyA9IHJlcXVpcmUoJy4uL2h0dHAvaGFuZGxlWGhyUHJvcHMnKTtcbnZhciBoYW5kbGVIZWFkZXJzID0gcmVxdWlyZSgnLi4vaHR0cC9oYW5kbGVIZWFkZXJzJyk7XG52YXIgaGFuZGxlUmVxdWVzdEJvZHkgPSByZXF1aXJlKCcuLi9odHRwL2hhbmRsZVJlcXVlc3RCb2R5Jyk7XG52YXIgY2FsbFhockhvb2sgPSByZXF1aXJlKCcuLi9odHRwL2NhbGxYaHJIb29rJyk7XG5cbi8qKlxuICogUmVwcmVzZW50cyBhbiBodHRwIHJlcXVlc3QuXG4gKlxuICogQGNsYXNzXG4gKiBAZXh0ZW5kcyB7UmVxdWVzZXR9XG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcGFyYW0ge1JlcXVlc3RTdWNjZXNzQ2FsbGJhY2t9IG9uc3VjY2VzcyBUaGUgY2FsbGJhY2sgdG8gY2FsbCBvbiBzdWNjZXNzLlxuICogQHBhcmFtIHtSZXF1ZXN0RXJyb3JDYWxsYmFja30gb25lcnJvciBUaGUgY2FsbGJhY2sgdG8gY2FsbCBvbiBlcnJvci5cbiAqL1xuZnVuY3Rpb24gSHR0cFJlcXVlc3Qob3B0aW9ucywgb25zdWNjZXNzLCBvbmVycm9yKSB7XG4gICAgdmFyIHhocjtcbiAgICB2YXIgY29udGVudDtcbiAgICB2YXIgdXJsO1xuXG4gICAgLy8gQ2FsbCB0aGUgc3VwZXIgY29uc3RydWN0b3IuXG4gICAgUmVxdWVzZXQuY2FsbCh0aGlzLCBjb25zdGFudHMuSFRUUF9SRVFVRVNULCBvcHRpb25zLCBvbnN1Y2Nlc3MsIG9uZXJyb3IpO1xuXG4gICAgLy8gQ2FsbCBgb3B0aW9ucy5oYW5kbGVPcHRpb25zYCB0byBoYW5kbGUgb3B0aW9ucy5cbiAgICBoYW5kbGVPcHRpb25zKG9wdGlvbnMpO1xuXG4gICAgdGhpcy54aHIgPSB4aHIgPSBvcHRpb25zLmNyZWF0ZVhIUi5jYWxsKG51bGwsIG9wdGlvbnMpO1xuICAgIGNvbnRlbnQgPSBoYW5kbGVSZXF1ZXN0Qm9keShvcHRpb25zKTtcbiAgICB1cmwgPSBidWlsZFVSTChvcHRpb25zKTtcblxuICAgIC8vIFNldCBwcm9wZXJ0aWVzIHRvIHRoZSB4aHIuXG4gICAgaGFuZGxlWGhyUHJvcHMoeGhyLCBvcHRpb25zKTtcblxuICAgIC8vIENhbGwgb25YaHJDcmVhdGVkLlxuICAgIGNhbGxYaHJIb29rKG9wdGlvbnMub25YaHJDcmVhdGVkLCB4aHIsIG9wdGlvbnMpO1xuXG4gICAgLy8gQWRkIGV2ZW50IGxpc3RlbmVycy4gVGhpcyBmdW5jdGlvbiBtdXN0IG92ZXJ3cml0ZSB0aGUgYGNhbmNlbGAgbWV0aG9kIG9mIHRoaXMgYEh0dHBSZXF1ZXN0YCBpbnN0YW5jZSB0byBjYW5jZWxcbiAgICAvLyB0aGlzIGh0dHAgcmVxdWVzdC5cbiAgICBhZGRFdmVudExpc3RlbmVycyh0aGlzKTtcblxuICAgIC8vIE9wZW4gdGhlIHJlcXVlc3QuXG4gICAgeGhyLm9wZW4ob3B0aW9ucy5tZXRob2QgfHwgJ0dFVCcsIHVybCwgdHJ1ZSwgb3B0aW9ucy51c2VybmFtZSwgb3B0aW9ucy5wYXNzd29yZCk7XG5cbiAgICAvLyBDYWxsIG9uWGhyT3BlbmVkLlxuICAgIGNhbGxYaHJIb29rKG9wdGlvbnMub25YaHJPcGVuZWQsIHhociwgb3B0aW9ucyk7XG5cbiAgICAvLyBIYW5sZGUgaGVhZGVycy5cbiAgICBoYW5kbGVIZWFkZXJzKHhociwgb3B0aW9ucyk7XG5cbiAgICAvLyBTZW5kIHRoZSBjb250ZW50IHRvIHRoZSBzZXJ2ZXIuXG4gICAgeGhyLnNlbmQoY29udGVudCk7XG5cbiAgICAvLyBDYWxsIG9uWGhyU2VudC5cbiAgICBjYWxsWGhySG9vayhvcHRpb25zLm9uWGhyU2VudCwgeGhyLCBvcHRpb25zKTtcblxuICAgIC8vIENhbGwgb25SZXF1ZXN0Q3JlYXRlZFxuICAgIGNhbGxSZXF1ZXN0Q3JlYXRlZENhbGxiYWNrKG9wdGlvbnMsIHRoaXMpO1xufVxuXG5pbmhlcml0cyhIdHRwUmVxdWVzdCwgUmVxdWVzZXQpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEh0dHBSZXF1ZXN0O1xuIiwiLyoqXG4gKiBIdHRwUmVzcG9uc2UgbW9kdWxlLlxuICpcbiAqIEBtb2R1bGUgY2xhc3MvSHR0cFJlc3BvbnNlXG4gKi9cblxudmFyIFJlc3BvbnNlID0gcmVxdWlyZSgnLi9SZXNwb25zZScpO1xudmFyIGluaGVyaXRzID0gcmVxdWlyZSgnLi4vc2hhcmVkL2luaGVyaXRzJyk7XG52YXIgYWRkQ3VzdG9tUGFyc2VyID0gcmVxdWlyZSgnLi4vc2hhcmVkL2FkZEN1c3RvbVBhcnNlcicpO1xuXG4vKipcbiAqIFRoZSBIdHRwUmVzcG9uc2UgY2xhc3MuXG4gKlxuICogQGNsYXNzXG4gKiBAcGFyYW0ge0h0dHBSZXF1ZXN0fSByZXF1ZXN0IFRoZSBodHRwIHJlcXVlc3QuXG4gKi9cbmZ1bmN0aW9uIEh0dHBSZXNwb25zZShyZXF1ZXN0KSB7XG4gICAgUmVzcG9uc2UuY2FsbCh0aGlzLCByZXF1ZXN0KTtcbiAgICBhZGRDdXN0b21QYXJzZXIodGhpcywgcmVxdWVzdC5vcHRpb25zLCAnaHR0cFJlc3BvbnNlUGFyc2VyJyk7XG59XG5cbmluaGVyaXRzKEh0dHBSZXNwb25zZSwgUmVzcG9uc2UpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEh0dHBSZXNwb25zZTtcbiIsInZhciBSZXNwb25zZUVycm9yID0gcmVxdWlyZSgnLi9SZXNwb25zZUVycm9yJyk7XG52YXIgaW5oZXJpdHMgPSByZXF1aXJlKCcuLi9zaGFyZWQvaW5oZXJpdHMnKTtcbnZhciBhZGRDdXN0b21QYXJzZXIgPSByZXF1aXJlKCcuLi9zaGFyZWQvYWRkQ3VzdG9tUGFyc2VyJyk7XG5cbi8qKlxuICogQGNsYXNzXG4gKiBAcGFyYW0ge3N0cmluZ30gY29kZSBUaGUgZXJyb3IgY29kZS5cbiAqIEBwYXJhbSB7SHR0cFJlcXVlc3R9IHJlcXVlc3QgVGhlIGh0dHAgcmVxdWVzdC5cbiAqL1xuZnVuY3Rpb24gSHR0cFJlc3BvbnNlRXJyb3IoY29kZSwgcmVxdWVzdCkge1xuICAgIFJlc3BvbnNlRXJyb3IuY2FsbCh0aGlzLCBjb2RlLCByZXF1ZXN0KTtcbiAgICBhZGRDdXN0b21QYXJzZXIodGhpcywgcmVxdWVzdC5vcHRpb25zLCAnaHR0cFJlc3BvbnNlRXJyb3JQYXJzZXInKTtcbn1cblxuaW5oZXJpdHMoSHR0cFJlc3BvbnNlRXJyb3IsIFJlc3BvbnNlRXJyb3IpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEh0dHBSZXNwb25zZUVycm9yO1xuIiwidmFyIFJlcXVlc2V0ID0gcmVxdWlyZSgnLi9SZXF1ZXN0Jyk7XG52YXIgY29uc3RhbnRzID0gcmVxdWlyZSgnLi4vY29uc3RhbnRzJyk7XG52YXIgaW5oZXJpdHMgPSByZXF1aXJlKCcuLi9zaGFyZWQvaW5oZXJpdHMnKTtcbnZhciBoYW5kbGVPcHRpb25zID0gcmVxdWlyZSgnLi4vc2hhcmVkL2hhbmRsZU9wdGlvbnMnKTtcbnZhciBjYWxsUmVxdWVzdENyZWF0ZWRDYWxsYmFjayA9IHJlcXVpcmUoJy4uL3NoYXJlZC9jYWxsUmVxdWVzdENyZWF0ZWRDYWxsYmFjaycpO1xudmFyIGFkZEV2ZW50TGlzdGVuZXJzID0gcmVxdWlyZSgnLi4vanNvbnAvYWRkRXZlbnRMaXN0ZW5lcnMnKTtcbnZhciBidWlsZENhbGxiYWNrTmFtZSA9IHJlcXVpcmUoJy4uL2pzb25wL2J1aWxkQ2FsbGJhY2tOYW1lJyk7XG52YXIgaGFuZGxlU2NyaXB0Q29ycyA9IHJlcXVpcmUoJy4uL2pzb25wL2hhbmRsZVNjcmlwdENvcnMnKTtcbnZhciBidWlsZFNjcmlwdFNyYyA9IHJlcXVpcmUoJy4uL2pzb25wL2J1aWxkU2NyaXB0U3JjJyk7XG5cbi8qKlxuICogUmVwcmVzZW50cyBhbiBqc29uIHJlcXVlc3QuXG4gKlxuICogQGNsYXNzXG4gKiBAZXh0ZW5kcyB7UmVxdWVzZXR9XG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcGFyYW0ge1JlcXVlc3RTdWNjZXNzQ2FsbGJhY2t9IG9uc3VjY2VzcyBUaGUgY2FsbGJhY2sgdG8gY2FsbCBvbiBzdWNjZXNzLlxuICogQHBhcmFtIHtSZXF1ZXN0RXJyb3JDYWxsYmFja30gb25lcnJvciBUaGUgY2FsbGJhY2sgdG8gY2FsbCBvbiBlcnJvci5cbiAqL1xuZnVuY3Rpb24gSlNPTlBSZXF1ZXN0KG9wdGlvbnMsIG9uc3VjY2Vzcywgb25lcnJvcikge1xuICAgIHZhciBzcmM7XG4gICAgdmFyIHNjcmlwdDtcbiAgICB2YXIgY2FsbGJhY2tOYW1lO1xuICAgIHZhciBjb250YWluZXJOb2RlO1xuXG4gICAgUmVxdWVzZXQuY2FsbCh0aGlzLCBjb25zdGFudHMuSlNPTlBfUkVRVUVTVCwgb3B0aW9ucywgb25zdWNjZXNzLCBvbmVycm9yKTtcblxuICAgIC8vIENhbGwgYG9wdGlvbnMuaGFuZGxlT3B0aW9uc2AgdG8gaGFuZGxlIG9wdGlvbnMuXG4gICAgaGFuZGxlT3B0aW9ucyhvcHRpb25zKTtcblxuICAgIHNjcmlwdCA9IHRoaXMuc2NyaXB0ID0gb3B0aW9ucy5jcmVhdGVTY3JpcHQuY2FsbChudWxsLCBvcHRpb25zKTtcbiAgICBjb250YWluZXJOb2RlID0gb3B0aW9ucy5qc29ucENvbnRhaW5lck5vZGUuY2FsbChudWxsLCBvcHRpb25zKTtcbiAgICBjYWxsYmFja05hbWUgPSBidWlsZENhbGxiYWNrTmFtZShvcHRpb25zKTtcbiAgICBzcmMgPSBidWlsZFNjcmlwdFNyYyhvcHRpb25zLCBjYWxsYmFja05hbWUpO1xuXG4gICAgLy8gU2V0IHRoZSBzcmMgYXR0cmlidXRlLlxuICAgIHNjcmlwdC5zZXRBdHRyaWJ1dGUoJ3NyYycsIHNyYyk7XG5cbiAgICAvLyBIYW5kbGUgYG9wdGlvbnMuY29yc2BcbiAgICBoYW5kbGVTY3JpcHRDb3JzKHNjcmlwdCwgb3B0aW9ucyk7XG5cbiAgICAvLyBBZGQgZXZlbnQgbGlzdGVuZXJzXG4gICAgYWRkRXZlbnRMaXN0ZW5lcnModGhpcywgY2FsbGJhY2tOYW1lKTtcblxuICAgIC8vIEluamVjdCB0aGUgc2NyaXB0IG5vZGVcbiAgICBjb250YWluZXJOb2RlLmFwcGVuZENoaWxkKHNjcmlwdCk7XG5cbiAgICAvLyBDYWxsIG9uUmVxdWVzdENyZWF0ZWRcbiAgICBjYWxsUmVxdWVzdENyZWF0ZWRDYWxsYmFjayhvcHRpb25zLCB0aGlzKTtcbn1cblxuaW5oZXJpdHMoSlNPTlBSZXF1ZXN0LCBSZXF1ZXNldCk7XG5cbm1vZHVsZS5leHBvcnRzID0gSlNPTlBSZXF1ZXN0O1xuIiwiLyoqXG4gKiBKU09OUFJlc3BvbnNlIG1vZHVsZS5cbiAqXG4gKiBAbW9kdWxlIGNsYXNzL0pTT05QUmVzcG9uc2VcbiAqL1xuXG52YXIgUmVzcG9uc2UgPSByZXF1aXJlKCcuL1Jlc3BvbnNlJyk7XG52YXIgaW5oZXJpdHMgPSByZXF1aXJlKCcuLi9zaGFyZWQvaW5oZXJpdHMnKTtcbnZhciBhZGRDdXN0b21QYXJzZXIgPSByZXF1aXJlKCcuLi9zaGFyZWQvYWRkQ3VzdG9tUGFyc2VyJyk7XG5cbi8qKlxuICogVGhlIEpTT05QUmVzcG9uc2UgY2xhc3MuXG4gKlxuICogQGNsYXNzXG4gKiBAcGFyYW0ge0pTT05SZXF1ZXN0fSByZXF1ZXN0IFRoZSBodHRwIHJlcXVlc3QuXG4gKi9cbmZ1bmN0aW9uIEpTT05QUmVzcG9uc2UocmVxdWVzdCkge1xuICAgIFJlc3BvbnNlLmNhbGwodGhpcywgcmVxdWVzdCk7XG4gICAgYWRkQ3VzdG9tUGFyc2VyKHRoaXMsIHJlcXVlc3Qub3B0aW9ucywgJ2pzb25wUmVzcG9uc2VQYXJzZXInKTtcbn1cblxuaW5oZXJpdHMoSlNPTlBSZXNwb25zZSwgUmVzcG9uc2UpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEpTT05QUmVzcG9uc2U7XG4iLCJ2YXIgUmVzcG9uc2VFcnJvciA9IHJlcXVpcmUoJy4vUmVzcG9uc2VFcnJvcicpO1xudmFyIGluaGVyaXRzID0gcmVxdWlyZSgnLi4vc2hhcmVkL2luaGVyaXRzJyk7XG52YXIgYWRkQ3VzdG9tUGFyc2VyID0gcmVxdWlyZSgnLi4vc2hhcmVkL2FkZEN1c3RvbVBhcnNlcicpO1xuXG4vKipcbiAqIEBjbGFzc1xuICogQHBhcmFtIHtzdHJpbmd9IGNvZGUgVGhlIGVycm9yIGNvZGUuXG4gKiBAcGFyYW0ge0pTT05QUmVxdWVzdH0gcmVxdWVzdCBUaGUgSlNPTlAgcmVxdWVzdC5cbiAqL1xuZnVuY3Rpb24gSlNPTlBSZXNwb25zZUVycm9yKGNvZGUsIHJlcXVlc3QpIHtcbiAgICBSZXNwb25zZUVycm9yLmNhbGwodGhpcywgY29kZSwgcmVxdWVzdCk7XG4gICAgYWRkQ3VzdG9tUGFyc2VyKHRoaXMsIHJlcXVlc3Qub3B0aW9ucywgJ2pzb25wUmVzcG9uc2VFcnJvclBhcnNlcicpO1xufVxuXG5pbmhlcml0cyhSZXNwb25zZUVycm9yLCBKU09OUFJlc3BvbnNlRXJyb3IpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEpTT05QUmVzcG9uc2VFcnJvcjtcbiIsInZhciB1dWlkID0gcmVxdWlyZSgnLi4vc2hhcmVkL3V1aWQnKTtcbnZhciBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuXG4vKipcbiAqIFRoZSBiYXNlIFJlcWV1c3QgY2xhc3MuXG4gKlxuICogQGNsYXNzXG4gKiBAcGFyYW0ge3N0cmluZ30gdHlwZSBUaGUgdHlwZSBvZiByZXF1ZXN0LCBjYW4gYmUgYEhUVFBfUkVRVUVTVGAgb3IgYEpTT05QX1JFUVVFU1RgLlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICogQHBhcmFtIHtSZXF1ZXN0U3VjY2Vzc0NhbGxiYWNrfSBvbnN1Y2Nlc3MgVGhlIGNhbGxiYWNrIHRvIGNhbGwgb24gc3VjY2Vzcy5cbiAqIEBwYXJhbSB7UmVxdWVzdEVycm9yQ2FsbGJhY2t9IG9uZXJyb3IgVGhlIGNhbGxiYWNrIHRvIGNhbGwgb24gZXJyb3IuXG4gKi9cbmZ1bmN0aW9uIFJlcXVlc3QodHlwZSwgb3B0aW9ucywgb25zdWNjZXNzLCBvbmVycm9yKSB7XG4gICAgLyoqXG4gICAgICogSWYgdGhlcmUgaXMgYW4gZXJyb3IgaGFwcGVuZCwgdGhlIGBlcnJvckNvZGVgIGlzIGEgc3RyaW5nIHJlcHJzZW5ndGluZyB0aGUgdHlwZSBvZiB0eXBlIGVycm9yLiBJZiB0aGVyZSBpcyBub1xuICAgICAqIGVycm9yLCB0aGUgdmFsdWUgb2YgYGVycm9yQ29kZWAgaXMgYG51bGxgLlxuICAgICAqL1xuICAgIHRoaXMuZXJyb3JDb2RlID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFRoZSBgWE1MSHR0cFJlcXVlc3RgIHdlIHVzZSB3aGVuIHNlbmRpbmcgaHR0cCByZXF1ZXN0LlxuICAgICAqL1xuICAgIHRoaXMueGhyID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFRoZSBgSFRNTFNjcmlwdEVsZW1lbnRgIHdlIHVzZSB3aGVuIHNlbmRpbmcganNvbiByZXF1ZXN0LlxuICAgICAqL1xuICAgIHRoaXMuc2NyaXB0ID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFdoZXRoZXIgdGhlIHJlcXVlc3QgaXMgZmluaXNoZWQuXG4gICAgICovXG4gICAgdGhpcy5maW5pc2hlZCA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHJlc3BvbnNlIEpTT04gZGF0YSBvZiB0aGUgSlNPTlAgcmVxdWVzdC5cbiAgICAgKi9cbiAgICB0aGlzLmpzb25wUmVzcG9uc2UgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGBDYW5jZWxDb250cm9sbGVyYCB0aGF0IHVzZWQgdG8gY2FuY2VsIHRoaXMgcmVxdWVzdC4gV2UgbmV2ZXIgdXNlIHRoaXMgcHJvcGVydHkgaW50ZXJuYWxseSwganVzdCBob2xkaW5nIHRoZVxuICAgICAqIGluZm9ybWF0aW9uIGluIGNhc2UgdGhhdCB0aGUgdXNlciBuZWVkcy5cbiAgICAgKi9cbiAgICB0aGlzLmNvbnRyb2xsZXIgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogVGhlIG5hbWUgb2YgdGhlIGZ1bmN0aW9uIHRoYXQgY3JlYXRlIHRoaXMgcmVxdWVzdC4gQ2FuIGJlIGBzZW5kYCwgYGZldGNoYCwgYGdldEpPU05QYCwgYGZldGNoSlNPTlBgLiBUaGlzIHZhbHVlXG4gICAgICogaXMgc2V0IGJ5IHRoZSBsaWJyYXkgaXRzZWxmLlxuICAgICAqL1xuICAgIHRoaXMucmVxdWVzdEZ1bmN0aW9uTmFtZSA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBBbiB1bmlxdWUgaWQgZm9yIHRoaXMgcmVxdWVzdC5cbiAgICAgKi9cbiAgICB0aGlzLnJlcXVlc3RJZCA9IHV1aWQoKTtcblxuICAgIC8qKlxuICAgICAqIFRoZSB0eXBlIG9mIHJlcXVlc3QsIGNhbiBiZSBgSFRUUF9SRVFVRVNUYCBvciBgSlNPTlBfUkVRVUVTVGAuXG4gICAgICovXG4gICAgdGhpcy5yZXF1ZXN0VHlwZSA9IHR5cGU7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICAgICAqL1xuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnMgfHwgbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFRoZSBjYWxsYmFjayB0byBjYWxsIG9uIHN1Y2Nlc3MuXG4gICAgICovXG4gICAgdGhpcy5vbnN1Y2Nlc3MgPSBvbnN1Y2Nlc3MgfHwgbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFRoZSBjYWxsYmFjayB0byBjYWxsIG9uIGVycm9yLlxuICAgICAqL1xuICAgIHRoaXMub25lcnJvciA9IG9uZXJyb3IgfHwgbnVsbDtcblxuICAgIC8vIFNldCB0aGUgcmVxdWVzdCB0eXBlLlxuICAgIGlmICh0aGlzLm9wdGlvbnMpIHtcbiAgICAgICAgdGhpcy5vcHRpb25zLnJlcXVlc3RUeXBlID0gdHlwZTtcbiAgICAgICAgdGhpcy5yZXF1ZXN0RnVuY3Rpb25OYW1lID0gdGhpcy5vcHRpb25zLnJlcXVlc3RGdW5jdGlvbk5hbWU7XG4gICAgICAgIHRoaXMuY29udHJvbGxlciA9IHRoaXMub3B0aW9ucy5jb250cm9sbGVyO1xuICAgIH1cbn1cblxuLyoqXG4gKiBDYW5jZWwgdGhlIGN1cnJlbnQgcmVxdWVzdC4gV2hlbiB0aGUgcmVxdWVzdCBpcyBjYW5jZWxsZWQsIHRoZSBgb25lcnJvcmAgY2FsbGJhY2sgd2lsbCBiZSBjYWxsZWQgd2l0aCB0aGUgZXJyb3IgbmFtZWRcbiAqIGBFUlJfQ0FOQ0VMTEVEYC5cbiAqL1xuUmVxdWVzdC5wcm90b3R5cGUuY2FuY2VsID0gZnVuY3Rpb24gKCkge1xuICAgIC8vIFRoZSBgY2FuY2VsYCBtZXRob2QgbXVzdCBiZSBvdmVyd3JpdHRlbiBpbiB0aGUgc3ViY2xhc3MuIEluIGNhc2UgdGhhdCB1c2VyIGNhbGwgdGhlIGZ1bmN0aW9uIHdpdGhcbiAgICAvLyBgRnVuY3Rpb24ucHJvdG90eXBlLmFwcGx5KC4uLilgIG9yIGBGdW5jdGlvbi5wcm90b3R5cGUuY2FsbCguLi4pYCwgd2Ugc2hvdWxkIGNhbGwgdGhlIHJpZ2h0IGZ1bmN0aW9uIGRpcmVjdGx5LlxuICAgIC8vIFRoZSBvdmVyd3JpdHRlbiBgY2FuY2VsYCBtZXRob2QgbXVzdCBub3QgdGhyb3cgYW55IGVycm9ycy5cbiAgICBpZiAoaGFzT3duLmNhbGwodGhpcywgJ2NhbmNlbCcpKSB7XG4gICAgICAgIGlmIChpc0Z1bmN0aW9uKHRoaXMuY2FuY2VsKSkge1xuICAgICAgICAgICAgLy8gaWYgYHRoaXNgIGlzIGFuIGluc3RhbmNlIG9mIGBSZXF1ZXN0YCwgbm8gZXJyb3JzIHdpbGwgYmUgdGhyb3duLlxuICAgICAgICAgICAgdGhpcy5jYW5jZWwoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcigndGhpcy5jYW5jZWwoKSBpcyBub3QgYSBmdW5jdGlvbicpO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgRXJyb3IoJ1RoZSBjYW5jZWwgbWV0aG9kIGlzIG5vdCBmb3VuZCBhcyBpdHMgb3duIHByb3BlcnR5Jyk7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBSZXF1ZXN0O1xuIiwiLyoqXG4gKiBSZXByZXNlbnRzIGEgcmVzcG9uc2UuXG4gKlxuICogQHBhcmFtIHtSZXF1ZXN0fSByZXF1ZXN0IFRoZSBpbnN0YW5jZSBvZiBgUmVxdWVzdGAuXG4gKi9cbmZ1bmN0aW9uIFJlc3BvbnNlKHJlcXVlc3QpIHtcbiAgICAvKipcbiAgICAgKiBAdHlwZSB7UmVxdWVzdH1cbiAgICAgKi9cbiAgICB0aGlzLnJlcXVlc3QgPSByZXF1ZXN0IHx8IG51bGw7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gUmVzcG9uc2U7XG4iLCJ2YXIgaXNQbGFpbk9iamVjdCA9IHJlcXVpcmUoJ3gtY29tbW9uLXV0aWxzL2lzUGxhaW5PYmplY3QnKTtcblxuLyoqXG4gKiBSZXByZXNlbnRzIHJlc3BvbnNlIGVycm9yLlxuICpcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHtzdHJpbmd9IGNvZGUgVGhlIGVycm9yIGNvZGUuXG4gKiBAcGFyYW0ge1JlcXVlc3R9IHJlcXVlc3QgVGhlIHJlcXVlc3QuXG4gKi9cbmZ1bmN0aW9uIFJlc3BvbnNlRXJyb3IoY29kZSwgcmVxdWVzdCkge1xuICAgIHZhciBvcHRpb25zID0gcmVxdWVzdCA/IHJlcXVlc3Qub3B0aW9ucyA6IHt9O1xuICAgIHZhciBlcnJvck1lc3NhZ2VzID0gb3B0aW9ucy5lcnJvck1lc3NhZ2VzO1xuICAgIHZhciBtZXNzYWdlO1xuXG4gICAgY29kZSA9IGNvZGUgfHwgJ0VSUl9VTktOT1dOJztcblxuICAgIGlmIChpc1BsYWluT2JqZWN0KGVycm9yTWVzc2FnZXMpKSB7XG4gICAgICAgIGlmIChlcnJvck1lc3NhZ2VzW2NvZGVdKSB7XG4gICAgICAgICAgICBtZXNzYWdlID0gZXJyb3JNZXNzYWdlc1tjb2RlXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmICghbWVzc2FnZSkge1xuICAgICAgICBtZXNzYWdlID0gJ1Vua25vd24gZXJyb3IgJyArIGNvZGU7XG4gICAgfVxuXG4gICAgaWYgKHJlcXVlc3QpIHtcbiAgICAgICAgcmVxdWVzdC5lcnJvckNvZGUgPSBjb2RlO1xuICAgIH1cblxuICAgIHRoaXMuY29kZSA9IGNvZGU7XG4gICAgdGhpcy5yZXF1ZXN0ID0gcmVxdWVzdCB8fCBudWxsO1xuICAgIHRoaXMubWVzc2FnZSA9IG1lc3NhZ2U7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gUmVzcG9uc2VFcnJvcjtcbiIsImV4cG9ydHMuRVJSX0FCT1JURUQgPSAnRVJSX0FCT1JURUQnO1xuZXhwb3J0cy5FUlJfUkVTUE9OU0UgPSAnRVJSX1JFU1BPTlNFJztcbmV4cG9ydHMuRVJSX0NBTkNFTExFRCA9ICdFUlJfQ0FOQ0VMTEVEJztcbmV4cG9ydHMuRVJSX05FVFdPUksgPSAnRVJSX05FVFdPUksnO1xuZXhwb3J0cy5FUlJfVElNRU9VVCA9ICdFUlJfVElNRU9VVCc7XG5leHBvcnRzLkhUVFBfUkVRVUVTVCA9ICdIVFRQX1JFUVVFU1QnO1xuZXhwb3J0cy5KU09OUF9SRVFVRVNUID0gJ0pTT05QX1JFUVVFU1QnO1xuIiwidmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKCd4LWNvbW1vbi11dGlscy9pc0Z1bmN0aW9uJyk7XG52YXIgSHR0cFJlc3BvbnNlID0gcmVxdWlyZSgnLi4vY2xhc3MvSHR0cFJlc3BvbnNlJyk7XG52YXIgYWRkVGltZW91dExpc3RlbmVyID0gcmVxdWlyZSgnLi9hZGRUaW1lb3V0TGlzdGVuZXInKTtcbnZhciBmaXJlQ2FsbGJhY2tzID0gcmVxdWlyZSgnLi4vc2hhcmVkL2ZpcmVDYWxsYmFja3MnKTtcbnZhciBub29wID0gcmVxdWlyZSgnLi4vc2hhcmVkL25vb3AnKTtcbnZhciBjb25zdGFudHMgPSByZXF1aXJlKCcuLi9jb25zdGFudHMnKTtcbnZhciBFUlJfQUJPUlRFRCAgID0gY29uc3RhbnRzLkVSUl9BQk9SVEVEO1xudmFyIEVSUl9DQU5DRUxMRUQgPSBjb25zdGFudHMuRVJSX0NBTkNFTExFRDtcbnZhciBFUlJfTkVUV09SSyAgID0gY29uc3RhbnRzLkVSUl9ORVRXT1JLO1xudmFyIEVSUl9SRVNQT05TRSAgPSBjb25zdGFudHMuRVJSX1JFU1BPTlNFO1xudmFyIEVSUl9USU1FT1VUICAgPSBjb25zdGFudHMuRVJSX1RJTUVPVVQ7XG5cbi8qKlxuICogQWRkIGV2ZW50IGxpc3RlbmVycyB0byB0aGUgaHR0cCByZXF1ZXN0LiBUaGlzIGZ1bmN0aW9uIHdpbGwgb3ZlcndpdGUgdGhlIGBjYW5jZWxgIG1ldGhvZCBvbiB0aGUgZ2l2ZW4gYEh0dHBSZXFlc3RgXG4gKiBpbnN0YW5jZS5cbiAqXG4gKiBAcGFyYW0ge0h0dHBSZXF1ZXN0fSByZXF1ZXN0IFRoZSBodHRwIHJlcXVlc3QgdG8gYWRkIGV2ZW50IGxpc3RlbmVycy5cbiAqL1xuZnVuY3Rpb24gYWRkRXZlbnRMaXN0ZW5lcnMocmVxdWVzdCkge1xuICAgIHZhciB4aHIgPSByZXF1ZXN0LnhocjtcbiAgICB2YXIgb3B0aW9ucyA9IHJlcXVlc3Qub3B0aW9ucztcbiAgICB2YXIgcmVxdWVzdFR5cGUgPSByZXF1ZXN0LnJlcXVlc3RUeXBlO1xuICAgIHZhciByZXNwb25zZSA9IG5ldyBIdHRwUmVzcG9uc2UocmVxdWVzdCk7XG4gICAgdmFyIGlzUmVzcG9uc2VPayA9IG9wdGlvbnMuaXNSZXNwb25zZU9rO1xuICAgIHZhciBjbGVhclRpbWVvdXRFdmVudCA9IG51bGw7XG4gICAgdmFyIHRpbWVvdXQgPSBwYXJzZUludChvcHRpb25zLnRpbWVvdXQgfHwgMCwgMTApO1xuXG4gICAgLyoqXG4gICAgICogQ2FuY2VsIHRoZSByZXF1ZXN0LlxuICAgICAqL1xuICAgIHZhciBjYW5jZWwgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNsZWFyRXZlbnRzKCk7XG4gICAgICAgIGlmICh4aHIuYWJvcnQpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgeGhyLmFib3J0KCk7XG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7fVxuICAgICAgICB9XG4gICAgICAgIGZpbmlzaChFUlJfQ0FOQ0VMTEVEKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogVGhlIGZ1bmN0aW9uIHRvIGNsZWFyIGV2ZW50cy5cbiAgICAgKi9cbiAgICB2YXIgY2xlYXJFdmVudHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8vIFNldCBjbGVhckV2ZW50cyB0byB0aGUgbm9vcCBmdW5jdGlvbi5cbiAgICAgICAgY2xlYXJFdmVudHMgPSBub29wO1xuXG4gICAgICAgIHhoci5vbmFib3J0ID0gbnVsbDtcbiAgICAgICAgeGhyLm9uZXJyb3IgPSBudWxsO1xuICAgICAgICB4aHIub25yZWFkeXN0YXRlY2hhbmdlID0gbnVsbDtcbiAgICAgICAgeGhyLm9udGltZW91dCA9IG51bGw7XG5cbiAgICAgICAgaWYgKGNsZWFyVGltZW91dEV2ZW50KSB7XG4gICAgICAgICAgICBjbGVhclRpbWVvdXRFdmVudCgpO1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0RXZlbnQgPSBudWxsO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBmdW5jdGlvbiBmaW5pc2ggdGhlIHJlcXVlc3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY29kZSBUaGUgZXJyb3IgY29kZSBvbiBlcnJvci4gSWYgbm8gZXJyb3Igb2NjdXJlZCwgdGhlIGNvZGUgaXMgYG51bGxgLlxuICAgICAqL1xuICAgIHZhciBmaW5pc2ggPSBmdW5jdGlvbiAoY29kZSkge1xuICAgICAgICAvLyBTZXQgZmluaXNoIHRvIHRoZSBub29wIGZ1bmN0aW9uLlxuICAgICAgICBmaW5pc2ggPSBub29wO1xuXG4gICAgICAgIC8vIFNldCBjYW5jZWwgdG8gdGhlIG5vb3AgZnVuY3Rpb24uXG4gICAgICAgIGNhbmNlbCA9IG5vb3A7XG5cbiAgICAgICAgLy8gTWFyayB0aGlzIHJlcXVlc3QgYXMgZmluaXNoZWQuXG4gICAgICAgIHJlcXVlc3QuZmluaXNoZWQgPSB0cnVlO1xuXG4gICAgICAgIC8vIENsZWFyIGV2ZW50cy5cbiAgICAgICAgY2xlYXJFdmVudHMoKTtcblxuICAgICAgICAvLyBGaXJlIGNhbGxiYWNrcy5cbiAgICAgICAgZmlyZUNhbGxiYWNrcyhjb2RlLCByZXNwb25zZSk7XG4gICAgfTtcblxuICAgIHhoci5vbmFib3J0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBmaW5pc2goRVJSX0FCT1JURUQpO1xuICAgIH07XG5cbiAgICB4aHIub25lcnJvciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZmluaXNoKEVSUl9ORVRXT1JLKTtcbiAgICB9O1xuXG4gICAgeGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKHhoci5yZWFkeVN0YXRlID09PSA0KSB7XG4gICAgICAgICAgICBpZiAoaXNGdW5jdGlvbihpc1Jlc3BvbnNlT2spKSB7XG4gICAgICAgICAgICAgICAgaWYgKGlzUmVzcG9uc2VPayhyZXF1ZXN0VHlwZSwgcmVzcG9uc2UpKSB7XG4gICAgICAgICAgICAgICAgICAgIGZpbmlzaChudWxsKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBmaW5pc2goRVJSX1JFU1BPTlNFKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGZpbmlzaChudWxsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBSZXdyaXRlIHRoZSBgY2FuY2VsYCBtZXRob2QuXG4gICAgICovXG4gICAgcmVxdWVzdC5jYW5jZWwgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNhbmNlbCgpO1xuICAgIH07XG5cbiAgICAvLyBBZGQgdGltZW91dCBsaXN0ZW5lclxuICAgIGlmICghaXNOYU4odGltZW91dCkgJiYgdGltZW91dCA+IDApIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0RXZlbnQgPSBhZGRUaW1lb3V0TGlzdGVuZXIoeGhyLCB0aW1lb3V0LCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBjbGVhckV2ZW50cygpO1xuICAgICAgICAgICAgaWYgKHhoci5hYm9ydCkge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIHhoci5hYm9ydCgpO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHt9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmaW5pc2goRVJSX1RJTUVPVVQpO1xuICAgICAgICB9KTtcbiAgICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYWRkRXZlbnRMaXN0ZW5lcnM7XG4iLCIvKipcbiAqIEFkZCB0aW1lb3V0IGV2ZW50IGxpc3RlbmVyIG9uIHRoZSBYSFIgb2JqZWN0LlxuICpcbiAqIEBwYXJhbSB7WE1MSHR0cFJlcXVlc3R9IHhociBUaGUgWEhSIHRvIGFkZCB0aW1lb3V0IGV2ZW50IGxpc3RlbmVyLlxuICogQHBhcmFtIHtudW1iZXJ9IHRpbWVvdXQgVGhlIHRpbWUgdG8gd2FpdCBpbiBtaWxsaXNlY29uZHMuXG4gKiBAcGFyYW0geygpID0+IHZvaWR9IGxpc3RlbmVyIFRoZSB0aW1lb3V0IGNhbGxiYWNrLlxuICogQHJldHVybnMgeygpID0+IHZvaWQpfSBSZXR1cm5zIGEgZnVuY3Rpb24gdG8gcmVtb3ZlIHRoZSB0aW1lb3V0IGV2ZW50IGxpc3RlbmVyLlxuICovXG5mdW5jdGlvbiBhZGRUaW1lb3V0TGlzdGVuZXIoeGhyLCB0aW1lb3V0LCBsaXN0ZW5lcikge1xuICAgIHZhciB0aW1lb3V0SWQgPSBudWxsO1xuICAgIHZhciBzdXBwb3J0VGltZW91dCA9ICd0aW1lb3V0JyBpbiB4aHIgJiYgJ29udGltZW91dCcgaW4geGhyO1xuXG4gICAgaWYgKHN1cHBvcnRUaW1lb3V0KSB7XG4gICAgICAgIHhoci50aW1lb3V0ID0gdGltZW91dDtcbiAgICAgICAgeGhyLm9udGltZW91dCA9IGxpc3RlbmVyO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRpbWVvdXRJZCA9IHNldFRpbWVvdXQobGlzdGVuZXIsIHRpbWVvdXQpO1xuICAgIH1cblxuICAgIC8vIENhbGwgdGhpcyBmdW5jdGlvbiB0byByZW1vdmUgdGltZW91dCBldmVudCBsaXN0ZW5lclxuICAgIGZ1bmN0aW9uIGNsZWFyVGltZW91dEV2ZW50KCkge1xuICAgICAgICBpZiAoeGhyKSB7XG4gICAgICAgICAgICBpZiAodGltZW91dElkID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgeGhyLm9udGltZW91dCA9IG51bGw7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgeGhyID0gbnVsbDtcbiAgICAgICAgICAgIGxpc3RlbmVyID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBjbGVhclRpbWVvdXRFdmVudDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBhZGRUaW1lb3V0TGlzdGVuZXI7XG4iLCJ2YXIgaXNGdW5jdGlvbiA9IHJlcXVpcmUoJ3gtY29tbW9uLXV0aWxzL2lzRnVuY3Rpb24nKTtcblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gY2FsbCB4aHIgaG9vayBmdW5jdGlvbi5cbiAqXG4gKiBAcGFyYW0ge1hIUkhvb2tGdW5jdGlvbn0gZnVuYyBUaGUgaG9vayBmdW5jdGlvbiB0byBjYWxsLCBpZiBpdCBpcyBub3QgZnVuY3Rpb24sIHRoaXMgaG9vayBpcyBza2lwcGVkLlxuICogQHBhcmFtIHtYTUxIdHRwUmVxZXVzdH0geGhyIFRoZSBpbnN0YW5jZSBvZiBgWE1MSHR0cFJlcWV1c3RgLlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9ufSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKi9cbmZ1bmN0aW9uIGNhbGxYaHJIb29rKGZ1bmMsIHhociwgb3B0aW9ucykge1xuICAgIGlmIChpc0Z1bmN0aW9uKGZ1bmMpKSB7XG4gICAgICAgIGZ1bmMoeGhyLCBvcHRpb25zKTtcbiAgICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gY2FsbFhockhvb2s7XG4iLCJ2YXIgbWVyZ2UgPSByZXF1aXJlKCd4LWNvbW1vbi11dGlscy9tZXJnZScpO1xudmFyIGlzUGxhaW5PYmplY3QgPSByZXF1aXJlKCd4LWNvbW1vbi11dGlscy9pc1BsYWluT2JqZWN0Jyk7XG52YXIgaGFzT3duID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gc2V0IHRoZSByZXF1ZXN0IGhlYWRlcnMuXG4gKlxuICogMS4gTWVyZ2UgdGhlIGBvcHRpb25zLm5vQ2FjaGVIZWFkZXJzYCBpZiBuZWVkZWQuXG4gKiAyLiBTZXQgdGhlIHJlcXVlc3QgaGVhZGVycyBpZiBuZWVkZWQuXG4gKlxuICogQHBhcmFtIHtYTUxIdHRwUmVxZXVzdH0geGhyIFRoZSBpbnN0YW5jZSBvZiBgWE1MSHR0cFJlcWV1c3RgLlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9ufSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKi9cbmZ1bmN0aW9uIGhhbmRsZUhlYWRlcnMoeGhyLCBvcHRpb25zKSB7XG4gICAgdmFyIG5hbWU7XG4gICAgdmFyIHZhbHVlO1xuICAgIHZhciBoZWFkZXJzID0gaXNQbGFpbk9iamVjdChvcHRpb25zLmhlYWRlcnMpID8gb3B0aW9ucy5oZWFkZXJzIDoge307XG5cbiAgICBpZiAob3B0aW9ucy5ub0NhY2hlKSB7XG4gICAgICAgIGlmIChpc1BsYWluT2JqZWN0KG9wdGlvbnMubm9DYWNoZUhlYWRlcnMpKSB7XG4gICAgICAgICAgICBoZWFkZXJzID0gbWVyZ2UoaGVhZGVycywgb3B0aW9ucy5ub0NhY2hlSGVhZGVycyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKG5hbWUgaW4gaGVhZGVycykge1xuICAgICAgICBpZiAoaGFzT3duLmNhbGwoaGVhZGVycywgbmFtZSkpIHtcbiAgICAgICAgICAgIHZhbHVlID0gaGVhZGVyc1tuYW1lXTtcbiAgICAgICAgICAgIC8vIE9ubHkgdGhlIG5vbi11bmRlZmluZWQgYW5kIG5vbi1udWxsIGhlYWRlcnMgYXJlIHNldFxuICAgICAgICAgICAgaWYgKHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcihuYW1lLCB2YWx1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBTZXQgdGhlIGhlYWRlcnMgYmFjay5cbiAgICBvcHRpb25zLmhlYWRlcnMgPSBoZWFkZXJzO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGhhbmRsZUhlYWRlcnM7XG4iLCJ2YXIgbWVyZ2UgPSByZXF1aXJlKCd4LWNvbW1vbi11dGlscy9tZXJnZScpO1xudmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKCd4LWNvbW1vbi11dGlscy9pc0Z1bmN0aW9uJyk7XG52YXIgaXNQbGFpbk9iamVjdCA9IHJlcXVpcmUoJ3gtY29tbW9uLXV0aWxzL2lzUGxhaW5PYmplY3QnKTtcbnZhciBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuXG4vKipcbiAqIEZpbmQgYSBwcm9jZXNzb3IgZnJvbSBgb3B0aW9ucy5odHRwUmVxdWVzdEJvZHlQcm9jZXNzb3JgIHRvIHByb2Nlc3MgdGhlIHJlcXVlc3QgYm9keS5cbiAqXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcmV0dXJucyB7YW55fSBSZXRydW5zIHRoZSBjb250ZW50IHRoYXQgc2VuZCB0byB0aGUgc2VydmVyLlxuICovXG5mdW5jdGlvbiBoYW5kbGVSZXF1ZXN0Qm9keShvcHRpb25zKSB7XG4gICAgdmFyIGk7XG4gICAgdmFyIGw7XG4gICAgdmFyIGtleTtcbiAgICB2YXIgY29udGVudCA9IG51bGw7XG4gICAgdmFyIHByb2Nlc3NvcjtcbiAgICB2YXIgY29udGVudFByb2Nlc3NvcjtcbiAgICB2YXIgY29udGVudFByb2Nlc3NvcnMgPSBbXTtcbiAgICB2YXIgYm9keSA9IG9wdGlvbnMuYm9keTtcbiAgICB2YXIgcHJvY2Vzc29ycyA9IG9wdGlvbnMuaHR0cFJlcXVlc3RCb2R5UHJvY2Vzc29yO1xuICAgIHZhciBoZWFkZXJzID0gaXNQbGFpbk9iamVjdChvcHRpb25zLmhlYWRlcnMpID8gb3B0aW9ucy5oZWFkZXJzIDoge307XG5cbiAgICBpZiAoaXNQbGFpbk9iamVjdChib2R5KSAmJiBpc1BsYWluT2JqZWN0KHByb2Nlc3NvcnMpKSB7XG4gICAgICAgIC8vIEZpbmQgYWxsIHByb2Nlc3NvcnMuXG4gICAgICAgIGZvciAoa2V5IGluIHByb2Nlc3NvcnMpIHtcbiAgICAgICAgICAgIGlmIChoYXNPd24uY2FsbChwcm9jZXNzb3JzLCBrZXkpKSB7XG4gICAgICAgICAgICAgICAgcHJvY2Vzc29yID0gcHJvY2Vzc29yc1trZXldO1xuICAgICAgICAgICAgICAgIGlmIChpc1BsYWluT2JqZWN0KHByb2Nlc3NvcikpIHtcbiAgICAgICAgICAgICAgICAgICAgY29udGVudFByb2Nlc3NvcnMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICBrZXk6IGtleSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGhlYWRlcnM6IHByb2Nlc3Nvci5oZWFkZXJzLFxuICAgICAgICAgICAgICAgICAgICAgICAgcHJpb3JpdHk6IHByb2Nlc3Nvci5wcmlvcml0eSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb2Nlc3NvcjogcHJvY2Vzc29yLnByb2Nlc3NvclxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTb3J0IHRoZSBwcm9jZXNzb3JzIGJ5IGl0cyBwcmlvcml0eS5cbiAgICAgICAgY29udGVudFByb2Nlc3NvcnMuc29ydChmdW5jdGlvbiAoYSwgYikge1xuICAgICAgICAgICAgcmV0dXJuIGIucHJpb3JpdHkgLSBhLnByaW9yaXR5O1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyBGaW5kIHRoZSBmaXJzdCBub24tdW5kZWZpbmVkIGNvbnRlbnQuXG4gICAgICAgIGZvciAoaSA9IDAsIGwgPSBjb250ZW50UHJvY2Vzc29ycy5sZW5ndGg7IGkgPCBsOyBpICs9IDEpIHtcbiAgICAgICAgICAgIHByb2Nlc3NvciA9IGNvbnRlbnRQcm9jZXNzb3JzW2ldO1xuICAgICAgICAgICAgaWYgKGJvZHlbcHJvY2Vzc29yLmtleV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGNvbnRlbnQgPSBib2R5W3Byb2Nlc3Nvci5rZXldO1xuICAgICAgICAgICAgICAgIGNvbnRlbnRQcm9jZXNzb3IgPSBwcm9jZXNzb3I7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBVc2UgdGhlIHByb2Nlc3NvciB0byBwcm9jZXNzIHRoZSBjb250ZW50LlxuICAgICAgICBpZiAoY29udGVudFByb2Nlc3Nvcikge1xuICAgICAgICAgICAgaWYgKGlzUGxhaW5PYmplY3QoY29udGVudFByb2Nlc3Nvci5oZWFkZXJzKSkge1xuICAgICAgICAgICAgICAgIGhlYWRlcnMgPSBtZXJnZShoZWFkZXJzLCBjb250ZW50UHJvY2Vzc29yLmhlYWRlcnMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcHJvY2Vzc29yID0gY29udGVudFByb2Nlc3Nvci5wcm9jZXNzb3I7XG4gICAgICAgICAgICBpZiAoaXNGdW5jdGlvbihwcm9jZXNzb3IpKSB7XG4gICAgICAgICAgICAgICAgY29udGVudCA9IHByb2Nlc3Nvcihjb250ZW50LCBvcHRpb25zKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIE1ha2Ugc3VyZSB0aGF0IHRoZSBoZWFkZXJzIGlzIGEgcGxhaW4gb2JqZWN0LlxuICAgIG9wdGlvbnMuaGVhZGVycyA9IGhlYWRlcnM7XG5cbiAgICByZXR1cm4gY29udGVudDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBoYW5kbGVSZXF1ZXN0Qm9keTtcbiIsInZhciBpc1BsYWluT2JqZWN0ID0gcmVxdWlyZSgneC1jb21tb24tdXRpbHMvaXNQbGFpbk9iamVjdCcpO1xudmFyIGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGhhbmxkZSBYTUxIdHRwUmVxdWVzdCBwcm9wZXJ0aWVzLlxuICpcbiAqIEBwYXJhbSB7WE1MSHR0cFJlcXVlc3R9IHhociBUaGUgaW5zdGFuY2Ugb2YgYFhNTEh0dHBSZXF1ZXN0YC5cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqL1xuZnVuY3Rpb24gaGFuZGxlWGhyUHJvcHMoeGhyLCBvcHRpb25zKSB7XG4gICAgdmFyIHByb3A7XG4gICAgdmFyIHhoclByb3BzID0gb3B0aW9ucy54aHJQcm9wcztcblxuICAgIGlmIChvcHRpb25zLmNvcnMpIHtcbiAgICAgICAgeGhyLndpdGhDcmVkZW50aWFscyA9IHRydWU7XG4gICAgfVxuXG4gICAgaWYgKGlzUGxhaW5PYmplY3QoeGhyUHJvcHMpKSB7XG4gICAgICAgIGZvciAocHJvcCBpbiB4aHJQcm9wcykge1xuICAgICAgICAgICAgaWYgKGhhc093bi5jYWxsKHhoclByb3BzLCBwcm9wKSkge1xuICAgICAgICAgICAgICAgIHhocltwcm9wXSA9IHhoclByb3BzW3Byb3BdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGhhbmRsZVhoclByb3BzO1xuIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2NsYXNzL0h0dHBDbGllbnQnKTtcbiIsInZhciBpc0Z1bmN0aW9uID0gcmVxdWlyZSgneC1jb21tb24tdXRpbHMvaXNGdW5jdGlvbicpO1xudmFyIEpTT05QUmVzcG9uc2UgPSByZXF1aXJlKCcuLi9jbGFzcy9KU09OUFJlc3BvbnNlJyk7XG52YXIgZmlyZUNhbGxiYWNrcyA9IHJlcXVpcmUoJy4uL3NoYXJlZC9maXJlQ2FsbGJhY2tzJyk7XG52YXIgbm9vcCA9IHJlcXVpcmUoJy4uL3NoYXJlZC9ub29wJyk7XG52YXIgY29uc3RhbnRzID0gcmVxdWlyZSgnLi4vY29uc3RhbnRzJyk7XG52YXIgRVJSX0NBTkNFTExFRCA9IGNvbnN0YW50cy5FUlJfQ0FOQ0VMTEVEO1xudmFyIEVSUl9ORVRXT1JLICAgPSBjb25zdGFudHMuRVJSX05FVFdPUks7XG52YXIgRVJSX1JFU1BPTlNFICA9IGNvbnN0YW50cy5FUlJfUkVTUE9OU0U7XG52YXIgRVJSX1RJTUVPVVQgICA9IGNvbnN0YW50cy5FUlJfVElNRU9VVDtcblxuZnVuY3Rpb24gYWRkRXZlbnRMaXN0ZW5lcnMocmVxdWVzdCwgY2FsbGJhY2tOYW1lKSB7XG4gICAgdmFyIHNjcmlwdCA9IHJlcXVlc3Quc2NyaXB0O1xuICAgIHZhciBvcHRpb25zID0gcmVxdWVzdC5vcHRpb25zO1xuICAgIHZhciByZXF1ZXN0VHlwZSA9IHJlcXVlc3QucmVxdWVzdFR5cGU7XG4gICAgdmFyIGlzUmVzcG9uc2VPayA9IG9wdGlvbnMuaXNSZXNwb25zZU9rO1xuICAgIHZhciByZXNwb25zZSA9IG5ldyBKU09OUFJlc3BvbnNlKHJlcXVlc3QpO1xuICAgIHZhciB0aW1lb3V0ID0gcGFyc2VJbnQob3B0aW9ucy50aW1lb3V0IHx8IDAsIDEwKTtcbiAgICB2YXIgdGltZW91dElkID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFRoZSBmdW5jdGlvbiBmaW5pc2ggdGhlIHJlcXVlc3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY29kZSBUaGUgZXJyb3IgY29kZSBvbiBlcnJvci4gSWYgbm8gZXJyb3Igb2NjdXJlZCwgdGhlIGNvZGUgaXMgYG51bGxgLlxuICAgICAqL1xuICAgIHZhciBmaW5pc2ggPSBmdW5jdGlvbiAoY29kZSkge1xuICAgICAgICAvLyBTZXQgZmluaXNoIHRvIHRoZSBubyBvcGVyYXRpb24gZnVuY3Rpb24uXG4gICAgICAgIGZpbmlzaCA9IG5vb3A7XG5cbiAgICAgICAgLy8gTWFyayB0aGlzIHJlcXVlc3QgYXMgZmluaXNoZWQuXG4gICAgICAgIHJlcXVlc3QuZmluaXNoZWQgPSB0cnVlO1xuXG4gICAgICAgIC8vIENsZWFyIGxpc3RlbmVycy5cbiAgICAgICAgd2luZG93W2NhbGxiYWNrTmFtZV0gPSBub29wO1xuICAgICAgICBzY3JpcHQub25lcnJvciA9IG51bGw7XG5cbiAgICAgICAgLy8gQ2xlYXIgdGltZW91dC5cbiAgICAgICAgaWYgKHRpbWVvdXRJZCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXRJZCk7XG4gICAgICAgICAgICB0aW1lb3V0SWQgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gRmlyZSBjYWxsYmFja3MuXG4gICAgICAgIGZpcmVDYWxsYmFja3MoY29kZSwgcmVzcG9uc2UpO1xuICAgIH07XG5cbiAgICAvLyBEZWZpbmUgdGhlIGNhbGxiYWNrIGZ1bmN0aW9uLlxuICAgIHdpbmRvd1tjYWxsYmFja05hbWVdID0gZnVuY3Rpb24gKHJlc3BvbnNlSlNPTikge1xuICAgICAgICByZXF1ZXN0Lmpzb25wUmVzcG9uc2UgPSByZXNwb25zZUpTT047XG4gICAgICAgIGlmIChpc0Z1bmN0aW9uKGlzUmVzcG9uc2VPaykpIHtcbiAgICAgICAgICAgIGlmIChpc1Jlc3BvbnNlT2socmVxdWVzdFR5cGUsIHJlc3BvbnNlKSkge1xuICAgICAgICAgICAgICAgIGZpbmlzaChudWxsKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZmluaXNoKEVSUl9SRVNQT05TRSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmaW5pc2gobnVsbCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gQ2F0Y2ggdGhlIGVycm9yLlxuICAgIHNjcmlwdC5vbmVycm9yID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBmaW5pc2goRVJSX05FVFdPUkspO1xuICAgIH07XG5cbiAgICAvLyBSZXdyaXRlIHRoZSBgY2FuY2VsYCBtZXRob2QuXG4gICAgcmVxdWVzdC5jYW5jZWwgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGZpbmlzaChFUlJfQ0FOQ0VMTEVEKTtcbiAgICB9O1xuXG4gICAgLy8gQWRkIHRpbWVvdXQgbGlzdGVuZXJcbiAgICBpZiAoIWlzTmFOKHRpbWVvdXQpICYmIHRpbWVvdXQgPiAwKSB7XG4gICAgICAgIHRpbWVvdXRJZCA9IHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgZmluaXNoKEVSUl9USU1FT1VUKTtcbiAgICAgICAgfSwgdGltZW91dCk7XG4gICAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGFkZEV2ZW50TGlzdGVuZXJzO1xuIiwiLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gY3JlYXRlIEpTT05QIGNhbGxiYWNrIG5hbWUuXG4gKlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICogQHJldHVybnMge3N0cmluZ30gUmV0dXJucyB0aGUgY2FsbGJhY2sgbmFtZS5cbiAqL1xuZnVuY3Rpb24gYnVpbGRDYWxsbGJhY2tOYW1lKG9wdGlvbnMpIHtcbiAgICB2YXIgY2FsbGJhY2tOYW1lO1xuXG4gICAgZG8ge1xuICAgICAgICBjYWxsYmFja05hbWUgPSBvcHRpb25zLmpzb25wQ2FsbGJhY2tOYW1lLmNhbGwobnVsbCwgb3B0aW9ucyk7XG4gICAgfSB3aGlsZSAoY2FsbGJhY2tOYW1lIGluIHdpbmRvdyk7XG5cbiAgICB3aW5kb3dbY2FsbGJhY2tOYW1lXSA9IG51bGw7XG5cbiAgICByZXR1cm4gY2FsbGJhY2tOYW1lO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGJ1aWxkQ2FsbGxiYWNrTmFtZTtcbiIsInZhciBidWlsZFVSTCA9IHJlcXVpcmUoJy4uL3NoYXJlZC9idWlsZFVSTCcpO1xuXG4vKipcbiAqIEJ1aWxkIHRoZSBKU09OUCBzY3JpcHQgc3JjLlxuICpcbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3BpdG9ucy5cbiAqIEBwYXJhbSB7c3RyaW5nfSBjYWxsYmFja05hbWUgVGhlIGNhbGxiYWNrIG5hbWUgb2YgdGhlIEpTT05QLlxuICogQHJldHVybiB7c3RyaW5nfSBSZXR1cm5zIHRoZSBzY3JpcHQgc3JjLlxuICovXG5mdW5jdGlvbiBidWlsZFNjcmlwdFNyYyhvcHRpb25zLCBjYWxsYmFja05hbWUpIHtcbiAgICAvLyB2YXIgdXNlcm5hbWUgPSBvcHRpb25zLnVzZXJuYW1lO1xuICAgIC8vIHZhciBwYXNzd29yZCA9IG9wdGlvbnMucGFzc3dvcmQ7XG4gICAgLy8gdmFyIGxpbms7XG4gICAgdmFyIHF1ZXJ5ID0gb3B0aW9ucy5xdWVyeTtcbiAgICB2YXIga2V5ID0gb3B0aW9ucy5qc29ucDtcbiAgICB2YXIgdXJsO1xuXG4gICAgaWYgKCFxdWVyeSkge1xuICAgICAgICBxdWVyeSA9IHt9O1xuICAgICAgICBvcHRpb25zLnF1ZXJ5ID0gcXVlcnk7XG4gICAgfVxuXG4gICAgcXVlcnlba2V5XSA9IGNhbGxiYWNrTmFtZTtcbiAgICB1cmwgPSBidWlsZFVSTChvcHRpb25zKTtcblxuICAgIHJldHVybiB1cmw7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYnVpbGRTY3JpcHRTcmM7XG4iLCIvKipcbiAqIFRoZSBmdW5jdGlvbiB0byBoYW5kbGUgYG9wdGlvbnMuY29yc2Agc2V0dGluZyB3aGVuIHNlbmRpbmcgSlNPTlAgcmVxdWVzdHMuIElmIGBvcHRpb25zLmNvcnNgIGlzIGB0cnVlYCwgdGhlXG4gKiBgY3Jvc3NvcmlnaW5gIGF0dHJpYnV0ZSBvZiB0aGUgYHNjcmlwdGAgZWxlbWVudCB3ZSB1c2luZyBpcyBzZXQgdG8gYHVzZS1jcmVkZW50aWFsc2AuXG4gKlxuICogQHBhcmFtIHtIVE1MU2NyaXB0RWxlbWVudH0gc2NyaXB0IFRoZSBzY3JpcHQgZWxlbWVudC5cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqL1xuZnVuY3Rpb24gaGFuZGxlU2NyaXB0Q29ycyhzY3JpcHQsIG9wdGlvbnMpIHtcbiAgICBpZiAob3B0aW9ucy5jb3JzKSB7XG4gICAgICAgIHNjcmlwdC5zZXRBdHRyaWJ1dGUoJ2Nyb3Nzb3JpZ2luJywgJ3VzZS1jcmVkZW50aWFscycpO1xuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBoYW5kbGVTY3JpcHRDb3JzO1xuIiwidmFyIGlzUGxhaW5PYmplY3QgPSByZXF1aXJlKCd4LWNvbW1vbi11dGlscy9pc1BsYWluT2JqZWN0Jyk7XG52YXIgaXNGdW5jdGlvbiA9IHJlcXVpcmUoJ3gtY29tbW9uLXV0aWxzL2lzRnVuY3Rpb24nKTtcbnZhciBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBhZGQgY3VzdG9tIHBhcnNlcnMgdG8gdGhlIGluc3RhbmNlIG9mIGBSZXNwb25zZWAgb3IgYFJlc3BvbnNlRXJyb3JgLlxuICpcbiAqIEBwYXJhbSB7UmVzcG9uc2V8UmVzcG9uc2VFcnJvcn0gdGFyZ2V0IFRoZSB0YXJnZXQgdG8gYWRkIHRoZSBjdXN0b21lIHBhcnNlcnMuXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcGFyYW0ge3N0cmluZ30gb3B0aW9uTmFtZSBUaGUgb3B0aW9uIG5hbWUgdGhlIHBhcnNlcnMgY29udGFpbmVyLlxuICovXG5mdW5jdGlvbiBhZGRDdXN0b21QYXJzZXIodGFyZ2V0LCBvcHRpb25zLCBvcHRpb25OYW1lKSB7XG4gICAgdmFyIHBhcnNlcnMgPSBvcHRpb25zW29wdGlvbk5hbWVdO1xuICAgIHZhciBuYW1lO1xuICAgIHZhciBwYXJzZXI7XG5cbiAgICBpZiAoaXNQbGFpbk9iamVjdChwYXJzZXJzKSkge1xuICAgICAgICBmb3IgKG5hbWUgaW4gcGFyc2Vycykge1xuICAgICAgICAgICAgaWYgKGhhc093bi5jYWxsKHBhcnNlcnMsIG5hbWUpKSB7XG4gICAgICAgICAgICAgICAgcGFyc2VyID0gcGFyc2Vyc1tuYW1lXTtcbiAgICAgICAgICAgICAgICBpZiAoaXNGdW5jdGlvbihwYXJzZXIpKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChuYW1lIGluIHRhcmdldCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdUaGUgbmFtZSBcIicgKyBuYW1lICsgJ1wiIGhhcyBhbHJlYWR5IGV4aXN0ZWQsIGNhbiBub3QgYWRkIGl0IGFzIGEgcGFyc2VyJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0W25hbWVdID0gcGFyc2VyO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBhZGRDdXN0b21QYXJzZXI7XG4iLCJ2YXIgaXNGdW5jdGlvbiA9IHJlcXVpcmUoJ3gtY29tbW9uLXV0aWxzL2lzRnVuY3Rpb24nKTtcbnZhciBpc0Fic29sdXRlVVJMID0gcmVxdWlyZSgneC1jb21tb24tdXRpbHMvaXNBYnNvbHV0ZVVSTCcpO1xudmFyIGlzUGxhaW5PYmplY3QgPSByZXF1aXJlKCd4LWNvbW1vbi11dGlscy9pc1BsYWluT2JqZWN0Jyk7XG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGJ1aWxkIHJlcXVlc3QgdXJsLlxuICpcbiAqIDEuIEFkZCBiYXNlVVJMIGlmIG5lZWRlZC5cbiAqIDIuIENvbXBpbGUgdXJsIGlmIG5lZWRlZC5cbiAqIDMuIENvbXBpbGUgcXVlcnkgc3RyaW5nIGlmIG5lZWRlZC5cbiAqXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBSZXR1cm5zIHRoZSBmaW5hbCB1cmwgc3RyaW5nLlxuICovXG5mdW5jdGlvbiBidWlsZFVSTChvcHRpb25zKSB7XG4gICAgdmFyIHVybCA9ICh0eXBlb2Ygb3B0aW9ucy51cmwgPT09ICdzdHJpbmcnKSA/IG9wdGlvbnMudXJsIDogJyc7XG4gICAgdmFyIGJhc2VVUkwgPSBvcHRpb25zLmJhc2VVUkw7XG4gICAgdmFyIHBhcmFtID0gb3B0aW9ucy5wYXJhbTtcbiAgICB2YXIgcXVlcnkgPSBvcHRpb25zLnF1ZXJ5O1xuICAgIHZhciBjb21waWxlVVJMID0gb3B0aW9ucy5jb21waWxlVVJMO1xuICAgIHZhciBlbmNvZGVRdWVyeVN0cmluZyA9IG9wdGlvbnMuZW5jb2RlUXVlcnlTdHJpbmc7XG4gICAgdmFyIGFycmF5O1xuXG4gICAgLy8gSWYgdGhlIHVybCBpcyBub3QgYWJzb2x1dGUgdXJsIGFuZCB0aGUgYmFzZVVSTCBpcyBkZWZpbmVkLFxuICAgIC8vIHByZXBlbmQgdGhlIGJhc2VVUkwgdG8gdGhlIHVybC5cbiAgICBpZiAoIWlzQWJzb2x1dGVVUkwodXJsKSkge1xuICAgICAgICBpZiAodHlwZW9mIGJhc2VVUkwgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICB1cmwgPSBiYXNlVVJMICsgdXJsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ29tcGlsZSB0aGUgdXJsIGlmIG5lZWRlZC5cbiAgICBpZiAoaXNQbGFpbk9iamVjdChwYXJhbSkgJiYgaXNGdW5jdGlvbihjb21waWxlVVJMKSkge1xuICAgICAgICB1cmwgPSBjb21waWxlVVJMKHVybCwgcGFyYW0sIG9wdGlvbnMpO1xuICAgIH1cblxuICAgIC8vIENvbXBpbGUgdGhlIHF1ZXJ5IHN0cmluZy5cbiAgICBpZiAoaXNQbGFpbk9iamVjdChxdWVyeSkgJiYgaXNGdW5jdGlvbihlbmNvZGVRdWVyeVN0cmluZykpIHtcbiAgICAgICAgcXVlcnkgPSBlbmNvZGVRdWVyeVN0cmluZyhxdWVyeSwgb3B0aW9ucyk7XG4gICAgICAgIGFycmF5ID0gdXJsLnNwbGl0KCcjJyk7IC8vIFRoZXJlIG1heSBiZSBzb21ldGhpbmcgaGFzaCBzdHJpbmcgaW4gdGhlIHVybC5cbiAgICAgICAgdXJsID0gYXJyYXlbMF07XG5cbiAgICAgICAgaWYgKHVybC5pbmRleE9mKCc/JykgPiAtMSkge1xuICAgICAgICAgICAgLy8gQ2hlY2sgd2hldGhlciB0aGUgdXJsIGlzIGVuZGluZyB3aXRoIGEgYCZgLlxuICAgICAgICAgICAgaWYgKC8mKyQvLnRlc3QodXJsKSkge1xuICAgICAgICAgICAgICAgIHVybCA9IHVybCArIHF1ZXJ5O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB1cmwgPSB1cmwgKyAnJicgKyBxdWVyeTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHVybCA9IHVybCArICc/JyArIHF1ZXJ5O1xuICAgICAgICB9XG5cbiAgICAgICAgYXJyYXlbMF0gPSB1cmw7XG4gICAgICAgIHVybCA9IGFycmF5LmpvaW4oJyMnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdXJsO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGJ1aWxkVVJMO1xuIiwidmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKCd4LWNvbW1vbi11dGlscy9pc0Z1bmN0aW9uJyk7XG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGNhbGwgYG9wdGlvbnMub25SZXF1ZXN0Q3JlYXRlZGAgY2FsbGJhY2suXG4gKlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICogQHBhcmFtIHtIdHRwUmVxdWVzdHxKU09OUFJlcXVlc3R9IHJlcXVlc3QgVGhlIHJlcXVlc3QgaW5zdGFuY2UuXG4gKi9cbmZ1bmN0aW9uIGNhbGxSZXF1ZXN0Q3JlYXRlZENhbGxiYWNrKG9wdGlvbnMsIHJlcXVlc3QpIHtcbiAgICB2YXIgb25SZXF1ZXN0Q3JlYXRlZCA9IG9wdGlvbnMub25SZXF1ZXN0Q3JlYXRlZDtcblxuICAgIGlmIChpc0Z1bmN0aW9uKG9uUmVxdWVzdENyZWF0ZWQpKSB7XG4gICAgICAgIG9uUmVxdWVzdENyZWF0ZWQocmVxdWVzdCk7XG4gICAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGNhbGxSZXF1ZXN0Q3JlYXRlZENhbGxiYWNrO1xuIiwidmFyIENhbmNlbENvbnRyb2xsZXIgPSByZXF1aXJlKCcuLi9jbGFzcy9DYW5jZWxDb250cm9sbGVyJyk7XG5cbi8qKlxuICogQ3JlYXRlIGEgbmV3IGluc3RhbmNlIG9mIGBDYW5jZWxDb250cm9sbGVyYC5cbiAqXG4gKiBAcmV0dXJucyB7Q2FuY2VsQ29udHJvbGxlcn0gUmV0dXJucyBhbiBuZXcgaW5zdGFuY2Ugb2YgYENhbmNlbENvbnRyb2xsZXJgLlxuICovXG52YXIgY3JlYXRlQ2FuY2VsQ29udHJvbGxlciA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gbmV3IENhbmNlbENvbnRyb2xsZXI7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZUNhbmNlbENvbnRyb2xsZXI7XG4iLCJ2YXIgUVMgPSByZXF1aXJlKCd4LXF1ZXJ5LXN0cmluZycpO1xudmFyIGNvbnN0YW50cyA9IHJlcXVpcmUoJy4uL2NvbnN0YW50cycpO1xudmFyIHRlbXBsYXRlID0gcmVxdWlyZSgnLi90ZW1wbGF0ZScpO1xudmFyIHV1aWQgPSByZXF1aXJlKCcuL3V1aWQnKTtcbnZhciBIVFRQX1JFUVVFU1QgID0gY29uc3RhbnRzLkhUVFBfUkVRVUVTVDtcbnZhciBFUlJfQUJPUlRFRCAgID0gY29uc3RhbnRzLkVSUl9BQk9SVEVEO1xudmFyIEVSUl9DQU5DRUxMRUQgPSBjb25zdGFudHMuRVJSX0NBTkNFTExFRDtcbnZhciBFUlJfTkVUV09SSyAgID0gY29uc3RhbnRzLkVSUl9ORVRXT1JLO1xudmFyIEVSUl9SRVNQT05TRSAgPSBjb25zdGFudHMuRVJSX1JFU1BPTlNFO1xudmFyIEVSUl9USU1FT1VUICAgPSBjb25zdGFudHMuRVJSX1RJTUVPVVQ7XG5cbi8qKlxuICogQ3JlYXRlIGEgbmV3IGRlZmF1bHQgcmVxdWVzdCBvcHRpb25zLlxuICpcbiAqIEByZXR1cm5zIHtSZXF1ZXN0T3B0aW9uc30gUmV0dXJucyBhIG5ldyBkZWZhdWx0IHJlcXVlc3Qgb3BpdG9ucy5cbiAqL1xuZnVuY3Rpb24gY3JlYXRlRGVmYXVsdE9wdGlvbnMoKSB7XG4gICAgdmFyIGVycm9yTWVzc2FnZXMgPSB7fTtcblxuICAgIGVycm9yTWVzc2FnZXNbRVJSX0FCT1JURURdID0gJ1JlcXVlc3QgYWJvcnRlZCc7XG4gICAgZXJyb3JNZXNzYWdlc1tFUlJfQ0FOQ0VMTEVEXSA9ICdSZXF1ZXN0IGNhbmNlbGxlZCc7XG4gICAgZXJyb3JNZXNzYWdlc1tFUlJfTkVUV09SS10gPSAnTmV0d29yayBlcnJvcic7XG4gICAgZXJyb3JNZXNzYWdlc1tFUlJfUkVTUE9OU0VdID0gJ1Jlc3BvbnNlIGVycm9yJztcbiAgICBlcnJvck1lc3NhZ2VzW0VSUl9USU1FT1VUXSA9ICdSZXF1ZXN0IHRpbWVvdXQnO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1JlcXVlc3RPcHRpb25zfVxuICAgICAqL1xuICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgICBtZXRob2Q6ICdHRVQnLFxuICAgICAgICBiYXNlVVJMOiBudWxsLFxuICAgICAgICB1cmw6IG51bGwsXG4gICAgICAgIHBhcmFtOiBudWxsLFxuICAgICAgICBxdWVyeTogbnVsbCxcbiAgICAgICAgaGVhZGVyczogbnVsbCxcbiAgICAgICAgYm9keTogbnVsbCxcbiAgICAgICAgZXh0cmE6IHt9LFxuICAgICAgICBjb250cm9sbGVyOiBudWxsLFxuICAgICAgICByZXF1ZXN0RnVuY3Rpb25OYW1lOiBudWxsLFxuICAgICAgICByZXF1ZXN0VHlwZTogbnVsbCxcbiAgICAgICAgY29yczogZmFsc2UsXG4gICAgICAgIHhoclByb3BzOiBudWxsLFxuICAgICAgICB1c2VybmFtZTogbnVsbCxcbiAgICAgICAgcGFzc3dvcmQ6IG51bGwsXG4gICAgICAgIHRpbWVvdXQ6IDAsXG4gICAgICAgIG5vQ2FjaGU6IGZhbHNlLFxuICAgICAgICBub0NhY2hlSGVhZGVyczoge1xuICAgICAgICAgICAgJ1ByYWdtYSc6ICduby1jYWNoZScsXG4gICAgICAgICAgICAnQ2FjaGUtQ29udHJvbCc6ICduby1jYWNoZSwgbm8tc3RvcmUsIG11c3QtcmV2YWxpZGF0ZSdcbiAgICAgICAgfSxcbiAgICAgICAganNvbnA6ICdjYWxsYmFjaycsXG4gICAgICAgIGVycm9yTWVzc2FnZXM6IGVycm9yTWVzc2FnZXMsXG4gICAgICAgIGh0dHBSZXF1ZXN0Qm9keVByb2Nlc3Nvcjoge1xuICAgICAgICAgICAgcmF3OiB7XG4gICAgICAgICAgICAgICAgcHJpb3JpdHk6IDAsXG4gICAgICAgICAgICAgICAgaGVhZGVyczogbnVsbCxcbiAgICAgICAgICAgICAgICBwcm9jZXNzb3I6IG51bGwsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZm9ybToge1xuICAgICAgICAgICAgICAgIHByaW9yaXR5OiAxLFxuICAgICAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQ7IGNoYXJzZXQ9VVRGLTgnXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBwcm9jZXNzb3I6IGZ1bmN0aW9uIChkYXRhLCBvcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBRUy5lbmNvZGUoZGF0YSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGpzb246IHtcbiAgICAgICAgICAgICAgICBwcmlvcml0eTogMixcbiAgICAgICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbjsgY2hhcnNldD1VVEYtOCdcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHByb2Nlc3NvcjogZnVuY3Rpb24gKGRhdGEsIG9wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGRhdGEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgaHR0cFJlc3BvbnNlUGFyc2VyOiB7XG4gICAgICAgICAgICBqc29uOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgLy8gYHRoaXNgIGlzIHBvaW50IHRvIHRoZSBjdXJyZW50IGluc3RhbmNlIG9mIGBIdHRwUmVzcG9uc2VgLlxuICAgICAgICAgICAgICAgIHZhciByZXNwb25zZVRleHQgPSB0aGlzLnJlcXVlc3QueGhyLnJlc3BvbnNlVGV4dDtcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzcG9uc2VUZXh0ID8gSlNPTi5wYXJzZShyZXNwb25zZVRleHQpIDogbnVsbDtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB0ZXh0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucmVxdWVzdC54aHIucmVzcG9uc2VUZXh0O1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHN0YXR1czogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnJlcXVlc3QueGhyLnN0YXR1cztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAganNvbnBSZXNwb25zZVBhcnNlcjoge1xuICAgICAgICAgICAganNvbjogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnJlcXVlc3QuanNvbnBSZXNwb25zZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgaHR0cFJlc3BvbnNlRXJyb3JQYXJzZXI6IG51bGwsXG4gICAgICAgIGpzb25wUmVzcG9uc2VFcnJvclBhcnNlcjogbnVsbCxcbiAgICAgICAgaGFuZGxlT3B0aW9uczogbnVsbCxcbiAgICAgICAgY3JlYXRlWEhSOiBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgICAgICB9LFxuICAgICAgICBjcmVhdGVTY3JpcHQ6IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgICAgICB2YXIgc2NyaXB0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2NyaXB0Jyk7XG5cbiAgICAgICAgICAgIHNjcmlwdC5zZXRBdHRyaWJ1dGUoJ3R5cGUnLCAndGV4dC9qYXZhc2NyaXB0Jyk7XG4gICAgICAgICAgICBzY3JpcHQuc2V0QXR0cmlidXRlKCdjaGFyc2V0JywgJ3V0Zi04Jyk7XG5cbiAgICAgICAgICAgIHJldHVybiBzY3JpcHQ7XG4gICAgICAgIH0sXG4gICAgICAgIGpzb25wQ29udGFpbmVyTm9kZTogZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgICAgIHJldHVybiBkb2N1bWVudC5oZWFkIHx8IGRvY3VtZW50LmdldEVsZW1lbnRzQnlOYW1lKCdoZWFkJylbMF07XG4gICAgICAgIH0sXG4gICAgICAgIGpzb25wQ2FsbGJhY2tOYW1lOiBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICAgICAgcmV0dXJuICdqc29ucF8nICsgdXVpZCgpICsgJ18nICsgKG5ldyBEYXRlKCkuZ2V0VGltZSgpKTtcbiAgICAgICAgfSxcbiAgICAgICAgY29tcGlsZVVSTDogZnVuY3Rpb24gKHVybCwgcGFyYW0sIG9wdGlvbnMpIHtcbiAgICAgICAgICAgIHJldHVybiB0ZW1wbGF0ZSh1cmwsIHBhcmFtKTtcbiAgICAgICAgfSxcbiAgICAgICAgZW5jb2RlUXVlcnlTdHJpbmc6IGZ1bmN0aW9uIChkYXRhLCBvcHRpb25zKSB7XG4gICAgICAgICAgICByZXR1cm4gUVMuZW5jb2RlKGRhdGEpO1xuICAgICAgICB9LFxuICAgICAgICBvblhockNyZWF0ZWQ6IG51bGwsXG4gICAgICAgIG9uWGhyT3BlbmVkOiBudWxsLFxuICAgICAgICBvblhoclNlbnQ6IG51bGwsXG4gICAgICAgIG9uUmVxdWVzdENyZWF0ZWQ6IG51bGwsXG4gICAgICAgIGlzUmVzcG9uc2VPazogZnVuY3Rpb24gKHJlcXVlc3RUeXBlLCByZXNwb25zZSkge1xuICAgICAgICAgICAgdmFyIHN0YXR1cztcblxuICAgICAgICAgICAgLy8gSHR0cCByZXFlc3RcbiAgICAgICAgICAgIGlmIChyZXF1ZXN0VHlwZSA9PT0gSFRUUF9SRVFVRVNUKSB7XG4gICAgICAgICAgICAgICAgc3RhdHVzID0gcmVzcG9uc2UucmVxdWVzdC54aHIuc3RhdHVzO1xuICAgICAgICAgICAgICAgIHJldHVybiAoc3RhdHVzID49IDIwMCAmJiBzdGF0dXMgPCAzMDApIHx8IHN0YXR1cyA9PT0gMzA0O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBKU09OUCByZXF1ZXN0XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSxcbiAgICAgICAgdHJhbnNmb3JtRXJyb3I6IG51bGwsXG4gICAgICAgIHRyYW5zZm9ybVJlc3BvbnNlOiBudWxsLFxuICAgICAgICBzaG91bGRDYWxsRXJyb3JDYWxsYmFjazogbnVsbCxcbiAgICAgICAgc2hvdWxkQ2FsbFN1Y2Nlc3NDYWxsYmFjazogbnVsbFxuICAgIH07XG5cbiAgICByZXR1cm4gb3B0aW9ucztcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBjcmVhdGVEZWZhdWx0T3B0aW9ucztcbiIsIi8qKlxuICogRGVmaW5lIGEgc3RhdGljIG1lbWJlciBvbiB0aGUgZ2l2ZW4gY29uc3RydWN0b3IgYW5kIGl0cyBwcm90b3R5cGVcbiAqXG4gKiBAcGFyYW0ge0NvbnN0cnVjdG9yfSBjdG9yIFRoZSBjb25zdHJ1Y3RvciB0byBkZWZpbmUgdGhlIHN0YXRpYyBtZW1iZXJcbiAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIFRoZSBuYW1lIG9mIHRoZSBzdGF0aWMgbWVtYmVyXG4gKiBAcGFyYW0ge2FueX0gdmFsdWUgVGhlIHZhbHVlIG9mIHRoZSBzdGF0aWMgbWVtYmVyXG4gKiBAdGhyb3dzIHtFcnJvcn0gVGhyb3dzIGVycm9yIGlmIHRoZSBuYW1lIGhhcyBhbHJlYWR5IGV4aXN0ZWQsIG9yIHRoZSBjb25zdHJ1Y3RvciBpcyBub3QgYSBmdW5jdGlvblxuICovXG5mdW5jdGlvbiBkZWZpbmVFeHBvcnRzKGN0b3IsIG5hbWUsIHZhbHVlKSB7XG4gICAgaWYgKHR5cGVvZiBjdG9yICE9PSAnZnVuY3Rpb24nIHx8ICFjdG9yLnByb3RvdHlwZSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RoZSBjb25zdHJ1Y3RvciBpcyBub3QgYSBmdW5jdGlvbiBvciBpdHMgcHJvdG90eXBlIGlzIG5vdCBhbiBvYmplY3QnKTtcbiAgICB9XG5cbiAgICBjdG9yLmV4cG9ydHMgPSBjdG9yLmV4cG9ydHMgfHwge307XG5cbiAgICBpZiAobmFtZSBpbiBjdG9yLmV4cG9ydHMpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdUaGUgbmFtZSBcIicgKyBuYW1lICsgJ1wiIGhhcyBhbHJlYWR5IGV4aXN0ZWQgaW4gdGhlIGNvbnN0cnVjdG9yLmV4cG9ydHMnKTtcbiAgICB9XG5cbiAgICBpZiAoY3Rvci5wcm90b3R5cGUuZXhwb3J0cyAmJiBjdG9yLnByb3RvdHlwZS5leHBvcnRzICE9PSBjdG9yLmV4cG9ydHMpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdUaGUgbmFtZSBcImV4cG9ydHNcIiBoYXMgYWxyZWFkeSBleGlzdGVkIGluIHRoZSBjb25zdHJ1Y3Rvci5wcm90b3R5cGUnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjdG9yLnByb3RvdHlwZS5leHBvcnRzID0gY3Rvci5leHBvcnRzO1xuICAgIH1cblxuICAgIGN0b3IuZXhwb3J0c1tuYW1lXSA9IHZhbHVlO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGRlZmluZUV4cG9ydHM7XG4iLCJ2YXIgaXNGdW5jdGlvbiA9IHJlcXVpcmUoJ3gtY29tbW9uLXV0aWxzL2lzRnVuY3Rpb24nKTtcbnZhciBIdHRwUmVzcG9uc2VFcnJvciA9IHJlcXVpcmUoJy4uL2NsYXNzL0h0dHBSZXNwb25zZUVycm9yJyk7XG52YXIgSlNPTlBSZXNwb25zZUVycm9yID0gcmVxdWlyZSgnLi4vY2xhc3MvSlNPTlBSZXNwb25zZUVycm9yJyk7XG52YXIgY29uc3RhbnRzID0gcmVxdWlyZSgnLi4vY29uc3RhbnRzJyk7XG52YXIgSFRUUF9SRVFVRVNUID0gY29uc3RhbnRzLkhUVFBfUkVRVUVTVDtcblxuLyoqXG4gKiBGaXJlIHRoZSBjYWxsYmFja3MuXG4gKlxuICogQHBhcmFtIHtzdHJpbmd8bnVsbH0gY29kZSBJZiB0aGVyZSBpcyBhbiBlcnJvciwgYGNvZGVgIHNob3VsZCBiZSBhIHN0cmluZy4gSWYgdGhlcmUgaXMgbm8gZXJyb3IsIGBjb2RlYCBpcyBgbnVsbGAuXG4gKiBAcGFyYW0ge0h0dHBSZXNwb25zZXxKU09OUFJlc3BvbnNlfSByZXNwb25zZSBUaGUgcmVzcG9uc2UgaW5zdGFuY2UuXG4gKi9cbmZ1bmN0aW9uIGZpcmVDYWxsYmFja3MoY29kZSwgcmVzcG9uc2UpIHtcbiAgICB2YXIgcmVxdWVzdCA9IHJlc3BvbnNlLnJlcXVlc3Q7XG4gICAgdmFyIHJlcXVlc3RUeXBlID0gcmVxdWVzdC5yZXF1ZXN0VHlwZTtcbiAgICB2YXIgb3B0aW9ucyA9IHJlcXVlc3Qub3B0aW9ucztcbiAgICB2YXIgb25zdWNjZXNzID0gcmVxdWVzdC5vbnN1Y2Nlc3M7XG4gICAgdmFyIG9uZXJyb3IgPSByZXF1ZXN0Lm9uZXJyb3I7XG4gICAgdmFyIHNob3VsZENhbGxFcnJvckNhbGxiYWNrID0gb3B0aW9ucy5zaG91bGRDYWxsRXJyb3JDYWxsYmFjaztcbiAgICB2YXIgc2hvdWxkQ2FsbFN1Y2Nlc3NDYWxsYmFjayA9IG9wdGlvbnMuc2hvdWxkQ2FsbFN1Y2Nlc3NDYWxsYmFjaztcbiAgICB2YXIgdHJhbnNmb3JtRXJyb3IgPSBvcHRpb25zLnRyYW5zZm9ybUVycm9yO1xuICAgIHZhciB0cmFuc2Zvcm1SZXNwb25zZSA9IG9wdGlvbnMudHJhbnNmb3JtUmVzcG9uc2U7XG5cbiAgICB2YXIgZXJyb3IgPSBudWxsO1xuICAgIHZhciBjYWxsRXJyb3JDYWxsYmFjayA9IHRydWU7XG4gICAgdmFyIGNhbGxTdWNjZXNzQ2FsbGJhY2sgPSB0cnVlO1xuICAgIHZhciB0cmFuc2Zvcm1lZEVycm9yID0gbnVsbDtcbiAgICB2YXIgdHJhbnNmb3JtZWRSZXNwb25zZSA9IG51bGw7XG5cbiAgICBpZiAoY29kZSkge1xuICAgICAgICBpZiAocmVxdWVzdFR5cGUgPT09IEhUVFBfUkVRVUVTVCkge1xuICAgICAgICAgICAgZXJyb3IgPSBuZXcgSHR0cFJlc3BvbnNlRXJyb3IoY29kZSwgcmVxdWVzdCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBlcnJvciA9IG5ldyBKU09OUFJlc3BvbnNlRXJyb3IoY29kZSwgcmVxdWVzdCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGlzRnVuY3Rpb24odHJhbnNmb3JtRXJyb3IpKSB7XG4gICAgICAgICAgICB0cmFuc2Zvcm1lZEVycm9yID0gdHJhbnNmb3JtRXJyb3IocmVxdWVzdFR5cGUsIGVycm9yKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRyYW5zZm9ybWVkRXJyb3IgPSBlcnJvcjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaXNGdW5jdGlvbihzaG91bGRDYWxsRXJyb3JDYWxsYmFjaykpIHtcbiAgICAgICAgICAgIGNhbGxFcnJvckNhbGxiYWNrID0gc2hvdWxkQ2FsbEVycm9yQ2FsbGJhY2socmVxdWVzdFR5cGUsIHRyYW5zZm9ybWVkRXJyb3IsIGVycm9yKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2FsbEVycm9yQ2FsbGJhY2spIHtcbiAgICAgICAgICAgIGlmIChpc0Z1bmN0aW9uKG9uZXJyb3IpKSB7XG4gICAgICAgICAgICAgICAgb25lcnJvcih0cmFuc2Zvcm1lZEVycm9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChpc0Z1bmN0aW9uKHRyYW5zZm9ybVJlc3BvbnNlKSkge1xuICAgICAgICAgICAgdHJhbnNmb3JtZWRSZXNwb25zZSA9IHRyYW5zZm9ybVJlc3BvbnNlKHJlcXVlc3RUeXBlLCByZXNwb25zZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0cmFuc2Zvcm1lZFJlc3BvbnNlID0gcmVzcG9uc2U7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGlzRnVuY3Rpb24oc2hvdWxkQ2FsbFN1Y2Nlc3NDYWxsYmFjaykpIHtcbiAgICAgICAgICAgIGNhbGxTdWNjZXNzQ2FsbGJhY2sgPSBzaG91bGRDYWxsU3VjY2Vzc0NhbGxiYWNrKHJlcXVlc3RUeXBlLCB0cmFuc2Zvcm1lZFJlc3BvbnNlLCByZXNwb25zZSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNhbGxTdWNjZXNzQ2FsbGJhY2spIHtcbiAgICAgICAgICAgIGlmIChpc0Z1bmN0aW9uKG9uc3VjY2VzcykpIHtcbiAgICAgICAgICAgICAgICBvbnN1Y2Nlc3ModHJhbnNmb3JtZWRSZXNwb25zZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZmlyZUNhbGxiYWNrcztcbiIsInZhciBpc0Z1bmN0aW9uID0gcmVxdWlyZSgneC1jb21tb24tdXRpbHMvaXNGdW5jdGlvbicpO1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBwcm9jZXNzIHRoZSByZXF1ZXN0IG9wdGlvbnMuIFRoaXMgZnVuY3Rpb24gd2lsbCBjYWxsIHRoZSBmdW5jdGlvbiBgb3B0aW9ucy5oYW5kbGVPcHRpb25zYC5cbiAqXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcmV0dXJucyB7dm9pZH1cbiAqL1xuZnVuY3Rpb24gaGFuZGxlT3B0aW9ucyhvcHRpb25zKSB7XG4gICAgaWYgKGlzRnVuY3Rpb24ob3B0aW9ucy5oYW5kbGVPcHRpb25zKSkge1xuICAgICAgICBvcHRpb25zLmhhbmRsZU9wdGlvbnMob3B0aW9ucyk7XG4gICAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGhhbmRsZU9wdGlvbnM7XG4iLCIvKipcbiAqIE1ha2UgYFN1YkNsYXNzYCBleHRlbmQgYFN1cGVyQ2xhc3NgLlxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IFN1YkNsYXNzIFRoZSBzdWIgY2xhc3MgY29uc3RydWN0b3IuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBTdXBlckNsYXNzIFRoZSBzdXBlciBjbGFzcyBjb25zdHJ1Y3Rvci5cbiAqL1xuZnVuY3Rpb24gaW5oZXJpdHMoU3ViQ2xhc3MsIFN1cGVyQ2xhc3MpIHtcbiAgICB2YXIgRiA9IGZ1bmN0aW9uKCkge307XG5cbiAgICBGLnByb3RvdHlwZSA9IFN1cGVyQ2xhc3MucHJvdG90eXBlO1xuXG4gICAgU3ViQ2xhc3MucHJvdG90eXBlID0gbmV3IEYoKTtcbiAgICBTdWJDbGFzcy5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBTdWJDbGFzcztcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpbmhlcml0cztcbiIsIi8qKlxuICogVGhlIG5vIG9wZXJhdGlvbiBmdW5jdGlvbi5cbiAqL1xuZnVuY3Rpb24gbm9vcCgpIHtcbiAgICAvLyBub3RoaW5nIHRvIGRvIGhlcmUuXG59XG5cbm1vZHVsZS5leHBvcnRzID0gbm9vcDtcbiIsIi8qKlxuICogQSBzaW1wbGUgdGVtcGxhdGUgZnVuY3Rpb25cbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gUnJldHVybnMgJy9wb3N0LzEnXG4gKiB0ZW1wbGF0ZSgnL3Bvc3Qve3Bvc3RJZH0nLCB7IHBvc3RJZDogMSB9KVxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZW1wbGF0ZSBUaGUgdGVtcGxhdGUgdGV4dFxuICogQHBhcmFtIHtPYmplY3QuPHN0cmluZywgc3RyaW5nPn0gZGF0YSBUaGUgZGF0YSBvYmplY3RcbiAqIEByZXR1cm5zIHtzdHJpbmd9IFJldHVybnMgdGhlIGNvbXBpbGVkIHRleHRcbiAqL1xuZnVuY3Rpb24gdGVtcGxhdGUodGVtcGxhdGUsIGRhdGEpIHtcbiAgICB2YXIgc3RyID0gW107XG4gICAgdmFyIHJlcyA9IG51bGw7XG4gICAgdmFyIHJlZ2V4cCA9IC8oXnxbXlxcXFxdKVxceyhbXlxce1xcfV0qW15cXFxcXSk/XFx9LztcblxuICAgIC8vIG1ha2Ugc3VyZSB0aGF0IHRoZSB0eXBlIGlzIGNvcnJlY3RcbiAgICB0ZW1wbGF0ZSA9ICcnICsgdGVtcGxhdGU7XG4gICAgZGF0YSA9IGRhdGEgfHwge307XG5cbiAgICB3aGlsZSAoIHJlcyA9IHJlZ2V4cC5leGVjKHRlbXBsYXRlKSApIHtcbiAgICAgICAgdmFyIGluZGV4ID0gcmVzLmluZGV4O1xuICAgICAgICB2YXIgbWF0Y2ggPSByZXNbMF07XG4gICAgICAgIHZhciBwcmVmaXggPSByZXNbMV07XG4gICAgICAgIHZhciBrZXkgPSByZXNbMl07XG5cbiAgICAgICAgLy8gdHJpbSB3aGl0ZSBzcGFjZXNcbiAgICAgICAga2V5ID0gKGtleSB8fCAnJykucmVwbGFjZSgvXlxccyt8XFxzKyQvZywgJycpO1xuICAgICAgICAvLyBzYXZlIHRoZSBjb250ZW50IGJlZm9yZSB0aGUga2V5XG4gICAgICAgIHN0ci5wdXNoKCB0ZW1wbGF0ZS5zdWJzdHIoIDAsIGluZGV4ICsgcHJlZml4Lmxlbmd0aCApICk7XG4gICAgICAgIC8vIHJlYWQgdGhlIHZhbHVlIG9mIHRoZSBrZXlcbiAgICAgICAgc3RyLnB1c2goICcnICsgZGF0YVtrZXldICk7XG4gICAgICAgIC8vIHVwZGF0ZSB0aGUgdGVtcGxhdGVcbiAgICAgICAgdGVtcGxhdGUgPSB0ZW1wbGF0ZS5zdWJzdHIoIGluZGV4ICsgbWF0Y2gubGVuZ3RoICk7XG4gICAgICAgIC8vIHJlc2V0IGxhc3QgaW5kZXggbWFudWFsbHlcbiAgICAgICAgcmVnZXhwLmxhc3RJbmRleCA9IDA7XG4gICAgfVxuXG4gICAgLy8gc2F2ZSB0aGUgY29udGVudCBhZnRlciBsYXN0IGtleVxuICAgIHN0ci5wdXNoKHRlbXBsYXRlKTtcblxuICAgIC8vIHJlcGxhY2UgYFxce2AgYW5kIGBcXH1gIHdpdGggYHtgIGFuZCBgfWBcbiAgICBzdHIgPSBzdHIuam9pbignJyk7XG4gICAgc3RyID0gc3RyLnJlcGxhY2UoL1xcXFxcXHsvZywgJ3snKTtcbiAgICBzdHIgPSBzdHIucmVwbGFjZSgvXFxcXFxcfS9nLCAnfScpO1xuXG4gICAgcmV0dXJuIHN0cjtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gdGVtcGxhdGU7XG4iLCJ2YXIgaWQgPSAwO1xuXG4vKipcbiAqIFJldHVybnMgYSBudW1iZXIgdGhhdCBncmVhdGVyIHRoYW4gdGhlIHByaXZvdXMgb25lLCBzdGFydGluZyBmb3JtIGAxYC5cbiAqXG4gKiBAcmV0dXJucyB7bnVtYmVyfVxuICovXG5mdW5jdGlvbiB1dWlkKCkge1xuICAgIGlkICs9IDE7XG4gICAgcmV0dXJuIGlkO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHV1aWQ7XG4iLCJtb2R1bGUuZXhwb3J0cyA9ICcwLjAuMS1hbHBoYS4xJztcbiIsIi8qKlxuICogQ2hlY2sgd2hldGhlciB0aGUgdXJsIGlzIGFic29sdXRlIHVybC5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gdXJsIFRoZSB1cmwgc3RyaW5nIHRvIGNoZWNrXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIHVybCBpcyBhYm9zb2x1dGUsIG90aGVyd2lzZSBgZmFsc2VgIGlzIHJldHVybmVkXG4gKi9cbmZ1bmN0aW9uIGlzQWJzb2x1dGVVUkwodXJsKSB7XG4gICAgcmV0dXJuIC9eKD86W2Etel1bYS16MC05XFwtXFwuXFwrXSo6KT9cXC9cXC8vaS50ZXN0KHVybCk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaXNBYnNvbHV0ZVVSTDtcbiIsInZhciB0b1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG5cbi8qKlxuICogQ2hlY2sgd2hldGhlciB0aGUgdmFyaWFibGUgaXMgYW4gaW5zdGFuY2Ugb2YgYEFycmF5YFxuICpcbiAqIEBwYXJhbSB7YW55fSBpdCBUaGUgdmFyaWFibGUgdG8gY2hlY2tcbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgdmFyaWFibGUgaXMgYW4gaW5zdGFuY2Ugb2YgYEFycmF5YCwgb3RoZXJ3aXNlIGBmYWxzZWAgaXMgcmV0dXJuZWRcbiAqL1xuZnVuY3Rpb24gaXNBcnJheShpdCkge1xuICAgIHJldHVybiB0b1N0cmluZy5jYWxsKGl0KSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpc0FycmF5O1xuIiwidmFyIHRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcblxuLyoqXG4gKiBDaGVjayB3aGV0aGVyIHRoZSB2YXJpYWJsZSBpcyBhIGZ1bmN0aW9uXG4gKlxuICogQHBhcmFtIHthbnl9IGl0IFRoZSB2YXJpYWJsZSB0byBjaGVja1xuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSB2YXJpYWJsZSBpcyBhIGZ1bmN0aW9uLCBvdGhlcndpc2UgYGZhbHNlYCBpcyByZXR1cm5lZFxuICovXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGl0KSB7XG4gICAgcmV0dXJuIHRvU3RyaW5nLmNhbGwoaXQpID09PSAnW29iamVjdCBGdW5jdGlvbl0nO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGlzRnVuY3Rpb247XG4iLCJ2YXIgdG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xuXG4vKipcbiAqIENoZWNrIHdoZXRoZXIgdGhlIHZhcmlhYmxlIGlzIGEgcGxhaW4gb2JqZWN0LlxuICpcbiAqIEBwYXJhbSB7YW55fSBpdCBUaGUgdmFyaWFibGUgdG8gY2hlY2tcbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgdmFyaWFibGUgaXMgYSBwbGFpbiBvYmplY3QsIG90aGVyd2lzZSBgZmFsc2VgIGlzIHJldHVybmVkXG4gKi9cbmZ1bmN0aW9uIGlzUGxhaW5PYmplY3QoaXQpIHtcbiAgICBpZiAoIWl0KSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgaXQgPT09IHdpbmRvdykge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBnbG9iYWwgIT09ICd1bmRlZmluZWQnICYmIGl0ID09PSBnbG9iYWwpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB0b1N0cmluZy5jYWxsKGl0KSA9PT0gJ1tvYmplY3QgT2JqZWN0XSc7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaXNQbGFpbk9iamVjdDtcbiIsInZhciBpc0FycmF5ID0gcmVxdWlyZSgnLi9pc0FycmF5Jyk7XG52YXIgaXNQbGFpbk9iamVjdCA9IHJlcXVpcmUoJy4vaXNQbGFpbk9iamVjdCcpO1xudmFyIGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG52YXIgc2xpY2UgPSBBcnJheS5wcm90b3R5cGUuc2xpY2U7XG5cbi8qKlxuICogQ29weSB0aGUgbm9uLXVuZGVmaW5lZCB2YWx1ZXMgb2Ygc291cmNlIHRvIHRhcmdldC4gT3ZlcndyaXRlIHRoZSBvcmlnaW5hbCB2YWx1ZXMuXG4gKiBUaGlzIGZ1bmN0aW9uIHdpbGwgbW9kaWZ5IHRoZSB0YXJnZXRcbiAqXG4gKiBAcGFyYW0ge09iamVjdC48c3RyaW5nLCAqPnxhbnlbXX0gdGFyZ2V0IFRoZSB0YXJnZXQgb2JqZWN0IG9yIGFycmF5XG4gKiBAcGFyYW0ge09iamVjdC48c3RyaW5nLCAqPnxhbnlbXX0gc291cmNlIFRoZSBzb3VyY2Ugb2JqZWN0IG9yIGFycmF5XG4gKiBAcmV0dXJucyB7T2JqZWN0LjxzdHJpbmcsICo+fGFueVtdfSBSZXR1cm5zIHRoZSBleHRlbmRlZCB0YXJnZXQgb2JqZWN0IG9yIGFycmF5XG4gKi9cbmZ1bmN0aW9uIGV4dGVuZCh0YXJnZXQsIHNvdXJjZSkge1xuICAgIHZhciBrZXksIHZhbDtcblxuICAgIGlmICggdGFyZ2V0ICYmICggaXNBcnJheShzb3VyY2UpIHx8IGlzUGxhaW5PYmplY3Qoc291cmNlKSApICkge1xuICAgICAgICBmb3IgKCBrZXkgaW4gc291cmNlICkge1xuICAgICAgICAgICAgaWYgKCBoYXNPd24uY2FsbChzb3VyY2UsIGtleSkgKSB7XG4gICAgICAgICAgICAgICAgdmFsID0gc291cmNlW2tleV07XG4gICAgICAgICAgICAgICAgaWYgKHZhbCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICggaXNQbGFpbk9iamVjdCh2YWwpICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCAhIGlzUGxhaW5PYmplY3QodGFyZ2V0W2tleV0pICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldFtrZXldID0ge307XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBtZXJnZSh0YXJnZXRba2V5XSwgdmFsKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICggaXNBcnJheSh2YWwpICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCAhIGlzQXJyYXkodGFyZ2V0W2tleV0pICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldFtrZXldID0gW107XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBtZXJnZSh0YXJnZXRba2V5XSwgdmFsKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldFtrZXldID0gdmFsO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRhcmdldDtcbn1cblxuLyoqXG4gKiBDb3B5IGFueSBub24tdW5kZWZpbmVkIHZhbHVlcyBvZiBzb3VyY2UgdG8gdGFyZ2V0IGFuZCBvdmVyd3JpdGVzIHRoZSBjb3JyZXNwb25kaW5nIG9yaWdpbmFsIHZhbHVlcy4gVGhpcyBmdW5jdGlvblxuICogd2lsbCBtb2RpZnkgdGhlIHRhcmdldCBvYmplY3QuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHRhcmdldCBUaGUgdGFyZ2V0IG9iamVjdFxuICogQHBhcmFtIHsuLi5PYmplY3R9IGFyZ3MgVGhlIHNvdXJjZSBvYmplY3RcbiAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgdGhlIG1vZGlmaWVkIHRhcmdldCBvYmplY3RcbiAqL1xuZnVuY3Rpb24gbWVyZ2UodGFyZ2V0LCBhcmdzKSB7XG4gICAgdmFyIGkgPSAwO1xuICAgIHZhciBsID0gYXJndW1lbnRzLmxlbmd0aCAtIDE7XG5cbiAgICBhcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuXG4gICAgZm9yIChpID0gMDsgaSA8IGw7IGkgKz0gMSkge1xuICAgICAgICBleHRlbmQodGFyZ2V0LCBhcmdzW2ldKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGFyZ2V0O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IG1lcmdlO1xuIiwidmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcbnZhciBpc0FycmF5ID0gdXRpbC5pc0FycmF5O1xuXG4vKipcbiAqIERlY29kZSB0aGUgVVJJIENvbXBvbmVudCBlbmNvZGVkIHF1ZXJ5IHN0cmluZyB0byBvYmplY3RcbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gVGhlIFVSSSBDb21wb25lbnQgZW5jb2RlZCBxdWVyeSBzdHJpbmdcbiAqIEByZXR1cm5zIHtPYmplY3QuPHN0cmluZywgc3RyaW5nPn0gUmV0dXJucyB0aGUgZGVjb2RlZCBvYmplY3RcbiAqL1xudmFyIGRlY29kZSA9IGZ1bmN0aW9uIChzdHJpbmcpIHtcbiAgICB2YXIgb2JqZWN0ID0ge307XG4gICAgdmFyIGNhY2hlID0ge307XG4gICAgdmFyIGtleVZhbHVlQXJyYXk7XG4gICAgdmFyIGluZGV4O1xuICAgIHZhciBsZW5ndGg7XG4gICAgdmFyIGtleVZhbHVlO1xuICAgIHZhciBrZXk7XG4gICAgdmFyIHZhbHVlO1xuXG4gICAgLy8gZG8gbm90IGRlY29kZSBlbXB0eSBzdHJpbmcgb3Igc29tZXRoaW5nIHRoYXQgaXMgbm90IHN0cmluZ1xuICAgIGlmIChzdHJpbmcgJiYgdHlwZW9mIHN0cmluZyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAga2V5VmFsdWVBcnJheSA9IHN0cmluZy5zcGxpdCgnJicpO1xuICAgICAgICBpbmRleCA9IDA7XG4gICAgICAgIGxlbmd0aCA9IGtleVZhbHVlQXJyYXkubGVuZ3RoO1xuXG4gICAgICAgIHdoaWxlIChpbmRleCA8IGxlbmd0aCkge1xuICAgICAgICAgICAga2V5VmFsdWUgPSBrZXlWYWx1ZUFycmF5W2luZGV4XS5zcGxpdCgnPScpO1xuICAgICAgICAgICAga2V5ID0gZGVjb2RlVVJJQ29tcG9uZW50KGtleVZhbHVlWzBdKTtcbiAgICAgICAgICAgIHZhbHVlID0ga2V5VmFsdWVbMV07XG5cbiAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgdmFsdWUgPSBkZWNvZGVVUklDb21wb25lbnQodmFsdWUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IG51bGw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGRlY29kZUtleShvYmplY3QsIGNhY2hlLCBrZXksIHZhbHVlKTtcblxuICAgICAgICAgICAgaW5kZXggKz0gMTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBvYmplY3Q7XG59O1xuXG4vKipcbiAqIERlY29kZSB0aGUgc3BlY2VmaWVkIGtleVxuICpcbiAqIEBwYXJhbSB7T2JqZWN0LjxzdHJpbmcsIHN0cmluZz59IG9iamVjdCBUaGUgb2JqZWN0IHRvIGhvbGQgdGhlIGRlY29kZWQgZGF0YVxuICogQHBhcmFtIHtPYmplY3QuPHN0cmluZywgKj59IGNhY2hlIFRoZSBvYmplY3QgdG8gaG9sZCBjYWNoZSBkYXRhXG4gKiBAcGFyYW0ge3N0cmluZ30ga2V5IFRoZSBrZXkgbmFtZSB0byBkZWNvZGVcbiAqIEBwYXJhbSB7YW55fSB2YWx1ZSBUaGUgdmFsdWUgdG8gZGVjb2RlXG4gKi9cbnZhciBkZWNvZGVLZXkgPSBmdW5jdGlvbiAob2JqZWN0LCBjYWNoZSwga2V5LCB2YWx1ZSkge1xuICAgIHZhciByQnJhY2tldCA9IC9cXFsoW15cXFtdKj8pP1xcXSQvO1xuICAgIHZhciBySW5kZXggPSAvKF4wJCl8KF5bMS05XVxcZCokKS87XG4gICAgdmFyIGluZGV4T3JLZXlPckVtcHR5O1xuICAgIHZhciBwYXJlbnRLZXk7XG4gICAgdmFyIGFycmF5T3JPYmplY3Q7XG4gICAgdmFyIGtleUlzSW5kZXg7XG4gICAgdmFyIGtleUlzRW1wdHk7XG4gICAgdmFyIHZhbHVlSXNJbkFycmF5O1xuICAgIHZhciBkYXRhQXJyYXk7XG4gICAgdmFyIGxlbmd0aDtcblxuICAgIC8vIGNoZWNrIHdoZXRoZXIga2V5IGlzIHNvbWV0aGluZyBsaWtlIGBwZXJzb25bbmFtZV1gIG9yIGBjb2xvcnNbXWAgb3JcbiAgICAvLyBgY29sb3JzWzFdYFxuICAgIGlmICggckJyYWNrZXQudGVzdChrZXkpICkge1xuICAgICAgICBpbmRleE9yS2V5T3JFbXB0eSA9IFJlZ0V4cC4kMTtcbiAgICAgICAgcGFyZW50S2V5ID0ga2V5LnJlcGxhY2UockJyYWNrZXQsICcnKTtcbiAgICAgICAgYXJyYXlPck9iamVjdCA9IGNhY2hlW3BhcmVudEtleV07XG5cbiAgICAgICAga2V5SXNJbmRleCA9IHJJbmRleC50ZXN0KGluZGV4T3JLZXlPckVtcHR5KTtcbiAgICAgICAga2V5SXNFbXB0eSA9IGluZGV4T3JLZXlPckVtcHR5ID09PSAnJztcbiAgICAgICAgdmFsdWVJc0luQXJyYXkgPSBrZXlJc0luZGV4IHx8IGtleUlzRW1wdHk7XG5cbiAgICAgICAgaWYgKGFycmF5T3JPYmplY3QpIHtcbiAgICAgICAgICAgIC8vIGNvbnZlcnQgdGhlIGFycmF5IHRvIG9iamVjdFxuICAgICAgICAgICAgaWYgKCAoISB2YWx1ZUlzSW5BcnJheSkgJiYgaXNBcnJheShhcnJheU9yT2JqZWN0KSApIHtcbiAgICAgICAgICAgICAgICBkYXRhQXJyYXkgPSBhcnJheU9yT2JqZWN0O1xuICAgICAgICAgICAgICAgIGxlbmd0aCA9IGRhdGFBcnJheS5sZW5ndGg7XG4gICAgICAgICAgICAgICAgYXJyYXlPck9iamVjdCA9IHt9O1xuXG4gICAgICAgICAgICAgICAgd2hpbGUgKGxlbmd0aC0tKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChhcnJheU9yT2JqZWN0W2xlbmd0aF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXJyYXlPck9iamVjdFtsZW5ndGhdID0gZGF0YUFycmF5W2xlbmd0aF07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhcnJheU9yT2JqZWN0ID0gdmFsdWVJc0luQXJyYXkgPyBbXSA6IHt9O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCBrZXlJc0VtcHR5ICYmIGlzQXJyYXkoYXJyYXlPck9iamVjdCkgKSB7XG4gICAgICAgICAgICBhcnJheU9yT2JqZWN0LnB1c2godmFsdWUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gYXJyYXlPck9iamVjdCBpcyBhcnJheSBvciBvYmplY3QgaGVyZVxuICAgICAgICAgICAgYXJyYXlPck9iamVjdFtpbmRleE9yS2V5T3JFbXB0eV0gPSB2YWx1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNhY2hlW3BhcmVudEtleV0gPSBhcnJheU9yT2JqZWN0O1xuXG4gICAgICAgIGRlY29kZUtleShvYmplY3QsIGNhY2hlLCBwYXJlbnRLZXksIGFycmF5T3JPYmplY3QpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG9iamVjdFtrZXldID0gdmFsdWU7XG4gICAgfVxufTtcblxuZXhwb3J0cy5kZWNvZGUgPSBkZWNvZGU7XG4iLCJ2YXIgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpO1xudmFyIGlzQXJyYXkgPSB1dGlsLmlzQXJyYXk7XG52YXIgaXNPYmplY3QgPSB1dGlsLmlzT2JqZWN0O1xudmFyIGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG5cbi8qKlxuICogRW5jb2RlIHRoZSBnaXZlbiBvYmplY3QgdG8gVVJJIENvbXBvbmVudCBlbmNvZGVkIHF1ZXJ5IHN0cmluZ1xuICpcbiAqIEBwYXJhbSB7T2JqZWN0LjxzdHJpbmcsICo+fSBvYmplY3QgVGhlIG9iamVjdCB0byBlbmNvZGVcbiAqIEBwYXJhbSB7Ym9vbGVhbn0gW2tlZXBBcnJheUluZGV4XSBXaGV0aGVyIHRvIGtlZXAgYXJyYXkgaW5kZXhcbiAqIEByZXR1cm5zIHtzdHJpbmd9IFJldHVybnMgdGhlIFVSSSBDb21wb25lbnQgZW5jb2RlZCBxdWVyeSBzdHJpbmdcbiAqL1xudmFyIGVuY29kZSA9IGZ1bmN0aW9uIChvYmplY3QsIGtlZXBBcnJheUluZGV4KSB7XG4gICAgdmFyIGtleTtcbiAgICB2YXIga2V5VmFsdWVBcnJheSA9IFtdO1xuXG4gICAga2VlcEFycmF5SW5kZXggPSAhIWtlZXBBcnJheUluZGV4O1xuXG4gICAgaWYgKCBpc09iamVjdChvYmplY3QpICkge1xuICAgICAgICBmb3IgKCBrZXkgaW4gb2JqZWN0ICkge1xuICAgICAgICAgICAgaWYgKCBoYXNPd24uY2FsbChvYmplY3QsIGtleSkgKSB7XG4gICAgICAgICAgICAgICAgZW5jb2RlS2V5KGtleSwgb2JqZWN0W2tleV0sIGtleVZhbHVlQXJyYXksIGtlZXBBcnJheUluZGV4KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBrZXlWYWx1ZUFycmF5LmpvaW4oJyYnKTtcbn07XG5cblxuLyoqXG4gKiBFbmNvZGUgdGhlIHNwZWNlaWZlZCBrZXkgaW4gdGhlIG9iamVjdFxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgVGhlIGtleSBuYW1lXG4gKiBAcGFyYW0ge2FueX0gZGF0YSBUaGUgZGF0YSBvZiB0aGUga2V5XG4gKiBAcGFyYW0ge3N0cmluZ1tdfSBrZXlWYWx1ZUFycmF5IFRoZSBhcnJheSB0byBzdG9yZSB0aGUga2V5IHZhbHVlIHN0cmluZ1xuICogQHBhcmFtIHtib29sZWFufSBrZWVwQXJyYXlJbmRleCBXaGV0aGVyIHRvIGtlZXAgYXJyYXkgaW5kZXhcbiAqL1xudmFyIGVuY29kZUtleSA9IGZ1bmN0aW9uIChrZXksIGRhdGEsIGtleVZhbHVlQXJyYXksIGtlZXBBcnJheUluZGV4KSB7XG4gICAgdmFyIHByb3A7XG4gICAgdmFyIGluZGV4O1xuICAgIHZhciBsZW5ndGg7XG4gICAgdmFyIHZhbHVlO1xuICAgIHZhciBzdWJLZXk7XG5cbiAgICBpZiAoIGlzT2JqZWN0KGRhdGEpICkge1xuICAgICAgICBmb3IgKCBwcm9wIGluIGRhdGEgKSB7XG4gICAgICAgICAgICBpZiAoIGhhc093bi5jYWxsKGRhdGEsIHByb3ApICkge1xuICAgICAgICAgICAgICAgIHZhbHVlID0gZGF0YVtwcm9wXTtcbiAgICAgICAgICAgICAgICBzdWJLZXkgPSBrZXkgKyAnWycgKyBwcm9wICsgJ10nO1xuICAgICAgICAgICAgICAgIGVuY29kZUtleShzdWJLZXksIHZhbHVlLCBrZXlWYWx1ZUFycmF5LCBrZWVwQXJyYXlJbmRleCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKCBpc0FycmF5KGRhdGEpICkge1xuICAgICAgICBpbmRleCA9IDA7XG4gICAgICAgIGxlbmd0aCA9IGRhdGEubGVuZ3RoO1xuXG4gICAgICAgIHdoaWxlIChpbmRleCA8IGxlbmd0aCkge1xuICAgICAgICAgICAgdmFsdWUgPSBkYXRhW2luZGV4XTtcblxuICAgICAgICAgICAgaWYgKCBrZWVwQXJyYXlJbmRleCB8fCBpc0FycmF5KHZhbHVlKSB8fCBpc09iamVjdCh2YWx1ZSkgKSB7XG4gICAgICAgICAgICAgICAgc3ViS2V5ID0ga2V5ICsgJ1snICsgaW5kZXggKyAnXSc7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHN1YktleSA9IGtleSArICdbXSc7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGVuY29kZUtleShzdWJLZXksIHZhbHVlLCBrZXlWYWx1ZUFycmF5LCBrZWVwQXJyYXlJbmRleCk7XG5cbiAgICAgICAgICAgIGluZGV4ICs9IDE7XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICBrZXkgPSBlbmNvZGVVUklDb21wb25lbnQoa2V5KTtcbiAgICAgICAgLy8gaWYgZGF0YSBpcyBudWxsLCBubyBgPWAgaXMgYXBwZW5kZWRcbiAgICAgICAgaWYgKGRhdGEgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHZhbHVlID0ga2V5O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gaWYgZGF0YSBpcyB1bmRlZmluZWQsIHRyZWF0IGl0IGFzIGVtcHR5IHN0cmluZ1xuICAgICAgICAgICAgaWYgKGRhdGEgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGRhdGEgPSAnJztcbiAgICAgICAgICAgIC8vIG1ha2Ugc3VyZSB0aGF0IGRhdGEgaXMgc3RyaW5nXG4gICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBkYXRhICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIGRhdGEgPSAnJyArIGRhdGE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YWx1ZSA9IGtleSArICc9JyArIGVuY29kZVVSSUNvbXBvbmVudChkYXRhKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGtleVZhbHVlQXJyYXkucHVzaCh2YWx1ZSk7XG4gICAgfVxufTtcblxuZXhwb3J0cy5lbmNvZGUgPSBlbmNvZGU7XG4iLCJ2YXIgZW5jb2RlID0gcmVxdWlyZSgnLi9lbmNvZGUnKS5lbmNvZGU7XG52YXIgZGVjb2RlID0gcmVxdWlyZSgnLi9kZWNvZGUnKS5kZWNvZGU7XG5cbmV4cG9ydHMuZW5jb2RlID0gZW5jb2RlO1xuZXhwb3J0cy5kZWNvZGUgPSBkZWNvZGU7XG5leHBvcnRzLnZlcnNpb24gPSAnMS4xLjInO1xuIiwidmFyIHRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcblxuLyoqXG4gKiBDaGVjayB3aGV0aGVyIHRoZSB2YXJpYWJsZSBpcyBhbiBhcnJheVxuICpcbiAqIEBwYXJhbSB7YW55fSBpdCBUaGUgdmFyaWFibGUgdG8gY2hlY2tcbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBpdCBpcyBhbiBhcnJheVxuICovXG52YXIgaXNBcnJheSA9IGZ1bmN0aW9uIChpdCkge1xuICAgIHJldHVybiAnW29iamVjdCBBcnJheV0nID09PSB0b1N0cmluZy5jYWxsKGl0KTtcbn07XG5cbi8qKlxuICogQ2hlY2sgd2hldGhlciB0aGUgdmFyaWFibGUgaXMgYW4gb2JqZWN0XG4gKlxuICogQHBhcmFtIHthbnl9IGl0IFRoZSB2YXJpYWJsZSB0byBjaGVja1xuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGl0IGlzIGFuIG9iamVjdFxuICovXG52YXIgaXNPYmplY3QgPSBmdW5jdGlvbiAoaXQpIHtcbiAgICByZXR1cm4gJ1tvYmplY3QgT2JqZWN0XScgPT09IHRvU3RyaW5nLmNhbGwoaXQpO1xufTtcblxuZXhwb3J0cy5pc0FycmF5ID0gaXNBcnJheTtcbmV4cG9ydHMuaXNPYmplY3QgPSBpc09iamVjdDtcbiJdfQ==
