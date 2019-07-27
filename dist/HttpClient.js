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
 * @property {Object.<string, ResponseMixinFunction>} [httpResponseMixin] The object that contains the http response
 * mixins.
 *
 * @property {Object.<string, ResponseMixinFunction>} [jsonpResponseMixin] The object that contains the jsonp response
 * mixins.
 *
 * @property {Object.<string, ResponseErrorMixinFunction>} [httpResponseErrorMixin] The object that contains the http
 * response error mixins.
 *
 * @property {Object.<string, ResponseErrorMixinFunction>} [jsonpResponseErrorMixin] The object that contains the jsonp
 * response error mixins.
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
 * @callback ResponseMixinFunction
 */

/**
 * The function to parse the response error. This function will be mounted on the response error instance, which made it
 * a method of the `ResponseError` instance. The parameters and the return value is up on you.
 *
 * @callback ResponseErrorMixinFunction
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
var addCustomMixin = require(22);

/**
 * The HttpResponse class.
 *
 * @class
 * @param {HttpRequest} request The http request.
 */
function HttpResponse(request) {
    Response.call(this, request);
    addCustomMixin(this, request.options, 'httpResponseMixin');
}

inherits(HttpResponse, Response);

module.exports = HttpResponse;

},{"10":10,"22":22,"32":32}],5:[function(require,module,exports){
var ResponseError = require(11);
var inherits = require(32);
var addCustomMixin = require(22);

/**
 * @class
 * @param {string} code The error code.
 * @param {HttpRequest} request The http request.
 */
function HttpResponseError(code, request) {
    ResponseError.call(this, code, request);
    addCustomMixin(this, request.options, 'httpResponseErrorMixin');
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
var addCustomMixin = require(22);

/**
 * The JSONPResponse class.
 *
 * @class
 * @param {JSONRequest} request The http request.
 */
function JSONPResponse(request) {
    Response.call(this, request);
    addCustomMixin(this, request.options, 'jsonpResponseMixin');
}

inherits(JSONPResponse, Response);

module.exports = JSONPResponse;

},{"10":10,"22":22,"32":32}],8:[function(require,module,exports){
var ResponseError = require(11);
var inherits = require(32);
var addCustomMixin = require(22);

/**
 * @class
 * @param {string} code The error code.
 * @param {JSONPRequest} request The JSONP request.
 */
function JSONPResponseError(code, request) {
    ResponseError.call(this, code, request);
    addCustomMixin(this, request.options, 'jsonpResponseErrorMixin');
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
 * The function to add custom mixins to the instance of `Response` or `ResponseError`.
 *
 * @param {Response|ResponseError} target The target to add the custome mixins.
 * @param {RequestOptions} options The request options.
 * @param {string} optionName The option name the mixins container.
 */
function addCustomMixin(target, options, optionName) {
    var mixins = options[optionName];
    var name;
    var mixin;

    if (isPlainObject(mixins)) {
        for (name in mixins) {
            if (hasOwn.call(mixins, name)) {
                mixin = mixins[name];
                if (isFunction(mixin)) {
                    if (name in target) {
                        throw new Error('mixin name conflict "' + name + '"');
                    }
                    target[name] = mixin;
                }
            }
        }
    }
}

module.exports = addCustomMixin;

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

    // make sure that url is a string.
    url = '' + url;

    // If the url is not absolute url and the baseURL is defined,
    // prepend the baseURL to the url.
    if (!isAbsoluteURL(url)) {
        if (baseURL === null || baseURL === undefined) {
            baseURL = '';
        }
        url = baseURL + url;
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
        baseURL: '',
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
        httpResponseMixin: {
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
        jsonpResponseMixin: {
            json: function () {
                return this.request.responseJSON;
            }
        },
        httpResponseErrorMixin: null,
        jsonpResponseErrorMixin: null,
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
    // Treat null (null == undefined) as empty string.
    var templ = template == null ? '' : (template + '');
    var model = data || {};
    var opts = options || {};
    var start = opts.start || '{';
    var end = opts.end || '}';
    var encode = opts.encode || encodeURIComponent;
    var result = parse(templ, start, end, function (expr) {
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

    var render = compile(result, encode);

    try {
        return render(model);
    } catch (e) {
        throw new Error('Compile Error:\n\n' + template + '\n\n' + e.message);
    }
}

/**
 * Compile the result of `parse` to a function.
 *
 * @param {Object.<string, *>[]} result The abstract syntax tree.
 * @param {(str: string) => string} encode The function to encode the string.
 * @returns {(model: Object.<string, *>) => string} Returns a function that compile data to string.
 */
function compile(result, encode) {
    var fn;
    var line;
    var lines = [];
    var i = 0;
    var l = result.length;

    lines.push('var __o=[]');
    lines.push('with(__s){');

    for ( ; i < l; ++i) {
        line = result[i];

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
 * The function to parse the template string.
 *
 * @param {string} template The template string to parse.
 * @param {string} openingTag The opening tag, for example `{{`.
 * @param {string} closingTag The closing tag, for example `}}`.
 * @param {(expr: string) => Object.<string, *>} handleExpr The function to handle each expression.
 * @returns {Object.<string, *>[]} Returns the parsed result.
 */
function parse(template, openingTag, closingTag, handleExpr) {
    var res;
    var templ = template;
    var regOpeningTag = createRegExp(openingTag);
    var regClosingTag = createRegExp(closingTag);
    var ERR_UNEXPECTED_END = 'Unexpected end';
    var type = T_STR;
    var strCache = [];
    var expCache = [];
    var output = [];

    /**
     * Create a `RegExp` for the given tag.
     *
     * @param {string} tag The tag to create a `RegExp`.
     * @returns {RegExp} Returns an instance of `RegExp`.
     */
    function createRegExp(tag) {
        var regChars = /[\\|{}()[\].*+?^$]/g;
        var escapedTag = tag.replace(regChars, function (char) {
            return '\\' + char;
        });
        return new RegExp('(\\\\*)' + escapedTag);
    }

    /**
     * Flush the text in `strCache` into `output` and reset `strCache`.
     */
    function flushStr() {
        output.push({
            type: T_STR,
            text: strCache.join('')
        });
        strCache = [];
    }

    /**
     * Flush the text in `expCache` into `output` and reset `expCache`.
     */
    function flushExp() {
        output.push(handleExpr(expCache.join('')));
        expCache = [];
    }

    /**
     * Check whether the tag is escaped. If it is, put is to the cache.
     *
     * @param {Object.<string, *>} res The result of `RegExp#exec`.
     * @param {string} tag The tag to escape.
     * @param {string[]} cache The array to save escaped text.
     * @returns {boolean} Returns `true` on it is NOT escaped.
     */
    function esc(res, tag, cache) {
        var slashes = res[1] || '';
        var count = slashes.length;

        if (count % 2 === 0) {
            if (count) {
                cache.push(slashes.substr(count / 2));
            }
            return true;
        } else {
            if (count > 1) {
                cache.push(slashes.substr((count + 1) / 2));
            }
            cache.push(tag);
            return false;
        }
    }

    while (templ.length) {
        if (type === T_STR) {
            res = regOpeningTag.exec(templ);
            if (res) {
                strCache.push(templ.substr(0, res.index));
                templ = templ.substr(res.index + res[0].length);
                if (esc(res, openingTag, strCache)) {
                    flushStr();
                    type = T_EXP;
                    if (!templ) {
                        throw new Error(ERR_UNEXPECTED_END);
                    }
                }
            } else {
                strCache.push(templ);
                flushStr();
                templ = '';
            }
        } else { // if (type === T_EXP)
            res = regClosingTag.exec(templ);
            if (res) {
                expCache.push(templ.substr(0, res.index));
                templ = templ.substr(res.index + res[0].length);
                if (esc(res, closingTag, expCache)) {
                    flushExp();
                    type = T_STR;
                }
            } else {
                throw new Error(ERR_UNEXPECTED_END);
            }
        }
    }

    return output;
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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9fYnJvd3Nlci1wYWNrQDYuMS4wQGJyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsImxpYi9jbGFzcy9DYW5jZWxDb250cm9sbGVyLmpzIiwibGliL2NsYXNzL0h0dHBDbGllbnQuanMiLCJsaWIvY2xhc3MvSHR0cFJlcXVlc3QuanMiLCJsaWIvY2xhc3MvSHR0cFJlc3BvbnNlLmpzIiwibGliL2NsYXNzL0h0dHBSZXNwb25zZUVycm9yLmpzIiwibGliL2NsYXNzL0pTT05QUmVxdWVzdC5qcyIsImxpYi9jbGFzcy9KU09OUFJlc3BvbnNlLmpzIiwibGliL2NsYXNzL0pTT05QUmVzcG9uc2VFcnJvci5qcyIsImxpYi9jbGFzcy9SZXF1ZXN0LmpzIiwibGliL2NsYXNzL1Jlc3BvbnNlLmpzIiwibGliL2NsYXNzL1Jlc3BvbnNlRXJyb3IuanMiLCJsaWIvaHR0cC9hZGRFdmVudExpc3RlbmVycy5qcyIsImxpYi9odHRwL2FkZFRpbWVvdXRMaXN0ZW5lci5qcyIsImxpYi9odHRwL2NhbGxYaHJIb29rLmpzIiwibGliL2h0dHAvaGFuZGxlSGVhZGVycy5qcyIsImxpYi9odHRwL2hhbmRsZVJlcXVlc3RCb2R5LmpzIiwibGliL2h0dHAvaGFuZGxlWGhyUHJvcHMuanMiLCJsaWIvanNvbnAvYWRkRXZlbnRMaXN0ZW5lcnMuanMiLCJsaWIvanNvbnAvYnVpbGRDYWxsYmFja05hbWUuanMiLCJsaWIvanNvbnAvYnVpbGRTY3JpcHRTcmMuanMiLCJsaWIvanNvbnAvaGFuZGxlU2NyaXB0Q29ycy5qcyIsImxpYi9zaGFyZWQvYWRkQ3VzdG9tTWl4aW4uanMiLCJsaWIvc2hhcmVkL2J1aWxkVVJMLmpzIiwibGliL3NoYXJlZC9jYWxsUmVxdWVzdENyZWF0ZWRDYWxsYmFjay5qcyIsImxpYi9zaGFyZWQvY29uc3RhbnRzLmpzIiwibGliL3NoYXJlZC9jcmVhdGVDYW5jZWxDb250cm9sbGVyLmpzIiwibGliL3NoYXJlZC9jcmVhdGVEZWZhdWx0T3B0aW9ucy5qcyIsImxpYi9zaGFyZWQvZGVmaW5lRXhwb3J0cy5qcyIsImxpYi9zaGFyZWQvZmlyZUNhbGxiYWNrcy5qcyIsImxpYi9zaGFyZWQvaGFuZGxlT3B0aW9ucy5qcyIsImxpYi9zaGFyZWQvaGFzT3duLmpzIiwibGliL3NoYXJlZC9pbmhlcml0cy5qcyIsImxpYi9zaGFyZWQvbm9vcC5qcyIsImxpYi9zaGFyZWQvdGVtcGxhdGUuanMiLCJsaWIvc2hhcmVkL3V1aWQuanMiLCJub2RlX21vZHVsZXMvX3gtY29tbW9uLXV0aWxzQDEuNC4xQHgtY29tbW9uLXV0aWxzL2lzQWJzb2x1dGVVUkwuanMiLCJub2RlX21vZHVsZXMvX3gtY29tbW9uLXV0aWxzQDEuNC4xQHgtY29tbW9uLXV0aWxzL2lzQXJyYXkuanMiLCJub2RlX21vZHVsZXMvX3gtY29tbW9uLXV0aWxzQDEuNC4xQHgtY29tbW9uLXV0aWxzL2lzRnVuY3Rpb24uanMiLCJub2RlX21vZHVsZXMvX3gtY29tbW9uLXV0aWxzQDEuNC4xQHgtY29tbW9uLXV0aWxzL2lzUGxhaW5PYmplY3QuanMiLCJub2RlX21vZHVsZXMvX3gtY29tbW9uLXV0aWxzQDEuNC4xQHgtY29tbW9uLXV0aWxzL21lcmdlLmpzIiwibm9kZV9tb2R1bGVzL194LXF1ZXJ5LXN0cmluZ0AxLjEuMkB4LXF1ZXJ5LXN0cmluZy9saWIvZGVjb2RlLmpzIiwibm9kZV9tb2R1bGVzL194LXF1ZXJ5LXN0cmluZ0AxLjEuMkB4LXF1ZXJ5LXN0cmluZy9saWIvZW5jb2RlLmpzIiwibm9kZV9tb2R1bGVzL194LXF1ZXJ5LXN0cmluZ0AxLjEuMkB4LXF1ZXJ5LXN0cmluZy9saWIvcXVlcnlzdHJpbmcuanMiLCJub2RlX21vZHVsZXMvX3gtcXVlcnktc3RyaW5nQDEuMS4yQHgtcXVlcnktc3RyaW5nL2xpYi91dGlsLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdnQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDYkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNmQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDYkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCJ2YXIgaXNGdW5jdGlvbiA9IHJlcXVpcmUoMzgpO1xuXG4vKipcbiAqIENhbmNlbCBjb250cm9sbGVyIGlzIHVzZWQgdG8gY2FuY2VsIGFjdGlvbnMuIE9uZSBjb250cm9sbGVyIGNhbiBiaW5kIGFueSBudW1iZXIgb2YgYWN0aW9ucy5cbiAqXG4gKiBAY2xhc3NcbiAqL1xuZnVuY3Rpb24gQ2FuY2VsQ29udHJvbGxlcigpIHtcbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn0gV2hldGhlciB0aGUgY29udHJvbGxlciBpcyBjYW5jZWxsZWQuXG4gICAgICovXG4gICAgdGhpcy5jYW5jZWxsZWQgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtGdW5jdGlvbltdfSBUaGUgY2FsbGJhY2tzIHRvIGNhbGwgb24gY2FuY2VsLlxuICAgICAqL1xuICAgIHRoaXMuY2FsbGJhY2tzID0gW107XG59XG5cbi8qKlxuICogQ2FuY2VsIHRoZSBhY3Rpb25zIHRoYXQgYmluZCB3aXRoIHRoaXMgY2FuY2VsIGNvbnRyb2xsZXIuXG4gKi9cbkNhbmNlbENvbnRyb2xsZXIucHJvdG90eXBlLmNhbmNlbCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgY2FsbGJhY2tzID0gdGhpcy5jYWxsYmFja3M7XG4gICAgdmFyIGkgPSAwO1xuICAgIHZhciBsID0gY2FsbGJhY2tzLmxlbmd0aDtcblxuICAgIGlmICh0aGlzLmNhbmNlbGxlZCA9PT0gZmFsc2UpIHtcbiAgICAgICAgdGhpcy5jYW5jZWxsZWQgPSB0cnVlO1xuXG4gICAgICAgIGZvciAoIDsgaSA8IGw7IGkgKz0gMSkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjYWxsYmFja3NbaV0oKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAvLyBUaHJvdyB0aGUgZXJyb3IgbGF0ZXIgZm9yIGRlYnVnaW5nLlxuICAgICAgICAgICAgICAgIChmdW5jdGlvbiAoZSkge1xuICAgICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IGU7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pKGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufTtcblxuLyoqXG4gKiBDaGVjayB3aGV0aGVyIHRoZSBjb250cm9sbGVyIGlzIGNhbmNlbGxlZC5cbiAqXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIGNvbnRyb2xsZXIgaXMgY2FuY2VsbGVkLCBvdGhlcndpc2UgYGZhbHNlYCBpcyByZXR1cm5lZC5cbiAqL1xuQ2FuY2VsQ29udHJvbGxlci5wcm90b3R5cGUuaXNDYW5jZWxsZWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY2FuY2VsbGVkO1xufTtcblxuLyoqXG4gKiBSZWdpc3RlciBhIGNhbGxiYWNrLCB3aGljaCB3aWxsIGJlIGNhbGxlZCB3aGVuIHRoZSBgY2FuY2VsKClgIG1ldGhvZCBpcyBjYWxsZWQuXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgVGhlIGNhbGxiYWNrIGZ1bmN0aW9uIHRvIGNhbGwgb24gY2FuY2VsLlxuICovXG5DYW5jZWxDb250cm9sbGVyLnByb3RvdHlwZS5yZWdpc3RlckNhbmNlbENhbGxiYWNrID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgaWYgKGlzRnVuY3Rpb24oY2FsbGJhY2spKSB7XG4gICAgICAgIHRoaXMuY2FsbGJhY2tzLnB1c2goY2FsbGJhY2spO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQ2FuY2VsQ29udHJvbGxlcjtcbiIsInZhciBRUyA9IHJlcXVpcmUoNDMpO1xudmFyIG1lcmdlID0gcmVxdWlyZSg0MCk7XG52YXIgaXNGdW5jdGlvbiA9IHJlcXVpcmUoMzgpO1xudmFyIGlzUGxhaW5PYmplY3QgPSByZXF1aXJlKDM5KTtcbnZhciBpc0Fic29sdXRlVVJMID0gcmVxdWlyZSgzNik7XG52YXIgdXVpZCA9IHJlcXVpcmUoMzUpO1xudmFyIG5vb3AgPSByZXF1aXJlKDMzKTtcbnZhciB0ZW1wbGF0ZSA9IHJlcXVpcmUoMzQpO1xudmFyIGluaGVyaXRzID0gcmVxdWlyZSgzMik7XG52YXIgY29uc3RhbnRzID0gcmVxdWlyZSgyNSk7XG52YXIgZGVmaW5lRXhwb3J0cyA9IHJlcXVpcmUoMjgpO1xudmFyIGNyZWF0ZURlZmF1bHRPcHRpb25zID0gcmVxdWlyZSgyNyk7XG52YXIgY3JlYXRlQ2FuY2VsQ29udHJvbGxlciA9IHJlcXVpcmUoMjYpO1xudmFyIFJlcXVlc3QgPSByZXF1aXJlKDkpO1xudmFyIEh0dHBSZXF1ZXN0ID0gcmVxdWlyZSgzKTtcbnZhciBKU09OUFJlcXVlc3QgPSByZXF1aXJlKDYpO1xudmFyIFJlc3BvbnNlID0gcmVxdWlyZSgxMCk7XG52YXIgSHR0cFJlc3BvbnNlID0gcmVxdWlyZSg0KTtcbnZhciBKU09OUFJlc3BvbnNlID0gcmVxdWlyZSg3KTtcbnZhciBSZXNwb25zZUVycm9yID0gcmVxdWlyZSgxMSk7XG52YXIgSHR0cFJlc3BvbnNlRXJyb3IgPSByZXF1aXJlKDUpO1xudmFyIEpTT05QUmVzcG9uc2VFcnJvciA9IHJlcXVpcmUoOCk7XG52YXIgQ2FuY2VsQ29udHJvbGxlciA9IHJlcXVpcmUoMSk7XG52YXIgdmVyc2lvbiA9ICcwLjAuMS1hbHBoYS41JztcblxuLyoqXG4gKiBAY2xhc3NcbiAqXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBbZGVmYXVsdHNdIFRoZSBkZWZhdWx0IG9wdGlvbnMgdG8gdXNlIHdoZW4gc2VuZGluZyByZXF1ZXN0cyB3aXRoIHRoZSBjcmVhdGVkIGh0dHAgY2xpZW50LlxuICogVGhpcyBkZWZhdWx0IG9wdGlvbnMgd2lsbCBiZSBtZXJnZWQgaW50byB0aGUgaW50ZXJuYWwgZGVmYXVsdCBvcHRpb25zIHRoYXQgYGNyZWF0ZURlZmF1bHRPcHRpb25zKClgIHJldHVybnMuXG4gKlxuICogQHBhcmFtIHtIYW5kbGVPcHRpb25zRnVuY3Rpb259IFtoYW5kbGVEZWZhdWx0c10gVGhlIGhhbmRsZXIgZnVuY3Rpb24gdG8gcHJvY2VzcyB0aGUgbWVyZ2VkIGRlZmF1bHQgb3B0aW9ucy4gVGhlXG4gKiBtZXJnZWQgZGVmYXVsdCBvcHRpb25zIHdpbGwgYmUgcGFzc2VkIGludG8gdGhlIGZ1bmN0aW9uIGFzIHRoZSBmaXJzdCBhcmd1bWVudC4gWW91IGNhbiBtYWtlIGNoYW5nZXMgdG8gaXQgYXMgeW91XG4gKiB3YW50LiBUaGlzIGZ1bmN0aW9uIG11c3QgcmV0dXJuIHN5bmNocm9ub3VzbHkuIFRoZSByZXR1cm4gdmFsdWUgb2YgdGhpcyBmdW5jdGlvbiBpcyBpZ25vcmVkLlxuICpcbiAqIEBwYXJhbSB7SGFuZGxlT3B0aW9uc0Z1bmN0aW9ufSBbaGFuZGxlUmVxdWVzdE9wdGlvbnNdIFRoZSBoYW5kbGVyIGZ1bmN0aW9uIHRvIHByb2Nlc3MgZWFjaCBtZXJnZWQgcmVxdWVzdCBvcHRpb25zLlxuICogRXZlcnkgb3B0aW9ucyB0aGF0IHBhc3NlZCBpbnRvIGBzZW5kYCwgYGZldGNoYCwgYGdldEpTT05QYCwgYGZldGNoSlNPTlBgIHdpbGwgYmUgcHJvY2Vzc2VkIGJ5IHRoaXMgaGFuZGxlciBmdW5jdGlvbi5cbiAqL1xuZnVuY3Rpb24gSHR0cENsaWVudChkZWZhdWx0cywgaGFuZGxlRGVmYXVsdHMsIGhhbmRsZVJlcXVlc3RPcHRpb25zKSB7XG4gICAgdmFyIGRlZmF1bHRPcHRpb25zID0gY3JlYXRlRGVmYXVsdE9wdGlvbnMoKTtcblxuICAgIGlmIChpc1BsYWluT2JqZWN0KGRlZmF1bHRzKSkge1xuICAgICAgICBtZXJnZShkZWZhdWx0T3B0aW9ucywgZGVmYXVsdHMpO1xuICAgIH1cblxuICAgIGlmIChpc0Z1bmN0aW9uKGhhbmRsZURlZmF1bHRzKSkge1xuICAgICAgICBoYW5kbGVEZWZhdWx0cyhkZWZhdWx0T3B0aW9ucyk7XG4gICAgICAgIC8vIERlZXAgY29weSB0aGUgY2hhZ25lZCBvcHRpb25zXG4gICAgICAgIGRlZmF1bHRPcHRpb25zID0gbWVyZ2Uoe30sIGRlZmF1bHRPcHRpb25zKTtcbiAgICB9XG5cbiAgICBpZiAoIWlzRnVuY3Rpb24oaGFuZGxlUmVxdWVzdE9wdGlvbnMpKSB7XG4gICAgICAgIGhhbmRsZVJlcXVlc3RPcHRpb25zID0gbm9vcDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgYSBjb3B5IG9mIHRoZSBkZWZhdWx0IHJlcXVlc3Qgb3B0aW9ucy4gVGhpcyBmdW5jdGlvbiBpcyBOT1QgYXZhaWxhYmxlIG9uIHRoZSBwcm90b3R5cGUgb2YgYEh0dHBDbGllbnRgLlxuICAgICAqXG4gICAgICogQHJldHVybnMge1JlcXVlc3RPcHRpb25zfVxuICAgICAqL1xuICAgIHRoaXMuY29weU9wdGlvbnMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBtZXJnZSh7fSwgZGVmYXVsdE9wdGlvbnMpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBNZXJnZSB0aGUgcmVxdWVzdCBvcHRpb25zIHdpdGggdGhlIGRlZmF1bHQgcmVxdWVzdCBvcHRpb25zLiBUaGlzIGZ1bmN0aW9uIGlzIE5PVCBhdmFpbGFibGUgb24gdGhlIHByb3RvdHlwZSBvZlxuICAgICAqIGBIdHRwQ2xpZW50YCBhbmQgd2lsbCBjYWxsIGBoYW5kbGVSZXF1ZXN0T3B0aW9uc2AgdG8gaGFuZGxlIHRoZSBtZXJnZWQgcmVxdWVzdCBvcHRpb25zLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zIHRvIG1lcmdlLlxuICAgICAqIEByZXR1cm5zIHtSZXF1ZXN0T3B0aW9uc30gUmV0dXJucyB0aGUgbWVyZ2VkIHJlcXVlc3Qgb3B0aW9ucy5cbiAgICAgKi9cbiAgICB0aGlzLm1lcmdlT3B0aW9ucyA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIHZhciByZXF1ZXN0T3B0aW9ucyA9IG1lcmdlKHt9LCBkZWZhdWx0T3B0aW9ucywgb3B0aW9ucyk7XG5cbiAgICAgICAgaGFuZGxlUmVxdWVzdE9wdGlvbnMocmVxdWVzdE9wdGlvbnMpO1xuXG4gICAgICAgIHJldHVybiByZXF1ZXN0T3B0aW9ucztcbiAgICB9O1xufVxuXG4vKipcbiAqIFNlbmQgYW4gaHR0cCByZXF1ZXN0LlxuICpcbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucyB0byB1c2UsIHdoaWNoIHdpbGwgYmUgbWVyZ2VkIGludG8gYSBjb3B5IG9mIHRoZSBkZWZhdWx0IG9wdGlvbnMuXG4gKiBAcGFyYW0ge1JlcXVlc3RTdWNjZXNzQ2FsbGJhY2t9IG9uc3VjY2VzcyBUaGUgY2FsbGJhY2sgdG8gY2FsbCBvbiBzdWNjZXNzLlxuICogQHBhcmFtIHtSZXF1ZXN0RXJyb3JDYWxsYmFja30gb25lcnJvciBUaGUgY2FsbGJhY2sgdG8gY2FsbCBvbiBlcnJvci5cbiAqIEByZXR1cm5zIHtIdHRwUmVxdWVzdH0gUmV0dXJucyBhbiBpbnN0YW5jZSBvZiBgSHR0cFJlcXVlc3RgLlxuICovXG5IdHRwQ2xpZW50LnByb3RvdHlwZS5zZW5kID0gZnVuY3Rpb24gKG9wdGlvbnMsIG9uc3VjY2Vzcywgb25lcnJvcikge1xuICAgIHZhciByZXF1ZXN0T3B0aW9ucyA9IHRoaXMubWVyZ2VPcHRpb25zKG9wdGlvbnMpO1xuXG4gICAgcmVxdWVzdE9wdGlvbnMucmVxdWVzdEZ1bmN0aW9uTmFtZSA9ICdzZW5kJztcbiAgICByZXF1ZXN0T3B0aW9ucy5jb250cm9sbGVyID0gbnVsbDtcblxuICAgIHJldHVybiBuZXcgSHR0cFJlcXVlc3QocmVxdWVzdE9wdGlvbnMsIG9uc3VjY2Vzcywgb25lcnJvcik7XG59O1xuXG4vKipcbiAqIFNlbmQgYW4gaHR0cCByZXF1ZXN0IGFuZCByZXR1cm4gYSBwcm9taXNlLlxuICpcbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucyB0byB1c2UsIHdoaWNoIHdpbGwgYmUgbWVyZ2VkIGludG8gYSBjb3B5IG9mIHRoZSBkZWZhdWx0IG9wdGlvbnMuXG4gKiBAcmV0dXJucyB7UHJvbWlzZX0gUmV0dXJucyBhbiBpbnN0YW5jZSBvZiBgUHJvbWlzZWAuXG4gKi9cbkh0dHBDbGllbnQucHJvdG90eXBlLmZldGNoID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICB2YXIgcmVxdWVzdE9wdGlvbnMgPSB0aGlzLm1lcmdlT3B0aW9ucyhvcHRpb25zKTtcbiAgICB2YXIgY29udHJvbGxlciA9IHJlcXVlc3RPcHRpb25zLmNvbnRyb2xsZXI7XG5cbiAgICByZXF1ZXN0T3B0aW9ucy5yZXF1ZXN0RnVuY3Rpb25OYW1lID0gJ2ZldGNoJztcblxuICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgIHZhciByZXF1ZXN0ID0gbmV3IEh0dHBSZXF1ZXN0KHJlcXVlc3RPcHRpb25zLCBmdW5jdGlvbiAocmVzcG9uc2UpIHtcbiAgICAgICAgICAgIGlmIChjb250cm9sbGVyKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFjb250cm9sbGVyLmlzQ2FuY2VsbGVkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShyZXNwb25zZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHJlc3BvbnNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgcmVqZWN0KTtcblxuICAgICAgICBpZiAoY29udHJvbGxlcikge1xuICAgICAgICAgICAgLy8gVHJpZ2dlciB0aGUgYEVSUl9DQU5DRUxMRURgIGVycm9yLlxuICAgICAgICAgICAgaWYgKGNvbnRyb2xsZXIuaXNDYW5jZWxsZWQoKSkge1xuICAgICAgICAgICAgICAgIHJlcXVlc3QuY2FuY2VsKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnRyb2xsZXIucmVnaXN0ZXJDYW5jZWxDYWxsYmFjayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlcXVlc3QuY2FuY2VsKCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbn07XG5cbi8qKlxuICogU2VuZCBhIGpzb25wIHJlcXVlc3QuXG4gKlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zIHRvIHVzZSwgd2hpY2ggd2lsbCBiZSBtZXJnZWQgaW50byBhIGNvcHkgb2YgdGhlIGRlZmF1bHQgb3B0aW9ucy5cbiAqIEBwYXJhbSB7UmVxdWVzdFN1Y2Nlc3NDYWxsYmFja30gb25zdWNjZXNzIFRoZSBjYWxsYmFjayB0byBjYWxsIG9uIHN1Y2Nlc3MuXG4gKiBAcGFyYW0ge1JlcXVlc3RFcnJvckNhbGxiYWNrfSBvbmVycm9yIFRoZSBjYWxsYmFjayB0byBjYWxsIG9uIGVycm9yLlxuICogQHJldHVybnMge0pTT05QUmVxdWVzdH0gUmV0dXJucyBhbiBpbnN0YW5jZSBvZiBgSlNPTlBSZXF1ZXN0YC5cbiAqL1xuSHR0cENsaWVudC5wcm90b3R5cGUuZ2V0SlNPTlAgPSBmdW5jdGlvbiAob3B0aW9ucywgb25zdWNjZXNzLCBvbmVycm9yKSB7XG4gICAgdmFyIHJlcXVlc3RPcHRpb25zID0gdGhpcy5tZXJnZU9wdGlvbnMob3B0aW9ucyk7XG5cbiAgICByZXF1ZXN0T3B0aW9ucy5yZXF1ZXN0RnVuY3Rpb25OYW1lID0gJ2dldEpTT05QJztcbiAgICByZXF1ZXN0T3B0aW9ucy5jb250cm9sbGVyID0gbnVsbDtcblxuICAgIHJldHVybiBuZXcgSlNPTlBSZXF1ZXN0KHJlcXVlc3RPcHRpb25zLCBvbnN1Y2Nlc3MsIG9uZXJyb3IpO1xufTtcblxuLyoqXG4gKiBTZW5kIGEganNvbnAgcmVxdWVzdCBhbmQgcmV0dXJuIGEgcHJvbWlzZS5cbiAqXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMgdG8gdXNlLCB3aGljaCB3aWxsIGJlIG1lcmdlZCBpbnRvIGEgY29weSBvZiB0aGUgZGVmYXVsdCBvcHRpb25zLlxuICogQHJldHVybnMge1Byb21pc2V9IFJldHVybnMgYW4gaW5zdGFuY2Ugb2YgYFByb21pc2VgLlxuICovXG5IdHRwQ2xpZW50LnByb3RvdHlwZS5mZXRjaEpTT05QID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICB2YXIgcmVxdWVzdE9wdGlvbnMgPSB0aGlzLm1lcmdlT3B0aW9ucyhvcHRpb25zKTtcbiAgICB2YXIgY29udHJvbGxlciA9IHJlcXVlc3RPcHRpb25zLmNvbnRyb2xsZXI7XG5cbiAgICByZXF1ZXN0T3B0aW9ucy5yZXF1ZXN0RnVuY3Rpb25OYW1lID0gJ2ZldGNoSlNPTlAnO1xuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgdmFyIHJlcXVlc3QgPSBuZXcgSlNPTlBSZXF1ZXN0KHJlcXVlc3RPcHRpb25zLCBmdW5jdGlvbiAocmVzcG9uc2UpIHtcbiAgICAgICAgICAgIGlmIChjb250cm9sbGVyKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFjb250cm9sbGVyLmlzQ2FuY2VsbGVkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShyZXNwb25zZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHJlc3BvbnNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgcmVqZWN0KTtcblxuICAgICAgICBpZiAoY29udHJvbGxlcikge1xuICAgICAgICAgICAgLy8gVHJpZ2dlciB0aGUgYEVSUl9DQU5DRUxMRURgIGVycm9yLlxuICAgICAgICAgICAgaWYgKGNvbnRyb2xsZXIuaXNDYW5jZWxsZWQoKSkge1xuICAgICAgICAgICAgICAgIHJlcXVlc3QuY2FuY2VsKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnRyb2xsZXIucmVnaXN0ZXJDYW5jZWxDYWxsYmFjayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlcXVlc3QuY2FuY2VsKCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbn07XG5cbi8qKlxuICogQ3JlYXRlIGEgbmV3IGluc3RhbmNlIG9mIGBDYW5jZWxDb250cm9sbGVyYC5cbiAqXG4gKiBAcmV0dXJucyB7Q2FuY2VsQ29udHJvbGxlcn0gUmV0dXJucyBhbiBuZXcgaW5zdGFuY2Ugb2YgYENhbmNlbENvbnRyb2xsZXJgLlxuICovXG5IdHRwQ2xpZW50LnByb3RvdHlwZS5jcmVhdGVDYW5jZWxDb250cm9sbGVyID0gY3JlYXRlQ2FuY2VsQ29udHJvbGxlcjtcblxuLyoqXG4gKiBDcmVhdGUgYSBuZXcgaW5zdGFuY2Ugb2YgYENhbmNlbENvbnRyb2xsZXJgLlxuICpcbiAqIEByZXR1cm5zIHtDYW5jZWxDb250cm9sbGVyfSBSZXR1cm5zIGFuIG5ldyBpbnN0YW5jZSBvZiBgQ2FuY2VsQ29udHJvbGxlcmAuXG4gKi9cbkh0dHBDbGllbnQuY3JlYXRlQ2FuY2VsQ29udHJvbGxlciA9IGNyZWF0ZUNhbmNlbENvbnRyb2xsZXI7XG5cbi8vIFRoZSB2ZXJzaW9uLlxuSHR0cENsaWVudC52ZXJzaW9uID0gdmVyc2lvbjtcbkh0dHBDbGllbnQucHJvdG90eXBlLnZlcnNpb24gPSB2ZXJzaW9uO1xuXG5kZWZpbmVFeHBvcnRzKEh0dHBDbGllbnQsICdjb25zdGFudHMnLCBtZXJnZSh7fSwgY29uc3RhbnRzKSk7XG5cbmRlZmluZUV4cG9ydHMoSHR0cENsaWVudCwgJ2xpYnMnLCB7XG4gICAgUVM6IFFTXG59KTtcblxuZGVmaW5lRXhwb3J0cyhIdHRwQ2xpZW50LCAnY2xhc3NlcycsIHtcbiAgICBDYW5jZWxDb250cm9sbGVyOiBDYW5jZWxDb250cm9sbGVyLFxuICAgIEh0dHBDbGllbnQ6IEh0dHBDbGllbnQsXG4gICAgSHR0cFJlcXVlc3Q6IEh0dHBSZXF1ZXN0LFxuICAgIEh0dHBSZXNwb25zZTogSHR0cFJlc3BvbnNlLFxuICAgIEh0dHBSZXNwb25zZUVycm9yOiBIdHRwUmVzcG9uc2VFcnJvcixcbiAgICBKU09OUFJlcXVlc3Q6IEpTT05QUmVxdWVzdCxcbiAgICBKU09OUFJlc3BvbnNlOiBKU09OUFJlc3BvbnNlLFxuICAgIEpTT05QUmVzcG9uc2VFcnJvcjogSlNPTlBSZXNwb25zZUVycm9yLFxuICAgIFJlcXVlc3Q6IFJlcXVlc3QsXG4gICAgUmVzcG9uc2U6IFJlc3BvbnNlLFxuICAgIFJlc3BvbnNlRXJyb3I6IFJlc3BvbnNlRXJyb3Jcbn0pO1xuXG5kZWZpbmVFeHBvcnRzKEh0dHBDbGllbnQsICdmdW5jdGlvbnMnLCB7XG4gICAgdGVtcGxhdGU6IHRlbXBsYXRlLFxuICAgIG1lcmdlOiBtZXJnZSxcbiAgICBpc0Fic29sdXRlVVJMOiBpc0Fic29sdXRlVVJMLFxuICAgIGlzRnVuY3Rpb246IGlzRnVuY3Rpb24sXG4gICAgaXNQbGFpbk9iamVjdDogaXNQbGFpbk9iamVjdCxcbiAgICB1dWlkOiB1dWlkLFxuICAgIG5vb3A6IG5vb3AsXG4gICAgaW5oZXJpdHM6IGluaGVyaXRzLFxuICAgIGNyZWF0ZURlZmF1bHRPcHRpb25zOiBjcmVhdGVEZWZhdWx0T3B0aW9uc1xufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gSHR0cENsaWVudDtcblxuLyoqXG4gKiBUaGlzIGNhbGxiYWNrIGlzIHVzZWQgdG8gaGFubGRlIHRoZSBtZXJnZWQgcmVxdWVzdCBvcHRpb25zLiBJdCBtdXN0IHJldHJ1biB0aGUgcmVzdWx0IHN5bmNocm9ub3VzbHkuXG4gKlxuICogQGNhbGxiYWNrIEhhbmRsZU9wdGlvbnNGdW5jdGlvblxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgbWVyZ2VkIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEByZXR1cm5zIHt2b2lkfVxuICovXG5cbi8qKlxuICogVGhlIGNhbGxiYWNrIHRvIGNhbGwgb24gc3VjY2Vzcy5cbiAqXG4gKiBAY2FsbGJhY2sgUmVxdWVzdFN1Y2Nlc3NDYWxsYmFja1xuICogQHBhcmFtIHtIdHRwUmVzcG9uc2V8YW55fSByZXNwb25zZSBUaGUgaHR0cCByZXNwb25zZSBvciB0aGUgcmV0dXJuIHZhbHVlIG9mIGBvcHRpb25zLnRyYW5zZm9ybVJlc3BvbnNlKHJlc3BvbnNlKWAuXG4gKi9cblxuLyoqXG4gKiBUaGUgY2FsbGJhY2sgdG8gY2FsbCBvbiBlcnJvci5cbiAqXG4gKiBAY2FsbGJhY2sgUmVxdWVzdEVycm9yQ2FsbGJhY2tcbiAqIEBwYXJhbSB7SHR0cFJlc3BvbnNlRXJyb3J8YW55fSBlcnJvciBUaGUgaHR0cCByZXNwb25zZSBlcnJvciBvciB0aGUgcmV0dXJuIHZhbHVlIG9mIGBvcHRpb25zLnRyYW5zZm9ybUVycm9yKGVycm9yKWAuXG4gKi9cblxuLyoqXG4gKiBUaGUgZGVmaW5pdG9uIG9mIHRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKlxuICogQHR5cGVkZWYge09iamVjdC48c3RyaW5nLCAqPn0gUmVxdWVzdE9wdGlvbnNcbiAqXG4gKiBAcHJvcGVydHkge3N0cmluZ30gW21ldGhvZF0gVGhlIGh0dHAgcmVxdWVzdCBtZXRob2QuIFRoZSBkZWZhdWx0IG1ldGhvZCBpcyBgR0VUYC5cbiAqXG4gKiBAcHJvcGVydHkge3N0cmluZ30gW2Jhc2VVUkxdIFRoZSByZXF1ZXN0IGJhc2UgdXJsLiBJZiB0aGUgYHVybGAgaXMgcmVsYXRpdmUgdXJsLCBhbmQgdGhlIGBiYXNlVVJMYCBpcyBub3QgYG51bGxgLCB0aGVcbiAqIGBiYXNlVVJMYCB3aWxsIGJlIHByZXBlbmQgdG8gdGhlIGB1cmxgLlxuICpcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSB1cmwgVGhlIHJlcXVlc3QgdXJsIHRoYXQgY2FuIGNvbnRhaW4gYW55IG51bWJlciBvZiBwbGFjZWhvbGRlcnMsIGFuZCB3aWxsIGJlIGNvbXBpbGVkIHdpdGggdGhlXG4gKiBkYXRhIHRoYXQgcGFzc2VkIGluIHdpdGggYG9wdGlvbnMubW9kZWxgLlxuICpcbiAqIEBwcm9wZXJ0eSB7T2JqZWN0LjxzdHJpbmcsICo+fSBbbW9kZWxdIFRoZSBkYXRhIHVzZWQgdG8gY29tcGlsZSB0aGUgcmVxdWVzdCB1cmwuXG4gKlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgKj59IFtxdWVyeV0gVGhlIGRhdGEgdGhhdCB3aWxsIGJlIGNvbXBpbGVkIHRvIHF1ZXJ5IHN0cmluZy5cbiAqXG4gKiBAcHJvcGVydHkge09iamVjdC48c3RyaW5nLCAqPn0gW2JvZHldIFRoZSBvYmplY3QgdGhhdCBjb250YWlucyB0aGUgY29udGVudCB3aGljaCB3aWxsIGJlIHNlbmQgdG8gdGhlIHNlcnZlci4gVGhpc1xuICogb2JqZWN0IGhhcyBvbmx5IG9uZSBwcm9wZXJ0eS4gVGhlIG5hbWUgb2YgdGhlIHByb3BlcnR5IGlzIHRoZSBjb250ZW50IHR5cGUgb2YgdGhlIGNvbnRlbnQsIHdoaWNoIHdpbGwgYmUgdXNlZCB0byBmaW5kXG4gKiBhIHByb2Nlc3NvciBpbiBgb3B0aW9ucy5odHRwUmVxdWVzdEJvZHlQcm9jZXNzb3JgLiBUaGUgcHJvY2Vzc29yIGlzIHVzZWQgdG8gcHJvY2VzcyB0aGUgdmFsdWUgb2YgdGhlIHByb3BlcnR5LiBUaGVcbiAqIHByb2Nlc3NlZCB2YWx1ZSB3aGljaCB0aGUgcHJvY2Vzc29yIHJldHVybnMgd2lsbCBiZSBzZW5kIHRvIHRoZSBzZXJ2ZXIgYXMgdGhlIHJlcXVlc3QgYm9keS5cbiAqXG4gKiBAcHJvcGVydHkge251bWJlcn0gW3RpbWVvdXRdIFRoZSBudW1iZXIgb2YgbWlsbGlzZWNvbmRzIHRoZSByZXF1ZXN0IGNhbiB0YWtlIGJlZm9yZSBpdCBmaW5pc2hlZC4gSWYgdGhlIHRpbWVvdXQgdmFsdWVcbiAqIGlzIGAwYCwgbm8gdGltZXIgd2lsbCBiZSBzZXQuIElmIHRoZSByZXF1ZXN0IGRvZXMgbm90IGZpbnNpaGVkIHdpdGhpbiB0aGUgZ2l2ZW4gdGltZSwgYSB0aW1lb3V0IGVycm9yIHdpbGwgYmUgdGhyb3duLlxuICogVGhlIGRlZmF1bHQgdmFsdWUgaXMgYDBgLlxuICpcbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gW2NvcnNdIFdoZXRoZXIgdG8gc2V0IGB3aXRoQ3JlZGVudGlhbHNgIHByb3BlcnR5IG9mIHRoZSBgWE1MSHR0cFJlcXVlc3RgIHRvIGB0cnVlYC4gVGhlIGRlZmF1bHRcbiAqIHZhbHVlIGlzIGBmYWxzZWAuXG4gKlxuICogQHByb3BlcnR5IHtib29sZWFufSBbbm9DYWNoZV0gV2hldGhlciB0byBkaXNhYmxlIHRoZSBjYWNoZS4gSWYgdGhlIHZhbHVlIGlzIGB0cnVlYCwgdGhlIGhlYWRlcnMgaW5cbiAqIGBvcHRpb25zLm5vQ2FjaGVIZWFkZXJzYCB3aWxsIGJlIHNldC4gVGhlIGRlZmF1bHQgdmFsdWUgaXMgYGZhbHNlYC5cbiAqXG4gKiBAcHJvcGVydHkge09iamVjdC48c3RyaW5nLCAqPn0gW25vQ2FjaGVIZWFkZXJzXSBUaGUgaGVhZGVycyB0byBzZXQgd2hlbiBgb3B0aW9ucy5ub0NhY2hlYCBpcyBzZXQgdG8gYHRydWVgLlxuICpcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbanNvbnBdIFRoZSBxdWVyeSBzdHJpbmcga2V5IHRvIGhvbGQgdGhlIHZhbHVlIG9mIHRoZSBjYWxsYmFjayBuYW1lIHdoZW4gc2VuZGluZyBKU09OUCByZXF1ZXN0LlxuICogVGhlIGRlZmF1bHQgdmFsdWVzIGlzIGBjYWxsYmFja2AuXG4gKlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgKj59IFtzZXR0aW5nc10gVGhlIG9iamVjdCB0byBrZWVwIHRoZSBzZXR0aW5ncyBpbmZvcm1hdGlvbiB0aGF0IHRoZSB1c2VyIHBhc3NlZCBpbi4gVGhlXG4gKiBsaWJyYXJ5IGl0c2VsZiB3aWxsIG5vdCB0b3VjaCB0aGlzIHByb3BlcnR5LiBZb3UgY2FuIHVzZSB0aGlzIHByb3BlcnR5IHRvIGhvbGQgYW55IGluZm9ybWF0aW9uIHRoYXQgeW91IHdhbnQsIHdoZW5cbiAqIHlvdSBleHRlbmQgdGhlIGZ1bmN0aW9uYWxpdHkgb2YgeW91ciBvd24gaW5zdGFuY2Ugb2YgYEh0dHBDbGllbnRgLiBUaGUgZGVmYXVsdCB2YWx1ZSBvZiB0aGlzIHByb3BlcnR5IGlzIGFuIGVtcHR5XG4gKiBvYmplY3QuXG4gKlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgKj59IFtoZWFkZXJzXSBUaGUgb2JqZWN0IHRoYXQgY29udGFpbnMgdGhlIGhlYWRlcnMgdG8gc2V0IHdoZW4gc2VuZGluZyB0aGUgcmVxdWVzdC4gT25seVxuICogdGhlIG5vbi11bmRlZmluZWQgYW5kIG5vbi1udWxsIGhlYWRlcnMgYXJlIHNldC5cbiAqXG4gKiBAcHJvcGVydHkge0NhbmNlbENvbnRyb2xsZXJ9IFtjb250cm9sbGVyXSBUaGUgYENhbmNlbENvbnRyb2xsZXJgIHVzZWQgdG8gY2FuY2VsIHRoZSByZXF1ZXN0LiBJdCBvbmx5IHdvcmtzIHdoZW4gdXNpbmdcbiAqIGBmZXRjaGAgb3IgYGZldGNoSlNPTlBgIHRvIHNlbmQgcmVxdWVzdC4gSWYgdGhlIHlvdSBzZW5kIHJlcXVlc3QgdXNpbmcgYHNlbmRgIG9yIGBnZXRKU09OUGAsIHRoZSBgb3B0aW9ucy5jb250cm9sbGVyYFxuICogd2lsbCBiZSBzZXQgdG8gYG51bGxgLlxuICpcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbcmVxdWVzdEZ1bmN0aW9uTmFtZV0gVGhlIG5hbWUgb2YgdGhlIGZ1bmN0aW9uIHRoYXQgc2VuZCB0aGUgcmVxdWVzdC4gQ2FuIGJlIGBzZW5kYCwgYGZldGNoYCxcbiAqIGBnZXRKU09OUGAsIGBmZXRjaEpTT05QYC4gVGhpcyB2YWx1ZSBpcyBzZXQgYnkgdGhlIGxpYnJhcnksIGRvbid0IGNoYW5nZSBpdC5cbiAqXG4gKiBAcHJvcGVydHkge3N0cmluZ30gW3JlcXVlc3RUeXBlXSBUaGUgcmVxdWVzdCB0eXBlIG9mIHRoaXMgcmVxdWVzdC4gVGhlIHZhbHVlIG9mIGl0IGlzIHNldCBieSB0aGUgbGlicmFyeSBpdHNlbGYsIGNhblxuICogYmUgYEhUVFBfUkVRVUVTVGAgb3IgYEpTT05QX1JFUVVFU1RgLiBBbnkgb3RoZXIgdmFsdWUgdGhlIHVzZXIgcGFzc2VkIGluIGlzIGlnbm9yZWQuIFlvdSBjYW4gdXNlIHRoaXMgcHJvcGVydHkgdG8gZ2V0XG4gKiB0aGUgdHlwZSBvZiB0aGUgY3VycmVudCByZXF1ZXN0LlxuICpcbiAqIEBwcm9wZXJ0eSB7T2JqZWN0LjxzdHJpbmcsICo+fSBbeGhyUHJvcHNdIFRoZSBvYmplY3QgdGhhdCBjb250YWlucyB0aGUgcHJvcGVydGllcyB0byBzZXQgb24gdGhlIGluc3RhbmNlIG9mIHRoZVxuICogYFhNTEh0dHBSZXF1ZXN0YC5cbiAqXG4gKiBAcHJvcGVydHkge3N0cmluZ30gW3VzZXJuYW1lXSBUaGUgdXNlciBuYW1lIHRvIHVzZSBmb3IgYXV0aGVudGljYXRpb24gcHVycG9zZXMuIFRoZSBkZWZ1YWx0IHZhbHVlIGlzIGBudWxsYC5cbiAqXG4gKiBAcHJvcGVydHkge3N0cmluZ30gW3Bhc3N3b3JkXSBUaGUgcGFzc3dvcmQgdG8gdXNlIGZvciBhdXRoZW50aWNhdGlvbiBwdXJwb3Nlcy4gVGhlIGRlZnVhbHQgdmFsdWUgaXMgYG51bGxgLlxuICpcbiAqIEBwcm9wZXJ0eSB7T2JqZWN0LjxzdHJpbmcsIGh0dHBSZXF1ZXN0Qm9keVByb2Nlc3Nvcj59IFtodHRwUmVxdWVzdEJvZHlQcm9jZXNzb3JdIFRoZSBvYmplY3QgdGhhdCBjb250YWlucyB0aGVcbiAqIGh0dHAgcmVxdWVzdCBib2R5IHByb2Nlc3NvcnMuXG4gKlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgUmVzcG9uc2VNaXhpbkZ1bmN0aW9uPn0gW2h0dHBSZXNwb25zZU1peGluXSBUaGUgb2JqZWN0IHRoYXQgY29udGFpbnMgdGhlIGh0dHAgcmVzcG9uc2VcbiAqIG1peGlucy5cbiAqXG4gKiBAcHJvcGVydHkge09iamVjdC48c3RyaW5nLCBSZXNwb25zZU1peGluRnVuY3Rpb24+fSBbanNvbnBSZXNwb25zZU1peGluXSBUaGUgb2JqZWN0IHRoYXQgY29udGFpbnMgdGhlIGpzb25wIHJlc3BvbnNlXG4gKiBtaXhpbnMuXG4gKlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgUmVzcG9uc2VFcnJvck1peGluRnVuY3Rpb24+fSBbaHR0cFJlc3BvbnNlRXJyb3JNaXhpbl0gVGhlIG9iamVjdCB0aGF0IGNvbnRhaW5zIHRoZSBodHRwXG4gKiByZXNwb25zZSBlcnJvciBtaXhpbnMuXG4gKlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgUmVzcG9uc2VFcnJvck1peGluRnVuY3Rpb24+fSBbanNvbnBSZXNwb25zZUVycm9yTWl4aW5dIFRoZSBvYmplY3QgdGhhdCBjb250YWlucyB0aGUganNvbnBcbiAqIHJlc3BvbnNlIGVycm9yIG1peGlucy5cbiAqXG4gKiBAcHJvcGVydHkge0hhbmxkZU9wdGlvbnNGdW5jdGlvbn0gW2hhbmRsZU9wdGlvbnNdIFRoZSBmdW5jdGlvbiB0byBoYW5kbGUgdGhlIG9wdGlvbnMuXG4gKlxuICogQHByb3BlcnR5IHtDcmVhdGVYSFJGdW5jdGlvbn0gW2NyZWF0ZVhIUl0gVGhlIGZ1bmN0aW9uIHRvIGNyZWF0ZSB0aGUgYFhNTEh0dHBSZXF1ZXN0YCBpbnN0YW5jZS5cbiAqXG4gKiBAcHJvcGVydHkge1NjcmlwdENyZWF0ZUZ1bmN0aW9ufSBbY3JlYXRlU2NyaXB0XSBUaGUgZnVuY3Rpb24gdG8gY3JlYXRlIHRoZSBgSFRNTFNjcmlwdEVsZW1lbnRgIGluc3RhbmNlLlxuICpcbiAqIEBwcm9wZXJ0eSB7SlNPTlBDb250YWluZXJGaW5kRnVuY3Rpb259IFtqc29ucENvbnRhaW5lck5vZGVdIFRoZSBmdW5jdGlvbiB0aGF0IHJldHVybnMgdGhlIGNvbnRhaW5lciBub2RlLCB3aGljaCB3aWxsXG4gKiBiZSB1c2VkIHRvIGFwcGVuZCB0aGUgc2NyaXB0IGVsZW1lbnQgd2hlbiBzZW5kaW5nIGpzb25wIHJlcXVlc3QuXG4gKlxuICogQHByb3BlcnR5IHtKU09OUENhbGxiYWNrTmFtZUdlbmVyYXRlRnVuY3Rpb259IFtqc29ucENhbGxiYWNrTmFtZV0gVGhlIGZ1bmN0aW9uIHRvIGdlbmVyYXRlIHRoZSB1bmlxdWUgY2FsbGJhY2sgbmFtZVxuICogd2hlbiBzZW5kaW5nIGpzb25wIHJlcXVlc3QuXG4gKlxuICogQHByb3BlcnR5IHtDb21waWxlVVJMRnVuY3Rpb259IFtjb21waWxlVVJMXSBUaGUgZnVuY3Rpb24gdG8gY29tcGlsZSB1cmwuXG4gKlxuICogQHByb3BlcnR5IHtFbmNvZGVRdWVyeVN0cmluZ0Z1bmN0aW9ufSBlbmNvZGVRdWVyeVN0cmluZyBUaGUgZnVuY3Rpb24gdG8gZW5jb2RlIHRoZSBxdWVyeSBzdHJpbmcuXG4gKlxuICogQHByb3BlcnR5IHtYSFJIb29rRnVuY3Rpb259IG9uWGhyQ3JlYXRlZCBUaGUgZnVuY3Rpb24gdG8gY2FsbCBvbiB4aHIgY3JlYXRlZC5cbiAqXG4gKiBAcHJvcGVydHkge1hIUkhvb2tGdW5jdGlvbn0gb25YaHJPcGVuZWQgVGhlIGZ1bmN0b24gdG8gY2FsbCBvbiB4aHIgb3BlbmVkLlxuICpcbiAqIEBwcm9wZXJ0eSB7WEhSSG9va0Z1bmN0aW9ufSBvblhoclNlbnQgVGhlIGZ1bmN0aW9uIHRvIGNhbGwgb24geGhyIHNlbnQuXG4gKlxuICogQHByb3BlcnR5IHtSZXF1ZXN0Q3JlYXRlZEZ1bmN0aW9ufSBvblJlcXVlc3RDcmVhdGVkIFRoZSBmdW5jdGlvbiB0byBjYWxsIG9uIHJlcXVlc3QgY3JlYXRlZC5cbiAqXG4gKiBAcHJvcGVydHkge0NoZWNrUmVzcG9uc2VPa0Z1bmN0aW9ufSBpc1Jlc3BvbnNlT2sgVGhlIGZ1bmN0aW9uIHRvIGNoZWNrIHdoZXRoZXIgdGhlIHJlc3BvbnNlIGlzIG9rLlxuICpcbiAqIEBwcm9wZXJ0eSB7VHJhbnNmb3JtRXJyb3JGdW5jdGlvbn0gdHJhbnNmb3JtRXJyb3IgVGhlIGZ1bmN0aW9uIHRvIHRyYW5zZnJvbSB0aGUgcmVzcG9uc2UgZXJyb3IuIFRoZSByZXR1cm4gdmFsdWUgb2ZcbiAqIHRoaXMgZnVuY3Rpb24gd2lsbCBiZSBwYXNzZWQgdG8gdGhlIGBvbmVycm9yYCBjYWxsYmFjay5cbiAqXG4gKiBAcHJvcGVydHkge1RyYW5zZm9ybVJlc3BvbnNlRnVuY3Rpb259IHRyYW5zZm9ybVJlc3BvbnNlIFRoZSBmdW5jdGlvbiB0byB0cmFuc2Zyb20gdGhlIHJlc3BvbnNlLiBUaGUgcmV0dXJuIHZhbHVlIG9mXG4gKiB0aGlzIGZ1bmN0aW9uIHdpbGwgYmUgcGFzc2VkIHRvIHRoZSBgb25zdWNjZXNzYCBjYWxsYmFjay5cbiAqXG4gKiBAcHJvcGVydHkge0NoZWNrU2hvdWxkQ2FsbEVycm9yQ2FsbGJhY2tGdW5jdGlvbn0gc2hvdWxkQ2FsbEVycm9yQ2FsbGJhY2sgVGhlIGZ1bmN0aW9uIHRvIGNoZWNrIHdoZXRoZXIgdG8gY2FsbCB0aGVcbiAqIGVycm9yIGNhbGxiYWNrLlxuICpcbiAqIEBwcm9wZXJ0eSB7Q2hlY2tTaG91bGRDYWxsU3VjY2Vzc0NhbGxiYWNrRnVuY3Rpb259IHNob3VsZENhbGxTdWNjZXNzQ2FsbGJhY2sgVGhlIGZ1bmN0aW9uIHRvIGNoZWNrIHdoZXRoZXIgdG8gY2FsbFxuICogdGhlIHN1Y2Nlc3MgY2FsbGJhY2suXG4gKi9cblxuLyoqXG4gKiBUaGUgZGVmaW5pdG9uIG9mIGh0dHAgcmVxdWVzdCBkYXRhIHByb2Nlc3Nvci5cbiAqXG4gKiBAdHlwZWRlZiB7T2JqZWN0LjxzdHJpbmcsICo+fSBodHRwUmVxdWVzdEJvZHlQcm9jZXNzb3JcbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBwcmlvcml0eSBUaGUgcHJpb3JpdHkgb2YgdGhlIHByb2Nlc3Nvci5cbiAqIEBwcm9wZXJ0eSB7T2JqZWN0LjxzdHJpbmcsICo+fSBbaGVhZGVyc10gVGhlIGhlYWRlcnMgdG8gc2V0IHdoZW4gdGhpcyBwcm9jZXNzb3IgaXMgdXNlZC5cbiAqIEBwcm9wZXJ0eSB7SHR0cFJlcXVlc3RDb250ZW50UHJvY2Vzc0Z1bmN0aW9ufSBbcHJvY2Vzc29yXSBUaGUgZnVuY3Rpb24gdG8gcHJvY2VzcyB0aGUgcmVxdWVzdCBib2R5LlxuICovXG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGhhbmRsZSB0aGUgb3B0aW9ucy5cbiAqXG4gKiBAY2FsbGJhY2sgSGFubGRlT3B0aW9uc0Z1bmN0aW9uXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKi9cblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gcHJvY2VzcyB0aGUgcmVxdWVzdCBkYXRhLlxuICpcbiAqIEBjYWxsYmFjayBIdHRwUmVxdWVzdENvbnRlbnRQcm9jZXNzRnVuY3Rpb25cbiAqIEBwYXJhbSB7T2JqZWN0LjxzdHJpbmcsICo+fSBjb250ZW50IFRoZSBjb25lbnQgbmVlZCB0byBwcm9jZXNzLlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zIG9mIHRoZSBjdXJyZW50IHJlcXVlc3QuXG4gKiBAcmV0dXJucyB7YW55fSBSZXR1cm5zIHRoZSB2YWx1ZSB0aGF0IHdpbGwgYmUgc2VuZCB0byB0aGUgc2VydmVyLlxuICovXG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIHBhcnNlIHRoZSByZXNwb25zZS4gVGhpcyBmdW5jdGlvbiB3aWxsIGJlIG1vdW50ZWQgb24gdGhlIHJlc3BvbnNlIGluc3RhbmNlLCB3aGljaCBtYWRlIGl0IGEgbWV0aG9kXG4gKiBvZiB0aGUgYFJlc3BvbnNlYCBpbnN0YW5jZS4gVGhlIHBhcmFtZXRlcnMgYW5kIHRoZSByZXR1cm4gdmFsdWUgaXMgdXAgb24geW91LlxuICpcbiAqIEBjYWxsYmFjayBSZXNwb25zZU1peGluRnVuY3Rpb25cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBwYXJzZSB0aGUgcmVzcG9uc2UgZXJyb3IuIFRoaXMgZnVuY3Rpb24gd2lsbCBiZSBtb3VudGVkIG9uIHRoZSByZXNwb25zZSBlcnJvciBpbnN0YW5jZSwgd2hpY2ggbWFkZSBpdFxuICogYSBtZXRob2Qgb2YgdGhlIGBSZXNwb25zZUVycm9yYCBpbnN0YW5jZS4gVGhlIHBhcmFtZXRlcnMgYW5kIHRoZSByZXR1cm4gdmFsdWUgaXMgdXAgb24geW91LlxuICpcbiAqIEBjYWxsYmFjayBSZXNwb25zZUVycm9yTWl4aW5GdW5jdGlvblxuICovXG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGNyZWF0ZSB0aGUgYFhNTEh0dHBSZXF1ZXN0YCBpbnN0YW5jZS5cbiAqXG4gKiBAY2FsbGJhY2sgQ3JlYXRlWEhSRnVuY3Rpb25cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEByZXR1cm5zIHtYTUxIdHRwUmVxdWVzdH0gUmV0dXJucyBhbiBpbnN0YW5jZSBvZiBgWE1MSHR0cFJlcXVlc3RgLlxuICovXG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGNyZWF0ZSB0aGUgYEhUTUxTY3JpcHRFbGVtZW50YCBpbnN0YW5jZS5cbiAqXG4gKiBAY2FsbGJhY2sgU2NyaXB0Q3JlYXRlRnVuY3Rpb25cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEByZXR1cm5zIHtIVE1MU2NyaXB0RWxlbWVudH0gUmV0dXJucyBhbiBpbnN0YW5jZSBvZiBgSFRNTFNjcmlwdEVsZW1lbnRgLlxuICovXG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyB0aGUgbm9kZSB0byBhcHBlbmQgdGhlIHNjcmlwdCBlbGVtZW50LlxuICpcbiAqIEBjYWxsYmFjayBKU09OUENvbnRhaW5lckZpbmRGdW5jdGlvblxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICogQHJldHVybnMge05vZGV9IFJldHVybnMgdGhlIG5vZGUgdG8gYXBwZW5kIHRoZSBzY3JpcHQgZWxlbWVudC5cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBnZW5lcmF0ZSB0aGUgdW5pcXVlIGNhbGxiYWNrIG5hbWUuXG4gKlxuICogQGNhbGxiYWNrIEpTT05QQ2FsbGJhY2tOYW1lR2VuZXJhdGVGdW5jdGlvblxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICogQHJldHVybnMge3N0cmluZ30gUmV0cnVucyBhIHZhbGlkIGphdmFzY3JpcHQgaWRlbnRpZmllciB0byBob2xkIHRoZSBjYWxsYmFrLlxuICovXG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGNvbXBpbGUgdGhlIHJlcXVlc3QgdXJsLlxuICpcbiAqIEBjYWxsYmFjayBDb21waWxlVVJMRnVuY3Rpb25cbiAqIEBwYXJhbSB7c3RyaW5nfSB1cmwgVGhlIHVybCAod2l0aCBiYXNlVVJMKSB0byBjb21waWxlLlxuICogQHBhcmFtIHtPYmplY3QuPHN0cmluZywgKj59IHBhcmFtIFRoZSBwYXJhbSB0byBjb21waWxlIHRoZSB1cmwuXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBSZXR1cm5zIHRoZSBjb21waWxlZCB1cmwuXG4gKi9cblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gZW5jb2RlIHRoZSBxdWVyeSBzdHJpbmcuXG4gKlxuICogQGNhbGxiYWNrIEVuY29kZVF1ZXJ5U3RyaW5nRnVuY3Rpb25cbiAqIEBwYXJhbSB7T2JqZWN0LjxzdHJpbmcsICo+fSBkYXRhIFRoZSBkYXRhIHRvIGJlIGVuY29kZWQgdG8gcXVlcnkgc3RyaW5nLlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICogQHJldHVybnMge3N0cmluZ30gUmV0dXJucyB0aGUgZW5jb2RlZCBxdWVyeSBzdHJpbmcuXG4gKi9cblxuLyoqXG4gKiBUaGUgeGhyIGhvb2sgZnVuY3Rpb24uXG4gKlxuICogQGNhbGxiYWNrIFhIUkhvb2tGdW5jdGlvblxuICogQHBhcmFtIHtYTUxIdHRwUmVxdWVzdH0geGhyIFRoZSBpbnN0YW5jZSBvZiBgWE1MSHR0cFJlcXVlc3RgLlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICovXG5cbi8qKlxuICogQGNhbGxiYWNrIFJlcXVlc3RDcmVhdGVkRnVuY3Rpb25cbiAqIEBwYXJhbSB7SHR0cFJlcXVlc3R8SlNPTlBSZXF1ZXN0fSByZXF1ZXN0IFRoZSByZXF1ZXN0IGluc3RhbmNlLCBjYW4gYmUgYEh0dHBSZXF1ZXN0YCBvciBgSlNPTlBSZXF1ZXN0YC5cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBjaGVjayB3aGV0aGVyIHRoZSByZXNwb25zZSBpcyBvay5cbiAqXG4gKiBAY2FsbGJhY2sgQ2hlY2tSZXNwb25zZU9rRnVuY3Rpb25cbiAqIEBwYXJhbSB7c3RyaW5nfSByZXF1ZXN0VHlwZSBUaGUgcmVxdWVzdCB0eXBlLCBgSFRUUF9SRVFVRVNUYCBvciBgSlNPTlBfUkVRVUVTVGAuXG4gKiBAcGFyYW0ge1Jlc3BvbnNlfSByZXNwb25zZSBUaGUgcmVzcG9uc2UgaW5zdGFuY2UuXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIHJlc3BvbnNlIGlzIG9rLCBvdGhlcndpc2UgYGZhbHNlYCBpcyByZXR1cm5lZC5cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBjaGVjayB3aGV0aGVyIHRvIGNhbGwgdGhlIGVycm9yIGNhbGxiYWNrLlxuICpcbiAqIEBjYWxsYmFjayBDaGVja1Nob3VsZENhbGxFcnJvckNhbGxiYWNrRnVuY3Rpb25cbiAqIEBwYXJhbSB7c3RyaW5nfSByZXF1ZXN0VHlwZSBUaGUgcmVxdWVzdCB0eXBlLCBgSFRUUF9SRVFVRVNUYCBvciBgSlNPTlBfUkVRVUVTVGAuXG4gKiBAcGFyYW0ge2FueX0gdHJhbnNmb3JtZWRFcnJvciBUaGUgZGF0YSB0aGF0IGBvcHRpb25zLnRyYW5zZm9ybUVycm9yKC4uLilgIHJldHVybnMuXG4gKiBAcGFyYW0ge0h0dHBSZXNwb25zZUVycm9yfEpTT05QUmVzcG9uc2VFcnJvcn0gZXJyb3IgVGhlIHJlc3BvbnNlIGVycm9yLlxuICovXG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGNoZWNrIHdoZXRoZXIgdG8gY2FsbCB0aGUgc3VjY2VzcyBjYWxsYmFjay5cbiAqXG4gKiBAY2FsbGJhY2sgQ2hlY2tTaG91bGRDYWxsU3VjY2Vzc0NhbGxiYWNrRnVuY3Rpb25cbiAqIEBwYXJhbSB7c3RyaW5nfSByZXF1ZXN0VHlwZSBUaGUgcmVxdWVzdCB0eXBlLCBgSFRUUF9SRVFVRVNUYCBvciBgSlNPTlBfUkVRVUVTVGAuXG4gKiBAcGFyYW0ge2FueX0gdHJhbnNmb3JtZWRSZXNwb25zZSBUaGUgZGF0YSB0aGF0IGBvcHRpb25zLnRyYW5zZm9ybVJlc3BvbnNlKC4uLilgIHJldHVybnMuXG4gKiBAcGFyYW0ge0h0dHBSZXNwb25zZXxKU09OUFJlc3BvbnNlfSByZXNwb25zZSBUaGUgcmVzcG9uc2UuXG4gKi9cblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gdHJhbnNmcm9tIHRoZSByZXNwb25zZS4gVGhlIHJldHVybiB2YWx1ZSBvZiB0aGlzIGZ1bmN0aW9uIHdpbGwgYmUgcGFzc2VkIHRvIHRoZSBgb25zdWNjZXNzYCBjYWxsYmFjay5cbiAqXG4gKiBAY2FsbGJhY2sgVHJhbnNmb3JtUmVzcG9uc2VGdW5jdGlvblxuICogQHBhcmFtIHtzdHJpbmd9IHJlcXVlc3RUeXBlIFRoZSByZXF1ZXN0IHR5cGUsIGBIVFRQX1JFUVVFU1RgIG9yIGBKU09OUF9SRVFVRVNUYC5cbiAqIEBwYXJhbSB7SHR0cFJlc3BvbnNlfEpTT05QUmVzcG9uc2V9IHJlc3BvbnNlIFRoZSByZXNwb25zZS5cbiAqIEByZXR1cm5zIHthbnl9IFJldHVybnMgdGhlIHRyYW5zZm9ybWVkIHJlc3BvbnNlLlxuICovXG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIHRyYW5zZnJvbSB0aGUgcmVzcG9uc2UgZXJyb3IuIFRoZSByZXR1cm4gdmFsdWUgb2YgdGhpcyBmdW5jdGlvbiB3aWxsIGJlIHBhc3NlZCB0byB0aGUgYG9uZXJyb3JgXG4gKiBjYWxsYmFjay5cbiAqXG4gKiBAY2FsbGJhY2sgVHJhbnNmb3JtRXJyb3JGdW5jdGlvblxuICogQHBhcmFtIHtzdHJpbmd9IHJlcXVlc3RUeXBlIFRoZSByZXF1ZXN0IHR5cGUsIGBIVFRQX1JFUVVFU1RgIG9yIGBKU09OUF9SRVFVRVNUYC5cbiAqIEBwYXJhbSB7SHR0cFJlc3BvbnNlRXJyb3J8SlNPTlBSZXNwb25zZUVycm9yfSBlcnJvciBUaGUgcmVzcG9uc2UgZXJyb3IuXG4gKiBAcmV0dXJucyB7YW55fSBSZXR1cm5zIHRoZSB0cmFuc2Zvcm1lZCByZXNwb25zZSBlcnJvci5cbiAqL1xuIiwidmFyIFJlcXVlc3QgPSByZXF1aXJlKDkpO1xudmFyIGNvbnN0YW50cyA9IHJlcXVpcmUoMjUpO1xudmFyIGluaGVyaXRzID0gcmVxdWlyZSgzMik7XG52YXIgYnVpbGRVUkwgPSByZXF1aXJlKDIzKTtcbnZhciBoYW5kbGVPcHRpb25zID0gcmVxdWlyZSgzMCk7XG52YXIgY2FsbFJlcXVlc3RDcmVhdGVkQ2FsbGJhY2sgPSByZXF1aXJlKDI0KTtcbnZhciBhZGRFdmVudExpc3RlbmVycyA9IHJlcXVpcmUoMTIpO1xudmFyIGhhbmRsZVhoclByb3BzID0gcmVxdWlyZSgxNyk7XG52YXIgaGFuZGxlSGVhZGVycyA9IHJlcXVpcmUoMTUpO1xudmFyIGhhbmRsZVJlcXVlc3RCb2R5ID0gcmVxdWlyZSgxNik7XG52YXIgY2FsbFhockhvb2sgPSByZXF1aXJlKDE0KTtcblxuLyoqXG4gKiBodHRwIHJlcXVlc3QuXG4gKlxuICogQGNsYXNzXG4gKiBAZXh0ZW5kcyB7UmVxdWVzdH1cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEBwYXJhbSB7UmVxdWVzdFN1Y2Nlc3NDYWxsYmFja30gb25zdWNjZXNzIFRoZSBjYWxsYmFjayB0byBjYWxsIG9uIHN1Y2Nlc3MuXG4gKiBAcGFyYW0ge1JlcXVlc3RFcnJvckNhbGxiYWNrfSBvbmVycm9yIFRoZSBjYWxsYmFjayB0byBjYWxsIG9uIGVycm9yLlxuICovXG5mdW5jdGlvbiBIdHRwUmVxdWVzdChvcHRpb25zLCBvbnN1Y2Nlc3MsIG9uZXJyb3IpIHtcbiAgICB2YXIgeGhyO1xuICAgIHZhciBib2R5O1xuICAgIHZhciB1cmw7XG5cbiAgICAvLyBDYWxsIHRoZSBzdXBlciBjb25zdHJ1Y3Rvci5cbiAgICBSZXF1ZXN0LmNhbGwodGhpcywgY29uc3RhbnRzLkhUVFBfUkVRVUVTVCwgb3B0aW9ucywgb25zdWNjZXNzLCBvbmVycm9yKTtcblxuICAgIC8vIENhbGwgYG9wdGlvbnMuaGFuZGxlT3B0aW9uc2AgdG8gaGFuZGxlIG9wdGlvbnMuXG4gICAgaGFuZGxlT3B0aW9ucyhvcHRpb25zKTtcblxuICAgIHhociA9IHRoaXMueGhyID0gb3B0aW9ucy5jcmVhdGVYSFIuY2FsbChudWxsLCBvcHRpb25zKTtcbiAgICBib2R5ID0gaGFuZGxlUmVxdWVzdEJvZHkob3B0aW9ucyk7XG4gICAgdXJsID0gYnVpbGRVUkwob3B0aW9ucyk7XG5cbiAgICAvLyBTZXQgcHJvcGVydGllcyB0byB0aGUgeGhyLlxuICAgIGhhbmRsZVhoclByb3BzKHhociwgb3B0aW9ucyk7XG5cbiAgICAvLyBDYWxsIG9uWGhyQ3JlYXRlZC5cbiAgICBjYWxsWGhySG9vayhvcHRpb25zLm9uWGhyQ3JlYXRlZCwgeGhyLCBvcHRpb25zKTtcblxuICAgIC8vIE9wZW4gdGhlIHJlcXVlc3QuXG4gICAgeGhyLm9wZW4ob3B0aW9ucy5tZXRob2QgfHwgJ0dFVCcsIHVybCwgdHJ1ZSwgb3B0aW9ucy51c2VybmFtZSwgb3B0aW9ucy5wYXNzd29yZCk7XG5cbiAgICAvLyBBZGQgZXZlbnQgbGlzdGVuZXJzLlxuICAgIGFkZEV2ZW50TGlzdGVuZXJzKHRoaXMpO1xuXG4gICAgLy8gQ2FsbCBvblhock9wZW5lZC5cbiAgICBjYWxsWGhySG9vayhvcHRpb25zLm9uWGhyT3BlbmVkLCB4aHIsIG9wdGlvbnMpO1xuXG4gICAgLy8gSGFubGRlIGhlYWRlcnMuXG4gICAgaGFuZGxlSGVhZGVycyh4aHIsIG9wdGlvbnMpO1xuXG4gICAgLy8gU2VuZCB0aGUgYm9keSB0byB0aGUgc2VydmVyLlxuICAgIHhoci5zZW5kKGJvZHkpO1xuXG4gICAgLy8gQ2FsbCBvblhoclNlbnQuXG4gICAgY2FsbFhockhvb2sob3B0aW9ucy5vblhoclNlbnQsIHhociwgb3B0aW9ucyk7XG5cbiAgICAvLyBDYWxsIG9uUmVxdWVzdENyZWF0ZWRcbiAgICBjYWxsUmVxdWVzdENyZWF0ZWRDYWxsYmFjayhvcHRpb25zLCB0aGlzKTtcbn1cblxuaW5oZXJpdHMoSHR0cFJlcXVlc3QsIFJlcXVlc3QpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEh0dHBSZXF1ZXN0O1xuIiwiLyoqXG4gKiBIdHRwUmVzcG9uc2UgbW9kdWxlLlxuICpcbiAqIEBtb2R1bGUgY2xhc3MvSHR0cFJlc3BvbnNlXG4gKi9cblxudmFyIFJlc3BvbnNlID0gcmVxdWlyZSgxMCk7XG52YXIgaW5oZXJpdHMgPSByZXF1aXJlKDMyKTtcbnZhciBhZGRDdXN0b21NaXhpbiA9IHJlcXVpcmUoMjIpO1xuXG4vKipcbiAqIFRoZSBIdHRwUmVzcG9uc2UgY2xhc3MuXG4gKlxuICogQGNsYXNzXG4gKiBAcGFyYW0ge0h0dHBSZXF1ZXN0fSByZXF1ZXN0IFRoZSBodHRwIHJlcXVlc3QuXG4gKi9cbmZ1bmN0aW9uIEh0dHBSZXNwb25zZShyZXF1ZXN0KSB7XG4gICAgUmVzcG9uc2UuY2FsbCh0aGlzLCByZXF1ZXN0KTtcbiAgICBhZGRDdXN0b21NaXhpbih0aGlzLCByZXF1ZXN0Lm9wdGlvbnMsICdodHRwUmVzcG9uc2VNaXhpbicpO1xufVxuXG5pbmhlcml0cyhIdHRwUmVzcG9uc2UsIFJlc3BvbnNlKTtcblxubW9kdWxlLmV4cG9ydHMgPSBIdHRwUmVzcG9uc2U7XG4iLCJ2YXIgUmVzcG9uc2VFcnJvciA9IHJlcXVpcmUoMTEpO1xudmFyIGluaGVyaXRzID0gcmVxdWlyZSgzMik7XG52YXIgYWRkQ3VzdG9tTWl4aW4gPSByZXF1aXJlKDIyKTtcblxuLyoqXG4gKiBAY2xhc3NcbiAqIEBwYXJhbSB7c3RyaW5nfSBjb2RlIFRoZSBlcnJvciBjb2RlLlxuICogQHBhcmFtIHtIdHRwUmVxdWVzdH0gcmVxdWVzdCBUaGUgaHR0cCByZXF1ZXN0LlxuICovXG5mdW5jdGlvbiBIdHRwUmVzcG9uc2VFcnJvcihjb2RlLCByZXF1ZXN0KSB7XG4gICAgUmVzcG9uc2VFcnJvci5jYWxsKHRoaXMsIGNvZGUsIHJlcXVlc3QpO1xuICAgIGFkZEN1c3RvbU1peGluKHRoaXMsIHJlcXVlc3Qub3B0aW9ucywgJ2h0dHBSZXNwb25zZUVycm9yTWl4aW4nKTtcbn1cblxuaW5oZXJpdHMoSHR0cFJlc3BvbnNlRXJyb3IsIFJlc3BvbnNlRXJyb3IpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEh0dHBSZXNwb25zZUVycm9yO1xuIiwidmFyIFJlcXVlc3QgPSByZXF1aXJlKDkpO1xudmFyIGNvbnN0YW50cyA9IHJlcXVpcmUoMjUpO1xudmFyIGluaGVyaXRzID0gcmVxdWlyZSgzMik7XG52YXIgaGFuZGxlT3B0aW9ucyA9IHJlcXVpcmUoMzApO1xudmFyIGNhbGxSZXF1ZXN0Q3JlYXRlZENhbGxiYWNrID0gcmVxdWlyZSgyNCk7XG52YXIgYWRkRXZlbnRMaXN0ZW5lcnMgPSByZXF1aXJlKDE4KTtcbnZhciBidWlsZENhbGxiYWNrTmFtZSA9IHJlcXVpcmUoMTkpO1xudmFyIGhhbmRsZVNjcmlwdENvcnMgPSByZXF1aXJlKDIxKTtcbnZhciBidWlsZFNjcmlwdFNyYyA9IHJlcXVpcmUoMjApO1xuXG4vKipcbiAqIEpTT05QIHJlcXVlc3QuXG4gKlxuICogQGNsYXNzXG4gKiBAZXh0ZW5kcyB7UmVxdWVzdH1cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEBwYXJhbSB7UmVxdWVzdFN1Y2Nlc3NDYWxsYmFja30gb25zdWNjZXNzIFRoZSBjYWxsYmFjayB0byBjYWxsIG9uIHN1Y2Nlc3MuXG4gKiBAcGFyYW0ge1JlcXVlc3RFcnJvckNhbGxiYWNrfSBvbmVycm9yIFRoZSBjYWxsYmFjayB0byBjYWxsIG9uIGVycm9yLlxuICovXG5mdW5jdGlvbiBKU09OUFJlcXVlc3Qob3B0aW9ucywgb25zdWNjZXNzLCBvbmVycm9yKSB7XG4gICAgdmFyIHNyYztcbiAgICB2YXIgc2NyaXB0O1xuICAgIHZhciBjYWxsYmFja05hbWU7XG4gICAgdmFyIGNvbnRhaW5lck5vZGU7XG5cbiAgICBSZXF1ZXN0LmNhbGwodGhpcywgY29uc3RhbnRzLkpTT05QX1JFUVVFU1QsIG9wdGlvbnMsIG9uc3VjY2Vzcywgb25lcnJvcik7XG5cbiAgICAvLyBDYWxsIGBvcHRpb25zLmhhbmRsZU9wdGlvbnNgIHRvIGhhbmRsZSBvcHRpb25zLlxuICAgIGhhbmRsZU9wdGlvbnMob3B0aW9ucyk7XG5cbiAgICBzY3JpcHQgPSB0aGlzLnNjcmlwdCA9IG9wdGlvbnMuY3JlYXRlU2NyaXB0LmNhbGwobnVsbCwgb3B0aW9ucyk7XG4gICAgY29udGFpbmVyTm9kZSA9IG9wdGlvbnMuanNvbnBDb250YWluZXJOb2RlLmNhbGwobnVsbCwgb3B0aW9ucyk7XG4gICAgY2FsbGJhY2tOYW1lID0gYnVpbGRDYWxsYmFja05hbWUob3B0aW9ucyk7XG4gICAgc3JjID0gYnVpbGRTY3JpcHRTcmMob3B0aW9ucywgY2FsbGJhY2tOYW1lKTtcblxuICAgIC8vIFNldCB0aGUgc3JjIGF0dHJpYnV0ZS5cbiAgICBzY3JpcHQuc2V0QXR0cmlidXRlKCdzcmMnLCBzcmMpO1xuXG4gICAgLy8gSGFuZGxlIGBvcHRpb25zLmNvcnNgLlxuICAgIGhhbmRsZVNjcmlwdENvcnMoc2NyaXB0LCBvcHRpb25zKTtcblxuICAgIC8vIEFkZCBldmVudCBsaXN0ZW5lcnMuXG4gICAgYWRkRXZlbnRMaXN0ZW5lcnModGhpcywgY2FsbGJhY2tOYW1lKTtcblxuICAgIC8vIEluamVjdCB0aGUgc2NyaXB0IG5vZGUuXG4gICAgY29udGFpbmVyTm9kZS5hcHBlbmRDaGlsZChzY3JpcHQpO1xuXG4gICAgLy8gQ2FsbCBvblJlcXVlc3RDcmVhdGVkLlxuICAgIGNhbGxSZXF1ZXN0Q3JlYXRlZENhbGxiYWNrKG9wdGlvbnMsIHRoaXMpO1xufVxuXG5pbmhlcml0cyhKU09OUFJlcXVlc3QsIFJlcXVlc3QpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEpTT05QUmVxdWVzdDtcbiIsIi8qKlxuICogSlNPTlBSZXNwb25zZSBtb2R1bGUuXG4gKlxuICogQG1vZHVsZSBjbGFzcy9KU09OUFJlc3BvbnNlXG4gKi9cblxudmFyIFJlc3BvbnNlID0gcmVxdWlyZSgxMCk7XG52YXIgaW5oZXJpdHMgPSByZXF1aXJlKDMyKTtcbnZhciBhZGRDdXN0b21NaXhpbiA9IHJlcXVpcmUoMjIpO1xuXG4vKipcbiAqIFRoZSBKU09OUFJlc3BvbnNlIGNsYXNzLlxuICpcbiAqIEBjbGFzc1xuICogQHBhcmFtIHtKU09OUmVxdWVzdH0gcmVxdWVzdCBUaGUgaHR0cCByZXF1ZXN0LlxuICovXG5mdW5jdGlvbiBKU09OUFJlc3BvbnNlKHJlcXVlc3QpIHtcbiAgICBSZXNwb25zZS5jYWxsKHRoaXMsIHJlcXVlc3QpO1xuICAgIGFkZEN1c3RvbU1peGluKHRoaXMsIHJlcXVlc3Qub3B0aW9ucywgJ2pzb25wUmVzcG9uc2VNaXhpbicpO1xufVxuXG5pbmhlcml0cyhKU09OUFJlc3BvbnNlLCBSZXNwb25zZSk7XG5cbm1vZHVsZS5leHBvcnRzID0gSlNPTlBSZXNwb25zZTtcbiIsInZhciBSZXNwb25zZUVycm9yID0gcmVxdWlyZSgxMSk7XG52YXIgaW5oZXJpdHMgPSByZXF1aXJlKDMyKTtcbnZhciBhZGRDdXN0b21NaXhpbiA9IHJlcXVpcmUoMjIpO1xuXG4vKipcbiAqIEBjbGFzc1xuICogQHBhcmFtIHtzdHJpbmd9IGNvZGUgVGhlIGVycm9yIGNvZGUuXG4gKiBAcGFyYW0ge0pTT05QUmVxdWVzdH0gcmVxdWVzdCBUaGUgSlNPTlAgcmVxdWVzdC5cbiAqL1xuZnVuY3Rpb24gSlNPTlBSZXNwb25zZUVycm9yKGNvZGUsIHJlcXVlc3QpIHtcbiAgICBSZXNwb25zZUVycm9yLmNhbGwodGhpcywgY29kZSwgcmVxdWVzdCk7XG4gICAgYWRkQ3VzdG9tTWl4aW4odGhpcywgcmVxdWVzdC5vcHRpb25zLCAnanNvbnBSZXNwb25zZUVycm9yTWl4aW4nKTtcbn1cblxuaW5oZXJpdHMoUmVzcG9uc2VFcnJvciwgSlNPTlBSZXNwb25zZUVycm9yKTtcblxubW9kdWxlLmV4cG9ydHMgPSBKU09OUFJlc3BvbnNlRXJyb3I7XG4iLCJ2YXIgdXVpZCA9IHJlcXVpcmUoMzUpO1xuXG4vKipcbiAqIFRoZSBiYXNlIFJlcWV1c3QgY2xhc3MuXG4gKlxuICogQGNsYXNzXG4gKiBAcGFyYW0ge3N0cmluZ30gdHlwZSBUaGUgdHlwZSBvZiByZXF1ZXN0LCBjYW4gYmUgYEhUVFBfUkVRVUVTVGAgb3IgYEpTT05QX1JFUVVFU1RgLlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICogQHBhcmFtIHtSZXF1ZXN0U3VjY2Vzc0NhbGxiYWNrfSBvbnN1Y2Nlc3MgVGhlIGNhbGxiYWNrIHRvIGNhbGwgb24gc3VjY2Vzcy5cbiAqIEBwYXJhbSB7UmVxdWVzdEVycm9yQ2FsbGJhY2t9IG9uZXJyb3IgVGhlIGNhbGxiYWNrIHRvIGNhbGwgb24gZXJyb3IuXG4gKi9cbmZ1bmN0aW9uIFJlcXVlc3QodHlwZSwgb3B0aW9ucywgb25zdWNjZXNzLCBvbmVycm9yKSB7XG4gICAgLyoqXG4gICAgICogSWYgdGhlcmUgaXMgYW4gZXJyb3IgaGFwcGVuZCwgdGhlIGBlcnJvcmAgaXMgYSBzdHJpbmcgcmVwcnNlbmd0aW5nIHRoZSB0eXBlIG9mIHRoZSBlcnJvci4gSWYgdGhlcmUgaXMgbm9cbiAgICAgKiBlcnJvciwgdGhlIHZhbHVlIG9mIGBlcnJvcmAgaXMgYG51bGxgLlxuICAgICAqL1xuICAgIHRoaXMuZXJyb3IgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGBYTUxIdHRwUmVxdWVzdGAgd2UgdXNlIHdoZW4gc2VuZGluZyBodHRwIHJlcXVlc3QuXG4gICAgICovXG4gICAgdGhpcy54aHIgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGBIVE1MU2NyaXB0RWxlbWVudGAgd2UgdXNlIHdoZW4gc2VuZGluZyBKU09OUCByZXF1ZXN0LlxuICAgICAqL1xuICAgIHRoaXMuc2NyaXB0ID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFdoZXRoZXIgdGhlIHJlcXVlc3QgaXMgZmluaXNoZWQuXG4gICAgICovXG4gICAgdGhpcy5maW5pc2hlZCA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHJlc3BvbnNlIEpTT04gZGF0YSBvZiB0aGUgSlNPTlAgcmVxdWVzdC5cbiAgICAgKi9cbiAgICB0aGlzLnJlc3BvbnNlSlNPTiA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBBbiB1bmlxdWUgaWQgZm9yIHRoaXMgcmVxdWVzdC5cbiAgICAgKi9cbiAgICB0aGlzLnJlcXVlc3RJZCA9IHV1aWQoKTtcblxuICAgIC8qKlxuICAgICAqIFRoZSB0eXBlIG9mIHJlcXVlc3QsIGNhbiBiZSBgSFRUUF9SRVFVRVNUYCBvciBgSlNPTlBfUkVRVUVTVGAuXG4gICAgICovXG4gICAgdGhpcy5yZXF1ZXN0VHlwZSA9IHR5cGU7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICAgICAqL1xuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbmFtZSBvZiB0aGUgZnVuY3Rpb24gdGhhdCBjcmVhdGUgdGhpcyByZXF1ZXN0LiBDYW4gYmUgYHNlbmRgLCBgZmV0Y2hgLCBgZ2V0Sk9TTlBgLCBgZmV0Y2hKU09OUGAuIFRoaXMgdmFsdWVcbiAgICAgKiBpcyBzZXQgYnkgdGhlIGxpYnJheSBpdHNlbGYuXG4gICAgICovXG4gICAgdGhpcy5yZXF1ZXN0RnVuY3Rpb25OYW1lID0gb3B0aW9ucy5yZXF1ZXN0RnVuY3Rpb25OYW1lO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGBDYW5jZWxDb250cm9sbGVyYCB0aGF0IHVzZWQgdG8gY2FuY2VsIHRoaXMgcmVxdWVzdC4gV2UgbmV2ZXIgdXNlIHRoaXMgcHJvcGVydHkgaW50ZXJuYWxseSwganVzdCBob2xkaW5nIHRoZVxuICAgICAqIGluZm9ybWF0aW9uIGluIGNhc2UgdGhhdCB0aGUgdXNlciBuZWVkcy5cbiAgICAgKi9cbiAgICB0aGlzLmNvbnRyb2xsZXIgPSBvcHRpb25zLmNvbnRyb2xsZXIgfHwgbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFRoZSBjYWxsYmFjayB0byBjYWxsIG9uIHN1Y2Nlc3MuXG4gICAgICovXG4gICAgdGhpcy5vbnN1Y2Nlc3MgPSBvbnN1Y2Nlc3MgfHwgbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFRoZSBjYWxsYmFjayB0byBjYWxsIG9uIGVycm9yLlxuICAgICAqL1xuICAgIHRoaXMub25lcnJvciA9IG9uZXJyb3IgfHwgbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFNldCB0aGUgcmVxdWVzdCB0eXBlIGJhY2suXG4gICAgICovXG4gICAgb3B0aW9ucy5yZXF1ZXN0VHlwZSA9IHR5cGU7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gUmVxdWVzdDtcbiIsIi8qKlxuICogUmVwcmVzZW50cyBhIHJlc3BvbnNlLlxuICpcbiAqIEBwYXJhbSB7UmVxdWVzdH0gcmVxdWVzdCBUaGUgaW5zdGFuY2Ugb2YgYFJlcXVlc3RgLlxuICovXG5mdW5jdGlvbiBSZXNwb25zZShyZXF1ZXN0KSB7XG4gICAgLyoqXG4gICAgICogQHR5cGUge1JlcXVlc3R9XG4gICAgICovXG4gICAgdGhpcy5yZXF1ZXN0ID0gcmVxdWVzdDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBSZXNwb25zZTtcbiIsInZhciBlcnJvck1lc3NhZ2VzID0ge1xuICAgIEVSUl9BQk9SVEVEOiAnUmVxdWVzdCBhYm9ydGVkJyxcbiAgICBFUlJfQ0FOQ0VMTEVEOiAnUmVxdWVzdCBjYW5jZWxsZWQnLFxuICAgIEVSUl9ORVRXT1JLOiAnTmV0d29yayBlcnJvcicsXG4gICAgRVJSX1JFU1BPTlNFOiAnUmVzcG9uc2UgZXJyb3InLFxuICAgIEVSUl9USU1FT1VUOiAnUmVxdWVzdCB0aW1lb3V0J1xufTtcblxuLyoqXG4gKiBSZXByZXNlbnRzIHJlc3BvbnNlIGVycm9yLlxuICpcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHtzdHJpbmd9IGNvZGUgVGhlIGVycm9yIGNvZGUuXG4gKiBAcGFyYW0ge1JlcXVlc3R9IHJlcXVlc3QgVGhlIHJlcXVlc3QuXG4gKi9cbmZ1bmN0aW9uIFJlc3BvbnNlRXJyb3IoY29kZSwgcmVxdWVzdCkge1xuICAgIHZhciBtZXNzYWdlO1xuXG4gICAgY29kZSA9IGNvZGUgfHwgJ0VSUl9VTktOT1dOJztcblxuICAgIGlmIChlcnJvck1lc3NhZ2VzW2NvZGVdKSB7XG4gICAgICAgIG1lc3NhZ2UgPSBlcnJvck1lc3NhZ2VzW2NvZGVdO1xuICAgIH1cblxuICAgIGlmICghbWVzc2FnZSkge1xuICAgICAgICBtZXNzYWdlID0gJ1Vua25vd24gZXJyb3IgJyArIGNvZGU7XG4gICAgfVxuXG4gICAgcmVxdWVzdC5lcnJvciA9IGNvZGU7XG5cbiAgICB0aGlzLmNvZGUgPSBjb2RlO1xuICAgIHRoaXMucmVxdWVzdCA9IHJlcXVlc3Q7XG4gICAgdGhpcy5tZXNzYWdlID0gbWVzc2FnZTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBSZXNwb25zZUVycm9yO1xuIiwidmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKDM4KTtcbnZhciBIdHRwUmVzcG9uc2UgPSByZXF1aXJlKDQpO1xudmFyIGFkZFRpbWVvdXRMaXN0ZW5lciA9IHJlcXVpcmUoMTMpO1xudmFyIGZpcmVDYWxsYmFja3MgPSByZXF1aXJlKDI5KTtcbnZhciBub29wID0gcmVxdWlyZSgzMyk7XG52YXIgY29uc3RhbnRzID0gcmVxdWlyZSgyNSk7XG52YXIgRVJSX0FCT1JURUQgICA9IGNvbnN0YW50cy5FUlJfQUJPUlRFRDtcbnZhciBFUlJfQ0FOQ0VMTEVEID0gY29uc3RhbnRzLkVSUl9DQU5DRUxMRUQ7XG52YXIgRVJSX05FVFdPUksgICA9IGNvbnN0YW50cy5FUlJfTkVUV09SSztcbnZhciBFUlJfUkVTUE9OU0UgID0gY29uc3RhbnRzLkVSUl9SRVNQT05TRTtcbnZhciBFUlJfVElNRU9VVCAgID0gY29uc3RhbnRzLkVSUl9USU1FT1VUO1xuXG4vKipcbiAqIEFkZCBldmVudCBsaXN0ZW5lcnMgdG8gdGhlIGh0dHAgcmVxdWVzdC4gVGhpcyBmdW5jdGlvbiB3aWxsIG92ZXJ3aXRlIHRoZSBgY2FuY2VsYCBtZXRob2Qgb24gdGhlIGdpdmVuIGBIdHRwUmVxZXN0YFxuICogaW5zdGFuY2UuXG4gKlxuICogQHBhcmFtIHtIdHRwUmVxdWVzdH0gcmVxdWVzdCBUaGUgaHR0cCByZXF1ZXN0IHRvIGFkZCBldmVudCBsaXN0ZW5lcnMuXG4gKi9cbmZ1bmN0aW9uIGFkZEV2ZW50TGlzdGVuZXJzKHJlcXVlc3QpIHtcbiAgICB2YXIgeGhyID0gcmVxdWVzdC54aHI7XG4gICAgdmFyIG9wdGlvbnMgPSByZXF1ZXN0Lm9wdGlvbnM7XG4gICAgdmFyIHJlcXVlc3RUeXBlID0gcmVxdWVzdC5yZXF1ZXN0VHlwZTtcbiAgICB2YXIgcmVzcG9uc2UgPSBuZXcgSHR0cFJlc3BvbnNlKHJlcXVlc3QpO1xuICAgIHZhciBpc1Jlc3BvbnNlT2sgPSBvcHRpb25zLmlzUmVzcG9uc2VPaztcbiAgICB2YXIgY2xlYXJUaW1lb3V0RXZlbnQgPSBudWxsO1xuICAgIHZhciB0aW1lb3V0ID0gcGFyc2VJbnQob3B0aW9ucy50aW1lb3V0LCAxMCkgfHwgMDtcblxuICAgIC8qKlxuICAgICAqIENhbmNlbCB0aGUgcmVxdWVzdC5cbiAgICAgKi9cbiAgICB2YXIgY2FuY2VsID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBjbGVhckV2ZW50cygpO1xuICAgICAgICBpZiAoeGhyLmFib3J0KSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHhoci5hYm9ydCgpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIC8vIGVtcHR5XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZmluaXNoKEVSUl9DQU5DRUxMRUQpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZnVuY3Rpb24gdG8gY2xlYXIgZXZlbnRzLlxuICAgICAqL1xuICAgIHZhciBjbGVhckV2ZW50cyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLy8gU2V0IGNsZWFyRXZlbnRzIHRvIHRoZSBub29wIGZ1bmN0aW9uLlxuICAgICAgICBjbGVhckV2ZW50cyA9IG5vb3A7XG5cbiAgICAgICAgeGhyLm9uYWJvcnQgPSBudWxsO1xuICAgICAgICB4aHIub25lcnJvciA9IG51bGw7XG4gICAgICAgIHhoci5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBudWxsO1xuICAgICAgICB4aHIub250aW1lb3V0ID0gbnVsbDtcblxuICAgICAgICBpZiAoY2xlYXJUaW1lb3V0RXZlbnQpIHtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dEV2ZW50KCk7XG4gICAgICAgICAgICBjbGVhclRpbWVvdXRFdmVudCA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogVGhlIGZ1bmN0aW9uIGZpbmlzaCB0aGUgcmVxdWVzdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBjb2RlIFRoZSBlcnJvciBjb2RlIG9uIGVycm9yLiBJZiBubyBlcnJvciBvY2N1cmVkLCB0aGUgY29kZSBpcyBgbnVsbGAuXG4gICAgICovXG4gICAgdmFyIGZpbmlzaCA9IGZ1bmN0aW9uIChjb2RlKSB7XG4gICAgICAgIC8vIFNldCBmaW5pc2ggdG8gdGhlIG5vb3AgZnVuY3Rpb24uXG4gICAgICAgIGZpbmlzaCA9IG5vb3A7XG5cbiAgICAgICAgLy8gU2V0IGNhbmNlbCB0byB0aGUgbm9vcCBmdW5jdGlvbi5cbiAgICAgICAgY2FuY2VsID0gbm9vcDtcblxuICAgICAgICAvLyBNYXJrIHRoaXMgcmVxdWVzdCBhcyBmaW5pc2hlZC5cbiAgICAgICAgcmVxdWVzdC5maW5pc2hlZCA9IHRydWU7XG5cbiAgICAgICAgLy8gQ2xlYXIgZXZlbnRzLlxuICAgICAgICBjbGVhckV2ZW50cygpO1xuXG4gICAgICAgIC8vIEZpcmUgY2FsbGJhY2tzLlxuICAgICAgICBmaXJlQ2FsbGJhY2tzKGNvZGUsIHJlc3BvbnNlKTtcbiAgICB9O1xuXG4gICAgeGhyLm9uYWJvcnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGZpbmlzaChFUlJfQUJPUlRFRCk7XG4gICAgfTtcblxuICAgIHhoci5vbmVycm9yID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBmaW5pc2goRVJSX05FVFdPUkspO1xuICAgIH07XG5cbiAgICB4aHIub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoK3hoci5yZWFkeVN0YXRlID09PSA0KSB7XG4gICAgICAgICAgICBpZiAoaXNGdW5jdGlvbihpc1Jlc3BvbnNlT2spKSB7XG4gICAgICAgICAgICAgICAgaWYgKGlzUmVzcG9uc2VPayhyZXF1ZXN0VHlwZSwgcmVzcG9uc2UpKSB7XG4gICAgICAgICAgICAgICAgICAgIGZpbmlzaChudWxsKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBmaW5pc2goRVJSX1JFU1BPTlNFKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGZpbmlzaChudWxsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBDYW5jZWwgdGhlIHJlcXVlc3QuXG4gICAgICovXG4gICAgcmVxdWVzdC5jYW5jZWwgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNhbmNlbCgpO1xuICAgIH07XG5cbiAgICAvLyBBZGQgdGltZW91dCBsaXN0ZW5lclxuICAgIGlmICh0aW1lb3V0ID4gMCkge1xuICAgICAgICBjbGVhclRpbWVvdXRFdmVudCA9IGFkZFRpbWVvdXRMaXN0ZW5lcih4aHIsIHRpbWVvdXQsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGNsZWFyRXZlbnRzKCk7XG4gICAgICAgICAgICBpZiAoeGhyLmFib3J0KSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgeGhyLmFib3J0KCk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBlbXB0eVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZpbmlzaChFUlJfVElNRU9VVCk7XG4gICAgICAgIH0pO1xuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBhZGRFdmVudExpc3RlbmVycztcbiIsIi8qKlxuICogQWRkIHRpbWVvdXQgZXZlbnQgbGlzdGVuZXIgb24gdGhlIFhIUiBvYmplY3QuXG4gKlxuICogQHBhcmFtIHtYTUxIdHRwUmVxdWVzdH0geGhyIFRoZSBYSFIgdG8gYWRkIHRpbWVvdXQgZXZlbnQgbGlzdGVuZXIuXG4gKiBAcGFyYW0ge251bWJlcn0gdGltZW91dCBUaGUgdGltZSB0byB3YWl0IGluIG1pbGxpc2Vjb25kcy5cbiAqIEBwYXJhbSB7KCkgPT4gdm9pZH0gbGlzdGVuZXIgVGhlIHRpbWVvdXQgY2FsbGJhY2suXG4gKiBAcmV0dXJucyB7KCkgPT4gdm9pZCl9IFJldHVybnMgYSBmdW5jdGlvbiB0byByZW1vdmUgdGhlIHRpbWVvdXQgZXZlbnQgbGlzdGVuZXIuXG4gKi9cbmZ1bmN0aW9uIGFkZFRpbWVvdXRMaXN0ZW5lcih4aHIsIHRpbWVvdXQsIGxpc3RlbmVyKSB7XG4gICAgdmFyIHRpbWVvdXRJZCA9IG51bGw7XG4gICAgdmFyIHN1cHBvcnRUaW1lb3V0ID0gJ3RpbWVvdXQnIGluIHhociAmJiAnb250aW1lb3V0JyBpbiB4aHI7XG5cbiAgICBpZiAoc3VwcG9ydFRpbWVvdXQpIHtcbiAgICAgICAgeGhyLnRpbWVvdXQgPSB0aW1lb3V0O1xuICAgICAgICB4aHIub250aW1lb3V0ID0gbGlzdGVuZXI7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGltZW91dElkID0gc2V0VGltZW91dChsaXN0ZW5lciwgdGltZW91dCk7XG4gICAgfVxuXG4gICAgLy8gQ2FsbCB0aGlzIGZ1bmN0aW9uIHRvIHJlbW92ZSB0aW1lb3V0IGV2ZW50IGxpc3RlbmVyXG4gICAgZnVuY3Rpb24gY2xlYXJUaW1lb3V0RXZlbnQoKSB7XG4gICAgICAgIGlmICh4aHIpIHtcbiAgICAgICAgICAgIGlmICh0aW1lb3V0SWQgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICB4aHIub250aW1lb3V0ID0gbnVsbDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXRJZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB4aHIgPSBudWxsO1xuICAgICAgICAgICAgbGlzdGVuZXIgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGNsZWFyVGltZW91dEV2ZW50O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGFkZFRpbWVvdXRMaXN0ZW5lcjtcbiIsInZhciBpc0Z1bmN0aW9uID0gcmVxdWlyZSgzOCk7XG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGNhbGwgeGhyIGhvb2sgZnVuY3Rpb24uXG4gKlxuICogQHBhcmFtIHtYSFJIb29rRnVuY3Rpb259IGZ1bmMgVGhlIGhvb2sgZnVuY3Rpb24gdG8gY2FsbCwgaWYgaXQgaXMgbm90IGZ1bmN0aW9uLCB0aGlzIGhvb2sgaXMgc2tpcHBlZC5cbiAqIEBwYXJhbSB7WE1MSHR0cFJlcWV1c3R9IHhociBUaGUgaW5zdGFuY2Ugb2YgYFhNTEh0dHBSZXFldXN0YC5cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbn0gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICovXG5mdW5jdGlvbiBjYWxsWGhySG9vayhmdW5jLCB4aHIsIG9wdGlvbnMpIHtcbiAgICBpZiAoaXNGdW5jdGlvbihmdW5jKSkge1xuICAgICAgICBmdW5jKHhociwgb3B0aW9ucyk7XG4gICAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGNhbGxYaHJIb29rO1xuIiwidmFyIG1lcmdlID0gcmVxdWlyZSg0MCk7XG52YXIgaXNQbGFpbk9iamVjdCA9IHJlcXVpcmUoMzkpO1xudmFyIGhhc093biA9IHJlcXVpcmUoMzEpO1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBzZXQgdGhlIHJlcXVlc3QgaGVhZGVycy5cbiAqXG4gKiAxLiBNZXJnZSB0aGUgYG9wdGlvbnMubm9DYWNoZUhlYWRlcnNgIGlmIG5lZWRlZC5cbiAqIDIuIFNldCB0aGUgcmVxdWVzdCBoZWFkZXJzIGlmIG5lZWRlZC5cbiAqXG4gKiBAcGFyYW0ge1hNTEh0dHBSZXFldXN0fSB4aHIgVGhlIGluc3RhbmNlIG9mIGBYTUxIdHRwUmVxZXVzdGAuXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb259IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqL1xuZnVuY3Rpb24gaGFuZGxlSGVhZGVycyh4aHIsIG9wdGlvbnMpIHtcbiAgICB2YXIgbmFtZTtcbiAgICB2YXIgdmFsdWU7XG4gICAgdmFyIGhlYWRlcnMgPSBpc1BsYWluT2JqZWN0KG9wdGlvbnMuaGVhZGVycykgPyBvcHRpb25zLmhlYWRlcnMgOiB7fTtcblxuICAgIGlmIChvcHRpb25zLm5vQ2FjaGUpIHtcbiAgICAgICAgaWYgKGlzUGxhaW5PYmplY3Qob3B0aW9ucy5ub0NhY2hlSGVhZGVycykpIHtcbiAgICAgICAgICAgIGhlYWRlcnMgPSBtZXJnZShoZWFkZXJzLCBvcHRpb25zLm5vQ2FjaGVIZWFkZXJzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZvciAobmFtZSBpbiBoZWFkZXJzKSB7XG4gICAgICAgIGlmIChoYXNPd24uY2FsbChoZWFkZXJzLCBuYW1lKSkge1xuICAgICAgICAgICAgdmFsdWUgPSBoZWFkZXJzW25hbWVdO1xuICAgICAgICAgICAgLy8gT25seSB0aGUgbm9uLXVuZGVmaW5lZCBhbmQgbm9uLW51bGwgaGVhZGVycyBhcmUgc2V0XG4gICAgICAgICAgICBpZiAodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKG5hbWUsIHZhbHVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIFNldCB0aGUgaGVhZGVycyBiYWNrLlxuICAgIG9wdGlvbnMuaGVhZGVycyA9IGhlYWRlcnM7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaGFuZGxlSGVhZGVycztcbiIsInZhciBtZXJnZSA9IHJlcXVpcmUoNDApO1xudmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKDM4KTtcbnZhciBpc1BsYWluT2JqZWN0ID0gcmVxdWlyZSgzOSk7XG52YXIgaGFzT3duID0gcmVxdWlyZSgzMSk7XG5cbi8qKlxuICogRmluZCBhIHByb2Nlc3NvciBmcm9tIGBvcHRpb25zLmh0dHBSZXF1ZXN0Qm9keVByb2Nlc3NvcmAgdG8gcHJvY2VzcyB0aGUgcmVxdWVzdCBib2R5LlxuICpcbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEByZXR1cm5zIHthbnl9IFJldHJ1bnMgdGhlIGNvbnRlbnQgdGhhdCBzZW5kIHRvIHRoZSBzZXJ2ZXIuXG4gKi9cbmZ1bmN0aW9uIGhhbmRsZVJlcXVlc3RCb2R5KG9wdGlvbnMpIHtcbiAgICB2YXIgaTtcbiAgICB2YXIgbDtcbiAgICB2YXIga2V5O1xuICAgIHZhciBjb250ZW50ID0gbnVsbDtcbiAgICB2YXIgcHJvY2Vzc29yO1xuICAgIHZhciBjb250ZW50UHJvY2Vzc29yO1xuICAgIHZhciBjb250ZW50UHJvY2Vzc29ycyA9IFtdO1xuICAgIHZhciBib2R5ID0gb3B0aW9ucy5ib2R5O1xuICAgIHZhciBwcm9jZXNzb3JzID0gb3B0aW9ucy5odHRwUmVxdWVzdEJvZHlQcm9jZXNzb3I7XG4gICAgdmFyIGhlYWRlcnMgPSBpc1BsYWluT2JqZWN0KG9wdGlvbnMuaGVhZGVycykgPyBvcHRpb25zLmhlYWRlcnMgOiB7fTtcblxuICAgIGlmIChpc1BsYWluT2JqZWN0KGJvZHkpICYmIGlzUGxhaW5PYmplY3QocHJvY2Vzc29ycykpIHtcbiAgICAgICAgLy8gRmluZCBhbGwgcHJvY2Vzc29ycy5cbiAgICAgICAgZm9yIChrZXkgaW4gcHJvY2Vzc29ycykge1xuICAgICAgICAgICAgaWYgKGhhc093bi5jYWxsKHByb2Nlc3NvcnMsIGtleSkpIHtcbiAgICAgICAgICAgICAgICBwcm9jZXNzb3IgPSBwcm9jZXNzb3JzW2tleV07XG4gICAgICAgICAgICAgICAgaWYgKGlzUGxhaW5PYmplY3QocHJvY2Vzc29yKSkge1xuICAgICAgICAgICAgICAgICAgICBjb250ZW50UHJvY2Vzc29ycy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGtleToga2V5LFxuICAgICAgICAgICAgICAgICAgICAgICAgaGVhZGVyczogcHJvY2Vzc29yLmhlYWRlcnMsXG4gICAgICAgICAgICAgICAgICAgICAgICBwcmlvcml0eTogcHJvY2Vzc29yLnByaW9yaXR5LFxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvY2Vzc29yOiBwcm9jZXNzb3IucHJvY2Vzc29yXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNvcnQgdGhlIHByb2Nlc3NvcnMgYnkgaXRzIHByaW9yaXR5LlxuICAgICAgICBjb250ZW50UHJvY2Vzc29ycy5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICAgICAgICByZXR1cm4gYi5wcmlvcml0eSAtIGEucHJpb3JpdHk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEZpbmQgdGhlIGZpcnN0IG5vbi11bmRlZmluZWQgY29udGVudC5cbiAgICAgICAgZm9yIChpID0gMCwgbCA9IGNvbnRlbnRQcm9jZXNzb3JzLmxlbmd0aDsgaSA8IGw7IGkgKz0gMSkge1xuICAgICAgICAgICAgcHJvY2Vzc29yID0gY29udGVudFByb2Nlc3NvcnNbaV07XG4gICAgICAgICAgICBpZiAoYm9keVtwcm9jZXNzb3Iua2V5XSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgY29udGVudCA9IGJvZHlbcHJvY2Vzc29yLmtleV07XG4gICAgICAgICAgICAgICAgY29udGVudFByb2Nlc3NvciA9IHByb2Nlc3NvcjtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFVzZSB0aGUgcHJvY2Vzc29yIHRvIHByb2Nlc3MgdGhlIGNvbnRlbnQuXG4gICAgICAgIGlmIChjb250ZW50UHJvY2Vzc29yKSB7XG4gICAgICAgICAgICBpZiAoaXNQbGFpbk9iamVjdChjb250ZW50UHJvY2Vzc29yLmhlYWRlcnMpKSB7XG4gICAgICAgICAgICAgICAgaGVhZGVycyA9IG1lcmdlKHt9LCBjb250ZW50UHJvY2Vzc29yLmhlYWRlcnMsIGhlYWRlcnMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcHJvY2Vzc29yID0gY29udGVudFByb2Nlc3Nvci5wcm9jZXNzb3I7XG4gICAgICAgICAgICBpZiAoaXNGdW5jdGlvbihwcm9jZXNzb3IpKSB7XG4gICAgICAgICAgICAgICAgY29udGVudCA9IHByb2Nlc3Nvcihjb250ZW50LCBvcHRpb25zKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIE1ha2Ugc3VyZSB0aGF0IHRoZSBoZWFkZXJzIGlzIGEgcGxhaW4gb2JqZWN0LlxuICAgIG9wdGlvbnMuaGVhZGVycyA9IGhlYWRlcnM7XG5cbiAgICByZXR1cm4gY29udGVudDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBoYW5kbGVSZXF1ZXN0Qm9keTtcbiIsInZhciBpc1BsYWluT2JqZWN0ID0gcmVxdWlyZSgzOSk7XG52YXIgaGFzT3duID0gcmVxdWlyZSgzMSk7XG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGhhbmxkZSBYTUxIdHRwUmVxdWVzdCBwcm9wZXJ0aWVzLlxuICpcbiAqIEBwYXJhbSB7WE1MSHR0cFJlcXVlc3R9IHhociBUaGUgaW5zdGFuY2Ugb2YgYFhNTEh0dHBSZXF1ZXN0YC5cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqL1xuZnVuY3Rpb24gaGFuZGxlWGhyUHJvcHMoeGhyLCBvcHRpb25zKSB7XG4gICAgdmFyIHByb3A7XG4gICAgdmFyIHhoclByb3BzID0gb3B0aW9ucy54aHJQcm9wcztcblxuICAgIGlmIChvcHRpb25zLmNvcnMpIHtcbiAgICAgICAgeGhyLndpdGhDcmVkZW50aWFscyA9IHRydWU7XG4gICAgfVxuXG4gICAgaWYgKGlzUGxhaW5PYmplY3QoeGhyUHJvcHMpKSB7XG4gICAgICAgIGZvciAocHJvcCBpbiB4aHJQcm9wcykge1xuICAgICAgICAgICAgaWYgKGhhc093bi5jYWxsKHhoclByb3BzLCBwcm9wKSkge1xuICAgICAgICAgICAgICAgIHhocltwcm9wXSA9IHhoclByb3BzW3Byb3BdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGhhbmRsZVhoclByb3BzO1xuIiwidmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKDM4KTtcbnZhciBKU09OUFJlc3BvbnNlID0gcmVxdWlyZSg3KTtcbnZhciBmaXJlQ2FsbGJhY2tzID0gcmVxdWlyZSgyOSk7XG52YXIgbm9vcCA9IHJlcXVpcmUoMzMpO1xudmFyIGNvbnN0YW50cyA9IHJlcXVpcmUoMjUpO1xudmFyIEVSUl9DQU5DRUxMRUQgPSBjb25zdGFudHMuRVJSX0NBTkNFTExFRDtcbnZhciBFUlJfTkVUV09SSyAgID0gY29uc3RhbnRzLkVSUl9ORVRXT1JLO1xudmFyIEVSUl9SRVNQT05TRSAgPSBjb25zdGFudHMuRVJSX1JFU1BPTlNFO1xudmFyIEVSUl9USU1FT1VUICAgPSBjb25zdGFudHMuRVJSX1RJTUVPVVQ7XG5cbi8qKlxuICogQWRkIGV2ZW50IGxpc3RlbmVycyB0byBKU09OUCByZXF1ZXN0LlxuICpcbiAqIEBwYXJhbSB7SlNPTlBSZXF1ZXN0fSByZXF1ZXN0IFRoZSBKU09OUCByZXF1ZXN0LlxuICogQHBhcmFtIHtzdHJpbmd9IGNhbGxiYWNrTmFtZSBUaGUgY2FsbGJhY2sgbmFtZSB1c2VkIHRvIGRlZmluZSB0aGUgZ2xvYmFsIEpTT05QIGNhbGxiYWNrLlxuICovXG5mdW5jdGlvbiBhZGRFdmVudExpc3RlbmVycyhyZXF1ZXN0LCBjYWxsYmFja05hbWUpIHtcbiAgICB2YXIgc2NyaXB0ID0gcmVxdWVzdC5zY3JpcHQ7XG4gICAgdmFyIG9wdGlvbnMgPSByZXF1ZXN0Lm9wdGlvbnM7XG4gICAgdmFyIHJlcXVlc3RUeXBlID0gcmVxdWVzdC5yZXF1ZXN0VHlwZTtcbiAgICB2YXIgaXNSZXNwb25zZU9rID0gb3B0aW9ucy5pc1Jlc3BvbnNlT2s7XG4gICAgdmFyIHJlc3BvbnNlID0gbmV3IEpTT05QUmVzcG9uc2UocmVxdWVzdCk7XG4gICAgdmFyIHRpbWVvdXQgPSBwYXJzZUludChvcHRpb25zLnRpbWVvdXQgfHwgMCwgMTApO1xuICAgIHZhciB0aW1lb3V0SWQgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGZ1bmN0aW9uIGZpbmlzaCB0aGUgcmVxdWVzdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBjb2RlIFRoZSBlcnJvciBjb2RlIG9uIGVycm9yLiBJZiBubyBlcnJvciBvY2N1cmVkLCB0aGUgY29kZSBpcyBgbnVsbGAuXG4gICAgICovXG4gICAgdmFyIGZpbmlzaCA9IGZ1bmN0aW9uIChjb2RlKSB7XG4gICAgICAgIC8vIFNldCBmaW5pc2ggdG8gdGhlIG5vIG9wZXJhdGlvbiBmdW5jdGlvbi5cbiAgICAgICAgZmluaXNoID0gbm9vcDtcblxuICAgICAgICAvLyBNYXJrIHRoaXMgcmVxdWVzdCBhcyBmaW5pc2hlZC5cbiAgICAgICAgcmVxdWVzdC5maW5pc2hlZCA9IHRydWU7XG5cbiAgICAgICAgLy8gQ2xlYXIgbGlzdGVuZXJzLlxuICAgICAgICB3aW5kb3dbY2FsbGJhY2tOYW1lXSA9IG5vb3A7XG4gICAgICAgIHNjcmlwdC5vbmVycm9yID0gbnVsbDtcblxuICAgICAgICAvLyBDbGVhciB0aW1lb3V0LlxuICAgICAgICBpZiAodGltZW91dElkICE9PSBudWxsKSB7XG4gICAgICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dElkKTtcbiAgICAgICAgICAgIHRpbWVvdXRJZCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBGaXJlIGNhbGxiYWNrcy5cbiAgICAgICAgZmlyZUNhbGxiYWNrcyhjb2RlLCByZXNwb25zZSk7XG4gICAgfTtcblxuICAgIC8vIERlZmluZSB0aGUgY2FsbGJhY2sgZnVuY3Rpb24uXG4gICAgd2luZG93W2NhbGxiYWNrTmFtZV0gPSBmdW5jdGlvbiAocmVzcG9uc2VKU09OKSB7XG4gICAgICAgIHJlcXVlc3QucmVzcG9uc2VKU09OID0gcmVzcG9uc2VKU09OO1xuICAgICAgICBpZiAoaXNGdW5jdGlvbihpc1Jlc3BvbnNlT2spKSB7XG4gICAgICAgICAgICBpZiAoaXNSZXNwb25zZU9rKHJlcXVlc3RUeXBlLCByZXNwb25zZSkpIHtcbiAgICAgICAgICAgICAgICBmaW5pc2gobnVsbCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGZpbmlzaChFUlJfUkVTUE9OU0UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZmluaXNoKG51bGwpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8vIENhdGNoIHRoZSBlcnJvci5cbiAgICBzY3JpcHQub25lcnJvciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZmluaXNoKEVSUl9ORVRXT1JLKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQ2FuY2VsIHRoZSByZXF1ZXN0LlxuICAgICAqL1xuICAgIHJlcXVlc3QuY2FuY2VsID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBmaW5pc2goRVJSX0NBTkNFTExFRCk7XG4gICAgfTtcblxuICAgIC8vIEFkZCB0aW1lb3V0IGxpc3RlbmVyXG4gICAgaWYgKCFpc05hTih0aW1lb3V0KSAmJiB0aW1lb3V0ID4gMCkge1xuICAgICAgICB0aW1lb3V0SWQgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGZpbmlzaChFUlJfVElNRU9VVCk7XG4gICAgICAgIH0sIHRpbWVvdXQpO1xuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBhZGRFdmVudExpc3RlbmVycztcbiIsIi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGNyZWF0ZSBKU09OUCBjYWxsYmFjayBuYW1lLlxuICpcbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEByZXR1cm5zIHtzdHJpbmd9IFJldHVybnMgdGhlIGNhbGxiYWNrIG5hbWUuXG4gKi9cbmZ1bmN0aW9uIGJ1aWxkQ2FsbGxiYWNrTmFtZShvcHRpb25zKSB7XG4gICAgdmFyIGNhbGxiYWNrTmFtZTtcblxuICAgIGRvIHtcbiAgICAgICAgY2FsbGJhY2tOYW1lID0gb3B0aW9ucy5qc29ucENhbGxiYWNrTmFtZS5jYWxsKG51bGwsIG9wdGlvbnMpO1xuICAgIH0gd2hpbGUgKGNhbGxiYWNrTmFtZSBpbiB3aW5kb3cpO1xuXG4gICAgd2luZG93W2NhbGxiYWNrTmFtZV0gPSBudWxsO1xuXG4gICAgcmV0dXJuIGNhbGxiYWNrTmFtZTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBidWlsZENhbGxsYmFja05hbWU7XG4iLCJ2YXIgYnVpbGRVUkwgPSByZXF1aXJlKDIzKTtcblxuLyoqXG4gKiBCdWlsZCB0aGUgSlNPTlAgc2NyaXB0IHNyYy5cbiAqXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9waXRvbnMuXG4gKiBAcGFyYW0ge3N0cmluZ30gY2FsbGJhY2tOYW1lIFRoZSBjYWxsYmFjayBuYW1lIG9mIHRoZSBKU09OUC5cbiAqIEByZXR1cm4ge3N0cmluZ30gUmV0dXJucyB0aGUgc2NyaXB0IHNyYy5cbiAqL1xuZnVuY3Rpb24gYnVpbGRTY3JpcHRTcmMob3B0aW9ucywgY2FsbGJhY2tOYW1lKSB7XG4gICAgdmFyIHF1ZXJ5ID0gb3B0aW9ucy5xdWVyeTtcbiAgICB2YXIga2V5ID0gb3B0aW9ucy5qc29ucDtcbiAgICB2YXIgdXJsO1xuXG4gICAgaWYgKCFxdWVyeSkge1xuICAgICAgICBxdWVyeSA9IHt9O1xuICAgICAgICBvcHRpb25zLnF1ZXJ5ID0gcXVlcnk7XG4gICAgfVxuXG4gICAgcXVlcnlba2V5XSA9IGNhbGxiYWNrTmFtZTtcbiAgICB1cmwgPSBidWlsZFVSTChvcHRpb25zKTtcblxuICAgIHJldHVybiB1cmw7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYnVpbGRTY3JpcHRTcmM7XG4iLCIvKipcbiAqIFRoZSBmdW5jdGlvbiB0byBoYW5kbGUgYG9wdGlvbnMuY29yc2Agc2V0dGluZyB3aGVuIHNlbmRpbmcgSlNPTlAgcmVxdWVzdHMuIElmIGBvcHRpb25zLmNvcnNgIGlzIGB0cnVlYCwgdGhlXG4gKiBgY3Jvc3NvcmlnaW5gIGF0dHJpYnV0ZSBvZiB0aGUgYHNjcmlwdGAgZWxlbWVudCB3ZSB1c2luZyBpcyBzZXQgdG8gYHVzZS1jcmVkZW50aWFsc2AuXG4gKlxuICogQHBhcmFtIHtIVE1MU2NyaXB0RWxlbWVudH0gc2NyaXB0IFRoZSBzY3JpcHQgZWxlbWVudC5cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqL1xuZnVuY3Rpb24gaGFuZGxlU2NyaXB0Q29ycyhzY3JpcHQsIG9wdGlvbnMpIHtcbiAgICBpZiAob3B0aW9ucy5jb3JzKSB7XG4gICAgICAgIHNjcmlwdC5zZXRBdHRyaWJ1dGUoJ2Nyb3Nzb3JpZ2luJywgJ3VzZS1jcmVkZW50aWFscycpO1xuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBoYW5kbGVTY3JpcHRDb3JzO1xuIiwidmFyIGlzUGxhaW5PYmplY3QgPSByZXF1aXJlKDM5KTtcbnZhciBpc0Z1bmN0aW9uID0gcmVxdWlyZSgzOCk7XG52YXIgaGFzT3duID0gcmVxdWlyZSgzMSk7XG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGFkZCBjdXN0b20gbWl4aW5zIHRvIHRoZSBpbnN0YW5jZSBvZiBgUmVzcG9uc2VgIG9yIGBSZXNwb25zZUVycm9yYC5cbiAqXG4gKiBAcGFyYW0ge1Jlc3BvbnNlfFJlc3BvbnNlRXJyb3J9IHRhcmdldCBUaGUgdGFyZ2V0IHRvIGFkZCB0aGUgY3VzdG9tZSBtaXhpbnMuXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcGFyYW0ge3N0cmluZ30gb3B0aW9uTmFtZSBUaGUgb3B0aW9uIG5hbWUgdGhlIG1peGlucyBjb250YWluZXIuXG4gKi9cbmZ1bmN0aW9uIGFkZEN1c3RvbU1peGluKHRhcmdldCwgb3B0aW9ucywgb3B0aW9uTmFtZSkge1xuICAgIHZhciBtaXhpbnMgPSBvcHRpb25zW29wdGlvbk5hbWVdO1xuICAgIHZhciBuYW1lO1xuICAgIHZhciBtaXhpbjtcblxuICAgIGlmIChpc1BsYWluT2JqZWN0KG1peGlucykpIHtcbiAgICAgICAgZm9yIChuYW1lIGluIG1peGlucykge1xuICAgICAgICAgICAgaWYgKGhhc093bi5jYWxsKG1peGlucywgbmFtZSkpIHtcbiAgICAgICAgICAgICAgICBtaXhpbiA9IG1peGluc1tuYW1lXTtcbiAgICAgICAgICAgICAgICBpZiAoaXNGdW5jdGlvbihtaXhpbikpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG5hbWUgaW4gdGFyZ2V0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ21peGluIG5hbWUgY29uZmxpY3QgXCInICsgbmFtZSArICdcIicpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHRhcmdldFtuYW1lXSA9IG1peGluO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBhZGRDdXN0b21NaXhpbjtcbiIsInZhciBpc0Z1bmN0aW9uID0gcmVxdWlyZSgzOCk7XG52YXIgaXNBYnNvbHV0ZVVSTCA9IHJlcXVpcmUoMzYpO1xudmFyIGlzUGxhaW5PYmplY3QgPSByZXF1aXJlKDM5KTtcblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gYnVpbGQgcmVxdWVzdCB1cmwuXG4gKlxuICogMS4gQWRkIGJhc2VVUkwgaWYgbmVlZGVkLlxuICogMi4gQ29tcGlsZSB1cmwgaWYgbmVlZGVkLlxuICogMy4gQ29tcGlsZSBxdWVyeSBzdHJpbmcgaWYgbmVlZGVkLlxuICpcbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEByZXR1cm5zIHtzdHJpbmd9IFJldHVybnMgdGhlIGZpbmFsIHVybCBzdHJpbmcuXG4gKi9cbmZ1bmN0aW9uIGJ1aWxkVVJMKG9wdGlvbnMpIHtcbiAgICB2YXIgdXJsID0gb3B0aW9ucy51cmw7XG4gICAgdmFyIGJhc2VVUkwgPSBvcHRpb25zLmJhc2VVUkw7XG4gICAgdmFyIG1vZGVsID0gb3B0aW9ucy5tb2RlbDtcbiAgICB2YXIgcXVlcnkgPSBvcHRpb25zLnF1ZXJ5O1xuICAgIHZhciBjb21waWxlVVJMID0gb3B0aW9ucy5jb21waWxlVVJMO1xuICAgIHZhciBlbmNvZGVRdWVyeVN0cmluZyA9IG9wdGlvbnMuZW5jb2RlUXVlcnlTdHJpbmc7XG4gICAgdmFyIGFycmF5O1xuXG4gICAgaWYgKHVybCA9PT0gbnVsbCB8fCB1cmwgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICB1cmwgPSAnJztcbiAgICB9XG5cbiAgICAvLyBtYWtlIHN1cmUgdGhhdCB1cmwgaXMgYSBzdHJpbmcuXG4gICAgdXJsID0gJycgKyB1cmw7XG5cbiAgICAvLyBJZiB0aGUgdXJsIGlzIG5vdCBhYnNvbHV0ZSB1cmwgYW5kIHRoZSBiYXNlVVJMIGlzIGRlZmluZWQsXG4gICAgLy8gcHJlcGVuZCB0aGUgYmFzZVVSTCB0byB0aGUgdXJsLlxuICAgIGlmICghaXNBYnNvbHV0ZVVSTCh1cmwpKSB7XG4gICAgICAgIGlmIChiYXNlVVJMID09PSBudWxsIHx8IGJhc2VVUkwgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgYmFzZVVSTCA9ICcnO1xuICAgICAgICB9XG4gICAgICAgIHVybCA9IGJhc2VVUkwgKyB1cmw7XG4gICAgfVxuXG4gICAgLy8gQ29tcGlsZSB0aGUgdXJsIGlmIG5lZWRlZC5cbiAgICBpZiAoaXNQbGFpbk9iamVjdChtb2RlbCkgJiYgaXNGdW5jdGlvbihjb21waWxlVVJMKSkge1xuICAgICAgICB1cmwgPSBjb21waWxlVVJMKHVybCwgbW9kZWwsIG9wdGlvbnMpO1xuICAgIH1cblxuICAgIC8vIENvbXBpbGUgdGhlIHF1ZXJ5IHN0cmluZy5cbiAgICBpZiAoaXNQbGFpbk9iamVjdChxdWVyeSkgJiYgaXNGdW5jdGlvbihlbmNvZGVRdWVyeVN0cmluZykpIHtcbiAgICAgICAgcXVlcnkgPSBlbmNvZGVRdWVyeVN0cmluZyhxdWVyeSwgb3B0aW9ucyk7XG4gICAgICAgIGFycmF5ID0gdXJsLnNwbGl0KCcjJyk7IC8vIFRoZXJlIG1heSBiZSBoYXNoIHN0cmluZyBpbiB0aGUgdXJsLlxuICAgICAgICB1cmwgPSBhcnJheVswXTtcblxuICAgICAgICBpZiAodXJsLmluZGV4T2YoJz8nKSA+IC0xKSB7XG4gICAgICAgICAgICBpZiAodXJsLmNoYXJBdCh1cmwubGVuZ3RoIC0gMSkgPT09ICcmJykge1xuICAgICAgICAgICAgICAgIHVybCA9IHVybCArIHF1ZXJ5O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB1cmwgPSB1cmwgKyAnJicgKyBxdWVyeTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHVybCA9IHVybCArICc/JyArIHF1ZXJ5O1xuICAgICAgICB9XG5cbiAgICAgICAgYXJyYXlbMF0gPSB1cmw7XG4gICAgICAgIHVybCA9IGFycmF5LmpvaW4oJyMnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdXJsO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGJ1aWxkVVJMO1xuIiwidmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKDM4KTtcblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gY2FsbCBgb3B0aW9ucy5vblJlcXVlc3RDcmVhdGVkYCBjYWxsYmFjay5cbiAqXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcGFyYW0ge0h0dHBSZXF1ZXN0fEpTT05QUmVxdWVzdH0gcmVxdWVzdCBUaGUgcmVxdWVzdCBpbnN0YW5jZS5cbiAqL1xuZnVuY3Rpb24gY2FsbFJlcXVlc3RDcmVhdGVkQ2FsbGJhY2sob3B0aW9ucywgcmVxdWVzdCkge1xuICAgIHZhciBvblJlcXVlc3RDcmVhdGVkID0gb3B0aW9ucy5vblJlcXVlc3RDcmVhdGVkO1xuXG4gICAgaWYgKGlzRnVuY3Rpb24ob25SZXF1ZXN0Q3JlYXRlZCkpIHtcbiAgICAgICAgb25SZXF1ZXN0Q3JlYXRlZChyZXF1ZXN0KTtcbiAgICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gY2FsbFJlcXVlc3RDcmVhdGVkQ2FsbGJhY2s7XG4iLCJleHBvcnRzLkVSUl9BQk9SVEVEID0gJ0VSUl9BQk9SVEVEJztcbmV4cG9ydHMuRVJSX1JFU1BPTlNFID0gJ0VSUl9SRVNQT05TRSc7XG5leHBvcnRzLkVSUl9DQU5DRUxMRUQgPSAnRVJSX0NBTkNFTExFRCc7XG5leHBvcnRzLkVSUl9ORVRXT1JLID0gJ0VSUl9ORVRXT1JLJztcbmV4cG9ydHMuRVJSX1RJTUVPVVQgPSAnRVJSX1RJTUVPVVQnO1xuZXhwb3J0cy5IVFRQX1JFUVVFU1QgPSAnSFRUUF9SRVFVRVNUJztcbmV4cG9ydHMuSlNPTlBfUkVRVUVTVCA9ICdKU09OUF9SRVFVRVNUJztcbiIsInZhciBDYW5jZWxDb250cm9sbGVyID0gcmVxdWlyZSgxKTtcblxuLyoqXG4gKiBDcmVhdGUgYSBuZXcgaW5zdGFuY2Ugb2YgYENhbmNlbENvbnRyb2xsZXJgLlxuICpcbiAqIEByZXR1cm5zIHtDYW5jZWxDb250cm9sbGVyfSBSZXR1cm5zIGFuIG5ldyBpbnN0YW5jZSBvZiBgQ2FuY2VsQ29udHJvbGxlcmAuXG4gKi9cbnZhciBjcmVhdGVDYW5jZWxDb250cm9sbGVyID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBuZXcgQ2FuY2VsQ29udHJvbGxlcigpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBjcmVhdGVDYW5jZWxDb250cm9sbGVyO1xuIiwidmFyIFFTID0gcmVxdWlyZSg0Myk7XG52YXIgY29uc3RhbnRzID0gcmVxdWlyZSgyNSk7XG52YXIgdGVtcGxhdGUgPSByZXF1aXJlKDM0KTtcbnZhciB1dWlkID0gcmVxdWlyZSgzNSk7XG52YXIgSFRUUF9SRVFVRVNUICA9IGNvbnN0YW50cy5IVFRQX1JFUVVFU1Q7XG5cbi8qKlxuICogQ3JlYXRlIGEgbmV3IGRlZmF1bHQgcmVxdWVzdCBvcHRpb25zLlxuICpcbiAqIEByZXR1cm5zIHtSZXF1ZXN0T3B0aW9uc30gUmV0dXJucyBhIG5ldyBkZWZhdWx0IHJlcXVlc3Qgb3BpdG9ucy5cbiAqL1xuZnVuY3Rpb24gY3JlYXRlRGVmYXVsdE9wdGlvbnMoKSB7XG4gICAgLyplc2xpbnQgbm8tdW51c2VkLXZhcnM6IFtcImVycm9yXCIsIHsgXCJhcmdzXCI6IFwibm9uZVwiIH1dKi9cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7UmVxdWVzdE9wdGlvbnN9XG4gICAgICovXG4gICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgICAgIGJhc2VVUkw6ICcnLFxuICAgICAgICB1cmw6ICcnLFxuICAgICAgICBtb2RlbDogbnVsbCxcbiAgICAgICAgcXVlcnk6IG51bGwsXG4gICAgICAgIGhlYWRlcnM6IG51bGwsXG4gICAgICAgIGJvZHk6IG51bGwsXG4gICAgICAgIHRpbWVvdXQ6IDAsXG4gICAgICAgIGNvcnM6IGZhbHNlLFxuICAgICAgICBub0NhY2hlOiBmYWxzZSxcbiAgICAgICAgbm9DYWNoZUhlYWRlcnM6IHtcbiAgICAgICAgICAgICdQcmFnbWEnOiAnbm8tY2FjaGUnLFxuICAgICAgICAgICAgJ0NhY2hlLUNvbnRyb2wnOiAnbm8tY2FjaGUsIG5vLXN0b3JlLCBtdXN0LXJldmFsaWRhdGUnXG4gICAgICAgIH0sXG4gICAgICAgIGpzb25wOiAnY2FsbGJhY2snLFxuICAgICAgICBzZXR0aW5nczoge30sXG4gICAgICAgIGNvbnRyb2xsZXI6IG51bGwsXG4gICAgICAgIHJlcXVlc3RGdW5jdGlvbk5hbWU6IG51bGwsXG4gICAgICAgIHJlcXVlc3RUeXBlOiBudWxsLFxuICAgICAgICB4aHJQcm9wczogbnVsbCxcbiAgICAgICAgdXNlcm5hbWU6IG51bGwsXG4gICAgICAgIHBhc3N3b3JkOiBudWxsLFxuICAgICAgICBodHRwUmVxdWVzdEJvZHlQcm9jZXNzb3I6IHtcbiAgICAgICAgICAgIHJhdzoge1xuICAgICAgICAgICAgICAgIHByaW9yaXR5OiAwLFxuICAgICAgICAgICAgICAgIGhlYWRlcnM6IG51bGwsXG4gICAgICAgICAgICAgICAgcHJvY2Vzc29yOiBudWxsLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGZvcm06IHtcbiAgICAgICAgICAgICAgICBwcmlvcml0eTogMSxcbiAgICAgICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkOyBjaGFyc2V0PVVURi04J1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcHJvY2Vzc29yOiBmdW5jdGlvbiAoZGF0YSwgb3B0aW9ucykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gUVMuZW5jb2RlKGRhdGEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBqc29uOiB7XG4gICAgICAgICAgICAgICAgcHJpb3JpdHk6IDIsXG4gICAgICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb247IGNoYXJzZXQ9VVRGLTgnXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBwcm9jZXNzb3I6IGZ1bmN0aW9uIChkYXRhLCBvcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShkYXRhKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGh0dHBSZXNwb25zZU1peGluOiB7XG4gICAgICAgICAgICBqc29uOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgLy8gYHRoaXNgIGlzIHBvaW50IHRvIHRoZSBjdXJyZW50IGluc3RhbmNlIG9mIGBIdHRwUmVzcG9uc2VgLlxuICAgICAgICAgICAgICAgIHZhciByZXNwb25zZVRleHQgPSB0aGlzLnJlcXVlc3QueGhyLnJlc3BvbnNlVGV4dDtcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzcG9uc2VUZXh0ID8gSlNPTi5wYXJzZShyZXNwb25zZVRleHQpIDogbnVsbDtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB0ZXh0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucmVxdWVzdC54aHIucmVzcG9uc2VUZXh0O1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHN0YXR1czogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnJlcXVlc3QueGhyLnN0YXR1cztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAganNvbnBSZXNwb25zZU1peGluOiB7XG4gICAgICAgICAgICBqc29uOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucmVxdWVzdC5yZXNwb25zZUpTT047XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGh0dHBSZXNwb25zZUVycm9yTWl4aW46IG51bGwsXG4gICAgICAgIGpzb25wUmVzcG9uc2VFcnJvck1peGluOiBudWxsLFxuICAgICAgICBoYW5kbGVPcHRpb25zOiBudWxsLFxuICAgICAgICBjcmVhdGVYSFI6IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgICAgIH0sXG4gICAgICAgIGNyZWF0ZVNjcmlwdDogZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgICAgIHZhciBzY3JpcHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzY3JpcHQnKTtcblxuICAgICAgICAgICAgc2NyaXB0LnNldEF0dHJpYnV0ZSgndHlwZScsICd0ZXh0L2phdmFzY3JpcHQnKTtcbiAgICAgICAgICAgIHNjcmlwdC5zZXRBdHRyaWJ1dGUoJ2NoYXJzZXQnLCAndXRmLTgnKTtcblxuICAgICAgICAgICAgcmV0dXJuIHNjcmlwdDtcbiAgICAgICAgfSxcbiAgICAgICAganNvbnBDb250YWluZXJOb2RlOiBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICAgICAgcmV0dXJuIGRvY3VtZW50LmhlYWQgfHwgZG9jdW1lbnQuZ2V0RWxlbWVudHNCeU5hbWUoJ2hlYWQnKVswXTtcbiAgICAgICAgfSxcbiAgICAgICAganNvbnBDYWxsYmFja05hbWU6IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgICAgICByZXR1cm4gJ2pzb25wXycgKyB1dWlkKCkgKyAnXycgKyAobmV3IERhdGUoKS5nZXRUaW1lKCkpO1xuICAgICAgICB9LFxuICAgICAgICBjb21waWxlVVJMOiBmdW5jdGlvbiAodXJsLCBtb2RlbCwgb3B0aW9ucykge1xuICAgICAgICAgICAgcmV0dXJuIHRlbXBsYXRlKHVybCwgbW9kZWwpO1xuICAgICAgICB9LFxuICAgICAgICBlbmNvZGVRdWVyeVN0cmluZzogZnVuY3Rpb24gKHF1ZXJ5LCBvcHRpb25zKSB7XG4gICAgICAgICAgICByZXR1cm4gUVMuZW5jb2RlKHF1ZXJ5KTtcbiAgICAgICAgfSxcbiAgICAgICAgb25YaHJDcmVhdGVkOiBudWxsLFxuICAgICAgICBvblhock9wZW5lZDogbnVsbCxcbiAgICAgICAgb25YaHJTZW50OiBudWxsLFxuICAgICAgICBvblJlcXVlc3RDcmVhdGVkOiBudWxsLFxuICAgICAgICBpc1Jlc3BvbnNlT2s6IGZ1bmN0aW9uIChyZXF1ZXN0VHlwZSwgcmVzcG9uc2UpIHtcbiAgICAgICAgICAgIHZhciBpc09rO1xuICAgICAgICAgICAgdmFyIHN0YXR1cztcblxuICAgICAgICAgICAgLy8gSHR0cCByZXF1ZXN0XG4gICAgICAgICAgICBpZiAocmVxdWVzdFR5cGUgPT09IEhUVFBfUkVRVUVTVCkge1xuICAgICAgICAgICAgICAgIHN0YXR1cyA9ICtyZXNwb25zZS5yZXF1ZXN0Lnhoci5zdGF0dXM7XG4gICAgICAgICAgICAgICAgaXNPayA9IChzdGF0dXMgPj0gMjAwICYmIHN0YXR1cyA8IDMwMCkgfHwgc3RhdHVzID09PSAzMDQ7XG4gICAgICAgICAgICAvLyBKU09OUCByZXF1ZXN0XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlzT2sgPSB0cnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gaXNPaztcbiAgICAgICAgfSxcbiAgICAgICAgdHJhbnNmb3JtRXJyb3I6IG51bGwsXG4gICAgICAgIHRyYW5zZm9ybVJlc3BvbnNlOiBudWxsLFxuICAgICAgICBzaG91bGRDYWxsRXJyb3JDYWxsYmFjazogbnVsbCxcbiAgICAgICAgc2hvdWxkQ2FsbFN1Y2Nlc3NDYWxsYmFjazogbnVsbFxuICAgIH07XG5cbiAgICByZXR1cm4gb3B0aW9ucztcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBjcmVhdGVEZWZhdWx0T3B0aW9ucztcbiIsIi8qKlxuICogRGVmaW5lIGEgc3RhdGljIG1lbWJlciBvbiB0aGUgZ2l2ZW4gY29uc3RydWN0b3IgYW5kIGl0cyBwcm90b3R5cGVcbiAqXG4gKiBAcGFyYW0ge0NvbnN0cnVjdG9yfSBjdG9yIFRoZSBjb25zdHJ1Y3RvciB0byBkZWZpbmUgdGhlIHN0YXRpYyBtZW1iZXJcbiAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIFRoZSBuYW1lIG9mIHRoZSBzdGF0aWMgbWVtYmVyXG4gKiBAcGFyYW0ge2FueX0gdmFsdWUgVGhlIHZhbHVlIG9mIHRoZSBzdGF0aWMgbWVtYmVyXG4gKiBAdGhyb3dzIHtFcnJvcn0gVGhyb3dzIGVycm9yIGlmIHRoZSBuYW1lIGhhcyBhbHJlYWR5IGV4aXN0ZWQsIG9yIHRoZSBjb25zdHJ1Y3RvciBpcyBub3QgYSBmdW5jdGlvblxuICovXG5mdW5jdGlvbiBkZWZpbmVFeHBvcnRzKGN0b3IsIG5hbWUsIHZhbHVlKSB7XG4gICAgY3Rvci5wcm90b3R5cGUuZXhwb3J0cyA9IGN0b3IuZXhwb3J0cyA9IGN0b3IuZXhwb3J0cyB8fCB7fTtcbiAgICBjdG9yLmV4cG9ydHNbbmFtZV0gPSB2YWx1ZTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBkZWZpbmVFeHBvcnRzO1xuIiwidmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKDM4KTtcbnZhciBIdHRwUmVzcG9uc2VFcnJvciA9IHJlcXVpcmUoNSk7XG52YXIgSlNPTlBSZXNwb25zZUVycm9yID0gcmVxdWlyZSg4KTtcbnZhciBjb25zdGFudHMgPSByZXF1aXJlKDI1KTtcbnZhciBIVFRQX1JFUVVFU1QgPSBjb25zdGFudHMuSFRUUF9SRVFVRVNUO1xuXG4vKipcbiAqIEZpcmUgdGhlIGNhbGxiYWNrcy5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ3xudWxsfSBjb2RlIElmIHRoZXJlIGlzIGFuIGVycm9yLCBgY29kZWAgc2hvdWxkIGJlIGEgc3RyaW5nLiBJZiB0aGVyZSBpcyBubyBlcnJvciwgYGNvZGVgIGlzIGBudWxsYC5cbiAqIEBwYXJhbSB7SHR0cFJlc3BvbnNlfEpTT05QUmVzcG9uc2V9IHJlc3BvbnNlIFRoZSByZXNwb25zZSBpbnN0YW5jZS5cbiAqL1xuZnVuY3Rpb24gZmlyZUNhbGxiYWNrcyhjb2RlLCByZXNwb25zZSkge1xuICAgIHZhciByZXF1ZXN0ID0gcmVzcG9uc2UucmVxdWVzdDtcbiAgICB2YXIgcmVxdWVzdFR5cGUgPSByZXF1ZXN0LnJlcXVlc3RUeXBlO1xuICAgIHZhciBvcHRpb25zID0gcmVxdWVzdC5vcHRpb25zO1xuICAgIHZhciBvbnN1Y2Nlc3MgPSByZXF1ZXN0Lm9uc3VjY2VzcztcbiAgICB2YXIgb25lcnJvciA9IHJlcXVlc3Qub25lcnJvcjtcbiAgICB2YXIgc2hvdWxkQ2FsbEVycm9yQ2FsbGJhY2sgPSBvcHRpb25zLnNob3VsZENhbGxFcnJvckNhbGxiYWNrO1xuICAgIHZhciBzaG91bGRDYWxsU3VjY2Vzc0NhbGxiYWNrID0gb3B0aW9ucy5zaG91bGRDYWxsU3VjY2Vzc0NhbGxiYWNrO1xuICAgIHZhciB0cmFuc2Zvcm1FcnJvciA9IG9wdGlvbnMudHJhbnNmb3JtRXJyb3I7XG4gICAgdmFyIHRyYW5zZm9ybVJlc3BvbnNlID0gb3B0aW9ucy50cmFuc2Zvcm1SZXNwb25zZTtcblxuICAgIHZhciBlcnJvciA9IG51bGw7XG4gICAgdmFyIGNhbGxFcnJvckNhbGxiYWNrID0gdHJ1ZTtcbiAgICB2YXIgY2FsbFN1Y2Nlc3NDYWxsYmFjayA9IHRydWU7XG4gICAgdmFyIHRyYW5zZm9ybWVkRXJyb3IgPSBudWxsO1xuICAgIHZhciB0cmFuc2Zvcm1lZFJlc3BvbnNlID0gbnVsbDtcblxuICAgIGlmIChjb2RlKSB7XG4gICAgICAgIGlmIChyZXF1ZXN0VHlwZSA9PT0gSFRUUF9SRVFVRVNUKSB7XG4gICAgICAgICAgICBlcnJvciA9IG5ldyBIdHRwUmVzcG9uc2VFcnJvcihjb2RlLCByZXF1ZXN0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGVycm9yID0gbmV3IEpTT05QUmVzcG9uc2VFcnJvcihjb2RlLCByZXF1ZXN0KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaXNGdW5jdGlvbih0cmFuc2Zvcm1FcnJvcikpIHtcbiAgICAgICAgICAgIHRyYW5zZm9ybWVkRXJyb3IgPSB0cmFuc2Zvcm1FcnJvcihyZXF1ZXN0VHlwZSwgZXJyb3IpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdHJhbnNmb3JtZWRFcnJvciA9IGVycm9yO1xuICAgICAgICB9XG4gICAgICAgIGlmIChpc0Z1bmN0aW9uKHNob3VsZENhbGxFcnJvckNhbGxiYWNrKSkge1xuICAgICAgICAgICAgY2FsbEVycm9yQ2FsbGJhY2sgPSBzaG91bGRDYWxsRXJyb3JDYWxsYmFjayhyZXF1ZXN0VHlwZSwgdHJhbnNmb3JtZWRFcnJvciwgZXJyb3IpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjYWxsRXJyb3JDYWxsYmFjaykge1xuICAgICAgICAgICAgaWYgKGlzRnVuY3Rpb24ob25lcnJvcikpIHtcbiAgICAgICAgICAgICAgICBvbmVycm9yKHRyYW5zZm9ybWVkRXJyb3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKGlzRnVuY3Rpb24odHJhbnNmb3JtUmVzcG9uc2UpKSB7XG4gICAgICAgICAgICB0cmFuc2Zvcm1lZFJlc3BvbnNlID0gdHJhbnNmb3JtUmVzcG9uc2UocmVxdWVzdFR5cGUsIHJlc3BvbnNlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRyYW5zZm9ybWVkUmVzcG9uc2UgPSByZXNwb25zZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaXNGdW5jdGlvbihzaG91bGRDYWxsU3VjY2Vzc0NhbGxiYWNrKSkge1xuICAgICAgICAgICAgY2FsbFN1Y2Nlc3NDYWxsYmFjayA9IHNob3VsZENhbGxTdWNjZXNzQ2FsbGJhY2socmVxdWVzdFR5cGUsIHRyYW5zZm9ybWVkUmVzcG9uc2UsIHJlc3BvbnNlKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2FsbFN1Y2Nlc3NDYWxsYmFjaykge1xuICAgICAgICAgICAgaWYgKGlzRnVuY3Rpb24ob25zdWNjZXNzKSkge1xuICAgICAgICAgICAgICAgIG9uc3VjY2Vzcyh0cmFuc2Zvcm1lZFJlc3BvbnNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBmaXJlQ2FsbGJhY2tzO1xuIiwidmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKDM4KTtcblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gcHJvY2VzcyB0aGUgcmVxdWVzdCBvcHRpb25zLiBUaGlzIGZ1bmN0aW9uIHdpbGwgY2FsbCB0aGUgZnVuY3Rpb24gYG9wdGlvbnMuaGFuZGxlT3B0aW9uc2AuXG4gKlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICogQHJldHVybnMge3ZvaWR9XG4gKi9cbmZ1bmN0aW9uIGhhbmRsZU9wdGlvbnMob3B0aW9ucykge1xuICAgIGlmIChpc0Z1bmN0aW9uKG9wdGlvbnMuaGFuZGxlT3B0aW9ucykpIHtcbiAgICAgICAgb3B0aW9ucy5oYW5kbGVPcHRpb25zKG9wdGlvbnMpO1xuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBoYW5kbGVPcHRpb25zO1xuIiwibW9kdWxlLmV4cG9ydHMgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuIiwiLyoqXG4gKiBNYWtlIGBTdWJDbGFzc2AgZXh0ZW5kIGBTdXBlckNsYXNzYC5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBTdWJDbGFzcyBUaGUgc3ViIGNsYXNzIGNvbnN0cnVjdG9yLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gU3VwZXJDbGFzcyBUaGUgc3VwZXIgY2xhc3MgY29uc3RydWN0b3IuXG4gKi9cbmZ1bmN0aW9uIGluaGVyaXRzKFN1YkNsYXNzLCBTdXBlckNsYXNzKSB7XG4gICAgdmFyIEYgPSBmdW5jdGlvbigpIHt9O1xuXG4gICAgRi5wcm90b3R5cGUgPSBTdXBlckNsYXNzLnByb3RvdHlwZTtcblxuICAgIFN1YkNsYXNzLnByb3RvdHlwZSA9IG5ldyBGKCk7XG4gICAgU3ViQ2xhc3MucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gU3ViQ2xhc3M7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaW5oZXJpdHM7XG4iLCIvKipcbiAqIFRoZSBubyBvcGVyYXRpb24gZnVuY3Rpb24uXG4gKi9cbmZ1bmN0aW9uIG5vb3AoKSB7XG4gICAgLy8gbm90aGluZyB0byBkbyBoZXJlLlxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IG5vb3A7XG4iLCJ2YXIgVF9TVFIgPSAxO1xudmFyIFRfRVhQID0gMjtcblxuLyoqXG4gKiBBIHNpbXBsZSB0ZW1wbGF0ZSBmdW5jdGlvblxuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBScmV0dXJucyAnL3Bvc3QvMSdcbiAqIHRlbXBsYXRlKCcvcG9zdC97IHBvc3QuaWQgfScsIHsgcG9zdDogeyBpZDogMSB9IH0pXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IHRlbXBsYXRlIFRoZSB0ZW1wbGF0ZSB0ZXh0LlxuICogQHBhcmFtIHtPYmplY3QuPHN0cmluZywgKj59IGRhdGEgVGhlIGRhdGEgb2JqZWN0LlxuICogQHBhcmFtIHtUZW1wbGF0ZU9wdGlvbnN9IG9wdGlvbnMgVGhlIHRlbXBsYXRlIG9wdGlvbnMuXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBSZXR1cm5zIHRoZSBjb21waWxlZCB0ZXh0LlxuICovXG5mdW5jdGlvbiB0ZW1wbGF0ZSh0ZW1wbGF0ZSwgZGF0YSwgb3B0aW9ucykge1xuICAgIC8vIFRyZWF0IG51bGwgKG51bGwgPT0gdW5kZWZpbmVkKSBhcyBlbXB0eSBzdHJpbmcuXG4gICAgdmFyIHRlbXBsID0gdGVtcGxhdGUgPT0gbnVsbCA/ICcnIDogKHRlbXBsYXRlICsgJycpO1xuICAgIHZhciBtb2RlbCA9IGRhdGEgfHwge307XG4gICAgdmFyIG9wdHMgPSBvcHRpb25zIHx8IHt9O1xuICAgIHZhciBzdGFydCA9IG9wdHMuc3RhcnQgfHwgJ3snO1xuICAgIHZhciBlbmQgPSBvcHRzLmVuZCB8fCAnfSc7XG4gICAgdmFyIGVuY29kZSA9IG9wdHMuZW5jb2RlIHx8IGVuY29kZVVSSUNvbXBvbmVudDtcbiAgICB2YXIgcmVzdWx0ID0gcGFyc2UodGVtcGwsIHN0YXJ0LCBlbmQsIGZ1bmN0aW9uIChleHByKSB7XG4gICAgICAgIHZhciBmaXJzdCA9IGV4cHIuY2hhckF0KDApO1xuICAgICAgICB2YXIgc2Vjb25kID0gZXhwci5jaGFyQXQoMSk7XG4gICAgICAgIHZhciByYXcgPSBmYWxzZTtcblxuICAgICAgICBpZiAoZmlyc3QgPT09ICctJyAmJiBzZWNvbmQgPT09ICcgJykge1xuICAgICAgICAgICAgcmF3ID0gdHJ1ZTtcbiAgICAgICAgICAgIGV4cHIgPSBleHByLnN1YnN0cigyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGV4cHIgPSBleHByLnJlcGxhY2UoL15cXHMrfFxccyskL2csICcnKTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdHlwZTogVF9FWFAsXG4gICAgICAgICAgICB0ZXh0OiBleHByLFxuICAgICAgICAgICAgcmF3OiByYXdcbiAgICAgICAgfTtcbiAgICB9KTtcblxuICAgIHZhciByZW5kZXIgPSBjb21waWxlKHJlc3VsdCwgZW5jb2RlKTtcblxuICAgIHRyeSB7XG4gICAgICAgIHJldHVybiByZW5kZXIobW9kZWwpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDb21waWxlIEVycm9yOlxcblxcbicgKyB0ZW1wbGF0ZSArICdcXG5cXG4nICsgZS5tZXNzYWdlKTtcbiAgICB9XG59XG5cbi8qKlxuICogQ29tcGlsZSB0aGUgcmVzdWx0IG9mIGBwYXJzZWAgdG8gYSBmdW5jdGlvbi5cbiAqXG4gKiBAcGFyYW0ge09iamVjdC48c3RyaW5nLCAqPltdfSByZXN1bHQgVGhlIGFic3RyYWN0IHN5bnRheCB0cmVlLlxuICogQHBhcmFtIHsoc3RyOiBzdHJpbmcpID0+IHN0cmluZ30gZW5jb2RlIFRoZSBmdW5jdGlvbiB0byBlbmNvZGUgdGhlIHN0cmluZy5cbiAqIEByZXR1cm5zIHsobW9kZWw6IE9iamVjdC48c3RyaW5nLCAqPikgPT4gc3RyaW5nfSBSZXR1cm5zIGEgZnVuY3Rpb24gdGhhdCBjb21waWxlIGRhdGEgdG8gc3RyaW5nLlxuICovXG5mdW5jdGlvbiBjb21waWxlKHJlc3VsdCwgZW5jb2RlKSB7XG4gICAgdmFyIGZuO1xuICAgIHZhciBsaW5lO1xuICAgIHZhciBsaW5lcyA9IFtdO1xuICAgIHZhciBpID0gMDtcbiAgICB2YXIgbCA9IHJlc3VsdC5sZW5ndGg7XG5cbiAgICBsaW5lcy5wdXNoKCd2YXIgX19vPVtdJyk7XG4gICAgbGluZXMucHVzaCgnd2l0aChfX3MpeycpO1xuXG4gICAgZm9yICggOyBpIDwgbDsgKytpKSB7XG4gICAgICAgIGxpbmUgPSByZXN1bHRbaV07XG5cbiAgICAgICAgaWYgKGxpbmUudHlwZSA9PT0gVF9TVFIpIHtcbiAgICAgICAgICAgIGxpbmVzLnB1c2goJ19fby5wdXNoKCcgKyBKU09OLnN0cmluZ2lmeShsaW5lLnRleHQpICsgJyknKTtcbiAgICAgICAgfSBlbHNlIGlmIChsaW5lLnR5cGUgPT09IFRfRVhQICYmIGxpbmUudGV4dCkge1xuICAgICAgICAgICAgaWYgKGxpbmUucmF3KSB7XG4gICAgICAgICAgICAgICAgbGluZXMucHVzaCgnX19vLnB1c2goJyArIGxpbmUudGV4dCArICcpJyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGxpbmVzLnB1c2goJ19fby5wdXNoKF9fZSgnICsgbGluZS50ZXh0ICsgJykpJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBsaW5lcy5wdXNoKCd9Jyk7XG4gICAgbGluZXMucHVzaCgncmV0dXJuIF9fby5qb2luKFwiXCIpJyk7XG5cbiAgICBmbiA9IG5ldyBGdW5jdGlvbignX19zJywgJ19fZScsIGxpbmVzLmpvaW4oJ1xcbicpKTtcblxuICAgIHJldHVybiBmdW5jdGlvbiAobW9kZWwpIHtcbiAgICAgICAgcmV0dXJuIGZuKG1vZGVsLCBmdW5jdGlvbiAodmFsKSB7XG4gICAgICAgICAgICByZXR1cm4gKHZhbCA9PT0gbnVsbCB8fCB2YWwgPT09IHVuZGVmaW5lZCkgPyAnJyA6IGVuY29kZSh2YWwgKyAnJyk7XG4gICAgICAgIH0pO1xuICAgIH07XG59XG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIHBhcnNlIHRoZSB0ZW1wbGF0ZSBzdHJpbmcuXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IHRlbXBsYXRlIFRoZSB0ZW1wbGF0ZSBzdHJpbmcgdG8gcGFyc2UuXG4gKiBAcGFyYW0ge3N0cmluZ30gb3BlbmluZ1RhZyBUaGUgb3BlbmluZyB0YWcsIGZvciBleGFtcGxlIGB7e2AuXG4gKiBAcGFyYW0ge3N0cmluZ30gY2xvc2luZ1RhZyBUaGUgY2xvc2luZyB0YWcsIGZvciBleGFtcGxlIGB9fWAuXG4gKiBAcGFyYW0geyhleHByOiBzdHJpbmcpID0+IE9iamVjdC48c3RyaW5nLCAqPn0gaGFuZGxlRXhwciBUaGUgZnVuY3Rpb24gdG8gaGFuZGxlIGVhY2ggZXhwcmVzc2lvbi5cbiAqIEByZXR1cm5zIHtPYmplY3QuPHN0cmluZywgKj5bXX0gUmV0dXJucyB0aGUgcGFyc2VkIHJlc3VsdC5cbiAqL1xuZnVuY3Rpb24gcGFyc2UodGVtcGxhdGUsIG9wZW5pbmdUYWcsIGNsb3NpbmdUYWcsIGhhbmRsZUV4cHIpIHtcbiAgICB2YXIgcmVzO1xuICAgIHZhciB0ZW1wbCA9IHRlbXBsYXRlO1xuICAgIHZhciByZWdPcGVuaW5nVGFnID0gY3JlYXRlUmVnRXhwKG9wZW5pbmdUYWcpO1xuICAgIHZhciByZWdDbG9zaW5nVGFnID0gY3JlYXRlUmVnRXhwKGNsb3NpbmdUYWcpO1xuICAgIHZhciBFUlJfVU5FWFBFQ1RFRF9FTkQgPSAnVW5leHBlY3RlZCBlbmQnO1xuICAgIHZhciB0eXBlID0gVF9TVFI7XG4gICAgdmFyIHN0ckNhY2hlID0gW107XG4gICAgdmFyIGV4cENhY2hlID0gW107XG4gICAgdmFyIG91dHB1dCA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgYFJlZ0V4cGAgZm9yIHRoZSBnaXZlbiB0YWcuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdGFnIFRoZSB0YWcgdG8gY3JlYXRlIGEgYFJlZ0V4cGAuXG4gICAgICogQHJldHVybnMge1JlZ0V4cH0gUmV0dXJucyBhbiBpbnN0YW5jZSBvZiBgUmVnRXhwYC5cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBjcmVhdGVSZWdFeHAodGFnKSB7XG4gICAgICAgIHZhciByZWdDaGFycyA9IC9bXFxcXHx7fSgpW1xcXS4qKz9eJF0vZztcbiAgICAgICAgdmFyIGVzY2FwZWRUYWcgPSB0YWcucmVwbGFjZShyZWdDaGFycywgZnVuY3Rpb24gKGNoYXIpIHtcbiAgICAgICAgICAgIHJldHVybiAnXFxcXCcgKyBjaGFyO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIG5ldyBSZWdFeHAoJyhcXFxcXFxcXCopJyArIGVzY2FwZWRUYWcpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZsdXNoIHRoZSB0ZXh0IGluIGBzdHJDYWNoZWAgaW50byBgb3V0cHV0YCBhbmQgcmVzZXQgYHN0ckNhY2hlYC5cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBmbHVzaFN0cigpIHtcbiAgICAgICAgb3V0cHV0LnB1c2goe1xuICAgICAgICAgICAgdHlwZTogVF9TVFIsXG4gICAgICAgICAgICB0ZXh0OiBzdHJDYWNoZS5qb2luKCcnKVxuICAgICAgICB9KTtcbiAgICAgICAgc3RyQ2FjaGUgPSBbXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGbHVzaCB0aGUgdGV4dCBpbiBgZXhwQ2FjaGVgIGludG8gYG91dHB1dGAgYW5kIHJlc2V0IGBleHBDYWNoZWAuXG4gICAgICovXG4gICAgZnVuY3Rpb24gZmx1c2hFeHAoKSB7XG4gICAgICAgIG91dHB1dC5wdXNoKGhhbmRsZUV4cHIoZXhwQ2FjaGUuam9pbignJykpKTtcbiAgICAgICAgZXhwQ2FjaGUgPSBbXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVjayB3aGV0aGVyIHRoZSB0YWcgaXMgZXNjYXBlZC4gSWYgaXQgaXMsIHB1dCBpcyB0byB0aGUgY2FjaGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge09iamVjdC48c3RyaW5nLCAqPn0gcmVzIFRoZSByZXN1bHQgb2YgYFJlZ0V4cCNleGVjYC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdGFnIFRoZSB0YWcgdG8gZXNjYXBlLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nW119IGNhY2hlIFRoZSBhcnJheSB0byBzYXZlIGVzY2FwZWQgdGV4dC5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgb24gaXQgaXMgTk9UIGVzY2FwZWQuXG4gICAgICovXG4gICAgZnVuY3Rpb24gZXNjKHJlcywgdGFnLCBjYWNoZSkge1xuICAgICAgICB2YXIgc2xhc2hlcyA9IHJlc1sxXSB8fCAnJztcbiAgICAgICAgdmFyIGNvdW50ID0gc2xhc2hlcy5sZW5ndGg7XG5cbiAgICAgICAgaWYgKGNvdW50ICUgMiA9PT0gMCkge1xuICAgICAgICAgICAgaWYgKGNvdW50KSB7XG4gICAgICAgICAgICAgICAgY2FjaGUucHVzaChzbGFzaGVzLnN1YnN0cihjb3VudCAvIDIpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKGNvdW50ID4gMSkge1xuICAgICAgICAgICAgICAgIGNhY2hlLnB1c2goc2xhc2hlcy5zdWJzdHIoKGNvdW50ICsgMSkgLyAyKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYWNoZS5wdXNoKHRhZyk7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB3aGlsZSAodGVtcGwubGVuZ3RoKSB7XG4gICAgICAgIGlmICh0eXBlID09PSBUX1NUUikge1xuICAgICAgICAgICAgcmVzID0gcmVnT3BlbmluZ1RhZy5leGVjKHRlbXBsKTtcbiAgICAgICAgICAgIGlmIChyZXMpIHtcbiAgICAgICAgICAgICAgICBzdHJDYWNoZS5wdXNoKHRlbXBsLnN1YnN0cigwLCByZXMuaW5kZXgpKTtcbiAgICAgICAgICAgICAgICB0ZW1wbCA9IHRlbXBsLnN1YnN0cihyZXMuaW5kZXggKyByZXNbMF0ubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICBpZiAoZXNjKHJlcywgb3BlbmluZ1RhZywgc3RyQ2FjaGUpKSB7XG4gICAgICAgICAgICAgICAgICAgIGZsdXNoU3RyKCk7XG4gICAgICAgICAgICAgICAgICAgIHR5cGUgPSBUX0VYUDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0ZW1wbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKEVSUl9VTkVYUEVDVEVEX0VORCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHN0ckNhY2hlLnB1c2godGVtcGwpO1xuICAgICAgICAgICAgICAgIGZsdXNoU3RyKCk7XG4gICAgICAgICAgICAgICAgdGVtcGwgPSAnJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHsgLy8gaWYgKHR5cGUgPT09IFRfRVhQKVxuICAgICAgICAgICAgcmVzID0gcmVnQ2xvc2luZ1RhZy5leGVjKHRlbXBsKTtcbiAgICAgICAgICAgIGlmIChyZXMpIHtcbiAgICAgICAgICAgICAgICBleHBDYWNoZS5wdXNoKHRlbXBsLnN1YnN0cigwLCByZXMuaW5kZXgpKTtcbiAgICAgICAgICAgICAgICB0ZW1wbCA9IHRlbXBsLnN1YnN0cihyZXMuaW5kZXggKyByZXNbMF0ubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICBpZiAoZXNjKHJlcywgY2xvc2luZ1RhZywgZXhwQ2FjaGUpKSB7XG4gICAgICAgICAgICAgICAgICAgIGZsdXNoRXhwKCk7XG4gICAgICAgICAgICAgICAgICAgIHR5cGUgPSBUX1NUUjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihFUlJfVU5FWFBFQ1RFRF9FTkQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG91dHB1dDtcbn1cblxuLyoqXG4gKiBAdHlwZWRlZiB7T2JqZWN0LjxzdHJpbmcsICo+fSBUZW1wbGF0ZU9wdGlvbnNcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbc3RhcnRdIFRoZSBzdGFydCB0YWcgb2YgdGhlIHRlbXBsYXRlLCBkZWZhdWx0IGlzIGB7YC5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbZW5kXSBUaGUgZW5kIHRhZyBvZiB0aGUgdGVtcGxhdGUsIGRlZmF1bHQgaXMgYH1gLlxuICogQHByb3BlcnR5IHsodmFsdWU6IHN0cmluZykgPT4gc3RyaW5nfSBbZW5jb2RlXSBUaGUgZnVuY3Rpb24gdG8gZW5jb2RlIHRoZSBzdHJpbmcsIGRlZmF1bHQgaXMgYGVuY29kZVVSSUNvbXBvbmVudGAuXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSB0ZW1wbGF0ZTtcbiIsInZhciBpZCA9IDA7XG5cbi8qKlxuICogUmV0dXJucyBhIG51bWJlciB0aGF0IGdyZWF0ZXIgdGhhbiB0aGUgcHJpdm91cyBvbmUsIHN0YXJ0aW5nIGZvcm0gYDFgLlxuICpcbiAqIEByZXR1cm5zIHtudW1iZXJ9XG4gKi9cbmZ1bmN0aW9uIHV1aWQoKSB7XG4gICAgaWQgKz0gMTtcbiAgICByZXR1cm4gaWQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gdXVpZDtcbiIsIi8qKlxuICogQ2hlY2sgd2hldGhlciB0aGUgdXJsIGlzIGFic29sdXRlIHVybC5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gdXJsIFRoZSB1cmwgc3RyaW5nIHRvIGNoZWNrXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIHVybCBpcyBhYm9zb2x1dGUsIG90aGVyd2lzZSBgZmFsc2VgIGlzIHJldHVybmVkXG4gKi9cbmZ1bmN0aW9uIGlzQWJzb2x1dGVVUkwodXJsKSB7XG4gICAgcmV0dXJuIC9eKD86W2Etel1bYS16MC05XFwtXFwuXFwrXSo6KT9cXC9cXC8vaS50ZXN0KHVybCk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaXNBYnNvbHV0ZVVSTDtcbiIsInZhciB0b1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG5cbi8qKlxuICogQ2hlY2sgd2hldGhlciB0aGUgdmFyaWFibGUgaXMgYW4gaW5zdGFuY2Ugb2YgYEFycmF5YFxuICpcbiAqIEBwYXJhbSB7YW55fSBpdCBUaGUgdmFyaWFibGUgdG8gY2hlY2tcbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgdmFyaWFibGUgaXMgYW4gaW5zdGFuY2Ugb2YgYEFycmF5YCwgb3RoZXJ3aXNlIGBmYWxzZWAgaXMgcmV0dXJuZWRcbiAqL1xuZnVuY3Rpb24gaXNBcnJheShpdCkge1xuICAgIHJldHVybiB0b1N0cmluZy5jYWxsKGl0KSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpc0FycmF5O1xuIiwidmFyIHRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcblxuLyoqXG4gKiBDaGVjayB3aGV0aGVyIHRoZSB2YXJpYWJsZSBpcyBhIGZ1bmN0aW9uXG4gKlxuICogQHBhcmFtIHthbnl9IGl0IFRoZSB2YXJpYWJsZSB0byBjaGVja1xuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSB2YXJpYWJsZSBpcyBhIGZ1bmN0aW9uLCBvdGhlcndpc2UgYGZhbHNlYCBpcyByZXR1cm5lZFxuICovXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGl0KSB7XG4gICAgcmV0dXJuIHRvU3RyaW5nLmNhbGwoaXQpID09PSAnW29iamVjdCBGdW5jdGlvbl0nO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGlzRnVuY3Rpb247XG4iLCJ2YXIgdG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xuXG4vKipcbiAqIENoZWNrIHdoZXRoZXIgdGhlIHZhcmlhYmxlIGlzIGEgcGxhaW4gb2JqZWN0LlxuICpcbiAqIEBwYXJhbSB7YW55fSBpdCBUaGUgdmFyaWFibGUgdG8gY2hlY2tcbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgdmFyaWFibGUgaXMgYSBwbGFpbiBvYmplY3QsIG90aGVyd2lzZSBgZmFsc2VgIGlzIHJldHVybmVkXG4gKi9cbmZ1bmN0aW9uIGlzUGxhaW5PYmplY3QoaXQpIHtcbiAgICBpZiAoIWl0KSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgaXQgPT09IHdpbmRvdykge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBnbG9iYWwgIT09ICd1bmRlZmluZWQnICYmIGl0ID09PSBnbG9iYWwpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB0b1N0cmluZy5jYWxsKGl0KSA9PT0gJ1tvYmplY3QgT2JqZWN0XSc7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaXNQbGFpbk9iamVjdDtcbiIsInZhciBpc0FycmF5ID0gcmVxdWlyZSgzNyk7XG52YXIgaXNQbGFpbk9iamVjdCA9IHJlcXVpcmUoMzkpO1xudmFyIGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG52YXIgc2xpY2UgPSBBcnJheS5wcm90b3R5cGUuc2xpY2U7XG5cbi8qKlxuICogQ29weSB0aGUgbm9uLXVuZGVmaW5lZCB2YWx1ZXMgb2Ygc291cmNlIHRvIHRhcmdldC4gT3ZlcndyaXRlIHRoZSBvcmlnaW5hbCB2YWx1ZXMuXG4gKiBUaGlzIGZ1bmN0aW9uIHdpbGwgbW9kaWZ5IHRoZSB0YXJnZXRcbiAqXG4gKiBAcGFyYW0ge09iamVjdC48c3RyaW5nLCAqPnxhbnlbXX0gdGFyZ2V0IFRoZSB0YXJnZXQgb2JqZWN0IG9yIGFycmF5XG4gKiBAcGFyYW0ge09iamVjdC48c3RyaW5nLCAqPnxhbnlbXX0gc291cmNlIFRoZSBzb3VyY2Ugb2JqZWN0IG9yIGFycmF5XG4gKiBAcmV0dXJucyB7T2JqZWN0LjxzdHJpbmcsICo+fGFueVtdfSBSZXR1cm5zIHRoZSBleHRlbmRlZCB0YXJnZXQgb2JqZWN0IG9yIGFycmF5XG4gKi9cbmZ1bmN0aW9uIGV4dGVuZCh0YXJnZXQsIHNvdXJjZSkge1xuICAgIHZhciBrZXksIHZhbDtcblxuICAgIGlmICggdGFyZ2V0ICYmICggaXNBcnJheShzb3VyY2UpIHx8IGlzUGxhaW5PYmplY3Qoc291cmNlKSApICkge1xuICAgICAgICBmb3IgKCBrZXkgaW4gc291cmNlICkge1xuICAgICAgICAgICAgaWYgKCBoYXNPd24uY2FsbChzb3VyY2UsIGtleSkgKSB7XG4gICAgICAgICAgICAgICAgdmFsID0gc291cmNlW2tleV07XG4gICAgICAgICAgICAgICAgaWYgKHZhbCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICggaXNQbGFpbk9iamVjdCh2YWwpICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCAhIGlzUGxhaW5PYmplY3QodGFyZ2V0W2tleV0pICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldFtrZXldID0ge307XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBtZXJnZSh0YXJnZXRba2V5XSwgdmFsKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICggaXNBcnJheSh2YWwpICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCAhIGlzQXJyYXkodGFyZ2V0W2tleV0pICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldFtrZXldID0gW107XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBtZXJnZSh0YXJnZXRba2V5XSwgdmFsKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldFtrZXldID0gdmFsO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRhcmdldDtcbn1cblxuLyoqXG4gKiBDb3B5IGFueSBub24tdW5kZWZpbmVkIHZhbHVlcyBvZiBzb3VyY2UgdG8gdGFyZ2V0IGFuZCBvdmVyd3JpdGVzIHRoZSBjb3JyZXNwb25kaW5nIG9yaWdpbmFsIHZhbHVlcy4gVGhpcyBmdW5jdGlvblxuICogd2lsbCBtb2RpZnkgdGhlIHRhcmdldCBvYmplY3QuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHRhcmdldCBUaGUgdGFyZ2V0IG9iamVjdFxuICogQHBhcmFtIHsuLi5PYmplY3R9IGFyZ3MgVGhlIHNvdXJjZSBvYmplY3RcbiAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgdGhlIG1vZGlmaWVkIHRhcmdldCBvYmplY3RcbiAqL1xuZnVuY3Rpb24gbWVyZ2UodGFyZ2V0LCBhcmdzKSB7XG4gICAgdmFyIGkgPSAwO1xuICAgIHZhciBsID0gYXJndW1lbnRzLmxlbmd0aCAtIDE7XG5cbiAgICBhcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuXG4gICAgZm9yIChpID0gMDsgaSA8IGw7IGkgKz0gMSkge1xuICAgICAgICBleHRlbmQodGFyZ2V0LCBhcmdzW2ldKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGFyZ2V0O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IG1lcmdlO1xuIiwidmFyIHV0aWwgPSByZXF1aXJlKDQ0KTtcbnZhciBpc0FycmF5ID0gdXRpbC5pc0FycmF5O1xuXG4vKipcbiAqIERlY29kZSB0aGUgVVJJIENvbXBvbmVudCBlbmNvZGVkIHF1ZXJ5IHN0cmluZyB0byBvYmplY3RcbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gVGhlIFVSSSBDb21wb25lbnQgZW5jb2RlZCBxdWVyeSBzdHJpbmdcbiAqIEByZXR1cm5zIHtPYmplY3QuPHN0cmluZywgc3RyaW5nPn0gUmV0dXJucyB0aGUgZGVjb2RlZCBvYmplY3RcbiAqL1xudmFyIGRlY29kZSA9IGZ1bmN0aW9uIChzdHJpbmcpIHtcbiAgICB2YXIgb2JqZWN0ID0ge307XG4gICAgdmFyIGNhY2hlID0ge307XG4gICAgdmFyIGtleVZhbHVlQXJyYXk7XG4gICAgdmFyIGluZGV4O1xuICAgIHZhciBsZW5ndGg7XG4gICAgdmFyIGtleVZhbHVlO1xuICAgIHZhciBrZXk7XG4gICAgdmFyIHZhbHVlO1xuXG4gICAgLy8gZG8gbm90IGRlY29kZSBlbXB0eSBzdHJpbmcgb3Igc29tZXRoaW5nIHRoYXQgaXMgbm90IHN0cmluZ1xuICAgIGlmIChzdHJpbmcgJiYgdHlwZW9mIHN0cmluZyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAga2V5VmFsdWVBcnJheSA9IHN0cmluZy5zcGxpdCgnJicpO1xuICAgICAgICBpbmRleCA9IDA7XG4gICAgICAgIGxlbmd0aCA9IGtleVZhbHVlQXJyYXkubGVuZ3RoO1xuXG4gICAgICAgIHdoaWxlIChpbmRleCA8IGxlbmd0aCkge1xuICAgICAgICAgICAga2V5VmFsdWUgPSBrZXlWYWx1ZUFycmF5W2luZGV4XS5zcGxpdCgnPScpO1xuICAgICAgICAgICAga2V5ID0gZGVjb2RlVVJJQ29tcG9uZW50KGtleVZhbHVlWzBdKTtcbiAgICAgICAgICAgIHZhbHVlID0ga2V5VmFsdWVbMV07XG5cbiAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgdmFsdWUgPSBkZWNvZGVVUklDb21wb25lbnQodmFsdWUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IG51bGw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGRlY29kZUtleShvYmplY3QsIGNhY2hlLCBrZXksIHZhbHVlKTtcblxuICAgICAgICAgICAgaW5kZXggKz0gMTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBvYmplY3Q7XG59O1xuXG4vKipcbiAqIERlY29kZSB0aGUgc3BlY2VmaWVkIGtleVxuICpcbiAqIEBwYXJhbSB7T2JqZWN0LjxzdHJpbmcsIHN0cmluZz59IG9iamVjdCBUaGUgb2JqZWN0IHRvIGhvbGQgdGhlIGRlY29kZWQgZGF0YVxuICogQHBhcmFtIHtPYmplY3QuPHN0cmluZywgKj59IGNhY2hlIFRoZSBvYmplY3QgdG8gaG9sZCBjYWNoZSBkYXRhXG4gKiBAcGFyYW0ge3N0cmluZ30ga2V5IFRoZSBrZXkgbmFtZSB0byBkZWNvZGVcbiAqIEBwYXJhbSB7YW55fSB2YWx1ZSBUaGUgdmFsdWUgdG8gZGVjb2RlXG4gKi9cbnZhciBkZWNvZGVLZXkgPSBmdW5jdGlvbiAob2JqZWN0LCBjYWNoZSwga2V5LCB2YWx1ZSkge1xuICAgIHZhciByQnJhY2tldCA9IC9cXFsoW15cXFtdKj8pP1xcXSQvO1xuICAgIHZhciBySW5kZXggPSAvKF4wJCl8KF5bMS05XVxcZCokKS87XG4gICAgdmFyIGluZGV4T3JLZXlPckVtcHR5O1xuICAgIHZhciBwYXJlbnRLZXk7XG4gICAgdmFyIGFycmF5T3JPYmplY3Q7XG4gICAgdmFyIGtleUlzSW5kZXg7XG4gICAgdmFyIGtleUlzRW1wdHk7XG4gICAgdmFyIHZhbHVlSXNJbkFycmF5O1xuICAgIHZhciBkYXRhQXJyYXk7XG4gICAgdmFyIGxlbmd0aDtcblxuICAgIC8vIGNoZWNrIHdoZXRoZXIga2V5IGlzIHNvbWV0aGluZyBsaWtlIGBwZXJzb25bbmFtZV1gIG9yIGBjb2xvcnNbXWAgb3JcbiAgICAvLyBgY29sb3JzWzFdYFxuICAgIGlmICggckJyYWNrZXQudGVzdChrZXkpICkge1xuICAgICAgICBpbmRleE9yS2V5T3JFbXB0eSA9IFJlZ0V4cC4kMTtcbiAgICAgICAgcGFyZW50S2V5ID0ga2V5LnJlcGxhY2UockJyYWNrZXQsICcnKTtcbiAgICAgICAgYXJyYXlPck9iamVjdCA9IGNhY2hlW3BhcmVudEtleV07XG5cbiAgICAgICAga2V5SXNJbmRleCA9IHJJbmRleC50ZXN0KGluZGV4T3JLZXlPckVtcHR5KTtcbiAgICAgICAga2V5SXNFbXB0eSA9IGluZGV4T3JLZXlPckVtcHR5ID09PSAnJztcbiAgICAgICAgdmFsdWVJc0luQXJyYXkgPSBrZXlJc0luZGV4IHx8IGtleUlzRW1wdHk7XG5cbiAgICAgICAgaWYgKGFycmF5T3JPYmplY3QpIHtcbiAgICAgICAgICAgIC8vIGNvbnZlcnQgdGhlIGFycmF5IHRvIG9iamVjdFxuICAgICAgICAgICAgaWYgKCAoISB2YWx1ZUlzSW5BcnJheSkgJiYgaXNBcnJheShhcnJheU9yT2JqZWN0KSApIHtcbiAgICAgICAgICAgICAgICBkYXRhQXJyYXkgPSBhcnJheU9yT2JqZWN0O1xuICAgICAgICAgICAgICAgIGxlbmd0aCA9IGRhdGFBcnJheS5sZW5ndGg7XG4gICAgICAgICAgICAgICAgYXJyYXlPck9iamVjdCA9IHt9O1xuXG4gICAgICAgICAgICAgICAgd2hpbGUgKGxlbmd0aC0tKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChhcnJheU9yT2JqZWN0W2xlbmd0aF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXJyYXlPck9iamVjdFtsZW5ndGhdID0gZGF0YUFycmF5W2xlbmd0aF07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhcnJheU9yT2JqZWN0ID0gdmFsdWVJc0luQXJyYXkgPyBbXSA6IHt9O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCBrZXlJc0VtcHR5ICYmIGlzQXJyYXkoYXJyYXlPck9iamVjdCkgKSB7XG4gICAgICAgICAgICBhcnJheU9yT2JqZWN0LnB1c2godmFsdWUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gYXJyYXlPck9iamVjdCBpcyBhcnJheSBvciBvYmplY3QgaGVyZVxuICAgICAgICAgICAgYXJyYXlPck9iamVjdFtpbmRleE9yS2V5T3JFbXB0eV0gPSB2YWx1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNhY2hlW3BhcmVudEtleV0gPSBhcnJheU9yT2JqZWN0O1xuXG4gICAgICAgIGRlY29kZUtleShvYmplY3QsIGNhY2hlLCBwYXJlbnRLZXksIGFycmF5T3JPYmplY3QpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG9iamVjdFtrZXldID0gdmFsdWU7XG4gICAgfVxufTtcblxuZXhwb3J0cy5kZWNvZGUgPSBkZWNvZGU7XG4iLCJ2YXIgdXRpbCA9IHJlcXVpcmUoNDQpO1xudmFyIGlzQXJyYXkgPSB1dGlsLmlzQXJyYXk7XG52YXIgaXNPYmplY3QgPSB1dGlsLmlzT2JqZWN0O1xudmFyIGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG5cbi8qKlxuICogRW5jb2RlIHRoZSBnaXZlbiBvYmplY3QgdG8gVVJJIENvbXBvbmVudCBlbmNvZGVkIHF1ZXJ5IHN0cmluZ1xuICpcbiAqIEBwYXJhbSB7T2JqZWN0LjxzdHJpbmcsICo+fSBvYmplY3QgVGhlIG9iamVjdCB0byBlbmNvZGVcbiAqIEBwYXJhbSB7Ym9vbGVhbn0gW2tlZXBBcnJheUluZGV4XSBXaGV0aGVyIHRvIGtlZXAgYXJyYXkgaW5kZXhcbiAqIEByZXR1cm5zIHtzdHJpbmd9IFJldHVybnMgdGhlIFVSSSBDb21wb25lbnQgZW5jb2RlZCBxdWVyeSBzdHJpbmdcbiAqL1xudmFyIGVuY29kZSA9IGZ1bmN0aW9uIChvYmplY3QsIGtlZXBBcnJheUluZGV4KSB7XG4gICAgdmFyIGtleTtcbiAgICB2YXIga2V5VmFsdWVBcnJheSA9IFtdO1xuXG4gICAga2VlcEFycmF5SW5kZXggPSAhIWtlZXBBcnJheUluZGV4O1xuXG4gICAgaWYgKCBpc09iamVjdChvYmplY3QpICkge1xuICAgICAgICBmb3IgKCBrZXkgaW4gb2JqZWN0ICkge1xuICAgICAgICAgICAgaWYgKCBoYXNPd24uY2FsbChvYmplY3QsIGtleSkgKSB7XG4gICAgICAgICAgICAgICAgZW5jb2RlS2V5KGtleSwgb2JqZWN0W2tleV0sIGtleVZhbHVlQXJyYXksIGtlZXBBcnJheUluZGV4KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBrZXlWYWx1ZUFycmF5LmpvaW4oJyYnKTtcbn07XG5cblxuLyoqXG4gKiBFbmNvZGUgdGhlIHNwZWNlaWZlZCBrZXkgaW4gdGhlIG9iamVjdFxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgVGhlIGtleSBuYW1lXG4gKiBAcGFyYW0ge2FueX0gZGF0YSBUaGUgZGF0YSBvZiB0aGUga2V5XG4gKiBAcGFyYW0ge3N0cmluZ1tdfSBrZXlWYWx1ZUFycmF5IFRoZSBhcnJheSB0byBzdG9yZSB0aGUga2V5IHZhbHVlIHN0cmluZ1xuICogQHBhcmFtIHtib29sZWFufSBrZWVwQXJyYXlJbmRleCBXaGV0aGVyIHRvIGtlZXAgYXJyYXkgaW5kZXhcbiAqL1xudmFyIGVuY29kZUtleSA9IGZ1bmN0aW9uIChrZXksIGRhdGEsIGtleVZhbHVlQXJyYXksIGtlZXBBcnJheUluZGV4KSB7XG4gICAgdmFyIHByb3A7XG4gICAgdmFyIGluZGV4O1xuICAgIHZhciBsZW5ndGg7XG4gICAgdmFyIHZhbHVlO1xuICAgIHZhciBzdWJLZXk7XG5cbiAgICBpZiAoIGlzT2JqZWN0KGRhdGEpICkge1xuICAgICAgICBmb3IgKCBwcm9wIGluIGRhdGEgKSB7XG4gICAgICAgICAgICBpZiAoIGhhc093bi5jYWxsKGRhdGEsIHByb3ApICkge1xuICAgICAgICAgICAgICAgIHZhbHVlID0gZGF0YVtwcm9wXTtcbiAgICAgICAgICAgICAgICBzdWJLZXkgPSBrZXkgKyAnWycgKyBwcm9wICsgJ10nO1xuICAgICAgICAgICAgICAgIGVuY29kZUtleShzdWJLZXksIHZhbHVlLCBrZXlWYWx1ZUFycmF5LCBrZWVwQXJyYXlJbmRleCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKCBpc0FycmF5KGRhdGEpICkge1xuICAgICAgICBpbmRleCA9IDA7XG4gICAgICAgIGxlbmd0aCA9IGRhdGEubGVuZ3RoO1xuXG4gICAgICAgIHdoaWxlIChpbmRleCA8IGxlbmd0aCkge1xuICAgICAgICAgICAgdmFsdWUgPSBkYXRhW2luZGV4XTtcblxuICAgICAgICAgICAgaWYgKCBrZWVwQXJyYXlJbmRleCB8fCBpc0FycmF5KHZhbHVlKSB8fCBpc09iamVjdCh2YWx1ZSkgKSB7XG4gICAgICAgICAgICAgICAgc3ViS2V5ID0ga2V5ICsgJ1snICsgaW5kZXggKyAnXSc7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHN1YktleSA9IGtleSArICdbXSc7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGVuY29kZUtleShzdWJLZXksIHZhbHVlLCBrZXlWYWx1ZUFycmF5LCBrZWVwQXJyYXlJbmRleCk7XG5cbiAgICAgICAgICAgIGluZGV4ICs9IDE7XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICBrZXkgPSBlbmNvZGVVUklDb21wb25lbnQoa2V5KTtcbiAgICAgICAgLy8gaWYgZGF0YSBpcyBudWxsLCBubyBgPWAgaXMgYXBwZW5kZWRcbiAgICAgICAgaWYgKGRhdGEgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHZhbHVlID0ga2V5O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gaWYgZGF0YSBpcyB1bmRlZmluZWQsIHRyZWF0IGl0IGFzIGVtcHR5IHN0cmluZ1xuICAgICAgICAgICAgaWYgKGRhdGEgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGRhdGEgPSAnJztcbiAgICAgICAgICAgIC8vIG1ha2Ugc3VyZSB0aGF0IGRhdGEgaXMgc3RyaW5nXG4gICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBkYXRhICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIGRhdGEgPSAnJyArIGRhdGE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YWx1ZSA9IGtleSArICc9JyArIGVuY29kZVVSSUNvbXBvbmVudChkYXRhKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGtleVZhbHVlQXJyYXkucHVzaCh2YWx1ZSk7XG4gICAgfVxufTtcblxuZXhwb3J0cy5lbmNvZGUgPSBlbmNvZGU7XG4iLCJ2YXIgZW5jb2RlID0gcmVxdWlyZSg0MikuZW5jb2RlO1xudmFyIGRlY29kZSA9IHJlcXVpcmUoNDEpLmRlY29kZTtcblxuZXhwb3J0cy5lbmNvZGUgPSBlbmNvZGU7XG5leHBvcnRzLmRlY29kZSA9IGRlY29kZTtcbmV4cG9ydHMudmVyc2lvbiA9ICcxLjEuMic7XG4iLCJ2YXIgdG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xuXG4vKipcbiAqIENoZWNrIHdoZXRoZXIgdGhlIHZhcmlhYmxlIGlzIGFuIGFycmF5XG4gKlxuICogQHBhcmFtIHthbnl9IGl0IFRoZSB2YXJpYWJsZSB0byBjaGVja1xuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGl0IGlzIGFuIGFycmF5XG4gKi9cbnZhciBpc0FycmF5ID0gZnVuY3Rpb24gKGl0KSB7XG4gICAgcmV0dXJuICdbb2JqZWN0IEFycmF5XScgPT09IHRvU3RyaW5nLmNhbGwoaXQpO1xufTtcblxuLyoqXG4gKiBDaGVjayB3aGV0aGVyIHRoZSB2YXJpYWJsZSBpcyBhbiBvYmplY3RcbiAqXG4gKiBAcGFyYW0ge2FueX0gaXQgVGhlIHZhcmlhYmxlIHRvIGNoZWNrXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgaXQgaXMgYW4gb2JqZWN0XG4gKi9cbnZhciBpc09iamVjdCA9IGZ1bmN0aW9uIChpdCkge1xuICAgIHJldHVybiAnW29iamVjdCBPYmplY3RdJyA9PT0gdG9TdHJpbmcuY2FsbChpdCk7XG59O1xuXG5leHBvcnRzLmlzQXJyYXkgPSBpc0FycmF5O1xuZXhwb3J0cy5pc09iamVjdCA9IGlzT2JqZWN0O1xuIl19
