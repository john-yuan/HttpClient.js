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
    return new CancelController;
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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9fYnJvd3Nlci1wYWNrQDYuMS4wQGJyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsImxpYi9jbGFzcy9DYW5jZWxDb250cm9sbGVyLmpzIiwibGliL2NsYXNzL0h0dHBDbGllbnQuanMiLCJsaWIvY2xhc3MvSHR0cFJlcXVlc3QuanMiLCJsaWIvY2xhc3MvSHR0cFJlc3BvbnNlLmpzIiwibGliL2NsYXNzL0h0dHBSZXNwb25zZUVycm9yLmpzIiwibGliL2NsYXNzL0pTT05QUmVxdWVzdC5qcyIsImxpYi9jbGFzcy9KU09OUFJlc3BvbnNlLmpzIiwibGliL2NsYXNzL0pTT05QUmVzcG9uc2VFcnJvci5qcyIsImxpYi9jbGFzcy9SZXF1ZXN0LmpzIiwibGliL2NsYXNzL1Jlc3BvbnNlLmpzIiwibGliL2NsYXNzL1Jlc3BvbnNlRXJyb3IuanMiLCJsaWIvaHR0cC9hZGRFdmVudExpc3RlbmVycy5qcyIsImxpYi9odHRwL2FkZFRpbWVvdXRMaXN0ZW5lci5qcyIsImxpYi9odHRwL2NhbGxYaHJIb29rLmpzIiwibGliL2h0dHAvaGFuZGxlSGVhZGVycy5qcyIsImxpYi9odHRwL2hhbmRsZVJlcXVlc3RCb2R5LmpzIiwibGliL2h0dHAvaGFuZGxlWGhyUHJvcHMuanMiLCJsaWIvanNvbnAvYWRkRXZlbnRMaXN0ZW5lcnMuanMiLCJsaWIvanNvbnAvYnVpbGRDYWxsYmFja05hbWUuanMiLCJsaWIvanNvbnAvYnVpbGRTY3JpcHRTcmMuanMiLCJsaWIvanNvbnAvaGFuZGxlU2NyaXB0Q29ycy5qcyIsImxpYi9zaGFyZWQvYWRkQ3VzdG9tUGFyc2VyLmpzIiwibGliL3NoYXJlZC9idWlsZFVSTC5qcyIsImxpYi9zaGFyZWQvY2FsbFJlcXVlc3RDcmVhdGVkQ2FsbGJhY2suanMiLCJsaWIvc2hhcmVkL2NvbnN0YW50cy5qcyIsImxpYi9zaGFyZWQvY3JlYXRlQ2FuY2VsQ29udHJvbGxlci5qcyIsImxpYi9zaGFyZWQvY3JlYXRlRGVmYXVsdE9wdGlvbnMuanMiLCJsaWIvc2hhcmVkL2RlZmluZUV4cG9ydHMuanMiLCJsaWIvc2hhcmVkL2ZpcmVDYWxsYmFja3MuanMiLCJsaWIvc2hhcmVkL2hhbmRsZU9wdGlvbnMuanMiLCJsaWIvc2hhcmVkL2hhc093bi5qcyIsImxpYi9zaGFyZWQvaW5oZXJpdHMuanMiLCJsaWIvc2hhcmVkL25vb3AuanMiLCJsaWIvc2hhcmVkL3RlbXBsYXRlLmpzIiwibGliL3NoYXJlZC91dWlkLmpzIiwibm9kZV9tb2R1bGVzL194LWNvbW1vbi11dGlsc0AxLjQuMEB4LWNvbW1vbi11dGlscy9pc0Fic29sdXRlVVJMLmpzIiwibm9kZV9tb2R1bGVzL194LWNvbW1vbi11dGlsc0AxLjQuMEB4LWNvbW1vbi11dGlscy9pc0FycmF5LmpzIiwibm9kZV9tb2R1bGVzL194LWNvbW1vbi11dGlsc0AxLjQuMEB4LWNvbW1vbi11dGlscy9pc0Z1bmN0aW9uLmpzIiwibm9kZV9tb2R1bGVzL194LWNvbW1vbi11dGlsc0AxLjQuMEB4LWNvbW1vbi11dGlscy9pc1BsYWluT2JqZWN0LmpzIiwibm9kZV9tb2R1bGVzL194LWNvbW1vbi11dGlsc0AxLjQuMEB4LWNvbW1vbi11dGlscy9tZXJnZS5qcyIsIm5vZGVfbW9kdWxlcy9feC1xdWVyeS1zdHJpbmdAMS4xLjJAeC1xdWVyeS1zdHJpbmcvbGliL2RlY29kZS5qcyIsIm5vZGVfbW9kdWxlcy9feC1xdWVyeS1zdHJpbmdAMS4xLjJAeC1xdWVyeS1zdHJpbmcvbGliL2VuY29kZS5qcyIsIm5vZGVfbW9kdWxlcy9feC1xdWVyeS1zdHJpbmdAMS4xLjJAeC1xdWVyeS1zdHJpbmcvbGliL3F1ZXJ5c3RyaW5nLmpzIiwibm9kZV9tb2R1bGVzL194LXF1ZXJ5LXN0cmluZ0AxLjEuMkB4LXF1ZXJ5LXN0cmluZy9saWIvdXRpbC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3Z0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDYkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcklBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZkE7QUFDQTs7QUNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDYkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCJ2YXIgaXNGdW5jdGlvbiA9IHJlcXVpcmUoMzgpO1xuXG4vKipcbiAqIENhbmNlbCBjb250cm9sbGVyIGlzIHVzZWQgdG8gY2FuY2VsIGFjdGlvbnMuIE9uZSBjb250cm9sbGVyIGNhbiBiaW5kIGFueSBudW1iZXIgb2YgYWN0aW9ucy5cbiAqXG4gKiBAY2xhc3NcbiAqL1xuZnVuY3Rpb24gQ2FuY2VsQ29udHJvbGxlcigpIHtcbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn0gV2hldGhlciB0aGUgY29udHJvbGxlciBpcyBjYW5jZWxsZWQuXG4gICAgICovXG4gICAgdGhpcy5jYW5jZWxsZWQgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtGdW5jdGlvbltdfSBUaGUgY2FsbGJhY2tzIHRvIGNhbGwgb24gY2FuY2VsLlxuICAgICAqL1xuICAgIHRoaXMuY2FsbGJhY2tzID0gW107XG59XG5cbi8qKlxuICogQ2FuY2VsIHRoZSBhY3Rpb25zIHRoYXQgYmluZCB3aXRoIHRoaXMgY2FuY2VsIGNvbnRyb2xsZXIuXG4gKi9cbkNhbmNlbENvbnRyb2xsZXIucHJvdG90eXBlLmNhbmNlbCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgY2FsbGJhY2tzID0gdGhpcy5jYWxsYmFja3M7XG4gICAgdmFyIGkgPSAwO1xuICAgIHZhciBsID0gY2FsbGJhY2tzLmxlbmd0aDtcblxuICAgIGlmICh0aGlzLmNhbmNlbGxlZCA9PT0gZmFsc2UpIHtcbiAgICAgICAgdGhpcy5jYW5jZWxsZWQgPSB0cnVlO1xuXG4gICAgICAgIGZvciAoIDsgaSA8IGw7IGkgKz0gMSkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjYWxsYmFja3NbaV0oKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAvLyBUaHJvdyB0aGUgZXJyb3IgbGF0ZXIgZm9yIGRlYnVnaW5nLlxuICAgICAgICAgICAgICAgIChmdW5jdGlvbiAoZSkge1xuICAgICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IGU7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pKGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufTtcblxuLyoqXG4gKiBDaGVjayB3aGV0aGVyIHRoZSBjb250cm9sbGVyIGlzIGNhbmNlbGxlZC5cbiAqXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIGNvbnRyb2xsZXIgaXMgY2FuY2VsbGVkLCBvdGhlcndpc2UgYGZhbHNlYCBpcyByZXR1cm5lZC5cbiAqL1xuQ2FuY2VsQ29udHJvbGxlci5wcm90b3R5cGUuaXNDYW5jZWxsZWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY2FuY2VsbGVkO1xufTtcblxuLyoqXG4gKiBSZWdpc3RlciBhIGNhbGxiYWNrLCB3aGljaCB3aWxsIGJlIGNhbGxlZCB3aGVuIHRoZSBgY2FuY2VsKClgIG1ldGhvZCBpcyBjYWxsZWQuXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgVGhlIGNhbGxiYWNrIGZ1bmN0aW9uIHRvIGNhbGwgb24gY2FuY2VsLlxuICovXG5DYW5jZWxDb250cm9sbGVyLnByb3RvdHlwZS5yZWdpc3RlckNhbmNlbENhbGxiYWNrID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgaWYgKGlzRnVuY3Rpb24oY2FsbGJhY2spKSB7XG4gICAgICAgIHRoaXMuY2FsbGJhY2tzLnB1c2goY2FsbGJhY2spO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQ2FuY2VsQ29udHJvbGxlcjtcbiIsInZhciBtZXJnZSA9IHJlcXVpcmUoNDApO1xudmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKDM4KTtcbnZhciBpc1BsYWluT2JqZWN0ID0gcmVxdWlyZSgzOSk7XG52YXIgUVMgPSByZXF1aXJlKDQzKTtcbnZhciBpc0Fic29sdXRlVVJMID0gcmVxdWlyZSgzNik7XG52YXIgZGVmaW5lRXhwb3J0cyA9IHJlcXVpcmUoMjgpO1xudmFyIGNvbnN0YW50cyA9IHJlcXVpcmUoMjUpO1xudmFyIHRlbXBsYXRlID0gcmVxdWlyZSgzNCk7XG52YXIgdXVpZCA9IHJlcXVpcmUoMzUpO1xudmFyIG5vb3AgPSByZXF1aXJlKDMzKTtcbnZhciBpbmhlcml0cyA9IHJlcXVpcmUoMzIpO1xudmFyIGNyZWF0ZURlZmF1bHRPcHRpb25zID0gcmVxdWlyZSgyNyk7XG52YXIgY3JlYXRlQ2FuY2VsQ29udHJvbGxlciA9IHJlcXVpcmUoMjYpO1xudmFyIENhbmNlbENvbnRyb2xsZXIgPSByZXF1aXJlKDEpO1xudmFyIEh0dHBSZXF1ZXN0ID0gcmVxdWlyZSgzKTtcbnZhciBIdHRwUmVzcG9uc2UgPSByZXF1aXJlKDQpO1xudmFyIEh0dHBSZXNwb25zZUVycm9yID0gcmVxdWlyZSg1KTtcbnZhciBKU09OUFJlcXVlc3QgPSByZXF1aXJlKDYpO1xudmFyIEpTT05QUmVzcG9uc2UgPSByZXF1aXJlKDcpO1xudmFyIEpTT05QUmVzcG9uc2VFcnJvciA9IHJlcXVpcmUoOCk7XG52YXIgUmVxdWVzdCA9IHJlcXVpcmUoOSk7XG52YXIgUmVzcG9uc2UgPSByZXF1aXJlKDEwKTtcbnZhciBSZXNwb25zZUVycm9yID0gcmVxdWlyZSgxMSk7XG52YXIgdmVyc2lvbiA9ICcwLjAuMS1hbHBoYS4zJztcblxuLyoqXG4gKiBAY2xhc3NcbiAqXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBbZGVmYXVsdHNdIFRoZSBkZWZhdWx0IG9wdGlvbnMgdG8gdXNlIHdoZW4gc2VuZGluZyByZXF1ZXN0cyB3aXRoIHRoZSBjcmVhdGVkIGh0dHAgY2xpZW50LlxuICogVGhpcyBkZWZhdWx0IG9wdGlvbnMgd2lsbCBiZSBtZXJnZWQgaW50byB0aGUgaW50ZXJuYWwgZGVmYXVsdCBvcHRpb25zIHRoYXQgYGNyZWF0ZURlZmF1bHRPcHRpb25zKClgIHJldHVybnMuXG4gKlxuICogQHBhcmFtIHtIYW5kbGVPcHRpb25zRnVuY3Rpb259IFtoYW5kbGVEZWZhdWx0c10gVGhlIGhhbmRsZXIgZnVuY3Rpb24gdG8gcHJvY2VzcyB0aGUgbWVyZ2VkIGRlZmF1bHQgb3B0aW9ucy4gVGhlXG4gKiBtZXJnZWQgZGVmYXVsdCBvcHRpb25zIHdpbGwgYmUgcGFzc2VkIGludG8gdGhlIGZ1bmN0aW9uIGFzIHRoZSBmaXJzdCBhcmd1bWVudC4gWW91IGNhbiBtYWtlIGNoYW5nZXMgdG8gaXQgYXMgeW91XG4gKiB3YW50LiBUaGlzIGZ1bmN0aW9uIG11c3QgcmV0dXJuIHN5bmNocm9ub3VzbHkuIFRoZSByZXR1cm4gdmFsdWUgb2YgdGhpcyBmdW5jdGlvbiBpcyBpZ25vcmVkLlxuICpcbiAqIEBwYXJhbSB7SGFuZGxlT3B0aW9uc0Z1bmN0aW9ufSBbaGFuZGxlUmVxdWVzdE9wdGlvbnNdIFRoZSBoYW5kbGVyIGZ1bmN0aW9uIHRvIHByb2Nlc3MgZWFjaCBtZXJnZWQgcmVxdWVzdCBvcHRpb25zLlxuICogRXZlcnkgb3B0aW9ucyB0aGF0IHBhc3NlZCBpbnRvIGBzZW5kYCwgYGZldGNoYCwgYGdldEpTT05QYCwgYGZldGNoSlNPTlBgIHdpbGwgYmUgcHJvY2Vzc2VkIGJ5IHRoaXMgaGFuZGxlciBmdW5jdGlvbi5cbiAqL1xuZnVuY3Rpb24gSHR0cENsaWVudChkZWZhdWx0cywgaGFuZGxlRGVmYXVsdHMsIGhhbmRsZVJlcXVlc3RPcHRpb25zKSB7XG4gICAgdmFyIGRlZmF1bHRPcHRpb25zID0gY3JlYXRlRGVmYXVsdE9wdGlvbnMoKTtcblxuICAgIGlmIChpc1BsYWluT2JqZWN0KGRlZmF1bHRzKSkge1xuICAgICAgICBtZXJnZShkZWZhdWx0T3B0aW9ucywgZGVmYXVsdHMpO1xuICAgIH1cblxuICAgIGlmIChpc0Z1bmN0aW9uKGhhbmRsZURlZmF1bHRzKSkge1xuICAgICAgICBoYW5kbGVEZWZhdWx0cyhkZWZhdWx0T3B0aW9ucyk7XG4gICAgICAgIC8vIERlZXAgY29weSB0aGUgY2hhZ25lZCBvcHRpb25zXG4gICAgICAgIGRlZmF1bHRPcHRpb25zID0gbWVyZ2Uoe30sIGRlZmF1bHRPcHRpb25zKTtcbiAgICB9XG5cbiAgICBpZiAoIWlzRnVuY3Rpb24oaGFuZGxlUmVxdWVzdE9wdGlvbnMpKSB7XG4gICAgICAgIGhhbmRsZVJlcXVlc3RPcHRpb25zID0gbm9vcDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgYSBjb3B5IG9mIHRoZSBkZWZhdWx0IHJlcXVlc3Qgb3B0aW9ucy4gVGhpcyBmdW5jdGlvbiBpcyBOT1QgYXZhaWxhYmxlIG9uIHRoZSBwcm90b3R5cGUgb2YgYEh0dHBDbGllbnRgLlxuICAgICAqXG4gICAgICogQHJldHVybnMge1JlcXVlc3RPcHRpb25zfVxuICAgICAqL1xuICAgIHRoaXMuY29weU9wdGlvbnMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBtZXJnZSh7fSwgZGVmYXVsdE9wdGlvbnMpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBNZXJnZSB0aGUgcmVxdWVzdCBvcHRpb25zIHdpdGggdGhlIGRlZmF1bHQgcmVxdWVzdCBvcHRpb25zLiBUaGlzIGZ1bmN0aW9uIGlzIE5PVCBhdmFpbGFibGUgb24gdGhlIHByb3RvdHlwZSBvZlxuICAgICAqIGBIdHRwQ2xpZW50YCBhbmQgd2lsbCBjYWxsIGBoYW5kbGVSZXF1ZXN0T3B0aW9uc2AgdG8gaGFuZGxlIHRoZSBtZXJnZWQgcmVxdWVzdCBvcHRpb25zLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zIHRvIG1lcmdlLlxuICAgICAqIEByZXR1cm5zIHtSZXF1ZXN0T3B0aW9uc30gUmV0dXJucyB0aGUgbWVyZ2VkIHJlcXVlc3Qgb3B0aW9ucy5cbiAgICAgKi9cbiAgICB0aGlzLm1lcmdlT3B0aW9ucyA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIHZhciByZXF1ZXN0T3B0aW9ucyA9IG1lcmdlKHt9LCBkZWZhdWx0T3B0aW9ucywgb3B0aW9ucyk7XG5cbiAgICAgICAgaGFuZGxlUmVxdWVzdE9wdGlvbnMocmVxdWVzdE9wdGlvbnMpO1xuXG4gICAgICAgIHJldHVybiByZXF1ZXN0T3B0aW9ucztcbiAgICB9O1xufVxuXG4vKipcbiAqIFNlbmQgYW4gaHR0cCByZXF1ZXN0LlxuICpcbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucyB0byB1c2UsIHdoaWNoIHdpbGwgYmUgbWVyZ2VkIGludG8gYSBjb3B5IG9mIHRoZSBkZWZhdWx0IG9wdGlvbnMuXG4gKiBAcGFyYW0ge1JlcXVlc3RTdWNjZXNzQ2FsbGJhY2t9IG9uc3VjY2VzcyBUaGUgY2FsbGJhY2sgdG8gY2FsbCBvbiBzdWNjZXNzLlxuICogQHBhcmFtIHtSZXF1ZXN0RXJyb3JDYWxsYmFja30gb25lcnJvciBUaGUgY2FsbGJhY2sgdG8gY2FsbCBvbiBlcnJvci5cbiAqIEByZXR1cm5zIHtIdHRwUmVxdWVzdH0gUmV0dXJucyBhbiBpbnN0YW5jZSBvZiBgSHR0cFJlcXVlc3RgLlxuICovXG5IdHRwQ2xpZW50LnByb3RvdHlwZS5zZW5kID0gZnVuY3Rpb24gKG9wdGlvbnMsIG9uc3VjY2Vzcywgb25lcnJvcikge1xuICAgIHZhciByZXF1ZXN0T3B0aW9ucyA9IHRoaXMubWVyZ2VPcHRpb25zKG9wdGlvbnMpO1xuXG4gICAgcmVxdWVzdE9wdGlvbnMucmVxdWVzdEZ1bmN0aW9uTmFtZSA9ICdzZW5kJztcbiAgICByZXF1ZXN0T3B0aW9ucy5jb250cm9sbGVyID0gbnVsbDtcblxuICAgIHJldHVybiBuZXcgSHR0cFJlcXVlc3QocmVxdWVzdE9wdGlvbnMsIG9uc3VjY2Vzcywgb25lcnJvcik7XG59O1xuXG4vKipcbiAqIFNlbmQgYW4gaHR0cCByZXF1ZXN0IGFuZCByZXR1cm4gYSBwcm9taXNlLlxuICpcbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucyB0byB1c2UsIHdoaWNoIHdpbGwgYmUgbWVyZ2VkIGludG8gYSBjb3B5IG9mIHRoZSBkZWZhdWx0IG9wdGlvbnMuXG4gKiBAcmV0dXJucyB7UHJvbWlzZX0gUmV0dXJucyBhbiBpbnN0YW5jZSBvZiBgUHJvbWlzZWAuXG4gKi9cbkh0dHBDbGllbnQucHJvdG90eXBlLmZldGNoID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICB2YXIgcmVxdWVzdE9wdGlvbnMgPSB0aGlzLm1lcmdlT3B0aW9ucyhvcHRpb25zKTtcbiAgICB2YXIgY29udHJvbGxlciA9IHJlcXVlc3RPcHRpb25zLmNvbnRyb2xsZXI7XG5cbiAgICByZXF1ZXN0T3B0aW9ucy5yZXF1ZXN0RnVuY3Rpb25OYW1lID0gJ2ZldGNoJztcblxuICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgIHZhciByZXF1ZXN0ID0gbmV3IEh0dHBSZXF1ZXN0KHJlcXVlc3RPcHRpb25zLCBmdW5jdGlvbiAocmVzcG9uc2UpIHtcbiAgICAgICAgICAgIGlmIChjb250cm9sbGVyKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFjb250cm9sbGVyLmlzQ2FuY2VsbGVkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShyZXNwb25zZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHJlc3BvbnNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgcmVqZWN0KTtcblxuICAgICAgICBpZiAoY29udHJvbGxlcikge1xuICAgICAgICAgICAgLy8gVHJpZ2dlciB0aGUgYEVSUl9DQU5DRUxMRURgIGVycm9yLlxuICAgICAgICAgICAgaWYgKGNvbnRyb2xsZXIuaXNDYW5jZWxsZWQoKSkge1xuICAgICAgICAgICAgICAgIHJlcXVlc3QuY2FuY2VsKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnRyb2xsZXIucmVnaXN0ZXJDYW5jZWxDYWxsYmFjayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlcXVlc3QuY2FuY2VsKCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbn07XG5cbi8qKlxuICogU2VuZCBhIGpzb25wIHJlcXVlc3QuXG4gKlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zIHRvIHVzZSwgd2hpY2ggd2lsbCBiZSBtZXJnZWQgaW50byBhIGNvcHkgb2YgdGhlIGRlZmF1bHQgb3B0aW9ucy5cbiAqIEBwYXJhbSB7UmVxdWVzdFN1Y2Nlc3NDYWxsYmFja30gb25zdWNjZXNzIFRoZSBjYWxsYmFjayB0byBjYWxsIG9uIHN1Y2Nlc3MuXG4gKiBAcGFyYW0ge1JlcXVlc3RFcnJvckNhbGxiYWNrfSBvbmVycm9yIFRoZSBjYWxsYmFjayB0byBjYWxsIG9uIGVycm9yLlxuICogQHJldHVybnMge0pTT05QUmVxdWVzdH0gUmV0dXJucyBhbiBpbnN0YW5jZSBvZiBgSlNPTlBSZXF1ZXN0YC5cbiAqL1xuSHR0cENsaWVudC5wcm90b3R5cGUuZ2V0SlNPTlAgPSBmdW5jdGlvbiAob3B0aW9ucywgb25zdWNjZXNzLCBvbmVycm9yKSB7XG4gICAgdmFyIHJlcXVlc3RPcHRpb25zID0gdGhpcy5tZXJnZU9wdGlvbnMob3B0aW9ucyk7XG5cbiAgICByZXF1ZXN0T3B0aW9ucy5yZXF1ZXN0RnVuY3Rpb25OYW1lID0gJ2dldEpTT05QJztcbiAgICByZXF1ZXN0T3B0aW9ucy5jb250cm9sbGVyID0gbnVsbDtcblxuICAgIHJldHVybiBuZXcgSlNPTlBSZXF1ZXN0KHJlcXVlc3RPcHRpb25zLCBvbnN1Y2Nlc3MsIG9uZXJyb3IpO1xufTtcblxuLyoqXG4gKiBTZW5kIGEganNvbnAgcmVxdWVzdCBhbmQgcmV0dXJuIGEgcHJvbWlzZS5cbiAqXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMgdG8gdXNlLCB3aGljaCB3aWxsIGJlIG1lcmdlZCBpbnRvIGEgY29weSBvZiB0aGUgZGVmYXVsdCBvcHRpb25zLlxuICogQHJldHVybnMge1Byb21pc2V9IFJldHVybnMgYW4gaW5zdGFuY2Ugb2YgYFByb21pc2VgLlxuICovXG5IdHRwQ2xpZW50LnByb3RvdHlwZS5mZXRjaEpTT05QID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICB2YXIgcmVxdWVzdE9wdGlvbnMgPSB0aGlzLm1lcmdlT3B0aW9ucyhvcHRpb25zKTtcbiAgICB2YXIgY29udHJvbGxlciA9IHJlcXVlc3RPcHRpb25zLmNvbnRyb2xsZXI7XG5cbiAgICByZXF1ZXN0T3B0aW9ucy5yZXF1ZXN0RnVuY3Rpb25OYW1lID0gJ2ZldGNoSlNPTlAnO1xuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgdmFyIHJlcXVlc3QgPSBuZXcgSlNPTlBSZXF1ZXN0KHJlcXVlc3RPcHRpb25zLCBmdW5jdGlvbiAocmVzcG9uc2UpIHtcbiAgICAgICAgICAgIGlmIChjb250cm9sbGVyKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFjb250cm9sbGVyLmlzQ2FuY2VsbGVkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShyZXNwb25zZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHJlc3BvbnNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgcmVqZWN0KTtcblxuICAgICAgICBpZiAoY29udHJvbGxlcikge1xuICAgICAgICAgICAgLy8gVHJpZ2dlciB0aGUgYEVSUl9DQU5DRUxMRURgIGVycm9yLlxuICAgICAgICAgICAgaWYgKGNvbnRyb2xsZXIuaXNDYW5jZWxsZWQoKSkge1xuICAgICAgICAgICAgICAgIHJlcXVlc3QuY2FuY2VsKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnRyb2xsZXIucmVnaXN0ZXJDYW5jZWxDYWxsYmFjayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlcXVlc3QuY2FuY2VsKCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbn07XG5cbi8qKlxuICogQ3JlYXRlIGEgbmV3IGluc3RhbmNlIG9mIGBDYW5jZWxDb250cm9sbGVyYC5cbiAqXG4gKiBAcmV0dXJucyB7Q2FuY2VsQ29udHJvbGxlcn0gUmV0dXJucyBhbiBuZXcgaW5zdGFuY2Ugb2YgYENhbmNlbENvbnRyb2xsZXJgLlxuICovXG5IdHRwQ2xpZW50LnByb3RvdHlwZS5jcmVhdGVDYW5jZWxDb250cm9sbGVyID0gY3JlYXRlQ2FuY2VsQ29udHJvbGxlcjtcblxuLyoqXG4gKiBDcmVhdGUgYSBuZXcgaW5zdGFuY2Ugb2YgYENhbmNlbENvbnRyb2xsZXJgLlxuICpcbiAqIEByZXR1cm5zIHtDYW5jZWxDb250cm9sbGVyfSBSZXR1cm5zIGFuIG5ldyBpbnN0YW5jZSBvZiBgQ2FuY2VsQ29udHJvbGxlcmAuXG4gKi9cbkh0dHBDbGllbnQuY3JlYXRlQ2FuY2VsQ29udHJvbGxlciA9IGNyZWF0ZUNhbmNlbENvbnRyb2xsZXI7XG5cbi8vIFRoZSB2ZXJzaW9uLlxuSHR0cENsaWVudC52ZXJzaW9uID0gdmVyc2lvbjtcbkh0dHBDbGllbnQucHJvdG90eXBlLnZlcnNpb24gPSB2ZXJzaW9uO1xuXG5kZWZpbmVFeHBvcnRzKEh0dHBDbGllbnQsICdjb25zdGFudHMnLCBtZXJnZSh7fSwgY29uc3RhbnRzKSk7XG5cbmRlZmluZUV4cG9ydHMoSHR0cENsaWVudCwgJ2xpYnMnLCB7XG4gICAgUVM6IFFTXG59KTtcblxuZGVmaW5lRXhwb3J0cyhIdHRwQ2xpZW50LCAnY2xhc3NlcycsIHtcbiAgICBDYW5jZWxDb250cm9sbGVyOiBDYW5jZWxDb250cm9sbGVyLFxuICAgIEh0dHBDbGllbnQ6IEh0dHBDbGllbnQsXG4gICAgSHR0cFJlcXVlc3Q6IEh0dHBSZXF1ZXN0LFxuICAgIEh0dHBSZXNwb25zZTogSHR0cFJlc3BvbnNlLFxuICAgIEh0dHBSZXNwb25zZUVycm9yOiBIdHRwUmVzcG9uc2VFcnJvcixcbiAgICBKU09OUFJlcXVlc3Q6IEpTT05QUmVxdWVzdCxcbiAgICBKU09OUFJlc3BvbnNlOiBKU09OUFJlc3BvbnNlLFxuICAgIEpTT05QUmVzcG9uc2VFcnJvcjogSlNPTlBSZXNwb25zZUVycm9yLFxuICAgIFJlcXVlc3Q6IFJlcXVlc3QsXG4gICAgUmVzcG9uc2U6IFJlc3BvbnNlLFxuICAgIFJlc3BvbnNlRXJyb3I6IFJlc3BvbnNlRXJyb3Jcbn0pO1xuXG5kZWZpbmVFeHBvcnRzKEh0dHBDbGllbnQsICdmdW5jdGlvbnMnLCB7XG4gICAgdGVtcGxhdGU6IHRlbXBsYXRlLFxuICAgIG1lcmdlOiBtZXJnZSxcbiAgICBpc0Fic29sdXRlVVJMOiBpc0Fic29sdXRlVVJMLFxuICAgIGlzRnVuY3Rpb246IGlzRnVuY3Rpb24sXG4gICAgaXNQbGFpbk9iamVjdDogaXNQbGFpbk9iamVjdCxcbiAgICB1dWlkOiB1dWlkLFxuICAgIG5vb3A6IG5vb3AsXG4gICAgaW5oZXJpdHM6IGluaGVyaXRzLFxuICAgIGNyZWF0ZURlZmF1bHRPcHRpb25zOiBjcmVhdGVEZWZhdWx0T3B0aW9uc1xufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gSHR0cENsaWVudDtcblxuLyoqXG4gKiBUaGlzIGNhbGxiYWNrIGlzIHVzZWQgdG8gaGFubGRlIHRoZSBtZXJnZWQgcmVxdWVzdCBvcHRpb25zLiBJdCBtdXN0IHJldHJ1biB0aGUgcmVzdWx0IHN5bmNocm9ub3VzbHkuXG4gKlxuICogQGNhbGxiYWNrIEhhbmRsZU9wdGlvbnNGdW5jdGlvblxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgbWVyZ2VkIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEByZXR1cm5zIHt2b2lkfVxuICovXG5cbi8qKlxuICogVGhlIGNhbGxiYWNrIHRvIGNhbGwgb24gc3VjY2Vzcy5cbiAqXG4gKiBAY2FsbGJhY2sgUmVxdWVzdFN1Y2Nlc3NDYWxsYmFja1xuICogQHBhcmFtIHtIdHRwUmVzcG9uc2V8YW55fSByZXNwb25zZSBUaGUgaHR0cCByZXNwb25zZSBvciB0aGUgcmV0dXJuIHZhbHVlIG9mIGBvcHRpb25zLnRyYW5zZm9ybVJlc3BvbnNlKHJlc3BvbnNlKWAuXG4gKi9cblxuLyoqXG4gKiBUaGUgY2FsbGJhY2sgdG8gY2FsbCBvbiBlcnJvci5cbiAqXG4gKiBAY2FsbGJhY2sgUmVxdWVzdEVycm9yQ2FsbGJhY2tcbiAqIEBwYXJhbSB7SHR0cFJlc3BvbnNlRXJyb3J8YW55fSBlcnJvciBUaGUgaHR0cCByZXNwb25zZSBlcnJvciBvciB0aGUgcmV0dXJuIHZhbHVlIG9mIGBvcHRpb25zLnRyYW5zZm9ybUVycm9yKGVycm9yKWAuXG4gKi9cblxuLyoqXG4gKiBUaGUgZGVmaW5pdG9uIG9mIHRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKlxuICogQHR5cGVkZWYge09iamVjdC48c3RyaW5nLCAqPn0gUmVxdWVzdE9wdGlvbnNcbiAqXG4gKiBAcHJvcGVydHkge3N0cmluZ30gW21ldGhvZF0gVGhlIGh0dHAgcmVxdWVzdCBtZXRob2QuIFRoZSBkZWZhdWx0IG1ldGhvZCBpcyBgR0VUYC5cbiAqXG4gKiBAcHJvcGVydHkge3N0cmluZ30gW2Jhc2VVUkxdIFRoZSByZXF1ZXN0IGJhc2UgdXJsLiBJZiB0aGUgYHVybGAgaXMgcmVsYXRpdmUgdXJsLCBhbmQgdGhlIGBiYXNlVVJMYCBpcyBub3QgYG51bGxgLCB0aGVcbiAqIGBiYXNlVVJMYCB3aWxsIGJlIHByZXBlbmQgdG8gdGhlIGB1cmxgLlxuICpcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSB1cmwgVGhlIHJlcXVlc3QgdXJsIHRoYXQgY2FuIGNvbnRhaW4gYW55IG51bWJlciBvZiBwbGFjZWhvbGRlcnMsIGFuZCB3aWxsIGJlIGNvbXBpbGVkIHdpdGggdGhlXG4gKiBkYXRhIHRoYXQgcGFzc2VkIGluIHdpdGggYG9wdGlvbnMubW9kZWxgLlxuICpcbiAqIEBwcm9wZXJ0eSB7T2JqZWN0LjxzdHJpbmcsICo+fSBbbW9kZWxdIFRoZSBkYXRhIHVzZWQgdG8gY29tcGlsZSB0aGUgcmVxdWVzdCB1cmwuXG4gKlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgKj59IFtxdWVyeV0gVGhlIGRhdGEgdGhhdCB3aWxsIGJlIGNvbXBpbGVkIHRvIHF1ZXJ5IHN0cmluZy5cbiAqXG4gKiBAcHJvcGVydHkge09iamVjdC48c3RyaW5nLCAqPn0gW2JvZHldIFRoZSBvYmplY3QgdGhhdCBjb250YWlucyB0aGUgY29udGVudCB3aGljaCB3aWxsIGJlIHNlbmQgdG8gdGhlIHNlcnZlci4gVGhpc1xuICogb2JqZWN0IGhhcyBvbmx5IG9uZSBwcm9wZXJ0eS4gVGhlIG5hbWUgb2YgdGhlIHByb3BlcnR5IGlzIHRoZSBjb250ZW50IHR5cGUgb2YgdGhlIGNvbnRlbnQsIHdoaWNoIHdpbGwgYmUgdXNlZCB0byBmaW5kXG4gKiBhIHByb2Nlc3NvciBpbiBgb3B0aW9ucy5odHRwUmVxdWVzdEJvZHlQcm9jZXNzb3JgLiBUaGUgcHJvY2Vzc29yIGlzIHVzZWQgdG8gcHJvY2VzcyB0aGUgdmFsdWUgb2YgdGhlIHByb3BlcnR5LiBUaGVcbiAqIHByb2Nlc3NlZCB2YWx1ZSB3aGljaCB0aGUgcHJvY2Vzc29yIHJldHVybnMgd2lsbCBiZSBzZW5kIHRvIHRoZSBzZXJ2ZXIgYXMgdGhlIHJlcXVlc3QgYm9keS5cbiAqXG4gKiBAcHJvcGVydHkge09iamVjdC48c3RyaW5nLCAqPn0gW3NldHRpbmdzXSBUaGUgb2JqZWN0IHRvIGtlZXAgdGhlIHNldHRpbmdzIGluZm9ybWF0aW9uIHRoYXQgdGhlIHVzZXIgcGFzc2VkIGluLiBUaGVcbiAqIGxpYnJhcnkgaXRzZWxmIHdpbGwgbm90IHRvdWNoIHRoaXMgcHJvcGVydHkuIFlvdSBjYW4gdXNlIHRoaXMgcHJvcGVydHkgdG8gaG9sZCBhbnkgaW5mb3JtYXRpb24gdGhhdCB5b3Ugd2FudCwgd2hlblxuICogeW91IGV4dGVuZCB0aGUgZnVuY3Rpb25hbGl0eSBvZiB5b3VyIG93biBpbnN0YW5jZSBvZiBgSHR0cENsaWVudGAuIFRoZSBkZWZhdWx0IHZhbHVlIG9mIHRoaXMgcHJvcGVydHkgaXMgYW4gZW1wdHlcbiAqIG9iamVjdC5cbiAqXG4gKiBAcHJvcGVydHkge09iamVjdC48c3RyaW5nLCAqPn0gW2hlYWRlcnNdIFRoZSBvYmplY3QgdGhhdCBjb250YWlucyB0aGUgaGVhZGVycyB0byBzZXQgd2hlbiBzZW5kaW5nIHRoZSByZXF1ZXN0LiBPbmx5XG4gKiB0aGUgbm9uLXVuZGVmaW5lZCBhbmQgbm9uLW51bGwgaGVhZGVycyBhcmUgc2V0LlxuICpcbiAqIEBwcm9wZXJ0eSB7Q2FuY2VsQ29udHJvbGxlcn0gW2NvbnRyb2xsZXJdIFRoZSBgQ2FuY2VsQ29udHJvbGxlcmAgdXNlZCB0byBjYW5jZWwgdGhlIHJlcXVlc3QuIEl0IG9ubHkgd29ya3Mgd2hlbiB1c2luZ1xuICogYGZldGNoYCBvciBgZmV0Y2hKU09OUGAgdG8gc2VuZCByZXF1ZXN0LiBJZiB0aGUgeW91IHNlbmQgcmVxdWVzdCB1c2luZyBgc2VuZGAgb3IgYGdldEpTT05QYCwgdGhlIGBvcHRpb25zLmNvbnRyb2xsZXJgXG4gKiB3aWxsIGJlIHNldCB0byBgbnVsbGAuXG4gKlxuICogQHByb3BlcnR5IHtzdHJpbmd9IFtyZXF1ZXN0RnVuY3Rpb25OYW1lXSBUaGUgbmFtZSBvZiB0aGUgZnVuY3Rpb24gdGhhdCBzZW5kIHRoZSByZXF1ZXN0LiBDYW4gYmUgYHNlbmRgLCBgZmV0Y2hgLFxuICogYGdldEpTT05QYCwgYGZldGNoSlNPTlBgLiBUaGlzIHZhbHVlIGlzIHNldCBieSB0aGUgbGlicmFyeSwgZG9uJ3QgY2hhbmdlIGl0LlxuICpcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbcmVxdWVzdFR5cGVdIFRoZSByZXF1ZXN0IHR5cGUgb2YgdGhpcyByZXF1ZXN0LiBUaGUgdmFsdWUgb2YgaXQgaXMgc2V0IGJ5IHRoZSBsaWJyYXJ5IGl0c2VsZiwgY2FuXG4gKiBiZSBgSFRUUF9SRVFVRVNUYCBvciBgSlNPTlBfUkVRVUVTVGAuIEFueSBvdGhlciB2YWx1ZSB0aGUgdXNlciBwYXNzZWQgaW4gaXMgaWdub3JlZC4gWW91IGNhbiB1c2UgdGhpcyBwcm9wZXJ0eSB0byBnZXRcbiAqIHRoZSB0eXBlIG9mIHRoZSBjdXJyZW50IHJlcXVlc3QuXG4gKlxuICogQHByb3BlcnR5IHtib29sZWFufSBbY29yc10gV2hldGhlciB0byBzZXQgYHdpdGhDcmVkZW50aWFsc2AgcHJvcGVydHkgb2YgdGhlIGBYTUxIdHRwUmVxdWVzdGAgdG8gYHRydWVgLiBUaGUgZGVmYXVsdFxuICogdmFsdWUgaXMgYGZhbHNlYC5cbiAqXG4gKiBAcHJvcGVydHkge09iamVjdC48c3RyaW5nLCAqPn0gW3hoclByb3BzXSBUaGUgb2JqZWN0IHRoYXQgY29udGFpbnMgdGhlIHByb3BlcnRpZXMgdG8gc2V0IG9uIHRoZSBpbnN0YW5jZSBvZiB0aGVcbiAqIGBYTUxIdHRwUmVxdWVzdGAuXG4gKlxuICogQHByb3BlcnR5IHtzdHJpbmd9IFt1c2VybmFtZV0gVGhlIHVzZXIgbmFtZSB0byB1c2UgZm9yIGF1dGhlbnRpY2F0aW9uIHB1cnBvc2VzLiBUaGUgZGVmdWFsdCB2YWx1ZSBpcyBgbnVsbGAuXG4gKlxuICogQHByb3BlcnR5IHtzdHJpbmd9IFtwYXNzd29yZF0gVGhlIHBhc3N3b3JkIHRvIHVzZSBmb3IgYXV0aGVudGljYXRpb24gcHVycG9zZXMuIFRoZSBkZWZ1YWx0IHZhbHVlIGlzIGBudWxsYC5cbiAqXG4gKiBAcHJvcGVydHkge251bWJlcn0gW3RpbWVvdXRdIFRoZSBudW1iZXIgb2YgbWlsbGlzZWNvbmRzIHRoZSByZXF1ZXN0IGNhbiB0YWtlIGJlZm9yZSBpdCBmaW5pc2hlZC4gSWYgdGhlIHRpbWVvdXQgdmFsdWVcbiAqIGlzIGAwYCwgbm8gdGltZXIgd2lsbCBiZSBzZXQuIElmIHRoZSByZXF1ZXN0IGRvZXMgbm90IGZpbnNpaGVkIHdpdGhpbiB0aGUgZ2l2ZW4gdGltZSwgYSB0aW1lb3V0IGVycm9yIHdpbGwgYmUgdGhyb3duLlxuICogVGhlIGRlZmF1bHQgdmFsdWUgaXMgYDBgLlxuICpcbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gW25vQ2FjaGVdIFdoZXRoZXIgdG8gZGlzYWJsZSB0aGUgY2FjaGUuIElmIHRoZSB2YWx1ZSBpcyBgdHJ1ZWAsIHRoZSBoZWFkZXJzIGluXG4gKiBgb3B0aW9ucy5ub0NhY2hlSGVhZGVyc2Agd2lsbCBiZSBzZXQuIFRoZSBkZWZhdWx0IHZhbHVlIGlzIGBmYWxzZWAuXG4gKlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgKj59IFtub0NhY2hlSGVhZGVyc10gVGhlIGhlYWRlcnMgdG8gc2V0IHdoZW4gYG9wdGlvbnMubm9DYWNoZWAgaXMgc2V0IHRvIGB0cnVlYC5cbiAqXG4gKiBAcHJvcGVydHkge3N0cmluZ30gW2pzb25wXSBUaGUgcXVlcnkgc3RyaW5nIGtleSB0byBob2xkIHRoZSB2YWx1ZSBvZiB0aGUgY2FsbGJhY2sgbmFtZSB3aGVuIHNlbmRpbmcgSlNPTlAgcmVxdWVzdC5cbiAqIFRoZSBkZWZhdWx0IHZhbHVlcyBpcyBgY2FsbGJhY2tgLlxuICpcbiAqIEBwcm9wZXJ0eSB7T2JqZWN0LjxzdHJpbmcsIGh0dHBSZXF1ZXN0Qm9keVByb2Nlc3Nvcj59IFtodHRwUmVxdWVzdEJvZHlQcm9jZXNzb3JdIFRoZSBvYmplY3QgdGhhdCBjb250YWlucyB0aGVcbiAqIGh0dHAgcmVxdWVzdCBib2R5IHByb2Nlc3NvcnMuXG4gKlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgUmVzcG9uc2VQYXJzZUZ1bmN0aW9uPn0gW2h0dHBSZXNwb25zZVBhcnNlcl0gVGhlIG9iamVjdCB0aGF0IGNvbnRhaW5zIHRoZSBodHRwIHJlc3BvbnNlXG4gKiBwYXJzZXJzLlxuICpcbiAqIEBwcm9wZXJ0eSB7T2JqZWN0LjxzdHJpbmcsIFJlc3BvbnNlUGFyc2VGdW5jdGlvbj59IFtqc29ucFJlc3BvbnNlUGFyc2VyXSBUaGUgb2JqZWN0IHRoYXQgY29udGFpbnMgdGhlIGpzb25wIHJlc3BvbnNlXG4gKiBwYXJzZXJzLlxuICpcbiAqIEBwcm9wZXJ0eSB7T2JqZWN0LjxzdHJpbmcsIFJlc3BvbnNlRXJyb3JQYXJzZUZ1bmN0aW9uPn0gW2h0dHBSZXNwb25zZUVycm9yUGFyc2VyXSBUaGUgb2JqZWN0IHRoYXQgY29udGFpbnMgdGhlIGh0dHBcbiAqIHJlc3BvbnNlIGVycm9yIHBhcnNlcnMuXG4gKlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgUmVzcG9uc2VFcnJvclBhcnNlRnVuY3Rpb24+fSBbanNvbnBSZXNwb25zZUVycm9yUGFyc2VyXSBUaGUgb2JqZWN0IHRoYXQgY29udGFpbnMgdGhlIGpzb25wXG4gKiByZXNwb25zZSBlcnJvciBwYXJzZXJzLlxuICpcbiAqIEBwcm9wZXJ0eSB7SGFubGRlT3B0aW9uc0Z1bmN0aW9ufSBbaGFuZGxlT3B0aW9uc10gVGhlIGZ1bmN0aW9uIHRvIGhhbmRsZSB0aGUgb3B0aW9ucy5cbiAqXG4gKiBAcHJvcGVydHkge0NyZWF0ZVhIUkZ1bmN0aW9ufSBbY3JlYXRlWEhSXSBUaGUgZnVuY3Rpb24gdG8gY3JlYXRlIHRoZSBgWE1MSHR0cFJlcXVlc3RgIGluc3RhbmNlLlxuICpcbiAqIEBwcm9wZXJ0eSB7U2NyaXB0Q3JlYXRlRnVuY3Rpb259IFtjcmVhdGVTY3JpcHRdIFRoZSBmdW5jdGlvbiB0byBjcmVhdGUgdGhlIGBIVE1MU2NyaXB0RWxlbWVudGAgaW5zdGFuY2UuXG4gKlxuICogQHByb3BlcnR5IHtKU09OUENvbnRhaW5lckZpbmRGdW5jdGlvbn0gW2pzb25wQ29udGFpbmVyTm9kZV0gVGhlIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyB0aGUgY29udGFpbmVyIG5vZGUsIHdoaWNoIHdpbGxcbiAqIGJlIHVzZWQgdG8gYXBwZW5kIHRoZSBzY3JpcHQgZWxlbWVudCB3aGVuIHNlbmRpbmcganNvbnAgcmVxdWVzdC5cbiAqXG4gKiBAcHJvcGVydHkge0pTT05QQ2FsbGJhY2tOYW1lR2VuZXJhdGVGdW5jdGlvbn0gW2pzb25wQ2FsbGJhY2tOYW1lXSBUaGUgZnVuY3Rpb24gdG8gZ2VuZXJhdGUgdGhlIHVuaXF1ZSBjYWxsYmFjayBuYW1lXG4gKiB3aGVuIHNlbmRpbmcganNvbnAgcmVxdWVzdC5cbiAqXG4gKiBAcHJvcGVydHkge0NvbXBpbGVVUkxGdW5jdGlvbn0gW2NvbXBpbGVVUkxdIFRoZSBmdW5jdGlvbiB0byBjb21waWxlIHVybC5cbiAqXG4gKiBAcHJvcGVydHkge0VuY29kZVF1ZXJ5U3RyaW5nRnVuY3Rpb259IGVuY29kZVF1ZXJ5U3RyaW5nIFRoZSBmdW5jdGlvbiB0byBlbmNvZGUgdGhlIHF1ZXJ5IHN0cmluZy5cbiAqXG4gKiBAcHJvcGVydHkge1hIUkhvb2tGdW5jdGlvbn0gb25YaHJDcmVhdGVkIFRoZSBmdW5jdGlvbiB0byBjYWxsIG9uIHhociBjcmVhdGVkLlxuICpcbiAqIEBwcm9wZXJ0eSB7WEhSSG9va0Z1bmN0aW9ufSBvblhock9wZW5lZCBUaGUgZnVuY3RvbiB0byBjYWxsIG9uIHhociBvcGVuZWQuXG4gKlxuICogQHByb3BlcnR5IHtYSFJIb29rRnVuY3Rpb259IG9uWGhyU2VudCBUaGUgZnVuY3Rpb24gdG8gY2FsbCBvbiB4aHIgc2VudC5cbiAqXG4gKiBAcHJvcGVydHkge1JlcXVlc3RDcmVhdGVkRnVuY3Rpb259IG9uUmVxdWVzdENyZWF0ZWQgVGhlIGZ1bmN0aW9uIHRvIGNhbGwgb24gcmVxdWVzdCBjcmVhdGVkLlxuICpcbiAqIEBwcm9wZXJ0eSB7Q2hlY2tSZXNwb25zZU9rRnVuY3Rpb259IGlzUmVzcG9uc2VPayBUaGUgZnVuY3Rpb24gdG8gY2hlY2sgd2hldGhlciB0aGUgcmVzcG9uc2UgaXMgb2suXG4gKlxuICogQHByb3BlcnR5IHtUcmFuc2Zvcm1FcnJvckZ1bmN0aW9ufSB0cmFuc2Zvcm1FcnJvciBUaGUgZnVuY3Rpb24gdG8gdHJhbnNmcm9tIHRoZSByZXNwb25zZSBlcnJvci4gVGhlIHJldHVybiB2YWx1ZSBvZlxuICogdGhpcyBmdW5jdGlvbiB3aWxsIGJlIHBhc3NlZCB0byB0aGUgYG9uZXJyb3JgIGNhbGxiYWNrLlxuICpcbiAqIEBwcm9wZXJ0eSB7VHJhbnNmb3JtUmVzcG9uc2VGdW5jdGlvbn0gdHJhbnNmb3JtUmVzcG9uc2UgVGhlIGZ1bmN0aW9uIHRvIHRyYW5zZnJvbSB0aGUgcmVzcG9uc2UuIFRoZSByZXR1cm4gdmFsdWUgb2ZcbiAqIHRoaXMgZnVuY3Rpb24gd2lsbCBiZSBwYXNzZWQgdG8gdGhlIGBvbnN1Y2Nlc3NgIGNhbGxiYWNrLlxuICpcbiAqIEBwcm9wZXJ0eSB7Q2hlY2tTaG91bGRDYWxsRXJyb3JDYWxsYmFja0Z1bmN0aW9ufSBzaG91bGRDYWxsRXJyb3JDYWxsYmFjayBUaGUgZnVuY3Rpb24gdG8gY2hlY2sgd2hldGhlciB0byBjYWxsIHRoZVxuICogZXJyb3IgY2FsbGJhY2suXG4gKlxuICogQHByb3BlcnR5IHtDaGVja1Nob3VsZENhbGxTdWNjZXNzQ2FsbGJhY2tGdW5jdGlvbn0gc2hvdWxkQ2FsbFN1Y2Nlc3NDYWxsYmFjayBUaGUgZnVuY3Rpb24gdG8gY2hlY2sgd2hldGhlciB0byBjYWxsXG4gKiB0aGUgc3VjY2VzcyBjYWxsYmFjay5cbiAqL1xuXG4vKipcbiAqIFRoZSBkZWZpbml0b24gb2YgaHR0cCByZXF1ZXN0IGRhdGEgcHJvY2Vzc29yLlxuICpcbiAqIEB0eXBlZGVmIHtPYmplY3QuPHN0cmluZywgKj59IGh0dHBSZXF1ZXN0Qm9keVByb2Nlc3NvclxuICogQHByb3BlcnR5IHtudW1iZXJ9IHByaW9yaXR5IFRoZSBwcmlvcml0eSBvZiB0aGUgcHJvY2Vzc29yLlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgKj59IFtoZWFkZXJzXSBUaGUgaGVhZGVycyB0byBzZXQgd2hlbiB0aGlzIHByb2Nlc3NvciBpcyB1c2VkLlxuICogQHByb3BlcnR5IHtIdHRwUmVxdWVzdENvbnRlbnRQcm9jZXNzRnVuY3Rpb259IFtwcm9jZXNzb3JdIFRoZSBmdW5jdGlvbiB0byBwcm9jZXNzIHRoZSByZXF1ZXN0IGJvZHkuXG4gKi9cblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gaGFuZGxlIHRoZSBvcHRpb25zLlxuICpcbiAqIEBjYWxsYmFjayBIYW5sZGVPcHRpb25zRnVuY3Rpb25cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBwcm9jZXNzIHRoZSByZXF1ZXN0IGRhdGEuXG4gKlxuICogQGNhbGxiYWNrIEh0dHBSZXF1ZXN0Q29udGVudFByb2Nlc3NGdW5jdGlvblxuICogQHBhcmFtIHtPYmplY3QuPHN0cmluZywgKj59IGNvbnRlbnQgVGhlIGNvbmVudCBuZWVkIHRvIHByb2Nlc3MuXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMgb2YgdGhlIGN1cnJlbnQgcmVxdWVzdC5cbiAqIEByZXR1cm5zIHthbnl9IFJldHVybnMgdGhlIHZhbHVlIHRoYXQgd2lsbCBiZSBzZW5kIHRvIHRoZSBzZXJ2ZXIuXG4gKi9cblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gcGFyc2UgdGhlIHJlc3BvbnNlLiBUaGlzIGZ1bmN0aW9uIHdpbGwgYmUgbW91bnRlZCBvbiB0aGUgcmVzcG9uc2UgaW5zdGFuY2UsIHdoaWNoIG1hZGUgaXQgYSBtZXRob2RcbiAqIG9mIHRoZSBgUmVzcG9uc2VgIGluc3RhbmNlLiBUaGUgcGFyYW1ldGVycyBhbmQgdGhlIHJldHVybiB2YWx1ZSBpcyB1cCBvbiB5b3UuXG4gKlxuICogQGNhbGxiYWNrIFJlc3BvbnNlUGFyc2VGdW5jdGlvblxuICovXG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIHBhcnNlIHRoZSByZXNwb25zZSBlcnJvci4gVGhpcyBmdW5jdGlvbiB3aWxsIGJlIG1vdW50ZWQgb24gdGhlIHJlc3BvbnNlIGVycm9yIGluc3RhbmNlLCB3aGljaCBtYWRlIGl0XG4gKiBhIG1ldGhvZCBvZiB0aGUgYFJlc3BvbnNlRXJyb3JgIGluc3RhbmNlLiBUaGUgcGFyYW1ldGVycyBhbmQgdGhlIHJldHVybiB2YWx1ZSBpcyB1cCBvbiB5b3UuXG4gKlxuICogQGNhbGxiYWNrIFJlc3BvbnNlRXJyb3JQYXJzZUZ1bmN0aW9uXG4gKi9cblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gY3JlYXRlIHRoZSBgWE1MSHR0cFJlcXVlc3RgIGluc3RhbmNlLlxuICpcbiAqIEBjYWxsYmFjayBDcmVhdGVYSFJGdW5jdGlvblxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICogQHJldHVybnMge1hNTEh0dHBSZXF1ZXN0fSBSZXR1cm5zIGFuIGluc3RhbmNlIG9mIGBYTUxIdHRwUmVxdWVzdGAuXG4gKi9cblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gY3JlYXRlIHRoZSBgSFRNTFNjcmlwdEVsZW1lbnRgIGluc3RhbmNlLlxuICpcbiAqIEBjYWxsYmFjayBTY3JpcHRDcmVhdGVGdW5jdGlvblxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICogQHJldHVybnMge0hUTUxTY3JpcHRFbGVtZW50fSBSZXR1cm5zIGFuIGluc3RhbmNlIG9mIGBIVE1MU2NyaXB0RWxlbWVudGAuXG4gKi9cblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdGhhdCByZXR1cm5zIHRoZSBub2RlIHRvIGFwcGVuZCB0aGUgc2NyaXB0IGVsZW1lbnQuXG4gKlxuICogQGNhbGxiYWNrIEpTT05QQ29udGFpbmVyRmluZEZ1bmN0aW9uXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcmV0dXJucyB7Tm9kZX0gUmV0dXJucyB0aGUgbm9kZSB0byBhcHBlbmQgdGhlIHNjcmlwdCBlbGVtZW50LlxuICovXG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGdlbmVyYXRlIHRoZSB1bmlxdWUgY2FsbGJhY2sgbmFtZS5cbiAqXG4gKiBAY2FsbGJhY2sgSlNPTlBDYWxsYmFja05hbWVHZW5lcmF0ZUZ1bmN0aW9uXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBSZXRydW5zIGEgdmFsaWQgamF2YXNjcmlwdCBpZGVudGlmaWVyIHRvIGhvbGQgdGhlIGNhbGxiYWsuXG4gKi9cblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gY29tcGlsZSB0aGUgcmVxdWVzdCB1cmwuXG4gKlxuICogQGNhbGxiYWNrIENvbXBpbGVVUkxGdW5jdGlvblxuICogQHBhcmFtIHtzdHJpbmd9IHVybCBUaGUgdXJsICh3aXRoIGJhc2VVUkwpIHRvIGNvbXBpbGUuXG4gKiBAcGFyYW0ge09iamVjdC48c3RyaW5nLCAqPn0gcGFyYW0gVGhlIHBhcmFtIHRvIGNvbXBpbGUgdGhlIHVybC5cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEByZXR1cm5zIHtzdHJpbmd9IFJldHVybnMgdGhlIGNvbXBpbGVkIHVybC5cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBlbmNvZGUgdGhlIHF1ZXJ5IHN0cmluZy5cbiAqXG4gKiBAY2FsbGJhY2sgRW5jb2RlUXVlcnlTdHJpbmdGdW5jdGlvblxuICogQHBhcmFtIHtPYmplY3QuPHN0cmluZywgKj59IGRhdGEgVGhlIGRhdGEgdG8gYmUgZW5jb2RlZCB0byBxdWVyeSBzdHJpbmcuXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBSZXR1cm5zIHRoZSBlbmNvZGVkIHF1ZXJ5IHN0cmluZy5cbiAqL1xuXG4vKipcbiAqIFRoZSB4aHIgaG9vayBmdW5jdGlvbi5cbiAqXG4gKiBAY2FsbGJhY2sgWEhSSG9va0Z1bmN0aW9uXG4gKiBAcGFyYW0ge1hNTEh0dHBSZXF1ZXN0fSB4aHIgVGhlIGluc3RhbmNlIG9mIGBYTUxIdHRwUmVxdWVzdGAuXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKi9cblxuLyoqXG4gKiBAY2FsbGJhY2sgUmVxdWVzdENyZWF0ZWRGdW5jdGlvblxuICogQHBhcmFtIHtIdHRwUmVxdWVzdHxKU09OUFJlcXVlc3R9IHJlcXVlc3QgVGhlIHJlcXVlc3QgaW5zdGFuY2UsIGNhbiBiZSBgSHR0cFJlcXVlc3RgIG9yIGBKU09OUFJlcXVlc3RgLlxuICovXG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGNoZWNrIHdoZXRoZXIgdGhlIHJlc3BvbnNlIGlzIG9rLlxuICpcbiAqIEBjYWxsYmFjayBDaGVja1Jlc3BvbnNlT2tGdW5jdGlvblxuICogQHBhcmFtIHtzdHJpbmd9IHJlcXVlc3RUeXBlIFRoZSByZXF1ZXN0IHR5cGUsIGBIVFRQX1JFUVVFU1RgIG9yIGBKU09OUF9SRVFVRVNUYC5cbiAqIEBwYXJhbSB7UmVzcG9uc2V9IHJlc3BvbnNlIFRoZSByZXNwb25zZSBpbnN0YW5jZS5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgcmVzcG9uc2UgaXMgb2ssIG90aGVyd2lzZSBgZmFsc2VgIGlzIHJldHVybmVkLlxuICovXG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGNoZWNrIHdoZXRoZXIgdG8gY2FsbCB0aGUgZXJyb3IgY2FsbGJhY2suXG4gKlxuICogQGNhbGxiYWNrIENoZWNrU2hvdWxkQ2FsbEVycm9yQ2FsbGJhY2tGdW5jdGlvblxuICogQHBhcmFtIHtzdHJpbmd9IHJlcXVlc3RUeXBlIFRoZSByZXF1ZXN0IHR5cGUsIGBIVFRQX1JFUVVFU1RgIG9yIGBKU09OUF9SRVFVRVNUYC5cbiAqIEBwYXJhbSB7YW55fSB0cmFuc2Zvcm1lZEVycm9yIFRoZSBkYXRhIHRoYXQgYG9wdGlvbnMudHJhbnNmb3JtRXJyb3IoLi4uKWAgcmV0dXJucy5cbiAqIEBwYXJhbSB7SHR0cFJlc3BvbnNlRXJyb3J8SlNPTlBSZXNwb25zZUVycm9yfSBlcnJvciBUaGUgcmVzcG9uc2UgZXJyb3IuXG4gKi9cblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gY2hlY2sgd2hldGhlciB0byBjYWxsIHRoZSBzdWNjZXNzIGNhbGxiYWNrLlxuICpcbiAqIEBjYWxsYmFjayBDaGVja1Nob3VsZENhbGxTdWNjZXNzQ2FsbGJhY2tGdW5jdGlvblxuICogQHBhcmFtIHtzdHJpbmd9IHJlcXVlc3RUeXBlIFRoZSByZXF1ZXN0IHR5cGUsIGBIVFRQX1JFUVVFU1RgIG9yIGBKU09OUF9SRVFVRVNUYC5cbiAqIEBwYXJhbSB7YW55fSB0cmFuc2Zvcm1lZFJlc3BvbnNlIFRoZSBkYXRhIHRoYXQgYG9wdGlvbnMudHJhbnNmb3JtUmVzcG9uc2UoLi4uKWAgcmV0dXJucy5cbiAqIEBwYXJhbSB7SHR0cFJlc3BvbnNlfEpTT05QUmVzcG9uc2V9IHJlc3BvbnNlIFRoZSByZXNwb25zZS5cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byB0cmFuc2Zyb20gdGhlIHJlc3BvbnNlLiBUaGUgcmV0dXJuIHZhbHVlIG9mIHRoaXMgZnVuY3Rpb24gd2lsbCBiZSBwYXNzZWQgdG8gdGhlIGBvbnN1Y2Nlc3NgIGNhbGxiYWNrLlxuICpcbiAqIEBjYWxsYmFjayBUcmFuc2Zvcm1SZXNwb25zZUZ1bmN0aW9uXG4gKiBAcGFyYW0ge3N0cmluZ30gcmVxdWVzdFR5cGUgVGhlIHJlcXVlc3QgdHlwZSwgYEhUVFBfUkVRVUVTVGAgb3IgYEpTT05QX1JFUVVFU1RgLlxuICogQHBhcmFtIHtIdHRwUmVzcG9uc2V8SlNPTlBSZXNwb25zZX0gcmVzcG9uc2UgVGhlIHJlc3BvbnNlLlxuICogQHJldHVybnMge2FueX0gUmV0dXJucyB0aGUgdHJhbnNmb3JtZWQgcmVzcG9uc2UuXG4gKi9cblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gdHJhbnNmcm9tIHRoZSByZXNwb25zZSBlcnJvci4gVGhlIHJldHVybiB2YWx1ZSBvZiB0aGlzIGZ1bmN0aW9uIHdpbGwgYmUgcGFzc2VkIHRvIHRoZSBgb25lcnJvcmBcbiAqIGNhbGxiYWNrLlxuICpcbiAqIEBjYWxsYmFjayBUcmFuc2Zvcm1FcnJvckZ1bmN0aW9uXG4gKiBAcGFyYW0ge3N0cmluZ30gcmVxdWVzdFR5cGUgVGhlIHJlcXVlc3QgdHlwZSwgYEhUVFBfUkVRVUVTVGAgb3IgYEpTT05QX1JFUVVFU1RgLlxuICogQHBhcmFtIHtIdHRwUmVzcG9uc2VFcnJvcnxKU09OUFJlc3BvbnNlRXJyb3J9IGVycm9yIFRoZSByZXNwb25zZSBlcnJvci5cbiAqIEByZXR1cm5zIHthbnl9IFJldHVybnMgdGhlIHRyYW5zZm9ybWVkIHJlc3BvbnNlIGVycm9yLlxuICovXG4iLCJ2YXIgUmVxdWVzZXQgPSByZXF1aXJlKDkpO1xudmFyIGNvbnN0YW50cyA9IHJlcXVpcmUoMjUpO1xudmFyIGluaGVyaXRzID0gcmVxdWlyZSgzMik7XG52YXIgYnVpbGRVUkwgPSByZXF1aXJlKDIzKTtcbnZhciBoYW5kbGVPcHRpb25zID0gcmVxdWlyZSgzMCk7XG52YXIgY2FsbFJlcXVlc3RDcmVhdGVkQ2FsbGJhY2sgPSByZXF1aXJlKDI0KTtcbnZhciBhZGRFdmVudExpc3RlbmVycyA9IHJlcXVpcmUoMTIpO1xudmFyIGhhbmRsZVhoclByb3BzID0gcmVxdWlyZSgxNyk7XG52YXIgaGFuZGxlSGVhZGVycyA9IHJlcXVpcmUoMTUpO1xudmFyIGhhbmRsZVJlcXVlc3RCb2R5ID0gcmVxdWlyZSgxNik7XG52YXIgY2FsbFhockhvb2sgPSByZXF1aXJlKDE0KTtcblxuLyoqXG4gKiBSZXByZXNlbnRzIGFuIGh0dHAgcmVxdWVzdC5cbiAqXG4gKiBAY2xhc3NcbiAqIEBleHRlbmRzIHtSZXF1ZXNldH1cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEBwYXJhbSB7UmVxdWVzdFN1Y2Nlc3NDYWxsYmFja30gb25zdWNjZXNzIFRoZSBjYWxsYmFjayB0byBjYWxsIG9uIHN1Y2Nlc3MuXG4gKiBAcGFyYW0ge1JlcXVlc3RFcnJvckNhbGxiYWNrfSBvbmVycm9yIFRoZSBjYWxsYmFjayB0byBjYWxsIG9uIGVycm9yLlxuICovXG5mdW5jdGlvbiBIdHRwUmVxdWVzdChvcHRpb25zLCBvbnN1Y2Nlc3MsIG9uZXJyb3IpIHtcbiAgICB2YXIgeGhyO1xuICAgIHZhciBjb250ZW50O1xuICAgIHZhciB1cmw7XG5cbiAgICAvLyBDYWxsIHRoZSBzdXBlciBjb25zdHJ1Y3Rvci5cbiAgICBSZXF1ZXNldC5jYWxsKHRoaXMsIGNvbnN0YW50cy5IVFRQX1JFUVVFU1QsIG9wdGlvbnMsIG9uc3VjY2Vzcywgb25lcnJvcik7XG5cbiAgICAvLyBDYWxsIGBvcHRpb25zLmhhbmRsZU9wdGlvbnNgIHRvIGhhbmRsZSBvcHRpb25zLlxuICAgIGhhbmRsZU9wdGlvbnMob3B0aW9ucyk7XG5cbiAgICB0aGlzLnhociA9IHhociA9IG9wdGlvbnMuY3JlYXRlWEhSLmNhbGwobnVsbCwgb3B0aW9ucyk7XG4gICAgY29udGVudCA9IGhhbmRsZVJlcXVlc3RCb2R5KG9wdGlvbnMpO1xuICAgIHVybCA9IGJ1aWxkVVJMKG9wdGlvbnMpO1xuXG4gICAgLy8gU2V0IHByb3BlcnRpZXMgdG8gdGhlIHhoci5cbiAgICBoYW5kbGVYaHJQcm9wcyh4aHIsIG9wdGlvbnMpO1xuXG4gICAgLy8gQ2FsbCBvblhockNyZWF0ZWQuXG4gICAgY2FsbFhockhvb2sob3B0aW9ucy5vblhockNyZWF0ZWQsIHhociwgb3B0aW9ucyk7XG5cbiAgICAvLyBBZGQgZXZlbnQgbGlzdGVuZXJzLiBUaGlzIGZ1bmN0aW9uIG11c3Qgb3ZlcndyaXRlIHRoZSBgY2FuY2VsYCBtZXRob2Qgb2YgdGhpcyBgSHR0cFJlcXVlc3RgIGluc3RhbmNlIHRvIGNhbmNlbFxuICAgIC8vIHRoaXMgaHR0cCByZXF1ZXN0LlxuICAgIGFkZEV2ZW50TGlzdGVuZXJzKHRoaXMpO1xuXG4gICAgLy8gT3BlbiB0aGUgcmVxdWVzdC5cbiAgICB4aHIub3BlbihvcHRpb25zLm1ldGhvZCB8fCAnR0VUJywgdXJsLCB0cnVlLCBvcHRpb25zLnVzZXJuYW1lLCBvcHRpb25zLnBhc3N3b3JkKTtcblxuICAgIC8vIENhbGwgb25YaHJPcGVuZWQuXG4gICAgY2FsbFhockhvb2sob3B0aW9ucy5vblhock9wZW5lZCwgeGhyLCBvcHRpb25zKTtcblxuICAgIC8vIEhhbmxkZSBoZWFkZXJzLlxuICAgIGhhbmRsZUhlYWRlcnMoeGhyLCBvcHRpb25zKTtcblxuICAgIC8vIFNlbmQgdGhlIGNvbnRlbnQgdG8gdGhlIHNlcnZlci5cbiAgICB4aHIuc2VuZChjb250ZW50KTtcblxuICAgIC8vIENhbGwgb25YaHJTZW50LlxuICAgIGNhbGxYaHJIb29rKG9wdGlvbnMub25YaHJTZW50LCB4aHIsIG9wdGlvbnMpO1xuXG4gICAgLy8gQ2FsbCBvblJlcXVlc3RDcmVhdGVkXG4gICAgY2FsbFJlcXVlc3RDcmVhdGVkQ2FsbGJhY2sob3B0aW9ucywgdGhpcyk7XG59XG5cbmluaGVyaXRzKEh0dHBSZXF1ZXN0LCBSZXF1ZXNldCk7XG5cbm1vZHVsZS5leHBvcnRzID0gSHR0cFJlcXVlc3Q7XG4iLCIvKipcbiAqIEh0dHBSZXNwb25zZSBtb2R1bGUuXG4gKlxuICogQG1vZHVsZSBjbGFzcy9IdHRwUmVzcG9uc2VcbiAqL1xuXG52YXIgUmVzcG9uc2UgPSByZXF1aXJlKDEwKTtcbnZhciBpbmhlcml0cyA9IHJlcXVpcmUoMzIpO1xudmFyIGFkZEN1c3RvbVBhcnNlciA9IHJlcXVpcmUoMjIpO1xuXG4vKipcbiAqIFRoZSBIdHRwUmVzcG9uc2UgY2xhc3MuXG4gKlxuICogQGNsYXNzXG4gKiBAcGFyYW0ge0h0dHBSZXF1ZXN0fSByZXF1ZXN0IFRoZSBodHRwIHJlcXVlc3QuXG4gKi9cbmZ1bmN0aW9uIEh0dHBSZXNwb25zZShyZXF1ZXN0KSB7XG4gICAgUmVzcG9uc2UuY2FsbCh0aGlzLCByZXF1ZXN0KTtcbiAgICBhZGRDdXN0b21QYXJzZXIodGhpcywgcmVxdWVzdC5vcHRpb25zLCAnaHR0cFJlc3BvbnNlUGFyc2VyJyk7XG59XG5cbmluaGVyaXRzKEh0dHBSZXNwb25zZSwgUmVzcG9uc2UpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEh0dHBSZXNwb25zZTtcbiIsInZhciBSZXNwb25zZUVycm9yID0gcmVxdWlyZSgxMSk7XG52YXIgaW5oZXJpdHMgPSByZXF1aXJlKDMyKTtcbnZhciBhZGRDdXN0b21QYXJzZXIgPSByZXF1aXJlKDIyKTtcblxuLyoqXG4gKiBAY2xhc3NcbiAqIEBwYXJhbSB7c3RyaW5nfSBjb2RlIFRoZSBlcnJvciBjb2RlLlxuICogQHBhcmFtIHtIdHRwUmVxdWVzdH0gcmVxdWVzdCBUaGUgaHR0cCByZXF1ZXN0LlxuICovXG5mdW5jdGlvbiBIdHRwUmVzcG9uc2VFcnJvcihjb2RlLCByZXF1ZXN0KSB7XG4gICAgUmVzcG9uc2VFcnJvci5jYWxsKHRoaXMsIGNvZGUsIHJlcXVlc3QpO1xuICAgIGFkZEN1c3RvbVBhcnNlcih0aGlzLCByZXF1ZXN0Lm9wdGlvbnMsICdodHRwUmVzcG9uc2VFcnJvclBhcnNlcicpO1xufVxuXG5pbmhlcml0cyhIdHRwUmVzcG9uc2VFcnJvciwgUmVzcG9uc2VFcnJvcik7XG5cbm1vZHVsZS5leHBvcnRzID0gSHR0cFJlc3BvbnNlRXJyb3I7XG4iLCJ2YXIgUmVxdWVzZXQgPSByZXF1aXJlKDkpO1xudmFyIGNvbnN0YW50cyA9IHJlcXVpcmUoMjUpO1xudmFyIGluaGVyaXRzID0gcmVxdWlyZSgzMik7XG52YXIgaGFuZGxlT3B0aW9ucyA9IHJlcXVpcmUoMzApO1xudmFyIGNhbGxSZXF1ZXN0Q3JlYXRlZENhbGxiYWNrID0gcmVxdWlyZSgyNCk7XG52YXIgYWRkRXZlbnRMaXN0ZW5lcnMgPSByZXF1aXJlKDE4KTtcbnZhciBidWlsZENhbGxiYWNrTmFtZSA9IHJlcXVpcmUoMTkpO1xudmFyIGhhbmRsZVNjcmlwdENvcnMgPSByZXF1aXJlKDIxKTtcbnZhciBidWlsZFNjcmlwdFNyYyA9IHJlcXVpcmUoMjApO1xuXG4vKipcbiAqIFJlcHJlc2VudHMgYW4ganNvbnAgcmVxdWVzdC5cbiAqXG4gKiBAY2xhc3NcbiAqIEBleHRlbmRzIHtSZXF1ZXNldH1cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEBwYXJhbSB7UmVxdWVzdFN1Y2Nlc3NDYWxsYmFja30gb25zdWNjZXNzIFRoZSBjYWxsYmFjayB0byBjYWxsIG9uIHN1Y2Nlc3MuXG4gKiBAcGFyYW0ge1JlcXVlc3RFcnJvckNhbGxiYWNrfSBvbmVycm9yIFRoZSBjYWxsYmFjayB0byBjYWxsIG9uIGVycm9yLlxuICovXG5mdW5jdGlvbiBKU09OUFJlcXVlc3Qob3B0aW9ucywgb25zdWNjZXNzLCBvbmVycm9yKSB7XG4gICAgdmFyIHNyYztcbiAgICB2YXIgc2NyaXB0O1xuICAgIHZhciBjYWxsYmFja05hbWU7XG4gICAgdmFyIGNvbnRhaW5lck5vZGU7XG5cbiAgICBSZXF1ZXNldC5jYWxsKHRoaXMsIGNvbnN0YW50cy5KU09OUF9SRVFVRVNULCBvcHRpb25zLCBvbnN1Y2Nlc3MsIG9uZXJyb3IpO1xuXG4gICAgLy8gQ2FsbCBgb3B0aW9ucy5oYW5kbGVPcHRpb25zYCB0byBoYW5kbGUgb3B0aW9ucy5cbiAgICBoYW5kbGVPcHRpb25zKG9wdGlvbnMpO1xuXG4gICAgc2NyaXB0ID0gdGhpcy5zY3JpcHQgPSBvcHRpb25zLmNyZWF0ZVNjcmlwdC5jYWxsKG51bGwsIG9wdGlvbnMpO1xuICAgIGNvbnRhaW5lck5vZGUgPSBvcHRpb25zLmpzb25wQ29udGFpbmVyTm9kZS5jYWxsKG51bGwsIG9wdGlvbnMpO1xuICAgIGNhbGxiYWNrTmFtZSA9IGJ1aWxkQ2FsbGJhY2tOYW1lKG9wdGlvbnMpO1xuICAgIHNyYyA9IGJ1aWxkU2NyaXB0U3JjKG9wdGlvbnMsIGNhbGxiYWNrTmFtZSk7XG5cbiAgICAvLyBTZXQgdGhlIHNyYyBhdHRyaWJ1dGUuXG4gICAgc2NyaXB0LnNldEF0dHJpYnV0ZSgnc3JjJywgc3JjKTtcblxuICAgIC8vIEhhbmRsZSBgb3B0aW9ucy5jb3JzYFxuICAgIGhhbmRsZVNjcmlwdENvcnMoc2NyaXB0LCBvcHRpb25zKTtcblxuICAgIC8vIEFkZCBldmVudCBsaXN0ZW5lcnNcbiAgICBhZGRFdmVudExpc3RlbmVycyh0aGlzLCBjYWxsYmFja05hbWUpO1xuXG4gICAgLy8gSW5qZWN0IHRoZSBzY3JpcHQgbm9kZVxuICAgIGNvbnRhaW5lck5vZGUuYXBwZW5kQ2hpbGQoc2NyaXB0KTtcblxuICAgIC8vIENhbGwgb25SZXF1ZXN0Q3JlYXRlZFxuICAgIGNhbGxSZXF1ZXN0Q3JlYXRlZENhbGxiYWNrKG9wdGlvbnMsIHRoaXMpO1xufVxuXG5pbmhlcml0cyhKU09OUFJlcXVlc3QsIFJlcXVlc2V0KTtcblxubW9kdWxlLmV4cG9ydHMgPSBKU09OUFJlcXVlc3Q7XG4iLCIvKipcbiAqIEpTT05QUmVzcG9uc2UgbW9kdWxlLlxuICpcbiAqIEBtb2R1bGUgY2xhc3MvSlNPTlBSZXNwb25zZVxuICovXG5cbnZhciBSZXNwb25zZSA9IHJlcXVpcmUoMTApO1xudmFyIGluaGVyaXRzID0gcmVxdWlyZSgzMik7XG52YXIgYWRkQ3VzdG9tUGFyc2VyID0gcmVxdWlyZSgyMik7XG5cbi8qKlxuICogVGhlIEpTT05QUmVzcG9uc2UgY2xhc3MuXG4gKlxuICogQGNsYXNzXG4gKiBAcGFyYW0ge0pTT05SZXF1ZXN0fSByZXF1ZXN0IFRoZSBodHRwIHJlcXVlc3QuXG4gKi9cbmZ1bmN0aW9uIEpTT05QUmVzcG9uc2UocmVxdWVzdCkge1xuICAgIFJlc3BvbnNlLmNhbGwodGhpcywgcmVxdWVzdCk7XG4gICAgYWRkQ3VzdG9tUGFyc2VyKHRoaXMsIHJlcXVlc3Qub3B0aW9ucywgJ2pzb25wUmVzcG9uc2VQYXJzZXInKTtcbn1cblxuaW5oZXJpdHMoSlNPTlBSZXNwb25zZSwgUmVzcG9uc2UpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEpTT05QUmVzcG9uc2U7XG4iLCJ2YXIgUmVzcG9uc2VFcnJvciA9IHJlcXVpcmUoMTEpO1xudmFyIGluaGVyaXRzID0gcmVxdWlyZSgzMik7XG52YXIgYWRkQ3VzdG9tUGFyc2VyID0gcmVxdWlyZSgyMik7XG5cbi8qKlxuICogQGNsYXNzXG4gKiBAcGFyYW0ge3N0cmluZ30gY29kZSBUaGUgZXJyb3IgY29kZS5cbiAqIEBwYXJhbSB7SlNPTlBSZXF1ZXN0fSByZXF1ZXN0IFRoZSBKU09OUCByZXF1ZXN0LlxuICovXG5mdW5jdGlvbiBKU09OUFJlc3BvbnNlRXJyb3IoY29kZSwgcmVxdWVzdCkge1xuICAgIFJlc3BvbnNlRXJyb3IuY2FsbCh0aGlzLCBjb2RlLCByZXF1ZXN0KTtcbiAgICBhZGRDdXN0b21QYXJzZXIodGhpcywgcmVxdWVzdC5vcHRpb25zLCAnanNvbnBSZXNwb25zZUVycm9yUGFyc2VyJyk7XG59XG5cbmluaGVyaXRzKFJlc3BvbnNlRXJyb3IsIEpTT05QUmVzcG9uc2VFcnJvcik7XG5cbm1vZHVsZS5leHBvcnRzID0gSlNPTlBSZXNwb25zZUVycm9yO1xuIiwidmFyIHV1aWQgPSByZXF1aXJlKDM1KTtcblxuLyoqXG4gKiBUaGUgYmFzZSBSZXFldXN0IGNsYXNzLlxuICpcbiAqIEBjbGFzc1xuICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgVGhlIHR5cGUgb2YgcmVxdWVzdCwgY2FuIGJlIGBIVFRQX1JFUVVFU1RgIG9yIGBKU09OUF9SRVFVRVNUYC5cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEBwYXJhbSB7UmVxdWVzdFN1Y2Nlc3NDYWxsYmFja30gb25zdWNjZXNzIFRoZSBjYWxsYmFjayB0byBjYWxsIG9uIHN1Y2Nlc3MuXG4gKiBAcGFyYW0ge1JlcXVlc3RFcnJvckNhbGxiYWNrfSBvbmVycm9yIFRoZSBjYWxsYmFjayB0byBjYWxsIG9uIGVycm9yLlxuICovXG5mdW5jdGlvbiBSZXF1ZXN0KHR5cGUsIG9wdGlvbnMsIG9uc3VjY2Vzcywgb25lcnJvcikge1xuICAgIC8qKlxuICAgICAqIElmIHRoZXJlIGlzIGFuIGVycm9yIGhhcHBlbmQsIHRoZSBgZXJyb3JDb2RlYCBpcyBhIHN0cmluZyByZXByc2VuZ3RpbmcgdGhlIHR5cGUgb2YgdHlwZSBlcnJvci4gSWYgdGhlcmUgaXMgbm9cbiAgICAgKiBlcnJvciwgdGhlIHZhbHVlIG9mIGBlcnJvckNvZGVgIGlzIGBudWxsYC5cbiAgICAgKi9cbiAgICB0aGlzLmVycm9yQ29kZSA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgYFhNTEh0dHBSZXF1ZXN0YCB3ZSB1c2Ugd2hlbiBzZW5kaW5nIGh0dHAgcmVxdWVzdC5cbiAgICAgKi9cbiAgICB0aGlzLnhociA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgYEhUTUxTY3JpcHRFbGVtZW50YCB3ZSB1c2Ugd2hlbiBzZW5kaW5nIGpzb24gcmVxdWVzdC5cbiAgICAgKi9cbiAgICB0aGlzLnNjcmlwdCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBXaGV0aGVyIHRoZSByZXF1ZXN0IGlzIGZpbmlzaGVkLlxuICAgICAqL1xuICAgIHRoaXMuZmluaXNoZWQgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIFRoZSByZXNwb25zZSBKU09OIGRhdGEgb2YgdGhlIEpTT05QIHJlcXVlc3QuXG4gICAgICovXG4gICAgdGhpcy5yZXNwb25zZUpTT04gPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQW4gdW5pcXVlIGlkIGZvciB0aGlzIHJlcXVlc3QuXG4gICAgICovXG4gICAgdGhpcy5yZXF1ZXN0SWQgPSB1dWlkKCk7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdHlwZSBvZiByZXF1ZXN0LCBjYW4gYmUgYEhUVFBfUkVRVUVTVGAgb3IgYEpTT05QX1JFUVVFU1RgLlxuICAgICAqL1xuICAgIHRoaXMucmVxdWVzdFR5cGUgPSB0eXBlO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAgICAgKi9cbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuXG4gICAgLyoqXG4gICAgICogVGhlIG5hbWUgb2YgdGhlIGZ1bmN0aW9uIHRoYXQgY3JlYXRlIHRoaXMgcmVxdWVzdC4gQ2FuIGJlIGBzZW5kYCwgYGZldGNoYCwgYGdldEpPU05QYCwgYGZldGNoSlNPTlBgLiBUaGlzIHZhbHVlXG4gICAgICogaXMgc2V0IGJ5IHRoZSBsaWJyYXkgaXRzZWxmLlxuICAgICAqL1xuICAgIHRoaXMucmVxdWVzdEZ1bmN0aW9uTmFtZSA9IG9wdGlvbnMucmVxdWVzdEZ1bmN0aW9uTmFtZTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBgQ2FuY2VsQ29udHJvbGxlcmAgdGhhdCB1c2VkIHRvIGNhbmNlbCB0aGlzIHJlcXVlc3QuIFdlIG5ldmVyIHVzZSB0aGlzIHByb3BlcnR5IGludGVybmFsbHksIGp1c3QgaG9sZGluZyB0aGVcbiAgICAgKiBpbmZvcm1hdGlvbiBpbiBjYXNlIHRoYXQgdGhlIHVzZXIgbmVlZHMuXG4gICAgICovXG4gICAgdGhpcy5jb250cm9sbGVyID0gb3B0aW9ucy5jb250cm9sbGVyIHx8IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgY2FsbGJhY2sgdG8gY2FsbCBvbiBzdWNjZXNzLlxuICAgICAqL1xuICAgIHRoaXMub25zdWNjZXNzID0gb25zdWNjZXNzIHx8IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgY2FsbGJhY2sgdG8gY2FsbCBvbiBlcnJvci5cbiAgICAgKi9cbiAgICB0aGlzLm9uZXJyb3IgPSBvbmVycm9yIHx8IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBTZXQgdGhlIHJlcXVlc3QgdHlwZSBiYWNrLlxuICAgICAqL1xuICAgIG9wdGlvbnMucmVxdWVzdFR5cGUgPSB0eXBlO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFJlcXVlc3Q7XG4iLCIvKipcbiAqIFJlcHJlc2VudHMgYSByZXNwb25zZS5cbiAqXG4gKiBAcGFyYW0ge1JlcXVlc3R9IHJlcXVlc3QgVGhlIGluc3RhbmNlIG9mIGBSZXF1ZXN0YC5cbiAqL1xuZnVuY3Rpb24gUmVzcG9uc2UocmVxdWVzdCkge1xuICAgIC8qKlxuICAgICAqIEB0eXBlIHtSZXF1ZXN0fVxuICAgICAqL1xuICAgIHRoaXMucmVxdWVzdCA9IHJlcXVlc3Q7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gUmVzcG9uc2U7XG4iLCJ2YXIgZXJyb3JNZXNzYWdlcyA9IHtcbiAgICBFUlJfQUJPUlRFRDogJ1JlcXVlc3QgYWJvcnRlZCcsXG4gICAgRVJSX0NBTkNFTExFRDogJ1JlcXVlc3QgY2FuY2VsbGVkJyxcbiAgICBFUlJfTkVUV09SSzogJ05ldHdvcmsgZXJyb3InLFxuICAgIEVSUl9SRVNQT05TRTogJ1Jlc3BvbnNlIGVycm9yJyxcbiAgICBFUlJfVElNRU9VVDogJ1JlcXVlc3QgdGltZW91dCdcbn07XG5cbi8qKlxuICogUmVwcmVzZW50cyByZXNwb25zZSBlcnJvci5cbiAqXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSB7c3RyaW5nfSBjb2RlIFRoZSBlcnJvciBjb2RlLlxuICogQHBhcmFtIHtSZXF1ZXN0fSByZXF1ZXN0IFRoZSByZXF1ZXN0LlxuICovXG5mdW5jdGlvbiBSZXNwb25zZUVycm9yKGNvZGUsIHJlcXVlc3QpIHtcbiAgICB2YXIgbWVzc2FnZTtcblxuICAgIGNvZGUgPSBjb2RlIHx8ICdFUlJfVU5LTk9XTic7XG5cbiAgICBpZiAoZXJyb3JNZXNzYWdlc1tjb2RlXSkge1xuICAgICAgICBtZXNzYWdlID0gZXJyb3JNZXNzYWdlc1tjb2RlXTtcbiAgICB9XG5cbiAgICBpZiAoIW1lc3NhZ2UpIHtcbiAgICAgICAgbWVzc2FnZSA9ICdVbmtub3duIGVycm9yICcgKyBjb2RlO1xuICAgIH1cblxuICAgIHJlcXVlc3QuZXJyb3JDb2RlID0gY29kZTtcblxuICAgIHRoaXMuY29kZSA9IGNvZGU7XG4gICAgdGhpcy5yZXF1ZXN0ID0gcmVxdWVzdDtcbiAgICB0aGlzLm1lc3NhZ2UgPSBtZXNzYWdlO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFJlc3BvbnNlRXJyb3I7XG4iLCJ2YXIgaXNGdW5jdGlvbiA9IHJlcXVpcmUoMzgpO1xudmFyIEh0dHBSZXNwb25zZSA9IHJlcXVpcmUoNCk7XG52YXIgYWRkVGltZW91dExpc3RlbmVyID0gcmVxdWlyZSgxMyk7XG52YXIgZmlyZUNhbGxiYWNrcyA9IHJlcXVpcmUoMjkpO1xudmFyIG5vb3AgPSByZXF1aXJlKDMzKTtcbnZhciBjb25zdGFudHMgPSByZXF1aXJlKDI1KTtcbnZhciBFUlJfQUJPUlRFRCAgID0gY29uc3RhbnRzLkVSUl9BQk9SVEVEO1xudmFyIEVSUl9DQU5DRUxMRUQgPSBjb25zdGFudHMuRVJSX0NBTkNFTExFRDtcbnZhciBFUlJfTkVUV09SSyAgID0gY29uc3RhbnRzLkVSUl9ORVRXT1JLO1xudmFyIEVSUl9SRVNQT05TRSAgPSBjb25zdGFudHMuRVJSX1JFU1BPTlNFO1xudmFyIEVSUl9USU1FT1VUICAgPSBjb25zdGFudHMuRVJSX1RJTUVPVVQ7XG5cbi8qKlxuICogQWRkIGV2ZW50IGxpc3RlbmVycyB0byB0aGUgaHR0cCByZXF1ZXN0LiBUaGlzIGZ1bmN0aW9uIHdpbGwgb3ZlcndpdGUgdGhlIGBjYW5jZWxgIG1ldGhvZCBvbiB0aGUgZ2l2ZW4gYEh0dHBSZXFlc3RgXG4gKiBpbnN0YW5jZS5cbiAqXG4gKiBAcGFyYW0ge0h0dHBSZXF1ZXN0fSByZXF1ZXN0IFRoZSBodHRwIHJlcXVlc3QgdG8gYWRkIGV2ZW50IGxpc3RlbmVycy5cbiAqL1xuZnVuY3Rpb24gYWRkRXZlbnRMaXN0ZW5lcnMocmVxdWVzdCkge1xuICAgIHZhciB4aHIgPSByZXF1ZXN0LnhocjtcbiAgICB2YXIgb3B0aW9ucyA9IHJlcXVlc3Qub3B0aW9ucztcbiAgICB2YXIgcmVxdWVzdFR5cGUgPSByZXF1ZXN0LnJlcXVlc3RUeXBlO1xuICAgIHZhciByZXNwb25zZSA9IG5ldyBIdHRwUmVzcG9uc2UocmVxdWVzdCk7XG4gICAgdmFyIGlzUmVzcG9uc2VPayA9IG9wdGlvbnMuaXNSZXNwb25zZU9rO1xuICAgIHZhciBjbGVhclRpbWVvdXRFdmVudCA9IG51bGw7XG4gICAgdmFyIHRpbWVvdXQgPSBwYXJzZUludChvcHRpb25zLnRpbWVvdXQgfHwgMCwgMTApO1xuXG4gICAgLyoqXG4gICAgICogQ2FuY2VsIHRoZSByZXF1ZXN0LlxuICAgICAqL1xuICAgIHZhciBjYW5jZWwgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNsZWFyRXZlbnRzKCk7XG4gICAgICAgIGlmICh4aHIuYWJvcnQpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgeGhyLmFib3J0KCk7XG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7fVxuICAgICAgICB9XG4gICAgICAgIGZpbmlzaChFUlJfQ0FOQ0VMTEVEKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogVGhlIGZ1bmN0aW9uIHRvIGNsZWFyIGV2ZW50cy5cbiAgICAgKi9cbiAgICB2YXIgY2xlYXJFdmVudHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8vIFNldCBjbGVhckV2ZW50cyB0byB0aGUgbm9vcCBmdW5jdGlvbi5cbiAgICAgICAgY2xlYXJFdmVudHMgPSBub29wO1xuXG4gICAgICAgIHhoci5vbmFib3J0ID0gbnVsbDtcbiAgICAgICAgeGhyLm9uZXJyb3IgPSBudWxsO1xuICAgICAgICB4aHIub25yZWFkeXN0YXRlY2hhbmdlID0gbnVsbDtcbiAgICAgICAgeGhyLm9udGltZW91dCA9IG51bGw7XG5cbiAgICAgICAgaWYgKGNsZWFyVGltZW91dEV2ZW50KSB7XG4gICAgICAgICAgICBjbGVhclRpbWVvdXRFdmVudCgpO1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0RXZlbnQgPSBudWxsO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBmdW5jdGlvbiBmaW5pc2ggdGhlIHJlcXVlc3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY29kZSBUaGUgZXJyb3IgY29kZSBvbiBlcnJvci4gSWYgbm8gZXJyb3Igb2NjdXJlZCwgdGhlIGNvZGUgaXMgYG51bGxgLlxuICAgICAqL1xuICAgIHZhciBmaW5pc2ggPSBmdW5jdGlvbiAoY29kZSkge1xuICAgICAgICAvLyBTZXQgZmluaXNoIHRvIHRoZSBub29wIGZ1bmN0aW9uLlxuICAgICAgICBmaW5pc2ggPSBub29wO1xuXG4gICAgICAgIC8vIFNldCBjYW5jZWwgdG8gdGhlIG5vb3AgZnVuY3Rpb24uXG4gICAgICAgIGNhbmNlbCA9IG5vb3A7XG5cbiAgICAgICAgLy8gTWFyayB0aGlzIHJlcXVlc3QgYXMgZmluaXNoZWQuXG4gICAgICAgIHJlcXVlc3QuZmluaXNoZWQgPSB0cnVlO1xuXG4gICAgICAgIC8vIENsZWFyIGV2ZW50cy5cbiAgICAgICAgY2xlYXJFdmVudHMoKTtcblxuICAgICAgICAvLyBGaXJlIGNhbGxiYWNrcy5cbiAgICAgICAgZmlyZUNhbGxiYWNrcyhjb2RlLCByZXNwb25zZSk7XG4gICAgfTtcblxuICAgIHhoci5vbmFib3J0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBmaW5pc2goRVJSX0FCT1JURUQpO1xuICAgIH07XG5cbiAgICB4aHIub25lcnJvciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZmluaXNoKEVSUl9ORVRXT1JLKTtcbiAgICB9O1xuXG4gICAgeGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKCt4aHIucmVhZHlTdGF0ZSA9PT0gNCkge1xuICAgICAgICAgICAgaWYgKGlzRnVuY3Rpb24oaXNSZXNwb25zZU9rKSkge1xuICAgICAgICAgICAgICAgIGlmIChpc1Jlc3BvbnNlT2socmVxdWVzdFR5cGUsIHJlc3BvbnNlKSkge1xuICAgICAgICAgICAgICAgICAgICBmaW5pc2gobnVsbCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgZmluaXNoKEVSUl9SRVNQT05TRSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBmaW5pc2gobnVsbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQ2FuY2VsIHRoZSByZXF1ZXN0LlxuICAgICAqL1xuICAgIHJlcXVlc3QuY2FuY2VsID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBjYW5jZWwoKTtcbiAgICB9O1xuXG4gICAgLy8gQWRkIHRpbWVvdXQgbGlzdGVuZXJcbiAgICBpZiAoIWlzTmFOKHRpbWVvdXQpICYmIHRpbWVvdXQgPiAwKSB7XG4gICAgICAgIGNsZWFyVGltZW91dEV2ZW50ID0gYWRkVGltZW91dExpc3RlbmVyKHhociwgdGltZW91dCwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgY2xlYXJFdmVudHMoKTtcbiAgICAgICAgICAgIGlmICh4aHIuYWJvcnQpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICB4aHIuYWJvcnQoKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7fVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZmluaXNoKEVSUl9USU1FT1VUKTtcbiAgICAgICAgfSk7XG4gICAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGFkZEV2ZW50TGlzdGVuZXJzO1xuIiwiLyoqXG4gKiBBZGQgdGltZW91dCBldmVudCBsaXN0ZW5lciBvbiB0aGUgWEhSIG9iamVjdC5cbiAqXG4gKiBAcGFyYW0ge1hNTEh0dHBSZXF1ZXN0fSB4aHIgVGhlIFhIUiB0byBhZGQgdGltZW91dCBldmVudCBsaXN0ZW5lci5cbiAqIEBwYXJhbSB7bnVtYmVyfSB0aW1lb3V0IFRoZSB0aW1lIHRvIHdhaXQgaW4gbWlsbGlzZWNvbmRzLlxuICogQHBhcmFtIHsoKSA9PiB2b2lkfSBsaXN0ZW5lciBUaGUgdGltZW91dCBjYWxsYmFjay5cbiAqIEByZXR1cm5zIHsoKSA9PiB2b2lkKX0gUmV0dXJucyBhIGZ1bmN0aW9uIHRvIHJlbW92ZSB0aGUgdGltZW91dCBldmVudCBsaXN0ZW5lci5cbiAqL1xuZnVuY3Rpb24gYWRkVGltZW91dExpc3RlbmVyKHhociwgdGltZW91dCwgbGlzdGVuZXIpIHtcbiAgICB2YXIgdGltZW91dElkID0gbnVsbDtcbiAgICB2YXIgc3VwcG9ydFRpbWVvdXQgPSAndGltZW91dCcgaW4geGhyICYmICdvbnRpbWVvdXQnIGluIHhocjtcblxuICAgIGlmIChzdXBwb3J0VGltZW91dCkge1xuICAgICAgICB4aHIudGltZW91dCA9IHRpbWVvdXQ7XG4gICAgICAgIHhoci5vbnRpbWVvdXQgPSBsaXN0ZW5lcjtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aW1lb3V0SWQgPSBzZXRUaW1lb3V0KGxpc3RlbmVyLCB0aW1lb3V0KTtcbiAgICB9XG5cbiAgICAvLyBDYWxsIHRoaXMgZnVuY3Rpb24gdG8gcmVtb3ZlIHRpbWVvdXQgZXZlbnQgbGlzdGVuZXJcbiAgICBmdW5jdGlvbiBjbGVhclRpbWVvdXRFdmVudCgpIHtcbiAgICAgICAgaWYgKHhocikge1xuICAgICAgICAgICAgaWYgKHRpbWVvdXRJZCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHhoci5vbnRpbWVvdXQgPSBudWxsO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dElkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHhociA9IG51bGw7XG4gICAgICAgICAgICBsaXN0ZW5lciA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gY2xlYXJUaW1lb3V0RXZlbnQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYWRkVGltZW91dExpc3RlbmVyO1xuIiwidmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKDM4KTtcblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gY2FsbCB4aHIgaG9vayBmdW5jdGlvbi5cbiAqXG4gKiBAcGFyYW0ge1hIUkhvb2tGdW5jdGlvbn0gZnVuYyBUaGUgaG9vayBmdW5jdGlvbiB0byBjYWxsLCBpZiBpdCBpcyBub3QgZnVuY3Rpb24sIHRoaXMgaG9vayBpcyBza2lwcGVkLlxuICogQHBhcmFtIHtYTUxIdHRwUmVxZXVzdH0geGhyIFRoZSBpbnN0YW5jZSBvZiBgWE1MSHR0cFJlcWV1c3RgLlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9ufSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKi9cbmZ1bmN0aW9uIGNhbGxYaHJIb29rKGZ1bmMsIHhociwgb3B0aW9ucykge1xuICAgIGlmIChpc0Z1bmN0aW9uKGZ1bmMpKSB7XG4gICAgICAgIGZ1bmMoeGhyLCBvcHRpb25zKTtcbiAgICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gY2FsbFhockhvb2s7XG4iLCJ2YXIgbWVyZ2UgPSByZXF1aXJlKDQwKTtcbnZhciBpc1BsYWluT2JqZWN0ID0gcmVxdWlyZSgzOSk7XG52YXIgaGFzT3duID0gcmVxdWlyZSgzMSk7XG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIHNldCB0aGUgcmVxdWVzdCBoZWFkZXJzLlxuICpcbiAqIDEuIE1lcmdlIHRoZSBgb3B0aW9ucy5ub0NhY2hlSGVhZGVyc2AgaWYgbmVlZGVkLlxuICogMi4gU2V0IHRoZSByZXF1ZXN0IGhlYWRlcnMgaWYgbmVlZGVkLlxuICpcbiAqIEBwYXJhbSB7WE1MSHR0cFJlcWV1c3R9IHhociBUaGUgaW5zdGFuY2Ugb2YgYFhNTEh0dHBSZXFldXN0YC5cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbn0gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICovXG5mdW5jdGlvbiBoYW5kbGVIZWFkZXJzKHhociwgb3B0aW9ucykge1xuICAgIHZhciBuYW1lO1xuICAgIHZhciB2YWx1ZTtcbiAgICB2YXIgaGVhZGVycyA9IGlzUGxhaW5PYmplY3Qob3B0aW9ucy5oZWFkZXJzKSA/IG9wdGlvbnMuaGVhZGVycyA6IHt9O1xuXG4gICAgaWYgKG9wdGlvbnMubm9DYWNoZSkge1xuICAgICAgICBpZiAoaXNQbGFpbk9iamVjdChvcHRpb25zLm5vQ2FjaGVIZWFkZXJzKSkge1xuICAgICAgICAgICAgaGVhZGVycyA9IG1lcmdlKGhlYWRlcnMsIG9wdGlvbnMubm9DYWNoZUhlYWRlcnMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZm9yIChuYW1lIGluIGhlYWRlcnMpIHtcbiAgICAgICAgaWYgKGhhc093bi5jYWxsKGhlYWRlcnMsIG5hbWUpKSB7XG4gICAgICAgICAgICB2YWx1ZSA9IGhlYWRlcnNbbmFtZV07XG4gICAgICAgICAgICAvLyBPbmx5IHRoZSBub24tdW5kZWZpbmVkIGFuZCBub24tbnVsbCBoZWFkZXJzIGFyZSBzZXRcbiAgICAgICAgICAgIGlmICh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIobmFtZSwgdmFsdWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gU2V0IHRoZSBoZWFkZXJzIGJhY2suXG4gICAgb3B0aW9ucy5oZWFkZXJzID0gaGVhZGVycztcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBoYW5kbGVIZWFkZXJzO1xuIiwidmFyIG1lcmdlID0gcmVxdWlyZSg0MCk7XG52YXIgaXNGdW5jdGlvbiA9IHJlcXVpcmUoMzgpO1xudmFyIGlzUGxhaW5PYmplY3QgPSByZXF1aXJlKDM5KTtcbnZhciBoYXNPd24gPSByZXF1aXJlKDMxKTtcblxuLyoqXG4gKiBGaW5kIGEgcHJvY2Vzc29yIGZyb20gYG9wdGlvbnMuaHR0cFJlcXVlc3RCb2R5UHJvY2Vzc29yYCB0byBwcm9jZXNzIHRoZSByZXF1ZXN0IGJvZHkuXG4gKlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICogQHJldHVybnMge2FueX0gUmV0cnVucyB0aGUgY29udGVudCB0aGF0IHNlbmQgdG8gdGhlIHNlcnZlci5cbiAqL1xuZnVuY3Rpb24gaGFuZGxlUmVxdWVzdEJvZHkob3B0aW9ucykge1xuICAgIHZhciBpO1xuICAgIHZhciBsO1xuICAgIHZhciBrZXk7XG4gICAgdmFyIGNvbnRlbnQgPSBudWxsO1xuICAgIHZhciBwcm9jZXNzb3I7XG4gICAgdmFyIGNvbnRlbnRQcm9jZXNzb3I7XG4gICAgdmFyIGNvbnRlbnRQcm9jZXNzb3JzID0gW107XG4gICAgdmFyIGJvZHkgPSBvcHRpb25zLmJvZHk7XG4gICAgdmFyIHByb2Nlc3NvcnMgPSBvcHRpb25zLmh0dHBSZXF1ZXN0Qm9keVByb2Nlc3NvcjtcbiAgICB2YXIgaGVhZGVycyA9IGlzUGxhaW5PYmplY3Qob3B0aW9ucy5oZWFkZXJzKSA/IG9wdGlvbnMuaGVhZGVycyA6IHt9O1xuXG4gICAgaWYgKGlzUGxhaW5PYmplY3QoYm9keSkgJiYgaXNQbGFpbk9iamVjdChwcm9jZXNzb3JzKSkge1xuICAgICAgICAvLyBGaW5kIGFsbCBwcm9jZXNzb3JzLlxuICAgICAgICBmb3IgKGtleSBpbiBwcm9jZXNzb3JzKSB7XG4gICAgICAgICAgICBpZiAoaGFzT3duLmNhbGwocHJvY2Vzc29ycywga2V5KSkge1xuICAgICAgICAgICAgICAgIHByb2Nlc3NvciA9IHByb2Nlc3NvcnNba2V5XTtcbiAgICAgICAgICAgICAgICBpZiAoaXNQbGFpbk9iamVjdChwcm9jZXNzb3IpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRlbnRQcm9jZXNzb3JzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAga2V5OiBrZXksXG4gICAgICAgICAgICAgICAgICAgICAgICBoZWFkZXJzOiBwcm9jZXNzb3IuaGVhZGVycyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHByaW9yaXR5OiBwcm9jZXNzb3IucHJpb3JpdHksXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9jZXNzb3I6IHByb2Nlc3Nvci5wcm9jZXNzb3JcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gU29ydCB0aGUgcHJvY2Vzc29ycyBieSBpdHMgcHJpb3JpdHkuXG4gICAgICAgIGNvbnRlbnRQcm9jZXNzb3JzLnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgICAgICAgIHJldHVybiBiLnByaW9yaXR5IC0gYS5wcmlvcml0eTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gRmluZCB0aGUgZmlyc3Qgbm9uLXVuZGVmaW5lZCBjb250ZW50LlxuICAgICAgICBmb3IgKGkgPSAwLCBsID0gY29udGVudFByb2Nlc3NvcnMubGVuZ3RoOyBpIDwgbDsgaSArPSAxKSB7XG4gICAgICAgICAgICBwcm9jZXNzb3IgPSBjb250ZW50UHJvY2Vzc29yc1tpXTtcbiAgICAgICAgICAgIGlmIChib2R5W3Byb2Nlc3Nvci5rZXldICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBjb250ZW50ID0gYm9keVtwcm9jZXNzb3Iua2V5XTtcbiAgICAgICAgICAgICAgICBjb250ZW50UHJvY2Vzc29yID0gcHJvY2Vzc29yO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gVXNlIHRoZSBwcm9jZXNzb3IgdG8gcHJvY2VzcyB0aGUgY29udGVudC5cbiAgICAgICAgaWYgKGNvbnRlbnRQcm9jZXNzb3IpIHtcbiAgICAgICAgICAgIGlmIChpc1BsYWluT2JqZWN0KGNvbnRlbnRQcm9jZXNzb3IuaGVhZGVycykpIHtcbiAgICAgICAgICAgICAgICBoZWFkZXJzID0gbWVyZ2UoaGVhZGVycywgY29udGVudFByb2Nlc3Nvci5oZWFkZXJzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHByb2Nlc3NvciA9IGNvbnRlbnRQcm9jZXNzb3IucHJvY2Vzc29yO1xuICAgICAgICAgICAgaWYgKGlzRnVuY3Rpb24ocHJvY2Vzc29yKSkge1xuICAgICAgICAgICAgICAgIGNvbnRlbnQgPSBwcm9jZXNzb3IoY29udGVudCwgb3B0aW9ucyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBNYWtlIHN1cmUgdGhhdCB0aGUgaGVhZGVycyBpcyBhIHBsYWluIG9iamVjdC5cbiAgICBvcHRpb25zLmhlYWRlcnMgPSBoZWFkZXJzO1xuXG4gICAgcmV0dXJuIGNvbnRlbnQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaGFuZGxlUmVxdWVzdEJvZHk7XG4iLCJ2YXIgaXNQbGFpbk9iamVjdCA9IHJlcXVpcmUoMzkpO1xudmFyIGhhc093biA9IHJlcXVpcmUoMzEpO1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBoYW5sZGUgWE1MSHR0cFJlcXVlc3QgcHJvcGVydGllcy5cbiAqXG4gKiBAcGFyYW0ge1hNTEh0dHBSZXF1ZXN0fSB4aHIgVGhlIGluc3RhbmNlIG9mIGBYTUxIdHRwUmVxdWVzdGAuXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKi9cbmZ1bmN0aW9uIGhhbmRsZVhoclByb3BzKHhociwgb3B0aW9ucykge1xuICAgIHZhciBwcm9wO1xuICAgIHZhciB4aHJQcm9wcyA9IG9wdGlvbnMueGhyUHJvcHM7XG5cbiAgICBpZiAob3B0aW9ucy5jb3JzKSB7XG4gICAgICAgIHhoci53aXRoQ3JlZGVudGlhbHMgPSB0cnVlO1xuICAgIH1cblxuICAgIGlmIChpc1BsYWluT2JqZWN0KHhoclByb3BzKSkge1xuICAgICAgICBmb3IgKHByb3AgaW4geGhyUHJvcHMpIHtcbiAgICAgICAgICAgIGlmIChoYXNPd24uY2FsbCh4aHJQcm9wcywgcHJvcCkpIHtcbiAgICAgICAgICAgICAgICB4aHJbcHJvcF0gPSB4aHJQcm9wc1twcm9wXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBoYW5kbGVYaHJQcm9wcztcbiIsInZhciBpc0Z1bmN0aW9uID0gcmVxdWlyZSgzOCk7XG52YXIgSlNPTlBSZXNwb25zZSA9IHJlcXVpcmUoNyk7XG52YXIgZmlyZUNhbGxiYWNrcyA9IHJlcXVpcmUoMjkpO1xudmFyIG5vb3AgPSByZXF1aXJlKDMzKTtcbnZhciBjb25zdGFudHMgPSByZXF1aXJlKDI1KTtcbnZhciBFUlJfQ0FOQ0VMTEVEID0gY29uc3RhbnRzLkVSUl9DQU5DRUxMRUQ7XG52YXIgRVJSX05FVFdPUksgICA9IGNvbnN0YW50cy5FUlJfTkVUV09SSztcbnZhciBFUlJfUkVTUE9OU0UgID0gY29uc3RhbnRzLkVSUl9SRVNQT05TRTtcbnZhciBFUlJfVElNRU9VVCAgID0gY29uc3RhbnRzLkVSUl9USU1FT1VUO1xuXG5mdW5jdGlvbiBhZGRFdmVudExpc3RlbmVycyhyZXF1ZXN0LCBjYWxsYmFja05hbWUpIHtcbiAgICB2YXIgc2NyaXB0ID0gcmVxdWVzdC5zY3JpcHQ7XG4gICAgdmFyIG9wdGlvbnMgPSByZXF1ZXN0Lm9wdGlvbnM7XG4gICAgdmFyIHJlcXVlc3RUeXBlID0gcmVxdWVzdC5yZXF1ZXN0VHlwZTtcbiAgICB2YXIgaXNSZXNwb25zZU9rID0gb3B0aW9ucy5pc1Jlc3BvbnNlT2s7XG4gICAgdmFyIHJlc3BvbnNlID0gbmV3IEpTT05QUmVzcG9uc2UocmVxdWVzdCk7XG4gICAgdmFyIHRpbWVvdXQgPSBwYXJzZUludChvcHRpb25zLnRpbWVvdXQgfHwgMCwgMTApO1xuICAgIHZhciB0aW1lb3V0SWQgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGZ1bmN0aW9uIGZpbmlzaCB0aGUgcmVxdWVzdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBjb2RlIFRoZSBlcnJvciBjb2RlIG9uIGVycm9yLiBJZiBubyBlcnJvciBvY2N1cmVkLCB0aGUgY29kZSBpcyBgbnVsbGAuXG4gICAgICovXG4gICAgdmFyIGZpbmlzaCA9IGZ1bmN0aW9uIChjb2RlKSB7XG4gICAgICAgIC8vIFNldCBmaW5pc2ggdG8gdGhlIG5vIG9wZXJhdGlvbiBmdW5jdGlvbi5cbiAgICAgICAgZmluaXNoID0gbm9vcDtcblxuICAgICAgICAvLyBNYXJrIHRoaXMgcmVxdWVzdCBhcyBmaW5pc2hlZC5cbiAgICAgICAgcmVxdWVzdC5maW5pc2hlZCA9IHRydWU7XG5cbiAgICAgICAgLy8gQ2xlYXIgbGlzdGVuZXJzLlxuICAgICAgICB3aW5kb3dbY2FsbGJhY2tOYW1lXSA9IG5vb3A7XG4gICAgICAgIHNjcmlwdC5vbmVycm9yID0gbnVsbDtcblxuICAgICAgICAvLyBDbGVhciB0aW1lb3V0LlxuICAgICAgICBpZiAodGltZW91dElkICE9PSBudWxsKSB7XG4gICAgICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dElkKTtcbiAgICAgICAgICAgIHRpbWVvdXRJZCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBGaXJlIGNhbGxiYWNrcy5cbiAgICAgICAgZmlyZUNhbGxiYWNrcyhjb2RlLCByZXNwb25zZSk7XG4gICAgfTtcblxuICAgIC8vIERlZmluZSB0aGUgY2FsbGJhY2sgZnVuY3Rpb24uXG4gICAgd2luZG93W2NhbGxiYWNrTmFtZV0gPSBmdW5jdGlvbiAocmVzcG9uc2VKU09OKSB7XG4gICAgICAgIHJlcXVlc3QucmVzcG9uc2VKU09OID0gcmVzcG9uc2VKU09OO1xuICAgICAgICBpZiAoaXNGdW5jdGlvbihpc1Jlc3BvbnNlT2spKSB7XG4gICAgICAgICAgICBpZiAoaXNSZXNwb25zZU9rKHJlcXVlc3RUeXBlLCByZXNwb25zZSkpIHtcbiAgICAgICAgICAgICAgICBmaW5pc2gobnVsbCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGZpbmlzaChFUlJfUkVTUE9OU0UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZmluaXNoKG51bGwpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8vIENhdGNoIHRoZSBlcnJvci5cbiAgICBzY3JpcHQub25lcnJvciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZmluaXNoKEVSUl9ORVRXT1JLKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQ2FuY2VsIHRoZSByZXF1ZXN0LlxuICAgICAqL1xuICAgIHJlcXVlc3QuY2FuY2VsID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBmaW5pc2goRVJSX0NBTkNFTExFRCk7XG4gICAgfTtcblxuICAgIC8vIEFkZCB0aW1lb3V0IGxpc3RlbmVyXG4gICAgaWYgKCFpc05hTih0aW1lb3V0KSAmJiB0aW1lb3V0ID4gMCkge1xuICAgICAgICB0aW1lb3V0SWQgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGZpbmlzaChFUlJfVElNRU9VVCk7XG4gICAgICAgIH0sIHRpbWVvdXQpO1xuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBhZGRFdmVudExpc3RlbmVycztcbiIsIi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGNyZWF0ZSBKU09OUCBjYWxsYmFjayBuYW1lLlxuICpcbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEByZXR1cm5zIHtzdHJpbmd9IFJldHVybnMgdGhlIGNhbGxiYWNrIG5hbWUuXG4gKi9cbmZ1bmN0aW9uIGJ1aWxkQ2FsbGxiYWNrTmFtZShvcHRpb25zKSB7XG4gICAgdmFyIGNhbGxiYWNrTmFtZTtcblxuICAgIGRvIHtcbiAgICAgICAgY2FsbGJhY2tOYW1lID0gb3B0aW9ucy5qc29ucENhbGxiYWNrTmFtZS5jYWxsKG51bGwsIG9wdGlvbnMpO1xuICAgIH0gd2hpbGUgKGNhbGxiYWNrTmFtZSBpbiB3aW5kb3cpO1xuXG4gICAgd2luZG93W2NhbGxiYWNrTmFtZV0gPSBudWxsO1xuXG4gICAgcmV0dXJuIGNhbGxiYWNrTmFtZTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBidWlsZENhbGxsYmFja05hbWU7XG4iLCJ2YXIgYnVpbGRVUkwgPSByZXF1aXJlKDIzKTtcblxuLyoqXG4gKiBCdWlsZCB0aGUgSlNPTlAgc2NyaXB0IHNyYy5cbiAqXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9waXRvbnMuXG4gKiBAcGFyYW0ge3N0cmluZ30gY2FsbGJhY2tOYW1lIFRoZSBjYWxsYmFjayBuYW1lIG9mIHRoZSBKU09OUC5cbiAqIEByZXR1cm4ge3N0cmluZ30gUmV0dXJucyB0aGUgc2NyaXB0IHNyYy5cbiAqL1xuZnVuY3Rpb24gYnVpbGRTY3JpcHRTcmMob3B0aW9ucywgY2FsbGJhY2tOYW1lKSB7XG4gICAgdmFyIHF1ZXJ5ID0gb3B0aW9ucy5xdWVyeTtcbiAgICB2YXIga2V5ID0gb3B0aW9ucy5qc29ucDtcbiAgICB2YXIgdXJsO1xuXG4gICAgaWYgKCFxdWVyeSkge1xuICAgICAgICBxdWVyeSA9IHt9O1xuICAgICAgICBvcHRpb25zLnF1ZXJ5ID0gcXVlcnk7XG4gICAgfVxuXG4gICAgcXVlcnlba2V5XSA9IGNhbGxiYWNrTmFtZTtcbiAgICB1cmwgPSBidWlsZFVSTChvcHRpb25zKTtcblxuICAgIHJldHVybiB1cmw7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYnVpbGRTY3JpcHRTcmM7XG4iLCIvKipcbiAqIFRoZSBmdW5jdGlvbiB0byBoYW5kbGUgYG9wdGlvbnMuY29yc2Agc2V0dGluZyB3aGVuIHNlbmRpbmcgSlNPTlAgcmVxdWVzdHMuIElmIGBvcHRpb25zLmNvcnNgIGlzIGB0cnVlYCwgdGhlXG4gKiBgY3Jvc3NvcmlnaW5gIGF0dHJpYnV0ZSBvZiB0aGUgYHNjcmlwdGAgZWxlbWVudCB3ZSB1c2luZyBpcyBzZXQgdG8gYHVzZS1jcmVkZW50aWFsc2AuXG4gKlxuICogQHBhcmFtIHtIVE1MU2NyaXB0RWxlbWVudH0gc2NyaXB0IFRoZSBzY3JpcHQgZWxlbWVudC5cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqL1xuZnVuY3Rpb24gaGFuZGxlU2NyaXB0Q29ycyhzY3JpcHQsIG9wdGlvbnMpIHtcbiAgICBpZiAob3B0aW9ucy5jb3JzKSB7XG4gICAgICAgIHNjcmlwdC5zZXRBdHRyaWJ1dGUoJ2Nyb3Nzb3JpZ2luJywgJ3VzZS1jcmVkZW50aWFscycpO1xuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBoYW5kbGVTY3JpcHRDb3JzO1xuIiwidmFyIGlzUGxhaW5PYmplY3QgPSByZXF1aXJlKDM5KTtcbnZhciBpc0Z1bmN0aW9uID0gcmVxdWlyZSgzOCk7XG52YXIgaGFzT3duID0gcmVxdWlyZSgzMSk7XG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGFkZCBjdXN0b20gcGFyc2VycyB0byB0aGUgaW5zdGFuY2Ugb2YgYFJlc3BvbnNlYCBvciBgUmVzcG9uc2VFcnJvcmAuXG4gKlxuICogQHBhcmFtIHtSZXNwb25zZXxSZXNwb25zZUVycm9yfSB0YXJnZXQgVGhlIHRhcmdldCB0byBhZGQgdGhlIGN1c3RvbWUgcGFyc2Vycy5cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEBwYXJhbSB7c3RyaW5nfSBvcHRpb25OYW1lIFRoZSBvcHRpb24gbmFtZSB0aGUgcGFyc2VycyBjb250YWluZXIuXG4gKi9cbmZ1bmN0aW9uIGFkZEN1c3RvbVBhcnNlcih0YXJnZXQsIG9wdGlvbnMsIG9wdGlvbk5hbWUpIHtcbiAgICB2YXIgcGFyc2VycyA9IG9wdGlvbnNbb3B0aW9uTmFtZV07XG4gICAgdmFyIG5hbWU7XG4gICAgdmFyIHBhcnNlcjtcblxuICAgIGlmIChpc1BsYWluT2JqZWN0KHBhcnNlcnMpKSB7XG4gICAgICAgIGZvciAobmFtZSBpbiBwYXJzZXJzKSB7XG4gICAgICAgICAgICBpZiAoaGFzT3duLmNhbGwocGFyc2VycywgbmFtZSkpIHtcbiAgICAgICAgICAgICAgICBwYXJzZXIgPSBwYXJzZXJzW25hbWVdO1xuICAgICAgICAgICAgICAgIGlmIChpc0Z1bmN0aW9uKHBhcnNlcikpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG5hbWUgaW4gdGFyZ2V0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1wiJyArIG5hbWUgKyAnXCIgY2Fubm90IGJlIGEgbmFtZSBvZiBwYXJzZXInKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB0YXJnZXRbbmFtZV0gPSBwYXJzZXI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGFkZEN1c3RvbVBhcnNlcjtcbiIsInZhciBpc0Z1bmN0aW9uID0gcmVxdWlyZSgzOCk7XG52YXIgaXNBYnNvbHV0ZVVSTCA9IHJlcXVpcmUoMzYpO1xudmFyIGlzUGxhaW5PYmplY3QgPSByZXF1aXJlKDM5KTtcblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gYnVpbGQgcmVxdWVzdCB1cmwuXG4gKlxuICogMS4gQWRkIGJhc2VVUkwgaWYgbmVlZGVkLlxuICogMi4gQ29tcGlsZSB1cmwgaWYgbmVlZGVkLlxuICogMy4gQ29tcGlsZSBxdWVyeSBzdHJpbmcgaWYgbmVlZGVkLlxuICpcbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEByZXR1cm5zIHtzdHJpbmd9IFJldHVybnMgdGhlIGZpbmFsIHVybCBzdHJpbmcuXG4gKi9cbmZ1bmN0aW9uIGJ1aWxkVVJMKG9wdGlvbnMpIHtcbiAgICB2YXIgdXJsID0gb3B0aW9ucy51cmwgKyAnJztcbiAgICB2YXIgYmFzZVVSTCA9IG9wdGlvbnMuYmFzZVVSTDtcbiAgICB2YXIgbW9kZWwgPSBvcHRpb25zLm1vZGVsO1xuICAgIHZhciBxdWVyeSA9IG9wdGlvbnMucXVlcnk7XG4gICAgdmFyIGNvbXBpbGVVUkwgPSBvcHRpb25zLmNvbXBpbGVVUkw7XG4gICAgdmFyIGVuY29kZVF1ZXJ5U3RyaW5nID0gb3B0aW9ucy5lbmNvZGVRdWVyeVN0cmluZztcbiAgICB2YXIgYXJyYXk7XG5cbiAgICAvLyBJZiB0aGUgdXJsIGlzIG5vdCBhYnNvbHV0ZSB1cmwgYW5kIHRoZSBiYXNlVVJMIGlzIGRlZmluZWQsXG4gICAgLy8gcHJlcGVuZCB0aGUgYmFzZVVSTCB0byB0aGUgdXJsLlxuICAgIGlmICghaXNBYnNvbHV0ZVVSTCh1cmwpKSB7XG4gICAgICAgIGlmICh0eXBlb2YgYmFzZVVSTCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIHVybCA9IGJhc2VVUkwgKyB1cmw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBDb21waWxlIHRoZSB1cmwgaWYgbmVlZGVkLlxuICAgIGlmIChpc1BsYWluT2JqZWN0KG1vZGVsKSAmJiBpc0Z1bmN0aW9uKGNvbXBpbGVVUkwpKSB7XG4gICAgICAgIHVybCA9IGNvbXBpbGVVUkwodXJsLCBtb2RlbCwgb3B0aW9ucyk7XG4gICAgfVxuXG4gICAgLy8gQ29tcGlsZSB0aGUgcXVlcnkgc3RyaW5nLlxuICAgIGlmIChpc1BsYWluT2JqZWN0KHF1ZXJ5KSAmJiBpc0Z1bmN0aW9uKGVuY29kZVF1ZXJ5U3RyaW5nKSkge1xuICAgICAgICBxdWVyeSA9IGVuY29kZVF1ZXJ5U3RyaW5nKHF1ZXJ5LCBvcHRpb25zKTtcbiAgICAgICAgYXJyYXkgPSB1cmwuc3BsaXQoJyMnKTsgLy8gVGhlcmUgbWF5IGJlIGhhc2ggc3RyaW5nIGluIHRoZSB1cmwuXG4gICAgICAgIHVybCA9IGFycmF5WzBdO1xuXG4gICAgICAgIGlmICh1cmwuaW5kZXhPZignPycpID4gLTEpIHtcbiAgICAgICAgICAgIGlmICh1cmwuY2hhckF0KHVybC5sZW5ndGggLSAxKSA9PT0gJyYnKSB7XG4gICAgICAgICAgICAgICAgdXJsID0gdXJsICsgcXVlcnk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHVybCA9IHVybCArICcmJyArIHF1ZXJ5O1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdXJsID0gdXJsICsgJz8nICsgcXVlcnk7XG4gICAgICAgIH1cblxuICAgICAgICBhcnJheVswXSA9IHVybDtcbiAgICAgICAgdXJsID0gYXJyYXkuam9pbignIycpO1xuICAgIH1cblxuICAgIHJldHVybiB1cmw7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYnVpbGRVUkw7XG4iLCJ2YXIgaXNGdW5jdGlvbiA9IHJlcXVpcmUoMzgpO1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBjYWxsIGBvcHRpb25zLm9uUmVxdWVzdENyZWF0ZWRgIGNhbGxiYWNrLlxuICpcbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEBwYXJhbSB7SHR0cFJlcXVlc3R8SlNPTlBSZXF1ZXN0fSByZXF1ZXN0IFRoZSByZXF1ZXN0IGluc3RhbmNlLlxuICovXG5mdW5jdGlvbiBjYWxsUmVxdWVzdENyZWF0ZWRDYWxsYmFjayhvcHRpb25zLCByZXF1ZXN0KSB7XG4gICAgdmFyIG9uUmVxdWVzdENyZWF0ZWQgPSBvcHRpb25zLm9uUmVxdWVzdENyZWF0ZWQ7XG5cbiAgICBpZiAoaXNGdW5jdGlvbihvblJlcXVlc3RDcmVhdGVkKSkge1xuICAgICAgICBvblJlcXVlc3RDcmVhdGVkKHJlcXVlc3QpO1xuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBjYWxsUmVxdWVzdENyZWF0ZWRDYWxsYmFjaztcbiIsImV4cG9ydHMuRVJSX0FCT1JURUQgPSAnRVJSX0FCT1JURUQnO1xuZXhwb3J0cy5FUlJfUkVTUE9OU0UgPSAnRVJSX1JFU1BPTlNFJztcbmV4cG9ydHMuRVJSX0NBTkNFTExFRCA9ICdFUlJfQ0FOQ0VMTEVEJztcbmV4cG9ydHMuRVJSX05FVFdPUksgPSAnRVJSX05FVFdPUksnO1xuZXhwb3J0cy5FUlJfVElNRU9VVCA9ICdFUlJfVElNRU9VVCc7XG5leHBvcnRzLkhUVFBfUkVRVUVTVCA9ICdIVFRQX1JFUVVFU1QnO1xuZXhwb3J0cy5KU09OUF9SRVFVRVNUID0gJ0pTT05QX1JFUVVFU1QnO1xuIiwidmFyIENhbmNlbENvbnRyb2xsZXIgPSByZXF1aXJlKDEpO1xuXG4vKipcbiAqIENyZWF0ZSBhIG5ldyBpbnN0YW5jZSBvZiBgQ2FuY2VsQ29udHJvbGxlcmAuXG4gKlxuICogQHJldHVybnMge0NhbmNlbENvbnRyb2xsZXJ9IFJldHVybnMgYW4gbmV3IGluc3RhbmNlIG9mIGBDYW5jZWxDb250cm9sbGVyYC5cbiAqL1xudmFyIGNyZWF0ZUNhbmNlbENvbnRyb2xsZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIG5ldyBDYW5jZWxDb250cm9sbGVyO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBjcmVhdGVDYW5jZWxDb250cm9sbGVyO1xuIiwidmFyIFFTID0gcmVxdWlyZSg0Myk7XG52YXIgY29uc3RhbnRzID0gcmVxdWlyZSgyNSk7XG52YXIgdGVtcGxhdGUgPSByZXF1aXJlKDM0KTtcbnZhciB1dWlkID0gcmVxdWlyZSgzNSk7XG52YXIgSFRUUF9SRVFVRVNUICA9IGNvbnN0YW50cy5IVFRQX1JFUVVFU1Q7XG5cbi8qKlxuICogQ3JlYXRlIGEgbmV3IGRlZmF1bHQgcmVxdWVzdCBvcHRpb25zLlxuICpcbiAqIEByZXR1cm5zIHtSZXF1ZXN0T3B0aW9uc30gUmV0dXJucyBhIG5ldyBkZWZhdWx0IHJlcXVlc3Qgb3BpdG9ucy5cbiAqL1xuZnVuY3Rpb24gY3JlYXRlRGVmYXVsdE9wdGlvbnMoKSB7XG4gICAgLyoqXG4gICAgICogQHR5cGUge1JlcXVlc3RPcHRpb25zfVxuICAgICAqL1xuICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgICBtZXRob2Q6ICdHRVQnLFxuICAgICAgICBiYXNlVVJMOiBudWxsLFxuICAgICAgICB1cmw6IG51bGwsXG4gICAgICAgIG1vZGVsOiBudWxsLFxuICAgICAgICBxdWVyeTogbnVsbCxcbiAgICAgICAgaGVhZGVyczogbnVsbCxcbiAgICAgICAgYm9keTogbnVsbCxcbiAgICAgICAgc2V0dGluZ3M6IHt9LFxuICAgICAgICBjb250cm9sbGVyOiBudWxsLFxuICAgICAgICByZXF1ZXN0RnVuY3Rpb25OYW1lOiBudWxsLFxuICAgICAgICByZXF1ZXN0VHlwZTogbnVsbCxcbiAgICAgICAgY29yczogZmFsc2UsXG4gICAgICAgIHhoclByb3BzOiBudWxsLFxuICAgICAgICB1c2VybmFtZTogbnVsbCxcbiAgICAgICAgcGFzc3dvcmQ6IG51bGwsXG4gICAgICAgIHRpbWVvdXQ6IDAsXG4gICAgICAgIG5vQ2FjaGU6IGZhbHNlLFxuICAgICAgICBub0NhY2hlSGVhZGVyczoge1xuICAgICAgICAgICAgJ1ByYWdtYSc6ICduby1jYWNoZScsXG4gICAgICAgICAgICAnQ2FjaGUtQ29udHJvbCc6ICduby1jYWNoZSwgbm8tc3RvcmUsIG11c3QtcmV2YWxpZGF0ZSdcbiAgICAgICAgfSxcbiAgICAgICAganNvbnA6ICdjYWxsYmFjaycsXG4gICAgICAgIGh0dHBSZXF1ZXN0Qm9keVByb2Nlc3Nvcjoge1xuICAgICAgICAgICAgcmF3OiB7XG4gICAgICAgICAgICAgICAgcHJpb3JpdHk6IDAsXG4gICAgICAgICAgICAgICAgaGVhZGVyczogbnVsbCxcbiAgICAgICAgICAgICAgICBwcm9jZXNzb3I6IG51bGwsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZm9ybToge1xuICAgICAgICAgICAgICAgIHByaW9yaXR5OiAxLFxuICAgICAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQ7IGNoYXJzZXQ9VVRGLTgnXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBwcm9jZXNzb3I6IGZ1bmN0aW9uIChkYXRhLCBvcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBRUy5lbmNvZGUoZGF0YSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGpzb246IHtcbiAgICAgICAgICAgICAgICBwcmlvcml0eTogMixcbiAgICAgICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbjsgY2hhcnNldD1VVEYtOCdcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHByb2Nlc3NvcjogZnVuY3Rpb24gKGRhdGEsIG9wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGRhdGEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgaHR0cFJlc3BvbnNlUGFyc2VyOiB7XG4gICAgICAgICAgICBqc29uOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgLy8gYHRoaXNgIGlzIHBvaW50IHRvIHRoZSBjdXJyZW50IGluc3RhbmNlIG9mIGBIdHRwUmVzcG9uc2VgLlxuICAgICAgICAgICAgICAgIHZhciByZXNwb25zZVRleHQgPSB0aGlzLnJlcXVlc3QueGhyLnJlc3BvbnNlVGV4dDtcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzcG9uc2VUZXh0ID8gSlNPTi5wYXJzZShyZXNwb25zZVRleHQpIDogbnVsbDtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB0ZXh0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucmVxdWVzdC54aHIucmVzcG9uc2VUZXh0O1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHN0YXR1czogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnJlcXVlc3QueGhyLnN0YXR1cztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAganNvbnBSZXNwb25zZVBhcnNlcjoge1xuICAgICAgICAgICAganNvbjogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnJlcXVlc3QucmVzcG9uc2VKU09OO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBodHRwUmVzcG9uc2VFcnJvclBhcnNlcjogbnVsbCxcbiAgICAgICAganNvbnBSZXNwb25zZUVycm9yUGFyc2VyOiBudWxsLFxuICAgICAgICBoYW5kbGVPcHRpb25zOiBudWxsLFxuICAgICAgICBjcmVhdGVYSFI6IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgICAgIH0sXG4gICAgICAgIGNyZWF0ZVNjcmlwdDogZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgICAgIHZhciBzY3JpcHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzY3JpcHQnKTtcblxuICAgICAgICAgICAgc2NyaXB0LnNldEF0dHJpYnV0ZSgndHlwZScsICd0ZXh0L2phdmFzY3JpcHQnKTtcbiAgICAgICAgICAgIHNjcmlwdC5zZXRBdHRyaWJ1dGUoJ2NoYXJzZXQnLCAndXRmLTgnKTtcblxuICAgICAgICAgICAgcmV0dXJuIHNjcmlwdDtcbiAgICAgICAgfSxcbiAgICAgICAganNvbnBDb250YWluZXJOb2RlOiBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICAgICAgcmV0dXJuIGRvY3VtZW50LmhlYWQgfHwgZG9jdW1lbnQuZ2V0RWxlbWVudHNCeU5hbWUoJ2hlYWQnKVswXTtcbiAgICAgICAgfSxcbiAgICAgICAganNvbnBDYWxsYmFja05hbWU6IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgICAgICByZXR1cm4gJ2pzb25wXycgKyB1dWlkKCkgKyAnXycgKyAobmV3IERhdGUoKS5nZXRUaW1lKCkpO1xuICAgICAgICB9LFxuICAgICAgICBjb21waWxlVVJMOiBmdW5jdGlvbiAodXJsLCBwYXJhbSwgb3B0aW9ucykge1xuICAgICAgICAgICAgcmV0dXJuIHRlbXBsYXRlKHVybCwgcGFyYW0pO1xuICAgICAgICB9LFxuICAgICAgICBlbmNvZGVRdWVyeVN0cmluZzogZnVuY3Rpb24gKGRhdGEsIG9wdGlvbnMpIHtcbiAgICAgICAgICAgIHJldHVybiBRUy5lbmNvZGUoZGF0YSk7XG4gICAgICAgIH0sXG4gICAgICAgIG9uWGhyQ3JlYXRlZDogbnVsbCxcbiAgICAgICAgb25YaHJPcGVuZWQ6IG51bGwsXG4gICAgICAgIG9uWGhyU2VudDogbnVsbCxcbiAgICAgICAgb25SZXF1ZXN0Q3JlYXRlZDogbnVsbCxcbiAgICAgICAgaXNSZXNwb25zZU9rOiBmdW5jdGlvbiAocmVxdWVzdFR5cGUsIHJlc3BvbnNlKSB7XG4gICAgICAgICAgICB2YXIgc3RhdHVzO1xuXG4gICAgICAgICAgICAvLyBIdHRwIHJlcXVlc3RcbiAgICAgICAgICAgIGlmIChyZXF1ZXN0VHlwZSA9PT0gSFRUUF9SRVFVRVNUKSB7XG4gICAgICAgICAgICAgICAgc3RhdHVzID0gcmVzcG9uc2UucmVxdWVzdC54aHIuc3RhdHVzO1xuICAgICAgICAgICAgICAgIHJldHVybiAoc3RhdHVzID49IDIwMCAmJiBzdGF0dXMgPCAzMDApIHx8IHN0YXR1cyA9PT0gMzA0O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBKU09OUCByZXF1ZXN0XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSxcbiAgICAgICAgdHJhbnNmb3JtRXJyb3I6IG51bGwsXG4gICAgICAgIHRyYW5zZm9ybVJlc3BvbnNlOiBudWxsLFxuICAgICAgICBzaG91bGRDYWxsRXJyb3JDYWxsYmFjazogbnVsbCxcbiAgICAgICAgc2hvdWxkQ2FsbFN1Y2Nlc3NDYWxsYmFjazogbnVsbFxuICAgIH07XG5cbiAgICByZXR1cm4gb3B0aW9ucztcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBjcmVhdGVEZWZhdWx0T3B0aW9ucztcbiIsIi8qKlxuICogRGVmaW5lIGEgc3RhdGljIG1lbWJlciBvbiB0aGUgZ2l2ZW4gY29uc3RydWN0b3IgYW5kIGl0cyBwcm90b3R5cGVcbiAqXG4gKiBAcGFyYW0ge0NvbnN0cnVjdG9yfSBjdG9yIFRoZSBjb25zdHJ1Y3RvciB0byBkZWZpbmUgdGhlIHN0YXRpYyBtZW1iZXJcbiAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIFRoZSBuYW1lIG9mIHRoZSBzdGF0aWMgbWVtYmVyXG4gKiBAcGFyYW0ge2FueX0gdmFsdWUgVGhlIHZhbHVlIG9mIHRoZSBzdGF0aWMgbWVtYmVyXG4gKiBAdGhyb3dzIHtFcnJvcn0gVGhyb3dzIGVycm9yIGlmIHRoZSBuYW1lIGhhcyBhbHJlYWR5IGV4aXN0ZWQsIG9yIHRoZSBjb25zdHJ1Y3RvciBpcyBub3QgYSBmdW5jdGlvblxuICovXG5mdW5jdGlvbiBkZWZpbmVFeHBvcnRzKGN0b3IsIG5hbWUsIHZhbHVlKSB7XG4gICAgY3Rvci5wcm90b3R5cGUuZXhwb3J0cyA9IGN0b3IuZXhwb3J0cyA9IGN0b3IuZXhwb3J0cyB8fCB7fTtcbiAgICBjdG9yLmV4cG9ydHNbbmFtZV0gPSB2YWx1ZTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBkZWZpbmVFeHBvcnRzO1xuIiwidmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKDM4KTtcbnZhciBIdHRwUmVzcG9uc2VFcnJvciA9IHJlcXVpcmUoNSk7XG52YXIgSlNPTlBSZXNwb25zZUVycm9yID0gcmVxdWlyZSg4KTtcbnZhciBjb25zdGFudHMgPSByZXF1aXJlKDI1KTtcbnZhciBIVFRQX1JFUVVFU1QgPSBjb25zdGFudHMuSFRUUF9SRVFVRVNUO1xuXG4vKipcbiAqIEZpcmUgdGhlIGNhbGxiYWNrcy5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ3xudWxsfSBjb2RlIElmIHRoZXJlIGlzIGFuIGVycm9yLCBgY29kZWAgc2hvdWxkIGJlIGEgc3RyaW5nLiBJZiB0aGVyZSBpcyBubyBlcnJvciwgYGNvZGVgIGlzIGBudWxsYC5cbiAqIEBwYXJhbSB7SHR0cFJlc3BvbnNlfEpTT05QUmVzcG9uc2V9IHJlc3BvbnNlIFRoZSByZXNwb25zZSBpbnN0YW5jZS5cbiAqL1xuZnVuY3Rpb24gZmlyZUNhbGxiYWNrcyhjb2RlLCByZXNwb25zZSkge1xuICAgIHZhciByZXF1ZXN0ID0gcmVzcG9uc2UucmVxdWVzdDtcbiAgICB2YXIgcmVxdWVzdFR5cGUgPSByZXF1ZXN0LnJlcXVlc3RUeXBlO1xuICAgIHZhciBvcHRpb25zID0gcmVxdWVzdC5vcHRpb25zO1xuICAgIHZhciBvbnN1Y2Nlc3MgPSByZXF1ZXN0Lm9uc3VjY2VzcztcbiAgICB2YXIgb25lcnJvciA9IHJlcXVlc3Qub25lcnJvcjtcbiAgICB2YXIgc2hvdWxkQ2FsbEVycm9yQ2FsbGJhY2sgPSBvcHRpb25zLnNob3VsZENhbGxFcnJvckNhbGxiYWNrO1xuICAgIHZhciBzaG91bGRDYWxsU3VjY2Vzc0NhbGxiYWNrID0gb3B0aW9ucy5zaG91bGRDYWxsU3VjY2Vzc0NhbGxiYWNrO1xuICAgIHZhciB0cmFuc2Zvcm1FcnJvciA9IG9wdGlvbnMudHJhbnNmb3JtRXJyb3I7XG4gICAgdmFyIHRyYW5zZm9ybVJlc3BvbnNlID0gb3B0aW9ucy50cmFuc2Zvcm1SZXNwb25zZTtcblxuICAgIHZhciBlcnJvciA9IG51bGw7XG4gICAgdmFyIGNhbGxFcnJvckNhbGxiYWNrID0gdHJ1ZTtcbiAgICB2YXIgY2FsbFN1Y2Nlc3NDYWxsYmFjayA9IHRydWU7XG4gICAgdmFyIHRyYW5zZm9ybWVkRXJyb3IgPSBudWxsO1xuICAgIHZhciB0cmFuc2Zvcm1lZFJlc3BvbnNlID0gbnVsbDtcblxuICAgIGlmIChjb2RlKSB7XG4gICAgICAgIGlmIChyZXF1ZXN0VHlwZSA9PT0gSFRUUF9SRVFVRVNUKSB7XG4gICAgICAgICAgICBlcnJvciA9IG5ldyBIdHRwUmVzcG9uc2VFcnJvcihjb2RlLCByZXF1ZXN0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGVycm9yID0gbmV3IEpTT05QUmVzcG9uc2VFcnJvcihjb2RlLCByZXF1ZXN0KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaXNGdW5jdGlvbih0cmFuc2Zvcm1FcnJvcikpIHtcbiAgICAgICAgICAgIHRyYW5zZm9ybWVkRXJyb3IgPSB0cmFuc2Zvcm1FcnJvcihyZXF1ZXN0VHlwZSwgZXJyb3IpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdHJhbnNmb3JtZWRFcnJvciA9IGVycm9yO1xuICAgICAgICB9XG4gICAgICAgIGlmIChpc0Z1bmN0aW9uKHNob3VsZENhbGxFcnJvckNhbGxiYWNrKSkge1xuICAgICAgICAgICAgY2FsbEVycm9yQ2FsbGJhY2sgPSBzaG91bGRDYWxsRXJyb3JDYWxsYmFjayhyZXF1ZXN0VHlwZSwgdHJhbnNmb3JtZWRFcnJvciwgZXJyb3IpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjYWxsRXJyb3JDYWxsYmFjaykge1xuICAgICAgICAgICAgaWYgKGlzRnVuY3Rpb24ob25lcnJvcikpIHtcbiAgICAgICAgICAgICAgICBvbmVycm9yKHRyYW5zZm9ybWVkRXJyb3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKGlzRnVuY3Rpb24odHJhbnNmb3JtUmVzcG9uc2UpKSB7XG4gICAgICAgICAgICB0cmFuc2Zvcm1lZFJlc3BvbnNlID0gdHJhbnNmb3JtUmVzcG9uc2UocmVxdWVzdFR5cGUsIHJlc3BvbnNlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRyYW5zZm9ybWVkUmVzcG9uc2UgPSByZXNwb25zZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaXNGdW5jdGlvbihzaG91bGRDYWxsU3VjY2Vzc0NhbGxiYWNrKSkge1xuICAgICAgICAgICAgY2FsbFN1Y2Nlc3NDYWxsYmFjayA9IHNob3VsZENhbGxTdWNjZXNzQ2FsbGJhY2socmVxdWVzdFR5cGUsIHRyYW5zZm9ybWVkUmVzcG9uc2UsIHJlc3BvbnNlKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2FsbFN1Y2Nlc3NDYWxsYmFjaykge1xuICAgICAgICAgICAgaWYgKGlzRnVuY3Rpb24ob25zdWNjZXNzKSkge1xuICAgICAgICAgICAgICAgIG9uc3VjY2Vzcyh0cmFuc2Zvcm1lZFJlc3BvbnNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBmaXJlQ2FsbGJhY2tzO1xuIiwidmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKDM4KTtcblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gcHJvY2VzcyB0aGUgcmVxdWVzdCBvcHRpb25zLiBUaGlzIGZ1bmN0aW9uIHdpbGwgY2FsbCB0aGUgZnVuY3Rpb24gYG9wdGlvbnMuaGFuZGxlT3B0aW9uc2AuXG4gKlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICogQHJldHVybnMge3ZvaWR9XG4gKi9cbmZ1bmN0aW9uIGhhbmRsZU9wdGlvbnMob3B0aW9ucykge1xuICAgIGlmIChpc0Z1bmN0aW9uKG9wdGlvbnMuaGFuZGxlT3B0aW9ucykpIHtcbiAgICAgICAgb3B0aW9ucy5oYW5kbGVPcHRpb25zKG9wdGlvbnMpO1xuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBoYW5kbGVPcHRpb25zO1xuIiwibW9kdWxlLmV4cG9ydHMgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuIiwiLyoqXG4gKiBNYWtlIGBTdWJDbGFzc2AgZXh0ZW5kIGBTdXBlckNsYXNzYC5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBTdWJDbGFzcyBUaGUgc3ViIGNsYXNzIGNvbnN0cnVjdG9yLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gU3VwZXJDbGFzcyBUaGUgc3VwZXIgY2xhc3MgY29uc3RydWN0b3IuXG4gKi9cbmZ1bmN0aW9uIGluaGVyaXRzKFN1YkNsYXNzLCBTdXBlckNsYXNzKSB7XG4gICAgdmFyIEYgPSBmdW5jdGlvbigpIHt9O1xuXG4gICAgRi5wcm90b3R5cGUgPSBTdXBlckNsYXNzLnByb3RvdHlwZTtcblxuICAgIFN1YkNsYXNzLnByb3RvdHlwZSA9IG5ldyBGKCk7XG4gICAgU3ViQ2xhc3MucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gU3ViQ2xhc3M7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaW5oZXJpdHM7XG4iLCIvKipcbiAqIFRoZSBubyBvcGVyYXRpb24gZnVuY3Rpb24uXG4gKi9cbmZ1bmN0aW9uIG5vb3AoKSB7XG4gICAgLy8gbm90aGluZyB0byBkbyBoZXJlLlxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IG5vb3A7XG4iLCIvKipcbiAqIEEgc2ltcGxlIHRlbXBsYXRlIGZ1bmN0aW9uXG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIFJyZXR1cm5zICcvcG9zdC8xJ1xuICogdGVtcGxhdGUoJy9wb3N0L3sgcG9zdC5pZCB9JywgeyBwb3N0OiB7IGlkOiAxIH0gfSlcbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gdGVtcGxhdGUgVGhlIHRlbXBsYXRlIHRleHQuXG4gKiBAcGFyYW0ge09iamVjdC48c3RyaW5nLCBzdHJpbmc+fSBkYXRhIFRoZSBkYXRhIG9iamVjdC5cbiAqIEBwYXJhbSB7VGVtcGxhdGVPcHRpb25zfSBvcHRpb25zIFRoZSB0ZW1wbGF0ZSBvcHRpb25zLlxuICogQHJldHVybnMge3N0cmluZ30gUmV0dXJucyB0aGUgY29tcGlsZWQgdGV4dC5cbiAqL1xuZnVuY3Rpb24gdGVtcGxhdGUodGVtcGxhdGUsIGRhdGEsIG9wdGlvbnMpIHtcbiAgICB2YXIgdGVtcGwgPSB0ZW1wbGF0ZSArICcnO1xuICAgIHZhciBtb2RlbCA9IGRhdGEgfHwge307XG4gICAgdmFyIG9wdHMgPSBvcHRpb25zIHx8IHt9O1xuICAgIHZhciBzdGFydCA9IG9wdHMuc3RhcnQgfHwgJ3snO1xuICAgIHZhciBlbmQgPSBvcHRzLmVuZCB8fCAnfSc7XG4gICAgdmFyIGVuY29kZSA9IG9wdHMuZW5jb2RlIHx8IGVuY29kZVVSSUNvbXBvbmVudDtcblxuICAgIHJldHVybiBjb21waWxlKHRlbXBsLCBzdGFydCwgZW5kLCBmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgIHJldHVybiByZWFkKG1vZGVsLCBrZXksIGVuY29kZSk7XG4gICAgfSk7XG59XG5cbi8qKlxuICogUmVhZCB0aGUgdmFsdWUgKGNhc3QgdG8gc3RyaW5nKSBpbiB0aGUgYGRhdGFgIHdpdGggdGhlIGdpdmVuIGBrZXlgLiBJZiB0aGUga2V5IGlzIHN0YXJ0IHdpdGggYC0gYCAoYC1gIGFuZCBzcGFjZSksXG4gKiB0aGUgYC0gYCB3aWxsIGJlIHJlbW92ZWQgZnJvbSB0aGUga2V5IGFuZCB0aGUgdmFsdWUgd2lsbCBub3QgYmUgdXJsZW5jb2RlZC4gT3RoZXJ3aXNlIHRoZSB2YWx1ZSB3aWxsIGJlIHVybGVuY29kZWQuXG4gKlxuICogQHBhcmFtIHtPYmplY3QuPHN0cmluZywgKj59IGRhdGEgVGhlIG9iamVjdCBrZWVwcyB0aGUgZGF0YS5cbiAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgVGhlIHByb3BlcnR5IHBhdGggdG8gYWNjZXNzLlxuICogQHBhcmFtIHsodmFsdWU6IHN0cmluZykgPT4gc3RyaW5nfSBlbmNvZGUgVGhlIGZ1bmN0aW9uIHRvIGVuY29kZSB0aGUgdmFsdWUuXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBSZXR1cm5zIHRoZSB2YWx1ZS5cbiAqL1xuZnVuY3Rpb24gcmVhZChkYXRhLCBrZXksIGVuY29kZSkge1xuICAgIHZhciBmaXJzdCA9IGtleS5jaGFyQXQoMCk7XG4gICAgdmFyIHNlY29uZCA9IGtleS5jaGFyQXQoMSk7XG4gICAgdmFyIHJhdyA9IGZhbHNlO1xuXG4gICAgLy8gey0gcmF3IH1cbiAgICBpZiAoZmlyc3QgPT09ICctJyAmJiBzZWNvbmQgPT09ICcgJykge1xuICAgICAgICByYXcgPSB0cnVlO1xuICAgICAgICBrZXkgPSBrZXkuc3Vic3RyKDIpO1xuICAgIH1cblxuICAgIGtleSA9IGtleS5yZXBsYWNlKC9eXFxzK3xcXHMrJC9nLCAnJyk7XG5cbiAgICBpZiAoa2V5LmNoYXJBdCgwKSAhPT0gJ1snKSB7XG4gICAgICAgIGtleSA9ICcuJyArIGtleTtcbiAgICB9XG5cbiAgICB2YXIgZm4gPSBuZXcgRnVuY3Rpb24oJ2QnLCAncmV0dXJuIGQnICsga2V5KTtcbiAgICB2YXIgdmFsdWUgPSBmbihkYXRhKSArICcnO1xuXG4gICAgaWYgKCFyYXcpIHtcbiAgICAgICAgdmFsdWUgPSBlbmNvZGUodmFsdWUpO1xuICAgIH1cblxuICAgIHJldHVybiB2YWx1ZTtcbn1cblxuLyoqXG4gKiBDb21waWxlIHRoZSB0ZW1wbGF0ZS5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gdGVtcGxhdGUgVGhlIHRlbXBsYXRlIHRvIGNvbXBpbGUuXG4gKiBAcGFyYW0ge3N0cmluZ30gc3RhcnRUYWcgVGhlIHN0YXJ0IHRhZy5cbiAqIEBwYXJhbSB7c3RyaW5nfSBlbmRUYWcgVGhlIGVuZCB0YWcuXG4gKiBAcGFyYW0geyhleHByOiBzdHJpbmcpID0+IHN0cmluZ30gcGFyc2UgVGhlIGZ1bmN0aW9uIHRvIHBhcnNlIHRoZSBleHByZXNzaW9uLlxuICogQHJldHVybnMge3N0cmluZ30gUmV0dXJuIHRoZSBjb21waWxlZCBzdHJpbmcuXG4gKi9cbmZ1bmN0aW9uIGNvbXBpbGUodGVtcGxhdGUsIHN0YXJ0VGFnLCBlbmRUYWcsIHBhcnNlKSB7XG4gICAgdmFyIGkgPSAwO1xuICAgIHZhciBsID0gdGVtcGxhdGUubGVuZ3RoO1xuICAgIHZhciBzbCA9IHN0YXJ0VGFnLmxlbmd0aDtcbiAgICB2YXIgZWwgPSBlbmRUYWcubGVuZ3RoO1xuICAgIHZhciBvdXRwdXQgPSBbXTtcbiAgICB2YXIgZXhwcmJ1ZmZlciA9IFtdO1xuICAgIHZhciBUX1NUUiA9IDE7XG4gICAgdmFyIFRfRVhQID0gMjtcbiAgICB2YXIgdHlwZSA9IFRfU1RSO1xuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBjaGFyIGluIGB0ZW1wbGF0ZWAgYXQgdGhlIGdpdmVuIHBvc2l0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1uZXJ9IFtpbmRleF0gVGhlIGluZGV4IHRvIHJlYWQsIGlmIGl0IGlzIG5vdCBzZXQsIGBpYCBpcyB1c2VkLlxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IFJldHVybnMgdGhlIGNoYXIuXG4gICAgICovXG4gICAgdmFyIGNoYXJBdCA9IGZ1bmN0aW9uIChpbmRleCkge1xuICAgICAgICByZXR1cm4gdGVtcGxhdGUuY2hhckF0KGluZGV4IHx8IGkpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBFc2NhcGUgdGhlIHRhZy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB0YWcgVGhlIHRhZyB0byBlc2NhcGUuXG4gICAgICogQHBhcmFtIHtzdHJpbmdbXX0gYnVmZmVyIFRoZSBidWZmZXIgdG8gcHV0IHRoZSBjaGFyLlxuICAgICAqL1xuICAgIHZhciBlc2MgPSBmdW5jdGlvbiAodGFnLCBidWZmZXIpIHtcbiAgICAgICAgdmFyIGM7XG4gICAgICAgIHZhciBtID0gdGFnLmxlbmd0aDtcbiAgICAgICAgdmFyIHMgPSAnXFxcXCc7XG5cbiAgICAgICAgd2hpbGUgKDEpIHtcbiAgICAgICAgICAgIGMgPSBjaGFyQXQoaSk7XG4gICAgICAgICAgICBpZiAoYyA9PT0gcykge1xuICAgICAgICAgICAgICAgIGMgPSBjaGFyQXQoKytpKTtcbiAgICAgICAgICAgICAgICBpZiAoYyA9PT0gcykge1xuICAgICAgICAgICAgICAgICAgICBidWZmZXIucHVzaChzKTtcbiAgICAgICAgICAgICAgICAgICAgKytpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoaXNXb3JkKHRhZykpIHtcbiAgICAgICAgICAgICAgICAgICAgYnVmZmVyLnB1c2godGFnKTtcbiAgICAgICAgICAgICAgICAgICAgaSArPSBtO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGJ1ZmZlci5wdXNoKHMpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIENoZWNrIHdoZXRoZXIgdGhlIG5leHQgaW5wdXQgaXMgdGhlIHdvcmQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gd29yZCBUaGUgd29yZCB0byBjaGVjay5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBSZXR1cm5zIGAxYCBvbiB5ZXMsIG90aGVyd2lzZSBgMGAgaXMgcmV0dXJuZWQuXG4gICAgICovXG4gICAgdmFyIGlzV29yZCA9IGZ1bmN0aW9uICh3b3JkKSB7XG4gICAgICAgIHZhciBrID0gMDtcbiAgICAgICAgdmFyIGogPSBpO1xuICAgICAgICB2YXIgbSA9IHdvcmQubGVuZ3RoO1xuXG4gICAgICAgIHdoaWxlIChrIDwgbSAmJiBqIDwgbCkge1xuICAgICAgICAgICAgaWYgKHdvcmQuY2hhckF0KGspICE9PSB0ZW1wbGF0ZS5jaGFyQXQoaikpIHJldHVybiAwO1xuICAgICAgICAgICAgKytrO1xuICAgICAgICAgICAgKytqO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIDE7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEZsdXNoIHRoZSBleHByIHRvIHRoZSBvdXRwdXQgYW5kIHJlc2V0IHRoZSBleHByIGJ1ZmZlci5cbiAgICAgKi9cbiAgICB2YXIgZmx1c2hFeHByID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBvdXRwdXQucHVzaChwYXJzZShleHByYnVmZmVyLmpvaW4oJycpKSk7XG4gICAgICAgIGV4cHJidWZmZXIgPSBbXTtcbiAgICB9O1xuXG4gICAgd2hpbGUgKGkgPCBsKSB7XG4gICAgICAgIGlmICh0eXBlID09PSBUX1NUUikge1xuICAgICAgICAgICAgZXNjKHN0YXJ0VGFnLCBvdXRwdXQpO1xuICAgICAgICAgICAgaWYgKGlzV29yZChzdGFydFRhZykpIHtcbiAgICAgICAgICAgICAgICB0eXBlID0gVF9FWFA7XG4gICAgICAgICAgICAgICAgaSArPSBzbDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgb3V0cHV0LnB1c2goY2hhckF0KGkpKTtcbiAgICAgICAgICAgICAgICBpICs9IDE7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gVF9FWFApIHtcbiAgICAgICAgICAgIGVzYyhlbmRUYWcsIGV4cHJidWZmZXIpO1xuICAgICAgICAgICAgaWYgKGlzV29yZChlbmRUYWcpKSB7XG4gICAgICAgICAgICAgICAgdHlwZSA9IFRfU1RSO1xuICAgICAgICAgICAgICAgIGkgKz0gZWw7XG4gICAgICAgICAgICAgICAgZmx1c2hFeHByKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGV4cHJidWZmZXIucHVzaChjaGFyQXQoaSkpO1xuICAgICAgICAgICAgICAgIGkgKz0gMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmICh0eXBlID09PSBUX0VYUCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuZXhwZWN0ZWQgZW5kJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG91dHB1dC5qb2luKCcnKTtcbn1cblxuLyoqXG4gKiBAdHlwZWRlZiB7T2JqZWN0LjxzdHJpbmcsICo+fSBUZW1wbGF0ZU9wdGlvbnNcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbc3RhcnRdIFRoZSBzdGFydCB0YWcgb2YgdGhlIHRlbXBsYXRlLCBkZWZhdWx0IGlzIGB7YC5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbZW5kXSBUaGUgZW5kIHRhZyBvZiB0aGUgdGVtcGxhdGUsIGRlZmF1bHQgaXMgYH1gLlxuICogQHByb3BlcnR5IHsodmFsdWU6IHN0cmluZykgPT4gc3RyaW5nfSBbZW5jb2RlXSBUaGUgZnVuY3Rpb24gdG8gZW5jb2RlIHRoZSB2YWx1ZSwgZGVmYXVsdCBpcyBgZW5jb2RlVVJJQ29tcG9uZW50YC5cbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IHRlbXBsYXRlO1xuIiwidmFyIGlkID0gMDtcblxuLyoqXG4gKiBSZXR1cm5zIGEgbnVtYmVyIHRoYXQgZ3JlYXRlciB0aGFuIHRoZSBwcml2b3VzIG9uZSwgc3RhcnRpbmcgZm9ybSBgMWAuXG4gKlxuICogQHJldHVybnMge251bWJlcn1cbiAqL1xuZnVuY3Rpb24gdXVpZCgpIHtcbiAgICBpZCArPSAxO1xuICAgIHJldHVybiBpZDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB1dWlkO1xuIiwiLyoqXG4gKiBDaGVjayB3aGV0aGVyIHRoZSB1cmwgaXMgYWJzb2x1dGUgdXJsLlxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSB1cmwgVGhlIHVybCBzdHJpbmcgdG8gY2hlY2tcbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgdXJsIGlzIGFib3NvbHV0ZSwgb3RoZXJ3aXNlIGBmYWxzZWAgaXMgcmV0dXJuZWRcbiAqL1xuZnVuY3Rpb24gaXNBYnNvbHV0ZVVSTCh1cmwpIHtcbiAgICByZXR1cm4gL14oPzpbYS16XVthLXowLTlcXC1cXC5cXCtdKjopP1xcL1xcLy9pLnRlc3QodXJsKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpc0Fic29sdXRlVVJMO1xuIiwidmFyIHRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcblxuLyoqXG4gKiBDaGVjayB3aGV0aGVyIHRoZSB2YXJpYWJsZSBpcyBhbiBpbnN0YW5jZSBvZiBgQXJyYXlgXG4gKlxuICogQHBhcmFtIHthbnl9IGl0IFRoZSB2YXJpYWJsZSB0byBjaGVja1xuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSB2YXJpYWJsZSBpcyBhbiBpbnN0YW5jZSBvZiBgQXJyYXlgLCBvdGhlcndpc2UgYGZhbHNlYCBpcyByZXR1cm5lZFxuICovXG5mdW5jdGlvbiBpc0FycmF5KGl0KSB7XG4gICAgcmV0dXJuIHRvU3RyaW5nLmNhbGwoaXQpID09PSAnW29iamVjdCBBcnJheV0nO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGlzQXJyYXk7XG4iLCJ2YXIgdG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xuXG4vKipcbiAqIENoZWNrIHdoZXRoZXIgdGhlIHZhcmlhYmxlIGlzIGEgZnVuY3Rpb25cbiAqXG4gKiBAcGFyYW0ge2FueX0gaXQgVGhlIHZhcmlhYmxlIHRvIGNoZWNrXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIHZhcmlhYmxlIGlzIGEgZnVuY3Rpb24sIG90aGVyd2lzZSBgZmFsc2VgIGlzIHJldHVybmVkXG4gKi9cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oaXQpIHtcbiAgICByZXR1cm4gdG9TdHJpbmcuY2FsbChpdCkgPT09ICdbb2JqZWN0IEZ1bmN0aW9uXSc7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaXNGdW5jdGlvbjtcbiIsInZhciB0b1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG5cbi8qKlxuICogQ2hlY2sgd2hldGhlciB0aGUgdmFyaWFibGUgaXMgYSBwbGFpbiBvYmplY3QuXG4gKlxuICogQHBhcmFtIHthbnl9IGl0IFRoZSB2YXJpYWJsZSB0byBjaGVja1xuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSB2YXJpYWJsZSBpcyBhIHBsYWluIG9iamVjdCwgb3RoZXJ3aXNlIGBmYWxzZWAgaXMgcmV0dXJuZWRcbiAqL1xuZnVuY3Rpb24gaXNQbGFpbk9iamVjdChpdCkge1xuICAgIGlmICghaXQpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiBpdCA9PT0gd2luZG93KSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIGdsb2JhbCAhPT0gJ3VuZGVmaW5lZCcgJiYgaXQgPT09IGdsb2JhbCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRvU3RyaW5nLmNhbGwoaXQpID09PSAnW29iamVjdCBPYmplY3RdJztcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpc1BsYWluT2JqZWN0O1xuIiwidmFyIGlzQXJyYXkgPSByZXF1aXJlKDM3KTtcbnZhciBpc1BsYWluT2JqZWN0ID0gcmVxdWlyZSgzOSk7XG52YXIgaGFzT3duID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcbnZhciBzbGljZSA9IEFycmF5LnByb3RvdHlwZS5zbGljZTtcblxuLyoqXG4gKiBDb3B5IHRoZSBub24tdW5kZWZpbmVkIHZhbHVlcyBvZiBzb3VyY2UgdG8gdGFyZ2V0LiBPdmVyd3JpdGUgdGhlIG9yaWdpbmFsIHZhbHVlcy5cbiAqIFRoaXMgZnVuY3Rpb24gd2lsbCBtb2RpZnkgdGhlIHRhcmdldFxuICpcbiAqIEBwYXJhbSB7T2JqZWN0LjxzdHJpbmcsICo+fGFueVtdfSB0YXJnZXQgVGhlIHRhcmdldCBvYmplY3Qgb3IgYXJyYXlcbiAqIEBwYXJhbSB7T2JqZWN0LjxzdHJpbmcsICo+fGFueVtdfSBzb3VyY2UgVGhlIHNvdXJjZSBvYmplY3Qgb3IgYXJyYXlcbiAqIEByZXR1cm5zIHtPYmplY3QuPHN0cmluZywgKj58YW55W119IFJldHVybnMgdGhlIGV4dGVuZGVkIHRhcmdldCBvYmplY3Qgb3IgYXJyYXlcbiAqL1xuZnVuY3Rpb24gZXh0ZW5kKHRhcmdldCwgc291cmNlKSB7XG4gICAgdmFyIGtleSwgdmFsO1xuXG4gICAgaWYgKCB0YXJnZXQgJiYgKCBpc0FycmF5KHNvdXJjZSkgfHwgaXNQbGFpbk9iamVjdChzb3VyY2UpICkgKSB7XG4gICAgICAgIGZvciAoIGtleSBpbiBzb3VyY2UgKSB7XG4gICAgICAgICAgICBpZiAoIGhhc093bi5jYWxsKHNvdXJjZSwga2V5KSApIHtcbiAgICAgICAgICAgICAgICB2YWwgPSBzb3VyY2Vba2V5XTtcbiAgICAgICAgICAgICAgICBpZiAodmFsICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCBpc1BsYWluT2JqZWN0KHZhbCkgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoICEgaXNQbGFpbk9iamVjdCh0YXJnZXRba2V5XSkgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0W2tleV0gPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIG1lcmdlKHRhcmdldFtrZXldLCB2YWwpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKCBpc0FycmF5KHZhbCkgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoICEgaXNBcnJheSh0YXJnZXRba2V5XSkgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0W2tleV0gPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIG1lcmdlKHRhcmdldFtrZXldLCB2YWwpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0W2tleV0gPSB2YWw7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGFyZ2V0O1xufVxuXG4vKipcbiAqIENvcHkgYW55IG5vbi11bmRlZmluZWQgdmFsdWVzIG9mIHNvdXJjZSB0byB0YXJnZXQgYW5kIG92ZXJ3cml0ZXMgdGhlIGNvcnJlc3BvbmRpbmcgb3JpZ2luYWwgdmFsdWVzLiBUaGlzIGZ1bmN0aW9uXG4gKiB3aWxsIG1vZGlmeSB0aGUgdGFyZ2V0IG9iamVjdC5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdGFyZ2V0IFRoZSB0YXJnZXQgb2JqZWN0XG4gKiBAcGFyYW0gey4uLk9iamVjdH0gYXJncyBUaGUgc291cmNlIG9iamVjdFxuICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyB0aGUgbW9kaWZpZWQgdGFyZ2V0IG9iamVjdFxuICovXG5mdW5jdGlvbiBtZXJnZSh0YXJnZXQsIGFyZ3MpIHtcbiAgICB2YXIgaSA9IDA7XG4gICAgdmFyIGwgPSBhcmd1bWVudHMubGVuZ3RoIC0gMTtcblxuICAgIGFyZ3MgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgbDsgaSArPSAxKSB7XG4gICAgICAgIGV4dGVuZCh0YXJnZXQsIGFyZ3NbaV0pO1xuICAgIH1cblxuICAgIHJldHVybiB0YXJnZXQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gbWVyZ2U7XG4iLCJ2YXIgdXRpbCA9IHJlcXVpcmUoNDQpO1xudmFyIGlzQXJyYXkgPSB1dGlsLmlzQXJyYXk7XG5cbi8qKlxuICogRGVjb2RlIHRoZSBVUkkgQ29tcG9uZW50IGVuY29kZWQgcXVlcnkgc3RyaW5nIHRvIG9iamVjdFxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSBUaGUgVVJJIENvbXBvbmVudCBlbmNvZGVkIHF1ZXJ5IHN0cmluZ1xuICogQHJldHVybnMge09iamVjdC48c3RyaW5nLCBzdHJpbmc+fSBSZXR1cm5zIHRoZSBkZWNvZGVkIG9iamVjdFxuICovXG52YXIgZGVjb2RlID0gZnVuY3Rpb24gKHN0cmluZykge1xuICAgIHZhciBvYmplY3QgPSB7fTtcbiAgICB2YXIgY2FjaGUgPSB7fTtcbiAgICB2YXIga2V5VmFsdWVBcnJheTtcbiAgICB2YXIgaW5kZXg7XG4gICAgdmFyIGxlbmd0aDtcbiAgICB2YXIga2V5VmFsdWU7XG4gICAgdmFyIGtleTtcbiAgICB2YXIgdmFsdWU7XG5cbiAgICAvLyBkbyBub3QgZGVjb2RlIGVtcHR5IHN0cmluZyBvciBzb21ldGhpbmcgdGhhdCBpcyBub3Qgc3RyaW5nXG4gICAgaWYgKHN0cmluZyAmJiB0eXBlb2Ygc3RyaW5nID09PSAnc3RyaW5nJykge1xuICAgICAgICBrZXlWYWx1ZUFycmF5ID0gc3RyaW5nLnNwbGl0KCcmJyk7XG4gICAgICAgIGluZGV4ID0gMDtcbiAgICAgICAgbGVuZ3RoID0ga2V5VmFsdWVBcnJheS5sZW5ndGg7XG5cbiAgICAgICAgd2hpbGUgKGluZGV4IDwgbGVuZ3RoKSB7XG4gICAgICAgICAgICBrZXlWYWx1ZSA9IGtleVZhbHVlQXJyYXlbaW5kZXhdLnNwbGl0KCc9Jyk7XG4gICAgICAgICAgICBrZXkgPSBkZWNvZGVVUklDb21wb25lbnQoa2V5VmFsdWVbMF0pO1xuICAgICAgICAgICAgdmFsdWUgPSBrZXlWYWx1ZVsxXTtcblxuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IGRlY29kZVVSSUNvbXBvbmVudCh2YWx1ZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHZhbHVlID0gbnVsbDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZGVjb2RlS2V5KG9iamVjdCwgY2FjaGUsIGtleSwgdmFsdWUpO1xuXG4gICAgICAgICAgICBpbmRleCArPSAxO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG9iamVjdDtcbn07XG5cbi8qKlxuICogRGVjb2RlIHRoZSBzcGVjZWZpZWQga2V5XG4gKlxuICogQHBhcmFtIHtPYmplY3QuPHN0cmluZywgc3RyaW5nPn0gb2JqZWN0IFRoZSBvYmplY3QgdG8gaG9sZCB0aGUgZGVjb2RlZCBkYXRhXG4gKiBAcGFyYW0ge09iamVjdC48c3RyaW5nLCAqPn0gY2FjaGUgVGhlIG9iamVjdCB0byBob2xkIGNhY2hlIGRhdGFcbiAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgVGhlIGtleSBuYW1lIHRvIGRlY29kZVxuICogQHBhcmFtIHthbnl9IHZhbHVlIFRoZSB2YWx1ZSB0byBkZWNvZGVcbiAqL1xudmFyIGRlY29kZUtleSA9IGZ1bmN0aW9uIChvYmplY3QsIGNhY2hlLCBrZXksIHZhbHVlKSB7XG4gICAgdmFyIHJCcmFja2V0ID0gL1xcWyhbXlxcW10qPyk/XFxdJC87XG4gICAgdmFyIHJJbmRleCA9IC8oXjAkKXwoXlsxLTldXFxkKiQpLztcbiAgICB2YXIgaW5kZXhPcktleU9yRW1wdHk7XG4gICAgdmFyIHBhcmVudEtleTtcbiAgICB2YXIgYXJyYXlPck9iamVjdDtcbiAgICB2YXIga2V5SXNJbmRleDtcbiAgICB2YXIga2V5SXNFbXB0eTtcbiAgICB2YXIgdmFsdWVJc0luQXJyYXk7XG4gICAgdmFyIGRhdGFBcnJheTtcbiAgICB2YXIgbGVuZ3RoO1xuXG4gICAgLy8gY2hlY2sgd2hldGhlciBrZXkgaXMgc29tZXRoaW5nIGxpa2UgYHBlcnNvbltuYW1lXWAgb3IgYGNvbG9yc1tdYCBvclxuICAgIC8vIGBjb2xvcnNbMV1gXG4gICAgaWYgKCByQnJhY2tldC50ZXN0KGtleSkgKSB7XG4gICAgICAgIGluZGV4T3JLZXlPckVtcHR5ID0gUmVnRXhwLiQxO1xuICAgICAgICBwYXJlbnRLZXkgPSBrZXkucmVwbGFjZShyQnJhY2tldCwgJycpO1xuICAgICAgICBhcnJheU9yT2JqZWN0ID0gY2FjaGVbcGFyZW50S2V5XTtcblxuICAgICAgICBrZXlJc0luZGV4ID0gckluZGV4LnRlc3QoaW5kZXhPcktleU9yRW1wdHkpO1xuICAgICAgICBrZXlJc0VtcHR5ID0gaW5kZXhPcktleU9yRW1wdHkgPT09ICcnO1xuICAgICAgICB2YWx1ZUlzSW5BcnJheSA9IGtleUlzSW5kZXggfHwga2V5SXNFbXB0eTtcblxuICAgICAgICBpZiAoYXJyYXlPck9iamVjdCkge1xuICAgICAgICAgICAgLy8gY29udmVydCB0aGUgYXJyYXkgdG8gb2JqZWN0XG4gICAgICAgICAgICBpZiAoICghIHZhbHVlSXNJbkFycmF5KSAmJiBpc0FycmF5KGFycmF5T3JPYmplY3QpICkge1xuICAgICAgICAgICAgICAgIGRhdGFBcnJheSA9IGFycmF5T3JPYmplY3Q7XG4gICAgICAgICAgICAgICAgbGVuZ3RoID0gZGF0YUFycmF5Lmxlbmd0aDtcbiAgICAgICAgICAgICAgICBhcnJheU9yT2JqZWN0ID0ge307XG5cbiAgICAgICAgICAgICAgICB3aGlsZSAobGVuZ3RoLS0pIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFycmF5T3JPYmplY3RbbGVuZ3RoXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhcnJheU9yT2JqZWN0W2xlbmd0aF0gPSBkYXRhQXJyYXlbbGVuZ3RoXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGFycmF5T3JPYmplY3QgPSB2YWx1ZUlzSW5BcnJheSA/IFtdIDoge307XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIGtleUlzRW1wdHkgJiYgaXNBcnJheShhcnJheU9yT2JqZWN0KSApIHtcbiAgICAgICAgICAgIGFycmF5T3JPYmplY3QucHVzaCh2YWx1ZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBhcnJheU9yT2JqZWN0IGlzIGFycmF5IG9yIG9iamVjdCBoZXJlXG4gICAgICAgICAgICBhcnJheU9yT2JqZWN0W2luZGV4T3JLZXlPckVtcHR5XSA9IHZhbHVlO1xuICAgICAgICB9XG5cbiAgICAgICAgY2FjaGVbcGFyZW50S2V5XSA9IGFycmF5T3JPYmplY3Q7XG5cbiAgICAgICAgZGVjb2RlS2V5KG9iamVjdCwgY2FjaGUsIHBhcmVudEtleSwgYXJyYXlPck9iamVjdCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgb2JqZWN0W2tleV0gPSB2YWx1ZTtcbiAgICB9XG59O1xuXG5leHBvcnRzLmRlY29kZSA9IGRlY29kZTtcbiIsInZhciB1dGlsID0gcmVxdWlyZSg0NCk7XG52YXIgaXNBcnJheSA9IHV0aWwuaXNBcnJheTtcbnZhciBpc09iamVjdCA9IHV0aWwuaXNPYmplY3Q7XG52YXIgaGFzT3duID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcblxuLyoqXG4gKiBFbmNvZGUgdGhlIGdpdmVuIG9iamVjdCB0byBVUkkgQ29tcG9uZW50IGVuY29kZWQgcXVlcnkgc3RyaW5nXG4gKlxuICogQHBhcmFtIHtPYmplY3QuPHN0cmluZywgKj59IG9iamVjdCBUaGUgb2JqZWN0IHRvIGVuY29kZVxuICogQHBhcmFtIHtib29sZWFufSBba2VlcEFycmF5SW5kZXhdIFdoZXRoZXIgdG8ga2VlcCBhcnJheSBpbmRleFxuICogQHJldHVybnMge3N0cmluZ30gUmV0dXJucyB0aGUgVVJJIENvbXBvbmVudCBlbmNvZGVkIHF1ZXJ5IHN0cmluZ1xuICovXG52YXIgZW5jb2RlID0gZnVuY3Rpb24gKG9iamVjdCwga2VlcEFycmF5SW5kZXgpIHtcbiAgICB2YXIga2V5O1xuICAgIHZhciBrZXlWYWx1ZUFycmF5ID0gW107XG5cbiAgICBrZWVwQXJyYXlJbmRleCA9ICEha2VlcEFycmF5SW5kZXg7XG5cbiAgICBpZiAoIGlzT2JqZWN0KG9iamVjdCkgKSB7XG4gICAgICAgIGZvciAoIGtleSBpbiBvYmplY3QgKSB7XG4gICAgICAgICAgICBpZiAoIGhhc093bi5jYWxsKG9iamVjdCwga2V5KSApIHtcbiAgICAgICAgICAgICAgICBlbmNvZGVLZXkoa2V5LCBvYmplY3Rba2V5XSwga2V5VmFsdWVBcnJheSwga2VlcEFycmF5SW5kZXgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGtleVZhbHVlQXJyYXkuam9pbignJicpO1xufTtcblxuXG4vKipcbiAqIEVuY29kZSB0aGUgc3BlY2VpZmVkIGtleSBpbiB0aGUgb2JqZWN0XG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IGtleSBUaGUga2V5IG5hbWVcbiAqIEBwYXJhbSB7YW55fSBkYXRhIFRoZSBkYXRhIG9mIHRoZSBrZXlcbiAqIEBwYXJhbSB7c3RyaW5nW119IGtleVZhbHVlQXJyYXkgVGhlIGFycmF5IHRvIHN0b3JlIHRoZSBrZXkgdmFsdWUgc3RyaW5nXG4gKiBAcGFyYW0ge2Jvb2xlYW59IGtlZXBBcnJheUluZGV4IFdoZXRoZXIgdG8ga2VlcCBhcnJheSBpbmRleFxuICovXG52YXIgZW5jb2RlS2V5ID0gZnVuY3Rpb24gKGtleSwgZGF0YSwga2V5VmFsdWVBcnJheSwga2VlcEFycmF5SW5kZXgpIHtcbiAgICB2YXIgcHJvcDtcbiAgICB2YXIgaW5kZXg7XG4gICAgdmFyIGxlbmd0aDtcbiAgICB2YXIgdmFsdWU7XG4gICAgdmFyIHN1YktleTtcblxuICAgIGlmICggaXNPYmplY3QoZGF0YSkgKSB7XG4gICAgICAgIGZvciAoIHByb3AgaW4gZGF0YSApIHtcbiAgICAgICAgICAgIGlmICggaGFzT3duLmNhbGwoZGF0YSwgcHJvcCkgKSB7XG4gICAgICAgICAgICAgICAgdmFsdWUgPSBkYXRhW3Byb3BdO1xuICAgICAgICAgICAgICAgIHN1YktleSA9IGtleSArICdbJyArIHByb3AgKyAnXSc7XG4gICAgICAgICAgICAgICAgZW5jb2RlS2V5KHN1YktleSwgdmFsdWUsIGtleVZhbHVlQXJyYXksIGtlZXBBcnJheUluZGV4KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAoIGlzQXJyYXkoZGF0YSkgKSB7XG4gICAgICAgIGluZGV4ID0gMDtcbiAgICAgICAgbGVuZ3RoID0gZGF0YS5sZW5ndGg7XG5cbiAgICAgICAgd2hpbGUgKGluZGV4IDwgbGVuZ3RoKSB7XG4gICAgICAgICAgICB2YWx1ZSA9IGRhdGFbaW5kZXhdO1xuXG4gICAgICAgICAgICBpZiAoIGtlZXBBcnJheUluZGV4IHx8IGlzQXJyYXkodmFsdWUpIHx8IGlzT2JqZWN0KHZhbHVlKSApIHtcbiAgICAgICAgICAgICAgICBzdWJLZXkgPSBrZXkgKyAnWycgKyBpbmRleCArICddJztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc3ViS2V5ID0ga2V5ICsgJ1tdJztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZW5jb2RlS2V5KHN1YktleSwgdmFsdWUsIGtleVZhbHVlQXJyYXksIGtlZXBBcnJheUluZGV4KTtcblxuICAgICAgICAgICAgaW5kZXggKz0gMTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIGtleSA9IGVuY29kZVVSSUNvbXBvbmVudChrZXkpO1xuICAgICAgICAvLyBpZiBkYXRhIGlzIG51bGwsIG5vIGA9YCBpcyBhcHBlbmRlZFxuICAgICAgICBpZiAoZGF0YSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgdmFsdWUgPSBrZXk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBpZiBkYXRhIGlzIHVuZGVmaW5lZCwgdHJlYXQgaXQgYXMgZW1wdHkgc3RyaW5nXG4gICAgICAgICAgICBpZiAoZGF0YSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgZGF0YSA9ICcnO1xuICAgICAgICAgICAgLy8gbWFrZSBzdXJlIHRoYXQgZGF0YSBpcyBzdHJpbmdcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGRhdGEgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgZGF0YSA9ICcnICsgZGF0YTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhbHVlID0ga2V5ICsgJz0nICsgZW5jb2RlVVJJQ29tcG9uZW50KGRhdGEpO1xuICAgICAgICB9XG5cbiAgICAgICAga2V5VmFsdWVBcnJheS5wdXNoKHZhbHVlKTtcbiAgICB9XG59O1xuXG5leHBvcnRzLmVuY29kZSA9IGVuY29kZTtcbiIsInZhciBlbmNvZGUgPSByZXF1aXJlKDQyKS5lbmNvZGU7XG52YXIgZGVjb2RlID0gcmVxdWlyZSg0MSkuZGVjb2RlO1xuXG5leHBvcnRzLmVuY29kZSA9IGVuY29kZTtcbmV4cG9ydHMuZGVjb2RlID0gZGVjb2RlO1xuZXhwb3J0cy52ZXJzaW9uID0gJzEuMS4yJztcbiIsInZhciB0b1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG5cbi8qKlxuICogQ2hlY2sgd2hldGhlciB0aGUgdmFyaWFibGUgaXMgYW4gYXJyYXlcbiAqXG4gKiBAcGFyYW0ge2FueX0gaXQgVGhlIHZhcmlhYmxlIHRvIGNoZWNrXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgaXQgaXMgYW4gYXJyYXlcbiAqL1xudmFyIGlzQXJyYXkgPSBmdW5jdGlvbiAoaXQpIHtcbiAgICByZXR1cm4gJ1tvYmplY3QgQXJyYXldJyA9PT0gdG9TdHJpbmcuY2FsbChpdCk7XG59O1xuXG4vKipcbiAqIENoZWNrIHdoZXRoZXIgdGhlIHZhcmlhYmxlIGlzIGFuIG9iamVjdFxuICpcbiAqIEBwYXJhbSB7YW55fSBpdCBUaGUgdmFyaWFibGUgdG8gY2hlY2tcbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBpdCBpcyBhbiBvYmplY3RcbiAqL1xudmFyIGlzT2JqZWN0ID0gZnVuY3Rpb24gKGl0KSB7XG4gICAgcmV0dXJuICdbb2JqZWN0IE9iamVjdF0nID09PSB0b1N0cmluZy5jYWxsKGl0KTtcbn07XG5cbmV4cG9ydHMuaXNBcnJheSA9IGlzQXJyYXk7XG5leHBvcnRzLmlzT2JqZWN0ID0gaXNPYmplY3Q7XG4iXX0=
