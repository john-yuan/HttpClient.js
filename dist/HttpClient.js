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
var template = require(33);
var uuid = require(34);
var noop = require(32);
var inherits = require(31);
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
var version = require(35);

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

},{"1":1,"10":10,"11":11,"25":25,"26":26,"27":27,"28":28,"3":3,"31":31,"32":32,"33":33,"34":34,"35":35,"36":36,"38":38,"39":39,"4":4,"40":40,"43":43,"5":5,"6":6,"7":7,"8":8,"9":9}],3:[function(require,module,exports){
var Requeset = require(9);
var constants = require(25);
var inherits = require(31);
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

},{"12":12,"14":14,"15":15,"16":16,"17":17,"23":23,"24":24,"25":25,"30":30,"31":31,"9":9}],4:[function(require,module,exports){
/**
 * HttpResponse module.
 *
 * @module class/HttpResponse
 */

var Response = require(10);
var inherits = require(31);
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

},{"10":10,"22":22,"31":31}],5:[function(require,module,exports){
var ResponseError = require(11);
var inherits = require(31);
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

},{"11":11,"22":22,"31":31}],6:[function(require,module,exports){
var Requeset = require(9);
var constants = require(25);
var inherits = require(31);
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

},{"18":18,"19":19,"20":20,"21":21,"24":24,"25":25,"30":30,"31":31,"9":9}],7:[function(require,module,exports){
/**
 * JSONPResponse module.
 *
 * @module class/JSONPResponse
 */

var Response = require(10);
var inherits = require(31);
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

},{"10":10,"22":22,"31":31}],8:[function(require,module,exports){
var ResponseError = require(11);
var inherits = require(31);
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

},{"11":11,"22":22,"31":31}],9:[function(require,module,exports){
var uuid = require(34);

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

},{"34":34}],10:[function(require,module,exports){
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
var noop = require(32);
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

},{"13":13,"25":25,"29":29,"32":32,"38":38,"4":4}],13:[function(require,module,exports){
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

},{"39":39,"40":40}],16:[function(require,module,exports){
var merge = require(40);
var isFunction = require(38);
var isPlainObject = require(39);
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

},{"38":38,"39":39,"40":40}],17:[function(require,module,exports){
var isPlainObject = require(39);
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

},{"39":39}],18:[function(require,module,exports){
var isFunction = require(38);
var JSONPResponse = require(7);
var fireCallbacks = require(29);
var noop = require(32);
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

},{"25":25,"29":29,"32":32,"38":38,"7":7}],19:[function(require,module,exports){
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

},{"38":38,"39":39}],23:[function(require,module,exports){
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
        array = url.split('#'); // There may be hash string in the url.
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
    return new CancelController;
};

module.exports = createCancelController;

},{"1":1}],27:[function(require,module,exports){
var QS = require(43);
var constants = require(25);
var template = require(33);
var uuid = require(34);
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

},{"25":25,"33":33,"34":34,"43":43}],28:[function(require,module,exports){
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

},{}],32:[function(require,module,exports){
/**
 * The no operation function.
 */
function noop() {
    // nothing to do here.
}

module.exports = noop;

},{}],33:[function(require,module,exports){
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

},{}],34:[function(require,module,exports){
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

},{}],35:[function(require,module,exports){
module.exports = '0.0.1-alpha.2';

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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9fYnJvd3Nlci1wYWNrQDYuMS4wQGJyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsImxpYi9jbGFzcy9DYW5jZWxDb250cm9sbGVyLmpzIiwibGliL2NsYXNzL0h0dHBDbGllbnQuanMiLCJsaWIvY2xhc3MvSHR0cFJlcXVlc3QuanMiLCJsaWIvY2xhc3MvSHR0cFJlc3BvbnNlLmpzIiwibGliL2NsYXNzL0h0dHBSZXNwb25zZUVycm9yLmpzIiwibGliL2NsYXNzL0pTT05QUmVxdWVzdC5qcyIsImxpYi9jbGFzcy9KU09OUFJlc3BvbnNlLmpzIiwibGliL2NsYXNzL0pTT05QUmVzcG9uc2VFcnJvci5qcyIsImxpYi9jbGFzcy9SZXF1ZXN0LmpzIiwibGliL2NsYXNzL1Jlc3BvbnNlLmpzIiwibGliL2NsYXNzL1Jlc3BvbnNlRXJyb3IuanMiLCJsaWIvaHR0cC9hZGRFdmVudExpc3RlbmVycy5qcyIsImxpYi9odHRwL2FkZFRpbWVvdXRMaXN0ZW5lci5qcyIsImxpYi9odHRwL2NhbGxYaHJIb29rLmpzIiwibGliL2h0dHAvaGFuZGxlSGVhZGVycy5qcyIsImxpYi9odHRwL2hhbmRsZVJlcXVlc3RCb2R5LmpzIiwibGliL2h0dHAvaGFuZGxlWGhyUHJvcHMuanMiLCJsaWIvanNvbnAvYWRkRXZlbnRMaXN0ZW5lcnMuanMiLCJsaWIvanNvbnAvYnVpbGRDYWxsYmFja05hbWUuanMiLCJsaWIvanNvbnAvYnVpbGRTY3JpcHRTcmMuanMiLCJsaWIvanNvbnAvaGFuZGxlU2NyaXB0Q29ycy5qcyIsImxpYi9zaGFyZWQvYWRkQ3VzdG9tUGFyc2VyLmpzIiwibGliL3NoYXJlZC9idWlsZFVSTC5qcyIsImxpYi9zaGFyZWQvY2FsbFJlcXVlc3RDcmVhdGVkQ2FsbGJhY2suanMiLCJsaWIvc2hhcmVkL2NvbnN0YW50cy5qcyIsImxpYi9zaGFyZWQvY3JlYXRlQ2FuY2VsQ29udHJvbGxlci5qcyIsImxpYi9zaGFyZWQvY3JlYXRlRGVmYXVsdE9wdGlvbnMuanMiLCJsaWIvc2hhcmVkL2RlZmluZUV4cG9ydHMuanMiLCJsaWIvc2hhcmVkL2ZpcmVDYWxsYmFja3MuanMiLCJsaWIvc2hhcmVkL2hhbmRsZU9wdGlvbnMuanMiLCJsaWIvc2hhcmVkL2luaGVyaXRzLmpzIiwibGliL3NoYXJlZC9ub29wLmpzIiwibGliL3NoYXJlZC90ZW1wbGF0ZS5qcyIsImxpYi9zaGFyZWQvdXVpZC5qcyIsImxpYi92ZXJzaW9uLmpzIiwibm9kZV9tb2R1bGVzL194LWNvbW1vbi11dGlsc0AxLjQuMEB4LWNvbW1vbi11dGlscy9pc0Fic29sdXRlVVJMLmpzIiwibm9kZV9tb2R1bGVzL194LWNvbW1vbi11dGlsc0AxLjQuMEB4LWNvbW1vbi11dGlscy9pc0FycmF5LmpzIiwibm9kZV9tb2R1bGVzL194LWNvbW1vbi11dGlsc0AxLjQuMEB4LWNvbW1vbi11dGlscy9pc0Z1bmN0aW9uLmpzIiwibm9kZV9tb2R1bGVzL194LWNvbW1vbi11dGlsc0AxLjQuMEB4LWNvbW1vbi11dGlscy9pc1BsYWluT2JqZWN0LmpzIiwibm9kZV9tb2R1bGVzL194LWNvbW1vbi11dGlsc0AxLjQuMEB4LWNvbW1vbi11dGlscy9tZXJnZS5qcyIsIm5vZGVfbW9kdWxlcy9feC1xdWVyeS1zdHJpbmdAMS4xLjJAeC1xdWVyeS1zdHJpbmcvbGliL2RlY29kZS5qcyIsIm5vZGVfbW9kdWxlcy9feC1xdWVyeS1zdHJpbmdAMS4xLjJAeC1xdWVyeS1zdHJpbmcvbGliL2VuY29kZS5qcyIsIm5vZGVfbW9kdWxlcy9feC1xdWVyeS1zdHJpbmdAMS4xLjJAeC1xdWVyeS1zdHJpbmcvbGliL3F1ZXJ5c3RyaW5nLmpzIiwibm9kZV9tb2R1bGVzL194LXF1ZXJ5LXN0cmluZ0AxLjEuMkB4LXF1ZXJ5LXN0cmluZy9saWIvdXRpbC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNWdCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3REQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcklBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDYkE7QUFDQTs7QUNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNiQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0dBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwidmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKDM4KTtcblxuLyoqXG4gKiBDYW5jZWwgY29udHJvbGxlciBpcyB1c2VkIHRvIGNhbmNlbCBhY3Rpb25zLiBPbmUgY29udHJvbGxlciBjYW4gYmluZCBhbnkgbnVtYmVyIG9mIGFjdGlvbnMuXG4gKlxuICogQGNsYXNzXG4gKi9cbmZ1bmN0aW9uIENhbmNlbENvbnRyb2xsZXIoKSB7XG4gICAgLyoqXG4gICAgICogQHR5cGUge2Jvb2xlYW59IFdoZXRoZXIgdGhlIGNvbnRyb2xsZXIgaXMgY2FuY2VsbGVkLlxuICAgICAqL1xuICAgIHRoaXMuY2FuY2VsbGVkID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7RnVuY3Rpb25bXX0gVGhlIGNhbGxiYWNrcyB0byBjYWxsIG9uIGNhbmNlbC5cbiAgICAgKi9cbiAgICB0aGlzLmNhbGxiYWNrcyA9IFtdO1xufVxuXG4vKipcbiAqIENhbmNlbCB0aGUgYWN0aW9ucyB0aGF0IGJpbmQgd2l0aCB0aGlzIGNhbmNlbCBjb250cm9sbGVyLlxuICovXG5DYW5jZWxDb250cm9sbGVyLnByb3RvdHlwZS5jYW5jZWwgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGNhbGxiYWNrcyA9IHRoaXMuY2FsbGJhY2tzO1xuICAgIHZhciBpID0gMDtcbiAgICB2YXIgbCA9IGNhbGxiYWNrcy5sZW5ndGg7XG5cbiAgICBpZiAodGhpcy5jYW5jZWxsZWQgPT09IGZhbHNlKSB7XG4gICAgICAgIHRoaXMuY2FuY2VsbGVkID0gdHJ1ZTtcblxuICAgICAgICBmb3IgKCA7IGkgPCBsOyBpICs9IDEpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2tzW2ldKCk7XG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgLy8gVGhyb3cgdGhlIGVycm9yIGxhdGVyIGZvciBkZWJ1Z2luZy5cbiAgICAgICAgICAgICAgICAoZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KShlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn07XG5cbi8qKlxuICogQ2hlY2sgd2hldGhlciB0aGUgY29udHJvbGxlciBpcyBjYW5jZWxsZWQuXG4gKlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSBjb250cm9sbGVyIGlzIGNhbmNlbGxlZCwgb3RoZXJ3aXNlIGBmYWxzZWAgaXMgcmV0dXJuZWQuXG4gKi9cbkNhbmNlbENvbnRyb2xsZXIucHJvdG90eXBlLmlzQ2FuY2VsbGVkID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLmNhbmNlbGxlZDtcbn07XG5cbi8qKlxuICogUmVnaXN0ZXIgYSBjYWxsYmFjaywgd2hpY2ggd2lsbCBiZSBjYWxsZWQgd2hlbiB0aGUgYGNhbmNlbCgpYCBtZXRob2QgaXMgY2FsbGVkLlxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIFRoZSBjYWxsYmFjayBmdW5jdGlvbiB0byBjYWxsIG9uIGNhbmNlbC5cbiAqL1xuQ2FuY2VsQ29udHJvbGxlci5wcm90b3R5cGUucmVnaXN0ZXJDYW5jZWxDYWxsYmFjayA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgIGlmIChpc0Z1bmN0aW9uKGNhbGxiYWNrKSkge1xuICAgICAgICB0aGlzLmNhbGxiYWNrcy5wdXNoKGNhbGxiYWNrKTtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IENhbmNlbENvbnRyb2xsZXI7XG4iLCJ2YXIgbWVyZ2UgPSByZXF1aXJlKDQwKTtcbnZhciBpc0Z1bmN0aW9uID0gcmVxdWlyZSgzOCk7XG52YXIgaXNQbGFpbk9iamVjdCA9IHJlcXVpcmUoMzkpO1xudmFyIFFTID0gcmVxdWlyZSg0Myk7XG52YXIgaXNBYnNvbHV0ZVVSTCA9IHJlcXVpcmUoMzYpO1xudmFyIGRlZmluZUV4cG9ydHMgPSByZXF1aXJlKDI4KTtcbnZhciBjb25zdGFudHMgPSByZXF1aXJlKDI1KTtcbnZhciB0ZW1wbGF0ZSA9IHJlcXVpcmUoMzMpO1xudmFyIHV1aWQgPSByZXF1aXJlKDM0KTtcbnZhciBub29wID0gcmVxdWlyZSgzMik7XG52YXIgaW5oZXJpdHMgPSByZXF1aXJlKDMxKTtcbnZhciBjcmVhdGVEZWZhdWx0T3B0aW9ucyA9IHJlcXVpcmUoMjcpO1xudmFyIGNyZWF0ZUNhbmNlbENvbnRyb2xsZXIgPSByZXF1aXJlKDI2KTtcbnZhciBDYW5jZWxDb250cm9sbGVyID0gcmVxdWlyZSgxKTtcbnZhciBIdHRwUmVxdWVzdCA9IHJlcXVpcmUoMyk7XG52YXIgSHR0cFJlc3BvbnNlID0gcmVxdWlyZSg0KTtcbnZhciBIdHRwUmVzcG9uc2VFcnJvciA9IHJlcXVpcmUoNSk7XG52YXIgSlNPTlBSZXF1ZXN0ID0gcmVxdWlyZSg2KTtcbnZhciBKU09OUFJlc3BvbnNlID0gcmVxdWlyZSg3KTtcbnZhciBKU09OUFJlc3BvbnNlRXJyb3IgPSByZXF1aXJlKDgpO1xudmFyIFJlcXVlc3QgPSByZXF1aXJlKDkpO1xudmFyIFJlc3BvbnNlID0gcmVxdWlyZSgxMCk7XG52YXIgUmVzcG9uc2VFcnJvciA9IHJlcXVpcmUoMTEpO1xudmFyIHZlcnNpb24gPSByZXF1aXJlKDM1KTtcblxuLyoqXG4gKiBAY2xhc3NcbiAqXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBbZGVmYXVsdHNdIFRoZSBkZWZhdWx0IG9wdGlvbnMgdG8gdXNlIHdoZW4gc2VuZGluZyByZXF1ZXN0cyB3aXRoIHRoZSBjcmVhdGVkIGh0dHAgY2xpZW50LlxuICogVGhpcyBkZWZhdWx0IG9wdGlvbnMgd2lsbCBiZSBtZXJnZWQgaW50byB0aGUgaW50ZXJuYWwgZGVmYXVsdCBvcHRpb25zIHRoYXQgYGNyZWF0ZURlZmF1bHRPcHRpb25zKClgIHJldHVybnMuXG4gKlxuICogQHBhcmFtIHtIYW5kbGVPcHRpb25zRnVuY3Rpb259IFtoYW5kbGVEZWZhdWx0c10gVGhlIGhhbmRsZXIgZnVuY3Rpb24gdG8gcHJvY2VzcyB0aGUgbWVyZ2VkIGRlZmF1bHQgb3B0aW9ucy4gVGhlXG4gKiBtZXJnZWQgZGVmYXVsdCBvcHRpb25zIHdpbGwgYmUgcGFzc2VkIGludG8gdGhlIGZ1bmN0aW9uIGFzIHRoZSBmaXJzdCBhcmd1bWVudC4gWW91IGNhbiBtYWtlIGNoYW5nZXMgdG8gaXQgYXMgeW91XG4gKiB3YW50LiBUaGlzIGZ1bmN0aW9uIG11c3QgcmV0dXJuIHN5bmNocm9ub3VzbHkuIFRoZSByZXR1cm4gdmFsdWUgb2YgdGhpcyBmdW5jdGlvbiBpcyBpZ25vcmVkLlxuICpcbiAqIEBwYXJhbSB7SGFuZGxlT3B0aW9uc0Z1bmN0aW9ufSBbaGFuZGxlUmVxdWVzdE9wdGlvbnNdIFRoZSBoYW5kbGVyIGZ1bmN0aW9uIHRvIHByb2Nlc3MgZWFjaCBtZXJnZWQgcmVxdWVzdCBvcHRpb25zLlxuICogRXZlcnkgb3B0aW9ucyB0aGF0IHBhc3NlZCBpbnRvIGBzZW5kYCwgYGZldGNoYCwgYGdldEpTT05QYCwgYGZldGNoSlNPTlBgIHdpbGwgYmUgcHJvY2Vzc2VkIGJ5IHRoaXMgaGFuZGxlciBmdW5jdGlvbi5cbiAqL1xuZnVuY3Rpb24gSHR0cENsaWVudChkZWZhdWx0cywgaGFuZGxlRGVmYXVsdHMsIGhhbmRsZVJlcXVlc3RPcHRpb25zKSB7XG4gICAgdmFyIGRlZmF1bHRPcHRpb25zID0gY3JlYXRlRGVmYXVsdE9wdGlvbnMoKTtcblxuICAgIGlmIChpc1BsYWluT2JqZWN0KGRlZmF1bHRzKSkge1xuICAgICAgICBtZXJnZShkZWZhdWx0T3B0aW9ucywgZGVmYXVsdHMpO1xuICAgIH1cblxuICAgIGlmIChpc0Z1bmN0aW9uKGhhbmRsZURlZmF1bHRzKSkge1xuICAgICAgICBoYW5kbGVEZWZhdWx0cyhkZWZhdWx0T3B0aW9ucyk7XG4gICAgICAgIC8vIERlZXAgY29weSB0aGUgY2hhZ25lZCBvcHRpb25zXG4gICAgICAgIGRlZmF1bHRPcHRpb25zID0gbWVyZ2Uoe30sIGRlZmF1bHRPcHRpb25zKTtcbiAgICB9XG5cbiAgICBpZiAoIWlzRnVuY3Rpb24oaGFuZGxlUmVxdWVzdE9wdGlvbnMpKSB7XG4gICAgICAgIGhhbmRsZVJlcXVlc3RPcHRpb25zID0gbm9vcDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgYSBjb3B5IG9mIHRoZSBkZWZhdWx0IHJlcXVlc3Qgb3B0aW9ucy4gVGhpcyBmdW5jdGlvbiBpcyBOT1QgYXZhaWxhYmxlIG9uIHRoZSBwcm90b3R5cGUgb2YgYEh0dHBDbGllbnRgLlxuICAgICAqXG4gICAgICogQHJldHVybnMge1JlcXVlc3RPcHRpb25zfVxuICAgICAqL1xuICAgIHRoaXMuY29weU9wdGlvbnMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBtZXJnZSh7fSwgZGVmYXVsdE9wdGlvbnMpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBNZXJnZSB0aGUgcmVxdWVzdCBvcHRpb25zIHdpdGggdGhlIGRlZmF1bHQgcmVxdWVzdCBvcHRpb25zLiBUaGlzIGZ1bmN0aW9uIGlzIE5PVCBhdmFpbGFibGUgb24gdGhlIHByb3RvdHlwZSBvZlxuICAgICAqIGBIdHRwQ2xpZW50YCBhbmQgd2lsbCBjYWxsIGBoYW5kbGVSZXF1ZXN0T3B0aW9uc2AgdG8gaGFuZGxlIHRoZSBtZXJnZWQgcmVxdWVzdCBvcHRpb25zLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zIHRvIG1lcmdlLlxuICAgICAqIEByZXR1cm5zIHtSZXF1ZXN0T3B0aW9uc30gUmV0dXJucyB0aGUgbWVyZ2VkIHJlcXVlc3Qgb3B0aW9ucy5cbiAgICAgKi9cbiAgICB0aGlzLm1lcmdlT3B0aW9ucyA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIHZhciByZXF1ZXN0T3B0aW9ucyA9IG1lcmdlKHt9LCBkZWZhdWx0T3B0aW9ucywgb3B0aW9ucyk7XG5cbiAgICAgICAgaGFuZGxlUmVxdWVzdE9wdGlvbnMocmVxdWVzdE9wdGlvbnMpO1xuXG4gICAgICAgIHJldHVybiByZXF1ZXN0T3B0aW9ucztcbiAgICB9O1xufVxuXG4vKipcbiAqIFNlbmQgYW4gaHR0cCByZXF1ZXN0LlxuICpcbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucyB0byB1c2UsIHdoaWNoIHdpbGwgYmUgbWVyZ2VkIGludG8gYSBjb3B5IG9mIHRoZSBkZWZhdWx0IG9wdGlvbnMuXG4gKiBAcGFyYW0ge1JlcXVlc3RTdWNjZXNzQ2FsbGJhY2t9IG9uc3VjY2VzcyBUaGUgY2FsbGJhY2sgdG8gY2FsbCBvbiBzdWNjZXNzLlxuICogQHBhcmFtIHtSZXF1ZXN0RXJyb3JDYWxsYmFja30gb25lcnJvciBUaGUgY2FsbGJhY2sgdG8gY2FsbCBvbiBlcnJvci5cbiAqIEByZXR1cm5zIHtIdHRwUmVxdWVzdH0gUmV0dXJucyBhbiBpbnN0YW5jZSBvZiBgSHR0cFJlcXVlc3RgLlxuICovXG5IdHRwQ2xpZW50LnByb3RvdHlwZS5zZW5kID0gZnVuY3Rpb24gKG9wdGlvbnMsIG9uc3VjY2Vzcywgb25lcnJvcikge1xuICAgIHZhciByZXF1ZXN0T3B0aW9ucyA9IHRoaXMubWVyZ2VPcHRpb25zKG9wdGlvbnMpO1xuXG4gICAgcmVxdWVzdE9wdGlvbnMucmVxdWVzdEZ1bmN0aW9uTmFtZSA9ICdzZW5kJztcbiAgICByZXF1ZXN0T3B0aW9ucy5jb250cm9sbGVyID0gbnVsbDtcblxuICAgIHJldHVybiBuZXcgSHR0cFJlcXVlc3QocmVxdWVzdE9wdGlvbnMsIG9uc3VjY2Vzcywgb25lcnJvcik7XG59O1xuXG4vKipcbiAqIFNlbmQgYW4gaHR0cCByZXF1ZXN0IGFuZCByZXR1cm4gYSBwcm9taXNlLlxuICpcbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucyB0byB1c2UsIHdoaWNoIHdpbGwgYmUgbWVyZ2VkIGludG8gYSBjb3B5IG9mIHRoZSBkZWZhdWx0IG9wdGlvbnMuXG4gKiBAcmV0dXJucyB7UHJvbWlzZX0gUmV0dXJucyBhbiBpbnN0YW5jZSBvZiBgUHJvbWlzZWAuXG4gKi9cbkh0dHBDbGllbnQucHJvdG90eXBlLmZldGNoID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICB2YXIgcmVxdWVzdE9wdGlvbnMgPSB0aGlzLm1lcmdlT3B0aW9ucyhvcHRpb25zKTtcbiAgICB2YXIgY29udHJvbGxlciA9IHJlcXVlc3RPcHRpb25zLmNvbnRyb2xsZXI7XG5cbiAgICByZXF1ZXN0T3B0aW9ucy5yZXF1ZXN0RnVuY3Rpb25OYW1lID0gJ2ZldGNoJztcblxuICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgIHZhciByZXF1ZXN0ID0gbmV3IEh0dHBSZXF1ZXN0KHJlcXVlc3RPcHRpb25zLCBmdW5jdGlvbiAocmVzcG9uc2UpIHtcbiAgICAgICAgICAgIGlmIChjb250cm9sbGVyKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFjb250cm9sbGVyLmlzQ2FuY2VsbGVkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShyZXNwb25zZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHJlc3BvbnNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgcmVqZWN0KTtcblxuICAgICAgICBpZiAoY29udHJvbGxlcikge1xuICAgICAgICAgICAgLy8gVHJpZ2dlciB0aGUgYEVSUl9DQU5DRUxMRURgIGVycm9yLlxuICAgICAgICAgICAgaWYgKGNvbnRyb2xsZXIuaXNDYW5jZWxsZWQoKSkge1xuICAgICAgICAgICAgICAgIHJlcXVlc3QuY2FuY2VsKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnRyb2xsZXIucmVnaXN0ZXJDYW5jZWxDYWxsYmFjayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlcXVlc3QuY2FuY2VsKCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbn07XG5cbi8qKlxuICogU2VuZCBhIGpzb25wIHJlcXVlc3QuXG4gKlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zIHRvIHVzZSwgd2hpY2ggd2lsbCBiZSBtZXJnZWQgaW50byBhIGNvcHkgb2YgdGhlIGRlZmF1bHQgb3B0aW9ucy5cbiAqIEBwYXJhbSB7UmVxdWVzdFN1Y2Nlc3NDYWxsYmFja30gb25zdWNjZXNzIFRoZSBjYWxsYmFjayB0byBjYWxsIG9uIHN1Y2Nlc3MuXG4gKiBAcGFyYW0ge1JlcXVlc3RFcnJvckNhbGxiYWNrfSBvbmVycm9yIFRoZSBjYWxsYmFjayB0byBjYWxsIG9uIGVycm9yLlxuICogQHJldHVybnMge0pTT05QUmVxdWVzdH0gUmV0dXJucyBhbiBpbnN0YW5jZSBvZiBgSlNPTlBSZXF1ZXN0YC5cbiAqL1xuSHR0cENsaWVudC5wcm90b3R5cGUuZ2V0SlNPTlAgPSBmdW5jdGlvbiAob3B0aW9ucywgb25zdWNjZXNzLCBvbmVycm9yKSB7XG4gICAgdmFyIHJlcXVlc3RPcHRpb25zID0gdGhpcy5tZXJnZU9wdGlvbnMob3B0aW9ucyk7XG5cbiAgICByZXF1ZXN0T3B0aW9ucy5yZXF1ZXN0RnVuY3Rpb25OYW1lID0gJ2dldEpTT05QJztcbiAgICByZXF1ZXN0T3B0aW9ucy5jb250cm9sbGVyID0gbnVsbDtcblxuICAgIHJldHVybiBuZXcgSlNPTlBSZXF1ZXN0KHJlcXVlc3RPcHRpb25zLCBvbnN1Y2Nlc3MsIG9uZXJyb3IpO1xufTtcblxuLyoqXG4gKiBTZW5kIGEganNvbnAgcmVxdWVzdCBhbmQgcmV0dXJuIGEgcHJvbWlzZS5cbiAqXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMgdG8gdXNlLCB3aGljaCB3aWxsIGJlIG1lcmdlZCBpbnRvIGEgY29weSBvZiB0aGUgZGVmYXVsdCBvcHRpb25zLlxuICogQHJldHVybnMge1Byb21pc2V9IFJldHVybnMgYW4gaW5zdGFuY2Ugb2YgYFByb21pc2VgLlxuICovXG5IdHRwQ2xpZW50LnByb3RvdHlwZS5mZXRjaEpTT05QID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICB2YXIgcmVxdWVzdE9wdGlvbnMgPSB0aGlzLm1lcmdlT3B0aW9ucyhvcHRpb25zKTtcbiAgICB2YXIgY29udHJvbGxlciA9IHJlcXVlc3RPcHRpb25zLmNvbnRyb2xsZXI7XG5cbiAgICByZXF1ZXN0T3B0aW9ucy5yZXF1ZXN0RnVuY3Rpb25OYW1lID0gJ2ZldGNoSlNPTlAnO1xuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgdmFyIHJlcXVlc3QgPSBuZXcgSlNPTlBSZXF1ZXN0KHJlcXVlc3RPcHRpb25zLCBmdW5jdGlvbiAocmVzcG9uc2UpIHtcbiAgICAgICAgICAgIGlmIChjb250cm9sbGVyKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFjb250cm9sbGVyLmlzQ2FuY2VsbGVkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShyZXNwb25zZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHJlc3BvbnNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgcmVqZWN0KTtcblxuICAgICAgICBpZiAoY29udHJvbGxlcikge1xuICAgICAgICAgICAgLy8gVHJpZ2dlciB0aGUgYEVSUl9DQU5DRUxMRURgIGVycm9yLlxuICAgICAgICAgICAgaWYgKGNvbnRyb2xsZXIuaXNDYW5jZWxsZWQoKSkge1xuICAgICAgICAgICAgICAgIHJlcXVlc3QuY2FuY2VsKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnRyb2xsZXIucmVnaXN0ZXJDYW5jZWxDYWxsYmFjayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlcXVlc3QuY2FuY2VsKCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbn07XG5cbi8qKlxuICogQ3JlYXRlIGEgbmV3IGluc3RhbmNlIG9mIGBDYW5jZWxDb250cm9sbGVyYC5cbiAqXG4gKiBAcmV0dXJucyB7Q2FuY2VsQ29udHJvbGxlcn0gUmV0dXJucyBhbiBuZXcgaW5zdGFuY2Ugb2YgYENhbmNlbENvbnRyb2xsZXJgLlxuICovXG5IdHRwQ2xpZW50LnByb3RvdHlwZS5jcmVhdGVDYW5jZWxDb250cm9sbGVyID0gY3JlYXRlQ2FuY2VsQ29udHJvbGxlcjtcblxuLyoqXG4gKiBDcmVhdGUgYSBuZXcgaW5zdGFuY2Ugb2YgYENhbmNlbENvbnRyb2xsZXJgLlxuICpcbiAqIEByZXR1cm5zIHtDYW5jZWxDb250cm9sbGVyfSBSZXR1cm5zIGFuIG5ldyBpbnN0YW5jZSBvZiBgQ2FuY2VsQ29udHJvbGxlcmAuXG4gKi9cbkh0dHBDbGllbnQuY3JlYXRlQ2FuY2VsQ29udHJvbGxlciA9IGNyZWF0ZUNhbmNlbENvbnRyb2xsZXI7XG5cbi8vIFRoZSB2ZXJzaW9uLlxuSHR0cENsaWVudC52ZXJzaW9uID0gdmVyc2lvbjtcbkh0dHBDbGllbnQucHJvdG90eXBlLnZlcnNpb24gPSB2ZXJzaW9uO1xuXG5kZWZpbmVFeHBvcnRzKEh0dHBDbGllbnQsICdjb25zdGFudHMnLCBtZXJnZSh7fSwgY29uc3RhbnRzKSk7XG5cbmRlZmluZUV4cG9ydHMoSHR0cENsaWVudCwgJ2xpYnMnLCB7XG4gICAgUVM6IFFTXG59KTtcblxuZGVmaW5lRXhwb3J0cyhIdHRwQ2xpZW50LCAnY2xhc3NlcycsIHtcbiAgICBDYW5jZWxDb250cm9sbGVyOiBDYW5jZWxDb250cm9sbGVyLFxuICAgIEh0dHBDbGllbnQ6IEh0dHBDbGllbnQsXG4gICAgSHR0cFJlcXVlc3Q6IEh0dHBSZXF1ZXN0LFxuICAgIEh0dHBSZXNwb25zZTogSHR0cFJlc3BvbnNlLFxuICAgIEh0dHBSZXNwb25zZUVycm9yOiBIdHRwUmVzcG9uc2VFcnJvcixcbiAgICBKU09OUFJlcXVlc3Q6IEpTT05QUmVxdWVzdCxcbiAgICBKU09OUFJlc3BvbnNlOiBKU09OUFJlc3BvbnNlLFxuICAgIEpTT05QUmVzcG9uc2VFcnJvcjogSlNPTlBSZXNwb25zZUVycm9yLFxuICAgIFJlcXVlc3Q6IFJlcXVlc3QsXG4gICAgUmVzcG9uc2U6IFJlc3BvbnNlLFxuICAgIFJlc3BvbnNlRXJyb3I6IFJlc3BvbnNlRXJyb3Jcbn0pO1xuXG5kZWZpbmVFeHBvcnRzKEh0dHBDbGllbnQsICdmdW5jdGlvbnMnLCB7XG4gICAgdGVtcGxhdGU6IHRlbXBsYXRlLFxuICAgIG1lcmdlOiBtZXJnZSxcbiAgICBpc0Fic29sdXRlVVJMOiBpc0Fic29sdXRlVVJMLFxuICAgIGlzRnVuY3Rpb246IGlzRnVuY3Rpb24sXG4gICAgaXNQbGFpbk9iamVjdDogaXNQbGFpbk9iamVjdCxcbiAgICB1dWlkOiB1dWlkLFxuICAgIG5vb3A6IG5vb3AsXG4gICAgaW5oZXJpdHM6IGluaGVyaXRzLFxuICAgIGNyZWF0ZURlZmF1bHRPcHRpb25zOiBjcmVhdGVEZWZhdWx0T3B0aW9uc1xufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gSHR0cENsaWVudDtcblxuLyoqXG4gKiBUaGlzIGNhbGxiYWNrIGlzIHVzZWQgdG8gaGFubGRlIHRoZSBtZXJnZWQgcmVxdWVzdCBvcHRpb25zLiBJdCBtdXN0IHJldHJ1biB0aGUgcmVzdWx0IHN5bmNocm9ub3VzbHkuXG4gKlxuICogQGNhbGxiYWNrIEhhbmRsZU9wdGlvbnNGdW5jdGlvblxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgbWVyZ2VkIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEByZXR1cm5zIHt2b2lkfVxuICovXG5cbi8qKlxuICogVGhlIGNhbGxiYWNrIHRvIGNhbGwgb24gc3VjY2Vzcy5cbiAqXG4gKiBAY2FsbGJhY2sgUmVxdWVzdFN1Y2Nlc3NDYWxsYmFja1xuICogQHBhcmFtIHtIdHRwUmVzcG9uc2V8YW55fSByZXNwb25zZSBUaGUgaHR0cCByZXNwb25zZSBvciB0aGUgcmV0dXJuIHZhbHVlIG9mIGBvcHRpb25zLnRyYW5zZm9ybVJlc3BvbnNlKHJlc3BvbnNlKWAuXG4gKi9cblxuLyoqXG4gKiBUaGUgY2FsbGJhY2sgdG8gY2FsbCBvbiBlcnJvci5cbiAqXG4gKiBAY2FsbGJhY2sgUmVxdWVzdEVycm9yQ2FsbGJhY2tcbiAqIEBwYXJhbSB7SHR0cFJlc3BvbnNlRXJyb3J8YW55fSBlcnJvciBUaGUgaHR0cCByZXNwb25zZSBlcnJvciBvciB0aGUgcmV0dXJuIHZhbHVlIG9mIGBvcHRpb25zLnRyYW5zZm9ybUVycm9yKGVycm9yKWAuXG4gKi9cblxuLyoqXG4gKiBUaGUgZGVmaW5pdG9uIG9mIHRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKlxuICogQHR5cGVkZWYge09iamVjdC48c3RyaW5nLCAqPn0gUmVxdWVzdE9wdGlvbnNcbiAqXG4gKiBAcHJvcGVydHkge3N0cmluZ30gW21ldGhvZF0gVGhlIGh0dHAgcmVxdWVzdCBtZXRob2QuIFRoZSBkZWZhdWx0IG1ldGhvZCBpcyBgR0VUYC5cbiAqXG4gKiBAcHJvcGVydHkge3N0cmluZ30gW2Jhc2VVUkxdIFRoZSByZXF1ZXN0IGJhc2UgdXJsLiBJZiB0aGUgYHVybGAgaXMgcmVsYXRpdmUgdXJsLCBhbmQgdGhlIGBiYXNlVVJMYCBpcyBub3QgYG51bGxgLCB0aGVcbiAqIGBiYXNlVVJMYCB3aWxsIGJlIHByZXBlbmQgdG8gdGhlIGB1cmxgLlxuICpcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSB1cmwgVGhlIHJlcXVlc3QgdXJsIHRoYXQgY2FuIGNvbnRhaW4gYW55IG51bWJlciBvZiBwbGFjZWhvbGRlcnMsIGFuZCB3aWxsIGJlIGNvbXBpbGVkIHdpdGggdGhlXG4gKiBkYXRhIHRoYXQgcGFzc2VkIGluIHdpdGggYG9wdGlvbnMucGFyYW1gLlxuICpcbiAqIEBwcm9wZXJ0eSB7T2JqZWN0LjxzdHJpbmcsICo+fSBbcGFyYW1dIFRoZSBkYXRhIHVzZWQgdG8gY29tcGlsZSB0aGUgcmVxdWVzdCB1cmwuXG4gKlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgKj59IFtxdWVyeV0gVGhlIGRhdGEgdGhhdCB3aWxsIGJlIGNvbXBpbGVkIHRvIHF1ZXJ5IHN0cmluZy5cbiAqXG4gKiBAcHJvcGVydHkge09iamVjdC48c3RyaW5nLCAqPn0gW2JvZHldIFRoZSBvYmplY3QgdGhhdCBjb250YWlucyB0aGUgY29udGVudCB3aGljaCB3aWxsIGJlIHNlbmQgdG8gdGhlIHNlcnZlci4gVGhpc1xuICogb2JqZWN0IGhhcyBvbmx5IG9uZSBwcm9wZXJ0eS4gVGhlIG5hbWUgb2YgdGhlIHByb3BlcnR5IGlzIHRoZSBjb250ZW50IHR5cGUgb2YgdGhlIGNvbnRlbnQsIHdoaWNoIHdpbGwgYmUgdXNlZCB0byBmaW5kXG4gKiBhIHByb2Nlc3NvciBpbiBgb3B0aW9ucy5odHRwUmVxdWVzdEJvZHlQcm9jZXNzb3JgLiBUaGUgcHJvY2Vzc29yIGlzIHVzZWQgdG8gcHJvY2VzcyB0aGUgdmFsdWUgb2YgdGhlIHByb3BlcnR5LiBUaGVcbiAqIHByb2Nlc3NlZCB2YWx1ZSB3aGljaCB0aGUgcHJvY2Vzc29yIHJldHVybnMgd2lsbCBiZSBzZW5kIHRvIHRoZSBzZXJ2ZXIgYXMgdGhlIHJlcXVlc3QgYm9keS5cbiAqXG4gKiBAcHJvcGVydHkge09iamVjdC48c3RyaW5nLCAqPn0gW2V4dHJhXSBUaGUgb2JqZWN0IHRvIGtlZXAgdGhlIGV4dHJhIGluZm9ybWF0aW9uIHRoYXQgdGhlIHVzZXIgcGFzc2VkIGluLiBUaGUgbGlicmFyeVxuICogaXRzZWxmIHdpbGwgbm90IHRvdWNoIHRoaXMgcHJvcGVydHkuIFlvdSBjYW4gdXNlIHRoaXMgcHJvcGVydHkgdG8gaG9sZCBhbnkgaW5mb3JtYXRpb24gdGhhdCB5b3Ugd2FudCwgd2hlbiB5b3UgZXh0ZW5kXG4gKiB0aGUgZnVuY3Rpb25hbGl0eSBvZiB5b3VyIG93biBpbnN0YW5jZSBvZiBgSHR0cENsaWVudGAuIFRoZSBkZWZhdWx0IHZhbHVlIG9mIHRoaXMgcHJvcGVydHkgaXMgYW4gZW1wdHkgb2JqZWN0LlxuICpcbiAqIEBwcm9wZXJ0eSB7T2JqZWN0LjxzdHJpbmcsICo+fSBbaGVhZGVyc10gVGhlIG9iamVjdCB0aGF0IGNvbnRhaW5zIHRoZSBoZWFkZXJzIHRvIHNldCB3aGVuIHNlbmRpbmcgdGhlIHJlcXVlc3QuIE9ubHlcbiAqIHRoZSBub24tdW5kZWZpbmVkIGFuZCBub24tbnVsbCBoZWFkZXJzIGFyZSBzZXQuXG4gKlxuICogQHByb3BlcnR5IHtDYW5jZWxDb250cm9sbGVyfSBbY29udHJvbGxlcl0gVGhlIGBDYW5jZWxDb250cm9sbGVyYCB1c2VkIHRvIGNhbmNlbCB0aGUgcmVxdWVzdC4gSXQgb25seSB3b3JrcyB3aGVuIHVzaW5nXG4gKiBgZmV0Y2hgIG9yIGBmZXRjaEpTT05QYCB0byBzZW5kIHJlcXVlc3QuIElmIHRoZSB5b3Ugc2VuZCByZXF1ZXN0IHVzaW5nIGBzZW5kYCBvciBgZ2V0SlNPTlBgLCB0aGUgYG9wdGlvbnMuY29udHJvbGxlcmBcbiAqIHdpbGwgYmUgc2V0IHRvIGBudWxsYC5cbiAqXG4gKiBAcHJvcGVydHkge3N0cmluZ30gW3JlcXVlc3RGdW5jdGlvbk5hbWVdIFRoZSBuYW1lIG9mIHRoZSBmdW5jdGlvbiB0aGF0IHNlbmQgdGhlIHJlcXVlc3QuIENhbiBiZSBgc2VuZGAsIGBmZXRjaGAsXG4gKiBgZ2V0SlNPTlBgLCBgZmV0Y2hKU09OUGAuIFRoaXMgdmFsdWUgaXMgc2V0IGJ5IHRoZSBsaWJyYXJ5LCBkb24ndCBjaGFuZ2UgaXQuXG4gKlxuICogQHByb3BlcnR5IHtzdHJpbmd9IFtyZXF1ZXN0VHlwZV0gVGhlIHJlcXVlc3QgdHlwZSBvZiB0aGlzIHJlcXVlc3QuIFRoZSB2YWx1ZSBvZiBpdCBpcyBzZXQgYnkgdGhlIGxpYnJhcnkgaXRzZWxmLCBjYW5cbiAqIGJlIGBIVFRQX1JFUVVFU1RgIG9yIGBKU09OUF9SRVFVRVNUYC4gQW55IG90aGVyIHZhbHVlIHRoZSB1c2VyIHBhc3NlZCBpbiBpcyBpZ25vcmVkLiBZb3UgY2FuIHVzZSB0aGlzIHByb3BlcnR5IHRvIGdldFxuICogdGhlIHR5cGUgb2YgdGhlIGN1cnJlbnQgcmVxdWVzdC5cbiAqXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IFtjb3JzXSBXaGV0aGVyIHRvIHNldCBgd2l0aENyZWRlbnRpYWxzYCBwcm9wZXJ0eSBvZiB0aGUgYFhNTEh0dHBSZXF1ZXN0YCB0byBgdHJ1ZWAuIFRoZSBkZWZhdWx0XG4gKiB2YWx1ZSBpcyBgZmFsc2VgLlxuICpcbiAqIEBwcm9wZXJ0eSB7T2JqZWN0LjxzdHJpbmcsICo+fSBbeGhyUHJvcHNdIFRoZSBvYmplY3QgdGhhdCBjb250YWlucyB0aGUgcHJvcGVydGllcyB0byBzZXQgb24gdGhlIGluc3RhbmNlIG9mIHRoZVxuICogYFhNTEh0dHBSZXF1ZXN0YC5cbiAqXG4gKiBAcHJvcGVydHkge3N0cmluZ30gW3VzZXJuYW1lXSBUaGUgdXNlciBuYW1lIHRvIHVzZSBmb3IgYXV0aGVudGljYXRpb24gcHVycG9zZXMuIFRoZSBkZWZ1YWx0IHZhbHVlIGlzIGBudWxsYC5cbiAqXG4gKiBAcHJvcGVydHkge3N0cmluZ30gW3Bhc3N3b3JkXSBUaGUgcGFzc3dvcmQgdG8gdXNlIGZvciBhdXRoZW50aWNhdGlvbiBwdXJwb3Nlcy4gVGhlIGRlZnVhbHQgdmFsdWUgaXMgYG51bGxgLlxuICpcbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBbdGltZW91dF0gVGhlIG51bWJlciBvZiBtaWxsaXNlY29uZHMgdGhlIHJlcXVlc3QgY2FuIHRha2UgYmVmb3JlIGl0IGZpbmlzaGVkLiBJZiB0aGUgdGltZW91dCB2YWx1ZVxuICogaXMgYDBgLCBubyB0aW1lciB3aWxsIGJlIHNldC4gSWYgdGhlIHJlcXVlc3QgZG9lcyBub3QgZmluc2loZWQgd2l0aGluIHRoZSBnaXZlbiB0aW1lLCBhIHRpbWVvdXQgZXJyb3Igd2lsbCBiZSB0aHJvd24uXG4gKiBUaGUgZGVmYXVsdCB2YWx1ZSBpcyBgMGAuXG4gKlxuICogQHByb3BlcnR5IHtib29sZWFufSBbbm9DYWNoZV0gV2hldGhlciB0byBkaXNhYmxlIHRoZSBjYWNoZS4gSWYgdGhlIHZhbHVlIGlzIGB0cnVlYCwgdGhlIGhlYWRlcnMgaW5cbiAqIGBvcHRpb25zLm5vQ2FjaGVIZWFkZXJzYCB3aWxsIGJlIHNldC4gVGhlIGRlZmF1bHQgdmFsdWUgaXMgYGZhbHNlYC5cbiAqXG4gKiBAcHJvcGVydHkge09iamVjdC48c3RyaW5nLCAqPn0gW25vQ2FjaGVIZWFkZXJzXSBUaGUgaGVhZGVycyB0byBzZXQgd2hlbiBgb3B0aW9ucy5ub0NhY2hlYCBpcyBzZXQgdG8gYHRydWVgLlxuICpcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbanNvbnBdIFRoZSBxdWVyeSBzdHJpbmcga2V5IHRvIGhvbGQgdGhlIHZhbHVlIG9mIHRoZSBjYWxsYmFjayBuYW1lIHdoZW4gc2VuZGluZyBKU09OUCByZXF1ZXN0LlxuICogVGhlIGRlZmF1bHQgdmFsdWVzIGlzIGBjYWxsYmFja2AuXG4gKlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgaHR0cFJlcXVlc3RCb2R5UHJvY2Vzc29yPn0gW2h0dHBSZXF1ZXN0Qm9keVByb2Nlc3Nvcl0gVGhlIG9iamVjdCB0aGF0IGNvbnRhaW5zIHRoZVxuICogaHR0cCByZXF1ZXN0IGJvZHkgcHJvY2Vzc29ycy5cbiAqXG4gKiBAcHJvcGVydHkge09iamVjdC48c3RyaW5nLCBSZXNwb25zZVBhcnNlRnVuY3Rpb24+fSBbaHR0cFJlc3BvbnNlUGFyc2VyXSBUaGUgb2JqZWN0IHRoYXQgY29udGFpbnMgdGhlIGh0dHAgcmVzcG9uc2VcbiAqIHBhcnNlcnMuXG4gKlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgUmVzcG9uc2VQYXJzZUZ1bmN0aW9uPn0gW2pzb25wUmVzcG9uc2VQYXJzZXJdIFRoZSBvYmplY3QgdGhhdCBjb250YWlucyB0aGUganNvbnAgcmVzcG9uc2VcbiAqIHBhcnNlcnMuXG4gKlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgUmVzcG9uc2VFcnJvclBhcnNlRnVuY3Rpb24+fSBbaHR0cFJlc3BvbnNlRXJyb3JQYXJzZXJdIFRoZSBvYmplY3QgdGhhdCBjb250YWlucyB0aGUgaHR0cFxuICogcmVzcG9uc2UgZXJyb3IgcGFyc2Vycy5cbiAqXG4gKiBAcHJvcGVydHkge09iamVjdC48c3RyaW5nLCBSZXNwb25zZUVycm9yUGFyc2VGdW5jdGlvbj59IFtqc29ucFJlc3BvbnNlRXJyb3JQYXJzZXJdIFRoZSBvYmplY3QgdGhhdCBjb250YWlucyB0aGUganNvbnBcbiAqIHJlc3BvbnNlIGVycm9yIHBhcnNlcnMuXG4gKlxuICogQHByb3BlcnR5IHtIYW5sZGVPcHRpb25zRnVuY3Rpb259IFtoYW5kbGVPcHRpb25zXSBUaGUgZnVuY3Rpb24gdG8gaGFuZGxlIHRoZSBvcHRpb25zLlxuICpcbiAqIEBwcm9wZXJ0eSB7Q3JlYXRlWEhSRnVuY3Rpb259IFtjcmVhdGVYSFJdIFRoZSBmdW5jdGlvbiB0byBjcmVhdGUgdGhlIGBYTUxIdHRwUmVxdWVzdGAgaW5zdGFuY2UuXG4gKlxuICogQHByb3BlcnR5IHtTY3JpcHRDcmVhdGVGdW5jdGlvbn0gW2NyZWF0ZVNjcmlwdF0gVGhlIGZ1bmN0aW9uIHRvIGNyZWF0ZSB0aGUgYEhUTUxTY3JpcHRFbGVtZW50YCBpbnN0YW5jZS5cbiAqXG4gKiBAcHJvcGVydHkge0pTT05QQ29udGFpbmVyRmluZEZ1bmN0aW9ufSBbanNvbnBDb250YWluZXJOb2RlXSBUaGUgZnVuY3Rpb24gdGhhdCByZXR1cm5zIHRoZSBjb250YWluZXIgbm9kZSwgd2hpY2ggd2lsbFxuICogYmUgdXNlZCB0byBhcHBlbmQgdGhlIHNjcmlwdCBlbGVtZW50IHdoZW4gc2VuZGluZyBqc29ucCByZXF1ZXN0LlxuICpcbiAqIEBwcm9wZXJ0eSB7SlNPTlBDYWxsYmFja05hbWVHZW5lcmF0ZUZ1bmN0aW9ufSBbanNvbnBDYWxsYmFja05hbWVdIFRoZSBmdW5jdGlvbiB0byBnZW5lcmF0ZSB0aGUgdW5pcXVlIGNhbGxiYWNrIG5hbWVcbiAqIHdoZW4gc2VuZGluZyBqc29ucCByZXF1ZXN0LlxuICpcbiAqIEBwcm9wZXJ0eSB7Q29tcGlsZVVSTEZ1bmN0aW9ufSBbY29tcGlsZVVSTF0gVGhlIGZ1bmN0aW9uIHRvIGNvbXBpbGUgdXJsLlxuICpcbiAqIEBwcm9wZXJ0eSB7RW5jb2RlUXVlcnlTdHJpbmdGdW5jdGlvbn0gZW5jb2RlUXVlcnlTdHJpbmcgVGhlIGZ1bmN0aW9uIHRvIGVuY29kZSB0aGUgcXVlcnkgc3RyaW5nLlxuICpcbiAqIEBwcm9wZXJ0eSB7WEhSSG9va0Z1bmN0aW9ufSBvblhockNyZWF0ZWQgVGhlIGZ1bmN0aW9uIHRvIGNhbGwgb24geGhyIGNyZWF0ZWQuXG4gKlxuICogQHByb3BlcnR5IHtYSFJIb29rRnVuY3Rpb259IG9uWGhyT3BlbmVkIFRoZSBmdW5jdG9uIHRvIGNhbGwgb24geGhyIG9wZW5lZC5cbiAqXG4gKiBAcHJvcGVydHkge1hIUkhvb2tGdW5jdGlvbn0gb25YaHJTZW50IFRoZSBmdW5jdGlvbiB0byBjYWxsIG9uIHhociBzZW50LlxuICpcbiAqIEBwcm9wZXJ0eSB7UmVxdWVzdENyZWF0ZWRGdW5jdGlvbn0gb25SZXF1ZXN0Q3JlYXRlZCBUaGUgZnVuY3Rpb24gdG8gY2FsbCBvbiByZXF1ZXN0IGNyZWF0ZWQuXG4gKlxuICogQHByb3BlcnR5IHtDaGVja1Jlc3BvbnNlT2tGdW5jdGlvbn0gaXNSZXNwb25zZU9rIFRoZSBmdW5jdGlvbiB0byBjaGVjayB3aGV0aGVyIHRoZSByZXNwb25zZSBpcyBvay5cbiAqXG4gKiBAcHJvcGVydHkge1RyYW5zZm9ybUVycm9yRnVuY3Rpb259IHRyYW5zZm9ybUVycm9yIFRoZSBmdW5jdGlvbiB0byB0cmFuc2Zyb20gdGhlIHJlc3BvbnNlIGVycm9yLiBUaGUgcmV0dXJuIHZhbHVlIG9mXG4gKiB0aGlzIGZ1bmN0aW9uIHdpbGwgYmUgcGFzc2VkIHRvIHRoZSBgb25lcnJvcmAgY2FsbGJhY2suXG4gKlxuICogQHByb3BlcnR5IHtUcmFuc2Zvcm1SZXNwb25zZUZ1bmN0aW9ufSB0cmFuc2Zvcm1SZXNwb25zZSBUaGUgZnVuY3Rpb24gdG8gdHJhbnNmcm9tIHRoZSByZXNwb25zZS4gVGhlIHJldHVybiB2YWx1ZSBvZlxuICogdGhpcyBmdW5jdGlvbiB3aWxsIGJlIHBhc3NlZCB0byB0aGUgYG9uc3VjY2Vzc2AgY2FsbGJhY2suXG4gKlxuICogQHByb3BlcnR5IHtDaGVja1Nob3VsZENhbGxFcnJvckNhbGxiYWNrRnVuY3Rpb259IHNob3VsZENhbGxFcnJvckNhbGxiYWNrIFRoZSBmdW5jdGlvbiB0byBjaGVjayB3aGV0aGVyIHRvIGNhbGwgdGhlXG4gKiBlcnJvciBjYWxsYmFjay5cbiAqXG4gKiBAcHJvcGVydHkge0NoZWNrU2hvdWxkQ2FsbFN1Y2Nlc3NDYWxsYmFja0Z1bmN0aW9ufSBzaG91bGRDYWxsU3VjY2Vzc0NhbGxiYWNrIFRoZSBmdW5jdGlvbiB0byBjaGVjayB3aGV0aGVyIHRvIGNhbGxcbiAqIHRoZSBzdWNjZXNzIGNhbGxiYWNrLlxuICovXG5cbi8qKlxuICogVGhlIGRlZmluaXRvbiBvZiBodHRwIHJlcXVlc3QgZGF0YSBwcm9jZXNzb3IuXG4gKlxuICogQHR5cGVkZWYge09iamVjdC48c3RyaW5nLCAqPn0gaHR0cFJlcXVlc3RCb2R5UHJvY2Vzc29yXG4gKiBAcHJvcGVydHkge251bWJlcn0gcHJpb3JpdHkgVGhlIHByaW9yaXR5IG9mIHRoZSBwcm9jZXNzb3IuXG4gKiBAcHJvcGVydHkge09iamVjdC48c3RyaW5nLCAqPn0gW2hlYWRlcnNdIFRoZSBoZWFkZXJzIHRvIHNldCB3aGVuIHRoaXMgcHJvY2Vzc29yIGlzIHVzZWQuXG4gKiBAcHJvcGVydHkge0h0dHBSZXF1ZXN0Q29udGVudFByb2Nlc3NGdW5jdGlvbn0gW3Byb2Nlc3Nvcl0gVGhlIGZ1bmN0aW9uIHRvIHByb2Nlc3MgdGhlIHJlcXVlc3QgYm9keS5cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBoYW5kbGUgdGhlIG9wdGlvbnMuXG4gKlxuICogQGNhbGxiYWNrIEhhbmxkZU9wdGlvbnNGdW5jdGlvblxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICovXG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIHByb2Nlc3MgdGhlIHJlcXVlc3QgZGF0YS5cbiAqXG4gKiBAY2FsbGJhY2sgSHR0cFJlcXVlc3RDb250ZW50UHJvY2Vzc0Z1bmN0aW9uXG4gKiBAcGFyYW0ge09iamVjdC48c3RyaW5nLCAqPn0gY29udGVudCBUaGUgY29uZW50IG5lZWQgdG8gcHJvY2Vzcy5cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucyBvZiB0aGUgY3VycmVudCByZXF1ZXN0LlxuICogQHJldHVybnMge2FueX0gUmV0dXJucyB0aGUgdmFsdWUgdGhhdCB3aWxsIGJlIHNlbmQgdG8gdGhlIHNlcnZlci5cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBwYXJzZSB0aGUgcmVzcG9uc2UuIFRoaXMgZnVuY3Rpb24gd2lsbCBiZSBtb3VudGVkIG9uIHRoZSByZXNwb25zZSBpbnN0YW5jZSwgd2hpY2ggbWFkZSBpdCBhIG1ldGhvZFxuICogb2YgdGhlIGBSZXNwb25zZWAgaW5zdGFuY2UuIFRoZSBwYXJhbWV0ZXJzIGFuZCB0aGUgcmV0dXJuIHZhbHVlIGlzIHVwIG9uIHlvdS5cbiAqXG4gKiBAY2FsbGJhY2sgUmVzcG9uc2VQYXJzZUZ1bmN0aW9uXG4gKi9cblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gcGFyc2UgdGhlIHJlc3BvbnNlIGVycm9yLiBUaGlzIGZ1bmN0aW9uIHdpbGwgYmUgbW91bnRlZCBvbiB0aGUgcmVzcG9uc2UgZXJyb3IgaW5zdGFuY2UsIHdoaWNoIG1hZGUgaXRcbiAqIGEgbWV0aG9kIG9mIHRoZSBgUmVzcG9uc2VFcnJvcmAgaW5zdGFuY2UuIFRoZSBwYXJhbWV0ZXJzIGFuZCB0aGUgcmV0dXJuIHZhbHVlIGlzIHVwIG9uIHlvdS5cbiAqXG4gKiBAY2FsbGJhY2sgUmVzcG9uc2VFcnJvclBhcnNlRnVuY3Rpb25cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBjcmVhdGUgdGhlIGBYTUxIdHRwUmVxdWVzdGAgaW5zdGFuY2UuXG4gKlxuICogQGNhbGxiYWNrIENyZWF0ZVhIUkZ1bmN0aW9uXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcmV0dXJucyB7WE1MSHR0cFJlcXVlc3R9IFJldHVybnMgYW4gaW5zdGFuY2Ugb2YgYFhNTEh0dHBSZXF1ZXN0YC5cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBjcmVhdGUgdGhlIGBIVE1MU2NyaXB0RWxlbWVudGAgaW5zdGFuY2UuXG4gKlxuICogQGNhbGxiYWNrIFNjcmlwdENyZWF0ZUZ1bmN0aW9uXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcmV0dXJucyB7SFRNTFNjcmlwdEVsZW1lbnR9IFJldHVybnMgYW4gaW5zdGFuY2Ugb2YgYEhUTUxTY3JpcHRFbGVtZW50YC5cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0aGF0IHJldHVybnMgdGhlIG5vZGUgdG8gYXBwZW5kIHRoZSBzY3JpcHQgZWxlbWVudC5cbiAqXG4gKiBAY2FsbGJhY2sgSlNPTlBDb250YWluZXJGaW5kRnVuY3Rpb25cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEByZXR1cm5zIHtOb2RlfSBSZXR1cm5zIHRoZSBub2RlIHRvIGFwcGVuZCB0aGUgc2NyaXB0IGVsZW1lbnQuXG4gKi9cblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gZ2VuZXJhdGUgdGhlIHVuaXF1ZSBjYWxsYmFjayBuYW1lLlxuICpcbiAqIEBjYWxsYmFjayBKU09OUENhbGxiYWNrTmFtZUdlbmVyYXRlRnVuY3Rpb25cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEByZXR1cm5zIHtzdHJpbmd9IFJldHJ1bnMgYSB2YWxpZCBqYXZhc2NyaXB0IGlkZW50aWZpZXIgdG8gaG9sZCB0aGUgY2FsbGJhay5cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBjb21waWxlIHRoZSByZXF1ZXN0IHVybC5cbiAqXG4gKiBAY2FsbGJhY2sgQ29tcGlsZVVSTEZ1bmN0aW9uXG4gKiBAcGFyYW0ge3N0cmluZ30gdXJsIFRoZSB1cmwgKHdpdGggYmFzZVVSTCkgdG8gY29tcGlsZS5cbiAqIEBwYXJhbSB7T2JqZWN0LjxzdHJpbmcsICo+fSBwYXJhbSBUaGUgcGFyYW0gdG8gY29tcGlsZSB0aGUgdXJsLlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICogQHJldHVybnMge3N0cmluZ30gUmV0dXJucyB0aGUgY29tcGlsZWQgdXJsLlxuICovXG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGVuY29kZSB0aGUgcXVlcnkgc3RyaW5nLlxuICpcbiAqIEBjYWxsYmFjayBFbmNvZGVRdWVyeVN0cmluZ0Z1bmN0aW9uXG4gKiBAcGFyYW0ge09iamVjdC48c3RyaW5nLCAqPn0gZGF0YSBUaGUgZGF0YSB0byBiZSBlbmNvZGVkIHRvIHF1ZXJ5IHN0cmluZy5cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEByZXR1cm5zIHtzdHJpbmd9IFJldHVybnMgdGhlIGVuY29kZWQgcXVlcnkgc3RyaW5nLlxuICovXG5cbi8qKlxuICogVGhlIHhociBob29rIGZ1bmN0aW9uLlxuICpcbiAqIEBjYWxsYmFjayBYSFJIb29rRnVuY3Rpb25cbiAqIEBwYXJhbSB7WE1MSHR0cFJlcXVlc3R9IHhociBUaGUgaW5zdGFuY2Ugb2YgYFhNTEh0dHBSZXF1ZXN0YC5cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqL1xuXG4vKipcbiAqIEBjYWxsYmFjayBSZXF1ZXN0Q3JlYXRlZEZ1bmN0aW9uXG4gKiBAcGFyYW0ge0h0dHBSZXF1ZXN0fEpTT05QUmVxdWVzdH0gcmVxdWVzdCBUaGUgcmVxdWVzdCBpbnN0YW5jZSwgY2FuIGJlIGBIdHRwUmVxdWVzdGAgb3IgYEpTT05QUmVxdWVzdGAuXG4gKi9cblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gY2hlY2sgd2hldGhlciB0aGUgcmVzcG9uc2UgaXMgb2suXG4gKlxuICogQGNhbGxiYWNrIENoZWNrUmVzcG9uc2VPa0Z1bmN0aW9uXG4gKiBAcGFyYW0ge3N0cmluZ30gcmVxdWVzdFR5cGUgVGhlIHJlcXVlc3QgdHlwZSwgYEhUVFBfUkVRVUVTVGAgb3IgYEpTT05QX1JFUVVFU1RgLlxuICogQHBhcmFtIHtSZXNwb25zZX0gcmVzcG9uc2UgVGhlIHJlc3BvbnNlIGluc3RhbmNlLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSByZXNwb25zZSBpcyBvaywgb3RoZXJ3aXNlIGBmYWxzZWAgaXMgcmV0dXJuZWQuXG4gKi9cblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gY2hlY2sgd2hldGhlciB0byBjYWxsIHRoZSBlcnJvciBjYWxsYmFjay5cbiAqXG4gKiBAY2FsbGJhY2sgQ2hlY2tTaG91bGRDYWxsRXJyb3JDYWxsYmFja0Z1bmN0aW9uXG4gKiBAcGFyYW0ge3N0cmluZ30gcmVxdWVzdFR5cGUgVGhlIHJlcXVlc3QgdHlwZSwgYEhUVFBfUkVRVUVTVGAgb3IgYEpTT05QX1JFUVVFU1RgLlxuICogQHBhcmFtIHthbnl9IHRyYW5zZm9ybWVkRXJyb3IgVGhlIGRhdGEgdGhhdCBgb3B0aW9ucy50cmFuc2Zvcm1FcnJvciguLi4pYCByZXR1cm5zLlxuICogQHBhcmFtIHtIdHRwUmVzcG9uc2VFcnJvcnxKU09OUFJlc3BvbnNlRXJyb3J9IGVycm9yIFRoZSByZXNwb25zZSBlcnJvci5cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBjaGVjayB3aGV0aGVyIHRvIGNhbGwgdGhlIHN1Y2Nlc3MgY2FsbGJhY2suXG4gKlxuICogQGNhbGxiYWNrIENoZWNrU2hvdWxkQ2FsbFN1Y2Nlc3NDYWxsYmFja0Z1bmN0aW9uXG4gKiBAcGFyYW0ge3N0cmluZ30gcmVxdWVzdFR5cGUgVGhlIHJlcXVlc3QgdHlwZSwgYEhUVFBfUkVRVUVTVGAgb3IgYEpTT05QX1JFUVVFU1RgLlxuICogQHBhcmFtIHthbnl9IHRyYW5zZm9ybWVkUmVzcG9uc2UgVGhlIGRhdGEgdGhhdCBgb3B0aW9ucy50cmFuc2Zvcm1SZXNwb25zZSguLi4pYCByZXR1cm5zLlxuICogQHBhcmFtIHtIdHRwUmVzcG9uc2V8SlNPTlBSZXNwb25zZX0gcmVzcG9uc2UgVGhlIHJlc3BvbnNlLlxuICovXG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIHRyYW5zZnJvbSB0aGUgcmVzcG9uc2UuIFRoZSByZXR1cm4gdmFsdWUgb2YgdGhpcyBmdW5jdGlvbiB3aWxsIGJlIHBhc3NlZCB0byB0aGUgYG9uc3VjY2Vzc2AgY2FsbGJhY2suXG4gKlxuICogQGNhbGxiYWNrIFRyYW5zZm9ybVJlc3BvbnNlRnVuY3Rpb25cbiAqIEBwYXJhbSB7c3RyaW5nfSByZXF1ZXN0VHlwZSBUaGUgcmVxdWVzdCB0eXBlLCBgSFRUUF9SRVFVRVNUYCBvciBgSlNPTlBfUkVRVUVTVGAuXG4gKiBAcGFyYW0ge0h0dHBSZXNwb25zZXxKU09OUFJlc3BvbnNlfSByZXNwb25zZSBUaGUgcmVzcG9uc2UuXG4gKiBAcmV0dXJucyB7YW55fSBSZXR1cm5zIHRoZSB0cmFuc2Zvcm1lZCByZXNwb25zZS5cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byB0cmFuc2Zyb20gdGhlIHJlc3BvbnNlIGVycm9yLiBUaGUgcmV0dXJuIHZhbHVlIG9mIHRoaXMgZnVuY3Rpb24gd2lsbCBiZSBwYXNzZWQgdG8gdGhlIGBvbmVycm9yYFxuICogY2FsbGJhY2suXG4gKlxuICogQGNhbGxiYWNrIFRyYW5zZm9ybUVycm9yRnVuY3Rpb25cbiAqIEBwYXJhbSB7c3RyaW5nfSByZXF1ZXN0VHlwZSBUaGUgcmVxdWVzdCB0eXBlLCBgSFRUUF9SRVFVRVNUYCBvciBgSlNPTlBfUkVRVUVTVGAuXG4gKiBAcGFyYW0ge0h0dHBSZXNwb25zZUVycm9yfEpTT05QUmVzcG9uc2VFcnJvcn0gZXJyb3IgVGhlIHJlc3BvbnNlIGVycm9yLlxuICogQHJldHVybnMge2FueX0gUmV0dXJucyB0aGUgdHJhbnNmb3JtZWQgcmVzcG9uc2UgZXJyb3IuXG4gKi9cbiIsInZhciBSZXF1ZXNldCA9IHJlcXVpcmUoOSk7XG52YXIgY29uc3RhbnRzID0gcmVxdWlyZSgyNSk7XG52YXIgaW5oZXJpdHMgPSByZXF1aXJlKDMxKTtcbnZhciBidWlsZFVSTCA9IHJlcXVpcmUoMjMpO1xudmFyIGhhbmRsZU9wdGlvbnMgPSByZXF1aXJlKDMwKTtcbnZhciBjYWxsUmVxdWVzdENyZWF0ZWRDYWxsYmFjayA9IHJlcXVpcmUoMjQpO1xudmFyIGFkZEV2ZW50TGlzdGVuZXJzID0gcmVxdWlyZSgxMik7XG52YXIgaGFuZGxlWGhyUHJvcHMgPSByZXF1aXJlKDE3KTtcbnZhciBoYW5kbGVIZWFkZXJzID0gcmVxdWlyZSgxNSk7XG52YXIgaGFuZGxlUmVxdWVzdEJvZHkgPSByZXF1aXJlKDE2KTtcbnZhciBjYWxsWGhySG9vayA9IHJlcXVpcmUoMTQpO1xuXG4vKipcbiAqIFJlcHJlc2VudHMgYW4gaHR0cCByZXF1ZXN0LlxuICpcbiAqIEBjbGFzc1xuICogQGV4dGVuZHMge1JlcXVlc2V0fVxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICogQHBhcmFtIHtSZXF1ZXN0U3VjY2Vzc0NhbGxiYWNrfSBvbnN1Y2Nlc3MgVGhlIGNhbGxiYWNrIHRvIGNhbGwgb24gc3VjY2Vzcy5cbiAqIEBwYXJhbSB7UmVxdWVzdEVycm9yQ2FsbGJhY2t9IG9uZXJyb3IgVGhlIGNhbGxiYWNrIHRvIGNhbGwgb24gZXJyb3IuXG4gKi9cbmZ1bmN0aW9uIEh0dHBSZXF1ZXN0KG9wdGlvbnMsIG9uc3VjY2Vzcywgb25lcnJvcikge1xuICAgIHZhciB4aHI7XG4gICAgdmFyIGNvbnRlbnQ7XG4gICAgdmFyIHVybDtcblxuICAgIC8vIENhbGwgdGhlIHN1cGVyIGNvbnN0cnVjdG9yLlxuICAgIFJlcXVlc2V0LmNhbGwodGhpcywgY29uc3RhbnRzLkhUVFBfUkVRVUVTVCwgb3B0aW9ucywgb25zdWNjZXNzLCBvbmVycm9yKTtcblxuICAgIC8vIENhbGwgYG9wdGlvbnMuaGFuZGxlT3B0aW9uc2AgdG8gaGFuZGxlIG9wdGlvbnMuXG4gICAgaGFuZGxlT3B0aW9ucyhvcHRpb25zKTtcblxuICAgIHRoaXMueGhyID0geGhyID0gb3B0aW9ucy5jcmVhdGVYSFIuY2FsbChudWxsLCBvcHRpb25zKTtcbiAgICBjb250ZW50ID0gaGFuZGxlUmVxdWVzdEJvZHkob3B0aW9ucyk7XG4gICAgdXJsID0gYnVpbGRVUkwob3B0aW9ucyk7XG5cbiAgICAvLyBTZXQgcHJvcGVydGllcyB0byB0aGUgeGhyLlxuICAgIGhhbmRsZVhoclByb3BzKHhociwgb3B0aW9ucyk7XG5cbiAgICAvLyBDYWxsIG9uWGhyQ3JlYXRlZC5cbiAgICBjYWxsWGhySG9vayhvcHRpb25zLm9uWGhyQ3JlYXRlZCwgeGhyLCBvcHRpb25zKTtcblxuICAgIC8vIEFkZCBldmVudCBsaXN0ZW5lcnMuIFRoaXMgZnVuY3Rpb24gbXVzdCBvdmVyd3JpdGUgdGhlIGBjYW5jZWxgIG1ldGhvZCBvZiB0aGlzIGBIdHRwUmVxdWVzdGAgaW5zdGFuY2UgdG8gY2FuY2VsXG4gICAgLy8gdGhpcyBodHRwIHJlcXVlc3QuXG4gICAgYWRkRXZlbnRMaXN0ZW5lcnModGhpcyk7XG5cbiAgICAvLyBPcGVuIHRoZSByZXF1ZXN0LlxuICAgIHhoci5vcGVuKG9wdGlvbnMubWV0aG9kIHx8ICdHRVQnLCB1cmwsIHRydWUsIG9wdGlvbnMudXNlcm5hbWUsIG9wdGlvbnMucGFzc3dvcmQpO1xuXG4gICAgLy8gQ2FsbCBvblhock9wZW5lZC5cbiAgICBjYWxsWGhySG9vayhvcHRpb25zLm9uWGhyT3BlbmVkLCB4aHIsIG9wdGlvbnMpO1xuXG4gICAgLy8gSGFubGRlIGhlYWRlcnMuXG4gICAgaGFuZGxlSGVhZGVycyh4aHIsIG9wdGlvbnMpO1xuXG4gICAgLy8gU2VuZCB0aGUgY29udGVudCB0byB0aGUgc2VydmVyLlxuICAgIHhoci5zZW5kKGNvbnRlbnQpO1xuXG4gICAgLy8gQ2FsbCBvblhoclNlbnQuXG4gICAgY2FsbFhockhvb2sob3B0aW9ucy5vblhoclNlbnQsIHhociwgb3B0aW9ucyk7XG5cbiAgICAvLyBDYWxsIG9uUmVxdWVzdENyZWF0ZWRcbiAgICBjYWxsUmVxdWVzdENyZWF0ZWRDYWxsYmFjayhvcHRpb25zLCB0aGlzKTtcbn1cblxuaW5oZXJpdHMoSHR0cFJlcXVlc3QsIFJlcXVlc2V0KTtcblxubW9kdWxlLmV4cG9ydHMgPSBIdHRwUmVxdWVzdDtcbiIsIi8qKlxuICogSHR0cFJlc3BvbnNlIG1vZHVsZS5cbiAqXG4gKiBAbW9kdWxlIGNsYXNzL0h0dHBSZXNwb25zZVxuICovXG5cbnZhciBSZXNwb25zZSA9IHJlcXVpcmUoMTApO1xudmFyIGluaGVyaXRzID0gcmVxdWlyZSgzMSk7XG52YXIgYWRkQ3VzdG9tUGFyc2VyID0gcmVxdWlyZSgyMik7XG5cbi8qKlxuICogVGhlIEh0dHBSZXNwb25zZSBjbGFzcy5cbiAqXG4gKiBAY2xhc3NcbiAqIEBwYXJhbSB7SHR0cFJlcXVlc3R9IHJlcXVlc3QgVGhlIGh0dHAgcmVxdWVzdC5cbiAqL1xuZnVuY3Rpb24gSHR0cFJlc3BvbnNlKHJlcXVlc3QpIHtcbiAgICBSZXNwb25zZS5jYWxsKHRoaXMsIHJlcXVlc3QpO1xuICAgIGFkZEN1c3RvbVBhcnNlcih0aGlzLCByZXF1ZXN0Lm9wdGlvbnMsICdodHRwUmVzcG9uc2VQYXJzZXInKTtcbn1cblxuaW5oZXJpdHMoSHR0cFJlc3BvbnNlLCBSZXNwb25zZSk7XG5cbm1vZHVsZS5leHBvcnRzID0gSHR0cFJlc3BvbnNlO1xuIiwidmFyIFJlc3BvbnNlRXJyb3IgPSByZXF1aXJlKDExKTtcbnZhciBpbmhlcml0cyA9IHJlcXVpcmUoMzEpO1xudmFyIGFkZEN1c3RvbVBhcnNlciA9IHJlcXVpcmUoMjIpO1xuXG4vKipcbiAqIEBjbGFzc1xuICogQHBhcmFtIHtzdHJpbmd9IGNvZGUgVGhlIGVycm9yIGNvZGUuXG4gKiBAcGFyYW0ge0h0dHBSZXF1ZXN0fSByZXF1ZXN0IFRoZSBodHRwIHJlcXVlc3QuXG4gKi9cbmZ1bmN0aW9uIEh0dHBSZXNwb25zZUVycm9yKGNvZGUsIHJlcXVlc3QpIHtcbiAgICBSZXNwb25zZUVycm9yLmNhbGwodGhpcywgY29kZSwgcmVxdWVzdCk7XG4gICAgYWRkQ3VzdG9tUGFyc2VyKHRoaXMsIHJlcXVlc3Qub3B0aW9ucywgJ2h0dHBSZXNwb25zZUVycm9yUGFyc2VyJyk7XG59XG5cbmluaGVyaXRzKEh0dHBSZXNwb25zZUVycm9yLCBSZXNwb25zZUVycm9yKTtcblxubW9kdWxlLmV4cG9ydHMgPSBIdHRwUmVzcG9uc2VFcnJvcjtcbiIsInZhciBSZXF1ZXNldCA9IHJlcXVpcmUoOSk7XG52YXIgY29uc3RhbnRzID0gcmVxdWlyZSgyNSk7XG52YXIgaW5oZXJpdHMgPSByZXF1aXJlKDMxKTtcbnZhciBoYW5kbGVPcHRpb25zID0gcmVxdWlyZSgzMCk7XG52YXIgY2FsbFJlcXVlc3RDcmVhdGVkQ2FsbGJhY2sgPSByZXF1aXJlKDI0KTtcbnZhciBhZGRFdmVudExpc3RlbmVycyA9IHJlcXVpcmUoMTgpO1xudmFyIGJ1aWxkQ2FsbGJhY2tOYW1lID0gcmVxdWlyZSgxOSk7XG52YXIgaGFuZGxlU2NyaXB0Q29ycyA9IHJlcXVpcmUoMjEpO1xudmFyIGJ1aWxkU2NyaXB0U3JjID0gcmVxdWlyZSgyMCk7XG5cbi8qKlxuICogUmVwcmVzZW50cyBhbiBqc29ucCByZXF1ZXN0LlxuICpcbiAqIEBjbGFzc1xuICogQGV4dGVuZHMge1JlcXVlc2V0fVxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICogQHBhcmFtIHtSZXF1ZXN0U3VjY2Vzc0NhbGxiYWNrfSBvbnN1Y2Nlc3MgVGhlIGNhbGxiYWNrIHRvIGNhbGwgb24gc3VjY2Vzcy5cbiAqIEBwYXJhbSB7UmVxdWVzdEVycm9yQ2FsbGJhY2t9IG9uZXJyb3IgVGhlIGNhbGxiYWNrIHRvIGNhbGwgb24gZXJyb3IuXG4gKi9cbmZ1bmN0aW9uIEpTT05QUmVxdWVzdChvcHRpb25zLCBvbnN1Y2Nlc3MsIG9uZXJyb3IpIHtcbiAgICB2YXIgc3JjO1xuICAgIHZhciBzY3JpcHQ7XG4gICAgdmFyIGNhbGxiYWNrTmFtZTtcbiAgICB2YXIgY29udGFpbmVyTm9kZTtcblxuICAgIFJlcXVlc2V0LmNhbGwodGhpcywgY29uc3RhbnRzLkpTT05QX1JFUVVFU1QsIG9wdGlvbnMsIG9uc3VjY2Vzcywgb25lcnJvcik7XG5cbiAgICAvLyBDYWxsIGBvcHRpb25zLmhhbmRsZU9wdGlvbnNgIHRvIGhhbmRsZSBvcHRpb25zLlxuICAgIGhhbmRsZU9wdGlvbnMob3B0aW9ucyk7XG5cbiAgICBzY3JpcHQgPSB0aGlzLnNjcmlwdCA9IG9wdGlvbnMuY3JlYXRlU2NyaXB0LmNhbGwobnVsbCwgb3B0aW9ucyk7XG4gICAgY29udGFpbmVyTm9kZSA9IG9wdGlvbnMuanNvbnBDb250YWluZXJOb2RlLmNhbGwobnVsbCwgb3B0aW9ucyk7XG4gICAgY2FsbGJhY2tOYW1lID0gYnVpbGRDYWxsYmFja05hbWUob3B0aW9ucyk7XG4gICAgc3JjID0gYnVpbGRTY3JpcHRTcmMob3B0aW9ucywgY2FsbGJhY2tOYW1lKTtcblxuICAgIC8vIFNldCB0aGUgc3JjIGF0dHJpYnV0ZS5cbiAgICBzY3JpcHQuc2V0QXR0cmlidXRlKCdzcmMnLCBzcmMpO1xuXG4gICAgLy8gSGFuZGxlIGBvcHRpb25zLmNvcnNgXG4gICAgaGFuZGxlU2NyaXB0Q29ycyhzY3JpcHQsIG9wdGlvbnMpO1xuXG4gICAgLy8gQWRkIGV2ZW50IGxpc3RlbmVyc1xuICAgIGFkZEV2ZW50TGlzdGVuZXJzKHRoaXMsIGNhbGxiYWNrTmFtZSk7XG5cbiAgICAvLyBJbmplY3QgdGhlIHNjcmlwdCBub2RlXG4gICAgY29udGFpbmVyTm9kZS5hcHBlbmRDaGlsZChzY3JpcHQpO1xuXG4gICAgLy8gQ2FsbCBvblJlcXVlc3RDcmVhdGVkXG4gICAgY2FsbFJlcXVlc3RDcmVhdGVkQ2FsbGJhY2sob3B0aW9ucywgdGhpcyk7XG59XG5cbmluaGVyaXRzKEpTT05QUmVxdWVzdCwgUmVxdWVzZXQpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEpTT05QUmVxdWVzdDtcbiIsIi8qKlxuICogSlNPTlBSZXNwb25zZSBtb2R1bGUuXG4gKlxuICogQG1vZHVsZSBjbGFzcy9KU09OUFJlc3BvbnNlXG4gKi9cblxudmFyIFJlc3BvbnNlID0gcmVxdWlyZSgxMCk7XG52YXIgaW5oZXJpdHMgPSByZXF1aXJlKDMxKTtcbnZhciBhZGRDdXN0b21QYXJzZXIgPSByZXF1aXJlKDIyKTtcblxuLyoqXG4gKiBUaGUgSlNPTlBSZXNwb25zZSBjbGFzcy5cbiAqXG4gKiBAY2xhc3NcbiAqIEBwYXJhbSB7SlNPTlJlcXVlc3R9IHJlcXVlc3QgVGhlIGh0dHAgcmVxdWVzdC5cbiAqL1xuZnVuY3Rpb24gSlNPTlBSZXNwb25zZShyZXF1ZXN0KSB7XG4gICAgUmVzcG9uc2UuY2FsbCh0aGlzLCByZXF1ZXN0KTtcbiAgICBhZGRDdXN0b21QYXJzZXIodGhpcywgcmVxdWVzdC5vcHRpb25zLCAnanNvbnBSZXNwb25zZVBhcnNlcicpO1xufVxuXG5pbmhlcml0cyhKU09OUFJlc3BvbnNlLCBSZXNwb25zZSk7XG5cbm1vZHVsZS5leHBvcnRzID0gSlNPTlBSZXNwb25zZTtcbiIsInZhciBSZXNwb25zZUVycm9yID0gcmVxdWlyZSgxMSk7XG52YXIgaW5oZXJpdHMgPSByZXF1aXJlKDMxKTtcbnZhciBhZGRDdXN0b21QYXJzZXIgPSByZXF1aXJlKDIyKTtcblxuLyoqXG4gKiBAY2xhc3NcbiAqIEBwYXJhbSB7c3RyaW5nfSBjb2RlIFRoZSBlcnJvciBjb2RlLlxuICogQHBhcmFtIHtKU09OUFJlcXVlc3R9IHJlcXVlc3QgVGhlIEpTT05QIHJlcXVlc3QuXG4gKi9cbmZ1bmN0aW9uIEpTT05QUmVzcG9uc2VFcnJvcihjb2RlLCByZXF1ZXN0KSB7XG4gICAgUmVzcG9uc2VFcnJvci5jYWxsKHRoaXMsIGNvZGUsIHJlcXVlc3QpO1xuICAgIGFkZEN1c3RvbVBhcnNlcih0aGlzLCByZXF1ZXN0Lm9wdGlvbnMsICdqc29ucFJlc3BvbnNlRXJyb3JQYXJzZXInKTtcbn1cblxuaW5oZXJpdHMoUmVzcG9uc2VFcnJvciwgSlNPTlBSZXNwb25zZUVycm9yKTtcblxubW9kdWxlLmV4cG9ydHMgPSBKU09OUFJlc3BvbnNlRXJyb3I7XG4iLCJ2YXIgdXVpZCA9IHJlcXVpcmUoMzQpO1xuXG4vKipcbiAqIFRoZSBiYXNlIFJlcWV1c3QgY2xhc3MuXG4gKlxuICogQGNsYXNzXG4gKiBAcGFyYW0ge3N0cmluZ30gdHlwZSBUaGUgdHlwZSBvZiByZXF1ZXN0LCBjYW4gYmUgYEhUVFBfUkVRVUVTVGAgb3IgYEpTT05QX1JFUVVFU1RgLlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICogQHBhcmFtIHtSZXF1ZXN0U3VjY2Vzc0NhbGxiYWNrfSBvbnN1Y2Nlc3MgVGhlIGNhbGxiYWNrIHRvIGNhbGwgb24gc3VjY2Vzcy5cbiAqIEBwYXJhbSB7UmVxdWVzdEVycm9yQ2FsbGJhY2t9IG9uZXJyb3IgVGhlIGNhbGxiYWNrIHRvIGNhbGwgb24gZXJyb3IuXG4gKi9cbmZ1bmN0aW9uIFJlcXVlc3QodHlwZSwgb3B0aW9ucywgb25zdWNjZXNzLCBvbmVycm9yKSB7XG4gICAgLyoqXG4gICAgICogSWYgdGhlcmUgaXMgYW4gZXJyb3IgaGFwcGVuZCwgdGhlIGBlcnJvckNvZGVgIGlzIGEgc3RyaW5nIHJlcHJzZW5ndGluZyB0aGUgdHlwZSBvZiB0eXBlIGVycm9yLiBJZiB0aGVyZSBpcyBub1xuICAgICAqIGVycm9yLCB0aGUgdmFsdWUgb2YgYGVycm9yQ29kZWAgaXMgYG51bGxgLlxuICAgICAqL1xuICAgIHRoaXMuZXJyb3JDb2RlID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFRoZSBgWE1MSHR0cFJlcXVlc3RgIHdlIHVzZSB3aGVuIHNlbmRpbmcgaHR0cCByZXF1ZXN0LlxuICAgICAqL1xuICAgIHRoaXMueGhyID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFRoZSBgSFRNTFNjcmlwdEVsZW1lbnRgIHdlIHVzZSB3aGVuIHNlbmRpbmcganNvbiByZXF1ZXN0LlxuICAgICAqL1xuICAgIHRoaXMuc2NyaXB0ID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFdoZXRoZXIgdGhlIHJlcXVlc3QgaXMgZmluaXNoZWQuXG4gICAgICovXG4gICAgdGhpcy5maW5pc2hlZCA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHJlc3BvbnNlIEpTT04gZGF0YSBvZiB0aGUgSlNPTlAgcmVxdWVzdC5cbiAgICAgKi9cbiAgICB0aGlzLnJlc3BvbnNlSlNPTiA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBBbiB1bmlxdWUgaWQgZm9yIHRoaXMgcmVxdWVzdC5cbiAgICAgKi9cbiAgICB0aGlzLnJlcXVlc3RJZCA9IHV1aWQoKTtcblxuICAgIC8qKlxuICAgICAqIFRoZSB0eXBlIG9mIHJlcXVlc3QsIGNhbiBiZSBgSFRUUF9SRVFVRVNUYCBvciBgSlNPTlBfUkVRVUVTVGAuXG4gICAgICovXG4gICAgdGhpcy5yZXF1ZXN0VHlwZSA9IHR5cGU7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICAgICAqL1xuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbmFtZSBvZiB0aGUgZnVuY3Rpb24gdGhhdCBjcmVhdGUgdGhpcyByZXF1ZXN0LiBDYW4gYmUgYHNlbmRgLCBgZmV0Y2hgLCBgZ2V0Sk9TTlBgLCBgZmV0Y2hKU09OUGAuIFRoaXMgdmFsdWVcbiAgICAgKiBpcyBzZXQgYnkgdGhlIGxpYnJheSBpdHNlbGYuXG4gICAgICovXG4gICAgdGhpcy5yZXF1ZXN0RnVuY3Rpb25OYW1lID0gb3B0aW9ucy5yZXF1ZXN0RnVuY3Rpb25OYW1lO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGBDYW5jZWxDb250cm9sbGVyYCB0aGF0IHVzZWQgdG8gY2FuY2VsIHRoaXMgcmVxdWVzdC4gV2UgbmV2ZXIgdXNlIHRoaXMgcHJvcGVydHkgaW50ZXJuYWxseSwganVzdCBob2xkaW5nIHRoZVxuICAgICAqIGluZm9ybWF0aW9uIGluIGNhc2UgdGhhdCB0aGUgdXNlciBuZWVkcy5cbiAgICAgKi9cbiAgICB0aGlzLmNvbnRyb2xsZXIgPSBvcHRpb25zLmNvbnRyb2xsZXIgfHwgbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFRoZSBjYWxsYmFjayB0byBjYWxsIG9uIHN1Y2Nlc3MuXG4gICAgICovXG4gICAgdGhpcy5vbnN1Y2Nlc3MgPSBvbnN1Y2Nlc3MgfHwgbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFRoZSBjYWxsYmFjayB0byBjYWxsIG9uIGVycm9yLlxuICAgICAqL1xuICAgIHRoaXMub25lcnJvciA9IG9uZXJyb3IgfHwgbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFNldCB0aGUgcmVxdWVzdCB0eXBlIGJhY2suXG4gICAgICovXG4gICAgb3B0aW9ucy5yZXF1ZXN0VHlwZSA9IHR5cGU7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gUmVxdWVzdDtcbiIsIi8qKlxuICogUmVwcmVzZW50cyBhIHJlc3BvbnNlLlxuICpcbiAqIEBwYXJhbSB7UmVxdWVzdH0gcmVxdWVzdCBUaGUgaW5zdGFuY2Ugb2YgYFJlcXVlc3RgLlxuICovXG5mdW5jdGlvbiBSZXNwb25zZShyZXF1ZXN0KSB7XG4gICAgLyoqXG4gICAgICogQHR5cGUge1JlcXVlc3R9XG4gICAgICovXG4gICAgdGhpcy5yZXF1ZXN0ID0gcmVxdWVzdDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBSZXNwb25zZTtcbiIsInZhciBlcnJvck1lc3NhZ2VzID0ge1xuICAgIEVSUl9BQk9SVEVEOiAnUmVxdWVzdCBhYm9ydGVkJyxcbiAgICBFUlJfQ0FOQ0VMTEVEOiAnUmVxdWVzdCBjYW5jZWxsZWQnLFxuICAgIEVSUl9ORVRXT1JLOiAnTmV0d29yayBlcnJvcicsXG4gICAgRVJSX1JFU1BPTlNFOiAnUmVzcG9uc2UgZXJyb3InLFxuICAgIEVSUl9USU1FT1VUOiAnUmVxdWVzdCB0aW1lb3V0J1xufTtcblxuLyoqXG4gKiBSZXByZXNlbnRzIHJlc3BvbnNlIGVycm9yLlxuICpcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHtzdHJpbmd9IGNvZGUgVGhlIGVycm9yIGNvZGUuXG4gKiBAcGFyYW0ge1JlcXVlc3R9IHJlcXVlc3QgVGhlIHJlcXVlc3QuXG4gKi9cbmZ1bmN0aW9uIFJlc3BvbnNlRXJyb3IoY29kZSwgcmVxdWVzdCkge1xuICAgIHZhciBtZXNzYWdlO1xuXG4gICAgY29kZSA9IGNvZGUgfHwgJ0VSUl9VTktOT1dOJztcblxuICAgIGlmIChlcnJvck1lc3NhZ2VzW2NvZGVdKSB7XG4gICAgICAgIG1lc3NhZ2UgPSBlcnJvck1lc3NhZ2VzW2NvZGVdO1xuICAgIH1cblxuICAgIGlmICghbWVzc2FnZSkge1xuICAgICAgICBtZXNzYWdlID0gJ1Vua25vd24gZXJyb3IgJyArIGNvZGU7XG4gICAgfVxuXG4gICAgcmVxdWVzdC5lcnJvckNvZGUgPSBjb2RlO1xuXG4gICAgdGhpcy5jb2RlID0gY29kZTtcbiAgICB0aGlzLnJlcXVlc3QgPSByZXF1ZXN0O1xuICAgIHRoaXMubWVzc2FnZSA9IG1lc3NhZ2U7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gUmVzcG9uc2VFcnJvcjtcbiIsInZhciBpc0Z1bmN0aW9uID0gcmVxdWlyZSgzOCk7XG52YXIgSHR0cFJlc3BvbnNlID0gcmVxdWlyZSg0KTtcbnZhciBhZGRUaW1lb3V0TGlzdGVuZXIgPSByZXF1aXJlKDEzKTtcbnZhciBmaXJlQ2FsbGJhY2tzID0gcmVxdWlyZSgyOSk7XG52YXIgbm9vcCA9IHJlcXVpcmUoMzIpO1xudmFyIGNvbnN0YW50cyA9IHJlcXVpcmUoMjUpO1xudmFyIEVSUl9BQk9SVEVEICAgPSBjb25zdGFudHMuRVJSX0FCT1JURUQ7XG52YXIgRVJSX0NBTkNFTExFRCA9IGNvbnN0YW50cy5FUlJfQ0FOQ0VMTEVEO1xudmFyIEVSUl9ORVRXT1JLICAgPSBjb25zdGFudHMuRVJSX05FVFdPUks7XG52YXIgRVJSX1JFU1BPTlNFICA9IGNvbnN0YW50cy5FUlJfUkVTUE9OU0U7XG52YXIgRVJSX1RJTUVPVVQgICA9IGNvbnN0YW50cy5FUlJfVElNRU9VVDtcblxuLyoqXG4gKiBBZGQgZXZlbnQgbGlzdGVuZXJzIHRvIHRoZSBodHRwIHJlcXVlc3QuIFRoaXMgZnVuY3Rpb24gd2lsbCBvdmVyd2l0ZSB0aGUgYGNhbmNlbGAgbWV0aG9kIG9uIHRoZSBnaXZlbiBgSHR0cFJlcWVzdGBcbiAqIGluc3RhbmNlLlxuICpcbiAqIEBwYXJhbSB7SHR0cFJlcXVlc3R9IHJlcXVlc3QgVGhlIGh0dHAgcmVxdWVzdCB0byBhZGQgZXZlbnQgbGlzdGVuZXJzLlxuICovXG5mdW5jdGlvbiBhZGRFdmVudExpc3RlbmVycyhyZXF1ZXN0KSB7XG4gICAgdmFyIHhociA9IHJlcXVlc3QueGhyO1xuICAgIHZhciBvcHRpb25zID0gcmVxdWVzdC5vcHRpb25zO1xuICAgIHZhciByZXF1ZXN0VHlwZSA9IHJlcXVlc3QucmVxdWVzdFR5cGU7XG4gICAgdmFyIHJlc3BvbnNlID0gbmV3IEh0dHBSZXNwb25zZShyZXF1ZXN0KTtcbiAgICB2YXIgaXNSZXNwb25zZU9rID0gb3B0aW9ucy5pc1Jlc3BvbnNlT2s7XG4gICAgdmFyIGNsZWFyVGltZW91dEV2ZW50ID0gbnVsbDtcbiAgICB2YXIgdGltZW91dCA9IHBhcnNlSW50KG9wdGlvbnMudGltZW91dCB8fCAwLCAxMCk7XG5cbiAgICAvKipcbiAgICAgKiBDYW5jZWwgdGhlIHJlcXVlc3QuXG4gICAgICovXG4gICAgdmFyIGNhbmNlbCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgY2xlYXJFdmVudHMoKTtcbiAgICAgICAgaWYgKHhoci5hYm9ydCkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICB4aHIuYWJvcnQoKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHt9XG4gICAgICAgIH1cbiAgICAgICAgZmluaXNoKEVSUl9DQU5DRUxMRUQpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZnVuY3Rpb24gdG8gY2xlYXIgZXZlbnRzLlxuICAgICAqL1xuICAgIHZhciBjbGVhckV2ZW50cyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLy8gU2V0IGNsZWFyRXZlbnRzIHRvIHRoZSBub29wIGZ1bmN0aW9uLlxuICAgICAgICBjbGVhckV2ZW50cyA9IG5vb3A7XG5cbiAgICAgICAgeGhyLm9uYWJvcnQgPSBudWxsO1xuICAgICAgICB4aHIub25lcnJvciA9IG51bGw7XG4gICAgICAgIHhoci5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBudWxsO1xuICAgICAgICB4aHIub250aW1lb3V0ID0gbnVsbDtcblxuICAgICAgICBpZiAoY2xlYXJUaW1lb3V0RXZlbnQpIHtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dEV2ZW50KCk7XG4gICAgICAgICAgICBjbGVhclRpbWVvdXRFdmVudCA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogVGhlIGZ1bmN0aW9uIGZpbmlzaCB0aGUgcmVxdWVzdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBjb2RlIFRoZSBlcnJvciBjb2RlIG9uIGVycm9yLiBJZiBubyBlcnJvciBvY2N1cmVkLCB0aGUgY29kZSBpcyBgbnVsbGAuXG4gICAgICovXG4gICAgdmFyIGZpbmlzaCA9IGZ1bmN0aW9uIChjb2RlKSB7XG4gICAgICAgIC8vIFNldCBmaW5pc2ggdG8gdGhlIG5vb3AgZnVuY3Rpb24uXG4gICAgICAgIGZpbmlzaCA9IG5vb3A7XG5cbiAgICAgICAgLy8gU2V0IGNhbmNlbCB0byB0aGUgbm9vcCBmdW5jdGlvbi5cbiAgICAgICAgY2FuY2VsID0gbm9vcDtcblxuICAgICAgICAvLyBNYXJrIHRoaXMgcmVxdWVzdCBhcyBmaW5pc2hlZC5cbiAgICAgICAgcmVxdWVzdC5maW5pc2hlZCA9IHRydWU7XG5cbiAgICAgICAgLy8gQ2xlYXIgZXZlbnRzLlxuICAgICAgICBjbGVhckV2ZW50cygpO1xuXG4gICAgICAgIC8vIEZpcmUgY2FsbGJhY2tzLlxuICAgICAgICBmaXJlQ2FsbGJhY2tzKGNvZGUsIHJlc3BvbnNlKTtcbiAgICB9O1xuXG4gICAgeGhyLm9uYWJvcnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGZpbmlzaChFUlJfQUJPUlRFRCk7XG4gICAgfTtcblxuICAgIHhoci5vbmVycm9yID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBmaW5pc2goRVJSX05FVFdPUkspO1xuICAgIH07XG5cbiAgICB4aHIub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoK3hoci5yZWFkeVN0YXRlID09PSA0KSB7XG4gICAgICAgICAgICBpZiAoaXNGdW5jdGlvbihpc1Jlc3BvbnNlT2spKSB7XG4gICAgICAgICAgICAgICAgaWYgKGlzUmVzcG9uc2VPayhyZXF1ZXN0VHlwZSwgcmVzcG9uc2UpKSB7XG4gICAgICAgICAgICAgICAgICAgIGZpbmlzaChudWxsKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBmaW5pc2goRVJSX1JFU1BPTlNFKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGZpbmlzaChudWxsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBDYW5jZWwgdGhlIHJlcXVlc3QuXG4gICAgICovXG4gICAgcmVxdWVzdC5jYW5jZWwgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNhbmNlbCgpO1xuICAgIH07XG5cbiAgICAvLyBBZGQgdGltZW91dCBsaXN0ZW5lclxuICAgIGlmICghaXNOYU4odGltZW91dCkgJiYgdGltZW91dCA+IDApIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0RXZlbnQgPSBhZGRUaW1lb3V0TGlzdGVuZXIoeGhyLCB0aW1lb3V0LCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBjbGVhckV2ZW50cygpO1xuICAgICAgICAgICAgaWYgKHhoci5hYm9ydCkge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIHhoci5hYm9ydCgpO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHt9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmaW5pc2goRVJSX1RJTUVPVVQpO1xuICAgICAgICB9KTtcbiAgICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYWRkRXZlbnRMaXN0ZW5lcnM7XG4iLCIvKipcbiAqIEFkZCB0aW1lb3V0IGV2ZW50IGxpc3RlbmVyIG9uIHRoZSBYSFIgb2JqZWN0LlxuICpcbiAqIEBwYXJhbSB7WE1MSHR0cFJlcXVlc3R9IHhociBUaGUgWEhSIHRvIGFkZCB0aW1lb3V0IGV2ZW50IGxpc3RlbmVyLlxuICogQHBhcmFtIHtudW1iZXJ9IHRpbWVvdXQgVGhlIHRpbWUgdG8gd2FpdCBpbiBtaWxsaXNlY29uZHMuXG4gKiBAcGFyYW0geygpID0+IHZvaWR9IGxpc3RlbmVyIFRoZSB0aW1lb3V0IGNhbGxiYWNrLlxuICogQHJldHVybnMgeygpID0+IHZvaWQpfSBSZXR1cm5zIGEgZnVuY3Rpb24gdG8gcmVtb3ZlIHRoZSB0aW1lb3V0IGV2ZW50IGxpc3RlbmVyLlxuICovXG5mdW5jdGlvbiBhZGRUaW1lb3V0TGlzdGVuZXIoeGhyLCB0aW1lb3V0LCBsaXN0ZW5lcikge1xuICAgIHZhciB0aW1lb3V0SWQgPSBudWxsO1xuICAgIHZhciBzdXBwb3J0VGltZW91dCA9ICd0aW1lb3V0JyBpbiB4aHIgJiYgJ29udGltZW91dCcgaW4geGhyO1xuXG4gICAgaWYgKHN1cHBvcnRUaW1lb3V0KSB7XG4gICAgICAgIHhoci50aW1lb3V0ID0gdGltZW91dDtcbiAgICAgICAgeGhyLm9udGltZW91dCA9IGxpc3RlbmVyO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRpbWVvdXRJZCA9IHNldFRpbWVvdXQobGlzdGVuZXIsIHRpbWVvdXQpO1xuICAgIH1cblxuICAgIC8vIENhbGwgdGhpcyBmdW5jdGlvbiB0byByZW1vdmUgdGltZW91dCBldmVudCBsaXN0ZW5lclxuICAgIGZ1bmN0aW9uIGNsZWFyVGltZW91dEV2ZW50KCkge1xuICAgICAgICBpZiAoeGhyKSB7XG4gICAgICAgICAgICBpZiAodGltZW91dElkID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgeGhyLm9udGltZW91dCA9IG51bGw7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgeGhyID0gbnVsbDtcbiAgICAgICAgICAgIGxpc3RlbmVyID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBjbGVhclRpbWVvdXRFdmVudDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBhZGRUaW1lb3V0TGlzdGVuZXI7XG4iLCJ2YXIgaXNGdW5jdGlvbiA9IHJlcXVpcmUoMzgpO1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBjYWxsIHhociBob29rIGZ1bmN0aW9uLlxuICpcbiAqIEBwYXJhbSB7WEhSSG9va0Z1bmN0aW9ufSBmdW5jIFRoZSBob29rIGZ1bmN0aW9uIHRvIGNhbGwsIGlmIGl0IGlzIG5vdCBmdW5jdGlvbiwgdGhpcyBob29rIGlzIHNraXBwZWQuXG4gKiBAcGFyYW0ge1hNTEh0dHBSZXFldXN0fSB4aHIgVGhlIGluc3RhbmNlIG9mIGBYTUxIdHRwUmVxZXVzdGAuXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb259IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqL1xuZnVuY3Rpb24gY2FsbFhockhvb2soZnVuYywgeGhyLCBvcHRpb25zKSB7XG4gICAgaWYgKGlzRnVuY3Rpb24oZnVuYykpIHtcbiAgICAgICAgZnVuYyh4aHIsIG9wdGlvbnMpO1xuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBjYWxsWGhySG9vaztcbiIsInZhciBtZXJnZSA9IHJlcXVpcmUoNDApO1xudmFyIGlzUGxhaW5PYmplY3QgPSByZXF1aXJlKDM5KTtcbnZhciBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBzZXQgdGhlIHJlcXVlc3QgaGVhZGVycy5cbiAqXG4gKiAxLiBNZXJnZSB0aGUgYG9wdGlvbnMubm9DYWNoZUhlYWRlcnNgIGlmIG5lZWRlZC5cbiAqIDIuIFNldCB0aGUgcmVxdWVzdCBoZWFkZXJzIGlmIG5lZWRlZC5cbiAqXG4gKiBAcGFyYW0ge1hNTEh0dHBSZXFldXN0fSB4aHIgVGhlIGluc3RhbmNlIG9mIGBYTUxIdHRwUmVxZXVzdGAuXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb259IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqL1xuZnVuY3Rpb24gaGFuZGxlSGVhZGVycyh4aHIsIG9wdGlvbnMpIHtcbiAgICB2YXIgbmFtZTtcbiAgICB2YXIgdmFsdWU7XG4gICAgdmFyIGhlYWRlcnMgPSBpc1BsYWluT2JqZWN0KG9wdGlvbnMuaGVhZGVycykgPyBvcHRpb25zLmhlYWRlcnMgOiB7fTtcblxuICAgIGlmIChvcHRpb25zLm5vQ2FjaGUpIHtcbiAgICAgICAgaWYgKGlzUGxhaW5PYmplY3Qob3B0aW9ucy5ub0NhY2hlSGVhZGVycykpIHtcbiAgICAgICAgICAgIGhlYWRlcnMgPSBtZXJnZShoZWFkZXJzLCBvcHRpb25zLm5vQ2FjaGVIZWFkZXJzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZvciAobmFtZSBpbiBoZWFkZXJzKSB7XG4gICAgICAgIGlmIChoYXNPd24uY2FsbChoZWFkZXJzLCBuYW1lKSkge1xuICAgICAgICAgICAgdmFsdWUgPSBoZWFkZXJzW25hbWVdO1xuICAgICAgICAgICAgLy8gT25seSB0aGUgbm9uLXVuZGVmaW5lZCBhbmQgbm9uLW51bGwgaGVhZGVycyBhcmUgc2V0XG4gICAgICAgICAgICBpZiAodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKG5hbWUsIHZhbHVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIFNldCB0aGUgaGVhZGVycyBiYWNrLlxuICAgIG9wdGlvbnMuaGVhZGVycyA9IGhlYWRlcnM7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaGFuZGxlSGVhZGVycztcbiIsInZhciBtZXJnZSA9IHJlcXVpcmUoNDApO1xudmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKDM4KTtcbnZhciBpc1BsYWluT2JqZWN0ID0gcmVxdWlyZSgzOSk7XG52YXIgaGFzT3duID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcblxuLyoqXG4gKiBGaW5kIGEgcHJvY2Vzc29yIGZyb20gYG9wdGlvbnMuaHR0cFJlcXVlc3RCb2R5UHJvY2Vzc29yYCB0byBwcm9jZXNzIHRoZSByZXF1ZXN0IGJvZHkuXG4gKlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICogQHJldHVybnMge2FueX0gUmV0cnVucyB0aGUgY29udGVudCB0aGF0IHNlbmQgdG8gdGhlIHNlcnZlci5cbiAqL1xuZnVuY3Rpb24gaGFuZGxlUmVxdWVzdEJvZHkob3B0aW9ucykge1xuICAgIHZhciBpO1xuICAgIHZhciBsO1xuICAgIHZhciBrZXk7XG4gICAgdmFyIGNvbnRlbnQgPSBudWxsO1xuICAgIHZhciBwcm9jZXNzb3I7XG4gICAgdmFyIGNvbnRlbnRQcm9jZXNzb3I7XG4gICAgdmFyIGNvbnRlbnRQcm9jZXNzb3JzID0gW107XG4gICAgdmFyIGJvZHkgPSBvcHRpb25zLmJvZHk7XG4gICAgdmFyIHByb2Nlc3NvcnMgPSBvcHRpb25zLmh0dHBSZXF1ZXN0Qm9keVByb2Nlc3NvcjtcbiAgICB2YXIgaGVhZGVycyA9IGlzUGxhaW5PYmplY3Qob3B0aW9ucy5oZWFkZXJzKSA/IG9wdGlvbnMuaGVhZGVycyA6IHt9O1xuXG4gICAgaWYgKGlzUGxhaW5PYmplY3QoYm9keSkgJiYgaXNQbGFpbk9iamVjdChwcm9jZXNzb3JzKSkge1xuICAgICAgICAvLyBGaW5kIGFsbCBwcm9jZXNzb3JzLlxuICAgICAgICBmb3IgKGtleSBpbiBwcm9jZXNzb3JzKSB7XG4gICAgICAgICAgICBpZiAoaGFzT3duLmNhbGwocHJvY2Vzc29ycywga2V5KSkge1xuICAgICAgICAgICAgICAgIHByb2Nlc3NvciA9IHByb2Nlc3NvcnNba2V5XTtcbiAgICAgICAgICAgICAgICBpZiAoaXNQbGFpbk9iamVjdChwcm9jZXNzb3IpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRlbnRQcm9jZXNzb3JzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAga2V5OiBrZXksXG4gICAgICAgICAgICAgICAgICAgICAgICBoZWFkZXJzOiBwcm9jZXNzb3IuaGVhZGVycyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHByaW9yaXR5OiBwcm9jZXNzb3IucHJpb3JpdHksXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9jZXNzb3I6IHByb2Nlc3Nvci5wcm9jZXNzb3JcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gU29ydCB0aGUgcHJvY2Vzc29ycyBieSBpdHMgcHJpb3JpdHkuXG4gICAgICAgIGNvbnRlbnRQcm9jZXNzb3JzLnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgICAgICAgIHJldHVybiBiLnByaW9yaXR5IC0gYS5wcmlvcml0eTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gRmluZCB0aGUgZmlyc3Qgbm9uLXVuZGVmaW5lZCBjb250ZW50LlxuICAgICAgICBmb3IgKGkgPSAwLCBsID0gY29udGVudFByb2Nlc3NvcnMubGVuZ3RoOyBpIDwgbDsgaSArPSAxKSB7XG4gICAgICAgICAgICBwcm9jZXNzb3IgPSBjb250ZW50UHJvY2Vzc29yc1tpXTtcbiAgICAgICAgICAgIGlmIChib2R5W3Byb2Nlc3Nvci5rZXldICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBjb250ZW50ID0gYm9keVtwcm9jZXNzb3Iua2V5XTtcbiAgICAgICAgICAgICAgICBjb250ZW50UHJvY2Vzc29yID0gcHJvY2Vzc29yO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gVXNlIHRoZSBwcm9jZXNzb3IgdG8gcHJvY2VzcyB0aGUgY29udGVudC5cbiAgICAgICAgaWYgKGNvbnRlbnRQcm9jZXNzb3IpIHtcbiAgICAgICAgICAgIGlmIChpc1BsYWluT2JqZWN0KGNvbnRlbnRQcm9jZXNzb3IuaGVhZGVycykpIHtcbiAgICAgICAgICAgICAgICBoZWFkZXJzID0gbWVyZ2UoaGVhZGVycywgY29udGVudFByb2Nlc3Nvci5oZWFkZXJzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHByb2Nlc3NvciA9IGNvbnRlbnRQcm9jZXNzb3IucHJvY2Vzc29yO1xuICAgICAgICAgICAgaWYgKGlzRnVuY3Rpb24ocHJvY2Vzc29yKSkge1xuICAgICAgICAgICAgICAgIGNvbnRlbnQgPSBwcm9jZXNzb3IoY29udGVudCwgb3B0aW9ucyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBNYWtlIHN1cmUgdGhhdCB0aGUgaGVhZGVycyBpcyBhIHBsYWluIG9iamVjdC5cbiAgICBvcHRpb25zLmhlYWRlcnMgPSBoZWFkZXJzO1xuXG4gICAgcmV0dXJuIGNvbnRlbnQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaGFuZGxlUmVxdWVzdEJvZHk7XG4iLCJ2YXIgaXNQbGFpbk9iamVjdCA9IHJlcXVpcmUoMzkpO1xudmFyIGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGhhbmxkZSBYTUxIdHRwUmVxdWVzdCBwcm9wZXJ0aWVzLlxuICpcbiAqIEBwYXJhbSB7WE1MSHR0cFJlcXVlc3R9IHhociBUaGUgaW5zdGFuY2Ugb2YgYFhNTEh0dHBSZXF1ZXN0YC5cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqL1xuZnVuY3Rpb24gaGFuZGxlWGhyUHJvcHMoeGhyLCBvcHRpb25zKSB7XG4gICAgdmFyIHByb3A7XG4gICAgdmFyIHhoclByb3BzID0gb3B0aW9ucy54aHJQcm9wcztcblxuICAgIGlmIChvcHRpb25zLmNvcnMpIHtcbiAgICAgICAgeGhyLndpdGhDcmVkZW50aWFscyA9IHRydWU7XG4gICAgfVxuXG4gICAgaWYgKGlzUGxhaW5PYmplY3QoeGhyUHJvcHMpKSB7XG4gICAgICAgIGZvciAocHJvcCBpbiB4aHJQcm9wcykge1xuICAgICAgICAgICAgaWYgKGhhc093bi5jYWxsKHhoclByb3BzLCBwcm9wKSkge1xuICAgICAgICAgICAgICAgIHhocltwcm9wXSA9IHhoclByb3BzW3Byb3BdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGhhbmRsZVhoclByb3BzO1xuIiwidmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKDM4KTtcbnZhciBKU09OUFJlc3BvbnNlID0gcmVxdWlyZSg3KTtcbnZhciBmaXJlQ2FsbGJhY2tzID0gcmVxdWlyZSgyOSk7XG52YXIgbm9vcCA9IHJlcXVpcmUoMzIpO1xudmFyIGNvbnN0YW50cyA9IHJlcXVpcmUoMjUpO1xudmFyIEVSUl9DQU5DRUxMRUQgPSBjb25zdGFudHMuRVJSX0NBTkNFTExFRDtcbnZhciBFUlJfTkVUV09SSyAgID0gY29uc3RhbnRzLkVSUl9ORVRXT1JLO1xudmFyIEVSUl9SRVNQT05TRSAgPSBjb25zdGFudHMuRVJSX1JFU1BPTlNFO1xudmFyIEVSUl9USU1FT1VUICAgPSBjb25zdGFudHMuRVJSX1RJTUVPVVQ7XG5cbmZ1bmN0aW9uIGFkZEV2ZW50TGlzdGVuZXJzKHJlcXVlc3QsIGNhbGxiYWNrTmFtZSkge1xuICAgIHZhciBzY3JpcHQgPSByZXF1ZXN0LnNjcmlwdDtcbiAgICB2YXIgb3B0aW9ucyA9IHJlcXVlc3Qub3B0aW9ucztcbiAgICB2YXIgcmVxdWVzdFR5cGUgPSByZXF1ZXN0LnJlcXVlc3RUeXBlO1xuICAgIHZhciBpc1Jlc3BvbnNlT2sgPSBvcHRpb25zLmlzUmVzcG9uc2VPaztcbiAgICB2YXIgcmVzcG9uc2UgPSBuZXcgSlNPTlBSZXNwb25zZShyZXF1ZXN0KTtcbiAgICB2YXIgdGltZW91dCA9IHBhcnNlSW50KG9wdGlvbnMudGltZW91dCB8fCAwLCAxMCk7XG4gICAgdmFyIHRpbWVvdXRJZCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZnVuY3Rpb24gZmluaXNoIHRoZSByZXF1ZXN0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGNvZGUgVGhlIGVycm9yIGNvZGUgb24gZXJyb3IuIElmIG5vIGVycm9yIG9jY3VyZWQsIHRoZSBjb2RlIGlzIGBudWxsYC5cbiAgICAgKi9cbiAgICB2YXIgZmluaXNoID0gZnVuY3Rpb24gKGNvZGUpIHtcbiAgICAgICAgLy8gU2V0IGZpbmlzaCB0byB0aGUgbm8gb3BlcmF0aW9uIGZ1bmN0aW9uLlxuICAgICAgICBmaW5pc2ggPSBub29wO1xuXG4gICAgICAgIC8vIE1hcmsgdGhpcyByZXF1ZXN0IGFzIGZpbmlzaGVkLlxuICAgICAgICByZXF1ZXN0LmZpbmlzaGVkID0gdHJ1ZTtcblxuICAgICAgICAvLyBDbGVhciBsaXN0ZW5lcnMuXG4gICAgICAgIHdpbmRvd1tjYWxsYmFja05hbWVdID0gbm9vcDtcbiAgICAgICAgc2NyaXB0Lm9uZXJyb3IgPSBudWxsO1xuXG4gICAgICAgIC8vIENsZWFyIHRpbWVvdXQuXG4gICAgICAgIGlmICh0aW1lb3V0SWQgIT09IG51bGwpIHtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xuICAgICAgICAgICAgdGltZW91dElkID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEZpcmUgY2FsbGJhY2tzLlxuICAgICAgICBmaXJlQ2FsbGJhY2tzKGNvZGUsIHJlc3BvbnNlKTtcbiAgICB9O1xuXG4gICAgLy8gRGVmaW5lIHRoZSBjYWxsYmFjayBmdW5jdGlvbi5cbiAgICB3aW5kb3dbY2FsbGJhY2tOYW1lXSA9IGZ1bmN0aW9uIChyZXNwb25zZUpTT04pIHtcbiAgICAgICAgcmVxdWVzdC5yZXNwb25zZUpTT04gPSByZXNwb25zZUpTT047XG4gICAgICAgIGlmIChpc0Z1bmN0aW9uKGlzUmVzcG9uc2VPaykpIHtcbiAgICAgICAgICAgIGlmIChpc1Jlc3BvbnNlT2socmVxdWVzdFR5cGUsIHJlc3BvbnNlKSkge1xuICAgICAgICAgICAgICAgIGZpbmlzaChudWxsKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZmluaXNoKEVSUl9SRVNQT05TRSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmaW5pc2gobnVsbCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gQ2F0Y2ggdGhlIGVycm9yLlxuICAgIHNjcmlwdC5vbmVycm9yID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBmaW5pc2goRVJSX05FVFdPUkspO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBDYW5jZWwgdGhlIHJlcXVlc3QuXG4gICAgICovXG4gICAgcmVxdWVzdC5jYW5jZWwgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGZpbmlzaChFUlJfQ0FOQ0VMTEVEKTtcbiAgICB9O1xuXG4gICAgLy8gQWRkIHRpbWVvdXQgbGlzdGVuZXJcbiAgICBpZiAoIWlzTmFOKHRpbWVvdXQpICYmIHRpbWVvdXQgPiAwKSB7XG4gICAgICAgIHRpbWVvdXRJZCA9IHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgZmluaXNoKEVSUl9USU1FT1VUKTtcbiAgICAgICAgfSwgdGltZW91dCk7XG4gICAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGFkZEV2ZW50TGlzdGVuZXJzO1xuIiwiLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gY3JlYXRlIEpTT05QIGNhbGxiYWNrIG5hbWUuXG4gKlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICogQHJldHVybnMge3N0cmluZ30gUmV0dXJucyB0aGUgY2FsbGJhY2sgbmFtZS5cbiAqL1xuZnVuY3Rpb24gYnVpbGRDYWxsbGJhY2tOYW1lKG9wdGlvbnMpIHtcbiAgICB2YXIgY2FsbGJhY2tOYW1lO1xuXG4gICAgZG8ge1xuICAgICAgICBjYWxsYmFja05hbWUgPSBvcHRpb25zLmpzb25wQ2FsbGJhY2tOYW1lLmNhbGwobnVsbCwgb3B0aW9ucyk7XG4gICAgfSB3aGlsZSAoY2FsbGJhY2tOYW1lIGluIHdpbmRvdyk7XG5cbiAgICB3aW5kb3dbY2FsbGJhY2tOYW1lXSA9IG51bGw7XG5cbiAgICByZXR1cm4gY2FsbGJhY2tOYW1lO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGJ1aWxkQ2FsbGxiYWNrTmFtZTtcbiIsInZhciBidWlsZFVSTCA9IHJlcXVpcmUoMjMpO1xuXG4vKipcbiAqIEJ1aWxkIHRoZSBKU09OUCBzY3JpcHQgc3JjLlxuICpcbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3BpdG9ucy5cbiAqIEBwYXJhbSB7c3RyaW5nfSBjYWxsYmFja05hbWUgVGhlIGNhbGxiYWNrIG5hbWUgb2YgdGhlIEpTT05QLlxuICogQHJldHVybiB7c3RyaW5nfSBSZXR1cm5zIHRoZSBzY3JpcHQgc3JjLlxuICovXG5mdW5jdGlvbiBidWlsZFNjcmlwdFNyYyhvcHRpb25zLCBjYWxsYmFja05hbWUpIHtcbiAgICB2YXIgcXVlcnkgPSBvcHRpb25zLnF1ZXJ5O1xuICAgIHZhciBrZXkgPSBvcHRpb25zLmpzb25wO1xuICAgIHZhciB1cmw7XG5cbiAgICBpZiAoIXF1ZXJ5KSB7XG4gICAgICAgIHF1ZXJ5ID0ge307XG4gICAgICAgIG9wdGlvbnMucXVlcnkgPSBxdWVyeTtcbiAgICB9XG5cbiAgICBxdWVyeVtrZXldID0gY2FsbGJhY2tOYW1lO1xuICAgIHVybCA9IGJ1aWxkVVJMKG9wdGlvbnMpO1xuXG4gICAgcmV0dXJuIHVybDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBidWlsZFNjcmlwdFNyYztcbiIsIi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGhhbmRsZSBgb3B0aW9ucy5jb3JzYCBzZXR0aW5nIHdoZW4gc2VuZGluZyBKU09OUCByZXF1ZXN0cy4gSWYgYG9wdGlvbnMuY29yc2AgaXMgYHRydWVgLCB0aGVcbiAqIGBjcm9zc29yaWdpbmAgYXR0cmlidXRlIG9mIHRoZSBgc2NyaXB0YCBlbGVtZW50IHdlIHVzaW5nIGlzIHNldCB0byBgdXNlLWNyZWRlbnRpYWxzYC5cbiAqXG4gKiBAcGFyYW0ge0hUTUxTY3JpcHRFbGVtZW50fSBzY3JpcHQgVGhlIHNjcmlwdCBlbGVtZW50LlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICovXG5mdW5jdGlvbiBoYW5kbGVTY3JpcHRDb3JzKHNjcmlwdCwgb3B0aW9ucykge1xuICAgIGlmIChvcHRpb25zLmNvcnMpIHtcbiAgICAgICAgc2NyaXB0LnNldEF0dHJpYnV0ZSgnY3Jvc3NvcmlnaW4nLCAndXNlLWNyZWRlbnRpYWxzJyk7XG4gICAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGhhbmRsZVNjcmlwdENvcnM7XG4iLCJ2YXIgaXNQbGFpbk9iamVjdCA9IHJlcXVpcmUoMzkpO1xudmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKDM4KTtcbnZhciBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBhZGQgY3VzdG9tIHBhcnNlcnMgdG8gdGhlIGluc3RhbmNlIG9mIGBSZXNwb25zZWAgb3IgYFJlc3BvbnNlRXJyb3JgLlxuICpcbiAqIEBwYXJhbSB7UmVzcG9uc2V8UmVzcG9uc2VFcnJvcn0gdGFyZ2V0IFRoZSB0YXJnZXQgdG8gYWRkIHRoZSBjdXN0b21lIHBhcnNlcnMuXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcGFyYW0ge3N0cmluZ30gb3B0aW9uTmFtZSBUaGUgb3B0aW9uIG5hbWUgdGhlIHBhcnNlcnMgY29udGFpbmVyLlxuICovXG5mdW5jdGlvbiBhZGRDdXN0b21QYXJzZXIodGFyZ2V0LCBvcHRpb25zLCBvcHRpb25OYW1lKSB7XG4gICAgdmFyIHBhcnNlcnMgPSBvcHRpb25zW29wdGlvbk5hbWVdO1xuICAgIHZhciBuYW1lO1xuICAgIHZhciBwYXJzZXI7XG5cbiAgICBpZiAoaXNQbGFpbk9iamVjdChwYXJzZXJzKSkge1xuICAgICAgICBmb3IgKG5hbWUgaW4gcGFyc2Vycykge1xuICAgICAgICAgICAgaWYgKGhhc093bi5jYWxsKHBhcnNlcnMsIG5hbWUpKSB7XG4gICAgICAgICAgICAgICAgcGFyc2VyID0gcGFyc2Vyc1tuYW1lXTtcbiAgICAgICAgICAgICAgICBpZiAoaXNGdW5jdGlvbihwYXJzZXIpKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChuYW1lIGluIHRhcmdldCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdUaGUgbmFtZSBcIicgKyBuYW1lICsgJ1wiIGhhcyBhbHJlYWR5IGV4aXN0ZWQsIGNhbiBub3QgYWRkIGl0IGFzIGEgcGFyc2VyJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0W25hbWVdID0gcGFyc2VyO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBhZGRDdXN0b21QYXJzZXI7XG4iLCJ2YXIgaXNGdW5jdGlvbiA9IHJlcXVpcmUoMzgpO1xudmFyIGlzQWJzb2x1dGVVUkwgPSByZXF1aXJlKDM2KTtcbnZhciBpc1BsYWluT2JqZWN0ID0gcmVxdWlyZSgzOSk7XG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGJ1aWxkIHJlcXVlc3QgdXJsLlxuICpcbiAqIDEuIEFkZCBiYXNlVVJMIGlmIG5lZWRlZC5cbiAqIDIuIENvbXBpbGUgdXJsIGlmIG5lZWRlZC5cbiAqIDMuIENvbXBpbGUgcXVlcnkgc3RyaW5nIGlmIG5lZWRlZC5cbiAqXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBSZXR1cm5zIHRoZSBmaW5hbCB1cmwgc3RyaW5nLlxuICovXG5mdW5jdGlvbiBidWlsZFVSTChvcHRpb25zKSB7XG4gICAgdmFyIHVybCA9ICh0eXBlb2Ygb3B0aW9ucy51cmwgPT09ICdzdHJpbmcnKSA/IG9wdGlvbnMudXJsIDogJyc7XG4gICAgdmFyIGJhc2VVUkwgPSBvcHRpb25zLmJhc2VVUkw7XG4gICAgdmFyIHBhcmFtID0gb3B0aW9ucy5wYXJhbTtcbiAgICB2YXIgcXVlcnkgPSBvcHRpb25zLnF1ZXJ5O1xuICAgIHZhciBjb21waWxlVVJMID0gb3B0aW9ucy5jb21waWxlVVJMO1xuICAgIHZhciBlbmNvZGVRdWVyeVN0cmluZyA9IG9wdGlvbnMuZW5jb2RlUXVlcnlTdHJpbmc7XG4gICAgdmFyIGFycmF5O1xuXG4gICAgLy8gSWYgdGhlIHVybCBpcyBub3QgYWJzb2x1dGUgdXJsIGFuZCB0aGUgYmFzZVVSTCBpcyBkZWZpbmVkLFxuICAgIC8vIHByZXBlbmQgdGhlIGJhc2VVUkwgdG8gdGhlIHVybC5cbiAgICBpZiAoIWlzQWJzb2x1dGVVUkwodXJsKSkge1xuICAgICAgICBpZiAodHlwZW9mIGJhc2VVUkwgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICB1cmwgPSBiYXNlVVJMICsgdXJsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ29tcGlsZSB0aGUgdXJsIGlmIG5lZWRlZC5cbiAgICBpZiAoaXNQbGFpbk9iamVjdChwYXJhbSkgJiYgaXNGdW5jdGlvbihjb21waWxlVVJMKSkge1xuICAgICAgICB1cmwgPSBjb21waWxlVVJMKHVybCwgcGFyYW0sIG9wdGlvbnMpO1xuICAgIH1cblxuICAgIC8vIENvbXBpbGUgdGhlIHF1ZXJ5IHN0cmluZy5cbiAgICBpZiAoaXNQbGFpbk9iamVjdChxdWVyeSkgJiYgaXNGdW5jdGlvbihlbmNvZGVRdWVyeVN0cmluZykpIHtcbiAgICAgICAgcXVlcnkgPSBlbmNvZGVRdWVyeVN0cmluZyhxdWVyeSwgb3B0aW9ucyk7XG4gICAgICAgIGFycmF5ID0gdXJsLnNwbGl0KCcjJyk7IC8vIFRoZXJlIG1heSBiZSBoYXNoIHN0cmluZyBpbiB0aGUgdXJsLlxuICAgICAgICB1cmwgPSBhcnJheVswXTtcblxuICAgICAgICBpZiAodXJsLmluZGV4T2YoJz8nKSA+IC0xKSB7XG4gICAgICAgICAgICAvLyBDaGVjayB3aGV0aGVyIHRoZSB1cmwgaXMgZW5kaW5nIHdpdGggYSBgJmAuXG4gICAgICAgICAgICBpZiAoLyYrJC8udGVzdCh1cmwpKSB7XG4gICAgICAgICAgICAgICAgdXJsID0gdXJsICsgcXVlcnk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHVybCA9IHVybCArICcmJyArIHF1ZXJ5O1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdXJsID0gdXJsICsgJz8nICsgcXVlcnk7XG4gICAgICAgIH1cblxuICAgICAgICBhcnJheVswXSA9IHVybDtcbiAgICAgICAgdXJsID0gYXJyYXkuam9pbignIycpO1xuICAgIH1cblxuICAgIHJldHVybiB1cmw7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYnVpbGRVUkw7XG4iLCJ2YXIgaXNGdW5jdGlvbiA9IHJlcXVpcmUoMzgpO1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBjYWxsIGBvcHRpb25zLm9uUmVxdWVzdENyZWF0ZWRgIGNhbGxiYWNrLlxuICpcbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEBwYXJhbSB7SHR0cFJlcXVlc3R8SlNPTlBSZXF1ZXN0fSByZXF1ZXN0IFRoZSByZXF1ZXN0IGluc3RhbmNlLlxuICovXG5mdW5jdGlvbiBjYWxsUmVxdWVzdENyZWF0ZWRDYWxsYmFjayhvcHRpb25zLCByZXF1ZXN0KSB7XG4gICAgdmFyIG9uUmVxdWVzdENyZWF0ZWQgPSBvcHRpb25zLm9uUmVxdWVzdENyZWF0ZWQ7XG5cbiAgICBpZiAoaXNGdW5jdGlvbihvblJlcXVlc3RDcmVhdGVkKSkge1xuICAgICAgICBvblJlcXVlc3RDcmVhdGVkKHJlcXVlc3QpO1xuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBjYWxsUmVxdWVzdENyZWF0ZWRDYWxsYmFjaztcbiIsImV4cG9ydHMuRVJSX0FCT1JURUQgPSAnRVJSX0FCT1JURUQnO1xuZXhwb3J0cy5FUlJfUkVTUE9OU0UgPSAnRVJSX1JFU1BPTlNFJztcbmV4cG9ydHMuRVJSX0NBTkNFTExFRCA9ICdFUlJfQ0FOQ0VMTEVEJztcbmV4cG9ydHMuRVJSX05FVFdPUksgPSAnRVJSX05FVFdPUksnO1xuZXhwb3J0cy5FUlJfVElNRU9VVCA9ICdFUlJfVElNRU9VVCc7XG5leHBvcnRzLkhUVFBfUkVRVUVTVCA9ICdIVFRQX1JFUVVFU1QnO1xuZXhwb3J0cy5KU09OUF9SRVFVRVNUID0gJ0pTT05QX1JFUVVFU1QnO1xuIiwidmFyIENhbmNlbENvbnRyb2xsZXIgPSByZXF1aXJlKDEpO1xuXG4vKipcbiAqIENyZWF0ZSBhIG5ldyBpbnN0YW5jZSBvZiBgQ2FuY2VsQ29udHJvbGxlcmAuXG4gKlxuICogQHJldHVybnMge0NhbmNlbENvbnRyb2xsZXJ9IFJldHVybnMgYW4gbmV3IGluc3RhbmNlIG9mIGBDYW5jZWxDb250cm9sbGVyYC5cbiAqL1xudmFyIGNyZWF0ZUNhbmNlbENvbnRyb2xsZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIG5ldyBDYW5jZWxDb250cm9sbGVyO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBjcmVhdGVDYW5jZWxDb250cm9sbGVyO1xuIiwidmFyIFFTID0gcmVxdWlyZSg0Myk7XG52YXIgY29uc3RhbnRzID0gcmVxdWlyZSgyNSk7XG52YXIgdGVtcGxhdGUgPSByZXF1aXJlKDMzKTtcbnZhciB1dWlkID0gcmVxdWlyZSgzNCk7XG52YXIgSFRUUF9SRVFVRVNUICA9IGNvbnN0YW50cy5IVFRQX1JFUVVFU1Q7XG5cbi8qKlxuICogQ3JlYXRlIGEgbmV3IGRlZmF1bHQgcmVxdWVzdCBvcHRpb25zLlxuICpcbiAqIEByZXR1cm5zIHtSZXF1ZXN0T3B0aW9uc30gUmV0dXJucyBhIG5ldyBkZWZhdWx0IHJlcXVlc3Qgb3BpdG9ucy5cbiAqL1xuZnVuY3Rpb24gY3JlYXRlRGVmYXVsdE9wdGlvbnMoKSB7XG4gICAgLyoqXG4gICAgICogQHR5cGUge1JlcXVlc3RPcHRpb25zfVxuICAgICAqL1xuICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgICBtZXRob2Q6ICdHRVQnLFxuICAgICAgICBiYXNlVVJMOiBudWxsLFxuICAgICAgICB1cmw6IG51bGwsXG4gICAgICAgIHBhcmFtOiBudWxsLFxuICAgICAgICBxdWVyeTogbnVsbCxcbiAgICAgICAgaGVhZGVyczogbnVsbCxcbiAgICAgICAgYm9keTogbnVsbCxcbiAgICAgICAgZXh0cmE6IHt9LFxuICAgICAgICBjb250cm9sbGVyOiBudWxsLFxuICAgICAgICByZXF1ZXN0RnVuY3Rpb25OYW1lOiBudWxsLFxuICAgICAgICByZXF1ZXN0VHlwZTogbnVsbCxcbiAgICAgICAgY29yczogZmFsc2UsXG4gICAgICAgIHhoclByb3BzOiBudWxsLFxuICAgICAgICB1c2VybmFtZTogbnVsbCxcbiAgICAgICAgcGFzc3dvcmQ6IG51bGwsXG4gICAgICAgIHRpbWVvdXQ6IDAsXG4gICAgICAgIG5vQ2FjaGU6IGZhbHNlLFxuICAgICAgICBub0NhY2hlSGVhZGVyczoge1xuICAgICAgICAgICAgJ1ByYWdtYSc6ICduby1jYWNoZScsXG4gICAgICAgICAgICAnQ2FjaGUtQ29udHJvbCc6ICduby1jYWNoZSwgbm8tc3RvcmUsIG11c3QtcmV2YWxpZGF0ZSdcbiAgICAgICAgfSxcbiAgICAgICAganNvbnA6ICdjYWxsYmFjaycsXG4gICAgICAgIGh0dHBSZXF1ZXN0Qm9keVByb2Nlc3Nvcjoge1xuICAgICAgICAgICAgcmF3OiB7XG4gICAgICAgICAgICAgICAgcHJpb3JpdHk6IDAsXG4gICAgICAgICAgICAgICAgaGVhZGVyczogbnVsbCxcbiAgICAgICAgICAgICAgICBwcm9jZXNzb3I6IG51bGwsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZm9ybToge1xuICAgICAgICAgICAgICAgIHByaW9yaXR5OiAxLFxuICAgICAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQ7IGNoYXJzZXQ9VVRGLTgnXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBwcm9jZXNzb3I6IGZ1bmN0aW9uIChkYXRhLCBvcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBRUy5lbmNvZGUoZGF0YSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGpzb246IHtcbiAgICAgICAgICAgICAgICBwcmlvcml0eTogMixcbiAgICAgICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbjsgY2hhcnNldD1VVEYtOCdcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHByb2Nlc3NvcjogZnVuY3Rpb24gKGRhdGEsIG9wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGRhdGEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgaHR0cFJlc3BvbnNlUGFyc2VyOiB7XG4gICAgICAgICAgICBqc29uOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgLy8gYHRoaXNgIGlzIHBvaW50IHRvIHRoZSBjdXJyZW50IGluc3RhbmNlIG9mIGBIdHRwUmVzcG9uc2VgLlxuICAgICAgICAgICAgICAgIHZhciByZXNwb25zZVRleHQgPSB0aGlzLnJlcXVlc3QueGhyLnJlc3BvbnNlVGV4dDtcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzcG9uc2VUZXh0ID8gSlNPTi5wYXJzZShyZXNwb25zZVRleHQpIDogbnVsbDtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB0ZXh0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucmVxdWVzdC54aHIucmVzcG9uc2VUZXh0O1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHN0YXR1czogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnJlcXVlc3QueGhyLnN0YXR1cztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAganNvbnBSZXNwb25zZVBhcnNlcjoge1xuICAgICAgICAgICAganNvbjogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnJlcXVlc3QucmVzcG9uc2VKU09OO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBodHRwUmVzcG9uc2VFcnJvclBhcnNlcjogbnVsbCxcbiAgICAgICAganNvbnBSZXNwb25zZUVycm9yUGFyc2VyOiBudWxsLFxuICAgICAgICBoYW5kbGVPcHRpb25zOiBudWxsLFxuICAgICAgICBjcmVhdGVYSFI6IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgICAgIH0sXG4gICAgICAgIGNyZWF0ZVNjcmlwdDogZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgICAgIHZhciBzY3JpcHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzY3JpcHQnKTtcblxuICAgICAgICAgICAgc2NyaXB0LnNldEF0dHJpYnV0ZSgndHlwZScsICd0ZXh0L2phdmFzY3JpcHQnKTtcbiAgICAgICAgICAgIHNjcmlwdC5zZXRBdHRyaWJ1dGUoJ2NoYXJzZXQnLCAndXRmLTgnKTtcblxuICAgICAgICAgICAgcmV0dXJuIHNjcmlwdDtcbiAgICAgICAgfSxcbiAgICAgICAganNvbnBDb250YWluZXJOb2RlOiBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICAgICAgcmV0dXJuIGRvY3VtZW50LmhlYWQgfHwgZG9jdW1lbnQuZ2V0RWxlbWVudHNCeU5hbWUoJ2hlYWQnKVswXTtcbiAgICAgICAgfSxcbiAgICAgICAganNvbnBDYWxsYmFja05hbWU6IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgICAgICByZXR1cm4gJ2pzb25wXycgKyB1dWlkKCkgKyAnXycgKyAobmV3IERhdGUoKS5nZXRUaW1lKCkpO1xuICAgICAgICB9LFxuICAgICAgICBjb21waWxlVVJMOiBmdW5jdGlvbiAodXJsLCBwYXJhbSwgb3B0aW9ucykge1xuICAgICAgICAgICAgcmV0dXJuIHRlbXBsYXRlKHVybCwgcGFyYW0pO1xuICAgICAgICB9LFxuICAgICAgICBlbmNvZGVRdWVyeVN0cmluZzogZnVuY3Rpb24gKGRhdGEsIG9wdGlvbnMpIHtcbiAgICAgICAgICAgIHJldHVybiBRUy5lbmNvZGUoZGF0YSk7XG4gICAgICAgIH0sXG4gICAgICAgIG9uWGhyQ3JlYXRlZDogbnVsbCxcbiAgICAgICAgb25YaHJPcGVuZWQ6IG51bGwsXG4gICAgICAgIG9uWGhyU2VudDogbnVsbCxcbiAgICAgICAgb25SZXF1ZXN0Q3JlYXRlZDogbnVsbCxcbiAgICAgICAgaXNSZXNwb25zZU9rOiBmdW5jdGlvbiAocmVxdWVzdFR5cGUsIHJlc3BvbnNlKSB7XG4gICAgICAgICAgICB2YXIgc3RhdHVzO1xuXG4gICAgICAgICAgICAvLyBIdHRwIHJlcWVzdFxuICAgICAgICAgICAgaWYgKHJlcXVlc3RUeXBlID09PSBIVFRQX1JFUVVFU1QpIHtcbiAgICAgICAgICAgICAgICBzdGF0dXMgPSByZXNwb25zZS5yZXF1ZXN0Lnhoci5zdGF0dXM7XG4gICAgICAgICAgICAgICAgcmV0dXJuIChzdGF0dXMgPj0gMjAwICYmIHN0YXR1cyA8IDMwMCkgfHwgc3RhdHVzID09PSAzMDQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEpTT05QIHJlcXVlc3RcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9LFxuICAgICAgICB0cmFuc2Zvcm1FcnJvcjogbnVsbCxcbiAgICAgICAgdHJhbnNmb3JtUmVzcG9uc2U6IG51bGwsXG4gICAgICAgIHNob3VsZENhbGxFcnJvckNhbGxiYWNrOiBudWxsLFxuICAgICAgICBzaG91bGRDYWxsU3VjY2Vzc0NhbGxiYWNrOiBudWxsXG4gICAgfTtcblxuICAgIHJldHVybiBvcHRpb25zO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZURlZmF1bHRPcHRpb25zO1xuIiwiLyoqXG4gKiBEZWZpbmUgYSBzdGF0aWMgbWVtYmVyIG9uIHRoZSBnaXZlbiBjb25zdHJ1Y3RvciBhbmQgaXRzIHByb3RvdHlwZVxuICpcbiAqIEBwYXJhbSB7Q29uc3RydWN0b3J9IGN0b3IgVGhlIGNvbnN0cnVjdG9yIHRvIGRlZmluZSB0aGUgc3RhdGljIG1lbWJlclxuICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgVGhlIG5hbWUgb2YgdGhlIHN0YXRpYyBtZW1iZXJcbiAqIEBwYXJhbSB7YW55fSB2YWx1ZSBUaGUgdmFsdWUgb2YgdGhlIHN0YXRpYyBtZW1iZXJcbiAqIEB0aHJvd3Mge0Vycm9yfSBUaHJvd3MgZXJyb3IgaWYgdGhlIG5hbWUgaGFzIGFscmVhZHkgZXhpc3RlZCwgb3IgdGhlIGNvbnN0cnVjdG9yIGlzIG5vdCBhIGZ1bmN0aW9uXG4gKi9cbmZ1bmN0aW9uIGRlZmluZUV4cG9ydHMoY3RvciwgbmFtZSwgdmFsdWUpIHtcbiAgICBpZiAodHlwZW9mIGN0b3IgIT09ICdmdW5jdGlvbicgfHwgIWN0b3IucHJvdG90eXBlKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVGhlIGNvbnN0cnVjdG9yIGlzIG5vdCBhIGZ1bmN0aW9uIG9yIGl0cyBwcm90b3R5cGUgaXMgbm90IGFuIG9iamVjdCcpO1xuICAgIH1cblxuICAgIGN0b3IuZXhwb3J0cyA9IGN0b3IuZXhwb3J0cyB8fCB7fTtcblxuICAgIGlmIChuYW1lIGluIGN0b3IuZXhwb3J0cykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RoZSBuYW1lIFwiJyArIG5hbWUgKyAnXCIgaGFzIGFscmVhZHkgZXhpc3RlZCBpbiB0aGUgY29uc3RydWN0b3IuZXhwb3J0cycpO1xuICAgIH1cblxuICAgIGlmIChjdG9yLnByb3RvdHlwZS5leHBvcnRzICYmIGN0b3IucHJvdG90eXBlLmV4cG9ydHMgIT09IGN0b3IuZXhwb3J0cykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RoZSBuYW1lIFwiZXhwb3J0c1wiIGhhcyBhbHJlYWR5IGV4aXN0ZWQgaW4gdGhlIGNvbnN0cnVjdG9yLnByb3RvdHlwZScpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGN0b3IucHJvdG90eXBlLmV4cG9ydHMgPSBjdG9yLmV4cG9ydHM7XG4gICAgfVxuXG4gICAgY3Rvci5leHBvcnRzW25hbWVdID0gdmFsdWU7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZGVmaW5lRXhwb3J0cztcbiIsInZhciBpc0Z1bmN0aW9uID0gcmVxdWlyZSgzOCk7XG52YXIgSHR0cFJlc3BvbnNlRXJyb3IgPSByZXF1aXJlKDUpO1xudmFyIEpTT05QUmVzcG9uc2VFcnJvciA9IHJlcXVpcmUoOCk7XG52YXIgY29uc3RhbnRzID0gcmVxdWlyZSgyNSk7XG52YXIgSFRUUF9SRVFVRVNUID0gY29uc3RhbnRzLkhUVFBfUkVRVUVTVDtcblxuLyoqXG4gKiBGaXJlIHRoZSBjYWxsYmFja3MuXG4gKlxuICogQHBhcmFtIHtzdHJpbmd8bnVsbH0gY29kZSBJZiB0aGVyZSBpcyBhbiBlcnJvciwgYGNvZGVgIHNob3VsZCBiZSBhIHN0cmluZy4gSWYgdGhlcmUgaXMgbm8gZXJyb3IsIGBjb2RlYCBpcyBgbnVsbGAuXG4gKiBAcGFyYW0ge0h0dHBSZXNwb25zZXxKU09OUFJlc3BvbnNlfSByZXNwb25zZSBUaGUgcmVzcG9uc2UgaW5zdGFuY2UuXG4gKi9cbmZ1bmN0aW9uIGZpcmVDYWxsYmFja3MoY29kZSwgcmVzcG9uc2UpIHtcbiAgICB2YXIgcmVxdWVzdCA9IHJlc3BvbnNlLnJlcXVlc3Q7XG4gICAgdmFyIHJlcXVlc3RUeXBlID0gcmVxdWVzdC5yZXF1ZXN0VHlwZTtcbiAgICB2YXIgb3B0aW9ucyA9IHJlcXVlc3Qub3B0aW9ucztcbiAgICB2YXIgb25zdWNjZXNzID0gcmVxdWVzdC5vbnN1Y2Nlc3M7XG4gICAgdmFyIG9uZXJyb3IgPSByZXF1ZXN0Lm9uZXJyb3I7XG4gICAgdmFyIHNob3VsZENhbGxFcnJvckNhbGxiYWNrID0gb3B0aW9ucy5zaG91bGRDYWxsRXJyb3JDYWxsYmFjaztcbiAgICB2YXIgc2hvdWxkQ2FsbFN1Y2Nlc3NDYWxsYmFjayA9IG9wdGlvbnMuc2hvdWxkQ2FsbFN1Y2Nlc3NDYWxsYmFjaztcbiAgICB2YXIgdHJhbnNmb3JtRXJyb3IgPSBvcHRpb25zLnRyYW5zZm9ybUVycm9yO1xuICAgIHZhciB0cmFuc2Zvcm1SZXNwb25zZSA9IG9wdGlvbnMudHJhbnNmb3JtUmVzcG9uc2U7XG5cbiAgICB2YXIgZXJyb3IgPSBudWxsO1xuICAgIHZhciBjYWxsRXJyb3JDYWxsYmFjayA9IHRydWU7XG4gICAgdmFyIGNhbGxTdWNjZXNzQ2FsbGJhY2sgPSB0cnVlO1xuICAgIHZhciB0cmFuc2Zvcm1lZEVycm9yID0gbnVsbDtcbiAgICB2YXIgdHJhbnNmb3JtZWRSZXNwb25zZSA9IG51bGw7XG5cbiAgICBpZiAoY29kZSkge1xuICAgICAgICBpZiAocmVxdWVzdFR5cGUgPT09IEhUVFBfUkVRVUVTVCkge1xuICAgICAgICAgICAgZXJyb3IgPSBuZXcgSHR0cFJlc3BvbnNlRXJyb3IoY29kZSwgcmVxdWVzdCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBlcnJvciA9IG5ldyBKU09OUFJlc3BvbnNlRXJyb3IoY29kZSwgcmVxdWVzdCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGlzRnVuY3Rpb24odHJhbnNmb3JtRXJyb3IpKSB7XG4gICAgICAgICAgICB0cmFuc2Zvcm1lZEVycm9yID0gdHJhbnNmb3JtRXJyb3IocmVxdWVzdFR5cGUsIGVycm9yKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRyYW5zZm9ybWVkRXJyb3IgPSBlcnJvcjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaXNGdW5jdGlvbihzaG91bGRDYWxsRXJyb3JDYWxsYmFjaykpIHtcbiAgICAgICAgICAgIGNhbGxFcnJvckNhbGxiYWNrID0gc2hvdWxkQ2FsbEVycm9yQ2FsbGJhY2socmVxdWVzdFR5cGUsIHRyYW5zZm9ybWVkRXJyb3IsIGVycm9yKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2FsbEVycm9yQ2FsbGJhY2spIHtcbiAgICAgICAgICAgIGlmIChpc0Z1bmN0aW9uKG9uZXJyb3IpKSB7XG4gICAgICAgICAgICAgICAgb25lcnJvcih0cmFuc2Zvcm1lZEVycm9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChpc0Z1bmN0aW9uKHRyYW5zZm9ybVJlc3BvbnNlKSkge1xuICAgICAgICAgICAgdHJhbnNmb3JtZWRSZXNwb25zZSA9IHRyYW5zZm9ybVJlc3BvbnNlKHJlcXVlc3RUeXBlLCByZXNwb25zZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0cmFuc2Zvcm1lZFJlc3BvbnNlID0gcmVzcG9uc2U7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGlzRnVuY3Rpb24oc2hvdWxkQ2FsbFN1Y2Nlc3NDYWxsYmFjaykpIHtcbiAgICAgICAgICAgIGNhbGxTdWNjZXNzQ2FsbGJhY2sgPSBzaG91bGRDYWxsU3VjY2Vzc0NhbGxiYWNrKHJlcXVlc3RUeXBlLCB0cmFuc2Zvcm1lZFJlc3BvbnNlLCByZXNwb25zZSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNhbGxTdWNjZXNzQ2FsbGJhY2spIHtcbiAgICAgICAgICAgIGlmIChpc0Z1bmN0aW9uKG9uc3VjY2VzcykpIHtcbiAgICAgICAgICAgICAgICBvbnN1Y2Nlc3ModHJhbnNmb3JtZWRSZXNwb25zZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZmlyZUNhbGxiYWNrcztcbiIsInZhciBpc0Z1bmN0aW9uID0gcmVxdWlyZSgzOCk7XG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIHByb2Nlc3MgdGhlIHJlcXVlc3Qgb3B0aW9ucy4gVGhpcyBmdW5jdGlvbiB3aWxsIGNhbGwgdGhlIGZ1bmN0aW9uIGBvcHRpb25zLmhhbmRsZU9wdGlvbnNgLlxuICpcbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEByZXR1cm5zIHt2b2lkfVxuICovXG5mdW5jdGlvbiBoYW5kbGVPcHRpb25zKG9wdGlvbnMpIHtcbiAgICBpZiAoaXNGdW5jdGlvbihvcHRpb25zLmhhbmRsZU9wdGlvbnMpKSB7XG4gICAgICAgIG9wdGlvbnMuaGFuZGxlT3B0aW9ucyhvcHRpb25zKTtcbiAgICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaGFuZGxlT3B0aW9ucztcbiIsIi8qKlxuICogTWFrZSBgU3ViQ2xhc3NgIGV4dGVuZCBgU3VwZXJDbGFzc2AuXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gU3ViQ2xhc3MgVGhlIHN1YiBjbGFzcyBjb25zdHJ1Y3Rvci5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IFN1cGVyQ2xhc3MgVGhlIHN1cGVyIGNsYXNzIGNvbnN0cnVjdG9yLlxuICovXG5mdW5jdGlvbiBpbmhlcml0cyhTdWJDbGFzcywgU3VwZXJDbGFzcykge1xuICAgIHZhciBGID0gZnVuY3Rpb24oKSB7fTtcblxuICAgIEYucHJvdG90eXBlID0gU3VwZXJDbGFzcy5wcm90b3R5cGU7XG5cbiAgICBTdWJDbGFzcy5wcm90b3R5cGUgPSBuZXcgRigpO1xuICAgIFN1YkNsYXNzLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IFN1YkNsYXNzO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGluaGVyaXRzO1xuIiwiLyoqXG4gKiBUaGUgbm8gb3BlcmF0aW9uIGZ1bmN0aW9uLlxuICovXG5mdW5jdGlvbiBub29wKCkge1xuICAgIC8vIG5vdGhpbmcgdG8gZG8gaGVyZS5cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBub29wO1xuIiwiLyoqXG4gKiBBIHNpbXBsZSB0ZW1wbGF0ZSBmdW5jdGlvblxuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBScmV0dXJucyAnL3Bvc3QvMSdcbiAqIHRlbXBsYXRlKCcvcG9zdC97cG9zdElkfScsIHsgcG9zdElkOiAxIH0pXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IHRlbXBsYXRlIFRoZSB0ZW1wbGF0ZSB0ZXh0XG4gKiBAcGFyYW0ge09iamVjdC48c3RyaW5nLCBzdHJpbmc+fSBkYXRhIFRoZSBkYXRhIG9iamVjdFxuICogQHJldHVybnMge3N0cmluZ30gUmV0dXJucyB0aGUgY29tcGlsZWQgdGV4dFxuICovXG5mdW5jdGlvbiB0ZW1wbGF0ZSh0ZW1wbGF0ZSwgZGF0YSkge1xuICAgIHZhciBzdHIgPSBbXTtcbiAgICB2YXIgcmVzID0gbnVsbDtcbiAgICB2YXIgcmVnZXhwID0gLyhefFteXFxcXF0pXFx7KFteXFx7XFx9XSpbXlxcXFxdKT9cXH0vO1xuXG4gICAgLy8gbWFrZSBzdXJlIHRoYXQgdGhlIHR5cGUgaXMgY29ycmVjdFxuICAgIHRlbXBsYXRlID0gJycgKyB0ZW1wbGF0ZTtcbiAgICBkYXRhID0gZGF0YSB8fCB7fTtcblxuICAgIHdoaWxlICggcmVzID0gcmVnZXhwLmV4ZWModGVtcGxhdGUpICkge1xuICAgICAgICB2YXIgaW5kZXggPSByZXMuaW5kZXg7XG4gICAgICAgIHZhciBtYXRjaCA9IHJlc1swXTtcbiAgICAgICAgdmFyIHByZWZpeCA9IHJlc1sxXTtcbiAgICAgICAgdmFyIGtleSA9IHJlc1syXTtcblxuICAgICAgICAvLyB0cmltIHdoaXRlIHNwYWNlc1xuICAgICAgICBrZXkgPSAoa2V5IHx8ICcnKS5yZXBsYWNlKC9eXFxzK3xcXHMrJC9nLCAnJyk7XG4gICAgICAgIC8vIHNhdmUgdGhlIGNvbnRlbnQgYmVmb3JlIHRoZSBrZXlcbiAgICAgICAgc3RyLnB1c2goIHRlbXBsYXRlLnN1YnN0ciggMCwgaW5kZXggKyBwcmVmaXgubGVuZ3RoICkgKTtcbiAgICAgICAgLy8gcmVhZCB0aGUgdmFsdWUgb2YgdGhlIGtleVxuICAgICAgICBzdHIucHVzaCggJycgKyBkYXRhW2tleV0gKTtcbiAgICAgICAgLy8gdXBkYXRlIHRoZSB0ZW1wbGF0ZVxuICAgICAgICB0ZW1wbGF0ZSA9IHRlbXBsYXRlLnN1YnN0ciggaW5kZXggKyBtYXRjaC5sZW5ndGggKTtcbiAgICAgICAgLy8gcmVzZXQgbGFzdCBpbmRleCBtYW51YWxseVxuICAgICAgICByZWdleHAubGFzdEluZGV4ID0gMDtcbiAgICB9XG5cbiAgICAvLyBzYXZlIHRoZSBjb250ZW50IGFmdGVyIGxhc3Qga2V5XG4gICAgc3RyLnB1c2godGVtcGxhdGUpO1xuXG4gICAgLy8gcmVwbGFjZSBgXFx7YCBhbmQgYFxcfWAgd2l0aCBge2AgYW5kIGB9YFxuICAgIHN0ciA9IHN0ci5qb2luKCcnKTtcbiAgICBzdHIgPSBzdHIucmVwbGFjZSgvXFxcXFxcey9nLCAneycpO1xuICAgIHN0ciA9IHN0ci5yZXBsYWNlKC9cXFxcXFx9L2csICd9Jyk7XG5cbiAgICByZXR1cm4gc3RyO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSB0ZW1wbGF0ZTtcbiIsInZhciBpZCA9IDA7XG5cbi8qKlxuICogUmV0dXJucyBhIG51bWJlciB0aGF0IGdyZWF0ZXIgdGhhbiB0aGUgcHJpdm91cyBvbmUsIHN0YXJ0aW5nIGZvcm0gYDFgLlxuICpcbiAqIEByZXR1cm5zIHtudW1iZXJ9XG4gKi9cbmZ1bmN0aW9uIHV1aWQoKSB7XG4gICAgaWQgKz0gMTtcbiAgICByZXR1cm4gaWQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gdXVpZDtcbiIsIm1vZHVsZS5leHBvcnRzID0gJzAuMC4xLWFscGhhLjInO1xuIiwiLyoqXG4gKiBDaGVjayB3aGV0aGVyIHRoZSB1cmwgaXMgYWJzb2x1dGUgdXJsLlxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSB1cmwgVGhlIHVybCBzdHJpbmcgdG8gY2hlY2tcbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgdXJsIGlzIGFib3NvbHV0ZSwgb3RoZXJ3aXNlIGBmYWxzZWAgaXMgcmV0dXJuZWRcbiAqL1xuZnVuY3Rpb24gaXNBYnNvbHV0ZVVSTCh1cmwpIHtcbiAgICByZXR1cm4gL14oPzpbYS16XVthLXowLTlcXC1cXC5cXCtdKjopP1xcL1xcLy9pLnRlc3QodXJsKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpc0Fic29sdXRlVVJMO1xuIiwidmFyIHRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcblxuLyoqXG4gKiBDaGVjayB3aGV0aGVyIHRoZSB2YXJpYWJsZSBpcyBhbiBpbnN0YW5jZSBvZiBgQXJyYXlgXG4gKlxuICogQHBhcmFtIHthbnl9IGl0IFRoZSB2YXJpYWJsZSB0byBjaGVja1xuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSB2YXJpYWJsZSBpcyBhbiBpbnN0YW5jZSBvZiBgQXJyYXlgLCBvdGhlcndpc2UgYGZhbHNlYCBpcyByZXR1cm5lZFxuICovXG5mdW5jdGlvbiBpc0FycmF5KGl0KSB7XG4gICAgcmV0dXJuIHRvU3RyaW5nLmNhbGwoaXQpID09PSAnW29iamVjdCBBcnJheV0nO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGlzQXJyYXk7XG4iLCJ2YXIgdG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xuXG4vKipcbiAqIENoZWNrIHdoZXRoZXIgdGhlIHZhcmlhYmxlIGlzIGEgZnVuY3Rpb25cbiAqXG4gKiBAcGFyYW0ge2FueX0gaXQgVGhlIHZhcmlhYmxlIHRvIGNoZWNrXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIHZhcmlhYmxlIGlzIGEgZnVuY3Rpb24sIG90aGVyd2lzZSBgZmFsc2VgIGlzIHJldHVybmVkXG4gKi9cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oaXQpIHtcbiAgICByZXR1cm4gdG9TdHJpbmcuY2FsbChpdCkgPT09ICdbb2JqZWN0IEZ1bmN0aW9uXSc7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaXNGdW5jdGlvbjtcbiIsInZhciB0b1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG5cbi8qKlxuICogQ2hlY2sgd2hldGhlciB0aGUgdmFyaWFibGUgaXMgYSBwbGFpbiBvYmplY3QuXG4gKlxuICogQHBhcmFtIHthbnl9IGl0IFRoZSB2YXJpYWJsZSB0byBjaGVja1xuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSB2YXJpYWJsZSBpcyBhIHBsYWluIG9iamVjdCwgb3RoZXJ3aXNlIGBmYWxzZWAgaXMgcmV0dXJuZWRcbiAqL1xuZnVuY3Rpb24gaXNQbGFpbk9iamVjdChpdCkge1xuICAgIGlmICghaXQpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiBpdCA9PT0gd2luZG93KSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIGdsb2JhbCAhPT0gJ3VuZGVmaW5lZCcgJiYgaXQgPT09IGdsb2JhbCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRvU3RyaW5nLmNhbGwoaXQpID09PSAnW29iamVjdCBPYmplY3RdJztcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpc1BsYWluT2JqZWN0O1xuIiwidmFyIGlzQXJyYXkgPSByZXF1aXJlKDM3KTtcbnZhciBpc1BsYWluT2JqZWN0ID0gcmVxdWlyZSgzOSk7XG52YXIgaGFzT3duID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcbnZhciBzbGljZSA9IEFycmF5LnByb3RvdHlwZS5zbGljZTtcblxuLyoqXG4gKiBDb3B5IHRoZSBub24tdW5kZWZpbmVkIHZhbHVlcyBvZiBzb3VyY2UgdG8gdGFyZ2V0LiBPdmVyd3JpdGUgdGhlIG9yaWdpbmFsIHZhbHVlcy5cbiAqIFRoaXMgZnVuY3Rpb24gd2lsbCBtb2RpZnkgdGhlIHRhcmdldFxuICpcbiAqIEBwYXJhbSB7T2JqZWN0LjxzdHJpbmcsICo+fGFueVtdfSB0YXJnZXQgVGhlIHRhcmdldCBvYmplY3Qgb3IgYXJyYXlcbiAqIEBwYXJhbSB7T2JqZWN0LjxzdHJpbmcsICo+fGFueVtdfSBzb3VyY2UgVGhlIHNvdXJjZSBvYmplY3Qgb3IgYXJyYXlcbiAqIEByZXR1cm5zIHtPYmplY3QuPHN0cmluZywgKj58YW55W119IFJldHVybnMgdGhlIGV4dGVuZGVkIHRhcmdldCBvYmplY3Qgb3IgYXJyYXlcbiAqL1xuZnVuY3Rpb24gZXh0ZW5kKHRhcmdldCwgc291cmNlKSB7XG4gICAgdmFyIGtleSwgdmFsO1xuXG4gICAgaWYgKCB0YXJnZXQgJiYgKCBpc0FycmF5KHNvdXJjZSkgfHwgaXNQbGFpbk9iamVjdChzb3VyY2UpICkgKSB7XG4gICAgICAgIGZvciAoIGtleSBpbiBzb3VyY2UgKSB7XG4gICAgICAgICAgICBpZiAoIGhhc093bi5jYWxsKHNvdXJjZSwga2V5KSApIHtcbiAgICAgICAgICAgICAgICB2YWwgPSBzb3VyY2Vba2V5XTtcbiAgICAgICAgICAgICAgICBpZiAodmFsICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCBpc1BsYWluT2JqZWN0KHZhbCkgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoICEgaXNQbGFpbk9iamVjdCh0YXJnZXRba2V5XSkgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0W2tleV0gPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIG1lcmdlKHRhcmdldFtrZXldLCB2YWwpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKCBpc0FycmF5KHZhbCkgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoICEgaXNBcnJheSh0YXJnZXRba2V5XSkgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0W2tleV0gPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIG1lcmdlKHRhcmdldFtrZXldLCB2YWwpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0W2tleV0gPSB2YWw7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGFyZ2V0O1xufVxuXG4vKipcbiAqIENvcHkgYW55IG5vbi11bmRlZmluZWQgdmFsdWVzIG9mIHNvdXJjZSB0byB0YXJnZXQgYW5kIG92ZXJ3cml0ZXMgdGhlIGNvcnJlc3BvbmRpbmcgb3JpZ2luYWwgdmFsdWVzLiBUaGlzIGZ1bmN0aW9uXG4gKiB3aWxsIG1vZGlmeSB0aGUgdGFyZ2V0IG9iamVjdC5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdGFyZ2V0IFRoZSB0YXJnZXQgb2JqZWN0XG4gKiBAcGFyYW0gey4uLk9iamVjdH0gYXJncyBUaGUgc291cmNlIG9iamVjdFxuICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyB0aGUgbW9kaWZpZWQgdGFyZ2V0IG9iamVjdFxuICovXG5mdW5jdGlvbiBtZXJnZSh0YXJnZXQsIGFyZ3MpIHtcbiAgICB2YXIgaSA9IDA7XG4gICAgdmFyIGwgPSBhcmd1bWVudHMubGVuZ3RoIC0gMTtcblxuICAgIGFyZ3MgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgbDsgaSArPSAxKSB7XG4gICAgICAgIGV4dGVuZCh0YXJnZXQsIGFyZ3NbaV0pO1xuICAgIH1cblxuICAgIHJldHVybiB0YXJnZXQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gbWVyZ2U7XG4iLCJ2YXIgdXRpbCA9IHJlcXVpcmUoNDQpO1xudmFyIGlzQXJyYXkgPSB1dGlsLmlzQXJyYXk7XG5cbi8qKlxuICogRGVjb2RlIHRoZSBVUkkgQ29tcG9uZW50IGVuY29kZWQgcXVlcnkgc3RyaW5nIHRvIG9iamVjdFxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSBUaGUgVVJJIENvbXBvbmVudCBlbmNvZGVkIHF1ZXJ5IHN0cmluZ1xuICogQHJldHVybnMge09iamVjdC48c3RyaW5nLCBzdHJpbmc+fSBSZXR1cm5zIHRoZSBkZWNvZGVkIG9iamVjdFxuICovXG52YXIgZGVjb2RlID0gZnVuY3Rpb24gKHN0cmluZykge1xuICAgIHZhciBvYmplY3QgPSB7fTtcbiAgICB2YXIgY2FjaGUgPSB7fTtcbiAgICB2YXIga2V5VmFsdWVBcnJheTtcbiAgICB2YXIgaW5kZXg7XG4gICAgdmFyIGxlbmd0aDtcbiAgICB2YXIga2V5VmFsdWU7XG4gICAgdmFyIGtleTtcbiAgICB2YXIgdmFsdWU7XG5cbiAgICAvLyBkbyBub3QgZGVjb2RlIGVtcHR5IHN0cmluZyBvciBzb21ldGhpbmcgdGhhdCBpcyBub3Qgc3RyaW5nXG4gICAgaWYgKHN0cmluZyAmJiB0eXBlb2Ygc3RyaW5nID09PSAnc3RyaW5nJykge1xuICAgICAgICBrZXlWYWx1ZUFycmF5ID0gc3RyaW5nLnNwbGl0KCcmJyk7XG4gICAgICAgIGluZGV4ID0gMDtcbiAgICAgICAgbGVuZ3RoID0ga2V5VmFsdWVBcnJheS5sZW5ndGg7XG5cbiAgICAgICAgd2hpbGUgKGluZGV4IDwgbGVuZ3RoKSB7XG4gICAgICAgICAgICBrZXlWYWx1ZSA9IGtleVZhbHVlQXJyYXlbaW5kZXhdLnNwbGl0KCc9Jyk7XG4gICAgICAgICAgICBrZXkgPSBkZWNvZGVVUklDb21wb25lbnQoa2V5VmFsdWVbMF0pO1xuICAgICAgICAgICAgdmFsdWUgPSBrZXlWYWx1ZVsxXTtcblxuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IGRlY29kZVVSSUNvbXBvbmVudCh2YWx1ZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHZhbHVlID0gbnVsbDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZGVjb2RlS2V5KG9iamVjdCwgY2FjaGUsIGtleSwgdmFsdWUpO1xuXG4gICAgICAgICAgICBpbmRleCArPSAxO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG9iamVjdDtcbn07XG5cbi8qKlxuICogRGVjb2RlIHRoZSBzcGVjZWZpZWQga2V5XG4gKlxuICogQHBhcmFtIHtPYmplY3QuPHN0cmluZywgc3RyaW5nPn0gb2JqZWN0IFRoZSBvYmplY3QgdG8gaG9sZCB0aGUgZGVjb2RlZCBkYXRhXG4gKiBAcGFyYW0ge09iamVjdC48c3RyaW5nLCAqPn0gY2FjaGUgVGhlIG9iamVjdCB0byBob2xkIGNhY2hlIGRhdGFcbiAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgVGhlIGtleSBuYW1lIHRvIGRlY29kZVxuICogQHBhcmFtIHthbnl9IHZhbHVlIFRoZSB2YWx1ZSB0byBkZWNvZGVcbiAqL1xudmFyIGRlY29kZUtleSA9IGZ1bmN0aW9uIChvYmplY3QsIGNhY2hlLCBrZXksIHZhbHVlKSB7XG4gICAgdmFyIHJCcmFja2V0ID0gL1xcWyhbXlxcW10qPyk/XFxdJC87XG4gICAgdmFyIHJJbmRleCA9IC8oXjAkKXwoXlsxLTldXFxkKiQpLztcbiAgICB2YXIgaW5kZXhPcktleU9yRW1wdHk7XG4gICAgdmFyIHBhcmVudEtleTtcbiAgICB2YXIgYXJyYXlPck9iamVjdDtcbiAgICB2YXIga2V5SXNJbmRleDtcbiAgICB2YXIga2V5SXNFbXB0eTtcbiAgICB2YXIgdmFsdWVJc0luQXJyYXk7XG4gICAgdmFyIGRhdGFBcnJheTtcbiAgICB2YXIgbGVuZ3RoO1xuXG4gICAgLy8gY2hlY2sgd2hldGhlciBrZXkgaXMgc29tZXRoaW5nIGxpa2UgYHBlcnNvbltuYW1lXWAgb3IgYGNvbG9yc1tdYCBvclxuICAgIC8vIGBjb2xvcnNbMV1gXG4gICAgaWYgKCByQnJhY2tldC50ZXN0KGtleSkgKSB7XG4gICAgICAgIGluZGV4T3JLZXlPckVtcHR5ID0gUmVnRXhwLiQxO1xuICAgICAgICBwYXJlbnRLZXkgPSBrZXkucmVwbGFjZShyQnJhY2tldCwgJycpO1xuICAgICAgICBhcnJheU9yT2JqZWN0ID0gY2FjaGVbcGFyZW50S2V5XTtcblxuICAgICAgICBrZXlJc0luZGV4ID0gckluZGV4LnRlc3QoaW5kZXhPcktleU9yRW1wdHkpO1xuICAgICAgICBrZXlJc0VtcHR5ID0gaW5kZXhPcktleU9yRW1wdHkgPT09ICcnO1xuICAgICAgICB2YWx1ZUlzSW5BcnJheSA9IGtleUlzSW5kZXggfHwga2V5SXNFbXB0eTtcblxuICAgICAgICBpZiAoYXJyYXlPck9iamVjdCkge1xuICAgICAgICAgICAgLy8gY29udmVydCB0aGUgYXJyYXkgdG8gb2JqZWN0XG4gICAgICAgICAgICBpZiAoICghIHZhbHVlSXNJbkFycmF5KSAmJiBpc0FycmF5KGFycmF5T3JPYmplY3QpICkge1xuICAgICAgICAgICAgICAgIGRhdGFBcnJheSA9IGFycmF5T3JPYmplY3Q7XG4gICAgICAgICAgICAgICAgbGVuZ3RoID0gZGF0YUFycmF5Lmxlbmd0aDtcbiAgICAgICAgICAgICAgICBhcnJheU9yT2JqZWN0ID0ge307XG5cbiAgICAgICAgICAgICAgICB3aGlsZSAobGVuZ3RoLS0pIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFycmF5T3JPYmplY3RbbGVuZ3RoXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhcnJheU9yT2JqZWN0W2xlbmd0aF0gPSBkYXRhQXJyYXlbbGVuZ3RoXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGFycmF5T3JPYmplY3QgPSB2YWx1ZUlzSW5BcnJheSA/IFtdIDoge307XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIGtleUlzRW1wdHkgJiYgaXNBcnJheShhcnJheU9yT2JqZWN0KSApIHtcbiAgICAgICAgICAgIGFycmF5T3JPYmplY3QucHVzaCh2YWx1ZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBhcnJheU9yT2JqZWN0IGlzIGFycmF5IG9yIG9iamVjdCBoZXJlXG4gICAgICAgICAgICBhcnJheU9yT2JqZWN0W2luZGV4T3JLZXlPckVtcHR5XSA9IHZhbHVlO1xuICAgICAgICB9XG5cbiAgICAgICAgY2FjaGVbcGFyZW50S2V5XSA9IGFycmF5T3JPYmplY3Q7XG5cbiAgICAgICAgZGVjb2RlS2V5KG9iamVjdCwgY2FjaGUsIHBhcmVudEtleSwgYXJyYXlPck9iamVjdCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgb2JqZWN0W2tleV0gPSB2YWx1ZTtcbiAgICB9XG59O1xuXG5leHBvcnRzLmRlY29kZSA9IGRlY29kZTtcbiIsInZhciB1dGlsID0gcmVxdWlyZSg0NCk7XG52YXIgaXNBcnJheSA9IHV0aWwuaXNBcnJheTtcbnZhciBpc09iamVjdCA9IHV0aWwuaXNPYmplY3Q7XG52YXIgaGFzT3duID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcblxuLyoqXG4gKiBFbmNvZGUgdGhlIGdpdmVuIG9iamVjdCB0byBVUkkgQ29tcG9uZW50IGVuY29kZWQgcXVlcnkgc3RyaW5nXG4gKlxuICogQHBhcmFtIHtPYmplY3QuPHN0cmluZywgKj59IG9iamVjdCBUaGUgb2JqZWN0IHRvIGVuY29kZVxuICogQHBhcmFtIHtib29sZWFufSBba2VlcEFycmF5SW5kZXhdIFdoZXRoZXIgdG8ga2VlcCBhcnJheSBpbmRleFxuICogQHJldHVybnMge3N0cmluZ30gUmV0dXJucyB0aGUgVVJJIENvbXBvbmVudCBlbmNvZGVkIHF1ZXJ5IHN0cmluZ1xuICovXG52YXIgZW5jb2RlID0gZnVuY3Rpb24gKG9iamVjdCwga2VlcEFycmF5SW5kZXgpIHtcbiAgICB2YXIga2V5O1xuICAgIHZhciBrZXlWYWx1ZUFycmF5ID0gW107XG5cbiAgICBrZWVwQXJyYXlJbmRleCA9ICEha2VlcEFycmF5SW5kZXg7XG5cbiAgICBpZiAoIGlzT2JqZWN0KG9iamVjdCkgKSB7XG4gICAgICAgIGZvciAoIGtleSBpbiBvYmplY3QgKSB7XG4gICAgICAgICAgICBpZiAoIGhhc093bi5jYWxsKG9iamVjdCwga2V5KSApIHtcbiAgICAgICAgICAgICAgICBlbmNvZGVLZXkoa2V5LCBvYmplY3Rba2V5XSwga2V5VmFsdWVBcnJheSwga2VlcEFycmF5SW5kZXgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGtleVZhbHVlQXJyYXkuam9pbignJicpO1xufTtcblxuXG4vKipcbiAqIEVuY29kZSB0aGUgc3BlY2VpZmVkIGtleSBpbiB0aGUgb2JqZWN0XG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IGtleSBUaGUga2V5IG5hbWVcbiAqIEBwYXJhbSB7YW55fSBkYXRhIFRoZSBkYXRhIG9mIHRoZSBrZXlcbiAqIEBwYXJhbSB7c3RyaW5nW119IGtleVZhbHVlQXJyYXkgVGhlIGFycmF5IHRvIHN0b3JlIHRoZSBrZXkgdmFsdWUgc3RyaW5nXG4gKiBAcGFyYW0ge2Jvb2xlYW59IGtlZXBBcnJheUluZGV4IFdoZXRoZXIgdG8ga2VlcCBhcnJheSBpbmRleFxuICovXG52YXIgZW5jb2RlS2V5ID0gZnVuY3Rpb24gKGtleSwgZGF0YSwga2V5VmFsdWVBcnJheSwga2VlcEFycmF5SW5kZXgpIHtcbiAgICB2YXIgcHJvcDtcbiAgICB2YXIgaW5kZXg7XG4gICAgdmFyIGxlbmd0aDtcbiAgICB2YXIgdmFsdWU7XG4gICAgdmFyIHN1YktleTtcblxuICAgIGlmICggaXNPYmplY3QoZGF0YSkgKSB7XG4gICAgICAgIGZvciAoIHByb3AgaW4gZGF0YSApIHtcbiAgICAgICAgICAgIGlmICggaGFzT3duLmNhbGwoZGF0YSwgcHJvcCkgKSB7XG4gICAgICAgICAgICAgICAgdmFsdWUgPSBkYXRhW3Byb3BdO1xuICAgICAgICAgICAgICAgIHN1YktleSA9IGtleSArICdbJyArIHByb3AgKyAnXSc7XG4gICAgICAgICAgICAgICAgZW5jb2RlS2V5KHN1YktleSwgdmFsdWUsIGtleVZhbHVlQXJyYXksIGtlZXBBcnJheUluZGV4KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAoIGlzQXJyYXkoZGF0YSkgKSB7XG4gICAgICAgIGluZGV4ID0gMDtcbiAgICAgICAgbGVuZ3RoID0gZGF0YS5sZW5ndGg7XG5cbiAgICAgICAgd2hpbGUgKGluZGV4IDwgbGVuZ3RoKSB7XG4gICAgICAgICAgICB2YWx1ZSA9IGRhdGFbaW5kZXhdO1xuXG4gICAgICAgICAgICBpZiAoIGtlZXBBcnJheUluZGV4IHx8IGlzQXJyYXkodmFsdWUpIHx8IGlzT2JqZWN0KHZhbHVlKSApIHtcbiAgICAgICAgICAgICAgICBzdWJLZXkgPSBrZXkgKyAnWycgKyBpbmRleCArICddJztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc3ViS2V5ID0ga2V5ICsgJ1tdJztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZW5jb2RlS2V5KHN1YktleSwgdmFsdWUsIGtleVZhbHVlQXJyYXksIGtlZXBBcnJheUluZGV4KTtcblxuICAgICAgICAgICAgaW5kZXggKz0gMTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIGtleSA9IGVuY29kZVVSSUNvbXBvbmVudChrZXkpO1xuICAgICAgICAvLyBpZiBkYXRhIGlzIG51bGwsIG5vIGA9YCBpcyBhcHBlbmRlZFxuICAgICAgICBpZiAoZGF0YSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgdmFsdWUgPSBrZXk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBpZiBkYXRhIGlzIHVuZGVmaW5lZCwgdHJlYXQgaXQgYXMgZW1wdHkgc3RyaW5nXG4gICAgICAgICAgICBpZiAoZGF0YSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgZGF0YSA9ICcnO1xuICAgICAgICAgICAgLy8gbWFrZSBzdXJlIHRoYXQgZGF0YSBpcyBzdHJpbmdcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGRhdGEgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgZGF0YSA9ICcnICsgZGF0YTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhbHVlID0ga2V5ICsgJz0nICsgZW5jb2RlVVJJQ29tcG9uZW50KGRhdGEpO1xuICAgICAgICB9XG5cbiAgICAgICAga2V5VmFsdWVBcnJheS5wdXNoKHZhbHVlKTtcbiAgICB9XG59O1xuXG5leHBvcnRzLmVuY29kZSA9IGVuY29kZTtcbiIsInZhciBlbmNvZGUgPSByZXF1aXJlKDQyKS5lbmNvZGU7XG52YXIgZGVjb2RlID0gcmVxdWlyZSg0MSkuZGVjb2RlO1xuXG5leHBvcnRzLmVuY29kZSA9IGVuY29kZTtcbmV4cG9ydHMuZGVjb2RlID0gZGVjb2RlO1xuZXhwb3J0cy52ZXJzaW9uID0gJzEuMS4yJztcbiIsInZhciB0b1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG5cbi8qKlxuICogQ2hlY2sgd2hldGhlciB0aGUgdmFyaWFibGUgaXMgYW4gYXJyYXlcbiAqXG4gKiBAcGFyYW0ge2FueX0gaXQgVGhlIHZhcmlhYmxlIHRvIGNoZWNrXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgaXQgaXMgYW4gYXJyYXlcbiAqL1xudmFyIGlzQXJyYXkgPSBmdW5jdGlvbiAoaXQpIHtcbiAgICByZXR1cm4gJ1tvYmplY3QgQXJyYXldJyA9PT0gdG9TdHJpbmcuY2FsbChpdCk7XG59O1xuXG4vKipcbiAqIENoZWNrIHdoZXRoZXIgdGhlIHZhcmlhYmxlIGlzIGFuIG9iamVjdFxuICpcbiAqIEBwYXJhbSB7YW55fSBpdCBUaGUgdmFyaWFibGUgdG8gY2hlY2tcbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBpdCBpcyBhbiBvYmplY3RcbiAqL1xudmFyIGlzT2JqZWN0ID0gZnVuY3Rpb24gKGl0KSB7XG4gICAgcmV0dXJuICdbb2JqZWN0IE9iamVjdF0nID09PSB0b1N0cmluZy5jYWxsKGl0KTtcbn07XG5cbmV4cG9ydHMuaXNBcnJheSA9IGlzQXJyYXk7XG5leHBvcnRzLmlzT2JqZWN0ID0gaXNPYmplY3Q7XG4iXX0=
