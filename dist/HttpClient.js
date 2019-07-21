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
    var timeout = parseInt(options.timeout || 0, 10);

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
    if (!isNaN(timeout) && timeout > 0) {
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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9fYnJvd3Nlci1wYWNrQDYuMS4wQGJyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsImxpYi9jbGFzcy9DYW5jZWxDb250cm9sbGVyLmpzIiwibGliL2NsYXNzL0h0dHBDbGllbnQuanMiLCJsaWIvY2xhc3MvSHR0cFJlcXVlc3QuanMiLCJsaWIvY2xhc3MvSHR0cFJlc3BvbnNlLmpzIiwibGliL2NsYXNzL0h0dHBSZXNwb25zZUVycm9yLmpzIiwibGliL2NsYXNzL0pTT05QUmVxdWVzdC5qcyIsImxpYi9jbGFzcy9KU09OUFJlc3BvbnNlLmpzIiwibGliL2NsYXNzL0pTT05QUmVzcG9uc2VFcnJvci5qcyIsImxpYi9jbGFzcy9SZXF1ZXN0LmpzIiwibGliL2NsYXNzL1Jlc3BvbnNlLmpzIiwibGliL2NsYXNzL1Jlc3BvbnNlRXJyb3IuanMiLCJsaWIvaHR0cC9hZGRFdmVudExpc3RlbmVycy5qcyIsImxpYi9odHRwL2FkZFRpbWVvdXRMaXN0ZW5lci5qcyIsImxpYi9odHRwL2NhbGxYaHJIb29rLmpzIiwibGliL2h0dHAvaGFuZGxlSGVhZGVycy5qcyIsImxpYi9odHRwL2hhbmRsZVJlcXVlc3RCb2R5LmpzIiwibGliL2h0dHAvaGFuZGxlWGhyUHJvcHMuanMiLCJsaWIvanNvbnAvYWRkRXZlbnRMaXN0ZW5lcnMuanMiLCJsaWIvanNvbnAvYnVpbGRDYWxsYmFja05hbWUuanMiLCJsaWIvanNvbnAvYnVpbGRTY3JpcHRTcmMuanMiLCJsaWIvanNvbnAvaGFuZGxlU2NyaXB0Q29ycy5qcyIsImxpYi9zaGFyZWQvYWRkQ3VzdG9tUGFyc2VyLmpzIiwibGliL3NoYXJlZC9idWlsZFVSTC5qcyIsImxpYi9zaGFyZWQvY2FsbFJlcXVlc3RDcmVhdGVkQ2FsbGJhY2suanMiLCJsaWIvc2hhcmVkL2NvbnN0YW50cy5qcyIsImxpYi9zaGFyZWQvY3JlYXRlQ2FuY2VsQ29udHJvbGxlci5qcyIsImxpYi9zaGFyZWQvY3JlYXRlRGVmYXVsdE9wdGlvbnMuanMiLCJsaWIvc2hhcmVkL2RlZmluZUV4cG9ydHMuanMiLCJsaWIvc2hhcmVkL2ZpcmVDYWxsYmFja3MuanMiLCJsaWIvc2hhcmVkL2hhbmRsZU9wdGlvbnMuanMiLCJsaWIvc2hhcmVkL2hhc093bi5qcyIsImxpYi9zaGFyZWQvaW5oZXJpdHMuanMiLCJsaWIvc2hhcmVkL25vb3AuanMiLCJsaWIvc2hhcmVkL3RlbXBsYXRlLmpzIiwibGliL3NoYXJlZC91dWlkLmpzIiwibm9kZV9tb2R1bGVzL194LWNvbW1vbi11dGlsc0AxLjQuMUB4LWNvbW1vbi11dGlscy9pc0Fic29sdXRlVVJMLmpzIiwibm9kZV9tb2R1bGVzL194LWNvbW1vbi11dGlsc0AxLjQuMUB4LWNvbW1vbi11dGlscy9pc0FycmF5LmpzIiwibm9kZV9tb2R1bGVzL194LWNvbW1vbi11dGlsc0AxLjQuMUB4LWNvbW1vbi11dGlscy9pc0Z1bmN0aW9uLmpzIiwibm9kZV9tb2R1bGVzL194LWNvbW1vbi11dGlsc0AxLjQuMUB4LWNvbW1vbi11dGlscy9pc1BsYWluT2JqZWN0LmpzIiwibm9kZV9tb2R1bGVzL194LWNvbW1vbi11dGlsc0AxLjQuMUB4LWNvbW1vbi11dGlscy9tZXJnZS5qcyIsIm5vZGVfbW9kdWxlcy9feC1xdWVyeS1zdHJpbmdAMS4xLjJAeC1xdWVyeS1zdHJpbmcvbGliL2RlY29kZS5qcyIsIm5vZGVfbW9kdWxlcy9feC1xdWVyeS1zdHJpbmdAMS4xLjJAeC1xdWVyeS1zdHJpbmcvbGliL2VuY29kZS5qcyIsIm5vZGVfbW9kdWxlcy9feC1xdWVyeS1zdHJpbmdAMS4xLjJAeC1xdWVyeS1zdHJpbmcvbGliL3F1ZXJ5c3RyaW5nLmpzIiwibm9kZV9tb2R1bGVzL194LXF1ZXJ5LXN0cmluZ0AxLjEuMkB4LXF1ZXJ5LXN0cmluZy9saWIvdXRpbC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3Z0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3REQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2ZBO0FBQ0E7O0FDREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM09BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDYkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDYkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNiQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsInZhciBpc0Z1bmN0aW9uID0gcmVxdWlyZSgzOCk7XG5cbi8qKlxuICogQ2FuY2VsIGNvbnRyb2xsZXIgaXMgdXNlZCB0byBjYW5jZWwgYWN0aW9ucy4gT25lIGNvbnRyb2xsZXIgY2FuIGJpbmQgYW55IG51bWJlciBvZiBhY3Rpb25zLlxuICpcbiAqIEBjbGFzc1xuICovXG5mdW5jdGlvbiBDYW5jZWxDb250cm9sbGVyKCkge1xuICAgIC8qKlxuICAgICAqIEB0eXBlIHtib29sZWFufSBXaGV0aGVyIHRoZSBjb250cm9sbGVyIGlzIGNhbmNlbGxlZC5cbiAgICAgKi9cbiAgICB0aGlzLmNhbmNlbGxlZCA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0Z1bmN0aW9uW119IFRoZSBjYWxsYmFja3MgdG8gY2FsbCBvbiBjYW5jZWwuXG4gICAgICovXG4gICAgdGhpcy5jYWxsYmFja3MgPSBbXTtcbn1cblxuLyoqXG4gKiBDYW5jZWwgdGhlIGFjdGlvbnMgdGhhdCBiaW5kIHdpdGggdGhpcyBjYW5jZWwgY29udHJvbGxlci5cbiAqL1xuQ2FuY2VsQ29udHJvbGxlci5wcm90b3R5cGUuY2FuY2VsID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBjYWxsYmFja3MgPSB0aGlzLmNhbGxiYWNrcztcbiAgICB2YXIgaSA9IDA7XG4gICAgdmFyIGwgPSBjYWxsYmFja3MubGVuZ3RoO1xuXG4gICAgaWYgKHRoaXMuY2FuY2VsbGVkID09PSBmYWxzZSkge1xuICAgICAgICB0aGlzLmNhbmNlbGxlZCA9IHRydWU7XG5cbiAgICAgICAgZm9yICggOyBpIDwgbDsgaSArPSAxKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrc1tpXSgpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIC8vIFRocm93IHRoZSBlcnJvciBsYXRlciBmb3IgZGVidWdpbmcuXG4gICAgICAgICAgICAgICAgKGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgZTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSkoZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG4vKipcbiAqIENoZWNrIHdoZXRoZXIgdGhlIGNvbnRyb2xsZXIgaXMgY2FuY2VsbGVkLlxuICpcbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgY29udHJvbGxlciBpcyBjYW5jZWxsZWQsIG90aGVyd2lzZSBgZmFsc2VgIGlzIHJldHVybmVkLlxuICovXG5DYW5jZWxDb250cm9sbGVyLnByb3RvdHlwZS5pc0NhbmNlbGxlZCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5jYW5jZWxsZWQ7XG59O1xuXG4vKipcbiAqIFJlZ2lzdGVyIGEgY2FsbGJhY2ssIHdoaWNoIHdpbGwgYmUgY2FsbGVkIHdoZW4gdGhlIGBjYW5jZWwoKWAgbWV0aG9kIGlzIGNhbGxlZC5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBUaGUgY2FsbGJhY2sgZnVuY3Rpb24gdG8gY2FsbCBvbiBjYW5jZWwuXG4gKi9cbkNhbmNlbENvbnRyb2xsZXIucHJvdG90eXBlLnJlZ2lzdGVyQ2FuY2VsQ2FsbGJhY2sgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICBpZiAoaXNGdW5jdGlvbihjYWxsYmFjaykpIHtcbiAgICAgICAgdGhpcy5jYWxsYmFja3MucHVzaChjYWxsYmFjayk7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBDYW5jZWxDb250cm9sbGVyO1xuIiwidmFyIFFTID0gcmVxdWlyZSg0Myk7XG52YXIgbWVyZ2UgPSByZXF1aXJlKDQwKTtcbnZhciBpc0Z1bmN0aW9uID0gcmVxdWlyZSgzOCk7XG52YXIgaXNQbGFpbk9iamVjdCA9IHJlcXVpcmUoMzkpO1xudmFyIGlzQWJzb2x1dGVVUkwgPSByZXF1aXJlKDM2KTtcbnZhciB1dWlkID0gcmVxdWlyZSgzNSk7XG52YXIgbm9vcCA9IHJlcXVpcmUoMzMpO1xudmFyIHRlbXBsYXRlID0gcmVxdWlyZSgzNCk7XG52YXIgaW5oZXJpdHMgPSByZXF1aXJlKDMyKTtcbnZhciBjb25zdGFudHMgPSByZXF1aXJlKDI1KTtcbnZhciBkZWZpbmVFeHBvcnRzID0gcmVxdWlyZSgyOCk7XG52YXIgY3JlYXRlRGVmYXVsdE9wdGlvbnMgPSByZXF1aXJlKDI3KTtcbnZhciBjcmVhdGVDYW5jZWxDb250cm9sbGVyID0gcmVxdWlyZSgyNik7XG52YXIgUmVxdWVzdCA9IHJlcXVpcmUoOSk7XG52YXIgSHR0cFJlcXVlc3QgPSByZXF1aXJlKDMpO1xudmFyIEpTT05QUmVxdWVzdCA9IHJlcXVpcmUoNik7XG52YXIgUmVzcG9uc2UgPSByZXF1aXJlKDEwKTtcbnZhciBIdHRwUmVzcG9uc2UgPSByZXF1aXJlKDQpO1xudmFyIEpTT05QUmVzcG9uc2UgPSByZXF1aXJlKDcpO1xudmFyIFJlc3BvbnNlRXJyb3IgPSByZXF1aXJlKDExKTtcbnZhciBIdHRwUmVzcG9uc2VFcnJvciA9IHJlcXVpcmUoNSk7XG52YXIgSlNPTlBSZXNwb25zZUVycm9yID0gcmVxdWlyZSg4KTtcbnZhciBDYW5jZWxDb250cm9sbGVyID0gcmVxdWlyZSgxKTtcbnZhciB2ZXJzaW9uID0gJzAuMC4xLWFscGhhLjUnO1xuXG4vKipcbiAqIEBjbGFzc1xuICpcbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IFtkZWZhdWx0c10gVGhlIGRlZmF1bHQgb3B0aW9ucyB0byB1c2Ugd2hlbiBzZW5kaW5nIHJlcXVlc3RzIHdpdGggdGhlIGNyZWF0ZWQgaHR0cCBjbGllbnQuXG4gKiBUaGlzIGRlZmF1bHQgb3B0aW9ucyB3aWxsIGJlIG1lcmdlZCBpbnRvIHRoZSBpbnRlcm5hbCBkZWZhdWx0IG9wdGlvbnMgdGhhdCBgY3JlYXRlRGVmYXVsdE9wdGlvbnMoKWAgcmV0dXJucy5cbiAqXG4gKiBAcGFyYW0ge0hhbmRsZU9wdGlvbnNGdW5jdGlvbn0gW2hhbmRsZURlZmF1bHRzXSBUaGUgaGFuZGxlciBmdW5jdGlvbiB0byBwcm9jZXNzIHRoZSBtZXJnZWQgZGVmYXVsdCBvcHRpb25zLiBUaGVcbiAqIG1lcmdlZCBkZWZhdWx0IG9wdGlvbnMgd2lsbCBiZSBwYXNzZWQgaW50byB0aGUgZnVuY3Rpb24gYXMgdGhlIGZpcnN0IGFyZ3VtZW50LiBZb3UgY2FuIG1ha2UgY2hhbmdlcyB0byBpdCBhcyB5b3VcbiAqIHdhbnQuIFRoaXMgZnVuY3Rpb24gbXVzdCByZXR1cm4gc3luY2hyb25vdXNseS4gVGhlIHJldHVybiB2YWx1ZSBvZiB0aGlzIGZ1bmN0aW9uIGlzIGlnbm9yZWQuXG4gKlxuICogQHBhcmFtIHtIYW5kbGVPcHRpb25zRnVuY3Rpb259IFtoYW5kbGVSZXF1ZXN0T3B0aW9uc10gVGhlIGhhbmRsZXIgZnVuY3Rpb24gdG8gcHJvY2VzcyBlYWNoIG1lcmdlZCByZXF1ZXN0IG9wdGlvbnMuXG4gKiBFdmVyeSBvcHRpb25zIHRoYXQgcGFzc2VkIGludG8gYHNlbmRgLCBgZmV0Y2hgLCBgZ2V0SlNPTlBgLCBgZmV0Y2hKU09OUGAgd2lsbCBiZSBwcm9jZXNzZWQgYnkgdGhpcyBoYW5kbGVyIGZ1bmN0aW9uLlxuICovXG5mdW5jdGlvbiBIdHRwQ2xpZW50KGRlZmF1bHRzLCBoYW5kbGVEZWZhdWx0cywgaGFuZGxlUmVxdWVzdE9wdGlvbnMpIHtcbiAgICB2YXIgZGVmYXVsdE9wdGlvbnMgPSBjcmVhdGVEZWZhdWx0T3B0aW9ucygpO1xuXG4gICAgaWYgKGlzUGxhaW5PYmplY3QoZGVmYXVsdHMpKSB7XG4gICAgICAgIG1lcmdlKGRlZmF1bHRPcHRpb25zLCBkZWZhdWx0cyk7XG4gICAgfVxuXG4gICAgaWYgKGlzRnVuY3Rpb24oaGFuZGxlRGVmYXVsdHMpKSB7XG4gICAgICAgIGhhbmRsZURlZmF1bHRzKGRlZmF1bHRPcHRpb25zKTtcbiAgICAgICAgLy8gRGVlcCBjb3B5IHRoZSBjaGFnbmVkIG9wdGlvbnNcbiAgICAgICAgZGVmYXVsdE9wdGlvbnMgPSBtZXJnZSh7fSwgZGVmYXVsdE9wdGlvbnMpO1xuICAgIH1cblxuICAgIGlmICghaXNGdW5jdGlvbihoYW5kbGVSZXF1ZXN0T3B0aW9ucykpIHtcbiAgICAgICAgaGFuZGxlUmVxdWVzdE9wdGlvbnMgPSBub29wO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCBhIGNvcHkgb2YgdGhlIGRlZmF1bHQgcmVxdWVzdCBvcHRpb25zLiBUaGlzIGZ1bmN0aW9uIGlzIE5PVCBhdmFpbGFibGUgb24gdGhlIHByb3RvdHlwZSBvZiBgSHR0cENsaWVudGAuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7UmVxdWVzdE9wdGlvbnN9XG4gICAgICovXG4gICAgdGhpcy5jb3B5T3B0aW9ucyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIG1lcmdlKHt9LCBkZWZhdWx0T3B0aW9ucyk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIE1lcmdlIHRoZSByZXF1ZXN0IG9wdGlvbnMgd2l0aCB0aGUgZGVmYXVsdCByZXF1ZXN0IG9wdGlvbnMuIFRoaXMgZnVuY3Rpb24gaXMgTk9UIGF2YWlsYWJsZSBvbiB0aGUgcHJvdG90eXBlIG9mXG4gICAgICogYEh0dHBDbGllbnRgIGFuZCB3aWxsIGNhbGwgYGhhbmRsZVJlcXVlc3RPcHRpb25zYCB0byBoYW5kbGUgdGhlIG1lcmdlZCByZXF1ZXN0IG9wdGlvbnMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMgdG8gbWVyZ2UuXG4gICAgICogQHJldHVybnMge1JlcXVlc3RPcHRpb25zfSBSZXR1cm5zIHRoZSBtZXJnZWQgcmVxdWVzdCBvcHRpb25zLlxuICAgICAqL1xuICAgIHRoaXMubWVyZ2VPcHRpb25zID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgdmFyIHJlcXVlc3RPcHRpb25zID0gbWVyZ2Uoe30sIGRlZmF1bHRPcHRpb25zLCBvcHRpb25zKTtcblxuICAgICAgICBoYW5kbGVSZXF1ZXN0T3B0aW9ucyhyZXF1ZXN0T3B0aW9ucyk7XG5cbiAgICAgICAgcmV0dXJuIHJlcXVlc3RPcHRpb25zO1xuICAgIH07XG59XG5cbi8qKlxuICogU2VuZCBhbiBodHRwIHJlcXVlc3QuXG4gKlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zIHRvIHVzZSwgd2hpY2ggd2lsbCBiZSBtZXJnZWQgaW50byBhIGNvcHkgb2YgdGhlIGRlZmF1bHQgb3B0aW9ucy5cbiAqIEBwYXJhbSB7UmVxdWVzdFN1Y2Nlc3NDYWxsYmFja30gb25zdWNjZXNzIFRoZSBjYWxsYmFjayB0byBjYWxsIG9uIHN1Y2Nlc3MuXG4gKiBAcGFyYW0ge1JlcXVlc3RFcnJvckNhbGxiYWNrfSBvbmVycm9yIFRoZSBjYWxsYmFjayB0byBjYWxsIG9uIGVycm9yLlxuICogQHJldHVybnMge0h0dHBSZXF1ZXN0fSBSZXR1cm5zIGFuIGluc3RhbmNlIG9mIGBIdHRwUmVxdWVzdGAuXG4gKi9cbkh0dHBDbGllbnQucHJvdG90eXBlLnNlbmQgPSBmdW5jdGlvbiAob3B0aW9ucywgb25zdWNjZXNzLCBvbmVycm9yKSB7XG4gICAgdmFyIHJlcXVlc3RPcHRpb25zID0gdGhpcy5tZXJnZU9wdGlvbnMob3B0aW9ucyk7XG5cbiAgICByZXF1ZXN0T3B0aW9ucy5yZXF1ZXN0RnVuY3Rpb25OYW1lID0gJ3NlbmQnO1xuICAgIHJlcXVlc3RPcHRpb25zLmNvbnRyb2xsZXIgPSBudWxsO1xuXG4gICAgcmV0dXJuIG5ldyBIdHRwUmVxdWVzdChyZXF1ZXN0T3B0aW9ucywgb25zdWNjZXNzLCBvbmVycm9yKTtcbn07XG5cbi8qKlxuICogU2VuZCBhbiBodHRwIHJlcXVlc3QgYW5kIHJldHVybiBhIHByb21pc2UuXG4gKlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zIHRvIHVzZSwgd2hpY2ggd2lsbCBiZSBtZXJnZWQgaW50byBhIGNvcHkgb2YgdGhlIGRlZmF1bHQgb3B0aW9ucy5cbiAqIEByZXR1cm5zIHtQcm9taXNlfSBSZXR1cm5zIGFuIGluc3RhbmNlIG9mIGBQcm9taXNlYC5cbiAqL1xuSHR0cENsaWVudC5wcm90b3R5cGUuZmV0Y2ggPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgIHZhciByZXF1ZXN0T3B0aW9ucyA9IHRoaXMubWVyZ2VPcHRpb25zKG9wdGlvbnMpO1xuICAgIHZhciBjb250cm9sbGVyID0gcmVxdWVzdE9wdGlvbnMuY29udHJvbGxlcjtcblxuICAgIHJlcXVlc3RPcHRpb25zLnJlcXVlc3RGdW5jdGlvbk5hbWUgPSAnZmV0Y2gnO1xuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgdmFyIHJlcXVlc3QgPSBuZXcgSHR0cFJlcXVlc3QocmVxdWVzdE9wdGlvbnMsIGZ1bmN0aW9uIChyZXNwb25zZSkge1xuICAgICAgICAgICAgaWYgKGNvbnRyb2xsZXIpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWNvbnRyb2xsZXIuaXNDYW5jZWxsZWQoKSkge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHJlc3BvbnNlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJlc29sdmUocmVzcG9uc2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LCByZWplY3QpO1xuXG4gICAgICAgIGlmIChjb250cm9sbGVyKSB7XG4gICAgICAgICAgICAvLyBUcmlnZ2VyIHRoZSBgRVJSX0NBTkNFTExFRGAgZXJyb3IuXG4gICAgICAgICAgICBpZiAoY29udHJvbGxlci5pc0NhbmNlbGxlZCgpKSB7XG4gICAgICAgICAgICAgICAgcmVxdWVzdC5jYW5jZWwoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29udHJvbGxlci5yZWdpc3RlckNhbmNlbENhbGxiYWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdC5jYW5jZWwoKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xufTtcblxuLyoqXG4gKiBTZW5kIGEganNvbnAgcmVxdWVzdC5cbiAqXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMgdG8gdXNlLCB3aGljaCB3aWxsIGJlIG1lcmdlZCBpbnRvIGEgY29weSBvZiB0aGUgZGVmYXVsdCBvcHRpb25zLlxuICogQHBhcmFtIHtSZXF1ZXN0U3VjY2Vzc0NhbGxiYWNrfSBvbnN1Y2Nlc3MgVGhlIGNhbGxiYWNrIHRvIGNhbGwgb24gc3VjY2Vzcy5cbiAqIEBwYXJhbSB7UmVxdWVzdEVycm9yQ2FsbGJhY2t9IG9uZXJyb3IgVGhlIGNhbGxiYWNrIHRvIGNhbGwgb24gZXJyb3IuXG4gKiBAcmV0dXJucyB7SlNPTlBSZXF1ZXN0fSBSZXR1cm5zIGFuIGluc3RhbmNlIG9mIGBKU09OUFJlcXVlc3RgLlxuICovXG5IdHRwQ2xpZW50LnByb3RvdHlwZS5nZXRKU09OUCA9IGZ1bmN0aW9uIChvcHRpb25zLCBvbnN1Y2Nlc3MsIG9uZXJyb3IpIHtcbiAgICB2YXIgcmVxdWVzdE9wdGlvbnMgPSB0aGlzLm1lcmdlT3B0aW9ucyhvcHRpb25zKTtcblxuICAgIHJlcXVlc3RPcHRpb25zLnJlcXVlc3RGdW5jdGlvbk5hbWUgPSAnZ2V0SlNPTlAnO1xuICAgIHJlcXVlc3RPcHRpb25zLmNvbnRyb2xsZXIgPSBudWxsO1xuXG4gICAgcmV0dXJuIG5ldyBKU09OUFJlcXVlc3QocmVxdWVzdE9wdGlvbnMsIG9uc3VjY2Vzcywgb25lcnJvcik7XG59O1xuXG4vKipcbiAqIFNlbmQgYSBqc29ucCByZXF1ZXN0IGFuZCByZXR1cm4gYSBwcm9taXNlLlxuICpcbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucyB0byB1c2UsIHdoaWNoIHdpbGwgYmUgbWVyZ2VkIGludG8gYSBjb3B5IG9mIHRoZSBkZWZhdWx0IG9wdGlvbnMuXG4gKiBAcmV0dXJucyB7UHJvbWlzZX0gUmV0dXJucyBhbiBpbnN0YW5jZSBvZiBgUHJvbWlzZWAuXG4gKi9cbkh0dHBDbGllbnQucHJvdG90eXBlLmZldGNoSlNPTlAgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgIHZhciByZXF1ZXN0T3B0aW9ucyA9IHRoaXMubWVyZ2VPcHRpb25zKG9wdGlvbnMpO1xuICAgIHZhciBjb250cm9sbGVyID0gcmVxdWVzdE9wdGlvbnMuY29udHJvbGxlcjtcblxuICAgIHJlcXVlc3RPcHRpb25zLnJlcXVlc3RGdW5jdGlvbk5hbWUgPSAnZmV0Y2hKU09OUCc7XG5cbiAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICB2YXIgcmVxdWVzdCA9IG5ldyBKU09OUFJlcXVlc3QocmVxdWVzdE9wdGlvbnMsIGZ1bmN0aW9uIChyZXNwb25zZSkge1xuICAgICAgICAgICAgaWYgKGNvbnRyb2xsZXIpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWNvbnRyb2xsZXIuaXNDYW5jZWxsZWQoKSkge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHJlc3BvbnNlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJlc29sdmUocmVzcG9uc2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LCByZWplY3QpO1xuXG4gICAgICAgIGlmIChjb250cm9sbGVyKSB7XG4gICAgICAgICAgICAvLyBUcmlnZ2VyIHRoZSBgRVJSX0NBTkNFTExFRGAgZXJyb3IuXG4gICAgICAgICAgICBpZiAoY29udHJvbGxlci5pc0NhbmNlbGxlZCgpKSB7XG4gICAgICAgICAgICAgICAgcmVxdWVzdC5jYW5jZWwoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29udHJvbGxlci5yZWdpc3RlckNhbmNlbENhbGxiYWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdC5jYW5jZWwoKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xufTtcblxuLyoqXG4gKiBDcmVhdGUgYSBuZXcgaW5zdGFuY2Ugb2YgYENhbmNlbENvbnRyb2xsZXJgLlxuICpcbiAqIEByZXR1cm5zIHtDYW5jZWxDb250cm9sbGVyfSBSZXR1cm5zIGFuIG5ldyBpbnN0YW5jZSBvZiBgQ2FuY2VsQ29udHJvbGxlcmAuXG4gKi9cbkh0dHBDbGllbnQucHJvdG90eXBlLmNyZWF0ZUNhbmNlbENvbnRyb2xsZXIgPSBjcmVhdGVDYW5jZWxDb250cm9sbGVyO1xuXG4vKipcbiAqIENyZWF0ZSBhIG5ldyBpbnN0YW5jZSBvZiBgQ2FuY2VsQ29udHJvbGxlcmAuXG4gKlxuICogQHJldHVybnMge0NhbmNlbENvbnRyb2xsZXJ9IFJldHVybnMgYW4gbmV3IGluc3RhbmNlIG9mIGBDYW5jZWxDb250cm9sbGVyYC5cbiAqL1xuSHR0cENsaWVudC5jcmVhdGVDYW5jZWxDb250cm9sbGVyID0gY3JlYXRlQ2FuY2VsQ29udHJvbGxlcjtcblxuLy8gVGhlIHZlcnNpb24uXG5IdHRwQ2xpZW50LnZlcnNpb24gPSB2ZXJzaW9uO1xuSHR0cENsaWVudC5wcm90b3R5cGUudmVyc2lvbiA9IHZlcnNpb247XG5cbmRlZmluZUV4cG9ydHMoSHR0cENsaWVudCwgJ2NvbnN0YW50cycsIG1lcmdlKHt9LCBjb25zdGFudHMpKTtcblxuZGVmaW5lRXhwb3J0cyhIdHRwQ2xpZW50LCAnbGlicycsIHtcbiAgICBRUzogUVNcbn0pO1xuXG5kZWZpbmVFeHBvcnRzKEh0dHBDbGllbnQsICdjbGFzc2VzJywge1xuICAgIENhbmNlbENvbnRyb2xsZXI6IENhbmNlbENvbnRyb2xsZXIsXG4gICAgSHR0cENsaWVudDogSHR0cENsaWVudCxcbiAgICBIdHRwUmVxdWVzdDogSHR0cFJlcXVlc3QsXG4gICAgSHR0cFJlc3BvbnNlOiBIdHRwUmVzcG9uc2UsXG4gICAgSHR0cFJlc3BvbnNlRXJyb3I6IEh0dHBSZXNwb25zZUVycm9yLFxuICAgIEpTT05QUmVxdWVzdDogSlNPTlBSZXF1ZXN0LFxuICAgIEpTT05QUmVzcG9uc2U6IEpTT05QUmVzcG9uc2UsXG4gICAgSlNPTlBSZXNwb25zZUVycm9yOiBKU09OUFJlc3BvbnNlRXJyb3IsXG4gICAgUmVxdWVzdDogUmVxdWVzdCxcbiAgICBSZXNwb25zZTogUmVzcG9uc2UsXG4gICAgUmVzcG9uc2VFcnJvcjogUmVzcG9uc2VFcnJvclxufSk7XG5cbmRlZmluZUV4cG9ydHMoSHR0cENsaWVudCwgJ2Z1bmN0aW9ucycsIHtcbiAgICB0ZW1wbGF0ZTogdGVtcGxhdGUsXG4gICAgbWVyZ2U6IG1lcmdlLFxuICAgIGlzQWJzb2x1dGVVUkw6IGlzQWJzb2x1dGVVUkwsXG4gICAgaXNGdW5jdGlvbjogaXNGdW5jdGlvbixcbiAgICBpc1BsYWluT2JqZWN0OiBpc1BsYWluT2JqZWN0LFxuICAgIHV1aWQ6IHV1aWQsXG4gICAgbm9vcDogbm9vcCxcbiAgICBpbmhlcml0czogaW5oZXJpdHMsXG4gICAgY3JlYXRlRGVmYXVsdE9wdGlvbnM6IGNyZWF0ZURlZmF1bHRPcHRpb25zXG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBIdHRwQ2xpZW50O1xuXG4vKipcbiAqIFRoaXMgY2FsbGJhY2sgaXMgdXNlZCB0byBoYW5sZGUgdGhlIG1lcmdlZCByZXF1ZXN0IG9wdGlvbnMuIEl0IG11c3QgcmV0cnVuIHRoZSByZXN1bHQgc3luY2hyb25vdXNseS5cbiAqXG4gKiBAY2FsbGJhY2sgSGFuZGxlT3B0aW9uc0Z1bmN0aW9uXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSBtZXJnZWQgcmVxdWVzdCBvcHRpb25zLlxuICogQHJldHVybnMge3ZvaWR9XG4gKi9cblxuLyoqXG4gKiBUaGUgY2FsbGJhY2sgdG8gY2FsbCBvbiBzdWNjZXNzLlxuICpcbiAqIEBjYWxsYmFjayBSZXF1ZXN0U3VjY2Vzc0NhbGxiYWNrXG4gKiBAcGFyYW0ge0h0dHBSZXNwb25zZXxhbnl9IHJlc3BvbnNlIFRoZSBodHRwIHJlc3BvbnNlIG9yIHRoZSByZXR1cm4gdmFsdWUgb2YgYG9wdGlvbnMudHJhbnNmb3JtUmVzcG9uc2UocmVzcG9uc2UpYC5cbiAqL1xuXG4vKipcbiAqIFRoZSBjYWxsYmFjayB0byBjYWxsIG9uIGVycm9yLlxuICpcbiAqIEBjYWxsYmFjayBSZXF1ZXN0RXJyb3JDYWxsYmFja1xuICogQHBhcmFtIHtIdHRwUmVzcG9uc2VFcnJvcnxhbnl9IGVycm9yIFRoZSBodHRwIHJlc3BvbnNlIGVycm9yIG9yIHRoZSByZXR1cm4gdmFsdWUgb2YgYG9wdGlvbnMudHJhbnNmb3JtRXJyb3IoZXJyb3IpYC5cbiAqL1xuXG4vKipcbiAqIFRoZSBkZWZpbml0b24gb2YgdGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqXG4gKiBAdHlwZWRlZiB7T2JqZWN0LjxzdHJpbmcsICo+fSBSZXF1ZXN0T3B0aW9uc1xuICpcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbbWV0aG9kXSBUaGUgaHR0cCByZXF1ZXN0IG1ldGhvZC4gVGhlIGRlZmF1bHQgbWV0aG9kIGlzIGBHRVRgLlxuICpcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbYmFzZVVSTF0gVGhlIHJlcXVlc3QgYmFzZSB1cmwuIElmIHRoZSBgdXJsYCBpcyByZWxhdGl2ZSB1cmwsIGFuZCB0aGUgYGJhc2VVUkxgIGlzIG5vdCBgbnVsbGAsIHRoZVxuICogYGJhc2VVUkxgIHdpbGwgYmUgcHJlcGVuZCB0byB0aGUgYHVybGAuXG4gKlxuICogQHByb3BlcnR5IHtzdHJpbmd9IHVybCBUaGUgcmVxdWVzdCB1cmwgdGhhdCBjYW4gY29udGFpbiBhbnkgbnVtYmVyIG9mIHBsYWNlaG9sZGVycywgYW5kIHdpbGwgYmUgY29tcGlsZWQgd2l0aCB0aGVcbiAqIGRhdGEgdGhhdCBwYXNzZWQgaW4gd2l0aCBgb3B0aW9ucy5tb2RlbGAuXG4gKlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgKj59IFttb2RlbF0gVGhlIGRhdGEgdXNlZCB0byBjb21waWxlIHRoZSByZXF1ZXN0IHVybC5cbiAqXG4gKiBAcHJvcGVydHkge09iamVjdC48c3RyaW5nLCAqPn0gW3F1ZXJ5XSBUaGUgZGF0YSB0aGF0IHdpbGwgYmUgY29tcGlsZWQgdG8gcXVlcnkgc3RyaW5nLlxuICpcbiAqIEBwcm9wZXJ0eSB7T2JqZWN0LjxzdHJpbmcsICo+fSBbYm9keV0gVGhlIG9iamVjdCB0aGF0IGNvbnRhaW5zIHRoZSBjb250ZW50IHdoaWNoIHdpbGwgYmUgc2VuZCB0byB0aGUgc2VydmVyLiBUaGlzXG4gKiBvYmplY3QgaGFzIG9ubHkgb25lIHByb3BlcnR5LiBUaGUgbmFtZSBvZiB0aGUgcHJvcGVydHkgaXMgdGhlIGNvbnRlbnQgdHlwZSBvZiB0aGUgY29udGVudCwgd2hpY2ggd2lsbCBiZSB1c2VkIHRvIGZpbmRcbiAqIGEgcHJvY2Vzc29yIGluIGBvcHRpb25zLmh0dHBSZXF1ZXN0Qm9keVByb2Nlc3NvcmAuIFRoZSBwcm9jZXNzb3IgaXMgdXNlZCB0byBwcm9jZXNzIHRoZSB2YWx1ZSBvZiB0aGUgcHJvcGVydHkuIFRoZVxuICogcHJvY2Vzc2VkIHZhbHVlIHdoaWNoIHRoZSBwcm9jZXNzb3IgcmV0dXJucyB3aWxsIGJlIHNlbmQgdG8gdGhlIHNlcnZlciBhcyB0aGUgcmVxdWVzdCBib2R5LlxuICpcbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBbdGltZW91dF0gVGhlIG51bWJlciBvZiBtaWxsaXNlY29uZHMgdGhlIHJlcXVlc3QgY2FuIHRha2UgYmVmb3JlIGl0IGZpbmlzaGVkLiBJZiB0aGUgdGltZW91dCB2YWx1ZVxuICogaXMgYDBgLCBubyB0aW1lciB3aWxsIGJlIHNldC4gSWYgdGhlIHJlcXVlc3QgZG9lcyBub3QgZmluc2loZWQgd2l0aGluIHRoZSBnaXZlbiB0aW1lLCBhIHRpbWVvdXQgZXJyb3Igd2lsbCBiZSB0aHJvd24uXG4gKiBUaGUgZGVmYXVsdCB2YWx1ZSBpcyBgMGAuXG4gKlxuICogQHByb3BlcnR5IHtib29sZWFufSBbY29yc10gV2hldGhlciB0byBzZXQgYHdpdGhDcmVkZW50aWFsc2AgcHJvcGVydHkgb2YgdGhlIGBYTUxIdHRwUmVxdWVzdGAgdG8gYHRydWVgLiBUaGUgZGVmYXVsdFxuICogdmFsdWUgaXMgYGZhbHNlYC5cbiAqXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IFtub0NhY2hlXSBXaGV0aGVyIHRvIGRpc2FibGUgdGhlIGNhY2hlLiBJZiB0aGUgdmFsdWUgaXMgYHRydWVgLCB0aGUgaGVhZGVycyBpblxuICogYG9wdGlvbnMubm9DYWNoZUhlYWRlcnNgIHdpbGwgYmUgc2V0LiBUaGUgZGVmYXVsdCB2YWx1ZSBpcyBgZmFsc2VgLlxuICpcbiAqIEBwcm9wZXJ0eSB7T2JqZWN0LjxzdHJpbmcsICo+fSBbbm9DYWNoZUhlYWRlcnNdIFRoZSBoZWFkZXJzIHRvIHNldCB3aGVuIGBvcHRpb25zLm5vQ2FjaGVgIGlzIHNldCB0byBgdHJ1ZWAuXG4gKlxuICogQHByb3BlcnR5IHtzdHJpbmd9IFtqc29ucF0gVGhlIHF1ZXJ5IHN0cmluZyBrZXkgdG8gaG9sZCB0aGUgdmFsdWUgb2YgdGhlIGNhbGxiYWNrIG5hbWUgd2hlbiBzZW5kaW5nIEpTT05QIHJlcXVlc3QuXG4gKiBUaGUgZGVmYXVsdCB2YWx1ZXMgaXMgYGNhbGxiYWNrYC5cbiAqXG4gKiBAcHJvcGVydHkge09iamVjdC48c3RyaW5nLCAqPn0gW3NldHRpbmdzXSBUaGUgb2JqZWN0IHRvIGtlZXAgdGhlIHNldHRpbmdzIGluZm9ybWF0aW9uIHRoYXQgdGhlIHVzZXIgcGFzc2VkIGluLiBUaGVcbiAqIGxpYnJhcnkgaXRzZWxmIHdpbGwgbm90IHRvdWNoIHRoaXMgcHJvcGVydHkuIFlvdSBjYW4gdXNlIHRoaXMgcHJvcGVydHkgdG8gaG9sZCBhbnkgaW5mb3JtYXRpb24gdGhhdCB5b3Ugd2FudCwgd2hlblxuICogeW91IGV4dGVuZCB0aGUgZnVuY3Rpb25hbGl0eSBvZiB5b3VyIG93biBpbnN0YW5jZSBvZiBgSHR0cENsaWVudGAuIFRoZSBkZWZhdWx0IHZhbHVlIG9mIHRoaXMgcHJvcGVydHkgaXMgYW4gZW1wdHlcbiAqIG9iamVjdC5cbiAqXG4gKiBAcHJvcGVydHkge09iamVjdC48c3RyaW5nLCAqPn0gW2hlYWRlcnNdIFRoZSBvYmplY3QgdGhhdCBjb250YWlucyB0aGUgaGVhZGVycyB0byBzZXQgd2hlbiBzZW5kaW5nIHRoZSByZXF1ZXN0LiBPbmx5XG4gKiB0aGUgbm9uLXVuZGVmaW5lZCBhbmQgbm9uLW51bGwgaGVhZGVycyBhcmUgc2V0LlxuICpcbiAqIEBwcm9wZXJ0eSB7Q2FuY2VsQ29udHJvbGxlcn0gW2NvbnRyb2xsZXJdIFRoZSBgQ2FuY2VsQ29udHJvbGxlcmAgdXNlZCB0byBjYW5jZWwgdGhlIHJlcXVlc3QuIEl0IG9ubHkgd29ya3Mgd2hlbiB1c2luZ1xuICogYGZldGNoYCBvciBgZmV0Y2hKU09OUGAgdG8gc2VuZCByZXF1ZXN0LiBJZiB0aGUgeW91IHNlbmQgcmVxdWVzdCB1c2luZyBgc2VuZGAgb3IgYGdldEpTT05QYCwgdGhlIGBvcHRpb25zLmNvbnRyb2xsZXJgXG4gKiB3aWxsIGJlIHNldCB0byBgbnVsbGAuXG4gKlxuICogQHByb3BlcnR5IHtzdHJpbmd9IFtyZXF1ZXN0RnVuY3Rpb25OYW1lXSBUaGUgbmFtZSBvZiB0aGUgZnVuY3Rpb24gdGhhdCBzZW5kIHRoZSByZXF1ZXN0LiBDYW4gYmUgYHNlbmRgLCBgZmV0Y2hgLFxuICogYGdldEpTT05QYCwgYGZldGNoSlNPTlBgLiBUaGlzIHZhbHVlIGlzIHNldCBieSB0aGUgbGlicmFyeSwgZG9uJ3QgY2hhbmdlIGl0LlxuICpcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbcmVxdWVzdFR5cGVdIFRoZSByZXF1ZXN0IHR5cGUgb2YgdGhpcyByZXF1ZXN0LiBUaGUgdmFsdWUgb2YgaXQgaXMgc2V0IGJ5IHRoZSBsaWJyYXJ5IGl0c2VsZiwgY2FuXG4gKiBiZSBgSFRUUF9SRVFVRVNUYCBvciBgSlNPTlBfUkVRVUVTVGAuIEFueSBvdGhlciB2YWx1ZSB0aGUgdXNlciBwYXNzZWQgaW4gaXMgaWdub3JlZC4gWW91IGNhbiB1c2UgdGhpcyBwcm9wZXJ0eSB0byBnZXRcbiAqIHRoZSB0eXBlIG9mIHRoZSBjdXJyZW50IHJlcXVlc3QuXG4gKlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgKj59IFt4aHJQcm9wc10gVGhlIG9iamVjdCB0aGF0IGNvbnRhaW5zIHRoZSBwcm9wZXJ0aWVzIHRvIHNldCBvbiB0aGUgaW5zdGFuY2Ugb2YgdGhlXG4gKiBgWE1MSHR0cFJlcXVlc3RgLlxuICpcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbdXNlcm5hbWVdIFRoZSB1c2VyIG5hbWUgdG8gdXNlIGZvciBhdXRoZW50aWNhdGlvbiBwdXJwb3Nlcy4gVGhlIGRlZnVhbHQgdmFsdWUgaXMgYG51bGxgLlxuICpcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbcGFzc3dvcmRdIFRoZSBwYXNzd29yZCB0byB1c2UgZm9yIGF1dGhlbnRpY2F0aW9uIHB1cnBvc2VzLiBUaGUgZGVmdWFsdCB2YWx1ZSBpcyBgbnVsbGAuXG4gKlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgaHR0cFJlcXVlc3RCb2R5UHJvY2Vzc29yPn0gW2h0dHBSZXF1ZXN0Qm9keVByb2Nlc3Nvcl0gVGhlIG9iamVjdCB0aGF0IGNvbnRhaW5zIHRoZVxuICogaHR0cCByZXF1ZXN0IGJvZHkgcHJvY2Vzc29ycy5cbiAqXG4gKiBAcHJvcGVydHkge09iamVjdC48c3RyaW5nLCBSZXNwb25zZVBhcnNlRnVuY3Rpb24+fSBbaHR0cFJlc3BvbnNlUGFyc2VyXSBUaGUgb2JqZWN0IHRoYXQgY29udGFpbnMgdGhlIGh0dHAgcmVzcG9uc2VcbiAqIHBhcnNlcnMuXG4gKlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgUmVzcG9uc2VQYXJzZUZ1bmN0aW9uPn0gW2pzb25wUmVzcG9uc2VQYXJzZXJdIFRoZSBvYmplY3QgdGhhdCBjb250YWlucyB0aGUganNvbnAgcmVzcG9uc2VcbiAqIHBhcnNlcnMuXG4gKlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgUmVzcG9uc2VFcnJvclBhcnNlRnVuY3Rpb24+fSBbaHR0cFJlc3BvbnNlRXJyb3JQYXJzZXJdIFRoZSBvYmplY3QgdGhhdCBjb250YWlucyB0aGUgaHR0cFxuICogcmVzcG9uc2UgZXJyb3IgcGFyc2Vycy5cbiAqXG4gKiBAcHJvcGVydHkge09iamVjdC48c3RyaW5nLCBSZXNwb25zZUVycm9yUGFyc2VGdW5jdGlvbj59IFtqc29ucFJlc3BvbnNlRXJyb3JQYXJzZXJdIFRoZSBvYmplY3QgdGhhdCBjb250YWlucyB0aGUganNvbnBcbiAqIHJlc3BvbnNlIGVycm9yIHBhcnNlcnMuXG4gKlxuICogQHByb3BlcnR5IHtIYW5sZGVPcHRpb25zRnVuY3Rpb259IFtoYW5kbGVPcHRpb25zXSBUaGUgZnVuY3Rpb24gdG8gaGFuZGxlIHRoZSBvcHRpb25zLlxuICpcbiAqIEBwcm9wZXJ0eSB7Q3JlYXRlWEhSRnVuY3Rpb259IFtjcmVhdGVYSFJdIFRoZSBmdW5jdGlvbiB0byBjcmVhdGUgdGhlIGBYTUxIdHRwUmVxdWVzdGAgaW5zdGFuY2UuXG4gKlxuICogQHByb3BlcnR5IHtTY3JpcHRDcmVhdGVGdW5jdGlvbn0gW2NyZWF0ZVNjcmlwdF0gVGhlIGZ1bmN0aW9uIHRvIGNyZWF0ZSB0aGUgYEhUTUxTY3JpcHRFbGVtZW50YCBpbnN0YW5jZS5cbiAqXG4gKiBAcHJvcGVydHkge0pTT05QQ29udGFpbmVyRmluZEZ1bmN0aW9ufSBbanNvbnBDb250YWluZXJOb2RlXSBUaGUgZnVuY3Rpb24gdGhhdCByZXR1cm5zIHRoZSBjb250YWluZXIgbm9kZSwgd2hpY2ggd2lsbFxuICogYmUgdXNlZCB0byBhcHBlbmQgdGhlIHNjcmlwdCBlbGVtZW50IHdoZW4gc2VuZGluZyBqc29ucCByZXF1ZXN0LlxuICpcbiAqIEBwcm9wZXJ0eSB7SlNPTlBDYWxsYmFja05hbWVHZW5lcmF0ZUZ1bmN0aW9ufSBbanNvbnBDYWxsYmFja05hbWVdIFRoZSBmdW5jdGlvbiB0byBnZW5lcmF0ZSB0aGUgdW5pcXVlIGNhbGxiYWNrIG5hbWVcbiAqIHdoZW4gc2VuZGluZyBqc29ucCByZXF1ZXN0LlxuICpcbiAqIEBwcm9wZXJ0eSB7Q29tcGlsZVVSTEZ1bmN0aW9ufSBbY29tcGlsZVVSTF0gVGhlIGZ1bmN0aW9uIHRvIGNvbXBpbGUgdXJsLlxuICpcbiAqIEBwcm9wZXJ0eSB7RW5jb2RlUXVlcnlTdHJpbmdGdW5jdGlvbn0gZW5jb2RlUXVlcnlTdHJpbmcgVGhlIGZ1bmN0aW9uIHRvIGVuY29kZSB0aGUgcXVlcnkgc3RyaW5nLlxuICpcbiAqIEBwcm9wZXJ0eSB7WEhSSG9va0Z1bmN0aW9ufSBvblhockNyZWF0ZWQgVGhlIGZ1bmN0aW9uIHRvIGNhbGwgb24geGhyIGNyZWF0ZWQuXG4gKlxuICogQHByb3BlcnR5IHtYSFJIb29rRnVuY3Rpb259IG9uWGhyT3BlbmVkIFRoZSBmdW5jdG9uIHRvIGNhbGwgb24geGhyIG9wZW5lZC5cbiAqXG4gKiBAcHJvcGVydHkge1hIUkhvb2tGdW5jdGlvbn0gb25YaHJTZW50IFRoZSBmdW5jdGlvbiB0byBjYWxsIG9uIHhociBzZW50LlxuICpcbiAqIEBwcm9wZXJ0eSB7UmVxdWVzdENyZWF0ZWRGdW5jdGlvbn0gb25SZXF1ZXN0Q3JlYXRlZCBUaGUgZnVuY3Rpb24gdG8gY2FsbCBvbiByZXF1ZXN0IGNyZWF0ZWQuXG4gKlxuICogQHByb3BlcnR5IHtDaGVja1Jlc3BvbnNlT2tGdW5jdGlvbn0gaXNSZXNwb25zZU9rIFRoZSBmdW5jdGlvbiB0byBjaGVjayB3aGV0aGVyIHRoZSByZXNwb25zZSBpcyBvay5cbiAqXG4gKiBAcHJvcGVydHkge1RyYW5zZm9ybUVycm9yRnVuY3Rpb259IHRyYW5zZm9ybUVycm9yIFRoZSBmdW5jdGlvbiB0byB0cmFuc2Zyb20gdGhlIHJlc3BvbnNlIGVycm9yLiBUaGUgcmV0dXJuIHZhbHVlIG9mXG4gKiB0aGlzIGZ1bmN0aW9uIHdpbGwgYmUgcGFzc2VkIHRvIHRoZSBgb25lcnJvcmAgY2FsbGJhY2suXG4gKlxuICogQHByb3BlcnR5IHtUcmFuc2Zvcm1SZXNwb25zZUZ1bmN0aW9ufSB0cmFuc2Zvcm1SZXNwb25zZSBUaGUgZnVuY3Rpb24gdG8gdHJhbnNmcm9tIHRoZSByZXNwb25zZS4gVGhlIHJldHVybiB2YWx1ZSBvZlxuICogdGhpcyBmdW5jdGlvbiB3aWxsIGJlIHBhc3NlZCB0byB0aGUgYG9uc3VjY2Vzc2AgY2FsbGJhY2suXG4gKlxuICogQHByb3BlcnR5IHtDaGVja1Nob3VsZENhbGxFcnJvckNhbGxiYWNrRnVuY3Rpb259IHNob3VsZENhbGxFcnJvckNhbGxiYWNrIFRoZSBmdW5jdGlvbiB0byBjaGVjayB3aGV0aGVyIHRvIGNhbGwgdGhlXG4gKiBlcnJvciBjYWxsYmFjay5cbiAqXG4gKiBAcHJvcGVydHkge0NoZWNrU2hvdWxkQ2FsbFN1Y2Nlc3NDYWxsYmFja0Z1bmN0aW9ufSBzaG91bGRDYWxsU3VjY2Vzc0NhbGxiYWNrIFRoZSBmdW5jdGlvbiB0byBjaGVjayB3aGV0aGVyIHRvIGNhbGxcbiAqIHRoZSBzdWNjZXNzIGNhbGxiYWNrLlxuICovXG5cbi8qKlxuICogVGhlIGRlZmluaXRvbiBvZiBodHRwIHJlcXVlc3QgZGF0YSBwcm9jZXNzb3IuXG4gKlxuICogQHR5cGVkZWYge09iamVjdC48c3RyaW5nLCAqPn0gaHR0cFJlcXVlc3RCb2R5UHJvY2Vzc29yXG4gKiBAcHJvcGVydHkge251bWJlcn0gcHJpb3JpdHkgVGhlIHByaW9yaXR5IG9mIHRoZSBwcm9jZXNzb3IuXG4gKiBAcHJvcGVydHkge09iamVjdC48c3RyaW5nLCAqPn0gW2hlYWRlcnNdIFRoZSBoZWFkZXJzIHRvIHNldCB3aGVuIHRoaXMgcHJvY2Vzc29yIGlzIHVzZWQuXG4gKiBAcHJvcGVydHkge0h0dHBSZXF1ZXN0Q29udGVudFByb2Nlc3NGdW5jdGlvbn0gW3Byb2Nlc3Nvcl0gVGhlIGZ1bmN0aW9uIHRvIHByb2Nlc3MgdGhlIHJlcXVlc3QgYm9keS5cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBoYW5kbGUgdGhlIG9wdGlvbnMuXG4gKlxuICogQGNhbGxiYWNrIEhhbmxkZU9wdGlvbnNGdW5jdGlvblxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICovXG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIHByb2Nlc3MgdGhlIHJlcXVlc3QgZGF0YS5cbiAqXG4gKiBAY2FsbGJhY2sgSHR0cFJlcXVlc3RDb250ZW50UHJvY2Vzc0Z1bmN0aW9uXG4gKiBAcGFyYW0ge09iamVjdC48c3RyaW5nLCAqPn0gY29udGVudCBUaGUgY29uZW50IG5lZWQgdG8gcHJvY2Vzcy5cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucyBvZiB0aGUgY3VycmVudCByZXF1ZXN0LlxuICogQHJldHVybnMge2FueX0gUmV0dXJucyB0aGUgdmFsdWUgdGhhdCB3aWxsIGJlIHNlbmQgdG8gdGhlIHNlcnZlci5cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBwYXJzZSB0aGUgcmVzcG9uc2UuIFRoaXMgZnVuY3Rpb24gd2lsbCBiZSBtb3VudGVkIG9uIHRoZSByZXNwb25zZSBpbnN0YW5jZSwgd2hpY2ggbWFkZSBpdCBhIG1ldGhvZFxuICogb2YgdGhlIGBSZXNwb25zZWAgaW5zdGFuY2UuIFRoZSBwYXJhbWV0ZXJzIGFuZCB0aGUgcmV0dXJuIHZhbHVlIGlzIHVwIG9uIHlvdS5cbiAqXG4gKiBAY2FsbGJhY2sgUmVzcG9uc2VQYXJzZUZ1bmN0aW9uXG4gKi9cblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gcGFyc2UgdGhlIHJlc3BvbnNlIGVycm9yLiBUaGlzIGZ1bmN0aW9uIHdpbGwgYmUgbW91bnRlZCBvbiB0aGUgcmVzcG9uc2UgZXJyb3IgaW5zdGFuY2UsIHdoaWNoIG1hZGUgaXRcbiAqIGEgbWV0aG9kIG9mIHRoZSBgUmVzcG9uc2VFcnJvcmAgaW5zdGFuY2UuIFRoZSBwYXJhbWV0ZXJzIGFuZCB0aGUgcmV0dXJuIHZhbHVlIGlzIHVwIG9uIHlvdS5cbiAqXG4gKiBAY2FsbGJhY2sgUmVzcG9uc2VFcnJvclBhcnNlRnVuY3Rpb25cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBjcmVhdGUgdGhlIGBYTUxIdHRwUmVxdWVzdGAgaW5zdGFuY2UuXG4gKlxuICogQGNhbGxiYWNrIENyZWF0ZVhIUkZ1bmN0aW9uXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcmV0dXJucyB7WE1MSHR0cFJlcXVlc3R9IFJldHVybnMgYW4gaW5zdGFuY2Ugb2YgYFhNTEh0dHBSZXF1ZXN0YC5cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBjcmVhdGUgdGhlIGBIVE1MU2NyaXB0RWxlbWVudGAgaW5zdGFuY2UuXG4gKlxuICogQGNhbGxiYWNrIFNjcmlwdENyZWF0ZUZ1bmN0aW9uXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcmV0dXJucyB7SFRNTFNjcmlwdEVsZW1lbnR9IFJldHVybnMgYW4gaW5zdGFuY2Ugb2YgYEhUTUxTY3JpcHRFbGVtZW50YC5cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0aGF0IHJldHVybnMgdGhlIG5vZGUgdG8gYXBwZW5kIHRoZSBzY3JpcHQgZWxlbWVudC5cbiAqXG4gKiBAY2FsbGJhY2sgSlNPTlBDb250YWluZXJGaW5kRnVuY3Rpb25cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEByZXR1cm5zIHtOb2RlfSBSZXR1cm5zIHRoZSBub2RlIHRvIGFwcGVuZCB0aGUgc2NyaXB0IGVsZW1lbnQuXG4gKi9cblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gZ2VuZXJhdGUgdGhlIHVuaXF1ZSBjYWxsYmFjayBuYW1lLlxuICpcbiAqIEBjYWxsYmFjayBKU09OUENhbGxiYWNrTmFtZUdlbmVyYXRlRnVuY3Rpb25cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEByZXR1cm5zIHtzdHJpbmd9IFJldHJ1bnMgYSB2YWxpZCBqYXZhc2NyaXB0IGlkZW50aWZpZXIgdG8gaG9sZCB0aGUgY2FsbGJhay5cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBjb21waWxlIHRoZSByZXF1ZXN0IHVybC5cbiAqXG4gKiBAY2FsbGJhY2sgQ29tcGlsZVVSTEZ1bmN0aW9uXG4gKiBAcGFyYW0ge3N0cmluZ30gdXJsIFRoZSB1cmwgKHdpdGggYmFzZVVSTCkgdG8gY29tcGlsZS5cbiAqIEBwYXJhbSB7T2JqZWN0LjxzdHJpbmcsICo+fSBwYXJhbSBUaGUgcGFyYW0gdG8gY29tcGlsZSB0aGUgdXJsLlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICogQHJldHVybnMge3N0cmluZ30gUmV0dXJucyB0aGUgY29tcGlsZWQgdXJsLlxuICovXG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGVuY29kZSB0aGUgcXVlcnkgc3RyaW5nLlxuICpcbiAqIEBjYWxsYmFjayBFbmNvZGVRdWVyeVN0cmluZ0Z1bmN0aW9uXG4gKiBAcGFyYW0ge09iamVjdC48c3RyaW5nLCAqPn0gZGF0YSBUaGUgZGF0YSB0byBiZSBlbmNvZGVkIHRvIHF1ZXJ5IHN0cmluZy5cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEByZXR1cm5zIHtzdHJpbmd9IFJldHVybnMgdGhlIGVuY29kZWQgcXVlcnkgc3RyaW5nLlxuICovXG5cbi8qKlxuICogVGhlIHhociBob29rIGZ1bmN0aW9uLlxuICpcbiAqIEBjYWxsYmFjayBYSFJIb29rRnVuY3Rpb25cbiAqIEBwYXJhbSB7WE1MSHR0cFJlcXVlc3R9IHhociBUaGUgaW5zdGFuY2Ugb2YgYFhNTEh0dHBSZXF1ZXN0YC5cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqL1xuXG4vKipcbiAqIEBjYWxsYmFjayBSZXF1ZXN0Q3JlYXRlZEZ1bmN0aW9uXG4gKiBAcGFyYW0ge0h0dHBSZXF1ZXN0fEpTT05QUmVxdWVzdH0gcmVxdWVzdCBUaGUgcmVxdWVzdCBpbnN0YW5jZSwgY2FuIGJlIGBIdHRwUmVxdWVzdGAgb3IgYEpTT05QUmVxdWVzdGAuXG4gKi9cblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gY2hlY2sgd2hldGhlciB0aGUgcmVzcG9uc2UgaXMgb2suXG4gKlxuICogQGNhbGxiYWNrIENoZWNrUmVzcG9uc2VPa0Z1bmN0aW9uXG4gKiBAcGFyYW0ge3N0cmluZ30gcmVxdWVzdFR5cGUgVGhlIHJlcXVlc3QgdHlwZSwgYEhUVFBfUkVRVUVTVGAgb3IgYEpTT05QX1JFUVVFU1RgLlxuICogQHBhcmFtIHtSZXNwb25zZX0gcmVzcG9uc2UgVGhlIHJlc3BvbnNlIGluc3RhbmNlLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSByZXNwb25zZSBpcyBvaywgb3RoZXJ3aXNlIGBmYWxzZWAgaXMgcmV0dXJuZWQuXG4gKi9cblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gY2hlY2sgd2hldGhlciB0byBjYWxsIHRoZSBlcnJvciBjYWxsYmFjay5cbiAqXG4gKiBAY2FsbGJhY2sgQ2hlY2tTaG91bGRDYWxsRXJyb3JDYWxsYmFja0Z1bmN0aW9uXG4gKiBAcGFyYW0ge3N0cmluZ30gcmVxdWVzdFR5cGUgVGhlIHJlcXVlc3QgdHlwZSwgYEhUVFBfUkVRVUVTVGAgb3IgYEpTT05QX1JFUVVFU1RgLlxuICogQHBhcmFtIHthbnl9IHRyYW5zZm9ybWVkRXJyb3IgVGhlIGRhdGEgdGhhdCBgb3B0aW9ucy50cmFuc2Zvcm1FcnJvciguLi4pYCByZXR1cm5zLlxuICogQHBhcmFtIHtIdHRwUmVzcG9uc2VFcnJvcnxKU09OUFJlc3BvbnNlRXJyb3J9IGVycm9yIFRoZSByZXNwb25zZSBlcnJvci5cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBjaGVjayB3aGV0aGVyIHRvIGNhbGwgdGhlIHN1Y2Nlc3MgY2FsbGJhY2suXG4gKlxuICogQGNhbGxiYWNrIENoZWNrU2hvdWxkQ2FsbFN1Y2Nlc3NDYWxsYmFja0Z1bmN0aW9uXG4gKiBAcGFyYW0ge3N0cmluZ30gcmVxdWVzdFR5cGUgVGhlIHJlcXVlc3QgdHlwZSwgYEhUVFBfUkVRVUVTVGAgb3IgYEpTT05QX1JFUVVFU1RgLlxuICogQHBhcmFtIHthbnl9IHRyYW5zZm9ybWVkUmVzcG9uc2UgVGhlIGRhdGEgdGhhdCBgb3B0aW9ucy50cmFuc2Zvcm1SZXNwb25zZSguLi4pYCByZXR1cm5zLlxuICogQHBhcmFtIHtIdHRwUmVzcG9uc2V8SlNPTlBSZXNwb25zZX0gcmVzcG9uc2UgVGhlIHJlc3BvbnNlLlxuICovXG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIHRyYW5zZnJvbSB0aGUgcmVzcG9uc2UuIFRoZSByZXR1cm4gdmFsdWUgb2YgdGhpcyBmdW5jdGlvbiB3aWxsIGJlIHBhc3NlZCB0byB0aGUgYG9uc3VjY2Vzc2AgY2FsbGJhY2suXG4gKlxuICogQGNhbGxiYWNrIFRyYW5zZm9ybVJlc3BvbnNlRnVuY3Rpb25cbiAqIEBwYXJhbSB7c3RyaW5nfSByZXF1ZXN0VHlwZSBUaGUgcmVxdWVzdCB0eXBlLCBgSFRUUF9SRVFVRVNUYCBvciBgSlNPTlBfUkVRVUVTVGAuXG4gKiBAcGFyYW0ge0h0dHBSZXNwb25zZXxKU09OUFJlc3BvbnNlfSByZXNwb25zZSBUaGUgcmVzcG9uc2UuXG4gKiBAcmV0dXJucyB7YW55fSBSZXR1cm5zIHRoZSB0cmFuc2Zvcm1lZCByZXNwb25zZS5cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byB0cmFuc2Zyb20gdGhlIHJlc3BvbnNlIGVycm9yLiBUaGUgcmV0dXJuIHZhbHVlIG9mIHRoaXMgZnVuY3Rpb24gd2lsbCBiZSBwYXNzZWQgdG8gdGhlIGBvbmVycm9yYFxuICogY2FsbGJhY2suXG4gKlxuICogQGNhbGxiYWNrIFRyYW5zZm9ybUVycm9yRnVuY3Rpb25cbiAqIEBwYXJhbSB7c3RyaW5nfSByZXF1ZXN0VHlwZSBUaGUgcmVxdWVzdCB0eXBlLCBgSFRUUF9SRVFVRVNUYCBvciBgSlNPTlBfUkVRVUVTVGAuXG4gKiBAcGFyYW0ge0h0dHBSZXNwb25zZUVycm9yfEpTT05QUmVzcG9uc2VFcnJvcn0gZXJyb3IgVGhlIHJlc3BvbnNlIGVycm9yLlxuICogQHJldHVybnMge2FueX0gUmV0dXJucyB0aGUgdHJhbnNmb3JtZWQgcmVzcG9uc2UgZXJyb3IuXG4gKi9cbiIsInZhciBSZXF1ZXN0ID0gcmVxdWlyZSg5KTtcbnZhciBjb25zdGFudHMgPSByZXF1aXJlKDI1KTtcbnZhciBpbmhlcml0cyA9IHJlcXVpcmUoMzIpO1xudmFyIGJ1aWxkVVJMID0gcmVxdWlyZSgyMyk7XG52YXIgaGFuZGxlT3B0aW9ucyA9IHJlcXVpcmUoMzApO1xudmFyIGNhbGxSZXF1ZXN0Q3JlYXRlZENhbGxiYWNrID0gcmVxdWlyZSgyNCk7XG52YXIgYWRkRXZlbnRMaXN0ZW5lcnMgPSByZXF1aXJlKDEyKTtcbnZhciBoYW5kbGVYaHJQcm9wcyA9IHJlcXVpcmUoMTcpO1xudmFyIGhhbmRsZUhlYWRlcnMgPSByZXF1aXJlKDE1KTtcbnZhciBoYW5kbGVSZXF1ZXN0Qm9keSA9IHJlcXVpcmUoMTYpO1xudmFyIGNhbGxYaHJIb29rID0gcmVxdWlyZSgxNCk7XG5cbi8qKlxuICogaHR0cCByZXF1ZXN0LlxuICpcbiAqIEBjbGFzc1xuICogQGV4dGVuZHMge1JlcXVlc3R9XG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcGFyYW0ge1JlcXVlc3RTdWNjZXNzQ2FsbGJhY2t9IG9uc3VjY2VzcyBUaGUgY2FsbGJhY2sgdG8gY2FsbCBvbiBzdWNjZXNzLlxuICogQHBhcmFtIHtSZXF1ZXN0RXJyb3JDYWxsYmFja30gb25lcnJvciBUaGUgY2FsbGJhY2sgdG8gY2FsbCBvbiBlcnJvci5cbiAqL1xuZnVuY3Rpb24gSHR0cFJlcXVlc3Qob3B0aW9ucywgb25zdWNjZXNzLCBvbmVycm9yKSB7XG4gICAgdmFyIHhocjtcbiAgICB2YXIgYm9keTtcbiAgICB2YXIgdXJsO1xuXG4gICAgLy8gQ2FsbCB0aGUgc3VwZXIgY29uc3RydWN0b3IuXG4gICAgUmVxdWVzdC5jYWxsKHRoaXMsIGNvbnN0YW50cy5IVFRQX1JFUVVFU1QsIG9wdGlvbnMsIG9uc3VjY2Vzcywgb25lcnJvcik7XG5cbiAgICAvLyBDYWxsIGBvcHRpb25zLmhhbmRsZU9wdGlvbnNgIHRvIGhhbmRsZSBvcHRpb25zLlxuICAgIGhhbmRsZU9wdGlvbnMob3B0aW9ucyk7XG5cbiAgICB4aHIgPSB0aGlzLnhociA9IG9wdGlvbnMuY3JlYXRlWEhSLmNhbGwobnVsbCwgb3B0aW9ucyk7XG4gICAgYm9keSA9IGhhbmRsZVJlcXVlc3RCb2R5KG9wdGlvbnMpO1xuICAgIHVybCA9IGJ1aWxkVVJMKG9wdGlvbnMpO1xuXG4gICAgLy8gU2V0IHByb3BlcnRpZXMgdG8gdGhlIHhoci5cbiAgICBoYW5kbGVYaHJQcm9wcyh4aHIsIG9wdGlvbnMpO1xuXG4gICAgLy8gQ2FsbCBvblhockNyZWF0ZWQuXG4gICAgY2FsbFhockhvb2sob3B0aW9ucy5vblhockNyZWF0ZWQsIHhociwgb3B0aW9ucyk7XG5cbiAgICAvLyBPcGVuIHRoZSByZXF1ZXN0LlxuICAgIHhoci5vcGVuKG9wdGlvbnMubWV0aG9kIHx8ICdHRVQnLCB1cmwsIHRydWUsIG9wdGlvbnMudXNlcm5hbWUsIG9wdGlvbnMucGFzc3dvcmQpO1xuXG4gICAgLy8gQWRkIGV2ZW50IGxpc3RlbmVycy5cbiAgICBhZGRFdmVudExpc3RlbmVycyh0aGlzKTtcblxuICAgIC8vIENhbGwgb25YaHJPcGVuZWQuXG4gICAgY2FsbFhockhvb2sob3B0aW9ucy5vblhock9wZW5lZCwgeGhyLCBvcHRpb25zKTtcblxuICAgIC8vIEhhbmxkZSBoZWFkZXJzLlxuICAgIGhhbmRsZUhlYWRlcnMoeGhyLCBvcHRpb25zKTtcblxuICAgIC8vIFNlbmQgdGhlIGJvZHkgdG8gdGhlIHNlcnZlci5cbiAgICB4aHIuc2VuZChib2R5KTtcblxuICAgIC8vIENhbGwgb25YaHJTZW50LlxuICAgIGNhbGxYaHJIb29rKG9wdGlvbnMub25YaHJTZW50LCB4aHIsIG9wdGlvbnMpO1xuXG4gICAgLy8gQ2FsbCBvblJlcXVlc3RDcmVhdGVkXG4gICAgY2FsbFJlcXVlc3RDcmVhdGVkQ2FsbGJhY2sob3B0aW9ucywgdGhpcyk7XG59XG5cbmluaGVyaXRzKEh0dHBSZXF1ZXN0LCBSZXF1ZXN0KTtcblxubW9kdWxlLmV4cG9ydHMgPSBIdHRwUmVxdWVzdDtcbiIsIi8qKlxuICogSHR0cFJlc3BvbnNlIG1vZHVsZS5cbiAqXG4gKiBAbW9kdWxlIGNsYXNzL0h0dHBSZXNwb25zZVxuICovXG5cbnZhciBSZXNwb25zZSA9IHJlcXVpcmUoMTApO1xudmFyIGluaGVyaXRzID0gcmVxdWlyZSgzMik7XG52YXIgYWRkQ3VzdG9tUGFyc2VyID0gcmVxdWlyZSgyMik7XG5cbi8qKlxuICogVGhlIEh0dHBSZXNwb25zZSBjbGFzcy5cbiAqXG4gKiBAY2xhc3NcbiAqIEBwYXJhbSB7SHR0cFJlcXVlc3R9IHJlcXVlc3QgVGhlIGh0dHAgcmVxdWVzdC5cbiAqL1xuZnVuY3Rpb24gSHR0cFJlc3BvbnNlKHJlcXVlc3QpIHtcbiAgICBSZXNwb25zZS5jYWxsKHRoaXMsIHJlcXVlc3QpO1xuICAgIGFkZEN1c3RvbVBhcnNlcih0aGlzLCByZXF1ZXN0Lm9wdGlvbnMsICdodHRwUmVzcG9uc2VQYXJzZXInKTtcbn1cblxuaW5oZXJpdHMoSHR0cFJlc3BvbnNlLCBSZXNwb25zZSk7XG5cbm1vZHVsZS5leHBvcnRzID0gSHR0cFJlc3BvbnNlO1xuIiwidmFyIFJlc3BvbnNlRXJyb3IgPSByZXF1aXJlKDExKTtcbnZhciBpbmhlcml0cyA9IHJlcXVpcmUoMzIpO1xudmFyIGFkZEN1c3RvbVBhcnNlciA9IHJlcXVpcmUoMjIpO1xuXG4vKipcbiAqIEBjbGFzc1xuICogQHBhcmFtIHtzdHJpbmd9IGNvZGUgVGhlIGVycm9yIGNvZGUuXG4gKiBAcGFyYW0ge0h0dHBSZXF1ZXN0fSByZXF1ZXN0IFRoZSBodHRwIHJlcXVlc3QuXG4gKi9cbmZ1bmN0aW9uIEh0dHBSZXNwb25zZUVycm9yKGNvZGUsIHJlcXVlc3QpIHtcbiAgICBSZXNwb25zZUVycm9yLmNhbGwodGhpcywgY29kZSwgcmVxdWVzdCk7XG4gICAgYWRkQ3VzdG9tUGFyc2VyKHRoaXMsIHJlcXVlc3Qub3B0aW9ucywgJ2h0dHBSZXNwb25zZUVycm9yUGFyc2VyJyk7XG59XG5cbmluaGVyaXRzKEh0dHBSZXNwb25zZUVycm9yLCBSZXNwb25zZUVycm9yKTtcblxubW9kdWxlLmV4cG9ydHMgPSBIdHRwUmVzcG9uc2VFcnJvcjtcbiIsInZhciBSZXF1ZXN0ID0gcmVxdWlyZSg5KTtcbnZhciBjb25zdGFudHMgPSByZXF1aXJlKDI1KTtcbnZhciBpbmhlcml0cyA9IHJlcXVpcmUoMzIpO1xudmFyIGhhbmRsZU9wdGlvbnMgPSByZXF1aXJlKDMwKTtcbnZhciBjYWxsUmVxdWVzdENyZWF0ZWRDYWxsYmFjayA9IHJlcXVpcmUoMjQpO1xudmFyIGFkZEV2ZW50TGlzdGVuZXJzID0gcmVxdWlyZSgxOCk7XG52YXIgYnVpbGRDYWxsYmFja05hbWUgPSByZXF1aXJlKDE5KTtcbnZhciBoYW5kbGVTY3JpcHRDb3JzID0gcmVxdWlyZSgyMSk7XG52YXIgYnVpbGRTY3JpcHRTcmMgPSByZXF1aXJlKDIwKTtcblxuLyoqXG4gKiBKU09OUCByZXF1ZXN0LlxuICpcbiAqIEBjbGFzc1xuICogQGV4dGVuZHMge1JlcXVlc3R9XG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcGFyYW0ge1JlcXVlc3RTdWNjZXNzQ2FsbGJhY2t9IG9uc3VjY2VzcyBUaGUgY2FsbGJhY2sgdG8gY2FsbCBvbiBzdWNjZXNzLlxuICogQHBhcmFtIHtSZXF1ZXN0RXJyb3JDYWxsYmFja30gb25lcnJvciBUaGUgY2FsbGJhY2sgdG8gY2FsbCBvbiBlcnJvci5cbiAqL1xuZnVuY3Rpb24gSlNPTlBSZXF1ZXN0KG9wdGlvbnMsIG9uc3VjY2Vzcywgb25lcnJvcikge1xuICAgIHZhciBzcmM7XG4gICAgdmFyIHNjcmlwdDtcbiAgICB2YXIgY2FsbGJhY2tOYW1lO1xuICAgIHZhciBjb250YWluZXJOb2RlO1xuXG4gICAgUmVxdWVzdC5jYWxsKHRoaXMsIGNvbnN0YW50cy5KU09OUF9SRVFVRVNULCBvcHRpb25zLCBvbnN1Y2Nlc3MsIG9uZXJyb3IpO1xuXG4gICAgLy8gQ2FsbCBgb3B0aW9ucy5oYW5kbGVPcHRpb25zYCB0byBoYW5kbGUgb3B0aW9ucy5cbiAgICBoYW5kbGVPcHRpb25zKG9wdGlvbnMpO1xuXG4gICAgc2NyaXB0ID0gdGhpcy5zY3JpcHQgPSBvcHRpb25zLmNyZWF0ZVNjcmlwdC5jYWxsKG51bGwsIG9wdGlvbnMpO1xuICAgIGNvbnRhaW5lck5vZGUgPSBvcHRpb25zLmpzb25wQ29udGFpbmVyTm9kZS5jYWxsKG51bGwsIG9wdGlvbnMpO1xuICAgIGNhbGxiYWNrTmFtZSA9IGJ1aWxkQ2FsbGJhY2tOYW1lKG9wdGlvbnMpO1xuICAgIHNyYyA9IGJ1aWxkU2NyaXB0U3JjKG9wdGlvbnMsIGNhbGxiYWNrTmFtZSk7XG5cbiAgICAvLyBTZXQgdGhlIHNyYyBhdHRyaWJ1dGUuXG4gICAgc2NyaXB0LnNldEF0dHJpYnV0ZSgnc3JjJywgc3JjKTtcblxuICAgIC8vIEhhbmRsZSBgb3B0aW9ucy5jb3JzYC5cbiAgICBoYW5kbGVTY3JpcHRDb3JzKHNjcmlwdCwgb3B0aW9ucyk7XG5cbiAgICAvLyBBZGQgZXZlbnQgbGlzdGVuZXJzLlxuICAgIGFkZEV2ZW50TGlzdGVuZXJzKHRoaXMsIGNhbGxiYWNrTmFtZSk7XG5cbiAgICAvLyBJbmplY3QgdGhlIHNjcmlwdCBub2RlLlxuICAgIGNvbnRhaW5lck5vZGUuYXBwZW5kQ2hpbGQoc2NyaXB0KTtcblxuICAgIC8vIENhbGwgb25SZXF1ZXN0Q3JlYXRlZC5cbiAgICBjYWxsUmVxdWVzdENyZWF0ZWRDYWxsYmFjayhvcHRpb25zLCB0aGlzKTtcbn1cblxuaW5oZXJpdHMoSlNPTlBSZXF1ZXN0LCBSZXF1ZXN0KTtcblxubW9kdWxlLmV4cG9ydHMgPSBKU09OUFJlcXVlc3Q7XG4iLCIvKipcbiAqIEpTT05QUmVzcG9uc2UgbW9kdWxlLlxuICpcbiAqIEBtb2R1bGUgY2xhc3MvSlNPTlBSZXNwb25zZVxuICovXG5cbnZhciBSZXNwb25zZSA9IHJlcXVpcmUoMTApO1xudmFyIGluaGVyaXRzID0gcmVxdWlyZSgzMik7XG52YXIgYWRkQ3VzdG9tUGFyc2VyID0gcmVxdWlyZSgyMik7XG5cbi8qKlxuICogVGhlIEpTT05QUmVzcG9uc2UgY2xhc3MuXG4gKlxuICogQGNsYXNzXG4gKiBAcGFyYW0ge0pTT05SZXF1ZXN0fSByZXF1ZXN0IFRoZSBodHRwIHJlcXVlc3QuXG4gKi9cbmZ1bmN0aW9uIEpTT05QUmVzcG9uc2UocmVxdWVzdCkge1xuICAgIFJlc3BvbnNlLmNhbGwodGhpcywgcmVxdWVzdCk7XG4gICAgYWRkQ3VzdG9tUGFyc2VyKHRoaXMsIHJlcXVlc3Qub3B0aW9ucywgJ2pzb25wUmVzcG9uc2VQYXJzZXInKTtcbn1cblxuaW5oZXJpdHMoSlNPTlBSZXNwb25zZSwgUmVzcG9uc2UpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEpTT05QUmVzcG9uc2U7XG4iLCJ2YXIgUmVzcG9uc2VFcnJvciA9IHJlcXVpcmUoMTEpO1xudmFyIGluaGVyaXRzID0gcmVxdWlyZSgzMik7XG52YXIgYWRkQ3VzdG9tUGFyc2VyID0gcmVxdWlyZSgyMik7XG5cbi8qKlxuICogQGNsYXNzXG4gKiBAcGFyYW0ge3N0cmluZ30gY29kZSBUaGUgZXJyb3IgY29kZS5cbiAqIEBwYXJhbSB7SlNPTlBSZXF1ZXN0fSByZXF1ZXN0IFRoZSBKU09OUCByZXF1ZXN0LlxuICovXG5mdW5jdGlvbiBKU09OUFJlc3BvbnNlRXJyb3IoY29kZSwgcmVxdWVzdCkge1xuICAgIFJlc3BvbnNlRXJyb3IuY2FsbCh0aGlzLCBjb2RlLCByZXF1ZXN0KTtcbiAgICBhZGRDdXN0b21QYXJzZXIodGhpcywgcmVxdWVzdC5vcHRpb25zLCAnanNvbnBSZXNwb25zZUVycm9yUGFyc2VyJyk7XG59XG5cbmluaGVyaXRzKFJlc3BvbnNlRXJyb3IsIEpTT05QUmVzcG9uc2VFcnJvcik7XG5cbm1vZHVsZS5leHBvcnRzID0gSlNPTlBSZXNwb25zZUVycm9yO1xuIiwidmFyIHV1aWQgPSByZXF1aXJlKDM1KTtcblxuLyoqXG4gKiBUaGUgYmFzZSBSZXFldXN0IGNsYXNzLlxuICpcbiAqIEBjbGFzc1xuICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgVGhlIHR5cGUgb2YgcmVxdWVzdCwgY2FuIGJlIGBIVFRQX1JFUVVFU1RgIG9yIGBKU09OUF9SRVFVRVNUYC5cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEBwYXJhbSB7UmVxdWVzdFN1Y2Nlc3NDYWxsYmFja30gb25zdWNjZXNzIFRoZSBjYWxsYmFjayB0byBjYWxsIG9uIHN1Y2Nlc3MuXG4gKiBAcGFyYW0ge1JlcXVlc3RFcnJvckNhbGxiYWNrfSBvbmVycm9yIFRoZSBjYWxsYmFjayB0byBjYWxsIG9uIGVycm9yLlxuICovXG5mdW5jdGlvbiBSZXF1ZXN0KHR5cGUsIG9wdGlvbnMsIG9uc3VjY2Vzcywgb25lcnJvcikge1xuICAgIC8qKlxuICAgICAqIElmIHRoZXJlIGlzIGFuIGVycm9yIGhhcHBlbmQsIHRoZSBgZXJyb3JgIGlzIGEgc3RyaW5nIHJlcHJzZW5ndGluZyB0aGUgdHlwZSBvZiB0aGUgZXJyb3IuIElmIHRoZXJlIGlzIG5vXG4gICAgICogZXJyb3IsIHRoZSB2YWx1ZSBvZiBgZXJyb3JgIGlzIGBudWxsYC5cbiAgICAgKi9cbiAgICB0aGlzLmVycm9yID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFRoZSBgWE1MSHR0cFJlcXVlc3RgIHdlIHVzZSB3aGVuIHNlbmRpbmcgaHR0cCByZXF1ZXN0LlxuICAgICAqL1xuICAgIHRoaXMueGhyID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFRoZSBgSFRNTFNjcmlwdEVsZW1lbnRgIHdlIHVzZSB3aGVuIHNlbmRpbmcgSlNPTlAgcmVxdWVzdC5cbiAgICAgKi9cbiAgICB0aGlzLnNjcmlwdCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBXaGV0aGVyIHRoZSByZXF1ZXN0IGlzIGZpbmlzaGVkLlxuICAgICAqL1xuICAgIHRoaXMuZmluaXNoZWQgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIFRoZSByZXNwb25zZSBKU09OIGRhdGEgb2YgdGhlIEpTT05QIHJlcXVlc3QuXG4gICAgICovXG4gICAgdGhpcy5yZXNwb25zZUpTT04gPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQW4gdW5pcXVlIGlkIGZvciB0aGlzIHJlcXVlc3QuXG4gICAgICovXG4gICAgdGhpcy5yZXF1ZXN0SWQgPSB1dWlkKCk7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdHlwZSBvZiByZXF1ZXN0LCBjYW4gYmUgYEhUVFBfUkVRVUVTVGAgb3IgYEpTT05QX1JFUVVFU1RgLlxuICAgICAqL1xuICAgIHRoaXMucmVxdWVzdFR5cGUgPSB0eXBlO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAgICAgKi9cbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuXG4gICAgLyoqXG4gICAgICogVGhlIG5hbWUgb2YgdGhlIGZ1bmN0aW9uIHRoYXQgY3JlYXRlIHRoaXMgcmVxdWVzdC4gQ2FuIGJlIGBzZW5kYCwgYGZldGNoYCwgYGdldEpPU05QYCwgYGZldGNoSlNPTlBgLiBUaGlzIHZhbHVlXG4gICAgICogaXMgc2V0IGJ5IHRoZSBsaWJyYXkgaXRzZWxmLlxuICAgICAqL1xuICAgIHRoaXMucmVxdWVzdEZ1bmN0aW9uTmFtZSA9IG9wdGlvbnMucmVxdWVzdEZ1bmN0aW9uTmFtZTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBgQ2FuY2VsQ29udHJvbGxlcmAgdGhhdCB1c2VkIHRvIGNhbmNlbCB0aGlzIHJlcXVlc3QuIFdlIG5ldmVyIHVzZSB0aGlzIHByb3BlcnR5IGludGVybmFsbHksIGp1c3QgaG9sZGluZyB0aGVcbiAgICAgKiBpbmZvcm1hdGlvbiBpbiBjYXNlIHRoYXQgdGhlIHVzZXIgbmVlZHMuXG4gICAgICovXG4gICAgdGhpcy5jb250cm9sbGVyID0gb3B0aW9ucy5jb250cm9sbGVyIHx8IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgY2FsbGJhY2sgdG8gY2FsbCBvbiBzdWNjZXNzLlxuICAgICAqL1xuICAgIHRoaXMub25zdWNjZXNzID0gb25zdWNjZXNzIHx8IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgY2FsbGJhY2sgdG8gY2FsbCBvbiBlcnJvci5cbiAgICAgKi9cbiAgICB0aGlzLm9uZXJyb3IgPSBvbmVycm9yIHx8IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBTZXQgdGhlIHJlcXVlc3QgdHlwZSBiYWNrLlxuICAgICAqL1xuICAgIG9wdGlvbnMucmVxdWVzdFR5cGUgPSB0eXBlO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFJlcXVlc3Q7XG4iLCIvKipcbiAqIFJlcHJlc2VudHMgYSByZXNwb25zZS5cbiAqXG4gKiBAcGFyYW0ge1JlcXVlc3R9IHJlcXVlc3QgVGhlIGluc3RhbmNlIG9mIGBSZXF1ZXN0YC5cbiAqL1xuZnVuY3Rpb24gUmVzcG9uc2UocmVxdWVzdCkge1xuICAgIC8qKlxuICAgICAqIEB0eXBlIHtSZXF1ZXN0fVxuICAgICAqL1xuICAgIHRoaXMucmVxdWVzdCA9IHJlcXVlc3Q7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gUmVzcG9uc2U7XG4iLCJ2YXIgZXJyb3JNZXNzYWdlcyA9IHtcbiAgICBFUlJfQUJPUlRFRDogJ1JlcXVlc3QgYWJvcnRlZCcsXG4gICAgRVJSX0NBTkNFTExFRDogJ1JlcXVlc3QgY2FuY2VsbGVkJyxcbiAgICBFUlJfTkVUV09SSzogJ05ldHdvcmsgZXJyb3InLFxuICAgIEVSUl9SRVNQT05TRTogJ1Jlc3BvbnNlIGVycm9yJyxcbiAgICBFUlJfVElNRU9VVDogJ1JlcXVlc3QgdGltZW91dCdcbn07XG5cbi8qKlxuICogUmVwcmVzZW50cyByZXNwb25zZSBlcnJvci5cbiAqXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSB7c3RyaW5nfSBjb2RlIFRoZSBlcnJvciBjb2RlLlxuICogQHBhcmFtIHtSZXF1ZXN0fSByZXF1ZXN0IFRoZSByZXF1ZXN0LlxuICovXG5mdW5jdGlvbiBSZXNwb25zZUVycm9yKGNvZGUsIHJlcXVlc3QpIHtcbiAgICB2YXIgbWVzc2FnZTtcblxuICAgIGNvZGUgPSBjb2RlIHx8ICdFUlJfVU5LTk9XTic7XG5cbiAgICBpZiAoZXJyb3JNZXNzYWdlc1tjb2RlXSkge1xuICAgICAgICBtZXNzYWdlID0gZXJyb3JNZXNzYWdlc1tjb2RlXTtcbiAgICB9XG5cbiAgICBpZiAoIW1lc3NhZ2UpIHtcbiAgICAgICAgbWVzc2FnZSA9ICdVbmtub3duIGVycm9yICcgKyBjb2RlO1xuICAgIH1cblxuICAgIHJlcXVlc3QuZXJyb3IgPSBjb2RlO1xuXG4gICAgdGhpcy5jb2RlID0gY29kZTtcbiAgICB0aGlzLnJlcXVlc3QgPSByZXF1ZXN0O1xuICAgIHRoaXMubWVzc2FnZSA9IG1lc3NhZ2U7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gUmVzcG9uc2VFcnJvcjtcbiIsInZhciBpc0Z1bmN0aW9uID0gcmVxdWlyZSgzOCk7XG52YXIgSHR0cFJlc3BvbnNlID0gcmVxdWlyZSg0KTtcbnZhciBhZGRUaW1lb3V0TGlzdGVuZXIgPSByZXF1aXJlKDEzKTtcbnZhciBmaXJlQ2FsbGJhY2tzID0gcmVxdWlyZSgyOSk7XG52YXIgbm9vcCA9IHJlcXVpcmUoMzMpO1xudmFyIGNvbnN0YW50cyA9IHJlcXVpcmUoMjUpO1xudmFyIEVSUl9BQk9SVEVEICAgPSBjb25zdGFudHMuRVJSX0FCT1JURUQ7XG52YXIgRVJSX0NBTkNFTExFRCA9IGNvbnN0YW50cy5FUlJfQ0FOQ0VMTEVEO1xudmFyIEVSUl9ORVRXT1JLICAgPSBjb25zdGFudHMuRVJSX05FVFdPUks7XG52YXIgRVJSX1JFU1BPTlNFICA9IGNvbnN0YW50cy5FUlJfUkVTUE9OU0U7XG52YXIgRVJSX1RJTUVPVVQgICA9IGNvbnN0YW50cy5FUlJfVElNRU9VVDtcblxuLyoqXG4gKiBBZGQgZXZlbnQgbGlzdGVuZXJzIHRvIHRoZSBodHRwIHJlcXVlc3QuIFRoaXMgZnVuY3Rpb24gd2lsbCBvdmVyd2l0ZSB0aGUgYGNhbmNlbGAgbWV0aG9kIG9uIHRoZSBnaXZlbiBgSHR0cFJlcWVzdGBcbiAqIGluc3RhbmNlLlxuICpcbiAqIEBwYXJhbSB7SHR0cFJlcXVlc3R9IHJlcXVlc3QgVGhlIGh0dHAgcmVxdWVzdCB0byBhZGQgZXZlbnQgbGlzdGVuZXJzLlxuICovXG5mdW5jdGlvbiBhZGRFdmVudExpc3RlbmVycyhyZXF1ZXN0KSB7XG4gICAgdmFyIHhociA9IHJlcXVlc3QueGhyO1xuICAgIHZhciBvcHRpb25zID0gcmVxdWVzdC5vcHRpb25zO1xuICAgIHZhciByZXF1ZXN0VHlwZSA9IHJlcXVlc3QucmVxdWVzdFR5cGU7XG4gICAgdmFyIHJlc3BvbnNlID0gbmV3IEh0dHBSZXNwb25zZShyZXF1ZXN0KTtcbiAgICB2YXIgaXNSZXNwb25zZU9rID0gb3B0aW9ucy5pc1Jlc3BvbnNlT2s7XG4gICAgdmFyIGNsZWFyVGltZW91dEV2ZW50ID0gbnVsbDtcbiAgICB2YXIgdGltZW91dCA9IHBhcnNlSW50KG9wdGlvbnMudGltZW91dCB8fCAwLCAxMCk7XG5cbiAgICAvKipcbiAgICAgKiBDYW5jZWwgdGhlIHJlcXVlc3QuXG4gICAgICovXG4gICAgdmFyIGNhbmNlbCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgY2xlYXJFdmVudHMoKTtcbiAgICAgICAgaWYgKHhoci5hYm9ydCkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICB4aHIuYWJvcnQoKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAvLyBlbXB0eVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGZpbmlzaChFUlJfQ0FOQ0VMTEVEKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogVGhlIGZ1bmN0aW9uIHRvIGNsZWFyIGV2ZW50cy5cbiAgICAgKi9cbiAgICB2YXIgY2xlYXJFdmVudHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8vIFNldCBjbGVhckV2ZW50cyB0byB0aGUgbm9vcCBmdW5jdGlvbi5cbiAgICAgICAgY2xlYXJFdmVudHMgPSBub29wO1xuXG4gICAgICAgIHhoci5vbmFib3J0ID0gbnVsbDtcbiAgICAgICAgeGhyLm9uZXJyb3IgPSBudWxsO1xuICAgICAgICB4aHIub25yZWFkeXN0YXRlY2hhbmdlID0gbnVsbDtcbiAgICAgICAgeGhyLm9udGltZW91dCA9IG51bGw7XG5cbiAgICAgICAgaWYgKGNsZWFyVGltZW91dEV2ZW50KSB7XG4gICAgICAgICAgICBjbGVhclRpbWVvdXRFdmVudCgpO1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0RXZlbnQgPSBudWxsO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBmdW5jdGlvbiBmaW5pc2ggdGhlIHJlcXVlc3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY29kZSBUaGUgZXJyb3IgY29kZSBvbiBlcnJvci4gSWYgbm8gZXJyb3Igb2NjdXJlZCwgdGhlIGNvZGUgaXMgYG51bGxgLlxuICAgICAqL1xuICAgIHZhciBmaW5pc2ggPSBmdW5jdGlvbiAoY29kZSkge1xuICAgICAgICAvLyBTZXQgZmluaXNoIHRvIHRoZSBub29wIGZ1bmN0aW9uLlxuICAgICAgICBmaW5pc2ggPSBub29wO1xuXG4gICAgICAgIC8vIFNldCBjYW5jZWwgdG8gdGhlIG5vb3AgZnVuY3Rpb24uXG4gICAgICAgIGNhbmNlbCA9IG5vb3A7XG5cbiAgICAgICAgLy8gTWFyayB0aGlzIHJlcXVlc3QgYXMgZmluaXNoZWQuXG4gICAgICAgIHJlcXVlc3QuZmluaXNoZWQgPSB0cnVlO1xuXG4gICAgICAgIC8vIENsZWFyIGV2ZW50cy5cbiAgICAgICAgY2xlYXJFdmVudHMoKTtcblxuICAgICAgICAvLyBGaXJlIGNhbGxiYWNrcy5cbiAgICAgICAgZmlyZUNhbGxiYWNrcyhjb2RlLCByZXNwb25zZSk7XG4gICAgfTtcblxuICAgIHhoci5vbmFib3J0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBmaW5pc2goRVJSX0FCT1JURUQpO1xuICAgIH07XG5cbiAgICB4aHIub25lcnJvciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZmluaXNoKEVSUl9ORVRXT1JLKTtcbiAgICB9O1xuXG4gICAgeGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKCt4aHIucmVhZHlTdGF0ZSA9PT0gNCkge1xuICAgICAgICAgICAgaWYgKGlzRnVuY3Rpb24oaXNSZXNwb25zZU9rKSkge1xuICAgICAgICAgICAgICAgIGlmIChpc1Jlc3BvbnNlT2socmVxdWVzdFR5cGUsIHJlc3BvbnNlKSkge1xuICAgICAgICAgICAgICAgICAgICBmaW5pc2gobnVsbCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgZmluaXNoKEVSUl9SRVNQT05TRSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBmaW5pc2gobnVsbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQ2FuY2VsIHRoZSByZXF1ZXN0LlxuICAgICAqL1xuICAgIHJlcXVlc3QuY2FuY2VsID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBjYW5jZWwoKTtcbiAgICB9O1xuXG4gICAgLy8gQWRkIHRpbWVvdXQgbGlzdGVuZXJcbiAgICBpZiAoIWlzTmFOKHRpbWVvdXQpICYmIHRpbWVvdXQgPiAwKSB7XG4gICAgICAgIGNsZWFyVGltZW91dEV2ZW50ID0gYWRkVGltZW91dExpc3RlbmVyKHhociwgdGltZW91dCwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgY2xlYXJFdmVudHMoKTtcbiAgICAgICAgICAgIGlmICh4aHIuYWJvcnQpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICB4aHIuYWJvcnQoKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGVtcHR5XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZmluaXNoKEVSUl9USU1FT1VUKTtcbiAgICAgICAgfSk7XG4gICAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGFkZEV2ZW50TGlzdGVuZXJzO1xuIiwiLyoqXG4gKiBBZGQgdGltZW91dCBldmVudCBsaXN0ZW5lciBvbiB0aGUgWEhSIG9iamVjdC5cbiAqXG4gKiBAcGFyYW0ge1hNTEh0dHBSZXF1ZXN0fSB4aHIgVGhlIFhIUiB0byBhZGQgdGltZW91dCBldmVudCBsaXN0ZW5lci5cbiAqIEBwYXJhbSB7bnVtYmVyfSB0aW1lb3V0IFRoZSB0aW1lIHRvIHdhaXQgaW4gbWlsbGlzZWNvbmRzLlxuICogQHBhcmFtIHsoKSA9PiB2b2lkfSBsaXN0ZW5lciBUaGUgdGltZW91dCBjYWxsYmFjay5cbiAqIEByZXR1cm5zIHsoKSA9PiB2b2lkKX0gUmV0dXJucyBhIGZ1bmN0aW9uIHRvIHJlbW92ZSB0aGUgdGltZW91dCBldmVudCBsaXN0ZW5lci5cbiAqL1xuZnVuY3Rpb24gYWRkVGltZW91dExpc3RlbmVyKHhociwgdGltZW91dCwgbGlzdGVuZXIpIHtcbiAgICB2YXIgdGltZW91dElkID0gbnVsbDtcbiAgICB2YXIgc3VwcG9ydFRpbWVvdXQgPSAndGltZW91dCcgaW4geGhyICYmICdvbnRpbWVvdXQnIGluIHhocjtcblxuICAgIGlmIChzdXBwb3J0VGltZW91dCkge1xuICAgICAgICB4aHIudGltZW91dCA9IHRpbWVvdXQ7XG4gICAgICAgIHhoci5vbnRpbWVvdXQgPSBsaXN0ZW5lcjtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aW1lb3V0SWQgPSBzZXRUaW1lb3V0KGxpc3RlbmVyLCB0aW1lb3V0KTtcbiAgICB9XG5cbiAgICAvLyBDYWxsIHRoaXMgZnVuY3Rpb24gdG8gcmVtb3ZlIHRpbWVvdXQgZXZlbnQgbGlzdGVuZXJcbiAgICBmdW5jdGlvbiBjbGVhclRpbWVvdXRFdmVudCgpIHtcbiAgICAgICAgaWYgKHhocikge1xuICAgICAgICAgICAgaWYgKHRpbWVvdXRJZCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHhoci5vbnRpbWVvdXQgPSBudWxsO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dElkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHhociA9IG51bGw7XG4gICAgICAgICAgICBsaXN0ZW5lciA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gY2xlYXJUaW1lb3V0RXZlbnQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYWRkVGltZW91dExpc3RlbmVyO1xuIiwidmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKDM4KTtcblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gY2FsbCB4aHIgaG9vayBmdW5jdGlvbi5cbiAqXG4gKiBAcGFyYW0ge1hIUkhvb2tGdW5jdGlvbn0gZnVuYyBUaGUgaG9vayBmdW5jdGlvbiB0byBjYWxsLCBpZiBpdCBpcyBub3QgZnVuY3Rpb24sIHRoaXMgaG9vayBpcyBza2lwcGVkLlxuICogQHBhcmFtIHtYTUxIdHRwUmVxZXVzdH0geGhyIFRoZSBpbnN0YW5jZSBvZiBgWE1MSHR0cFJlcWV1c3RgLlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9ufSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKi9cbmZ1bmN0aW9uIGNhbGxYaHJIb29rKGZ1bmMsIHhociwgb3B0aW9ucykge1xuICAgIGlmIChpc0Z1bmN0aW9uKGZ1bmMpKSB7XG4gICAgICAgIGZ1bmMoeGhyLCBvcHRpb25zKTtcbiAgICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gY2FsbFhockhvb2s7XG4iLCJ2YXIgbWVyZ2UgPSByZXF1aXJlKDQwKTtcbnZhciBpc1BsYWluT2JqZWN0ID0gcmVxdWlyZSgzOSk7XG52YXIgaGFzT3duID0gcmVxdWlyZSgzMSk7XG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIHNldCB0aGUgcmVxdWVzdCBoZWFkZXJzLlxuICpcbiAqIDEuIE1lcmdlIHRoZSBgb3B0aW9ucy5ub0NhY2hlSGVhZGVyc2AgaWYgbmVlZGVkLlxuICogMi4gU2V0IHRoZSByZXF1ZXN0IGhlYWRlcnMgaWYgbmVlZGVkLlxuICpcbiAqIEBwYXJhbSB7WE1MSHR0cFJlcWV1c3R9IHhociBUaGUgaW5zdGFuY2Ugb2YgYFhNTEh0dHBSZXFldXN0YC5cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbn0gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICovXG5mdW5jdGlvbiBoYW5kbGVIZWFkZXJzKHhociwgb3B0aW9ucykge1xuICAgIHZhciBuYW1lO1xuICAgIHZhciB2YWx1ZTtcbiAgICB2YXIgaGVhZGVycyA9IGlzUGxhaW5PYmplY3Qob3B0aW9ucy5oZWFkZXJzKSA/IG9wdGlvbnMuaGVhZGVycyA6IHt9O1xuXG4gICAgaWYgKG9wdGlvbnMubm9DYWNoZSkge1xuICAgICAgICBpZiAoaXNQbGFpbk9iamVjdChvcHRpb25zLm5vQ2FjaGVIZWFkZXJzKSkge1xuICAgICAgICAgICAgaGVhZGVycyA9IG1lcmdlKGhlYWRlcnMsIG9wdGlvbnMubm9DYWNoZUhlYWRlcnMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZm9yIChuYW1lIGluIGhlYWRlcnMpIHtcbiAgICAgICAgaWYgKGhhc093bi5jYWxsKGhlYWRlcnMsIG5hbWUpKSB7XG4gICAgICAgICAgICB2YWx1ZSA9IGhlYWRlcnNbbmFtZV07XG4gICAgICAgICAgICAvLyBPbmx5IHRoZSBub24tdW5kZWZpbmVkIGFuZCBub24tbnVsbCBoZWFkZXJzIGFyZSBzZXRcbiAgICAgICAgICAgIGlmICh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIobmFtZSwgdmFsdWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gU2V0IHRoZSBoZWFkZXJzIGJhY2suXG4gICAgb3B0aW9ucy5oZWFkZXJzID0gaGVhZGVycztcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBoYW5kbGVIZWFkZXJzO1xuIiwidmFyIG1lcmdlID0gcmVxdWlyZSg0MCk7XG52YXIgaXNGdW5jdGlvbiA9IHJlcXVpcmUoMzgpO1xudmFyIGlzUGxhaW5PYmplY3QgPSByZXF1aXJlKDM5KTtcbnZhciBoYXNPd24gPSByZXF1aXJlKDMxKTtcblxuLyoqXG4gKiBGaW5kIGEgcHJvY2Vzc29yIGZyb20gYG9wdGlvbnMuaHR0cFJlcXVlc3RCb2R5UHJvY2Vzc29yYCB0byBwcm9jZXNzIHRoZSByZXF1ZXN0IGJvZHkuXG4gKlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICogQHJldHVybnMge2FueX0gUmV0cnVucyB0aGUgY29udGVudCB0aGF0IHNlbmQgdG8gdGhlIHNlcnZlci5cbiAqL1xuZnVuY3Rpb24gaGFuZGxlUmVxdWVzdEJvZHkob3B0aW9ucykge1xuICAgIHZhciBpO1xuICAgIHZhciBsO1xuICAgIHZhciBrZXk7XG4gICAgdmFyIGNvbnRlbnQgPSBudWxsO1xuICAgIHZhciBwcm9jZXNzb3I7XG4gICAgdmFyIGNvbnRlbnRQcm9jZXNzb3I7XG4gICAgdmFyIGNvbnRlbnRQcm9jZXNzb3JzID0gW107XG4gICAgdmFyIGJvZHkgPSBvcHRpb25zLmJvZHk7XG4gICAgdmFyIHByb2Nlc3NvcnMgPSBvcHRpb25zLmh0dHBSZXF1ZXN0Qm9keVByb2Nlc3NvcjtcbiAgICB2YXIgaGVhZGVycyA9IGlzUGxhaW5PYmplY3Qob3B0aW9ucy5oZWFkZXJzKSA/IG9wdGlvbnMuaGVhZGVycyA6IHt9O1xuXG4gICAgaWYgKGlzUGxhaW5PYmplY3QoYm9keSkgJiYgaXNQbGFpbk9iamVjdChwcm9jZXNzb3JzKSkge1xuICAgICAgICAvLyBGaW5kIGFsbCBwcm9jZXNzb3JzLlxuICAgICAgICBmb3IgKGtleSBpbiBwcm9jZXNzb3JzKSB7XG4gICAgICAgICAgICBpZiAoaGFzT3duLmNhbGwocHJvY2Vzc29ycywga2V5KSkge1xuICAgICAgICAgICAgICAgIHByb2Nlc3NvciA9IHByb2Nlc3NvcnNba2V5XTtcbiAgICAgICAgICAgICAgICBpZiAoaXNQbGFpbk9iamVjdChwcm9jZXNzb3IpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRlbnRQcm9jZXNzb3JzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAga2V5OiBrZXksXG4gICAgICAgICAgICAgICAgICAgICAgICBoZWFkZXJzOiBwcm9jZXNzb3IuaGVhZGVycyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHByaW9yaXR5OiBwcm9jZXNzb3IucHJpb3JpdHksXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9jZXNzb3I6IHByb2Nlc3Nvci5wcm9jZXNzb3JcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gU29ydCB0aGUgcHJvY2Vzc29ycyBieSBpdHMgcHJpb3JpdHkuXG4gICAgICAgIGNvbnRlbnRQcm9jZXNzb3JzLnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgICAgICAgIHJldHVybiBiLnByaW9yaXR5IC0gYS5wcmlvcml0eTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gRmluZCB0aGUgZmlyc3Qgbm9uLXVuZGVmaW5lZCBjb250ZW50LlxuICAgICAgICBmb3IgKGkgPSAwLCBsID0gY29udGVudFByb2Nlc3NvcnMubGVuZ3RoOyBpIDwgbDsgaSArPSAxKSB7XG4gICAgICAgICAgICBwcm9jZXNzb3IgPSBjb250ZW50UHJvY2Vzc29yc1tpXTtcbiAgICAgICAgICAgIGlmIChib2R5W3Byb2Nlc3Nvci5rZXldICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBjb250ZW50ID0gYm9keVtwcm9jZXNzb3Iua2V5XTtcbiAgICAgICAgICAgICAgICBjb250ZW50UHJvY2Vzc29yID0gcHJvY2Vzc29yO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gVXNlIHRoZSBwcm9jZXNzb3IgdG8gcHJvY2VzcyB0aGUgY29udGVudC5cbiAgICAgICAgaWYgKGNvbnRlbnRQcm9jZXNzb3IpIHtcbiAgICAgICAgICAgIGlmIChpc1BsYWluT2JqZWN0KGNvbnRlbnRQcm9jZXNzb3IuaGVhZGVycykpIHtcbiAgICAgICAgICAgICAgICBoZWFkZXJzID0gbWVyZ2Uoe30sIGNvbnRlbnRQcm9jZXNzb3IuaGVhZGVycywgaGVhZGVycyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBwcm9jZXNzb3IgPSBjb250ZW50UHJvY2Vzc29yLnByb2Nlc3NvcjtcbiAgICAgICAgICAgIGlmIChpc0Z1bmN0aW9uKHByb2Nlc3NvcikpIHtcbiAgICAgICAgICAgICAgICBjb250ZW50ID0gcHJvY2Vzc29yKGNvbnRlbnQsIG9wdGlvbnMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gTWFrZSBzdXJlIHRoYXQgdGhlIGhlYWRlcnMgaXMgYSBwbGFpbiBvYmplY3QuXG4gICAgb3B0aW9ucy5oZWFkZXJzID0gaGVhZGVycztcblxuICAgIHJldHVybiBjb250ZW50O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGhhbmRsZVJlcXVlc3RCb2R5O1xuIiwidmFyIGlzUGxhaW5PYmplY3QgPSByZXF1aXJlKDM5KTtcbnZhciBoYXNPd24gPSByZXF1aXJlKDMxKTtcblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gaGFubGRlIFhNTEh0dHBSZXF1ZXN0IHByb3BlcnRpZXMuXG4gKlxuICogQHBhcmFtIHtYTUxIdHRwUmVxdWVzdH0geGhyIFRoZSBpbnN0YW5jZSBvZiBgWE1MSHR0cFJlcXVlc3RgLlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICovXG5mdW5jdGlvbiBoYW5kbGVYaHJQcm9wcyh4aHIsIG9wdGlvbnMpIHtcbiAgICB2YXIgcHJvcDtcbiAgICB2YXIgeGhyUHJvcHMgPSBvcHRpb25zLnhoclByb3BzO1xuXG4gICAgaWYgKG9wdGlvbnMuY29ycykge1xuICAgICAgICB4aHIud2l0aENyZWRlbnRpYWxzID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAoaXNQbGFpbk9iamVjdCh4aHJQcm9wcykpIHtcbiAgICAgICAgZm9yIChwcm9wIGluIHhoclByb3BzKSB7XG4gICAgICAgICAgICBpZiAoaGFzT3duLmNhbGwoeGhyUHJvcHMsIHByb3ApKSB7XG4gICAgICAgICAgICAgICAgeGhyW3Byb3BdID0geGhyUHJvcHNbcHJvcF07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaGFuZGxlWGhyUHJvcHM7XG4iLCJ2YXIgaXNGdW5jdGlvbiA9IHJlcXVpcmUoMzgpO1xudmFyIEpTT05QUmVzcG9uc2UgPSByZXF1aXJlKDcpO1xudmFyIGZpcmVDYWxsYmFja3MgPSByZXF1aXJlKDI5KTtcbnZhciBub29wID0gcmVxdWlyZSgzMyk7XG52YXIgY29uc3RhbnRzID0gcmVxdWlyZSgyNSk7XG52YXIgRVJSX0NBTkNFTExFRCA9IGNvbnN0YW50cy5FUlJfQ0FOQ0VMTEVEO1xudmFyIEVSUl9ORVRXT1JLICAgPSBjb25zdGFudHMuRVJSX05FVFdPUks7XG52YXIgRVJSX1JFU1BPTlNFICA9IGNvbnN0YW50cy5FUlJfUkVTUE9OU0U7XG52YXIgRVJSX1RJTUVPVVQgICA9IGNvbnN0YW50cy5FUlJfVElNRU9VVDtcblxuLyoqXG4gKiBBZGQgZXZlbnQgbGlzdGVuZXJzIHRvIEpTT05QIHJlcXVlc3QuXG4gKlxuICogQHBhcmFtIHtKU09OUFJlcXVlc3R9IHJlcXVlc3QgVGhlIEpTT05QIHJlcXVlc3QuXG4gKiBAcGFyYW0ge3N0cmluZ30gY2FsbGJhY2tOYW1lIFRoZSBjYWxsYmFjayBuYW1lIHVzZWQgdG8gZGVmaW5lIHRoZSBnbG9iYWwgSlNPTlAgY2FsbGJhY2suXG4gKi9cbmZ1bmN0aW9uIGFkZEV2ZW50TGlzdGVuZXJzKHJlcXVlc3QsIGNhbGxiYWNrTmFtZSkge1xuICAgIHZhciBzY3JpcHQgPSByZXF1ZXN0LnNjcmlwdDtcbiAgICB2YXIgb3B0aW9ucyA9IHJlcXVlc3Qub3B0aW9ucztcbiAgICB2YXIgcmVxdWVzdFR5cGUgPSByZXF1ZXN0LnJlcXVlc3RUeXBlO1xuICAgIHZhciBpc1Jlc3BvbnNlT2sgPSBvcHRpb25zLmlzUmVzcG9uc2VPaztcbiAgICB2YXIgcmVzcG9uc2UgPSBuZXcgSlNPTlBSZXNwb25zZShyZXF1ZXN0KTtcbiAgICB2YXIgdGltZW91dCA9IHBhcnNlSW50KG9wdGlvbnMudGltZW91dCB8fCAwLCAxMCk7XG4gICAgdmFyIHRpbWVvdXRJZCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZnVuY3Rpb24gZmluaXNoIHRoZSByZXF1ZXN0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGNvZGUgVGhlIGVycm9yIGNvZGUgb24gZXJyb3IuIElmIG5vIGVycm9yIG9jY3VyZWQsIHRoZSBjb2RlIGlzIGBudWxsYC5cbiAgICAgKi9cbiAgICB2YXIgZmluaXNoID0gZnVuY3Rpb24gKGNvZGUpIHtcbiAgICAgICAgLy8gU2V0IGZpbmlzaCB0byB0aGUgbm8gb3BlcmF0aW9uIGZ1bmN0aW9uLlxuICAgICAgICBmaW5pc2ggPSBub29wO1xuXG4gICAgICAgIC8vIE1hcmsgdGhpcyByZXF1ZXN0IGFzIGZpbmlzaGVkLlxuICAgICAgICByZXF1ZXN0LmZpbmlzaGVkID0gdHJ1ZTtcblxuICAgICAgICAvLyBDbGVhciBsaXN0ZW5lcnMuXG4gICAgICAgIHdpbmRvd1tjYWxsYmFja05hbWVdID0gbm9vcDtcbiAgICAgICAgc2NyaXB0Lm9uZXJyb3IgPSBudWxsO1xuXG4gICAgICAgIC8vIENsZWFyIHRpbWVvdXQuXG4gICAgICAgIGlmICh0aW1lb3V0SWQgIT09IG51bGwpIHtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xuICAgICAgICAgICAgdGltZW91dElkID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEZpcmUgY2FsbGJhY2tzLlxuICAgICAgICBmaXJlQ2FsbGJhY2tzKGNvZGUsIHJlc3BvbnNlKTtcbiAgICB9O1xuXG4gICAgLy8gRGVmaW5lIHRoZSBjYWxsYmFjayBmdW5jdGlvbi5cbiAgICB3aW5kb3dbY2FsbGJhY2tOYW1lXSA9IGZ1bmN0aW9uIChyZXNwb25zZUpTT04pIHtcbiAgICAgICAgcmVxdWVzdC5yZXNwb25zZUpTT04gPSByZXNwb25zZUpTT047XG4gICAgICAgIGlmIChpc0Z1bmN0aW9uKGlzUmVzcG9uc2VPaykpIHtcbiAgICAgICAgICAgIGlmIChpc1Jlc3BvbnNlT2socmVxdWVzdFR5cGUsIHJlc3BvbnNlKSkge1xuICAgICAgICAgICAgICAgIGZpbmlzaChudWxsKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZmluaXNoKEVSUl9SRVNQT05TRSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmaW5pc2gobnVsbCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gQ2F0Y2ggdGhlIGVycm9yLlxuICAgIHNjcmlwdC5vbmVycm9yID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBmaW5pc2goRVJSX05FVFdPUkspO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBDYW5jZWwgdGhlIHJlcXVlc3QuXG4gICAgICovXG4gICAgcmVxdWVzdC5jYW5jZWwgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGZpbmlzaChFUlJfQ0FOQ0VMTEVEKTtcbiAgICB9O1xuXG4gICAgLy8gQWRkIHRpbWVvdXQgbGlzdGVuZXJcbiAgICBpZiAoIWlzTmFOKHRpbWVvdXQpICYmIHRpbWVvdXQgPiAwKSB7XG4gICAgICAgIHRpbWVvdXRJZCA9IHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgZmluaXNoKEVSUl9USU1FT1VUKTtcbiAgICAgICAgfSwgdGltZW91dCk7XG4gICAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGFkZEV2ZW50TGlzdGVuZXJzO1xuIiwiLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gY3JlYXRlIEpTT05QIGNhbGxiYWNrIG5hbWUuXG4gKlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICogQHJldHVybnMge3N0cmluZ30gUmV0dXJucyB0aGUgY2FsbGJhY2sgbmFtZS5cbiAqL1xuZnVuY3Rpb24gYnVpbGRDYWxsbGJhY2tOYW1lKG9wdGlvbnMpIHtcbiAgICB2YXIgY2FsbGJhY2tOYW1lO1xuXG4gICAgZG8ge1xuICAgICAgICBjYWxsYmFja05hbWUgPSBvcHRpb25zLmpzb25wQ2FsbGJhY2tOYW1lLmNhbGwobnVsbCwgb3B0aW9ucyk7XG4gICAgfSB3aGlsZSAoY2FsbGJhY2tOYW1lIGluIHdpbmRvdyk7XG5cbiAgICB3aW5kb3dbY2FsbGJhY2tOYW1lXSA9IG51bGw7XG5cbiAgICByZXR1cm4gY2FsbGJhY2tOYW1lO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGJ1aWxkQ2FsbGxiYWNrTmFtZTtcbiIsInZhciBidWlsZFVSTCA9IHJlcXVpcmUoMjMpO1xuXG4vKipcbiAqIEJ1aWxkIHRoZSBKU09OUCBzY3JpcHQgc3JjLlxuICpcbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3BpdG9ucy5cbiAqIEBwYXJhbSB7c3RyaW5nfSBjYWxsYmFja05hbWUgVGhlIGNhbGxiYWNrIG5hbWUgb2YgdGhlIEpTT05QLlxuICogQHJldHVybiB7c3RyaW5nfSBSZXR1cm5zIHRoZSBzY3JpcHQgc3JjLlxuICovXG5mdW5jdGlvbiBidWlsZFNjcmlwdFNyYyhvcHRpb25zLCBjYWxsYmFja05hbWUpIHtcbiAgICB2YXIgcXVlcnkgPSBvcHRpb25zLnF1ZXJ5O1xuICAgIHZhciBrZXkgPSBvcHRpb25zLmpzb25wO1xuICAgIHZhciB1cmw7XG5cbiAgICBpZiAoIXF1ZXJ5KSB7XG4gICAgICAgIHF1ZXJ5ID0ge307XG4gICAgICAgIG9wdGlvbnMucXVlcnkgPSBxdWVyeTtcbiAgICB9XG5cbiAgICBxdWVyeVtrZXldID0gY2FsbGJhY2tOYW1lO1xuICAgIHVybCA9IGJ1aWxkVVJMKG9wdGlvbnMpO1xuXG4gICAgcmV0dXJuIHVybDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBidWlsZFNjcmlwdFNyYztcbiIsIi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGhhbmRsZSBgb3B0aW9ucy5jb3JzYCBzZXR0aW5nIHdoZW4gc2VuZGluZyBKU09OUCByZXF1ZXN0cy4gSWYgYG9wdGlvbnMuY29yc2AgaXMgYHRydWVgLCB0aGVcbiAqIGBjcm9zc29yaWdpbmAgYXR0cmlidXRlIG9mIHRoZSBgc2NyaXB0YCBlbGVtZW50IHdlIHVzaW5nIGlzIHNldCB0byBgdXNlLWNyZWRlbnRpYWxzYC5cbiAqXG4gKiBAcGFyYW0ge0hUTUxTY3JpcHRFbGVtZW50fSBzY3JpcHQgVGhlIHNjcmlwdCBlbGVtZW50LlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICovXG5mdW5jdGlvbiBoYW5kbGVTY3JpcHRDb3JzKHNjcmlwdCwgb3B0aW9ucykge1xuICAgIGlmIChvcHRpb25zLmNvcnMpIHtcbiAgICAgICAgc2NyaXB0LnNldEF0dHJpYnV0ZSgnY3Jvc3NvcmlnaW4nLCAndXNlLWNyZWRlbnRpYWxzJyk7XG4gICAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGhhbmRsZVNjcmlwdENvcnM7XG4iLCJ2YXIgaXNQbGFpbk9iamVjdCA9IHJlcXVpcmUoMzkpO1xudmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKDM4KTtcbnZhciBoYXNPd24gPSByZXF1aXJlKDMxKTtcblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gYWRkIGN1c3RvbSBwYXJzZXJzIHRvIHRoZSBpbnN0YW5jZSBvZiBgUmVzcG9uc2VgIG9yIGBSZXNwb25zZUVycm9yYC5cbiAqXG4gKiBAcGFyYW0ge1Jlc3BvbnNlfFJlc3BvbnNlRXJyb3J9IHRhcmdldCBUaGUgdGFyZ2V0IHRvIGFkZCB0aGUgY3VzdG9tZSBwYXJzZXJzLlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICogQHBhcmFtIHtzdHJpbmd9IG9wdGlvbk5hbWUgVGhlIG9wdGlvbiBuYW1lIHRoZSBwYXJzZXJzIGNvbnRhaW5lci5cbiAqL1xuZnVuY3Rpb24gYWRkQ3VzdG9tUGFyc2VyKHRhcmdldCwgb3B0aW9ucywgb3B0aW9uTmFtZSkge1xuICAgIHZhciBwYXJzZXJzID0gb3B0aW9uc1tvcHRpb25OYW1lXTtcbiAgICB2YXIgbmFtZTtcbiAgICB2YXIgcGFyc2VyO1xuXG4gICAgaWYgKGlzUGxhaW5PYmplY3QocGFyc2VycykpIHtcbiAgICAgICAgZm9yIChuYW1lIGluIHBhcnNlcnMpIHtcbiAgICAgICAgICAgIGlmIChoYXNPd24uY2FsbChwYXJzZXJzLCBuYW1lKSkge1xuICAgICAgICAgICAgICAgIHBhcnNlciA9IHBhcnNlcnNbbmFtZV07XG4gICAgICAgICAgICAgICAgaWYgKGlzRnVuY3Rpb24ocGFyc2VyKSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAobmFtZSBpbiB0YXJnZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignXCInICsgbmFtZSArICdcIiBjYW5ub3QgYmUgYSBuYW1lIG9mIHBhcnNlcicpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHRhcmdldFtuYW1lXSA9IHBhcnNlcjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYWRkQ3VzdG9tUGFyc2VyO1xuIiwidmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKDM4KTtcbnZhciBpc0Fic29sdXRlVVJMID0gcmVxdWlyZSgzNik7XG52YXIgaXNQbGFpbk9iamVjdCA9IHJlcXVpcmUoMzkpO1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBidWlsZCByZXF1ZXN0IHVybC5cbiAqXG4gKiAxLiBBZGQgYmFzZVVSTCBpZiBuZWVkZWQuXG4gKiAyLiBDb21waWxlIHVybCBpZiBuZWVkZWQuXG4gKiAzLiBDb21waWxlIHF1ZXJ5IHN0cmluZyBpZiBuZWVkZWQuXG4gKlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICogQHJldHVybnMge3N0cmluZ30gUmV0dXJucyB0aGUgZmluYWwgdXJsIHN0cmluZy5cbiAqL1xuZnVuY3Rpb24gYnVpbGRVUkwob3B0aW9ucykge1xuICAgIHZhciB1cmwgPSBvcHRpb25zLnVybDtcbiAgICB2YXIgYmFzZVVSTCA9IG9wdGlvbnMuYmFzZVVSTDtcbiAgICB2YXIgbW9kZWwgPSBvcHRpb25zLm1vZGVsO1xuICAgIHZhciBxdWVyeSA9IG9wdGlvbnMucXVlcnk7XG4gICAgdmFyIGNvbXBpbGVVUkwgPSBvcHRpb25zLmNvbXBpbGVVUkw7XG4gICAgdmFyIGVuY29kZVF1ZXJ5U3RyaW5nID0gb3B0aW9ucy5lbmNvZGVRdWVyeVN0cmluZztcbiAgICB2YXIgYXJyYXk7XG5cbiAgICBpZiAodXJsID09PSBudWxsIHx8IHVybCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHVybCA9ICcnO1xuICAgIH1cblxuICAgIC8vIElmIHRoZSB1cmwgaXMgbm90IGFic29sdXRlIHVybCBhbmQgdGhlIGJhc2VVUkwgaXMgZGVmaW5lZCxcbiAgICAvLyBwcmVwZW5kIHRoZSBiYXNlVVJMIHRvIHRoZSB1cmwuXG4gICAgaWYgKCFpc0Fic29sdXRlVVJMKHVybCkpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBiYXNlVVJMID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgdXJsID0gYmFzZVVSTCArIHVybDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIENvbXBpbGUgdGhlIHVybCBpZiBuZWVkZWQuXG4gICAgaWYgKGlzUGxhaW5PYmplY3QobW9kZWwpICYmIGlzRnVuY3Rpb24oY29tcGlsZVVSTCkpIHtcbiAgICAgICAgdXJsID0gY29tcGlsZVVSTCh1cmwsIG1vZGVsLCBvcHRpb25zKTtcbiAgICB9XG5cbiAgICAvLyBDb21waWxlIHRoZSBxdWVyeSBzdHJpbmcuXG4gICAgaWYgKGlzUGxhaW5PYmplY3QocXVlcnkpICYmIGlzRnVuY3Rpb24oZW5jb2RlUXVlcnlTdHJpbmcpKSB7XG4gICAgICAgIHF1ZXJ5ID0gZW5jb2RlUXVlcnlTdHJpbmcocXVlcnksIG9wdGlvbnMpO1xuICAgICAgICBhcnJheSA9IHVybC5zcGxpdCgnIycpOyAvLyBUaGVyZSBtYXkgYmUgaGFzaCBzdHJpbmcgaW4gdGhlIHVybC5cbiAgICAgICAgdXJsID0gYXJyYXlbMF07XG5cbiAgICAgICAgaWYgKHVybC5pbmRleE9mKCc/JykgPiAtMSkge1xuICAgICAgICAgICAgaWYgKHVybC5jaGFyQXQodXJsLmxlbmd0aCAtIDEpID09PSAnJicpIHtcbiAgICAgICAgICAgICAgICB1cmwgPSB1cmwgKyBxdWVyeTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdXJsID0gdXJsICsgJyYnICsgcXVlcnk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB1cmwgPSB1cmwgKyAnPycgKyBxdWVyeTtcbiAgICAgICAgfVxuXG4gICAgICAgIGFycmF5WzBdID0gdXJsO1xuICAgICAgICB1cmwgPSBhcnJheS5qb2luKCcjJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHVybDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBidWlsZFVSTDtcbiIsInZhciBpc0Z1bmN0aW9uID0gcmVxdWlyZSgzOCk7XG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGNhbGwgYG9wdGlvbnMub25SZXF1ZXN0Q3JlYXRlZGAgY2FsbGJhY2suXG4gKlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICogQHBhcmFtIHtIdHRwUmVxdWVzdHxKU09OUFJlcXVlc3R9IHJlcXVlc3QgVGhlIHJlcXVlc3QgaW5zdGFuY2UuXG4gKi9cbmZ1bmN0aW9uIGNhbGxSZXF1ZXN0Q3JlYXRlZENhbGxiYWNrKG9wdGlvbnMsIHJlcXVlc3QpIHtcbiAgICB2YXIgb25SZXF1ZXN0Q3JlYXRlZCA9IG9wdGlvbnMub25SZXF1ZXN0Q3JlYXRlZDtcblxuICAgIGlmIChpc0Z1bmN0aW9uKG9uUmVxdWVzdENyZWF0ZWQpKSB7XG4gICAgICAgIG9uUmVxdWVzdENyZWF0ZWQocmVxdWVzdCk7XG4gICAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGNhbGxSZXF1ZXN0Q3JlYXRlZENhbGxiYWNrO1xuIiwiZXhwb3J0cy5FUlJfQUJPUlRFRCA9ICdFUlJfQUJPUlRFRCc7XG5leHBvcnRzLkVSUl9SRVNQT05TRSA9ICdFUlJfUkVTUE9OU0UnO1xuZXhwb3J0cy5FUlJfQ0FOQ0VMTEVEID0gJ0VSUl9DQU5DRUxMRUQnO1xuZXhwb3J0cy5FUlJfTkVUV09SSyA9ICdFUlJfTkVUV09SSyc7XG5leHBvcnRzLkVSUl9USU1FT1VUID0gJ0VSUl9USU1FT1VUJztcbmV4cG9ydHMuSFRUUF9SRVFVRVNUID0gJ0hUVFBfUkVRVUVTVCc7XG5leHBvcnRzLkpTT05QX1JFUVVFU1QgPSAnSlNPTlBfUkVRVUVTVCc7XG4iLCJ2YXIgQ2FuY2VsQ29udHJvbGxlciA9IHJlcXVpcmUoMSk7XG5cbi8qKlxuICogQ3JlYXRlIGEgbmV3IGluc3RhbmNlIG9mIGBDYW5jZWxDb250cm9sbGVyYC5cbiAqXG4gKiBAcmV0dXJucyB7Q2FuY2VsQ29udHJvbGxlcn0gUmV0dXJucyBhbiBuZXcgaW5zdGFuY2Ugb2YgYENhbmNlbENvbnRyb2xsZXJgLlxuICovXG52YXIgY3JlYXRlQ2FuY2VsQ29udHJvbGxlciA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gbmV3IENhbmNlbENvbnRyb2xsZXIoKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gY3JlYXRlQ2FuY2VsQ29udHJvbGxlcjtcbiIsInZhciBRUyA9IHJlcXVpcmUoNDMpO1xudmFyIGNvbnN0YW50cyA9IHJlcXVpcmUoMjUpO1xudmFyIHRlbXBsYXRlID0gcmVxdWlyZSgzNCk7XG52YXIgdXVpZCA9IHJlcXVpcmUoMzUpO1xudmFyIEhUVFBfUkVRVUVTVCAgPSBjb25zdGFudHMuSFRUUF9SRVFVRVNUO1xuXG4vKipcbiAqIENyZWF0ZSBhIG5ldyBkZWZhdWx0IHJlcXVlc3Qgb3B0aW9ucy5cbiAqXG4gKiBAcmV0dXJucyB7UmVxdWVzdE9wdGlvbnN9IFJldHVybnMgYSBuZXcgZGVmYXVsdCByZXF1ZXN0IG9waXRvbnMuXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZURlZmF1bHRPcHRpb25zKCkge1xuICAgIC8qZXNsaW50IG5vLXVudXNlZC12YXJzOiBbXCJlcnJvclwiLCB7IFwiYXJnc1wiOiBcIm5vbmVcIiB9XSovXG4gICAgLyoqXG4gICAgICogQHR5cGUge1JlcXVlc3RPcHRpb25zfVxuICAgICAqL1xuICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgICBtZXRob2Q6ICdHRVQnLFxuICAgICAgICBiYXNlVVJMOiBudWxsLFxuICAgICAgICB1cmw6ICcnLFxuICAgICAgICBtb2RlbDogbnVsbCxcbiAgICAgICAgcXVlcnk6IG51bGwsXG4gICAgICAgIGhlYWRlcnM6IG51bGwsXG4gICAgICAgIGJvZHk6IG51bGwsXG4gICAgICAgIHRpbWVvdXQ6IDAsXG4gICAgICAgIGNvcnM6IGZhbHNlLFxuICAgICAgICBub0NhY2hlOiBmYWxzZSxcbiAgICAgICAgbm9DYWNoZUhlYWRlcnM6IHtcbiAgICAgICAgICAgICdQcmFnbWEnOiAnbm8tY2FjaGUnLFxuICAgICAgICAgICAgJ0NhY2hlLUNvbnRyb2wnOiAnbm8tY2FjaGUsIG5vLXN0b3JlLCBtdXN0LXJldmFsaWRhdGUnXG4gICAgICAgIH0sXG4gICAgICAgIGpzb25wOiAnY2FsbGJhY2snLFxuICAgICAgICBzZXR0aW5nczoge30sXG4gICAgICAgIGNvbnRyb2xsZXI6IG51bGwsXG4gICAgICAgIHJlcXVlc3RGdW5jdGlvbk5hbWU6IG51bGwsXG4gICAgICAgIHJlcXVlc3RUeXBlOiBudWxsLFxuICAgICAgICB4aHJQcm9wczogbnVsbCxcbiAgICAgICAgdXNlcm5hbWU6IG51bGwsXG4gICAgICAgIHBhc3N3b3JkOiBudWxsLFxuICAgICAgICBodHRwUmVxdWVzdEJvZHlQcm9jZXNzb3I6IHtcbiAgICAgICAgICAgIHJhdzoge1xuICAgICAgICAgICAgICAgIHByaW9yaXR5OiAwLFxuICAgICAgICAgICAgICAgIGhlYWRlcnM6IG51bGwsXG4gICAgICAgICAgICAgICAgcHJvY2Vzc29yOiBudWxsLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGZvcm06IHtcbiAgICAgICAgICAgICAgICBwcmlvcml0eTogMSxcbiAgICAgICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkOyBjaGFyc2V0PVVURi04J1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcHJvY2Vzc29yOiBmdW5jdGlvbiAoZGF0YSwgb3B0aW9ucykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gUVMuZW5jb2RlKGRhdGEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBqc29uOiB7XG4gICAgICAgICAgICAgICAgcHJpb3JpdHk6IDIsXG4gICAgICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb247IGNoYXJzZXQ9VVRGLTgnXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBwcm9jZXNzb3I6IGZ1bmN0aW9uIChkYXRhLCBvcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShkYXRhKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGh0dHBSZXNwb25zZVBhcnNlcjoge1xuICAgICAgICAgICAganNvbjogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIC8vIGB0aGlzYCBpcyBwb2ludCB0byB0aGUgY3VycmVudCBpbnN0YW5jZSBvZiBgSHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICAgICAgICB2YXIgcmVzcG9uc2VUZXh0ID0gdGhpcy5yZXF1ZXN0Lnhoci5yZXNwb25zZVRleHQ7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlc3BvbnNlVGV4dCA/IEpTT04ucGFyc2UocmVzcG9uc2VUZXh0KSA6IG51bGw7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdGV4dDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnJlcXVlc3QueGhyLnJlc3BvbnNlVGV4dDtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzdGF0dXM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5yZXF1ZXN0Lnhoci5zdGF0dXM7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGpzb25wUmVzcG9uc2VQYXJzZXI6IHtcbiAgICAgICAgICAgIGpzb246IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5yZXF1ZXN0LnJlc3BvbnNlSlNPTjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgaHR0cFJlc3BvbnNlRXJyb3JQYXJzZXI6IG51bGwsXG4gICAgICAgIGpzb25wUmVzcG9uc2VFcnJvclBhcnNlcjogbnVsbCxcbiAgICAgICAgaGFuZGxlT3B0aW9uczogbnVsbCxcbiAgICAgICAgY3JlYXRlWEhSOiBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgICAgICB9LFxuICAgICAgICBjcmVhdGVTY3JpcHQ6IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgICAgICB2YXIgc2NyaXB0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2NyaXB0Jyk7XG5cbiAgICAgICAgICAgIHNjcmlwdC5zZXRBdHRyaWJ1dGUoJ3R5cGUnLCAndGV4dC9qYXZhc2NyaXB0Jyk7XG4gICAgICAgICAgICBzY3JpcHQuc2V0QXR0cmlidXRlKCdjaGFyc2V0JywgJ3V0Zi04Jyk7XG5cbiAgICAgICAgICAgIHJldHVybiBzY3JpcHQ7XG4gICAgICAgIH0sXG4gICAgICAgIGpzb25wQ29udGFpbmVyTm9kZTogZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgICAgIHJldHVybiBkb2N1bWVudC5oZWFkIHx8IGRvY3VtZW50LmdldEVsZW1lbnRzQnlOYW1lKCdoZWFkJylbMF07XG4gICAgICAgIH0sXG4gICAgICAgIGpzb25wQ2FsbGJhY2tOYW1lOiBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICAgICAgcmV0dXJuICdqc29ucF8nICsgdXVpZCgpICsgJ18nICsgKG5ldyBEYXRlKCkuZ2V0VGltZSgpKTtcbiAgICAgICAgfSxcbiAgICAgICAgY29tcGlsZVVSTDogZnVuY3Rpb24gKHVybCwgbW9kZWwsIG9wdGlvbnMpIHtcbiAgICAgICAgICAgIHJldHVybiB0ZW1wbGF0ZSh1cmwsIG1vZGVsKTtcbiAgICAgICAgfSxcbiAgICAgICAgZW5jb2RlUXVlcnlTdHJpbmc6IGZ1bmN0aW9uIChxdWVyeSwgb3B0aW9ucykge1xuICAgICAgICAgICAgcmV0dXJuIFFTLmVuY29kZShxdWVyeSk7XG4gICAgICAgIH0sXG4gICAgICAgIG9uWGhyQ3JlYXRlZDogbnVsbCxcbiAgICAgICAgb25YaHJPcGVuZWQ6IG51bGwsXG4gICAgICAgIG9uWGhyU2VudDogbnVsbCxcbiAgICAgICAgb25SZXF1ZXN0Q3JlYXRlZDogbnVsbCxcbiAgICAgICAgaXNSZXNwb25zZU9rOiBmdW5jdGlvbiAocmVxdWVzdFR5cGUsIHJlc3BvbnNlKSB7XG4gICAgICAgICAgICB2YXIgaXNPaztcbiAgICAgICAgICAgIHZhciBzdGF0dXM7XG5cbiAgICAgICAgICAgIC8vIEh0dHAgcmVxdWVzdFxuICAgICAgICAgICAgaWYgKHJlcXVlc3RUeXBlID09PSBIVFRQX1JFUVVFU1QpIHtcbiAgICAgICAgICAgICAgICBzdGF0dXMgPSArcmVzcG9uc2UucmVxdWVzdC54aHIuc3RhdHVzO1xuICAgICAgICAgICAgICAgIGlzT2sgPSAoc3RhdHVzID49IDIwMCAmJiBzdGF0dXMgPCAzMDApIHx8IHN0YXR1cyA9PT0gMzA0O1xuICAgICAgICAgICAgLy8gSlNPTlAgcmVxdWVzdFxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpc09rID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGlzT2s7XG4gICAgICAgIH0sXG4gICAgICAgIHRyYW5zZm9ybUVycm9yOiBudWxsLFxuICAgICAgICB0cmFuc2Zvcm1SZXNwb25zZTogbnVsbCxcbiAgICAgICAgc2hvdWxkQ2FsbEVycm9yQ2FsbGJhY2s6IG51bGwsXG4gICAgICAgIHNob3VsZENhbGxTdWNjZXNzQ2FsbGJhY2s6IG51bGxcbiAgICB9O1xuXG4gICAgcmV0dXJuIG9wdGlvbnM7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gY3JlYXRlRGVmYXVsdE9wdGlvbnM7XG4iLCIvKipcbiAqIERlZmluZSBhIHN0YXRpYyBtZW1iZXIgb24gdGhlIGdpdmVuIGNvbnN0cnVjdG9yIGFuZCBpdHMgcHJvdG90eXBlXG4gKlxuICogQHBhcmFtIHtDb25zdHJ1Y3Rvcn0gY3RvciBUaGUgY29uc3RydWN0b3IgdG8gZGVmaW5lIHRoZSBzdGF0aWMgbWVtYmVyXG4gKiBAcGFyYW0ge3N0cmluZ30gbmFtZSBUaGUgbmFtZSBvZiB0aGUgc3RhdGljIG1lbWJlclxuICogQHBhcmFtIHthbnl9IHZhbHVlIFRoZSB2YWx1ZSBvZiB0aGUgc3RhdGljIG1lbWJlclxuICogQHRocm93cyB7RXJyb3J9IFRocm93cyBlcnJvciBpZiB0aGUgbmFtZSBoYXMgYWxyZWFkeSBleGlzdGVkLCBvciB0aGUgY29uc3RydWN0b3IgaXMgbm90IGEgZnVuY3Rpb25cbiAqL1xuZnVuY3Rpb24gZGVmaW5lRXhwb3J0cyhjdG9yLCBuYW1lLCB2YWx1ZSkge1xuICAgIGN0b3IucHJvdG90eXBlLmV4cG9ydHMgPSBjdG9yLmV4cG9ydHMgPSBjdG9yLmV4cG9ydHMgfHwge307XG4gICAgY3Rvci5leHBvcnRzW25hbWVdID0gdmFsdWU7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZGVmaW5lRXhwb3J0cztcbiIsInZhciBpc0Z1bmN0aW9uID0gcmVxdWlyZSgzOCk7XG52YXIgSHR0cFJlc3BvbnNlRXJyb3IgPSByZXF1aXJlKDUpO1xudmFyIEpTT05QUmVzcG9uc2VFcnJvciA9IHJlcXVpcmUoOCk7XG52YXIgY29uc3RhbnRzID0gcmVxdWlyZSgyNSk7XG52YXIgSFRUUF9SRVFVRVNUID0gY29uc3RhbnRzLkhUVFBfUkVRVUVTVDtcblxuLyoqXG4gKiBGaXJlIHRoZSBjYWxsYmFja3MuXG4gKlxuICogQHBhcmFtIHtzdHJpbmd8bnVsbH0gY29kZSBJZiB0aGVyZSBpcyBhbiBlcnJvciwgYGNvZGVgIHNob3VsZCBiZSBhIHN0cmluZy4gSWYgdGhlcmUgaXMgbm8gZXJyb3IsIGBjb2RlYCBpcyBgbnVsbGAuXG4gKiBAcGFyYW0ge0h0dHBSZXNwb25zZXxKU09OUFJlc3BvbnNlfSByZXNwb25zZSBUaGUgcmVzcG9uc2UgaW5zdGFuY2UuXG4gKi9cbmZ1bmN0aW9uIGZpcmVDYWxsYmFja3MoY29kZSwgcmVzcG9uc2UpIHtcbiAgICB2YXIgcmVxdWVzdCA9IHJlc3BvbnNlLnJlcXVlc3Q7XG4gICAgdmFyIHJlcXVlc3RUeXBlID0gcmVxdWVzdC5yZXF1ZXN0VHlwZTtcbiAgICB2YXIgb3B0aW9ucyA9IHJlcXVlc3Qub3B0aW9ucztcbiAgICB2YXIgb25zdWNjZXNzID0gcmVxdWVzdC5vbnN1Y2Nlc3M7XG4gICAgdmFyIG9uZXJyb3IgPSByZXF1ZXN0Lm9uZXJyb3I7XG4gICAgdmFyIHNob3VsZENhbGxFcnJvckNhbGxiYWNrID0gb3B0aW9ucy5zaG91bGRDYWxsRXJyb3JDYWxsYmFjaztcbiAgICB2YXIgc2hvdWxkQ2FsbFN1Y2Nlc3NDYWxsYmFjayA9IG9wdGlvbnMuc2hvdWxkQ2FsbFN1Y2Nlc3NDYWxsYmFjaztcbiAgICB2YXIgdHJhbnNmb3JtRXJyb3IgPSBvcHRpb25zLnRyYW5zZm9ybUVycm9yO1xuICAgIHZhciB0cmFuc2Zvcm1SZXNwb25zZSA9IG9wdGlvbnMudHJhbnNmb3JtUmVzcG9uc2U7XG5cbiAgICB2YXIgZXJyb3IgPSBudWxsO1xuICAgIHZhciBjYWxsRXJyb3JDYWxsYmFjayA9IHRydWU7XG4gICAgdmFyIGNhbGxTdWNjZXNzQ2FsbGJhY2sgPSB0cnVlO1xuICAgIHZhciB0cmFuc2Zvcm1lZEVycm9yID0gbnVsbDtcbiAgICB2YXIgdHJhbnNmb3JtZWRSZXNwb25zZSA9IG51bGw7XG5cbiAgICBpZiAoY29kZSkge1xuICAgICAgICBpZiAocmVxdWVzdFR5cGUgPT09IEhUVFBfUkVRVUVTVCkge1xuICAgICAgICAgICAgZXJyb3IgPSBuZXcgSHR0cFJlc3BvbnNlRXJyb3IoY29kZSwgcmVxdWVzdCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBlcnJvciA9IG5ldyBKU09OUFJlc3BvbnNlRXJyb3IoY29kZSwgcmVxdWVzdCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGlzRnVuY3Rpb24odHJhbnNmb3JtRXJyb3IpKSB7XG4gICAgICAgICAgICB0cmFuc2Zvcm1lZEVycm9yID0gdHJhbnNmb3JtRXJyb3IocmVxdWVzdFR5cGUsIGVycm9yKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRyYW5zZm9ybWVkRXJyb3IgPSBlcnJvcjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaXNGdW5jdGlvbihzaG91bGRDYWxsRXJyb3JDYWxsYmFjaykpIHtcbiAgICAgICAgICAgIGNhbGxFcnJvckNhbGxiYWNrID0gc2hvdWxkQ2FsbEVycm9yQ2FsbGJhY2socmVxdWVzdFR5cGUsIHRyYW5zZm9ybWVkRXJyb3IsIGVycm9yKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2FsbEVycm9yQ2FsbGJhY2spIHtcbiAgICAgICAgICAgIGlmIChpc0Z1bmN0aW9uKG9uZXJyb3IpKSB7XG4gICAgICAgICAgICAgICAgb25lcnJvcih0cmFuc2Zvcm1lZEVycm9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChpc0Z1bmN0aW9uKHRyYW5zZm9ybVJlc3BvbnNlKSkge1xuICAgICAgICAgICAgdHJhbnNmb3JtZWRSZXNwb25zZSA9IHRyYW5zZm9ybVJlc3BvbnNlKHJlcXVlc3RUeXBlLCByZXNwb25zZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0cmFuc2Zvcm1lZFJlc3BvbnNlID0gcmVzcG9uc2U7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGlzRnVuY3Rpb24oc2hvdWxkQ2FsbFN1Y2Nlc3NDYWxsYmFjaykpIHtcbiAgICAgICAgICAgIGNhbGxTdWNjZXNzQ2FsbGJhY2sgPSBzaG91bGRDYWxsU3VjY2Vzc0NhbGxiYWNrKHJlcXVlc3RUeXBlLCB0cmFuc2Zvcm1lZFJlc3BvbnNlLCByZXNwb25zZSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNhbGxTdWNjZXNzQ2FsbGJhY2spIHtcbiAgICAgICAgICAgIGlmIChpc0Z1bmN0aW9uKG9uc3VjY2VzcykpIHtcbiAgICAgICAgICAgICAgICBvbnN1Y2Nlc3ModHJhbnNmb3JtZWRSZXNwb25zZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZmlyZUNhbGxiYWNrcztcbiIsInZhciBpc0Z1bmN0aW9uID0gcmVxdWlyZSgzOCk7XG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIHByb2Nlc3MgdGhlIHJlcXVlc3Qgb3B0aW9ucy4gVGhpcyBmdW5jdGlvbiB3aWxsIGNhbGwgdGhlIGZ1bmN0aW9uIGBvcHRpb25zLmhhbmRsZU9wdGlvbnNgLlxuICpcbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEByZXR1cm5zIHt2b2lkfVxuICovXG5mdW5jdGlvbiBoYW5kbGVPcHRpb25zKG9wdGlvbnMpIHtcbiAgICBpZiAoaXNGdW5jdGlvbihvcHRpb25zLmhhbmRsZU9wdGlvbnMpKSB7XG4gICAgICAgIG9wdGlvbnMuaGFuZGxlT3B0aW9ucyhvcHRpb25zKTtcbiAgICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaGFuZGxlT3B0aW9ucztcbiIsIm1vZHVsZS5leHBvcnRzID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcbiIsIi8qKlxuICogTWFrZSBgU3ViQ2xhc3NgIGV4dGVuZCBgU3VwZXJDbGFzc2AuXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gU3ViQ2xhc3MgVGhlIHN1YiBjbGFzcyBjb25zdHJ1Y3Rvci5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IFN1cGVyQ2xhc3MgVGhlIHN1cGVyIGNsYXNzIGNvbnN0cnVjdG9yLlxuICovXG5mdW5jdGlvbiBpbmhlcml0cyhTdWJDbGFzcywgU3VwZXJDbGFzcykge1xuICAgIHZhciBGID0gZnVuY3Rpb24oKSB7fTtcblxuICAgIEYucHJvdG90eXBlID0gU3VwZXJDbGFzcy5wcm90b3R5cGU7XG5cbiAgICBTdWJDbGFzcy5wcm90b3R5cGUgPSBuZXcgRigpO1xuICAgIFN1YkNsYXNzLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IFN1YkNsYXNzO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGluaGVyaXRzO1xuIiwiLyoqXG4gKiBUaGUgbm8gb3BlcmF0aW9uIGZ1bmN0aW9uLlxuICovXG5mdW5jdGlvbiBub29wKCkge1xuICAgIC8vIG5vdGhpbmcgdG8gZG8gaGVyZS5cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBub29wO1xuIiwidmFyIFRfU1RSID0gMTtcbnZhciBUX0VYUCA9IDI7XG5cbi8qKlxuICogQSBzaW1wbGUgdGVtcGxhdGUgZnVuY3Rpb25cbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gUnJldHVybnMgJy9wb3N0LzEnXG4gKiB0ZW1wbGF0ZSgnL3Bvc3QveyBwb3N0LmlkIH0nLCB7IHBvc3Q6IHsgaWQ6IDEgfSB9KVxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZW1wbGF0ZSBUaGUgdGVtcGxhdGUgdGV4dC5cbiAqIEBwYXJhbSB7T2JqZWN0LjxzdHJpbmcsICo+fSBkYXRhIFRoZSBkYXRhIG9iamVjdC5cbiAqIEBwYXJhbSB7VGVtcGxhdGVPcHRpb25zfSBvcHRpb25zIFRoZSB0ZW1wbGF0ZSBvcHRpb25zLlxuICogQHJldHVybnMge3N0cmluZ30gUmV0dXJucyB0aGUgY29tcGlsZWQgdGV4dC5cbiAqL1xuZnVuY3Rpb24gdGVtcGxhdGUodGVtcGxhdGUsIGRhdGEsIG9wdGlvbnMpIHtcbiAgICB2YXIgdGVtcGwgPSB0ZW1wbGF0ZSArICcnO1xuICAgIHZhciBtb2RlbCA9IGRhdGEgfHwge307XG4gICAgdmFyIG9wdHMgPSBvcHRpb25zIHx8IHt9O1xuICAgIHZhciBzdGFydCA9IG9wdHMuc3RhcnQgfHwgJ3snO1xuICAgIHZhciBlbmQgPSBvcHRzLmVuZCB8fCAnfSc7XG4gICAgdmFyIGVuY29kZSA9IG9wdHMuZW5jb2RlIHx8IGVuY29kZVVSSUNvbXBvbmVudDtcbiAgICB2YXIgYXN0ID0gY29tcGlsZSh0ZW1wbCwgc3RhcnQsIGVuZCwgZnVuY3Rpb24gKGV4cHIpIHtcbiAgICAgICAgdmFyIGZpcnN0ID0gZXhwci5jaGFyQXQoMCk7XG4gICAgICAgIHZhciBzZWNvbmQgPSBleHByLmNoYXJBdCgxKTtcbiAgICAgICAgdmFyIHJhdyA9IGZhbHNlO1xuXG4gICAgICAgIGlmIChmaXJzdCA9PT0gJy0nICYmIHNlY29uZCA9PT0gJyAnKSB7XG4gICAgICAgICAgICByYXcgPSB0cnVlO1xuICAgICAgICAgICAgZXhwciA9IGV4cHIuc3Vic3RyKDIpO1xuICAgICAgICB9XG5cbiAgICAgICAgZXhwciA9IGV4cHIucmVwbGFjZSgvXlxccyt8XFxzKyQvZywgJycpO1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB0eXBlOiBUX0VYUCxcbiAgICAgICAgICAgIHRleHQ6IGV4cHIsXG4gICAgICAgICAgICByYXc6IHJhd1xuICAgICAgICB9O1xuICAgIH0pO1xuXG4gICAgdmFyIHJlbmRlciA9IGJ1aWxkUmVuZGVyRnVuY3Rpb24oYXN0LCBlbmNvZGUpO1xuXG4gICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIHJlbmRlcihtb2RlbCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvbXBpbGUgRXJyb3I6XFxuXFxuJyArIHRlbXBsYXRlICsgJ1xcblxcbicgKyBlLm1lc3NhZ2UpO1xuICAgIH1cbn1cblxuLyoqXG4gKiBCdWlsZCByZW5kZXIgZnVuY3Rpb24uXG4gKlxuICogQHBhcmFtIHtPYmplY3QuPHN0cmluZywgKj5bXX0gYXN0IFRoZSBhYnN0cmFjdCBzeW50YXggdHJlZS5cbiAqIEBwYXJhbSB7KHN0cjogc3RyaW5nKSA9PiBzdHJpbmd9IGVuY29kZSBUaGUgZnVuY3Rpb24gdG8gZW5jb2RlIHRoZSBzdHJpbmcuXG4gKiBAcmV0dXJucyB7KG1vZGVsOiBPYmplY3QuPHN0cmluZywgKj4pID0+IHN0cmluZ30gUmV0dXJucyBhIGZ1bmN0aW9uIHRoYXQgY29tcGlsZSBkYXRhIHRvIHN0cmluZy5cbiAqL1xuZnVuY3Rpb24gYnVpbGRSZW5kZXJGdW5jdGlvbihhc3QsIGVuY29kZSkge1xuICAgIHZhciBmbjtcbiAgICB2YXIgbGluZTtcbiAgICB2YXIgbGluZXMgPSBbXTtcbiAgICB2YXIgaSA9IDA7XG4gICAgdmFyIGwgPSBhc3QubGVuZ3RoO1xuXG4gICAgbGluZXMucHVzaCgndmFyIF9fbz1bXScpO1xuICAgIGxpbmVzLnB1c2goJ3dpdGgoX19zKXsnKTtcblxuICAgIGZvciAoIDsgaSA8IGw7ICsraSkge1xuICAgICAgICBsaW5lID0gYXN0W2ldO1xuXG4gICAgICAgIGlmIChsaW5lLnR5cGUgPT09IFRfU1RSKSB7XG4gICAgICAgICAgICBsaW5lcy5wdXNoKCdfX28ucHVzaCgnICsgSlNPTi5zdHJpbmdpZnkobGluZS50ZXh0KSArICcpJyk7XG4gICAgICAgIH0gZWxzZSBpZiAobGluZS50eXBlID09PSBUX0VYUCAmJiBsaW5lLnRleHQpIHtcbiAgICAgICAgICAgIGlmIChsaW5lLnJhdykge1xuICAgICAgICAgICAgICAgIGxpbmVzLnB1c2goJ19fby5wdXNoKCcgKyBsaW5lLnRleHQgKyAnKScpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBsaW5lcy5wdXNoKCdfX28ucHVzaChfX2UoJyArIGxpbmUudGV4dCArICcpKScpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgbGluZXMucHVzaCgnfScpO1xuICAgIGxpbmVzLnB1c2goJ3JldHVybiBfX28uam9pbihcIlwiKScpO1xuXG4gICAgZm4gPSBuZXcgRnVuY3Rpb24oJ19fcycsICdfX2UnLCBsaW5lcy5qb2luKCdcXG4nKSk7XG5cbiAgICByZXR1cm4gZnVuY3Rpb24gKG1vZGVsKSB7XG4gICAgICAgIHJldHVybiBmbihtb2RlbCwgZnVuY3Rpb24gKHZhbCkge1xuICAgICAgICAgICAgcmV0dXJuICh2YWwgPT09IG51bGwgfHwgdmFsID09PSB1bmRlZmluZWQpID8gJycgOiBlbmNvZGUodmFsICsgJycpO1xuICAgICAgICB9KTtcbiAgICB9O1xufVxuXG4vKipcbiAqIENvbXBpbGUgdGhlIHRlbXBsYXRlLlxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZW1wbGF0ZSBUaGUgdGVtcGxhdGUgdG8gY29tcGlsZS5cbiAqIEBwYXJhbSB7c3RyaW5nfSBzdGFydFRhZyBUaGUgc3RhcnQgdGFnLlxuICogQHBhcmFtIHtzdHJpbmd9IGVuZFRhZyBUaGUgZW5kIHRhZy5cbiAqIEBwYXJhbSB7KGV4cHI6IHN0cmluZykgPT4gc3RyaW5nfSBwYXJzZUV4cHIgVGhlIGZ1bmN0aW9uIHRvIHBhcnNlIHRoZSBleHByZXNzaW9uLlxuICogQHJldHVybnMge3N0cmluZ30gUmV0dXJuIHRoZSBjb21waWxlZCBzdHJpbmcuXG4gKi9cbmZ1bmN0aW9uIGNvbXBpbGUodGVtcGxhdGUsIHN0YXJ0VGFnLCBlbmRUYWcsIHBhcnNlRXhwcikge1xuICAgIHZhciBpID0gMDtcbiAgICB2YXIgbCA9IHRlbXBsYXRlLmxlbmd0aDtcbiAgICB2YXIgc2wgPSBzdGFydFRhZy5sZW5ndGg7XG4gICAgdmFyIGVsID0gZW5kVGFnLmxlbmd0aDtcbiAgICB2YXIgYXN0ID0gW107XG4gICAgdmFyIHN0cmJ1ZmZlciA9IFtdO1xuICAgIHZhciBleHByYnVmZmVyID0gW107XG4gICAgdmFyIHR5cGUgPSBUX1NUUjtcblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgY2hhciBpbiBgdGVtcGxhdGVgIGF0IHRoZSBnaXZlbiBwb3NpdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtbmVyfSBpbmRleCBUaGUgaW5kZXggdG8gcmVhZC5cbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSBSZXR1cm5zIHRoZSBjaGFyLlxuICAgICAqL1xuICAgIHZhciBjaGFyQXQgPSBmdW5jdGlvbiAoaW5kZXgpIHtcbiAgICAgICAgcmV0dXJuIHRlbXBsYXRlLmNoYXJBdChpbmRleCk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEVzY2FwZSB0aGUgdGFnLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHRhZyBUaGUgdGFnIHRvIGVzY2FwZS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ1tdfSBidWZmZXIgVGhlIGJ1ZmZlciB0byBwdXQgdGhlIGNoYXIuXG4gICAgICovXG4gICAgdmFyIGVzYyA9IGZ1bmN0aW9uICh0YWcsIGJ1ZmZlcikge1xuICAgICAgICB2YXIgYztcbiAgICAgICAgdmFyIG0gPSB0YWcubGVuZ3RoO1xuICAgICAgICB2YXIgcyA9ICdcXFxcJztcbiAgICAgICAgLyplc2xpbnQgbm8tY29uc3RhbnQtY29uZGl0aW9uOiBbXCJlcnJvclwiLCB7IFwiY2hlY2tMb29wc1wiOiBmYWxzZSB9XSovXG4gICAgICAgIHdoaWxlICgxKSB7XG4gICAgICAgICAgICBjID0gY2hhckF0KGkpO1xuICAgICAgICAgICAgaWYgKGMgPT09IHMpIHtcbiAgICAgICAgICAgICAgICBjID0gY2hhckF0KCsraSk7XG4gICAgICAgICAgICAgICAgaWYgKGMgPT09IHMpIHtcbiAgICAgICAgICAgICAgICAgICAgYnVmZmVyLnB1c2gocyk7XG4gICAgICAgICAgICAgICAgICAgICsraTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGlzV29yZCh0YWcpKSB7XG4gICAgICAgICAgICAgICAgICAgIGJ1ZmZlci5wdXNoKHRhZyk7XG4gICAgICAgICAgICAgICAgICAgIGkgKz0gbTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBidWZmZXIucHVzaChzKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBDaGVjayB3aGV0aGVyIHRoZSBuZXh0IGlucHV0IGlzIHRoZSB3b3JkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHdvcmQgVGhlIHdvcmQgdG8gY2hlY2suXG4gICAgICogQHJldHVybnMge251bWJlcn0gUmV0dXJucyBgMWAgb24geWVzLCBvdGhlcndpc2UgYDBgIGlzIHJldHVybmVkLlxuICAgICAqL1xuICAgIHZhciBpc1dvcmQgPSBmdW5jdGlvbiAod29yZCkge1xuICAgICAgICB2YXIgayA9IDA7XG4gICAgICAgIHZhciBqID0gaTtcbiAgICAgICAgdmFyIG0gPSB3b3JkLmxlbmd0aDtcblxuICAgICAgICB3aGlsZSAoayA8IG0gJiYgaiA8IGwpIHtcbiAgICAgICAgICAgIGlmICh3b3JkLmNoYXJBdChrKSAhPT0gY2hhckF0KGopKSByZXR1cm4gMDtcbiAgICAgICAgICAgICsraztcbiAgICAgICAgICAgICsrajtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiAxO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBGbHVzaCB0aGUgc3RyIHRvIHRoZSBhc3QgYW5kIHJlc2V0IHRoZSBzdHIgYnVmZmVyLlxuICAgICAqL1xuICAgIHZhciBmbHVzaFN0ciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKHN0cmJ1ZmZlci5sZW5ndGgpIHtcbiAgICAgICAgICAgIGFzdC5wdXNoKHtcbiAgICAgICAgICAgICAgICB0eXBlOiBUX1NUUixcbiAgICAgICAgICAgICAgICB0ZXh0OiBzdHJidWZmZXIuam9pbignJylcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgc3RyYnVmZmVyID0gW107XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogRmx1c2ggdGhlIGV4cHIgdG8gdGhlIGFzdCBhbmQgcmVzZXQgdGhlIGV4cHIgYnVmZmVyLlxuICAgICAqL1xuICAgIHZhciBmbHVzaEV4cHIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGZsdXNoU3RyKCk7XG4gICAgICAgIGFzdC5wdXNoKHBhcnNlRXhwcihleHByYnVmZmVyLmpvaW4oJycpKSk7XG4gICAgICAgIGV4cHJidWZmZXIgPSBbXTtcbiAgICB9O1xuXG4gICAgd2hpbGUgKGkgPCBsKSB7XG4gICAgICAgIGlmICh0eXBlID09PSBUX1NUUikge1xuICAgICAgICAgICAgZXNjKHN0YXJ0VGFnLCBzdHJidWZmZXIpO1xuICAgICAgICAgICAgaWYgKGlzV29yZChzdGFydFRhZykpIHtcbiAgICAgICAgICAgICAgICB0eXBlID0gVF9FWFA7XG4gICAgICAgICAgICAgICAgaSArPSBzbDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc3RyYnVmZmVyLnB1c2goY2hhckF0KGkpKTtcbiAgICAgICAgICAgICAgICArK2k7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gVF9FWFApIHtcbiAgICAgICAgICAgIGVzYyhlbmRUYWcsIGV4cHJidWZmZXIpO1xuICAgICAgICAgICAgaWYgKGlzV29yZChlbmRUYWcpKSB7XG4gICAgICAgICAgICAgICAgdHlwZSA9IFRfU1RSO1xuICAgICAgICAgICAgICAgIGkgKz0gZWw7XG4gICAgICAgICAgICAgICAgZmx1c2hFeHByKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGV4cHJidWZmZXIucHVzaChjaGFyQXQoaSkpO1xuICAgICAgICAgICAgICAgICsraTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmICh0eXBlID09PSBUX0VYUCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgZW5kJyk7XG4gICAgfVxuXG4gICAgZmx1c2hTdHIoKTtcblxuICAgIHJldHVybiBhc3Q7XG59XG5cbi8qKlxuICogQHR5cGVkZWYge09iamVjdC48c3RyaW5nLCAqPn0gVGVtcGxhdGVPcHRpb25zXG4gKiBAcHJvcGVydHkge3N0cmluZ30gW3N0YXJ0XSBUaGUgc3RhcnQgdGFnIG9mIHRoZSB0ZW1wbGF0ZSwgZGVmYXVsdCBpcyBge2AuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gW2VuZF0gVGhlIGVuZCB0YWcgb2YgdGhlIHRlbXBsYXRlLCBkZWZhdWx0IGlzIGB9YC5cbiAqIEBwcm9wZXJ0eSB7KHZhbHVlOiBzdHJpbmcpID0+IHN0cmluZ30gW2VuY29kZV0gVGhlIGZ1bmN0aW9uIHRvIGVuY29kZSB0aGUgc3RyaW5nLCBkZWZhdWx0IGlzIGBlbmNvZGVVUklDb21wb25lbnRgLlxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gdGVtcGxhdGU7XG4iLCJ2YXIgaWQgPSAwO1xuXG4vKipcbiAqIFJldHVybnMgYSBudW1iZXIgdGhhdCBncmVhdGVyIHRoYW4gdGhlIHByaXZvdXMgb25lLCBzdGFydGluZyBmb3JtIGAxYC5cbiAqXG4gKiBAcmV0dXJucyB7bnVtYmVyfVxuICovXG5mdW5jdGlvbiB1dWlkKCkge1xuICAgIGlkICs9IDE7XG4gICAgcmV0dXJuIGlkO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHV1aWQ7XG4iLCIvKipcbiAqIENoZWNrIHdoZXRoZXIgdGhlIHVybCBpcyBhYnNvbHV0ZSB1cmwuXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IHVybCBUaGUgdXJsIHN0cmluZyB0byBjaGVja1xuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSB1cmwgaXMgYWJvc29sdXRlLCBvdGhlcndpc2UgYGZhbHNlYCBpcyByZXR1cm5lZFxuICovXG5mdW5jdGlvbiBpc0Fic29sdXRlVVJMKHVybCkge1xuICAgIHJldHVybiAvXig/OlthLXpdW2EtejAtOVxcLVxcLlxcK10qOik/XFwvXFwvL2kudGVzdCh1cmwpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGlzQWJzb2x1dGVVUkw7XG4iLCJ2YXIgdG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xuXG4vKipcbiAqIENoZWNrIHdoZXRoZXIgdGhlIHZhcmlhYmxlIGlzIGFuIGluc3RhbmNlIG9mIGBBcnJheWBcbiAqXG4gKiBAcGFyYW0ge2FueX0gaXQgVGhlIHZhcmlhYmxlIHRvIGNoZWNrXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIHZhcmlhYmxlIGlzIGFuIGluc3RhbmNlIG9mIGBBcnJheWAsIG90aGVyd2lzZSBgZmFsc2VgIGlzIHJldHVybmVkXG4gKi9cbmZ1bmN0aW9uIGlzQXJyYXkoaXQpIHtcbiAgICByZXR1cm4gdG9TdHJpbmcuY2FsbChpdCkgPT09ICdbb2JqZWN0IEFycmF5XSc7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaXNBcnJheTtcbiIsInZhciB0b1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG5cbi8qKlxuICogQ2hlY2sgd2hldGhlciB0aGUgdmFyaWFibGUgaXMgYSBmdW5jdGlvblxuICpcbiAqIEBwYXJhbSB7YW55fSBpdCBUaGUgdmFyaWFibGUgdG8gY2hlY2tcbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgdmFyaWFibGUgaXMgYSBmdW5jdGlvbiwgb3RoZXJ3aXNlIGBmYWxzZWAgaXMgcmV0dXJuZWRcbiAqL1xuZnVuY3Rpb24gaXNGdW5jdGlvbihpdCkge1xuICAgIHJldHVybiB0b1N0cmluZy5jYWxsKGl0KSA9PT0gJ1tvYmplY3QgRnVuY3Rpb25dJztcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpc0Z1bmN0aW9uO1xuIiwidmFyIHRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcblxuLyoqXG4gKiBDaGVjayB3aGV0aGVyIHRoZSB2YXJpYWJsZSBpcyBhIHBsYWluIG9iamVjdC5cbiAqXG4gKiBAcGFyYW0ge2FueX0gaXQgVGhlIHZhcmlhYmxlIHRvIGNoZWNrXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIHZhcmlhYmxlIGlzIGEgcGxhaW4gb2JqZWN0LCBvdGhlcndpc2UgYGZhbHNlYCBpcyByZXR1cm5lZFxuICovXG5mdW5jdGlvbiBpc1BsYWluT2JqZWN0KGl0KSB7XG4gICAgaWYgKCFpdCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmIGl0ID09PSB3aW5kb3cpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgZ2xvYmFsICE9PSAndW5kZWZpbmVkJyAmJiBpdCA9PT0gZ2xvYmFsKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdG9TdHJpbmcuY2FsbChpdCkgPT09ICdbb2JqZWN0IE9iamVjdF0nO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGlzUGxhaW5PYmplY3Q7XG4iLCJ2YXIgaXNBcnJheSA9IHJlcXVpcmUoMzcpO1xudmFyIGlzUGxhaW5PYmplY3QgPSByZXF1aXJlKDM5KTtcbnZhciBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xudmFyIHNsaWNlID0gQXJyYXkucHJvdG90eXBlLnNsaWNlO1xuXG4vKipcbiAqIENvcHkgdGhlIG5vbi11bmRlZmluZWQgdmFsdWVzIG9mIHNvdXJjZSB0byB0YXJnZXQuIE92ZXJ3cml0ZSB0aGUgb3JpZ2luYWwgdmFsdWVzLlxuICogVGhpcyBmdW5jdGlvbiB3aWxsIG1vZGlmeSB0aGUgdGFyZ2V0XG4gKlxuICogQHBhcmFtIHtPYmplY3QuPHN0cmluZywgKj58YW55W119IHRhcmdldCBUaGUgdGFyZ2V0IG9iamVjdCBvciBhcnJheVxuICogQHBhcmFtIHtPYmplY3QuPHN0cmluZywgKj58YW55W119IHNvdXJjZSBUaGUgc291cmNlIG9iamVjdCBvciBhcnJheVxuICogQHJldHVybnMge09iamVjdC48c3RyaW5nLCAqPnxhbnlbXX0gUmV0dXJucyB0aGUgZXh0ZW5kZWQgdGFyZ2V0IG9iamVjdCBvciBhcnJheVxuICovXG5mdW5jdGlvbiBleHRlbmQodGFyZ2V0LCBzb3VyY2UpIHtcbiAgICB2YXIga2V5LCB2YWw7XG5cbiAgICBpZiAoIHRhcmdldCAmJiAoIGlzQXJyYXkoc291cmNlKSB8fCBpc1BsYWluT2JqZWN0KHNvdXJjZSkgKSApIHtcbiAgICAgICAgZm9yICgga2V5IGluIHNvdXJjZSApIHtcbiAgICAgICAgICAgIGlmICggaGFzT3duLmNhbGwoc291cmNlLCBrZXkpICkge1xuICAgICAgICAgICAgICAgIHZhbCA9IHNvdXJjZVtrZXldO1xuICAgICAgICAgICAgICAgIGlmICh2YWwgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIGlzUGxhaW5PYmplY3QodmFsKSApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICggISBpc1BsYWluT2JqZWN0KHRhcmdldFtrZXldKSApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0YXJnZXRba2V5XSA9IHt9O1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgbWVyZ2UodGFyZ2V0W2tleV0sIHZhbCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoIGlzQXJyYXkodmFsKSApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICggISBpc0FycmF5KHRhcmdldFtrZXldKSApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0YXJnZXRba2V5XSA9IFtdO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgbWVyZ2UodGFyZ2V0W2tleV0sIHZhbCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0YXJnZXRba2V5XSA9IHZhbDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0YXJnZXQ7XG59XG5cbi8qKlxuICogQ29weSBhbnkgbm9uLXVuZGVmaW5lZCB2YWx1ZXMgb2Ygc291cmNlIHRvIHRhcmdldCBhbmQgb3ZlcndyaXRlcyB0aGUgY29ycmVzcG9uZGluZyBvcmlnaW5hbCB2YWx1ZXMuIFRoaXMgZnVuY3Rpb25cbiAqIHdpbGwgbW9kaWZ5IHRoZSB0YXJnZXQgb2JqZWN0LlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB0YXJnZXQgVGhlIHRhcmdldCBvYmplY3RcbiAqIEBwYXJhbSB7Li4uT2JqZWN0fSBhcmdzIFRoZSBzb3VyY2Ugb2JqZWN0XG4gKiBAcmV0dXJucyB7T2JqZWN0fSBSZXR1cm5zIHRoZSBtb2RpZmllZCB0YXJnZXQgb2JqZWN0XG4gKi9cbmZ1bmN0aW9uIG1lcmdlKHRhcmdldCwgYXJncykge1xuICAgIHZhciBpID0gMDtcbiAgICB2YXIgbCA9IGFyZ3VtZW50cy5sZW5ndGggLSAxO1xuXG4gICAgYXJncyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcblxuICAgIGZvciAoaSA9IDA7IGkgPCBsOyBpICs9IDEpIHtcbiAgICAgICAgZXh0ZW5kKHRhcmdldCwgYXJnc1tpXSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRhcmdldDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBtZXJnZTtcbiIsInZhciB1dGlsID0gcmVxdWlyZSg0NCk7XG52YXIgaXNBcnJheSA9IHV0aWwuaXNBcnJheTtcblxuLyoqXG4gKiBEZWNvZGUgdGhlIFVSSSBDb21wb25lbnQgZW5jb2RlZCBxdWVyeSBzdHJpbmcgdG8gb2JqZWN0XG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IFRoZSBVUkkgQ29tcG9uZW50IGVuY29kZWQgcXVlcnkgc3RyaW5nXG4gKiBAcmV0dXJucyB7T2JqZWN0LjxzdHJpbmcsIHN0cmluZz59IFJldHVybnMgdGhlIGRlY29kZWQgb2JqZWN0XG4gKi9cbnZhciBkZWNvZGUgPSBmdW5jdGlvbiAoc3RyaW5nKSB7XG4gICAgdmFyIG9iamVjdCA9IHt9O1xuICAgIHZhciBjYWNoZSA9IHt9O1xuICAgIHZhciBrZXlWYWx1ZUFycmF5O1xuICAgIHZhciBpbmRleDtcbiAgICB2YXIgbGVuZ3RoO1xuICAgIHZhciBrZXlWYWx1ZTtcbiAgICB2YXIga2V5O1xuICAgIHZhciB2YWx1ZTtcblxuICAgIC8vIGRvIG5vdCBkZWNvZGUgZW1wdHkgc3RyaW5nIG9yIHNvbWV0aGluZyB0aGF0IGlzIG5vdCBzdHJpbmdcbiAgICBpZiAoc3RyaW5nICYmIHR5cGVvZiBzdHJpbmcgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGtleVZhbHVlQXJyYXkgPSBzdHJpbmcuc3BsaXQoJyYnKTtcbiAgICAgICAgaW5kZXggPSAwO1xuICAgICAgICBsZW5ndGggPSBrZXlWYWx1ZUFycmF5Lmxlbmd0aDtcblxuICAgICAgICB3aGlsZSAoaW5kZXggPCBsZW5ndGgpIHtcbiAgICAgICAgICAgIGtleVZhbHVlID0ga2V5VmFsdWVBcnJheVtpbmRleF0uc3BsaXQoJz0nKTtcbiAgICAgICAgICAgIGtleSA9IGRlY29kZVVSSUNvbXBvbmVudChrZXlWYWx1ZVswXSk7XG4gICAgICAgICAgICB2YWx1ZSA9IGtleVZhbHVlWzFdO1xuXG4gICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIHZhbHVlID0gZGVjb2RlVVJJQ29tcG9uZW50KHZhbHVlKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFsdWUgPSBudWxsO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBkZWNvZGVLZXkob2JqZWN0LCBjYWNoZSwga2V5LCB2YWx1ZSk7XG5cbiAgICAgICAgICAgIGluZGV4ICs9IDE7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gb2JqZWN0O1xufTtcblxuLyoqXG4gKiBEZWNvZGUgdGhlIHNwZWNlZmllZCBrZXlcbiAqXG4gKiBAcGFyYW0ge09iamVjdC48c3RyaW5nLCBzdHJpbmc+fSBvYmplY3QgVGhlIG9iamVjdCB0byBob2xkIHRoZSBkZWNvZGVkIGRhdGFcbiAqIEBwYXJhbSB7T2JqZWN0LjxzdHJpbmcsICo+fSBjYWNoZSBUaGUgb2JqZWN0IHRvIGhvbGQgY2FjaGUgZGF0YVxuICogQHBhcmFtIHtzdHJpbmd9IGtleSBUaGUga2V5IG5hbWUgdG8gZGVjb2RlXG4gKiBAcGFyYW0ge2FueX0gdmFsdWUgVGhlIHZhbHVlIHRvIGRlY29kZVxuICovXG52YXIgZGVjb2RlS2V5ID0gZnVuY3Rpb24gKG9iamVjdCwgY2FjaGUsIGtleSwgdmFsdWUpIHtcbiAgICB2YXIgckJyYWNrZXQgPSAvXFxbKFteXFxbXSo/KT9cXF0kLztcbiAgICB2YXIgckluZGV4ID0gLyheMCQpfCheWzEtOV1cXGQqJCkvO1xuICAgIHZhciBpbmRleE9yS2V5T3JFbXB0eTtcbiAgICB2YXIgcGFyZW50S2V5O1xuICAgIHZhciBhcnJheU9yT2JqZWN0O1xuICAgIHZhciBrZXlJc0luZGV4O1xuICAgIHZhciBrZXlJc0VtcHR5O1xuICAgIHZhciB2YWx1ZUlzSW5BcnJheTtcbiAgICB2YXIgZGF0YUFycmF5O1xuICAgIHZhciBsZW5ndGg7XG5cbiAgICAvLyBjaGVjayB3aGV0aGVyIGtleSBpcyBzb21ldGhpbmcgbGlrZSBgcGVyc29uW25hbWVdYCBvciBgY29sb3JzW11gIG9yXG4gICAgLy8gYGNvbG9yc1sxXWBcbiAgICBpZiAoIHJCcmFja2V0LnRlc3Qoa2V5KSApIHtcbiAgICAgICAgaW5kZXhPcktleU9yRW1wdHkgPSBSZWdFeHAuJDE7XG4gICAgICAgIHBhcmVudEtleSA9IGtleS5yZXBsYWNlKHJCcmFja2V0LCAnJyk7XG4gICAgICAgIGFycmF5T3JPYmplY3QgPSBjYWNoZVtwYXJlbnRLZXldO1xuXG4gICAgICAgIGtleUlzSW5kZXggPSBySW5kZXgudGVzdChpbmRleE9yS2V5T3JFbXB0eSk7XG4gICAgICAgIGtleUlzRW1wdHkgPSBpbmRleE9yS2V5T3JFbXB0eSA9PT0gJyc7XG4gICAgICAgIHZhbHVlSXNJbkFycmF5ID0ga2V5SXNJbmRleCB8fCBrZXlJc0VtcHR5O1xuXG4gICAgICAgIGlmIChhcnJheU9yT2JqZWN0KSB7XG4gICAgICAgICAgICAvLyBjb252ZXJ0IHRoZSBhcnJheSB0byBvYmplY3RcbiAgICAgICAgICAgIGlmICggKCEgdmFsdWVJc0luQXJyYXkpICYmIGlzQXJyYXkoYXJyYXlPck9iamVjdCkgKSB7XG4gICAgICAgICAgICAgICAgZGF0YUFycmF5ID0gYXJyYXlPck9iamVjdDtcbiAgICAgICAgICAgICAgICBsZW5ndGggPSBkYXRhQXJyYXkubGVuZ3RoO1xuICAgICAgICAgICAgICAgIGFycmF5T3JPYmplY3QgPSB7fTtcblxuICAgICAgICAgICAgICAgIHdoaWxlIChsZW5ndGgtLSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoYXJyYXlPck9iamVjdFtsZW5ndGhdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFycmF5T3JPYmplY3RbbGVuZ3RoXSA9IGRhdGFBcnJheVtsZW5ndGhdO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYXJyYXlPck9iamVjdCA9IHZhbHVlSXNJbkFycmF5ID8gW10gOiB7fTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICgga2V5SXNFbXB0eSAmJiBpc0FycmF5KGFycmF5T3JPYmplY3QpICkge1xuICAgICAgICAgICAgYXJyYXlPck9iamVjdC5wdXNoKHZhbHVlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGFycmF5T3JPYmplY3QgaXMgYXJyYXkgb3Igb2JqZWN0IGhlcmVcbiAgICAgICAgICAgIGFycmF5T3JPYmplY3RbaW5kZXhPcktleU9yRW1wdHldID0gdmFsdWU7XG4gICAgICAgIH1cblxuICAgICAgICBjYWNoZVtwYXJlbnRLZXldID0gYXJyYXlPck9iamVjdDtcblxuICAgICAgICBkZWNvZGVLZXkob2JqZWN0LCBjYWNoZSwgcGFyZW50S2V5LCBhcnJheU9yT2JqZWN0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBvYmplY3Rba2V5XSA9IHZhbHVlO1xuICAgIH1cbn07XG5cbmV4cG9ydHMuZGVjb2RlID0gZGVjb2RlO1xuIiwidmFyIHV0aWwgPSByZXF1aXJlKDQ0KTtcbnZhciBpc0FycmF5ID0gdXRpbC5pc0FycmF5O1xudmFyIGlzT2JqZWN0ID0gdXRpbC5pc09iamVjdDtcbnZhciBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuXG4vKipcbiAqIEVuY29kZSB0aGUgZ2l2ZW4gb2JqZWN0IHRvIFVSSSBDb21wb25lbnQgZW5jb2RlZCBxdWVyeSBzdHJpbmdcbiAqXG4gKiBAcGFyYW0ge09iamVjdC48c3RyaW5nLCAqPn0gb2JqZWN0IFRoZSBvYmplY3QgdG8gZW5jb2RlXG4gKiBAcGFyYW0ge2Jvb2xlYW59IFtrZWVwQXJyYXlJbmRleF0gV2hldGhlciB0byBrZWVwIGFycmF5IGluZGV4XG4gKiBAcmV0dXJucyB7c3RyaW5nfSBSZXR1cm5zIHRoZSBVUkkgQ29tcG9uZW50IGVuY29kZWQgcXVlcnkgc3RyaW5nXG4gKi9cbnZhciBlbmNvZGUgPSBmdW5jdGlvbiAob2JqZWN0LCBrZWVwQXJyYXlJbmRleCkge1xuICAgIHZhciBrZXk7XG4gICAgdmFyIGtleVZhbHVlQXJyYXkgPSBbXTtcblxuICAgIGtlZXBBcnJheUluZGV4ID0gISFrZWVwQXJyYXlJbmRleDtcblxuICAgIGlmICggaXNPYmplY3Qob2JqZWN0KSApIHtcbiAgICAgICAgZm9yICgga2V5IGluIG9iamVjdCApIHtcbiAgICAgICAgICAgIGlmICggaGFzT3duLmNhbGwob2JqZWN0LCBrZXkpICkge1xuICAgICAgICAgICAgICAgIGVuY29kZUtleShrZXksIG9iamVjdFtrZXldLCBrZXlWYWx1ZUFycmF5LCBrZWVwQXJyYXlJbmRleCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4ga2V5VmFsdWVBcnJheS5qb2luKCcmJyk7XG59O1xuXG5cbi8qKlxuICogRW5jb2RlIHRoZSBzcGVjZWlmZWQga2V5IGluIHRoZSBvYmplY3RcbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30ga2V5IFRoZSBrZXkgbmFtZVxuICogQHBhcmFtIHthbnl9IGRhdGEgVGhlIGRhdGEgb2YgdGhlIGtleVxuICogQHBhcmFtIHtzdHJpbmdbXX0ga2V5VmFsdWVBcnJheSBUaGUgYXJyYXkgdG8gc3RvcmUgdGhlIGtleSB2YWx1ZSBzdHJpbmdcbiAqIEBwYXJhbSB7Ym9vbGVhbn0ga2VlcEFycmF5SW5kZXggV2hldGhlciB0byBrZWVwIGFycmF5IGluZGV4XG4gKi9cbnZhciBlbmNvZGVLZXkgPSBmdW5jdGlvbiAoa2V5LCBkYXRhLCBrZXlWYWx1ZUFycmF5LCBrZWVwQXJyYXlJbmRleCkge1xuICAgIHZhciBwcm9wO1xuICAgIHZhciBpbmRleDtcbiAgICB2YXIgbGVuZ3RoO1xuICAgIHZhciB2YWx1ZTtcbiAgICB2YXIgc3ViS2V5O1xuXG4gICAgaWYgKCBpc09iamVjdChkYXRhKSApIHtcbiAgICAgICAgZm9yICggcHJvcCBpbiBkYXRhICkge1xuICAgICAgICAgICAgaWYgKCBoYXNPd24uY2FsbChkYXRhLCBwcm9wKSApIHtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IGRhdGFbcHJvcF07XG4gICAgICAgICAgICAgICAgc3ViS2V5ID0ga2V5ICsgJ1snICsgcHJvcCArICddJztcbiAgICAgICAgICAgICAgICBlbmNvZGVLZXkoc3ViS2V5LCB2YWx1ZSwga2V5VmFsdWVBcnJheSwga2VlcEFycmF5SW5kZXgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSBlbHNlIGlmICggaXNBcnJheShkYXRhKSApIHtcbiAgICAgICAgaW5kZXggPSAwO1xuICAgICAgICBsZW5ndGggPSBkYXRhLmxlbmd0aDtcblxuICAgICAgICB3aGlsZSAoaW5kZXggPCBsZW5ndGgpIHtcbiAgICAgICAgICAgIHZhbHVlID0gZGF0YVtpbmRleF07XG5cbiAgICAgICAgICAgIGlmICgga2VlcEFycmF5SW5kZXggfHwgaXNBcnJheSh2YWx1ZSkgfHwgaXNPYmplY3QodmFsdWUpICkge1xuICAgICAgICAgICAgICAgIHN1YktleSA9IGtleSArICdbJyArIGluZGV4ICsgJ10nO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzdWJLZXkgPSBrZXkgKyAnW10nO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBlbmNvZGVLZXkoc3ViS2V5LCB2YWx1ZSwga2V5VmFsdWVBcnJheSwga2VlcEFycmF5SW5kZXgpO1xuXG4gICAgICAgICAgICBpbmRleCArPSAxO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAga2V5ID0gZW5jb2RlVVJJQ29tcG9uZW50KGtleSk7XG4gICAgICAgIC8vIGlmIGRhdGEgaXMgbnVsbCwgbm8gYD1gIGlzIGFwcGVuZGVkXG4gICAgICAgIGlmIChkYXRhID09PSBudWxsKSB7XG4gICAgICAgICAgICB2YWx1ZSA9IGtleTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGlmIGRhdGEgaXMgdW5kZWZpbmVkLCB0cmVhdCBpdCBhcyBlbXB0eSBzdHJpbmdcbiAgICAgICAgICAgIGlmIChkYXRhID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBkYXRhID0gJyc7XG4gICAgICAgICAgICAvLyBtYWtlIHN1cmUgdGhhdCBkYXRhIGlzIHN0cmluZ1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgZGF0YSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICBkYXRhID0gJycgKyBkYXRhO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFsdWUgPSBrZXkgKyAnPScgKyBlbmNvZGVVUklDb21wb25lbnQoZGF0YSk7XG4gICAgICAgIH1cblxuICAgICAgICBrZXlWYWx1ZUFycmF5LnB1c2godmFsdWUpO1xuICAgIH1cbn07XG5cbmV4cG9ydHMuZW5jb2RlID0gZW5jb2RlO1xuIiwidmFyIGVuY29kZSA9IHJlcXVpcmUoNDIpLmVuY29kZTtcbnZhciBkZWNvZGUgPSByZXF1aXJlKDQxKS5kZWNvZGU7XG5cbmV4cG9ydHMuZW5jb2RlID0gZW5jb2RlO1xuZXhwb3J0cy5kZWNvZGUgPSBkZWNvZGU7XG5leHBvcnRzLnZlcnNpb24gPSAnMS4xLjInO1xuIiwidmFyIHRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcblxuLyoqXG4gKiBDaGVjayB3aGV0aGVyIHRoZSB2YXJpYWJsZSBpcyBhbiBhcnJheVxuICpcbiAqIEBwYXJhbSB7YW55fSBpdCBUaGUgdmFyaWFibGUgdG8gY2hlY2tcbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBpdCBpcyBhbiBhcnJheVxuICovXG52YXIgaXNBcnJheSA9IGZ1bmN0aW9uIChpdCkge1xuICAgIHJldHVybiAnW29iamVjdCBBcnJheV0nID09PSB0b1N0cmluZy5jYWxsKGl0KTtcbn07XG5cbi8qKlxuICogQ2hlY2sgd2hldGhlciB0aGUgdmFyaWFibGUgaXMgYW4gb2JqZWN0XG4gKlxuICogQHBhcmFtIHthbnl9IGl0IFRoZSB2YXJpYWJsZSB0byBjaGVja1xuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGl0IGlzIGFuIG9iamVjdFxuICovXG52YXIgaXNPYmplY3QgPSBmdW5jdGlvbiAoaXQpIHtcbiAgICByZXR1cm4gJ1tvYmplY3QgT2JqZWN0XScgPT09IHRvU3RyaW5nLmNhbGwoaXQpO1xufTtcblxuZXhwb3J0cy5pc0FycmF5ID0gaXNBcnJheTtcbmV4cG9ydHMuaXNPYmplY3QgPSBpc09iamVjdDtcbiJdfQ==
