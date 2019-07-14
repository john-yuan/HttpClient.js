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
var merge = require(40);
var isFunction = require(38);
var isPlainObject = require(39);
var QS = require(43);
var isAbsoluteURL = require(36);
var defineExports = require(28);
var constants = require(25);
var template = require(34);
var uuid = require(35);
var noop = require(33);
var inherits = require(32);
var createDefaultOptions = require(27);
var createCancelController = require(26);
var CancelController = require(1);
var HttpRequest = require(3);
var HttpResponse = require(4);
var HttpResponseError = require(5);
var JSONPRequest = require(6);
var JSONPResponse = require(7);
var JSONPResponseError = require(8);
var Request = require(9);
var Response = require(10);
var ResponseError = require(11);
var version = '0.0.1-alpha.3';

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
var Requeset = require(9);
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

    // Open the request.
    xhr.open(options.method || 'GET', url, true, options.username, options.password);

    // Add event listeners.
    addEventListeners(this);

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
var Requeset = require(9);
var constants = require(25);
var inherits = require(32);
var handleOptions = require(30);
var callRequestCreatedCallback = require(24);
var addEventListeners = require(18);
var buildCallbackName = require(19);
var handleScriptCors = require(21);
var buildScriptSrc = require(20);

/**
 * Represents an jsonp request.
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

    request.errorCode = code;

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
                } catch (e) {}
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
    var url = options.url + '';
    var baseURL = options.baseURL;
    var model = options.model;
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
    /**
     * @type {RequestOptions}
     */
    var options = {
        method: 'GET',
        baseURL: null,
        url: null,
        model: null,
        query: null,
        headers: null,
        body: null,
        settings: {},
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

            // Http request
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
/**
 * A simple template function
 *
 * @example
 * // Rreturns '/post/1'
 * template('/post/{ post.id }', { post: { id: 1 } })
 *
 * @param {string} template The template text.
 * @param {Object.<string, string>} data The data object.
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

    return compile(templ, start, end, function (key) {
        return read(model, key, encode);
    });
}

/**
 * Read the value (cast to string) in the `data` with the given `key`. If the key is start with `- ` (`-` and space),
 * the `- ` will be removed from the key and the value will not be urlencoded. Otherwise the value will be urlencoded.
 *
 * @param {Object.<string, *>} data The object keeps the data.
 * @param {string} key The property path to access.
 * @param {(value: string) => string} encode The function to encode the value.
 * @returns {string} Returns the value.
 */
function read(data, key, encode) {
    var first = key.charAt(0);
    var second = key.charAt(1);
    var raw = false;

    // {- raw }
    if (first === '-' && second === ' ') {
        raw = true;
        key = key.substr(2);
    }

    key = key.replace(/^\s+|\s+$/g, '');

    if (key.charAt(0) !== '[') {
        key = '.' + key;
    }

    var fn = new Function('d', 'return d' + key);
    var value = fn(data) + '';

    if (!raw) {
        value = encode(value);
    }

    return value;
}

/**
 * Compile the template.
 *
 * @param {string} template The template to compile.
 * @param {string} startTag The start tag.
 * @param {string} endTag The end tag.
 * @param {(expr: string) => string} parse The function to parse the expression.
 * @returns {string} Return the compiled string.
 */
function compile(template, startTag, endTag, parse) {
    var i = 0;
    var l = template.length;
    var sl = startTag.length;
    var el = endTag.length;
    var output = [];
    var exprbuffer = [];
    var T_STR = 1;
    var T_EXP = 2;
    var type = T_STR;

    /**
     * Get the char in `template` at the given position.
     *
     * @param {numner} [index] The index to read, if it is not set, `i` is used.
     * @returns {string} Returns the char.
     */
    var charAt = function (index) {
        return template.charAt(index || i);
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
            if (word.charAt(k) !== template.charAt(j)) return 0;
            ++k;
            ++j;
        }

        return 1;
    };

    /**
     * Flush the expr to the output and reset the expr buffer.
     */
    var flushExpr = function () {
        output.push(parse(exprbuffer.join('')));
        exprbuffer = [];
    };

    while (i < l) {
        if (type === T_STR) {
            esc(startTag, output);
            if (isWord(startTag)) {
                type = T_EXP;
                i += sl;
            } else {
                output.push(charAt(i));
                i += 1;
            }
        } else if (type === T_EXP) {
            esc(endTag, exprbuffer);
            if (isWord(endTag)) {
                type = T_STR;
                i += el;
                flushExpr();
            } else {
                exprbuffer.push(charAt(i));
                i += 1;
            }
        }
    }

    if (type === T_EXP) {
        throw new Error('unexpected end');
    }

    return output.join('');
}

