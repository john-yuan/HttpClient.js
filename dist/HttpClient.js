(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.HttpClient = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
var isFunction = require(38);

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
                    });
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

},{"38":38}],2:[function(require,module,exports){
var QS = require(43);
var merge = require(40);
var isFunction = require(38);
var isPlainObject = require(39);
var isAbsoluteURL = require(36);
var uuid = require(35);
var noop = require(33);
var template = require(34);
var inherits = require(32);
var constants = require(25);
var defineExports = require(28);
var createDefaultOptions = require(27);
var createCancelController = require(26);
var Request = require(9);
var HttpRequest = require(3);
var JSONPRequest = require(6);
var Response = require(10);
var HttpResponse = require(4);
var JSONPResponse = require(7);
var ResponseError = require(11);
var HttpResponseError = require(5);
var JSONPResponseError = require(8);
var CancelController = require(1);
var version = '0.0.1-alpha.5';

/**
 * @class
 *
 * @param {RequestOptions} [defaults] The default options to use when sending requests with the created http client.
 * This default options will be merged into the internal default options that `createDefaultOptions()` returns.
 *
 * @param {HandleOptionsFunction} [handleDefaults] The handler function to process the merged default options. The
 * merged default options will be passed into the function as the first argument. You can make changes to it as you
 * want. This function must return synchronously. The return value of this function is ignored.
 *
 * @param {HandleOptionsFunction} [handleRequestOptions] The handler function to process each merged request options.
 * Every options that passed into `send`, `fetch`, `getJSONP`, `fetchJSONP` will be processed by this handler function.
 */
function HttpClient(defaults, handleDefaults, handleRequestOptions) {
    var defaultOptions = createDefaultOptions();

    if (isPlainObject(defaults)) {
        merge(defaultOptions, defaults);
    }

    if (isFunction(handleDefaults)) {
        handleDefaults(defaultOptions);
        // Deep copy the chagned options
        defaultOptions = merge({}, defaultOptions);
    }

    if (!isFunction(handleRequestOptions)) {
        handleRequestOptions = noop;
    }

    /**
     * Get a copy of the default request options. This function is NOT available on the prototype of `HttpClient`.
     *
     * @returns {RequestOptions}
     */
    this.copyOptions = function () {
        return merge({}, defaultOptions);
    };

    /**
     * Merge the request options with the default request options. This function is NOT available on the prototype of
     * `HttpClient` and will call `handleRequestOptions` to handle the merged request options.
     *
     * @param {RequestOptions} options The request options to merge.
     * @returns {RequestOptions} Returns the merged request options.
     */
    this.mergeOptions = function (options) {
        var requestOptions = merge({}, defaultOptions, options);

        handleRequestOptions(requestOptions);

        return requestOptions;
    };
}

/**
 * Send an http request.
 *
 * @param {RequestOptions} options The request options to use, which will be merged into a copy of the default options.
 * @param {RequestSuccessCallback} onsuccess The callback to call on success.
 * @param {RequestErrorCallback} onerror The callback to call on error.
 * @returns {HttpRequest} Returns an instance of `HttpRequest`.
 */
HttpClient.prototype.send = function (options, onsuccess, onerror) {
    var requestOptions = this.mergeOptions(options);

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
    var requestOptions = this.mergeOptions(options);
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
    var requestOptions = this.mergeOptions(options);

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
    var requestOptions = this.mergeOptions(options);
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

defineExports(HttpClient, 'constants', merge({}, constants));

defineExports(HttpClient, 'libs', {
    QS: QS
});

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

module.exports = HttpClient;

/**
 * This callback is used to hanlde the merged request options. It must retrun the result synchronously.
 *
 * @callback HandleOptionsFunction
 * @param {RequestOptions} options The merged request options.
 * @returns {void}
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
 * data that passed in with `options.model`.
 *
 * @property {Object.<string, *>} [model] The data used to compile the request url.
 *
 * @property {Object.<string, *>} [query] The data that will be compiled to query string.
 *
 * @property {Object.<string, *>} [body] The object that contains the content which will be send to the server. This
 * object has only one property. The name of the property is the content type of the content, which will be used to find
 * a processor in `options.httpRequestBodyProcessor`. The processor is used to process the value of the property. The
 * processed value which the processor returns will be send to the server as the request body.
 *
 * @property {number} [timeout] The number of milliseconds the request can take before it finished. If the timeout value
 * is `0`, no timer will be set. If the request does not finsihed within the given time, a timeout error will be thrown.
 * The default value is `0`.
 *
 * @property {boolean} [cors] Whether to set `withCredentials` property of the `XMLHttpRequest` to `true`. The default
 * value is `false`.
 *
 * @property {boolean} [noCache] Whether to disable the cache. If the value is `true`, the headers in
 * `options.noCacheHeaders` will be set. The default value is `false`.
 *
 * @property {Object.<string, *>} [noCacheHeaders] The headers to set when `options.noCache` is set to `true`.
 *
 * @property {string} [jsonp] The query string key to hold the value of the callback name when sending JSONP request.
 * The default values is `callback`.
 *
 * @property {Object.<string, *>} [settings] The object to keep the settings information that the user passed in. The
 * library itself will not touch this property. You can use this property to hold any information that you want, when
 * you extend the functionality of your own instance of `HttpClient`. The default value of this property is an empty
 * object.
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
 * @property {Object.<string, *>} [xhrProps] The object that contains the properties to set on the instance of the
 * `XMLHttpRequest`.
 *
 * @property {string} [username] The user name to use for authentication purposes. The defualt value is `null`.
 *
 * @property {string} [password] The password to use for authentication purposes. The defualt value is `null`.
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

},{"1":1,"10":10,"11":11,"25":25,"26":26,"27":27,"28":28,"3":3,"32":32,"33":33,"34":34,"35":35,"36":36,"38":38,"39":39,"4":4,"40":40,"43":43,"5":5,"6":6,"7":7,"8":8,"9":9}],3:[function(require,module,exports){
var Request = require(9);
var constants = require(25);
var inherits = require(32);
var buildURL = require(23);
var handleOptions = require(30);
var callRequestCreatedCallback = require(24);
var addEventListeners = require(12);
var handleXhrProps = require(17);
var handleHeaders = require(15);
var handleRequestBody = require(16);
var callXhrHook = require(14);

/**
 * http request.
 *
 * @class
 * @extends {Request}
 * @param {RequestOptions} options The request options.
 * @param {RequestSuccessCallback} onsuccess The callback to call on success.
 * @param {RequestErrorCallback} onerror The callback to call on error.
 */
function HttpRequest(options, onsuccess, onerror) {
    var xhr;
    var body;
    var url;

    // Call the super constructor.
    Request.call(this, constants.HTTP_REQUEST, options, onsuccess, onerror);

    // Call `options.handleOptions` to handle options.
    handleOptions(options);

    xhr = this.xhr = options.createXHR.call(null, options);
    body = handleRequestBody(options);
    url = buildURL(options);

    // Set properties to the xhr.
    handleXhrProps(xhr, options);

    // Call onXhrCreated.
    callXhrHook(options.onXhrCreated, xhr, options);

    // Open the request.
    xhr.open(options.method || 'GET', url, true, options.username, options.password);

    // Add event listeners.
    addEventListeners(this);

    // Call onXhrOpened.
    callXhrHook(options.onXhrOpened, xhr, options);

    // Hanlde headers.
    handleHeaders(xhr, options);

    // Send the body to the server.
    xhr.send(body);

    // Call onXhrSent.
    callXhrHook(options.onXhrSent, xhr, options);

    // Call onRequestCreated
    callRequestCreatedCallback(options, this);
}

inherits(HttpRequest, Request);

module.exports = HttpRequest;

},{"12":12,"14":14,"15":15,"16":16,"17":17,"23":23,"24":24,"25":25,"30":30,"32":32,"9":9}],4:[function(require,module,exports){
/**
 * HttpResponse module.
 *
 * @module class/HttpResponse
 */

var Response = require(10);
var inherits = require(32);
var addCustomParser = require(22);

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

},{"10":10,"22":22,"32":32}],5:[function(require,module,exports){
var ResponseError = require(11);
var inherits = require(32);
var addCustomParser = require(22);

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

},{"11":11,"22":22,"32":32}],6:[function(require,module,exports){
var Request = require(9);
var constants = require(25);
var inherits = require(32);
var handleOptions = require(30);
var callRequestCreatedCallback = require(24);
var addEventListeners = require(18);
var buildCallbackName = require(19);
var handleScriptCors = require(21);
var buildScriptSrc = require(20);

/**
 * JSONP request.
 *
 * @class
 * @extends {Request}
 * @param {RequestOptions} options The request options.
 * @param {RequestSuccessCallback} onsuccess The callback to call on success.
 * @param {RequestErrorCallback} onerror The callback to call on error.
 */
function JSONPRequest(options, onsuccess, onerror) {
    var src;
    var script;
    var callbackName;
    var containerNode;

    Request.call(this, constants.JSONP_REQUEST, options, onsuccess, onerror);

    // Call `options.handleOptions` to handle options.
    handleOptions(options);

    script = this.script = options.createScript.call(null, options);
    containerNode = options.jsonpContainerNode.call(null, options);
    callbackName = buildCallbackName(options);
    src = buildScriptSrc(options, callbackName);

    // Set the src attribute.
    script.setAttribute('src', src);

    // Handle `options.cors`.
    handleScriptCors(script, options);

    // Add event listeners.
    addEventListeners(this, callbackName);

    // Inject the script node.
    containerNode.appendChild(script);

    // Call onRequestCreated.
    callRequestCreatedCallback(options, this);
}

inherits(JSONPRequest, Request);

module.exports = JSONPRequest;

},{"18":18,"19":19,"20":20,"21":21,"24":24,"25":25,"30":30,"32":32,"9":9}],7:[function(require,module,exports){
/**
 * JSONPResponse module.
 *
 * @module class/JSONPResponse
 */

var Response = require(10);
var inherits = require(32);
var addCustomParser = require(22);

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

},{"10":10,"22":22,"32":32}],8:[function(require,module,exports){
var ResponseError = require(11);
var inherits = require(32);
var addCustomParser = require(22);

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

},{"11":11,"22":22,"32":32}],9:[function(require,module,exports){
var uuid = require(35);

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
     * If there is an error happend, the `error` is a string reprsengting the type of the error. If there is no
     * error, the value of `error` is `null`.
     */
    this.error = null;

    /**
     * The `XMLHttpRequest` we use when sending http request.
     */
    this.xhr = null;

    /**
     * The `HTMLScriptElement` we use when sending JSONP request.
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
    this.options = options;

    /**
     * The name of the function that create this request. Can be `send`, `fetch`, `getJOSNP`, `fetchJSONP`. This value
     * is set by the libray itself.
     */
    this.requestFunctionName = options.requestFunctionName;

    /**
     * The `CancelController` that used to cancel this request. We never use this property internally, just holding the
     * information in case that the user needs.
     */
    this.controller = options.controller || null;

    /**
     * The callback to call on success.
     */
    this.onsuccess = onsuccess || null;

    /**
     * The callback to call on error.
     */
    this.onerror = onerror || null;

    /**
     * Set the request type back.
     */
    options.requestType = type;
}

module.exports = Request;

},{"35":35}],10:[function(require,module,exports){
/**
 * Represents a response.
 *
 * @param {Request} request The instance of `Request`.
 */
function Response(request) {
    /**
     * @type {Request}
     */
    this.request = request;
}

module.exports = Response;

},{}],11:[function(require,module,exports){
var errorMessages = {
    ERR_ABORTED: 'Request aborted',
    ERR_CANCELLED: 'Request cancelled',
    ERR_NETWORK: 'Network error',
    ERR_RESPONSE: 'Response error',
    ERR_TIMEOUT: 'Request timeout'
};

/**
 * Represents response error.
 *
 * @constructor
 * @param {string} code The error code.
 * @param {Request} request The request.
 */
function ResponseError(code, request) {
    var message;

    code = code || 'ERR_UNKNOWN';

    if (errorMessages[code]) {
        message = errorMessages[code];
    }

    if (!message) {
        message = 'Unknown error ' + code;
    }

    request.error = code;

    this.code = code;
    this.request = request;
    this.message = message;
}

module.exports = ResponseError;

},{}],12:[function(require,module,exports){
var isFunction = require(38);
var HttpResponse = require(4);
var addTimeoutListener = require(13);
var fireCallbacks = require(29);
var noop = require(33);
var constants = require(25);
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
    var timeout = parseInt(options.timeout, 10) || 0;

    /**
     * Cancel the request.
     */
    var cancel = function () {
        clearEvents();
        if (xhr.abort) {
            try {
                xhr.abort();
            } catch (e) {
                // empty
            }
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
        if (+xhr.readyState === 4) {
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
     * Cancel the request.
     */
    request.cancel = function () {
        cancel();
    };

    // Add timeout listener
    if (timeout > 0) {
        clearTimeoutEvent = addTimeoutListener(xhr, timeout, function () {
            clearEvents();
            if (xhr.abort) {
                try {
                    xhr.abort();
                } catch (e) {
                    // empty
                }
            }
            finish(ERR_TIMEOUT);
        });
    }
}

module.exports = addEventListeners;

},{"13":13,"25":25,"29":29,"33":33,"38":38,"4":4}],13:[function(require,module,exports){
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

},{}],14:[function(require,module,exports){
var isFunction = require(38);

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

},{"38":38}],15:[function(require,module,exports){
var merge = require(40);
var isPlainObject = require(39);
var hasOwn = require(31);

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

},{"31":31,"39":39,"40":40}],16:[function(require,module,exports){
var merge = require(40);
var isFunction = require(38);
var isPlainObject = require(39);
var hasOwn = require(31);

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
                headers = merge({}, contentProcessor.headers, headers);
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

},{"31":31,"38":38,"39":39,"40":40}],17:[function(require,module,exports){
var isPlainObject = require(39);
var hasOwn = require(31);

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

},{"31":31,"39":39}],18:[function(require,module,exports){
var isFunction = require(38);
var JSONPResponse = require(7);
var fireCallbacks = require(29);
var noop = require(33);
var constants = require(25);
var ERR_CANCELLED = constants.ERR_CANCELLED;
var ERR_NETWORK   = constants.ERR_NETWORK;
var ERR_RESPONSE  = constants.ERR_RESPONSE;
var ERR_TIMEOUT   = constants.ERR_TIMEOUT;

/**
 * Add event listeners to JSONP request.
 *
 * @param {JSONPRequest} request The JSONP request.
 * @param {string} callbackName The callback name used to define the global JSONP callback.
 */
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
        request.responseJSON = responseJSON;
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

    /**
     * Cancel the request.
     */
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

},{"25":25,"29":29,"33":33,"38":38,"7":7}],19:[function(require,module,exports){
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

},{}],20:[function(require,module,exports){
var buildURL = require(23);

/**
 * Build the JSONP script src.
 *
 * @param {RequestOptions} options The request opitons.
 * @param {string} callbackName The callback name of the JSONP.
 * @return {string} Returns the script src.
 */
function buildScriptSrc(options, callbackName) {
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

},{"23":23}],21:[function(require,module,exports){
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

},{}],22:[function(require,module,exports){
var isPlainObject = require(39);
var isFunction = require(38);
var hasOwn = require(31);

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
                        throw new Error('"' + name + '" cannot be a name of parser');
                    }
                    target[name] = parser;
                }
            }
        }
    }
}

