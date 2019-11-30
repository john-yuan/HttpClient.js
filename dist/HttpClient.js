(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.HttpClient = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
var isFunction = require(36);

/**
 * Cancel controller is used to cancel actions. One controller can bind any number of actions.
 *
 * @class
 */
function CancelController() {
    /**
     * @type {boolean} Whether the controller is canceled.
     */
    this.canceled = false;

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

    if (this.canceled === false) {
        this.canceled = true;

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
 * Check whether the controller is canceled.
 *
 * @returns {boolean} Returns `true` if the controller is canceled, otherwise `false` is returned.
 */
CancelController.prototype.isCanceled = function () {
    return this.canceled;
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

},{"36":36}],2:[function(require,module,exports){
var merge = require(38);
var isFunction = require(36);
var isPlainObject = require(37);
var noop = require(31);
var constants = require(24);
var createDefaultOptions = require(26);
var createCancelController = require(25);
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
var version = '0.0.1-alpha.8';

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
                if (!controller.isCanceled()) {
                    resolve(response);
                }
            } else {
                resolve(response);
            }
        }, reject);

        if (controller) {
            // Trigger the `ERR_CANCELED` error.
            if (controller.isCanceled()) {
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
                if (!controller.isCanceled()) {
                    resolve(response);
                }
            } else {
                resolve(response);
            }
        }, reject);

        if (controller) {
            // Trigger the `ERR_CANCELED` error.
            if (controller.isCanceled()) {
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
HttpClient.version = HttpClient.prototype.version = version;

// The exports.
HttpClient.exports = HttpClient.prototype.exports = merge({
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
    ResponseError: ResponseError,
    createDefaultOptions: createDefaultOptions
}, constants);

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

},{"1":1,"10":10,"11":11,"24":24,"25":25,"26":26,"3":3,"31":31,"36":36,"37":37,"38":38,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9}],3:[function(require,module,exports){
var Request = require(9);
var constants = require(24);
var inherits = require(30);
var buildURL = require(22);
var handleOptions = require(28);
var callRequestCreatedCallback = require(23);
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

},{"12":12,"14":14,"15":15,"16":16,"17":17,"22":22,"23":23,"24":24,"28":28,"30":30,"9":9}],4:[function(require,module,exports){
/**
 * HttpResponse module.
 *
 * @module class/HttpResponse
 */

var Response = require(10);
var inherits = require(30);
var addMixin = require(21);

/**
 * The HttpResponse class.
 *
 * @class
 * @param {HttpRequest} request The http request.
 */
function HttpResponse(request) {
    Response.call(this, request);
    addMixin(this, request.options, 'httpResponseMixin');
}

inherits(HttpResponse, Response);

module.exports = HttpResponse;

},{"10":10,"21":21,"30":30}],5:[function(require,module,exports){
var ResponseError = require(11);
var inherits = require(30);
var addMixin = require(21);

/**
 * @class
 * @param {string} code The error code.
 * @param {HttpRequest} request The http request.
 */
function HttpResponseError(code, request) {
    ResponseError.call(this, code, request);
    addMixin(this, request.options, 'httpResponseErrorMixin');
}

inherits(HttpResponseError, ResponseError);

module.exports = HttpResponseError;

},{"11":11,"21":21,"30":30}],6:[function(require,module,exports){
var Request = require(9);
var constants = require(24);
var inherits = require(30);
var handleOptions = require(28);
var callRequestCreatedCallback = require(23);
var addEventListeners = require(18);
var buildCallbackName = require(19);
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

    // Add event listeners.
    addEventListeners(this, callbackName);

    // Inject the script node.
    containerNode.appendChild(script);

    // Call onRequestCreated.
    callRequestCreatedCallback(options, this);
}

inherits(JSONPRequest, Request);

module.exports = JSONPRequest;

},{"18":18,"19":19,"20":20,"23":23,"24":24,"28":28,"30":30,"9":9}],7:[function(require,module,exports){
/**
 * JSONPResponse module.
 *
 * @module class/JSONPResponse
 */

var Response = require(10);
var inherits = require(30);
var addMixin = require(21);

/**
 * The JSONPResponse class.
 *
 * @class
 * @param {JSONRequest} request The http request.
 */
function JSONPResponse(request) {
    Response.call(this, request);
    addMixin(this, request.options, 'jsonpResponseMixin');
}

inherits(JSONPResponse, Response);

module.exports = JSONPResponse;

},{"10":10,"21":21,"30":30}],8:[function(require,module,exports){
var ResponseError = require(11);
var inherits = require(30);
var addMixin = require(21);

/**
 * @class
 * @param {string} code The error code.
 * @param {JSONPRequest} request The JSONP request.
 */
function JSONPResponseError(code, request) {
    ResponseError.call(this, code, request);
    addMixin(this, request.options, 'jsonpResponseErrorMixin');
}

inherits(ResponseError, JSONPResponseError);

module.exports = JSONPResponseError;

},{"11":11,"21":21,"30":30}],9:[function(require,module,exports){
var uuid = require(33);

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

},{"33":33}],10:[function(require,module,exports){
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
    ERR_CANCELED: 'Request canceled',
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
var isFunction = require(36);
var HttpResponse = require(4);
var addTimeoutListener = require(13);
var fireCallbacks = require(27);
var noop = require(31);
var constants = require(24);
var ERR_ABORTED   = constants.ERR_ABORTED;
var ERR_CANCELED = constants.ERR_CANCELED;
var ERR_NETWORK   = constants.ERR_NETWORK;
var ERR_RESPONSE  = constants.ERR_RESPONSE;
var ERR_TIMEOUT   = constants.ERR_TIMEOUT;

/**
 * Check whether the request is aborted.
 *
 * @param {XMLHttpRequest} xhr The XMLHttpRequest.
 * @returns {boolean} Returns `true` if it is aborted.
 */
function isAborted(xhr) {
    var status = +xhr.status;
    var responseURL = xhr.responseURL;

    if (typeof responseURL !== 'string') {
        responseURL = '';
    }

    return status === 0 && responseURL.indexOf('file:') !== 0;
}

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
        finish(ERR_CANCELED);
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
            if (isAborted(xhr)) {
                finish(ERR_ABORTED);
            } else if (isFunction(isResponseOk)) {
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

},{"13":13,"24":24,"27":27,"31":31,"36":36,"4":4}],13:[function(require,module,exports){
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
var isFunction = require(36);

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

},{"36":36}],15:[function(require,module,exports){
var merge = require(38);
var isPlainObject = require(37);
var hasOwn = require(29);

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

},{"29":29,"37":37,"38":38}],16:[function(require,module,exports){
var merge = require(38);
var isFunction = require(36);
var isPlainObject = require(37);
var hasOwn = require(29);

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

},{"29":29,"36":36,"37":37,"38":38}],17:[function(require,module,exports){
var isPlainObject = require(37);
var hasOwn = require(29);

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

},{"29":29,"37":37}],18:[function(require,module,exports){
var isFunction = require(36);
var JSONPResponse = require(7);
var fireCallbacks = require(27);
var noop = require(31);
var constants = require(24);
var ERR_CANCELED = constants.ERR_CANCELED;
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
    var timeout = parseInt(options.timeout, 10) || 0;
    var timeoutId = null;

    if (timeout <= 0) {
        timeout = parseInt(options.jsonpDefaultTimeout, 10) || 0;
    }

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
        finish(ERR_CANCELED);
    };

    // Add timeout listener
    if (timeout > 0) {
        timeoutId = setTimeout(function () {
            finish(ERR_TIMEOUT);
        }, timeout);
    }
}

module.exports = addEventListeners;

},{"24":24,"27":27,"31":31,"36":36,"7":7}],19:[function(require,module,exports){
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
var buildURL = require(22);

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

},{"22":22}],21:[function(require,module,exports){
var isPlainObject = require(37);
var isFunction = require(36);
var hasOwn = require(29);

/**
 * The function to add custom mixins to the instance of `Response` or `ResponseError`.
 *
 * @param {Response|ResponseError} target The target to add the custome mixins.
 * @param {RequestOptions} options The request options.
 * @param {string} optionName The option name the mixins container.
 */
function addMixin(target, options, optionName) {
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

module.exports = addMixin;

},{"29":29,"36":36,"37":37}],22:[function(require,module,exports){
var isFunction = require(36);
var isAbsoluteURL = require(34);
var isPlainObject = require(37);

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

},{"34":34,"36":36,"37":37}],23:[function(require,module,exports){
var isFunction = require(36);

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

},{"36":36}],24:[function(require,module,exports){
exports.ERR_ABORTED = 'ERR_ABORTED';
exports.ERR_RESPONSE = 'ERR_RESPONSE';
exports.ERR_CANCELED = 'ERR_CANCELED';
exports.ERR_NETWORK = 'ERR_NETWORK';
exports.ERR_TIMEOUT = 'ERR_TIMEOUT';
exports.HTTP_REQUEST = 'HTTP_REQUEST';
exports.JSONP_REQUEST = 'JSONP_REQUEST';

},{}],25:[function(require,module,exports){
var CancelController = require(1);

/**
 * Create a new instance of `CancelController`.
 *
 * @returns {CancelController} Returns an new instance of `CancelController`.
 */
function createCancelController() {
    return new CancelController();
}

module.exports = createCancelController;

},{"1":1}],26:[function(require,module,exports){
var encodeQueryString = require(39);
var constants = require(24);
var template = require(32);
var uuid = require(33);
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
        jsonpDefaultTimeout: 60000,
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
                    return encodeQueryString(data);
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
            return encodeQueryString(query);
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

},{"24":24,"32":32,"33":33,"39":39}],27:[function(require,module,exports){
var isFunction = require(36);
var HttpResponseError = require(5);
var JSONPResponseError = require(8);
var constants = require(24);
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

},{"24":24,"36":36,"5":5,"8":8}],28:[function(require,module,exports){
var isFunction = require(36);

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

},{"36":36}],29:[function(require,module,exports){
module.exports = Object.prototype.hasOwnProperty;

},{}],30:[function(require,module,exports){
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

},{}],31:[function(require,module,exports){
/**
 * The no operation function.
 */
function noop() {
    // nothing to do here.
}

module.exports = noop;

},{}],32:[function(require,module,exports){
var T_STR = 1; // Stands for a normal string.
var T_EXP = 2; // Stands for an expression.

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
    var templ = (template === null || template === undefined) ? '' : (template + '');
    var model = data || {};
    var opts = options || {};
    var openingTag = opts.openingTag || '{';
    var closingTag = opts.closingTag || '}';
    var encode = opts.encode || encodeURIComponent;
    var result = parse(templ, openingTag, closingTag, function (exp) {
        var first = exp.charAt(0);
        var second = exp.charAt(1);
        var raw = false;

        if (first === '-' && second === ' ') {
            raw = true;
            exp = exp.substr(2);
        }

        exp = exp.replace(/^\s+|\s+$/g, '');

        return {
            type: T_EXP,
            text: exp,
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
 * @param {Object.<string, *>[]} result The result of `parse`.
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
 * @param {string} openingTag The opening tag, for example `{`.
 * @param {string} closingTag The closing tag, for example `}`.
 * @param {(exp: string) => Object.<string, *>} handleExp The function to handle each expression.
 * @returns {Object.<string, *>[]} Returns the parsed result.
 */
function parse(template, openingTag, closingTag, handleExp) {
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
        output.push(handleExp(expCache.join('')));
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
 * @property {string} [openingTag] The opening tag of the template, default is `{`.
 * @property {string} [closingTag] The closing tag of the template, default is `}`.
 * @property {(value: string) => string} [encode] The function to encode the string, default is `encodeURIComponent`.
 */

module.exports = template;

},{}],33:[function(require,module,exports){
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

},{}],34:[function(require,module,exports){
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

},{}],35:[function(require,module,exports){
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

},{}],36:[function(require,module,exports){
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

},{}],37:[function(require,module,exports){
var toString = Object.prototype.toString;
var getPrototypeOf = Object.getPrototypeOf;

if (!getPrototypeOf) {
    getPrototypeOf = function (object) {
        return object.__proto__;
    };
}

/**
 * Check whether the variable is a plain object.
 *
 * @param {any} it The variable to check
 * @returns {boolean} Returns `true` if the variable is a plain object, otherwise `false` is returned
 */
function isPlainObject(it) {
    var proto;

    if (toString.call(it) !== '[object Object]') {
        return false;
    }

    proto = getPrototypeOf(it);

    // Object.create(null)
    if (!proto) {
        return true;
    }

    if (proto !== getPrototypeOf({})) {
        return false;
    }

    return true;
}

module.exports = isPlainObject;

},{}],38:[function(require,module,exports){
var isArray = require(35);
var isPlainObject = require(37);
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

},{"35":35,"37":37}],39:[function(require,module,exports){
var util = require(40);
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
function encode(object, keepArrayIndex) {
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
}

/**
 * Encode the speceifed key in the object
 *
 * @param {string} key The key name
 * @param {any} data The data of the key
 * @param {string[]} keyValueArray The array to store the key value string
 * @param {boolean} keepArrayIndex Whether to keep array index
 */
function encodeKey(key, data, keyValueArray, keepArrayIndex) {
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
}

module.exports = encode;

},{"40":40}],40:[function(require,module,exports){
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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9fYnJvd3Nlci1wYWNrQDYuMS4wQGJyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsImxpYi9jbGFzcy9DYW5jZWxDb250cm9sbGVyLmpzIiwibGliL2NsYXNzL0h0dHBDbGllbnQuanMiLCJsaWIvY2xhc3MvSHR0cFJlcXVlc3QuanMiLCJsaWIvY2xhc3MvSHR0cFJlc3BvbnNlLmpzIiwibGliL2NsYXNzL0h0dHBSZXNwb25zZUVycm9yLmpzIiwibGliL2NsYXNzL0pTT05QUmVxdWVzdC5qcyIsImxpYi9jbGFzcy9KU09OUFJlc3BvbnNlLmpzIiwibGliL2NsYXNzL0pTT05QUmVzcG9uc2VFcnJvci5qcyIsImxpYi9jbGFzcy9SZXF1ZXN0LmpzIiwibGliL2NsYXNzL1Jlc3BvbnNlLmpzIiwibGliL2NsYXNzL1Jlc3BvbnNlRXJyb3IuanMiLCJsaWIvaHR0cC9hZGRFdmVudExpc3RlbmVycy5qcyIsImxpYi9odHRwL2FkZFRpbWVvdXRMaXN0ZW5lci5qcyIsImxpYi9odHRwL2NhbGxYaHJIb29rLmpzIiwibGliL2h0dHAvaGFuZGxlSGVhZGVycy5qcyIsImxpYi9odHRwL2hhbmRsZVJlcXVlc3RCb2R5LmpzIiwibGliL2h0dHAvaGFuZGxlWGhyUHJvcHMuanMiLCJsaWIvanNvbnAvYWRkRXZlbnRMaXN0ZW5lcnMuanMiLCJsaWIvanNvbnAvYnVpbGRDYWxsYmFja05hbWUuanMiLCJsaWIvanNvbnAvYnVpbGRTY3JpcHRTcmMuanMiLCJsaWIvc2hhcmVkL2FkZE1peGluLmpzIiwibGliL3NoYXJlZC9idWlsZFVSTC5qcyIsImxpYi9zaGFyZWQvY2FsbFJlcXVlc3RDcmVhdGVkQ2FsbGJhY2suanMiLCJsaWIvc2hhcmVkL2NvbnN0YW50cy5qcyIsImxpYi9zaGFyZWQvY3JlYXRlQ2FuY2VsQ29udHJvbGxlci5qcyIsImxpYi9zaGFyZWQvY3JlYXRlRGVmYXVsdE9wdGlvbnMuanMiLCJsaWIvc2hhcmVkL2ZpcmVDYWxsYmFja3MuanMiLCJsaWIvc2hhcmVkL2hhbmRsZU9wdGlvbnMuanMiLCJsaWIvc2hhcmVkL2hhc093bi5qcyIsImxpYi9zaGFyZWQvaW5oZXJpdHMuanMiLCJsaWIvc2hhcmVkL25vb3AuanMiLCJsaWIvc2hhcmVkL3RlbXBsYXRlLmpzIiwibGliL3NoYXJlZC91dWlkLmpzIiwibm9kZV9tb2R1bGVzL194LWNvbW1vbi11dGlsc0AxLjQuNEB4LWNvbW1vbi11dGlscy9pc0Fic29sdXRlVVJMLmpzIiwibm9kZV9tb2R1bGVzL194LWNvbW1vbi11dGlsc0AxLjQuNEB4LWNvbW1vbi11dGlscy9pc0FycmF5LmpzIiwibm9kZV9tb2R1bGVzL194LWNvbW1vbi11dGlsc0AxLjQuNEB4LWNvbW1vbi11dGlscy9pc0Z1bmN0aW9uLmpzIiwibm9kZV9tb2R1bGVzL194LWNvbW1vbi11dGlsc0AxLjQuNEB4LWNvbW1vbi11dGlscy9pc1BsYWluT2JqZWN0LmpzIiwibm9kZV9tb2R1bGVzL194LWNvbW1vbi11dGlsc0AxLjQuNEB4LWNvbW1vbi11dGlscy9tZXJnZS5qcyIsIm5vZGVfbW9kdWxlcy9feC1xdWVyeS1zdHJpbmdAMi4wLjBAeC1xdWVyeS1zdHJpbmcvZW5jb2RlLmpzIiwibm9kZV9tb2R1bGVzL194LXF1ZXJ5LXN0cmluZ0AyLjAuMEB4LXF1ZXJ5LXN0cmluZy91dGlsL3V0aWwuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0ZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNaQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2ZBO0FBQ0E7O0FDREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDYkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwidmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKDM2KTtcblxuLyoqXG4gKiBDYW5jZWwgY29udHJvbGxlciBpcyB1c2VkIHRvIGNhbmNlbCBhY3Rpb25zLiBPbmUgY29udHJvbGxlciBjYW4gYmluZCBhbnkgbnVtYmVyIG9mIGFjdGlvbnMuXG4gKlxuICogQGNsYXNzXG4gKi9cbmZ1bmN0aW9uIENhbmNlbENvbnRyb2xsZXIoKSB7XG4gICAgLyoqXG4gICAgICogQHR5cGUge2Jvb2xlYW59IFdoZXRoZXIgdGhlIGNvbnRyb2xsZXIgaXMgY2FuY2VsZWQuXG4gICAgICovXG4gICAgdGhpcy5jYW5jZWxlZCA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0Z1bmN0aW9uW119IFRoZSBjYWxsYmFja3MgdG8gY2FsbCBvbiBjYW5jZWwuXG4gICAgICovXG4gICAgdGhpcy5jYWxsYmFja3MgPSBbXTtcbn1cblxuLyoqXG4gKiBDYW5jZWwgdGhlIGFjdGlvbnMgdGhhdCBiaW5kIHdpdGggdGhpcyBjYW5jZWwgY29udHJvbGxlci5cbiAqL1xuQ2FuY2VsQ29udHJvbGxlci5wcm90b3R5cGUuY2FuY2VsID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBjYWxsYmFja3MgPSB0aGlzLmNhbGxiYWNrcztcbiAgICB2YXIgaSA9IDA7XG4gICAgdmFyIGwgPSBjYWxsYmFja3MubGVuZ3RoO1xuXG4gICAgaWYgKHRoaXMuY2FuY2VsZWQgPT09IGZhbHNlKSB7XG4gICAgICAgIHRoaXMuY2FuY2VsZWQgPSB0cnVlO1xuXG4gICAgICAgIGZvciAoIDsgaSA8IGw7IGkgKz0gMSkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjYWxsYmFja3NbaV0oKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAvLyBUaHJvdyB0aGUgZXJyb3IgbGF0ZXIgZm9yIGRlYnVnaW5nLlxuICAgICAgICAgICAgICAgIChmdW5jdGlvbiAoZSkge1xuICAgICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IGU7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pKGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufTtcblxuLyoqXG4gKiBDaGVjayB3aGV0aGVyIHRoZSBjb250cm9sbGVyIGlzIGNhbmNlbGVkLlxuICpcbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgY29udHJvbGxlciBpcyBjYW5jZWxlZCwgb3RoZXJ3aXNlIGBmYWxzZWAgaXMgcmV0dXJuZWQuXG4gKi9cbkNhbmNlbENvbnRyb2xsZXIucHJvdG90eXBlLmlzQ2FuY2VsZWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY2FuY2VsZWQ7XG59O1xuXG4vKipcbiAqIFJlZ2lzdGVyIGEgY2FsbGJhY2ssIHdoaWNoIHdpbGwgYmUgY2FsbGVkIHdoZW4gdGhlIGBjYW5jZWwoKWAgbWV0aG9kIGlzIGNhbGxlZC5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBUaGUgY2FsbGJhY2sgZnVuY3Rpb24gdG8gY2FsbCBvbiBjYW5jZWwuXG4gKi9cbkNhbmNlbENvbnRyb2xsZXIucHJvdG90eXBlLnJlZ2lzdGVyQ2FuY2VsQ2FsbGJhY2sgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICBpZiAoaXNGdW5jdGlvbihjYWxsYmFjaykpIHtcbiAgICAgICAgdGhpcy5jYWxsYmFja3MucHVzaChjYWxsYmFjayk7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBDYW5jZWxDb250cm9sbGVyO1xuIiwidmFyIG1lcmdlID0gcmVxdWlyZSgzOCk7XG52YXIgaXNGdW5jdGlvbiA9IHJlcXVpcmUoMzYpO1xudmFyIGlzUGxhaW5PYmplY3QgPSByZXF1aXJlKDM3KTtcbnZhciBub29wID0gcmVxdWlyZSgzMSk7XG52YXIgY29uc3RhbnRzID0gcmVxdWlyZSgyNCk7XG52YXIgY3JlYXRlRGVmYXVsdE9wdGlvbnMgPSByZXF1aXJlKDI2KTtcbnZhciBjcmVhdGVDYW5jZWxDb250cm9sbGVyID0gcmVxdWlyZSgyNSk7XG52YXIgUmVxdWVzdCA9IHJlcXVpcmUoOSk7XG52YXIgSHR0cFJlcXVlc3QgPSByZXF1aXJlKDMpO1xudmFyIEpTT05QUmVxdWVzdCA9IHJlcXVpcmUoNik7XG52YXIgUmVzcG9uc2UgPSByZXF1aXJlKDEwKTtcbnZhciBIdHRwUmVzcG9uc2UgPSByZXF1aXJlKDQpO1xudmFyIEpTT05QUmVzcG9uc2UgPSByZXF1aXJlKDcpO1xudmFyIFJlc3BvbnNlRXJyb3IgPSByZXF1aXJlKDExKTtcbnZhciBIdHRwUmVzcG9uc2VFcnJvciA9IHJlcXVpcmUoNSk7XG52YXIgSlNPTlBSZXNwb25zZUVycm9yID0gcmVxdWlyZSg4KTtcbnZhciBDYW5jZWxDb250cm9sbGVyID0gcmVxdWlyZSgxKTtcbnZhciB2ZXJzaW9uID0gJzAuMC4xLWFscGhhLjgnO1xuXG4vKipcbiAqIEBjbGFzc1xuICpcbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IFtkZWZhdWx0c10gVGhlIGRlZmF1bHQgb3B0aW9ucyB0byB1c2Ugd2hlbiBzZW5kaW5nIHJlcXVlc3RzIHdpdGggdGhlIGNyZWF0ZWQgaHR0cCBjbGllbnQuXG4gKiBUaGlzIGRlZmF1bHQgb3B0aW9ucyB3aWxsIGJlIG1lcmdlZCBpbnRvIHRoZSBpbnRlcm5hbCBkZWZhdWx0IG9wdGlvbnMgdGhhdCBgY3JlYXRlRGVmYXVsdE9wdGlvbnMoKWAgcmV0dXJucy5cbiAqXG4gKiBAcGFyYW0ge0hhbmRsZU9wdGlvbnNGdW5jdGlvbn0gW2hhbmRsZURlZmF1bHRzXSBUaGUgaGFuZGxlciBmdW5jdGlvbiB0byBwcm9jZXNzIHRoZSBtZXJnZWQgZGVmYXVsdCBvcHRpb25zLiBUaGVcbiAqIG1lcmdlZCBkZWZhdWx0IG9wdGlvbnMgd2lsbCBiZSBwYXNzZWQgaW50byB0aGUgZnVuY3Rpb24gYXMgdGhlIGZpcnN0IGFyZ3VtZW50LiBZb3UgY2FuIG1ha2UgY2hhbmdlcyB0byBpdCBhcyB5b3VcbiAqIHdhbnQuIFRoaXMgZnVuY3Rpb24gbXVzdCByZXR1cm4gc3luY2hyb25vdXNseS4gVGhlIHJldHVybiB2YWx1ZSBvZiB0aGlzIGZ1bmN0aW9uIGlzIGlnbm9yZWQuXG4gKlxuICogQHBhcmFtIHtIYW5kbGVPcHRpb25zRnVuY3Rpb259IFtoYW5kbGVSZXF1ZXN0T3B0aW9uc10gVGhlIGhhbmRsZXIgZnVuY3Rpb24gdG8gcHJvY2VzcyBlYWNoIG1lcmdlZCByZXF1ZXN0IG9wdGlvbnMuXG4gKiBFdmVyeSBvcHRpb25zIHRoYXQgcGFzc2VkIGludG8gYHNlbmRgLCBgZmV0Y2hgLCBgZ2V0SlNPTlBgLCBgZmV0Y2hKU09OUGAgd2lsbCBiZSBwcm9jZXNzZWQgYnkgdGhpcyBoYW5kbGVyIGZ1bmN0aW9uLlxuICovXG5mdW5jdGlvbiBIdHRwQ2xpZW50KGRlZmF1bHRzLCBoYW5kbGVEZWZhdWx0cywgaGFuZGxlUmVxdWVzdE9wdGlvbnMpIHtcbiAgICB2YXIgZGVmYXVsdE9wdGlvbnMgPSBjcmVhdGVEZWZhdWx0T3B0aW9ucygpO1xuXG4gICAgaWYgKGlzUGxhaW5PYmplY3QoZGVmYXVsdHMpKSB7XG4gICAgICAgIG1lcmdlKGRlZmF1bHRPcHRpb25zLCBkZWZhdWx0cyk7XG4gICAgfVxuXG4gICAgaWYgKGlzRnVuY3Rpb24oaGFuZGxlRGVmYXVsdHMpKSB7XG4gICAgICAgIGhhbmRsZURlZmF1bHRzKGRlZmF1bHRPcHRpb25zKTtcbiAgICAgICAgLy8gRGVlcCBjb3B5IHRoZSBjaGFnbmVkIG9wdGlvbnNcbiAgICAgICAgZGVmYXVsdE9wdGlvbnMgPSBtZXJnZSh7fSwgZGVmYXVsdE9wdGlvbnMpO1xuICAgIH1cblxuICAgIGlmICghaXNGdW5jdGlvbihoYW5kbGVSZXF1ZXN0T3B0aW9ucykpIHtcbiAgICAgICAgaGFuZGxlUmVxdWVzdE9wdGlvbnMgPSBub29wO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCBhIGNvcHkgb2YgdGhlIGRlZmF1bHQgcmVxdWVzdCBvcHRpb25zLiBUaGlzIGZ1bmN0aW9uIGlzIE5PVCBhdmFpbGFibGUgb24gdGhlIHByb3RvdHlwZSBvZiBgSHR0cENsaWVudGAuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7UmVxdWVzdE9wdGlvbnN9XG4gICAgICovXG4gICAgdGhpcy5jb3B5T3B0aW9ucyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIG1lcmdlKHt9LCBkZWZhdWx0T3B0aW9ucyk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIE1lcmdlIHRoZSByZXF1ZXN0IG9wdGlvbnMgd2l0aCB0aGUgZGVmYXVsdCByZXF1ZXN0IG9wdGlvbnMuIFRoaXMgZnVuY3Rpb24gaXMgTk9UIGF2YWlsYWJsZSBvbiB0aGUgcHJvdG90eXBlIG9mXG4gICAgICogYEh0dHBDbGllbnRgIGFuZCB3aWxsIGNhbGwgYGhhbmRsZVJlcXVlc3RPcHRpb25zYCB0byBoYW5kbGUgdGhlIG1lcmdlZCByZXF1ZXN0IG9wdGlvbnMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMgdG8gbWVyZ2UuXG4gICAgICogQHJldHVybnMge1JlcXVlc3RPcHRpb25zfSBSZXR1cm5zIHRoZSBtZXJnZWQgcmVxdWVzdCBvcHRpb25zLlxuICAgICAqL1xuICAgIHRoaXMubWVyZ2VPcHRpb25zID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgdmFyIHJlcXVlc3RPcHRpb25zID0gbWVyZ2Uoe30sIGRlZmF1bHRPcHRpb25zLCBvcHRpb25zKTtcblxuICAgICAgICBoYW5kbGVSZXF1ZXN0T3B0aW9ucyhyZXF1ZXN0T3B0aW9ucyk7XG5cbiAgICAgICAgcmV0dXJuIHJlcXVlc3RPcHRpb25zO1xuICAgIH07XG59XG5cbi8qKlxuICogU2VuZCBhbiBodHRwIHJlcXVlc3QuXG4gKlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zIHRvIHVzZSwgd2hpY2ggd2lsbCBiZSBtZXJnZWQgaW50byBhIGNvcHkgb2YgdGhlIGRlZmF1bHQgb3B0aW9ucy5cbiAqIEBwYXJhbSB7UmVxdWVzdFN1Y2Nlc3NDYWxsYmFja30gb25zdWNjZXNzIFRoZSBjYWxsYmFjayB0byBjYWxsIG9uIHN1Y2Nlc3MuXG4gKiBAcGFyYW0ge1JlcXVlc3RFcnJvckNhbGxiYWNrfSBvbmVycm9yIFRoZSBjYWxsYmFjayB0byBjYWxsIG9uIGVycm9yLlxuICogQHJldHVybnMge0h0dHBSZXF1ZXN0fSBSZXR1cm5zIGFuIGluc3RhbmNlIG9mIGBIdHRwUmVxdWVzdGAuXG4gKi9cbkh0dHBDbGllbnQucHJvdG90eXBlLnNlbmQgPSBmdW5jdGlvbiAob3B0aW9ucywgb25zdWNjZXNzLCBvbmVycm9yKSB7XG4gICAgdmFyIHJlcXVlc3RPcHRpb25zID0gdGhpcy5tZXJnZU9wdGlvbnMob3B0aW9ucyk7XG5cbiAgICByZXF1ZXN0T3B0aW9ucy5yZXF1ZXN0RnVuY3Rpb25OYW1lID0gJ3NlbmQnO1xuICAgIHJlcXVlc3RPcHRpb25zLmNvbnRyb2xsZXIgPSBudWxsO1xuXG4gICAgcmV0dXJuIG5ldyBIdHRwUmVxdWVzdChyZXF1ZXN0T3B0aW9ucywgb25zdWNjZXNzLCBvbmVycm9yKTtcbn07XG5cbi8qKlxuICogU2VuZCBhbiBodHRwIHJlcXVlc3QgYW5kIHJldHVybiBhIHByb21pc2UuXG4gKlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zIHRvIHVzZSwgd2hpY2ggd2lsbCBiZSBtZXJnZWQgaW50byBhIGNvcHkgb2YgdGhlIGRlZmF1bHQgb3B0aW9ucy5cbiAqIEByZXR1cm5zIHtQcm9taXNlfSBSZXR1cm5zIGFuIGluc3RhbmNlIG9mIGBQcm9taXNlYC5cbiAqL1xuSHR0cENsaWVudC5wcm90b3R5cGUuZmV0Y2ggPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgIHZhciByZXF1ZXN0T3B0aW9ucyA9IHRoaXMubWVyZ2VPcHRpb25zKG9wdGlvbnMpO1xuICAgIHZhciBjb250cm9sbGVyID0gcmVxdWVzdE9wdGlvbnMuY29udHJvbGxlcjtcblxuICAgIHJlcXVlc3RPcHRpb25zLnJlcXVlc3RGdW5jdGlvbk5hbWUgPSAnZmV0Y2gnO1xuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgdmFyIHJlcXVlc3QgPSBuZXcgSHR0cFJlcXVlc3QocmVxdWVzdE9wdGlvbnMsIGZ1bmN0aW9uIChyZXNwb25zZSkge1xuICAgICAgICAgICAgaWYgKGNvbnRyb2xsZXIpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWNvbnRyb2xsZXIuaXNDYW5jZWxlZCgpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUocmVzcG9uc2UpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShyZXNwb25zZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sIHJlamVjdCk7XG5cbiAgICAgICAgaWYgKGNvbnRyb2xsZXIpIHtcbiAgICAgICAgICAgIC8vIFRyaWdnZXIgdGhlIGBFUlJfQ0FOQ0VMRURgIGVycm9yLlxuICAgICAgICAgICAgaWYgKGNvbnRyb2xsZXIuaXNDYW5jZWxlZCgpKSB7XG4gICAgICAgICAgICAgICAgcmVxdWVzdC5jYW5jZWwoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29udHJvbGxlci5yZWdpc3RlckNhbmNlbENhbGxiYWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdC5jYW5jZWwoKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xufTtcblxuLyoqXG4gKiBTZW5kIGEganNvbnAgcmVxdWVzdC5cbiAqXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMgdG8gdXNlLCB3aGljaCB3aWxsIGJlIG1lcmdlZCBpbnRvIGEgY29weSBvZiB0aGUgZGVmYXVsdCBvcHRpb25zLlxuICogQHBhcmFtIHtSZXF1ZXN0U3VjY2Vzc0NhbGxiYWNrfSBvbnN1Y2Nlc3MgVGhlIGNhbGxiYWNrIHRvIGNhbGwgb24gc3VjY2Vzcy5cbiAqIEBwYXJhbSB7UmVxdWVzdEVycm9yQ2FsbGJhY2t9IG9uZXJyb3IgVGhlIGNhbGxiYWNrIHRvIGNhbGwgb24gZXJyb3IuXG4gKiBAcmV0dXJucyB7SlNPTlBSZXF1ZXN0fSBSZXR1cm5zIGFuIGluc3RhbmNlIG9mIGBKU09OUFJlcXVlc3RgLlxuICovXG5IdHRwQ2xpZW50LnByb3RvdHlwZS5nZXRKU09OUCA9IGZ1bmN0aW9uIChvcHRpb25zLCBvbnN1Y2Nlc3MsIG9uZXJyb3IpIHtcbiAgICB2YXIgcmVxdWVzdE9wdGlvbnMgPSB0aGlzLm1lcmdlT3B0aW9ucyhvcHRpb25zKTtcblxuICAgIHJlcXVlc3RPcHRpb25zLnJlcXVlc3RGdW5jdGlvbk5hbWUgPSAnZ2V0SlNPTlAnO1xuICAgIHJlcXVlc3RPcHRpb25zLmNvbnRyb2xsZXIgPSBudWxsO1xuXG4gICAgcmV0dXJuIG5ldyBKU09OUFJlcXVlc3QocmVxdWVzdE9wdGlvbnMsIG9uc3VjY2Vzcywgb25lcnJvcik7XG59O1xuXG4vKipcbiAqIFNlbmQgYSBqc29ucCByZXF1ZXN0IGFuZCByZXR1cm4gYSBwcm9taXNlLlxuICpcbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucyB0byB1c2UsIHdoaWNoIHdpbGwgYmUgbWVyZ2VkIGludG8gYSBjb3B5IG9mIHRoZSBkZWZhdWx0IG9wdGlvbnMuXG4gKiBAcmV0dXJucyB7UHJvbWlzZX0gUmV0dXJucyBhbiBpbnN0YW5jZSBvZiBgUHJvbWlzZWAuXG4gKi9cbkh0dHBDbGllbnQucHJvdG90eXBlLmZldGNoSlNPTlAgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgIHZhciByZXF1ZXN0T3B0aW9ucyA9IHRoaXMubWVyZ2VPcHRpb25zKG9wdGlvbnMpO1xuICAgIHZhciBjb250cm9sbGVyID0gcmVxdWVzdE9wdGlvbnMuY29udHJvbGxlcjtcblxuICAgIHJlcXVlc3RPcHRpb25zLnJlcXVlc3RGdW5jdGlvbk5hbWUgPSAnZmV0Y2hKU09OUCc7XG5cbiAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICB2YXIgcmVxdWVzdCA9IG5ldyBKU09OUFJlcXVlc3QocmVxdWVzdE9wdGlvbnMsIGZ1bmN0aW9uIChyZXNwb25zZSkge1xuICAgICAgICAgICAgaWYgKGNvbnRyb2xsZXIpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWNvbnRyb2xsZXIuaXNDYW5jZWxlZCgpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUocmVzcG9uc2UpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShyZXNwb25zZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sIHJlamVjdCk7XG5cbiAgICAgICAgaWYgKGNvbnRyb2xsZXIpIHtcbiAgICAgICAgICAgIC8vIFRyaWdnZXIgdGhlIGBFUlJfQ0FOQ0VMRURgIGVycm9yLlxuICAgICAgICAgICAgaWYgKGNvbnRyb2xsZXIuaXNDYW5jZWxlZCgpKSB7XG4gICAgICAgICAgICAgICAgcmVxdWVzdC5jYW5jZWwoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29udHJvbGxlci5yZWdpc3RlckNhbmNlbENhbGxiYWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdC5jYW5jZWwoKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xufTtcblxuLyoqXG4gKiBDcmVhdGUgYSBuZXcgaW5zdGFuY2Ugb2YgYENhbmNlbENvbnRyb2xsZXJgLlxuICpcbiAqIEByZXR1cm5zIHtDYW5jZWxDb250cm9sbGVyfSBSZXR1cm5zIGFuIG5ldyBpbnN0YW5jZSBvZiBgQ2FuY2VsQ29udHJvbGxlcmAuXG4gKi9cbkh0dHBDbGllbnQucHJvdG90eXBlLmNyZWF0ZUNhbmNlbENvbnRyb2xsZXIgPSBjcmVhdGVDYW5jZWxDb250cm9sbGVyO1xuXG4vKipcbiAqIENyZWF0ZSBhIG5ldyBpbnN0YW5jZSBvZiBgQ2FuY2VsQ29udHJvbGxlcmAuXG4gKlxuICogQHJldHVybnMge0NhbmNlbENvbnRyb2xsZXJ9IFJldHVybnMgYW4gbmV3IGluc3RhbmNlIG9mIGBDYW5jZWxDb250cm9sbGVyYC5cbiAqL1xuSHR0cENsaWVudC5jcmVhdGVDYW5jZWxDb250cm9sbGVyID0gY3JlYXRlQ2FuY2VsQ29udHJvbGxlcjtcblxuLy8gVGhlIHZlcnNpb24uXG5IdHRwQ2xpZW50LnZlcnNpb24gPSBIdHRwQ2xpZW50LnByb3RvdHlwZS52ZXJzaW9uID0gdmVyc2lvbjtcblxuLy8gVGhlIGV4cG9ydHMuXG5IdHRwQ2xpZW50LmV4cG9ydHMgPSBIdHRwQ2xpZW50LnByb3RvdHlwZS5leHBvcnRzID0gbWVyZ2Uoe1xuICAgIENhbmNlbENvbnRyb2xsZXI6IENhbmNlbENvbnRyb2xsZXIsXG4gICAgSHR0cENsaWVudDogSHR0cENsaWVudCxcbiAgICBIdHRwUmVxdWVzdDogSHR0cFJlcXVlc3QsXG4gICAgSHR0cFJlc3BvbnNlOiBIdHRwUmVzcG9uc2UsXG4gICAgSHR0cFJlc3BvbnNlRXJyb3I6IEh0dHBSZXNwb25zZUVycm9yLFxuICAgIEpTT05QUmVxdWVzdDogSlNPTlBSZXF1ZXN0LFxuICAgIEpTT05QUmVzcG9uc2U6IEpTT05QUmVzcG9uc2UsXG4gICAgSlNPTlBSZXNwb25zZUVycm9yOiBKU09OUFJlc3BvbnNlRXJyb3IsXG4gICAgUmVxdWVzdDogUmVxdWVzdCxcbiAgICBSZXNwb25zZTogUmVzcG9uc2UsXG4gICAgUmVzcG9uc2VFcnJvcjogUmVzcG9uc2VFcnJvcixcbiAgICBjcmVhdGVEZWZhdWx0T3B0aW9uczogY3JlYXRlRGVmYXVsdE9wdGlvbnNcbn0sIGNvbnN0YW50cyk7XG5cbm1vZHVsZS5leHBvcnRzID0gSHR0cENsaWVudDtcblxuLyoqXG4gKiBUaGlzIGNhbGxiYWNrIGlzIHVzZWQgdG8gaGFubGRlIHRoZSBtZXJnZWQgcmVxdWVzdCBvcHRpb25zLiBJdCBtdXN0IHJldHJ1biB0aGUgcmVzdWx0IHN5bmNocm9ub3VzbHkuXG4gKlxuICogQGNhbGxiYWNrIEhhbmRsZU9wdGlvbnNGdW5jdGlvblxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgbWVyZ2VkIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEByZXR1cm5zIHt2b2lkfVxuICovXG5cbi8qKlxuICogVGhlIGNhbGxiYWNrIHRvIGNhbGwgb24gc3VjY2Vzcy5cbiAqXG4gKiBAY2FsbGJhY2sgUmVxdWVzdFN1Y2Nlc3NDYWxsYmFja1xuICogQHBhcmFtIHtIdHRwUmVzcG9uc2V8YW55fSByZXNwb25zZSBUaGUgaHR0cCByZXNwb25zZSBvciB0aGUgcmV0dXJuIHZhbHVlIG9mIGBvcHRpb25zLnRyYW5zZm9ybVJlc3BvbnNlKHJlc3BvbnNlKWAuXG4gKi9cblxuLyoqXG4gKiBUaGUgY2FsbGJhY2sgdG8gY2FsbCBvbiBlcnJvci5cbiAqXG4gKiBAY2FsbGJhY2sgUmVxdWVzdEVycm9yQ2FsbGJhY2tcbiAqIEBwYXJhbSB7SHR0cFJlc3BvbnNlRXJyb3J8YW55fSBlcnJvciBUaGUgaHR0cCByZXNwb25zZSBlcnJvciBvciB0aGUgcmV0dXJuIHZhbHVlIG9mIGBvcHRpb25zLnRyYW5zZm9ybUVycm9yKGVycm9yKWAuXG4gKi9cblxuLyoqXG4gKiBUaGUgZGVmaW5pdG9uIG9mIHRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKlxuICogQHR5cGVkZWYge09iamVjdC48c3RyaW5nLCAqPn0gUmVxdWVzdE9wdGlvbnNcbiAqXG4gKiBAcHJvcGVydHkge3N0cmluZ30gW21ldGhvZF0gVGhlIGh0dHAgcmVxdWVzdCBtZXRob2QuIFRoZSBkZWZhdWx0IG1ldGhvZCBpcyBgR0VUYC5cbiAqXG4gKiBAcHJvcGVydHkge3N0cmluZ30gW2Jhc2VVUkxdIFRoZSByZXF1ZXN0IGJhc2UgdXJsLiBJZiB0aGUgYHVybGAgaXMgcmVsYXRpdmUgdXJsLCBhbmQgdGhlIGBiYXNlVVJMYCBpcyBub3QgYG51bGxgLCB0aGVcbiAqIGBiYXNlVVJMYCB3aWxsIGJlIHByZXBlbmQgdG8gdGhlIGB1cmxgLlxuICpcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSB1cmwgVGhlIHJlcXVlc3QgdXJsIHRoYXQgY2FuIGNvbnRhaW4gYW55IG51bWJlciBvZiBwbGFjZWhvbGRlcnMsIGFuZCB3aWxsIGJlIGNvbXBpbGVkIHdpdGggdGhlXG4gKiBkYXRhIHRoYXQgcGFzc2VkIGluIHdpdGggYG9wdGlvbnMubW9kZWxgLlxuICpcbiAqIEBwcm9wZXJ0eSB7T2JqZWN0LjxzdHJpbmcsICo+fSBbbW9kZWxdIFRoZSBkYXRhIHVzZWQgdG8gY29tcGlsZSB0aGUgcmVxdWVzdCB1cmwuXG4gKlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgKj59IFtxdWVyeV0gVGhlIGRhdGEgdGhhdCB3aWxsIGJlIGNvbXBpbGVkIHRvIHF1ZXJ5IHN0cmluZy5cbiAqXG4gKiBAcHJvcGVydHkge09iamVjdC48c3RyaW5nLCAqPn0gW2JvZHldIFRoZSBvYmplY3QgdGhhdCBjb250YWlucyB0aGUgY29udGVudCB3aGljaCB3aWxsIGJlIHNlbmQgdG8gdGhlIHNlcnZlci4gVGhpc1xuICogb2JqZWN0IGhhcyBvbmx5IG9uZSBwcm9wZXJ0eS4gVGhlIG5hbWUgb2YgdGhlIHByb3BlcnR5IGlzIHRoZSBjb250ZW50IHR5cGUgb2YgdGhlIGNvbnRlbnQsIHdoaWNoIHdpbGwgYmUgdXNlZCB0byBmaW5kXG4gKiBhIHByb2Nlc3NvciBpbiBgb3B0aW9ucy5odHRwUmVxdWVzdEJvZHlQcm9jZXNzb3JgLiBUaGUgcHJvY2Vzc29yIGlzIHVzZWQgdG8gcHJvY2VzcyB0aGUgdmFsdWUgb2YgdGhlIHByb3BlcnR5LiBUaGVcbiAqIHByb2Nlc3NlZCB2YWx1ZSB3aGljaCB0aGUgcHJvY2Vzc29yIHJldHVybnMgd2lsbCBiZSBzZW5kIHRvIHRoZSBzZXJ2ZXIgYXMgdGhlIHJlcXVlc3QgYm9keS5cbiAqXG4gKiBAcHJvcGVydHkge251bWJlcn0gW3RpbWVvdXRdIFRoZSBudW1iZXIgb2YgbWlsbGlzZWNvbmRzIHRoZSByZXF1ZXN0IGNhbiB0YWtlIGJlZm9yZSBpdCBmaW5pc2hlZC4gSWYgdGhlIHRpbWVvdXQgdmFsdWVcbiAqIGlzIGAwYCwgbm8gdGltZXIgd2lsbCBiZSBzZXQuIElmIHRoZSByZXF1ZXN0IGRvZXMgbm90IGZpbnNpaGVkIHdpdGhpbiB0aGUgZ2l2ZW4gdGltZSwgYSB0aW1lb3V0IGVycm9yIHdpbGwgYmUgdGhyb3duLlxuICogVGhlIGRlZmF1bHQgdmFsdWUgaXMgYDBgLlxuICpcbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gW2NvcnNdIFdoZXRoZXIgdG8gc2V0IGB3aXRoQ3JlZGVudGlhbHNgIHByb3BlcnR5IG9mIHRoZSBgWE1MSHR0cFJlcXVlc3RgIHRvIGB0cnVlYC4gVGhlIGRlZmF1bHRcbiAqIHZhbHVlIGlzIGBmYWxzZWAuXG4gKlxuICogQHByb3BlcnR5IHtib29sZWFufSBbbm9DYWNoZV0gV2hldGhlciB0byBkaXNhYmxlIHRoZSBjYWNoZS4gSWYgdGhlIHZhbHVlIGlzIGB0cnVlYCwgdGhlIGhlYWRlcnMgaW5cbiAqIGBvcHRpb25zLm5vQ2FjaGVIZWFkZXJzYCB3aWxsIGJlIHNldC4gVGhlIGRlZmF1bHQgdmFsdWUgaXMgYGZhbHNlYC5cbiAqXG4gKiBAcHJvcGVydHkge09iamVjdC48c3RyaW5nLCAqPn0gW25vQ2FjaGVIZWFkZXJzXSBUaGUgaGVhZGVycyB0byBzZXQgd2hlbiBgb3B0aW9ucy5ub0NhY2hlYCBpcyBzZXQgdG8gYHRydWVgLlxuICpcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbanNvbnBdIFRoZSBxdWVyeSBzdHJpbmcga2V5IHRvIGhvbGQgdGhlIHZhbHVlIG9mIHRoZSBjYWxsYmFjayBuYW1lIHdoZW4gc2VuZGluZyBKU09OUCByZXF1ZXN0LlxuICogVGhlIGRlZmF1bHQgdmFsdWVzIGlzIGBjYWxsYmFja2AuXG4gKlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgKj59IFtzZXR0aW5nc10gVGhlIG9iamVjdCB0byBrZWVwIHRoZSBzZXR0aW5ncyBpbmZvcm1hdGlvbiB0aGF0IHRoZSB1c2VyIHBhc3NlZCBpbi4gVGhlXG4gKiBsaWJyYXJ5IGl0c2VsZiB3aWxsIG5vdCB0b3VjaCB0aGlzIHByb3BlcnR5LiBZb3UgY2FuIHVzZSB0aGlzIHByb3BlcnR5IHRvIGhvbGQgYW55IGluZm9ybWF0aW9uIHRoYXQgeW91IHdhbnQsIHdoZW5cbiAqIHlvdSBleHRlbmQgdGhlIGZ1bmN0aW9uYWxpdHkgb2YgeW91ciBvd24gaW5zdGFuY2Ugb2YgYEh0dHBDbGllbnRgLiBUaGUgZGVmYXVsdCB2YWx1ZSBvZiB0aGlzIHByb3BlcnR5IGlzIGFuIGVtcHR5XG4gKiBvYmplY3QuXG4gKlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgKj59IFtoZWFkZXJzXSBUaGUgb2JqZWN0IHRoYXQgY29udGFpbnMgdGhlIGhlYWRlcnMgdG8gc2V0IHdoZW4gc2VuZGluZyB0aGUgcmVxdWVzdC4gT25seVxuICogdGhlIG5vbi11bmRlZmluZWQgYW5kIG5vbi1udWxsIGhlYWRlcnMgYXJlIHNldC5cbiAqXG4gKiBAcHJvcGVydHkge0NhbmNlbENvbnRyb2xsZXJ9IFtjb250cm9sbGVyXSBUaGUgYENhbmNlbENvbnRyb2xsZXJgIHVzZWQgdG8gY2FuY2VsIHRoZSByZXF1ZXN0LiBJdCBvbmx5IHdvcmtzIHdoZW4gdXNpbmdcbiAqIGBmZXRjaGAgb3IgYGZldGNoSlNPTlBgIHRvIHNlbmQgcmVxdWVzdC4gSWYgdGhlIHlvdSBzZW5kIHJlcXVlc3QgdXNpbmcgYHNlbmRgIG9yIGBnZXRKU09OUGAsIHRoZSBgb3B0aW9ucy5jb250cm9sbGVyYFxuICogd2lsbCBiZSBzZXQgdG8gYG51bGxgLlxuICpcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbcmVxdWVzdEZ1bmN0aW9uTmFtZV0gVGhlIG5hbWUgb2YgdGhlIGZ1bmN0aW9uIHRoYXQgc2VuZCB0aGUgcmVxdWVzdC4gQ2FuIGJlIGBzZW5kYCwgYGZldGNoYCxcbiAqIGBnZXRKU09OUGAsIGBmZXRjaEpTT05QYC4gVGhpcyB2YWx1ZSBpcyBzZXQgYnkgdGhlIGxpYnJhcnksIGRvbid0IGNoYW5nZSBpdC5cbiAqXG4gKiBAcHJvcGVydHkge3N0cmluZ30gW3JlcXVlc3RUeXBlXSBUaGUgcmVxdWVzdCB0eXBlIG9mIHRoaXMgcmVxdWVzdC4gVGhlIHZhbHVlIG9mIGl0IGlzIHNldCBieSB0aGUgbGlicmFyeSBpdHNlbGYsIGNhblxuICogYmUgYEhUVFBfUkVRVUVTVGAgb3IgYEpTT05QX1JFUVVFU1RgLiBBbnkgb3RoZXIgdmFsdWUgdGhlIHVzZXIgcGFzc2VkIGluIGlzIGlnbm9yZWQuIFlvdSBjYW4gdXNlIHRoaXMgcHJvcGVydHkgdG8gZ2V0XG4gKiB0aGUgdHlwZSBvZiB0aGUgY3VycmVudCByZXF1ZXN0LlxuICpcbiAqIEBwcm9wZXJ0eSB7T2JqZWN0LjxzdHJpbmcsICo+fSBbeGhyUHJvcHNdIFRoZSBvYmplY3QgdGhhdCBjb250YWlucyB0aGUgcHJvcGVydGllcyB0byBzZXQgb24gdGhlIGluc3RhbmNlIG9mIHRoZVxuICogYFhNTEh0dHBSZXF1ZXN0YC5cbiAqXG4gKiBAcHJvcGVydHkge3N0cmluZ30gW3VzZXJuYW1lXSBUaGUgdXNlciBuYW1lIHRvIHVzZSBmb3IgYXV0aGVudGljYXRpb24gcHVycG9zZXMuIFRoZSBkZWZ1YWx0IHZhbHVlIGlzIGBudWxsYC5cbiAqXG4gKiBAcHJvcGVydHkge3N0cmluZ30gW3Bhc3N3b3JkXSBUaGUgcGFzc3dvcmQgdG8gdXNlIGZvciBhdXRoZW50aWNhdGlvbiBwdXJwb3Nlcy4gVGhlIGRlZnVhbHQgdmFsdWUgaXMgYG51bGxgLlxuICpcbiAqIEBwcm9wZXJ0eSB7T2JqZWN0LjxzdHJpbmcsIGh0dHBSZXF1ZXN0Qm9keVByb2Nlc3Nvcj59IFtodHRwUmVxdWVzdEJvZHlQcm9jZXNzb3JdIFRoZSBvYmplY3QgdGhhdCBjb250YWlucyB0aGVcbiAqIGh0dHAgcmVxdWVzdCBib2R5IHByb2Nlc3NvcnMuXG4gKlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgUmVzcG9uc2VNaXhpbkZ1bmN0aW9uPn0gW2h0dHBSZXNwb25zZU1peGluXSBUaGUgb2JqZWN0IHRoYXQgY29udGFpbnMgdGhlIGh0dHAgcmVzcG9uc2VcbiAqIG1peGlucy5cbiAqXG4gKiBAcHJvcGVydHkge09iamVjdC48c3RyaW5nLCBSZXNwb25zZU1peGluRnVuY3Rpb24+fSBbanNvbnBSZXNwb25zZU1peGluXSBUaGUgb2JqZWN0IHRoYXQgY29udGFpbnMgdGhlIGpzb25wIHJlc3BvbnNlXG4gKiBtaXhpbnMuXG4gKlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgUmVzcG9uc2VFcnJvck1peGluRnVuY3Rpb24+fSBbaHR0cFJlc3BvbnNlRXJyb3JNaXhpbl0gVGhlIG9iamVjdCB0aGF0IGNvbnRhaW5zIHRoZSBodHRwXG4gKiByZXNwb25zZSBlcnJvciBtaXhpbnMuXG4gKlxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywgUmVzcG9uc2VFcnJvck1peGluRnVuY3Rpb24+fSBbanNvbnBSZXNwb25zZUVycm9yTWl4aW5dIFRoZSBvYmplY3QgdGhhdCBjb250YWlucyB0aGUganNvbnBcbiAqIHJlc3BvbnNlIGVycm9yIG1peGlucy5cbiAqXG4gKiBAcHJvcGVydHkge0hhbmxkZU9wdGlvbnNGdW5jdGlvbn0gW2hhbmRsZU9wdGlvbnNdIFRoZSBmdW5jdGlvbiB0byBoYW5kbGUgdGhlIG9wdGlvbnMuXG4gKlxuICogQHByb3BlcnR5IHtDcmVhdGVYSFJGdW5jdGlvbn0gW2NyZWF0ZVhIUl0gVGhlIGZ1bmN0aW9uIHRvIGNyZWF0ZSB0aGUgYFhNTEh0dHBSZXF1ZXN0YCBpbnN0YW5jZS5cbiAqXG4gKiBAcHJvcGVydHkge1NjcmlwdENyZWF0ZUZ1bmN0aW9ufSBbY3JlYXRlU2NyaXB0XSBUaGUgZnVuY3Rpb24gdG8gY3JlYXRlIHRoZSBgSFRNTFNjcmlwdEVsZW1lbnRgIGluc3RhbmNlLlxuICpcbiAqIEBwcm9wZXJ0eSB7SlNPTlBDb250YWluZXJGaW5kRnVuY3Rpb259IFtqc29ucENvbnRhaW5lck5vZGVdIFRoZSBmdW5jdGlvbiB0aGF0IHJldHVybnMgdGhlIGNvbnRhaW5lciBub2RlLCB3aGljaCB3aWxsXG4gKiBiZSB1c2VkIHRvIGFwcGVuZCB0aGUgc2NyaXB0IGVsZW1lbnQgd2hlbiBzZW5kaW5nIGpzb25wIHJlcXVlc3QuXG4gKlxuICogQHByb3BlcnR5IHtKU09OUENhbGxiYWNrTmFtZUdlbmVyYXRlRnVuY3Rpb259IFtqc29ucENhbGxiYWNrTmFtZV0gVGhlIGZ1bmN0aW9uIHRvIGdlbmVyYXRlIHRoZSB1bmlxdWUgY2FsbGJhY2sgbmFtZVxuICogd2hlbiBzZW5kaW5nIGpzb25wIHJlcXVlc3QuXG4gKlxuICogQHByb3BlcnR5IHtDb21waWxlVVJMRnVuY3Rpb259IFtjb21waWxlVVJMXSBUaGUgZnVuY3Rpb24gdG8gY29tcGlsZSB1cmwuXG4gKlxuICogQHByb3BlcnR5IHtFbmNvZGVRdWVyeVN0cmluZ0Z1bmN0aW9ufSBlbmNvZGVRdWVyeVN0cmluZyBUaGUgZnVuY3Rpb24gdG8gZW5jb2RlIHRoZSBxdWVyeSBzdHJpbmcuXG4gKlxuICogQHByb3BlcnR5IHtYSFJIb29rRnVuY3Rpb259IG9uWGhyQ3JlYXRlZCBUaGUgZnVuY3Rpb24gdG8gY2FsbCBvbiB4aHIgY3JlYXRlZC5cbiAqXG4gKiBAcHJvcGVydHkge1hIUkhvb2tGdW5jdGlvbn0gb25YaHJPcGVuZWQgVGhlIGZ1bmN0b24gdG8gY2FsbCBvbiB4aHIgb3BlbmVkLlxuICpcbiAqIEBwcm9wZXJ0eSB7WEhSSG9va0Z1bmN0aW9ufSBvblhoclNlbnQgVGhlIGZ1bmN0aW9uIHRvIGNhbGwgb24geGhyIHNlbnQuXG4gKlxuICogQHByb3BlcnR5IHtSZXF1ZXN0Q3JlYXRlZEZ1bmN0aW9ufSBvblJlcXVlc3RDcmVhdGVkIFRoZSBmdW5jdGlvbiB0byBjYWxsIG9uIHJlcXVlc3QgY3JlYXRlZC5cbiAqXG4gKiBAcHJvcGVydHkge0NoZWNrUmVzcG9uc2VPa0Z1bmN0aW9ufSBpc1Jlc3BvbnNlT2sgVGhlIGZ1bmN0aW9uIHRvIGNoZWNrIHdoZXRoZXIgdGhlIHJlc3BvbnNlIGlzIG9rLlxuICpcbiAqIEBwcm9wZXJ0eSB7VHJhbnNmb3JtRXJyb3JGdW5jdGlvbn0gdHJhbnNmb3JtRXJyb3IgVGhlIGZ1bmN0aW9uIHRvIHRyYW5zZnJvbSB0aGUgcmVzcG9uc2UgZXJyb3IuIFRoZSByZXR1cm4gdmFsdWUgb2ZcbiAqIHRoaXMgZnVuY3Rpb24gd2lsbCBiZSBwYXNzZWQgdG8gdGhlIGBvbmVycm9yYCBjYWxsYmFjay5cbiAqXG4gKiBAcHJvcGVydHkge1RyYW5zZm9ybVJlc3BvbnNlRnVuY3Rpb259IHRyYW5zZm9ybVJlc3BvbnNlIFRoZSBmdW5jdGlvbiB0byB0cmFuc2Zyb20gdGhlIHJlc3BvbnNlLiBUaGUgcmV0dXJuIHZhbHVlIG9mXG4gKiB0aGlzIGZ1bmN0aW9uIHdpbGwgYmUgcGFzc2VkIHRvIHRoZSBgb25zdWNjZXNzYCBjYWxsYmFjay5cbiAqXG4gKiBAcHJvcGVydHkge0NoZWNrU2hvdWxkQ2FsbEVycm9yQ2FsbGJhY2tGdW5jdGlvbn0gc2hvdWxkQ2FsbEVycm9yQ2FsbGJhY2sgVGhlIGZ1bmN0aW9uIHRvIGNoZWNrIHdoZXRoZXIgdG8gY2FsbCB0aGVcbiAqIGVycm9yIGNhbGxiYWNrLlxuICpcbiAqIEBwcm9wZXJ0eSB7Q2hlY2tTaG91bGRDYWxsU3VjY2Vzc0NhbGxiYWNrRnVuY3Rpb259IHNob3VsZENhbGxTdWNjZXNzQ2FsbGJhY2sgVGhlIGZ1bmN0aW9uIHRvIGNoZWNrIHdoZXRoZXIgdG8gY2FsbFxuICogdGhlIHN1Y2Nlc3MgY2FsbGJhY2suXG4gKi9cblxuLyoqXG4gKiBUaGUgZGVmaW5pdG9uIG9mIGh0dHAgcmVxdWVzdCBkYXRhIHByb2Nlc3Nvci5cbiAqXG4gKiBAdHlwZWRlZiB7T2JqZWN0LjxzdHJpbmcsICo+fSBodHRwUmVxdWVzdEJvZHlQcm9jZXNzb3JcbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBwcmlvcml0eSBUaGUgcHJpb3JpdHkgb2YgdGhlIHByb2Nlc3Nvci5cbiAqIEBwcm9wZXJ0eSB7T2JqZWN0LjxzdHJpbmcsICo+fSBbaGVhZGVyc10gVGhlIGhlYWRlcnMgdG8gc2V0IHdoZW4gdGhpcyBwcm9jZXNzb3IgaXMgdXNlZC5cbiAqIEBwcm9wZXJ0eSB7SHR0cFJlcXVlc3RDb250ZW50UHJvY2Vzc0Z1bmN0aW9ufSBbcHJvY2Vzc29yXSBUaGUgZnVuY3Rpb24gdG8gcHJvY2VzcyB0aGUgcmVxdWVzdCBib2R5LlxuICovXG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGhhbmRsZSB0aGUgb3B0aW9ucy5cbiAqXG4gKiBAY2FsbGJhY2sgSGFubGRlT3B0aW9uc0Z1bmN0aW9uXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKi9cblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gcHJvY2VzcyB0aGUgcmVxdWVzdCBkYXRhLlxuICpcbiAqIEBjYWxsYmFjayBIdHRwUmVxdWVzdENvbnRlbnRQcm9jZXNzRnVuY3Rpb25cbiAqIEBwYXJhbSB7T2JqZWN0LjxzdHJpbmcsICo+fSBjb250ZW50IFRoZSBjb25lbnQgbmVlZCB0byBwcm9jZXNzLlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zIG9mIHRoZSBjdXJyZW50IHJlcXVlc3QuXG4gKiBAcmV0dXJucyB7YW55fSBSZXR1cm5zIHRoZSB2YWx1ZSB0aGF0IHdpbGwgYmUgc2VuZCB0byB0aGUgc2VydmVyLlxuICovXG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIHBhcnNlIHRoZSByZXNwb25zZS4gVGhpcyBmdW5jdGlvbiB3aWxsIGJlIG1vdW50ZWQgb24gdGhlIHJlc3BvbnNlIGluc3RhbmNlLCB3aGljaCBtYWRlIGl0IGEgbWV0aG9kXG4gKiBvZiB0aGUgYFJlc3BvbnNlYCBpbnN0YW5jZS4gVGhlIHBhcmFtZXRlcnMgYW5kIHRoZSByZXR1cm4gdmFsdWUgaXMgdXAgb24geW91LlxuICpcbiAqIEBjYWxsYmFjayBSZXNwb25zZU1peGluRnVuY3Rpb25cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBwYXJzZSB0aGUgcmVzcG9uc2UgZXJyb3IuIFRoaXMgZnVuY3Rpb24gd2lsbCBiZSBtb3VudGVkIG9uIHRoZSByZXNwb25zZSBlcnJvciBpbnN0YW5jZSwgd2hpY2ggbWFkZSBpdFxuICogYSBtZXRob2Qgb2YgdGhlIGBSZXNwb25zZUVycm9yYCBpbnN0YW5jZS4gVGhlIHBhcmFtZXRlcnMgYW5kIHRoZSByZXR1cm4gdmFsdWUgaXMgdXAgb24geW91LlxuICpcbiAqIEBjYWxsYmFjayBSZXNwb25zZUVycm9yTWl4aW5GdW5jdGlvblxuICovXG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGNyZWF0ZSB0aGUgYFhNTEh0dHBSZXF1ZXN0YCBpbnN0YW5jZS5cbiAqXG4gKiBAY2FsbGJhY2sgQ3JlYXRlWEhSRnVuY3Rpb25cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEByZXR1cm5zIHtYTUxIdHRwUmVxdWVzdH0gUmV0dXJucyBhbiBpbnN0YW5jZSBvZiBgWE1MSHR0cFJlcXVlc3RgLlxuICovXG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGNyZWF0ZSB0aGUgYEhUTUxTY3JpcHRFbGVtZW50YCBpbnN0YW5jZS5cbiAqXG4gKiBAY2FsbGJhY2sgU2NyaXB0Q3JlYXRlRnVuY3Rpb25cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEByZXR1cm5zIHtIVE1MU2NyaXB0RWxlbWVudH0gUmV0dXJucyBhbiBpbnN0YW5jZSBvZiBgSFRNTFNjcmlwdEVsZW1lbnRgLlxuICovXG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyB0aGUgbm9kZSB0byBhcHBlbmQgdGhlIHNjcmlwdCBlbGVtZW50LlxuICpcbiAqIEBjYWxsYmFjayBKU09OUENvbnRhaW5lckZpbmRGdW5jdGlvblxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICogQHJldHVybnMge05vZGV9IFJldHVybnMgdGhlIG5vZGUgdG8gYXBwZW5kIHRoZSBzY3JpcHQgZWxlbWVudC5cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBnZW5lcmF0ZSB0aGUgdW5pcXVlIGNhbGxiYWNrIG5hbWUuXG4gKlxuICogQGNhbGxiYWNrIEpTT05QQ2FsbGJhY2tOYW1lR2VuZXJhdGVGdW5jdGlvblxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICogQHJldHVybnMge3N0cmluZ30gUmV0cnVucyBhIHZhbGlkIGphdmFzY3JpcHQgaWRlbnRpZmllciB0byBob2xkIHRoZSBjYWxsYmFrLlxuICovXG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGNvbXBpbGUgdGhlIHJlcXVlc3QgdXJsLlxuICpcbiAqIEBjYWxsYmFjayBDb21waWxlVVJMRnVuY3Rpb25cbiAqIEBwYXJhbSB7c3RyaW5nfSB1cmwgVGhlIHVybCAod2l0aCBiYXNlVVJMKSB0byBjb21waWxlLlxuICogQHBhcmFtIHtPYmplY3QuPHN0cmluZywgKj59IHBhcmFtIFRoZSBwYXJhbSB0byBjb21waWxlIHRoZSB1cmwuXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBSZXR1cm5zIHRoZSBjb21waWxlZCB1cmwuXG4gKi9cblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gZW5jb2RlIHRoZSBxdWVyeSBzdHJpbmcuXG4gKlxuICogQGNhbGxiYWNrIEVuY29kZVF1ZXJ5U3RyaW5nRnVuY3Rpb25cbiAqIEBwYXJhbSB7T2JqZWN0LjxzdHJpbmcsICo+fSBkYXRhIFRoZSBkYXRhIHRvIGJlIGVuY29kZWQgdG8gcXVlcnkgc3RyaW5nLlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICogQHJldHVybnMge3N0cmluZ30gUmV0dXJucyB0aGUgZW5jb2RlZCBxdWVyeSBzdHJpbmcuXG4gKi9cblxuLyoqXG4gKiBUaGUgeGhyIGhvb2sgZnVuY3Rpb24uXG4gKlxuICogQGNhbGxiYWNrIFhIUkhvb2tGdW5jdGlvblxuICogQHBhcmFtIHtYTUxIdHRwUmVxdWVzdH0geGhyIFRoZSBpbnN0YW5jZSBvZiBgWE1MSHR0cFJlcXVlc3RgLlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICovXG5cbi8qKlxuICogQGNhbGxiYWNrIFJlcXVlc3RDcmVhdGVkRnVuY3Rpb25cbiAqIEBwYXJhbSB7SHR0cFJlcXVlc3R8SlNPTlBSZXF1ZXN0fSByZXF1ZXN0IFRoZSByZXF1ZXN0IGluc3RhbmNlLCBjYW4gYmUgYEh0dHBSZXF1ZXN0YCBvciBgSlNPTlBSZXF1ZXN0YC5cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBjaGVjayB3aGV0aGVyIHRoZSByZXNwb25zZSBpcyBvay5cbiAqXG4gKiBAY2FsbGJhY2sgQ2hlY2tSZXNwb25zZU9rRnVuY3Rpb25cbiAqIEBwYXJhbSB7c3RyaW5nfSByZXF1ZXN0VHlwZSBUaGUgcmVxdWVzdCB0eXBlLCBgSFRUUF9SRVFVRVNUYCBvciBgSlNPTlBfUkVRVUVTVGAuXG4gKiBAcGFyYW0ge1Jlc3BvbnNlfSByZXNwb25zZSBUaGUgcmVzcG9uc2UgaW5zdGFuY2UuXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIHJlc3BvbnNlIGlzIG9rLCBvdGhlcndpc2UgYGZhbHNlYCBpcyByZXR1cm5lZC5cbiAqL1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBjaGVjayB3aGV0aGVyIHRvIGNhbGwgdGhlIGVycm9yIGNhbGxiYWNrLlxuICpcbiAqIEBjYWxsYmFjayBDaGVja1Nob3VsZENhbGxFcnJvckNhbGxiYWNrRnVuY3Rpb25cbiAqIEBwYXJhbSB7c3RyaW5nfSByZXF1ZXN0VHlwZSBUaGUgcmVxdWVzdCB0eXBlLCBgSFRUUF9SRVFVRVNUYCBvciBgSlNPTlBfUkVRVUVTVGAuXG4gKiBAcGFyYW0ge2FueX0gdHJhbnNmb3JtZWRFcnJvciBUaGUgZGF0YSB0aGF0IGBvcHRpb25zLnRyYW5zZm9ybUVycm9yKC4uLilgIHJldHVybnMuXG4gKiBAcGFyYW0ge0h0dHBSZXNwb25zZUVycm9yfEpTT05QUmVzcG9uc2VFcnJvcn0gZXJyb3IgVGhlIHJlc3BvbnNlIGVycm9yLlxuICovXG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGNoZWNrIHdoZXRoZXIgdG8gY2FsbCB0aGUgc3VjY2VzcyBjYWxsYmFjay5cbiAqXG4gKiBAY2FsbGJhY2sgQ2hlY2tTaG91bGRDYWxsU3VjY2Vzc0NhbGxiYWNrRnVuY3Rpb25cbiAqIEBwYXJhbSB7c3RyaW5nfSByZXF1ZXN0VHlwZSBUaGUgcmVxdWVzdCB0eXBlLCBgSFRUUF9SRVFVRVNUYCBvciBgSlNPTlBfUkVRVUVTVGAuXG4gKiBAcGFyYW0ge2FueX0gdHJhbnNmb3JtZWRSZXNwb25zZSBUaGUgZGF0YSB0aGF0IGBvcHRpb25zLnRyYW5zZm9ybVJlc3BvbnNlKC4uLilgIHJldHVybnMuXG4gKiBAcGFyYW0ge0h0dHBSZXNwb25zZXxKU09OUFJlc3BvbnNlfSByZXNwb25zZSBUaGUgcmVzcG9uc2UuXG4gKi9cblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gdHJhbnNmcm9tIHRoZSByZXNwb25zZS4gVGhlIHJldHVybiB2YWx1ZSBvZiB0aGlzIGZ1bmN0aW9uIHdpbGwgYmUgcGFzc2VkIHRvIHRoZSBgb25zdWNjZXNzYCBjYWxsYmFjay5cbiAqXG4gKiBAY2FsbGJhY2sgVHJhbnNmb3JtUmVzcG9uc2VGdW5jdGlvblxuICogQHBhcmFtIHtzdHJpbmd9IHJlcXVlc3RUeXBlIFRoZSByZXF1ZXN0IHR5cGUsIGBIVFRQX1JFUVVFU1RgIG9yIGBKU09OUF9SRVFVRVNUYC5cbiAqIEBwYXJhbSB7SHR0cFJlc3BvbnNlfEpTT05QUmVzcG9uc2V9IHJlc3BvbnNlIFRoZSByZXNwb25zZS5cbiAqIEByZXR1cm5zIHthbnl9IFJldHVybnMgdGhlIHRyYW5zZm9ybWVkIHJlc3BvbnNlLlxuICovXG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIHRyYW5zZnJvbSB0aGUgcmVzcG9uc2UgZXJyb3IuIFRoZSByZXR1cm4gdmFsdWUgb2YgdGhpcyBmdW5jdGlvbiB3aWxsIGJlIHBhc3NlZCB0byB0aGUgYG9uZXJyb3JgXG4gKiBjYWxsYmFjay5cbiAqXG4gKiBAY2FsbGJhY2sgVHJhbnNmb3JtRXJyb3JGdW5jdGlvblxuICogQHBhcmFtIHtzdHJpbmd9IHJlcXVlc3RUeXBlIFRoZSByZXF1ZXN0IHR5cGUsIGBIVFRQX1JFUVVFU1RgIG9yIGBKU09OUF9SRVFVRVNUYC5cbiAqIEBwYXJhbSB7SHR0cFJlc3BvbnNlRXJyb3J8SlNPTlBSZXNwb25zZUVycm9yfSBlcnJvciBUaGUgcmVzcG9uc2UgZXJyb3IuXG4gKiBAcmV0dXJucyB7YW55fSBSZXR1cm5zIHRoZSB0cmFuc2Zvcm1lZCByZXNwb25zZSBlcnJvci5cbiAqL1xuIiwidmFyIFJlcXVlc3QgPSByZXF1aXJlKDkpO1xudmFyIGNvbnN0YW50cyA9IHJlcXVpcmUoMjQpO1xudmFyIGluaGVyaXRzID0gcmVxdWlyZSgzMCk7XG52YXIgYnVpbGRVUkwgPSByZXF1aXJlKDIyKTtcbnZhciBoYW5kbGVPcHRpb25zID0gcmVxdWlyZSgyOCk7XG52YXIgY2FsbFJlcXVlc3RDcmVhdGVkQ2FsbGJhY2sgPSByZXF1aXJlKDIzKTtcbnZhciBhZGRFdmVudExpc3RlbmVycyA9IHJlcXVpcmUoMTIpO1xudmFyIGhhbmRsZVhoclByb3BzID0gcmVxdWlyZSgxNyk7XG52YXIgaGFuZGxlSGVhZGVycyA9IHJlcXVpcmUoMTUpO1xudmFyIGhhbmRsZVJlcXVlc3RCb2R5ID0gcmVxdWlyZSgxNik7XG52YXIgY2FsbFhockhvb2sgPSByZXF1aXJlKDE0KTtcblxuLyoqXG4gKiBodHRwIHJlcXVlc3QuXG4gKlxuICogQGNsYXNzXG4gKiBAZXh0ZW5kcyB7UmVxdWVzdH1cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEBwYXJhbSB7UmVxdWVzdFN1Y2Nlc3NDYWxsYmFja30gb25zdWNjZXNzIFRoZSBjYWxsYmFjayB0byBjYWxsIG9uIHN1Y2Nlc3MuXG4gKiBAcGFyYW0ge1JlcXVlc3RFcnJvckNhbGxiYWNrfSBvbmVycm9yIFRoZSBjYWxsYmFjayB0byBjYWxsIG9uIGVycm9yLlxuICovXG5mdW5jdGlvbiBIdHRwUmVxdWVzdChvcHRpb25zLCBvbnN1Y2Nlc3MsIG9uZXJyb3IpIHtcbiAgICB2YXIgeGhyO1xuICAgIHZhciBib2R5O1xuICAgIHZhciB1cmw7XG5cbiAgICAvLyBDYWxsIHRoZSBzdXBlciBjb25zdHJ1Y3Rvci5cbiAgICBSZXF1ZXN0LmNhbGwodGhpcywgY29uc3RhbnRzLkhUVFBfUkVRVUVTVCwgb3B0aW9ucywgb25zdWNjZXNzLCBvbmVycm9yKTtcblxuICAgIC8vIENhbGwgYG9wdGlvbnMuaGFuZGxlT3B0aW9uc2AgdG8gaGFuZGxlIG9wdGlvbnMuXG4gICAgaGFuZGxlT3B0aW9ucyhvcHRpb25zKTtcblxuICAgIHhociA9IHRoaXMueGhyID0gb3B0aW9ucy5jcmVhdGVYSFIuY2FsbChudWxsLCBvcHRpb25zKTtcbiAgICBib2R5ID0gaGFuZGxlUmVxdWVzdEJvZHkob3B0aW9ucyk7XG4gICAgdXJsID0gYnVpbGRVUkwob3B0aW9ucyk7XG5cbiAgICAvLyBTZXQgcHJvcGVydGllcyB0byB0aGUgeGhyLlxuICAgIGhhbmRsZVhoclByb3BzKHhociwgb3B0aW9ucyk7XG5cbiAgICAvLyBDYWxsIG9uWGhyQ3JlYXRlZC5cbiAgICBjYWxsWGhySG9vayhvcHRpb25zLm9uWGhyQ3JlYXRlZCwgeGhyLCBvcHRpb25zKTtcblxuICAgIC8vIE9wZW4gdGhlIHJlcXVlc3QuXG4gICAgeGhyLm9wZW4ob3B0aW9ucy5tZXRob2QgfHwgJ0dFVCcsIHVybCwgdHJ1ZSwgb3B0aW9ucy51c2VybmFtZSwgb3B0aW9ucy5wYXNzd29yZCk7XG5cbiAgICAvLyBBZGQgZXZlbnQgbGlzdGVuZXJzLlxuICAgIGFkZEV2ZW50TGlzdGVuZXJzKHRoaXMpO1xuXG4gICAgLy8gQ2FsbCBvblhock9wZW5lZC5cbiAgICBjYWxsWGhySG9vayhvcHRpb25zLm9uWGhyT3BlbmVkLCB4aHIsIG9wdGlvbnMpO1xuXG4gICAgLy8gSGFubGRlIGhlYWRlcnMuXG4gICAgaGFuZGxlSGVhZGVycyh4aHIsIG9wdGlvbnMpO1xuXG4gICAgLy8gU2VuZCB0aGUgYm9keSB0byB0aGUgc2VydmVyLlxuICAgIHhoci5zZW5kKGJvZHkpO1xuXG4gICAgLy8gQ2FsbCBvblhoclNlbnQuXG4gICAgY2FsbFhockhvb2sob3B0aW9ucy5vblhoclNlbnQsIHhociwgb3B0aW9ucyk7XG5cbiAgICAvLyBDYWxsIG9uUmVxdWVzdENyZWF0ZWRcbiAgICBjYWxsUmVxdWVzdENyZWF0ZWRDYWxsYmFjayhvcHRpb25zLCB0aGlzKTtcbn1cblxuaW5oZXJpdHMoSHR0cFJlcXVlc3QsIFJlcXVlc3QpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEh0dHBSZXF1ZXN0O1xuIiwiLyoqXG4gKiBIdHRwUmVzcG9uc2UgbW9kdWxlLlxuICpcbiAqIEBtb2R1bGUgY2xhc3MvSHR0cFJlc3BvbnNlXG4gKi9cblxudmFyIFJlc3BvbnNlID0gcmVxdWlyZSgxMCk7XG52YXIgaW5oZXJpdHMgPSByZXF1aXJlKDMwKTtcbnZhciBhZGRNaXhpbiA9IHJlcXVpcmUoMjEpO1xuXG4vKipcbiAqIFRoZSBIdHRwUmVzcG9uc2UgY2xhc3MuXG4gKlxuICogQGNsYXNzXG4gKiBAcGFyYW0ge0h0dHBSZXF1ZXN0fSByZXF1ZXN0IFRoZSBodHRwIHJlcXVlc3QuXG4gKi9cbmZ1bmN0aW9uIEh0dHBSZXNwb25zZShyZXF1ZXN0KSB7XG4gICAgUmVzcG9uc2UuY2FsbCh0aGlzLCByZXF1ZXN0KTtcbiAgICBhZGRNaXhpbih0aGlzLCByZXF1ZXN0Lm9wdGlvbnMsICdodHRwUmVzcG9uc2VNaXhpbicpO1xufVxuXG5pbmhlcml0cyhIdHRwUmVzcG9uc2UsIFJlc3BvbnNlKTtcblxubW9kdWxlLmV4cG9ydHMgPSBIdHRwUmVzcG9uc2U7XG4iLCJ2YXIgUmVzcG9uc2VFcnJvciA9IHJlcXVpcmUoMTEpO1xudmFyIGluaGVyaXRzID0gcmVxdWlyZSgzMCk7XG52YXIgYWRkTWl4aW4gPSByZXF1aXJlKDIxKTtcblxuLyoqXG4gKiBAY2xhc3NcbiAqIEBwYXJhbSB7c3RyaW5nfSBjb2RlIFRoZSBlcnJvciBjb2RlLlxuICogQHBhcmFtIHtIdHRwUmVxdWVzdH0gcmVxdWVzdCBUaGUgaHR0cCByZXF1ZXN0LlxuICovXG5mdW5jdGlvbiBIdHRwUmVzcG9uc2VFcnJvcihjb2RlLCByZXF1ZXN0KSB7XG4gICAgUmVzcG9uc2VFcnJvci5jYWxsKHRoaXMsIGNvZGUsIHJlcXVlc3QpO1xuICAgIGFkZE1peGluKHRoaXMsIHJlcXVlc3Qub3B0aW9ucywgJ2h0dHBSZXNwb25zZUVycm9yTWl4aW4nKTtcbn1cblxuaW5oZXJpdHMoSHR0cFJlc3BvbnNlRXJyb3IsIFJlc3BvbnNlRXJyb3IpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEh0dHBSZXNwb25zZUVycm9yO1xuIiwidmFyIFJlcXVlc3QgPSByZXF1aXJlKDkpO1xudmFyIGNvbnN0YW50cyA9IHJlcXVpcmUoMjQpO1xudmFyIGluaGVyaXRzID0gcmVxdWlyZSgzMCk7XG52YXIgaGFuZGxlT3B0aW9ucyA9IHJlcXVpcmUoMjgpO1xudmFyIGNhbGxSZXF1ZXN0Q3JlYXRlZENhbGxiYWNrID0gcmVxdWlyZSgyMyk7XG52YXIgYWRkRXZlbnRMaXN0ZW5lcnMgPSByZXF1aXJlKDE4KTtcbnZhciBidWlsZENhbGxiYWNrTmFtZSA9IHJlcXVpcmUoMTkpO1xudmFyIGJ1aWxkU2NyaXB0U3JjID0gcmVxdWlyZSgyMCk7XG5cbi8qKlxuICogSlNPTlAgcmVxdWVzdC5cbiAqXG4gKiBAY2xhc3NcbiAqIEBleHRlbmRzIHtSZXF1ZXN0fVxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICogQHBhcmFtIHtSZXF1ZXN0U3VjY2Vzc0NhbGxiYWNrfSBvbnN1Y2Nlc3MgVGhlIGNhbGxiYWNrIHRvIGNhbGwgb24gc3VjY2Vzcy5cbiAqIEBwYXJhbSB7UmVxdWVzdEVycm9yQ2FsbGJhY2t9IG9uZXJyb3IgVGhlIGNhbGxiYWNrIHRvIGNhbGwgb24gZXJyb3IuXG4gKi9cbmZ1bmN0aW9uIEpTT05QUmVxdWVzdChvcHRpb25zLCBvbnN1Y2Nlc3MsIG9uZXJyb3IpIHtcbiAgICB2YXIgc3JjO1xuICAgIHZhciBzY3JpcHQ7XG4gICAgdmFyIGNhbGxiYWNrTmFtZTtcbiAgICB2YXIgY29udGFpbmVyTm9kZTtcblxuICAgIFJlcXVlc3QuY2FsbCh0aGlzLCBjb25zdGFudHMuSlNPTlBfUkVRVUVTVCwgb3B0aW9ucywgb25zdWNjZXNzLCBvbmVycm9yKTtcblxuICAgIC8vIENhbGwgYG9wdGlvbnMuaGFuZGxlT3B0aW9uc2AgdG8gaGFuZGxlIG9wdGlvbnMuXG4gICAgaGFuZGxlT3B0aW9ucyhvcHRpb25zKTtcblxuICAgIHNjcmlwdCA9IHRoaXMuc2NyaXB0ID0gb3B0aW9ucy5jcmVhdGVTY3JpcHQuY2FsbChudWxsLCBvcHRpb25zKTtcbiAgICBjb250YWluZXJOb2RlID0gb3B0aW9ucy5qc29ucENvbnRhaW5lck5vZGUuY2FsbChudWxsLCBvcHRpb25zKTtcbiAgICBjYWxsYmFja05hbWUgPSBidWlsZENhbGxiYWNrTmFtZShvcHRpb25zKTtcbiAgICBzcmMgPSBidWlsZFNjcmlwdFNyYyhvcHRpb25zLCBjYWxsYmFja05hbWUpO1xuXG4gICAgLy8gU2V0IHRoZSBzcmMgYXR0cmlidXRlLlxuICAgIHNjcmlwdC5zZXRBdHRyaWJ1dGUoJ3NyYycsIHNyYyk7XG5cbiAgICAvLyBBZGQgZXZlbnQgbGlzdGVuZXJzLlxuICAgIGFkZEV2ZW50TGlzdGVuZXJzKHRoaXMsIGNhbGxiYWNrTmFtZSk7XG5cbiAgICAvLyBJbmplY3QgdGhlIHNjcmlwdCBub2RlLlxuICAgIGNvbnRhaW5lck5vZGUuYXBwZW5kQ2hpbGQoc2NyaXB0KTtcblxuICAgIC8vIENhbGwgb25SZXF1ZXN0Q3JlYXRlZC5cbiAgICBjYWxsUmVxdWVzdENyZWF0ZWRDYWxsYmFjayhvcHRpb25zLCB0aGlzKTtcbn1cblxuaW5oZXJpdHMoSlNPTlBSZXF1ZXN0LCBSZXF1ZXN0KTtcblxubW9kdWxlLmV4cG9ydHMgPSBKU09OUFJlcXVlc3Q7XG4iLCIvKipcbiAqIEpTT05QUmVzcG9uc2UgbW9kdWxlLlxuICpcbiAqIEBtb2R1bGUgY2xhc3MvSlNPTlBSZXNwb25zZVxuICovXG5cbnZhciBSZXNwb25zZSA9IHJlcXVpcmUoMTApO1xudmFyIGluaGVyaXRzID0gcmVxdWlyZSgzMCk7XG52YXIgYWRkTWl4aW4gPSByZXF1aXJlKDIxKTtcblxuLyoqXG4gKiBUaGUgSlNPTlBSZXNwb25zZSBjbGFzcy5cbiAqXG4gKiBAY2xhc3NcbiAqIEBwYXJhbSB7SlNPTlJlcXVlc3R9IHJlcXVlc3QgVGhlIGh0dHAgcmVxdWVzdC5cbiAqL1xuZnVuY3Rpb24gSlNPTlBSZXNwb25zZShyZXF1ZXN0KSB7XG4gICAgUmVzcG9uc2UuY2FsbCh0aGlzLCByZXF1ZXN0KTtcbiAgICBhZGRNaXhpbih0aGlzLCByZXF1ZXN0Lm9wdGlvbnMsICdqc29ucFJlc3BvbnNlTWl4aW4nKTtcbn1cblxuaW5oZXJpdHMoSlNPTlBSZXNwb25zZSwgUmVzcG9uc2UpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEpTT05QUmVzcG9uc2U7XG4iLCJ2YXIgUmVzcG9uc2VFcnJvciA9IHJlcXVpcmUoMTEpO1xudmFyIGluaGVyaXRzID0gcmVxdWlyZSgzMCk7XG52YXIgYWRkTWl4aW4gPSByZXF1aXJlKDIxKTtcblxuLyoqXG4gKiBAY2xhc3NcbiAqIEBwYXJhbSB7c3RyaW5nfSBjb2RlIFRoZSBlcnJvciBjb2RlLlxuICogQHBhcmFtIHtKU09OUFJlcXVlc3R9IHJlcXVlc3QgVGhlIEpTT05QIHJlcXVlc3QuXG4gKi9cbmZ1bmN0aW9uIEpTT05QUmVzcG9uc2VFcnJvcihjb2RlLCByZXF1ZXN0KSB7XG4gICAgUmVzcG9uc2VFcnJvci5jYWxsKHRoaXMsIGNvZGUsIHJlcXVlc3QpO1xuICAgIGFkZE1peGluKHRoaXMsIHJlcXVlc3Qub3B0aW9ucywgJ2pzb25wUmVzcG9uc2VFcnJvck1peGluJyk7XG59XG5cbmluaGVyaXRzKFJlc3BvbnNlRXJyb3IsIEpTT05QUmVzcG9uc2VFcnJvcik7XG5cbm1vZHVsZS5leHBvcnRzID0gSlNPTlBSZXNwb25zZUVycm9yO1xuIiwidmFyIHV1aWQgPSByZXF1aXJlKDMzKTtcblxuLyoqXG4gKiBUaGUgYmFzZSBSZXFldXN0IGNsYXNzLlxuICpcbiAqIEBjbGFzc1xuICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgVGhlIHR5cGUgb2YgcmVxdWVzdCwgY2FuIGJlIGBIVFRQX1JFUVVFU1RgIG9yIGBKU09OUF9SRVFVRVNUYC5cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEBwYXJhbSB7UmVxdWVzdFN1Y2Nlc3NDYWxsYmFja30gb25zdWNjZXNzIFRoZSBjYWxsYmFjayB0byBjYWxsIG9uIHN1Y2Nlc3MuXG4gKiBAcGFyYW0ge1JlcXVlc3RFcnJvckNhbGxiYWNrfSBvbmVycm9yIFRoZSBjYWxsYmFjayB0byBjYWxsIG9uIGVycm9yLlxuICovXG5mdW5jdGlvbiBSZXF1ZXN0KHR5cGUsIG9wdGlvbnMsIG9uc3VjY2Vzcywgb25lcnJvcikge1xuICAgIC8qKlxuICAgICAqIElmIHRoZXJlIGlzIGFuIGVycm9yIGhhcHBlbmQsIHRoZSBgZXJyb3JgIGlzIGEgc3RyaW5nIHJlcHJzZW5ndGluZyB0aGUgdHlwZSBvZiB0aGUgZXJyb3IuIElmIHRoZXJlIGlzIG5vXG4gICAgICogZXJyb3IsIHRoZSB2YWx1ZSBvZiBgZXJyb3JgIGlzIGBudWxsYC5cbiAgICAgKi9cbiAgICB0aGlzLmVycm9yID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFRoZSBgWE1MSHR0cFJlcXVlc3RgIHdlIHVzZSB3aGVuIHNlbmRpbmcgaHR0cCByZXF1ZXN0LlxuICAgICAqL1xuICAgIHRoaXMueGhyID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFRoZSBgSFRNTFNjcmlwdEVsZW1lbnRgIHdlIHVzZSB3aGVuIHNlbmRpbmcgSlNPTlAgcmVxdWVzdC5cbiAgICAgKi9cbiAgICB0aGlzLnNjcmlwdCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBXaGV0aGVyIHRoZSByZXF1ZXN0IGlzIGZpbmlzaGVkLlxuICAgICAqL1xuICAgIHRoaXMuZmluaXNoZWQgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIFRoZSByZXNwb25zZSBKU09OIGRhdGEgb2YgdGhlIEpTT05QIHJlcXVlc3QuXG4gICAgICovXG4gICAgdGhpcy5yZXNwb25zZUpTT04gPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQW4gdW5pcXVlIGlkIGZvciB0aGlzIHJlcXVlc3QuXG4gICAgICovXG4gICAgdGhpcy5yZXF1ZXN0SWQgPSB1dWlkKCk7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdHlwZSBvZiByZXF1ZXN0LCBjYW4gYmUgYEhUVFBfUkVRVUVTVGAgb3IgYEpTT05QX1JFUVVFU1RgLlxuICAgICAqL1xuICAgIHRoaXMucmVxdWVzdFR5cGUgPSB0eXBlO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAgICAgKi9cbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuXG4gICAgLyoqXG4gICAgICogVGhlIG5hbWUgb2YgdGhlIGZ1bmN0aW9uIHRoYXQgY3JlYXRlIHRoaXMgcmVxdWVzdC4gQ2FuIGJlIGBzZW5kYCwgYGZldGNoYCwgYGdldEpPU05QYCwgYGZldGNoSlNPTlBgLiBUaGlzIHZhbHVlXG4gICAgICogaXMgc2V0IGJ5IHRoZSBsaWJyYXkgaXRzZWxmLlxuICAgICAqL1xuICAgIHRoaXMucmVxdWVzdEZ1bmN0aW9uTmFtZSA9IG9wdGlvbnMucmVxdWVzdEZ1bmN0aW9uTmFtZTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBgQ2FuY2VsQ29udHJvbGxlcmAgdGhhdCB1c2VkIHRvIGNhbmNlbCB0aGlzIHJlcXVlc3QuIFdlIG5ldmVyIHVzZSB0aGlzIHByb3BlcnR5IGludGVybmFsbHksIGp1c3QgaG9sZGluZyB0aGVcbiAgICAgKiBpbmZvcm1hdGlvbiBpbiBjYXNlIHRoYXQgdGhlIHVzZXIgbmVlZHMuXG4gICAgICovXG4gICAgdGhpcy5jb250cm9sbGVyID0gb3B0aW9ucy5jb250cm9sbGVyIHx8IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgY2FsbGJhY2sgdG8gY2FsbCBvbiBzdWNjZXNzLlxuICAgICAqL1xuICAgIHRoaXMub25zdWNjZXNzID0gb25zdWNjZXNzIHx8IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgY2FsbGJhY2sgdG8gY2FsbCBvbiBlcnJvci5cbiAgICAgKi9cbiAgICB0aGlzLm9uZXJyb3IgPSBvbmVycm9yIHx8IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBTZXQgdGhlIHJlcXVlc3QgdHlwZSBiYWNrLlxuICAgICAqL1xuICAgIG9wdGlvbnMucmVxdWVzdFR5cGUgPSB0eXBlO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFJlcXVlc3Q7XG4iLCIvKipcbiAqIFJlcHJlc2VudHMgYSByZXNwb25zZS5cbiAqXG4gKiBAcGFyYW0ge1JlcXVlc3R9IHJlcXVlc3QgVGhlIGluc3RhbmNlIG9mIGBSZXF1ZXN0YC5cbiAqL1xuZnVuY3Rpb24gUmVzcG9uc2UocmVxdWVzdCkge1xuICAgIC8qKlxuICAgICAqIEB0eXBlIHtSZXF1ZXN0fVxuICAgICAqL1xuICAgIHRoaXMucmVxdWVzdCA9IHJlcXVlc3Q7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gUmVzcG9uc2U7XG4iLCJ2YXIgZXJyb3JNZXNzYWdlcyA9IHtcbiAgICBFUlJfQUJPUlRFRDogJ1JlcXVlc3QgYWJvcnRlZCcsXG4gICAgRVJSX0NBTkNFTEVEOiAnUmVxdWVzdCBjYW5jZWxlZCcsXG4gICAgRVJSX05FVFdPUks6ICdOZXR3b3JrIGVycm9yJyxcbiAgICBFUlJfUkVTUE9OU0U6ICdSZXNwb25zZSBlcnJvcicsXG4gICAgRVJSX1RJTUVPVVQ6ICdSZXF1ZXN0IHRpbWVvdXQnXG59O1xuXG4vKipcbiAqIFJlcHJlc2VudHMgcmVzcG9uc2UgZXJyb3IuXG4gKlxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0ge3N0cmluZ30gY29kZSBUaGUgZXJyb3IgY29kZS5cbiAqIEBwYXJhbSB7UmVxdWVzdH0gcmVxdWVzdCBUaGUgcmVxdWVzdC5cbiAqL1xuZnVuY3Rpb24gUmVzcG9uc2VFcnJvcihjb2RlLCByZXF1ZXN0KSB7XG4gICAgdmFyIG1lc3NhZ2U7XG5cbiAgICBjb2RlID0gY29kZSB8fCAnRVJSX1VOS05PV04nO1xuXG4gICAgaWYgKGVycm9yTWVzc2FnZXNbY29kZV0pIHtcbiAgICAgICAgbWVzc2FnZSA9IGVycm9yTWVzc2FnZXNbY29kZV07XG4gICAgfVxuXG4gICAgaWYgKCFtZXNzYWdlKSB7XG4gICAgICAgIG1lc3NhZ2UgPSAnVW5rbm93biBlcnJvciAnICsgY29kZTtcbiAgICB9XG5cbiAgICByZXF1ZXN0LmVycm9yID0gY29kZTtcblxuICAgIHRoaXMuY29kZSA9IGNvZGU7XG4gICAgdGhpcy5yZXF1ZXN0ID0gcmVxdWVzdDtcbiAgICB0aGlzLm1lc3NhZ2UgPSBtZXNzYWdlO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFJlc3BvbnNlRXJyb3I7XG4iLCJ2YXIgaXNGdW5jdGlvbiA9IHJlcXVpcmUoMzYpO1xudmFyIEh0dHBSZXNwb25zZSA9IHJlcXVpcmUoNCk7XG52YXIgYWRkVGltZW91dExpc3RlbmVyID0gcmVxdWlyZSgxMyk7XG52YXIgZmlyZUNhbGxiYWNrcyA9IHJlcXVpcmUoMjcpO1xudmFyIG5vb3AgPSByZXF1aXJlKDMxKTtcbnZhciBjb25zdGFudHMgPSByZXF1aXJlKDI0KTtcbnZhciBFUlJfQUJPUlRFRCAgID0gY29uc3RhbnRzLkVSUl9BQk9SVEVEO1xudmFyIEVSUl9DQU5DRUxFRCA9IGNvbnN0YW50cy5FUlJfQ0FOQ0VMRUQ7XG52YXIgRVJSX05FVFdPUksgICA9IGNvbnN0YW50cy5FUlJfTkVUV09SSztcbnZhciBFUlJfUkVTUE9OU0UgID0gY29uc3RhbnRzLkVSUl9SRVNQT05TRTtcbnZhciBFUlJfVElNRU9VVCAgID0gY29uc3RhbnRzLkVSUl9USU1FT1VUO1xuXG4vKipcbiAqIENoZWNrIHdoZXRoZXIgdGhlIHJlcXVlc3QgaXMgYWJvcnRlZC5cbiAqXG4gKiBAcGFyYW0ge1hNTEh0dHBSZXF1ZXN0fSB4aHIgVGhlIFhNTEh0dHBSZXF1ZXN0LlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGl0IGlzIGFib3J0ZWQuXG4gKi9cbmZ1bmN0aW9uIGlzQWJvcnRlZCh4aHIpIHtcbiAgICB2YXIgc3RhdHVzID0gK3hoci5zdGF0dXM7XG4gICAgdmFyIHJlc3BvbnNlVVJMID0geGhyLnJlc3BvbnNlVVJMO1xuXG4gICAgaWYgKHR5cGVvZiByZXNwb25zZVVSTCAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgcmVzcG9uc2VVUkwgPSAnJztcbiAgICB9XG5cbiAgICByZXR1cm4gc3RhdHVzID09PSAwICYmIHJlc3BvbnNlVVJMLmluZGV4T2YoJ2ZpbGU6JykgIT09IDA7XG59XG5cbi8qKlxuICogQWRkIGV2ZW50IGxpc3RlbmVycyB0byB0aGUgaHR0cCByZXF1ZXN0LiBUaGlzIGZ1bmN0aW9uIHdpbGwgb3ZlcndpdGUgdGhlIGBjYW5jZWxgIG1ldGhvZCBvbiB0aGUgZ2l2ZW4gYEh0dHBSZXFlc3RgXG4gKiBpbnN0YW5jZS5cbiAqXG4gKiBAcGFyYW0ge0h0dHBSZXF1ZXN0fSByZXF1ZXN0IFRoZSBodHRwIHJlcXVlc3QgdG8gYWRkIGV2ZW50IGxpc3RlbmVycy5cbiAqL1xuZnVuY3Rpb24gYWRkRXZlbnRMaXN0ZW5lcnMocmVxdWVzdCkge1xuICAgIHZhciB4aHIgPSByZXF1ZXN0LnhocjtcbiAgICB2YXIgb3B0aW9ucyA9IHJlcXVlc3Qub3B0aW9ucztcbiAgICB2YXIgcmVxdWVzdFR5cGUgPSByZXF1ZXN0LnJlcXVlc3RUeXBlO1xuICAgIHZhciByZXNwb25zZSA9IG5ldyBIdHRwUmVzcG9uc2UocmVxdWVzdCk7XG4gICAgdmFyIGlzUmVzcG9uc2VPayA9IG9wdGlvbnMuaXNSZXNwb25zZU9rO1xuICAgIHZhciBjbGVhclRpbWVvdXRFdmVudCA9IG51bGw7XG4gICAgdmFyIHRpbWVvdXQgPSBwYXJzZUludChvcHRpb25zLnRpbWVvdXQsIDEwKSB8fCAwO1xuXG4gICAgLyoqXG4gICAgICogQ2FuY2VsIHRoZSByZXF1ZXN0LlxuICAgICAqL1xuICAgIHZhciBjYW5jZWwgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNsZWFyRXZlbnRzKCk7XG4gICAgICAgIGlmICh4aHIuYWJvcnQpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgeGhyLmFib3J0KCk7XG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgLy8gZW1wdHlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBmaW5pc2goRVJSX0NBTkNFTEVEKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogVGhlIGZ1bmN0aW9uIHRvIGNsZWFyIGV2ZW50cy5cbiAgICAgKi9cbiAgICB2YXIgY2xlYXJFdmVudHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8vIFNldCBjbGVhckV2ZW50cyB0byB0aGUgbm9vcCBmdW5jdGlvbi5cbiAgICAgICAgY2xlYXJFdmVudHMgPSBub29wO1xuXG4gICAgICAgIHhoci5vbmFib3J0ID0gbnVsbDtcbiAgICAgICAgeGhyLm9uZXJyb3IgPSBudWxsO1xuICAgICAgICB4aHIub25yZWFkeXN0YXRlY2hhbmdlID0gbnVsbDtcbiAgICAgICAgeGhyLm9udGltZW91dCA9IG51bGw7XG5cbiAgICAgICAgaWYgKGNsZWFyVGltZW91dEV2ZW50KSB7XG4gICAgICAgICAgICBjbGVhclRpbWVvdXRFdmVudCgpO1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0RXZlbnQgPSBudWxsO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBmdW5jdGlvbiBmaW5pc2ggdGhlIHJlcXVlc3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY29kZSBUaGUgZXJyb3IgY29kZSBvbiBlcnJvci4gSWYgbm8gZXJyb3Igb2NjdXJlZCwgdGhlIGNvZGUgaXMgYG51bGxgLlxuICAgICAqL1xuICAgIHZhciBmaW5pc2ggPSBmdW5jdGlvbiAoY29kZSkge1xuICAgICAgICAvLyBTZXQgZmluaXNoIHRvIHRoZSBub29wIGZ1bmN0aW9uLlxuICAgICAgICBmaW5pc2ggPSBub29wO1xuXG4gICAgICAgIC8vIFNldCBjYW5jZWwgdG8gdGhlIG5vb3AgZnVuY3Rpb24uXG4gICAgICAgIGNhbmNlbCA9IG5vb3A7XG5cbiAgICAgICAgLy8gTWFyayB0aGlzIHJlcXVlc3QgYXMgZmluaXNoZWQuXG4gICAgICAgIHJlcXVlc3QuZmluaXNoZWQgPSB0cnVlO1xuXG4gICAgICAgIC8vIENsZWFyIGV2ZW50cy5cbiAgICAgICAgY2xlYXJFdmVudHMoKTtcblxuICAgICAgICAvLyBGaXJlIGNhbGxiYWNrcy5cbiAgICAgICAgZmlyZUNhbGxiYWNrcyhjb2RlLCByZXNwb25zZSk7XG4gICAgfTtcblxuICAgIHhoci5vbmFib3J0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBmaW5pc2goRVJSX0FCT1JURUQpO1xuICAgIH07XG5cbiAgICB4aHIub25lcnJvciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZmluaXNoKEVSUl9ORVRXT1JLKTtcbiAgICB9O1xuXG4gICAgeGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKCt4aHIucmVhZHlTdGF0ZSA9PT0gNCkge1xuICAgICAgICAgICAgaWYgKGlzQWJvcnRlZCh4aHIpKSB7XG4gICAgICAgICAgICAgICAgZmluaXNoKEVSUl9BQk9SVEVEKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoaXNGdW5jdGlvbihpc1Jlc3BvbnNlT2spKSB7XG4gICAgICAgICAgICAgICAgaWYgKGlzUmVzcG9uc2VPayhyZXF1ZXN0VHlwZSwgcmVzcG9uc2UpKSB7XG4gICAgICAgICAgICAgICAgICAgIGZpbmlzaChudWxsKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBmaW5pc2goRVJSX1JFU1BPTlNFKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGZpbmlzaChudWxsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBDYW5jZWwgdGhlIHJlcXVlc3QuXG4gICAgICovXG4gICAgcmVxdWVzdC5jYW5jZWwgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNhbmNlbCgpO1xuICAgIH07XG5cbiAgICAvLyBBZGQgdGltZW91dCBsaXN0ZW5lclxuICAgIGlmICh0aW1lb3V0ID4gMCkge1xuICAgICAgICBjbGVhclRpbWVvdXRFdmVudCA9IGFkZFRpbWVvdXRMaXN0ZW5lcih4aHIsIHRpbWVvdXQsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGNsZWFyRXZlbnRzKCk7XG4gICAgICAgICAgICBpZiAoeGhyLmFib3J0KSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgeGhyLmFib3J0KCk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBlbXB0eVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZpbmlzaChFUlJfVElNRU9VVCk7XG4gICAgICAgIH0pO1xuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBhZGRFdmVudExpc3RlbmVycztcbiIsIi8qKlxuICogQWRkIHRpbWVvdXQgZXZlbnQgbGlzdGVuZXIgb24gdGhlIFhIUiBvYmplY3QuXG4gKlxuICogQHBhcmFtIHtYTUxIdHRwUmVxdWVzdH0geGhyIFRoZSBYSFIgdG8gYWRkIHRpbWVvdXQgZXZlbnQgbGlzdGVuZXIuXG4gKiBAcGFyYW0ge251bWJlcn0gdGltZW91dCBUaGUgdGltZSB0byB3YWl0IGluIG1pbGxpc2Vjb25kcy5cbiAqIEBwYXJhbSB7KCkgPT4gdm9pZH0gbGlzdGVuZXIgVGhlIHRpbWVvdXQgY2FsbGJhY2suXG4gKiBAcmV0dXJucyB7KCkgPT4gdm9pZCl9IFJldHVybnMgYSBmdW5jdGlvbiB0byByZW1vdmUgdGhlIHRpbWVvdXQgZXZlbnQgbGlzdGVuZXIuXG4gKi9cbmZ1bmN0aW9uIGFkZFRpbWVvdXRMaXN0ZW5lcih4aHIsIHRpbWVvdXQsIGxpc3RlbmVyKSB7XG4gICAgdmFyIHRpbWVvdXRJZCA9IG51bGw7XG4gICAgdmFyIHN1cHBvcnRUaW1lb3V0ID0gJ3RpbWVvdXQnIGluIHhociAmJiAnb250aW1lb3V0JyBpbiB4aHI7XG5cbiAgICBpZiAoc3VwcG9ydFRpbWVvdXQpIHtcbiAgICAgICAgeGhyLnRpbWVvdXQgPSB0aW1lb3V0O1xuICAgICAgICB4aHIub250aW1lb3V0ID0gbGlzdGVuZXI7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGltZW91dElkID0gc2V0VGltZW91dChsaXN0ZW5lciwgdGltZW91dCk7XG4gICAgfVxuXG4gICAgLy8gQ2FsbCB0aGlzIGZ1bmN0aW9uIHRvIHJlbW92ZSB0aW1lb3V0IGV2ZW50IGxpc3RlbmVyXG4gICAgZnVuY3Rpb24gY2xlYXJUaW1lb3V0RXZlbnQoKSB7XG4gICAgICAgIGlmICh4aHIpIHtcbiAgICAgICAgICAgIGlmICh0aW1lb3V0SWQgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICB4aHIub250aW1lb3V0ID0gbnVsbDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXRJZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB4aHIgPSBudWxsO1xuICAgICAgICAgICAgbGlzdGVuZXIgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGNsZWFyVGltZW91dEV2ZW50O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGFkZFRpbWVvdXRMaXN0ZW5lcjtcbiIsInZhciBpc0Z1bmN0aW9uID0gcmVxdWlyZSgzNik7XG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGNhbGwgeGhyIGhvb2sgZnVuY3Rpb24uXG4gKlxuICogQHBhcmFtIHtYSFJIb29rRnVuY3Rpb259IGZ1bmMgVGhlIGhvb2sgZnVuY3Rpb24gdG8gY2FsbCwgaWYgaXQgaXMgbm90IGZ1bmN0aW9uLCB0aGlzIGhvb2sgaXMgc2tpcHBlZC5cbiAqIEBwYXJhbSB7WE1MSHR0cFJlcWV1c3R9IHhociBUaGUgaW5zdGFuY2Ugb2YgYFhNTEh0dHBSZXFldXN0YC5cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbn0gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICovXG5mdW5jdGlvbiBjYWxsWGhySG9vayhmdW5jLCB4aHIsIG9wdGlvbnMpIHtcbiAgICBpZiAoaXNGdW5jdGlvbihmdW5jKSkge1xuICAgICAgICBmdW5jKHhociwgb3B0aW9ucyk7XG4gICAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGNhbGxYaHJIb29rO1xuIiwidmFyIG1lcmdlID0gcmVxdWlyZSgzOCk7XG52YXIgaXNQbGFpbk9iamVjdCA9IHJlcXVpcmUoMzcpO1xudmFyIGhhc093biA9IHJlcXVpcmUoMjkpO1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBzZXQgdGhlIHJlcXVlc3QgaGVhZGVycy5cbiAqXG4gKiAxLiBNZXJnZSB0aGUgYG9wdGlvbnMubm9DYWNoZUhlYWRlcnNgIGlmIG5lZWRlZC5cbiAqIDIuIFNldCB0aGUgcmVxdWVzdCBoZWFkZXJzIGlmIG5lZWRlZC5cbiAqXG4gKiBAcGFyYW0ge1hNTEh0dHBSZXFldXN0fSB4aHIgVGhlIGluc3RhbmNlIG9mIGBYTUxIdHRwUmVxZXVzdGAuXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb259IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqL1xuZnVuY3Rpb24gaGFuZGxlSGVhZGVycyh4aHIsIG9wdGlvbnMpIHtcbiAgICB2YXIgbmFtZTtcbiAgICB2YXIgdmFsdWU7XG4gICAgdmFyIGhlYWRlcnMgPSBpc1BsYWluT2JqZWN0KG9wdGlvbnMuaGVhZGVycykgPyBvcHRpb25zLmhlYWRlcnMgOiB7fTtcblxuICAgIGlmIChvcHRpb25zLm5vQ2FjaGUpIHtcbiAgICAgICAgaWYgKGlzUGxhaW5PYmplY3Qob3B0aW9ucy5ub0NhY2hlSGVhZGVycykpIHtcbiAgICAgICAgICAgIGhlYWRlcnMgPSBtZXJnZShoZWFkZXJzLCBvcHRpb25zLm5vQ2FjaGVIZWFkZXJzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZvciAobmFtZSBpbiBoZWFkZXJzKSB7XG4gICAgICAgIGlmIChoYXNPd24uY2FsbChoZWFkZXJzLCBuYW1lKSkge1xuICAgICAgICAgICAgdmFsdWUgPSBoZWFkZXJzW25hbWVdO1xuICAgICAgICAgICAgLy8gT25seSB0aGUgbm9uLXVuZGVmaW5lZCBhbmQgbm9uLW51bGwgaGVhZGVycyBhcmUgc2V0XG4gICAgICAgICAgICBpZiAodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKG5hbWUsIHZhbHVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIFNldCB0aGUgaGVhZGVycyBiYWNrLlxuICAgIG9wdGlvbnMuaGVhZGVycyA9IGhlYWRlcnM7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaGFuZGxlSGVhZGVycztcbiIsInZhciBtZXJnZSA9IHJlcXVpcmUoMzgpO1xudmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKDM2KTtcbnZhciBpc1BsYWluT2JqZWN0ID0gcmVxdWlyZSgzNyk7XG52YXIgaGFzT3duID0gcmVxdWlyZSgyOSk7XG5cbi8qKlxuICogRmluZCBhIHByb2Nlc3NvciBmcm9tIGBvcHRpb25zLmh0dHBSZXF1ZXN0Qm9keVByb2Nlc3NvcmAgdG8gcHJvY2VzcyB0aGUgcmVxdWVzdCBib2R5LlxuICpcbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEByZXR1cm5zIHthbnl9IFJldHJ1bnMgdGhlIGNvbnRlbnQgdGhhdCBzZW5kIHRvIHRoZSBzZXJ2ZXIuXG4gKi9cbmZ1bmN0aW9uIGhhbmRsZVJlcXVlc3RCb2R5KG9wdGlvbnMpIHtcbiAgICB2YXIgaTtcbiAgICB2YXIgbDtcbiAgICB2YXIga2V5O1xuICAgIHZhciBjb250ZW50ID0gbnVsbDtcbiAgICB2YXIgcHJvY2Vzc29yO1xuICAgIHZhciBjb250ZW50UHJvY2Vzc29yO1xuICAgIHZhciBjb250ZW50UHJvY2Vzc29ycyA9IFtdO1xuICAgIHZhciBib2R5ID0gb3B0aW9ucy5ib2R5O1xuICAgIHZhciBwcm9jZXNzb3JzID0gb3B0aW9ucy5odHRwUmVxdWVzdEJvZHlQcm9jZXNzb3I7XG4gICAgdmFyIGhlYWRlcnMgPSBpc1BsYWluT2JqZWN0KG9wdGlvbnMuaGVhZGVycykgPyBvcHRpb25zLmhlYWRlcnMgOiB7fTtcblxuICAgIGlmIChpc1BsYWluT2JqZWN0KGJvZHkpICYmIGlzUGxhaW5PYmplY3QocHJvY2Vzc29ycykpIHtcbiAgICAgICAgLy8gRmluZCBhbGwgcHJvY2Vzc29ycy5cbiAgICAgICAgZm9yIChrZXkgaW4gcHJvY2Vzc29ycykge1xuICAgICAgICAgICAgaWYgKGhhc093bi5jYWxsKHByb2Nlc3NvcnMsIGtleSkpIHtcbiAgICAgICAgICAgICAgICBwcm9jZXNzb3IgPSBwcm9jZXNzb3JzW2tleV07XG4gICAgICAgICAgICAgICAgaWYgKGlzUGxhaW5PYmplY3QocHJvY2Vzc29yKSkge1xuICAgICAgICAgICAgICAgICAgICBjb250ZW50UHJvY2Vzc29ycy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGtleToga2V5LFxuICAgICAgICAgICAgICAgICAgICAgICAgaGVhZGVyczogcHJvY2Vzc29yLmhlYWRlcnMsXG4gICAgICAgICAgICAgICAgICAgICAgICBwcmlvcml0eTogcHJvY2Vzc29yLnByaW9yaXR5LFxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvY2Vzc29yOiBwcm9jZXNzb3IucHJvY2Vzc29yXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNvcnQgdGhlIHByb2Nlc3NvcnMgYnkgaXRzIHByaW9yaXR5LlxuICAgICAgICBjb250ZW50UHJvY2Vzc29ycy5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICAgICAgICByZXR1cm4gYi5wcmlvcml0eSAtIGEucHJpb3JpdHk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEZpbmQgdGhlIGZpcnN0IG5vbi11bmRlZmluZWQgY29udGVudC5cbiAgICAgICAgZm9yIChpID0gMCwgbCA9IGNvbnRlbnRQcm9jZXNzb3JzLmxlbmd0aDsgaSA8IGw7IGkgKz0gMSkge1xuICAgICAgICAgICAgcHJvY2Vzc29yID0gY29udGVudFByb2Nlc3NvcnNbaV07XG4gICAgICAgICAgICBpZiAoYm9keVtwcm9jZXNzb3Iua2V5XSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgY29udGVudCA9IGJvZHlbcHJvY2Vzc29yLmtleV07XG4gICAgICAgICAgICAgICAgY29udGVudFByb2Nlc3NvciA9IHByb2Nlc3NvcjtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFVzZSB0aGUgcHJvY2Vzc29yIHRvIHByb2Nlc3MgdGhlIGNvbnRlbnQuXG4gICAgICAgIGlmIChjb250ZW50UHJvY2Vzc29yKSB7XG4gICAgICAgICAgICBpZiAoaXNQbGFpbk9iamVjdChjb250ZW50UHJvY2Vzc29yLmhlYWRlcnMpKSB7XG4gICAgICAgICAgICAgICAgaGVhZGVycyA9IG1lcmdlKHt9LCBjb250ZW50UHJvY2Vzc29yLmhlYWRlcnMsIGhlYWRlcnMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcHJvY2Vzc29yID0gY29udGVudFByb2Nlc3Nvci5wcm9jZXNzb3I7XG4gICAgICAgICAgICBpZiAoaXNGdW5jdGlvbihwcm9jZXNzb3IpKSB7XG4gICAgICAgICAgICAgICAgY29udGVudCA9IHByb2Nlc3Nvcihjb250ZW50LCBvcHRpb25zKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIE1ha2Ugc3VyZSB0aGF0IHRoZSBoZWFkZXJzIGlzIGEgcGxhaW4gb2JqZWN0LlxuICAgIG9wdGlvbnMuaGVhZGVycyA9IGhlYWRlcnM7XG5cbiAgICByZXR1cm4gY29udGVudDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBoYW5kbGVSZXF1ZXN0Qm9keTtcbiIsInZhciBpc1BsYWluT2JqZWN0ID0gcmVxdWlyZSgzNyk7XG52YXIgaGFzT3duID0gcmVxdWlyZSgyOSk7XG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGhhbmxkZSBYTUxIdHRwUmVxdWVzdCBwcm9wZXJ0aWVzLlxuICpcbiAqIEBwYXJhbSB7WE1MSHR0cFJlcXVlc3R9IHhociBUaGUgaW5zdGFuY2Ugb2YgYFhNTEh0dHBSZXF1ZXN0YC5cbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqL1xuZnVuY3Rpb24gaGFuZGxlWGhyUHJvcHMoeGhyLCBvcHRpb25zKSB7XG4gICAgdmFyIHByb3A7XG4gICAgdmFyIHhoclByb3BzID0gb3B0aW9ucy54aHJQcm9wcztcblxuICAgIGlmIChvcHRpb25zLmNvcnMpIHtcbiAgICAgICAgeGhyLndpdGhDcmVkZW50aWFscyA9IHRydWU7XG4gICAgfVxuXG4gICAgaWYgKGlzUGxhaW5PYmplY3QoeGhyUHJvcHMpKSB7XG4gICAgICAgIGZvciAocHJvcCBpbiB4aHJQcm9wcykge1xuICAgICAgICAgICAgaWYgKGhhc093bi5jYWxsKHhoclByb3BzLCBwcm9wKSkge1xuICAgICAgICAgICAgICAgIHhocltwcm9wXSA9IHhoclByb3BzW3Byb3BdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGhhbmRsZVhoclByb3BzO1xuIiwidmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKDM2KTtcbnZhciBKU09OUFJlc3BvbnNlID0gcmVxdWlyZSg3KTtcbnZhciBmaXJlQ2FsbGJhY2tzID0gcmVxdWlyZSgyNyk7XG52YXIgbm9vcCA9IHJlcXVpcmUoMzEpO1xudmFyIGNvbnN0YW50cyA9IHJlcXVpcmUoMjQpO1xudmFyIEVSUl9DQU5DRUxFRCA9IGNvbnN0YW50cy5FUlJfQ0FOQ0VMRUQ7XG52YXIgRVJSX05FVFdPUksgICA9IGNvbnN0YW50cy5FUlJfTkVUV09SSztcbnZhciBFUlJfUkVTUE9OU0UgID0gY29uc3RhbnRzLkVSUl9SRVNQT05TRTtcbnZhciBFUlJfVElNRU9VVCAgID0gY29uc3RhbnRzLkVSUl9USU1FT1VUO1xuXG4vKipcbiAqIEFkZCBldmVudCBsaXN0ZW5lcnMgdG8gSlNPTlAgcmVxdWVzdC5cbiAqXG4gKiBAcGFyYW0ge0pTT05QUmVxdWVzdH0gcmVxdWVzdCBUaGUgSlNPTlAgcmVxdWVzdC5cbiAqIEBwYXJhbSB7c3RyaW5nfSBjYWxsYmFja05hbWUgVGhlIGNhbGxiYWNrIG5hbWUgdXNlZCB0byBkZWZpbmUgdGhlIGdsb2JhbCBKU09OUCBjYWxsYmFjay5cbiAqL1xuZnVuY3Rpb24gYWRkRXZlbnRMaXN0ZW5lcnMocmVxdWVzdCwgY2FsbGJhY2tOYW1lKSB7XG4gICAgdmFyIHNjcmlwdCA9IHJlcXVlc3Quc2NyaXB0O1xuICAgIHZhciBvcHRpb25zID0gcmVxdWVzdC5vcHRpb25zO1xuICAgIHZhciByZXF1ZXN0VHlwZSA9IHJlcXVlc3QucmVxdWVzdFR5cGU7XG4gICAgdmFyIGlzUmVzcG9uc2VPayA9IG9wdGlvbnMuaXNSZXNwb25zZU9rO1xuICAgIHZhciByZXNwb25zZSA9IG5ldyBKU09OUFJlc3BvbnNlKHJlcXVlc3QpO1xuICAgIHZhciB0aW1lb3V0ID0gcGFyc2VJbnQob3B0aW9ucy50aW1lb3V0LCAxMCkgfHwgMDtcbiAgICB2YXIgdGltZW91dElkID0gbnVsbDtcblxuICAgIGlmICh0aW1lb3V0IDw9IDApIHtcbiAgICAgICAgdGltZW91dCA9IHBhcnNlSW50KG9wdGlvbnMuanNvbnBEZWZhdWx0VGltZW91dCwgMTApIHx8IDA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGZ1bmN0aW9uIGZpbmlzaCB0aGUgcmVxdWVzdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBjb2RlIFRoZSBlcnJvciBjb2RlIG9uIGVycm9yLiBJZiBubyBlcnJvciBvY2N1cmVkLCB0aGUgY29kZSBpcyBgbnVsbGAuXG4gICAgICovXG4gICAgdmFyIGZpbmlzaCA9IGZ1bmN0aW9uIChjb2RlKSB7XG4gICAgICAgIC8vIFNldCBmaW5pc2ggdG8gdGhlIG5vIG9wZXJhdGlvbiBmdW5jdGlvbi5cbiAgICAgICAgZmluaXNoID0gbm9vcDtcblxuICAgICAgICAvLyBNYXJrIHRoaXMgcmVxdWVzdCBhcyBmaW5pc2hlZC5cbiAgICAgICAgcmVxdWVzdC5maW5pc2hlZCA9IHRydWU7XG5cbiAgICAgICAgLy8gQ2xlYXIgbGlzdGVuZXJzLlxuICAgICAgICB3aW5kb3dbY2FsbGJhY2tOYW1lXSA9IG5vb3A7XG4gICAgICAgIHNjcmlwdC5vbmVycm9yID0gbnVsbDtcblxuICAgICAgICAvLyBDbGVhciB0aW1lb3V0LlxuICAgICAgICBpZiAodGltZW91dElkICE9PSBudWxsKSB7XG4gICAgICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dElkKTtcbiAgICAgICAgICAgIHRpbWVvdXRJZCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBGaXJlIGNhbGxiYWNrcy5cbiAgICAgICAgZmlyZUNhbGxiYWNrcyhjb2RlLCByZXNwb25zZSk7XG4gICAgfTtcblxuICAgIC8vIERlZmluZSB0aGUgY2FsbGJhY2sgZnVuY3Rpb24uXG4gICAgd2luZG93W2NhbGxiYWNrTmFtZV0gPSBmdW5jdGlvbiAocmVzcG9uc2VKU09OKSB7XG4gICAgICAgIHJlcXVlc3QucmVzcG9uc2VKU09OID0gcmVzcG9uc2VKU09OO1xuICAgICAgICBpZiAoaXNGdW5jdGlvbihpc1Jlc3BvbnNlT2spKSB7XG4gICAgICAgICAgICBpZiAoaXNSZXNwb25zZU9rKHJlcXVlc3RUeXBlLCByZXNwb25zZSkpIHtcbiAgICAgICAgICAgICAgICBmaW5pc2gobnVsbCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGZpbmlzaChFUlJfUkVTUE9OU0UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZmluaXNoKG51bGwpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8vIENhdGNoIHRoZSBlcnJvci5cbiAgICBzY3JpcHQub25lcnJvciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZmluaXNoKEVSUl9ORVRXT1JLKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQ2FuY2VsIHRoZSByZXF1ZXN0LlxuICAgICAqL1xuICAgIHJlcXVlc3QuY2FuY2VsID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBmaW5pc2goRVJSX0NBTkNFTEVEKTtcbiAgICB9O1xuXG4gICAgLy8gQWRkIHRpbWVvdXQgbGlzdGVuZXJcbiAgICBpZiAodGltZW91dCA+IDApIHtcbiAgICAgICAgdGltZW91dElkID0gc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBmaW5pc2goRVJSX1RJTUVPVVQpO1xuICAgICAgICB9LCB0aW1lb3V0KTtcbiAgICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYWRkRXZlbnRMaXN0ZW5lcnM7XG4iLCIvKipcbiAqIFRoZSBmdW5jdGlvbiB0byBjcmVhdGUgSlNPTlAgY2FsbGJhY2sgbmFtZS5cbiAqXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBSZXR1cm5zIHRoZSBjYWxsYmFjayBuYW1lLlxuICovXG5mdW5jdGlvbiBidWlsZENhbGxsYmFja05hbWUob3B0aW9ucykge1xuICAgIHZhciBjYWxsYmFja05hbWU7XG5cbiAgICBkbyB7XG4gICAgICAgIGNhbGxiYWNrTmFtZSA9IG9wdGlvbnMuanNvbnBDYWxsYmFja05hbWUuY2FsbChudWxsLCBvcHRpb25zKTtcbiAgICB9IHdoaWxlIChjYWxsYmFja05hbWUgaW4gd2luZG93KTtcblxuICAgIHdpbmRvd1tjYWxsYmFja05hbWVdID0gbnVsbDtcblxuICAgIHJldHVybiBjYWxsYmFja05hbWU7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYnVpbGRDYWxsbGJhY2tOYW1lO1xuIiwidmFyIGJ1aWxkVVJMID0gcmVxdWlyZSgyMik7XG5cbi8qKlxuICogQnVpbGQgdGhlIEpTT05QIHNjcmlwdCBzcmMuXG4gKlxuICogQHBhcmFtIHtSZXF1ZXN0T3B0aW9uc30gb3B0aW9ucyBUaGUgcmVxdWVzdCBvcGl0b25zLlxuICogQHBhcmFtIHtzdHJpbmd9IGNhbGxiYWNrTmFtZSBUaGUgY2FsbGJhY2sgbmFtZSBvZiB0aGUgSlNPTlAuXG4gKiBAcmV0dXJuIHtzdHJpbmd9IFJldHVybnMgdGhlIHNjcmlwdCBzcmMuXG4gKi9cbmZ1bmN0aW9uIGJ1aWxkU2NyaXB0U3JjKG9wdGlvbnMsIGNhbGxiYWNrTmFtZSkge1xuICAgIHZhciBxdWVyeSA9IG9wdGlvbnMucXVlcnk7XG4gICAgdmFyIGtleSA9IG9wdGlvbnMuanNvbnA7XG4gICAgdmFyIHVybDtcblxuICAgIGlmICghcXVlcnkpIHtcbiAgICAgICAgcXVlcnkgPSB7fTtcbiAgICAgICAgb3B0aW9ucy5xdWVyeSA9IHF1ZXJ5O1xuICAgIH1cblxuICAgIHF1ZXJ5W2tleV0gPSBjYWxsYmFja05hbWU7XG4gICAgdXJsID0gYnVpbGRVUkwob3B0aW9ucyk7XG5cbiAgICByZXR1cm4gdXJsO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGJ1aWxkU2NyaXB0U3JjO1xuIiwidmFyIGlzUGxhaW5PYmplY3QgPSByZXF1aXJlKDM3KTtcbnZhciBpc0Z1bmN0aW9uID0gcmVxdWlyZSgzNik7XG52YXIgaGFzT3duID0gcmVxdWlyZSgyOSk7XG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIGFkZCBjdXN0b20gbWl4aW5zIHRvIHRoZSBpbnN0YW5jZSBvZiBgUmVzcG9uc2VgIG9yIGBSZXNwb25zZUVycm9yYC5cbiAqXG4gKiBAcGFyYW0ge1Jlc3BvbnNlfFJlc3BvbnNlRXJyb3J9IHRhcmdldCBUaGUgdGFyZ2V0IHRvIGFkZCB0aGUgY3VzdG9tZSBtaXhpbnMuXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcGFyYW0ge3N0cmluZ30gb3B0aW9uTmFtZSBUaGUgb3B0aW9uIG5hbWUgdGhlIG1peGlucyBjb250YWluZXIuXG4gKi9cbmZ1bmN0aW9uIGFkZE1peGluKHRhcmdldCwgb3B0aW9ucywgb3B0aW9uTmFtZSkge1xuICAgIHZhciBtaXhpbnMgPSBvcHRpb25zW29wdGlvbk5hbWVdO1xuICAgIHZhciBuYW1lO1xuICAgIHZhciBtaXhpbjtcblxuICAgIGlmIChpc1BsYWluT2JqZWN0KG1peGlucykpIHtcbiAgICAgICAgZm9yIChuYW1lIGluIG1peGlucykge1xuICAgICAgICAgICAgaWYgKGhhc093bi5jYWxsKG1peGlucywgbmFtZSkpIHtcbiAgICAgICAgICAgICAgICBtaXhpbiA9IG1peGluc1tuYW1lXTtcbiAgICAgICAgICAgICAgICBpZiAoaXNGdW5jdGlvbihtaXhpbikpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG5hbWUgaW4gdGFyZ2V0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ21peGluIG5hbWUgY29uZmxpY3QgXCInICsgbmFtZSArICdcIicpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHRhcmdldFtuYW1lXSA9IG1peGluO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBhZGRNaXhpbjtcbiIsInZhciBpc0Z1bmN0aW9uID0gcmVxdWlyZSgzNik7XG52YXIgaXNBYnNvbHV0ZVVSTCA9IHJlcXVpcmUoMzQpO1xudmFyIGlzUGxhaW5PYmplY3QgPSByZXF1aXJlKDM3KTtcblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gYnVpbGQgcmVxdWVzdCB1cmwuXG4gKlxuICogMS4gQWRkIGJhc2VVUkwgaWYgbmVlZGVkLlxuICogMi4gQ29tcGlsZSB1cmwgaWYgbmVlZGVkLlxuICogMy4gQ29tcGlsZSBxdWVyeSBzdHJpbmcgaWYgbmVlZGVkLlxuICpcbiAqIEBwYXJhbSB7UmVxdWVzdE9wdGlvbnN9IG9wdGlvbnMgVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAqIEByZXR1cm5zIHtzdHJpbmd9IFJldHVybnMgdGhlIGZpbmFsIHVybCBzdHJpbmcuXG4gKi9cbmZ1bmN0aW9uIGJ1aWxkVVJMKG9wdGlvbnMpIHtcbiAgICB2YXIgdXJsID0gb3B0aW9ucy51cmw7XG4gICAgdmFyIGJhc2VVUkwgPSBvcHRpb25zLmJhc2VVUkw7XG4gICAgdmFyIG1vZGVsID0gb3B0aW9ucy5tb2RlbDtcbiAgICB2YXIgcXVlcnkgPSBvcHRpb25zLnF1ZXJ5O1xuICAgIHZhciBjb21waWxlVVJMID0gb3B0aW9ucy5jb21waWxlVVJMO1xuICAgIHZhciBlbmNvZGVRdWVyeVN0cmluZyA9IG9wdGlvbnMuZW5jb2RlUXVlcnlTdHJpbmc7XG4gICAgdmFyIGFycmF5O1xuXG4gICAgaWYgKHVybCA9PT0gbnVsbCB8fCB1cmwgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICB1cmwgPSAnJztcbiAgICB9XG5cbiAgICAvLyBtYWtlIHN1cmUgdGhhdCB1cmwgaXMgYSBzdHJpbmcuXG4gICAgdXJsID0gJycgKyB1cmw7XG5cbiAgICAvLyBJZiB0aGUgdXJsIGlzIG5vdCBhYnNvbHV0ZSB1cmwgYW5kIHRoZSBiYXNlVVJMIGlzIGRlZmluZWQsXG4gICAgLy8gcHJlcGVuZCB0aGUgYmFzZVVSTCB0byB0aGUgdXJsLlxuICAgIGlmICghaXNBYnNvbHV0ZVVSTCh1cmwpKSB7XG4gICAgICAgIGlmIChiYXNlVVJMID09PSBudWxsIHx8IGJhc2VVUkwgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgYmFzZVVSTCA9ICcnO1xuICAgICAgICB9XG4gICAgICAgIHVybCA9IGJhc2VVUkwgKyB1cmw7XG4gICAgfVxuXG4gICAgLy8gQ29tcGlsZSB0aGUgdXJsIGlmIG5lZWRlZC5cbiAgICBpZiAoaXNQbGFpbk9iamVjdChtb2RlbCkgJiYgaXNGdW5jdGlvbihjb21waWxlVVJMKSkge1xuICAgICAgICB1cmwgPSBjb21waWxlVVJMKHVybCwgbW9kZWwsIG9wdGlvbnMpO1xuICAgIH1cblxuICAgIC8vIENvbXBpbGUgdGhlIHF1ZXJ5IHN0cmluZy5cbiAgICBpZiAoaXNQbGFpbk9iamVjdChxdWVyeSkgJiYgaXNGdW5jdGlvbihlbmNvZGVRdWVyeVN0cmluZykpIHtcbiAgICAgICAgcXVlcnkgPSBlbmNvZGVRdWVyeVN0cmluZyhxdWVyeSwgb3B0aW9ucyk7XG4gICAgICAgIGFycmF5ID0gdXJsLnNwbGl0KCcjJyk7IC8vIFRoZXJlIG1heSBiZSBoYXNoIHN0cmluZyBpbiB0aGUgdXJsLlxuICAgICAgICB1cmwgPSBhcnJheVswXTtcblxuICAgICAgICBpZiAodXJsLmluZGV4T2YoJz8nKSA+IC0xKSB7XG4gICAgICAgICAgICBpZiAodXJsLmNoYXJBdCh1cmwubGVuZ3RoIC0gMSkgPT09ICcmJykge1xuICAgICAgICAgICAgICAgIHVybCA9IHVybCArIHF1ZXJ5O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB1cmwgPSB1cmwgKyAnJicgKyBxdWVyeTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHVybCA9IHVybCArICc/JyArIHF1ZXJ5O1xuICAgICAgICB9XG5cbiAgICAgICAgYXJyYXlbMF0gPSB1cmw7XG4gICAgICAgIHVybCA9IGFycmF5LmpvaW4oJyMnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdXJsO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGJ1aWxkVVJMO1xuIiwidmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKDM2KTtcblxuLyoqXG4gKiBUaGUgZnVuY3Rpb24gdG8gY2FsbCBgb3B0aW9ucy5vblJlcXVlc3RDcmVhdGVkYCBjYWxsYmFjay5cbiAqXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcGFyYW0ge0h0dHBSZXF1ZXN0fEpTT05QUmVxdWVzdH0gcmVxdWVzdCBUaGUgcmVxdWVzdCBpbnN0YW5jZS5cbiAqL1xuZnVuY3Rpb24gY2FsbFJlcXVlc3RDcmVhdGVkQ2FsbGJhY2sob3B0aW9ucywgcmVxdWVzdCkge1xuICAgIHZhciBvblJlcXVlc3RDcmVhdGVkID0gb3B0aW9ucy5vblJlcXVlc3RDcmVhdGVkO1xuXG4gICAgaWYgKGlzRnVuY3Rpb24ob25SZXF1ZXN0Q3JlYXRlZCkpIHtcbiAgICAgICAgb25SZXF1ZXN0Q3JlYXRlZChyZXF1ZXN0KTtcbiAgICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gY2FsbFJlcXVlc3RDcmVhdGVkQ2FsbGJhY2s7XG4iLCJleHBvcnRzLkVSUl9BQk9SVEVEID0gJ0VSUl9BQk9SVEVEJztcbmV4cG9ydHMuRVJSX1JFU1BPTlNFID0gJ0VSUl9SRVNQT05TRSc7XG5leHBvcnRzLkVSUl9DQU5DRUxFRCA9ICdFUlJfQ0FOQ0VMRUQnO1xuZXhwb3J0cy5FUlJfTkVUV09SSyA9ICdFUlJfTkVUV09SSyc7XG5leHBvcnRzLkVSUl9USU1FT1VUID0gJ0VSUl9USU1FT1VUJztcbmV4cG9ydHMuSFRUUF9SRVFVRVNUID0gJ0hUVFBfUkVRVUVTVCc7XG5leHBvcnRzLkpTT05QX1JFUVVFU1QgPSAnSlNPTlBfUkVRVUVTVCc7XG4iLCJ2YXIgQ2FuY2VsQ29udHJvbGxlciA9IHJlcXVpcmUoMSk7XG5cbi8qKlxuICogQ3JlYXRlIGEgbmV3IGluc3RhbmNlIG9mIGBDYW5jZWxDb250cm9sbGVyYC5cbiAqXG4gKiBAcmV0dXJucyB7Q2FuY2VsQ29udHJvbGxlcn0gUmV0dXJucyBhbiBuZXcgaW5zdGFuY2Ugb2YgYENhbmNlbENvbnRyb2xsZXJgLlxuICovXG5mdW5jdGlvbiBjcmVhdGVDYW5jZWxDb250cm9sbGVyKCkge1xuICAgIHJldHVybiBuZXcgQ2FuY2VsQ29udHJvbGxlcigpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZUNhbmNlbENvbnRyb2xsZXI7XG4iLCJ2YXIgZW5jb2RlUXVlcnlTdHJpbmcgPSByZXF1aXJlKDM5KTtcbnZhciBjb25zdGFudHMgPSByZXF1aXJlKDI0KTtcbnZhciB0ZW1wbGF0ZSA9IHJlcXVpcmUoMzIpO1xudmFyIHV1aWQgPSByZXF1aXJlKDMzKTtcbnZhciBIVFRQX1JFUVVFU1QgID0gY29uc3RhbnRzLkhUVFBfUkVRVUVTVDtcblxuLyoqXG4gKiBDcmVhdGUgYSBuZXcgZGVmYXVsdCByZXF1ZXN0IG9wdGlvbnMuXG4gKlxuICogQHJldHVybnMge1JlcXVlc3RPcHRpb25zfSBSZXR1cm5zIGEgbmV3IGRlZmF1bHQgcmVxdWVzdCBvcGl0b25zLlxuICovXG5mdW5jdGlvbiBjcmVhdGVEZWZhdWx0T3B0aW9ucygpIHtcbiAgICAvKmVzbGludCBuby11bnVzZWQtdmFyczogW1wiZXJyb3JcIiwgeyBcImFyZ3NcIjogXCJub25lXCIgfV0qL1xuICAgIC8qKlxuICAgICAqIEB0eXBlIHtSZXF1ZXN0T3B0aW9uc31cbiAgICAgKi9cbiAgICB2YXIgb3B0aW9ucyA9IHtcbiAgICAgICAgbWV0aG9kOiAnR0VUJyxcbiAgICAgICAgYmFzZVVSTDogJycsXG4gICAgICAgIHVybDogJycsXG4gICAgICAgIG1vZGVsOiBudWxsLFxuICAgICAgICBxdWVyeTogbnVsbCxcbiAgICAgICAgaGVhZGVyczogbnVsbCxcbiAgICAgICAgYm9keTogbnVsbCxcbiAgICAgICAgdGltZW91dDogMCxcbiAgICAgICAganNvbnBEZWZhdWx0VGltZW91dDogNjAwMDAsXG4gICAgICAgIGNvcnM6IGZhbHNlLFxuICAgICAgICBub0NhY2hlOiBmYWxzZSxcbiAgICAgICAgbm9DYWNoZUhlYWRlcnM6IHtcbiAgICAgICAgICAgICdQcmFnbWEnOiAnbm8tY2FjaGUnLFxuICAgICAgICAgICAgJ0NhY2hlLUNvbnRyb2wnOiAnbm8tY2FjaGUsIG5vLXN0b3JlLCBtdXN0LXJldmFsaWRhdGUnXG4gICAgICAgIH0sXG4gICAgICAgIGpzb25wOiAnY2FsbGJhY2snLFxuICAgICAgICBzZXR0aW5nczoge30sXG4gICAgICAgIGNvbnRyb2xsZXI6IG51bGwsXG4gICAgICAgIHJlcXVlc3RGdW5jdGlvbk5hbWU6IG51bGwsXG4gICAgICAgIHJlcXVlc3RUeXBlOiBudWxsLFxuICAgICAgICB4aHJQcm9wczogbnVsbCxcbiAgICAgICAgdXNlcm5hbWU6IG51bGwsXG4gICAgICAgIHBhc3N3b3JkOiBudWxsLFxuICAgICAgICBodHRwUmVxdWVzdEJvZHlQcm9jZXNzb3I6IHtcbiAgICAgICAgICAgIHJhdzoge1xuICAgICAgICAgICAgICAgIHByaW9yaXR5OiAwLFxuICAgICAgICAgICAgICAgIGhlYWRlcnM6IG51bGwsXG4gICAgICAgICAgICAgICAgcHJvY2Vzc29yOiBudWxsLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGZvcm06IHtcbiAgICAgICAgICAgICAgICBwcmlvcml0eTogMSxcbiAgICAgICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkOyBjaGFyc2V0PVVURi04J1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcHJvY2Vzc29yOiBmdW5jdGlvbiAoZGF0YSwgb3B0aW9ucykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZW5jb2RlUXVlcnlTdHJpbmcoZGF0YSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGpzb246IHtcbiAgICAgICAgICAgICAgICBwcmlvcml0eTogMixcbiAgICAgICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbjsgY2hhcnNldD1VVEYtOCdcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHByb2Nlc3NvcjogZnVuY3Rpb24gKGRhdGEsIG9wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGRhdGEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgaHR0cFJlc3BvbnNlTWl4aW46IHtcbiAgICAgICAgICAgIGpzb246IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAvLyBgdGhpc2AgaXMgcG9pbnQgdG8gdGhlIGN1cnJlbnQgaW5zdGFuY2Ugb2YgYEh0dHBSZXNwb25zZWAuXG4gICAgICAgICAgICAgICAgdmFyIHJlc3BvbnNlVGV4dCA9IHRoaXMucmVxdWVzdC54aHIucmVzcG9uc2VUZXh0O1xuICAgICAgICAgICAgICAgIHJldHVybiByZXNwb25zZVRleHQgPyBKU09OLnBhcnNlKHJlc3BvbnNlVGV4dCkgOiBudWxsO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHRleHQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5yZXF1ZXN0Lnhoci5yZXNwb25zZVRleHQ7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc3RhdHVzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucmVxdWVzdC54aHIuc3RhdHVzO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBqc29ucFJlc3BvbnNlTWl4aW46IHtcbiAgICAgICAgICAgIGpzb246IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5yZXF1ZXN0LnJlc3BvbnNlSlNPTjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgaHR0cFJlc3BvbnNlRXJyb3JNaXhpbjogbnVsbCxcbiAgICAgICAganNvbnBSZXNwb25zZUVycm9yTWl4aW46IG51bGwsXG4gICAgICAgIGhhbmRsZU9wdGlvbnM6IG51bGwsXG4gICAgICAgIGNyZWF0ZVhIUjogZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICAgICAgfSxcbiAgICAgICAgY3JlYXRlU2NyaXB0OiBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICAgICAgdmFyIHNjcmlwdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NjcmlwdCcpO1xuXG4gICAgICAgICAgICBzY3JpcHQuc2V0QXR0cmlidXRlKCd0eXBlJywgJ3RleHQvamF2YXNjcmlwdCcpO1xuICAgICAgICAgICAgc2NyaXB0LnNldEF0dHJpYnV0ZSgnY2hhcnNldCcsICd1dGYtOCcpO1xuXG4gICAgICAgICAgICByZXR1cm4gc2NyaXB0O1xuICAgICAgICB9LFxuICAgICAgICBqc29ucENvbnRhaW5lck5vZGU6IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgICAgICByZXR1cm4gZG9jdW1lbnQuaGVhZCB8fCBkb2N1bWVudC5nZXRFbGVtZW50c0J5TmFtZSgnaGVhZCcpWzBdO1xuICAgICAgICB9LFxuICAgICAgICBqc29ucENhbGxiYWNrTmFtZTogZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgICAgIHJldHVybiAnanNvbnBfJyArIHV1aWQoKSArICdfJyArIChuZXcgRGF0ZSgpLmdldFRpbWUoKSk7XG4gICAgICAgIH0sXG4gICAgICAgIGNvbXBpbGVVUkw6IGZ1bmN0aW9uICh1cmwsIG1vZGVsLCBvcHRpb25zKSB7XG4gICAgICAgICAgICByZXR1cm4gdGVtcGxhdGUodXJsLCBtb2RlbCk7XG4gICAgICAgIH0sXG4gICAgICAgIGVuY29kZVF1ZXJ5U3RyaW5nOiBmdW5jdGlvbiAocXVlcnksIG9wdGlvbnMpIHtcbiAgICAgICAgICAgIHJldHVybiBlbmNvZGVRdWVyeVN0cmluZyhxdWVyeSk7XG4gICAgICAgIH0sXG4gICAgICAgIG9uWGhyQ3JlYXRlZDogbnVsbCxcbiAgICAgICAgb25YaHJPcGVuZWQ6IG51bGwsXG4gICAgICAgIG9uWGhyU2VudDogbnVsbCxcbiAgICAgICAgb25SZXF1ZXN0Q3JlYXRlZDogbnVsbCxcbiAgICAgICAgaXNSZXNwb25zZU9rOiBmdW5jdGlvbiAocmVxdWVzdFR5cGUsIHJlc3BvbnNlKSB7XG4gICAgICAgICAgICB2YXIgaXNPaztcbiAgICAgICAgICAgIHZhciBzdGF0dXM7XG5cbiAgICAgICAgICAgIC8vIEh0dHAgcmVxdWVzdFxuICAgICAgICAgICAgaWYgKHJlcXVlc3RUeXBlID09PSBIVFRQX1JFUVVFU1QpIHtcbiAgICAgICAgICAgICAgICBzdGF0dXMgPSArcmVzcG9uc2UucmVxdWVzdC54aHIuc3RhdHVzO1xuICAgICAgICAgICAgICAgIGlzT2sgPSAoc3RhdHVzID49IDIwMCAmJiBzdGF0dXMgPCAzMDApIHx8IHN0YXR1cyA9PT0gMzA0O1xuICAgICAgICAgICAgLy8gSlNPTlAgcmVxdWVzdFxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpc09rID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGlzT2s7XG4gICAgICAgIH0sXG4gICAgICAgIHRyYW5zZm9ybUVycm9yOiBudWxsLFxuICAgICAgICB0cmFuc2Zvcm1SZXNwb25zZTogbnVsbCxcbiAgICAgICAgc2hvdWxkQ2FsbEVycm9yQ2FsbGJhY2s6IG51bGwsXG4gICAgICAgIHNob3VsZENhbGxTdWNjZXNzQ2FsbGJhY2s6IG51bGxcbiAgICB9O1xuXG4gICAgcmV0dXJuIG9wdGlvbnM7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gY3JlYXRlRGVmYXVsdE9wdGlvbnM7XG4iLCJ2YXIgaXNGdW5jdGlvbiA9IHJlcXVpcmUoMzYpO1xudmFyIEh0dHBSZXNwb25zZUVycm9yID0gcmVxdWlyZSg1KTtcbnZhciBKU09OUFJlc3BvbnNlRXJyb3IgPSByZXF1aXJlKDgpO1xudmFyIGNvbnN0YW50cyA9IHJlcXVpcmUoMjQpO1xudmFyIEhUVFBfUkVRVUVTVCA9IGNvbnN0YW50cy5IVFRQX1JFUVVFU1Q7XG5cbi8qKlxuICogRmlyZSB0aGUgY2FsbGJhY2tzLlxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfG51bGx9IGNvZGUgSWYgdGhlcmUgaXMgYW4gZXJyb3IsIGBjb2RlYCBzaG91bGQgYmUgYSBzdHJpbmcuIElmIHRoZXJlIGlzIG5vIGVycm9yLCBgY29kZWAgaXMgYG51bGxgLlxuICogQHBhcmFtIHtIdHRwUmVzcG9uc2V8SlNPTlBSZXNwb25zZX0gcmVzcG9uc2UgVGhlIHJlc3BvbnNlIGluc3RhbmNlLlxuICovXG5mdW5jdGlvbiBmaXJlQ2FsbGJhY2tzKGNvZGUsIHJlc3BvbnNlKSB7XG4gICAgdmFyIHJlcXVlc3QgPSByZXNwb25zZS5yZXF1ZXN0O1xuICAgIHZhciByZXF1ZXN0VHlwZSA9IHJlcXVlc3QucmVxdWVzdFR5cGU7XG4gICAgdmFyIG9wdGlvbnMgPSByZXF1ZXN0Lm9wdGlvbnM7XG4gICAgdmFyIG9uc3VjY2VzcyA9IHJlcXVlc3Qub25zdWNjZXNzO1xuICAgIHZhciBvbmVycm9yID0gcmVxdWVzdC5vbmVycm9yO1xuICAgIHZhciBzaG91bGRDYWxsRXJyb3JDYWxsYmFjayA9IG9wdGlvbnMuc2hvdWxkQ2FsbEVycm9yQ2FsbGJhY2s7XG4gICAgdmFyIHNob3VsZENhbGxTdWNjZXNzQ2FsbGJhY2sgPSBvcHRpb25zLnNob3VsZENhbGxTdWNjZXNzQ2FsbGJhY2s7XG4gICAgdmFyIHRyYW5zZm9ybUVycm9yID0gb3B0aW9ucy50cmFuc2Zvcm1FcnJvcjtcbiAgICB2YXIgdHJhbnNmb3JtUmVzcG9uc2UgPSBvcHRpb25zLnRyYW5zZm9ybVJlc3BvbnNlO1xuXG4gICAgdmFyIGVycm9yID0gbnVsbDtcbiAgICB2YXIgY2FsbEVycm9yQ2FsbGJhY2sgPSB0cnVlO1xuICAgIHZhciBjYWxsU3VjY2Vzc0NhbGxiYWNrID0gdHJ1ZTtcbiAgICB2YXIgdHJhbnNmb3JtZWRFcnJvciA9IG51bGw7XG4gICAgdmFyIHRyYW5zZm9ybWVkUmVzcG9uc2UgPSBudWxsO1xuXG4gICAgaWYgKGNvZGUpIHtcbiAgICAgICAgaWYgKHJlcXVlc3RUeXBlID09PSBIVFRQX1JFUVVFU1QpIHtcbiAgICAgICAgICAgIGVycm9yID0gbmV3IEh0dHBSZXNwb25zZUVycm9yKGNvZGUsIHJlcXVlc3QpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZXJyb3IgPSBuZXcgSlNPTlBSZXNwb25zZUVycm9yKGNvZGUsIHJlcXVlc3QpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChpc0Z1bmN0aW9uKHRyYW5zZm9ybUVycm9yKSkge1xuICAgICAgICAgICAgdHJhbnNmb3JtZWRFcnJvciA9IHRyYW5zZm9ybUVycm9yKHJlcXVlc3RUeXBlLCBlcnJvcik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0cmFuc2Zvcm1lZEVycm9yID0gZXJyb3I7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGlzRnVuY3Rpb24oc2hvdWxkQ2FsbEVycm9yQ2FsbGJhY2spKSB7XG4gICAgICAgICAgICBjYWxsRXJyb3JDYWxsYmFjayA9IHNob3VsZENhbGxFcnJvckNhbGxiYWNrKHJlcXVlc3RUeXBlLCB0cmFuc2Zvcm1lZEVycm9yLCBlcnJvcik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNhbGxFcnJvckNhbGxiYWNrKSB7XG4gICAgICAgICAgICBpZiAoaXNGdW5jdGlvbihvbmVycm9yKSkge1xuICAgICAgICAgICAgICAgIG9uZXJyb3IodHJhbnNmb3JtZWRFcnJvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoaXNGdW5jdGlvbih0cmFuc2Zvcm1SZXNwb25zZSkpIHtcbiAgICAgICAgICAgIHRyYW5zZm9ybWVkUmVzcG9uc2UgPSB0cmFuc2Zvcm1SZXNwb25zZShyZXF1ZXN0VHlwZSwgcmVzcG9uc2UpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdHJhbnNmb3JtZWRSZXNwb25zZSA9IHJlc3BvbnNlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChpc0Z1bmN0aW9uKHNob3VsZENhbGxTdWNjZXNzQ2FsbGJhY2spKSB7XG4gICAgICAgICAgICBjYWxsU3VjY2Vzc0NhbGxiYWNrID0gc2hvdWxkQ2FsbFN1Y2Nlc3NDYWxsYmFjayhyZXF1ZXN0VHlwZSwgdHJhbnNmb3JtZWRSZXNwb25zZSwgcmVzcG9uc2UpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjYWxsU3VjY2Vzc0NhbGxiYWNrKSB7XG4gICAgICAgICAgICBpZiAoaXNGdW5jdGlvbihvbnN1Y2Nlc3MpKSB7XG4gICAgICAgICAgICAgICAgb25zdWNjZXNzKHRyYW5zZm9ybWVkUmVzcG9uc2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZpcmVDYWxsYmFja3M7XG4iLCJ2YXIgaXNGdW5jdGlvbiA9IHJlcXVpcmUoMzYpO1xuXG4vKipcbiAqIFRoZSBmdW5jdGlvbiB0byBwcm9jZXNzIHRoZSByZXF1ZXN0IG9wdGlvbnMuIFRoaXMgZnVuY3Rpb24gd2lsbCBjYWxsIHRoZSBmdW5jdGlvbiBgb3B0aW9ucy5oYW5kbGVPcHRpb25zYC5cbiAqXG4gKiBAcGFyYW0ge1JlcXVlc3RPcHRpb25zfSBvcHRpb25zIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gKiBAcmV0dXJucyB7dm9pZH1cbiAqL1xuZnVuY3Rpb24gaGFuZGxlT3B0aW9ucyhvcHRpb25zKSB7XG4gICAgaWYgKGlzRnVuY3Rpb24ob3B0aW9ucy5oYW5kbGVPcHRpb25zKSkge1xuICAgICAgICBvcHRpb25zLmhhbmRsZU9wdGlvbnMob3B0aW9ucyk7XG4gICAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGhhbmRsZU9wdGlvbnM7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG4iLCIvKipcbiAqIE1ha2UgYFN1YkNsYXNzYCBleHRlbmQgYFN1cGVyQ2xhc3NgLlxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IFN1YkNsYXNzIFRoZSBzdWIgY2xhc3MgY29uc3RydWN0b3IuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBTdXBlckNsYXNzIFRoZSBzdXBlciBjbGFzcyBjb25zdHJ1Y3Rvci5cbiAqL1xuZnVuY3Rpb24gaW5oZXJpdHMoU3ViQ2xhc3MsIFN1cGVyQ2xhc3MpIHtcbiAgICB2YXIgRiA9IGZ1bmN0aW9uKCkge307XG5cbiAgICBGLnByb3RvdHlwZSA9IFN1cGVyQ2xhc3MucHJvdG90eXBlO1xuXG4gICAgU3ViQ2xhc3MucHJvdG90eXBlID0gbmV3IEYoKTtcbiAgICBTdWJDbGFzcy5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBTdWJDbGFzcztcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpbmhlcml0cztcbiIsIi8qKlxuICogVGhlIG5vIG9wZXJhdGlvbiBmdW5jdGlvbi5cbiAqL1xuZnVuY3Rpb24gbm9vcCgpIHtcbiAgICAvLyBub3RoaW5nIHRvIGRvIGhlcmUuXG59XG5cbm1vZHVsZS5leHBvcnRzID0gbm9vcDtcbiIsInZhciBUX1NUUiA9IDE7IC8vIFN0YW5kcyBmb3IgYSBub3JtYWwgc3RyaW5nLlxudmFyIFRfRVhQID0gMjsgLy8gU3RhbmRzIGZvciBhbiBleHByZXNzaW9uLlxuXG4vKipcbiAqIEEgc2ltcGxlIHRlbXBsYXRlIGZ1bmN0aW9uXG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIFJyZXR1cm5zICcvcG9zdC8xJ1xuICogdGVtcGxhdGUoJy9wb3N0L3sgcG9zdC5pZCB9JywgeyBwb3N0OiB7IGlkOiAxIH0gfSlcbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gdGVtcGxhdGUgVGhlIHRlbXBsYXRlIHRleHQuXG4gKiBAcGFyYW0ge09iamVjdC48c3RyaW5nLCAqPn0gZGF0YSBUaGUgZGF0YSBvYmplY3QuXG4gKiBAcGFyYW0ge1RlbXBsYXRlT3B0aW9uc30gb3B0aW9ucyBUaGUgdGVtcGxhdGUgb3B0aW9ucy5cbiAqIEByZXR1cm5zIHtzdHJpbmd9IFJldHVybnMgdGhlIGNvbXBpbGVkIHRleHQuXG4gKi9cbmZ1bmN0aW9uIHRlbXBsYXRlKHRlbXBsYXRlLCBkYXRhLCBvcHRpb25zKSB7XG4gICAgdmFyIHRlbXBsID0gKHRlbXBsYXRlID09PSBudWxsIHx8IHRlbXBsYXRlID09PSB1bmRlZmluZWQpID8gJycgOiAodGVtcGxhdGUgKyAnJyk7XG4gICAgdmFyIG1vZGVsID0gZGF0YSB8fCB7fTtcbiAgICB2YXIgb3B0cyA9IG9wdGlvbnMgfHwge307XG4gICAgdmFyIG9wZW5pbmdUYWcgPSBvcHRzLm9wZW5pbmdUYWcgfHwgJ3snO1xuICAgIHZhciBjbG9zaW5nVGFnID0gb3B0cy5jbG9zaW5nVGFnIHx8ICd9JztcbiAgICB2YXIgZW5jb2RlID0gb3B0cy5lbmNvZGUgfHwgZW5jb2RlVVJJQ29tcG9uZW50O1xuICAgIHZhciByZXN1bHQgPSBwYXJzZSh0ZW1wbCwgb3BlbmluZ1RhZywgY2xvc2luZ1RhZywgZnVuY3Rpb24gKGV4cCkge1xuICAgICAgICB2YXIgZmlyc3QgPSBleHAuY2hhckF0KDApO1xuICAgICAgICB2YXIgc2Vjb25kID0gZXhwLmNoYXJBdCgxKTtcbiAgICAgICAgdmFyIHJhdyA9IGZhbHNlO1xuXG4gICAgICAgIGlmIChmaXJzdCA9PT0gJy0nICYmIHNlY29uZCA9PT0gJyAnKSB7XG4gICAgICAgICAgICByYXcgPSB0cnVlO1xuICAgICAgICAgICAgZXhwID0gZXhwLnN1YnN0cigyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGV4cCA9IGV4cC5yZXBsYWNlKC9eXFxzK3xcXHMrJC9nLCAnJyk7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHR5cGU6IFRfRVhQLFxuICAgICAgICAgICAgdGV4dDogZXhwLFxuICAgICAgICAgICAgcmF3OiByYXdcbiAgICAgICAgfTtcbiAgICB9KTtcblxuICAgIHZhciByZW5kZXIgPSBjb21waWxlKHJlc3VsdCwgZW5jb2RlKTtcblxuICAgIHRyeSB7XG4gICAgICAgIHJldHVybiByZW5kZXIobW9kZWwpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDb21waWxlIEVycm9yOlxcblxcbicgKyB0ZW1wbGF0ZSArICdcXG5cXG4nICsgZS5tZXNzYWdlKTtcbiAgICB9XG59XG5cbi8qKlxuICogQ29tcGlsZSB0aGUgcmVzdWx0IG9mIGBwYXJzZWAgdG8gYSBmdW5jdGlvbi5cbiAqXG4gKiBAcGFyYW0ge09iamVjdC48c3RyaW5nLCAqPltdfSByZXN1bHQgVGhlIHJlc3VsdCBvZiBgcGFyc2VgLlxuICogQHBhcmFtIHsoc3RyOiBzdHJpbmcpID0+IHN0cmluZ30gZW5jb2RlIFRoZSBmdW5jdGlvbiB0byBlbmNvZGUgdGhlIHN0cmluZy5cbiAqIEByZXR1cm5zIHsobW9kZWw6IE9iamVjdC48c3RyaW5nLCAqPikgPT4gc3RyaW5nfSBSZXR1cm5zIGEgZnVuY3Rpb24gdGhhdCBjb21waWxlIGRhdGEgdG8gc3RyaW5nLlxuICovXG5mdW5jdGlvbiBjb21waWxlKHJlc3VsdCwgZW5jb2RlKSB7XG4gICAgdmFyIGZuO1xuICAgIHZhciBsaW5lO1xuICAgIHZhciBsaW5lcyA9IFtdO1xuICAgIHZhciBpID0gMDtcbiAgICB2YXIgbCA9IHJlc3VsdC5sZW5ndGg7XG5cbiAgICBsaW5lcy5wdXNoKCd2YXIgX19vPVtdJyk7XG4gICAgbGluZXMucHVzaCgnd2l0aChfX3MpeycpO1xuXG4gICAgZm9yICggOyBpIDwgbDsgKytpKSB7XG4gICAgICAgIGxpbmUgPSByZXN1bHRbaV07XG5cbiAgICAgICAgaWYgKGxpbmUudHlwZSA9PT0gVF9TVFIpIHtcbiAgICAgICAgICAgIGxpbmVzLnB1c2goJ19fby5wdXNoKCcgKyBKU09OLnN0cmluZ2lmeShsaW5lLnRleHQpICsgJyknKTtcbiAgICAgICAgfSBlbHNlIGlmIChsaW5lLnR5cGUgPT09IFRfRVhQICYmIGxpbmUudGV4dCkge1xuICAgICAgICAgICAgaWYgKGxpbmUucmF3KSB7XG4gICAgICAgICAgICAgICAgbGluZXMucHVzaCgnX19vLnB1c2goJyArIGxpbmUudGV4dCArICcpJyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGxpbmVzLnB1c2goJ19fby5wdXNoKF9fZSgnICsgbGluZS50ZXh0ICsgJykpJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBsaW5lcy5wdXNoKCd9Jyk7XG4gICAgbGluZXMucHVzaCgncmV0dXJuIF9fby5qb2luKFwiXCIpJyk7XG5cbiAgICBmbiA9IG5ldyBGdW5jdGlvbignX19zJywgJ19fZScsIGxpbmVzLmpvaW4oJ1xcbicpKTtcblxuICAgIHJldHVybiBmdW5jdGlvbiAobW9kZWwpIHtcbiAgICAgICAgcmV0dXJuIGZuKG1vZGVsLCBmdW5jdGlvbiAodmFsKSB7XG4gICAgICAgICAgICByZXR1cm4gKHZhbCA9PT0gbnVsbCB8fCB2YWwgPT09IHVuZGVmaW5lZCkgPyAnJyA6IGVuY29kZSh2YWwgKyAnJyk7XG4gICAgICAgIH0pO1xuICAgIH07XG59XG5cbi8qKlxuICogVGhlIGZ1bmN0aW9uIHRvIHBhcnNlIHRoZSB0ZW1wbGF0ZSBzdHJpbmcuXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IHRlbXBsYXRlIFRoZSB0ZW1wbGF0ZSBzdHJpbmcgdG8gcGFyc2UuXG4gKiBAcGFyYW0ge3N0cmluZ30gb3BlbmluZ1RhZyBUaGUgb3BlbmluZyB0YWcsIGZvciBleGFtcGxlIGB7YC5cbiAqIEBwYXJhbSB7c3RyaW5nfSBjbG9zaW5nVGFnIFRoZSBjbG9zaW5nIHRhZywgZm9yIGV4YW1wbGUgYH1gLlxuICogQHBhcmFtIHsoZXhwOiBzdHJpbmcpID0+IE9iamVjdC48c3RyaW5nLCAqPn0gaGFuZGxlRXhwIFRoZSBmdW5jdGlvbiB0byBoYW5kbGUgZWFjaCBleHByZXNzaW9uLlxuICogQHJldHVybnMge09iamVjdC48c3RyaW5nLCAqPltdfSBSZXR1cm5zIHRoZSBwYXJzZWQgcmVzdWx0LlxuICovXG5mdW5jdGlvbiBwYXJzZSh0ZW1wbGF0ZSwgb3BlbmluZ1RhZywgY2xvc2luZ1RhZywgaGFuZGxlRXhwKSB7XG4gICAgdmFyIHJlcztcbiAgICB2YXIgdGVtcGwgPSB0ZW1wbGF0ZTtcbiAgICB2YXIgcmVnT3BlbmluZ1RhZyA9IGNyZWF0ZVJlZ0V4cChvcGVuaW5nVGFnKTtcbiAgICB2YXIgcmVnQ2xvc2luZ1RhZyA9IGNyZWF0ZVJlZ0V4cChjbG9zaW5nVGFnKTtcbiAgICB2YXIgRVJSX1VORVhQRUNURURfRU5EID0gJ1VuZXhwZWN0ZWQgZW5kJztcbiAgICB2YXIgdHlwZSA9IFRfU1RSO1xuICAgIHZhciBzdHJDYWNoZSA9IFtdO1xuICAgIHZhciBleHBDYWNoZSA9IFtdO1xuICAgIHZhciBvdXRwdXQgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIGBSZWdFeHBgIGZvciB0aGUgZ2l2ZW4gdGFnLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHRhZyBUaGUgdGFnIHRvIGNyZWF0ZSBhIGBSZWdFeHBgLlxuICAgICAqIEByZXR1cm5zIHtSZWdFeHB9IFJldHVybnMgYW4gaW5zdGFuY2Ugb2YgYFJlZ0V4cGAuXG4gICAgICovXG4gICAgZnVuY3Rpb24gY3JlYXRlUmVnRXhwKHRhZykge1xuICAgICAgICB2YXIgcmVnQ2hhcnMgPSAvW1xcXFx8e30oKVtcXF0uKis/XiRdL2c7XG4gICAgICAgIHZhciBlc2NhcGVkVGFnID0gdGFnLnJlcGxhY2UocmVnQ2hhcnMsIGZ1bmN0aW9uIChjaGFyKSB7XG4gICAgICAgICAgICByZXR1cm4gJ1xcXFwnICsgY2hhcjtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBuZXcgUmVnRXhwKCcoXFxcXFxcXFwqKScgKyBlc2NhcGVkVGFnKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGbHVzaCB0aGUgdGV4dCBpbiBgc3RyQ2FjaGVgIGludG8gYG91dHB1dGAgYW5kIHJlc2V0IGBzdHJDYWNoZWAuXG4gICAgICovXG4gICAgZnVuY3Rpb24gZmx1c2hTdHIoKSB7XG4gICAgICAgIG91dHB1dC5wdXNoKHtcbiAgICAgICAgICAgIHR5cGU6IFRfU1RSLFxuICAgICAgICAgICAgdGV4dDogc3RyQ2FjaGUuam9pbignJylcbiAgICAgICAgfSk7XG4gICAgICAgIHN0ckNhY2hlID0gW107XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmx1c2ggdGhlIHRleHQgaW4gYGV4cENhY2hlYCBpbnRvIGBvdXRwdXRgIGFuZCByZXNldCBgZXhwQ2FjaGVgLlxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGZsdXNoRXhwKCkge1xuICAgICAgICBvdXRwdXQucHVzaChoYW5kbGVFeHAoZXhwQ2FjaGUuam9pbignJykpKTtcbiAgICAgICAgZXhwQ2FjaGUgPSBbXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVjayB3aGV0aGVyIHRoZSB0YWcgaXMgZXNjYXBlZC4gSWYgaXQgaXMsIHB1dCBpcyB0byB0aGUgY2FjaGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge09iamVjdC48c3RyaW5nLCAqPn0gcmVzIFRoZSByZXN1bHQgb2YgYFJlZ0V4cCNleGVjYC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdGFnIFRoZSB0YWcgdG8gZXNjYXBlLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nW119IGNhY2hlIFRoZSBhcnJheSB0byBzYXZlIGVzY2FwZWQgdGV4dC5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgb24gaXQgaXMgTk9UIGVzY2FwZWQuXG4gICAgICovXG4gICAgZnVuY3Rpb24gZXNjKHJlcywgdGFnLCBjYWNoZSkge1xuICAgICAgICB2YXIgc2xhc2hlcyA9IHJlc1sxXSB8fCAnJztcbiAgICAgICAgdmFyIGNvdW50ID0gc2xhc2hlcy5sZW5ndGg7XG5cbiAgICAgICAgaWYgKGNvdW50ICUgMiA9PT0gMCkge1xuICAgICAgICAgICAgaWYgKGNvdW50KSB7XG4gICAgICAgICAgICAgICAgY2FjaGUucHVzaChzbGFzaGVzLnN1YnN0cihjb3VudCAvIDIpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKGNvdW50ID4gMSkge1xuICAgICAgICAgICAgICAgIGNhY2hlLnB1c2goc2xhc2hlcy5zdWJzdHIoKGNvdW50ICsgMSkgLyAyKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYWNoZS5wdXNoKHRhZyk7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB3aGlsZSAodGVtcGwubGVuZ3RoKSB7XG4gICAgICAgIGlmICh0eXBlID09PSBUX1NUUikge1xuICAgICAgICAgICAgcmVzID0gcmVnT3BlbmluZ1RhZy5leGVjKHRlbXBsKTtcbiAgICAgICAgICAgIGlmIChyZXMpIHtcbiAgICAgICAgICAgICAgICBzdHJDYWNoZS5wdXNoKHRlbXBsLnN1YnN0cigwLCByZXMuaW5kZXgpKTtcbiAgICAgICAgICAgICAgICB0ZW1wbCA9IHRlbXBsLnN1YnN0cihyZXMuaW5kZXggKyByZXNbMF0ubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICBpZiAoZXNjKHJlcywgb3BlbmluZ1RhZywgc3RyQ2FjaGUpKSB7XG4gICAgICAgICAgICAgICAgICAgIGZsdXNoU3RyKCk7XG4gICAgICAgICAgICAgICAgICAgIHR5cGUgPSBUX0VYUDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0ZW1wbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKEVSUl9VTkVYUEVDVEVEX0VORCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHN0ckNhY2hlLnB1c2godGVtcGwpO1xuICAgICAgICAgICAgICAgIGZsdXNoU3RyKCk7XG4gICAgICAgICAgICAgICAgdGVtcGwgPSAnJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHsgLy8gaWYgKHR5cGUgPT09IFRfRVhQKVxuICAgICAgICAgICAgcmVzID0gcmVnQ2xvc2luZ1RhZy5leGVjKHRlbXBsKTtcbiAgICAgICAgICAgIGlmIChyZXMpIHtcbiAgICAgICAgICAgICAgICBleHBDYWNoZS5wdXNoKHRlbXBsLnN1YnN0cigwLCByZXMuaW5kZXgpKTtcbiAgICAgICAgICAgICAgICB0ZW1wbCA9IHRlbXBsLnN1YnN0cihyZXMuaW5kZXggKyByZXNbMF0ubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICBpZiAoZXNjKHJlcywgY2xvc2luZ1RhZywgZXhwQ2FjaGUpKSB7XG4gICAgICAgICAgICAgICAgICAgIGZsdXNoRXhwKCk7XG4gICAgICAgICAgICAgICAgICAgIHR5cGUgPSBUX1NUUjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihFUlJfVU5FWFBFQ1RFRF9FTkQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG91dHB1dDtcbn1cblxuLyoqXG4gKiBAdHlwZWRlZiB7T2JqZWN0LjxzdHJpbmcsICo+fSBUZW1wbGF0ZU9wdGlvbnNcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbb3BlbmluZ1RhZ10gVGhlIG9wZW5pbmcgdGFnIG9mIHRoZSB0ZW1wbGF0ZSwgZGVmYXVsdCBpcyBge2AuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gW2Nsb3NpbmdUYWddIFRoZSBjbG9zaW5nIHRhZyBvZiB0aGUgdGVtcGxhdGUsIGRlZmF1bHQgaXMgYH1gLlxuICogQHByb3BlcnR5IHsodmFsdWU6IHN0cmluZykgPT4gc3RyaW5nfSBbZW5jb2RlXSBUaGUgZnVuY3Rpb24gdG8gZW5jb2RlIHRoZSBzdHJpbmcsIGRlZmF1bHQgaXMgYGVuY29kZVVSSUNvbXBvbmVudGAuXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSB0ZW1wbGF0ZTtcbiIsInZhciBpZCA9IDA7XG5cbi8qKlxuICogUmV0dXJucyBhIG51bWJlciB0aGF0IGdyZWF0ZXIgdGhhbiB0aGUgcHJpdm91cyBvbmUsIHN0YXJ0aW5nIGZvcm0gYDFgLlxuICpcbiAqIEByZXR1cm5zIHtudW1iZXJ9XG4gKi9cbmZ1bmN0aW9uIHV1aWQoKSB7XG4gICAgaWQgKz0gMTtcbiAgICByZXR1cm4gaWQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gdXVpZDtcbiIsIi8qKlxuICogQ2hlY2sgd2hldGhlciB0aGUgdXJsIGlzIGFic29sdXRlIHVybC5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gdXJsIFRoZSB1cmwgc3RyaW5nIHRvIGNoZWNrXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIHVybCBpcyBhYm9zb2x1dGUsIG90aGVyd2lzZSBgZmFsc2VgIGlzIHJldHVybmVkXG4gKi9cbmZ1bmN0aW9uIGlzQWJzb2x1dGVVUkwodXJsKSB7XG4gICAgcmV0dXJuIC9eKD86W2Etel1bYS16MC05XFwtXFwuXFwrXSo6KT9cXC9cXC8vaS50ZXN0KHVybCk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaXNBYnNvbHV0ZVVSTDtcbiIsInZhciB0b1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG5cbi8qKlxuICogQ2hlY2sgd2hldGhlciB0aGUgdmFyaWFibGUgaXMgYW4gaW5zdGFuY2Ugb2YgYEFycmF5YFxuICpcbiAqIEBwYXJhbSB7YW55fSBpdCBUaGUgdmFyaWFibGUgdG8gY2hlY2tcbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgdmFyaWFibGUgaXMgYW4gaW5zdGFuY2Ugb2YgYEFycmF5YCwgb3RoZXJ3aXNlIGBmYWxzZWAgaXMgcmV0dXJuZWRcbiAqL1xuZnVuY3Rpb24gaXNBcnJheShpdCkge1xuICAgIHJldHVybiB0b1N0cmluZy5jYWxsKGl0KSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpc0FycmF5O1xuIiwidmFyIHRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcblxuLyoqXG4gKiBDaGVjayB3aGV0aGVyIHRoZSB2YXJpYWJsZSBpcyBhIGZ1bmN0aW9uXG4gKlxuICogQHBhcmFtIHthbnl9IGl0IFRoZSB2YXJpYWJsZSB0byBjaGVja1xuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSB2YXJpYWJsZSBpcyBhIGZ1bmN0aW9uLCBvdGhlcndpc2UgYGZhbHNlYCBpcyByZXR1cm5lZFxuICovXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGl0KSB7XG4gICAgcmV0dXJuIHRvU3RyaW5nLmNhbGwoaXQpID09PSAnW29iamVjdCBGdW5jdGlvbl0nO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGlzRnVuY3Rpb247XG4iLCJ2YXIgdG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xudmFyIGdldFByb3RvdHlwZU9mID0gT2JqZWN0LmdldFByb3RvdHlwZU9mO1xuXG5pZiAoIWdldFByb3RvdHlwZU9mKSB7XG4gICAgZ2V0UHJvdG90eXBlT2YgPSBmdW5jdGlvbiAob2JqZWN0KSB7XG4gICAgICAgIHJldHVybiBvYmplY3QuX19wcm90b19fO1xuICAgIH07XG59XG5cbi8qKlxuICogQ2hlY2sgd2hldGhlciB0aGUgdmFyaWFibGUgaXMgYSBwbGFpbiBvYmplY3QuXG4gKlxuICogQHBhcmFtIHthbnl9IGl0IFRoZSB2YXJpYWJsZSB0byBjaGVja1xuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSB2YXJpYWJsZSBpcyBhIHBsYWluIG9iamVjdCwgb3RoZXJ3aXNlIGBmYWxzZWAgaXMgcmV0dXJuZWRcbiAqL1xuZnVuY3Rpb24gaXNQbGFpbk9iamVjdChpdCkge1xuICAgIHZhciBwcm90bztcblxuICAgIGlmICh0b1N0cmluZy5jYWxsKGl0KSAhPT0gJ1tvYmplY3QgT2JqZWN0XScpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHByb3RvID0gZ2V0UHJvdG90eXBlT2YoaXQpO1xuXG4gICAgLy8gT2JqZWN0LmNyZWF0ZShudWxsKVxuICAgIGlmICghcHJvdG8pIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgaWYgKHByb3RvICE9PSBnZXRQcm90b3R5cGVPZih7fSkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGlzUGxhaW5PYmplY3Q7XG4iLCJ2YXIgaXNBcnJheSA9IHJlcXVpcmUoMzUpO1xudmFyIGlzUGxhaW5PYmplY3QgPSByZXF1aXJlKDM3KTtcbnZhciBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xudmFyIHNsaWNlID0gQXJyYXkucHJvdG90eXBlLnNsaWNlO1xuXG4vKipcbiAqIENvcHkgdGhlIG5vbi11bmRlZmluZWQgdmFsdWVzIG9mIHNvdXJjZSB0byB0YXJnZXQuIE92ZXJ3cml0ZSB0aGUgb3JpZ2luYWwgdmFsdWVzLlxuICogVGhpcyBmdW5jdGlvbiB3aWxsIG1vZGlmeSB0aGUgdGFyZ2V0XG4gKlxuICogQHBhcmFtIHtPYmplY3QuPHN0cmluZywgKj58YW55W119IHRhcmdldCBUaGUgdGFyZ2V0IG9iamVjdCBvciBhcnJheVxuICogQHBhcmFtIHtPYmplY3QuPHN0cmluZywgKj58YW55W119IHNvdXJjZSBUaGUgc291cmNlIG9iamVjdCBvciBhcnJheVxuICogQHJldHVybnMge09iamVjdC48c3RyaW5nLCAqPnxhbnlbXX0gUmV0dXJucyB0aGUgZXh0ZW5kZWQgdGFyZ2V0IG9iamVjdCBvciBhcnJheVxuICovXG5mdW5jdGlvbiBleHRlbmQodGFyZ2V0LCBzb3VyY2UpIHtcbiAgICB2YXIga2V5LCB2YWw7XG5cbiAgICBpZiAoIHRhcmdldCAmJiAoIGlzQXJyYXkoc291cmNlKSB8fCBpc1BsYWluT2JqZWN0KHNvdXJjZSkgKSApIHtcbiAgICAgICAgZm9yICgga2V5IGluIHNvdXJjZSApIHtcbiAgICAgICAgICAgIGlmICggaGFzT3duLmNhbGwoc291cmNlLCBrZXkpICkge1xuICAgICAgICAgICAgICAgIHZhbCA9IHNvdXJjZVtrZXldO1xuICAgICAgICAgICAgICAgIGlmICh2YWwgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIGlzUGxhaW5PYmplY3QodmFsKSApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICggISBpc1BsYWluT2JqZWN0KHRhcmdldFtrZXldKSApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0YXJnZXRba2V5XSA9IHt9O1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgbWVyZ2UodGFyZ2V0W2tleV0sIHZhbCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoIGlzQXJyYXkodmFsKSApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICggISBpc0FycmF5KHRhcmdldFtrZXldKSApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0YXJnZXRba2V5XSA9IFtdO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgbWVyZ2UodGFyZ2V0W2tleV0sIHZhbCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0YXJnZXRba2V5XSA9IHZhbDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0YXJnZXQ7XG59XG5cbi8qKlxuICogQ29weSBhbnkgbm9uLXVuZGVmaW5lZCB2YWx1ZXMgb2Ygc291cmNlIHRvIHRhcmdldCBhbmQgb3ZlcndyaXRlcyB0aGUgY29ycmVzcG9uZGluZyBvcmlnaW5hbCB2YWx1ZXMuIFRoaXMgZnVuY3Rpb25cbiAqIHdpbGwgbW9kaWZ5IHRoZSB0YXJnZXQgb2JqZWN0LlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB0YXJnZXQgVGhlIHRhcmdldCBvYmplY3RcbiAqIEBwYXJhbSB7Li4uT2JqZWN0fSBhcmdzIFRoZSBzb3VyY2Ugb2JqZWN0XG4gKiBAcmV0dXJucyB7T2JqZWN0fSBSZXR1cm5zIHRoZSBtb2RpZmllZCB0YXJnZXQgb2JqZWN0XG4gKi9cbmZ1bmN0aW9uIG1lcmdlKHRhcmdldCwgYXJncykge1xuICAgIHZhciBpID0gMDtcbiAgICB2YXIgbCA9IGFyZ3VtZW50cy5sZW5ndGggLSAxO1xuXG4gICAgYXJncyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcblxuICAgIGZvciAoaSA9IDA7IGkgPCBsOyBpICs9IDEpIHtcbiAgICAgICAgZXh0ZW5kKHRhcmdldCwgYXJnc1tpXSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRhcmdldDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBtZXJnZTtcbiIsInZhciB1dGlsID0gcmVxdWlyZSg0MCk7XG52YXIgaXNBcnJheSA9IHV0aWwuaXNBcnJheTtcbnZhciBpc09iamVjdCA9IHV0aWwuaXNPYmplY3Q7XG52YXIgaGFzT3duID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcblxuLyoqXG4gKiBFbmNvZGUgdGhlIGdpdmVuIG9iamVjdCB0byBVUkkgQ29tcG9uZW50IGVuY29kZWQgcXVlcnkgc3RyaW5nXG4gKlxuICogQHBhcmFtIHtPYmplY3QuPHN0cmluZywgKj59IG9iamVjdCBUaGUgb2JqZWN0IHRvIGVuY29kZVxuICogQHBhcmFtIHtib29sZWFufSBba2VlcEFycmF5SW5kZXhdIFdoZXRoZXIgdG8ga2VlcCBhcnJheSBpbmRleFxuICogQHJldHVybnMge3N0cmluZ30gUmV0dXJucyB0aGUgVVJJIENvbXBvbmVudCBlbmNvZGVkIHF1ZXJ5IHN0cmluZ1xuICovXG5mdW5jdGlvbiBlbmNvZGUob2JqZWN0LCBrZWVwQXJyYXlJbmRleCkge1xuICAgIHZhciBrZXk7XG4gICAgdmFyIGtleVZhbHVlQXJyYXkgPSBbXTtcblxuICAgIGtlZXBBcnJheUluZGV4ID0gISFrZWVwQXJyYXlJbmRleDtcblxuICAgIGlmICggaXNPYmplY3Qob2JqZWN0KSApIHtcbiAgICAgICAgZm9yICgga2V5IGluIG9iamVjdCApIHtcbiAgICAgICAgICAgIGlmICggaGFzT3duLmNhbGwob2JqZWN0LCBrZXkpICkge1xuICAgICAgICAgICAgICAgIGVuY29kZUtleShrZXksIG9iamVjdFtrZXldLCBrZXlWYWx1ZUFycmF5LCBrZWVwQXJyYXlJbmRleCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4ga2V5VmFsdWVBcnJheS5qb2luKCcmJyk7XG59XG5cbi8qKlxuICogRW5jb2RlIHRoZSBzcGVjZWlmZWQga2V5IGluIHRoZSBvYmplY3RcbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30ga2V5IFRoZSBrZXkgbmFtZVxuICogQHBhcmFtIHthbnl9IGRhdGEgVGhlIGRhdGEgb2YgdGhlIGtleVxuICogQHBhcmFtIHtzdHJpbmdbXX0ga2V5VmFsdWVBcnJheSBUaGUgYXJyYXkgdG8gc3RvcmUgdGhlIGtleSB2YWx1ZSBzdHJpbmdcbiAqIEBwYXJhbSB7Ym9vbGVhbn0ga2VlcEFycmF5SW5kZXggV2hldGhlciB0byBrZWVwIGFycmF5IGluZGV4XG4gKi9cbmZ1bmN0aW9uIGVuY29kZUtleShrZXksIGRhdGEsIGtleVZhbHVlQXJyYXksIGtlZXBBcnJheUluZGV4KSB7XG4gICAgdmFyIHByb3A7XG4gICAgdmFyIGluZGV4O1xuICAgIHZhciBsZW5ndGg7XG4gICAgdmFyIHZhbHVlO1xuICAgIHZhciBzdWJLZXk7XG5cbiAgICBpZiAoIGlzT2JqZWN0KGRhdGEpICkge1xuICAgICAgICBmb3IgKCBwcm9wIGluIGRhdGEgKSB7XG4gICAgICAgICAgICBpZiAoIGhhc093bi5jYWxsKGRhdGEsIHByb3ApICkge1xuICAgICAgICAgICAgICAgIHZhbHVlID0gZGF0YVtwcm9wXTtcbiAgICAgICAgICAgICAgICBzdWJLZXkgPSBrZXkgKyAnWycgKyBwcm9wICsgJ10nO1xuICAgICAgICAgICAgICAgIGVuY29kZUtleShzdWJLZXksIHZhbHVlLCBrZXlWYWx1ZUFycmF5LCBrZWVwQXJyYXlJbmRleCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKCBpc0FycmF5KGRhdGEpICkge1xuICAgICAgICBpbmRleCA9IDA7XG4gICAgICAgIGxlbmd0aCA9IGRhdGEubGVuZ3RoO1xuXG4gICAgICAgIHdoaWxlIChpbmRleCA8IGxlbmd0aCkge1xuICAgICAgICAgICAgdmFsdWUgPSBkYXRhW2luZGV4XTtcblxuICAgICAgICAgICAgaWYgKCBrZWVwQXJyYXlJbmRleCB8fCBpc0FycmF5KHZhbHVlKSB8fCBpc09iamVjdCh2YWx1ZSkgKSB7XG4gICAgICAgICAgICAgICAgc3ViS2V5ID0ga2V5ICsgJ1snICsgaW5kZXggKyAnXSc7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHN1YktleSA9IGtleSArICdbXSc7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGVuY29kZUtleShzdWJLZXksIHZhbHVlLCBrZXlWYWx1ZUFycmF5LCBrZWVwQXJyYXlJbmRleCk7XG5cbiAgICAgICAgICAgIGluZGV4ICs9IDE7XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICBrZXkgPSBlbmNvZGVVUklDb21wb25lbnQoa2V5KTtcbiAgICAgICAgLy8gaWYgZGF0YSBpcyBudWxsLCBubyBgPWAgaXMgYXBwZW5kZWRcbiAgICAgICAgaWYgKGRhdGEgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHZhbHVlID0ga2V5O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gaWYgZGF0YSBpcyB1bmRlZmluZWQsIHRyZWF0IGl0IGFzIGVtcHR5IHN0cmluZ1xuICAgICAgICAgICAgaWYgKGRhdGEgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGRhdGEgPSAnJztcbiAgICAgICAgICAgIC8vIG1ha2Ugc3VyZSB0aGF0IGRhdGEgaXMgc3RyaW5nXG4gICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBkYXRhICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIGRhdGEgPSAnJyArIGRhdGE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YWx1ZSA9IGtleSArICc9JyArIGVuY29kZVVSSUNvbXBvbmVudChkYXRhKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGtleVZhbHVlQXJyYXkucHVzaCh2YWx1ZSk7XG4gICAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGVuY29kZTtcbiIsInZhciB0b1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG5cbi8qKlxuICogQ2hlY2sgd2hldGhlciB0aGUgdmFyaWFibGUgaXMgYW4gYXJyYXlcbiAqXG4gKiBAcGFyYW0ge2FueX0gaXQgVGhlIHZhcmlhYmxlIHRvIGNoZWNrXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgaXQgaXMgYW4gYXJyYXlcbiAqL1xudmFyIGlzQXJyYXkgPSBmdW5jdGlvbiAoaXQpIHtcbiAgICByZXR1cm4gJ1tvYmplY3QgQXJyYXldJyA9PT0gdG9TdHJpbmcuY2FsbChpdCk7XG59O1xuXG4vKipcbiAqIENoZWNrIHdoZXRoZXIgdGhlIHZhcmlhYmxlIGlzIGFuIG9iamVjdFxuICpcbiAqIEBwYXJhbSB7YW55fSBpdCBUaGUgdmFyaWFibGUgdG8gY2hlY2tcbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBpdCBpcyBhbiBvYmplY3RcbiAqL1xudmFyIGlzT2JqZWN0ID0gZnVuY3Rpb24gKGl0KSB7XG4gICAgcmV0dXJuICdbb2JqZWN0IE9iamVjdF0nID09PSB0b1N0cmluZy5jYWxsKGl0KTtcbn07XG5cbmV4cG9ydHMuaXNBcnJheSA9IGlzQXJyYXk7XG5leHBvcnRzLmlzT2JqZWN0ID0gaXNPYmplY3Q7XG4iXX0=