/**
 * @typedef {Object.<string, *>} TemplateOptions
 * @property {string} [start] The start tag of the template, default is `{`.
 * @property {string} [end] The end tag of the template, default is `}`.
 * @property {(value: string) => string} [encode] The function to encode the value, default is `encodeURIComponent`.
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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9fYnJvd3Nlci1wYWNrQDYuMS4wQGJyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsImxpYi9jbGFzcy9DYW5jZWxDb250cm9sbGVyLmpzIiwibGliL2NsYXNzL0h0dHBDbGllbnQuanMiLCJsaWIvY2xhc3MvSHR0cFJlcXVlc3QuanMiLCJsaWIvY2xhc3MvSHR0cFJlc3BvbnNlLmpzIiwibGliL2NsYXNzL0h0dHBSZXNwb25zZUVycm9yLmpzIiwibGliL2NsYXNzL0pTT05QUmVxdWVzdC5qcyIsImxpYi9jbGFzcy9KU09OUFJlc3BvbnNlLmpzIiwibGliL2NsYXNzL0pTT05QUmVzcG9uc2VFcnJvci5qcyIsImxpYi9jbGFzcy9SZXF1ZXN0LmpzIiwibGliL2NsYXNzL1Jlc3BvbnNlLmpzIiwibGliL2NsYXNzL1Jlc3BvbnNlRXJyb3IuanMiLCJsaWIvaHR0cC9hZGRFdmVudExpc3RlbmVycy5qcyIsImxpYi9odHRwL2FkZFRpbWVvdXRMaXN0ZW5lci5qcyIsImxpYi9odHRwL2NhbGxYaHJIb29rLmpzIiwibGliL2h0dHAvaGFuZGxlSGVhZGVycy5qcyIsImxpYi9odHRwL2hhbmRsZVJlcXVlc3RCb2R5LmpzIiwibGliL2h0dHAvaGFuZGxlWGhyUHJvcHMuanMiLCJsaWIvanNvbnAvYWRkRXZlbnRMaXN0ZW5lcnMuanMiLCJsaWIvanNvbnAvYnVpbGRDYWxsYmFja05hbWUuanMiLCJsaWIvanNvbnAvYnVpbGRTY3JpcHRTcmMuanMiLCJsaWIvanNvbnAvaGFuZGxlU2NyaXB0Q29ycy5qcyIsImxpYi9zaGFyZWQvYWRkQ3VzdG9tUGFyc2VyLmpzIiwibGliL3NoYXJlZC9idWlsZFVSTC5qcyIsImxpYi9zaGFyZWQvY2FsbFJlcXVlc3RDcmVhdGVkQ2FsbGJhY2suanMiLCJsaWIvc2hhcmVkL2NvbnN0YW50cy5qcyIsImxpYi9zaGFyZWQvY3JlYXRlQ2FuY2VsQ29udHJvbGxlci5qcyIsImxpYi9zaGFyZWQvY3JlYXRlRGVmYXVsdE9wdGlvbnMuanMiLCJsaWIvc2hhcmVkL2RlZmluZUV4cG9ydHMuanMiLCJsaWIvc2hhcmVkL2ZpcmVDYWxsYmFja3MuanMiLCJsaWIvc2hhcmVkL2hhbmRsZU9wdGlvbnMuanMiLCJsaWIvc2hhcmVkL2hhc093bi5qcyIsImxpYi9zaGFyZWQvaW5oZXJpdHMuanMiLCJsaWIvc2hhcmVkL25vb3AuanMiLCJsaWIvc2hhcmVkL3RlbXBsYXRlLmpzIiwibGliL3NoYXJlZC91dWlkLmpzIiwibm9kZV9tb2R1bGVzL194LWNvbW1vbi11dGlsc0AxLjQuMEB4LWNvbW1vbi11dGlscy9pc0Fic29sdXRlVVJMLmpzIiwibm9kZV9tb2R1bGVzL194LWNvbW1vbi11dGlsc0AxLjQuMEB4LWNvbW1vbi11dGlscy9pc0FycmF5LmpzIiwibm9kZV9tb2R1bGVzL194LWNvbW1vbi11dGlsc0AxLjQuMEB4LWNvbW1vbi11dGlscy9pc0Z1bmN0aW9uLmpzIiwibm9kZV9tb2R1bGVzL194LWNvbW1vbi11dGlsc0AxLjQuMEB4LWNvbW1vbi11dGlscy9pc1BsYWluT2JqZWN0LmpzIiwibm9kZV9tb2R1bGVzL194LWNvbW1vbi11dGlsc0AxLjQuMEB4LWNvbW1vbi11dGlscy9tZXJnZS5qcyIsIm5vZGVfbW9kdWxlcy9feC1xdWVyeS1zdHJpbmdAMS4xLjJAeC1xdWVyeS1zdHJpbmcvbGliL2RlY29kZS5qcyIsIm5vZGVfbW9kdWxlcy9feC1xdWVyeS1zdHJpbmdAMS4xLjJAeC1xdWVyeS1zdHJpbmcvbGliL2VuY29kZS5qcyIsIm5vZGVfbW9kdWxlcy9feC1xdWVyeS1zdHJpbmdAMS4xLjJAeC1xdWVyeS1zdHJpbmcvbGliL3F1ZXJ5c3RyaW5nLmpzIiwibm9kZV9tb2R1bGVzL194LXF1ZXJ5LXN0cmluZ0AxLjEuMkB4LXF1ZXJ5LXN0cmluZy9saWIvdXRpbC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3Z0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3REQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNaQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2ZBO0FBQ0E7O0FDREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNiQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNiQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0dBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwidmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKDM4KTtcblxuLyoqXG4gKiBDYW5jZWwgY29udHJvbGxlciBpcyB1c2VkIHRvIGNhbmNlbCBhY3Rpb25zLiBPbmUgY29udHJvbGxlciBjYW4gYmluZCBhbnkgbnVtYmVyIG9mIGFjdGlvbnMuXG4gKlxuICogQGNsYXNzXG4gKi9cbmZ1bmN0aW9uIENhbmNlbENvbnRyb2xsZXIoKSB7XG4gICAgLyoqXG4gICAgICogQHR5cGUge2Jvb2xlYW59IFdoZXRoZXIgdGhlIGNvbnRyb2xsZXIgaXMgY2FuY2VsbGVkLlxuICAgICAqL1xuICAgIHRoaXMuY2FuY2VsbGVkID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7RnVuY3Rpb25bXX0gVGhlIGNhbGxiYWNrcyB0byBjYWxsIG9uIGNhbmNlbC5cbiAgICAgKi9cbiAgICB0aGlzLmNhbGxiYWNrcyA9IFtdO1xufVxuXG4vKipcbiAqIENhbmNlbCB0aGUgYWN0aW9ucyB0aGF0IGJpbmQgd2l0aCB0aGlzIGNhbmNlbCBjb250cm9sbGVyLlxuICovXG5DYW5jZWxDb250cm9sbGVyLnByb3RvdHlwZS5jYW5jZWwgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGNhbGxiYWNrcyA9IHRoaXMuY2FsbGJhY2tzO1xuICAgIHZhciBpID0gMDtcbiAgICB2YXIgbCA9IGNhbGxiYWNrcy5sZW5ndGg7XG5cbiAgICBpZiAodGhpcy5jYW5jZWxsZWQgPT09IGZhbHNlKSB7XG4gICAgICAgIHRoaXMuY2FuY2VsbGVkID0gdHJ1ZTtcblxuICAgICAgICBmb3IgKCA7IGkgPCBsOyBpICs9IDEpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2tzW2ldKCk7XG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgLy8gVGhyb3cgdGhlIGVycm9yIGxhdGVyIGZvciBkZWJ1Z2luZy5cbiAgICAgICAgICAgICAgICAoZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KShlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn07XG5cbi8qKlxuICogQ2hlY2sgd2hldGhlciB0aGUgY29udHJvbGxlciBpcyBjYW5jZWxsZWQuXG4gKlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSBjb250cm9sbGVyIGlzIGNhbmNlbGxlZCwgb3RoZXJ3aXNlIGBmYWxzZWAgaXMgcmV0dXJuZWQuXG4gKi9cbkNhbmNlbENvbnRyb2xsZXIucHJvdG90eXBlLmlzQ2FuY2VsbGVkID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLmNhbmNlbGxlZDtcbn07XG5cbi8qKlxuICogUmVnaXN0ZXIgYSBjYWxsYmFjaywgd2hpY2ggd2lsbCBiZSBjYWxsZWQgd2hlbiB0aGUgYGNhbmNlbCgpYCBtZXRob2QgaXMgY2FsbGVkLlxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIFRoZSBjYWxsYmFjayBmdW5jdGlvbiB0byBjYWxsIG9uIGNhbmNlbC5cbiAqL1xuQ2FuY2VsQ29udHJvbGxlci5wcm90b3R5cGUucmVnaXN0ZXJDYW5jZWxDYWxsYmFjayA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgIGlmIChpc0Z1bmN0aW9uKGNhbGxiYWNrKSkge1xuICAgICAgICB0aGlzLmNhbGxiYWNrcy5wdXNoKGNhbGxiYWNrKTtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IENhbmNlbENvbnRyb2xsZXI7XG4iLCJ2YXIgbWVyZ2UgPSByZXF1aXJlKDQwKTtcbnZhciBpc0Z1bmN0aW9uID0gcmVxdWlyZSgzOCk7XG52YXIgaXNQbGFpbk9iamVjdCA9IHJlcXVpcmUoMzkpO1xudmFyIFFTID0gcmVxdWlyZSg0Myk7XG52YXIgaXNBYnNvbHV0ZVVSTCA9IHJlcXVpcmUoMzYpO1xudmFyIGRlZmluZUV4cG9ydHMgPSByZXF1aXJlKDI4KTtcbnZhciBjb25zdGFudHMgPSByZXF1aXJlKDI1KTtcbnZhciB0ZW1wbGF0ZSA9IHJlcXVpcmUoMzQpO1xudmFyIHV1aWQgPSByZXF1aXJlKDM1KTtcbnZhciBub29wID0gcmVxdWlyZSgzMyk7XG52YXIgaW5oZXJpdHMgPSByZXF1aXJlKDMyKTtcbnZhciBjcmVhdGVEZWZhdWx0T3B0aW9ucyA9IHJlcXVpcmUoMjcpO1xudmFyIGNyZWF0ZUNhbmNlbENvbnRyb2xsZXIgPSByZXF1aXJlKDI2KTtcbnZhciBDYW5jZWxDb250cm9sbGVyID0gcmVxdWlyZSgxKTtcbnZhciBIdHRwUmVxdWVzdCA9IHJlcXVpcmUoMyk7XG52YXIgSHR0cFJlc3BvbnNlID0gcmVxdWlyZSg0KTtcbnZhciBIdHRwUmVzcG9uc2VFcnJvciA9IHJlcXVpcmUoNSk7XG52YXIgSlNPTlBSZXF1ZXN0ID0gcmVxdWlyZSg2KTtcbnZhciBKU09OUFJlc3BvbnNlID0gcmVxdWlyZSg3KTtcbnZhciBKU09OUFJlc3BvbnNlRXJyb3IgPSByZXF1aXJlKDgpO1xudmFyIFJlcXVlc3QgPSByZXF1aXJlKDkpO1xudmFyIFJlc3BvbnNlID0gcmVxdWlyZSgxMCk7XG52YXIgUmVzcG9uc2VFcnJvciA9IHJlcXVpcmUoMTEpO1xudmFyIHZlcnNpb24gPSAnMC4wLjEtYWxwaGEuMyc7XG5cbi8qKlxuICogQGNsYXNzXG4gKlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gW2RlZmF1bHRzXSBUaGUgZGVmYXVsdCBvcHRpb25zIHRvIHVzZSB3aGVuIHNlbmRpbmcgcmVxdWVzdHMgd2l0aCB0aGUgY3JlYXRlZCBodHRwIGNsaWVudC5cbiAqIFRoaXMgZGVmYXVsdCBvcHRpb25zIHdpbGwgYmUgbWVyZ2VkIGludG8gdGhlIGludGVybmFsIGRlZmF1bHQgb3B0aW9ucyB0aGF0IGBjcmVhdGVEZWZhdWx0T3B0aW9ucygpYCByZXR1cm5zLlxuICpcbiAqIEBwYXJhbSB7SGFuZGxlT3B0aW9uc0Z1bmN0aW9ufSBbaGFuZGxlRGVmYXVsdHNdIFRoZSBoYW5kbGVyIGZ1bmN0aW9uIHRvIHByb2Nlc3MgdGhlIG1lcmdlZCBkZWZhdWx0IG9wdGlvbnMuIFRoZVxuICogbWVyZ2VkIGRlZmF1bHQgb3B0aW9ucyB3aWxsIGJlIHBhc3NlZCBpbnRvIHRoZSBmdW5jdGlvbiBhcyB0aGUgZmlyc3QgYXJndW1lbnQuIFlvdSBjYW4gbWFrZSBjaGFuZ2VzIHRvIGl0IGFzIHlvdVxuICogd2FudC4gVGhpcyBmdW5jdGlvbiBtdXN0IHJldHVybiBzeW5jaHJvbm91c2x5LiBUaGUgcmV0dXJuIHZhbHVlIG9mIHRoaXMgZnVuY3Rpb24gaXMgaWdub3JlZC5cbiAqXG4gKiBAcGFyYW0ge0hhbmRsZU9wdGlvbnNGdW5jdGlvbn0gW2hhbmRsZVJlcXVlc3RPcHRpb25zXSBUaGUgaGFuZGxlciBmdW5jdGlvbiB0byBwcm9jZXNzIGVhY2ggbWVyZ2VkIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEV2ZXJ5IG9wdGlvbnMgdGhhdCBwYXNzZWQgaW50byBgc2VuZGAsIGBmZXRjaGAsIGBnZXRKU09OUGAsIGBmZXRjaEpTT05QYCB3aWxsIGJlIHByb2Nlc3NlZCBieSB0aGlzIGhhbmRsZXIgZnVuY3Rpb24uXG4gKi9cbmZ1bmN0aW9uIEh0dHBDbGllbnQoZGVmYXVsdHMsIGhhbmRsZURlZmF1bHRzLCBoYW5kbGVSZXF1ZXN0T3B0aW9ucykge1xuICAgIHZhciBkZWZhdWx0T3B0aW9ucyA9IGNyZWF0ZURlZmF1bHRPcHRpb25zKCk7XG5cbiAgICBpZiAoaXNQbGFpbk9iamVjdChkZWZhdWx0cykpIHtcbiAgICAgICAgbWVyZ2UoZGVmYXVsdE9wdGlvbnMsIGRlZmF1bHRzKTtcbiAgICB9XG5cbiAgICBpZiAoaXNGdW5jdGlvbihoYW5kbGVEZWZhdWx0cykpIHtcbiAgICAgICAgaGFuZGxlRGVmYXVsdHMoZGVmYXVsdE9wdGlvbnMpO1xuICAgICAgICAvLyBEZWVwIGNvcHkgdGhlIGNoYWduZWQgb3B0aW9uc1xuICAgICAgICBkZWZhdWx0T3B0aW9ucyA9IG1lcmdlKHt9LCBkZWZhdWx0T3B0aW9ucyk7XG4gICAgfVxuXG4gICAgaWYgKCFpc0Z1bmN0aW9uKGhhbmRsZVJlcXVlc3RPcHRpb25zKSkge1xuICAgICAgICBoYW5kbGVSZXF1ZXN0T3B0aW9ucyA9IG5vb3A7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IGEgY29weSBvZiB0aGUgZGVmYXVsdCByZXF1ZXN0IG9wdGlvbnMuIFRoaXMgZnVuY3Rpb24gaXMgTk9UIGF2YWlsYWJsZSBvbiB0aGUgcHJvdG90eXBlIG9mIGBIdHRwQ2xpZW50YC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtSZXF1ZXN0T3B0aW9uc31cbiAgICAgKi9cbiAgICB0aGlzLmNvcHlPcHRpb25zID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gbWVyZ2Uoe30sIGRlZmF1bHRPcHRpb25zKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogTWVyZ2UgdGhlIHJlcXVlc3Qgb3B0aW9ucyB3aXRoIHRoZSBkZWZhdWx0IHJlcXVlc3Qgb3B0aW9ucy4gVGhpcyBmdW5jdGlvbiBpcyBOT1QgYXZhaWxhYmxlIG9uIHRoZSBwcm90b3R5cGUgb2ZcbiAgICAgKiBgSHR0cENsaWVudGAgYW5kIHdpbGwgY2FsbCBgaGFuZGxlUmVxdWVzdE9wdGlvbnNgIHRvIGhhbmRsZSB0aGUgbWVyZ2VkIHJlcXVlc3Qgb3B0aW9ucy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucyB0byBtZXJnZS5cbiAgICAgKiBAcmV0dXJucyB7UmVxdWVzdE9wdGlvbnN9IFJldHVybnMgdGhlIG1lcmdlZCByZXF1ZXN0IG9wdGlvbnMuXG4gICAgICovXG4gICAgdGhpcy5tZXJnZU9wdGlvbnMgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICB2YXIgcmVxdWVzdE9wdGlvbnMgPSBtZXJnZSh7fSwgZGVmYXVsdE9wdGlvbnMsIG9wdGlvbnMpO1xuXG4gICAgICAgIGhhbmRsZVJlcXVlc3RPcHRpb25zKHJlcXVlc3RPcHRpb25zKTtcblxuICAgICAgICByZXR1cm4gcmVxdWVzdE9wdGlvbnM7XG4gICAgfTtcbn1cblxuLyoqXG4gKiBTZW5kIGFuIGh0dHAgcmVxdWVzdC5cbiAqXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMgdG8gdXNlLCB3aGljaCB3aWxsIGJlIG1lcmdlZCBpbnRvIGEgY29weSBvZiB0aGUgZGVmYXVsdCBvcHRpb25zLlxuICogQHBhcmFtIHtSZXF1ZXN0U3VjY2Vzc0NhbGxiYWNrfSBvbnN1Y2Nlc3MgVGhlIGNhbGxiYWNrIHRvIGNhbGwgb24gc3VjY2Vzcy5cbiAqIEBwYXJhbSB7UmVxdWVzdEVycm9yQ2FsbGJhY2t9IG9uZXJyb3IgVGhlIGNhbGxiYWNrIHRvIGNhbGwgb24gZXJyb3IuXG4gKiBAcmV0dXJucyB7SHR0cFJlcXVlc3R9IFJldHVybnMgYW4gaW5zdGFuY2Ugb2YgYEh0dHBSZXF1ZXN0YC5cbiAqL1xuSHR0cENsaWVudC5wcm90b3R5cGUuc2VuZCA9IGZ1bmN0aW9uIChvcHRpb25zLCBvbnN1Y2Nlc3MsIG9uZXJyb3IpIHtcbiAgICB2YXIgcmVxdWVzdE9wdGlvbnMgPSB0aGlzLm1lcmdlT3B0aW9ucyhvcHRpb25zKTtcblxuICAgIHJlcXVlc3RPcHRpb25zLnJlcXVlc3RGdW5jdGlvbk5hbWUgPSAnc2VuZCc7XG4gICAgcmVxdWVzdE9wdGlvbnMuY29udHJvbGxlciA9IG51bGw7XG5cbiAgICByZXR1cm4gbmV3IEh0dHBSZXF1ZXN0KHJlcXVlc3RPcHRpb25zLCBvbnN1Y2Nlc3MsIG9uZXJyb3IpO1xufTtcblxuLyoqXG4gKiBTZW5kIGFuIGh0dHAgcmVxdWVzdCBhbmQgcmV0dXJuIGEgcHJvbWlzZS5cbiAqXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMgdG8gdXNlLCB3aGljaCB3aWxsIGJlIG1lcmdlZCBpbnRvIGEgY29weSBvZiB0aGUgZGVmYXVsdCBvcHRpb25zLlxuICogQHJldHVybnMge1Byb21pc2V9IFJldHVybnMgYW4gaW5zdGFuY2Ugb2YgYFByb21pc2VgLlxuICovXG5IdHRwQ2xpZW50LnByb3RvdHlwZS5mZXRjaCA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgdmFyIHJlcXVlc3RPcHRpb25zID0gdGhpcy5tZXJnZU9wdGlvbnMob3B0aW9ucyk7XG4gICAgdmFyIGNvbnRyb2xsZXIgPSByZXF1ZXN0T3B0aW9ucy5jb250cm9sbGVyO1xuXG4gICAgcmVxdWVzdE9wdGlvbnMucmVxdWVzdEZ1bmN0aW9uTmFtZSA9ICdmZXRjaCc7XG5cbiAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICB2YXIgcmVxdWVzdCA9IG5ldyBIdHRwUmVxdWVzdChyZXF1ZXN0T3B0aW9ucywgZnVuY3Rpb24gKHJlc3BvbnNlKSB7XG4gICAgICAgICAgICBpZiAoY29udHJvbGxlcikge1xuICAgICAgICAgICAgICAgIGlmICghY29udHJvbGxlci5pc0NhbmNlbGxlZCgpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUocmVzcG9uc2UpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShyZXNwb25zZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sIHJlamVjdCk7XG5cbiAgICAgICAgaWYgKGNvbnRyb2xsZXIpIHtcbiAgICAgICAgICAgIC8vIFRyaWdnZXIgdGhlIGBFUlJfQ0FOQ0VMTEVEYCBlcnJvci5cbiAgICAgICAgICAgIGlmIChjb250cm9sbGVyLmlzQ2FuY2VsbGVkKCkpIHtcbiAgICAgICAgICAgICAgICByZXF1ZXN0LmNhbmNlbCgpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb250cm9sbGVyLnJlZ2lzdGVyQ2FuY2VsQ2FsbGJhY2soZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICByZXF1ZXN0LmNhbmNlbCgpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG59O1xuXG4vKipcbiAqIFNlbmQgYSBqc29ucCByZXF1ZXN0LlxuICpcbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucyB0byB1c2UsIHdoaWNoIHdpbGwgYmUgbWVyZ2VkIGludG8gYSBjb3B5IG9mIHRoZSBkZWZhdWx0IG9wdGlvbnMuXG4gKiBAcGFyYW0ge1JlcXVlc3RTdWNjZXNzQ2FsbGJhY2t9IG9uc3VjY2VzcyBUaGUgY2FsbGJhY2sgdG8gY2FsbCBvbiBzdWNjZXNzLlxuICogQHBhcmFtIHtSZXF1ZXN0RXJyb3JDYWxsYmFja30gb25lcnJvciBUaGUgY2FsbGJhY2sgdG8gY2FsbCBvbiBlcnJvci5cbiAqIEByZXR1cm5zIHtKU09OUFJlcXVlc3R9IFJldHVybnMgYW4gaW5zdGFuY2Ugb2YgYEpTT05QUmVxdWVzdGAuXG4gKi9cbkh0dHBDbGllbnQucHJvdG90eXBlLmdldEpTT05QID0gZnVuY3Rpb24gKG9wdGlvbnMsIG9uc3VjY2Vzcywgb25lcnJvcikge1xuICAgIHZhciByZXF1ZXN0T3B0aW9ucyA9IHRoaXMubWVyZ2VPcHRpb25zKG9wdGlvbnMpO1xuXG4gICAgcmVxdWVzdE9wdGlvbnMucmVxdWVzdEZ1bmN0aW9uTmFtZSA9ICdnZXRKU09OUCc7XG4gICAgcmVxdWVzdE9wdGlvbnMuY29udHJvbGxlciA9IG51bGw7XG5cbiAgICByZXR1cm4gbmV3IEpTT05QUmVxdWVzdChyZXF1ZXN0T3B0aW9ucywgb25zdWNjZXNzLCBvbmVycm9yKTtcbn07XG5cbi8qKlxuICogU2VuZCBhIGpzb25wIHJlcXVlc3QgYW5kIHJldHVybiBhIHByb21pc2UuXG4gKlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zIHRvIHVzZSwgd2hpY2ggd2lsbCBiZSBtZXJnZWQgaW50byBhIGNvcHkgb2YgdGhlIGRlZmF1bHQgb3B0aW9ucy5cbiAqIEByZXR1cm5zIHtQcm9taXNlfSBSZXR1cm5zIGFuIGluc3RhbmNlIG9mIGBQcm9taXNlYC5cbiAqL1xuSHR0cENsaWVudC5wcm90b3R5cGUuZmV0Y2hKU09OUCA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgdmFyIHJlcXVlc3RPcHRpb25zID0gdGhpcy5tZXJnZU9wdGlvbnMob3B0aW9ucyk7XG4gICAgdmFyIGNvbnRyb2xsZXIgPSByZXF1ZXN0T3B0aW9ucy5jb250cm9sbGVyO1xuXG4gICAgcmVxdWVzdE9wdGlvbnMucmVxdWVzdEZ1bmN0aW9uTmFtZSA9ICdmZXRjaEpTT05QJztcblxuICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgIHZhciByZXF1ZXN0ID0gbmV3IEpTT05QUmVxdWVzdChyZXF1ZXN0T3B0aW9ucywgZnVuY3Rpb24gKHJlc3BvbnNlKSB7XG4gICAgICAgICAgICBpZiAoY29udHJvbGxlcikge1xuICAgICAgICAgICAgICAgIGlmICghY29udHJvbGxlci5pc0NhbmNlbGxlZCgpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUocmVzcG9uc2UpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShyZXNwb25zZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sIHJlamVjdCk7XG5cbiAgICAgICAgaWYgKGNvbnRyb2xsZXIpIHtcbiAgICAgICAgICAgIC8vIFRyaWdnZXIgdGhlIGBFUlJfQ0FOQ0VMTEVEYCBlcnJvci5cbiAgICAgICAgICAgIGlmIChjb250cm9sbGVyLmlzQ2FuY2VsbGVkKCkpIHtcbiAgICAgICAgICAgICAgICByZXF1ZXN0LmNhbmNlbCgpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb250cm9sbGVyLnJlZ2lzdGVyQ2FuY2VsQ2FsbGJhY2soZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICByZXF1ZXN0LmNhbmNlbCgpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG59O1xuXG4vKipcbiAqIENyZWF0ZSBhIG5ldyBpbnN0YW5jZSBvZiBgQ2FuY2VsQ29udHJvbGxlcmAuXG4gKlxuICogQHJldHVybnMge0NhbmNlbENvbnRyb2xsZXJ9IFJldHVybnMgYW4gbmV3IGluc3RhbmNlIG9mIGBDYW5jZWxDb250cm9sbGVyYC5cbiAqL1xuSHR0cENsaWVudC5wcm90b3R5cGUuY3JlYXRlQ2FuY2VsQ29udHJvbGxlciA9IGNyZWF0ZUNhbmNlbENvbnRyb2xsZXI7XG5cbi8qKlxuICogQ3JlYXRlIGEgbmV3IGluc3RhbmNlIG9mIGBDYW5jZWxDb250cm9sbGVyYC5cbiAqXG4gKiBAcmV0dXJucyB7Q2FuY2VsQ29udHJvbGxlcn0gUmV0dXJucyBhbiBuZXcgaW5zdGFuY2Ugb2YgYENhbmNlbENvbnRyb2xsZXJgLlxuICovXG5IdHRwQ2xpZW50LmNyZWF0ZUNhbmNlbENvbnRyb2xsZXIgPSBjcmVhdGVDYW5jZWxDb250cm9sbGVyO1xuXG4vLyBUaGUgdmVyc2lvbi5cbkh0dHBDbGllbnQudmVyc2lvbiA9IHZlcnNpb247XG5IdHRwQ2xpZW50LnByb3RvdHlwZS52ZXJzaW9uID0gdmVyc2lvbjtcblxuZGVmaW5lRXhwb3J0cyhIdHRwQ2xpZW50LCAnY29uc3RhbnRzJywgbWVyZ2Uoe30sIGNvbnN0YW50cykpO1xuXG5kZWZpbmVFeHBvcnRzKEh0dHBDbGllbnQsICdsaWJzJywge1xuICAgIFFTOiBRU1xufSk7XG5cbmRlZmluZUV4cG9ydHMoSHR0cENsaWVudCwgJ2NsYXNzZXMnLCB7XG4gICAgQ2FuY2VsQ29udHJvbGxlcjogQ2FuY2VsQ29udHJvbGxlcixcbiAgICBIdHRwQ2xpZW50OiBIdHRwQ2xpZW50LFxuICAgIEh0dHBSZXF1ZXN0OiBIdHRwUmVxdWVzdCxcbiAgICBIdHRwUmVzcG9uc2U6IEh0dHBSZXNwb25zZSxcbiAgICBIdHRwUmVzcG9uc2VFcnJvcjogSHR0cFJlc3BvbnNlRXJyb3IsXG4gICAgSlNPTlBSZXF1ZXN0OiBKU09OUFJlcXVlc3QsXG4gICAgSlNPTlBSZXNwb25zZTogSlNPTlBSZXNwb25zZSxcbiAgICBKU09OUFJlc3BvbnNlRXJyb3I6IEpTT05QUmVzcG9uc2VFcnJvcixcbiAgICBSZXF1ZXN0OiBSZXF1ZXN0LFxuICAgIFJlc3BvbnNlOiBSZXNwb25zZSxcbiAgICBSZXNwb25zZUVycm9yOiBSZXNwb25zZUVycm9yXG59KTtcblxuZGVmaW5lRXhwb3J0cyhIdHRwQ2xpZW50LCAnZnVuY3Rpb25zJywge1xuICAgIHRlbXBsYXRlOiB0ZW1wbGF0ZSxcbiAgICBtZXJnZTogbWVyZ2UsXG4gICAgaXNBYnNvbHV0ZVVSTDogaXNBYnNvbHV0ZVVSTCxcbiAgICBpc0Z1bmN0aW9uOiBpc0Z1bmN0aW9uLFxuICAgIGlzUGxhaW5PYmplY3Q6IGlzUGxhaW5PYmplY3QsXG4gICAgdXVpZDogdXVpZCxcbiAgICBub29wOiBub29wLFxuICAgIGluaGVyaXRzOiBpbmhlcml0cyxcbiAgICBjcmVhdGVEZWZhdWx0T3B0aW9uczogY3JlYXRlRGVmYXVsdE9wdGlvbnNcbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEh0dHBDbGllbnQ7XG5cbi8qKlxuICogVGhpcyBjYWxsYmFjayBpcyB1c2VkIHRvIGhhbmxkZSB0aGUgbWVyZ2VkIHJlcXVlc3Qgb3B0aW9ucy4gSXQgbXVzdCByZXRydW4gdGhlIHJlc3VsdCBzeW5jaHJvbm91c2x5LlxuICpcbiAqIEBjYWxsYmFjayBIYW5kbGVPcHRpb25zRnVuY3Rpb25cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIG1lcmdlZCByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcmV0dXJucyB7dm9pZH1cbiAqL1xuXG4vKipcbiAqIFRoZSBjYWxsYmFjayB0byBjYWxsIG9uIHN1Y2Nlc3MuXG4gKlxuICogQGNhbGxiYWNrIFJlcXVlc3RTdWNjZXNzQ2FsbGJhY2tcbiAqIEBwYXJhbSB7SHR0cFJlc3BvbnNlfGFueX0gcmVzcG9uc2UgVGhlIGh0dHAgcmVzcG9uc2Ugb3IgdGhlIHJldHVybiB2YWx1ZSBvZiBgb3B0aW9ucy50cmFuc2Zvcm1SZXNwb25zZShyZXNwb25zZSlgLlxuICovXG5cbi8qKlxuICogVGhlIGNhbGxiYWNrIHRvIGNhbGwgb24gZXJyb3IuXG4gKlxuICogQGNhbGxiYWNrIFJlcXVlc3RFcnJvckNhbGxiYWNrXG4gKiBAcGFyYW0ge0h0dHBSZXNwb25zZUVycm9yfGFueX0gZXJyb3IgVGhlIGh0dHAgcmVzcG9uc2UgZXJyb3Igb3IgdGhlIHJldHVybiB2YWx1ZSBvZiBgb3B0aW9ucy50cmFuc2Zvcm1FcnJvcihlcnJvcilgLlxuICovXG5cbi8qKlxuICogVGhlIGRlZmluaXRvbiBvZiB0aGUgcmVxdWVzdCBvcHRpb25zLlxuICpcbiAqIEB0eXBlZGVmIHtPYmplY3QuPHN0cmluZywgKj59IFJlcXVlc3RPcHRpb25zXG4gKlxuICogQHByb3BlcnR5IHtzdHJpbmd9IFttZXRob2RdIFRoZSBodHRwIHJlcXVlc3QgbWV0aG9kLiBUaGUgZGVmYXVsdCBtZXRob2QgaXMgYEdFVGAuXG4gKlxuICogQHByb3BlcnR5IHtzdHJpbmd9IFtiYXNlVVJMXSBUaGUgcmVxdWVzdCBiYXNlIHVybC4gSWYgdGhlIGB1cmxgIGlzIHJlbGF0aXZlIHVybCwgYW5kIHRoZSBgYmFzZVVSTGAgaXMgbm90IGBudWxsYCwgdGhlXG4gKiBgYmFzZVVSTGAgd2lsbCBiZSBwcmVwZW5kIHRvIHRoZSBgdXJsYC5cbiAqXG4gKiBAcHJvcGVydHkge3N0cmluZ30gdXJsIFRoZSByZXF1ZXN0IHVybCB0aGF0IGNhbiBjb250YWluIGFueSBudW1iZXIgb2YgcGxhY2Vob2xkZXJzLCBhbmQgd2lsbCBiZSBjb21waWxlZCB3aXRoIHRoZVxuICogZGF0YSB0aGF0IHBhc3NlZCBpbiB3aXRoIGBvcHRpb25zLm1vZGVsYC5cbiAqXG4gKiBAcHJvcGVydHkge09iamVjdC48c3RyaW5nLCAqPn0gW21vZGVsXSBUaGUgZGF0YSB1c2VkIHRvIGNvbXBpbGUgdGhlIHJlcXVlc3QgdXJsLlxuICpcbiAqIEBwcm9wZXJ0eSB7T2JqZWN0LjxzdHJpbmcsICo+fSBbcXVlcnldIFRoZSBkYXRhIHRoYXQgd2lsbCBiZSBjb21waWxlZCB0byBxdWVyeSBzdHJpbmcuXG4gKlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgKj59IFtib2R5XSBUaGUgb2JqZWN0IHRoYXQgY29udGFpbnMgdGhlIGNvbnRlbnQgd2hpY2ggd2lsbCBiZSBzZW5kIHRvIHRoZSBzZXJ2ZXIuIFRoaXNcbiAqIG9iamVjdCBoYXMgb25seSBvbmUgcHJvcGVydHkuIFRoZSBuYW1lIG9mIHRoZSBwcm9wZXJ0eSBpcyB0aGUgY29udGVudCB0eXBlIG9mIHRoZSBjb250ZW50LCB3aGljaCB3aWxsIGJlIHVzZWQgdG8gZmluZFxuICogYSBwcm9jZXNzb3IgaW4gYG9wdGlvbnMuaHR0cFJlcXVlc3RCb2R5UHJvY2Vzc29yYC4gVGhlIHByb2Nlc3NvciBpcyB1c2VkIHRvIHByb2Nlc3MgdGhlIHZhbHVlIG9mIHRoZSBwcm9wZXJ0eS4gVGhlXG4gKiBwcm9jZXNzZWQgdmFsdWUgd2hpY2ggdGhlIHByb2Nlc3NvciByZXR1cm5zIHdpbGwgYmUgc2VuZCB0byB0aGUgc2VydmVyIGFzIHRoZSByZXF1ZXN0IGJvZHkuXG4gKlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgKj59IFtzZXR0aW5nc10gVGhlIG9iamVjdCB0byBrZWVwIHRoZSBzZXR0aW5ncyBpbmZvcm1hdGlvbiB0aGF0IHRoZSB1c2VyIHBhc3NlZCBpbi4gVGhlXG4gKiBsaWJyYXJ5IGl0c2VsZiB3aWxsIG5vdCB0b3VjaCB0aGlzIHByb3BlcnR5LiBZb3UgY2FuIHVzZSB0aGlzIHByb3BlcnR5IHRvIGhvbGQgYW55IGluZm9ybWF0aW9uIHRoYXQgeW91IHdhbnQsIHdoZW5cbiAqIHlvdSBleHRlbmQgdGhlIGZ1bmN0aW9uYWxpdHkgb2YgeW91ciBvd24gaW5zdGFuY2Ugb2YgYEh0dHBDbGllbnRgLiBUaGUgZGVmYXVsdCB2YWx1ZSBvZiB0aGlzIHByb3BlcnR5IGlzIGFuIGVtcHR5XG4gKiBvYmplY3QuXG4gKlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgKj59IFtoZWFkZXJzXSBUaGUgb2JqZWN0IHRoYXQgY29udGFpbnMgdGhlIGhlYWRlcnMgdG8gc2V0IHdoZW4gc2VuZGluZyB0aGUgcmVxdWVzdC4gT25seVxuICogdGhlIG5vbi11bmRlZmluZWQgYW5kIG5vbi1udWxsIGhlYWRlcnMgYXJlIHNldC5cbiAqXG4gKiBAcHJvcGVydHkge0NhbmNlbENvbnRyb2xsZXJ9IFtjb250cm9sbGVyXSBUaGUgYENhbmNlbENvbnRyb2xsZXJgIHVzZWQgdG8gY2FuY2VsIHRoZSByZXF1ZXN0LiBJdCBvbmx5IHdvcmtzIHdoZW4gdXNpbmdcbiAqIGBmZXRjaGAgb3IgYGZldGNoSlNPTlBgIHRvIHNlbmQgcmVxdWVzdC4gSWYgdGhlIHlvdSBzZW5kIHJlcXVlc3QgdXNpbmcgYHNlbmRgIG9yIGBnZXRKU09OUGAsIHRoZSBgb3B0aW9ucy5jb250cm9sbGVyYFxuICogd2lsbCBiZSBzZXQgdG8gYG51bGxgLlxuICpcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbcmVxdWVzdEZ1bmN0aW9uTmFtZV0gVGhlIG5hbWUgb2YgdGhlIGZ1bmN0aW9uIHRoYXQgc2VuZCB0aGUgcmVxdWVzdC4gQ2FuIGJlIGBzZW5kYCwgYGZldGNoYCxcbiAqIGBnZXRKU09OUGAsIGBmZXRjaEpTT05QYC4gVGhpcyB2YWx1ZSBpcyBzZXQgYnkgdGhlIGxpYnJhcnksIGRvbid0IGNoYW5nZSBpdC5cbiAqXG4gKiBAcHJvcGVydHkge3N0cmluZ30gW3JlcXVlc3RUeXBlXSBUaGUgcmVxdWVzdCB0eXBlIG9mIHRoaXMgcmVxdWVzdC4gVGhlIHZhbHVlIG9mIGl0IGlzIHNldCBieSB0aGUgbGlicmFyeSBpdHNlbGYsIGNhblxuICogYmUgYEhUVFBfUkVRVUVTVGAgb3IgYEpTT05QX1JFUVVFU1RgLiBBbnkgb3RoZXIgdmFsdWUgdGhlIHVzZXIgcGFzc2VkIGluIGlzIGlnbm9yZWQuIFlvdSBjYW4gdXNlIHRoaXMgcHJvcGVydHkgdG8gZ2V0XG4gKiB0aGUgdHlwZSBvZiB0aGUgY3VycmVudCByZXF1ZXN0LlxuICpcbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gW2NvcnNdIFdoZXRoZXIgdG8gc2V0IGB3aXRoQ3JlZGVudGlhbHNgIHByb3BlcnR5IG9mIHRoZSBgWE1MSHR0cFJlcXVlc3RgIHRvIGB0cnVlYC4gVGhlIGRlZmF1bHRcbiAqIHZhbHVlIGlzIGBmYWxzZWAuXG4gKlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgKj59IFt4aHJQcm9wc10gVGhlIG9iamVjdCB0aGF0IGNvbnRhaW5zIHRoZSBwcm9wZXJ0aWVzIHRvIHNldCBvbiB0aGUgaW5zdGFuY2Ugb2YgdGhlXG4gKiBgWE1MSHR0cFJlcXVlc3RgLlxuICpcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbdXNlcm5hbWVdIFRoZSB1c2VyIG5hbWUgdG8gdXNlIGZvciBhdXRoZW50aWNhdGlvbiBwdXJwb3Nlcy4gVGhlIGRlZnVhbHQgdmFsdWUgaXMgYG51bGxgLlxuICpcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbcGFzc3dvcmRdIFRoZSBwYXNzd29yZCB0byB1c2UgZm9yIGF1dGhlbnRpY2F0aW9uIHB1cnBvc2VzLiBUaGUgZGVmdWFsdCB2YWx1ZSBpcyBgbnVsbGAuXG4gKlxuICogQHByb3BlcnR5IHtudW1iZXJ9IFt0aW1lb3V0XSBUaGUgbnVtYmVyIG9mIG1pbGxpc2Vjb25kcyB0aGUgcmVxdWVzdCBjYW4gdGFrZSBiZWZvcmUgaXQgZmluaXNoZWQuIElmIHRoZSB0aW1lb3V0IHZhbHVlXG4gKiBpcyBgMGAsIG5vIHRpbWVyIHdpbGwgYmUgc2V0LiBJZiB0aGUgcmVxdWVzdCBkb2VzIG5vdCBmaW5zaWhlZCB3aXRoaW4gdGhlIGdpdmVuIHRpbWUsIGEgdGltZW91dCBlcnJvciB3aWxsIGJlIHRocm93bi5cbiAqIFRoZSBkZWZhdWx0IHZhbHVlIGlzIGAwYC5cbiAqXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IFtub0NhY2hlXSBXaGV0aGVyIHRvIGRpc2FibGUgdGhlIGNhY2hlLiBJZiB0aGUgdmFsdWUgaXMgYHRydWVgLCB0aGUgaGVhZGVycyBpblxuICogYG9wdGlvbnMubm9DYWNoZUhlYWRlcnNgIHdpbGwgYmUgc2V0LiBUaGUgZGVmYXVsdCB2YWx1ZSBpcyBgZmFsc2VgLlxuICpcbiAqIEBwcm9wZXJ0eSB7T2JqZWN0LjxzdHJpbmcsICo+fSBbbm9DYWNoZUhlYWRlcnNdIFRoZSBoZWFkZXJzIHRvIHNldCB3aGVuIGBvcHRpb25zLm5vQ2FjaGVgIGlzIHNldCB0byBgdHJ1ZWAuXG4gKlxuICogQHByb3BlcnR5IHtzdHJpbmd9IFtqc29ucF0gVGhlIHF1ZXJ5IHN0cmluZyBrZXkgdG8gaG9sZCB0aGUgdmFsdWUgb2YgdGhlIGNhbGxiYWNrIG5hbWUgd2hlbiBzZW5kaW5nIEpTT05QIHJlcXVlc3QuXG4gKiBUaGUgZGVmYXVsdCB2YWx1ZXMgaXMgYGNhbGxiYWNrYC5cbiAqXG4gKiBAcHJvcGVydHkge09iamVjdC48c3RyaW5nLCBodHRwUmVxdWVzdEJvZHlQcm9jZXNzb3I+fSBbaHR0cFJlcXVlc3RCb2R5UHJvY2Vzc29yXSBUaGUgb2JqZWN0IHRoYXQgY29udGFpbnMgdGhlXG4gKiBodHRwIHJlcXVlc3QgYm9keSBwcm9jZXNzb3JzLlxuICpcbiAqIEBwcm9wZXJ0eSB7T2JqZWN0LjxzdHJpbmcsIFJlc3BvbnNlUGFyc2VGdW5jdGlvbj59IFtodHRwUmVzcG9uc2VQYXJzZXJdIFRoZSBvYmplY3QgdGhhdCBjb250YWlucyB0aGUgaHR0cCByZXNwb25zZVxuICogcGFyc2Vycy5cbiAqXG4gKiBAcHJvcGVydHkge09iamVjdC48c3RyaW5nLCBSZXNwb25zZVBhcnNlRnVuY3Rpb24+fSBbanNvbnBSZXNwb25zZVBhcnNlcl0gVGhlIG9iamVjdCB0aGF0IGNvbnRhaW5zIHRoZSBqc29ucCByZXNwb25zZVxuICogcGFyc2Vycy5cbiAqXG4gKiBAcHJvcGVydHkge09iamVjdC48c3RyaW5nLCBSZXNwb25zZUVycm9yUGFyc2VGdW5jdGlvbj59IFtodHRwUmVzcG9uc2VFcnJvclBhcnNlcl0gVGhlIG9iamVjdCB0aGF0IGNvbnRhaW5zIHRoZSBodHRwXG4gKiByZXNwb25zZSBlcnJvciBwYXJzZXJzLlxuICpcbiAqIEBwcm9wZXJ0eSB7T2JqZWN0LjxzdHJpbmcsIFJlc3BvbnNlRXJyb3JQYXJzZUZ1bmN0aW9uPn0gW2pzb25wUmVzcG9uc2VFcnJvclBhcnNlcl0gVGhlIG9iamVjdCB0aGF0IGNvbnRhaW5zIHRoZSBqc29ucFxuICogcmVzcG9uc2UgZXJyb3IgcGFyc2Vycy5cbiAqXG4gKiBAcHJvcGVydHkge0hhbmxkZU9wdGlvbnNGdW5jdGlvbn0gW2hhbmRsZU9wdGlvbnNdIFRoZSBmdW5jdGlvbiB0byBoYW5kbGUgdGhlIG9wdGlvbnMuXG4gKlxuICogQHByb3BlcnR5IHtDcmVhdGVYSFJGdW5jdGlvbn0gW2NyZWF0ZVhIUl0gVGhlIGZ1bmN0aW9uIHRvIGNyZWF0ZSB0aGUgYFhNTEh0dHBSZXF1ZXN0YCBpbnN0YW5jZS5cbiAqXG4gKiBAcHJvcGVydHkge1NjcmlwdENyZWF0ZUZ1bmN0aW9ufSBbY3JlYXRlU2NyaXB0XSBUaGUgZnVuY3Rpb24gdG8gY3JlYXRlIHRoZSBgSFRNTFNjcmlwdEVsZW1lbnRgIGluc3RhbmNlLlxuICpcbiAqIEBwcm9wZXJ0eSB7SlNPTlBDb250YWluZXJGaW5kRnVuY3Rpb259IFtqc29ucENvbnRhaW5lck5vZGVdIFRoZSBmdW5jdGlvbiB0aGF0IHJldHVybnMgdGhlIGNvbnRhaW5lciBub2RlLCB3aGljaCB3aWxsXG4gKiBiZSB1c2VkIHRvIGFwcGVuZCB0aGUgc2NyaXB0IGVsZW1lbnQgd2hlbiBzZW5kaW5nIGpzb25wIHJlcXVlc3QuXG4gKlxuICogQHByb3BlcnR5IHtKU09OUENhbGxiYWNrTmFtZUdlbmVyYXRlRnVuY3Rpb259IFtqc29ucENhbGxiYWNrTmFtZV0gVGhlIGZ1bmN0aW9uIHRvIGdlbmVyYXRlIHRoZSB1bmlxdWUgY2FsbGJhY2sgbmFtZVxuICogd2hlbiBzZW5kaW5nIGpzb25wIHJlcXVlc3QuXG4gKlxuICogQHByb3BlcnR5IHtDb21waWxlVVJMRnVuY3Rpb259IFtjb21waWxlVVJMXSBUaGUgZnVuY3Rpb24gdG8gY29tcGlsZSB1cmwuXG4gKlxuICogQHByb3BlcnR5IHtFbmNvZGVRdWVyeVN0cmluZ0Z1bmN0aW9ufSBlbmNvZGVRdWVyeVN0cmluZyBUaGUgZnVuY3Rpb24gdG8gZW5jb2RlIHRoZSBxdWVyeSBzdHJpbmcuXG4gKlxuICogQHByb3BlcnR5IHtYSFJIb29rRnVuY3Rpb259IG9uWGhyQ3JlYXRlZCBUaGUgZnVuY3Rpb24gdG8gY2FsbCBvbiB4aHIgY3JlYXRlZC5cbiAqXG4gKiBAcHJvcGVydHkge1hIUkhvb2tGdW5jdGlvbn0gb25YaHJPcGVuZWQgVGhlIGZ1bmN0b24gdG8gY2FsbCBvbiB4aHIgb3BlbmVkLlxuICpcbiAqIEBwcm9wZXJ0eSB7WEhSSG9va0Z1bmN0aW9ufSBvblhoclNlbnQgVGhlIGZ1bmN0aW9uIHRvIGNhbGwgb24geGhyIHNlbnQuXG4gKlxuICogQHByb3BlcnR5IHtSZXF1ZXN0Q3JlYXRlZEZ1bmN0aW9ufSBvblJlcXVlc3RDcmVhdGVkIFRoZSBmdW5jdGlvbiB0byBjYWxsIG9uIHJlcXVlc3QgY3JlYXRlZC5cbiAqXG4gKiBAcHJvcGVydHkge0NoZWNrUmVzcG9uc2VPa0Z1bmN0aW9ufSBpc1Jlc3BvbnNlT2sgVGhlIGZ1bmN0aW9uIHRvIGNoZWNrIHdoZXRoZXIgdGhlIHJlc3BvbnNlIGlzIG9rLlxuICpcbiAqIEBwcm9wZXJ0eSB7VHJhbnNmb3JtRXJyb3JGdW5jdGlvbn0gdHJhbnNmb3JtRXJyb3IgVGhlIGZ1bmN0aW9uIHRvIHRyYW5zZnJvbSB0aGUgcmVzcG9uc2UgZXJyb3IuIFRoZSByZXR1cm4gdmFsdWUgb2ZcbiAqIHRoaXMgZnVuY3Rpb24gd2lsbCBiZSBwYXNzZWQgdG8gdGhlIGBvbmVycm9yYCBjYWxsYmFjay5cbiAqXG4gKiBAcHJvcGVydHkge1RyYW5zZm9ybVJlc3BvbnNlRnVuY3Rpb259IHRyYW5zZm9ybVJlc3BvbnNlIFRoZSBmdW5jdGlvbiB0byB0cmFuc2Zyb20gdGhlIHJlc3BvbnNlLiBUaGUgcmV0dXJuIHZhbHVlIG9mXG4gKiB0aGlzIGZ1bmN0aW9uIHdpbGwgYmUgcGFzc2VkIHRvIHRoZSBgb25zdWNjZXNzYCBjYWxsYmFjay5cbiAqXG4gKiBAcHJvcGVydHkge0NoZWNrU2hvdWxkQ2FsbEVycm9yQ2FsbGJhY2tGdW5jdGlvbn0gc2hvdWxkQ2FsbEVycm9yQ2FsbGJhY2sgVGhlIGZ1bmN0aW9uIHRvIGNoZWNrIHdoZXRoZXIgdG8gY2FsbCB0aGVcbiAqIGVycm9yIGNhbGxiYWNrLlxuICpcbiAqIEBwcm9wZXJ0eSB7Q2hlY2tTaG91bGRDYWxsU3VjY2Vzc0NhbGxiYWNrRnVuY3Rpb259IHNob3VsZENhbGxTdWNjZXNzQ2FsbGJhY2sgVGhlIGZ1bmN0aW9uIHRvIGNoZWNrIHdoZXRoZXIgdG8gY2FsbFxuICogdGhlIHN1Y2Nlc3MgY2FsbGJhY2suXG4gKi9cblxuLyoqXG4gKiBUaGUgZGVmaW5pdG9uIG9mIGh0dHAgcmVxdWVzdCBkYXRhIHByb2Nlc3Nvci5cbiAqXG4gKiBAdHlwZWRlZiB7T2JqZWN0LjxzdHJpbmcsICo+fSBodHRwUmVxdWVzdEJvZHlQcm9jZXNzb3JcbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBwcmlvcml0eSBUaGUgcHJpb3JpdHkgb2YgdGhlIHByb2Nlc3Nvci5cbiAqIEBwcm9wZXJ0eSB7T2JqZWN0LjxzdHJpbmcsICo+fSBbaGVhZGVyc10gVGhlIGhlYWRlcnMgdG8gc2V0IHdoZW4gdGhpcyBwcm9jZXNzb3IgaXMgdXNlZC5cbiAqIEBwcm9wZXJ0eSB7SHR0cFJlcXVlc3RDb250ZW50UHJvY2Vzc0Z1bmN0aW9ufSBbcHJvY2Vzc29yXSBUaGUgZnVuY3Rpb24gdG8gcHJvY2VzcyB0aGUgcmVxdWVzdCBib2R5LlxuICovXG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGhhbmRsZSB0aGUgb3B0aW9ucy5cbiAqXG4gKiBAY2FsbGJhY2sgSGFubGRlT3B0aW9uc0Z1bmN0aW9uXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKi9cblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gcHJvY2VzcyB0aGUgcmVxdWVzdCBkYXRhLlxuICpcbiAqIEBjYWxsYmFjayBIdHRwUmVxdWVzdENvbnRlbnRQcm9jZXNzRnVuY3Rpb25cbiAqIEBwYXJhbSB7T2JqZWN0LjxzdHJpbmcsICo+fSBjb250ZW50IFRoZSBjb25lbnQgbmVlZCB0byBwcm9jZXNzLlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zIG9mIHRoZSBjdXJyZW50IHJlcXVlc3QuXG4gKiBAcmV0dXJucyB7YW55fSBSZXR1cm5zIHRoZSB2YWx1ZSB0aGF0IHdpbGwgYmUgc2VuZCB0byB0aGUgc2VydmVyLlxuICovXG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIHBhcnNlIHRoZSByZXNwb25zZS4gVGhpcyBmdW5jdGlvbiB3aWxsIGJlIG1vdW50ZWQgb24gdGhlIHJlc3BvbnNlIGluc3RhbmNlLCB3aGljaCBtYWRlIGl0IGEgbWV0aG9kXG4gKiBvZiB0aGUgYFJlc3BvbnNlYCBpbnN0YW5jZS4gVGhlIHBhcmFtZXRlcnMgYW5kIHRoZSByZXR1cm4gdmFsdWUgaXMgdXAgb24geW91LlxuICpcbiAqIEBjYWxsYmFjayBSZXNwb25zZVBhcnNlRnVuY3Rpb25cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBwYXJzZSB0aGUgcmVzcG9uc2UgZXJyb3IuIFRoaXMgZnVuY3Rpb24gd2lsbCBiZSBtb3VudGVkIG9uIHRoZSByZXNwb25zZSBlcnJvciBpbnN0YW5jZSwgd2hpY2ggbWFkZSBpdFxuICogYSBtZXRob2Qgb2YgdGhlIGBSZXNwb25zZUVycm9yYCBpbnN0YW5jZS4gVGhlIHBhcmFtZXRlcnMgYW5kIHRoZSByZXR1cm4gdmFsdWUgaXMgdXAgb24geW91LlxuICpcbiAqIEBjYWxsYmFjayBSZXNwb25zZUVycm9yUGFyc2VGdW5jdGlvblxuICovXG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGNyZWF0ZSB0aGUgYFhNTEh0dHBSZXF1ZXN0YCBpbnN0YW5jZS5cbiAqXG4gKiBAY2FsbGJhY2sgQ3JlYXRlWEhSRnVuY3Rpb25cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEByZXR1cm5zIHtYTUxIdHRwUmVxdWVzdH0gUmV0dXJucyBhbiBpbnN0YW5jZSBvZiBgWE1MSHR0cFJlcXVlc3RgLlxuICovXG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGNyZWF0ZSB0aGUgYEhUTUxTY3JpcHRFbGVtZW50YCBpbnN0YW5jZS5cbiAqXG4gKiBAY2FsbGJhY2sgU2NyaXB0Q3JlYXRlRnVuY3Rpb25cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEByZXR1cm5zIHtIVE1MU2NyaXB0RWxlbWVudH0gUmV0dXJucyBhbiBpbnN0YW5jZSBvZiBgSFRNTFNjcmlwdEVsZW1lbnRgLlxuICovXG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyB0aGUgbm9kZSB0byBhcHBlbmQgdGhlIHNjcmlwdCBlbGVtZW50LlxuICpcbiAqIEBjYWxsYmFjayBKU09OUENvbnRhaW5lckZpbmRGdW5jdGlvblxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICogQHJldHVybnMge05vZGV9IFJldHVybnMgdGhlIG5vZGUgdG8gYXBwZW5kIHRoZSBzY3JpcHQgZWxlbWVudC5cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBnZW5lcmF0ZSB0aGUgdW5pcXVlIGNhbGxiYWNrIG5hbWUuXG4gKlxuICogQGNhbGxiYWNrIEpTT05QQ2FsbGJhY2tOYW1lR2VuZXJhdGVGdW5jdGlvblxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICogQHJldHVybnMge3N0cmluZ30gUmV0cnVucyBhIHZhbGlkIGphdmFzY3JpcHQgaWRlbnRpZmllciB0byBob2xkIHRoZSBjYWxsYmFrLlxuICovXG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGNvbXBpbGUgdGhlIHJlcXVlc3QgdXJsLlxuICpcbiAqIEBjYWxsYmFjayBDb21waWxlVVJMRnVuY3Rpb25cbiAqIEBwYXJhbSB7c3RyaW5nfSB1cmwgVGhlIHVybCAod2l0aCBiYXNlVVJMKSB0byBjb21waWxlLlxuICogQHBhcmFtIHtPYmplY3QuPHN0cmluZywgKj59IHBhcmFtIFRoZSBwYXJhbSB0byBjb21waWxlIHRoZSB1cmwuXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBSZXR1cm5zIHRoZSBjb21waWxlZCB1cmwuXG4gKi9cblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gZW5jb2RlIHRoZSBxdWVyeSBzdHJpbmcuXG4gKlxuICogQGNhbGxiYWNrIEVuY29kZVF1ZXJ5U3RyaW5nRnVuY3Rpb25cbiAqIEBwYXJhbSB7T2JqZWN0LjxzdHJpbmcsICo+fSBkYXRhIFRoZSBkYXRhIHRvIGJlIGVuY29kZWQgdG8gcXVlcnkgc3RyaW5nLlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICogQHJldHVybnMge3N0cmluZ30gUmV0dXJucyB0aGUgZW5jb2RlZCBxdWVyeSBzdHJpbmcuXG4gKi9cblxuLyoqXG4gKiBUaGUgeGhyIGhvb2sgZnVuY3Rpb24uXG4gKlxuICogQGNhbGxiYWNrIFhIUkhvb2tGdW5jdGlvblxuICogQHBhcmFtIHtYTUxIdHRwUmVxdWVzdH0geGhyIFRoZSBpbnN0YW5jZSBvZiBgWE1MSHR0cFJlcXVlc3RgLlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICovXG5cbi8qKlxuICogQGNhbGxiYWNrIFJlcXVlc3RDcmVhdGVkRnVuY3Rpb25cbiAqIEBwYXJhbSB7SHR0cFJlcXVlc3R8SlNPTlBSZXF1ZXN0fSByZXF1ZXN0IFRoZSByZXF1ZXN0IGluc3RhbmNlLCBjYW4gYmUgYEh0dHBSZXF1ZXN0YCBvciBgSlNPTlBSZXF1ZXN0YC5cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBjaGVjayB3aGV0aGVyIHRoZSByZXNwb25zZSBpcyBvay5cbiAqXG4gKiBAY2FsbGJhY2sgQ2hlY2tSZXNwb25zZU9rRnVuY3Rpb25cbiAqIEBwYXJhbSB7c3RyaW5nfSByZXF1ZXN0VHlwZSBUaGUgcmVxdWVzdCB0eXBlLCBgSFRUUF9SRVFVRVNUYCBvciBgSlNPTlBfUkVRVUVTVGAuXG4gKiBAcGFyYW0ge1Jlc3BvbnNlfSByZXNwb25zZSBUaGUgcmVzcG9uc2UgaW5zdGFuY2UuXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIHJlc3BvbnNlIGlzIG9rLCBvdGhlcndpc2UgYGZhbHNlYCBpcyByZXR1cm5lZC5cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBjaGVjayB3aGV0aGVyIHRvIGNhbGwgdGhlIGVycm9yIGNhbGxiYWNrLlxuICpcbiAqIEBjYWxsYmFjayBDaGVja1Nob3VsZENhbGxFcnJvckNhbGxiYWNrRnVuY3Rpb25cbiAqIEBwYXJhbSB7c3RyaW5nfSByZXF1ZXN0VHlwZSBUaGUgcmVxdWVzdCB0eXBlLCBgSFRUUF9SRVFVRVNUYCBvciBgSlNPTlBfUkVRVUVTVGAuXG4gKiBAcGFyYW0ge2FueX0gdHJhbnNmb3JtZWRFcnJvciBUaGUgZGF0YSB0aGF0IGBvcHRpb25zLnRyYW5zZm9ybUVycm9yKC4uLilgIHJldHVybnMuXG4gKiBAcGFyYW0ge0h0dHBSZXNwb25zZUVycm9yfEpTT05QUmVzcG9uc2VFcnJvcn0gZXJyb3IgVGhlIHJlc3BvbnNlIGVycm9yLlxuICovXG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGNoZWNrIHdoZXRoZXIgdG8gY2FsbCB0aGUgc3VjY2VzcyBjYWxsYmFjay5cbiAqXG4gKiBAY2FsbGJhY2sgQ2hlY2tTaG91bGRDYWxsU3VjY2Vzc0NhbGxiYWNrRnVuY3Rpb25cbiAqIEBwYXJhbSB7c3RyaW5nfSByZXF1ZXN0VHlwZSBUaGUgcmVxdWVzdCB0eXBlLCBgSFRUUF9SRVFVRVNUYCBvciBgSlNPTlBfUkVRVUVTVGAuXG4gKiBAcGFyYW0ge2FueX0gdHJhbnNmb3JtZWRSZXNwb25zZSBUaGUgZGF0YSB0aGF0IGBvcHRpb25zLnRyYW5zZm9ybVJlc3BvbnNlKC4uLilgIHJldHVybnMuXG4gKiBAcGFyYW0ge0h0dHBSZXNwb25zZXxKU09OUFJlc3BvbnNlfSByZXNwb25zZSBUaGUgcmVzcG9uc2UuXG4gKi9cblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gdHJhbnNmcm9tIHRoZSByZXNwb25zZS4gVGhlIHJldHVybiB2YWx1ZSBvZiB0aGlzIGZ1bmN0aW9uIHdpbGwgYmUgcGFzc2VkIHRvIHRoZSBgb25zdWNjZXNzYCBjYWxsYmFjay5cbiAqXG4gKiBAY2FsbGJhY2sgVHJhbnNmb3JtUmVzcG9uc2VGdW5jdGlvblxuICogQHBhcmFtIHtzdHJpbmd9IHJlcXVlc3RUeXBlIFRoZSByZXF1ZXN0IHR5cGUsIGBIVFRQX1JFUVVFU1RgIG9yIGBKU09OUF9SRVFVRVNUYC5cbiAqIEBwYXJhbSB7SHR0cFJlc3BvbnNlfEpTT05QUmVzcG9uc2V9IHJlc3BvbnNlIFRoZSByZXNwb25zZS5cbiAqIEByZXR1cm5zIHthbnl9IFJldHVybnMgdGhlIHRyYW5zZm9ybWVkIHJlc3BvbnNlLlxuICovXG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIHRyYW5zZnJvbSB0aGUgcmVzcG9uc2UgZXJyb3IuIFRoZSByZXR1cm4gdmFsdWUgb2YgdGhpcyBmdW5jdGlvbiB3aWxsIGJlIHBhc3NlZCB0byB0aGUgYG9uZXJyb3JgXG4gKiBjYWxsYmFjay5cbiAqXG4gKiBAY2FsbGJhY2sgVHJhbnNmb3JtRXJyb3JGdW5jdGlvblxuICogQHBhcmFtIHtzdHJpbmd9IHJlcXVlc3RUeXBlIFRoZSByZXF1ZXN0IHR5cGUsIGBIVFRQX1JFUVVFU1RgIG9yIGBKU09OUF9SRVFVRVNUYC5cbiAqIEBwYXJhbSB7SHR0cFJlc3BvbnNlRXJyb3J8SlNPTlBSZXNwb25zZUVycm9yfSBlcnJvciBUaGUgcmVzcG9uc2UgZXJyb3IuXG4gKiBAcmV0dXJucyB7YW55fSBSZXR1cm5zIHRoZSB0cmFuc2Zvcm1lZCByZXNwb25zZSBlcnJvci5cbiAqL1xuIiwidmFyIFJlcXVlc2V0ID0gcmVxdWlyZSg5KTtcbnZhciBjb25zdGFudHMgPSByZXF1aXJlKDI1KTtcbnZhciBpbmhlcml0cyA9IHJlcXVpcmUoMzIpO1xudmFyIGJ1aWxkVVJMID0gcmVxdWlyZSgyMyk7XG52YXIgaGFuZGxlT3B0aW9ucyA9IHJlcXVpcmUoMzApO1xudmFyIGNhbGxSZXF1ZXN0Q3JlYXRlZENhbGxiYWNrID0gcmVxdWlyZSgyNCk7XG52YXIgYWRkRXZlbnRMaXN0ZW5lcnMgPSByZXF1aXJlKDEyKTtcbnZhciBoYW5kbGVYaHJQcm9wcyA9IHJlcXVpcmUoMTcpO1xudmFyIGhhbmRsZUhlYWRlcnMgPSByZXF1aXJlKDE1KTtcbnZhciBoYW5kbGVSZXF1ZXN0Qm9keSA9IHJlcXVpcmUoMTYpO1xudmFyIGNhbGxYaHJIb29rID0gcmVxdWlyZSgxNCk7XG5cbi8qKlxuICogUmVwcmVzZW50cyBhbiBodHRwIHJlcXVlc3QuXG4gKlxuICogQGNsYXNzXG4gKiBAZXh0ZW5kcyB7UmVxdWVzZXR9XG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcGFyYW0ge1JlcXVlc3RTdWNjZXNzQ2FsbGJhY2t9IG9uc3VjY2VzcyBUaGUgY2FsbGJhY2sgdG8gY2FsbCBvbiBzdWNjZXNzLlxuICogQHBhcmFtIHtSZXF1ZXN0RXJyb3JDYWxsYmFja30gb25lcnJvciBUaGUgY2FsbGJhY2sgdG8gY2FsbCBvbiBlcnJvci5cbiAqL1xuZnVuY3Rpb24gSHR0cFJlcXVlc3Qob3B0aW9ucywgb25zdWNjZXNzLCBvbmVycm9yKSB7XG4gICAgdmFyIHhocjtcbiAgICB2YXIgY29udGVudDtcbiAgICB2YXIgdXJsO1xuXG4gICAgLy8gQ2FsbCB0aGUgc3VwZXIgY29uc3RydWN0b3IuXG4gICAgUmVxdWVzZXQuY2FsbCh0aGlzLCBjb25zdGFudHMuSFRUUF9SRVFVRVNULCBvcHRpb25zLCBvbnN1Y2Nlc3MsIG9uZXJyb3IpO1xuXG4gICAgLy8gQ2FsbCBgb3B0aW9ucy5oYW5kbGVPcHRpb25zYCB0byBoYW5kbGUgb3B0aW9ucy5cbiAgICBoYW5kbGVPcHRpb25zKG9wdGlvbnMpO1xuXG4gICAgdGhpcy54aHIgPSB4aHIgPSBvcHRpb25zLmNyZWF0ZVhIUi5jYWxsKG51bGwsIG9wdGlvbnMpO1xuICAgIGNvbnRlbnQgPSBoYW5kbGVSZXF1ZXN0Qm9keShvcHRpb25zKTtcbiAgICB1cmwgPSBidWlsZFVSTChvcHRpb25zKTtcblxuICAgIC8vIFNldCBwcm9wZXJ0aWVzIHRvIHRoZSB4aHIuXG4gICAgaGFuZGxlWGhyUHJvcHMoeGhyLCBvcHRpb25zKTtcblxuICAgIC8vIENhbGwgb25YaHJDcmVhdGVkLlxuICAgIGNhbGxYaHJIb29rKG9wdGlvbnMub25YaHJDcmVhdGVkLCB4aHIsIG9wdGlvbnMpO1xuXG4gICAgLy8gT3BlbiB0aGUgcmVxdWVzdC5cbiAgICB4aHIub3BlbihvcHRpb25zLm1ldGhvZCB8fCAnR0VUJywgdXJsLCB0cnVlLCBvcHRpb25zLnVzZXJuYW1lLCBvcHRpb25zLnBhc3N3b3JkKTtcblxuICAgIC8vIEFkZCBldmVudCBsaXN0ZW5lcnMuXG4gICAgYWRkRXZlbnRMaXN0ZW5lcnModGhpcyk7XG5cbiAgICAvLyBDYWxsIG9uWGhyT3BlbmVkLlxuICAgIGNhbGxYaHJIb29rKG9wdGlvbnMub25YaHJPcGVuZWQsIHhociwgb3B0aW9ucyk7XG5cbiAgICAvLyBIYW5sZGUgaGVhZGVycy5cbiAgICBoYW5kbGVIZWFkZXJzKHhociwgb3B0aW9ucyk7XG5cbiAgICAvLyBTZW5kIHRoZSBjb250ZW50IHRvIHRoZSBzZXJ2ZXIuXG4gICAgeGhyLnNlbmQoY29udGVudCk7XG5cbiAgICAvLyBDYWxsIG9uWGhyU2VudC5cbiAgICBjYWxsWGhySG9vayhvcHRpb25zLm9uWGhyU2VudCwgeGhyLCBvcHRpb25zKTtcblxuICAgIC8vIENhbGwgb25SZXF1ZXN0Q3JlYXRlZFxuICAgIGNhbGxSZXF1ZXN0Q3JlYXRlZENhbGxiYWNrKG9wdGlvbnMsIHRoaXMpO1xufVxuXG5pbmhlcml0cyhIdHRwUmVxdWVzdCwgUmVxdWVzZXQpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEh0dHBSZXF1ZXN0O1xuIiwiLyoqXG4gKiBIdHRwUmVzcG9uc2UgbW9kdWxlLlxuICpcbiAqIEBtb2R1bGUgY2xhc3MvSHR0cFJlc3BvbnNlXG4gKi9cblxudmFyIFJlc3BvbnNlID0gcmVxdWlyZSgxMCk7XG52YXIgaW5oZXJpdHMgPSByZXF1aXJlKDMyKTtcbnZhciBhZGRDdXN0b21QYXJzZXIgPSByZXF1aXJlKDIyKTtcblxuLyoqXG4gKiBUaGUgSHR0cFJlc3BvbnNlIGNsYXNzLlxuICpcbiAqIEBjbGFzc1xuICogQHBhcmFtIHtIdHRwUmVxdWVzdH0gcmVxdWVzdCBUaGUgaHR0cCByZXF1ZXN0LlxuICovXG5mdW5jdGlvbiBIdHRwUmVzcG9uc2UocmVxdWVzdCkge1xuICAgIFJlc3BvbnNlLmNhbGwodGhpcywgcmVxdWVzdCk7XG4gICAgYWRkQ3VzdG9tUGFyc2VyKHRoaXMsIHJlcXVlc3Qub3B0aW9ucywgJ2h0dHBSZXNwb25zZVBhcnNlcicpO1xufVxuXG5pbmhlcml0cyhIdHRwUmVzcG9uc2UsIFJlc3BvbnNlKTtcblxubW9kdWxlLmV4cG9ydHMgPSBIdHRwUmVzcG9uc2U7XG4iLCJ2YXIgUmVzcG9uc2VFcnJvciA9IHJlcXVpcmUoMTEpO1xudmFyIGluaGVyaXRzID0gcmVxdWlyZSgzMik7XG52YXIgYWRkQ3VzdG9tUGFyc2VyID0gcmVxdWlyZSgyMik7XG5cbi8qKlxuICogQGNsYXNzXG4gKiBAcGFyYW0ge3N0cmluZ30gY29kZSBUaGUgZXJyb3IgY29kZS5cbiAqIEBwYXJhbSB7SHR0cFJlcXVlc3R9IHJlcXVlc3QgVGhlIGh0dHAgcmVxdWVzdC5cbiAqL1xuZnVuY3Rpb24gSHR0cFJlc3BvbnNlRXJyb3IoY29kZSwgcmVxdWVzdCkge1xuICAgIFJlc3BvbnNlRXJyb3IuY2FsbCh0aGlzLCBjb2RlLCByZXF1ZXN0KTtcbiAgICBhZGRDdXN0b21QYXJzZXIodGhpcywgcmVxdWVzdC5vcHRpb25zLCAnaHR0cFJlc3BvbnNlRXJyb3JQYXJzZXInKTtcbn1cblxuaW5oZXJpdHMoSHR0cFJlc3BvbnNlRXJyb3IsIFJlc3BvbnNlRXJyb3IpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEh0dHBSZXNwb25zZUVycm9yO1xuIiwidmFyIFJlcXVlc2V0ID0gcmVxdWlyZSg5KTtcbnZhciBjb25zdGFudHMgPSByZXF1aXJlKDI1KTtcbnZhciBpbmhlcml0cyA9IHJlcXVpcmUoMzIpO1xudmFyIGhhbmRsZU9wdGlvbnMgPSByZXF1aXJlKDMwKTtcbnZhciBjYWxsUmVxdWVzdENyZWF0ZWRDYWxsYmFjayA9IHJlcXVpcmUoMjQpO1xudmFyIGFkZEV2ZW50TGlzdGVuZXJzID0gcmVxdWlyZSgxOCk7XG52YXIgYnVpbGRDYWxsYmFja05hbWUgPSByZXF1aXJlKDE5KTtcbnZhciBoYW5kbGVTY3JpcHRDb3JzID0gcmVxdWlyZSgyMSk7XG52YXIgYnVpbGRTY3JpcHRTcmMgPSByZXF1aXJlKDIwKTtcblxuLyoqXG4gKiBSZXByZXNlbnRzIGFuIGpzb25wIHJlcXVlc3QuXG4gKlxuICogQGNsYXNzXG4gKiBAZXh0ZW5kcyB7UmVxdWVzZXR9XG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcGFyYW0ge1JlcXVlc3RTdWNjZXNzQ2FsbGJhY2t9IG9uc3VjY2VzcyBUaGUgY2FsbGJhY2sgdG8gY2FsbCBvbiBzdWNjZXNzLlxuICogQHBhcmFtIHtSZXF1ZXN0RXJyb3JDYWxsYmFja30gb25lcnJvciBUaGUgY2FsbGJhY2sgdG8gY2FsbCBvbiBlcnJvci5cbiAqL1xuZnVuY3Rpb24gSlNPTlBSZXF1ZXN0KG9wdGlvbnMsIG9uc3VjY2Vzcywgb25lcnJvcikge1xuICAgIHZhciBzcmM7XG4gICAgdmFyIHNjcmlwdDtcbiAgICB2YXIgY2FsbGJhY2tOYW1lO1xuICAgIHZhciBjb250YWluZXJOb2RlO1xuXG4gICAgUmVxdWVzZXQuY2FsbCh0aGlzLCBjb25zdGFudHMuSlNPTlBfUkVRVUVTVCwgb3B0aW9ucywgb25zdWNjZXNzLCBvbmVycm9yKTtcblxuICAgIC8vIENhbGwgYG9wdGlvbnMuaGFuZGxlT3B0aW9uc2AgdG8gaGFuZGxlIG9wdGlvbnMuXG4gICAgaGFuZGxlT3B0aW9ucyhvcHRpb25zKTtcblxuICAgIHNjcmlwdCA9IHRoaXMuc2NyaXB0ID0gb3B0aW9ucy5jcmVhdGVTY3JpcHQuY2FsbChudWxsLCBvcHRpb25zKTtcbiAgICBjb250YWluZXJOb2RlID0gb3B0aW9ucy5qc29ucENvbnRhaW5lck5vZGUuY2FsbChudWxsLCBvcHRpb25zKTtcbiAgICBjYWxsYmFja05hbWUgPSBidWlsZENhbGxiYWNrTmFtZShvcHRpb25zKTtcbiAgICBzcmMgPSBidWlsZFNjcmlwdFNyYyhvcHRpb25zLCBjYWxsYmFja05hbWUpO1xuXG4gICAgLy8gU2V0IHRoZSBzcmMgYXR0cmlidXRlLlxuICAgIHNjcmlwdC5zZXRBdHRyaWJ1dGUoJ3NyYycsIHNyYyk7XG5cbiAgICAvLyBIYW5kbGUgYG9wdGlvbnMuY29yc2BcbiAgICBoYW5kbGVTY3JpcHRDb3JzKHNjcmlwdCwgb3B0aW9ucyk7XG5cbiAgICAvLyBBZGQgZXZlbnQgbGlzdGVuZXJzXG4gICAgYWRkRXZlbnRMaXN0ZW5lcnModGhpcywgY2FsbGJhY2tOYW1lKTtcblxuICAgIC8vIEluamVjdCB0aGUgc2NyaXB0IG5vZGVcbiAgICBjb250YWluZXJOb2RlLmFwcGVuZENoaWxkKHNjcmlwdCk7XG5cbiAgICAvLyBDYWxsIG9uUmVxdWVzdENyZWF0ZWRcbiAgICBjYWxsUmVxdWVzdENyZWF0ZWRDYWxsYmFjayhvcHRpb25zLCB0aGlzKTtcbn1cblxuaW5oZXJpdHMoSlNPTlBSZXF1ZXN0LCBSZXF1ZXNldCk7XG5cbm1vZHVsZS5leHBvcnRzID0gSlNPTlBSZXF1ZXN0O1xuIiwiLyoqXG4gKiBKU09OUFJlc3BvbnNlIG1vZHVsZS5cbiAqXG4gKiBAbW9kdWxlIGNsYXNzL0pTT05QUmVzcG9uc2VcbiAqL1xuXG52YXIgUmVzcG9uc2UgPSByZXF1aXJlKDEwKTtcbnZhciBpbmhlcml0cyA9IHJlcXVpcmUoMzIpO1xudmFyIGFkZEN1c3RvbVBhcnNlciA9IHJlcXVpcmUoMjIpO1xuXG4vKipcbiAqIFRoZSBKU09OUFJlc3BvbnNlIGNsYXNzLlxuICpcbiAqIEBjbGFzc1xuICogQHBhcmFtIHtKU09OUmVxdWVzdH0gcmVxdWVzdCBUaGUgaHR0cCByZXF1ZXN0LlxuICovXG5mdW5jdGlvbiBKU09OUFJlc3BvbnNlKHJlcXVlc3QpIHtcbiAgICBSZXNwb25zZS5jYWxsKHRoaXMsIHJlcXVlc3QpO1xuICAgIGFkZEN1c3RvbVBhcnNlcih0aGlzLCByZXF1ZXN0Lm9wdGlvbnMsICdqc29ucFJlc3BvbnNlUGFyc2VyJyk7XG59XG5cbmluaGVyaXRzKEpTT05QUmVzcG9uc2UsIFJlc3BvbnNlKTtcblxubW9kdWxlLmV4cG9ydHMgPSBKU09OUFJlc3BvbnNlO1xuIiwidmFyIFJlc3BvbnNlRXJyb3IgPSByZXF1aXJlKDExKTtcbnZhciBpbmhlcml0cyA9IHJlcXVpcmUoMzIpO1xudmFyIGFkZEN1c3RvbVBhcnNlciA9IHJlcXVpcmUoMjIpO1xuXG4vKipcbiAqIEBjbGFzc1xuICogQHBhcmFtIHtzdHJpbmd9IGNvZGUgVGhlIGVycm9yIGNvZGUuXG4gKiBAcGFyYW0ge0pTT05QUmVxdWVzdH0gcmVxdWVzdCBUaGUgSlNPTlAgcmVxdWVzdC5cbiAqL1xuZnVuY3Rpb24gSlNPTlBSZXNwb25zZUVycm9yKGNvZGUsIHJlcXVlc3QpIHtcbiAgICBSZXNwb25zZUVycm9yLmNhbGwodGhpcywgY29kZSwgcmVxdWVzdCk7XG4gICAgYWRkQ3VzdG9tUGFyc2VyKHRoaXMsIHJlcXVlc3Qub3B0aW9ucywgJ2pzb25wUmVzcG9uc2VFcnJvclBhcnNlcicpO1xufVxuXG5pbmhlcml0cyhSZXNwb25zZUVycm9yLCBKU09OUFJlc3BvbnNlRXJyb3IpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEpTT05QUmVzcG9uc2VFcnJvcjtcbiIsInZhciB1dWlkID0gcmVxdWlyZSgzNSk7XG5cbi8qKlxuICogVGhlIGJhc2UgUmVxZXVzdCBjbGFzcy5cbiAqXG4gKiBAY2xhc3NcbiAqIEBwYXJhbSB7c3RyaW5nfSB0eXBlIFRoZSB0eXBlIG9mIHJlcXVlc3QsIGNhbiBiZSBgSFRUUF9SRVFVRVNUYCBvciBgSlNPTlBfUkVRVUVTVGAuXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcGFyYW0ge1JlcXVlc3RTdWNjZXNzQ2FsbGJhY2t9IG9uc3VjY2VzcyBUaGUgY2FsbGJhY2sgdG8gY2FsbCBvbiBzdWNjZXNzLlxuICogQHBhcmFtIHtSZXF1ZXN0RXJyb3JDYWxsYmFja30gb25lcnJvciBUaGUgY2FsbGJhY2sgdG8gY2FsbCBvbiBlcnJvci5cbiAqL1xuZnVuY3Rpb24gUmVxdWVzdCh0eXBlLCBvcHRpb25zLCBvbnN1Y2Nlc3MsIG9uZXJyb3IpIHtcbiAgICAvKipcbiAgICAgKiBJZiB0aGVyZSBpcyBhbiBlcnJvciBoYXBwZW5kLCB0aGUgYGVycm9yQ29kZWAgaXMgYSBzdHJpbmcgcmVwcnNlbmd0aW5nIHRoZSB0eXBlIG9mIHR5cGUgZXJyb3IuIElmIHRoZXJlIGlzIG5vXG4gICAgICogZXJyb3IsIHRoZSB2YWx1ZSBvZiBgZXJyb3JDb2RlYCBpcyBgbnVsbGAuXG4gICAgICovXG4gICAgdGhpcy5lcnJvckNvZGUgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGBYTUxIdHRwUmVxdWVzdGAgd2UgdXNlIHdoZW4gc2VuZGluZyBodHRwIHJlcXVlc3QuXG4gICAgICovXG4gICAgdGhpcy54aHIgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGBIVE1MU2NyaXB0RWxlbWVudGAgd2UgdXNlIHdoZW4gc2VuZGluZyBqc29uIHJlcXVlc3QuXG4gICAgICovXG4gICAgdGhpcy5zY3JpcHQgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogV2hldGhlciB0aGUgcmVxdWVzdCBpcyBmaW5pc2hlZC5cbiAgICAgKi9cbiAgICB0aGlzLmZpbmlzaGVkID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgcmVzcG9uc2UgSlNPTiBkYXRhIG9mIHRoZSBKU09OUCByZXF1ZXN0LlxuICAgICAqL1xuICAgIHRoaXMucmVzcG9uc2VKU09OID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEFuIHVuaXF1ZSBpZCBmb3IgdGhpcyByZXF1ZXN0LlxuICAgICAqL1xuICAgIHRoaXMucmVxdWVzdElkID0gdXVpZCgpO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHR5cGUgb2YgcmVxdWVzdCwgY2FuIGJlIGBIVFRQX1JFUVVFU1RgIG9yIGBKU09OUF9SRVFVRVNUYC5cbiAgICAgKi9cbiAgICB0aGlzLnJlcXVlc3RUeXBlID0gdHlwZTtcblxuICAgIC8qKlxuICAgICAqIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gICAgICovXG4gICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucztcblxuICAgIC8qKlxuICAgICAqIFRoZSBuYW1lIG9mIHRoZSBmdW5jdGlvbiB0aGF0IGNyZWF0ZSB0aGlzIHJlcXVlc3QuIENhbiBiZSBgc2VuZGAsIGBmZXRjaGAsIGBnZXRKT1NOUGAsIGBmZXRjaEpTT05QYC4gVGhpcyB2YWx1ZVxuICAgICAqIGlzIHNldCBieSB0aGUgbGlicmF5IGl0c2VsZi5cbiAgICAgKi9cbiAgICB0aGlzLnJlcXVlc3RGdW5jdGlvbk5hbWUgPSBvcHRpb25zLnJlcXVlc3RGdW5jdGlvbk5hbWU7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgYENhbmNlbENvbnRyb2xsZXJgIHRoYXQgdXNlZCB0byBjYW5jZWwgdGhpcyByZXF1ZXN0LiBXZSBuZXZlciB1c2UgdGhpcyBwcm9wZXJ0eSBpbnRlcm5hbGx5LCBqdXN0IGhvbGRpbmcgdGhlXG4gICAgICogaW5mb3JtYXRpb24gaW4gY2FzZSB0aGF0IHRoZSB1c2VyIG5lZWRzLlxuICAgICAqL1xuICAgIHRoaXMuY29udHJvbGxlciA9IG9wdGlvbnMuY29udHJvbGxlciB8fCBudWxsO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGNhbGxiYWNrIHRvIGNhbGwgb24gc3VjY2Vzcy5cbiAgICAgKi9cbiAgICB0aGlzLm9uc3VjY2VzcyA9IG9uc3VjY2VzcyB8fCBudWxsO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGNhbGxiYWNrIHRvIGNhbGwgb24gZXJyb3IuXG4gICAgICovXG4gICAgdGhpcy5vbmVycm9yID0gb25lcnJvciB8fCBudWxsO1xuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSByZXF1ZXN0IHR5cGUgYmFjay5cbiAgICAgKi9cbiAgICBvcHRpb25zLnJlcXVlc3RUeXBlID0gdHlwZTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBSZXF1ZXN0O1xuIiwiLyoqXG4gKiBSZXByZXNlbnRzIGEgcmVzcG9uc2UuXG4gKlxuICogQHBhcmFtIHtSZXF1ZXN0fSByZXF1ZXN0IFRoZSBpbnN0YW5jZSBvZiBgUmVxdWVzdGAuXG4gKi9cbmZ1bmN0aW9uIFJlc3BvbnNlKHJlcXVlc3QpIHtcbiAgICAvKipcbiAgICAgKiBAdHlwZSB7UmVxdWVzdH1cbiAgICAgKi9cbiAgICB0aGlzLnJlcXVlc3QgPSByZXF1ZXN0O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFJlc3BvbnNlO1xuIiwidmFyIGVycm9yTWVzc2FnZXMgPSB7XG4gICAgRVJSX0FCT1JURUQ6ICdSZXF1ZXN0IGFib3J0ZWQnLFxuICAgIEVSUl9DQU5DRUxMRUQ6ICdSZXF1ZXN0IGNhbmNlbGxlZCcsXG4gICAgRVJSX05FVFdPUks6ICdOZXR3b3JrIGVycm9yJyxcbiAgICBFUlJfUkVTUE9OU0U6ICdSZXNwb25zZSBlcnJvcicsXG4gICAgRVJSX1RJTUVPVVQ6ICdSZXF1ZXN0IHRpbWVvdXQnXG59O1xuXG4vKipcbiAqIFJlcHJlc2VudHMgcmVzcG9uc2UgZXJyb3IuXG4gKlxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0ge3N0cmluZ30gY29kZSBUaGUgZXJyb3IgY29kZS5cbiAqIEBwYXJhbSB7UmVxdWVzdH0gcmVxdWVzdCBUaGUgcmVxdWVzdC5cbiAqL1xuZnVuY3Rpb24gUmVzcG9uc2VFcnJvcihjb2RlLCByZXF1ZXN0KSB7XG4gICAgdmFyIG1lc3NhZ2U7XG5cbiAgICBjb2RlID0gY29kZSB8fCAnRVJSX1VOS05PV04nO1xuXG4gICAgaWYgKGVycm9yTWVzc2FnZXNbY29kZV0pIHtcbiAgICAgICAgbWVzc2FnZSA9IGVycm9yTWVzc2FnZXNbY29kZV07XG4gICAgfVxuXG4gICAgaWYgKCFtZXNzYWdlKSB7XG4gICAgICAgIG1lc3NhZ2UgPSAnVW5rbm93biBlcnJvciAnICsgY29kZTtcbiAgICB9XG5cbiAgICByZXF1ZXN0LmVycm9yQ29kZSA9IGNvZGU7XG5cbiAgICB0aGlzLmNvZGUgPSBjb2RlO1xuICAgIHRoaXMucmVxdWVzdCA9IHJlcXVlc3Q7XG4gICAgdGhpcy5tZXNzYWdlID0gbWVzc2FnZTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBSZXNwb25zZUVycm9yO1xuIiwidmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKDM4KTtcbnZhciBIdHRwUmVzcG9uc2UgPSByZXF1aXJlKDQpO1xudmFyIGFkZFRpbWVvdXRMaXN0ZW5lciA9IHJlcXVpcmUoMTMpO1xudmFyIGZpcmVDYWxsYmFja3MgPSByZXF1aXJlKDI5KTtcbnZhciBub29wID0gcmVxdWlyZSgzMyk7XG52YXIgY29uc3RhbnRzID0gcmVxdWlyZSgyNSk7XG52YXIgRVJSX0FCT1JURUQgICA9IGNvbnN0YW50cy5FUlJfQUJPUlRFRDtcbnZhciBFUlJfQ0FOQ0VMTEVEID0gY29uc3RhbnRzLkVSUl9DQU5DRUxMRUQ7XG52YXIgRVJSX05FVFdPUksgICA9IGNvbnN0YW50cy5FUlJfTkVUV09SSztcbnZhciBFUlJfUkVTUE9OU0UgID0gY29uc3RhbnRzLkVSUl9SRVNQT05TRTtcbnZhciBFUlJfVElNRU9VVCAgID0gY29uc3RhbnRzLkVSUl9USU1FT1VUO1xuXG4vKipcbiAqIEFkZCBldmVudCBsaXN0ZW5lcnMgdG8gdGhlIGh0dHAgcmVxdWVzdC4gVGhpcyBmdW5jdGlvbiB3aWxsIG92ZXJ3aXRlIHRoZSBgY2FuY2VsYCBtZXRob2Qgb24gdGhlIGdpdmVuIGBIdHRwUmVxZXN0YFxuICogaW5zdGFuY2UuXG4gKlxuICogQHBhcmFtIHtIdHRwUmVxdWVzdH0gcmVxdWVzdCBUaGUgaHR0cCByZXF1ZXN0IHRvIGFkZCBldmVudCBsaXN0ZW5lcnMuXG4gKi9cbmZ1bmN0aW9uIGFkZEV2ZW50TGlzdGVuZXJzKHJlcXVlc3QpIHtcbiAgICB2YXIgeGhyID0gcmVxdWVzdC54aHI7XG4gICAgdmFyIG9wdGlvbnMgPSByZXF1ZXN0Lm9wdGlvbnM7XG4gICAgdmFyIHJlcXVlc3RUeXBlID0gcmVxdWVzdC5yZXF1ZXN0VHlwZTtcbiAgICB2YXIgcmVzcG9uc2UgPSBuZXcgSHR0cFJlc3BvbnNlKHJlcXVlc3QpO1xuICAgIHZhciBpc1Jlc3BvbnNlT2sgPSBvcHRpb25zLmlzUmVzcG9uc2VPaztcbiAgICB2YXIgY2xlYXJUaW1lb3V0RXZlbnQgPSBudWxsO1xuICAgIHZhciB0aW1lb3V0ID0gcGFyc2VJbnQob3B0aW9ucy50aW1lb3V0IHx8IDAsIDEwKTtcblxuICAgIC8qKlxuICAgICAqIENhbmNlbCB0aGUgcmVxdWVzdC5cbiAgICAgKi9cbiAgICB2YXIgY2FuY2VsID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBjbGVhckV2ZW50cygpO1xuICAgICAgICBpZiAoeGhyLmFib3J0KSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHhoci5hYm9ydCgpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZSkge31cbiAgICAgICAgfVxuICAgICAgICBmaW5pc2goRVJSX0NBTkNFTExFRCk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBmdW5jdGlvbiB0byBjbGVhciBldmVudHMuXG4gICAgICovXG4gICAgdmFyIGNsZWFyRXZlbnRzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAvLyBTZXQgY2xlYXJFdmVudHMgdG8gdGhlIG5vb3AgZnVuY3Rpb24uXG4gICAgICAgIGNsZWFyRXZlbnRzID0gbm9vcDtcblxuICAgICAgICB4aHIub25hYm9ydCA9IG51bGw7XG4gICAgICAgIHhoci5vbmVycm9yID0gbnVsbDtcbiAgICAgICAgeGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IG51bGw7XG4gICAgICAgIHhoci5vbnRpbWVvdXQgPSBudWxsO1xuXG4gICAgICAgIGlmIChjbGVhclRpbWVvdXRFdmVudCkge1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0RXZlbnQoKTtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dEV2ZW50ID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZnVuY3Rpb24gZmluaXNoIHRoZSByZXF1ZXN0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGNvZGUgVGhlIGVycm9yIGNvZGUgb24gZXJyb3IuIElmIG5vIGVycm9yIG9jY3VyZWQsIHRoZSBjb2RlIGlzIGBudWxsYC5cbiAgICAgKi9cbiAgICB2YXIgZmluaXNoID0gZnVuY3Rpb24gKGNvZGUpIHtcbiAgICAgICAgLy8gU2V0IGZpbmlzaCB0byB0aGUgbm9vcCBmdW5jdGlvbi5cbiAgICAgICAgZmluaXNoID0gbm9vcDtcblxuICAgICAgICAvLyBTZXQgY2FuY2VsIHRvIHRoZSBub29wIGZ1bmN0aW9uLlxuICAgICAgICBjYW5jZWwgPSBub29wO1xuXG4gICAgICAgIC8vIE1hcmsgdGhpcyByZXF1ZXN0IGFzIGZpbmlzaGVkLlxuICAgICAgICByZXF1ZXN0LmZpbmlzaGVkID0gdHJ1ZTtcblxuICAgICAgICAvLyBDbGVhciBldmVudHMuXG4gICAgICAgIGNsZWFyRXZlbnRzKCk7XG5cbiAgICAgICAgLy8gRmlyZSBjYWxsYmFja3MuXG4gICAgICAgIGZpcmVDYWxsYmFja3MoY29kZSwgcmVzcG9uc2UpO1xuICAgIH07XG5cbiAgICB4aHIub25hYm9ydCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZmluaXNoKEVSUl9BQk9SVEVEKTtcbiAgICB9O1xuXG4gICAgeGhyLm9uZXJyb3IgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGZpbmlzaChFUlJfTkVUV09SSyk7XG4gICAgfTtcblxuICAgIHhoci5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICgreGhyLnJlYWR5U3RhdGUgPT09IDQpIHtcbiAgICAgICAgICAgIGlmIChpc0Z1bmN0aW9uKGlzUmVzcG9uc2VPaykpIHtcbiAgICAgICAgICAgICAgICBpZiAoaXNSZXNwb25zZU9rKHJlcXVlc3RUeXBlLCByZXNwb25zZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgZmluaXNoKG51bGwpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGZpbmlzaChFUlJfUkVTUE9OU0UpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZmluaXNoKG51bGwpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIENhbmNlbCB0aGUgcmVxdWVzdC5cbiAgICAgKi9cbiAgICByZXF1ZXN0LmNhbmNlbCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgY2FuY2VsKCk7XG4gICAgfTtcblxuICAgIC8vIEFkZCB0aW1lb3V0IGxpc3RlbmVyXG4gICAgaWYgKCFpc05hTih0aW1lb3V0KSAmJiB0aW1lb3V0ID4gMCkge1xuICAgICAgICBjbGVhclRpbWVvdXRFdmVudCA9IGFkZFRpbWVvdXRMaXN0ZW5lcih4aHIsIHRpbWVvdXQsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGNsZWFyRXZlbnRzKCk7XG4gICAgICAgICAgICBpZiAoeGhyLmFib3J0KSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgeGhyLmFib3J0KCk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge31cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZpbmlzaChFUlJfVElNRU9VVCk7XG4gICAgICAgIH0pO1xuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBhZGRFdmVudExpc3RlbmVycztcbiIsIi8qKlxuICogQWRkIHRpbWVvdXQgZXZlbnQgbGlzdGVuZXIgb24gdGhlIFhIUiBvYmplY3QuXG4gKlxuICogQHBhcmFtIHtYTUxIdHRwUmVxdWVzdH0geGhyIFRoZSBYSFIgdG8gYWRkIHRpbWVvdXQgZXZlbnQgbGlzdGVuZXIuXG4gKiBAcGFyYW0ge251bWJlcn0gdGltZW91dCBUaGUgdGltZSB0byB3YWl0IGluIG1pbGxpc2Vjb25kcy5cbiAqIEBwYXJhbSB7KCkgPT4gdm9pZH0gbGlzdGVuZXIgVGhlIHRpbWVvdXQgY2FsbGJhY2suXG4gKiBAcmV0dXJucyB7KCkgPT4gdm9pZCl9IFJldHVybnMgYSBmdW5jdGlvbiB0byByZW1vdmUgdGhlIHRpbWVvdXQgZXZlbnQgbGlzdGVuZXIuXG4gKi9cbmZ1bmN0aW9uIGFkZFRpbWVvdXRMaXN0ZW5lcih4aHIsIHRpbWVvdXQsIGxpc3RlbmVyKSB7XG4gICAgdmFyIHRpbWVvdXRJZCA9IG51bGw7XG4gICAgdmFyIHN1cHBvcnRUaW1lb3V0ID0gJ3RpbWVvdXQnIGluIHhociAmJiAnb250aW1lb3V0JyBpbiB4aHI7XG5cbiAgICBpZiAoc3VwcG9ydFRpbWVvdXQpIHtcbiAgICAgICAgeGhyLnRpbWVvdXQgPSB0aW1lb3V0O1xuICAgICAgICB4aHIub250aW1lb3V0ID0gbGlzdGVuZXI7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGltZW91dElkID0gc2V0VGltZW91dChsaXN0ZW5lciwgdGltZW91dCk7XG4gICAgfVxuXG4gICAgLy8gQ2FsbCB0aGlzIGZ1bmN0aW9uIHRvIHJlbW92ZSB0aW1lb3V0IGV2ZW50IGxpc3RlbmVyXG4gICAgZnVuY3Rpb24gY2xlYXJUaW1lb3V0RXZlbnQoKSB7XG4gICAgICAgIGlmICh4aHIpIHtcbiAgICAgICAgICAgIGlmICh0aW1lb3V0SWQgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICB4aHIub250aW1lb3V0ID0gbnVsbDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXRJZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB4aHIgPSBudWxsO1xuICAgICAgICAgICAgbGlzdGVuZXIgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGNsZWFyVGltZW91dEV2ZW50O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGFkZFRpbWVvdXRMaXN0ZW5lcjtcbiIsInZhciBpc0Z1bmN0aW9uID0gcmVxdWlyZSgzOCk7XG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGNhbGwgeGhyIGhvb2sgZnVuY3Rpb24uXG4gKlxuICogQHBhcmFtIHtYSFJIb29rRnVuY3Rpb259IGZ1bmMgVGhlIGhvb2sgZnVuY3Rpb24gdG8gY2FsbCwgaWYgaXQgaXMgbm90IGZ1bmN0aW9uLCB0aGlzIGhvb2sgaXMgc2tpcHBlZC5cbiAqIEBwYXJhbSB7WE1MSHR0cFJlcWV1c3R9IHhociBUaGUgaW5zdGFuY2Ugb2YgYFhNTEh0dHBSZXFldXN0YC5cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbn0gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICovXG5mdW5jdGlvbiBjYWxsWGhySG9vayhmdW5jLCB4aHIsIG9wdGlvbnMpIHtcbiAgICBpZiAoaXNGdW5jdGlvbihmdW5jKSkge1xuICAgICAgICBmdW5jKHhociwgb3B0aW9ucyk7XG4gICAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGNhbGxYaHJIb29rO1xuIiwidmFyIG1lcmdlID0gcmVxdWlyZSg0MCk7XG52YXIgaXNQbGFpbk9iamVjdCA9IHJlcXVpcmUoMzkpO1xudmFyIGhhc093biA9IHJlcXVpcmUoMzEpO1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBzZXQgdGhlIHJlcXVlc3QgaGVhZGVycy5cbiAqXG4gKiAxLiBNZXJnZSB0aGUgYG9wdGlvbnMubm9DYWNoZUhlYWRlcnNgIGlmIG5lZWRlZC5cbiAqIDIuIFNldCB0aGUgcmVxdWVzdCBoZWFkZXJzIGlmIG5lZWRlZC5cbiAqXG4gKiBAcGFyYW0ge1hNTEh0dHBSZXFldXN0fSB4aHIgVGhlIGluc3RhbmNlIG9mIGBYTUxIdHRwUmVxZXVzdGAuXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb259IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqL1xuZnVuY3Rpb24gaGFuZGxlSGVhZGVycyh4aHIsIG9wdGlvbnMpIHtcbiAgICB2YXIgbmFtZTtcbiAgICB2YXIgdmFsdWU7XG4gICAgdmFyIGhlYWRlcnMgPSBpc1BsYWluT2JqZWN0KG9wdGlvbnMuaGVhZGVycykgPyBvcHRpb25zLmhlYWRlcnMgOiB7fTtcblxuICAgIGlmIChvcHRpb25zLm5vQ2FjaGUpIHtcbiAgICAgICAgaWYgKGlzUGxhaW5PYmplY3Qob3B0aW9ucy5ub0NhY2hlSGVhZGVycykpIHtcbiAgICAgICAgICAgIGhlYWRlcnMgPSBtZXJnZShoZWFkZXJzLCBvcHRpb25zLm5vQ2FjaGVIZWFkZXJzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZvciAobmFtZSBpbiBoZWFkZXJzKSB7XG4gICAgICAgIGlmIChoYXNPd24uY2FsbChoZWFkZXJzLCBuYW1lKSkge1xuICAgICAgICAgICAgdmFsdWUgPSBoZWFkZXJzW25hbWVdO1xuICAgICAgICAgICAgLy8gT25seSB0aGUgbm9uLXVuZGVmaW5lZCBhbmQgbm9uLW51bGwgaGVhZGVycyBhcmUgc2V0XG4gICAgICAgICAgICBpZiAodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKG5hbWUsIHZhbHVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIFNldCB0aGUgaGVhZGVycyBiYWNrLlxuICAgIG9wdGlvbnMuaGVhZGVycyA9IGhlYWRlcnM7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaGFuZGxlSGVhZGVycztcbiIsInZhciBtZXJnZSA9IHJlcXVpcmUoNDApO1xudmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKDM4KTtcbnZhciBpc1BsYWluT2JqZWN0ID0gcmVxdWlyZSgzOSk7XG52YXIgaGFzT3duID0gcmVxdWlyZSgzMSk7XG5cbi8qKlxuICogRmluZCBhIHByb2Nlc3NvciBmcm9tIGBvcHRpb25zLmh0dHBSZXF1ZXN0Qm9keVByb2Nlc3NvcmAgdG8gcHJvY2VzcyB0aGUgcmVxdWVzdCBib2R5LlxuICpcbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEByZXR1cm5zIHthbnl9IFJldHJ1bnMgdGhlIGNvbnRlbnQgdGhhdCBzZW5kIHRvIHRoZSBzZXJ2ZXIuXG4gKi9cbmZ1bmN0aW9uIGhhbmRsZVJlcXVlc3RCb2R5KG9wdGlvbnMpIHtcbiAgICB2YXIgaTtcbiAgICB2YXIgbDtcbiAgICB2YXIga2V5O1xuICAgIHZhciBjb250ZW50ID0gbnVsbDtcbiAgICB2YXIgcHJvY2Vzc29yO1xuICAgIHZhciBjb250ZW50UHJvY2Vzc29yO1xuICAgIHZhciBjb250ZW50UHJvY2Vzc29ycyA9IFtdO1xuICAgIHZhciBib2R5ID0gb3B0aW9ucy5ib2R5O1xuICAgIHZhciBwcm9jZXNzb3JzID0gb3B0aW9ucy5odHRwUmVxdWVzdEJvZHlQcm9jZXNzb3I7XG4gICAgdmFyIGhlYWRlcnMgPSBpc1BsYWluT2JqZWN0KG9wdGlvbnMuaGVhZGVycykgPyBvcHRpb25zLmhlYWRlcnMgOiB7fTtcblxuICAgIGlmIChpc1BsYWluT2JqZWN0KGJvZHkpICYmIGlzUGxhaW5PYmplY3QocHJvY2Vzc29ycykpIHtcbiAgICAgICAgLy8gRmluZCBhbGwgcHJvY2Vzc29ycy5cbiAgICAgICAgZm9yIChrZXkgaW4gcHJvY2Vzc29ycykge1xuICAgICAgICAgICAgaWYgKGhhc093bi5jYWxsKHByb2Nlc3NvcnMsIGtleSkpIHtcbiAgICAgICAgICAgICAgICBwcm9jZXNzb3IgPSBwcm9jZXNzb3JzW2tleV07XG4gICAgICAgICAgICAgICAgaWYgKGlzUGxhaW5PYmplY3QocHJvY2Vzc29yKSkge1xuICAgICAgICAgICAgICAgICAgICBjb250ZW50UHJvY2Vzc29ycy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGtleToga2V5LFxuICAgICAgICAgICAgICAgICAgICAgICAgaGVhZGVyczogcHJvY2Vzc29yLmhlYWRlcnMsXG4gICAgICAgICAgICAgICAgICAgICAgICBwcmlvcml0eTogcHJvY2Vzc29yLnByaW9yaXR5LFxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvY2Vzc29yOiBwcm9jZXNzb3IucHJvY2Vzc29yXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNvcnQgdGhlIHByb2Nlc3NvcnMgYnkgaXRzIHByaW9yaXR5LlxuICAgICAgICBjb250ZW50UHJvY2Vzc29ycy5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICAgICAgICByZXR1cm4gYi5wcmlvcml0eSAtIGEucHJpb3JpdHk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEZpbmQgdGhlIGZpcnN0IG5vbi11bmRlZmluZWQgY29udGVudC5cbiAgICAgICAgZm9yIChpID0gMCwgbCA9IGNvbnRlbnRQcm9jZXNzb3JzLmxlbmd0aDsgaSA8IGw7IGkgKz0gMSkge1xuICAgICAgICAgICAgcHJvY2Vzc29yID0gY29udGVudFByb2Nlc3NvcnNbaV07XG4gICAgICAgICAgICBpZiAoYm9keVtwcm9jZXNzb3Iua2V5XSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgY29udGVudCA9IGJvZHlbcHJvY2Vzc29yLmtleV07XG4gICAgICAgICAgICAgICAgY29udGVudFByb2Nlc3NvciA9IHByb2Nlc3NvcjtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFVzZSB0aGUgcHJvY2Vzc29yIHRvIHByb2Nlc3MgdGhlIGNvbnRlbnQuXG4gICAgICAgIGlmIChjb250ZW50UHJvY2Vzc29yKSB7XG4gICAgICAgICAgICBpZiAoaXNQbGFpbk9iamVjdChjb250ZW50UHJvY2Vzc29yLmhlYWRlcnMpKSB7XG4gICAgICAgICAgICAgICAgaGVhZGVycyA9IG1lcmdlKGhlYWRlcnMsIGNvbnRlbnRQcm9jZXNzb3IuaGVhZGVycyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBwcm9jZXNzb3IgPSBjb250ZW50UHJvY2Vzc29yLnByb2Nlc3NvcjtcbiAgICAgICAgICAgIGlmIChpc0Z1bmN0aW9uKHByb2Nlc3NvcikpIHtcbiAgICAgICAgICAgICAgICBjb250ZW50ID0gcHJvY2Vzc29yKGNvbnRlbnQsIG9wdGlvbnMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gTWFrZSBzdXJlIHRoYXQgdGhlIGhlYWRlcnMgaXMgYSBwbGFpbiBvYmplY3QuXG4gICAgb3B0aW9ucy5oZWFkZXJzID0gaGVhZGVycztcblxuICAgIHJldHVybiBjb250ZW50O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGhhbmRsZVJlcXVlc3RCb2R5O1xuIiwidmFyIGlzUGxhaW5PYmplY3QgPSByZXF1aXJlKDM5KTtcbnZhciBoYXNPd24gPSByZXF1aXJlKDMxKTtcblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gaGFubGRlIFhNTEh0dHBSZXF1ZXN0IHByb3BlcnRpZXMuXG4gKlxuICogQHBhcmFtIHtYTUxIdHRwUmVxdWVzdH0geGhyIFRoZSBpbnN0YW5jZSBvZiBgWE1MSHR0cFJlcXVlc3RgLlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICovXG5mdW5jdGlvbiBoYW5kbGVYaHJQcm9wcyh4aHIsIG9wdGlvbnMpIHtcbiAgICB2YXIgcHJvcDtcbiAgICB2YXIgeGhyUHJvcHMgPSBvcHRpb25zLnhoclByb3BzO1xuXG4gICAgaWYgKG9wdGlvbnMuY29ycykge1xuICAgICAgICB4aHIud2l0aENyZWRlbnRpYWxzID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAoaXNQbGFpbk9iamVjdCh4aHJQcm9wcykpIHtcbiAgICAgICAgZm9yIChwcm9wIGluIHhoclByb3BzKSB7XG4gICAgICAgICAgICBpZiAoaGFzT3duLmNhbGwoeGhyUHJvcHMsIHByb3ApKSB7XG4gICAgICAgICAgICAgICAgeGhyW3Byb3BdID0geGhyUHJvcHNbcHJvcF07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaGFuZGxlWGhyUHJvcHM7XG4iLCJ2YXIgaXNGdW5jdGlvbiA9IHJlcXVpcmUoMzgpO1xudmFyIEpTT05QUmVzcG9uc2UgPSByZXF1aXJlKDcpO1xudmFyIGZpcmVDYWxsYmFja3MgPSByZXF1aXJlKDI5KTtcbnZhciBub29wID0gcmVxdWlyZSgzMyk7XG52YXIgY29uc3RhbnRzID0gcmVxdWlyZSgyNSk7XG52YXIgRVJSX0NBTkNFTExFRCA9IGNvbnN0YW50cy5FUlJfQ0FOQ0VMTEVEO1xudmFyIEVSUl9ORVRXT1JLICAgPSBjb25zdGFudHMuRVJSX05FVFdPUks7XG52YXIgRVJSX1JFU1BPTlNFICA9IGNvbnN0YW50cy5FUlJfUkVTUE9OU0U7XG52YXIgRVJSX1RJTUVPVVQgICA9IGNvbnN0YW50cy5FUlJfVElNRU9VVDtcblxuZnVuY3Rpb24gYWRkRXZlbnRMaXN0ZW5lcnMocmVxdWVzdCwgY2FsbGJhY2tOYW1lKSB7XG4gICAgdmFyIHNjcmlwdCA9IHJlcXVlc3Quc2NyaXB0O1xuICAgIHZhciBvcHRpb25zID0gcmVxdWVzdC5vcHRpb25zO1xuICAgIHZhciByZXF1ZXN0VHlwZSA9IHJlcXVlc3QucmVxdWVzdFR5cGU7XG4gICAgdmFyIGlzUmVzcG9uc2VPayA9IG9wdGlvbnMuaXNSZXNwb25zZU9rO1xuICAgIHZhciByZXNwb25zZSA9IG5ldyBKU09OUFJlc3BvbnNlKHJlcXVlc3QpO1xuICAgIHZhciB0aW1lb3V0ID0gcGFyc2VJbnQob3B0aW9ucy50aW1lb3V0IHx8IDAsIDEwKTtcbiAgICB2YXIgdGltZW91dElkID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFRoZSBmdW5jdGlvbiBmaW5pc2ggdGhlIHJlcXVlc3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY29kZSBUaGUgZXJyb3IgY29kZSBvbiBlcnJvci4gSWYgbm8gZXJyb3Igb2NjdXJlZCwgdGhlIGNvZGUgaXMgYG51bGxgLlxuICAgICAqL1xuICAgIHZhciBmaW5pc2ggPSBmdW5jdGlvbiAoY29kZSkge1xuICAgICAgICAvLyBTZXQgZmluaXNoIHRvIHRoZSBubyBvcGVyYXRpb24gZnVuY3Rpb24uXG4gICAgICAgIGZpbmlzaCA9IG5vb3A7XG5cbiAgICAgICAgLy8gTWFyayB0aGlzIHJlcXVlc3QgYXMgZmluaXNoZWQuXG4gICAgICAgIHJlcXVlc3QuZmluaXNoZWQgPSB0cnVlO1xuXG4gICAgICAgIC8vIENsZWFyIGxpc3RlbmVycy5cbiAgICAgICAgd2luZG93W2NhbGxiYWNrTmFtZV0gPSBub29wO1xuICAgICAgICBzY3JpcHQub25lcnJvciA9IG51bGw7XG5cbiAgICAgICAgLy8gQ2xlYXIgdGltZW91dC5cbiAgICAgICAgaWYgKHRpbWVvdXRJZCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXRJZCk7XG4gICAgICAgICAgICB0aW1lb3V0SWQgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gRmlyZSBjYWxsYmFja3MuXG4gICAgICAgIGZpcmVDYWxsYmFja3MoY29kZSwgcmVzcG9uc2UpO1xuICAgIH07XG5cbiAgICAvLyBEZWZpbmUgdGhlIGNhbGxiYWNrIGZ1bmN0aW9uLlxuICAgIHdpbmRvd1tjYWxsYmFja05hbWVdID0gZnVuY3Rpb24gKHJlc3BvbnNlSlNPTikge1xuICAgICAgICByZXF1ZXN0LnJlc3BvbnNlSlNPTiA9IHJlc3BvbnNlSlNPTjtcbiAgICAgICAgaWYgKGlzRnVuY3Rpb24oaXNSZXNwb25zZU9rKSkge1xuICAgICAgICAgICAgaWYgKGlzUmVzcG9uc2VPayhyZXF1ZXN0VHlwZSwgcmVzcG9uc2UpKSB7XG4gICAgICAgICAgICAgICAgZmluaXNoKG51bGwpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBmaW5pc2goRVJSX1JFU1BPTlNFKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZpbmlzaChudWxsKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvLyBDYXRjaCB0aGUgZXJyb3IuXG4gICAgc2NyaXB0Lm9uZXJyb3IgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGZpbmlzaChFUlJfTkVUV09SSyk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIENhbmNlbCB0aGUgcmVxdWVzdC5cbiAgICAgKi9cbiAgICByZXF1ZXN0LmNhbmNlbCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZmluaXNoKEVSUl9DQU5DRUxMRUQpO1xuICAgIH07XG5cbiAgICAvLyBBZGQgdGltZW91dCBsaXN0ZW5lclxuICAgIGlmICghaXNOYU4odGltZW91dCkgJiYgdGltZW91dCA+IDApIHtcbiAgICAgICAgdGltZW91dElkID0gc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBmaW5pc2goRVJSX1RJTUVPVVQpO1xuICAgICAgICB9LCB0aW1lb3V0KTtcbiAgICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYWRkRXZlbnRMaXN0ZW5lcnM7XG4iLCIvKipcbiAqIFRoZSBmdW5jdGlvbiB0byBjcmVhdGUgSlNPTlAgY2FsbGJhY2sgbmFtZS5cbiAqXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBSZXR1cm5zIHRoZSBjYWxsYmFjayBuYW1lLlxuICovXG5mdW5jdGlvbiBidWlsZENhbGxsYmFja05hbWUob3B0aW9ucykge1xuICAgIHZhciBjYWxsYmFja05hbWU7XG5cbiAgICBkbyB7XG4gICAgICAgIGNhbGxiYWNrTmFtZSA9IG9wdGlvbnMuanNvbnBDYWxsYmFja05hbWUuY2FsbChudWxsLCBvcHRpb25zKTtcbiAgICB9IHdoaWxlIChjYWxsYmFja05hbWUgaW4gd2luZG93KTtcblxuICAgIHdpbmRvd1tjYWxsYmFja05hbWVdID0gbnVsbDtcblxuICAgIHJldHVybiBjYWxsYmFja05hbWU7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYnVpbGRDYWxsbGJhY2tOYW1lO1xuIiwidmFyIGJ1aWxkVVJMID0gcmVxdWlyZSgyMyk7XG5cbi8qKlxuICogQnVpbGQgdGhlIEpTT05QIHNjcmlwdCBzcmMuXG4gKlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcGl0b25zLlxuICogQHBhcmFtIHtzdHJpbmd9IGNhbGxiYWNrTmFtZSBUaGUgY2FsbGJhY2sgbmFtZSBvZiB0aGUgSlNPTlAuXG4gKiBAcmV0dXJuIHtzdHJpbmd9IFJldHVybnMgdGhlIHNjcmlwdCBzcmMuXG4gKi9cbmZ1bmN0aW9uIGJ1aWxkU2NyaXB0U3JjKG9wdGlvbnMsIGNhbGxiYWNrTmFtZSkge1xuICAgIHZhciBxdWVyeSA9IG9wdGlvbnMucXVlcnk7XG4gICAgdmFyIGtleSA9IG9wdGlvbnMuanNvbnA7XG4gICAgdmFyIHVybDtcblxuICAgIGlmICghcXVlcnkpIHtcbiAgICAgICAgcXVlcnkgPSB7fTtcbiAgICAgICAgb3B0aW9ucy5xdWVyeSA9IHF1ZXJ5O1xuICAgIH1cblxuICAgIHF1ZXJ5W2tleV0gPSBjYWxsYmFja05hbWU7XG4gICAgdXJsID0gYnVpbGRVUkwob3B0aW9ucyk7XG5cbiAgICByZXR1cm4gdXJsO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGJ1aWxkU2NyaXB0U3JjO1xuIiwiLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gaGFuZGxlIGBvcHRpb25zLmNvcnNgIHNldHRpbmcgd2hlbiBzZW5kaW5nIEpTT05QIHJlcXVlc3RzLiBJZiBgb3B0aW9ucy5jb3JzYCBpcyBgdHJ1ZWAsIHRoZVxuICogYGNyb3Nzb3JpZ2luYCBhdHRyaWJ1dGUgb2YgdGhlIGBzY3JpcHRgIGVsZW1lbnQgd2UgdXNpbmcgaXMgc2V0IHRvIGB1c2UtY3JlZGVudGlhbHNgLlxuICpcbiAqIEBwYXJhbSB7SFRNTFNjcmlwdEVsZW1lbnR9IHNjcmlwdCBUaGUgc2NyaXB0IGVsZW1lbnQuXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKi9cbmZ1bmN0aW9uIGhhbmRsZVNjcmlwdENvcnMoc2NyaXB0LCBvcHRpb25zKSB7XG4gICAgaWYgKG9wdGlvbnMuY29ycykge1xuICAgICAgICBzY3JpcHQuc2V0QXR0cmlidXRlKCdjcm9zc29yaWdpbicsICd1c2UtY3JlZGVudGlhbHMnKTtcbiAgICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaGFuZGxlU2NyaXB0Q29ycztcbiIsInZhciBpc1BsYWluT2JqZWN0ID0gcmVxdWlyZSgzOSk7XG52YXIgaXNGdW5jdGlvbiA9IHJlcXVpcmUoMzgpO1xudmFyIGhhc093biA9IHJlcXVpcmUoMzEpO1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBhZGQgY3VzdG9tIHBhcnNlcnMgdG8gdGhlIGluc3RhbmNlIG9mIGBSZXNwb25zZWAgb3IgYFJlc3BvbnNlRXJyb3JgLlxuICpcbiAqIEBwYXJhbSB7UmVzcG9uc2V8UmVzcG9uc2VFcnJvcn0gdGFyZ2V0IFRoZSB0YXJnZXQgdG8gYWRkIHRoZSBjdXN0b21lIHBhcnNlcnMuXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcGFyYW0ge3N0cmluZ30gb3B0aW9uTmFtZSBUaGUgb3B0aW9uIG5hbWUgdGhlIHBhcnNlcnMgY29udGFpbmVyLlxuICovXG5mdW5jdGlvbiBhZGRDdXN0b21QYXJzZXIodGFyZ2V0LCBvcHRpb25zLCBvcHRpb25OYW1lKSB7XG4gICAgdmFyIHBhcnNlcnMgPSBvcHRpb25zW29wdGlvbk5hbWVdO1xuICAgIHZhciBuYW1lO1xuICAgIHZhciBwYXJzZXI7XG5cbiAgICBpZiAoaXNQbGFpbk9iamVjdChwYXJzZXJzKSkge1xuICAgICAgICBmb3IgKG5hbWUgaW4gcGFyc2Vycykge1xuICAgICAgICAgICAgaWYgKGhhc093bi5jYWxsKHBhcnNlcnMsIG5hbWUpKSB7XG4gICAgICAgICAgICAgICAgcGFyc2VyID0gcGFyc2Vyc1tuYW1lXTtcbiAgICAgICAgICAgICAgICBpZiAoaXNGdW5jdGlvbihwYXJzZXIpKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChuYW1lIGluIHRhcmdldCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdcIicgKyBuYW1lICsgJ1wiIGNhbm5vdCBiZSBhIG5hbWUgb2YgcGFyc2VyJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0W25hbWVdID0gcGFyc2VyO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBhZGRDdXN0b21QYXJzZXI7XG4iLCJ2YXIgaXNGdW5jdGlvbiA9IHJlcXVpcmUoMzgpO1xudmFyIGlzQWJzb2x1dGVVUkwgPSByZXF1aXJlKDM2KTtcbnZhciBpc1BsYWluT2JqZWN0ID0gcmVxdWlyZSgzOSk7XG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGJ1aWxkIHJlcXVlc3QgdXJsLlxuICpcbiAqIDEuIEFkZCBiYXNlVVJMIGlmIG5lZWRlZC5cbiAqIDIuIENvbXBpbGUgdXJsIGlmIG5lZWRlZC5cbiAqIDMuIENvbXBpbGUgcXVlcnkgc3RyaW5nIGlmIG5lZWRlZC5cbiAqXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBSZXR1cm5zIHRoZSBmaW5hbCB1cmwgc3RyaW5nLlxuICovXG5mdW5jdGlvbiBidWlsZFVSTChvcHRpb25zKSB7XG4gICAgdmFyIHVybCA9IG9wdGlvbnMudXJsICsgJyc7XG4gICAgdmFyIGJhc2VVUkwgPSBvcHRpb25zLmJhc2VVUkw7XG4gICAgdmFyIG1vZGVsID0gb3B0aW9ucy5tb2RlbDtcbiAgICB2YXIgcXVlcnkgPSBvcHRpb25zLnF1ZXJ5O1xuICAgIHZhciBjb21waWxlVVJMID0gb3B0aW9ucy5jb21waWxlVVJMO1xuICAgIHZhciBlbmNvZGVRdWVyeVN0cmluZyA9IG9wdGlvbnMuZW5jb2RlUXVlcnlTdHJpbmc7XG4gICAgdmFyIGFycmF5O1xuXG4gICAgLy8gSWYgdGhlIHVybCBpcyBub3QgYWJzb2x1dGUgdXJsIGFuZCB0aGUgYmFzZVVSTCBpcyBkZWZpbmVkLFxuICAgIC8vIHByZXBlbmQgdGhlIGJhc2VVUkwgdG8gdGhlIHVybC5cbiAgICBpZiAoIWlzQWJzb2x1dGVVUkwodXJsKSkge1xuICAgICAgICBpZiAodHlwZW9mIGJhc2VVUkwgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICB1cmwgPSBiYXNlVVJMICsgdXJsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ29tcGlsZSB0aGUgdXJsIGlmIG5lZWRlZC5cbiAgICBpZiAoaXNQbGFpbk9iamVjdChtb2RlbCkgJiYgaXNGdW5jdGlvbihjb21waWxlVVJMKSkge1xuICAgICAgICB1cmwgPSBjb21waWxlVVJMKHVybCwgbW9kZWwsIG9wdGlvbnMpO1xuICAgIH1cblxuICAgIC8vIENvbXBpbGUgdGhlIHF1ZXJ5IHN0cmluZy5cbiAgICBpZiAoaXNQbGFpbk9iamVjdChxdWVyeSkgJiYgaXNGdW5jdGlvbihlbmNvZGVRdWVyeVN0cmluZykpIHtcbiAgICAgICAgcXVlcnkgPSBlbmNvZGVRdWVyeVN0cmluZyhxdWVyeSwgb3B0aW9ucyk7XG4gICAgICAgIGFycmF5ID0gdXJsLnNwbGl0KCcjJyk7IC8vIFRoZXJlIG1heSBiZSBoYXNoIHN0cmluZyBpbiB0aGUgdXJsLlxuICAgICAgICB1cmwgPSBhcnJheVswXTtcblxuICAgICAgICBpZiAodXJsLmluZGV4T2YoJz8nKSA+IC0xKSB7XG4gICAgICAgICAgICBpZiAodXJsLmNoYXJBdCh1cmwubGVuZ3RoIC0gMSkgPT09ICcmJykge1xuICAgICAgICAgICAgICAgIHVybCA9IHVybCArIHF1ZXJ5O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB1cmwgPSB1cmwgKyAnJicgKyBxdWVyeTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHVybCA9IHVybCArICc/JyArIHF1ZXJ5O1xuICAgICAgICB9XG5cbiAgICAgICAgYXJyYXlbMF0gPSB1cmw7XG4gICAgICAgIHVybCA9IGFycmF5LmpvaW4oJyMnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdXJsO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGJ1aWxkVVJMO1xuIiwidmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKDM4KTtcblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gY2FsbCBgb3B0aW9ucy5vblJlcXVlc3RDcmVhdGVkYCBjYWxsYmFjay5cbiAqXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcGFyYW0ge0h0dHBSZXF1ZXN0fEpTT05QUmVxdWVzdH0gcmVxdWVzdCBUaGUgcmVxdWVzdCBpbnN0YW5jZS5cbiAqL1xuZnVuY3Rpb24gY2FsbFJlcXVlc3RDcmVhdGVkQ2FsbGJhY2sob3B0aW9ucywgcmVxdWVzdCkge1xuICAgIHZhciBvblJlcXVlc3RDcmVhdGVkID0gb3B0aW9ucy5vblJlcXVlc3RDcmVhdGVkO1xuXG4gICAgaWYgKGlzRnVuY3Rpb24ob25SZXF1ZXN0Q3JlYXRlZCkpIHtcbiAgICAgICAgb25SZXF1ZXN0Q3JlYXRlZChyZXF1ZXN0KTtcbiAgICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gY2FsbFJlcXVlc3RDcmVhdGVkQ2FsbGJhY2s7XG4iLCJleHBvcnRzLkVSUl9BQk9SVEVEID0gJ0VSUl9BQk9SVEVEJztcbmV4cG9ydHMuRVJSX1JFU1BPTlNFID0gJ0VSUl9SRVNQT05TRSc7XG5leHBvcnRzLkVSUl9DQU5DRUxMRUQgPSAnRVJSX0NBTkNFTExFRCc7XG5leHBvcnRzLkVSUl9ORVRXT1JLID0gJ0VSUl9ORVRXT1JLJztcbmV4cG9ydHMuRVJSX1RJTUVPVVQgPSAnRVJSX1RJTUVPVVQnO1xuZXhwb3J0cy5IVFRQX1JFUVVFU1QgPSAnSFRUUF9SRVFVRVNUJztcbmV4cG9ydHMuSlNPTlBfUkVRVUVTVCA9ICdKU09OUF9SRVFVRVNUJztcbiIsInZhciBDYW5jZWxDb250cm9sbGVyID0gcmVxdWlyZSgxKTtcblxuLyoqXG4gKiBDcmVhdGUgYSBuZXcgaW5zdGFuY2Ugb2YgYENhbmNlbENvbnRyb2xsZXJgLlxuICpcbiAqIEByZXR1cm5zIHtDYW5jZWxDb250cm9sbGVyfSBSZXR1cm5zIGFuIG5ldyBpbnN0YW5jZSBvZiBgQ2FuY2VsQ29udHJvbGxlcmAuXG4gKi9cbnZhciBjcmVhdGVDYW5jZWxDb250cm9sbGVyID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBuZXcgQ2FuY2VsQ29udHJvbGxlcigpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBjcmVhdGVDYW5jZWxDb250cm9sbGVyO1xuIiwidmFyIFFTID0gcmVxdWlyZSg0Myk7XG52YXIgY29uc3RhbnRzID0gcmVxdWlyZSgyNSk7XG52YXIgdGVtcGxhdGUgPSByZXF1aXJlKDM0KTtcbnZhciB1dWlkID0gcmVxdWlyZSgzNSk7XG52YXIgSFRUUF9SRVFVRVNUICA9IGNvbnN0YW50cy5IVFRQX1JFUVVFU1Q7XG5cbi8qKlxuICogQ3JlYXRlIGEgbmV3IGRlZmF1bHQgcmVxdWVzdCBvcHRpb25zLlxuICpcbiAqIEByZXR1cm5zIHtSZXF1ZXN0T3B0aW9uc30gUmV0dXJucyBhIG5ldyBkZWZhdWx0IHJlcXVlc3Qgb3BpdG9ucy5cbiAqL1xuZnVuY3Rpb24gY3JlYXRlRGVmYXVsdE9wdGlvbnMoKSB7XG4gICAgLyoqXG4gICAgICogQHR5cGUge1JlcXVlc3RPcHRpb25zfVxuICAgICAqL1xuICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgICBtZXRob2Q6ICdHRVQnLFxuICAgICAgICBiYXNlVVJMOiBudWxsLFxuICAgICAgICB1cmw6IG51bGwsXG4gICAgICAgIG1vZGVsOiBudWxsLFxuICAgICAgICBxdWVyeTogbnVsbCxcbiAgICAgICAgaGVhZGVyczogbnVsbCxcbiAgICAgICAgYm9keTogbnVsbCxcbiAgICAgICAgc2V0dGluZ3M6IHt9LFxuICAgICAgICBjb250cm9sbGVyOiBudWxsLFxuICAgICAgICByZXF1ZXN0RnVuY3Rpb25OYW1lOiBudWxsLFxuICAgICAgICByZXF1ZXN0VHlwZTogbnVsbCxcbiAgICAgICAgY29yczogZmFsc2UsXG4gICAgICAgIHhoclByb3BzOiBudWxsLFxuICAgICAgICB1c2VybmFtZTogbnVsbCxcbiAgICAgICAgcGFzc3dvcmQ6IG51bGwsXG4gICAgICAgIHRpbWVvdXQ6IDAsXG4gICAgICAgIG5vQ2FjaGU6IGZhbHNlLFxuICAgICAgICBub0NhY2hlSGVhZGVyczoge1xuICAgICAgICAgICAgJ1ByYWdtYSc6ICduby1jYWNoZScsXG4gICAgICAgICAgICAnQ2FjaGUtQ29udHJvbCc6ICduby1jYWNoZSwgbm8tc3RvcmUsIG11c3QtcmV2YWxpZGF0ZSdcbiAgICAgICAgfSxcbiAgICAgICAganNvbnA6ICdjYWxsYmFjaycsXG4gICAgICAgIGh0dHBSZXF1ZXN0Qm9keVByb2Nlc3Nvcjoge1xuICAgICAgICAgICAgcmF3OiB7XG4gICAgICAgICAgICAgICAgcHJpb3JpdHk6IDAsXG4gICAgICAgICAgICAgICAgaGVhZGVyczogbnVsbCxcbiAgICAgICAgICAgICAgICBwcm9jZXNzb3I6IG51bGwsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZm9ybToge1xuICAgICAgICAgICAgICAgIHByaW9yaXR5OiAxLFxuICAgICAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQ7IGNoYXJzZXQ9VVRGLTgnXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBwcm9jZXNzb3I6IGZ1bmN0aW9uIChkYXRhLCBvcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBRUy5lbmNvZGUoZGF0YSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGpzb246IHtcbiAgICAgICAgICAgICAgICBwcmlvcml0eTogMixcbiAgICAgICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbjsgY2hhcnNldD1VVEYtOCdcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHByb2Nlc3NvcjogZnVuY3Rpb24gKGRhdGEsIG9wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGRhdGEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgaHR0cFJlc3BvbnNlUGFyc2VyOiB7XG4gICAgICAgICAgICBqc29uOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgLy8gYHRoaXNgIGlzIHBvaW50IHRvIHRoZSBjdXJyZW50IGluc3RhbmNlIG9mIGBIdHRwUmVzcG9uc2VgLlxuICAgICAgICAgICAgICAgIHZhciByZXNwb25zZVRleHQgPSB0aGlzLnJlcXVlc3QueGhyLnJlc3BvbnNlVGV4dDtcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzcG9uc2VUZXh0ID8gSlNPTi5wYXJzZShyZXNwb25zZVRleHQpIDogbnVsbDtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB0ZXh0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucmVxdWVzdC54aHIucmVzcG9uc2VUZXh0O1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHN0YXR1czogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnJlcXVlc3QueGhyLnN0YXR1cztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAganNvbnBSZXNwb25zZVBhcnNlcjoge1xuICAgICAgICAgICAganNvbjogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnJlcXVlc3QucmVzcG9uc2VKU09OO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBodHRwUmVzcG9uc2VFcnJvclBhcnNlcjogbnVsbCxcbiAgICAgICAganNvbnBSZXNwb25zZUVycm9yUGFyc2VyOiBudWxsLFxuICAgICAgICBoYW5kbGVPcHRpb25zOiBudWxsLFxuICAgICAgICBjcmVhdGVYSFI6IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgICAgIH0sXG4gICAgICAgIGNyZWF0ZVNjcmlwdDogZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgICAgIHZhciBzY3JpcHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzY3JpcHQnKTtcblxuICAgICAgICAgICAgc2NyaXB0LnNldEF0dHJpYnV0ZSgndHlwZScsICd0ZXh0L2phdmFzY3JpcHQnKTtcbiAgICAgICAgICAgIHNjcmlwdC5zZXRBdHRyaWJ1dGUoJ2NoYXJzZXQnLCAndXRmLTgnKTtcblxuICAgICAgICAgICAgcmV0dXJuIHNjcmlwdDtcbiAgICAgICAgfSxcbiAgICAgICAganNvbnBDb250YWluZXJOb2RlOiBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICAgICAgcmV0dXJuIGRvY3VtZW50LmhlYWQgfHwgZG9jdW1lbnQuZ2V0RWxlbWVudHNCeU5hbWUoJ2hlYWQnKVswXTtcbiAgICAgICAgfSxcbiAgICAgICAganNvbnBDYWxsYmFja05hbWU6IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgICAgICByZXR1cm4gJ2pzb25wXycgKyB1dWlkKCkgKyAnXycgKyAobmV3IERhdGUoKS5nZXRUaW1lKCkpO1xuICAgICAgICB9LFxuICAgICAgICBjb21waWxlVVJMOiBmdW5jdGlvbiAodXJsLCBwYXJhbSwgb3B0aW9ucykge1xuICAgICAgICAgICAgcmV0dXJuIHRlbXBsYXRlKHVybCwgcGFyYW0pO1xuICAgICAgICB9LFxuICAgICAgICBlbmNvZGVRdWVyeVN0cmluZzogZnVuY3Rpb24gKGRhdGEsIG9wdGlvbnMpIHtcbiAgICAgICAgICAgIHJldHVybiBRUy5lbmNvZGUoZGF0YSk7XG4gICAgICAgIH0sXG4gICAgICAgIG9uWGhyQ3JlYXRlZDogbnVsbCxcbiAgICAgICAgb25YaHJPcGVuZWQ6IG51bGwsXG4gICAgICAgIG9uWGhyU2VudDogbnVsbCxcbiAgICAgICAgb25SZXF1ZXN0Q3JlYXRlZDogbnVsbCxcbiAgICAgICAgaXNSZXNwb25zZU9rOiBmdW5jdGlvbiAocmVxdWVzdFR5cGUsIHJlc3BvbnNlKSB7XG4gICAgICAgICAgICB2YXIgc3RhdHVzO1xuXG4gICAgICAgICAgICAvLyBIdHRwIHJlcXVlc3RcbiAgICAgICAgICAgIGlmIChyZXF1ZXN0VHlwZSA9PT0gSFRUUF9SRVFVRVNUKSB7XG4gICAgICAgICAgICAgICAgc3RhdHVzID0gcmVzcG9uc2UucmVxdWVzdC54aHIuc3RhdHVzO1xuICAgICAgICAgICAgICAgIHJldHVybiAoc3RhdHVzID49IDIwMCAmJiBzdGF0dXMgPCAzMDApIHx8IHN0YXR1cyA9PT0gMzA0O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBKU09OUCByZXF1ZXN0XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSxcbiAgICAgICAgdHJhbnNmb3JtRXJyb3I6IG51bGwsXG4gICAgICAgIHRyYW5zZm9ybVJlc3BvbnNlOiBudWxsLFxuICAgICAgICBzaG91bGRDYWxsRXJyb3JDYWxsYmFjazogbnVsbCxcbiAgICAgICAgc2hvdWxkQ2FsbFN1Y2Nlc3NDYWxsYmFjazogbnVsbFxuICAgIH07XG5cbiAgICByZXR1cm4gb3B0aW9ucztcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBjcmVhdGVEZWZhdWx0T3B0aW9ucztcbiIsIi8qKlxuICogRGVmaW5lIGEgc3RhdGljIG1lbWJlciBvbiB0aGUgZ2l2ZW4gY29uc3RydWN0b3IgYW5kIGl0cyBwcm90b3R5cGVcbiAqXG4gKiBAcGFyYW0ge0NvbnN0cnVjdG9yfSBjdG9yIFRoZSBjb25zdHJ1Y3RvciB0byBkZWZpbmUgdGhlIHN0YXRpYyBtZW1iZXJcbiAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIFRoZSBuYW1lIG9mIHRoZSBzdGF0aWMgbWVtYmVyXG4gKiBAcGFyYW0ge2FueX0gdmFsdWUgVGhlIHZhbHVlIG9mIHRoZSBzdGF0aWMgbWVtYmVyXG4gKiBAdGhyb3dzIHtFcnJvcn0gVGhyb3dzIGVycm9yIGlmIHRoZSBuYW1lIGhhcyBhbHJlYWR5IGV4aXN0ZWQsIG9yIHRoZSBjb25zdHJ1Y3RvciBpcyBub3QgYSBmdW5jdGlvblxuICovXG5mdW5jdGlvbiBkZWZpbmVFeHBvcnRzKGN0b3IsIG5hbWUsIHZhbHVlKSB7XG4gICAgY3Rvci5wcm90b3R5cGUuZXhwb3J0cyA9IGN0b3IuZXhwb3J0cyA9IGN0b3IuZXhwb3J0cyB8fCB7fTtcbiAgICBjdG9yLmV4cG9ydHNbbmFtZV0gPSB2YWx1ZTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBkZWZpbmVFeHBvcnRzO1xuIiwidmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKDM4KTtcbnZhciBIdHRwUmVzcG9uc2VFcnJvciA9IHJlcXVpcmUoNSk7XG52YXIgSlNPTlBSZXNwb25zZUVycm9yID0gcmVxdWlyZSg4KTtcbnZhciBjb25zdGFudHMgPSByZXF1aXJlKDI1KTtcbnZhciBIVFRQX1JFUVVFU1QgPSBjb25zdGFudHMuSFRUUF9SRVFVRVNUO1xuXG4vKipcbiAqIEZpcmUgdGhlIGNhbGxiYWNrcy5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ3xudWxsfSBjb2RlIElmIHRoZXJlIGlzIGFuIGVycm9yLCBgY29kZWAgc2hvdWxkIGJlIGEgc3RyaW5nLiBJZiB0aGVyZSBpcyBubyBlcnJvciwgYGNvZGVgIGlzIGBudWxsYC5cbiAqIEBwYXJhbSB7SHR0cFJlc3BvbnNlfEpTT05QUmVzcG9uc2V9IHJlc3BvbnNlIFRoZSByZXNwb25zZSBpbnN0YW5jZS5cbiAqL1xuZnVuY3Rpb24gZmlyZUNhbGxiYWNrcyhjb2RlLCByZXNwb25zZSkge1xuICAgIHZhciByZXF1ZXN0ID0gcmVzcG9uc2UucmVxdWVzdDtcbiAgICB2YXIgcmVxdWVzdFR5cGUgPSByZXF1ZXN0LnJlcXVlc3RUeXBlO1xuICAgIHZhciBvcHRpb25zID0gcmVxdWVzdC5vcHRpb25zO1xuICAgIHZhciBvbnN1Y2Nlc3MgPSByZXF1ZXN0Lm9uc3VjY2VzcztcbiAgICB2YXIgb25lcnJvciA9IHJlcXVlc3Qub25lcnJvcjtcbiAgICB2YXIgc2hvdWxkQ2FsbEVycm9yQ2FsbGJhY2sgPSBvcHRpb25zLnNob3VsZENhbGxFcnJvckNhbGxiYWNrO1xuICAgIHZhciBzaG91bGRDYWxsU3VjY2Vzc0NhbGxiYWNrID0gb3B0aW9ucy5zaG91bGRDYWxsU3VjY2Vzc0NhbGxiYWNrO1xuICAgIHZhciB0cmFuc2Zvcm1FcnJvciA9IG9wdGlvbnMudHJhbnNmb3JtRXJyb3I7XG4gICAgdmFyIHRyYW5zZm9ybVJlc3BvbnNlID0gb3B0aW9ucy50cmFuc2Zvcm1SZXNwb25zZTtcblxuICAgIHZhciBlcnJvciA9IG51bGw7XG4gICAgdmFyIGNhbGxFcnJvckNhbGxiYWNrID0gdHJ1ZTtcbiAgICB2YXIgY2FsbFN1Y2Nlc3NDYWxsYmFjayA9IHRydWU7XG4gICAgdmFyIHRyYW5zZm9ybWVkRXJyb3IgPSBudWxsO1xuICAgIHZhciB0cmFuc2Zvcm1lZFJlc3BvbnNlID0gbnVsbDtcblxuICAgIGlmIChjb2RlKSB7XG4gICAgICAgIGlmIChyZXF1ZXN0VHlwZSA9PT0gSFRUUF9SRVFVRVNUKSB7XG4gICAgICAgICAgICBlcnJvciA9IG5ldyBIdHRwUmVzcG9uc2VFcnJvcihjb2RlLCByZXF1ZXN0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGVycm9yID0gbmV3IEpTT05QUmVzcG9uc2VFcnJvcihjb2RlLCByZXF1ZXN0KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaXNGdW5jdGlvbih0cmFuc2Zvcm1FcnJvcikpIHtcbiAgICAgICAgICAgIHRyYW5zZm9ybWVkRXJyb3IgPSB0cmFuc2Zvcm1FcnJvcihyZXF1ZXN0VHlwZSwgZXJyb3IpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdHJhbnNmb3JtZWRFcnJvciA9IGVycm9yO1xuICAgICAgICB9XG4gICAgICAgIGlmIChpc0Z1bmN0aW9uKHNob3VsZENhbGxFcnJvckNhbGxiYWNrKSkge1xuICAgICAgICAgICAgY2FsbEVycm9yQ2FsbGJhY2sgPSBzaG91bGRDYWxsRXJyb3JDYWxsYmFjayhyZXF1ZXN0VHlwZSwgdHJhbnNmb3JtZWRFcnJvciwgZXJyb3IpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjYWxsRXJyb3JDYWxsYmFjaykge1xuICAgICAgICAgICAgaWYgKGlzRnVuY3Rpb24ob25lcnJvcikpIHtcbiAgICAgICAgICAgICAgICBvbmVycm9yKHRyYW5zZm9ybWVkRXJyb3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKGlzRnVuY3Rpb24odHJhbnNmb3JtUmVzcG9uc2UpKSB7XG4gICAgICAgICAgICB0cmFuc2Zvcm1lZFJlc3BvbnNlID0gdHJhbnNmb3JtUmVzcG9uc2UocmVxdWVzdFR5cGUsIHJlc3BvbnNlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRyYW5zZm9ybWVkUmVzcG9uc2UgPSByZXNwb25zZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaXNGdW5jdGlvbihzaG91bGRDYWxsU3VjY2Vzc0NhbGxiYWNrKSkge1xuICAgICAgICAgICAgY2FsbFN1Y2Nlc3NDYWxsYmFjayA9IHNob3VsZENhbGxTdWNjZXNzQ2FsbGJhY2socmVxdWVzdFR5cGUsIHRyYW5zZm9ybWVkUmVzcG9uc2UsIHJlc3BvbnNlKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2FsbFN1Y2Nlc3NDYWxsYmFjaykge1xuICAgICAgICAgICAgaWYgKGlzRnVuY3Rpb24ob25zdWNjZXNzKSkge1xuICAgICAgICAgICAgICAgIG9uc3VjY2Vzcyh0cmFuc2Zvcm1lZFJlc3BvbnNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBmaXJlQ2FsbGJhY2tzO1xuIiwidmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKDM4KTtcblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gcHJvY2VzcyB0aGUgcmVxdWVzdCBvcHRpb25zLiBUaGlzIGZ1bmN0aW9uIHdpbGwgY2FsbCB0aGUgZnVuY3Rpb24gYG9wdGlvbnMuaGFuZGxlT3B0aW9uc2AuXG4gKlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICogQHJldHVybnMge3ZvaWR9XG4gKi9cbmZ1bmN0aW9uIGhhbmRsZU9wdGlvbnMob3B0aW9ucykge1xuICAgIGlmIChpc0Z1bmN0aW9uKG9wdGlvbnMuaGFuZGxlT3B0aW9ucykpIHtcbiAgICAgICAgb3B0aW9ucy5oYW5kbGVPcHRpb25zKG9wdGlvbnMpO1xuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBoYW5kbGVPcHRpb25zO1xuIiwibW9kdWxlLmV4cG9ydHMgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuIiwiLyoqXG4gKiBNYWtlIGBTdWJDbGFzc2AgZXh0ZW5kIGBTdXBlckNsYXNzYC5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBTdWJDbGFzcyBUaGUgc3ViIGNsYXNzIGNvbnN0cnVjdG9yLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gU3VwZXJDbGFzcyBUaGUgc3VwZXIgY2xhc3MgY29uc3RydWN0b3IuXG4gKi9cbmZ1bmN0aW9uIGluaGVyaXRzKFN1YkNsYXNzLCBTdXBlckNsYXNzKSB7XG4gICAgdmFyIEYgPSBmdW5jdGlvbigpIHt9O1xuXG4gICAgRi5wcm90b3R5cGUgPSBTdXBlckNsYXNzLnByb3RvdHlwZTtcblxuICAgIFN1YkNsYXNzLnByb3RvdHlwZSA9IG5ldyBGKCk7XG4gICAgU3ViQ2xhc3MucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gU3ViQ2xhc3M7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaW5oZXJpdHM7XG4iLCIvKipcbiAqIFRoZSBubyBvcGVyYXRpb24gZnVuY3Rpb24uXG4gKi9cbmZ1bmN0aW9uIG5vb3AoKSB7XG4gICAgLy8gbm90aGluZyB0byBkbyBoZXJlLlxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IG5vb3A7XG4iLCIvKipcbiAqIEEgc2ltcGxlIHRlbXBsYXRlIGZ1bmN0aW9uXG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIFJyZXR1cm5zICcvcG9zdC8xJ1xuICogdGVtcGxhdGUoJy9wb3N0L3sgcG9zdC5pZCB9JywgeyBwb3N0OiB7IGlkOiAxIH0gfSlcbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gdGVtcGxhdGUgVGhlIHRlbXBsYXRlIHRleHQuXG4gKiBAcGFyYW0ge09iamVjdC48c3RyaW5nLCBzdHJpbmc+fSBkYXRhIFRoZSBkYXRhIG9iamVjdC5cbiAqIEBwYXJhbSB7VGVtcGxhdGVPcHRpb25zfSBvcHRpb25zIFRoZSB0ZW1wbGF0ZSBvcHRpb25zLlxuICogQHJldHVybnMge3N0cmluZ30gUmV0dXJucyB0aGUgY29tcGlsZWQgdGV4dC5cbiAqL1xuZnVuY3Rpb24gdGVtcGxhdGUodGVtcGxhdGUsIGRhdGEsIG9wdGlvbnMpIHtcbiAgICB2YXIgdGVtcGwgPSB0ZW1wbGF0ZSArICcnO1xuICAgIHZhciBtb2RlbCA9IGRhdGEgfHwge307XG4gICAgdmFyIG9wdHMgPSBvcHRpb25zIHx8IHt9O1xuICAgIHZhciBzdGFydCA9IG9wdHMuc3RhcnQgfHwgJ3snO1xuICAgIHZhciBlbmQgPSBvcHRzLmVuZCB8fCAnfSc7XG4gICAgdmFyIGVuY29kZSA9IG9wdHMuZW5jb2RlIHx8IGVuY29kZVVSSUNvbXBvbmVudDtcblxuICAgIHJldHVybiBjb21waWxlKHRlbXBsLCBzdGFydCwgZW5kLCBmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgIHJldHVybiByZWFkKG1vZGVsLCBrZXksIGVuY29kZSk7XG4gICAgfSk7XG59XG5cbi8qKlxuICogUmVhZCB0aGUgdmFsdWUgKGNhc3QgdG8gc3RyaW5nKSBpbiB0aGUgYGRhdGFgIHdpdGggdGhlIGdpdmVuIGBrZXlgLiBJZiB0aGUga2V5IGlzIHN0YXJ0IHdpdGggYC0gYCAoYC1gIGFuZCBzcGFjZSksXG4gKiB0aGUgYC0gYCB3aWxsIGJlIHJlbW92ZWQgZnJvbSB0aGUga2V5IGFuZCB0aGUgdmFsdWUgd2lsbCBub3QgYmUgdXJsZW5jb2RlZC4gT3RoZXJ3aXNlIHRoZSB2YWx1ZSB3aWxsIGJlIHVybGVuY29kZWQuXG4gKlxuICogQHBhcmFtIHtPYmplY3QuPHN0cmluZywgKj59IGRhdGEgVGhlIG9iamVjdCBrZWVwcyB0aGUgZGF0YS5cbiAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgVGhlIHByb3BlcnR5IHBhdGggdG8gYWNjZXNzLlxuICogQHBhcmFtIHsodmFsdWU6IHN0cmluZykgPT4gc3RyaW5nfSBlbmNvZGUgVGhlIGZ1bmN0aW9uIHRvIGVuY29kZSB0aGUgdmFsdWUuXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBSZXR1cm5zIHRoZSB2YWx1ZS5cbiAqL1xuZnVuY3Rpb24gcmVhZChkYXRhLCBrZXksIGVuY29kZSkge1xuICAgIHZhciBmaXJzdCA9IGtleS5jaGFyQXQoMCk7XG4gICAgdmFyIHNlY29uZCA9IGtleS5jaGFyQXQoMSk7XG4gICAgdmFyIHJhdyA9IGZhbHNlO1xuXG4gICAgLy8gey0gcmF3IH1cbiAgICBpZiAoZmlyc3QgPT09ICctJyAmJiBzZWNvbmQgPT09ICcgJykge1xuICAgICAgICByYXcgPSB0cnVlO1xuICAgICAgICBrZXkgPSBrZXkuc3Vic3RyKDIpO1xuICAgIH1cblxuICAgIGtleSA9IGtleS5yZXBsYWNlKC9eXFxzK3xcXHMrJC9nLCAnJyk7XG5cbiAgICBpZiAoa2V5LmNoYXJBdCgwKSAhPT0gJ1snKSB7XG4gICAgICAgIGtleSA9ICcuJyArIGtleTtcbiAgICB9XG5cbiAgICB2YXIgZm4gPSBuZXcgRnVuY3Rpb24oJ2QnLCAncmV0dXJuIGQnICsga2V5KTtcbiAgICB2YXIgdmFsdWUgPSBmbihkYXRhKSArICcnO1xuXG4gICAgaWYgKCFyYXcpIHtcbiAgICAgICAgdmFsdWUgPSBlbmNvZGUodmFsdWUpO1xuICAgIH1cblxuICAgIHJldHVybiB2YWx1ZTtcbn1cblxuLyoqXG4gKiBDb21waWxlIHRoZSB0ZW1wbGF0ZS5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gdGVtcGxhdGUgVGhlIHRlbXBsYXRlIHRvIGNvbXBpbGUuXG4gKiBAcGFyYW0ge3N0cmluZ30gc3RhcnRUYWcgVGhlIHN0YXJ0IHRhZy5cbiAqIEBwYXJhbSB7c3RyaW5nfSBlbmRUYWcgVGhlIGVuZCB0YWcuXG4gKiBAcGFyYW0geyhleHByOiBzdHJpbmcpID0+IHN0cmluZ30gcGFyc2UgVGhlIGZ1bmN0aW9uIHRvIHBhcnNlIHRoZSBleHByZXNzaW9uLlxuICogQHJldHVybnMge3N0cmluZ30gUmV0dXJuIHRoZSBjb21waWxlZCBzdHJpbmcuXG4gKi9cbmZ1bmN0aW9uIGNvbXBpbGUodGVtcGxhdGUsIHN0YXJ0VGFnLCBlbmRUYWcsIHBhcnNlKSB7XG4gICAgdmFyIGkgPSAwO1xuICAgIHZhciBsID0gdGVtcGxhdGUubGVuZ3RoO1xuICAgIHZhciBzbCA9IHN0YXJ0VGFnLmxlbmd0aDtcbiAgICB2YXIgZWwgPSBlbmRUYWcubGVuZ3RoO1xuICAgIHZhciBvdXRwdXQgPSBbXTtcbiAgICB2YXIgZXhwcmJ1ZmZlciA9IFtdO1xuICAgIHZhciBUX1NUUiA9IDE7XG4gICAgdmFyIFRfRVhQID0gMjtcbiAgICB2YXIgdHlwZSA9IFRfU1RSO1xuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBjaGFyIGluIGB0ZW1wbGF0ZWAgYXQgdGhlIGdpdmVuIHBvc2l0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1uZXJ9IFtpbmRleF0gVGhlIGluZGV4IHRvIHJlYWQsIGlmIGl0IGlzIG5vdCBzZXQsIGBpYCBpcyB1c2VkLlxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IFJldHVybnMgdGhlIGNoYXIuXG4gICAgICovXG4gICAgdmFyIGNoYXJBdCA9IGZ1bmN0aW9uIChpbmRleCkge1xuICAgICAgICByZXR1cm4gdGVtcGxhdGUuY2hhckF0KGluZGV4IHx8IGkpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBFc2NhcGUgdGhlIHRhZy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB0YWcgVGhlIHRhZyB0byBlc2NhcGUuXG4gICAgICogQHBhcmFtIHtzdHJpbmdbXX0gYnVmZmVyIFRoZSBidWZmZXIgdG8gcHV0IHRoZSBjaGFyLlxuICAgICAqL1xuICAgIHZhciBlc2MgPSBmdW5jdGlvbiAodGFnLCBidWZmZXIpIHtcbiAgICAgICAgdmFyIGM7XG4gICAgICAgIHZhciBtID0gdGFnLmxlbmd0aDtcbiAgICAgICAgdmFyIHMgPSAnXFxcXCc7XG5cbiAgICAgICAgd2hpbGUgKDEpIHtcbiAgICAgICAgICAgIGMgPSBjaGFyQXQoaSk7XG4gICAgICAgICAgICBpZiAoYyA9PT0gcykge1xuICAgICAgICAgICAgICAgIGMgPSBjaGFyQXQoKytpKTtcbiAgICAgICAgICAgICAgICBpZiAoYyA9PT0gcykge1xuICAgICAgICAgICAgICAgICAgICBidWZmZXIucHVzaChzKTtcbiAgICAgICAgICAgICAgICAgICAgKytpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoaXNXb3JkKHRhZykpIHtcbiAgICAgICAgICAgICAgICAgICAgYnVmZmVyLnB1c2godGFnKTtcbiAgICAgICAgICAgICAgICAgICAgaSArPSBtO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGJ1ZmZlci5wdXNoKHMpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIENoZWNrIHdoZXRoZXIgdGhlIG5leHQgaW5wdXQgaXMgdGhlIHdvcmQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gd29yZCBUaGUgd29yZCB0byBjaGVjay5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBSZXR1cm5zIGAxYCBvbiB5ZXMsIG90aGVyd2lzZSBgMGAgaXMgcmV0dXJuZWQuXG4gICAgICovXG4gICAgdmFyIGlzV29yZCA9IGZ1bmN0aW9uICh3b3JkKSB7XG4gICAgICAgIHZhciBrID0gMDtcbiAgICAgICAgdmFyIGogPSBpO1xuICAgICAgICB2YXIgbSA9IHdvcmQubGVuZ3RoO1xuXG4gICAgICAgIHdoaWxlIChrIDwgbSAmJiBqIDwgbCkge1xuICAgICAgICAgICAgaWYgKHdvcmQuY2hhckF0KGspICE9PSB0ZW1wbGF0ZS5jaGFyQXQoaikpIHJldHVybiAwO1xuICAgICAgICAgICAgKytrO1xuICAgICAgICAgICAgKytqO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIDE7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEZsdXNoIHRoZSBleHByIHRvIHRoZSBvdXRwdXQgYW5kIHJlc2V0IHRoZSBleHByIGJ1ZmZlci5cbiAgICAgKi9cbiAgICB2YXIgZmx1c2hFeHByID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBvdXRwdXQucHVzaChwYXJzZShleHByYnVmZmVyLmpvaW4oJycpKSk7XG4gICAgICAgIGV4cHJidWZmZXIgPSBbXTtcbiAgICB9O1xuXG4gICAgd2hpbGUgKGkgPCBsKSB7XG4gICAgICAgIGlmICh0eXBlID09PSBUX1NUUikge1xuICAgICAgICAgICAgZXNjKHN0YXJ0VGFnLCBvdXRwdXQpO1xuICAgICAgICAgICAgaWYgKGlzV29yZChzdGFydFRhZykpIHtcbiAgICAgICAgICAgICAgICB0eXBlID0gVF9FWFA7XG4gICAgICAgICAgICAgICAgaSArPSBzbDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgb3V0cHV0LnB1c2goY2hhckF0KGkpKTtcbiAgICAgICAgICAgICAgICBpICs9IDE7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gVF9FWFApIHtcbiAgICAgICAgICAgIGVzYyhlbmRUYWcsIGV4cHJidWZmZXIpO1xuICAgICAgICAgICAgaWYgKGlzV29yZChlbmRUYWcpKSB7XG4gICAgICAgICAgICAgICAgdHlwZSA9IFRfU1RSO1xuICAgICAgICAgICAgICAgIGkgKz0gZWw7XG4gICAgICAgICAgICAgICAgZmx1c2hFeHByKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGV4cHJidWZmZXIucHVzaChjaGFyQXQoaSkpO1xuICAgICAgICAgICAgICAgIGkgKz0gMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmICh0eXBlID09PSBUX0VYUCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuZXhwZWN0ZWQgZW5kJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG91dHB1dC5qb2luKCcnKTtcbn1cblxuLyoqXG4gKiBAdHlwZWRlZiB7T2JqZWN0LjxzdHJpbmcsICo+fSBUZW1wbGF0ZU9wdGlvbnNcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbc3RhcnRdIFRoZSBzdGFydCB0YWcgb2YgdGhlIHRlbXBsYXRlLCBkZWZhdWx0IGlzIGB7YC5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbZW5kXSBUaGUgZW5kIHRhZyBvZiB0aGUgdGVtcGxhdGUsIGRlZmF1bHQgaXMgYH1gLlxuICogQHByb3BlcnR5IHsodmFsdWU6IHN0cmluZykgPT4gc3RyaW5nfSBbZW5jb2RlXSBUaGUgZnVuY3Rpb24gdG8gZW5jb2RlIHRoZSB2YWx1ZSwgZGVmYXVsdCBpcyBgZW5jb2RlVVJJQ29tcG9uZW50YC5cbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IHRlbXBsYXRlO1xuIiwidmFyIGlkID0gMDtcblxuLyoqXG4gKiBSZXR1cm5zIGEgbnVtYmVyIHRoYXQgZ3JlYXRlciB0aGFuIHRoZSBwcml2b3VzIG9uZSwgc3RhcnRpbmcgZm9ybSBgMWAuXG4gKlxuICogQHJldHVybnMge251bWJlcn1cbiAqL1xuZnVuY3Rpb24gdXVpZCgpIHtcbiAgICBpZCArPSAxO1xuICAgIHJldHVybiBpZDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB1dWlkO1xuIiwiLyoqXG4gKiBDaGVjayB3aGV0aGVyIHRoZSB1cmwgaXMgYWJzb2x1dGUgdXJsLlxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSB1cmwgVGhlIHVybCBzdHJpbmcgdG8gY2hlY2tcbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgdXJsIGlzIGFib3NvbHV0ZSwgb3RoZXJ3aXNlIGBmYWxzZWAgaXMgcmV0dXJuZWRcbiAqL1xuZnVuY3Rpb24gaXNBYnNvbHV0ZVVSTCh1cmwpIHtcbiAgICByZXR1cm4gL14oPzpbYS16XVthLXowLTlcXC1cXC5cXCtdKjopP1xcL1xcLy9pLnRlc3QodXJsKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpc0Fic29sdXRlVVJMO1xuIiwidmFyIHRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcblxuLyoqXG4gKiBDaGVjayB3aGV0aGVyIHRoZSB2YXJpYWJsZSBpcyBhbiBpbnN0YW5jZSBvZiBgQXJyYXlgXG4gKlxuICogQHBhcmFtIHthbnl9IGl0IFRoZSB2YXJpYWJsZSB0byBjaGVja1xuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSB2YXJpYWJsZSBpcyBhbiBpbnN0YW5jZSBvZiBgQXJyYXlgLCBvdGhlcndpc2UgYGZhbHNlYCBpcyByZXR1cm5lZFxuICovXG5mdW5jdGlvbiBpc0FycmF5KGl0KSB7XG4gICAgcmV0dXJuIHRvU3RyaW5nLmNhbGwoaXQpID09PSAnW29iamVjdCBBcnJheV0nO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGlzQXJyYXk7XG4iLCJ2YXIgdG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xuXG4vKipcbiAqIENoZWNrIHdoZXRoZXIgdGhlIHZhcmlhYmxlIGlzIGEgZnVuY3Rpb25cbiAqXG4gKiBAcGFyYW0ge2FueX0gaXQgVGhlIHZhcmlhYmxlIHRvIGNoZWNrXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIHZhcmlhYmxlIGlzIGEgZnVuY3Rpb24sIG90aGVyd2lzZSBgZmFsc2VgIGlzIHJldHVybmVkXG4gKi9cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oaXQpIHtcbiAgICByZXR1cm4gdG9TdHJpbmcuY2FsbChpdCkgPT09ICdbb2JqZWN0IEZ1bmN0aW9uXSc7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaXNGdW5jdGlvbjtcbiIsInZhciB0b1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG5cbi8qKlxuICogQ2hlY2sgd2hldGhlciB0aGUgdmFyaWFibGUgaXMgYSBwbGFpbiBvYmplY3QuXG4gKlxuICogQHBhcmFtIHthbnl9IGl0IFRoZSB2YXJpYWJsZSB0byBjaGVja1xuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSB2YXJpYWJsZSBpcyBhIHBsYWluIG9iamVjdCwgb3RoZXJ3aXNlIGBmYWxzZWAgaXMgcmV0dXJuZWRcbiAqL1xuZnVuY3Rpb24gaXNQbGFpbk9iamVjdChpdCkge1xuICAgIGlmICghaXQpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiBpdCA9PT0gd2luZG93KSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIGdsb2JhbCAhPT0gJ3VuZGVmaW5lZCcgJiYgaXQgPT09IGdsb2JhbCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRvU3RyaW5nLmNhbGwoaXQpID09PSAnW29iamVjdCBPYmplY3RdJztcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpc1BsYWluT2JqZWN0O1xuIiwidmFyIGlzQXJyYXkgPSByZXF1aXJlKDM3KTtcbnZhciBpc1BsYWluT2JqZWN0ID0gcmVxdWlyZSgzOSk7XG52YXIgaGFzT3duID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcbnZhciBzbGljZSA9IEFycmF5LnByb3RvdHlwZS5zbGljZTtcblxuLyoqXG4gKiBDb3B5IHRoZSBub24tdW5kZWZpbmVkIHZhbHVlcyBvZiBzb3VyY2UgdG8gdGFyZ2V0LiBPdmVyd3JpdGUgdGhlIG9yaWdpbmFsIHZhbHVlcy5cbiAqIFRoaXMgZnVuY3Rpb24gd2lsbCBtb2RpZnkgdGhlIHRhcmdldFxuICpcbiAqIEBwYXJhbSB7T2JqZWN0LjxzdHJpbmcsICo+fGFueVtdfSB0YXJnZXQgVGhlIHRhcmdldCBvYmplY3Qgb3IgYXJyYXlcbiAqIEBwYXJhbSB7T2JqZWN0LjxzdHJpbmcsICo+fGFueVtdfSBzb3VyY2UgVGhlIHNvdXJjZSBvYmplY3Qgb3IgYXJyYXlcbiAqIEByZXR1cm5zIHtPYmplY3QuPHN0cmluZywgKj58YW55W119IFJldHVybnMgdGhlIGV4dGVuZGVkIHRhcmdldCBvYmplY3Qgb3IgYXJyYXlcbiAqL1xuZnVuY3Rpb24gZXh0ZW5kKHRhcmdldCwgc291cmNlKSB7XG4gICAgdmFyIGtleSwgdmFsO1xuXG4gICAgaWYgKCB0YXJnZXQgJiYgKCBpc0FycmF5KHNvdXJjZSkgfHwgaXNQbGFpbk9iamVjdChzb3VyY2UpICkgKSB7XG4gICAgICAgIGZvciAoIGtleSBpbiBzb3VyY2UgKSB7XG4gICAgICAgICAgICBpZiAoIGhhc093bi5jYWxsKHNvdXJjZSwga2V5KSApIHtcbiAgICAgICAgICAgICAgICB2YWwgPSBzb3VyY2Vba2V5XTtcbiAgICAgICAgICAgICAgICBpZiAodmFsICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCBpc1BsYWluT2JqZWN0KHZhbCkgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoICEgaXNQbGFpbk9iamVjdCh0YXJnZXRba2V5XSkgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0W2tleV0gPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIG1lcmdlKHRhcmdldFtrZXldLCB2YWwpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKCBpc0FycmF5KHZhbCkgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoICEgaXNBcnJheSh0YXJnZXRba2V5XSkgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0W2tleV0gPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIG1lcmdlKHRhcmdldFtrZXldLCB2YWwpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0W2tleV0gPSB2YWw7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGFyZ2V0O1xufVxuXG4vKipcbiAqIENvcHkgYW55IG5vbi11bmRlZmluZWQgdmFsdWVzIG9mIHNvdXJjZSB0byB0YXJnZXQgYW5kIG92ZXJ3cml0ZXMgdGhlIGNvcnJlc3BvbmRpbmcgb3JpZ2luYWwgdmFsdWVzLiBUaGlzIGZ1bmN0aW9uXG4gKiB3aWxsIG1vZGlmeSB0aGUgdGFyZ2V0IG9iamVjdC5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdGFyZ2V0IFRoZSB0YXJnZXQgb2JqZWN0XG4gKiBAcGFyYW0gey4uLk9iamVjdH0gYXJncyBUaGUgc291cmNlIG9iamVjdFxuICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyB0aGUgbW9kaWZpZWQgdGFyZ2V0IG9iamVjdFxuICovXG5mdW5jdGlvbiBtZXJnZSh0YXJnZXQsIGFyZ3MpIHtcbiAgICB2YXIgaSA9IDA7XG4gICAgdmFyIGwgPSBhcmd1bWVudHMubGVuZ3RoIC0gMTtcblxuICAgIGFyZ3MgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgbDsgaSArPSAxKSB7XG4gICAgICAgIGV4dGVuZCh0YXJnZXQsIGFyZ3NbaV0pO1xuICAgIH1cblxuICAgIHJldHVybiB0YXJnZXQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gbWVyZ2U7XG4iLCJ2YXIgdXRpbCA9IHJlcXVpcmUoNDQpO1xudmFyIGlzQXJyYXkgPSB1dGlsLmlzQXJyYXk7XG5cbi8qKlxuICogRGVjb2RlIHRoZSBVUkkgQ29tcG9uZW50IGVuY29kZWQgcXVlcnkgc3RyaW5nIHRvIG9iamVjdFxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSBUaGUgVVJJIENvbXBvbmVudCBlbmNvZGVkIHF1ZXJ5IHN0cmluZ1xuICogQHJldHVybnMge09iamVjdC48c3RyaW5nLCBzdHJpbmc+fSBSZXR1cm5zIHRoZSBkZWNvZGVkIG9iamVjdFxuICovXG52YXIgZGVjb2RlID0gZnVuY3Rpb24gKHN0cmluZykge1xuICAgIHZhciBvYmplY3QgPSB7fTtcbiAgICB2YXIgY2FjaGUgPSB7fTtcbiAgICB2YXIga2V5VmFsdWVBcnJheTtcbiAgICB2YXIgaW5kZXg7XG4gICAgdmFyIGxlbmd0aDtcbiAgICB2YXIga2V5VmFsdWU7XG4gICAgdmFyIGtleTtcbiAgICB2YXIgdmFsdWU7XG5cbiAgICAvLyBkbyBub3QgZGVjb2RlIGVtcHR5IHN0cmluZyBvciBzb21ldGhpbmcgdGhhdCBpcyBub3Qgc3RyaW5nXG4gICAgaWYgKHN0cmluZyAmJiB0eXBlb2Ygc3RyaW5nID09PSAnc3RyaW5nJykge1xuICAgICAgICBrZXlWYWx1ZUFycmF5ID0gc3RyaW5nLnNwbGl0KCcmJyk7XG4gICAgICAgIGluZGV4ID0gMDtcbiAgICAgICAgbGVuZ3RoID0ga2V5VmFsdWVBcnJheS5sZW5ndGg7XG5cbiAgICAgICAgd2hpbGUgKGluZGV4IDwgbGVuZ3RoKSB7XG4gICAgICAgICAgICBrZXlWYWx1ZSA9IGtleVZhbHVlQXJyYXlbaW5kZXhdLnNwbGl0KCc9Jyk7XG4gICAgICAgICAgICBrZXkgPSBkZWNvZGVVUklDb21wb25lbnQoa2V5VmFsdWVbMF0pO1xuICAgICAgICAgICAgdmFsdWUgPSBrZXlWYWx1ZVsxXTtcblxuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IGRlY29kZVVSSUNvbXBvbmVudCh2YWx1ZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHZhbHVlID0gbnVsbDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZGVjb2RlS2V5KG9iamVjdCwgY2FjaGUsIGtleSwgdmFsdWUpO1xuXG4gICAgICAgICAgICBpbmRleCArPSAxO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG9iamVjdDtcbn07XG5cbi8qKlxuICogRGVjb2RlIHRoZSBzcGVjZWZpZWQga2V5XG4gKlxuICogQHBhcmFtIHtPYmplY3QuPHN0cmluZywgc3RyaW5nPn0gb2JqZWN0IFRoZSBvYmplY3QgdG8gaG9sZCB0aGUgZGVjb2RlZCBkYXRhXG4gKiBAcGFyYW0ge09iamVjdC48c3RyaW5nLCAqPn0gY2FjaGUgVGhlIG9iamVjdCB0byBob2xkIGNhY2hlIGRhdGFcbiAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgVGhlIGtleSBuYW1lIHRvIGRlY29kZVxuICogQHBhcmFtIHthbnl9IHZhbHVlIFRoZSB2YWx1ZSB0byBkZWNvZGVcbiAqL1xudmFyIGRlY29kZUtleSA9IGZ1bmN0aW9uIChvYmplY3QsIGNhY2hlLCBrZXksIHZhbHVlKSB7XG4gICAgdmFyIHJCcmFja2V0ID0gL1xcWyhbXlxcW10qPyk/XFxdJC87XG4gICAgdmFyIHJJbmRleCA9IC8oXjAkKXwoXlsxLTldXFxkKiQpLztcbiAgICB2YXIgaW5kZXhPcktleU9yRW1wdHk7XG4gICAgdmFyIHBhcmVudEtleTtcbiAgICB2YXIgYXJyYXlPck9iamVjdDtcbiAgICB2YXIga2V5SXNJbmRleDtcbiAgICB2YXIga2V5SXNFbXB0eTtcbiAgICB2YXIgdmFsdWVJc0luQXJyYXk7XG4gICAgdmFyIGRhdGFBcnJheTtcbiAgICB2YXIgbGVuZ3RoO1xuXG4gICAgLy8gY2hlY2sgd2hldGhlciBrZXkgaXMgc29tZXRoaW5nIGxpa2UgYHBlcnNvbltuYW1lXWAgb3IgYGNvbG9yc1tdYCBvclxuICAgIC8vIGBjb2xvcnNbMV1gXG4gICAgaWYgKCByQnJhY2tldC50ZXN0KGtleSkgKSB7XG4gICAgICAgIGluZGV4T3JLZXlPckVtcHR5ID0gUmVnRXhwLiQxO1xuICAgICAgICBwYXJlbnRLZXkgPSBrZXkucmVwbGFjZShyQnJhY2tldCwgJycpO1xuICAgICAgICBhcnJheU9yT2JqZWN0ID0gY2FjaGVbcGFyZW50S2V5XTtcblxuICAgICAgICBrZXlJc0luZGV4ID0gckluZGV4LnRlc3QoaW5kZXhPcktleU9yRW1wdHkpO1xuICAgICAgICBrZXlJc0VtcHR5ID0gaW5kZXhPcktleU9yRW1wdHkgPT09ICcnO1xuICAgICAgICB2YWx1ZUlzSW5BcnJheSA9IGtleUlzSW5kZXggfHwga2V5SXNFbXB0eTtcblxuICAgICAgICBpZiAoYXJyYXlPck9iamVjdCkge1xuICAgICAgICAgICAgLy8gY29udmVydCB0aGUgYXJyYXkgdG8gb2JqZWN0XG4gICAgICAgICAgICBpZiAoICghIHZhbHVlSXNJbkFycmF5KSAmJiBpc0FycmF5KGFycmF5T3JPYmplY3QpICkge1xuICAgICAgICAgICAgICAgIGRhdGFBcnJheSA9IGFycmF5T3JPYmplY3Q7XG4gICAgICAgICAgICAgICAgbGVuZ3RoID0gZGF0YUFycmF5Lmxlbmd0aDtcbiAgICAgICAgICAgICAgICBhcnJheU9yT2JqZWN0ID0ge307XG5cbiAgICAgICAgICAgICAgICB3aGlsZSAobGVuZ3RoLS0pIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFycmF5T3JPYmplY3RbbGVuZ3RoXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhcnJheU9yT2JqZWN0W2xlbmd0aF0gPSBkYXRhQXJyYXlbbGVuZ3RoXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGFycmF5T3JPYmplY3QgPSB2YWx1ZUlzSW5BcnJheSA/IFtdIDoge307XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIGtleUlzRW1wdHkgJiYgaXNBcnJheShhcnJheU9yT2JqZWN0KSApIHtcbiAgICAgICAgICAgIGFycmF5T3JPYmplY3QucHVzaCh2YWx1ZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBhcnJheU9yT2JqZWN0IGlzIGFycmF5IG9yIG9iamVjdCBoZXJlXG4gICAgICAgICAgICBhcnJheU9yT2JqZWN0W2luZGV4T3JLZXlPckVtcHR5XSA9IHZhbHVlO1xuICAgICAgICB9XG5cbiAgICAgICAgY2FjaGVbcGFyZW50S2V5XSA9IGFycmF5T3JPYmplY3Q7XG5cbiAgICAgICAgZGVjb2RlS2V5KG9iamVjdCwgY2FjaGUsIHBhcmVudEtleSwgYXJyYXlPck9iamVjdCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgb2JqZWN0W2tleV0gPSB2YWx1ZTtcbiAgICB9XG59O1xuXG5leHBvcnRzLmRlY29kZSA9IGRlY29kZTtcbiIsInZhciB1dGlsID0gcmVxdWlyZSg0NCk7XG52YXIgaXNBcnJheSA9IHV0aWwuaXNBcnJheTtcbnZhciBpc09iamVjdCA9IHV0aWwuaXNPYmplY3Q7XG52YXIgaGFzT3duID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcblxuLyoqXG4gKiBFbmNvZGUgdGhlIGdpdmVuIG9iamVjdCB0byBVUkkgQ29tcG9uZW50IGVuY29kZWQgcXVlcnkgc3RyaW5nXG4gKlxuICogQHBhcmFtIHtPYmplY3QuPHN0cmluZywgKj59IG9iamVjdCBUaGUgb2JqZWN0IHRvIGVuY29kZVxuICogQHBhcmFtIHtib29sZWFufSBba2VlcEFycmF5SW5kZXhdIFdoZXRoZXIgdG8ga2VlcCBhcnJheSBpbmRleFxuICogQHJldHVybnMge3N0cmluZ30gUmV0dXJucyB0aGUgVVJJIENvbXBvbmVudCBlbmNvZGVkIHF1ZXJ5IHN0cmluZ1xuICovXG52YXIgZW5jb2RlID0gZnVuY3Rpb24gKG9iamVjdCwga2VlcEFycmF5SW5kZXgpIHtcbiAgICB2YXIga2V5O1xuICAgIHZhciBrZXlWYWx1ZUFycmF5ID0gW107XG5cbiAgICBrZWVwQXJyYXlJbmRleCA9ICEha2VlcEFycmF5SW5kZXg7XG5cbiAgICBpZiAoIGlzT2JqZWN0KG9iamVjdCkgKSB7XG4gICAgICAgIGZvciAoIGtleSBpbiBvYmplY3QgKSB7XG4gICAgICAgICAgICBpZiAoIGhhc093bi5jYWxsKG9iamVjdCwga2V5KSApIHtcbiAgICAgICAgICAgICAgICBlbmNvZGVLZXkoa2V5LCBvYmplY3Rba2V5XSwga2V5VmFsdWVBcnJheSwga2VlcEFycmF5SW5kZXgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGtleVZhbHVlQXJyYXkuam9pbignJicpO1xufTtcblxuXG4vKipcbiAqIEVuY29kZSB0aGUgc3BlY2VpZmVkIGtleSBpbiB0aGUgb2JqZWN0XG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IGtleSBUaGUga2V5IG5hbWVcbiAqIEBwYXJhbSB7YW55fSBkYXRhIFRoZSBkYXRhIG9mIHRoZSBrZXlcbiAqIEBwYXJhbSB7c3RyaW5nW119IGtleVZhbHVlQXJyYXkgVGhlIGFycmF5IHRvIHN0b3JlIHRoZSBrZXkgdmFsdWUgc3RyaW5nXG4gKiBAcGFyYW0ge2Jvb2xlYW59IGtlZXBBcnJheUluZGV4IFdoZXRoZXIgdG8ga2VlcCBhcnJheSBpbmRleFxuICovXG52YXIgZW5jb2RlS2V5ID0gZnVuY3Rpb24gKGtleSwgZGF0YSwga2V5VmFsdWVBcnJheSwga2VlcEFycmF5SW5kZXgpIHtcbiAgICB2YXIgcHJvcDtcbiAgICB2YXIgaW5kZXg7XG4gICAgdmFyIGxlbmd0aDtcbiAgICB2YXIgdmFsdWU7XG4gICAgdmFyIHN1YktleTtcblxuICAgIGlmICggaXNPYmplY3QoZGF0YSkgKSB7XG4gICAgICAgIGZvciAoIHByb3AgaW4gZGF0YSApIHtcbiAgICAgICAgICAgIGlmICggaGFzT3duLmNhbGwoZGF0YSwgcHJvcCkgKSB7XG4gICAgICAgICAgICAgICAgdmFsdWUgPSBkYXRhW3Byb3BdO1xuICAgICAgICAgICAgICAgIHN1YktleSA9IGtleSArICdbJyArIHByb3AgKyAnXSc7XG4gICAgICAgICAgICAgICAgZW5jb2RlS2V5KHN1YktleSwgdmFsdWUsIGtleVZhbHVlQXJyYXksIGtlZXBBcnJheUluZGV4KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAoIGlzQXJyYXkoZGF0YSkgKSB7XG4gICAgICAgIGluZGV4ID0gMDtcbiAgICAgICAgbGVuZ3RoID0gZGF0YS5sZW5ndGg7XG5cbiAgICAgICAgd2hpbGUgKGluZGV4IDwgbGVuZ3RoKSB7XG4gICAgICAgICAgICB2YWx1ZSA9IGRhdGFbaW5kZXhdO1xuXG4gICAgICAgICAgICBpZiAoIGtlZXBBcnJheUluZGV4IHx8IGlzQXJyYXkodmFsdWUpIHx8IGlzT2JqZWN0KHZhbHVlKSApIHtcbiAgICAgICAgICAgICAgICBzdWJLZXkgPSBrZXkgKyAnWycgKyBpbmRleCArICddJztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc3ViS2V5ID0ga2V5ICsgJ1tdJztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZW5jb2RlS2V5KHN1YktleSwgdmFsdWUsIGtleVZhbHVlQXJyYXksIGtlZXBBcnJheUluZGV4KTtcblxuICAgICAgICAgICAgaW5kZXggKz0gMTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIGtleSA9IGVuY29kZVVSSUNvbXBvbmVudChrZXkpO1xuICAgICAgICAvLyBpZiBkYXRhIGlzIG51bGwsIG5vIGA9YCBpcyBhcHBlbmRlZFxuICAgICAgICBpZiAoZGF0YSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgdmFsdWUgPSBrZXk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBpZiBkYXRhIGlzIHVuZGVmaW5lZCwgdHJlYXQgaXQgYXMgZW1wdHkgc3RyaW5nXG4gICAgICAgICAgICBpZiAoZGF0YSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgZGF0YSA9ICcnO1xuICAgICAgICAgICAgLy8gbWFrZSBzdXJlIHRoYXQgZGF0YSBpcyBzdHJpbmdcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGRhdGEgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgZGF0YSA9ICcnICsgZGF0YTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhbHVlID0ga2V5ICsgJz0nICsgZW5jb2RlVVJJQ29tcG9uZW50KGRhdGEpO1xuICAgICAgICB9XG5cbiAgICAgICAga2V5VmFsdWVBcnJheS5wdXNoKHZhbHVlKTtcbiAgICB9XG59O1xuXG5leHBvcnRzLmVuY29kZSA9IGVuY29kZTtcbiIsInZhciBlbmNvZGUgPSByZXF1aXJlKDQyKS5lbmNvZGU7XG52YXIgZGVjb2RlID0gcmVxdWlyZSg0MSkuZGVjb2RlO1xuXG5leHBvcnRzLmVuY29kZSA9IGVuY29kZTtcbmV4cG9ydHMuZGVjb2RlID0gZGVjb2RlO1xuZXhwb3J0cy52ZXJzaW9uID0gJzEuMS4yJztcbiIsInZhciB0b1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG5cbi8qKlxuICogQ2hlY2sgd2hldGhlciB0aGUgdmFyaWFibGUgaXMgYW4gYXJyYXlcbiAqXG4gKiBAcGFyYW0ge2FueX0gaXQgVGhlIHZhcmlhYmxlIHRvIGNoZWNrXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgaXQgaXMgYW4gYXJyYXlcbiAqL1xudmFyIGlzQXJyYXkgPSBmdW5jdGlvbiAoaXQpIHtcbiAgICByZXR1cm4gJ1tvYmplY3QgQXJyYXldJyA9PT0gdG9TdHJpbmcuY2FsbChpdCk7XG59O1xuXG4vKipcbiAqIENoZWNrIHdoZXRoZXIgdGhlIHZhcmlhYmxlIGlzIGFuIG9iamVjdFxuICpcbiAqIEBwYXJhbSB7YW55fSBpdCBUaGUgdmFyaWFibGUgdG8gY2hlY2tcbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBpdCBpcyBhbiBvYmplY3RcbiAqL1xudmFyIGlzT2JqZWN0ID0gZnVuY3Rpb24gKGl0KSB7XG4gICAgcmV0dXJuICdbb2JqZWN0IE9iamVjdF0nID09PSB0b1N0cmluZy5jYWxsKGl0KTtcbn07XG5cbmV4cG9ydHMuaXNBcnJheSA9IGlzQXJyYXk7XG5leHBvcnRzLmlzT2JqZWN0ID0gaXNPYmplY3Q7XG4iXX0=