module.exports = addCustomParser;

},{"31":31,"38":38,"39":39}],23:[function(require,module,exports){
var isFunction = require(38);
var isAbsoluteURL = require(36);
var isPlainObject = require(39);

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
    var url = options.url;
    var baseURL = options.baseURL;
    var model = options.model;
    var query = options.query;
    var compileURL = options.compileURL;
    var encodeQueryString = options.encodeQueryString;
    var array;

    if (url === null || url === undefined) {
        url = '';
    }

    // If the url is not absolute url and the baseURL is defined,
    // prepend the baseURL to the url.
    if (!isAbsoluteURL(url)) {
        if (typeof baseURL === 'string') {
            url = baseURL + url;
        }
    }

    // Compile the url if needed.
    if (isPlainObject(model) && isFunction(compileURL)) {
        url = compileURL(url, model, options);
    }

    // Compile the query string.
    if (isPlainObject(query) && isFunction(encodeQueryString)) {
        query = encodeQueryString(query, options);
        array = url.split('#'); // There may be hash string in the url.
        url = array[0];

        if (url.indexOf('?') > -1) {
            if (url.charAt(url.length - 1) === '&') {
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

},{"36":36,"38":38,"39":39}],24:[function(require,module,exports){
var isFunction = require(38);

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

},{"38":38}],25:[function(require,module,exports){
exports.ERR_ABORTED = 'ERR_ABORTED';
exports.ERR_RESPONSE = 'ERR_RESPONSE';
exports.ERR_CANCELLED = 'ERR_CANCELLED';
exports.ERR_NETWORK = 'ERR_NETWORK';
exports.ERR_TIMEOUT = 'ERR_TIMEOUT';
exports.HTTP_REQUEST = 'HTTP_REQUEST';
exports.JSONP_REQUEST = 'JSONP_REQUEST';

},{}],26:[function(require,module,exports){
var CancelController = require(1);

/**
 * Create a new instance of `CancelController`.
 *
 * @returns {CancelController} Returns an new instance of `CancelController`.
 */
var createCancelController = function () {
    return new CancelController();
};

module.exports = createCancelController;

},{"1":1}],27:[function(require,module,exports){
var QS = require(43);
var constants = require(25);
var template = require(34);
var uuid = require(35);
var HTTP_REQUEST  = constants.HTTP_REQUEST;

/**
 * Create a new default request options.
 *
 * @returns {RequestOptions} Returns a new default request opitons.
 */
function createDefaultOptions() {
    /*eslint no-unused-vars: ["error", { "args": "none" }]*/
    /**
     * @type {RequestOptions}
     */
    var options = {
        method: 'GET',
        baseURL: null,
        url: '',
        model: null,
        query: null,
        headers: null,
        body: null,
        timeout: 0,
        cors: false,
        noCache: false,
        noCacheHeaders: {
            'Pragma': 'no-cache',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        },
        jsonp: 'callback',
        settings: {},
        controller: null,
        requestFunctionName: null,
        requestType: null,
        xhrProps: null,
        username: null,
        password: null,
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
                return this.request.responseJSON;
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
        compileURL: function (url, model, options) {
            return template(url, model);
        },
        encodeQueryString: function (query, options) {
            return QS.encode(query);
        },
        onXhrCreated: null,
        onXhrOpened: null,
        onXhrSent: null,
        onRequestCreated: null,
        isResponseOk: function (requestType, response) {
            var isOk;
            var status;

            // Http request
            if (requestType === HTTP_REQUEST) {
                status = +response.request.xhr.status;
                isOk = (status >= 200 && status < 300) || status === 304;
            // JSONP request
            } else {
                isOk = true;
            }

            return isOk;
        },
        transformError: null,
        transformResponse: null,
        shouldCallErrorCallback: null,
        shouldCallSuccessCallback: null
    };

    return options;
}

module.exports = createDefaultOptions;

},{"25":25,"34":34,"35":35,"43":43}],28:[function(require,module,exports){
/**
 * Define a static member on the given constructor and its prototype
 *
 * @param {Constructor} ctor The constructor to define the static member
 * @param {string} name The name of the static member
 * @param {any} value The value of the static member
 * @throws {Error} Throws error if the name has already existed, or the constructor is not a function
 */
function defineExports(ctor, name, value) {
    ctor.prototype.exports = ctor.exports = ctor.exports || {};
    ctor.exports[name] = value;
}

module.exports = defineExports;

},{}],29:[function(require,module,exports){
var isFunction = require(38);
var HttpResponseError = require(5);
var JSONPResponseError = require(8);
var constants = require(25);
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

},{"25":25,"38":38,"5":5,"8":8}],30:[function(require,module,exports){
var isFunction = require(38);

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

},{"38":38}],31:[function(require,module,exports){
module.exports = Object.prototype.hasOwnProperty;

},{}],32:[function(require,module,exports){
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
var T_STR = 1;
var T_EXP = 2;

/**
 * A simple template function
 *
 * @example
 * // Rreturns '/post/1'
 * template('/post/{ post.id }', { post: { id: 1 } })
 *
 * @param {string} template The template text.
 * @param {Object.<string, *>} data The data object.
 * @param {TemplateOptions} options The template options.
 * @returns {string} Returns the compiled text.
 */
function template(template, data, options) {
    var templ = template + '';
    var model = data || {};
    var opts = options || {};
    var start = opts.start || '{';
    var end = opts.end || '}';
    var encode = opts.encode || encodeURIComponent;
    var ast = compile(templ, start, end, function (expr) {
        var first = expr.charAt(0);
        var second = expr.charAt(1);
        var raw = false;

        if (first === '-' && second === ' ') {
            raw = true;
            expr = expr.substr(2);
        }

        expr = expr.replace(/^\s+|\s+$/g, '');

        return {
            type: T_EXP,
            text: expr,
            raw: raw
        };
    });

    var render = buildRenderFunction(ast, encode);

    try {
        return render(model);
    } catch (e) {
        throw new Error('Compile Error:\n\n' + template + '\n\n' + e.message);
    }
}

/**
 * Build render function.
 *
 * @param {Object.<string, *>[]} ast The abstract syntax tree.
 * @param {(str: string) => string} encode The function to encode the string.
 * @returns {(model: Object.<string, *>) => string} Returns a function that compile data to string.
 */
function buildRenderFunction(ast, encode) {
    var fn;
    var line;
    var lines = [];
    var i = 0;
    var l = ast.length;

    lines.push('var __o=[]');
    lines.push('with(__s){');

    for ( ; i < l; ++i) {
        line = ast[i];

        if (line.type === T_STR) {
            lines.push('__o.push(' + JSON.stringify(line.text) + ')');
        } else if (line.type === T_EXP && line.text) {
            if (line.raw) {
                lines.push('__o.push(' + line.text + ')');
            } else {
                lines.push('__o.push(__e(' + line.text + '))');
            }
        }
    }

    lines.push('}');
    lines.push('return __o.join("")');

    fn = new Function('__s', '__e', lines.join('\n'));

    return function (model) {
        return fn(model, function (val) {
            return (val === null || val === undefined) ? '' : encode(val + '');
        });
    };
}

/**
 * Compile the template.
 *
 * @param {string} template The template to compile.
 * @param {string} startTag The start tag.
 * @param {string} endTag The end tag.
 * @param {(expr: string) => string} parseExpr The function to parse the expression.
 * @returns {string} Return the compiled string.
 */
function compile(template, startTag, endTag, parseExpr) {
    var i = 0;
    var l = template.length;
    var sl = startTag.length;
    var el = endTag.length;
    var ast = [];
    var strbuffer = [];
    var exprbuffer = [];
    var type = T_STR;

    /**
     * Get the char in `template` at the given position.
     *
     * @param {numner} index The index to read.
     * @returns {string} Returns the char.
     */
    var charAt = function (index) {
        return template.charAt(index);
    };

    /**
     * Escape the tag.
     *
     * @param {string} tag The tag to escape.
     * @param {string[]} buffer The buffer to put the char.
     */
    var esc = function (tag, buffer) {
        var c;
        var m = tag.length;
        var s = '\\';
        /*eslint no-constant-condition: ["error", { "checkLoops": false }]*/
        while (1) {
            c = charAt(i);
            if (c === s) {
                c = charAt(++i);
                if (c === s) {
                    buffer.push(s);
                    ++i;
                } else if (isWord(tag)) {
                    buffer.push(tag);
                    i += m;
                } else {
                    buffer.push(s);
                    break;
                }
            } else {
                break;
            }
        }
    };

    /**
     * Check whether the next input is the word.
     *
     * @param {string} word The word to check.
     * @returns {number} Returns `1` on yes, otherwise `0` is returned.
     */
    var isWord = function (word) {
        var k = 0;
        var j = i;
        var m = word.length;

        while (k < m && j < l) {
            if (word.charAt(k) !== charAt(j)) return 0;
            ++k;
            ++j;
        }

        return 1;
    };

    /**
     * Flush the str to the ast and reset the str buffer.
     */
    var flushStr = function () {
        if (strbuffer.length) {
            ast.push({
                type: T_STR,
                text: strbuffer.join('')
            });
            strbuffer = [];
        }
    };

    /**
     * Flush the expr to the ast and reset the expr buffer.
     */
    var flushExpr = function () {
        flushStr();
        ast.push(parseExpr(exprbuffer.join('')));
        exprbuffer = [];
    };

    while (i < l) {
        if (type === T_STR) {
            esc(startTag, strbuffer);
            if (isWord(startTag)) {
                type = T_EXP;
                i += sl;
            } else {
                strbuffer.push(charAt(i));
                ++i;
            }
        } else if (type === T_EXP) {
            esc(endTag, exprbuffer);
            if (isWord(endTag)) {
                type = T_STR;
                i += el;
                flushExpr();
            } else {
                exprbuffer.push(charAt(i));
                ++i;
            }
        }
    }

    if (type === T_EXP) {
        throw new Error('Unexpected end');
    }

    flushStr();

    return ast;
}

/**
 * @typedef {Object.<string, *>} TemplateOptions
 * @property {string} [start] The start tag of the template, default is `{`.
 * @property {string} [end] The end tag of the template, default is `}`.
 * @property {(value: string) => string} [encode] The function to encode the string, default is `encodeURIComponent`.
 */

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

},{}],37:[function(require,module,exports){
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

},{}],38:[function(require,module,exports){
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

},{}],39:[function(require,module,exports){
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

},{}],40:[function(require,module,exports){
var isArray = require(37);
var isPlainObject = require(39);
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

},{"37":37,"39":39}],41:[function(require,module,exports){
var util = require(44);
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

},{"44":44}],42:[function(require,module,exports){
var util = require(44);
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

},{"44":44}],43:[function(require,module,exports){
var encode = require(42).encode;
var decode = require(41).decode;

exports.encode = encode;
exports.decode = decode;
exports.version = '1.1.2';

},{"41":41,"42":42}],44:[function(require,module,exports){
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

},{}]},{},[2])(2)
});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9fYnJvd3Nlci1wYWNrQDYuMS4wQGJyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsImxpYi9jbGFzcy9DYW5jZWxDb250cm9sbGVyLmpzIiwibGliL2NsYXNzL0h0dHBDbGllbnQuanMiLCJsaWIvY2xhc3MvSHR0cFJlcXVlc3QuanMiLCJsaWIvY2xhc3MvSHR0cFJlc3BvbnNlLmpzIiwibGliL2NsYXNzL0h0dHBSZXNwb25zZUVycm9yLmpzIiwibGliL2NsYXNzL0pTT05QUmVxdWVzdC5qcyIsImxpYi9jbGFzcy9KU09OUFJlc3BvbnNlLmpzIiwibGliL2NsYXNzL0pTT05QUmVzcG9uc2VFcnJvci5qcyIsImxpYi9jbGFzcy9SZXF1ZXN0LmpzIiwibGliL2NsYXNzL1Jlc3BvbnNlLmpzIiwibGliL2NsYXNzL1Jlc3BvbnNlRXJyb3IuanMiLCJsaWIvaHR0cC9hZGRFdmVudExpc3RlbmVycy5qcyIsImxpYi9odHRwL2FkZFRpbWVvdXRMaXN0ZW5lci5qcyIsImxpYi9odHRwL2NhbGxYaHJIb29rLmpzIiwibGliL2h0dHAvaGFuZGxlSGVhZGVycy5qcyIsImxpYi9odHRwL2hhbmRsZVJlcXVlc3RCb2R5LmpzIiwibGliL2h0dHAvaGFuZGxlWGhyUHJvcHMuanMiLCJsaWIvanNvbnAvYWRkRXZlbnRMaXN0ZW5lcnMuanMiLCJsaWIvanNvbnAvYnVpbGRDYWxsYmFja05hbWUuanMiLCJsaWIvanNvbnAvYnVpbGRTY3JpcHRTcmMuanMiLCJsaWIvanNvbnAvaGFuZGxlU2NyaXB0Q29ycy5qcyIsImxpYi9zaGFyZWQvYWRkQ3VzdG9tUGFyc2VyLmpzIiwibGliL3NoYXJlZC9idWlsZFVSTC5qcyIsImxpYi9zaGFyZWQvY2FsbFJlcXVlc3RDcmVhdGVkQ2FsbGJhY2suanMiLCJsaWIvc2hhcmVkL2NvbnN0YW50cy5qcyIsImxpYi9zaGFyZWQvY3JlYXRlQ2FuY2VsQ29udHJvbGxlci5qcyIsImxpYi9zaGFyZWQvY3JlYXRlRGVmYXVsdE9wdGlvbnMuanMiLCJsaWIvc2hhcmVkL2RlZmluZUV4cG9ydHMuanMiLCJsaWIvc2hhcmVkL2ZpcmVDYWxsYmFja3MuanMiLCJsaWIvc2hhcmVkL2hhbmRsZU9wdGlvbnMuanMiLCJsaWIvc2hhcmVkL2hhc093bi5qcyIsImxpYi9zaGFyZWQvaW5oZXJpdHMuanMiLCJsaWIvc2hhcmVkL25vb3AuanMiLCJsaWIvc2hhcmVkL3RlbXBsYXRlLmpzIiwibGliL3NoYXJlZC91dWlkLmpzIiwibm9kZV9tb2R1bGVzL194LWNvbW1vbi11dGlsc0AxLjQuMUB4LWNvbW1vbi11dGlscy9pc0Fic29sdXRlVVJMLmpzIiwibm9kZV9tb2R1bGVzL194LWNvbW1vbi11dGlsc0AxLjQuMUB4LWNvbW1vbi11dGlscy9pc0FycmF5LmpzIiwibm9kZV9tb2R1bGVzL194LWNvbW1vbi11dGlsc0AxLjQuMUB4LWNvbW1vbi11dGlscy9pc0Z1bmN0aW9uLmpzIiwibm9kZV9tb2R1bGVzL194LWNvbW1vbi11dGlsc0AxLjQuMUB4LWNvbW1vbi11dGlscy9pc1BsYWluT2JqZWN0LmpzIiwibm9kZV9tb2R1bGVzL194LWNvbW1vbi11dGlsc0AxLjQuMUB4LWNvbW1vbi11dGlscy9tZXJnZS5qcyIsIm5vZGVfbW9kdWxlcy9feC1xdWVyeS1zdHJpbmdAMS4xLjJAeC1xdWVyeS1zdHJpbmcvbGliL2RlY29kZS5qcyIsIm5vZGVfbW9kdWxlcy9feC1xdWVyeS1zdHJpbmdAMS4xLjJAeC1xdWVyeS1zdHJpbmcvbGliL2VuY29kZS5qcyIsIm5vZGVfbW9kdWxlcy9feC1xdWVyeS1zdHJpbmdAMS4xLjJAeC1xdWVyeS1zdHJpbmcvbGliL3F1ZXJ5c3RyaW5nLmpzIiwibm9kZV9tb2R1bGVzL194LXF1ZXJ5LXN0cmluZ0AxLjEuMkB4LXF1ZXJ5LXN0cmluZy9saWIvdXRpbC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3Z0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3REQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2ZBO0FBQ0E7O0FDREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM09BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDYkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDYkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNiQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsInZhciBpc0Z1bmN0aW9uID0gcmVxdWlyZSgzOCk7XG5cbi8qKlxuICogQ2FuY2VsIGNvbnRyb2xsZXIgaXMgdXNlZCB0byBjYW5jZWwgYWN0aW9ucy4gT25lIGNvbnRyb2xsZXIgY2FuIGJpbmQgYW55IG51bWJlciBvZiBhY3Rpb25zLlxuICpcbiAqIEBjbGFzc1xuICovXG5mdW5jdGlvbiBDYW5jZWxDb250cm9sbGVyKCkge1xuICAgIC8qKlxuICAgICAqIEB0eXBlIHtib29sZWFufSBXaGV0aGVyIHRoZSBjb250cm9sbGVyIGlzIGNhbmNlbGxlZC5cbiAgICAgKi9cbiAgICB0aGlzLmNhbmNlbGxlZCA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0Z1bmN0aW9uW119IFRoZSBjYWxsYmFja3MgdG8gY2FsbCBvbiBjYW5jZWwuXG4gICAgICovXG4gICAgdGhpcy5jYWxsYmFja3MgPSBbXTtcbn1cblxuLyoqXG4gKiBDYW5jZWwgdGhlIGFjdGlvbnMgdGhhdCBiaW5kIHdpdGggdGhpcyBjYW5jZWwgY29udHJvbGxlci5cbiAqL1xuQ2FuY2VsQ29udHJvbGxlci5wcm90b3R5cGUuY2FuY2VsID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBjYWxsYmFja3MgPSB0aGlzLmNhbGxiYWNrcztcbiAgICB2YXIgaSA9IDA7XG4gICAgdmFyIGwgPSBjYWxsYmFja3MubGVuZ3RoO1xuXG4gICAgaWYgKHRoaXMuY2FuY2VsbGVkID09PSBmYWxzZSkge1xuICAgICAgICB0aGlzLmNhbmNlbGxlZCA9IHRydWU7XG5cbiAgICAgICAgZm9yICggOyBpIDwgbDsgaSArPSAxKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrc1tpXSgpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIC8vIFRocm93IHRoZSBlcnJvciBsYXRlciBmb3IgZGVidWdpbmcuXG4gICAgICAgICAgICAgICAgKGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgZTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSkoZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG4vKipcbiAqIENoZWNrIHdoZXRoZXIgdGhlIGNvbnRyb2xsZXIgaXMgY2FuY2VsbGVkLlxuICpcbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgY29udHJvbGxlciBpcyBjYW5jZWxsZWQsIG90aGVyd2lzZSBgZmFsc2VgIGlzIHJldHVybmVkLlxuICovXG5DYW5jZWxDb250cm9sbGVyLnByb3RvdHlwZS5pc0NhbmNlbGxlZCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5jYW5jZWxsZWQ7XG59O1xuXG4vKipcbiAqIFJlZ2lzdGVyIGEgY2FsbGJhY2ssIHdoaWNoIHdpbGwgYmUgY2FsbGVkIHdoZW4gdGhlIGBjYW5jZWwoKWAgbWV0aG9kIGlzIGNhbGxlZC5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBUaGUgY2FsbGJhY2sgZnVuY3Rpb24gdG8gY2FsbCBvbiBjYW5jZWwuXG4gKi9cbkNhbmNlbENvbnRyb2xsZXIucHJvdG90eXBlLnJlZ2lzdGVyQ2FuY2VsQ2FsbGJhY2sgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICBpZiAoaXNGdW5jdGlvbihjYWxsYmFjaykpIHtcbiAgICAgICAgdGhpcy5jYWxsYmFja3MucHVzaChjYWxsYmFjayk7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBDYW5jZWxDb250cm9sbGVyO1xuIiwidmFyIFFTID0gcmVxdWlyZSg0Myk7XG52YXIgbWVyZ2UgPSByZXF1aXJlKDQwKTtcbnZhciBpc0Z1bmN0aW9uID0gcmVxdWlyZSgzOCk7XG52YXIgaXNQbGFpbk9iamVjdCA9IHJlcXVpcmUoMzkpO1xudmFyIGlzQWJzb2x1dGVVUkwgPSByZXF1aXJlKDM2KTtcbnZhciB1dWlkID0gcmVxdWlyZSgzNSk7XG52YXIgbm9vcCA9IHJlcXVpcmUoMzMpO1xudmFyIHRlbXBsYXRlID0gcmVxdWlyZSgzNCk7XG52YXIgaW5oZXJpdHMgPSByZXF1aXJlKDMyKTtcbnZhciBjb25zdGFudHMgPSByZXF1aXJlKDI1KTtcbnZhciBkZWZpbmVFeHBvcnRzID0gcmVxdWlyZSgyOCk7XG52YXIgY3JlYXRlRGVmYXVsdE9wdGlvbnMgPSByZXF1aXJlKDI3KTtcbnZhciBjcmVhdGVDYW5jZWxDb250cm9sbGVyID0gcmVxdWlyZSgyNik7XG52YXIgUmVxdWVzdCA9IHJlcXVpcmUoOSk7XG52YXIgSHR0cFJlcXVlc3QgPSByZXF1aXJlKDMpO1xudmFyIEpTT05QUmVxdWVzdCA9IHJlcXVpcmUoNik7XG52YXIgUmVzcG9uc2UgPSByZXF1aXJlKDEwKTtcbnZhciBIdHRwUmVzcG9uc2UgPSByZXF1aXJlKDQpO1xudmFyIEpTT05QUmVzcG9uc2UgPSByZXF1aXJlKDcpO1xudmFyIFJlc3BvbnNlRXJyb3IgPSByZXF1aXJlKDExKTtcbnZhciBIdHRwUmVzcG9uc2VFcnJvciA9IHJlcXVpcmUoNSk7XG52YXIgSlNPTlBSZXNwb25zZUVycm9yID0gcmVxdWlyZSg4KTtcbnZhciBDYW5jZWxDb250cm9sbGVyID0gcmVxdWlyZSgxKTtcbnZhciB2ZXJzaW9uID0gJzAuMC4xLWFscGhhLjUnO1xuXG4vKipcbiAqIEBjbGFzc1xuICpcbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IFtkZWZhdWx0c10gVGhlIGRlZmF1bHQgb3B0aW9ucyB0byB1c2Ugd2hlbiBzZW5kaW5nIHJlcXVlc3RzIHdpdGggdGhlIGNyZWF0ZWQgaHR0cCBjbGllbnQuXG4gKiBUaGlzIGRlZmF1bHQgb3B0aW9ucyB3aWxsIGJlIG1lcmdlZCBpbnRvIHRoZSBpbnRlcm5hbCBkZWZhdWx0IG9wdGlvbnMgdGhhdCBgY3JlYXRlRGVmYXVsdE9wdGlvbnMoKWAgcmV0dXJucy5cbiAqXG4gKiBAcGFyYW0ge0hhbmRsZU9wdGlvbnNGdW5jdGlvbn0gW2hhbmRsZURlZmF1bHRzXSBUaGUgaGFuZGxlciBmdW5jdGlvbiB0byBwcm9jZXNzIHRoZSBtZXJnZWQgZGVmYXVsdCBvcHRpb25zLiBUaGVcbiAqIG1lcmdlZCBkZWZhdWx0IG9wdGlvbnMgd2lsbCBiZSBwYXNzZWQgaW50byB0aGUgZnVuY3Rpb24gYXMgdGhlIGZpcnN0IGFyZ3VtZW50LiBZb3UgY2FuIG1ha2UgY2hhbmdlcyB0byBpdCBhcyB5b3VcbiAqIHdhbnQuIFRoaXMgZnVuY3Rpb24gbXVzdCByZXR1cm4gc3luY2hyb25vdXNseS4gVGhlIHJldHVybiB2YWx1ZSBvZiB0aGlzIGZ1bmN0aW9uIGlzIGlnbm9yZWQuXG4gKlxuICogQHBhcmFtIHtIYW5kbGVPcHRpb25zRnVuY3Rpb259IFtoYW5kbGVSZXF1ZXN0T3B0aW9uc10gVGhlIGhhbmRsZXIgZnVuY3Rpb24gdG8gcHJvY2VzcyBlYWNoIG1lcmdlZCByZXF1ZXN0IG9wdGlvbnMuXG4gKiBFdmVyeSBvcHRpb25zIHRoYXQgcGFzc2VkIGludG8gYHNlbmRgLCBgZmV0Y2hgLCBgZ2V0SlNPTlBgLCBgZmV0Y2hKU09OUGAgd2lsbCBiZSBwcm9jZXNzZWQgYnkgdGhpcyBoYW5kbGVyIGZ1bmN0aW9uLlxuICovXG5mdW5jdGlvbiBIdHRwQ2xpZW50KGRlZmF1bHRzLCBoYW5kbGVEZWZhdWx0cywgaGFuZGxlUmVxdWVzdE9wdGlvbnMpIHtcbiAgICB2YXIgZGVmYXVsdE9wdGlvbnMgPSBjcmVhdGVEZWZhdWx0T3B0aW9ucygpO1xuXG4gICAgaWYgKGlzUGxhaW5PYmplY3QoZGVmYXVsdHMpKSB7XG4gICAgICAgIG1lcmdlKGRlZmF1bHRPcHRpb25zLCBkZWZhdWx0cyk7XG4gICAgfVxuXG4gICAgaWYgKGlzRnVuY3Rpb24oaGFuZGxlRGVmYXVsdHMpKSB7XG4gICAgICAgIGhhbmRsZURlZmF1bHRzKGRlZmF1bHRPcHRpb25zKTtcbiAgICAgICAgLy8gRGVlcCBjb3B5IHRoZSBjaGFnbmVkIG9wdGlvbnNcbiAgICAgICAgZGVmYXVsdE9wdGlvbnMgPSBtZXJnZSh7fSwgZGVmYXVsdE9wdGlvbnMpO1xuICAgIH1cblxuICAgIGlmICghaXNGdW5jdGlvbihoYW5kbGVSZXF1ZXN0T3B0aW9ucykpIHtcbiAgICAgICAgaGFuZGxlUmVxdWVzdE9wdGlvbnMgPSBub29wO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCBhIGNvcHkgb2YgdGhlIGRlZmF1bHQgcmVxdWVzdCBvcHRpb25zLiBUaGlzIGZ1bmN0aW9uIGlzIE5PVCBhdmFpbGFibGUgb24gdGhlIHByb3RvdHlwZSBvZiBgSHR0cENsaWVudGAuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7UmVxdWVzdE9wdGlvbnN9XG4gICAgICovXG4gICAgdGhpcy5jb3B5T3B0aW9ucyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIG1lcmdlKHt9LCBkZWZhdWx0T3B0aW9ucyk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIE1lcmdlIHRoZSByZXF1ZXN0IG9wdGlvbnMgd2l0aCB0aGUgZGVmYXVsdCByZXF1ZXN0IG9wdGlvbnMuIFRoaXMgZnVuY3Rpb24gaXMgTk9UIGF2YWlsYWJsZSBvbiB0aGUgcHJvdG90eXBlIG9mXG4gICAgICogYEh0dHBDbGllbnRgIGFuZCB3aWxsIGNhbGwgYGhhbmRsZVJlcXVlc3RPcHRpb25zYCB0byBoYW5kbGUgdGhlIG1lcmdlZCByZXF1ZXN0IG9wdGlvbnMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMgdG8gbWVyZ2UuXG4gICAgICogQHJldHVybnMge1JlcXVlc3RPcHRpb25zfSBSZXR1cm5zIHRoZSBtZXJnZWQgcmVxdWVzdCBvcHRpb25zLlxuICAgICAqL1xuICAgIHRoaXMubWVyZ2VPcHRpb25zID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgdmFyIHJlcXVlc3RPcHRpb25zID0gbWVyZ2Uoe30sIGRlZmF1bHRPcHRpb25zLCBvcHRpb25zKTtcblxuICAgICAgICBoYW5kbGVSZXF1ZXN0T3B0aW9ucyhyZXF1ZXN0T3B0aW9ucyk7XG5cbiAgICAgICAgcmV0dXJuIHJlcXVlc3RPcHRpb25zO1xuICAgIH07XG59XG5cbi8qKlxuICogU2VuZCBhbiBodHRwIHJlcXVlc3QuXG4gKlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zIHRvIHVzZSwgd2hpY2ggd2lsbCBiZSBtZXJnZWQgaW50byBhIGNvcHkgb2YgdGhlIGRlZmF1bHQgb3B0aW9ucy5cbiAqIEBwYXJhbSB7UmVxdWVzdFN1Y2Nlc3NDYWxsYmFja30gb25zdWNjZXNzIFRoZSBjYWxsYmFjayB0byBjYWxsIG9uIHN1Y2Nlc3MuXG4gKiBAcGFyYW0ge1JlcXVlc3RFcnJvckNhbGxiYWNrfSBvbmVycm9yIFRoZSBjYWxsYmFjayB0byBjYWxsIG9uIGVycm9yLlxuICogQHJldHVybnMge0h0dHBSZXF1ZXN0fSBSZXR1cm5zIGFuIGluc3RhbmNlIG9mIGBIdHRwUmVxdWVzdGAuXG4gKi9cbkh0dHBDbGllbnQucHJvdG90eXBlLnNlbmQgPSBmdW5jdGlvbiAob3B0aW9ucywgb25zdWNjZXNzLCBvbmVycm9yKSB7XG4gICAgdmFyIHJlcXVlc3RPcHRpb25zID0gdGhpcy5tZXJnZU9wdGlvbnMob3B0aW9ucyk7XG5cbiAgICByZXF1ZXN0T3B0aW9ucy5yZXF1ZXN0RnVuY3Rpb25OYW1lID0gJ3NlbmQnO1xuICAgIHJlcXVlc3RPcHRpb25zLmNvbnRyb2xsZXIgPSBudWxsO1xuXG4gICAgcmV0dXJuIG5ldyBIdHRwUmVxdWVzdChyZXF1ZXN0T3B0aW9ucywgb25zdWNjZXNzLCBvbmVycm9yKTtcbn07XG5cbi8qKlxuICogU2VuZCBhbiBodHRwIHJlcXVlc3QgYW5kIHJldHVybiBhIHByb21pc2UuXG4gKlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zIHRvIHVzZSwgd2hpY2ggd2lsbCBiZSBtZXJnZWQgaW50byBhIGNvcHkgb2YgdGhlIGRlZmF1bHQgb3B0aW9ucy5cbiAqIEByZXR1cm5zIHtQcm9taXNlfSBSZXR1cm5zIGFuIGluc3RhbmNlIG9mIGBQcm9taXNlYC5cbiAqL1xuSHR0cENsaWVudC5wcm90b3R5cGUuZmV0Y2ggPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgIHZhciByZXF1ZXN0T3B0aW9ucyA9IHRoaXMubWVyZ2VPcHRpb25zKG9wdGlvbnMpO1xuICAgIHZhciBjb250cm9sbGVyID0gcmVxdWVzdE9wdGlvbnMuY29udHJvbGxlcjtcblxuICAgIHJlcXVlc3RPcHRpb25zLnJlcXVlc3RGdW5jdGlvbk5hbWUgPSAnZmV0Y2gnO1xuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgdmFyIHJlcXVlc3QgPSBuZXcgSHR0cFJlcXVlc3QocmVxdWVzdE9wdGlvbnMsIGZ1bmN0aW9uIChyZXNwb25zZSkge1xuICAgICAgICAgICAgaWYgKGNvbnRyb2xsZXIpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWNvbnRyb2xsZXIuaXNDYW5jZWxsZWQoKSkge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHJlc3BvbnNlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJlc29sdmUocmVzcG9uc2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LCByZWplY3QpO1xuXG4gICAgICAgIGlmIChjb250cm9sbGVyKSB7XG4gICAgICAgICAgICAvLyBUcmlnZ2VyIHRoZSBgRVJSX0NBTkNFTExFRGAgZXJyb3IuXG4gICAgICAgICAgICBpZiAoY29udHJvbGxlci5pc0NhbmNlbGxlZCgpKSB7XG4gICAgICAgICAgICAgICAgcmVxdWVzdC5jYW5jZWwoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29udHJvbGxlci5yZWdpc3RlckNhbmNlbENhbGxiYWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdC5jYW5jZWwoKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xufTtcblxuLyoqXG4gKiBTZW5kIGEganNvbnAgcmVxdWVzdC5cbiAqXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMgdG8gdXNlLCB3aGljaCB3aWxsIGJlIG1lcmdlZCBpbnRvIGEgY29weSBvZiB0aGUgZGVmYXVsdCBvcHRpb25zLlxuICogQHBhcmFtIHtSZXF1ZXN0U3VjY2Vzc0NhbGxiYWNrfSBvbnN1Y2Nlc3MgVGhlIGNhbGxiYWNrIHRvIGNhbGwgb24gc3VjY2Vzcy5cbiAqIEBwYXJhbSB7UmVxdWVzdEVycm9yQ2FsbGJhY2t9IG9uZXJyb3IgVGhlIGNhbGxiYWNrIHRvIGNhbGwgb24gZXJyb3IuXG4gKiBAcmV0dXJucyB7SlNPTlBSZXF1ZXN0fSBSZXR1cm5zIGFuIGluc3RhbmNlIG9mIGBKU09OUFJlcXVlc3RgLlxuICovXG5IdHRwQ2xpZW50LnByb3RvdHlwZS5nZXRKU09OUCA9IGZ1bmN0aW9uIChvcHRpb25zLCBvbnN1Y2Nlc3MsIG9uZXJyb3IpIHtcbiAgICB2YXIgcmVxdWVzdE9wdGlvbnMgPSB0aGlzLm1lcmdlT3B0aW9ucyhvcHRpb25zKTtcblxuICAgIHJlcXVlc3RPcHRpb25zLnJlcXVlc3RGdW5jdGlvbk5hbWUgPSAnZ2V0SlNPTlAnO1xuICAgIHJlcXVlc3RPcHRpb25zLmNvbnRyb2xsZXIgPSBudWxsO1xuXG4gICAgcmV0dXJuIG5ldyBKU09OUFJlcXVlc3QocmVxdWVzdE9wdGlvbnMsIG9uc3VjY2Vzcywgb25lcnJvcik7XG59O1xuXG4vKipcbiAqIFNlbmQgYSBqc29ucCByZXF1ZXN0IGFuZCByZXR1cm4gYSBwcm9taXNlLlxuICpcbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucyB0byB1c2UsIHdoaWNoIHdpbGwgYmUgbWVyZ2VkIGludG8gYSBjb3B5IG9mIHRoZSBkZWZhdWx0IG9wdGlvbnMuXG4gKiBAcmV0dXJucyB7UHJvbWlzZX0gUmV0dXJucyBhbiBpbnN0YW5jZSBvZiBgUHJvbWlzZWAuXG4gKi9cbkh0dHBDbGllbnQucHJvdG90eXBlLmZldGNoSlNPTlAgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgIHZhciByZXF1ZXN0T3B0aW9ucyA9IHRoaXMubWVyZ2VPcHRpb25zKG9wdGlvbnMpO1xuICAgIHZhciBjb250cm9sbGVyID0gcmVxdWVzdE9wdGlvbnMuY29udHJvbGxlcjtcblxuICAgIHJlcXVlc3RPcHRpb25zLnJlcXVlc3RGdW5jdGlvbk5hbWUgPSAnZmV0Y2hKU09OUCc7XG5cbiAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICB2YXIgcmVxdWVzdCA9IG5ldyBKU09OUFJlcXVlc3QocmVxdWVzdE9wdGlvbnMsIGZ1bmN0aW9uIChyZXNwb25zZSkge1xuICAgICAgICAgICAgaWYgKGNvbnRyb2xsZXIpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWNvbnRyb2xsZXIuaXNDYW5jZWxsZWQoKSkge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHJlc3BvbnNlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJlc29sdmUocmVzcG9uc2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LCByZWplY3QpO1xuXG4gICAgICAgIGlmIChjb250cm9sbGVyKSB7XG4gICAgICAgICAgICAvLyBUcmlnZ2VyIHRoZSBgRVJSX0NBTkNFTExFRGAgZXJyb3IuXG4gICAgICAgICAgICBpZiAoY29udHJvbGxlci5pc0NhbmNlbGxlZCgpKSB7XG4gICAgICAgICAgICAgICAgcmVxdWVzdC5jYW5jZWwoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29udHJvbGxlci5yZWdpc3RlckNhbmNlbENhbGxiYWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdC5jYW5jZWwoKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xufTtcblxuLyoqXG4gKiBDcmVhdGUgYSBuZXcgaW5zdGFuY2Ugb2YgYENhbmNlbENvbnRyb2xsZXJgLlxuICpcbiAqIEByZXR1cm5zIHtDYW5jZWxDb250cm9sbGVyfSBSZXR1cm5zIGFuIG5ldyBpbnN0YW5jZSBvZiBgQ2FuY2VsQ29udHJvbGxlcmAuXG4gKi9cbkh0dHBDbGllbnQucHJvdG90eXBlLmNyZWF0ZUNhbmNlbENvbnRyb2xsZXIgPSBjcmVhdGVDYW5jZWxDb250cm9sbGVyO1xuXG4vKipcbiAqIENyZWF0ZSBhIG5ldyBpbnN0YW5jZSBvZiBgQ2FuY2VsQ29udHJvbGxlcmAuXG4gKlxuICogQHJldHVybnMge0NhbmNlbENvbnRyb2xsZXJ9IFJldHVybnMgYW4gbmV3IGluc3RhbmNlIG9mIGBDYW5jZWxDb250cm9sbGVyYC5cbiAqL1xuSHR0cENsaWVudC5jcmVhdGVDYW5jZWxDb250cm9sbGVyID0gY3JlYXRlQ2FuY2VsQ29udHJvbGxlcjtcblxuLy8gVGhlIHZlcnNpb24uXG5IdHRwQ2xpZW50LnZlcnNpb24gPSB2ZXJzaW9uO1xuSHR0cENsaWVudC5wcm90b3R5cGUudmVyc2lvbiA9IHZlcnNpb247XG5cbmRlZmluZUV4cG9ydHMoSHR0cENsaWVudCwgJ2NvbnN0YW50cycsIG1lcmdlKHt9LCBjb25zdGFudHMpKTtcblxuZGVmaW5lRXhwb3J0cyhIdHRwQ2xpZW50LCAnbGlicycsIHtcbiAgICBRUzogUVNcbn0pO1xuXG5kZWZpbmVFeHBvcnRzKEh0dHBDbGllbnQsICdjbGFzc2VzJywge1xuICAgIENhbmNlbENvbnRyb2xsZXI6IENhbmNlbENvbnRyb2xsZXIsXG4gICAgSHR0cENsaWVudDogSHR0cENsaWVudCxcbiAgICBIdHRwUmVxdWVzdDogSHR0cFJlcXVlc3QsXG4gICAgSHR0cFJlc3BvbnNlOiBIdHRwUmVzcG9uc2UsXG4gICAgSHR0cFJlc3BvbnNlRXJyb3I6IEh0dHBSZXNwb25zZUVycm9yLFxuICAgIEpTT05QUmVxdWVzdDogSlNPTlBSZXF1ZXN0LFxuICAgIEpTT05QUmVzcG9uc2U6IEpTT05QUmVzcG9uc2UsXG4gICAgSlNPTlBSZXNwb25zZUVycm9yOiBKU09OUFJlc3BvbnNlRXJyb3IsXG4gICAgUmVxdWVzdDogUmVxdWVzdCxcbiAgICBSZXNwb25zZTogUmVzcG9uc2UsXG4gICAgUmVzcG9uc2VFcnJvcjogUmVzcG9uc2VFcnJvclxufSk7XG5cbmRlZmluZUV4cG9ydHMoSHR0cENsaWVudCwgJ2Z1bmN0aW9ucycsIHtcbiAgICB0ZW1wbGF0ZTogdGVtcGxhdGUsXG4gICAgbWVyZ2U6IG1lcmdlLFxuICAgIGlzQWJzb2x1dGVVUkw6IGlzQWJzb2x1dGVVUkwsXG4gICAgaXNGdW5jdGlvbjogaXNGdW5jdGlvbixcbiAgICBpc1BsYWluT2JqZWN0OiBpc1BsYWluT2JqZWN0LFxuICAgIHV1aWQ6IHV1aWQsXG4gICAgbm9vcDogbm9vcCxcbiAgICBpbmhlcml0czogaW5oZXJpdHMsXG4gICAgY3JlYXRlRGVmYXVsdE9wdGlvbnM6IGNyZWF0ZURlZmF1bHRPcHRpb25zXG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBIdHRwQ2xpZW50O1xuXG4vKipcbiAqIFRoaXMgY2FsbGJhY2sgaXMgdXNlZCB0byBoYW5sZGUgdGhlIG1lcmdlZCByZXF1ZXN0IG9wdGlvbnMuIEl0IG11c3QgcmV0cnVuIHRoZSByZXN1bHQgc3luY2hyb25vdXNseS5cbiAqXG4gKiBAY2FsbGJhY2sgSGFuZGxlT3B0aW9uc0Z1bmN0aW9uXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSBtZXJnZWQgcmVxdWVzdCBvcHRpb25zLlxuICogQHJldHVybnMge3ZvaWR9XG4gKi9cblxuLyoqXG4gKiBUaGUgY2FsbGJhY2sgdG8gY2FsbCBvbiBzdWNjZXNzLlxuICpcbiAqIEBjYWxsYmFjayBSZXF1ZXN0U3VjY2Vzc0NhbGxiYWNrXG4gKiBAcGFyYW0ge0h0dHBSZXNwb25zZXxhbnl9IHJlc3BvbnNlIFRoZSBodHRwIHJlc3BvbnNlIG9yIHRoZSByZXR1cm4gdmFsdWUgb2YgYG9wdGlvbnMudHJhbnNmb3JtUmVzcG9uc2UocmVzcG9uc2UpYC5cbiAqL1xuXG4vKipcbiAqIFRoZSBjYWxsYmFjayB0byBjYWxsIG9uIGVycm9yLlxuICpcbiAqIEBjYWxsYmFjayBSZXF1ZXN0RXJyb3JDYWxsYmFja1xuICogQHBhcmFtIHtIdHRwUmVzcG9uc2VFcnJvcnxhbnl9IGVycm9yIFRoZSBodHRwIHJlc3BvbnNlIGVycm9yIG9yIHRoZSByZXR1cm4gdmFsdWUgb2YgYG9wdGlvbnMudHJhbnNmb3JtRXJyb3IoZXJyb3IpYC5cbiAqL1xuXG4vKipcbiAqIFRoZSBkZWZpbml0b24gb2YgdGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqXG4gKiBAdHlwZWRlZiB7T2JqZWN0LjxzdHJpbmcsICo+fSBSZXF1ZXN0T3B0aW9uc1xuICpcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbbWV0aG9kXSBUaGUgaHR0cCByZXF1ZXN0IG1ldGhvZC4gVGhlIGRlZmF1bHQgbWV0aG9kIGlzIGBHRVRgLlxuICpcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbYmFzZVVSTF0gVGhlIHJlcXVlc3QgYmFzZSB1cmwuIElmIHRoZSBgdXJsYCBpcyByZWxhdGl2ZSB1cmwsIGFuZCB0aGUgYGJhc2VVUkxgIGlzIG5vdCBgbnVsbGAsIHRoZVxuICogYGJhc2VVUkxgIHdpbGwgYmUgcHJlcGVuZCB0byB0aGUgYHVybGAuXG4gKlxuICogQHByb3BlcnR5IHtzdHJpbmd9IHVybCBUaGUgcmVxdWVzdCB1cmwgdGhhdCBjYW4gY29udGFpbiBhbnkgbnVtYmVyIG9mIHBsYWNlaG9sZGVycywgYW5kIHdpbGwgYmUgY29tcGlsZWQgd2l0aCB0aGVcbiAqIGRhdGEgdGhhdCBwYXNzZWQgaW4gd2l0aCBgb3B0aW9ucy5tb2RlbGAuXG4gKlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgKj59IFttb2RlbF0gVGhlIGRhdGEgdXNlZCB0byBjb21waWxlIHRoZSByZXF1ZXN0IHVybC5cbiAqXG4gKiBAcHJvcGVydHkge09iamVjdC48c3RyaW5nLCAqPn0gW3F1ZXJ5XSBUaGUgZGF0YSB0aGF0IHdpbGwgYmUgY29tcGlsZWQgdG8gcXVlcnkgc3RyaW5nLlxuICpcbiAqIEBwcm9wZXJ0eSB7T2JqZWN0LjxzdHJpbmcsICo+fSBbYm9keV0gVGhlIG9iamVjdCB0aGF0IGNvbnRhaW5zIHRoZSBjb250ZW50IHdoaWNoIHdpbGwgYmUgc2VuZCB0byB0aGUgc2VydmVyLiBUaGlzXG4gKiBvYmplY3QgaGFzIG9ubHkgb25lIHByb3BlcnR5LiBUaGUgbmFtZSBvZiB0aGUgcHJvcGVydHkgaXMgdGhlIGNvbnRlbnQgdHlwZSBvZiB0aGUgY29udGVudCwgd2hpY2ggd2lsbCBiZSB1c2VkIHRvIGZpbmRcbiAqIGEgcHJvY2Vzc29yIGluIGBvcHRpb25zLmh0dHBSZXF1ZXN0Qm9keVByb2Nlc3NvcmAuIFRoZSBwcm9jZXNzb3IgaXMgdXNlZCB0byBwcm9jZXNzIHRoZSB2YWx1ZSBvZiB0aGUgcHJvcGVydHkuIFRoZVxuICogcHJvY2Vzc2VkIHZhbHVlIHdoaWNoIHRoZSBwcm9jZXNzb3IgcmV0dXJucyB3aWxsIGJlIHNlbmQgdG8gdGhlIHNlcnZlciBhcyB0aGUgcmVxdWVzdCBib2R5LlxuICpcbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBbdGltZW91dF0gVGhlIG51bWJlciBvZiBtaWxsaXNlY29uZHMgdGhlIHJlcXVlc3QgY2FuIHRha2UgYmVmb3JlIGl0IGZpbmlzaGVkLiBJZiB0aGUgdGltZW91dCB2YWx1ZVxuICogaXMgYDBgLCBubyB0aW1lciB3aWxsIGJlIHNldC4gSWYgdGhlIHJlcXVlc3QgZG9lcyBub3QgZmluc2loZWQgd2l0aGluIHRoZSBnaXZlbiB0aW1lLCBhIHRpbWVvdXQgZXJyb3Igd2lsbCBiZSB0aHJvd24uXG4gKiBUaGUgZGVmYXVsdCB2YWx1ZSBpcyBgMGAuXG4gKlxuICogQHByb3BlcnR5IHtib29sZWFufSBbY29yc10gV2hldGhlciB0byBzZXQgYHdpdGhDcmVkZW50aWFsc2AgcHJvcGVydHkgb2YgdGhlIGBYTUxIdHRwUmVxdWVzdGAgdG8gYHRydWVgLiBUaGUgZGVmYXVsdFxuICogdmFsdWUgaXMgYGZhbHNlYC5cbiAqXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IFtub0NhY2hlXSBXaGV0aGVyIHRvIGRpc2FibGUgdGhlIGNhY2hlLiBJZiB0aGUgdmFsdWUgaXMgYHRydWVgLCB0aGUgaGVhZGVycyBpblxuICogYG9wdGlvbnMubm9DYWNoZUhlYWRlcnNgIHdpbGwgYmUgc2V0LiBUaGUgZGVmYXVsdCB2YWx1ZSBpcyBgZmFsc2VgLlxuICpcbiAqIEBwcm9wZXJ0eSB7T2JqZWN0LjxzdHJpbmcsICo+fSBbbm9DYWNoZUhlYWRlcnNdIFRoZSBoZWFkZXJzIHRvIHNldCB3aGVuIGBvcHRpb25zLm5vQ2FjaGVgIGlzIHNldCB0byBgdHJ1ZWAuXG4gKlxuICogQHByb3BlcnR5IHtzdHJpbmd9IFtqc29ucF0gVGhlIHF1ZXJ5IHN0cmluZyBrZXkgdG8gaG9sZCB0aGUgdmFsdWUgb2YgdGhlIGNhbGxiYWNrIG5hbWUgd2hlbiBzZW5kaW5nIEpTT05QIHJlcXVlc3QuXG4gKiBUaGUgZGVmYXVsdCB2YWx1ZXMgaXMgYGNhbGxiYWNrYC5cbiAqXG4gKiBAcHJvcGVydHkge09iamVjdC48c3RyaW5nLCAqPn0gW3NldHRpbmdzXSBUaGUgb2JqZWN0IHRvIGtlZXAgdGhlIHNldHRpbmdzIGluZm9ybWF0aW9uIHRoYXQgdGhlIHVzZXIgcGFzc2VkIGluLiBUaGVcbiAqIGxpYnJhcnkgaXRzZWxmIHdpbGwgbm90IHRvdWNoIHRoaXMgcHJvcGVydHkuIFlvdSBjYW4gdXNlIHRoaXMgcHJvcGVydHkgdG8gaG9sZCBhbnkgaW5mb3JtYXRpb24gdGhhdCB5b3Ugd2FudCwgd2hlblxuICogeW91IGV4dGVuZCB0aGUgZnVuY3Rpb25hbGl0eSBvZiB5b3VyIG93biBpbnN0YW5jZSBvZiBgSHR0cENsaWVudGAuIFRoZSBkZWZhdWx0IHZhbHVlIG9mIHRoaXMgcHJvcGVydHkgaXMgYW4gZW1wdHlcbiAqIG9iamVjdC5cbiAqXG4gKiBAcHJvcGVydHkge09iamVjdC48c3RyaW5nLCAqPn0gW2hlYWRlcnNdIFRoZSBvYmplY3QgdGhhdCBjb250YWlucyB0aGUgaGVhZGVycyB0byBzZXQgd2hlbiBzZW5kaW5nIHRoZSByZXF1ZXN0LiBPbmx5XG4gKiB0aGUgbm9uLXVuZGVmaW5lZCBhbmQgbm9uLW51bGwgaGVhZGVycyBhcmUgc2V0LlxuICpcbiAqIEBwcm9wZXJ0eSB7Q2FuY2VsQ29udHJvbGxlcn0gW2NvbnRyb2xsZXJdIFRoZSBgQ2FuY2VsQ29udHJvbGxlcmAgdXNlZCB0byBjYW5jZWwgdGhlIHJlcXVlc3QuIEl0IG9ubHkgd29ya3Mgd2hlbiB1c2luZ1xuICogYGZldGNoYCBvciBgZmV0Y2hKU09OUGAgdG8gc2VuZCByZXF1ZXN0LiBJZiB0aGUgeW91IHNlbmQgcmVxdWVzdCB1c2luZyBgc2VuZGAgb3IgYGdldEpTT05QYCwgdGhlIGBvcHRpb25zLmNvbnRyb2xsZXJgXG4gKiB3aWxsIGJlIHNldCB0byBgbnVsbGAuXG4gKlxuICogQHByb3BlcnR5IHtzdHJpbmd9IFtyZXF1ZXN0RnVuY3Rpb25OYW1lXSBUaGUgbmFtZSBvZiB0aGUgZnVuY3Rpb24gdGhhdCBzZW5kIHRoZSByZXF1ZXN0LiBDYW4gYmUgYHNlbmRgLCBgZmV0Y2hgLFxuICogYGdldEpTT05QYCwgYGZldGNoSlNPTlBgLiBUaGlzIHZhbHVlIGlzIHNldCBieSB0aGUgbGlicmFyeSwgZG9uJ3QgY2hhbmdlIGl0LlxuICpcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbcmVxdWVzdFR5cGVdIFRoZSByZXF1ZXN0IHR5cGUgb2YgdGhpcyByZXF1ZXN0LiBUaGUgdmFsdWUgb2YgaXQgaXMgc2V0IGJ5IHRoZSBsaWJyYXJ5IGl0c2VsZiwgY2FuXG4gKiBiZSBgSFRUUF9SRVFVRVNUYCBvciBgSlNPTlBfUkVRVUVTVGAuIEFueSBvdGhlciB2YWx1ZSB0aGUgdXNlciBwYXNzZWQgaW4gaXMgaWdub3JlZC4gWW91IGNhbiB1c2UgdGhpcyBwcm9wZXJ0eSB0byBnZXRcbiAqIHRoZSB0eXBlIG9mIHRoZSBjdXJyZW50IHJlcXVlc3QuXG4gKlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgKj59IFt4aHJQcm9wc10gVGhlIG9iamVjdCB0aGF0IGNvbnRhaW5zIHRoZSBwcm9wZXJ0aWVzIHRvIHNldCBvbiB0aGUgaW5zdGFuY2Ugb2YgdGhlXG4gKiBgWE1MSHR0cFJlcXVlc3RgLlxuICpcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbdXNlcm5hbWVdIFRoZSB1c2VyIG5hbWUgdG8gdXNlIGZvciBhdXRoZW50aWNhdGlvbiBwdXJwb3Nlcy4gVGhlIGRlZnVhbHQgdmFsdWUgaXMgYG51bGxgLlxuICpcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbcGFzc3dvcmRdIFRoZSBwYXNzd29yZCB0byB1c2UgZm9yIGF1dGhlbnRpY2F0aW9uIHB1cnBvc2VzLiBUaGUgZGVmdWFsdCB2YWx1ZSBpcyBgbnVsbGAuXG4gKlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgaHR0cFJlcXVlc3RCb2R5UHJvY2Vzc29yPn0gW2h0dHBSZXF1ZXN0Qm9keVByb2Nlc3Nvcl0gVGhlIG9iamVjdCB0aGF0IGNvbnRhaW5zIHRoZVxuICogaHR0cCByZXF1ZXN0IGJvZHkgcHJvY2Vzc29ycy5cbiAqXG4gKiBAcHJvcGVydHkge09iamVjdC48c3RyaW5nLCBSZXNwb25zZVBhcnNlRnVuY3Rpb24+fSBbaHR0cFJlc3BvbnNlUGFyc2VyXSBUaGUgb2JqZWN0IHRoYXQgY29udGFpbnMgdGhlIGh0dHAgcmVzcG9uc2VcbiAqIHBhcnNlcnMuXG4gKlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgUmVzcG9uc2VQYXJzZUZ1bmN0aW9uPn0gW2pzb25wUmVzcG9uc2VQYXJzZXJdIFRoZSBvYmplY3QgdGhhdCBjb250YWlucyB0aGUganNvbnAgcmVzcG9uc2VcbiAqIHBhcnNlcnMuXG4gKlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgUmVzcG9uc2VFcnJvclBhcnNlRnVuY3Rpb24+fSBbaHR0cFJlc3BvbnNlRXJyb3JQYXJzZXJdIFRoZSBvYmplY3QgdGhhdCBjb250YWlucyB0aGUgaHR0cFxuICogcmVzcG9uc2UgZXJyb3IgcGFyc2Vycy5cbiAqXG4gKiBAcHJvcGVydHkge09iamVjdC48c3RyaW5nLCBSZXNwb25zZUVycm9yUGFyc2VGdW5jdGlvbj59IFtqc29ucFJlc3BvbnNlRXJyb3JQYXJzZXJdIFRoZSBvYmplY3QgdGhhdCBjb250YWlucyB0aGUganNvbnBcbiAqIHJlc3BvbnNlIGVycm9yIHBhcnNlcnMuXG4gKlxuICogQHByb3BlcnR5IHtIYW5sZGVPcHRpb25zRnVuY3Rpb259IFtoYW5kbGVPcHRpb25zXSBUaGUgZnVuY3Rpb24gdG8gaGFuZGxlIHRoZSBvcHRpb25zLlxuICpcbiAqIEBwcm9wZXJ0eSB7Q3JlYXRlWEhSRnVuY3Rpb259IFtjcmVhdGVYSFJdIFRoZSBmdW5jdGlvbiB0byBjcmVhdGUgdGhlIGBYTUxIdHRwUmVxdWVzdGAgaW5zdGFuY2UuXG4gKlxuICogQHByb3BlcnR5IHtTY3JpcHRDcmVhdGVGdW5jdGlvbn0gW2NyZWF0ZVNjcmlwdF0gVGhlIGZ1bmN0aW9uIHRvIGNyZWF0ZSB0aGUgYEhUTUxTY3JpcHRFbGVtZW50YCBpbnN0YW5jZS5cbiAqXG4gKiBAcHJvcGVydHkge0pTT05QQ29udGFpbmVyRmluZEZ1bmN0aW9ufSBbanNvbnBDb250YWluZXJOb2RlXSBUaGUgZnVuY3Rpb24gdGhhdCByZXR1cm5zIHRoZSBjb250YWluZXIgbm9kZSwgd2hpY2ggd2lsbFxuICogYmUgdXNlZCB0byBhcHBlbmQgdGhlIHNjcmlwdCBlbGVtZW50IHdoZW4gc2VuZGluZyBqc29ucCByZXF1ZXN0LlxuICpcbiAqIEBwcm9wZXJ0eSB7SlNPTlBDYWxsYmFja05hbWVHZW5lcmF0ZUZ1bmN0aW9ufSBbanNvbnBDYWxsYmFja05hbWVdIFRoZSBmdW5jdGlvbiB0byBnZW5lcmF0ZSB0aGUgdW5pcXVlIGNhbGxiYWNrIG5hbWVcbiAqIHdoZW4gc2VuZGluZyBqc29ucCByZXF1ZXN0LlxuICpcbiAqIEBwcm9wZXJ0eSB7Q29tcGlsZVVSTEZ1bmN0aW9ufSBbY29tcGlsZVVSTF0gVGhlIGZ1bmN0aW9uIHRvIGNvbXBpbGUgdXJsLlxuICpcbiAqIEBwcm9wZXJ0eSB7RW5jb2RlUXVlcnlTdHJpbmdGdW5jdGlvbn0gZW5jb2RlUXVlcnlTdHJpbmcgVGhlIGZ1bmN0aW9uIHRvIGVuY29kZSB0aGUgcXVlcnkgc3RyaW5nLlxuICpcbiAqIEBwcm9wZXJ0eSB7WEhSSG9va0Z1bmN0aW9ufSBvblhockNyZWF0ZWQgVGhlIGZ1bmN0aW9uIHRvIGNhbGwgb24geGhyIGNyZWF0ZWQuXG4gKlxuICogQHByb3BlcnR5IHtYSFJIb29rRnVuY3Rpb259IG9uWGhyT3BlbmVkIFRoZSBmdW5jdG9uIHRvIGNhbGwgb24geGhyIG9wZW5lZC5cbiAqXG4gKiBAcHJvcGVydHkge1hIUkhvb2tGdW5jdGlvbn0gb25YaHJTZW50IFRoZSBmdW5jdGlvbiB0byBjYWxsIG9uIHhociBzZW50LlxuICpcbiAqIEBwcm9wZXJ0eSB7UmVxdWVzdENyZWF0ZWRGdW5jdGlvbn0gb25SZXF1ZXN0Q3JlYXRlZCBUaGUgZnVuY3Rpb24gdG8gY2FsbCBvbiByZXF1ZXN0IGNyZWF0ZWQuXG4gKlxuICogQHByb3BlcnR5IHtDaGVja1Jlc3BvbnNlT2tGdW5jdGlvbn0gaXNSZXNwb25zZU9rIFRoZSBmdW5jdGlvbiB0byBjaGVjayB3aGV0aGVyIHRoZSByZXNwb25zZSBpcyBvay5cbiAqXG4gKiBAcHJvcGVydHkge1RyYW5zZm9ybUVycm9yRnVuY3Rpb259IHRyYW5zZm9ybUVycm9yIFRoZSBmdW5jdGlvbiB0byB0cmFuc2Zyb20gdGhlIHJlc3BvbnNlIGVycm9yLiBUaGUgcmV0dXJuIHZhbHVlIG9mXG4gKiB0aGlzIGZ1bmN0aW9uIHdpbGwgYmUgcGFzc2VkIHRvIHRoZSBgb25lcnJvcmAgY2FsbGJhY2suXG4gKlxuICogQHByb3BlcnR5IHtUcmFuc2Zvcm1SZXNwb25zZUZ1bmN0aW9ufSB0cmFuc2Zvcm1SZXNwb25zZSBUaGUgZnVuY3Rpb24gdG8gdHJhbnNmcm9tIHRoZSByZXNwb25zZS4gVGhlIHJldHVybiB2YWx1ZSBvZlxuICogdGhpcyBmdW5jdGlvbiB3aWxsIGJlIHBhc3NlZCB0byB0aGUgYG9uc3VjY2Vzc2AgY2FsbGJhY2suXG4gKlxuICogQHByb3BlcnR5IHtDaGVja1Nob3VsZENhbGxFcnJvckNhbGxiYWNrRnVuY3Rpb259IHNob3VsZENhbGxFcnJvckNhbGxiYWNrIFRoZSBmdW5jdGlvbiB0byBjaGVjayB3aGV0aGVyIHRvIGNhbGwgdGhlXG4gKiBlcnJvciBjYWxsYmFjay5cbiAqXG4gKiBAcHJvcGVydHkge0NoZWNrU2hvdWxkQ2FsbFN1Y2Nlc3NDYWxsYmFja0Z1bmN0aW9ufSBzaG91bGRDYWxsU3VjY2Vzc0NhbGxiYWNrIFRoZSBmdW5jdGlvbiB0byBjaGVjayB3aGV0aGVyIHRvIGNhbGxcbiAqIHRoZSBzdWNjZXNzIGNhbGxiYWNrLlxuICovXG5cbi8qKlxuICogVGhlIGRlZmluaXRvbiBvZiBodHRwIHJlcXVlc3QgZGF0YSBwcm9jZXNzb3IuXG4gKlxuICogQHR5cGVkZWYge09iamVjdC48c3RyaW5nLCAqPn0gaHR0cFJlcXVlc3RCb2R5UHJvY2Vzc29yXG4gKiBAcHJvcGVydHkge251bWJlcn0gcHJpb3JpdHkgVGhlIHByaW9yaXR5IG9mIHRoZSBwcm9jZXNzb3IuXG4gKiBAcHJvcGVydHkge09iamVjdC48c3RyaW5nLCAqPn0gW2hlYWRlcnNdIFRoZSBoZWFkZXJzIHRvIHNldCB3aGVuIHRoaXMgcHJvY2Vzc29yIGlzIHVzZWQuXG4gKiBAcHJvcGVydHkge0h0dHBSZXF1ZXN0Q29udGVudFByb2Nlc3NGdW5jdGlvbn0gW3Byb2Nlc3Nvcl0gVGhlIGZ1bmN0aW9uIHRvIHByb2Nlc3MgdGhlIHJlcXVlc3QgYm9keS5cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBoYW5kbGUgdGhlIG9wdGlvbnMuXG4gKlxuICogQGNhbGxiYWNrIEhhbmxkZU9wdGlvbnNGdW5jdGlvblxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICovXG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIHByb2Nlc3MgdGhlIHJlcXVlc3QgZGF0YS5cbiAqXG4gKiBAY2FsbGJhY2sgSHR0cFJlcXVlc3RDb250ZW50UHJvY2Vzc0Z1bmN0aW9uXG4gKiBAcGFyYW0ge09iamVjdC48c3RyaW5nLCAqPn0gY29udGVudCBUaGUgY29uZW50IG5lZWQgdG8gcHJvY2Vzcy5cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucyBvZiB0aGUgY3VycmVudCByZXF1ZXN0LlxuICogQHJldHVybnMge2FueX0gUmV0dXJucyB0aGUgdmFsdWUgdGhhdCB3aWxsIGJlIHNlbmQgdG8gdGhlIHNlcnZlci5cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBwYXJzZSB0aGUgcmVzcG9uc2UuIFRoaXMgZnVuY3Rpb24gd2lsbCBiZSBtb3VudGVkIG9uIHRoZSByZXNwb25zZSBpbnN0YW5jZSwgd2hpY2ggbWFkZSBpdCBhIG1ldGhvZFxuICogb2YgdGhlIGBSZXNwb25zZWAgaW5zdGFuY2UuIFRoZSBwYXJhbWV0ZXJzIGFuZCB0aGUgcmV0dXJuIHZhbHVlIGlzIHVwIG9uIHlvdS5cbiAqXG4gKiBAY2FsbGJhY2sgUmVzcG9uc2VQYXJzZUZ1bmN0aW9uXG4gKi9cblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gcGFyc2UgdGhlIHJlc3BvbnNlIGVycm9yLiBUaGlzIGZ1bmN0aW9uIHdpbGwgYmUgbW91bnRlZCBvbiB0aGUgcmVzcG9uc2UgZXJyb3IgaW5zdGFuY2UsIHdoaWNoIG1hZGUgaXRcbiAqIGEgbWV0aG9kIG9mIHRoZSBgUmVzcG9uc2VFcnJvcmAgaW5zdGFuY2UuIFRoZSBwYXJhbWV0ZXJzIGFuZCB0aGUgcmV0dXJuIHZhbHVlIGlzIHVwIG9uIHlvdS5cbiAqXG4gKiBAY2FsbGJhY2sgUmVzcG9uc2VFcnJvclBhcnNlRnVuY3Rpb25cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBjcmVhdGUgdGhlIGBYTUxIdHRwUmVxdWVzdGAgaW5zdGFuY2UuXG4gKlxuICogQGNhbGxiYWNrIENyZWF0ZVhIUkZ1bmN0aW9uXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcmV0dXJucyB7WE1MSHR0cFJlcXVlc3R9IFJldHVybnMgYW4gaW5zdGFuY2Ugb2YgYFhNTEh0dHBSZXF1ZXN0YC5cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBjcmVhdGUgdGhlIGBIVE1MU2NyaXB0RWxlbWVudGAgaW5zdGFuY2UuXG4gKlxuICogQGNhbGxiYWNrIFNjcmlwdENyZWF0ZUZ1bmN0aW9uXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcmV0dXJucyB7SFRNTFNjcmlwdEVsZW1lbnR9IFJldHVybnMgYW4gaW5zdGFuY2Ugb2YgYEhUTUxTY3JpcHRFbGVtZW50YC5cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0aGF0IHJldHVybnMgdGhlIG5vZGUgdG8gYXBwZW5kIHRoZSBzY3JpcHQgZWxlbWVudC5cbiAqXG4gKiBAY2FsbGJhY2sgSlNPTlBDb250YWluZXJGaW5kRnVuY3Rpb25cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEByZXR1cm5zIHtOb2RlfSBSZXR1cm5zIHRoZSBub2RlIHRvIGFwcGVuZCB0aGUgc2NyaXB0IGVsZW1lbnQuXG4gKi9cblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gZ2VuZXJhdGUgdGhlIHVuaXF1ZSBjYWxsYmFjayBuYW1lLlxuICpcbiAqIEBjYWxsYmFjayBKU09OUENhbGxiYWNrTmFtZUdlbmVyYXRlRnVuY3Rpb25cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEByZXR1cm5zIHtzdHJpbmd9IFJldHJ1bnMgYSB2YWxpZCBqYXZhc2NyaXB0IGlkZW50aWZpZXIgdG8gaG9sZCB0aGUgY2FsbGJhay5cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBjb21waWxlIHRoZSByZXF1ZXN0IHVybC5cbiAqXG4gKiBAY2FsbGJhY2sgQ29tcGlsZVVSTEZ1bmN0aW9uXG4gKiBAcGFyYW0ge3N0cmluZ30gdXJsIFRoZSB1cmwgKHdpdGggYmFzZVVSTCkgdG8gY29tcGlsZS5cbiAqIEBwYXJhbSB7T2JqZWN0LjxzdHJpbmcsICo+fSBwYXJhbSBUaGUgcGFyYW0gdG8gY29tcGlsZSB0aGUgdXJsLlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICogQHJldHVybnMge3N0cmluZ30gUmV0dXJucyB0aGUgY29tcGlsZWQgdXJsLlxuICovXG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGVuY29kZSB0aGUgcXVlcnkgc3RyaW5nLlxuICpcbiAqIEBjYWxsYmFjayBFbmNvZGVRdWVyeVN0cmluZ0Z1bmN0aW9uXG4gKiBAcGFyYW0ge09iamVjdC48c3RyaW5nLCAqPn0gZGF0YSBUaGUgZGF0YSB0byBiZSBlbmNvZGVkIHRvIHF1ZXJ5IHN0cmluZy5cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEByZXR1cm5zIHtzdHJpbmd9IFJldHVybnMgdGhlIGVuY29kZWQgcXVlcnkgc3RyaW5nLlxuICovXG5cbi8qKlxuICogVGhlIHhociBob29rIGZ1bmN0aW9uLlxuICpcbiAqIEBjYWxsYmFjayBYSFJIb29rRnVuY3Rpb25cbiAqIEBwYXJhbSB7WE1MSHR0cFJlcXVlc3R9IHhociBUaGUgaW5zdGFuY2Ugb2YgYFhNTEh0dHBSZXF1ZXN0YC5cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqL1xuXG4vKipcbiAqIEBjYWxsYmFjayBSZXF1ZXN0Q3JlYXRlZEZ1bmN0aW9uXG4gKiBAcGFyYW0ge0h0dHBSZXF1ZXN0fEpTT05QUmVxdWVzdH0gcmVxdWVzdCBUaGUgcmVxdWVzdCBpbnN0YW5jZSwgY2FuIGJlIGBIdHRwUmVxdWVzdGAgb3IgYEpTT05QUmVxdWVzdGAuXG4gKi9cblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gY2hlY2sgd2hldGhlciB0aGUgcmVzcG9uc2UgaXMgb2suXG4gKlxuICogQGNhbGxiYWNrIENoZWNrUmVzcG9uc2VPa0Z1bmN0aW9uXG4gKiBAcGFyYW0ge3N0cmluZ30gcmVxdWVzdFR5cGUgVGhlIHJlcXVlc3QgdHlwZSwgYEhUVFBfUkVRVUVTVGAgb3IgYEpTT05QX1JFUVVFU1RgLlxuICogQHBhcmFtIHtSZXNwb25zZX0gcmVzcG9uc2UgVGhlIHJlc3BvbnNlIGluc3RhbmNlLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSByZXNwb25zZSBpcyBvaywgb3RoZXJ3aXNlIGBmYWxzZWAgaXMgcmV0dXJuZWQuXG4gKi9cblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gY2hlY2sgd2hldGhlciB0byBjYWxsIHRoZSBlcnJvciBjYWxsYmFjay5cbiAqXG4gKiBAY2FsbGJhY2sgQ2hlY2tTaG91bGRDYWxsRXJyb3JDYWxsYmFja0Z1bmN0aW9uXG4gKiBAcGFyYW0ge3N0cmluZ30gcmVxdWVzdFR5cGUgVGhlIHJlcXVlc3QgdHlwZSwgYEhUVFBfUkVRVUVTVGAgb3IgYEpTT05QX1JFUVVFU1RgLlxuICogQHBhcmFtIHthbnl9IHRyYW5zZm9ybWVkRXJyb3IgVGhlIGRhdGEgdGhhdCBgb3B0aW9ucy50cmFuc2Zvcm1FcnJvciguLi4pYCByZXR1cm5zLlxuICogQHBhcmFtIHtIdHRwUmVzcG9uc2VFcnJvcnxKU09OUFJlc3BvbnNlRXJyb3J9IGVycm9yIFRoZSByZXNwb25zZSBlcnJvci5cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBjaGVjayB3aGV0aGVyIHRvIGNhbGwgdGhlIHN1Y2Nlc3MgY2FsbGJhY2suXG4gKlxuICogQGNhbGxiYWNrIENoZWNrU2hvdWxkQ2FsbFN1Y2Nlc3NDYWxsYmFja0Z1bmN0aW9uXG4gKiBAcGFyYW0ge3N0cmluZ30gcmVxdWVzdFR5cGUgVGhlIHJlcXVlc3QgdHlwZSwgYEhUVFBfUkVRVUVTVGAgb3IgYEpTT05QX1JFUVVFU1RgLlxuICogQHBhcmFtIHthbnl9IHRyYW5zZm9ybWVkUmVzcG9uc2UgVGhlIGRhdGEgdGhhdCBgb3B0aW9ucy50cmFuc2Zvcm1SZXNwb25zZSguLi4pYCByZXR1cm5zLlxuICogQHBhcmFtIHtIdHRwUmVzcG9uc2V8SlNPTlBSZXNwb25zZX0gcmVzcG9uc2UgVGhlIHJlc3BvbnNlLlxuICovXG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIHRyYW5zZnJvbSB0aGUgcmVzcG9uc2UuIFRoZSByZXR1cm4gdmFsdWUgb2YgdGhpcyBmdW5jdGlvbiB3aWxsIGJlIHBhc3NlZCB0byB0aGUgYG9uc3VjY2Vzc2AgY2FsbGJhY2suXG4gKlxuICogQGNhbGxiYWNrIFRyYW5zZm9ybVJlc3BvbnNlRnVuY3Rpb25cbiAqIEBwYXJhbSB7c3RyaW5nfSByZXF1ZXN0VHlwZSBUaGUgcmVxdWVzdCB0eXBlLCBgSFRUUF9SRVFVRVNUYCBvciBgSlNPTlBfUkVRVUVTVGAuXG4gKiBAcGFyYW0ge0h0dHBSZXNwb25zZXxKU09OUFJlc3BvbnNlfSByZXNwb25zZSBUaGUgcmVzcG9uc2UuXG4gKiBAcmV0dXJucyB7YW55fSBSZXR1cm5zIHRoZSB0cmFuc2Zvcm1lZCByZXNwb25zZS5cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byB0cmFuc2Zyb20gdGhlIHJlc3BvbnNlIGVycm9yLiBUaGUgcmV0dXJuIHZhbHVlIG9mIHRoaXMgZnVuY3Rpb24gd2lsbCBiZSBwYXNzZWQgdG8gdGhlIGBvbmVycm9yYFxuICogY2FsbGJhY2suXG4gKlxuICogQGNhbGxiYWNrIFRyYW5zZm9ybUVycm9yRnVuY3Rpb25cbiAqIEBwYXJhbSB7c3RyaW5nfSByZXF1ZXN0VHlwZSBUaGUgcmVxdWVzdCB0eXBlLCBgSFRUUF9SRVFVRVNUYCBvciBgSlNPTlBfUkVRVUVTVGAuXG4gKiBAcGFyYW0ge0h0dHBSZXNwb25zZUVycm9yfEpTT05QUmVzcG9uc2VFcnJvcn0gZXJyb3IgVGhlIHJlc3BvbnNlIGVycm9yLlxuICogQHJldHVybnMge2FueX0gUmV0dXJucyB0aGUgdHJhbnNmb3JtZWQgcmVzcG9uc2UgZXJyb3IuXG4gKi9cbiIsInZhciBSZXF1ZXN0ID0gcmVxdWlyZSg5KTtcbnZhciBjb25zdGFudHMgPSByZXF1aXJlKDI1KTtcbnZhciBpbmhlcml0cyA9IHJlcXVpcmUoMzIpO1xudmFyIGJ1aWxkVVJMID0gcmVxdWlyZSgyMyk7XG52YXIgaGFuZGxlT3B0aW9ucyA9IHJlcXVpcmUoMzApO1xudmFyIGNhbGxSZXF1ZXN0Q3JlYXRlZENhbGxiYWNrID0gcmVxdWlyZSgyNCk7XG52YXIgYWRkRXZlbnRMaXN0ZW5lcnMgPSByZXF1aXJlKDEyKTtcbnZhciBoYW5kbGVYaHJQcm9wcyA9IHJlcXVpcmUoMTcpO1xudmFyIGhhbmRsZUhlYWRlcnMgPSByZXF1aXJlKDE1KTtcbnZhciBoYW5kbGVSZXF1ZXN0Qm9keSA9IHJlcXVpcmUoMTYpO1xudmFyIGNhbGxYaHJIb29rID0gcmVxdWlyZSgxNCk7XG5cbi8qKlxuICogaHR0cCByZXF1ZXN0LlxuICpcbiAqIEBjbGFzc1xuICogQGV4dGVuZHMge1JlcXVlc3R9XG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcGFyYW0ge1JlcXVlc3RTdWNjZXNzQ2FsbGJhY2t9IG9uc3VjY2VzcyBUaGUgY2FsbGJhY2sgdG8gY2FsbCBvbiBzdWNjZXNzLlxuICogQHBhcmFtIHtSZXF1ZXN0RXJyb3JDYWxsYmFja30gb25lcnJvciBUaGUgY2FsbGJhY2sgdG8gY2FsbCBvbiBlcnJvci5cbiAqL1xuZnVuY3Rpb24gSHR0cFJlcXVlc3Qob3B0aW9ucywgb25zdWNjZXNzLCBvbmVycm9yKSB7XG4gICAgdmFyIHhocjtcbiAgICB2YXIgYm9keTtcbiAgICB2YXIgdXJsO1xuXG4gICAgLy8gQ2FsbCB0aGUgc3VwZXIgY29uc3RydWN0b3IuXG4gICAgUmVxdWVzdC5jYWxsKHRoaXMsIGNvbnN0YW50cy5IVFRQX1JFUVVFU1QsIG9wdGlvbnMsIG9uc3VjY2Vzcywgb25lcnJvcik7XG5cbiAgICAvLyBDYWxsIGBvcHRpb25zLmhhbmRsZU9wdGlvbnNgIHRvIGhhbmRsZSBvcHRpb25zLlxuICAgIGhhbmRsZU9wdGlvbnMob3B0aW9ucyk7XG5cbiAgICB4aHIgPSB0aGlzLnhociA9IG9wdGlvbnMuY3JlYXRlWEhSLmNhbGwobnVsbCwgb3B0aW9ucyk7XG4gICAgYm9keSA9IGhhbmRsZVJlcXVlc3RCb2R5KG9wdGlvbnMpO1xuICAgIHVybCA9IGJ1aWxkVVJMKG9wdGlvbnMpO1xuXG4gICAgLy8gU2V0IHByb3BlcnRpZXMgdG8gdGhlIHhoci5cbiAgICBoYW5kbGVYaHJQcm9wcyh4aHIsIG9wdGlvbnMpO1xuXG4gICAgLy8gQ2FsbCBvblhockNyZWF0ZWQuXG4gICAgY2FsbFhockhvb2sob3B0aW9ucy5vblhockNyZWF0ZWQsIHhociwgb3B0aW9ucyk7XG5cbiAgICAvLyBPcGVuIHRoZSByZXF1ZXN0LlxuICAgIHhoci5vcGVuKG9wdGlvbnMubWV0aG9kIHx8ICdHRVQnLCB1cmwsIHRydWUsIG9wdGlvbnMudXNlcm5hbWUsIG9wdGlvbnMucGFzc3dvcmQpO1xuXG4gICAgLy8gQWRkIGV2ZW50IGxpc3RlbmVycy5cbiAgICBhZGRFdmVudExpc3RlbmVycyh0aGlzKTtcblxuICAgIC8vIENhbGwgb25YaHJPcGVuZWQuXG4gICAgY2FsbFhockhvb2sob3B0aW9ucy5vblhock9wZW5lZCwgeGhyLCBvcHRpb25zKTtcblxuICAgIC8vIEhhbmxkZSBoZWFkZXJzLlxuICAgIGhhbmRsZUhlYWRlcnMoeGhyLCBvcHRpb25zKTtcblxuICAgIC8vIFNlbmQgdGhlIGJvZHkgdG8gdGhlIHNlcnZlci5cbiAgICB4aHIuc2VuZChib2R5KTtcblxuICAgIC8vIENhbGwgb25YaHJTZW50LlxuICAgIGNhbGxYaHJIb29rKG9wdGlvbnMub25YaHJTZW50LCB4aHIsIG9wdGlvbnMpO1xuXG4gICAgLy8gQ2FsbCBvblJlcXVlc3RDcmVhdGVkXG4gICAgY2FsbFJlcXVlc3RDcmVhdGVkQ2FsbGJhY2sob3B0aW9ucywgdGhpcyk7XG59XG5cbmluaGVyaXRzKEh0dHBSZXF1ZXN0LCBSZXF1ZXN0KTtcblxubW9kdWxlLmV4cG9ydHMgPSBIdHRwUmVxdWVzdDtcbiIsIi8qKlxuICogSHR0cFJlc3BvbnNlIG1vZHVsZS5cbiAqXG4gKiBAbW9kdWxlIGNsYXNzL0h0dHBSZXNwb25zZVxuICovXG5cbnZhciBSZXNwb25zZSA9IHJlcXVpcmUoMTApO1xudmFyIGluaGVyaXRzID0gcmVxdWlyZSgzMik7XG52YXIgYWRkQ3VzdG9tUGFyc2VyID0gcmVxdWlyZSgyMik7XG5cbi8qKlxuICogVGhlIEh0dHBSZXNwb25zZSBjbGFzcy5cbiAqXG4gKiBAY2xhc3NcbiAqIEBwYXJhbSB7SHR0cFJlcXVlc3R9IHJlcXVlc3QgVGhlIGh0dHAgcmVxdWVzdC5cbiAqL1xuZnVuY3Rpb24gSHR0cFJlc3BvbnNlKHJlcXVlc3QpIHtcbiAgICBSZXNwb25zZS5jYWxsKHRoaXMsIHJlcXVlc3QpO1xuICAgIGFkZEN1c3RvbVBhcnNlcih0aGlzLCByZXF1ZXN0Lm9wdGlvbnMsICdodHRwUmVzcG9uc2VQYXJzZXInKTtcbn1cblxuaW5oZXJpdHMoSHR0cFJlc3BvbnNlLCBSZXNwb25zZSk7XG5cbm1vZHVsZS5leHBvcnRzID0gSHR0cFJlc3BvbnNlO1xuIiwidmFyIFJlc3BvbnNlRXJyb3IgPSByZXF1aXJlKDExKTtcbnZhciBpbmhlcml0cyA9IHJlcXVpcmUoMzIpO1xudmFyIGFkZEN1c3RvbVBhcnNlciA9IHJlcXVpcmUoMjIpO1xuXG4vKipcbiAqIEBjbGFzc1xuICogQHBhcmFtIHtzdHJpbmd9IGNvZGUgVGhlIGVycm9yIGNvZGUuXG4gKiBAcGFyYW0ge0h0dHBSZXF1ZXN0fSByZXF1ZXN0IFRoZSBodHRwIHJlcXVlc3QuXG4gKi9cbmZ1bmN0aW9uIEh0dHBSZXNwb25zZUVycm9yKGNvZGUsIHJlcXVlc3QpIHtcbiAgICBSZXNwb25zZUVycm9yLmNhbGwodGhpcywgY29kZSwgcmVxdWVzdCk7XG4gICAgYWRkQ3VzdG9tUGFyc2VyKHRoaXMsIHJlcXVlc3Qub3B0aW9ucywgJ2h0dHBSZXNwb25zZUVycm9yUGFyc2VyJyk7XG59XG5cbmluaGVyaXRzKEh0dHBSZXNwb25zZUVycm9yLCBSZXNwb25zZUVycm9yKTtcblxubW9kdWxlLmV4cG9ydHMgPSBIdHRwUmVzcG9uc2VFcnJvcjtcbiIsInZhciBSZXF1ZXN0ID0gcmVxdWlyZSg5KTtcbnZhciBjb25zdGFudHMgPSByZXF1aXJlKDI1KTtcbnZhciBpbmhlcml0cyA9IHJlcXVpcmUoMzIpO1xudmFyIGhhbmRsZU9wdGlvbnMgPSByZXF1aXJlKDMwKTtcbnZhciBjYWxsUmVxdWVzdENyZWF0ZWRDYWxsYmFjayA9IHJlcXVpcmUoMjQpO1xudmFyIGFkZEV2ZW50TGlzdGVuZXJzID0gcmVxdWlyZSgxOCk7XG52YXIgYnVpbGRDYWxsYmFja05hbWUgPSByZXF1aXJlKDE5KTtcbnZhciBoYW5kbGVTY3JpcHRDb3JzID0gcmVxdWlyZSgyMSk7XG52YXIgYnVpbGRTY3JpcHRTcmMgPSByZXF1aXJlKDIwKTtcblxuLyoqXG4gKiBKU09OUCByZXF1ZXN0LlxuICpcbiAqIEBjbGFzc1xuICogQGV4dGVuZHMge1JlcXVlc3R9XG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcGFyYW0ge1JlcXVlc3RTdWNjZXNzQ2FsbGJhY2t9IG9uc3VjY2VzcyBUaGUgY2FsbGJhY2sgdG8gY2FsbCBvbiBzdWNjZXNzLlxuICogQHBhcmFtIHtSZXF1ZXN0RXJyb3JDYWxsYmFja30gb25lcnJvciBUaGUgY2FsbGJhY2sgdG8gY2FsbCBvbiBlcnJvci5cbiAqL1xuZnVuY3Rpb24gSlNPTlBSZXF1ZXN0KG9wdGlvbnMsIG9uc3VjY2Vzcywgb25lcnJvcikge1xuICAgIHZhciBzcmM7XG4gICAgdmFyIHNjcmlwdDtcbiAgICB2YXIgY2FsbGJhY2tOYW1lO1xuICAgIHZhciBjb250YWluZXJOb2RlO1xuXG4gICAgUmVxdWVzdC5jYWxsKHRoaXMsIGNvbnN0YW50cy5KU09OUF9SRVFVRVNULCBvcHRpb25zLCBvbnN1Y2Nlc3MsIG9uZXJyb3IpO1xuXG4gICAgLy8gQ2FsbCBgb3B0aW9ucy5oYW5kbGVPcHRpb25zYCB0byBoYW5kbGUgb3B0aW9ucy5cbiAgICBoYW5kbGVPcHRpb25zKG9wdGlvbnMpO1xuXG4gICAgc2NyaXB0ID0gdGhpcy5zY3JpcHQgPSBvcHRpb25zLmNyZWF0ZVNjcmlwdC5jYWxsKG51bGwsIG9wdGlvbnMpO1xuICAgIGNvbnRhaW5lck5vZGUgPSBvcHRpb25zLmpzb25wQ29udGFpbmVyTm9kZS5jYWxsKG51bGwsIG9wdGlvbnMpO1xuICAgIGNhbGxiYWNrTmFtZSA9IGJ1aWxkQ2FsbGJhY2tOYW1lKG9wdGlvbnMpO1xuICAgIHNyYyA9IGJ1aWxkU2NyaXB0U3JjKG9wdGlvbnMsIGNhbGxiYWNrTmFtZSk7XG5cbiAgICAvLyBTZXQgdGhlIHNyYyBhdHRyaWJ1dGUuXG4gICAgc2NyaXB0LnNldEF0dHJpYnV0ZSgnc3JjJywgc3JjKTtcblxuICAgIC8vIEhhbmRsZSBgb3B0aW9ucy5jb3JzYC5cbiAgICBoYW5kbGVTY3JpcHRDb3JzKHNjcmlwdCwgb3B0aW9ucyk7XG5cbiAgICAvLyBBZGQgZXZlbnQgbGlzdGVuZXJzLlxuICAgIGFkZEV2ZW50TGlzdGVuZXJzKHRoaXMsIGNhbGxiYWNrTmFtZSk7XG5cbiAgICAvLyBJbmplY3QgdGhlIHNjcmlwdCBub2RlLlxuICAgIGNvbnRhaW5lck5vZGUuYXBwZW5kQ2hpbGQoc2NyaXB0KTtcblxuICAgIC8vIENhbGwgb25SZXF1ZXN0Q3JlYXRlZC5cbiAgICBjYWxsUmVxdWVzdENyZWF0ZWRDYWxsYmFjayhvcHRpb25zLCB0aGlzKTtcbn1cblxuaW5oZXJpdHMoSlNPTlBSZXF1ZXN0LCBSZXF1ZXN0KTtcblxubW9kdWxlLmV4cG9ydHMgPSBKU09OUFJlcXVlc3Q7XG4iLCIvKipcbiAqIEpTT05QUmVzcG9uc2UgbW9kdWxlLlxuICpcbiAqIEBtb2R1bGUgY2xhc3MvSlNPTlBSZXNwb25zZVxuICovXG5cbnZhciBSZXNwb25zZSA9IHJlcXVpcmUoMTApO1xudmFyIGluaGVyaXRzID0gcmVxdWlyZSgzMik7XG52YXIgYWRkQ3VzdG9tUGFyc2VyID0gcmVxdWlyZSgyMik7XG5cbi8qKlxuICogVGhlIEpTT05QUmVzcG9uc2UgY2xhc3MuXG4gKlxuICogQGNsYXNzXG4gKiBAcGFyYW0ge0pTT05SZXF1ZXN0fSByZXF1ZXN0IFRoZSBodHRwIHJlcXVlc3QuXG4gKi9cbmZ1bmN0aW9uIEpTT05QUmVzcG9uc2UocmVxdWVzdCkge1xuICAgIFJlc3BvbnNlLmNhbGwodGhpcywgcmVxdWVzdCk7XG4gICAgYWRkQ3VzdG9tUGFyc2VyKHRoaXMsIHJlcXVlc3Qub3B0aW9ucywgJ2pzb25wUmVzcG9uc2VQYXJzZXInKTtcbn1cblxuaW5oZXJpdHMoSlNPTlBSZXNwb25zZSwgUmVzcG9uc2UpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEpTT05QUmVzcG9uc2U7XG4iLCJ2YXIgUmVzcG9uc2VFcnJvciA9IHJlcXVpcmUoMTEpO1xudmFyIGluaGVyaXRzID0gcmVxdWlyZSgzMik7XG52YXIgYWRkQ3VzdG9tUGFyc2VyID0gcmVxdWlyZSgyMik7XG5cbi8qKlxuICogQGNsYXNzXG4gKiBAcGFyYW0ge3N0cmluZ30gY29kZSBUaGUgZXJyb3IgY29kZS5cbiAqIEBwYXJhbSB7SlNPTlBSZXF1ZXN0fSByZXF1ZXN0IFRoZSBKU09OUCByZXF1ZXN0LlxuICovXG5mdW5jdGlvbiBKU09OUFJlc3BvbnNlRXJyb3IoY29kZSwgcmVxdWVzdCkge1xuICAgIFJlc3BvbnNlRXJyb3IuY2FsbCh0aGlzLCBjb2RlLCByZXF1ZXN0KTtcbiAgICBhZGRDdXN0b21QYXJzZXIodGhpcywgcmVxdWVzdC5vcHRpb25zLCAnanNvbnBSZXNwb25zZUVycm9yUGFyc2VyJyk7XG59XG5cbmluaGVyaXRzKFJlc3BvbnNlRXJyb3IsIEpTT05QUmVzcG9uc2VFcnJvcik7XG5cbm1vZHVsZS5leHBvcnRzID0gSlNPTlBSZXNwb25zZUVycm9yO1xuIiwidmFyIHV1aWQgPSByZXF1aXJlKDM1KTtcblxuLyoqXG4gKiBUaGUgYmFzZSBSZXFldXN0IGNsYXNzLlxuICpcbiAqIEBjbGFzc1xuICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgVGhlIHR5cGUgb2YgcmVxdWVzdCwgY2FuIGJlIGBIVFRQX1JFUVVFU1RgIG9yIGBKU09OUF9SRVFVRVNUYC5cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEBwYXJhbSB7UmVxdWVzdFN1Y2Nlc3NDYWxsYmFja30gb25zdWNjZXNzIFRoZSBjYWxsYmFjayB0byBjYWxsIG9uIHN1Y2Nlc3MuXG4gKiBAcGFyYW0ge1JlcXVlc3RFcnJvckNhbGxiYWNrfSBvbmVycm9yIFRoZSBjYWxsYmFjayB0byBjYWxsIG9uIGVycm9yLlxuICovXG5mdW5jdGlvbiBSZXF1ZXN0KHR5cGUsIG9wdGlvbnMsIG9uc3VjY2Vzcywgb25lcnJvcikge1xuICAgIC8qKlxuICAgICAqIElmIHRoZXJlIGlzIGFuIGVycm9yIGhhcHBlbmQsIHRoZSBgZXJyb3JgIGlzIGEgc3RyaW5nIHJlcHJzZW5ndGluZyB0aGUgdHlwZSBvZiB0aGUgZXJyb3IuIElmIHRoZXJlIGlzIG5vXG4gICAgICogZXJyb3IsIHRoZSB2YWx1ZSBvZiBgZXJyb3JgIGlzIGBudWxsYC5cbiAgICAgKi9cbiAgICB0aGlzLmVycm9yID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFRoZSBgWE1MSHR0cFJlcXVlc3RgIHdlIHVzZSB3aGVuIHNlbmRpbmcgaHR0cCByZXF1ZXN0LlxuICAgICAqL1xuICAgIHRoaXMueGhyID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFRoZSBgSFRNTFNjcmlwdEVsZW1lbnRgIHdlIHVzZSB3aGVuIHNlbmRpbmcgSlNPTlAgcmVxdWVzdC5cbiAgICAgKi9cbiAgICB0aGlzLnNjcmlwdCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBXaGV0aGVyIHRoZSByZXF1ZXN0IGlzIGZpbmlzaGVkLlxuICAgICAqL1xuICAgIHRoaXMuZmluaXNoZWQgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIFRoZSByZXNwb25zZSBKU09OIGRhdGEgb2YgdGhlIEpTT05QIHJlcXVlc3QuXG4gICAgICovXG4gICAgdGhpcy5yZXNwb25zZUpTT04gPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQW4gdW5pcXVlIGlkIGZvciB0aGlzIHJlcXVlc3QuXG4gICAgICovXG4gICAgdGhpcy5yZXF1ZXN0SWQgPSB1dWlkKCk7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdHlwZSBvZiByZXF1ZXN0LCBjYW4gYmUgYEhUVFBfUkVRVUVTVGAgb3IgYEpTT05QX1JFUVVFU1RgLlxuICAgICAqL1xuICAgIHRoaXMucmVxdWVzdFR5cGUgPSB0eXBlO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAgICAgKi9cbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuXG4gICAgLyoqXG4gICAgICogVGhlIG5hbWUgb2YgdGhlIGZ1bmN0aW9uIHRoYXQgY3JlYXRlIHRoaXMgcmVxdWVzdC4gQ2FuIGJlIGBzZW5kYCwgYGZldGNoYCwgYGdldEpPU05QYCwgYGZldGNoSlNPTlBgLiBUaGlzIHZhbHVlXG4gICAgICogaXMgc2V0IGJ5IHRoZSBsaWJyYXkgaXRzZWxmLlxuICAgICAqL1xuICAgIHRoaXMucmVxdWVzdEZ1bmN0aW9uTmFtZSA9IG9wdGlvbnMucmVxdWVzdEZ1bmN0aW9uTmFtZTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBgQ2FuY2VsQ29udHJvbGxlcmAgdGhhdCB1c2VkIHRvIGNhbmNlbCB0aGlzIHJlcXVlc3QuIFdlIG5ldmVyIHVzZSB0aGlzIHByb3BlcnR5IGludGVybmFsbHksIGp1c3QgaG9sZGluZyB0aGVcbiAgICAgKiBpbmZvcm1hdGlvbiBpbiBjYXNlIHRoYXQgdGhlIHVzZXIgbmVlZHMuXG4gICAgICovXG4gICAgdGhpcy5jb250cm9sbGVyID0gb3B0aW9ucy5jb250cm9sbGVyIHx8IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgY2FsbGJhY2sgdG8gY2FsbCBvbiBzdWNjZXNzLlxuICAgICAqL1xuICAgIHRoaXMub25zdWNjZXNzID0gb25zdWNjZXNzIHx8IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgY2FsbGJhY2sgdG8gY2FsbCBvbiBlcnJvci5cbiAgICAgKi9cbiAgICB0aGlzLm9uZXJyb3IgPSBvbmVycm9yIHx8IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBTZXQgdGhlIHJlcXVlc3QgdHlwZSBiYWNrLlxuICAgICAqL1xuICAgIG9wdGlvbnMucmVxdWVzdFR5cGUgPSB0eXBlO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFJlcXVlc3Q7XG4iLCIvKipcbiAqIFJlcHJlc2VudHMgYSByZXNwb25zZS5cbiAqXG4gKiBAcGFyYW0ge1JlcXVlc3R9IHJlcXVlc3QgVGhlIGluc3RhbmNlIG9mIGBSZXF1ZXN0YC5cbiAqL1xuZnVuY3Rpb24gUmVzcG9uc2UocmVxdWVzdCkge1xuICAgIC8qKlxuICAgICAqIEB0eXBlIHtSZXF1ZXN0fVxuICAgICAqL1xuICAgIHRoaXMucmVxdWVzdCA9IHJlcXVlc3Q7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gUmVzcG9uc2U7XG4iLCJ2YXIgZXJyb3JNZXNzYWdlcyA9IHtcbiAgICBFUlJfQUJPUlRFRDogJ1JlcXVlc3QgYWJvcnRlZCcsXG4gICAgRVJSX0NBTkNFTExFRDogJ1JlcXVlc3QgY2FuY2VsbGVkJyxcbiAgICBFUlJfTkVUV09SSzogJ05ldHdvcmsgZXJyb3InLFxuICAgIEVSUl9SRVNQT05TRTogJ1Jlc3BvbnNlIGVycm9yJyxcbiAgICBFUlJfVElNRU9VVDogJ1JlcXVlc3QgdGltZW91dCdcbn07XG5cbi8qKlxuICogUmVwcmVzZW50cyByZXNwb25zZSBlcnJvci5cbiAqXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSB7c3RyaW5nfSBjb2RlIFRoZSBlcnJvciBjb2RlLlxuICogQHBhcmFtIHtSZXF1ZXN0fSByZXF1ZXN0IFRoZSByZXF1ZXN0LlxuICovXG5mdW5jdGlvbiBSZXNwb25zZUVycm9yKGNvZGUsIHJlcXVlc3QpIHtcbiAgICB2YXIgbWVzc2FnZTtcblxuICAgIGNvZGUgPSBjb2RlIHx8ICdFUlJfVU5LTk9XTic7XG5cbiAgICBpZiAoZXJyb3JNZXNzYWdlc1tjb2RlXSkge1xuICAgICAgICBtZXNzYWdlID0gZXJyb3JNZXNzYWdlc1tjb2RlXTtcbiAgICB9XG5cbiAgICBpZiAoIW1lc3NhZ2UpIHtcbiAgICAgICAgbWVzc2FnZSA9ICdVbmtub3duIGVycm9yICcgKyBjb2RlO1xuICAgIH1cblxuICAgIHJlcXVlc3QuZXJyb3IgPSBjb2RlO1xuXG4gICAgdGhpcy5jb2RlID0gY29kZTtcbiAgICB0aGlzLnJlcXVlc3QgPSByZXF1ZXN0O1xuICAgIHRoaXMubWVzc2FnZSA9IG1lc3NhZ2U7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gUmVzcG9uc2VFcnJvcjtcbiIsInZhciBpc0Z1bmN0aW9uID0gcmVxdWlyZSgzOCk7XG52YXIgSHR0cFJlc3BvbnNlID0gcmVxdWlyZSg0KTtcbnZhciBhZGRUaW1lb3V0TGlzdGVuZXIgPSByZXF1aXJlKDEzKTtcbnZhciBmaXJlQ2FsbGJhY2tzID0gcmVxdWlyZSgyOSk7XG52YXIgbm9vcCA9IHJlcXVpcmUoMzMpO1xudmFyIGNvbnN0YW50cyA9IHJlcXVpcmUoMjUpO1xudmFyIEVSUl9BQk9SVEVEICAgPSBjb25zdGFudHMuRVJSX0FCT1JURUQ7XG52YXIgRVJSX0NBTkNFTExFRCA9IGNvbnN0YW50cy5FUlJfQ0FOQ0VMTEVEO1xudmFyIEVSUl9ORVRXT1JLICAgPSBjb25zdGFudHMuRVJSX05FVFdPUks7XG52YXIgRVJSX1JFU1BPTlNFICA9IGNvbnN0YW50cy5FUlJfUkVTUE9OU0U7XG52YXIgRVJSX1RJTUVPVVQgICA9IGNvbnN0YW50cy5FUlJfVElNRU9VVDtcblxuLyoqXG4gKiBBZGQgZXZlbnQgbGlzdGVuZXJzIHRvIHRoZSBodHRwIHJlcXVlc3QuIFRoaXMgZnVuY3Rpb24gd2lsbCBvdmVyd2l0ZSB0aGUgYGNhbmNlbGAgbWV0aG9kIG9uIHRoZSBnaXZlbiBgSHR0cFJlcWVzdGBcbiAqIGluc3RhbmNlLlxuICpcbiAqIEBwYXJhbSB7SHR0cFJlcXVlc3R9IHJlcXVlc3QgVGhlIGh0dHAgcmVxdWVzdCB0byBhZGQgZXZlbnQgbGlzdGVuZXJzLlxuICovXG5mdW5jdGlvbiBhZGRFdmVudExpc3RlbmVycyhyZXF1ZXN0KSB7XG4gICAgdmFyIHhociA9IHJlcXVlc3QueGhyO1xuICAgIHZhciBvcHRpb25zID0gcmVxdWVzdC5vcHRpb25zO1xuICAgIHZhciByZXF1ZXN0VHlwZSA9IHJlcXVlc3QucmVxdWVzdFR5cGU7XG4gICAgdmFyIHJlc3BvbnNlID0gbmV3IEh0dHBSZXNwb25zZShyZXF1ZXN0KTtcbiAgICB2YXIgaXNSZXNwb25zZU9rID0gb3B0aW9ucy5pc1Jlc3BvbnNlT2s7XG4gICAgdmFyIGNsZWFyVGltZW91dEV2ZW50ID0gbnVsbDtcbiAgICB2YXIgdGltZW91dCA9IHBhcnNlSW50KG9wdGlvbnMudGltZW91dCwgMTApIHx8IDA7XG5cbiAgICAvKipcbiAgICAgKiBDYW5jZWwgdGhlIHJlcXVlc3QuXG4gICAgICovXG4gICAgdmFyIGNhbmNlbCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgY2xlYXJFdmVudHMoKTtcbiAgICAgICAgaWYgKHhoci5hYm9ydCkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICB4aHIuYWJvcnQoKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAvLyBlbXB0eVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGZpbmlzaChFUlJfQ0FOQ0VMTEVEKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogVGhlIGZ1bmN0aW9uIHRvIGNsZWFyIGV2ZW50cy5cbiAgICAgKi9cbiAgICB2YXIgY2xlYXJFdmVudHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8vIFNldCBjbGVhckV2ZW50cyB0byB0aGUgbm9vcCBmdW5jdGlvbi5cbiAgICAgICAgY2xlYXJFdmVudHMgPSBub29wO1xuXG4gICAgICAgIHhoci5vbmFib3J0ID0gbnVsbDtcbiAgICAgICAgeGhyLm9uZXJyb3IgPSBudWxsO1xuICAgICAgICB4aHIub25yZWFkeXN0YXRlY2hhbmdlID0gbnVsbDtcbiAgICAgICAgeGhyLm9udGltZW91dCA9IG51bGw7XG5cbiAgICAgICAgaWYgKGNsZWFyVGltZW91dEV2ZW50KSB7XG4gICAgICAgICAgICBjbGVhclRpbWVvdXRFdmVudCgpO1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0RXZlbnQgPSBudWxsO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBmdW5jdGlvbiBmaW5pc2ggdGhlIHJlcXVlc3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY29kZSBUaGUgZXJyb3IgY29kZSBvbiBlcnJvci4gSWYgbm8gZXJyb3Igb2NjdXJlZCwgdGhlIGNvZGUgaXMgYG51bGxgLlxuICAgICAqL1xuICAgIHZhciBmaW5pc2ggPSBmdW5jdGlvbiAoY29kZSkge1xuICAgICAgICAvLyBTZXQgZmluaXNoIHRvIHRoZSBub29wIGZ1bmN0aW9uLlxuICAgICAgICBmaW5pc2ggPSBub29wO1xuXG4gICAgICAgIC8vIFNldCBjYW5jZWwgdG8gdGhlIG5vb3AgZnVuY3Rpb24uXG4gICAgICAgIGNhbmNlbCA9IG5vb3A7XG5cbiAgICAgICAgLy8gTWFyayB0aGlzIHJlcXVlc3QgYXMgZmluaXNoZWQuXG4gICAgICAgIHJlcXVlc3QuZmluaXNoZWQgPSB0cnVlO1xuXG4gICAgICAgIC8vIENsZWFyIGV2ZW50cy5cbiAgICAgICAgY2xlYXJFdmVudHMoKTtcblxuICAgICAgICAvLyBGaXJlIGNhbGxiYWNrcy5cbiAgICAgICAgZmlyZUNhbGxiYWNrcyhjb2RlLCByZXNwb25zZSk7XG4gICAgfTtcblxuICAgIHhoci5vbmFib3J0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBmaW5pc2goRVJSX0FCT1JURUQpO1xuICAgIH07XG5cbiAgICB4aHIub25lcnJvciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZmluaXNoKEVSUl9ORVRXT1JLKTtcbiAgICB9O1xuXG4gICAgeGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKCt4aHIucmVhZHlTdGF0ZSA9PT0gNCkge1xuICAgICAgICAgICAgaWYgKGlzRnVuY3Rpb24oaXNSZXNwb25zZU9rKSkge1xuICAgICAgICAgICAgICAgIGlmIChpc1Jlc3BvbnNlT2socmVxdWVzdFR5cGUsIHJlc3BvbnNlKSkge1xuICAgICAgICAgICAgICAgICAgICBmaW5pc2gobnVsbCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgZmluaXNoKEVSUl9SRVNQT05TRSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBmaW5pc2gobnVsbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQ2FuY2VsIHRoZSByZXF1ZXN0LlxuICAgICAqL1xuICAgIHJlcXVlc3QuY2FuY2VsID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBjYW5jZWwoKTtcbiAgICB9O1xuXG4gICAgLy8gQWRkIHRpbWVvdXQgbGlzdGVuZXJcbiAgICBpZiAodGltZW91dCA+IDApIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0RXZlbnQgPSBhZGRUaW1lb3V0TGlzdGVuZXIoeGhyLCB0aW1lb3V0LCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBjbGVhckV2ZW50cygpO1xuICAgICAgICAgICAgaWYgKHhoci5hYm9ydCkge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIHhoci5hYm9ydCgpO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gZW1wdHlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmaW5pc2goRVJSX1RJTUVPVVQpO1xuICAgICAgICB9KTtcbiAgICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYWRkRXZlbnRMaXN0ZW5lcnM7XG4iLCIvKipcbiAqIEFkZCB0aW1lb3V0IGV2ZW50IGxpc3RlbmVyIG9uIHRoZSBYSFIgb2JqZWN0LlxuICpcbiAqIEBwYXJhbSB7WE1MSHR0cFJlcXVlc3R9IHhociBUaGUgWEhSIHRvIGFkZCB0aW1lb3V0IGV2ZW50IGxpc3RlbmVyLlxuICogQHBhcmFtIHtudW1iZXJ9IHRpbWVvdXQgVGhlIHRpbWUgdG8gd2FpdCBpbiBtaWxsaXNlY29uZHMuXG4gKiBAcGFyYW0geygpID0+IHZvaWR9IGxpc3RlbmVyIFRoZSB0aW1lb3V0IGNhbGxiYWNrLlxuICogQHJldHVybnMgeygpID0+IHZvaWQpfSBSZXR1cm5zIGEgZnVuY3Rpb24gdG8gcmVtb3ZlIHRoZSB0aW1lb3V0IGV2ZW50IGxpc3RlbmVyLlxuICovXG5mdW5jdGlvbiBhZGRUaW1lb3V0TGlzdGVuZXIoeGhyLCB0aW1lb3V0LCBsaXN0ZW5lcikge1xuICAgIHZhciB0aW1lb3V0SWQgPSBudWxsO1xuICAgIHZhciBzdXBwb3J0VGltZW91dCA9ICd0aW1lb3V0JyBpbiB4aHIgJiYgJ29udGltZW91dCcgaW4geGhyO1xuXG4gICAgaWYgKHN1cHBvcnRUaW1lb3V0KSB7XG4gICAgICAgIHhoci50aW1lb3V0ID0gdGltZW91dDtcbiAgICAgICAgeGhyLm9udGltZW91dCA9IGxpc3RlbmVyO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRpbWVvdXRJZCA9IHNldFRpbWVvdXQobGlzdGVuZXIsIHRpbWVvdXQpO1xuICAgIH1cblxuICAgIC8vIENhbGwgdGhpcyBmdW5jdGlvbiB0byByZW1vdmUgdGltZW91dCBldmVudCBsaXN0ZW5lclxuICAgIGZ1bmN0aW9uIGNsZWFyVGltZW91dEV2ZW50KCkge1xuICAgICAgICBpZiAoeGhyKSB7XG4gICAgICAgICAgICBpZiAodGltZW91dElkID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgeGhyLm9udGltZW91dCA9IG51bGw7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgeGhyID0gbnVsbDtcbiAgICAgICAgICAgIGxpc3RlbmVyID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBjbGVhclRpbWVvdXRFdmVudDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBhZGRUaW1lb3V0TGlzdGVuZXI7XG4iLCJ2YXIgaXNGdW5jdGlvbiA9IHJlcXVpcmUoMzgpO1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBjYWxsIHhociBob29rIGZ1bmN0aW9uLlxuICpcbiAqIEBwYXJhbSB7WEhSSG9va0Z1bmN0aW9ufSBmdW5jIFRoZSBob29rIGZ1bmN0aW9uIHRvIGNhbGwsIGlmIGl0IGlzIG5vdCBmdW5jdGlvbiwgdGhpcyBob29rIGlzIHNraXBwZWQuXG4gKiBAcGFyYW0ge1hNTEh0dHBSZXFldXN0fSB4aHIgVGhlIGluc3RhbmNlIG9mIGBYTUxIdHRwUmVxZXVzdGAuXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb259IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqL1xuZnVuY3Rpb24gY2FsbFhockhvb2soZnVuYywgeGhyLCBvcHRpb25zKSB7XG4gICAgaWYgKGlzRnVuY3Rpb24oZnVuYykpIHtcbiAgICAgICAgZnVuYyh4aHIsIG9wdGlvbnMpO1xuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBjYWxsWGhySG9vaztcbiIsInZhciBtZXJnZSA9IHJlcXVpcmUoNDApO1xudmFyIGlzUGxhaW5PYmplY3QgPSByZXF1aXJlKDM5KTtcbnZhciBoYXNPd24gPSByZXF1aXJlKDMxKTtcblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gc2V0IHRoZSByZXF1ZXN0IGhlYWRlcnMuXG4gKlxuICogMS4gTWVyZ2UgdGhlIGBvcHRpb25zLm5vQ2FjaGVIZWFkZXJzYCBpZiBuZWVkZWQuXG4gKiAyLiBTZXQgdGhlIHJlcXVlc3QgaGVhZGVycyBpZiBuZWVkZWQuXG4gKlxuICogQHBhcmFtIHtYTUxIdHRwUmVxZXVzdH0geGhyIFRoZSBpbnN0YW5jZSBvZiBgWE1MSHR0cFJlcWV1c3RgLlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9ufSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKi9cbmZ1bmN0aW9uIGhhbmRsZUhlYWRlcnMoeGhyLCBvcHRpb25zKSB7XG4gICAgdmFyIG5hbWU7XG4gICAgdmFyIHZhbHVlO1xuICAgIHZhciBoZWFkZXJzID0gaXNQbGFpbk9iamVjdChvcHRpb25zLmhlYWRlcnMpID8gb3B0aW9ucy5oZWFkZXJzIDoge307XG5cbiAgICBpZiAob3B0aW9ucy5ub0NhY2hlKSB7XG4gICAgICAgIGlmIChpc1BsYWluT2JqZWN0KG9wdGlvbnMubm9DYWNoZUhlYWRlcnMpKSB7XG4gICAgICAgICAgICBoZWFkZXJzID0gbWVyZ2UoaGVhZGVycywgb3B0aW9ucy5ub0NhY2hlSGVhZGVycyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKG5hbWUgaW4gaGVhZGVycykge1xuICAgICAgICBpZiAoaGFzT3duLmNhbGwoaGVhZGVycywgbmFtZSkpIHtcbiAgICAgICAgICAgIHZhbHVlID0gaGVhZGVyc1tuYW1lXTtcbiAgICAgICAgICAgIC8vIE9ubHkgdGhlIG5vbi11bmRlZmluZWQgYW5kIG5vbi1udWxsIGhlYWRlcnMgYXJlIHNldFxuICAgICAgICAgICAgaWYgKHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcihuYW1lLCB2YWx1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBTZXQgdGhlIGhlYWRlcnMgYmFjay5cbiAgICBvcHRpb25zLmhlYWRlcnMgPSBoZWFkZXJzO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGhhbmRsZUhlYWRlcnM7XG4iLCJ2YXIgbWVyZ2UgPSByZXF1aXJlKDQwKTtcbnZhciBpc0Z1bmN0aW9uID0gcmVxdWlyZSgzOCk7XG52YXIgaXNQbGFpbk9iamVjdCA9IHJlcXVpcmUoMzkpO1xudmFyIGhhc093biA9IHJlcXVpcmUoMzEpO1xuXG4vKipcbiAqIEZpbmQgYSBwcm9jZXNzb3IgZnJvbSBgb3B0aW9ucy5odHRwUmVxdWVzdEJvZHlQcm9jZXNzb3JgIHRvIHByb2Nlc3MgdGhlIHJlcXVlc3QgYm9keS5cbiAqXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcmV0dXJucyB7YW55fSBSZXRydW5zIHRoZSBjb250ZW50IHRoYXQgc2VuZCB0byB0aGUgc2VydmVyLlxuICovXG5mdW5jdGlvbiBoYW5kbGVSZXF1ZXN0Qm9keShvcHRpb25zKSB7XG4gICAgdmFyIGk7XG4gICAgdmFyIGw7XG4gICAgdmFyIGtleTtcbiAgICB2YXIgY29udGVudCA9IG51bGw7XG4gICAgdmFyIHByb2Nlc3NvcjtcbiAgICB2YXIgY29udGVudFByb2Nlc3NvcjtcbiAgICB2YXIgY29udGVudFByb2Nlc3NvcnMgPSBbXTtcbiAgICB2YXIgYm9keSA9IG9wdGlvbnMuYm9keTtcbiAgICB2YXIgcHJvY2Vzc29ycyA9IG9wdGlvbnMuaHR0cFJlcXVlc3RCb2R5UHJvY2Vzc29yO1xuICAgIHZhciBoZWFkZXJzID0gaXNQbGFpbk9iamVjdChvcHRpb25zLmhlYWRlcnMpID8gb3B0aW9ucy5oZWFkZXJzIDoge307XG5cbiAgICBpZiAoaXNQbGFpbk9iamVjdChib2R5KSAmJiBpc1BsYWluT2JqZWN0KHByb2Nlc3NvcnMpKSB7XG4gICAgICAgIC8vIEZpbmQgYWxsIHByb2Nlc3NvcnMuXG4gICAgICAgIGZvciAoa2V5IGluIHByb2Nlc3NvcnMpIHtcbiAgICAgICAgICAgIGlmIChoYXNPd24uY2FsbChwcm9jZXNzb3JzLCBrZXkpKSB7XG4gICAgICAgICAgICAgICAgcHJvY2Vzc29yID0gcHJvY2Vzc29yc1trZXldO1xuICAgICAgICAgICAgICAgIGlmIChpc1BsYWluT2JqZWN0KHByb2Nlc3NvcikpIHtcbiAgICAgICAgICAgICAgICAgICAgY29udGVudFByb2Nlc3NvcnMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICBrZXk6IGtleSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGhlYWRlcnM6IHByb2Nlc3Nvci5oZWFkZXJzLFxuICAgICAgICAgICAgICAgICAgICAgICAgcHJpb3JpdHk6IHByb2Nlc3Nvci5wcmlvcml0eSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb2Nlc3NvcjogcHJvY2Vzc29yLnByb2Nlc3NvclxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTb3J0IHRoZSBwcm9jZXNzb3JzIGJ5IGl0cyBwcmlvcml0eS5cbiAgICAgICAgY29udGVudFByb2Nlc3NvcnMuc29ydChmdW5jdGlvbiAoYSwgYikge1xuICAgICAgICAgICAgcmV0dXJuIGIucHJpb3JpdHkgLSBhLnByaW9yaXR5O1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyBGaW5kIHRoZSBmaXJzdCBub24tdW5kZWZpbmVkIGNvbnRlbnQuXG4gICAgICAgIGZvciAoaSA9IDAsIGwgPSBjb250ZW50UHJvY2Vzc29ycy5sZW5ndGg7IGkgPCBsOyBpICs9IDEpIHtcbiAgICAgICAgICAgIHByb2Nlc3NvciA9IGNvbnRlbnRQcm9jZXNzb3JzW2ldO1xuICAgICAgICAgICAgaWYgKGJvZHlbcHJvY2Vzc29yLmtleV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGNvbnRlbnQgPSBib2R5W3Byb2Nlc3Nvci5rZXldO1xuICAgICAgICAgICAgICAgIGNvbnRlbnRQcm9jZXNzb3IgPSBwcm9jZXNzb3I7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBVc2UgdGhlIHByb2Nlc3NvciB0byBwcm9jZXNzIHRoZSBjb250ZW50LlxuICAgICAgICBpZiAoY29udGVudFByb2Nlc3Nvcikge1xuICAgICAgICAgICAgaWYgKGlzUGxhaW5PYmplY3QoY29udGVudFByb2Nlc3Nvci5oZWFkZXJzKSkge1xuICAgICAgICAgICAgICAgIGhlYWRlcnMgPSBtZXJnZSh7fSwgY29udGVudFByb2Nlc3Nvci5oZWFkZXJzLCBoZWFkZXJzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHByb2Nlc3NvciA9IGNvbnRlbnRQcm9jZXNzb3IucHJvY2Vzc29yO1xuICAgICAgICAgICAgaWYgKGlzRnVuY3Rpb24ocHJvY2Vzc29yKSkge1xuICAgICAgICAgICAgICAgIGNvbnRlbnQgPSBwcm9jZXNzb3IoY29udGVudCwgb3B0aW9ucyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBNYWtlIHN1cmUgdGhhdCB0aGUgaGVhZGVycyBpcyBhIHBsYWluIG9iamVjdC5cbiAgICBvcHRpb25zLmhlYWRlcnMgPSBoZWFkZXJzO1xuXG4gICAgcmV0dXJuIGNvbnRlbnQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaGFuZGxlUmVxdWVzdEJvZHk7XG4iLCJ2YXIgaXNQbGFpbk9iamVjdCA9IHJlcXVpcmUoMzkpO1xudmFyIGhhc093biA9IHJlcXVpcmUoMzEpO1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBoYW5sZGUgWE1MSHR0cFJlcXVlc3QgcHJvcGVydGllcy5cbiAqXG4gKiBAcGFyYW0ge1hNTEh0dHBSZXF1ZXN0fSB4aHIgVGhlIGluc3RhbmNlIG9mIGBYTUxIdHRwUmVxdWVzdGAuXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKi9cbmZ1bmN0aW9uIGhhbmRsZVhoclByb3BzKHhociwgb3B0aW9ucykge1xuICAgIHZhciBwcm9wO1xuICAgIHZhciB4aHJQcm9wcyA9IG9wdGlvbnMueGhyUHJvcHM7XG5cbiAgICBpZiAob3B0aW9ucy5jb3JzKSB7XG4gICAgICAgIHhoci53aXRoQ3JlZGVudGlhbHMgPSB0cnVlO1xuICAgIH1cblxuICAgIGlmIChpc1BsYWluT2JqZWN0KHhoclByb3BzKSkge1xuICAgICAgICBmb3IgKHByb3AgaW4geGhyUHJvcHMpIHtcbiAgICAgICAgICAgIGlmIChoYXNPd24uY2FsbCh4aHJQcm9wcywgcHJvcCkpIHtcbiAgICAgICAgICAgICAgICB4aHJbcHJvcF0gPSB4aHJQcm9wc1twcm9wXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBoYW5kbGVYaHJQcm9wcztcbiIsInZhciBpc0Z1bmN0aW9uID0gcmVxdWlyZSgzOCk7XG52YXIgSlNPTlBSZXNwb25zZSA9IHJlcXVpcmUoNyk7XG52YXIgZmlyZUNhbGxiYWNrcyA9IHJlcXVpcmUoMjkpO1xudmFyIG5vb3AgPSByZXF1aXJlKDMzKTtcbnZhciBjb25zdGFudHMgPSByZXF1aXJlKDI1KTtcbnZhciBFUlJfQ0FOQ0VMTEVEID0gY29uc3RhbnRzLkVSUl9DQU5DRUxMRUQ7XG52YXIgRVJSX05FVFdPUksgICA9IGNvbnN0YW50cy5FUlJfTkVUV09SSztcbnZhciBFUlJfUkVTUE9OU0UgID0gY29uc3RhbnRzLkVSUl9SRVNQT05TRTtcbnZhciBFUlJfVElNRU9VVCAgID0gY29uc3RhbnRzLkVSUl9USU1FT1VUO1xuXG4vKipcbiAqIEFkZCBldmVudCBsaXN0ZW5lcnMgdG8gSlNPTlAgcmVxdWVzdC5cbiAqXG4gKiBAcGFyYW0ge0pTT05QUmVxdWVzdH0gcmVxdWVzdCBUaGUgSlNPTlAgcmVxdWVzdC5cbiAqIEBwYXJhbSB7c3RyaW5nfSBjYWxsYmFja05hbWUgVGhlIGNhbGxiYWNrIG5hbWUgdXNlZCB0byBkZWZpbmUgdGhlIGdsb2JhbCBKU09OUCBjYWxsYmFjay5cbiAqL1xuZnVuY3Rpb24gYWRkRXZlbnRMaXN0ZW5lcnMocmVxdWVzdCwgY2FsbGJhY2tOYW1lKSB7XG4gICAgdmFyIHNjcmlwdCA9IHJlcXVlc3Quc2NyaXB0O1xuICAgIHZhciBvcHRpb25zID0gcmVxdWVzdC5vcHRpb25zO1xuICAgIHZhciByZXF1ZXN0VHlwZSA9IHJlcXVlc3QucmVxdWVzdFR5cGU7XG4gICAgdmFyIGlzUmVzcG9uc2VPayA9IG9wdGlvbnMuaXNSZXNwb25zZU9rO1xuICAgIHZhciByZXNwb25zZSA9IG5ldyBKU09OUFJlc3BvbnNlKHJlcXVlc3QpO1xuICAgIHZhciB0aW1lb3V0ID0gcGFyc2VJbnQob3B0aW9ucy50aW1lb3V0IHx8IDAsIDEwKTtcbiAgICB2YXIgdGltZW91dElkID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFRoZSBmdW5jdGlvbiBmaW5pc2ggdGhlIHJlcXVlc3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY29kZSBUaGUgZXJyb3IgY29kZSBvbiBlcnJvci4gSWYgbm8gZXJyb3Igb2NjdXJlZCwgdGhlIGNvZGUgaXMgYG51bGxgLlxuICAgICAqL1xuICAgIHZhciBmaW5pc2ggPSBmdW5jdGlvbiAoY29kZSkge1xuICAgICAgICAvLyBTZXQgZmluaXNoIHRvIHRoZSBubyBvcGVyYXRpb24gZnVuY3Rpb24uXG4gICAgICAgIGZpbmlzaCA9IG5vb3A7XG5cbiAgICAgICAgLy8gTWFyayB0aGlzIHJlcXVlc3QgYXMgZmluaXNoZWQuXG4gICAgICAgIHJlcXVlc3QuZmluaXNoZWQgPSB0cnVlO1xuXG4gICAgICAgIC8vIENsZWFyIGxpc3RlbmVycy5cbiAgICAgICAgd2luZG93W2NhbGxiYWNrTmFtZV0gPSBub29wO1xuICAgICAgICBzY3JpcHQub25lcnJvciA9IG51bGw7XG5cbiAgICAgICAgLy8gQ2xlYXIgdGltZW91dC5cbiAgICAgICAgaWYgKHRpbWVvdXRJZCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXRJZCk7XG4gICAgICAgICAgICB0aW1lb3V0SWQgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gRmlyZSBjYWxsYmFja3MuXG4gICAgICAgIGZpcmVDYWxsYmFja3MoY29kZSwgcmVzcG9uc2UpO1xuICAgIH07XG5cbiAgICAvLyBEZWZpbmUgdGhlIGNhbGxiYWNrIGZ1bmN0aW9uLlxuICAgIHdpbmRvd1tjYWxsYmFja05hbWVdID0gZnVuY3Rpb24gKHJlc3BvbnNlSlNPTikge1xuICAgICAgICByZXF1ZXN0LnJlc3BvbnNlSlNPTiA9IHJlc3BvbnNlSlNPTjtcbiAgICAgICAgaWYgKGlzRnVuY3Rpb24oaXNSZXNwb25zZU9rKSkge1xuICAgICAgICAgICAgaWYgKGlzUmVzcG9uc2VPayhyZXF1ZXN0VHlwZSwgcmVzcG9uc2UpKSB7XG4gICAgICAgICAgICAgICAgZmluaXNoKG51bGwpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBmaW5pc2goRVJSX1JFU1BPTlNFKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZpbmlzaChudWxsKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvLyBDYXRjaCB0aGUgZXJyb3IuXG4gICAgc2NyaXB0Lm9uZXJyb3IgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGZpbmlzaChFUlJfTkVUV09SSyk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIENhbmNlbCB0aGUgcmVxdWVzdC5cbiAgICAgKi9cbiAgICByZXF1ZXN0LmNhbmNlbCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZmluaXNoKEVSUl9DQU5DRUxMRUQpO1xuICAgIH07XG5cbiAgICAvLyBBZGQgdGltZW91dCBsaXN0ZW5lclxuICAgIGlmICghaXNOYU4odGltZW91dCkgJiYgdGltZW91dCA+IDApIHtcbiAgICAgICAgdGltZW91dElkID0gc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBmaW5pc2goRVJSX1RJTUVPVVQpO1xuICAgICAgICB9LCB0aW1lb3V0KTtcbiAgICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYWRkRXZlbnRMaXN0ZW5lcnM7XG4iLCIvKipcbiAqIFRoZSBmdW5jdGlvbiB0byBjcmVhdGUgSlNPTlAgY2FsbGJhY2sgbmFtZS5cbiAqXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBSZXR1cm5zIHRoZSBjYWxsYmFjayBuYW1lLlxuICovXG5mdW5jdGlvbiBidWlsZENhbGxsYmFja05hbWUob3B0aW9ucykge1xuICAgIHZhciBjYWxsYmFja05hbWU7XG5cbiAgICBkbyB7XG4gICAgICAgIGNhbGxiYWNrTmFtZSA9IG9wdGlvbnMuanNvbnBDYWxsYmFja05hbWUuY2FsbChudWxsLCBvcHRpb25zKTtcbiAgICB9IHdoaWxlIChjYWxsYmFja05hbWUgaW4gd2luZG93KTtcblxuICAgIHdpbmRvd1tjYWxsYmFja05hbWVdID0gbnVsbDtcblxuICAgIHJldHVybiBjYWxsYmFja05hbWU7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYnVpbGRDYWxsbGJhY2tOYW1lO1xuIiwidmFyIGJ1aWxkVVJMID0gcmVxdWlyZSgyMyk7XG5cbi8qKlxuICogQnVpbGQgdGhlIEpTT05QIHNjcmlwdCBzcmMuXG4gKlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcGl0b25zLlxuICogQHBhcmFtIHtzdHJpbmd9IGNhbGxiYWNrTmFtZSBUaGUgY2FsbGJhY2sgbmFtZSBvZiB0aGUgSlNPTlAuXG4gKiBAcmV0dXJuIHtzdHJpbmd9IFJldHVybnMgdGhlIHNjcmlwdCBzcmMuXG4gKi9cbmZ1bmN0aW9uIGJ1aWxkU2NyaXB0U3JjKG9wdGlvbnMsIGNhbGxiYWNrTmFtZSkge1xuICAgIHZhciBxdWVyeSA9IG9wdGlvbnMucXVlcnk7XG4gICAgdmFyIGtleSA9IG9wdGlvbnMuanNvbnA7XG4gICAgdmFyIHVybDtcblxuICAgIGlmICghcXVlcnkpIHtcbiAgICAgICAgcXVlcnkgPSB7fTtcbiAgICAgICAgb3B0aW9ucy5xdWVyeSA9IHF1ZXJ5O1xuICAgIH1cblxuICAgIHF1ZXJ5W2tleV0gPSBjYWxsYmFja05hbWU7XG4gICAgdXJsID0gYnVpbGRVUkwob3B0aW9ucyk7XG5cbiAgICByZXR1cm4gdXJsO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGJ1aWxkU2NyaXB0U3JjO1xuIiwiLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gaGFuZGxlIGBvcHRpb25zLmNvcnNgIHNldHRpbmcgd2hlbiBzZW5kaW5nIEpTT05QIHJlcXVlc3RzLiBJZiBgb3B0aW9ucy5jb3JzYCBpcyBgdHJ1ZWAsIHRoZVxuICogYGNyb3Nzb3JpZ2luYCBhdHRyaWJ1dGUgb2YgdGhlIGBzY3JpcHRgIGVsZW1lbnQgd2UgdXNpbmcgaXMgc2V0IHRvIGB1c2UtY3JlZGVudGlhbHNgLlxuICpcbiAqIEBwYXJhbSB7SFRNTFNjcmlwdEVsZW1lbnR9IHNjcmlwdCBUaGUgc2NyaXB0IGVsZW1lbnQuXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKi9cbmZ1bmN0aW9uIGhhbmRsZVNjcmlwdENvcnMoc2NyaXB0LCBvcHRpb25zKSB7XG4gICAgaWYgKG9wdGlvbnMuY29ycykge1xuICAgICAgICBzY3JpcHQuc2V0QXR0cmlidXRlKCdjcm9zc29yaWdpbicsICd1c2UtY3JlZGVudGlhbHMnKTtcbiAgICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaGFuZGxlU2NyaXB0Q29ycztcbiIsInZhciBpc1BsYWluT2JqZWN0ID0gcmVxdWlyZSgzOSk7XG52YXIgaXNGdW5jdGlvbiA9IHJlcXVpcmUoMzgpO1xudmFyIGhhc093biA9IHJlcXVpcmUoMzEpO1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBhZGQgY3VzdG9tIHBhcnNlcnMgdG8gdGhlIGluc3RhbmNlIG9mIGBSZXNwb25zZWAgb3IgYFJlc3BvbnNlRXJyb3JgLlxuICpcbiAqIEBwYXJhbSB7UmVzcG9uc2V8UmVzcG9uc2VFcnJvcn0gdGFyZ2V0IFRoZSB0YXJnZXQgdG8gYWRkIHRoZSBjdXN0b21lIHBhcnNlcnMuXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcGFyYW0ge3N0cmluZ30gb3B0aW9uTmFtZSBUaGUgb3B0aW9uIG5hbWUgdGhlIHBhcnNlcnMgY29udGFpbmVyLlxuICovXG5mdW5jdGlvbiBhZGRDdXN0b21QYXJzZXIodGFyZ2V0LCBvcHRpb25zLCBvcHRpb25OYW1lKSB7XG4gICAgdmFyIHBhcnNlcnMgPSBvcHRpb25zW29wdGlvbk5hbWVdO1xuICAgIHZhciBuYW1lO1xuICAgIHZhciBwYXJzZXI7XG5cbiAgICBpZiAoaXNQbGFpbk9iamVjdChwYXJzZXJzKSkge1xuICAgICAgICBmb3IgKG5hbWUgaW4gcGFyc2Vycykge1xuICAgICAgICAgICAgaWYgKGhhc093bi5jYWxsKHBhcnNlcnMsIG5hbWUpKSB7XG4gICAgICAgICAgICAgICAgcGFyc2VyID0gcGFyc2Vyc1tuYW1lXTtcbiAgICAgICAgICAgICAgICBpZiAoaXNGdW5jdGlvbihwYXJzZXIpKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChuYW1lIGluIHRhcmdldCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdcIicgKyBuYW1lICsgJ1wiIGNhbm5vdCBiZSBhIG5hbWUgb2YgcGFyc2VyJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0W25hbWVdID0gcGFyc2VyO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBhZGRDdXN0b21QYXJzZXI7XG4iLCJ2YXIgaXNGdW5jdGlvbiA9IHJlcXVpcmUoMzgpO1xudmFyIGlzQWJzb2x1dGVVUkwgPSByZXF1aXJlKDM2KTtcbnZhciBpc1BsYWluT2JqZWN0ID0gcmVxdWlyZSgzOSk7XG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGJ1aWxkIHJlcXVlc3QgdXJsLlxuICpcbiAqIDEuIEFkZCBiYXNlVVJMIGlmIG5lZWRlZC5cbiAqIDIuIENvbXBpbGUgdXJsIGlmIG5lZWRlZC5cbiAqIDMuIENvbXBpbGUgcXVlcnkgc3RyaW5nIGlmIG5lZWRlZC5cbiAqXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBSZXR1cm5zIHRoZSBmaW5hbCB1cmwgc3RyaW5nLlxuICovXG5mdW5jdGlvbiBidWlsZFVSTChvcHRpb25zKSB7XG4gICAgdmFyIHVybCA9IG9wdGlvbnMudXJsO1xuICAgIHZhciBiYXNlVVJMID0gb3B0aW9ucy5iYXNlVVJMO1xuICAgIHZhciBtb2RlbCA9IG9wdGlvbnMubW9kZWw7XG4gICAgdmFyIHF1ZXJ5ID0gb3B0aW9ucy5xdWVyeTtcbiAgICB2YXIgY29tcGlsZVVSTCA9IG9wdGlvbnMuY29tcGlsZVVSTDtcbiAgICB2YXIgZW5jb2RlUXVlcnlTdHJpbmcgPSBvcHRpb25zLmVuY29kZVF1ZXJ5U3RyaW5nO1xuICAgIHZhciBhcnJheTtcblxuICAgIGlmICh1cmwgPT09IG51bGwgfHwgdXJsID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdXJsID0gJyc7XG4gICAgfVxuXG4gICAgLy8gSWYgdGhlIHVybCBpcyBub3QgYWJzb2x1dGUgdXJsIGFuZCB0aGUgYmFzZVVSTCBpcyBkZWZpbmVkLFxuICAgIC8vIHByZXBlbmQgdGhlIGJhc2VVUkwgdG8gdGhlIHVybC5cbiAgICBpZiAoIWlzQWJzb2x1dGVVUkwodXJsKSkge1xuICAgICAgICBpZiAodHlwZW9mIGJhc2VVUkwgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICB1cmwgPSBiYXNlVVJMICsgdXJsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ29tcGlsZSB0aGUgdXJsIGlmIG5lZWRlZC5cbiAgICBpZiAoaXNQbGFpbk9iamVjdChtb2RlbCkgJiYgaXNGdW5jdGlvbihjb21waWxlVVJMKSkge1xuICAgICAgICB1cmwgPSBjb21waWxlVVJMKHVybCwgbW9kZWwsIG9wdGlvbnMpO1xuICAgIH1cblxuICAgIC8vIENvbXBpbGUgdGhlIHF1ZXJ5IHN0cmluZy5cbiAgICBpZiAoaXNQbGFpbk9iamVjdChxdWVyeSkgJiYgaXNGdW5jdGlvbihlbmNvZGVRdWVyeVN0cmluZykpIHtcbiAgICAgICAgcXVlcnkgPSBlbmNvZGVRdWVyeVN0cmluZyhxdWVyeSwgb3B0aW9ucyk7XG4gICAgICAgIGFycmF5ID0gdXJsLnNwbGl0KCcjJyk7IC8vIFRoZXJlIG1heSBiZSBoYXNoIHN0cmluZyBpbiB0aGUgdXJsLlxuICAgICAgICB1cmwgPSBhcnJheVswXTtcblxuICAgICAgICBpZiAodXJsLmluZGV4T2YoJz8nKSA+IC0xKSB7XG4gICAgICAgICAgICBpZiAodXJsLmNoYXJBdCh1cmwubGVuZ3RoIC0gMSkgPT09ICcmJykge1xuICAgICAgICAgICAgICAgIHVybCA9IHVybCArIHF1ZXJ5O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB1cmwgPSB1cmwgKyAnJicgKyBxdWVyeTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHVybCA9IHVybCArICc/JyArIHF1ZXJ5O1xuICAgICAgICB9XG5cbiAgICAgICAgYXJyYXlbMF0gPSB1cmw7XG4gICAgICAgIHVybCA9IGFycmF5LmpvaW4oJyMnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdXJsO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGJ1aWxkVVJMO1xuIiwidmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKDM4KTtcblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gY2FsbCBgb3B0aW9ucy5vblJlcXVlc3RDcmVhdGVkYCBjYWxsYmFjay5cbiAqXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcGFyYW0ge0h0dHBSZXF1ZXN0fEpTT05QUmVxdWVzdH0gcmVxdWVzdCBUaGUgcmVxdWVzdCBpbnN0YW5jZS5cbiAqL1xuZnVuY3Rpb24gY2FsbFJlcXVlc3RDcmVhdGVkQ2FsbGJhY2sob3B0aW9ucywgcmVxdWVzdCkge1xuICAgIHZhciBvblJlcXVlc3RDcmVhdGVkID0gb3B0aW9ucy5vblJlcXVlc3RDcmVhdGVkO1xuXG4gICAgaWYgKGlzRnVuY3Rpb24ob25SZXF1ZXN0Q3JlYXRlZCkpIHtcbiAgICAgICAgb25SZXF1ZXN0Q3JlYXRlZChyZXF1ZXN0KTtcbiAgICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gY2FsbFJlcXVlc3RDcmVhdGVkQ2FsbGJhY2s7XG4iLCJleHBvcnRzLkVSUl9BQk9SVEVEID0gJ0VSUl9BQk9SVEVEJztcbmV4cG9ydHMuRVJSX1JFU1BPTlNFID0gJ0VSUl9SRVNQT05TRSc7XG5leHBvcnRzLkVSUl9DQU5DRUxMRUQgPSAnRVJSX0NBTkNFTExFRCc7XG5leHBvcnRzLkVSUl9ORVRXT1JLID0gJ0VSUl9ORVRXT1JLJztcbmV4cG9ydHMuRVJSX1RJTUVPVVQgPSAnRVJSX1RJTUVPVVQnO1xuZXhwb3J0cy5IVFRQX1JFUVVFU1QgPSAnSFRUUF9SRVFVRVNUJztcbmV4cG9ydHMuSlNPTlBfUkVRVUVTVCA9ICdKU09OUF9SRVFVRVNUJztcbiIsInZhciBDYW5jZWxDb250cm9sbGVyID0gcmVxdWlyZSgxKTtcblxuLyoqXG4gKiBDcmVhdGUgYSBuZXcgaW5zdGFuY2Ugb2YgYENhbmNlbENvbnRyb2xsZXJgLlxuICpcbiAqIEByZXR1cm5zIHtDYW5jZWxDb250cm9sbGVyfSBSZXR1cm5zIGFuIG5ldyBpbnN0YW5jZSBvZiBgQ2FuY2VsQ29udHJvbGxlcmAuXG4gKi9cbnZhciBjcmVhdGVDYW5jZWxDb250cm9sbGVyID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBuZXcgQ2FuY2VsQ29udHJvbGxlcigpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBjcmVhdGVDYW5jZWxDb250cm9sbGVyO1xuIiwidmFyIFFTID0gcmVxdWlyZSg0Myk7XG52YXIgY29uc3RhbnRzID0gcmVxdWlyZSgyNSk7XG52YXIgdGVtcGxhdGUgPSByZXF1aXJlKDM0KTtcbnZhciB1dWlkID0gcmVxdWlyZSgzNSk7XG52YXIgSFRUUF9SRVFVRVNUICA9IGNvbnN0YW50cy5IVFRQX1JFUVVFU1Q7XG5cbi8qKlxuICogQ3JlYXRlIGEgbmV3IGRlZmF1bHQgcmVxdWVzdCBvcHRpb25zLlxuICpcbiAqIEByZXR1cm5zIHtSZXF1ZXN0T3B0aW9uc30gUmV0dXJucyBhIG5ldyBkZWZhdWx0IHJlcXVlc3Qgb3BpdG9ucy5cbiAqL1xuZnVuY3Rpb24gY3JlYXRlRGVmYXVsdE9wdGlvbnMoKSB7XG4gICAgLyplc2xpbnQgbm8tdW51c2VkLXZhcnM6IFtcImVycm9yXCIsIHsgXCJhcmdzXCI6IFwibm9uZVwiIH1dKi9cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7UmVxdWVzdE9wdGlvbnN9XG4gICAgICovXG4gICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgICAgIGJhc2VVUkw6IG51bGwsXG4gICAgICAgIHVybDogJycsXG4gICAgICAgIG1vZGVsOiBudWxsLFxuICAgICAgICBxdWVyeTogbnVsbCxcbiAgICAgICAgaGVhZGVyczogbnVsbCxcbiAgICAgICAgYm9keTogbnVsbCxcbiAgICAgICAgdGltZW91dDogMCxcbiAgICAgICAgY29yczogZmFsc2UsXG4gICAgICAgIG5vQ2FjaGU6IGZhbHNlLFxuICAgICAgICBub0NhY2hlSGVhZGVyczoge1xuICAgICAgICAgICAgJ1ByYWdtYSc6ICduby1jYWNoZScsXG4gICAgICAgICAgICAnQ2FjaGUtQ29udHJvbCc6ICduby1jYWNoZSwgbm8tc3RvcmUsIG11c3QtcmV2YWxpZGF0ZSdcbiAgICAgICAgfSxcbiAgICAgICAganNvbnA6ICdjYWxsYmFjaycsXG4gICAgICAgIHNldHRpbmdzOiB7fSxcbiAgICAgICAgY29udHJvbGxlcjogbnVsbCxcbiAgICAgICAgcmVxdWVzdEZ1bmN0aW9uTmFtZTogbnVsbCxcbiAgICAgICAgcmVxdWVzdFR5cGU6IG51bGwsXG4gICAgICAgIHhoclByb3BzOiBudWxsLFxuICAgICAgICB1c2VybmFtZTogbnVsbCxcbiAgICAgICAgcGFzc3dvcmQ6IG51bGwsXG4gICAgICAgIGh0dHBSZXF1ZXN0Qm9keVByb2Nlc3Nvcjoge1xuICAgICAgICAgICAgcmF3OiB7XG4gICAgICAgICAgICAgICAgcHJpb3JpdHk6IDAsXG4gICAgICAgICAgICAgICAgaGVhZGVyczogbnVsbCxcbiAgICAgICAgICAgICAgICBwcm9jZXNzb3I6IG51bGwsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZm9ybToge1xuICAgICAgICAgICAgICAgIHByaW9yaXR5OiAxLFxuICAgICAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQ7IGNoYXJzZXQ9VVRGLTgnXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBwcm9jZXNzb3I6IGZ1bmN0aW9uIChkYXRhLCBvcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBRUy5lbmNvZGUoZGF0YSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGpzb246IHtcbiAgICAgICAgICAgICAgICBwcmlvcml0eTogMixcbiAgICAgICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbjsgY2hhcnNldD1VVEYtOCdcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHByb2Nlc3NvcjogZnVuY3Rpb24gKGRhdGEsIG9wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGRhdGEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgaHR0cFJlc3BvbnNlUGFyc2VyOiB7XG4gICAgICAgICAgICBqc29uOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgLy8gYHRoaXNgIGlzIHBvaW50IHRvIHRoZSBjdXJyZW50IGluc3RhbmNlIG9mIGBIdHRwUmVzcG9uc2VgLlxuICAgICAgICAgICAgICAgIHZhciByZXNwb25zZVRleHQgPSB0aGlzLnJlcXVlc3QueGhyLnJlc3BvbnNlVGV4dDtcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzcG9uc2VUZXh0ID8gSlNPTi5wYXJzZShyZXNwb25zZVRleHQpIDogbnVsbDtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB0ZXh0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucmVxdWVzdC54aHIucmVzcG9uc2VUZXh0O1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHN0YXR1czogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnJlcXVlc3QueGhyLnN0YXR1cztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAganNvbnBSZXNwb25zZVBhcnNlcjoge1xuICAgICAgICAgICAganNvbjogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnJlcXVlc3QucmVzcG9uc2VKU09OO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBodHRwUmVzcG9uc2VFcnJvclBhcnNlcjogbnVsbCxcbiAgICAgICAganNvbnBSZXNwb25zZUVycm9yUGFyc2VyOiBudWxsLFxuICAgICAgICBoYW5kbGVPcHRpb25zOiBudWxsLFxuICAgICAgICBjcmVhdGVYSFI6IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgICAgIH0sXG4gICAgICAgIGNyZWF0ZVNjcmlwdDogZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgICAgIHZhciBzY3JpcHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzY3JpcHQnKTtcblxuICAgICAgICAgICAgc2NyaXB0LnNldEF0dHJpYnV0ZSgndHlwZScsICd0ZXh0L2phdmFzY3JpcHQnKTtcbiAgICAgICAgICAgIHNjcmlwdC5zZXRBdHRyaWJ1dGUoJ2NoYXJzZXQnLCAndXRmLTgnKTtcblxuICAgICAgICAgICAgcmV0dXJuIHNjcmlwdDtcbiAgICAgICAgfSxcbiAgICAgICAganNvbnBDb250YWluZXJOb2RlOiBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICAgICAgcmV0dXJuIGRvY3VtZW50LmhlYWQgfHwgZG9jdW1lbnQuZ2V0RWxlbWVudHNCeU5hbWUoJ2hlYWQnKVswXTtcbiAgICAgICAgfSxcbiAgICAgICAganNvbnBDYWxsYmFja05hbWU6IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgICAgICByZXR1cm4gJ2pzb25wXycgKyB1dWlkKCkgKyAnXycgKyAobmV3IERhdGUoKS5nZXRUaW1lKCkpO1xuICAgICAgICB9LFxuICAgICAgICBjb21waWxlVVJMOiBmdW5jdGlvbiAodXJsLCBtb2RlbCwgb3B0aW9ucykge1xuICAgICAgICAgICAgcmV0dXJuIHRlbXBsYXRlKHVybCwgbW9kZWwpO1xuICAgICAgICB9LFxuICAgICAgICBlbmNvZGVRdWVyeVN0cmluZzogZnVuY3Rpb24gKHF1ZXJ5LCBvcHRpb25zKSB7XG4gICAgICAgICAgICByZXR1cm4gUVMuZW5jb2RlKHF1ZXJ5KTtcbiAgICAgICAgfSxcbiAgICAgICAgb25YaHJDcmVhdGVkOiBudWxsLFxuICAgICAgICBvblhock9wZW5lZDogbnVsbCxcbiAgICAgICAgb25YaHJTZW50OiBudWxsLFxuICAgICAgICBvblJlcXVlc3RDcmVhdGVkOiBudWxsLFxuICAgICAgICBpc1Jlc3BvbnNlT2s6IGZ1bmN0aW9uIChyZXF1ZXN0VHlwZSwgcmVzcG9uc2UpIHtcbiAgICAgICAgICAgIHZhciBpc09rO1xuICAgICAgICAgICAgdmFyIHN0YXR1cztcblxuICAgICAgICAgICAgLy8gSHR0cCByZXF1ZXN0XG4gICAgICAgICAgICBpZiAocmVxdWVzdFR5cGUgPT09IEhUVFBfUkVRVUVTVCkge1xuICAgICAgICAgICAgICAgIHN0YXR1cyA9ICtyZXNwb25zZS5yZXF1ZXN0Lnhoci5zdGF0dXM7XG4gICAgICAgICAgICAgICAgaXNPayA9IChzdGF0dXMgPj0gMjAwICYmIHN0YXR1cyA8IDMwMCkgfHwgc3RhdHVzID09PSAzMDQ7XG4gICAgICAgICAgICAvLyBKU09OUCByZXF1ZXN0XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlzT2sgPSB0cnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gaXNPaztcbiAgICAgICAgfSxcbiAgICAgICAgdHJhbnNmb3JtRXJyb3I6IG51bGwsXG4gICAgICAgIHRyYW5zZm9ybVJlc3BvbnNlOiBudWxsLFxuICAgICAgICBzaG91bGRDYWxsRXJyb3JDYWxsYmFjazogbnVsbCxcbiAgICAgICAgc2hvdWxkQ2FsbFN1Y2Nlc3NDYWxsYmFjazogbnVsbFxuICAgIH07XG5cbiAgICByZXR1cm4gb3B0aW9ucztcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBjcmVhdGVEZWZhdWx0T3B0aW9ucztcbiIsIi8qKlxuICogRGVmaW5lIGEgc3RhdGljIG1lbWJlciBvbiB0aGUgZ2l2ZW4gY29uc3RydWN0b3IgYW5kIGl0cyBwcm90b3R5cGVcbiAqXG4gKiBAcGFyYW0ge0NvbnN0cnVjdG9yfSBjdG9yIFRoZSBjb25zdHJ1Y3RvciB0byBkZWZpbmUgdGhlIHN0YXRpYyBtZW1iZXJcbiAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIFRoZSBuYW1lIG9mIHRoZSBzdGF0aWMgbWVtYmVyXG4gKiBAcGFyYW0ge2FueX0gdmFsdWUgVGhlIHZhbHVlIG9mIHRoZSBzdGF0aWMgbWVtYmVyXG4gKiBAdGhyb3dzIHtFcnJvcn0gVGhyb3dzIGVycm9yIGlmIHRoZSBuYW1lIGhhcyBhbHJlYWR5IGV4aXN0ZWQsIG9yIHRoZSBjb25zdHJ1Y3RvciBpcyBub3QgYSBmdW5jdGlvblxuICovXG5mdW5jdGlvbiBkZWZpbmVFeHBvcnRzKGN0b3IsIG5hbWUsIHZhbHVlKSB7XG4gICAgY3Rvci5wcm90b3R5cGUuZXhwb3J0cyA9IGN0b3IuZXhwb3J0cyA9IGN0b3IuZXhwb3J0cyB8fCB7fTtcbiAgICBjdG9yLmV4cG9ydHNbbmFtZV0gPSB2YWx1ZTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBkZWZpbmVFeHBvcnRzO1xuIiwidmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKDM4KTtcbnZhciBIdHRwUmVzcG9uc2VFcnJvciA9IHJlcXVpcmUoNSk7XG52YXIgSlNPTlBSZXNwb25zZUVycm9yID0gcmVxdWlyZSg4KTtcbnZhciBjb25zdGFudHMgPSByZXF1aXJlKDI1KTtcbnZhciBIVFRQX1JFUVVFU1QgPSBjb25zdGFudHMuSFRUUF9SRVFVRVNUO1xuXG4vKipcbiAqIEZpcmUgdGhlIGNhbGxiYWNrcy5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ3xudWxsfSBjb2RlIElmIHRoZXJlIGlzIGFuIGVycm9yLCBgY29kZWAgc2hvdWxkIGJlIGEgc3RyaW5nLiBJZiB0aGVyZSBpcyBubyBlcnJvciwgYGNvZGVgIGlzIGBudWxsYC5cbiAqIEBwYXJhbSB7SHR0cFJlc3BvbnNlfEpTT05QUmVzcG9uc2V9IHJlc3BvbnNlIFRoZSByZXNwb25zZSBpbnN0YW5jZS5cbiAqL1xuZnVuY3Rpb24gZmlyZUNhbGxiYWNrcyhjb2RlLCByZXNwb25zZSkge1xuICAgIHZhciByZXF1ZXN0ID0gcmVzcG9uc2UucmVxdWVzdDtcbiAgICB2YXIgcmVxdWVzdFR5cGUgPSByZXF1ZXN0LnJlcXVlc3RUeXBlO1xuICAgIHZhciBvcHRpb25zID0gcmVxdWVzdC5vcHRpb25zO1xuICAgIHZhciBvbnN1Y2Nlc3MgPSByZXF1ZXN0Lm9uc3VjY2VzcztcbiAgICB2YXIgb25lcnJvciA9IHJlcXVlc3Qub25lcnJvcjtcbiAgICB2YXIgc2hvdWxkQ2FsbEVycm9yQ2FsbGJhY2sgPSBvcHRpb25zLnNob3VsZENhbGxFcnJvckNhbGxiYWNrO1xuICAgIHZhciBzaG91bGRDYWxsU3VjY2Vzc0NhbGxiYWNrID0gb3B0aW9ucy5zaG91bGRDYWxsU3VjY2Vzc0NhbGxiYWNrO1xuICAgIHZhciB0cmFuc2Zvcm1FcnJvciA9IG9wdGlvbnMudHJhbnNmb3JtRXJyb3I7XG4gICAgdmFyIHRyYW5zZm9ybVJlc3BvbnNlID0gb3B0aW9ucy50cmFuc2Zvcm1SZXNwb25zZTtcblxuICAgIHZhciBlcnJvciA9IG51bGw7XG4gICAgdmFyIGNhbGxFcnJvckNhbGxiYWNrID0gdHJ1ZTtcbiAgICB2YXIgY2FsbFN1Y2Nlc3NDYWxsYmFjayA9IHRydWU7XG4gICAgdmFyIHRyYW5zZm9ybWVkRXJyb3IgPSBudWxsO1xuICAgIHZhciB0cmFuc2Zvcm1lZFJlc3BvbnNlID0gbnVsbDtcblxuICAgIGlmIChjb2RlKSB7XG4gICAgICAgIGlmIChyZXF1ZXN0VHlwZSA9PT0gSFRUUF9SRVFVRVNUKSB7XG4gICAgICAgICAgICBlcnJvciA9IG5ldyBIdHRwUmVzcG9uc2VFcnJvcihjb2RlLCByZXF1ZXN0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGVycm9yID0gbmV3IEpTT05QUmVzcG9uc2VFcnJvcihjb2RlLCByZXF1ZXN0KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaXNGdW5jdGlvbih0cmFuc2Zvcm1FcnJvcikpIHtcbiAgICAgICAgICAgIHRyYW5zZm9ybWVkRXJyb3IgPSB0cmFuc2Zvcm1FcnJvcihyZXF1ZXN0VHlwZSwgZXJyb3IpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdHJhbnNmb3JtZWRFcnJvciA9IGVycm9yO1xuICAgICAgICB9XG4gICAgICAgIGlmIChpc0Z1bmN0aW9uKHNob3VsZENhbGxFcnJvckNhbGxiYWNrKSkge1xuICAgICAgICAgICAgY2FsbEVycm9yQ2FsbGJhY2sgPSBzaG91bGRDYWxsRXJyb3JDYWxsYmFjayhyZXF1ZXN0VHlwZSwgdHJhbnNmb3JtZWRFcnJvciwgZXJyb3IpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjYWxsRXJyb3JDYWxsYmFjaykge1xuICAgICAgICAgICAgaWYgKGlzRnVuY3Rpb24ob25lcnJvcikpIHtcbiAgICAgICAgICAgICAgICBvbmVycm9yKHRyYW5zZm9ybWVkRXJyb3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKGlzRnVuY3Rpb24odHJhbnNmb3JtUmVzcG9uc2UpKSB7XG4gICAgICAgICAgICB0cmFuc2Zvcm1lZFJlc3BvbnNlID0gdHJhbnNmb3JtUmVzcG9uc2UocmVxdWVzdFR5cGUsIHJlc3BvbnNlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRyYW5zZm9ybWVkUmVzcG9uc2UgPSByZXNwb25zZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaXNGdW5jdGlvbihzaG91bGRDYWxsU3VjY2Vzc0NhbGxiYWNrKSkge1xuICAgICAgICAgICAgY2FsbFN1Y2Nlc3NDYWxsYmFjayA9IHNob3VsZENhbGxTdWNjZXNzQ2FsbGJhY2socmVxdWVzdFR5cGUsIHRyYW5zZm9ybWVkUmVzcG9uc2UsIHJlc3BvbnNlKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2FsbFN1Y2Nlc3NDYWxsYmFjaykge1xuICAgICAgICAgICAgaWYgKGlzRnVuY3Rpb24ob25zdWNjZXNzKSkge1xuICAgICAgICAgICAgICAgIG9uc3VjY2Vzcyh0cmFuc2Zvcm1lZFJlc3BvbnNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBmaXJlQ2FsbGJhY2tzO1xuIiwidmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKDM4KTtcblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gcHJvY2VzcyB0aGUgcmVxdWVzdCBvcHRpb25zLiBUaGlzIGZ1bmN0aW9uIHdpbGwgY2FsbCB0aGUgZnVuY3Rpb24gYG9wdGlvbnMuaGFuZGxlT3B0aW9uc2AuXG4gKlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICogQHJldHVybnMge3ZvaWR9XG4gKi9cbmZ1bmN0aW9uIGhhbmRsZU9wdGlvbnMob3B0aW9ucykge1xuICAgIGlmIChpc0Z1bmN0aW9uKG9wdGlvbnMuaGFuZGxlT3B0aW9ucykpIHtcbiAgICAgICAgb3B0aW9ucy5oYW5kbGVPcHRpb25zKG9wdGlvbnMpO1xuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBoYW5kbGVPcHRpb25zO1xuIiwibW9kdWxlLmV4cG9ydHMgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuIiwiLyoqXG4gKiBNYWtlIGBTdWJDbGFzc2AgZXh0ZW5kIGBTdXBlckNsYXNzYC5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBTdWJDbGFzcyBUaGUgc3ViIGNsYXNzIGNvbnN0cnVjdG9yLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gU3VwZXJDbGFzcyBUaGUgc3VwZXIgY2xhc3MgY29uc3RydWN0b3IuXG4gKi9cbmZ1bmN0aW9uIGluaGVyaXRzKFN1YkNsYXNzLCBTdXBlckNsYXNzKSB7XG4gICAgdmFyIEYgPSBmdW5jdGlvbigpIHt9O1xuXG4gICAgRi5wcm90b3R5cGUgPSBTdXBlckNsYXNzLnByb3RvdHlwZTtcblxuICAgIFN1YkNsYXNzLnByb3RvdHlwZSA9IG5ldyBGKCk7XG4gICAgU3ViQ2xhc3MucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gU3ViQ2xhc3M7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaW5oZXJpdHM7XG4iLCIvKipcbiAqIFRoZSBubyBvcGVyYXRpb24gZnVuY3Rpb24uXG4gKi9cbmZ1bmN0aW9uIG5vb3AoKSB7XG4gICAgLy8gbm90aGluZyB0byBkbyBoZXJlLlxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IG5vb3A7XG4iLCJ2YXIgVF9TVFIgPSAxO1xudmFyIFRfRVhQID0gMjtcblxuLyoqXG4gKiBBIHNpbXBsZSB0ZW1wbGF0ZSBmdW5jdGlvblxuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBScmV0dXJucyAnL3Bvc3QvMSdcbiAqIHRlbXBsYXRlKCcvcG9zdC97IHBvc3QuaWQgfScsIHsgcG9zdDogeyBpZDogMSB9IH0pXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IHRlbXBsYXRlIFRoZSB0ZW1wbGF0ZSB0ZXh0LlxuICogQHBhcmFtIHtPYmplY3QuPHN0cmluZywgKj59IGRhdGEgVGhlIGRhdGEgb2JqZWN0LlxuICogQHBhcmFtIHtUZW1wbGF0ZU9wdGlvbnN9IG9wdGlvbnMgVGhlIHRlbXBsYXRlIG9wdGlvbnMuXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBSZXR1cm5zIHRoZSBjb21waWxlZCB0ZXh0LlxuICovXG5mdW5jdGlvbiB0ZW1wbGF0ZSh0ZW1wbGF0ZSwgZGF0YSwgb3B0aW9ucykge1xuICAgIHZhciB0ZW1wbCA9IHRlbXBsYXRlICsgJyc7XG4gICAgdmFyIG1vZGVsID0gZGF0YSB8fCB7fTtcbiAgICB2YXIgb3B0cyA9IG9wdGlvbnMgfHwge307XG4gICAgdmFyIHN0YXJ0ID0gb3B0cy5zdGFydCB8fCAneyc7XG4gICAgdmFyIGVuZCA9IG9wdHMuZW5kIHx8ICd9JztcbiAgICB2YXIgZW5jb2RlID0gb3B0cy5lbmNvZGUgfHwgZW5jb2RlVVJJQ29tcG9uZW50O1xuICAgIHZhciBhc3QgPSBjb21waWxlKHRlbXBsLCBzdGFydCwgZW5kLCBmdW5jdGlvbiAoZXhwcikge1xuICAgICAgICB2YXIgZmlyc3QgPSBleHByLmNoYXJBdCgwKTtcbiAgICAgICAgdmFyIHNlY29uZCA9IGV4cHIuY2hhckF0KDEpO1xuICAgICAgICB2YXIgcmF3ID0gZmFsc2U7XG5cbiAgICAgICAgaWYgKGZpcnN0ID09PSAnLScgJiYgc2Vjb25kID09PSAnICcpIHtcbiAgICAgICAgICAgIHJhdyA9IHRydWU7XG4gICAgICAgICAgICBleHByID0gZXhwci5zdWJzdHIoMik7XG4gICAgICAgIH1cblxuICAgICAgICBleHByID0gZXhwci5yZXBsYWNlKC9eXFxzK3xcXHMrJC9nLCAnJyk7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHR5cGU6IFRfRVhQLFxuICAgICAgICAgICAgdGV4dDogZXhwcixcbiAgICAgICAgICAgIHJhdzogcmF3XG4gICAgICAgIH07XG4gICAgfSk7XG5cbiAgICB2YXIgcmVuZGVyID0gYnVpbGRSZW5kZXJGdW5jdGlvbihhc3QsIGVuY29kZSk7XG5cbiAgICB0cnkge1xuICAgICAgICByZXR1cm4gcmVuZGVyKG1vZGVsKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignQ29tcGlsZSBFcnJvcjpcXG5cXG4nICsgdGVtcGxhdGUgKyAnXFxuXFxuJyArIGUubWVzc2FnZSk7XG4gICAgfVxufVxuXG4vKipcbiAqIEJ1aWxkIHJlbmRlciBmdW5jdGlvbi5cbiAqXG4gKiBAcGFyYW0ge09iamVjdC48c3RyaW5nLCAqPltdfSBhc3QgVGhlIGFic3RyYWN0IHN5bnRheCB0cmVlLlxuICogQHBhcmFtIHsoc3RyOiBzdHJpbmcpID0+IHN0cmluZ30gZW5jb2RlIFRoZSBmdW5jdGlvbiB0byBlbmNvZGUgdGhlIHN0cmluZy5cbiAqIEByZXR1cm5zIHsobW9kZWw6IE9iamVjdC48c3RyaW5nLCAqPikgPT4gc3RyaW5nfSBSZXR1cm5zIGEgZnVuY3Rpb24gdGhhdCBjb21waWxlIGRhdGEgdG8gc3RyaW5nLlxuICovXG5mdW5jdGlvbiBidWlsZFJlbmRlckZ1bmN0aW9uKGFzdCwgZW5jb2RlKSB7XG4gICAgdmFyIGZuO1xuICAgIHZhciBsaW5lO1xuICAgIHZhciBsaW5lcyA9IFtdO1xuICAgIHZhciBpID0gMDtcbiAgICB2YXIgbCA9IGFzdC5sZW5ndGg7XG5cbiAgICBsaW5lcy5wdXNoKCd2YXIgX19vPVtdJyk7XG4gICAgbGluZXMucHVzaCgnd2l0aChfX3MpeycpO1xuXG4gICAgZm9yICggOyBpIDwgbDsgKytpKSB7XG4gICAgICAgIGxpbmUgPSBhc3RbaV07XG5cbiAgICAgICAgaWYgKGxpbmUudHlwZSA9PT0gVF9TVFIpIHtcbiAgICAgICAgICAgIGxpbmVzLnB1c2goJ19fby5wdXNoKCcgKyBKU09OLnN0cmluZ2lmeShsaW5lLnRleHQpICsgJyknKTtcbiAgICAgICAgfSBlbHNlIGlmIChsaW5lLnR5cGUgPT09IFRfRVhQICYmIGxpbmUudGV4dCkge1xuICAgICAgICAgICAgaWYgKGxpbmUucmF3KSB7XG4gICAgICAgICAgICAgICAgbGluZXMucHVzaCgnX19vLnB1c2goJyArIGxpbmUudGV4dCArICcpJyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGxpbmVzLnB1c2goJ19fby5wdXNoKF9fZSgnICsgbGluZS50ZXh0ICsgJykpJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBsaW5lcy5wdXNoKCd9Jyk7XG4gICAgbGluZXMucHVzaCgncmV0dXJuIF9fby5qb2luKFwiXCIpJyk7XG5cbiAgICBmbiA9IG5ldyBGdW5jdGlvbignX19zJywgJ19fZScsIGxpbmVzLmpvaW4oJ1xcbicpKTtcblxuICAgIHJldHVybiBmdW5jdGlvbiAobW9kZWwpIHtcbiAgICAgICAgcmV0dXJuIGZuKG1vZGVsLCBmdW5jdGlvbiAodmFsKSB7XG4gICAgICAgICAgICByZXR1cm4gKHZhbCA9PT0gbnVsbCB8fCB2YWwgPT09IHVuZGVmaW5lZCkgPyAnJyA6IGVuY29kZSh2YWwgKyAnJyk7XG4gICAgICAgIH0pO1xuICAgIH07XG59XG5cbi8qKlxuICogQ29tcGlsZSB0aGUgdGVtcGxhdGUuXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IHRlbXBsYXRlIFRoZSB0ZW1wbGF0ZSB0byBjb21waWxlLlxuICogQHBhcmFtIHtzdHJpbmd9IHN0YXJ0VGFnIFRoZSBzdGFydCB0YWcuXG4gKiBAcGFyYW0ge3N0cmluZ30gZW5kVGFnIFRoZSBlbmQgdGFnLlxuICogQHBhcmFtIHsoZXhwcjogc3RyaW5nKSA9PiBzdHJpbmd9IHBhcnNlRXhwciBUaGUgZnVuY3Rpb24gdG8gcGFyc2UgdGhlIGV4cHJlc3Npb24uXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBSZXR1cm4gdGhlIGNvbXBpbGVkIHN0cmluZy5cbiAqL1xuZnVuY3Rpb24gY29tcGlsZSh0ZW1wbGF0ZSwgc3RhcnRUYWcsIGVuZFRhZywgcGFyc2VFeHByKSB7XG4gICAgdmFyIGkgPSAwO1xuICAgIHZhciBsID0gdGVtcGxhdGUubGVuZ3RoO1xuICAgIHZhciBzbCA9IHN0YXJ0VGFnLmxlbmd0aDtcbiAgICB2YXIgZWwgPSBlbmRUYWcubGVuZ3RoO1xuICAgIHZhciBhc3QgPSBbXTtcbiAgICB2YXIgc3RyYnVmZmVyID0gW107XG4gICAgdmFyIGV4cHJidWZmZXIgPSBbXTtcbiAgICB2YXIgdHlwZSA9IFRfU1RSO1xuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBjaGFyIGluIGB0ZW1wbGF0ZWAgYXQgdGhlIGdpdmVuIHBvc2l0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1uZXJ9IGluZGV4IFRoZSBpbmRleCB0byByZWFkLlxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IFJldHVybnMgdGhlIGNoYXIuXG4gICAgICovXG4gICAgdmFyIGNoYXJBdCA9IGZ1bmN0aW9uIChpbmRleCkge1xuICAgICAgICByZXR1cm4gdGVtcGxhdGUuY2hhckF0KGluZGV4KTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogRXNjYXBlIHRoZSB0YWcuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdGFnIFRoZSB0YWcgdG8gZXNjYXBlLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nW119IGJ1ZmZlciBUaGUgYnVmZmVyIHRvIHB1dCB0aGUgY2hhci5cbiAgICAgKi9cbiAgICB2YXIgZXNjID0gZnVuY3Rpb24gKHRhZywgYnVmZmVyKSB7XG4gICAgICAgIHZhciBjO1xuICAgICAgICB2YXIgbSA9IHRhZy5sZW5ndGg7XG4gICAgICAgIHZhciBzID0gJ1xcXFwnO1xuICAgICAgICAvKmVzbGludCBuby1jb25zdGFudC1jb25kaXRpb246IFtcImVycm9yXCIsIHsgXCJjaGVja0xvb3BzXCI6IGZhbHNlIH1dKi9cbiAgICAgICAgd2hpbGUgKDEpIHtcbiAgICAgICAgICAgIGMgPSBjaGFyQXQoaSk7XG4gICAgICAgICAgICBpZiAoYyA9PT0gcykge1xuICAgICAgICAgICAgICAgIGMgPSBjaGFyQXQoKytpKTtcbiAgICAgICAgICAgICAgICBpZiAoYyA9PT0gcykge1xuICAgICAgICAgICAgICAgICAgICBidWZmZXIucHVzaChzKTtcbiAgICAgICAgICAgICAgICAgICAgKytpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoaXNXb3JkKHRhZykpIHtcbiAgICAgICAgICAgICAgICAgICAgYnVmZmVyLnB1c2godGFnKTtcbiAgICAgICAgICAgICAgICAgICAgaSArPSBtO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGJ1ZmZlci5wdXNoKHMpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIENoZWNrIHdoZXRoZXIgdGhlIG5leHQgaW5wdXQgaXMgdGhlIHdvcmQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gd29yZCBUaGUgd29yZCB0byBjaGVjay5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBSZXR1cm5zIGAxYCBvbiB5ZXMsIG90aGVyd2lzZSBgMGAgaXMgcmV0dXJuZWQuXG4gICAgICovXG4gICAgdmFyIGlzV29yZCA9IGZ1bmN0aW9uICh3b3JkKSB7XG4gICAgICAgIHZhciBrID0gMDtcbiAgICAgICAgdmFyIGogPSBpO1xuICAgICAgICB2YXIgbSA9IHdvcmQubGVuZ3RoO1xuXG4gICAgICAgIHdoaWxlIChrIDwgbSAmJiBqIDwgbCkge1xuICAgICAgICAgICAgaWYgKHdvcmQuY2hhckF0KGspICE9PSBjaGFyQXQoaikpIHJldHVybiAwO1xuICAgICAgICAgICAgKytrO1xuICAgICAgICAgICAgKytqO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIDE7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEZsdXNoIHRoZSBzdHIgdG8gdGhlIGFzdCBhbmQgcmVzZXQgdGhlIHN0ciBidWZmZXIuXG4gICAgICovXG4gICAgdmFyIGZsdXNoU3RyID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoc3RyYnVmZmVyLmxlbmd0aCkge1xuICAgICAgICAgICAgYXN0LnB1c2goe1xuICAgICAgICAgICAgICAgIHR5cGU6IFRfU1RSLFxuICAgICAgICAgICAgICAgIHRleHQ6IHN0cmJ1ZmZlci5qb2luKCcnKVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBzdHJidWZmZXIgPSBbXTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBGbHVzaCB0aGUgZXhwciB0byB0aGUgYXN0IGFuZCByZXNldCB0aGUgZXhwciBidWZmZXIuXG4gICAgICovXG4gICAgdmFyIGZsdXNoRXhwciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZmx1c2hTdHIoKTtcbiAgICAgICAgYXN0LnB1c2gocGFyc2VFeHByKGV4cHJidWZmZXIuam9pbignJykpKTtcbiAgICAgICAgZXhwcmJ1ZmZlciA9IFtdO1xuICAgIH07XG5cbiAgICB3aGlsZSAoaSA8IGwpIHtcbiAgICAgICAgaWYgKHR5cGUgPT09IFRfU1RSKSB7XG4gICAgICAgICAgICBlc2Moc3RhcnRUYWcsIHN0cmJ1ZmZlcik7XG4gICAgICAgICAgICBpZiAoaXNXb3JkKHN0YXJ0VGFnKSkge1xuICAgICAgICAgICAgICAgIHR5cGUgPSBUX0VYUDtcbiAgICAgICAgICAgICAgICBpICs9IHNsO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzdHJidWZmZXIucHVzaChjaGFyQXQoaSkpO1xuICAgICAgICAgICAgICAgICsraTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmICh0eXBlID09PSBUX0VYUCkge1xuICAgICAgICAgICAgZXNjKGVuZFRhZywgZXhwcmJ1ZmZlcik7XG4gICAgICAgICAgICBpZiAoaXNXb3JkKGVuZFRhZykpIHtcbiAgICAgICAgICAgICAgICB0eXBlID0gVF9TVFI7XG4gICAgICAgICAgICAgICAgaSArPSBlbDtcbiAgICAgICAgICAgICAgICBmbHVzaEV4cHIoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZXhwcmJ1ZmZlci5wdXNoKGNoYXJBdChpKSk7XG4gICAgICAgICAgICAgICAgKytpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHR5cGUgPT09IFRfRVhQKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBlbmQnKTtcbiAgICB9XG5cbiAgICBmbHVzaFN0cigpO1xuXG4gICAgcmV0dXJuIGFzdDtcbn1cblxuLyoqXG4gKiBAdHlwZWRlZiB7T2JqZWN0LjxzdHJpbmcsICo+fSBUZW1wbGF0ZU9wdGlvbnNcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbc3RhcnRdIFRoZSBzdGFydCB0YWcgb2YgdGhlIHRlbXBsYXRlLCBkZWZhdWx0IGlzIGB7YC5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbZW5kXSBUaGUgZW5kIHRhZyBvZiB0aGUgdGVtcGxhdGUsIGRlZmF1bHQgaXMgYH1gLlxuICogQHByb3BlcnR5IHsodmFsdWU6IHN0cmluZykgPT4gc3RyaW5nfSBbZW5jb2RlXSBUaGUgZnVuY3Rpb24gdG8gZW5jb2RlIHRoZSBzdHJpbmcsIGRlZmF1bHQgaXMgYGVuY29kZVVSSUNvbXBvbmVudGAuXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSB0ZW1wbGF0ZTtcbiIsInZhciBpZCA9IDA7XG5cbi8qKlxuICogUmV0dXJucyBhIG51bWJlciB0aGF0IGdyZWF0ZXIgdGhhbiB0aGUgcHJpdm91cyBvbmUsIHN0YXJ0aW5nIGZvcm0gYDFgLlxuICpcbiAqIEByZXR1cm5zIHtudW1iZXJ9XG4gKi9cbmZ1bmN0aW9uIHV1aWQoKSB7XG4gICAgaWQgKz0gMTtcbiAgICByZXR1cm4gaWQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gdXVpZDtcbiIsIi8qKlxuICogQ2hlY2sgd2hldGhlciB0aGUgdXJsIGlzIGFic29sdXRlIHVybC5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gdXJsIFRoZSB1cmwgc3RyaW5nIHRvIGNoZWNrXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIHVybCBpcyBhYm9zb2x1dGUsIG90aGVyd2lzZSBgZmFsc2VgIGlzIHJldHVybmVkXG4gKi9cbmZ1bmN0aW9uIGlzQWJzb2x1dGVVUkwodXJsKSB7XG4gICAgcmV0dXJuIC9eKD86W2Etel1bYS16MC05XFwtXFwuXFwrXSo6KT9cXC9cXC8vaS50ZXN0KHVybCk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaXNBYnNvbHV0ZVVSTDtcbiIsInZhciB0b1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG5cbi8qKlxuICogQ2hlY2sgd2hldGhlciB0aGUgdmFyaWFibGUgaXMgYW4gaW5zdGFuY2Ugb2YgYEFycmF5YFxuICpcbiAqIEBwYXJhbSB7YW55fSBpdCBUaGUgdmFyaWFibGUgdG8gY2hlY2tcbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgdmFyaWFibGUgaXMgYW4gaW5zdGFuY2Ugb2YgYEFycmF5YCwgb3RoZXJ3aXNlIGBmYWxzZWAgaXMgcmV0dXJuZWRcbiAqL1xuZnVuY3Rpb24gaXNBcnJheShpdCkge1xuICAgIHJldHVybiB0b1N0cmluZy5jYWxsKGl0KSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpc0FycmF5O1xuIiwidmFyIHRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcblxuLyoqXG4gKiBDaGVjayB3aGV0aGVyIHRoZSB2YXJpYWJsZSBpcyBhIGZ1bmN0aW9uXG4gKlxuICogQHBhcmFtIHthbnl9IGl0IFRoZSB2YXJpYWJsZSB0byBjaGVja1xuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSB2YXJpYWJsZSBpcyBhIGZ1bmN0aW9uLCBvdGhlcndpc2UgYGZhbHNlYCBpcyByZXR1cm5lZFxuICovXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGl0KSB7XG4gICAgcmV0dXJuIHRvU3RyaW5nLmNhbGwoaXQpID09PSAnW29iamVjdCBGdW5jdGlvbl0nO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGlzRnVuY3Rpb247XG4iLCJ2YXIgdG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xuXG4vKipcbiAqIENoZWNrIHdoZXRoZXIgdGhlIHZhcmlhYmxlIGlzIGEgcGxhaW4gb2JqZWN0LlxuICpcbiAqIEBwYXJhbSB7YW55fSBpdCBUaGUgdmFyaWFibGUgdG8gY2hlY2tcbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgdmFyaWFibGUgaXMgYSBwbGFpbiBvYmplY3QsIG90aGVyd2lzZSBgZmFsc2VgIGlzIHJldHVybmVkXG4gKi9cbmZ1bmN0aW9uIGlzUGxhaW5PYmplY3QoaXQpIHtcbiAgICBpZiAoIWl0KSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgaXQgPT09IHdpbmRvdykge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBnbG9iYWwgIT09ICd1bmRlZmluZWQnICYmIGl0ID09PSBnbG9iYWwpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB0b1N0cmluZy5jYWxsKGl0KSA9PT0gJ1tvYmplY3QgT2JqZWN0XSc7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaXNQbGFpbk9iamVjdDtcbiIsInZhciBpc0FycmF5ID0gcmVxdWlyZSgzNyk7XG52YXIgaXNQbGFpbk9iamVjdCA9IHJlcXVpcmUoMzkpO1xudmFyIGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG52YXIgc2xpY2UgPSBBcnJheS5wcm90b3R5cGUuc2xpY2U7XG5cbi8qKlxuICogQ29weSB0aGUgbm9uLXVuZGVmaW5lZCB2YWx1ZXMgb2Ygc291cmNlIHRvIHRhcmdldC4gT3ZlcndyaXRlIHRoZSBvcmlnaW5hbCB2YWx1ZXMuXG4gKiBUaGlzIGZ1bmN0aW9uIHdpbGwgbW9kaWZ5IHRoZSB0YXJnZXRcbiAqXG4gKiBAcGFyYW0ge09iamVjdC48c3RyaW5nLCAqPnxhbnlbXX0gdGFyZ2V0IFRoZSB0YXJnZXQgb2JqZWN0IG9yIGFycmF5XG4gKiBAcGFyYW0ge09iamVjdC48c3RyaW5nLCAqPnxhbnlbXX0gc291cmNlIFRoZSBzb3VyY2Ugb2JqZWN0IG9yIGFycmF5XG4gKiBAcmV0dXJucyB7T2JqZWN0LjxzdHJpbmcsICo+fGFueVtdfSBSZXR1cm5zIHRoZSBleHRlbmRlZCB0YXJnZXQgb2JqZWN0IG9yIGFycmF5XG4gKi9cbmZ1bmN0aW9uIGV4dGVuZCh0YXJnZXQsIHNvdXJjZSkge1xuICAgIHZhciBrZXksIHZhbDtcblxuICAgIGlmICggdGFyZ2V0ICYmICggaXNBcnJheShzb3VyY2UpIHx8IGlzUGxhaW5PYmplY3Qoc291cmNlKSApICkge1xuICAgICAgICBmb3IgKCBrZXkgaW4gc291cmNlICkge1xuICAgICAgICAgICAgaWYgKCBoYXNPd24uY2FsbChzb3VyY2UsIGtleSkgKSB7XG4gICAgICAgICAgICAgICAgdmFsID0gc291cmNlW2tleV07XG4gICAgICAgICAgICAgICAgaWYgKHZhbCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICggaXNQbGFpbk9iamVjdCh2YWwpICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCAhIGlzUGxhaW5PYmplY3QodGFyZ2V0W2tleV0pICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldFtrZXldID0ge307XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBtZXJnZSh0YXJnZXRba2V5XSwgdmFsKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICggaXNBcnJheSh2YWwpICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCAhIGlzQXJyYXkodGFyZ2V0W2tleV0pICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldFtrZXldID0gW107XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBtZXJnZSh0YXJnZXRba2V5XSwgdmFsKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldFtrZXldID0gdmFsO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRhcmdldDtcbn1cblxuLyoqXG4gKiBDb3B5IGFueSBub24tdW5kZWZpbmVkIHZhbHVlcyBvZiBzb3VyY2UgdG8gdGFyZ2V0IGFuZCBvdmVyd3JpdGVzIHRoZSBjb3JyZXNwb25kaW5nIG9yaWdpbmFsIHZhbHVlcy4gVGhpcyBmdW5jdGlvblxuICogd2lsbCBtb2RpZnkgdGhlIHRhcmdldCBvYmplY3QuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHRhcmdldCBUaGUgdGFyZ2V0IG9iamVjdFxuICogQHBhcmFtIHsuLi5PYmplY3R9IGFyZ3MgVGhlIHNvdXJjZSBvYmplY3RcbiAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgdGhlIG1vZGlmaWVkIHRhcmdldCBvYmplY3RcbiAqL1xuZnVuY3Rpb24gbWVyZ2UodGFyZ2V0LCBhcmdzKSB7XG4gICAgdmFyIGkgPSAwO1xuICAgIHZhciBsID0gYXJndW1lbnRzLmxlbmd0aCAtIDE7XG5cbiAgICBhcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuXG4gICAgZm9yIChpID0gMDsgaSA8IGw7IGkgKz0gMSkge1xuICAgICAgICBleHRlbmQodGFyZ2V0LCBhcmdzW2ldKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGFyZ2V0O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IG1lcmdlO1xuIiwidmFyIHV0aWwgPSByZXF1aXJlKDQ0KTtcbnZhciBpc0FycmF5ID0gdXRpbC5pc0FycmF5O1xuXG4vKipcbiAqIERlY29kZSB0aGUgVVJJIENvbXBvbmVudCBlbmNvZGVkIHF1ZXJ5IHN0cmluZyB0byBvYmplY3RcbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gVGhlIFVSSSBDb21wb25lbnQgZW5jb2RlZCBxdWVyeSBzdHJpbmdcbiAqIEByZXR1cm5zIHtPYmplY3QuPHN0cmluZywgc3RyaW5nPn0gUmV0dXJucyB0aGUgZGVjb2RlZCBvYmplY3RcbiAqL1xudmFyIGRlY29kZSA9IGZ1bmN0aW9uIChzdHJpbmcpIHtcbiAgICB2YXIgb2JqZWN0ID0ge307XG4gICAgdmFyIGNhY2hlID0ge307XG4gICAgdmFyIGtleVZhbHVlQXJyYXk7XG4gICAgdmFyIGluZGV4O1xuICAgIHZhciBsZW5ndGg7XG4gICAgdmFyIGtleVZhbHVlO1xuICAgIHZhciBrZXk7XG4gICAgdmFyIHZhbHVlO1xuXG4gICAgLy8gZG8gbm90IGRlY29kZSBlbXB0eSBzdHJpbmcgb3Igc29tZXRoaW5nIHRoYXQgaXMgbm90IHN0cmluZ1xuICAgIGlmIChzdHJpbmcgJiYgdHlwZW9mIHN0cmluZyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAga2V5VmFsdWVBcnJheSA9IHN0cmluZy5zcGxpdCgnJicpO1xuICAgICAgICBpbmRleCA9IDA7XG4gICAgICAgIGxlbmd0aCA9IGtleVZhbHVlQXJyYXkubGVuZ3RoO1xuXG4gICAgICAgIHdoaWxlIChpbmRleCA8IGxlbmd0aCkge1xuICAgICAgICAgICAga2V5VmFsdWUgPSBrZXlWYWx1ZUFycmF5W2luZGV4XS5zcGxpdCgnPScpO1xuICAgICAgICAgICAga2V5ID0gZGVjb2RlVVJJQ29tcG9uZW50KGtleVZhbHVlWzBdKTtcbiAgICAgICAgICAgIHZhbHVlID0ga2V5VmFsdWVbMV07XG5cbiAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgdmFsdWUgPSBkZWNvZGVVUklDb21wb25lbnQodmFsdWUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IG51bGw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGRlY29kZUtleShvYmplY3QsIGNhY2hlLCBrZXksIHZhbHVlKTtcblxuICAgICAgICAgICAgaW5kZXggKz0gMTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBvYmplY3Q7XG59O1xuXG4vKipcbiAqIERlY29kZSB0aGUgc3BlY2VmaWVkIGtleVxuICpcbiAqIEBwYXJhbSB7T2JqZWN0LjxzdHJpbmcsIHN0cmluZz59IG9iamVjdCBUaGUgb2JqZWN0IHRvIGhvbGQgdGhlIGRlY29kZWQgZGF0YVxuICogQHBhcmFtIHtPYmplY3QuPHN0cmluZywgKj59IGNhY2hlIFRoZSBvYmplY3QgdG8gaG9sZCBjYWNoZSBkYXRhXG4gKiBAcGFyYW0ge3N0cmluZ30ga2V5IFRoZSBrZXkgbmFtZSB0byBkZWNvZGVcbiAqIEBwYXJhbSB7YW55fSB2YWx1ZSBUaGUgdmFsdWUgdG8gZGVjb2RlXG4gKi9cbnZhciBkZWNvZGVLZXkgPSBmdW5jdGlvbiAob2JqZWN0LCBjYWNoZSwga2V5LCB2YWx1ZSkge1xuICAgIHZhciByQnJhY2tldCA9IC9cXFsoW15cXFtdKj8pP1xcXSQvO1xuICAgIHZhciBySW5kZXggPSAvKF4wJCl8KF5bMS05XVxcZCokKS87XG4gICAgdmFyIGluZGV4T3JLZXlPckVtcHR5O1xuICAgIHZhciBwYXJlbnRLZXk7XG4gICAgdmFyIGFycmF5T3JPYmplY3Q7XG4gICAgdmFyIGtleUlzSW5kZXg7XG4gICAgdmFyIGtleUlzRW1wdHk7XG4gICAgdmFyIHZhbHVlSXNJbkFycmF5O1xuICAgIHZhciBkYXRhQXJyYXk7XG4gICAgdmFyIGxlbmd0aDtcblxuICAgIC8vIGNoZWNrIHdoZXRoZXIga2V5IGlzIHNvbWV0aGluZyBsaWtlIGBwZXJzb25bbmFtZV1gIG9yIGBjb2xvcnNbXWAgb3JcbiAgICAvLyBgY29sb3JzWzFdYFxuICAgIGlmICggckJyYWNrZXQudGVzdChrZXkpICkge1xuICAgICAgICBpbmRleE9yS2V5T3JFbXB0eSA9IFJlZ0V4cC4kMTtcbiAgICAgICAgcGFyZW50S2V5ID0ga2V5LnJlcGxhY2UockJyYWNrZXQsICcnKTtcbiAgICAgICAgYXJyYXlPck9iamVjdCA9IGNhY2hlW3BhcmVudEtleV07XG5cbiAgICAgICAga2V5SXNJbmRleCA9IHJJbmRleC50ZXN0KGluZGV4T3JLZXlPckVtcHR5KTtcbiAgICAgICAga2V5SXNFbXB0eSA9IGluZGV4T3JLZXlPckVtcHR5ID09PSAnJztcbiAgICAgICAgdmFsdWVJc0luQXJyYXkgPSBrZXlJc0luZGV4IHx8IGtleUlzRW1wdHk7XG5cbiAgICAgICAgaWYgKGFycmF5T3JPYmplY3QpIHtcbiAgICAgICAgICAgIC8vIGNvbnZlcnQgdGhlIGFycmF5IHRvIG9iamVjdFxuICAgICAgICAgICAgaWYgKCAoISB2YWx1ZUlzSW5BcnJheSkgJiYgaXNBcnJheShhcnJheU9yT2JqZWN0KSApIHtcbiAgICAgICAgICAgICAgICBkYXRhQXJyYXkgPSBhcnJheU9yT2JqZWN0O1xuICAgICAgICAgICAgICAgIGxlbmd0aCA9IGRhdGFBcnJheS5sZW5ndGg7XG4gICAgICAgICAgICAgICAgYXJyYXlPck9iamVjdCA9IHt9O1xuXG4gICAgICAgICAgICAgICAgd2hpbGUgKGxlbmd0aC0tKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChhcnJheU9yT2JqZWN0W2xlbmd0aF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXJyYXlPck9iamVjdFtsZW5ndGhdID0gZGF0YUFycmF5W2xlbmd0aF07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhcnJheU9yT2JqZWN0ID0gdmFsdWVJc0luQXJyYXkgPyBbXSA6IHt9O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCBrZXlJc0VtcHR5ICYmIGlzQXJyYXkoYXJyYXlPck9iamVjdCkgKSB7XG4gICAgICAgICAgICBhcnJheU9yT2JqZWN0LnB1c2godmFsdWUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gYXJyYXlPck9iamVjdCBpcyBhcnJheSBvciBvYmplY3QgaGVyZVxuICAgICAgICAgICAgYXJyYXlPck9iamVjdFtpbmRleE9yS2V5T3JFbXB0eV0gPSB2YWx1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNhY2hlW3BhcmVudEtleV0gPSBhcnJheU9yT2JqZWN0O1xuXG4gICAgICAgIGRlY29kZUtleShvYmplY3QsIGNhY2hlLCBwYXJlbnRLZXksIGFycmF5T3JPYmplY3QpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG9iamVjdFtrZXldID0gdmFsdWU7XG4gICAgfVxufTtcblxuZXhwb3J0cy5kZWNvZGUgPSBkZWNvZGU7XG4iLCJ2YXIgdXRpbCA9IHJlcXVpcmUoNDQpO1xudmFyIGlzQXJyYXkgPSB1dGlsLmlzQXJyYXk7XG52YXIgaXNPYmplY3QgPSB1dGlsLmlzT2JqZWN0O1xudmFyIGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG5cbi8qKlxuICogRW5jb2RlIHRoZSBnaXZlbiBvYmplY3QgdG8gVVJJIENvbXBvbmVudCBlbmNvZGVkIHF1ZXJ5IHN0cmluZ1xuICpcbiAqIEBwYXJhbSB7T2JqZWN0LjxzdHJpbmcsICo+fSBvYmplY3QgVGhlIG9iamVjdCB0byBlbmNvZGVcbiAqIEBwYXJhbSB7Ym9vbGVhbn0gW2tlZXBBcnJheUluZGV4XSBXaGV0aGVyIHRvIGtlZXAgYXJyYXkgaW5kZXhcbiAqIEByZXR1cm5zIHtzdHJpbmd9IFJldHVybnMgdGhlIFVSSSBDb21wb25lbnQgZW5jb2RlZCBxdWVyeSBzdHJpbmdcbiAqL1xudmFyIGVuY29kZSA9IGZ1bmN0aW9uIChvYmplY3QsIGtlZXBBcnJheUluZGV4KSB7XG4gICAgdmFyIGtleTtcbiAgICB2YXIga2V5VmFsdWVBcnJheSA9IFtdO1xuXG4gICAga2VlcEFycmF5SW5kZXggPSAhIWtlZXBBcnJheUluZGV4O1xuXG4gICAgaWYgKCBpc09iamVjdChvYmplY3QpICkge1xuICAgICAgICBmb3IgKCBrZXkgaW4gb2JqZWN0ICkge1xuICAgICAgICAgICAgaWYgKCBoYXNPd24uY2FsbChvYmplY3QsIGtleSkgKSB7XG4gICAgICAgICAgICAgICAgZW5jb2RlS2V5KGtleSwgb2JqZWN0W2tleV0sIGtleVZhbHVlQXJyYXksIGtlZXBBcnJheUluZGV4KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBrZXlWYWx1ZUFycmF5LmpvaW4oJyYnKTtcbn07XG5cblxuLyoqXG4gKiBFbmNvZGUgdGhlIHNwZWNlaWZlZCBrZXkgaW4gdGhlIG9iamVjdFxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgVGhlIGtleSBuYW1lXG4gKiBAcGFyYW0ge2FueX0gZGF0YSBUaGUgZGF0YSBvZiB0aGUga2V5XG4gKiBAcGFyYW0ge3N0cmluZ1tdfSBrZXlWYWx1ZUFycmF5IFRoZSBhcnJheSB0byBzdG9yZSB0aGUga2V5IHZhbHVlIHN0cmluZ1xuICogQHBhcmFtIHtib29sZWFufSBrZWVwQXJyYXlJbmRleCBXaGV0aGVyIHRvIGtlZXAgYXJyYXkgaW5kZXhcbiAqL1xudmFyIGVuY29kZUtleSA9IGZ1bmN0aW9uIChrZXksIGRhdGEsIGtleVZhbHVlQXJyYXksIGtlZXBBcnJheUluZGV4KSB7XG4gICAgdmFyIHByb3A7XG4gICAgdmFyIGluZGV4O1xuICAgIHZhciBsZW5ndGg7XG4gICAgdmFyIHZhbHVlO1xuICAgIHZhciBzdWJLZXk7XG5cbiAgICBpZiAoIGlzT2JqZWN0KGRhdGEpICkge1xuICAgICAgICBmb3IgKCBwcm9wIGluIGRhdGEgKSB7XG4gICAgICAgICAgICBpZiAoIGhhc093bi5jYWxsKGRhdGEsIHByb3ApICkge1xuICAgICAgICAgICAgICAgIHZhbHVlID0gZGF0YVtwcm9wXTtcbiAgICAgICAgICAgICAgICBzdWJLZXkgPSBrZXkgKyAnWycgKyBwcm9wICsgJ10nO1xuICAgICAgICAgICAgICAgIGVuY29kZUtleShzdWJLZXksIHZhbHVlLCBrZXlWYWx1ZUFycmF5LCBrZWVwQXJyYXlJbmRleCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKCBpc0FycmF5KGRhdGEpICkge1xuICAgICAgICBpbmRleCA9IDA7XG4gICAgICAgIGxlbmd0aCA9IGRhdGEubGVuZ3RoO1xuXG4gICAgICAgIHdoaWxlIChpbmRleCA8IGxlbmd0aCkge1xuICAgICAgICAgICAgdmFsdWUgPSBkYXRhW2luZGV4XTtcblxuICAgICAgICAgICAgaWYgKCBrZWVwQXJyYXlJbmRleCB8fCBpc0FycmF5KHZhbHVlKSB8fCBpc09iamVjdCh2YWx1ZSkgKSB7XG4gICAgICAgICAgICAgICAgc3ViS2V5ID0ga2V5ICsgJ1snICsgaW5kZXggKyAnXSc7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHN1YktleSA9IGtleSArICdbXSc7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGVuY29kZUtleShzdWJLZXksIHZhbHVlLCBrZXlWYWx1ZUFycmF5LCBrZWVwQXJyYXlJbmRleCk7XG5cbiAgICAgICAgICAgIGluZGV4ICs9IDE7XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICBrZXkgPSBlbmNvZGVVUklDb21wb25lbnQoa2V5KTtcbiAgICAgICAgLy8gaWYgZGF0YSBpcyBudWxsLCBubyBgPWAgaXMgYXBwZW5kZWRcbiAgICAgICAgaWYgKGRhdGEgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHZhbHVlID0ga2V5O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gaWYgZGF0YSBpcyB1bmRlZmluZWQsIHRyZWF0IGl0IGFzIGVtcHR5IHN0cmluZ1xuICAgICAgICAgICAgaWYgKGRhdGEgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGRhdGEgPSAnJztcbiAgICAgICAgICAgIC8vIG1ha2Ugc3VyZSB0aGF0IGRhdGEgaXMgc3RyaW5nXG4gICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBkYXRhICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIGRhdGEgPSAnJyArIGRhdGE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YWx1ZSA9IGtleSArICc9JyArIGVuY29kZVVSSUNvbXBvbmVudChkYXRhKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGtleVZhbHVlQXJyYXkucHVzaCh2YWx1ZSk7XG4gICAgfVxufTtcblxuZXhwb3J0cy5lbmNvZGUgPSBlbmNvZGU7XG4iLCJ2YXIgZW5jb2RlID0gcmVxdWlyZSg0MikuZW5jb2RlO1xudmFyIGRlY29kZSA9IHJlcXVpcmUoNDEpLmRlY29kZTtcblxuZXhwb3J0cy5lbmNvZGUgPSBlbmNvZGU7XG5leHBvcnRzLmRlY29kZSA9IGRlY29kZTtcbmV4cG9ydHMudmVyc2lvbiA9ICcxLjEuMic7XG4iLCJ2YXIgdG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xuXG4vKipcbiAqIENoZWNrIHdoZXRoZXIgdGhlIHZhcmlhYmxlIGlzIGFuIGFycmF5XG4gKlxuICogQHBhcmFtIHthbnl9IGl0IFRoZSB2YXJpYWJsZSB0byBjaGVja1xuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGl0IGlzIGFuIGFycmF5XG4gKi9cbnZhciBpc0FycmF5ID0gZnVuY3Rpb24gKGl0KSB7XG4gICAgcmV0dXJuICdbb2JqZWN0IEFycmF5XScgPT09IHRvU3RyaW5nLmNhbGwoaXQpO1xufTtcblxuLyoqXG4gKiBDaGVjayB3aGV0aGVyIHRoZSB2YXJpYWJsZSBpcyBhbiBvYmplY3RcbiAqXG4gKiBAcGFyYW0ge2FueX0gaXQgVGhlIHZhcmlhYmxlIHRvIGNoZWNrXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgaXQgaXMgYW4gb2JqZWN0XG4gKi9cbnZhciBpc09iamVjdCA9IGZ1bmN0aW9uIChpdCkge1xuICAgIHJldHVybiAnW29iamVjdCBPYmplY3RdJyA9PT0gdG9TdHJpbmcuY2FsbChpdCk7XG59O1xuXG5leHBvcnRzLmlzQXJyYXkgPSBpc0FycmF5O1xuZXhwb3J0cy5pc09iamVjdCA9IGlzT2JqZWN0O1xuIl19
