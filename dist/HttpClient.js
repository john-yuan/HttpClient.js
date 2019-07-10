(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.HttpClient = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
var isFunction = require(39);

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

},{"39":39}],2:[function(require,module,exports){
var merge = require(41);
var isFunction = require(39);
var isPlainObject = require(40);
var createDefaultOptions = require(28);
var createCancelController = require(27);
var noop = require(33);
var version = require(36);
var HttpRequest = require(3);
var JSONPRequest = require(6);

/**
 * @class
 *
 * @param {RequestOptions} [defaults] The default options to use when sending requests with the created http client.
 * This default options will be merged into the internal default options that `createDefaultOptions()` returns.
 *
 * @param {HandleOptionsFunction} [handleDefaults] The handler function to process the merged default options. The
 * merged default options will be passed into the function as the first argument. You can make changes to it as you
 * want. This function must return synchronously. The return value of this function is ignored.
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

module.exports = HttpClient;

/**
 * This callback is used to hanlde the merged default options. It must retrun the result synchronously.
 *
 * @callback HandleOptionsFunction
 * @param {RequestOptions} options The merged default options.
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

},{"27":27,"28":28,"3":3,"33":33,"36":36,"39":39,"40":40,"41":41,"6":6}],3:[function(require,module,exports){
var Requeset = require(9);
var constants = require(12);
var inherits = require(32);
var buildURL = require(25);
var handleOptions = require(31);
var callRequestCreatedCallback = require(26);
var addEventListeners = require(13);
var handleXhrProps = require(18);
var handleHeaders = require(16);
var handleRequestBody = require(17);
var callXhrHook = require(15);

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

},{"12":12,"13":13,"15":15,"16":16,"17":17,"18":18,"25":25,"26":26,"31":31,"32":32,"9":9}],4:[function(require,module,exports){
/**
 * HttpResponse module.
 *
 * @module class/HttpResponse
 */

var Response = require(10);
var inherits = require(32);
var addCustomParser = require(24);

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

},{"10":10,"24":24,"32":32}],5:[function(require,module,exports){
var ResponseError = require(11);
var inherits = require(32);
var addCustomParser = require(24);

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

},{"11":11,"24":24,"32":32}],6:[function(require,module,exports){
var Requeset = require(9);
var constants = require(12);
var inherits = require(32);
var handleOptions = require(31);
var callRequestCreatedCallback = require(26);
var addEventListeners = require(20);
var buildCallbackName = require(21);
var handleScriptCors = require(23);
var buildScriptSrc = require(22);

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

},{"12":12,"20":20,"21":21,"22":22,"23":23,"26":26,"31":31,"32":32,"9":9}],7:[function(require,module,exports){
/**
 * JSONPResponse module.
 *
 * @module class/JSONPResponse
 */

var Response = require(10);
var inherits = require(32);
var addCustomParser = require(24);

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

},{"10":10,"24":24,"32":32}],8:[function(require,module,exports){
var ResponseError = require(11);
var inherits = require(32);
var addCustomParser = require(24);

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

},{"11":11,"24":24,"32":32}],9:[function(require,module,exports){
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
    this.request = request || null;
}

module.exports = Response;

},{}],11:[function(require,module,exports){
var isPlainObject = require(40);

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

},{"40":40}],12:[function(require,module,exports){
exports.ERR_ABORTED = 'ERR_ABORTED';
exports.ERR_RESPONSE = 'ERR_RESPONSE';
exports.ERR_CANCELLED = 'ERR_CANCELLED';
exports.ERR_NETWORK = 'ERR_NETWORK';
exports.ERR_TIMEOUT = 'ERR_TIMEOUT';
exports.HTTP_REQUEST = 'HTTP_REQUEST';
exports.JSONP_REQUEST = 'JSONP_REQUEST';

},{}],13:[function(require,module,exports){
var isFunction = require(39);
var HttpResponse = require(4);
var addTimeoutListener = require(14);
var fireCallbacks = require(30);
var noop = require(33);
var constants = require(12);
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

},{"12":12,"14":14,"30":30,"33":33,"39":39,"4":4}],14:[function(require,module,exports){
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
var isFunction = require(39);

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

},{"39":39}],16:[function(require,module,exports){
var merge = require(41);
var isPlainObject = require(40);
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

},{"40":40,"41":41}],17:[function(require,module,exports){
var merge = require(41);
var isFunction = require(39);
var isPlainObject = require(40);
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

},{"39":39,"40":40,"41":41}],18:[function(require,module,exports){
var isPlainObject = require(40);
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

},{"40":40}],19:[function(require,module,exports){
var HttpClient = require(2);
var merge = require(41);
var isFunction = require(39);
var isPlainObject = require(40);
var QS = require(44);
var isAbsoluteURL = require(37);
var defineExports = require(29);
var createDefaultOptions = require(28);
var constants = require(12);
var template = require(34);
var uuid = require(35);
var noop = require(33);
var inherits = require(32);
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

},{"1":1,"10":10,"11":11,"12":12,"2":2,"28":28,"29":29,"3":3,"32":32,"33":33,"34":34,"35":35,"37":37,"39":39,"4":4,"40":40,"41":41,"44":44,"5":5,"6":6,"7":7,"8":8,"9":9}],20:[function(require,module,exports){
var isFunction = require(39);
var JSONPResponse = require(7);
var fireCallbacks = require(30);
var noop = require(33);
var constants = require(12);
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

},{"12":12,"30":30,"33":33,"39":39,"7":7}],21:[function(require,module,exports){
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
var buildURL = require(25);

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

},{"25":25}],23:[function(require,module,exports){
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
var isPlainObject = require(40);
var isFunction = require(39);
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

},{"39":39,"40":40}],25:[function(require,module,exports){
var isFunction = require(39);
var isAbsoluteURL = require(37);
var isPlainObject = require(40);

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

},{"37":37,"39":39,"40":40}],26:[function(require,module,exports){
var isFunction = require(39);

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

},{"39":39}],27:[function(require,module,exports){
var CancelController = require(1);

/**
 * Create a new instance of `CancelController`.
 *
 * @returns {CancelController} Returns an new instance of `CancelController`.
 */
var createCancelController = function () {
    return new CancelController;
};

module.exports = createCancelController;

},{"1":1}],28:[function(require,module,exports){
var QS = require(44);
var constants = require(12);
var template = require(34);
var uuid = require(35);
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

},{"12":12,"34":34,"35":35,"44":44}],29:[function(require,module,exports){
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
var isFunction = require(39);
var HttpResponseError = require(5);
var JSONPResponseError = require(8);
var constants = require(12);
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

},{"12":12,"39":39,"5":5,"8":8}],31:[function(require,module,exports){
var isFunction = require(39);

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

},{"39":39}],32:[function(require,module,exports){
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
var isArray = require(38);
var isPlainObject = require(40);
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

},{"38":38,"40":40}],42:[function(require,module,exports){
var util = require(45);
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

},{"45":45}],43:[function(require,module,exports){
var util = require(45);
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

},{"45":45}],44:[function(require,module,exports){
var encode = require(43).encode;
var decode = require(42).decode;

exports.encode = encode;
exports.decode = decode;
exports.version = '1.1.2';

},{"42":42,"43":43}],45:[function(require,module,exports){
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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9fYnJvd3Nlci1wYWNrQDYuMS4wQGJyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsImxpYi9jbGFzcy9DYW5jZWxDb250cm9sbGVyLmpzIiwibGliL2NsYXNzL0h0dHBDbGllbnQuanMiLCJsaWIvY2xhc3MvSHR0cFJlcXVlc3QuanMiLCJsaWIvY2xhc3MvSHR0cFJlc3BvbnNlLmpzIiwibGliL2NsYXNzL0h0dHBSZXNwb25zZUVycm9yLmpzIiwibGliL2NsYXNzL0pTT05QUmVxdWVzdC5qcyIsImxpYi9jbGFzcy9KU09OUFJlc3BvbnNlLmpzIiwibGliL2NsYXNzL0pTT05QUmVzcG9uc2VFcnJvci5qcyIsImxpYi9jbGFzcy9SZXF1ZXN0LmpzIiwibGliL2NsYXNzL1Jlc3BvbnNlLmpzIiwibGliL2NsYXNzL1Jlc3BvbnNlRXJyb3IuanMiLCJsaWIvY29uc3RhbnRzLmpzIiwibGliL2h0dHAvYWRkRXZlbnRMaXN0ZW5lcnMuanMiLCJsaWIvaHR0cC9hZGRUaW1lb3V0TGlzdGVuZXIuanMiLCJsaWIvaHR0cC9jYWxsWGhySG9vay5qcyIsImxpYi9odHRwL2hhbmRsZUhlYWRlcnMuanMiLCJsaWIvaHR0cC9oYW5kbGVSZXF1ZXN0Qm9keS5qcyIsImxpYi9odHRwL2hhbmRsZVhoclByb3BzLmpzIiwibGliL2luZGV4LmpzIiwibGliL2pzb25wL2FkZEV2ZW50TGlzdGVuZXJzLmpzIiwibGliL2pzb25wL2J1aWxkQ2FsbGJhY2tOYW1lLmpzIiwibGliL2pzb25wL2J1aWxkU2NyaXB0U3JjLmpzIiwibGliL2pzb25wL2hhbmRsZVNjcmlwdENvcnMuanMiLCJsaWIvc2hhcmVkL2FkZEN1c3RvbVBhcnNlci5qcyIsImxpYi9zaGFyZWQvYnVpbGRVUkwuanMiLCJsaWIvc2hhcmVkL2NhbGxSZXF1ZXN0Q3JlYXRlZENhbGxiYWNrLmpzIiwibGliL3NoYXJlZC9jcmVhdGVDYW5jZWxDb250cm9sbGVyLmpzIiwibGliL3NoYXJlZC9jcmVhdGVEZWZhdWx0T3B0aW9ucy5qcyIsImxpYi9zaGFyZWQvZGVmaW5lRXhwb3J0cy5qcyIsImxpYi9zaGFyZWQvZmlyZUNhbGxiYWNrcy5qcyIsImxpYi9zaGFyZWQvaGFuZGxlT3B0aW9ucy5qcyIsImxpYi9zaGFyZWQvaW5oZXJpdHMuanMiLCJsaWIvc2hhcmVkL25vb3AuanMiLCJsaWIvc2hhcmVkL3RlbXBsYXRlLmpzIiwibGliL3NoYXJlZC91dWlkLmpzIiwibGliL3ZlcnNpb24uanMiLCJub2RlX21vZHVsZXMvX3gtY29tbW9uLXV0aWxzQDEuNC4wQHgtY29tbW9uLXV0aWxzL2lzQWJzb2x1dGVVUkwuanMiLCJub2RlX21vZHVsZXMvX3gtY29tbW9uLXV0aWxzQDEuNC4wQHgtY29tbW9uLXV0aWxzL2lzQXJyYXkuanMiLCJub2RlX21vZHVsZXMvX3gtY29tbW9uLXV0aWxzQDEuNC4wQHgtY29tbW9uLXV0aWxzL2lzRnVuY3Rpb24uanMiLCJub2RlX21vZHVsZXMvX3gtY29tbW9uLXV0aWxzQDEuNC4wQHgtY29tbW9uLXV0aWxzL2lzUGxhaW5PYmplY3QuanMiLCJub2RlX21vZHVsZXMvX3gtY29tbW9uLXV0aWxzQDEuNC4wQHgtY29tbW9uLXV0aWxzL21lcmdlLmpzIiwibm9kZV9tb2R1bGVzL194LXF1ZXJ5LXN0cmluZ0AxLjEuMkB4LXF1ZXJ5LXN0cmluZy9saWIvZGVjb2RlLmpzIiwibm9kZV9tb2R1bGVzL194LXF1ZXJ5LXN0cmluZ0AxLjEuMkB4LXF1ZXJ5LXN0cmluZy9saWIvZW5jb2RlLmpzIiwibm9kZV9tb2R1bGVzL194LXF1ZXJ5LXN0cmluZ0AxLjEuMkB4LXF1ZXJ5LXN0cmluZy9saWIvcXVlcnlzdHJpbmcuanMiLCJub2RlX21vZHVsZXMvX3gtcXVlcnktc3RyaW5nQDEuMS4yQHgtcXVlcnktc3RyaW5nL2xpYi91dGlsLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3REQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNiQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDYkE7QUFDQTs7QUNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNiQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0dBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwidmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKDM5KTtcblxuLyoqXG4gKiBDYW5jZWwgY29udHJvbGxlciBpcyB1c2VkIHRvIGNhbmNlbCBhY3Rpb25zLiBPbmUgY29udHJvbGxlciBjYW4gYmluZCBhbnkgbnVtYmVyIG9mIGFjdGlvbnMuXG4gKlxuICogQGNsYXNzXG4gKi9cbmZ1bmN0aW9uIENhbmNlbENvbnRyb2xsZXIoKSB7XG4gICAgLyoqXG4gICAgICogQHR5cGUge2Jvb2xlYW59IFdoZXRoZXIgdGhlIGNvbnRyb2xsZXIgaXMgY2FuY2VsbGVkLlxuICAgICAqL1xuICAgIHRoaXMuY2FuY2VsbGVkID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7RnVuY3Rpb25bXX0gVGhlIGNhbGxiYWNrcyB0byBjYWxsIG9uIGNhbmNlbC5cbiAgICAgKi9cbiAgICB0aGlzLmNhbGxiYWNrcyA9IFtdO1xufVxuXG4vKipcbiAqIENhbmNlbCB0aGUgYWN0aW9ucyB0aGF0IGJpbmQgd2l0aCB0aGlzIGNhbmNlbCBjb250cm9sbGVyLlxuICovXG5DYW5jZWxDb250cm9sbGVyLnByb3RvdHlwZS5jYW5jZWwgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGNhbGxiYWNrcyA9IHRoaXMuY2FsbGJhY2tzO1xuICAgIHZhciBpID0gMDtcbiAgICB2YXIgbCA9IGNhbGxiYWNrcy5sZW5ndGg7XG5cbiAgICBpZiAodGhpcy5jYW5jZWxsZWQgPT09IGZhbHNlKSB7XG4gICAgICAgIHRoaXMuY2FuY2VsbGVkID0gdHJ1ZTtcblxuICAgICAgICBmb3IgKCA7IGkgPCBsOyBpICs9IDEpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2tzW2ldKCk7XG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgLy8gVGhyb3cgdGhlIGVycm9yIGxhdGVyIGZvciBkZWJ1Z2luZy5cbiAgICAgICAgICAgICAgICAoZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KShlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn07XG5cbi8qKlxuICogQ2hlY2sgd2hldGhlciB0aGUgY29udHJvbGxlciBpcyBjYW5jZWxsZWQuXG4gKlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSBjb250cm9sbGVyIGlzIGNhbmNlbGxlZCwgb3RoZXJ3aXNlIGBmYWxzZWAgaXMgcmV0dXJuZWQuXG4gKi9cbkNhbmNlbENvbnRyb2xsZXIucHJvdG90eXBlLmlzQ2FuY2VsbGVkID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLmNhbmNlbGxlZDtcbn07XG5cbi8qKlxuICogUmVnaXN0ZXIgYSBjYWxsYmFjaywgd2hpY2ggd2lsbCBiZSBjYWxsZWQgd2hlbiB0aGUgYGNhbmNlbCgpYCBtZXRob2QgaXMgY2FsbGVkLlxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIFRoZSBjYWxsYmFjayBmdW5jdGlvbiB0byBjYWxsIG9uIGNhbmNlbC5cbiAqL1xuQ2FuY2VsQ29udHJvbGxlci5wcm90b3R5cGUucmVnaXN0ZXJDYW5jZWxDYWxsYmFjayA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgIGlmIChpc0Z1bmN0aW9uKGNhbGxiYWNrKSkge1xuICAgICAgICB0aGlzLmNhbGxiYWNrcy5wdXNoKGNhbGxiYWNrKTtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IENhbmNlbENvbnRyb2xsZXI7XG4iLCJ2YXIgbWVyZ2UgPSByZXF1aXJlKDQxKTtcbnZhciBpc0Z1bmN0aW9uID0gcmVxdWlyZSgzOSk7XG52YXIgaXNQbGFpbk9iamVjdCA9IHJlcXVpcmUoNDApO1xudmFyIGNyZWF0ZURlZmF1bHRPcHRpb25zID0gcmVxdWlyZSgyOCk7XG52YXIgY3JlYXRlQ2FuY2VsQ29udHJvbGxlciA9IHJlcXVpcmUoMjcpO1xudmFyIG5vb3AgPSByZXF1aXJlKDMzKTtcbnZhciB2ZXJzaW9uID0gcmVxdWlyZSgzNik7XG52YXIgSHR0cFJlcXVlc3QgPSByZXF1aXJlKDMpO1xudmFyIEpTT05QUmVxdWVzdCA9IHJlcXVpcmUoNik7XG5cbi8qKlxuICogQGNsYXNzXG4gKlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gW2RlZmF1bHRzXSBUaGUgZGVmYXVsdCBvcHRpb25zIHRvIHVzZSB3aGVuIHNlbmRpbmcgcmVxdWVzdHMgd2l0aCB0aGUgY3JlYXRlZCBodHRwIGNsaWVudC5cbiAqIFRoaXMgZGVmYXVsdCBvcHRpb25zIHdpbGwgYmUgbWVyZ2VkIGludG8gdGhlIGludGVybmFsIGRlZmF1bHQgb3B0aW9ucyB0aGF0IGBjcmVhdGVEZWZhdWx0T3B0aW9ucygpYCByZXR1cm5zLlxuICpcbiAqIEBwYXJhbSB7SGFuZGxlT3B0aW9uc0Z1bmN0aW9ufSBbaGFuZGxlRGVmYXVsdHNdIFRoZSBoYW5kbGVyIGZ1bmN0aW9uIHRvIHByb2Nlc3MgdGhlIG1lcmdlZCBkZWZhdWx0IG9wdGlvbnMuIFRoZVxuICogbWVyZ2VkIGRlZmF1bHQgb3B0aW9ucyB3aWxsIGJlIHBhc3NlZCBpbnRvIHRoZSBmdW5jdGlvbiBhcyB0aGUgZmlyc3QgYXJndW1lbnQuIFlvdSBjYW4gbWFrZSBjaGFuZ2VzIHRvIGl0IGFzIHlvdVxuICogd2FudC4gVGhpcyBmdW5jdGlvbiBtdXN0IHJldHVybiBzeW5jaHJvbm91c2x5LiBUaGUgcmV0dXJuIHZhbHVlIG9mIHRoaXMgZnVuY3Rpb24gaXMgaWdub3JlZC5cbiAqL1xuZnVuY3Rpb24gSHR0cENsaWVudChkZWZhdWx0cywgaGFuZGxlRGVmYXVsdHMsIGhhbmRsZVJlcXVlc3RPcHRpb25zKSB7XG4gICAgdmFyIGRlZmF1bHRPcHRpb25zID0gY3JlYXRlRGVmYXVsdE9wdGlvbnMoKTtcblxuICAgIGlmIChpc1BsYWluT2JqZWN0KGRlZmF1bHRzKSkge1xuICAgICAgICBtZXJnZShkZWZhdWx0T3B0aW9ucywgZGVmYXVsdHMpO1xuICAgIH1cblxuICAgIGlmIChpc0Z1bmN0aW9uKGhhbmRsZURlZmF1bHRzKSkge1xuICAgICAgICBoYW5kbGVEZWZhdWx0cyhkZWZhdWx0T3B0aW9ucyk7XG4gICAgICAgIC8vIERlZXAgY29weSB0aGUgY2hhZ25lZCBvcHRpb25zXG4gICAgICAgIGRlZmF1bHRPcHRpb25zID0gbWVyZ2Uoe30sIGRlZmF1bHRPcHRpb25zKTtcbiAgICB9XG5cbiAgICBpZiAoIWlzRnVuY3Rpb24oaGFuZGxlUmVxdWVzdE9wdGlvbnMpKSB7XG4gICAgICAgIGhhbmRsZVJlcXVlc3RPcHRpb25zID0gbm9vcDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgYSBjb3B5IG9mIHRoZSBkZWZhdWx0IHJlcXVlc3Qgb3B0aW9ucy4gVGhpcyBmdW5jdGlvbiBpcyBOT1QgYXZhaWxhYmxlIG9uIHRoZSBwcm90b3R5cGUgb2YgYEh0dHBDbGllbnRgLlxuICAgICAqXG4gICAgICogQHJldHVybnMge1JlcXVlc3RPcHRpb25zfVxuICAgICAqL1xuICAgIHRoaXMuY29weU9wdGlvbnMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBtZXJnZSh7fSwgZGVmYXVsdE9wdGlvbnMpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBNZXJnZSB0aGUgcmVxdWVzdCBvcHRpb25zIHdpdGggdGhlIGRlZmF1bHQgcmVxdWVzdCBvcHRpb25zLiBUaGlzIGZ1bmN0aW9uIGlzIE5PVCBhdmFpbGFibGUgb24gdGhlIHByb3RvdHlwZSBvZlxuICAgICAqIGBIdHRwQ2xpZW50YCBhbmQgd2lsbCBjYWxsIGBoYW5kbGVSZXF1ZXN0T3B0aW9uc2AgdG8gaGFuZGxlIHRoZSBtZXJnZWQgcmVxdWVzdCBvcHRpb25zLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zIHRvIG1lcmdlLlxuICAgICAqIEByZXR1cm5zIHtSZXF1ZXN0T3B0aW9uc30gUmV0dXJucyB0aGUgbWVyZ2VkIHJlcXVlc3Qgb3B0aW9ucy5cbiAgICAgKi9cbiAgICB0aGlzLm1lcmdlT3B0aW9ucyA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIHZhciByZXF1ZXN0T3B0aW9ucyA9IG1lcmdlKHt9LCBkZWZhdWx0T3B0aW9ucywgb3B0aW9ucyk7XG5cbiAgICAgICAgaGFuZGxlUmVxdWVzdE9wdGlvbnMocmVxdWVzdE9wdGlvbnMpO1xuXG4gICAgICAgIHJldHVybiByZXF1ZXN0T3B0aW9ucztcbiAgICB9O1xufVxuXG4vKipcbiAqIFNlbmQgYW4gaHR0cCByZXF1ZXN0LlxuICpcbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucyB0byB1c2UsIHdoaWNoIHdpbGwgYmUgbWVyZ2VkIGludG8gYSBjb3B5IG9mIHRoZSBkZWZhdWx0IG9wdGlvbnMuXG4gKiBAcGFyYW0ge1JlcXVlc3RTdWNjZXNzQ2FsbGJhY2t9IG9uc3VjY2VzcyBUaGUgY2FsbGJhY2sgdG8gY2FsbCBvbiBzdWNjZXNzLlxuICogQHBhcmFtIHtSZXF1ZXN0RXJyb3JDYWxsYmFja30gb25lcnJvciBUaGUgY2FsbGJhY2sgdG8gY2FsbCBvbiBlcnJvci5cbiAqIEByZXR1cm5zIHtIdHRwUmVxdWVzdH0gUmV0dXJucyBhbiBpbnN0YW5jZSBvZiBgSHR0cFJlcXVlc3RgLlxuICovXG5IdHRwQ2xpZW50LnByb3RvdHlwZS5zZW5kID0gZnVuY3Rpb24gKG9wdGlvbnMsIG9uc3VjY2Vzcywgb25lcnJvcikge1xuICAgIHZhciByZXF1ZXN0T3B0aW9ucyA9IHRoaXMubWVyZ2VPcHRpb25zKG9wdGlvbnMpO1xuXG4gICAgcmVxdWVzdE9wdGlvbnMucmVxdWVzdEZ1bmN0aW9uTmFtZSA9ICdzZW5kJztcbiAgICByZXF1ZXN0T3B0aW9ucy5jb250cm9sbGVyID0gbnVsbDtcblxuICAgIHJldHVybiBuZXcgSHR0cFJlcXVlc3QocmVxdWVzdE9wdGlvbnMsIG9uc3VjY2Vzcywgb25lcnJvcik7XG59O1xuXG4vKipcbiAqIFNlbmQgYW4gaHR0cCByZXF1ZXN0IGFuZCByZXR1cm4gYSBwcm9taXNlLlxuICpcbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucyB0byB1c2UsIHdoaWNoIHdpbGwgYmUgbWVyZ2VkIGludG8gYSBjb3B5IG9mIHRoZSBkZWZhdWx0IG9wdGlvbnMuXG4gKiBAcmV0dXJucyB7UHJvbWlzZX0gUmV0dXJucyBhbiBpbnN0YW5jZSBvZiBgUHJvbWlzZWAuXG4gKi9cbkh0dHBDbGllbnQucHJvdG90eXBlLmZldGNoID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICB2YXIgcmVxdWVzdE9wdGlvbnMgPSB0aGlzLm1lcmdlT3B0aW9ucyhvcHRpb25zKTtcbiAgICB2YXIgY29udHJvbGxlciA9IHJlcXVlc3RPcHRpb25zLmNvbnRyb2xsZXI7XG5cbiAgICByZXF1ZXN0T3B0aW9ucy5yZXF1ZXN0RnVuY3Rpb25OYW1lID0gJ2ZldGNoJztcblxuICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgIHZhciByZXF1ZXN0ID0gbmV3IEh0dHBSZXF1ZXN0KHJlcXVlc3RPcHRpb25zLCBmdW5jdGlvbiAocmVzcG9uc2UpIHtcbiAgICAgICAgICAgIGlmIChjb250cm9sbGVyKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFjb250cm9sbGVyLmlzQ2FuY2VsbGVkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShyZXNwb25zZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHJlc3BvbnNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgcmVqZWN0KTtcblxuICAgICAgICBpZiAoY29udHJvbGxlcikge1xuICAgICAgICAgICAgLy8gVHJpZ2dlciB0aGUgYEVSUl9DQU5DRUxMRURgIGVycm9yLlxuICAgICAgICAgICAgaWYgKGNvbnRyb2xsZXIuaXNDYW5jZWxsZWQoKSkge1xuICAgICAgICAgICAgICAgIHJlcXVlc3QuY2FuY2VsKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnRyb2xsZXIucmVnaXN0ZXJDYW5jZWxDYWxsYmFjayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlcXVlc3QuY2FuY2VsKCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbn07XG5cbi8qKlxuICogU2VuZCBhIGpzb25wIHJlcXVlc3QuXG4gKlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zIHRvIHVzZSwgd2hpY2ggd2lsbCBiZSBtZXJnZWQgaW50byBhIGNvcHkgb2YgdGhlIGRlZmF1bHQgb3B0aW9ucy5cbiAqIEBwYXJhbSB7UmVxdWVzdFN1Y2Nlc3NDYWxsYmFja30gb25zdWNjZXNzIFRoZSBjYWxsYmFjayB0byBjYWxsIG9uIHN1Y2Nlc3MuXG4gKiBAcGFyYW0ge1JlcXVlc3RFcnJvckNhbGxiYWNrfSBvbmVycm9yIFRoZSBjYWxsYmFjayB0byBjYWxsIG9uIGVycm9yLlxuICogQHJldHVybnMge0pTT05QUmVxdWVzdH0gUmV0dXJucyBhbiBpbnN0YW5jZSBvZiBgSlNPTlBSZXF1ZXN0YC5cbiAqL1xuSHR0cENsaWVudC5wcm90b3R5cGUuZ2V0SlNPTlAgPSBmdW5jdGlvbiAob3B0aW9ucywgb25zdWNjZXNzLCBvbmVycm9yKSB7XG4gICAgdmFyIHJlcXVlc3RPcHRpb25zID0gdGhpcy5tZXJnZU9wdGlvbnMob3B0aW9ucyk7XG5cbiAgICByZXF1ZXN0T3B0aW9ucy5yZXF1ZXN0RnVuY3Rpb25OYW1lID0gJ2dldEpTT05QJztcbiAgICByZXF1ZXN0T3B0aW9ucy5jb250cm9sbGVyID0gbnVsbDtcblxuICAgIHJldHVybiBuZXcgSlNPTlBSZXF1ZXN0KHJlcXVlc3RPcHRpb25zLCBvbnN1Y2Nlc3MsIG9uZXJyb3IpO1xufTtcblxuLyoqXG4gKiBTZW5kIGEganNvbnAgcmVxdWVzdCBhbmQgcmV0dXJuIGEgcHJvbWlzZS5cbiAqXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMgdG8gdXNlLCB3aGljaCB3aWxsIGJlIG1lcmdlZCBpbnRvIGEgY29weSBvZiB0aGUgZGVmYXVsdCBvcHRpb25zLlxuICogQHJldHVybnMge1Byb21pc2V9IFJldHVybnMgYW4gaW5zdGFuY2Ugb2YgYFByb21pc2VgLlxuICovXG5IdHRwQ2xpZW50LnByb3RvdHlwZS5mZXRjaEpTT05QID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICB2YXIgcmVxdWVzdE9wdGlvbnMgPSB0aGlzLm1lcmdlT3B0aW9ucyhvcHRpb25zKTtcbiAgICB2YXIgY29udHJvbGxlciA9IHJlcXVlc3RPcHRpb25zLmNvbnRyb2xsZXI7XG5cbiAgICByZXF1ZXN0T3B0aW9ucy5yZXF1ZXN0RnVuY3Rpb25OYW1lID0gJ2ZldGNoSlNPTlAnO1xuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgdmFyIHJlcXVlc3QgPSBuZXcgSlNPTlBSZXF1ZXN0KHJlcXVlc3RPcHRpb25zLCBmdW5jdGlvbiAocmVzcG9uc2UpIHtcbiAgICAgICAgICAgIGlmIChjb250cm9sbGVyKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFjb250cm9sbGVyLmlzQ2FuY2VsbGVkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShyZXNwb25zZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHJlc3BvbnNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgcmVqZWN0KTtcblxuICAgICAgICBpZiAoY29udHJvbGxlcikge1xuICAgICAgICAgICAgLy8gVHJpZ2dlciB0aGUgYEVSUl9DQU5DRUxMRURgIGVycm9yLlxuICAgICAgICAgICAgaWYgKGNvbnRyb2xsZXIuaXNDYW5jZWxsZWQoKSkge1xuICAgICAgICAgICAgICAgIHJlcXVlc3QuY2FuY2VsKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnRyb2xsZXIucmVnaXN0ZXJDYW5jZWxDYWxsYmFjayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlcXVlc3QuY2FuY2VsKCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbn07XG5cbi8qKlxuICogQ3JlYXRlIGEgbmV3IGluc3RhbmNlIG9mIGBDYW5jZWxDb250cm9sbGVyYC5cbiAqXG4gKiBAcmV0dXJucyB7Q2FuY2VsQ29udHJvbGxlcn0gUmV0dXJucyBhbiBuZXcgaW5zdGFuY2Ugb2YgYENhbmNlbENvbnRyb2xsZXJgLlxuICovXG5IdHRwQ2xpZW50LnByb3RvdHlwZS5jcmVhdGVDYW5jZWxDb250cm9sbGVyID0gY3JlYXRlQ2FuY2VsQ29udHJvbGxlcjtcblxuLyoqXG4gKiBDcmVhdGUgYSBuZXcgaW5zdGFuY2Ugb2YgYENhbmNlbENvbnRyb2xsZXJgLlxuICpcbiAqIEByZXR1cm5zIHtDYW5jZWxDb250cm9sbGVyfSBSZXR1cm5zIGFuIG5ldyBpbnN0YW5jZSBvZiBgQ2FuY2VsQ29udHJvbGxlcmAuXG4gKi9cbkh0dHBDbGllbnQuY3JlYXRlQ2FuY2VsQ29udHJvbGxlciA9IGNyZWF0ZUNhbmNlbENvbnRyb2xsZXI7XG5cbi8vIFRoZSB2ZXJzaW9uLlxuSHR0cENsaWVudC52ZXJzaW9uID0gdmVyc2lvbjtcbkh0dHBDbGllbnQucHJvdG90eXBlLnZlcnNpb24gPSB2ZXJzaW9uO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEh0dHBDbGllbnQ7XG5cbi8qKlxuICogVGhpcyBjYWxsYmFjayBpcyB1c2VkIHRvIGhhbmxkZSB0aGUgbWVyZ2VkIGRlZmF1bHQgb3B0aW9ucy4gSXQgbXVzdCByZXRydW4gdGhlIHJlc3VsdCBzeW5jaHJvbm91c2x5LlxuICpcbiAqIEBjYWxsYmFjayBIYW5kbGVPcHRpb25zRnVuY3Rpb25cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIG1lcmdlZCBkZWZhdWx0IG9wdGlvbnMuXG4gKiBAcmV0dXJucyB7dm9pZH1cbiAqL1xuXG4vKipcbiAqIFRoZSBjYWxsYmFjayB0byBjYWxsIG9uIHN1Y2Nlc3MuXG4gKlxuICogQGNhbGxiYWNrIFJlcXVlc3RTdWNjZXNzQ2FsbGJhY2tcbiAqIEBwYXJhbSB7SHR0cFJlc3BvbnNlfGFueX0gcmVzcG9uc2UgVGhlIGh0dHAgcmVzcG9uc2Ugb3IgdGhlIHJldHVybiB2YWx1ZSBvZiBgb3B0aW9ucy50cmFuc2Zvcm1SZXNwb25zZShyZXNwb25zZSlgLlxuICovXG5cbi8qKlxuICogVGhlIGNhbGxiYWNrIHRvIGNhbGwgb24gZXJyb3IuXG4gKlxuICogQGNhbGxiYWNrIFJlcXVlc3RFcnJvckNhbGxiYWNrXG4gKiBAcGFyYW0ge0h0dHBSZXNwb25zZUVycm9yfGFueX0gZXJyb3IgVGhlIGh0dHAgcmVzcG9uc2UgZXJyb3Igb3IgdGhlIHJldHVybiB2YWx1ZSBvZiBgb3B0aW9ucy50cmFuc2Zvcm1FcnJvcihlcnJvcilgLlxuICovXG5cbi8qKlxuICogVGhlIGRlZmluaXRvbiBvZiB0aGUgcmVxdWVzdCBvcHRpb25zLlxuICpcbiAqIEB0eXBlZGVmIHtPYmplY3QuPHN0cmluZywgKj59IFJlcXVlc3RPcHRpb25zXG4gKlxuICogQHByb3BlcnR5IHtzdHJpbmd9IFttZXRob2RdIFRoZSBodHRwIHJlcXVlc3QgbWV0aG9kLiBUaGUgZGVmYXVsdCBtZXRob2QgaXMgYEdFVGAuXG4gKlxuICogQHByb3BlcnR5IHtzdHJpbmd9IFtiYXNlVVJMXSBUaGUgcmVxdWVzdCBiYXNlIHVybC4gSWYgdGhlIGB1cmxgIGlzIHJlbGF0aXZlIHVybCwgYW5kIHRoZSBgYmFzZVVSTGAgaXMgbm90IGBudWxsYCwgdGhlXG4gKiBgYmFzZVVSTGAgd2lsbCBiZSBwcmVwZW5kIHRvIHRoZSBgdXJsYC5cbiAqXG4gKiBAcHJvcGVydHkge3N0cmluZ30gdXJsIFRoZSByZXF1ZXN0IHVybCB0aGF0IGNhbiBjb250YWluIGFueSBudW1iZXIgb2YgcGxhY2Vob2xkZXJzLCBhbmQgd2lsbCBiZSBjb21waWxlZCB3aXRoIHRoZVxuICogZGF0YSB0aGF0IHBhc3NlZCBpbiB3aXRoIGBvcHRpb25zLnBhcmFtYC5cbiAqXG4gKiBAcHJvcGVydHkge09iamVjdC48c3RyaW5nLCAqPn0gW3BhcmFtXSBUaGUgZGF0YSB1c2VkIHRvIGNvbXBpbGUgdGhlIHJlcXVlc3QgdXJsLlxuICpcbiAqIEBwcm9wZXJ0eSB7T2JqZWN0LjxzdHJpbmcsICo+fSBbcXVlcnldIFRoZSBkYXRhIHRoYXQgd2lsbCBiZSBjb21waWxlZCB0byBxdWVyeSBzdHJpbmcuXG4gKlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgKj59IFtib2R5XSBUaGUgb2JqZWN0IHRoYXQgY29udGFpbnMgdGhlIGNvbnRlbnQgd2hpY2ggd2lsbCBiZSBzZW5kIHRvIHRoZSBzZXJ2ZXIuIFRoaXNcbiAqIG9iamVjdCBoYXMgb25seSBvbmUgcHJvcGVydHkuIFRoZSBuYW1lIG9mIHRoZSBwcm9wZXJ0eSBpcyB0aGUgY29udGVudCB0eXBlIG9mIHRoZSBjb250ZW50LCB3aGljaCB3aWxsIGJlIHVzZWQgdG8gZmluZFxuICogYSBwcm9jZXNzb3IgaW4gYG9wdGlvbnMuaHR0cFJlcXVlc3RCb2R5UHJvY2Vzc29yYC4gVGhlIHByb2Nlc3NvciBpcyB1c2VkIHRvIHByb2Nlc3MgdGhlIHZhbHVlIG9mIHRoZSBwcm9wZXJ0eS4gVGhlXG4gKiBwcm9jZXNzZWQgdmFsdWUgd2hpY2ggdGhlIHByb2Nlc3NvciByZXR1cm5zIHdpbGwgYmUgc2VuZCB0byB0aGUgc2VydmVyIGFzIHRoZSByZXF1ZXN0IGJvZHkuXG4gKlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgKj59IFtleHRyYV0gVGhlIG9iamVjdCB0byBrZWVwIHRoZSBleHRyYSBpbmZvcm1hdGlvbiB0aGF0IHRoZSB1c2VyIHBhc3NlZCBpbi4gVGhlIGxpYnJhcnlcbiAqIGl0c2VsZiB3aWxsIG5vdCB0b3VjaCB0aGlzIHByb3BlcnR5LiBZb3UgY2FuIHVzZSB0aGlzIHByb3BlcnR5IHRvIGhvbGQgYW55IGluZm9ybWF0aW9uIHRoYXQgeW91IHdhbnQsIHdoZW4geW91IGV4dGVuZFxuICogdGhlIGZ1bmN0aW9uYWxpdHkgb2YgeW91ciBvd24gaW5zdGFuY2Ugb2YgYEh0dHBDbGllbnRgLiBUaGUgZGVmYXVsdCB2YWx1ZSBvZiB0aGlzIHByb3BlcnR5IGlzIGFuIGVtcHR5IG9iamVjdC5cbiAqXG4gKiBAcHJvcGVydHkge09iamVjdC48c3RyaW5nLCAqPn0gW2hlYWRlcnNdIFRoZSBvYmplY3QgdGhhdCBjb250YWlucyB0aGUgaGVhZGVycyB0byBzZXQgd2hlbiBzZW5kaW5nIHRoZSByZXF1ZXN0LiBPbmx5XG4gKiB0aGUgbm9uLXVuZGVmaW5lZCBhbmQgbm9uLW51bGwgaGVhZGVycyBhcmUgc2V0LlxuICpcbiAqIEBwcm9wZXJ0eSB7Q2FuY2VsQ29udHJvbGxlcn0gW2NvbnRyb2xsZXJdIFRoZSBgQ2FuY2VsQ29udHJvbGxlcmAgdXNlZCB0byBjYW5jZWwgdGhlIHJlcXVlc3QuIEl0IG9ubHkgd29ya3Mgd2hlbiB1c2luZ1xuICogYGZldGNoYCBvciBgZmV0Y2hKU09OUGAgdG8gc2VuZCByZXF1ZXN0LiBJZiB0aGUgeW91IHNlbmQgcmVxdWVzdCB1c2luZyBgc2VuZGAgb3IgYGdldEpTT05QYCwgdGhlIGBvcHRpb25zLmNvbnRyb2xsZXJgXG4gKiB3aWxsIGJlIHNldCB0byBgbnVsbGAuXG4gKlxuICogQHByb3BlcnR5IHtzdHJpbmd9IFtyZXF1ZXN0RnVuY3Rpb25OYW1lXSBUaGUgbmFtZSBvZiB0aGUgZnVuY3Rpb24gdGhhdCBzZW5kIHRoZSByZXF1ZXN0LiBDYW4gYmUgYHNlbmRgLCBgZmV0Y2hgLFxuICogYGdldEpTT05QYCwgYGZldGNoSlNPTlBgLiBUaGlzIHZhbHVlIGlzIHNldCBieSB0aGUgbGlicmFyeSwgZG9uJ3QgY2hhbmdlIGl0LlxuICpcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbcmVxdWVzdFR5cGVdIFRoZSByZXF1ZXN0IHR5cGUgb2YgdGhpcyByZXF1ZXN0LiBUaGUgdmFsdWUgb2YgaXQgaXMgc2V0IGJ5IHRoZSBsaWJyYXJ5IGl0c2VsZiwgY2FuXG4gKiBiZSBgSFRUUF9SRVFVRVNUYCBvciBgSlNPTlBfUkVRVUVTVGAuIEFueSBvdGhlciB2YWx1ZSB0aGUgdXNlciBwYXNzZWQgaW4gaXMgaWdub3JlZC4gWW91IGNhbiB1c2UgdGhpcyBwcm9wZXJ0eSB0byBnZXRcbiAqIHRoZSB0eXBlIG9mIHRoZSBjdXJyZW50IHJlcXVlc3QuXG4gKlxuICogQHByb3BlcnR5IHtib29sZWFufSBbY29yc10gV2hldGhlciB0byBzZXQgYHdpdGhDcmVkZW50aWFsc2AgcHJvcGVydHkgb2YgdGhlIGBYTUxIdHRwUmVxdWVzdGAgdG8gYHRydWVgLiBUaGUgZGVmYXVsdFxuICogdmFsdWUgaXMgYGZhbHNlYC5cbiAqXG4gKiBAcHJvcGVydHkge09iamVjdC48c3RyaW5nLCAqPn0gW3hoclByb3BzXSBUaGUgb2JqZWN0IHRoYXQgY29udGFpbnMgdGhlIHByb3BlcnRpZXMgdG8gc2V0IG9uIHRoZSBpbnN0YW5jZSBvZiB0aGVcbiAqIGBYTUxIdHRwUmVxdWVzdGAuXG4gKlxuICogQHByb3BlcnR5IHtzdHJpbmd9IFt1c2VybmFtZV0gVGhlIHVzZXIgbmFtZSB0byB1c2UgZm9yIGF1dGhlbnRpY2F0aW9uIHB1cnBvc2VzLiBUaGUgZGVmdWFsdCB2YWx1ZSBpcyBgbnVsbGAuXG4gKlxuICogQHByb3BlcnR5IHtzdHJpbmd9IFtwYXNzd29yZF0gVGhlIHBhc3N3b3JkIHRvIHVzZSBmb3IgYXV0aGVudGljYXRpb24gcHVycG9zZXMuIFRoZSBkZWZ1YWx0IHZhbHVlIGlzIGBudWxsYC5cbiAqXG4gKiBAcHJvcGVydHkge251bWJlcn0gW3RpbWVvdXRdIFRoZSBudW1iZXIgb2YgbWlsbGlzZWNvbmRzIHRoZSByZXF1ZXN0IGNhbiB0YWtlIGJlZm9yZSBpdCBmaW5pc2hlZC4gSWYgdGhlIHRpbWVvdXQgdmFsdWVcbiAqIGlzIGAwYCwgbm8gdGltZXIgd2lsbCBiZSBzZXQuIElmIHRoZSByZXF1ZXN0IGRvZXMgbm90IGZpbnNpaGVkIHdpdGhpbiB0aGUgZ2l2ZW4gdGltZSwgYSB0aW1lb3V0IGVycm9yIHdpbGwgYmUgdGhyb3duLlxuICogVGhlIGRlZmF1bHQgdmFsdWUgaXMgYDBgLlxuICpcbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gW25vQ2FjaGVdIFdoZXRoZXIgdG8gZGlzYWJsZSB0aGUgY2FjaGUuIElmIHRoZSB2YWx1ZSBpcyBgdHJ1ZWAsIHRoZSBoZWFkZXJzIGluXG4gKiBgb3B0aW9ucy5ub0NhY2hlSGVhZGVyc2Agd2lsbCBiZSBzZXQuIFRoZSBkZWZhdWx0IHZhbHVlIGlzIGBmYWxzZWAuXG4gKlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgKj59IFtub0NhY2hlSGVhZGVyc10gVGhlIGhlYWRlcnMgdG8gc2V0IHdoZW4gYG9wdGlvbnMubm9DYWNoZWAgaXMgc2V0IHRvIGB0cnVlYC5cbiAqXG4gKiBAcHJvcGVydHkge3N0cmluZ30gW2pzb25wXSBUaGUgcXVlcnkgc3RyaW5nIGtleSB0byBob2xkIHRoZSB2YWx1ZSBvZiB0aGUgY2FsbGJhY2sgbmFtZSB3aGVuIHNlbmRpbmcgSlNPTlAgcmVxdWVzdC5cbiAqIFRoZSBkZWZhdWx0IHZhbHVlcyBpcyBgY2FsbGJhY2tgLlxuICpcbiAqIEBwcm9wZXJ0eSB7T2JqZWN0LjxzdHJpbmcsICo+fSBbZXJyb3JNZXNzYWdlc10gVGhlIG9iamVjdCB0byBjb25maWcgdGhlIGVycm9yIG1lc3NhZ2VzLiBUaGUga2V5cyBpbiB0aGUgb2JqZWN0IGFyZVxuICogZXJyb3IgY29kZSBzdWNoIGFzIGBFUlJfTkVUV09SS2AuXG4gKlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgaHR0cFJlcXVlc3RCb2R5UHJvY2Vzc29yPn0gW2h0dHBSZXF1ZXN0Qm9keVByb2Nlc3Nvcl0gVGhlIG9iamVjdCB0aGF0IGNvbnRhaW5zIHRoZVxuICogaHR0cCByZXF1ZXN0IGJvZHkgcHJvY2Vzc29ycy5cbiAqXG4gKiBAcHJvcGVydHkge09iamVjdC48c3RyaW5nLCBSZXNwb25zZVBhcnNlRnVuY3Rpb24+fSBbaHR0cFJlc3BvbnNlUGFyc2VyXSBUaGUgb2JqZWN0IHRoYXQgY29udGFpbnMgdGhlIGh0dHAgcmVzcG9uc2VcbiAqIHBhcnNlcnMuXG4gKlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgUmVzcG9uc2VQYXJzZUZ1bmN0aW9uPn0gW2pzb25wUmVzcG9uc2VQYXJzZXJdIFRoZSBvYmplY3QgdGhhdCBjb250YWlucyB0aGUganNvbnAgcmVzcG9uc2VcbiAqIHBhcnNlcnMuXG4gKlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgUmVzcG9uc2VFcnJvclBhcnNlRnVuY3Rpb24+fSBbaHR0cFJlc3BvbnNlRXJyb3JQYXJzZXJdIFRoZSBvYmplY3QgdGhhdCBjb250YWlucyB0aGUgaHR0cFxuICogcmVzcG9uc2UgZXJyb3IgcGFyc2Vycy5cbiAqXG4gKiBAcHJvcGVydHkge09iamVjdC48c3RyaW5nLCBSZXNwb25zZUVycm9yUGFyc2VGdW5jdGlvbj59IFtqc29ucFJlc3BvbnNlRXJyb3JQYXJzZXJdIFRoZSBvYmplY3QgdGhhdCBjb250YWlucyB0aGUganNvbnBcbiAqIHJlc3BvbnNlIGVycm9yIHBhcnNlcnMuXG4gKlxuICogQHByb3BlcnR5IHtIYW5sZGVPcHRpb25zRnVuY3Rpb259IFtoYW5kbGVPcHRpb25zXSBUaGUgZnVuY3Rpb24gdG8gaGFuZGxlIHRoZSBvcHRpb25zLlxuICpcbiAqIEBwcm9wZXJ0eSB7Q3JlYXRlWEhSRnVuY3Rpb259IFtjcmVhdGVYSFJdIFRoZSBmdW5jdGlvbiB0byBjcmVhdGUgdGhlIGBYTUxIdHRwUmVxdWVzdGAgaW5zdGFuY2UuXG4gKlxuICogQHByb3BlcnR5IHtTY3JpcHRDcmVhdGVGdW5jdGlvbn0gW2NyZWF0ZVNjcmlwdF0gVGhlIGZ1bmN0aW9uIHRvIGNyZWF0ZSB0aGUgYEhUTUxTY3JpcHRFbGVtZW50YCBpbnN0YW5jZS5cbiAqXG4gKiBAcHJvcGVydHkge0pTT05QQ29udGFpbmVyRmluZEZ1bmN0aW9ufSBbanNvbnBDb250YWluZXJOb2RlXSBUaGUgZnVuY3Rpb24gdGhhdCByZXR1cm5zIHRoZSBjb250YWluZXIgbm9kZSwgd2hpY2ggd2lsbFxuICogYmUgdXNlZCB0byBhcHBlbmQgdGhlIHNjcmlwdCBlbGVtZW50IHdoZW4gc2VuZGluZyBqc29ucCByZXF1ZXN0LlxuICpcbiAqIEBwcm9wZXJ0eSB7SlNPTlBDYWxsYmFja05hbWVHZW5lcmF0ZUZ1bmN0aW9ufSBbanNvbnBDYWxsYmFja05hbWVdIFRoZSBmdW5jdGlvbiB0byBnZW5lcmF0ZSB0aGUgdW5pcXVlIGNhbGxiYWNrIG5hbWVcbiAqIHdoZW4gc2VuZGluZyBqc29ucCByZXF1ZXN0LlxuICpcbiAqIEBwcm9wZXJ0eSB7Q29tcGlsZVVSTEZ1bmN0aW9ufSBbY29tcGlsZVVSTF0gVGhlIGZ1bmN0aW9uIHRvIGNvbXBpbGUgdXJsLlxuICpcbiAqIEBwcm9wZXJ0eSB7RW5jb2RlUXVlcnlTdHJpbmdGdW5jdGlvbn0gZW5jb2RlUXVlcnlTdHJpbmcgVGhlIGZ1bmN0aW9uIHRvIGVuY29kZSB0aGUgcXVlcnkgc3RyaW5nLlxuICpcbiAqIEBwcm9wZXJ0eSB7WEhSSG9va0Z1bmN0aW9ufSBvblhockNyZWF0ZWQgVGhlIGZ1bmN0aW9uIHRvIGNhbGwgb24geGhyIGNyZWF0ZWQuXG4gKlxuICogQHByb3BlcnR5IHtYSFJIb29rRnVuY3Rpb259IG9uWGhyT3BlbmVkIFRoZSBmdW5jdG9uIHRvIGNhbGwgb24geGhyIG9wZW5lZC5cbiAqXG4gKiBAcHJvcGVydHkge1hIUkhvb2tGdW5jdGlvbn0gb25YaHJTZW50IFRoZSBmdW5jdGlvbiB0byBjYWxsIG9uIHhociBzZW50LlxuICpcbiAqIEBwcm9wZXJ0eSB7UmVxdWVzdENyZWF0ZWRGdW5jdGlvbn0gb25SZXF1ZXN0Q3JlYXRlZCBUaGUgZnVuY3Rpb24gdG8gY2FsbCBvbiByZXF1ZXN0IGNyZWF0ZWQuXG4gKlxuICogQHByb3BlcnR5IHtDaGVja1Jlc3BvbnNlT2tGdW5jdGlvbn0gaXNSZXNwb25zZU9rIFRoZSBmdW5jdGlvbiB0byBjaGVjayB3aGV0aGVyIHRoZSByZXNwb25zZSBpcyBvay5cbiAqXG4gKiBAcHJvcGVydHkge1RyYW5zZm9ybUVycm9yRnVuY3Rpb259IHRyYW5zZm9ybUVycm9yIFRoZSBmdW5jdGlvbiB0byB0cmFuc2Zyb20gdGhlIHJlc3BvbnNlIGVycm9yLiBUaGUgcmV0dXJuIHZhbHVlIG9mXG4gKiB0aGlzIGZ1bmN0aW9uIHdpbGwgYmUgcGFzc2VkIHRvIHRoZSBgb25lcnJvcmAgY2FsbGJhY2suXG4gKlxuICogQHByb3BlcnR5IHtUcmFuc2Zvcm1SZXNwb25zZUZ1bmN0aW9ufSB0cmFuc2Zvcm1SZXNwb25zZSBUaGUgZnVuY3Rpb24gdG8gdHJhbnNmcm9tIHRoZSByZXNwb25zZS4gVGhlIHJldHVybiB2YWx1ZSBvZlxuICogdGhpcyBmdW5jdGlvbiB3aWxsIGJlIHBhc3NlZCB0byB0aGUgYG9uc3VjY2Vzc2AgY2FsbGJhY2suXG4gKlxuICogQHByb3BlcnR5IHtDaGVja1Nob3VsZENhbGxFcnJvckNhbGxiYWNrRnVuY3Rpb259IHNob3VsZENhbGxFcnJvckNhbGxiYWNrIFRoZSBmdW5jdGlvbiB0byBjaGVjayB3aGV0aGVyIHRvIGNhbGwgdGhlXG4gKiBlcnJvciBjYWxsYmFjay5cbiAqXG4gKiBAcHJvcGVydHkge0NoZWNrU2hvdWxkQ2FsbFN1Y2Nlc3NDYWxsYmFja0Z1bmN0aW9ufSBzaG91bGRDYWxsU3VjY2Vzc0NhbGxiYWNrIFRoZSBmdW5jdGlvbiB0byBjaGVjayB3aGV0aGVyIHRvIGNhbGxcbiAqIHRoZSBzdWNjZXNzIGNhbGxiYWNrLlxuICovXG5cbi8qKlxuICogVGhlIGRlZmluaXRvbiBvZiBodHRwIHJlcXVlc3QgZGF0YSBwcm9jZXNzb3IuXG4gKlxuICogQHR5cGVkZWYge09iamVjdC48c3RyaW5nLCAqPn0gaHR0cFJlcXVlc3RCb2R5UHJvY2Vzc29yXG4gKiBAcHJvcGVydHkge251bWJlcn0gcHJpb3JpdHkgVGhlIHByaW9yaXR5IG9mIHRoZSBwcm9jZXNzb3IuXG4gKiBAcHJvcGVydHkge09iamVjdC48c3RyaW5nLCAqPn0gW2hlYWRlcnNdIFRoZSBoZWFkZXJzIHRvIHNldCB3aGVuIHRoaXMgcHJvY2Vzc29yIGlzIHVzZWQuXG4gKiBAcHJvcGVydHkge0h0dHBSZXF1ZXN0Q29udGVudFByb2Nlc3NGdW5jdGlvbn0gW3Byb2Nlc3Nvcl0gVGhlIGZ1bmN0aW9uIHRvIHByb2Nlc3MgdGhlIHJlcXVlc3QgYm9keS5cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBoYW5kbGUgdGhlIG9wdGlvbnMuXG4gKlxuICogQGNhbGxiYWNrIEhhbmxkZU9wdGlvbnNGdW5jdGlvblxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICovXG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIHByb2Nlc3MgdGhlIHJlcXVlc3QgZGF0YS5cbiAqXG4gKiBAY2FsbGJhY2sgSHR0cFJlcXVlc3RDb250ZW50UHJvY2Vzc0Z1bmN0aW9uXG4gKiBAcGFyYW0ge09iamVjdC48c3RyaW5nLCAqPn0gY29udGVudCBUaGUgY29uZW50IG5lZWQgdG8gcHJvY2Vzcy5cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucyBvZiB0aGUgY3VycmVudCByZXF1ZXN0LlxuICogQHJldHVybnMge2FueX0gUmV0dXJucyB0aGUgdmFsdWUgdGhhdCB3aWxsIGJlIHNlbmQgdG8gdGhlIHNlcnZlci5cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBwYXJzZSB0aGUgcmVzcG9uc2UuIFRoaXMgZnVuY3Rpb24gd2lsbCBiZSBtb3VudGVkIG9uIHRoZSByZXNwb25zZSBpbnN0YW5jZSwgd2hpY2ggbWFkZSBpdCBhIG1ldGhvZFxuICogb2YgdGhlIGBSZXNwb25zZWAgaW5zdGFuY2UuIFRoZSBwYXJhbWV0ZXJzIGFuZCB0aGUgcmV0dXJuIHZhbHVlIGlzIHVwIG9uIHlvdS5cbiAqXG4gKiBAY2FsbGJhY2sgUmVzcG9uc2VQYXJzZUZ1bmN0aW9uXG4gKi9cblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gcGFyc2UgdGhlIHJlc3BvbnNlIGVycm9yLiBUaGlzIGZ1bmN0aW9uIHdpbGwgYmUgbW91bnRlZCBvbiB0aGUgcmVzcG9uc2UgZXJyb3IgaW5zdGFuY2UsIHdoaWNoIG1hZGUgaXRcbiAqIGEgbWV0aG9kIG9mIHRoZSBgUmVzcG9uc2VFcnJvcmAgaW5zdGFuY2UuIFRoZSBwYXJhbWV0ZXJzIGFuZCB0aGUgcmV0dXJuIHZhbHVlIGlzIHVwIG9uIHlvdS5cbiAqXG4gKiBAY2FsbGJhY2sgUmVzcG9uc2VFcnJvclBhcnNlRnVuY3Rpb25cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBjcmVhdGUgdGhlIGBYTUxIdHRwUmVxdWVzdGAgaW5zdGFuY2UuXG4gKlxuICogQGNhbGxiYWNrIENyZWF0ZVhIUkZ1bmN0aW9uXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcmV0dXJucyB7WE1MSHR0cFJlcXVlc3R9IFJldHVybnMgYW4gaW5zdGFuY2Ugb2YgYFhNTEh0dHBSZXF1ZXN0YC5cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBjcmVhdGUgdGhlIGBIVE1MU2NyaXB0RWxlbWVudGAgaW5zdGFuY2UuXG4gKlxuICogQGNhbGxiYWNrIFNjcmlwdENyZWF0ZUZ1bmN0aW9uXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcmV0dXJucyB7SFRNTFNjcmlwdEVsZW1lbnR9IFJldHVybnMgYW4gaW5zdGFuY2Ugb2YgYEhUTUxTY3JpcHRFbGVtZW50YC5cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0aGF0IHJldHVybnMgdGhlIG5vZGUgdG8gYXBwZW5kIHRoZSBzY3JpcHQgZWxlbWVudC5cbiAqXG4gKiBAY2FsbGJhY2sgSlNPTlBDb250YWluZXJGaW5kRnVuY3Rpb25cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEByZXR1cm5zIHtOb2RlfSBSZXR1cm5zIHRoZSBub2RlIHRvIGFwcGVuZCB0aGUgc2NyaXB0IGVsZW1lbnQuXG4gKi9cblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gZ2VuZXJhdGUgdGhlIHVuaXF1ZSBjYWxsYmFjayBuYW1lLlxuICpcbiAqIEBjYWxsYmFjayBKU09OUENhbGxiYWNrTmFtZUdlbmVyYXRlRnVuY3Rpb25cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEByZXR1cm5zIHtzdHJpbmd9IFJldHJ1bnMgYSB2YWxpZCBqYXZhc2NyaXB0IGlkZW50aWZpZXIgdG8gaG9sZCB0aGUgY2FsbGJhay5cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBjb21waWxlIHRoZSByZXF1ZXN0IHVybC5cbiAqXG4gKiBAY2FsbGJhY2sgQ29tcGlsZVVSTEZ1bmN0aW9uXG4gKiBAcGFyYW0ge3N0cmluZ30gdXJsIFRoZSB1cmwgKHdpdGggYmFzZVVSTCkgdG8gY29tcGlsZS5cbiAqIEBwYXJhbSB7T2JqZWN0LjxzdHJpbmcsICo+fSBwYXJhbSBUaGUgcGFyYW0gdG8gY29tcGlsZSB0aGUgdXJsLlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICogQHJldHVybnMge3N0cmluZ30gUmV0dXJucyB0aGUgY29tcGlsZWQgdXJsLlxuICovXG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGVuY29kZSB0aGUgcXVlcnkgc3RyaW5nLlxuICpcbiAqIEBjYWxsYmFjayBFbmNvZGVRdWVyeVN0cmluZ0Z1bmN0aW9uXG4gKiBAcGFyYW0ge09iamVjdC48c3RyaW5nLCAqPn0gZGF0YSBUaGUgZGF0YSB0byBiZSBlbmNvZGVkIHRvIHF1ZXJ5IHN0cmluZy5cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEByZXR1cm5zIHtzdHJpbmd9IFJldHVybnMgdGhlIGVuY29kZWQgcXVlcnkgc3RyaW5nLlxuICovXG5cbi8qKlxuICogVGhlIHhociBob29rIGZ1bmN0aW9uLlxuICpcbiAqIEBjYWxsYmFjayBYSFJIb29rRnVuY3Rpb25cbiAqIEBwYXJhbSB7WE1MSHR0cFJlcXVlc3R9IHhociBUaGUgaW5zdGFuY2Ugb2YgYFhNTEh0dHBSZXF1ZXN0YC5cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqL1xuXG4vKipcbiAqIEBjYWxsYmFjayBSZXF1ZXN0Q3JlYXRlZEZ1bmN0aW9uXG4gKiBAcGFyYW0ge0h0dHBSZXF1ZXN0fEpTT05QUmVxdWVzdH0gcmVxdWVzdCBUaGUgcmVxdWVzdCBpbnN0YW5jZSwgY2FuIGJlIGBIdHRwUmVxdWVzdGAgb3IgYEpTT05QUmVxdWVzdGAuXG4gKi9cblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gY2hlY2sgd2hldGhlciB0aGUgcmVzcG9uc2UgaXMgb2suXG4gKlxuICogQGNhbGxiYWNrIENoZWNrUmVzcG9uc2VPa0Z1bmN0aW9uXG4gKiBAcGFyYW0ge3N0cmluZ30gcmVxdWVzdFR5cGUgVGhlIHJlcXVlc3QgdHlwZSwgYEhUVFBfUkVRVUVTVGAgb3IgYEpTT05QX1JFUVVFU1RgLlxuICogQHBhcmFtIHtSZXNwb25zZX0gcmVzcG9uc2UgVGhlIHJlc3BvbnNlIGluc3RhbmNlLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSByZXNwb25zZSBpcyBvaywgb3RoZXJ3aXNlIGBmYWxzZWAgaXMgcmV0dXJuZWQuXG4gKi9cblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gY2hlY2sgd2hldGhlciB0byBjYWxsIHRoZSBlcnJvciBjYWxsYmFjay5cbiAqXG4gKiBAY2FsbGJhY2sgQ2hlY2tTaG91bGRDYWxsRXJyb3JDYWxsYmFja0Z1bmN0aW9uXG4gKiBAcGFyYW0ge3N0cmluZ30gcmVxdWVzdFR5cGUgVGhlIHJlcXVlc3QgdHlwZSwgYEhUVFBfUkVRVUVTVGAgb3IgYEpTT05QX1JFUVVFU1RgLlxuICogQHBhcmFtIHthbnl9IHRyYW5zZm9ybWVkRXJyb3IgVGhlIGRhdGEgdGhhdCBgb3B0aW9ucy50cmFuc2Zvcm1FcnJvciguLi4pYCByZXR1cm5zLlxuICogQHBhcmFtIHtIdHRwUmVzcG9uc2VFcnJvcnxKU09OUFJlc3BvbnNlRXJyb3J9IGVycm9yIFRoZSByZXNwb25zZSBlcnJvci5cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBjaGVjayB3aGV0aGVyIHRvIGNhbGwgdGhlIHN1Y2Nlc3MgY2FsbGJhY2suXG4gKlxuICogQGNhbGxiYWNrIENoZWNrU2hvdWxkQ2FsbFN1Y2Nlc3NDYWxsYmFja0Z1bmN0aW9uXG4gKiBAcGFyYW0ge3N0cmluZ30gcmVxdWVzdFR5cGUgVGhlIHJlcXVlc3QgdHlwZSwgYEhUVFBfUkVRVUVTVGAgb3IgYEpTT05QX1JFUVVFU1RgLlxuICogQHBhcmFtIHthbnl9IHRyYW5zZm9ybWVkUmVzcG9uc2UgVGhlIGRhdGEgdGhhdCBgb3B0aW9ucy50cmFuc2Zvcm1SZXNwb25zZSguLi4pYCByZXR1cm5zLlxuICogQHBhcmFtIHtIdHRwUmVzcG9uc2V8SlNPTlBSZXNwb25zZX0gcmVzcG9uc2UgVGhlIHJlc3BvbnNlLlxuICovXG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIHRyYW5zZnJvbSB0aGUgcmVzcG9uc2UuIFRoZSByZXR1cm4gdmFsdWUgb2YgdGhpcyBmdW5jdGlvbiB3aWxsIGJlIHBhc3NlZCB0byB0aGUgYG9uc3VjY2Vzc2AgY2FsbGJhY2suXG4gKlxuICogQGNhbGxiYWNrIFRyYW5zZm9ybVJlc3BvbnNlRnVuY3Rpb25cbiAqIEBwYXJhbSB7c3RyaW5nfSByZXF1ZXN0VHlwZSBUaGUgcmVxdWVzdCB0eXBlLCBgSFRUUF9SRVFVRVNUYCBvciBgSlNPTlBfUkVRVUVTVGAuXG4gKiBAcGFyYW0ge0h0dHBSZXNwb25zZXxKU09OUFJlc3BvbnNlfSByZXNwb25zZSBUaGUgcmVzcG9uc2UuXG4gKiBAcmV0dXJucyB7YW55fSBSZXR1cm5zIHRoZSB0cmFuc2Zvcm1lZCByZXNwb25zZS5cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byB0cmFuc2Zyb20gdGhlIHJlc3BvbnNlIGVycm9yLiBUaGUgcmV0dXJuIHZhbHVlIG9mIHRoaXMgZnVuY3Rpb24gd2lsbCBiZSBwYXNzZWQgdG8gdGhlIGBvbmVycm9yYFxuICogY2FsbGJhY2suXG4gKlxuICogQGNhbGxiYWNrIFRyYW5zZm9ybUVycm9yRnVuY3Rpb25cbiAqIEBwYXJhbSB7c3RyaW5nfSByZXF1ZXN0VHlwZSBUaGUgcmVxdWVzdCB0eXBlLCBgSFRUUF9SRVFVRVNUYCBvciBgSlNPTlBfUkVRVUVTVGAuXG4gKiBAcGFyYW0ge0h0dHBSZXNwb25zZUVycm9yfEpTT05QUmVzcG9uc2VFcnJvcn0gZXJyb3IgVGhlIHJlc3BvbnNlIGVycm9yLlxuICogQHJldHVybnMge2FueX0gUmV0dXJucyB0aGUgdHJhbnNmb3JtZWQgcmVzcG9uc2UgZXJyb3IuXG4gKi9cbiIsInZhciBSZXF1ZXNldCA9IHJlcXVpcmUoOSk7XG52YXIgY29uc3RhbnRzID0gcmVxdWlyZSgxMik7XG52YXIgaW5oZXJpdHMgPSByZXF1aXJlKDMyKTtcbnZhciBidWlsZFVSTCA9IHJlcXVpcmUoMjUpO1xudmFyIGhhbmRsZU9wdGlvbnMgPSByZXF1aXJlKDMxKTtcbnZhciBjYWxsUmVxdWVzdENyZWF0ZWRDYWxsYmFjayA9IHJlcXVpcmUoMjYpO1xudmFyIGFkZEV2ZW50TGlzdGVuZXJzID0gcmVxdWlyZSgxMyk7XG52YXIgaGFuZGxlWGhyUHJvcHMgPSByZXF1aXJlKDE4KTtcbnZhciBoYW5kbGVIZWFkZXJzID0gcmVxdWlyZSgxNik7XG52YXIgaGFuZGxlUmVxdWVzdEJvZHkgPSByZXF1aXJlKDE3KTtcbnZhciBjYWxsWGhySG9vayA9IHJlcXVpcmUoMTUpO1xuXG4vKipcbiAqIFJlcHJlc2VudHMgYW4gaHR0cCByZXF1ZXN0LlxuICpcbiAqIEBjbGFzc1xuICogQGV4dGVuZHMge1JlcXVlc2V0fVxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICogQHBhcmFtIHtSZXF1ZXN0U3VjY2Vzc0NhbGxiYWNrfSBvbnN1Y2Nlc3MgVGhlIGNhbGxiYWNrIHRvIGNhbGwgb24gc3VjY2Vzcy5cbiAqIEBwYXJhbSB7UmVxdWVzdEVycm9yQ2FsbGJhY2t9IG9uZXJyb3IgVGhlIGNhbGxiYWNrIHRvIGNhbGwgb24gZXJyb3IuXG4gKi9cbmZ1bmN0aW9uIEh0dHBSZXF1ZXN0KG9wdGlvbnMsIG9uc3VjY2Vzcywgb25lcnJvcikge1xuICAgIHZhciB4aHI7XG4gICAgdmFyIGNvbnRlbnQ7XG4gICAgdmFyIHVybDtcblxuICAgIC8vIENhbGwgdGhlIHN1cGVyIGNvbnN0cnVjdG9yLlxuICAgIFJlcXVlc2V0LmNhbGwodGhpcywgY29uc3RhbnRzLkhUVFBfUkVRVUVTVCwgb3B0aW9ucywgb25zdWNjZXNzLCBvbmVycm9yKTtcblxuICAgIC8vIENhbGwgYG9wdGlvbnMuaGFuZGxlT3B0aW9uc2AgdG8gaGFuZGxlIG9wdGlvbnMuXG4gICAgaGFuZGxlT3B0aW9ucyhvcHRpb25zKTtcblxuICAgIHRoaXMueGhyID0geGhyID0gb3B0aW9ucy5jcmVhdGVYSFIuY2FsbChudWxsLCBvcHRpb25zKTtcbiAgICBjb250ZW50ID0gaGFuZGxlUmVxdWVzdEJvZHkob3B0aW9ucyk7XG4gICAgdXJsID0gYnVpbGRVUkwob3B0aW9ucyk7XG5cbiAgICAvLyBTZXQgcHJvcGVydGllcyB0byB0aGUgeGhyLlxuICAgIGhhbmRsZVhoclByb3BzKHhociwgb3B0aW9ucyk7XG5cbiAgICAvLyBDYWxsIG9uWGhyQ3JlYXRlZC5cbiAgICBjYWxsWGhySG9vayhvcHRpb25zLm9uWGhyQ3JlYXRlZCwgeGhyLCBvcHRpb25zKTtcblxuICAgIC8vIEFkZCBldmVudCBsaXN0ZW5lcnMuIFRoaXMgZnVuY3Rpb24gbXVzdCBvdmVyd3JpdGUgdGhlIGBjYW5jZWxgIG1ldGhvZCBvZiB0aGlzIGBIdHRwUmVxdWVzdGAgaW5zdGFuY2UgdG8gY2FuY2VsXG4gICAgLy8gdGhpcyBodHRwIHJlcXVlc3QuXG4gICAgYWRkRXZlbnRMaXN0ZW5lcnModGhpcyk7XG5cbiAgICAvLyBPcGVuIHRoZSByZXF1ZXN0LlxuICAgIHhoci5vcGVuKG9wdGlvbnMubWV0aG9kIHx8ICdHRVQnLCB1cmwsIHRydWUsIG9wdGlvbnMudXNlcm5hbWUsIG9wdGlvbnMucGFzc3dvcmQpO1xuXG4gICAgLy8gQ2FsbCBvblhock9wZW5lZC5cbiAgICBjYWxsWGhySG9vayhvcHRpb25zLm9uWGhyT3BlbmVkLCB4aHIsIG9wdGlvbnMpO1xuXG4gICAgLy8gSGFubGRlIGhlYWRlcnMuXG4gICAgaGFuZGxlSGVhZGVycyh4aHIsIG9wdGlvbnMpO1xuXG4gICAgLy8gU2VuZCB0aGUgY29udGVudCB0byB0aGUgc2VydmVyLlxuICAgIHhoci5zZW5kKGNvbnRlbnQpO1xuXG4gICAgLy8gQ2FsbCBvblhoclNlbnQuXG4gICAgY2FsbFhockhvb2sob3B0aW9ucy5vblhoclNlbnQsIHhociwgb3B0aW9ucyk7XG5cbiAgICAvLyBDYWxsIG9uUmVxdWVzdENyZWF0ZWRcbiAgICBjYWxsUmVxdWVzdENyZWF0ZWRDYWxsYmFjayhvcHRpb25zLCB0aGlzKTtcbn1cblxuaW5oZXJpdHMoSHR0cFJlcXVlc3QsIFJlcXVlc2V0KTtcblxubW9kdWxlLmV4cG9ydHMgPSBIdHRwUmVxdWVzdDtcbiIsIi8qKlxuICogSHR0cFJlc3BvbnNlIG1vZHVsZS5cbiAqXG4gKiBAbW9kdWxlIGNsYXNzL0h0dHBSZXNwb25zZVxuICovXG5cbnZhciBSZXNwb25zZSA9IHJlcXVpcmUoMTApO1xudmFyIGluaGVyaXRzID0gcmVxdWlyZSgzMik7XG52YXIgYWRkQ3VzdG9tUGFyc2VyID0gcmVxdWlyZSgyNCk7XG5cbi8qKlxuICogVGhlIEh0dHBSZXNwb25zZSBjbGFzcy5cbiAqXG4gKiBAY2xhc3NcbiAqIEBwYXJhbSB7SHR0cFJlcXVlc3R9IHJlcXVlc3QgVGhlIGh0dHAgcmVxdWVzdC5cbiAqL1xuZnVuY3Rpb24gSHR0cFJlc3BvbnNlKHJlcXVlc3QpIHtcbiAgICBSZXNwb25zZS5jYWxsKHRoaXMsIHJlcXVlc3QpO1xuICAgIGFkZEN1c3RvbVBhcnNlcih0aGlzLCByZXF1ZXN0Lm9wdGlvbnMsICdodHRwUmVzcG9uc2VQYXJzZXInKTtcbn1cblxuaW5oZXJpdHMoSHR0cFJlc3BvbnNlLCBSZXNwb25zZSk7XG5cbm1vZHVsZS5leHBvcnRzID0gSHR0cFJlc3BvbnNlO1xuIiwidmFyIFJlc3BvbnNlRXJyb3IgPSByZXF1aXJlKDExKTtcbnZhciBpbmhlcml0cyA9IHJlcXVpcmUoMzIpO1xudmFyIGFkZEN1c3RvbVBhcnNlciA9IHJlcXVpcmUoMjQpO1xuXG4vKipcbiAqIEBjbGFzc1xuICogQHBhcmFtIHtzdHJpbmd9IGNvZGUgVGhlIGVycm9yIGNvZGUuXG4gKiBAcGFyYW0ge0h0dHBSZXF1ZXN0fSByZXF1ZXN0IFRoZSBodHRwIHJlcXVlc3QuXG4gKi9cbmZ1bmN0aW9uIEh0dHBSZXNwb25zZUVycm9yKGNvZGUsIHJlcXVlc3QpIHtcbiAgICBSZXNwb25zZUVycm9yLmNhbGwodGhpcywgY29kZSwgcmVxdWVzdCk7XG4gICAgYWRkQ3VzdG9tUGFyc2VyKHRoaXMsIHJlcXVlc3Qub3B0aW9ucywgJ2h0dHBSZXNwb25zZUVycm9yUGFyc2VyJyk7XG59XG5cbmluaGVyaXRzKEh0dHBSZXNwb25zZUVycm9yLCBSZXNwb25zZUVycm9yKTtcblxubW9kdWxlLmV4cG9ydHMgPSBIdHRwUmVzcG9uc2VFcnJvcjtcbiIsInZhciBSZXF1ZXNldCA9IHJlcXVpcmUoOSk7XG52YXIgY29uc3RhbnRzID0gcmVxdWlyZSgxMik7XG52YXIgaW5oZXJpdHMgPSByZXF1aXJlKDMyKTtcbnZhciBoYW5kbGVPcHRpb25zID0gcmVxdWlyZSgzMSk7XG52YXIgY2FsbFJlcXVlc3RDcmVhdGVkQ2FsbGJhY2sgPSByZXF1aXJlKDI2KTtcbnZhciBhZGRFdmVudExpc3RlbmVycyA9IHJlcXVpcmUoMjApO1xudmFyIGJ1aWxkQ2FsbGJhY2tOYW1lID0gcmVxdWlyZSgyMSk7XG52YXIgaGFuZGxlU2NyaXB0Q29ycyA9IHJlcXVpcmUoMjMpO1xudmFyIGJ1aWxkU2NyaXB0U3JjID0gcmVxdWlyZSgyMik7XG5cbi8qKlxuICogUmVwcmVzZW50cyBhbiBqc29ucCByZXF1ZXN0LlxuICpcbiAqIEBjbGFzc1xuICogQGV4dGVuZHMge1JlcXVlc2V0fVxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICogQHBhcmFtIHtSZXF1ZXN0U3VjY2Vzc0NhbGxiYWNrfSBvbnN1Y2Nlc3MgVGhlIGNhbGxiYWNrIHRvIGNhbGwgb24gc3VjY2Vzcy5cbiAqIEBwYXJhbSB7UmVxdWVzdEVycm9yQ2FsbGJhY2t9IG9uZXJyb3IgVGhlIGNhbGxiYWNrIHRvIGNhbGwgb24gZXJyb3IuXG4gKi9cbmZ1bmN0aW9uIEpTT05QUmVxdWVzdChvcHRpb25zLCBvbnN1Y2Nlc3MsIG9uZXJyb3IpIHtcbiAgICB2YXIgc3JjO1xuICAgIHZhciBzY3JpcHQ7XG4gICAgdmFyIGNhbGxiYWNrTmFtZTtcbiAgICB2YXIgY29udGFpbmVyTm9kZTtcblxuICAgIFJlcXVlc2V0LmNhbGwodGhpcywgY29uc3RhbnRzLkpTT05QX1JFUVVFU1QsIG9wdGlvbnMsIG9uc3VjY2Vzcywgb25lcnJvcik7XG5cbiAgICAvLyBDYWxsIGBvcHRpb25zLmhhbmRsZU9wdGlvbnNgIHRvIGhhbmRsZSBvcHRpb25zLlxuICAgIGhhbmRsZU9wdGlvbnMob3B0aW9ucyk7XG5cbiAgICBzY3JpcHQgPSB0aGlzLnNjcmlwdCA9IG9wdGlvbnMuY3JlYXRlU2NyaXB0LmNhbGwobnVsbCwgb3B0aW9ucyk7XG4gICAgY29udGFpbmVyTm9kZSA9IG9wdGlvbnMuanNvbnBDb250YWluZXJOb2RlLmNhbGwobnVsbCwgb3B0aW9ucyk7XG4gICAgY2FsbGJhY2tOYW1lID0gYnVpbGRDYWxsYmFja05hbWUob3B0aW9ucyk7XG4gICAgc3JjID0gYnVpbGRTY3JpcHRTcmMob3B0aW9ucywgY2FsbGJhY2tOYW1lKTtcblxuICAgIC8vIFNldCB0aGUgc3JjIGF0dHJpYnV0ZS5cbiAgICBzY3JpcHQuc2V0QXR0cmlidXRlKCdzcmMnLCBzcmMpO1xuXG4gICAgLy8gSGFuZGxlIGBvcHRpb25zLmNvcnNgXG4gICAgaGFuZGxlU2NyaXB0Q29ycyhzY3JpcHQsIG9wdGlvbnMpO1xuXG4gICAgLy8gQWRkIGV2ZW50IGxpc3RlbmVyc1xuICAgIGFkZEV2ZW50TGlzdGVuZXJzKHRoaXMsIGNhbGxiYWNrTmFtZSk7XG5cbiAgICAvLyBJbmplY3QgdGhlIHNjcmlwdCBub2RlXG4gICAgY29udGFpbmVyTm9kZS5hcHBlbmRDaGlsZChzY3JpcHQpO1xuXG4gICAgLy8gQ2FsbCBvblJlcXVlc3RDcmVhdGVkXG4gICAgY2FsbFJlcXVlc3RDcmVhdGVkQ2FsbGJhY2sob3B0aW9ucywgdGhpcyk7XG59XG5cbmluaGVyaXRzKEpTT05QUmVxdWVzdCwgUmVxdWVzZXQpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEpTT05QUmVxdWVzdDtcbiIsIi8qKlxuICogSlNPTlBSZXNwb25zZSBtb2R1bGUuXG4gKlxuICogQG1vZHVsZSBjbGFzcy9KU09OUFJlc3BvbnNlXG4gKi9cblxudmFyIFJlc3BvbnNlID0gcmVxdWlyZSgxMCk7XG52YXIgaW5oZXJpdHMgPSByZXF1aXJlKDMyKTtcbnZhciBhZGRDdXN0b21QYXJzZXIgPSByZXF1aXJlKDI0KTtcblxuLyoqXG4gKiBUaGUgSlNPTlBSZXNwb25zZSBjbGFzcy5cbiAqXG4gKiBAY2xhc3NcbiAqIEBwYXJhbSB7SlNPTlJlcXVlc3R9IHJlcXVlc3QgVGhlIGh0dHAgcmVxdWVzdC5cbiAqL1xuZnVuY3Rpb24gSlNPTlBSZXNwb25zZShyZXF1ZXN0KSB7XG4gICAgUmVzcG9uc2UuY2FsbCh0aGlzLCByZXF1ZXN0KTtcbiAgICBhZGRDdXN0b21QYXJzZXIodGhpcywgcmVxdWVzdC5vcHRpb25zLCAnanNvbnBSZXNwb25zZVBhcnNlcicpO1xufVxuXG5pbmhlcml0cyhKU09OUFJlc3BvbnNlLCBSZXNwb25zZSk7XG5cbm1vZHVsZS5leHBvcnRzID0gSlNPTlBSZXNwb25zZTtcbiIsInZhciBSZXNwb25zZUVycm9yID0gcmVxdWlyZSgxMSk7XG52YXIgaW5oZXJpdHMgPSByZXF1aXJlKDMyKTtcbnZhciBhZGRDdXN0b21QYXJzZXIgPSByZXF1aXJlKDI0KTtcblxuLyoqXG4gKiBAY2xhc3NcbiAqIEBwYXJhbSB7c3RyaW5nfSBjb2RlIFRoZSBlcnJvciBjb2RlLlxuICogQHBhcmFtIHtKU09OUFJlcXVlc3R9IHJlcXVlc3QgVGhlIEpTT05QIHJlcXVlc3QuXG4gKi9cbmZ1bmN0aW9uIEpTT05QUmVzcG9uc2VFcnJvcihjb2RlLCByZXF1ZXN0KSB7XG4gICAgUmVzcG9uc2VFcnJvci5jYWxsKHRoaXMsIGNvZGUsIHJlcXVlc3QpO1xuICAgIGFkZEN1c3RvbVBhcnNlcih0aGlzLCByZXF1ZXN0Lm9wdGlvbnMsICdqc29ucFJlc3BvbnNlRXJyb3JQYXJzZXInKTtcbn1cblxuaW5oZXJpdHMoUmVzcG9uc2VFcnJvciwgSlNPTlBSZXNwb25zZUVycm9yKTtcblxubW9kdWxlLmV4cG9ydHMgPSBKU09OUFJlc3BvbnNlRXJyb3I7XG4iLCJ2YXIgdXVpZCA9IHJlcXVpcmUoMzUpO1xuXG4vKipcbiAqIFRoZSBiYXNlIFJlcWV1c3QgY2xhc3MuXG4gKlxuICogQGNsYXNzXG4gKiBAcGFyYW0ge3N0cmluZ30gdHlwZSBUaGUgdHlwZSBvZiByZXF1ZXN0LCBjYW4gYmUgYEhUVFBfUkVRVUVTVGAgb3IgYEpTT05QX1JFUVVFU1RgLlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICogQHBhcmFtIHtSZXF1ZXN0U3VjY2Vzc0NhbGxiYWNrfSBvbnN1Y2Nlc3MgVGhlIGNhbGxiYWNrIHRvIGNhbGwgb24gc3VjY2Vzcy5cbiAqIEBwYXJhbSB7UmVxdWVzdEVycm9yQ2FsbGJhY2t9IG9uZXJyb3IgVGhlIGNhbGxiYWNrIHRvIGNhbGwgb24gZXJyb3IuXG4gKi9cbmZ1bmN0aW9uIFJlcXVlc3QodHlwZSwgb3B0aW9ucywgb25zdWNjZXNzLCBvbmVycm9yKSB7XG4gICAgLyoqXG4gICAgICogSWYgdGhlcmUgaXMgYW4gZXJyb3IgaGFwcGVuZCwgdGhlIGBlcnJvckNvZGVgIGlzIGEgc3RyaW5nIHJlcHJzZW5ndGluZyB0aGUgdHlwZSBvZiB0eXBlIGVycm9yLiBJZiB0aGVyZSBpcyBub1xuICAgICAqIGVycm9yLCB0aGUgdmFsdWUgb2YgYGVycm9yQ29kZWAgaXMgYG51bGxgLlxuICAgICAqL1xuICAgIHRoaXMuZXJyb3JDb2RlID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFRoZSBgWE1MSHR0cFJlcXVlc3RgIHdlIHVzZSB3aGVuIHNlbmRpbmcgaHR0cCByZXF1ZXN0LlxuICAgICAqL1xuICAgIHRoaXMueGhyID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFRoZSBgSFRNTFNjcmlwdEVsZW1lbnRgIHdlIHVzZSB3aGVuIHNlbmRpbmcganNvbiByZXF1ZXN0LlxuICAgICAqL1xuICAgIHRoaXMuc2NyaXB0ID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFdoZXRoZXIgdGhlIHJlcXVlc3QgaXMgZmluaXNoZWQuXG4gICAgICovXG4gICAgdGhpcy5maW5pc2hlZCA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHJlc3BvbnNlIEpTT04gZGF0YSBvZiB0aGUgSlNPTlAgcmVxdWVzdC5cbiAgICAgKi9cbiAgICB0aGlzLnJlc3BvbnNlSlNPTiA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgYENhbmNlbENvbnRyb2xsZXJgIHRoYXQgdXNlZCB0byBjYW5jZWwgdGhpcyByZXF1ZXN0LiBXZSBuZXZlciB1c2UgdGhpcyBwcm9wZXJ0eSBpbnRlcm5hbGx5LCBqdXN0IGhvbGRpbmcgdGhlXG4gICAgICogaW5mb3JtYXRpb24gaW4gY2FzZSB0aGF0IHRoZSB1c2VyIG5lZWRzLlxuICAgICAqL1xuICAgIHRoaXMuY29udHJvbGxlciA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbmFtZSBvZiB0aGUgZnVuY3Rpb24gdGhhdCBjcmVhdGUgdGhpcyByZXF1ZXN0LiBDYW4gYmUgYHNlbmRgLCBgZmV0Y2hgLCBgZ2V0Sk9TTlBgLCBgZmV0Y2hKU09OUGAuIFRoaXMgdmFsdWVcbiAgICAgKiBpcyBzZXQgYnkgdGhlIGxpYnJheSBpdHNlbGYuXG4gICAgICovXG4gICAgdGhpcy5yZXF1ZXN0RnVuY3Rpb25OYW1lID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEFuIHVuaXF1ZSBpZCBmb3IgdGhpcyByZXF1ZXN0LlxuICAgICAqL1xuICAgIHRoaXMucmVxdWVzdElkID0gdXVpZCgpO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHR5cGUgb2YgcmVxdWVzdCwgY2FuIGJlIGBIVFRQX1JFUVVFU1RgIG9yIGBKU09OUF9SRVFVRVNUYC5cbiAgICAgKi9cbiAgICB0aGlzLnJlcXVlc3RUeXBlID0gdHlwZTtcblxuICAgIC8qKlxuICAgICAqIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gICAgICovXG4gICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucyB8fCBudWxsO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGNhbGxiYWNrIHRvIGNhbGwgb24gc3VjY2Vzcy5cbiAgICAgKi9cbiAgICB0aGlzLm9uc3VjY2VzcyA9IG9uc3VjY2VzcyB8fCBudWxsO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGNhbGxiYWNrIHRvIGNhbGwgb24gZXJyb3IuXG4gICAgICovXG4gICAgdGhpcy5vbmVycm9yID0gb25lcnJvciB8fCBudWxsO1xuXG4gICAgLy8gU2V0IHRoZSByZXF1ZXN0IHR5cGUuXG4gICAgaWYgKHRoaXMub3B0aW9ucykge1xuICAgICAgICB0aGlzLm9wdGlvbnMucmVxdWVzdFR5cGUgPSB0eXBlO1xuICAgICAgICB0aGlzLnJlcXVlc3RGdW5jdGlvbk5hbWUgPSB0aGlzLm9wdGlvbnMucmVxdWVzdEZ1bmN0aW9uTmFtZTtcbiAgICAgICAgdGhpcy5jb250cm9sbGVyID0gdGhpcy5vcHRpb25zLmNvbnRyb2xsZXI7XG4gICAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFJlcXVlc3Q7XG4iLCIvKipcbiAqIFJlcHJlc2VudHMgYSByZXNwb25zZS5cbiAqXG4gKiBAcGFyYW0ge1JlcXVlc3R9IHJlcXVlc3QgVGhlIGluc3RhbmNlIG9mIGBSZXF1ZXN0YC5cbiAqL1xuZnVuY3Rpb24gUmVzcG9uc2UocmVxdWVzdCkge1xuICAgIC8qKlxuICAgICAqIEB0eXBlIHtSZXF1ZXN0fVxuICAgICAqL1xuICAgIHRoaXMucmVxdWVzdCA9IHJlcXVlc3QgfHwgbnVsbDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBSZXNwb25zZTtcbiIsInZhciBpc1BsYWluT2JqZWN0ID0gcmVxdWlyZSg0MCk7XG5cbi8qKlxuICogUmVwcmVzZW50cyByZXNwb25zZSBlcnJvci5cbiAqXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSB7c3RyaW5nfSBjb2RlIFRoZSBlcnJvciBjb2RlLlxuICogQHBhcmFtIHtSZXF1ZXN0fSByZXF1ZXN0IFRoZSByZXF1ZXN0LlxuICovXG5mdW5jdGlvbiBSZXNwb25zZUVycm9yKGNvZGUsIHJlcXVlc3QpIHtcbiAgICB2YXIgb3B0aW9ucyA9IHJlcXVlc3QgPyByZXF1ZXN0Lm9wdGlvbnMgOiB7fTtcbiAgICB2YXIgZXJyb3JNZXNzYWdlcyA9IG9wdGlvbnMuZXJyb3JNZXNzYWdlcztcbiAgICB2YXIgbWVzc2FnZTtcblxuICAgIGNvZGUgPSBjb2RlIHx8ICdFUlJfVU5LTk9XTic7XG5cbiAgICBpZiAoaXNQbGFpbk9iamVjdChlcnJvck1lc3NhZ2VzKSkge1xuICAgICAgICBpZiAoZXJyb3JNZXNzYWdlc1tjb2RlXSkge1xuICAgICAgICAgICAgbWVzc2FnZSA9IGVycm9yTWVzc2FnZXNbY29kZV07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIW1lc3NhZ2UpIHtcbiAgICAgICAgbWVzc2FnZSA9ICdVbmtub3duIGVycm9yICcgKyBjb2RlO1xuICAgIH1cblxuICAgIGlmIChyZXF1ZXN0KSB7XG4gICAgICAgIHJlcXVlc3QuZXJyb3JDb2RlID0gY29kZTtcbiAgICB9XG5cbiAgICB0aGlzLmNvZGUgPSBjb2RlO1xuICAgIHRoaXMucmVxdWVzdCA9IHJlcXVlc3QgfHwgbnVsbDtcbiAgICB0aGlzLm1lc3NhZ2UgPSBtZXNzYWdlO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFJlc3BvbnNlRXJyb3I7XG4iLCJleHBvcnRzLkVSUl9BQk9SVEVEID0gJ0VSUl9BQk9SVEVEJztcbmV4cG9ydHMuRVJSX1JFU1BPTlNFID0gJ0VSUl9SRVNQT05TRSc7XG5leHBvcnRzLkVSUl9DQU5DRUxMRUQgPSAnRVJSX0NBTkNFTExFRCc7XG5leHBvcnRzLkVSUl9ORVRXT1JLID0gJ0VSUl9ORVRXT1JLJztcbmV4cG9ydHMuRVJSX1RJTUVPVVQgPSAnRVJSX1RJTUVPVVQnO1xuZXhwb3J0cy5IVFRQX1JFUVVFU1QgPSAnSFRUUF9SRVFVRVNUJztcbmV4cG9ydHMuSlNPTlBfUkVRVUVTVCA9ICdKU09OUF9SRVFVRVNUJztcbiIsInZhciBpc0Z1bmN0aW9uID0gcmVxdWlyZSgzOSk7XG52YXIgSHR0cFJlc3BvbnNlID0gcmVxdWlyZSg0KTtcbnZhciBhZGRUaW1lb3V0TGlzdGVuZXIgPSByZXF1aXJlKDE0KTtcbnZhciBmaXJlQ2FsbGJhY2tzID0gcmVxdWlyZSgzMCk7XG52YXIgbm9vcCA9IHJlcXVpcmUoMzMpO1xudmFyIGNvbnN0YW50cyA9IHJlcXVpcmUoMTIpO1xudmFyIEVSUl9BQk9SVEVEICAgPSBjb25zdGFudHMuRVJSX0FCT1JURUQ7XG52YXIgRVJSX0NBTkNFTExFRCA9IGNvbnN0YW50cy5FUlJfQ0FOQ0VMTEVEO1xudmFyIEVSUl9ORVRXT1JLICAgPSBjb25zdGFudHMuRVJSX05FVFdPUks7XG52YXIgRVJSX1JFU1BPTlNFICA9IGNvbnN0YW50cy5FUlJfUkVTUE9OU0U7XG52YXIgRVJSX1RJTUVPVVQgICA9IGNvbnN0YW50cy5FUlJfVElNRU9VVDtcblxuLyoqXG4gKiBBZGQgZXZlbnQgbGlzdGVuZXJzIHRvIHRoZSBodHRwIHJlcXVlc3QuIFRoaXMgZnVuY3Rpb24gd2lsbCBvdmVyd2l0ZSB0aGUgYGNhbmNlbGAgbWV0aG9kIG9uIHRoZSBnaXZlbiBgSHR0cFJlcWVzdGBcbiAqIGluc3RhbmNlLlxuICpcbiAqIEBwYXJhbSB7SHR0cFJlcXVlc3R9IHJlcXVlc3QgVGhlIGh0dHAgcmVxdWVzdCB0byBhZGQgZXZlbnQgbGlzdGVuZXJzLlxuICovXG5mdW5jdGlvbiBhZGRFdmVudExpc3RlbmVycyhyZXF1ZXN0KSB7XG4gICAgdmFyIHhociA9IHJlcXVlc3QueGhyO1xuICAgIHZhciBvcHRpb25zID0gcmVxdWVzdC5vcHRpb25zO1xuICAgIHZhciByZXF1ZXN0VHlwZSA9IHJlcXVlc3QucmVxdWVzdFR5cGU7XG4gICAgdmFyIHJlc3BvbnNlID0gbmV3IEh0dHBSZXNwb25zZShyZXF1ZXN0KTtcbiAgICB2YXIgaXNSZXNwb25zZU9rID0gb3B0aW9ucy5pc1Jlc3BvbnNlT2s7XG4gICAgdmFyIGNsZWFyVGltZW91dEV2ZW50ID0gbnVsbDtcbiAgICB2YXIgdGltZW91dCA9IHBhcnNlSW50KG9wdGlvbnMudGltZW91dCB8fCAwLCAxMCk7XG5cbiAgICAvKipcbiAgICAgKiBDYW5jZWwgdGhlIHJlcXVlc3QuXG4gICAgICovXG4gICAgdmFyIGNhbmNlbCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgY2xlYXJFdmVudHMoKTtcbiAgICAgICAgaWYgKHhoci5hYm9ydCkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICB4aHIuYWJvcnQoKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHt9XG4gICAgICAgIH1cbiAgICAgICAgZmluaXNoKEVSUl9DQU5DRUxMRUQpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZnVuY3Rpb24gdG8gY2xlYXIgZXZlbnRzLlxuICAgICAqL1xuICAgIHZhciBjbGVhckV2ZW50cyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLy8gU2V0IGNsZWFyRXZlbnRzIHRvIHRoZSBub29wIGZ1bmN0aW9uLlxuICAgICAgICBjbGVhckV2ZW50cyA9IG5vb3A7XG5cbiAgICAgICAgeGhyLm9uYWJvcnQgPSBudWxsO1xuICAgICAgICB4aHIub25lcnJvciA9IG51bGw7XG4gICAgICAgIHhoci5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBudWxsO1xuICAgICAgICB4aHIub250aW1lb3V0ID0gbnVsbDtcblxuICAgICAgICBpZiAoY2xlYXJUaW1lb3V0RXZlbnQpIHtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dEV2ZW50KCk7XG4gICAgICAgICAgICBjbGVhclRpbWVvdXRFdmVudCA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogVGhlIGZ1bmN0aW9uIGZpbmlzaCB0aGUgcmVxdWVzdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBjb2RlIFRoZSBlcnJvciBjb2RlIG9uIGVycm9yLiBJZiBubyBlcnJvciBvY2N1cmVkLCB0aGUgY29kZSBpcyBgbnVsbGAuXG4gICAgICovXG4gICAgdmFyIGZpbmlzaCA9IGZ1bmN0aW9uIChjb2RlKSB7XG4gICAgICAgIC8vIFNldCBmaW5pc2ggdG8gdGhlIG5vb3AgZnVuY3Rpb24uXG4gICAgICAgIGZpbmlzaCA9IG5vb3A7XG5cbiAgICAgICAgLy8gU2V0IGNhbmNlbCB0byB0aGUgbm9vcCBmdW5jdGlvbi5cbiAgICAgICAgY2FuY2VsID0gbm9vcDtcblxuICAgICAgICAvLyBNYXJrIHRoaXMgcmVxdWVzdCBhcyBmaW5pc2hlZC5cbiAgICAgICAgcmVxdWVzdC5maW5pc2hlZCA9IHRydWU7XG5cbiAgICAgICAgLy8gQ2xlYXIgZXZlbnRzLlxuICAgICAgICBjbGVhckV2ZW50cygpO1xuXG4gICAgICAgIC8vIEZpcmUgY2FsbGJhY2tzLlxuICAgICAgICBmaXJlQ2FsbGJhY2tzKGNvZGUsIHJlc3BvbnNlKTtcbiAgICB9O1xuXG4gICAgeGhyLm9uYWJvcnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGZpbmlzaChFUlJfQUJPUlRFRCk7XG4gICAgfTtcblxuICAgIHhoci5vbmVycm9yID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBmaW5pc2goRVJSX05FVFdPUkspO1xuICAgIH07XG5cbiAgICB4aHIub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoK3hoci5yZWFkeVN0YXRlID09PSA0KSB7XG4gICAgICAgICAgICBpZiAoaXNGdW5jdGlvbihpc1Jlc3BvbnNlT2spKSB7XG4gICAgICAgICAgICAgICAgaWYgKGlzUmVzcG9uc2VPayhyZXF1ZXN0VHlwZSwgcmVzcG9uc2UpKSB7XG4gICAgICAgICAgICAgICAgICAgIGZpbmlzaChudWxsKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBmaW5pc2goRVJSX1JFU1BPTlNFKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGZpbmlzaChudWxsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBDYW5jZWwgdGhlIHJlcXVlc3QuXG4gICAgICovXG4gICAgcmVxdWVzdC5jYW5jZWwgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNhbmNlbCgpO1xuICAgIH07XG5cbiAgICAvLyBBZGQgdGltZW91dCBsaXN0ZW5lclxuICAgIGlmICghaXNOYU4odGltZW91dCkgJiYgdGltZW91dCA+IDApIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0RXZlbnQgPSBhZGRUaW1lb3V0TGlzdGVuZXIoeGhyLCB0aW1lb3V0LCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBjbGVhckV2ZW50cygpO1xuICAgICAgICAgICAgaWYgKHhoci5hYm9ydCkge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIHhoci5hYm9ydCgpO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHt9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmaW5pc2goRVJSX1RJTUVPVVQpO1xuICAgICAgICB9KTtcbiAgICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYWRkRXZlbnRMaXN0ZW5lcnM7XG4iLCIvKipcbiAqIEFkZCB0aW1lb3V0IGV2ZW50IGxpc3RlbmVyIG9uIHRoZSBYSFIgb2JqZWN0LlxuICpcbiAqIEBwYXJhbSB7WE1MSHR0cFJlcXVlc3R9IHhociBUaGUgWEhSIHRvIGFkZCB0aW1lb3V0IGV2ZW50IGxpc3RlbmVyLlxuICogQHBhcmFtIHtudW1iZXJ9IHRpbWVvdXQgVGhlIHRpbWUgdG8gd2FpdCBpbiBtaWxsaXNlY29uZHMuXG4gKiBAcGFyYW0geygpID0+IHZvaWR9IGxpc3RlbmVyIFRoZSB0aW1lb3V0IGNhbGxiYWNrLlxuICogQHJldHVybnMgeygpID0+IHZvaWQpfSBSZXR1cm5zIGEgZnVuY3Rpb24gdG8gcmVtb3ZlIHRoZSB0aW1lb3V0IGV2ZW50IGxpc3RlbmVyLlxuICovXG5mdW5jdGlvbiBhZGRUaW1lb3V0TGlzdGVuZXIoeGhyLCB0aW1lb3V0LCBsaXN0ZW5lcikge1xuICAgIHZhciB0aW1lb3V0SWQgPSBudWxsO1xuICAgIHZhciBzdXBwb3J0VGltZW91dCA9ICd0aW1lb3V0JyBpbiB4aHIgJiYgJ29udGltZW91dCcgaW4geGhyO1xuXG4gICAgaWYgKHN1cHBvcnRUaW1lb3V0KSB7XG4gICAgICAgIHhoci50aW1lb3V0ID0gdGltZW91dDtcbiAgICAgICAgeGhyLm9udGltZW91dCA9IGxpc3RlbmVyO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRpbWVvdXRJZCA9IHNldFRpbWVvdXQobGlzdGVuZXIsIHRpbWVvdXQpO1xuICAgIH1cblxuICAgIC8vIENhbGwgdGhpcyBmdW5jdGlvbiB0byByZW1vdmUgdGltZW91dCBldmVudCBsaXN0ZW5lclxuICAgIGZ1bmN0aW9uIGNsZWFyVGltZW91dEV2ZW50KCkge1xuICAgICAgICBpZiAoeGhyKSB7XG4gICAgICAgICAgICBpZiAodGltZW91dElkID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgeGhyLm9udGltZW91dCA9IG51bGw7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgeGhyID0gbnVsbDtcbiAgICAgICAgICAgIGxpc3RlbmVyID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBjbGVhclRpbWVvdXRFdmVudDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBhZGRUaW1lb3V0TGlzdGVuZXI7XG4iLCJ2YXIgaXNGdW5jdGlvbiA9IHJlcXVpcmUoMzkpO1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBjYWxsIHhociBob29rIGZ1bmN0aW9uLlxuICpcbiAqIEBwYXJhbSB7WEhSSG9va0Z1bmN0aW9ufSBmdW5jIFRoZSBob29rIGZ1bmN0aW9uIHRvIGNhbGwsIGlmIGl0IGlzIG5vdCBmdW5jdGlvbiwgdGhpcyBob29rIGlzIHNraXBwZWQuXG4gKiBAcGFyYW0ge1hNTEh0dHBSZXFldXN0fSB4aHIgVGhlIGluc3RhbmNlIG9mIGBYTUxIdHRwUmVxZXVzdGAuXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb259IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqL1xuZnVuY3Rpb24gY2FsbFhockhvb2soZnVuYywgeGhyLCBvcHRpb25zKSB7XG4gICAgaWYgKGlzRnVuY3Rpb24oZnVuYykpIHtcbiAgICAgICAgZnVuYyh4aHIsIG9wdGlvbnMpO1xuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBjYWxsWGhySG9vaztcbiIsInZhciBtZXJnZSA9IHJlcXVpcmUoNDEpO1xudmFyIGlzUGxhaW5PYmplY3QgPSByZXF1aXJlKDQwKTtcbnZhciBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBzZXQgdGhlIHJlcXVlc3QgaGVhZGVycy5cbiAqXG4gKiAxLiBNZXJnZSB0aGUgYG9wdGlvbnMubm9DYWNoZUhlYWRlcnNgIGlmIG5lZWRlZC5cbiAqIDIuIFNldCB0aGUgcmVxdWVzdCBoZWFkZXJzIGlmIG5lZWRlZC5cbiAqXG4gKiBAcGFyYW0ge1hNTEh0dHBSZXFldXN0fSB4aHIgVGhlIGluc3RhbmNlIG9mIGBYTUxIdHRwUmVxZXVzdGAuXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb259IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqL1xuZnVuY3Rpb24gaGFuZGxlSGVhZGVycyh4aHIsIG9wdGlvbnMpIHtcbiAgICB2YXIgbmFtZTtcbiAgICB2YXIgdmFsdWU7XG4gICAgdmFyIGhlYWRlcnMgPSBpc1BsYWluT2JqZWN0KG9wdGlvbnMuaGVhZGVycykgPyBvcHRpb25zLmhlYWRlcnMgOiB7fTtcblxuICAgIGlmIChvcHRpb25zLm5vQ2FjaGUpIHtcbiAgICAgICAgaWYgKGlzUGxhaW5PYmplY3Qob3B0aW9ucy5ub0NhY2hlSGVhZGVycykpIHtcbiAgICAgICAgICAgIGhlYWRlcnMgPSBtZXJnZShoZWFkZXJzLCBvcHRpb25zLm5vQ2FjaGVIZWFkZXJzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZvciAobmFtZSBpbiBoZWFkZXJzKSB7XG4gICAgICAgIGlmIChoYXNPd24uY2FsbChoZWFkZXJzLCBuYW1lKSkge1xuICAgICAgICAgICAgdmFsdWUgPSBoZWFkZXJzW25hbWVdO1xuICAgICAgICAgICAgLy8gT25seSB0aGUgbm9uLXVuZGVmaW5lZCBhbmQgbm9uLW51bGwgaGVhZGVycyBhcmUgc2V0XG4gICAgICAgICAgICBpZiAodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKG5hbWUsIHZhbHVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIFNldCB0aGUgaGVhZGVycyBiYWNrLlxuICAgIG9wdGlvbnMuaGVhZGVycyA9IGhlYWRlcnM7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaGFuZGxlSGVhZGVycztcbiIsInZhciBtZXJnZSA9IHJlcXVpcmUoNDEpO1xudmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKDM5KTtcbnZhciBpc1BsYWluT2JqZWN0ID0gcmVxdWlyZSg0MCk7XG52YXIgaGFzT3duID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcblxuLyoqXG4gKiBGaW5kIGEgcHJvY2Vzc29yIGZyb20gYG9wdGlvbnMuaHR0cFJlcXVlc3RCb2R5UHJvY2Vzc29yYCB0byBwcm9jZXNzIHRoZSByZXF1ZXN0IGJvZHkuXG4gKlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICogQHJldHVybnMge2FueX0gUmV0cnVucyB0aGUgY29udGVudCB0aGF0IHNlbmQgdG8gdGhlIHNlcnZlci5cbiAqL1xuZnVuY3Rpb24gaGFuZGxlUmVxdWVzdEJvZHkob3B0aW9ucykge1xuICAgIHZhciBpO1xuICAgIHZhciBsO1xuICAgIHZhciBrZXk7XG4gICAgdmFyIGNvbnRlbnQgPSBudWxsO1xuICAgIHZhciBwcm9jZXNzb3I7XG4gICAgdmFyIGNvbnRlbnRQcm9jZXNzb3I7XG4gICAgdmFyIGNvbnRlbnRQcm9jZXNzb3JzID0gW107XG4gICAgdmFyIGJvZHkgPSBvcHRpb25zLmJvZHk7XG4gICAgdmFyIHByb2Nlc3NvcnMgPSBvcHRpb25zLmh0dHBSZXF1ZXN0Qm9keVByb2Nlc3NvcjtcbiAgICB2YXIgaGVhZGVycyA9IGlzUGxhaW5PYmplY3Qob3B0aW9ucy5oZWFkZXJzKSA/IG9wdGlvbnMuaGVhZGVycyA6IHt9O1xuXG4gICAgaWYgKGlzUGxhaW5PYmplY3QoYm9keSkgJiYgaXNQbGFpbk9iamVjdChwcm9jZXNzb3JzKSkge1xuICAgICAgICAvLyBGaW5kIGFsbCBwcm9jZXNzb3JzLlxuICAgICAgICBmb3IgKGtleSBpbiBwcm9jZXNzb3JzKSB7XG4gICAgICAgICAgICBpZiAoaGFzT3duLmNhbGwocHJvY2Vzc29ycywga2V5KSkge1xuICAgICAgICAgICAgICAgIHByb2Nlc3NvciA9IHByb2Nlc3NvcnNba2V5XTtcbiAgICAgICAgICAgICAgICBpZiAoaXNQbGFpbk9iamVjdChwcm9jZXNzb3IpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRlbnRQcm9jZXNzb3JzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAga2V5OiBrZXksXG4gICAgICAgICAgICAgICAgICAgICAgICBoZWFkZXJzOiBwcm9jZXNzb3IuaGVhZGVycyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHByaW9yaXR5OiBwcm9jZXNzb3IucHJpb3JpdHksXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9jZXNzb3I6IHByb2Nlc3Nvci5wcm9jZXNzb3JcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gU29ydCB0aGUgcHJvY2Vzc29ycyBieSBpdHMgcHJpb3JpdHkuXG4gICAgICAgIGNvbnRlbnRQcm9jZXNzb3JzLnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgICAgICAgIHJldHVybiBiLnByaW9yaXR5IC0gYS5wcmlvcml0eTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gRmluZCB0aGUgZmlyc3Qgbm9uLXVuZGVmaW5lZCBjb250ZW50LlxuICAgICAgICBmb3IgKGkgPSAwLCBsID0gY29udGVudFByb2Nlc3NvcnMubGVuZ3RoOyBpIDwgbDsgaSArPSAxKSB7XG4gICAgICAgICAgICBwcm9jZXNzb3IgPSBjb250ZW50UHJvY2Vzc29yc1tpXTtcbiAgICAgICAgICAgIGlmIChib2R5W3Byb2Nlc3Nvci5rZXldICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBjb250ZW50ID0gYm9keVtwcm9jZXNzb3Iua2V5XTtcbiAgICAgICAgICAgICAgICBjb250ZW50UHJvY2Vzc29yID0gcHJvY2Vzc29yO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gVXNlIHRoZSBwcm9jZXNzb3IgdG8gcHJvY2VzcyB0aGUgY29udGVudC5cbiAgICAgICAgaWYgKGNvbnRlbnRQcm9jZXNzb3IpIHtcbiAgICAgICAgICAgIGlmIChpc1BsYWluT2JqZWN0KGNvbnRlbnRQcm9jZXNzb3IuaGVhZGVycykpIHtcbiAgICAgICAgICAgICAgICBoZWFkZXJzID0gbWVyZ2UoaGVhZGVycywgY29udGVudFByb2Nlc3Nvci5oZWFkZXJzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHByb2Nlc3NvciA9IGNvbnRlbnRQcm9jZXNzb3IucHJvY2Vzc29yO1xuICAgICAgICAgICAgaWYgKGlzRnVuY3Rpb24ocHJvY2Vzc29yKSkge1xuICAgICAgICAgICAgICAgIGNvbnRlbnQgPSBwcm9jZXNzb3IoY29udGVudCwgb3B0aW9ucyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBNYWtlIHN1cmUgdGhhdCB0aGUgaGVhZGVycyBpcyBhIHBsYWluIG9iamVjdC5cbiAgICBvcHRpb25zLmhlYWRlcnMgPSBoZWFkZXJzO1xuXG4gICAgcmV0dXJuIGNvbnRlbnQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaGFuZGxlUmVxdWVzdEJvZHk7XG4iLCJ2YXIgaXNQbGFpbk9iamVjdCA9IHJlcXVpcmUoNDApO1xudmFyIGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGhhbmxkZSBYTUxIdHRwUmVxdWVzdCBwcm9wZXJ0aWVzLlxuICpcbiAqIEBwYXJhbSB7WE1MSHR0cFJlcXVlc3R9IHhociBUaGUgaW5zdGFuY2Ugb2YgYFhNTEh0dHBSZXF1ZXN0YC5cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqL1xuZnVuY3Rpb24gaGFuZGxlWGhyUHJvcHMoeGhyLCBvcHRpb25zKSB7XG4gICAgdmFyIHByb3A7XG4gICAgdmFyIHhoclByb3BzID0gb3B0aW9ucy54aHJQcm9wcztcblxuICAgIGlmIChvcHRpb25zLmNvcnMpIHtcbiAgICAgICAgeGhyLndpdGhDcmVkZW50aWFscyA9IHRydWU7XG4gICAgfVxuXG4gICAgaWYgKGlzUGxhaW5PYmplY3QoeGhyUHJvcHMpKSB7XG4gICAgICAgIGZvciAocHJvcCBpbiB4aHJQcm9wcykge1xuICAgICAgICAgICAgaWYgKGhhc093bi5jYWxsKHhoclByb3BzLCBwcm9wKSkge1xuICAgICAgICAgICAgICAgIHhocltwcm9wXSA9IHhoclByb3BzW3Byb3BdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGhhbmRsZVhoclByb3BzO1xuIiwidmFyIEh0dHBDbGllbnQgPSByZXF1aXJlKDIpO1xudmFyIG1lcmdlID0gcmVxdWlyZSg0MSk7XG52YXIgaXNGdW5jdGlvbiA9IHJlcXVpcmUoMzkpO1xudmFyIGlzUGxhaW5PYmplY3QgPSByZXF1aXJlKDQwKTtcbnZhciBRUyA9IHJlcXVpcmUoNDQpO1xudmFyIGlzQWJzb2x1dGVVUkwgPSByZXF1aXJlKDM3KTtcbnZhciBkZWZpbmVFeHBvcnRzID0gcmVxdWlyZSgyOSk7XG52YXIgY3JlYXRlRGVmYXVsdE9wdGlvbnMgPSByZXF1aXJlKDI4KTtcbnZhciBjb25zdGFudHMgPSByZXF1aXJlKDEyKTtcbnZhciB0ZW1wbGF0ZSA9IHJlcXVpcmUoMzQpO1xudmFyIHV1aWQgPSByZXF1aXJlKDM1KTtcbnZhciBub29wID0gcmVxdWlyZSgzMyk7XG52YXIgaW5oZXJpdHMgPSByZXF1aXJlKDMyKTtcbnZhciBDYW5jZWxDb250cm9sbGVyID0gcmVxdWlyZSgxKTtcbnZhciBIdHRwUmVxdWVzdCA9IHJlcXVpcmUoMyk7XG52YXIgSHR0cFJlc3BvbnNlID0gcmVxdWlyZSg0KTtcbnZhciBIdHRwUmVzcG9uc2VFcnJvciA9IHJlcXVpcmUoNSk7XG52YXIgSlNPTlBSZXF1ZXN0ID0gcmVxdWlyZSg2KTtcbnZhciBKU09OUFJlc3BvbnNlID0gcmVxdWlyZSg3KTtcbnZhciBKU09OUFJlc3BvbnNlRXJyb3IgPSByZXF1aXJlKDgpO1xudmFyIFJlcXVlc3QgPSByZXF1aXJlKDkpO1xudmFyIFJlc3BvbnNlID0gcmVxdWlyZSgxMCk7XG52YXIgUmVzcG9uc2VFcnJvciA9IHJlcXVpcmUoMTEpO1xuXG5kZWZpbmVFeHBvcnRzKEh0dHBDbGllbnQsICdjb25zdGFudHMnLCBtZXJnZSh7fSwgY29uc3RhbnRzKSk7XG5cbmRlZmluZUV4cG9ydHMoSHR0cENsaWVudCwgJ2xpYnMnLCB7XG4gICAgUVM6IFFTXG59KTtcblxuZGVmaW5lRXhwb3J0cyhIdHRwQ2xpZW50LCAnY2xhc3NlcycsIHtcbiAgICBDYW5jZWxDb250cm9sbGVyOiBDYW5jZWxDb250cm9sbGVyLFxuICAgIEh0dHBDbGllbnQ6IEh0dHBDbGllbnQsXG4gICAgSHR0cFJlcXVlc3Q6IEh0dHBSZXF1ZXN0LFxuICAgIEh0dHBSZXNwb25zZTogSHR0cFJlc3BvbnNlLFxuICAgIEh0dHBSZXNwb25zZUVycm9yOiBIdHRwUmVzcG9uc2VFcnJvcixcbiAgICBKU09OUFJlcXVlc3Q6IEpTT05QUmVxdWVzdCxcbiAgICBKU09OUFJlc3BvbnNlOiBKU09OUFJlc3BvbnNlLFxuICAgIEpTT05QUmVzcG9uc2VFcnJvcjogSlNPTlBSZXNwb25zZUVycm9yLFxuICAgIFJlcXVlc3Q6IFJlcXVlc3QsXG4gICAgUmVzcG9uc2U6IFJlc3BvbnNlLFxuICAgIFJlc3BvbnNlRXJyb3I6IFJlc3BvbnNlRXJyb3Jcbn0pO1xuXG5kZWZpbmVFeHBvcnRzKEh0dHBDbGllbnQsICdmdW5jdGlvbnMnLCB7XG4gICAgdGVtcGxhdGU6IHRlbXBsYXRlLFxuICAgIG1lcmdlOiBtZXJnZSxcbiAgICBpc0Fic29sdXRlVVJMOiBpc0Fic29sdXRlVVJMLFxuICAgIGlzRnVuY3Rpb246IGlzRnVuY3Rpb24sXG4gICAgaXNQbGFpbk9iamVjdDogaXNQbGFpbk9iamVjdCxcbiAgICB1dWlkOiB1dWlkLFxuICAgIG5vb3A6IG5vb3AsXG4gICAgaW5oZXJpdHM6IGluaGVyaXRzLFxuICAgIGNyZWF0ZURlZmF1bHRPcHRpb25zOiBjcmVhdGVEZWZhdWx0T3B0aW9uc1xufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gSHR0cENsaWVudDtcbiIsInZhciBpc0Z1bmN0aW9uID0gcmVxdWlyZSgzOSk7XG52YXIgSlNPTlBSZXNwb25zZSA9IHJlcXVpcmUoNyk7XG52YXIgZmlyZUNhbGxiYWNrcyA9IHJlcXVpcmUoMzApO1xudmFyIG5vb3AgPSByZXF1aXJlKDMzKTtcbnZhciBjb25zdGFudHMgPSByZXF1aXJlKDEyKTtcbnZhciBFUlJfQ0FOQ0VMTEVEID0gY29uc3RhbnRzLkVSUl9DQU5DRUxMRUQ7XG52YXIgRVJSX05FVFdPUksgICA9IGNvbnN0YW50cy5FUlJfTkVUV09SSztcbnZhciBFUlJfUkVTUE9OU0UgID0gY29uc3RhbnRzLkVSUl9SRVNQT05TRTtcbnZhciBFUlJfVElNRU9VVCAgID0gY29uc3RhbnRzLkVSUl9USU1FT1VUO1xuXG5mdW5jdGlvbiBhZGRFdmVudExpc3RlbmVycyhyZXF1ZXN0LCBjYWxsYmFja05hbWUpIHtcbiAgICB2YXIgc2NyaXB0ID0gcmVxdWVzdC5zY3JpcHQ7XG4gICAgdmFyIG9wdGlvbnMgPSByZXF1ZXN0Lm9wdGlvbnM7XG4gICAgdmFyIHJlcXVlc3RUeXBlID0gcmVxdWVzdC5yZXF1ZXN0VHlwZTtcbiAgICB2YXIgaXNSZXNwb25zZU9rID0gb3B0aW9ucy5pc1Jlc3BvbnNlT2s7XG4gICAgdmFyIHJlc3BvbnNlID0gbmV3IEpTT05QUmVzcG9uc2UocmVxdWVzdCk7XG4gICAgdmFyIHRpbWVvdXQgPSBwYXJzZUludChvcHRpb25zLnRpbWVvdXQgfHwgMCwgMTApO1xuICAgIHZhciB0aW1lb3V0SWQgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGZ1bmN0aW9uIGZpbmlzaCB0aGUgcmVxdWVzdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBjb2RlIFRoZSBlcnJvciBjb2RlIG9uIGVycm9yLiBJZiBubyBlcnJvciBvY2N1cmVkLCB0aGUgY29kZSBpcyBgbnVsbGAuXG4gICAgICovXG4gICAgdmFyIGZpbmlzaCA9IGZ1bmN0aW9uIChjb2RlKSB7XG4gICAgICAgIC8vIFNldCBmaW5pc2ggdG8gdGhlIG5vIG9wZXJhdGlvbiBmdW5jdGlvbi5cbiAgICAgICAgZmluaXNoID0gbm9vcDtcblxuICAgICAgICAvLyBNYXJrIHRoaXMgcmVxdWVzdCBhcyBmaW5pc2hlZC5cbiAgICAgICAgcmVxdWVzdC5maW5pc2hlZCA9IHRydWU7XG5cbiAgICAgICAgLy8gQ2xlYXIgbGlzdGVuZXJzLlxuICAgICAgICB3aW5kb3dbY2FsbGJhY2tOYW1lXSA9IG5vb3A7XG4gICAgICAgIHNjcmlwdC5vbmVycm9yID0gbnVsbDtcblxuICAgICAgICAvLyBDbGVhciB0aW1lb3V0LlxuICAgICAgICBpZiAodGltZW91dElkICE9PSBudWxsKSB7XG4gICAgICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dElkKTtcbiAgICAgICAgICAgIHRpbWVvdXRJZCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBGaXJlIGNhbGxiYWNrcy5cbiAgICAgICAgZmlyZUNhbGxiYWNrcyhjb2RlLCByZXNwb25zZSk7XG4gICAgfTtcblxuICAgIC8vIERlZmluZSB0aGUgY2FsbGJhY2sgZnVuY3Rpb24uXG4gICAgd2luZG93W2NhbGxiYWNrTmFtZV0gPSBmdW5jdGlvbiAocmVzcG9uc2VKU09OKSB7XG4gICAgICAgIHJlcXVlc3QucmVzcG9uc2VKU09OID0gcmVzcG9uc2VKU09OO1xuICAgICAgICBpZiAoaXNGdW5jdGlvbihpc1Jlc3BvbnNlT2spKSB7XG4gICAgICAgICAgICBpZiAoaXNSZXNwb25zZU9rKHJlcXVlc3RUeXBlLCByZXNwb25zZSkpIHtcbiAgICAgICAgICAgICAgICBmaW5pc2gobnVsbCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGZpbmlzaChFUlJfUkVTUE9OU0UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZmluaXNoKG51bGwpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8vIENhdGNoIHRoZSBlcnJvci5cbiAgICBzY3JpcHQub25lcnJvciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZmluaXNoKEVSUl9ORVRXT1JLKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQ2FuY2VsIHRoZSByZXF1ZXN0LlxuICAgICAqL1xuICAgIHJlcXVlc3QuY2FuY2VsID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBmaW5pc2goRVJSX0NBTkNFTExFRCk7XG4gICAgfTtcblxuICAgIC8vIEFkZCB0aW1lb3V0IGxpc3RlbmVyXG4gICAgaWYgKCFpc05hTih0aW1lb3V0KSAmJiB0aW1lb3V0ID4gMCkge1xuICAgICAgICB0aW1lb3V0SWQgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGZpbmlzaChFUlJfVElNRU9VVCk7XG4gICAgICAgIH0sIHRpbWVvdXQpO1xuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBhZGRFdmVudExpc3RlbmVycztcbiIsIi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGNyZWF0ZSBKU09OUCBjYWxsYmFjayBuYW1lLlxuICpcbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEByZXR1cm5zIHtzdHJpbmd9IFJldHVybnMgdGhlIGNhbGxiYWNrIG5hbWUuXG4gKi9cbmZ1bmN0aW9uIGJ1aWxkQ2FsbGxiYWNrTmFtZShvcHRpb25zKSB7XG4gICAgdmFyIGNhbGxiYWNrTmFtZTtcblxuICAgIGRvIHtcbiAgICAgICAgY2FsbGJhY2tOYW1lID0gb3B0aW9ucy5qc29ucENhbGxiYWNrTmFtZS5jYWxsKG51bGwsIG9wdGlvbnMpO1xuICAgIH0gd2hpbGUgKGNhbGxiYWNrTmFtZSBpbiB3aW5kb3cpO1xuXG4gICAgd2luZG93W2NhbGxiYWNrTmFtZV0gPSBudWxsO1xuXG4gICAgcmV0dXJuIGNhbGxiYWNrTmFtZTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBidWlsZENhbGxsYmFja05hbWU7XG4iLCJ2YXIgYnVpbGRVUkwgPSByZXF1aXJlKDI1KTtcblxuLyoqXG4gKiBCdWlsZCB0aGUgSlNPTlAgc2NyaXB0IHNyYy5cbiAqXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9waXRvbnMuXG4gKiBAcGFyYW0ge3N0cmluZ30gY2FsbGJhY2tOYW1lIFRoZSBjYWxsYmFjayBuYW1lIG9mIHRoZSBKU09OUC5cbiAqIEByZXR1cm4ge3N0cmluZ30gUmV0dXJucyB0aGUgc2NyaXB0IHNyYy5cbiAqL1xuZnVuY3Rpb24gYnVpbGRTY3JpcHRTcmMob3B0aW9ucywgY2FsbGJhY2tOYW1lKSB7XG4gICAgLy8gdmFyIHVzZXJuYW1lID0gb3B0aW9ucy51c2VybmFtZTtcbiAgICAvLyB2YXIgcGFzc3dvcmQgPSBvcHRpb25zLnBhc3N3b3JkO1xuICAgIC8vIHZhciBsaW5rO1xuICAgIHZhciBxdWVyeSA9IG9wdGlvbnMucXVlcnk7XG4gICAgdmFyIGtleSA9IG9wdGlvbnMuanNvbnA7XG4gICAgdmFyIHVybDtcblxuICAgIGlmICghcXVlcnkpIHtcbiAgICAgICAgcXVlcnkgPSB7fTtcbiAgICAgICAgb3B0aW9ucy5xdWVyeSA9IHF1ZXJ5O1xuICAgIH1cblxuICAgIHF1ZXJ5W2tleV0gPSBjYWxsYmFja05hbWU7XG4gICAgdXJsID0gYnVpbGRVUkwob3B0aW9ucyk7XG5cbiAgICByZXR1cm4gdXJsO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGJ1aWxkU2NyaXB0U3JjO1xuIiwiLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gaGFuZGxlIGBvcHRpb25zLmNvcnNgIHNldHRpbmcgd2hlbiBzZW5kaW5nIEpTT05QIHJlcXVlc3RzLiBJZiBgb3B0aW9ucy5jb3JzYCBpcyBgdHJ1ZWAsIHRoZVxuICogYGNyb3Nzb3JpZ2luYCBhdHRyaWJ1dGUgb2YgdGhlIGBzY3JpcHRgIGVsZW1lbnQgd2UgdXNpbmcgaXMgc2V0IHRvIGB1c2UtY3JlZGVudGlhbHNgLlxuICpcbiAqIEBwYXJhbSB7SFRNTFNjcmlwdEVsZW1lbnR9IHNjcmlwdCBUaGUgc2NyaXB0IGVsZW1lbnQuXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKi9cbmZ1bmN0aW9uIGhhbmRsZVNjcmlwdENvcnMoc2NyaXB0LCBvcHRpb25zKSB7XG4gICAgaWYgKG9wdGlvbnMuY29ycykge1xuICAgICAgICBzY3JpcHQuc2V0QXR0cmlidXRlKCdjcm9zc29yaWdpbicsICd1c2UtY3JlZGVudGlhbHMnKTtcbiAgICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaGFuZGxlU2NyaXB0Q29ycztcbiIsInZhciBpc1BsYWluT2JqZWN0ID0gcmVxdWlyZSg0MCk7XG52YXIgaXNGdW5jdGlvbiA9IHJlcXVpcmUoMzkpO1xudmFyIGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGFkZCBjdXN0b20gcGFyc2VycyB0byB0aGUgaW5zdGFuY2Ugb2YgYFJlc3BvbnNlYCBvciBgUmVzcG9uc2VFcnJvcmAuXG4gKlxuICogQHBhcmFtIHtSZXNwb25zZXxSZXNwb25zZUVycm9yfSB0YXJnZXQgVGhlIHRhcmdldCB0byBhZGQgdGhlIGN1c3RvbWUgcGFyc2Vycy5cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEBwYXJhbSB7c3RyaW5nfSBvcHRpb25OYW1lIFRoZSBvcHRpb24gbmFtZSB0aGUgcGFyc2VycyBjb250YWluZXIuXG4gKi9cbmZ1bmN0aW9uIGFkZEN1c3RvbVBhcnNlcih0YXJnZXQsIG9wdGlvbnMsIG9wdGlvbk5hbWUpIHtcbiAgICB2YXIgcGFyc2VycyA9IG9wdGlvbnNbb3B0aW9uTmFtZV07XG4gICAgdmFyIG5hbWU7XG4gICAgdmFyIHBhcnNlcjtcblxuICAgIGlmIChpc1BsYWluT2JqZWN0KHBhcnNlcnMpKSB7XG4gICAgICAgIGZvciAobmFtZSBpbiBwYXJzZXJzKSB7XG4gICAgICAgICAgICBpZiAoaGFzT3duLmNhbGwocGFyc2VycywgbmFtZSkpIHtcbiAgICAgICAgICAgICAgICBwYXJzZXIgPSBwYXJzZXJzW25hbWVdO1xuICAgICAgICAgICAgICAgIGlmIChpc0Z1bmN0aW9uKHBhcnNlcikpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG5hbWUgaW4gdGFyZ2V0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RoZSBuYW1lIFwiJyArIG5hbWUgKyAnXCIgaGFzIGFscmVhZHkgZXhpc3RlZCwgY2FuIG5vdCBhZGQgaXQgYXMgYSBwYXJzZXInKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB0YXJnZXRbbmFtZV0gPSBwYXJzZXI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGFkZEN1c3RvbVBhcnNlcjtcbiIsInZhciBpc0Z1bmN0aW9uID0gcmVxdWlyZSgzOSk7XG52YXIgaXNBYnNvbHV0ZVVSTCA9IHJlcXVpcmUoMzcpO1xudmFyIGlzUGxhaW5PYmplY3QgPSByZXF1aXJlKDQwKTtcblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gYnVpbGQgcmVxdWVzdCB1cmwuXG4gKlxuICogMS4gQWRkIGJhc2VVUkwgaWYgbmVlZGVkLlxuICogMi4gQ29tcGlsZSB1cmwgaWYgbmVlZGVkLlxuICogMy4gQ29tcGlsZSBxdWVyeSBzdHJpbmcgaWYgbmVlZGVkLlxuICpcbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEByZXR1cm5zIHtzdHJpbmd9IFJldHVybnMgdGhlIGZpbmFsIHVybCBzdHJpbmcuXG4gKi9cbmZ1bmN0aW9uIGJ1aWxkVVJMKG9wdGlvbnMpIHtcbiAgICB2YXIgdXJsID0gKHR5cGVvZiBvcHRpb25zLnVybCA9PT0gJ3N0cmluZycpID8gb3B0aW9ucy51cmwgOiAnJztcbiAgICB2YXIgYmFzZVVSTCA9IG9wdGlvbnMuYmFzZVVSTDtcbiAgICB2YXIgcGFyYW0gPSBvcHRpb25zLnBhcmFtO1xuICAgIHZhciBxdWVyeSA9IG9wdGlvbnMucXVlcnk7XG4gICAgdmFyIGNvbXBpbGVVUkwgPSBvcHRpb25zLmNvbXBpbGVVUkw7XG4gICAgdmFyIGVuY29kZVF1ZXJ5U3RyaW5nID0gb3B0aW9ucy5lbmNvZGVRdWVyeVN0cmluZztcbiAgICB2YXIgYXJyYXk7XG5cbiAgICAvLyBJZiB0aGUgdXJsIGlzIG5vdCBhYnNvbHV0ZSB1cmwgYW5kIHRoZSBiYXNlVVJMIGlzIGRlZmluZWQsXG4gICAgLy8gcHJlcGVuZCB0aGUgYmFzZVVSTCB0byB0aGUgdXJsLlxuICAgIGlmICghaXNBYnNvbHV0ZVVSTCh1cmwpKSB7XG4gICAgICAgIGlmICh0eXBlb2YgYmFzZVVSTCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIHVybCA9IGJhc2VVUkwgKyB1cmw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBDb21waWxlIHRoZSB1cmwgaWYgbmVlZGVkLlxuICAgIGlmIChpc1BsYWluT2JqZWN0KHBhcmFtKSAmJiBpc0Z1bmN0aW9uKGNvbXBpbGVVUkwpKSB7XG4gICAgICAgIHVybCA9IGNvbXBpbGVVUkwodXJsLCBwYXJhbSwgb3B0aW9ucyk7XG4gICAgfVxuXG4gICAgLy8gQ29tcGlsZSB0aGUgcXVlcnkgc3RyaW5nLlxuICAgIGlmIChpc1BsYWluT2JqZWN0KHF1ZXJ5KSAmJiBpc0Z1bmN0aW9uKGVuY29kZVF1ZXJ5U3RyaW5nKSkge1xuICAgICAgICBxdWVyeSA9IGVuY29kZVF1ZXJ5U3RyaW5nKHF1ZXJ5LCBvcHRpb25zKTtcbiAgICAgICAgYXJyYXkgPSB1cmwuc3BsaXQoJyMnKTsgLy8gVGhlcmUgbWF5IGJlIHNvbWV0aGluZyBoYXNoIHN0cmluZyBpbiB0aGUgdXJsLlxuICAgICAgICB1cmwgPSBhcnJheVswXTtcblxuICAgICAgICBpZiAodXJsLmluZGV4T2YoJz8nKSA+IC0xKSB7XG4gICAgICAgICAgICAvLyBDaGVjayB3aGV0aGVyIHRoZSB1cmwgaXMgZW5kaW5nIHdpdGggYSBgJmAuXG4gICAgICAgICAgICBpZiAoLyYrJC8udGVzdCh1cmwpKSB7XG4gICAgICAgICAgICAgICAgdXJsID0gdXJsICsgcXVlcnk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHVybCA9IHVybCArICcmJyArIHF1ZXJ5O1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdXJsID0gdXJsICsgJz8nICsgcXVlcnk7XG4gICAgICAgIH1cblxuICAgICAgICBhcnJheVswXSA9IHVybDtcbiAgICAgICAgdXJsID0gYXJyYXkuam9pbignIycpO1xuICAgIH1cblxuICAgIHJldHVybiB1cmw7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYnVpbGRVUkw7XG4iLCJ2YXIgaXNGdW5jdGlvbiA9IHJlcXVpcmUoMzkpO1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBjYWxsIGBvcHRpb25zLm9uUmVxdWVzdENyZWF0ZWRgIGNhbGxiYWNrLlxuICpcbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEBwYXJhbSB7SHR0cFJlcXVlc3R8SlNPTlBSZXF1ZXN0fSByZXF1ZXN0IFRoZSByZXF1ZXN0IGluc3RhbmNlLlxuICovXG5mdW5jdGlvbiBjYWxsUmVxdWVzdENyZWF0ZWRDYWxsYmFjayhvcHRpb25zLCByZXF1ZXN0KSB7XG4gICAgdmFyIG9uUmVxdWVzdENyZWF0ZWQgPSBvcHRpb25zLm9uUmVxdWVzdENyZWF0ZWQ7XG5cbiAgICBpZiAoaXNGdW5jdGlvbihvblJlcXVlc3RDcmVhdGVkKSkge1xuICAgICAgICBvblJlcXVlc3RDcmVhdGVkKHJlcXVlc3QpO1xuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBjYWxsUmVxdWVzdENyZWF0ZWRDYWxsYmFjaztcbiIsInZhciBDYW5jZWxDb250cm9sbGVyID0gcmVxdWlyZSgxKTtcblxuLyoqXG4gKiBDcmVhdGUgYSBuZXcgaW5zdGFuY2Ugb2YgYENhbmNlbENvbnRyb2xsZXJgLlxuICpcbiAqIEByZXR1cm5zIHtDYW5jZWxDb250cm9sbGVyfSBSZXR1cm5zIGFuIG5ldyBpbnN0YW5jZSBvZiBgQ2FuY2VsQ29udHJvbGxlcmAuXG4gKi9cbnZhciBjcmVhdGVDYW5jZWxDb250cm9sbGVyID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBuZXcgQ2FuY2VsQ29udHJvbGxlcjtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gY3JlYXRlQ2FuY2VsQ29udHJvbGxlcjtcbiIsInZhciBRUyA9IHJlcXVpcmUoNDQpO1xudmFyIGNvbnN0YW50cyA9IHJlcXVpcmUoMTIpO1xudmFyIHRlbXBsYXRlID0gcmVxdWlyZSgzNCk7XG52YXIgdXVpZCA9IHJlcXVpcmUoMzUpO1xudmFyIEhUVFBfUkVRVUVTVCAgPSBjb25zdGFudHMuSFRUUF9SRVFVRVNUO1xudmFyIEVSUl9BQk9SVEVEICAgPSBjb25zdGFudHMuRVJSX0FCT1JURUQ7XG52YXIgRVJSX0NBTkNFTExFRCA9IGNvbnN0YW50cy5FUlJfQ0FOQ0VMTEVEO1xudmFyIEVSUl9ORVRXT1JLICAgPSBjb25zdGFudHMuRVJSX05FVFdPUks7XG52YXIgRVJSX1JFU1BPTlNFICA9IGNvbnN0YW50cy5FUlJfUkVTUE9OU0U7XG52YXIgRVJSX1RJTUVPVVQgICA9IGNvbnN0YW50cy5FUlJfVElNRU9VVDtcblxuLyoqXG4gKiBDcmVhdGUgYSBuZXcgZGVmYXVsdCByZXF1ZXN0IG9wdGlvbnMuXG4gKlxuICogQHJldHVybnMge1JlcXVlc3RPcHRpb25zfSBSZXR1cm5zIGEgbmV3IGRlZmF1bHQgcmVxdWVzdCBvcGl0b25zLlxuICovXG5mdW5jdGlvbiBjcmVhdGVEZWZhdWx0T3B0aW9ucygpIHtcbiAgICB2YXIgZXJyb3JNZXNzYWdlcyA9IHt9O1xuXG4gICAgZXJyb3JNZXNzYWdlc1tFUlJfQUJPUlRFRF0gPSAnUmVxdWVzdCBhYm9ydGVkJztcbiAgICBlcnJvck1lc3NhZ2VzW0VSUl9DQU5DRUxMRURdID0gJ1JlcXVlc3QgY2FuY2VsbGVkJztcbiAgICBlcnJvck1lc3NhZ2VzW0VSUl9ORVRXT1JLXSA9ICdOZXR3b3JrIGVycm9yJztcbiAgICBlcnJvck1lc3NhZ2VzW0VSUl9SRVNQT05TRV0gPSAnUmVzcG9uc2UgZXJyb3InO1xuICAgIGVycm9yTWVzc2FnZXNbRVJSX1RJTUVPVVRdID0gJ1JlcXVlc3QgdGltZW91dCc7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7UmVxdWVzdE9wdGlvbnN9XG4gICAgICovXG4gICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgICAgIGJhc2VVUkw6IG51bGwsXG4gICAgICAgIHVybDogbnVsbCxcbiAgICAgICAgcGFyYW06IG51bGwsXG4gICAgICAgIHF1ZXJ5OiBudWxsLFxuICAgICAgICBoZWFkZXJzOiBudWxsLFxuICAgICAgICBib2R5OiBudWxsLFxuICAgICAgICBleHRyYToge30sXG4gICAgICAgIGNvbnRyb2xsZXI6IG51bGwsXG4gICAgICAgIHJlcXVlc3RGdW5jdGlvbk5hbWU6IG51bGwsXG4gICAgICAgIHJlcXVlc3RUeXBlOiBudWxsLFxuICAgICAgICBjb3JzOiBmYWxzZSxcbiAgICAgICAgeGhyUHJvcHM6IG51bGwsXG4gICAgICAgIHVzZXJuYW1lOiBudWxsLFxuICAgICAgICBwYXNzd29yZDogbnVsbCxcbiAgICAgICAgdGltZW91dDogMCxcbiAgICAgICAgbm9DYWNoZTogZmFsc2UsXG4gICAgICAgIG5vQ2FjaGVIZWFkZXJzOiB7XG4gICAgICAgICAgICAnUHJhZ21hJzogJ25vLWNhY2hlJyxcbiAgICAgICAgICAgICdDYWNoZS1Db250cm9sJzogJ25vLWNhY2hlLCBuby1zdG9yZSwgbXVzdC1yZXZhbGlkYXRlJ1xuICAgICAgICB9LFxuICAgICAgICBqc29ucDogJ2NhbGxiYWNrJyxcbiAgICAgICAgZXJyb3JNZXNzYWdlczogZXJyb3JNZXNzYWdlcyxcbiAgICAgICAgaHR0cFJlcXVlc3RCb2R5UHJvY2Vzc29yOiB7XG4gICAgICAgICAgICByYXc6IHtcbiAgICAgICAgICAgICAgICBwcmlvcml0eTogMCxcbiAgICAgICAgICAgICAgICBoZWFkZXJzOiBudWxsLFxuICAgICAgICAgICAgICAgIHByb2Nlc3NvcjogbnVsbCxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBmb3JtOiB7XG4gICAgICAgICAgICAgICAgcHJpb3JpdHk6IDEsXG4gICAgICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZDsgY2hhcnNldD1VVEYtOCdcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHByb2Nlc3NvcjogZnVuY3Rpb24gKGRhdGEsIG9wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFFTLmVuY29kZShkYXRhKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAganNvbjoge1xuICAgICAgICAgICAgICAgIHByaW9yaXR5OiAyLFxuICAgICAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uOyBjaGFyc2V0PVVURi04J1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcHJvY2Vzc29yOiBmdW5jdGlvbiAoZGF0YSwgb3B0aW9ucykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoZGF0YSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBodHRwUmVzcG9uc2VQYXJzZXI6IHtcbiAgICAgICAgICAgIGpzb246IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAvLyBgdGhpc2AgaXMgcG9pbnQgdG8gdGhlIGN1cnJlbnQgaW5zdGFuY2Ugb2YgYEh0dHBSZXNwb25zZWAuXG4gICAgICAgICAgICAgICAgdmFyIHJlc3BvbnNlVGV4dCA9IHRoaXMucmVxdWVzdC54aHIucmVzcG9uc2VUZXh0O1xuICAgICAgICAgICAgICAgIHJldHVybiByZXNwb25zZVRleHQgPyBKU09OLnBhcnNlKHJlc3BvbnNlVGV4dCkgOiBudWxsO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHRleHQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5yZXF1ZXN0Lnhoci5yZXNwb25zZVRleHQ7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc3RhdHVzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucmVxdWVzdC54aHIuc3RhdHVzO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBqc29ucFJlc3BvbnNlUGFyc2VyOiB7XG4gICAgICAgICAgICBqc29uOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucmVxdWVzdC5yZXNwb25zZUpTT047XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGh0dHBSZXNwb25zZUVycm9yUGFyc2VyOiBudWxsLFxuICAgICAgICBqc29ucFJlc3BvbnNlRXJyb3JQYXJzZXI6IG51bGwsXG4gICAgICAgIGhhbmRsZU9wdGlvbnM6IG51bGwsXG4gICAgICAgIGNyZWF0ZVhIUjogZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICAgICAgfSxcbiAgICAgICAgY3JlYXRlU2NyaXB0OiBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICAgICAgdmFyIHNjcmlwdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NjcmlwdCcpO1xuXG4gICAgICAgICAgICBzY3JpcHQuc2V0QXR0cmlidXRlKCd0eXBlJywgJ3RleHQvamF2YXNjcmlwdCcpO1xuICAgICAgICAgICAgc2NyaXB0LnNldEF0dHJpYnV0ZSgnY2hhcnNldCcsICd1dGYtOCcpO1xuXG4gICAgICAgICAgICByZXR1cm4gc2NyaXB0O1xuICAgICAgICB9LFxuICAgICAgICBqc29ucENvbnRhaW5lck5vZGU6IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgICAgICByZXR1cm4gZG9jdW1lbnQuaGVhZCB8fCBkb2N1bWVudC5nZXRFbGVtZW50c0J5TmFtZSgnaGVhZCcpWzBdO1xuICAgICAgICB9LFxuICAgICAgICBqc29ucENhbGxiYWNrTmFtZTogZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgICAgIHJldHVybiAnanNvbnBfJyArIHV1aWQoKSArICdfJyArIChuZXcgRGF0ZSgpLmdldFRpbWUoKSk7XG4gICAgICAgIH0sXG4gICAgICAgIGNvbXBpbGVVUkw6IGZ1bmN0aW9uICh1cmwsIHBhcmFtLCBvcHRpb25zKSB7XG4gICAgICAgICAgICByZXR1cm4gdGVtcGxhdGUodXJsLCBwYXJhbSk7XG4gICAgICAgIH0sXG4gICAgICAgIGVuY29kZVF1ZXJ5U3RyaW5nOiBmdW5jdGlvbiAoZGF0YSwgb3B0aW9ucykge1xuICAgICAgICAgICAgcmV0dXJuIFFTLmVuY29kZShkYXRhKTtcbiAgICAgICAgfSxcbiAgICAgICAgb25YaHJDcmVhdGVkOiBudWxsLFxuICAgICAgICBvblhock9wZW5lZDogbnVsbCxcbiAgICAgICAgb25YaHJTZW50OiBudWxsLFxuICAgICAgICBvblJlcXVlc3RDcmVhdGVkOiBudWxsLFxuICAgICAgICBpc1Jlc3BvbnNlT2s6IGZ1bmN0aW9uIChyZXF1ZXN0VHlwZSwgcmVzcG9uc2UpIHtcbiAgICAgICAgICAgIHZhciBzdGF0dXM7XG5cbiAgICAgICAgICAgIC8vIEh0dHAgcmVxZXN0XG4gICAgICAgICAgICBpZiAocmVxdWVzdFR5cGUgPT09IEhUVFBfUkVRVUVTVCkge1xuICAgICAgICAgICAgICAgIHN0YXR1cyA9IHJlc3BvbnNlLnJlcXVlc3QueGhyLnN0YXR1cztcbiAgICAgICAgICAgICAgICByZXR1cm4gKHN0YXR1cyA+PSAyMDAgJiYgc3RhdHVzIDwgMzAwKSB8fCBzdGF0dXMgPT09IDMwNDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gSlNPTlAgcmVxdWVzdFxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0sXG4gICAgICAgIHRyYW5zZm9ybUVycm9yOiBudWxsLFxuICAgICAgICB0cmFuc2Zvcm1SZXNwb25zZTogbnVsbCxcbiAgICAgICAgc2hvdWxkQ2FsbEVycm9yQ2FsbGJhY2s6IG51bGwsXG4gICAgICAgIHNob3VsZENhbGxTdWNjZXNzQ2FsbGJhY2s6IG51bGxcbiAgICB9O1xuXG4gICAgcmV0dXJuIG9wdGlvbnM7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gY3JlYXRlRGVmYXVsdE9wdGlvbnM7XG4iLCIvKipcbiAqIERlZmluZSBhIHN0YXRpYyBtZW1iZXIgb24gdGhlIGdpdmVuIGNvbnN0cnVjdG9yIGFuZCBpdHMgcHJvdG90eXBlXG4gKlxuICogQHBhcmFtIHtDb25zdHJ1Y3Rvcn0gY3RvciBUaGUgY29uc3RydWN0b3IgdG8gZGVmaW5lIHRoZSBzdGF0aWMgbWVtYmVyXG4gKiBAcGFyYW0ge3N0cmluZ30gbmFtZSBUaGUgbmFtZSBvZiB0aGUgc3RhdGljIG1lbWJlclxuICogQHBhcmFtIHthbnl9IHZhbHVlIFRoZSB2YWx1ZSBvZiB0aGUgc3RhdGljIG1lbWJlclxuICogQHRocm93cyB7RXJyb3J9IFRocm93cyBlcnJvciBpZiB0aGUgbmFtZSBoYXMgYWxyZWFkeSBleGlzdGVkLCBvciB0aGUgY29uc3RydWN0b3IgaXMgbm90IGEgZnVuY3Rpb25cbiAqL1xuZnVuY3Rpb24gZGVmaW5lRXhwb3J0cyhjdG9yLCBuYW1lLCB2YWx1ZSkge1xuICAgIGlmICh0eXBlb2YgY3RvciAhPT0gJ2Z1bmN0aW9uJyB8fCAhY3Rvci5wcm90b3R5cGUpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdUaGUgY29uc3RydWN0b3IgaXMgbm90IGEgZnVuY3Rpb24gb3IgaXRzIHByb3RvdHlwZSBpcyBub3QgYW4gb2JqZWN0Jyk7XG4gICAgfVxuXG4gICAgY3Rvci5leHBvcnRzID0gY3Rvci5leHBvcnRzIHx8IHt9O1xuXG4gICAgaWYgKG5hbWUgaW4gY3Rvci5leHBvcnRzKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVGhlIG5hbWUgXCInICsgbmFtZSArICdcIiBoYXMgYWxyZWFkeSBleGlzdGVkIGluIHRoZSBjb25zdHJ1Y3Rvci5leHBvcnRzJyk7XG4gICAgfVxuXG4gICAgaWYgKGN0b3IucHJvdG90eXBlLmV4cG9ydHMgJiYgY3Rvci5wcm90b3R5cGUuZXhwb3J0cyAhPT0gY3Rvci5leHBvcnRzKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVGhlIG5hbWUgXCJleHBvcnRzXCIgaGFzIGFscmVhZHkgZXhpc3RlZCBpbiB0aGUgY29uc3RydWN0b3IucHJvdG90eXBlJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgY3Rvci5wcm90b3R5cGUuZXhwb3J0cyA9IGN0b3IuZXhwb3J0cztcbiAgICB9XG5cbiAgICBjdG9yLmV4cG9ydHNbbmFtZV0gPSB2YWx1ZTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBkZWZpbmVFeHBvcnRzO1xuIiwidmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKDM5KTtcbnZhciBIdHRwUmVzcG9uc2VFcnJvciA9IHJlcXVpcmUoNSk7XG52YXIgSlNPTlBSZXNwb25zZUVycm9yID0gcmVxdWlyZSg4KTtcbnZhciBjb25zdGFudHMgPSByZXF1aXJlKDEyKTtcbnZhciBIVFRQX1JFUVVFU1QgPSBjb25zdGFudHMuSFRUUF9SRVFVRVNUO1xuXG4vKipcbiAqIEZpcmUgdGhlIGNhbGxiYWNrcy5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ3xudWxsfSBjb2RlIElmIHRoZXJlIGlzIGFuIGVycm9yLCBgY29kZWAgc2hvdWxkIGJlIGEgc3RyaW5nLiBJZiB0aGVyZSBpcyBubyBlcnJvciwgYGNvZGVgIGlzIGBudWxsYC5cbiAqIEBwYXJhbSB7SHR0cFJlc3BvbnNlfEpTT05QUmVzcG9uc2V9IHJlc3BvbnNlIFRoZSByZXNwb25zZSBpbnN0YW5jZS5cbiAqL1xuZnVuY3Rpb24gZmlyZUNhbGxiYWNrcyhjb2RlLCByZXNwb25zZSkge1xuICAgIHZhciByZXF1ZXN0ID0gcmVzcG9uc2UucmVxdWVzdDtcbiAgICB2YXIgcmVxdWVzdFR5cGUgPSByZXF1ZXN0LnJlcXVlc3RUeXBlO1xuICAgIHZhciBvcHRpb25zID0gcmVxdWVzdC5vcHRpb25zO1xuICAgIHZhciBvbnN1Y2Nlc3MgPSByZXF1ZXN0Lm9uc3VjY2VzcztcbiAgICB2YXIgb25lcnJvciA9IHJlcXVlc3Qub25lcnJvcjtcbiAgICB2YXIgc2hvdWxkQ2FsbEVycm9yQ2FsbGJhY2sgPSBvcHRpb25zLnNob3VsZENhbGxFcnJvckNhbGxiYWNrO1xuICAgIHZhciBzaG91bGRDYWxsU3VjY2Vzc0NhbGxiYWNrID0gb3B0aW9ucy5zaG91bGRDYWxsU3VjY2Vzc0NhbGxiYWNrO1xuICAgIHZhciB0cmFuc2Zvcm1FcnJvciA9IG9wdGlvbnMudHJhbnNmb3JtRXJyb3I7XG4gICAgdmFyIHRyYW5zZm9ybVJlc3BvbnNlID0gb3B0aW9ucy50cmFuc2Zvcm1SZXNwb25zZTtcblxuICAgIHZhciBlcnJvciA9IG51bGw7XG4gICAgdmFyIGNhbGxFcnJvckNhbGxiYWNrID0gdHJ1ZTtcbiAgICB2YXIgY2FsbFN1Y2Nlc3NDYWxsYmFjayA9IHRydWU7XG4gICAgdmFyIHRyYW5zZm9ybWVkRXJyb3IgPSBudWxsO1xuICAgIHZhciB0cmFuc2Zvcm1lZFJlc3BvbnNlID0gbnVsbDtcblxuICAgIGlmIChjb2RlKSB7XG4gICAgICAgIGlmIChyZXF1ZXN0VHlwZSA9PT0gSFRUUF9SRVFVRVNUKSB7XG4gICAgICAgICAgICBlcnJvciA9IG5ldyBIdHRwUmVzcG9uc2VFcnJvcihjb2RlLCByZXF1ZXN0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGVycm9yID0gbmV3IEpTT05QUmVzcG9uc2VFcnJvcihjb2RlLCByZXF1ZXN0KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaXNGdW5jdGlvbih0cmFuc2Zvcm1FcnJvcikpIHtcbiAgICAgICAgICAgIHRyYW5zZm9ybWVkRXJyb3IgPSB0cmFuc2Zvcm1FcnJvcihyZXF1ZXN0VHlwZSwgZXJyb3IpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdHJhbnNmb3JtZWRFcnJvciA9IGVycm9yO1xuICAgICAgICB9XG4gICAgICAgIGlmIChpc0Z1bmN0aW9uKHNob3VsZENhbGxFcnJvckNhbGxiYWNrKSkge1xuICAgICAgICAgICAgY2FsbEVycm9yQ2FsbGJhY2sgPSBzaG91bGRDYWxsRXJyb3JDYWxsYmFjayhyZXF1ZXN0VHlwZSwgdHJhbnNmb3JtZWRFcnJvciwgZXJyb3IpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjYWxsRXJyb3JDYWxsYmFjaykge1xuICAgICAgICAgICAgaWYgKGlzRnVuY3Rpb24ob25lcnJvcikpIHtcbiAgICAgICAgICAgICAgICBvbmVycm9yKHRyYW5zZm9ybWVkRXJyb3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKGlzRnVuY3Rpb24odHJhbnNmb3JtUmVzcG9uc2UpKSB7XG4gICAgICAgICAgICB0cmFuc2Zvcm1lZFJlc3BvbnNlID0gdHJhbnNmb3JtUmVzcG9uc2UocmVxdWVzdFR5cGUsIHJlc3BvbnNlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRyYW5zZm9ybWVkUmVzcG9uc2UgPSByZXNwb25zZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaXNGdW5jdGlvbihzaG91bGRDYWxsU3VjY2Vzc0NhbGxiYWNrKSkge1xuICAgICAgICAgICAgY2FsbFN1Y2Nlc3NDYWxsYmFjayA9IHNob3VsZENhbGxTdWNjZXNzQ2FsbGJhY2socmVxdWVzdFR5cGUsIHRyYW5zZm9ybWVkUmVzcG9uc2UsIHJlc3BvbnNlKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2FsbFN1Y2Nlc3NDYWxsYmFjaykge1xuICAgICAgICAgICAgaWYgKGlzRnVuY3Rpb24ob25zdWNjZXNzKSkge1xuICAgICAgICAgICAgICAgIG9uc3VjY2Vzcyh0cmFuc2Zvcm1lZFJlc3BvbnNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBmaXJlQ2FsbGJhY2tzO1xuIiwidmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKDM5KTtcblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gcHJvY2VzcyB0aGUgcmVxdWVzdCBvcHRpb25zLiBUaGlzIGZ1bmN0aW9uIHdpbGwgY2FsbCB0aGUgZnVuY3Rpb24gYG9wdGlvbnMuaGFuZGxlT3B0aW9uc2AuXG4gKlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICogQHJldHVybnMge3ZvaWR9XG4gKi9cbmZ1bmN0aW9uIGhhbmRsZU9wdGlvbnMob3B0aW9ucykge1xuICAgIGlmIChpc0Z1bmN0aW9uKG9wdGlvbnMuaGFuZGxlT3B0aW9ucykpIHtcbiAgICAgICAgb3B0aW9ucy5oYW5kbGVPcHRpb25zKG9wdGlvbnMpO1xuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBoYW5kbGVPcHRpb25zO1xuIiwiLyoqXG4gKiBNYWtlIGBTdWJDbGFzc2AgZXh0ZW5kIGBTdXBlckNsYXNzYC5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBTdWJDbGFzcyBUaGUgc3ViIGNsYXNzIGNvbnN0cnVjdG9yLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gU3VwZXJDbGFzcyBUaGUgc3VwZXIgY2xhc3MgY29uc3RydWN0b3IuXG4gKi9cbmZ1bmN0aW9uIGluaGVyaXRzKFN1YkNsYXNzLCBTdXBlckNsYXNzKSB7XG4gICAgdmFyIEYgPSBmdW5jdGlvbigpIHt9O1xuXG4gICAgRi5wcm90b3R5cGUgPSBTdXBlckNsYXNzLnByb3RvdHlwZTtcblxuICAgIFN1YkNsYXNzLnByb3RvdHlwZSA9IG5ldyBGKCk7XG4gICAgU3ViQ2xhc3MucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gU3ViQ2xhc3M7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaW5oZXJpdHM7XG4iLCIvKipcbiAqIFRoZSBubyBvcGVyYXRpb24gZnVuY3Rpb24uXG4gKi9cbmZ1bmN0aW9uIG5vb3AoKSB7XG4gICAgLy8gbm90aGluZyB0byBkbyBoZXJlLlxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IG5vb3A7XG4iLCIvKipcbiAqIEEgc2ltcGxlIHRlbXBsYXRlIGZ1bmN0aW9uXG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIFJyZXR1cm5zICcvcG9zdC8xJ1xuICogdGVtcGxhdGUoJy9wb3N0L3twb3N0SWR9JywgeyBwb3N0SWQ6IDEgfSlcbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gdGVtcGxhdGUgVGhlIHRlbXBsYXRlIHRleHRcbiAqIEBwYXJhbSB7T2JqZWN0LjxzdHJpbmcsIHN0cmluZz59IGRhdGEgVGhlIGRhdGEgb2JqZWN0XG4gKiBAcmV0dXJucyB7c3RyaW5nfSBSZXR1cm5zIHRoZSBjb21waWxlZCB0ZXh0XG4gKi9cbmZ1bmN0aW9uIHRlbXBsYXRlKHRlbXBsYXRlLCBkYXRhKSB7XG4gICAgdmFyIHN0ciA9IFtdO1xuICAgIHZhciByZXMgPSBudWxsO1xuICAgIHZhciByZWdleHAgPSAvKF58W15cXFxcXSlcXHsoW15cXHtcXH1dKlteXFxcXF0pP1xcfS87XG5cbiAgICAvLyBtYWtlIHN1cmUgdGhhdCB0aGUgdHlwZSBpcyBjb3JyZWN0XG4gICAgdGVtcGxhdGUgPSAnJyArIHRlbXBsYXRlO1xuICAgIGRhdGEgPSBkYXRhIHx8IHt9O1xuXG4gICAgd2hpbGUgKCByZXMgPSByZWdleHAuZXhlYyh0ZW1wbGF0ZSkgKSB7XG4gICAgICAgIHZhciBpbmRleCA9IHJlcy5pbmRleDtcbiAgICAgICAgdmFyIG1hdGNoID0gcmVzWzBdO1xuICAgICAgICB2YXIgcHJlZml4ID0gcmVzWzFdO1xuICAgICAgICB2YXIga2V5ID0gcmVzWzJdO1xuXG4gICAgICAgIC8vIHRyaW0gd2hpdGUgc3BhY2VzXG4gICAgICAgIGtleSA9IChrZXkgfHwgJycpLnJlcGxhY2UoL15cXHMrfFxccyskL2csICcnKTtcbiAgICAgICAgLy8gc2F2ZSB0aGUgY29udGVudCBiZWZvcmUgdGhlIGtleVxuICAgICAgICBzdHIucHVzaCggdGVtcGxhdGUuc3Vic3RyKCAwLCBpbmRleCArIHByZWZpeC5sZW5ndGggKSApO1xuICAgICAgICAvLyByZWFkIHRoZSB2YWx1ZSBvZiB0aGUga2V5XG4gICAgICAgIHN0ci5wdXNoKCAnJyArIGRhdGFba2V5XSApO1xuICAgICAgICAvLyB1cGRhdGUgdGhlIHRlbXBsYXRlXG4gICAgICAgIHRlbXBsYXRlID0gdGVtcGxhdGUuc3Vic3RyKCBpbmRleCArIG1hdGNoLmxlbmd0aCApO1xuICAgICAgICAvLyByZXNldCBsYXN0IGluZGV4IG1hbnVhbGx5XG4gICAgICAgIHJlZ2V4cC5sYXN0SW5kZXggPSAwO1xuICAgIH1cblxuICAgIC8vIHNhdmUgdGhlIGNvbnRlbnQgYWZ0ZXIgbGFzdCBrZXlcbiAgICBzdHIucHVzaCh0ZW1wbGF0ZSk7XG5cbiAgICAvLyByZXBsYWNlIGBcXHtgIGFuZCBgXFx9YCB3aXRoIGB7YCBhbmQgYH1gXG4gICAgc3RyID0gc3RyLmpvaW4oJycpO1xuICAgIHN0ciA9IHN0ci5yZXBsYWNlKC9cXFxcXFx7L2csICd7Jyk7XG4gICAgc3RyID0gc3RyLnJlcGxhY2UoL1xcXFxcXH0vZywgJ30nKTtcblxuICAgIHJldHVybiBzdHI7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHRlbXBsYXRlO1xuIiwidmFyIGlkID0gMDtcblxuLyoqXG4gKiBSZXR1cm5zIGEgbnVtYmVyIHRoYXQgZ3JlYXRlciB0aGFuIHRoZSBwcml2b3VzIG9uZSwgc3RhcnRpbmcgZm9ybSBgMWAuXG4gKlxuICogQHJldHVybnMge251bWJlcn1cbiAqL1xuZnVuY3Rpb24gdXVpZCgpIHtcbiAgICBpZCArPSAxO1xuICAgIHJldHVybiBpZDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB1dWlkO1xuIiwibW9kdWxlLmV4cG9ydHMgPSAnMC4wLjEtYWxwaGEuMSc7XG4iLCIvKipcbiAqIENoZWNrIHdoZXRoZXIgdGhlIHVybCBpcyBhYnNvbHV0ZSB1cmwuXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IHVybCBUaGUgdXJsIHN0cmluZyB0byBjaGVja1xuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSB1cmwgaXMgYWJvc29sdXRlLCBvdGhlcndpc2UgYGZhbHNlYCBpcyByZXR1cm5lZFxuICovXG5mdW5jdGlvbiBpc0Fic29sdXRlVVJMKHVybCkge1xuICAgIHJldHVybiAvXig/OlthLXpdW2EtejAtOVxcLVxcLlxcK10qOik/XFwvXFwvL2kudGVzdCh1cmwpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGlzQWJzb2x1dGVVUkw7XG4iLCJ2YXIgdG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xuXG4vKipcbiAqIENoZWNrIHdoZXRoZXIgdGhlIHZhcmlhYmxlIGlzIGFuIGluc3RhbmNlIG9mIGBBcnJheWBcbiAqXG4gKiBAcGFyYW0ge2FueX0gaXQgVGhlIHZhcmlhYmxlIHRvIGNoZWNrXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIHZhcmlhYmxlIGlzIGFuIGluc3RhbmNlIG9mIGBBcnJheWAsIG90aGVyd2lzZSBgZmFsc2VgIGlzIHJldHVybmVkXG4gKi9cbmZ1bmN0aW9uIGlzQXJyYXkoaXQpIHtcbiAgICByZXR1cm4gdG9TdHJpbmcuY2FsbChpdCkgPT09ICdbb2JqZWN0IEFycmF5XSc7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaXNBcnJheTtcbiIsInZhciB0b1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG5cbi8qKlxuICogQ2hlY2sgd2hldGhlciB0aGUgdmFyaWFibGUgaXMgYSBmdW5jdGlvblxuICpcbiAqIEBwYXJhbSB7YW55fSBpdCBUaGUgdmFyaWFibGUgdG8gY2hlY2tcbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgdmFyaWFibGUgaXMgYSBmdW5jdGlvbiwgb3RoZXJ3aXNlIGBmYWxzZWAgaXMgcmV0dXJuZWRcbiAqL1xuZnVuY3Rpb24gaXNGdW5jdGlvbihpdCkge1xuICAgIHJldHVybiB0b1N0cmluZy5jYWxsKGl0KSA9PT0gJ1tvYmplY3QgRnVuY3Rpb25dJztcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpc0Z1bmN0aW9uO1xuIiwidmFyIHRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcblxuLyoqXG4gKiBDaGVjayB3aGV0aGVyIHRoZSB2YXJpYWJsZSBpcyBhIHBsYWluIG9iamVjdC5cbiAqXG4gKiBAcGFyYW0ge2FueX0gaXQgVGhlIHZhcmlhYmxlIHRvIGNoZWNrXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIHZhcmlhYmxlIGlzIGEgcGxhaW4gb2JqZWN0LCBvdGhlcndpc2UgYGZhbHNlYCBpcyByZXR1cm5lZFxuICovXG5mdW5jdGlvbiBpc1BsYWluT2JqZWN0KGl0KSB7XG4gICAgaWYgKCFpdCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmIGl0ID09PSB3aW5kb3cpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgZ2xvYmFsICE9PSAndW5kZWZpbmVkJyAmJiBpdCA9PT0gZ2xvYmFsKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdG9TdHJpbmcuY2FsbChpdCkgPT09ICdbb2JqZWN0IE9iamVjdF0nO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGlzUGxhaW5PYmplY3Q7XG4iLCJ2YXIgaXNBcnJheSA9IHJlcXVpcmUoMzgpO1xudmFyIGlzUGxhaW5PYmplY3QgPSByZXF1aXJlKDQwKTtcbnZhciBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xudmFyIHNsaWNlID0gQXJyYXkucHJvdG90eXBlLnNsaWNlO1xuXG4vKipcbiAqIENvcHkgdGhlIG5vbi11bmRlZmluZWQgdmFsdWVzIG9mIHNvdXJjZSB0byB0YXJnZXQuIE92ZXJ3cml0ZSB0aGUgb3JpZ2luYWwgdmFsdWVzLlxuICogVGhpcyBmdW5jdGlvbiB3aWxsIG1vZGlmeSB0aGUgdGFyZ2V0XG4gKlxuICogQHBhcmFtIHtPYmplY3QuPHN0cmluZywgKj58YW55W119IHRhcmdldCBUaGUgdGFyZ2V0IG9iamVjdCBvciBhcnJheVxuICogQHBhcmFtIHtPYmplY3QuPHN0cmluZywgKj58YW55W119IHNvdXJjZSBUaGUgc291cmNlIG9iamVjdCBvciBhcnJheVxuICogQHJldHVybnMge09iamVjdC48c3RyaW5nLCAqPnxhbnlbXX0gUmV0dXJucyB0aGUgZXh0ZW5kZWQgdGFyZ2V0IG9iamVjdCBvciBhcnJheVxuICovXG5mdW5jdGlvbiBleHRlbmQodGFyZ2V0LCBzb3VyY2UpIHtcbiAgICB2YXIga2V5LCB2YWw7XG5cbiAgICBpZiAoIHRhcmdldCAmJiAoIGlzQXJyYXkoc291cmNlKSB8fCBpc1BsYWluT2JqZWN0KHNvdXJjZSkgKSApIHtcbiAgICAgICAgZm9yICgga2V5IGluIHNvdXJjZSApIHtcbiAgICAgICAgICAgIGlmICggaGFzT3duLmNhbGwoc291cmNlLCBrZXkpICkge1xuICAgICAgICAgICAgICAgIHZhbCA9IHNvdXJjZVtrZXldO1xuICAgICAgICAgICAgICAgIGlmICh2YWwgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIGlzUGxhaW5PYmplY3QodmFsKSApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICggISBpc1BsYWluT2JqZWN0KHRhcmdldFtrZXldKSApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0YXJnZXRba2V5XSA9IHt9O1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgbWVyZ2UodGFyZ2V0W2tleV0sIHZhbCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoIGlzQXJyYXkodmFsKSApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICggISBpc0FycmF5KHRhcmdldFtrZXldKSApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0YXJnZXRba2V5XSA9IFtdO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgbWVyZ2UodGFyZ2V0W2tleV0sIHZhbCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0YXJnZXRba2V5XSA9IHZhbDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0YXJnZXQ7XG59XG5cbi8qKlxuICogQ29weSBhbnkgbm9uLXVuZGVmaW5lZCB2YWx1ZXMgb2Ygc291cmNlIHRvIHRhcmdldCBhbmQgb3ZlcndyaXRlcyB0aGUgY29ycmVzcG9uZGluZyBvcmlnaW5hbCB2YWx1ZXMuIFRoaXMgZnVuY3Rpb25cbiAqIHdpbGwgbW9kaWZ5IHRoZSB0YXJnZXQgb2JqZWN0LlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB0YXJnZXQgVGhlIHRhcmdldCBvYmplY3RcbiAqIEBwYXJhbSB7Li4uT2JqZWN0fSBhcmdzIFRoZSBzb3VyY2Ugb2JqZWN0XG4gKiBAcmV0dXJucyB7T2JqZWN0fSBSZXR1cm5zIHRoZSBtb2RpZmllZCB0YXJnZXQgb2JqZWN0XG4gKi9cbmZ1bmN0aW9uIG1lcmdlKHRhcmdldCwgYXJncykge1xuICAgIHZhciBpID0gMDtcbiAgICB2YXIgbCA9IGFyZ3VtZW50cy5sZW5ndGggLSAxO1xuXG4gICAgYXJncyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcblxuICAgIGZvciAoaSA9IDA7IGkgPCBsOyBpICs9IDEpIHtcbiAgICAgICAgZXh0ZW5kKHRhcmdldCwgYXJnc1tpXSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRhcmdldDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBtZXJnZTtcbiIsInZhciB1dGlsID0gcmVxdWlyZSg0NSk7XG52YXIgaXNBcnJheSA9IHV0aWwuaXNBcnJheTtcblxuLyoqXG4gKiBEZWNvZGUgdGhlIFVSSSBDb21wb25lbnQgZW5jb2RlZCBxdWVyeSBzdHJpbmcgdG8gb2JqZWN0XG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IFRoZSBVUkkgQ29tcG9uZW50IGVuY29kZWQgcXVlcnkgc3RyaW5nXG4gKiBAcmV0dXJucyB7T2JqZWN0LjxzdHJpbmcsIHN0cmluZz59IFJldHVybnMgdGhlIGRlY29kZWQgb2JqZWN0XG4gKi9cbnZhciBkZWNvZGUgPSBmdW5jdGlvbiAoc3RyaW5nKSB7XG4gICAgdmFyIG9iamVjdCA9IHt9O1xuICAgIHZhciBjYWNoZSA9IHt9O1xuICAgIHZhciBrZXlWYWx1ZUFycmF5O1xuICAgIHZhciBpbmRleDtcbiAgICB2YXIgbGVuZ3RoO1xuICAgIHZhciBrZXlWYWx1ZTtcbiAgICB2YXIga2V5O1xuICAgIHZhciB2YWx1ZTtcblxuICAgIC8vIGRvIG5vdCBkZWNvZGUgZW1wdHkgc3RyaW5nIG9yIHNvbWV0aGluZyB0aGF0IGlzIG5vdCBzdHJpbmdcbiAgICBpZiAoc3RyaW5nICYmIHR5cGVvZiBzdHJpbmcgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGtleVZhbHVlQXJyYXkgPSBzdHJpbmcuc3BsaXQoJyYnKTtcbiAgICAgICAgaW5kZXggPSAwO1xuICAgICAgICBsZW5ndGggPSBrZXlWYWx1ZUFycmF5Lmxlbmd0aDtcblxuICAgICAgICB3aGlsZSAoaW5kZXggPCBsZW5ndGgpIHtcbiAgICAgICAgICAgIGtleVZhbHVlID0ga2V5VmFsdWVBcnJheVtpbmRleF0uc3BsaXQoJz0nKTtcbiAgICAgICAgICAgIGtleSA9IGRlY29kZVVSSUNvbXBvbmVudChrZXlWYWx1ZVswXSk7XG4gICAgICAgICAgICB2YWx1ZSA9IGtleVZhbHVlWzFdO1xuXG4gICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIHZhbHVlID0gZGVjb2RlVVJJQ29tcG9uZW50KHZhbHVlKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFsdWUgPSBudWxsO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBkZWNvZGVLZXkob2JqZWN0LCBjYWNoZSwga2V5LCB2YWx1ZSk7XG5cbiAgICAgICAgICAgIGluZGV4ICs9IDE7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gb2JqZWN0O1xufTtcblxuLyoqXG4gKiBEZWNvZGUgdGhlIHNwZWNlZmllZCBrZXlcbiAqXG4gKiBAcGFyYW0ge09iamVjdC48c3RyaW5nLCBzdHJpbmc+fSBvYmplY3QgVGhlIG9iamVjdCB0byBob2xkIHRoZSBkZWNvZGVkIGRhdGFcbiAqIEBwYXJhbSB7T2JqZWN0LjxzdHJpbmcsICo+fSBjYWNoZSBUaGUgb2JqZWN0IHRvIGhvbGQgY2FjaGUgZGF0YVxuICogQHBhcmFtIHtzdHJpbmd9IGtleSBUaGUga2V5IG5hbWUgdG8gZGVjb2RlXG4gKiBAcGFyYW0ge2FueX0gdmFsdWUgVGhlIHZhbHVlIHRvIGRlY29kZVxuICovXG52YXIgZGVjb2RlS2V5ID0gZnVuY3Rpb24gKG9iamVjdCwgY2FjaGUsIGtleSwgdmFsdWUpIHtcbiAgICB2YXIgckJyYWNrZXQgPSAvXFxbKFteXFxbXSo/KT9cXF0kLztcbiAgICB2YXIgckluZGV4ID0gLyheMCQpfCheWzEtOV1cXGQqJCkvO1xuICAgIHZhciBpbmRleE9yS2V5T3JFbXB0eTtcbiAgICB2YXIgcGFyZW50S2V5O1xuICAgIHZhciBhcnJheU9yT2JqZWN0O1xuICAgIHZhciBrZXlJc0luZGV4O1xuICAgIHZhciBrZXlJc0VtcHR5O1xuICAgIHZhciB2YWx1ZUlzSW5BcnJheTtcbiAgICB2YXIgZGF0YUFycmF5O1xuICAgIHZhciBsZW5ndGg7XG5cbiAgICAvLyBjaGVjayB3aGV0aGVyIGtleSBpcyBzb21ldGhpbmcgbGlrZSBgcGVyc29uW25hbWVdYCBvciBgY29sb3JzW11gIG9yXG4gICAgLy8gYGNvbG9yc1sxXWBcbiAgICBpZiAoIHJCcmFja2V0LnRlc3Qoa2V5KSApIHtcbiAgICAgICAgaW5kZXhPcktleU9yRW1wdHkgPSBSZWdFeHAuJDE7XG4gICAgICAgIHBhcmVudEtleSA9IGtleS5yZXBsYWNlKHJCcmFja2V0LCAnJyk7XG4gICAgICAgIGFycmF5T3JPYmplY3QgPSBjYWNoZVtwYXJlbnRLZXldO1xuXG4gICAgICAgIGtleUlzSW5kZXggPSBySW5kZXgudGVzdChpbmRleE9yS2V5T3JFbXB0eSk7XG4gICAgICAgIGtleUlzRW1wdHkgPSBpbmRleE9yS2V5T3JFbXB0eSA9PT0gJyc7XG4gICAgICAgIHZhbHVlSXNJbkFycmF5ID0ga2V5SXNJbmRleCB8fCBrZXlJc0VtcHR5O1xuXG4gICAgICAgIGlmIChhcnJheU9yT2JqZWN0KSB7XG4gICAgICAgICAgICAvLyBjb252ZXJ0IHRoZSBhcnJheSB0byBvYmplY3RcbiAgICAgICAgICAgIGlmICggKCEgdmFsdWVJc0luQXJyYXkpICYmIGlzQXJyYXkoYXJyYXlPck9iamVjdCkgKSB7XG4gICAgICAgICAgICAgICAgZGF0YUFycmF5ID0gYXJyYXlPck9iamVjdDtcbiAgICAgICAgICAgICAgICBsZW5ndGggPSBkYXRhQXJyYXkubGVuZ3RoO1xuICAgICAgICAgICAgICAgIGFycmF5T3JPYmplY3QgPSB7fTtcblxuICAgICAgICAgICAgICAgIHdoaWxlIChsZW5ndGgtLSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoYXJyYXlPck9iamVjdFtsZW5ndGhdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFycmF5T3JPYmplY3RbbGVuZ3RoXSA9IGRhdGFBcnJheVtsZW5ndGhdO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYXJyYXlPck9iamVjdCA9IHZhbHVlSXNJbkFycmF5ID8gW10gOiB7fTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICgga2V5SXNFbXB0eSAmJiBpc0FycmF5KGFycmF5T3JPYmplY3QpICkge1xuICAgICAgICAgICAgYXJyYXlPck9iamVjdC5wdXNoKHZhbHVlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGFycmF5T3JPYmplY3QgaXMgYXJyYXkgb3Igb2JqZWN0IGhlcmVcbiAgICAgICAgICAgIGFycmF5T3JPYmplY3RbaW5kZXhPcktleU9yRW1wdHldID0gdmFsdWU7XG4gICAgICAgIH1cblxuICAgICAgICBjYWNoZVtwYXJlbnRLZXldID0gYXJyYXlPck9iamVjdDtcblxuICAgICAgICBkZWNvZGVLZXkob2JqZWN0LCBjYWNoZSwgcGFyZW50S2V5LCBhcnJheU9yT2JqZWN0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBvYmplY3Rba2V5XSA9IHZhbHVlO1xuICAgIH1cbn07XG5cbmV4cG9ydHMuZGVjb2RlID0gZGVjb2RlO1xuIiwidmFyIHV0aWwgPSByZXF1aXJlKDQ1KTtcbnZhciBpc0FycmF5ID0gdXRpbC5pc0FycmF5O1xudmFyIGlzT2JqZWN0ID0gdXRpbC5pc09iamVjdDtcbnZhciBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuXG4vKipcbiAqIEVuY29kZSB0aGUgZ2l2ZW4gb2JqZWN0IHRvIFVSSSBDb21wb25lbnQgZW5jb2RlZCBxdWVyeSBzdHJpbmdcbiAqXG4gKiBAcGFyYW0ge09iamVjdC48c3RyaW5nLCAqPn0gb2JqZWN0IFRoZSBvYmplY3QgdG8gZW5jb2RlXG4gKiBAcGFyYW0ge2Jvb2xlYW59IFtrZWVwQXJyYXlJbmRleF0gV2hldGhlciB0byBrZWVwIGFycmF5IGluZGV4XG4gKiBAcmV0dXJucyB7c3RyaW5nfSBSZXR1cm5zIHRoZSBVUkkgQ29tcG9uZW50IGVuY29kZWQgcXVlcnkgc3RyaW5nXG4gKi9cbnZhciBlbmNvZGUgPSBmdW5jdGlvbiAob2JqZWN0LCBrZWVwQXJyYXlJbmRleCkge1xuICAgIHZhciBrZXk7XG4gICAgdmFyIGtleVZhbHVlQXJyYXkgPSBbXTtcblxuICAgIGtlZXBBcnJheUluZGV4ID0gISFrZWVwQXJyYXlJbmRleDtcblxuICAgIGlmICggaXNPYmplY3Qob2JqZWN0KSApIHtcbiAgICAgICAgZm9yICgga2V5IGluIG9iamVjdCApIHtcbiAgICAgICAgICAgIGlmICggaGFzT3duLmNhbGwob2JqZWN0LCBrZXkpICkge1xuICAgICAgICAgICAgICAgIGVuY29kZUtleShrZXksIG9iamVjdFtrZXldLCBrZXlWYWx1ZUFycmF5LCBrZWVwQXJyYXlJbmRleCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4ga2V5VmFsdWVBcnJheS5qb2luKCcmJyk7XG59O1xuXG5cbi8qKlxuICogRW5jb2RlIHRoZSBzcGVjZWlmZWQga2V5IGluIHRoZSBvYmplY3RcbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30ga2V5IFRoZSBrZXkgbmFtZVxuICogQHBhcmFtIHthbnl9IGRhdGEgVGhlIGRhdGEgb2YgdGhlIGtleVxuICogQHBhcmFtIHtzdHJpbmdbXX0ga2V5VmFsdWVBcnJheSBUaGUgYXJyYXkgdG8gc3RvcmUgdGhlIGtleSB2YWx1ZSBzdHJpbmdcbiAqIEBwYXJhbSB7Ym9vbGVhbn0ga2VlcEFycmF5SW5kZXggV2hldGhlciB0byBrZWVwIGFycmF5IGluZGV4XG4gKi9cbnZhciBlbmNvZGVLZXkgPSBmdW5jdGlvbiAoa2V5LCBkYXRhLCBrZXlWYWx1ZUFycmF5LCBrZWVwQXJyYXlJbmRleCkge1xuICAgIHZhciBwcm9wO1xuICAgIHZhciBpbmRleDtcbiAgICB2YXIgbGVuZ3RoO1xuICAgIHZhciB2YWx1ZTtcbiAgICB2YXIgc3ViS2V5O1xuXG4gICAgaWYgKCBpc09iamVjdChkYXRhKSApIHtcbiAgICAgICAgZm9yICggcHJvcCBpbiBkYXRhICkge1xuICAgICAgICAgICAgaWYgKCBoYXNPd24uY2FsbChkYXRhLCBwcm9wKSApIHtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IGRhdGFbcHJvcF07XG4gICAgICAgICAgICAgICAgc3ViS2V5ID0ga2V5ICsgJ1snICsgcHJvcCArICddJztcbiAgICAgICAgICAgICAgICBlbmNvZGVLZXkoc3ViS2V5LCB2YWx1ZSwga2V5VmFsdWVBcnJheSwga2VlcEFycmF5SW5kZXgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSBlbHNlIGlmICggaXNBcnJheShkYXRhKSApIHtcbiAgICAgICAgaW5kZXggPSAwO1xuICAgICAgICBsZW5ndGggPSBkYXRhLmxlbmd0aDtcblxuICAgICAgICB3aGlsZSAoaW5kZXggPCBsZW5ndGgpIHtcbiAgICAgICAgICAgIHZhbHVlID0gZGF0YVtpbmRleF07XG5cbiAgICAgICAgICAgIGlmICgga2VlcEFycmF5SW5kZXggfHwgaXNBcnJheSh2YWx1ZSkgfHwgaXNPYmplY3QodmFsdWUpICkge1xuICAgICAgICAgICAgICAgIHN1YktleSA9IGtleSArICdbJyArIGluZGV4ICsgJ10nO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzdWJLZXkgPSBrZXkgKyAnW10nO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBlbmNvZGVLZXkoc3ViS2V5LCB2YWx1ZSwga2V5VmFsdWVBcnJheSwga2VlcEFycmF5SW5kZXgpO1xuXG4gICAgICAgICAgICBpbmRleCArPSAxO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAga2V5ID0gZW5jb2RlVVJJQ29tcG9uZW50KGtleSk7XG4gICAgICAgIC8vIGlmIGRhdGEgaXMgbnVsbCwgbm8gYD1gIGlzIGFwcGVuZGVkXG4gICAgICAgIGlmIChkYXRhID09PSBudWxsKSB7XG4gICAgICAgICAgICB2YWx1ZSA9IGtleTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGlmIGRhdGEgaXMgdW5kZWZpbmVkLCB0cmVhdCBpdCBhcyBlbXB0eSBzdHJpbmdcbiAgICAgICAgICAgIGlmIChkYXRhID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBkYXRhID0gJyc7XG4gICAgICAgICAgICAvLyBtYWtlIHN1cmUgdGhhdCBkYXRhIGlzIHN0cmluZ1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgZGF0YSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICBkYXRhID0gJycgKyBkYXRhO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFsdWUgPSBrZXkgKyAnPScgKyBlbmNvZGVVUklDb21wb25lbnQoZGF0YSk7XG4gICAgICAgIH1cblxuICAgICAgICBrZXlWYWx1ZUFycmF5LnB1c2godmFsdWUpO1xuICAgIH1cbn07XG5cbmV4cG9ydHMuZW5jb2RlID0gZW5jb2RlO1xuIiwidmFyIGVuY29kZSA9IHJlcXVpcmUoNDMpLmVuY29kZTtcbnZhciBkZWNvZGUgPSByZXF1aXJlKDQyKS5kZWNvZGU7XG5cbmV4cG9ydHMuZW5jb2RlID0gZW5jb2RlO1xuZXhwb3J0cy5kZWNvZGUgPSBkZWNvZGU7XG5leHBvcnRzLnZlcnNpb24gPSAnMS4xLjInO1xuIiwidmFyIHRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcblxuLyoqXG4gKiBDaGVjayB3aGV0aGVyIHRoZSB2YXJpYWJsZSBpcyBhbiBhcnJheVxuICpcbiAqIEBwYXJhbSB7YW55fSBpdCBUaGUgdmFyaWFibGUgdG8gY2hlY2tcbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBpdCBpcyBhbiBhcnJheVxuICovXG52YXIgaXNBcnJheSA9IGZ1bmN0aW9uIChpdCkge1xuICAgIHJldHVybiAnW29iamVjdCBBcnJheV0nID09PSB0b1N0cmluZy5jYWxsKGl0KTtcbn07XG5cbi8qKlxuICogQ2hlY2sgd2hldGhlciB0aGUgdmFyaWFibGUgaXMgYW4gb2JqZWN0XG4gKlxuICogQHBhcmFtIHthbnl9IGl0IFRoZSB2YXJpYWJsZSB0byBjaGVja1xuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGl0IGlzIGFuIG9iamVjdFxuICovXG52YXIgaXNPYmplY3QgPSBmdW5jdGlvbiAoaXQpIHtcbiAgICByZXR1cm4gJ1tvYmplY3QgT2JqZWN0XScgPT09IHRvU3RyaW5nLmNhbGwoaXQpO1xufTtcblxuZXhwb3J0cy5pc0FycmF5ID0gaXNBcnJheTtcbmV4cG9ydHMuaXNPYmplY3QgPSBpc09iamVjdDtcbiJdfQ==
