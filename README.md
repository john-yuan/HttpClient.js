# HttpClient.js

[![npm version](https://img.shields.io/npm/v/x-http-client.svg)](https://www.npmjs.com/package/x-http-client)
[![Build Status](https://travis-ci.org/john-yuan/HttpClient.js.svg?branch=master)](https://travis-ci.org/john-yuan/HttpClient.js)
[![install size](https://packagephobia.now.sh/badge?p=x-http-client)](https://packagephobia.now.sh/result?p=x-http-client)
[![npm downloads](https://img.shields.io/npm/dm/x-http-client.svg)](http://npm-stat.com/charts.html?package=x-http-client)

An http client to simplify sending requests (Http & JSONP) in the browser.

[点击此处查看中文说明文档](./README.zh_CN.md)

## Features

* Promise-style and callback-style API.
* Send Http & JSONP requests.
* Compile url and query string.
* Cancel request and set timeout.
* Headers, cache control and CORS.
* Configurable http request body processor.
* Configurable function to check whether the response is ok.
* Configurable functions to transform the responses and the errors.
* Configurable mixins to the responses and the errors.
* Other flexible and useful configuration.

## Install

If you are using npm, just install `x-http-client` as a dependency.

```bash
npm i x-http-client
```

Otherwise you can import the bundle file with script tag directly.

```html
<script src="/path/to/HttpClient.min.js"></script>
```

Note that the bundle file also can be used as an [AMD module](https://github.com/amdjs/amdjs-api), which means it can be loaded by [require.js](https://requirejs.org/).

## Example

### 1. An exmaple of GET request

```js
import HttpClient from 'x-http-client';

/**
 * Tip: You'd better save the configured instance of `HttpClient` in
 * a individual module and reuse it in other place of your project.
 */
const client = new HttpClient({
    baseURL: 'https://example.com'
});

/**
 * GET https://example.com/posts/1
 */
client.fetch({
    url: '/posts/1'
}).then(response => {
    return response.json();
}).then(data => {
    console.log(data);
}).catch(error => {
    console.error(error);
});
```

### 2. An exmaple of PUT request

```js
import HttpClient from 'x-http-client';

/**
 * Tip: You'd better save the configured instance of `HttpClient` in
 * a individual module and reuse it in other place of your project.
 */
const client = new HttpClient({
    baseURL: 'https://example.com'
});

/**
 * PUT https://example.com/posts/1?category=2
 */
client.fetch({
    // The http request method, default is `GET`. Here we use `PUT`.
    method: 'PUT',
    // The url to request. It will be compiled before sending request.
    url: '/posts/{ postId }',
    // The data used to compile the url above.
    model: {
        postId: 1
    },
    // The data to be compiled to query string.
    query: {
        category: 2
    },
    // The request headers to set.
    headers: {
        'X-My-Custom-Header': 'value'
    },
    // The body of the http request.
    body: {
        // Send JSON data to the server. The request content type will
        // be set to `application/json; charset=UTF-8` and the data
        // will be converted to a JSON string automaticly.
        // For more details, please read the descriptions of the
        // option called `body` and `httpRequestBodyProcessor`.
        json: {
            title: 'Using HttpClient.js',
            content: '...'
        }
    }
}).then(response => {
    return response.json();
}).then(data => {
    console.log(data);
}).catch(error => {
    console.error(error);
});
```

## Default request options

```js
{
    /**
     * The http request method.
     */
    method: 'GET',

    /**
     * The base url.
     */
    baseURL: '',

    /**
     * The url to request. If the url is a relative url and the base url is not empty,
     * the `baseURL` will be prepended to the `url`. The `url` and `baseURL` can contain
     * placeholders like `{ post.id }`, which will be replaced by the corresponding value
     * in the option called `model`.
     */
    url: '',

    /**
     * The data used to compile the request url.
     */
    model: null,

    /**
     * The data used to compile to query string.
     */
    query: null,

    /**
     * The http request headers to set.
     */
    headers: null,

    /**
     * The body of the http request. `body` is a simple plain object that contains only
     * one property, like `json` or `form`. The property name is used to find a http
     * request body processor in the option called `httpRequestBodyProcessor`.
     * The processor we found will be used to process the value of the property,
     * and add smome extra headers to the request if needed.
     * We provide three default http request body processors.
     * json - convert the data to JSON string (application/json; charset=UTF-8).
     * form - convert the data to form-urlencoded (application/x-www-form-urlencoded; charset=UTF-8).
     * raw - the data will not be processed and no extra headers will be added.
     * For more details, please read the description of `httpRequestBodyProcessor`.
     */
    body: null,

    /**
     * The maximum time (in millisecond) to wait for the response. If the request not
     * finished in the given time, an error (`ERR_TIMEOUT`) will be thrown. If the timeout
     * is less than or equal to zero, no timeout will be set.
     */
    timeout: 0,

    /**
     * The default timeout when sending JSONP requests. If the `timeout` is less than or equal to
     * zero this value will be used as `timeout`. So, if you want to disable timeout when sending
     * JSONP requests (NOT recommended), you should set `timeout` and `jsonpDefaultTimeout` to zero.
     */
    jsonpDefaultTimeout: 60000,

    /**
     * If `cors` is set to `true`, the `withCredentials` property of the `XMLHttpRequest` instance
     * will be set to `true` when sending http requests.
     */
    cors: false,

    /**
     * Whether to disable cache. If this value is set to `true`, the headers defined in
     * `noCacheHeaders` will be added to the request headers.
     */
    noCache: false,

    /**
     * The headers to be added to the request headers when `noCache` is set to `true`.
     */
    noCacheHeaders: {
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
    },

    /**
     * The url search param name that used to hold the callback name when sending JSONP requests.
     */
    jsonp: 'callback',

    /**
     * The namespace reserved for the users who want extend the library. The library itself will
     * not use this field.
     */
    settings: {},

    /**
     * The cancel controller that be used to cancel requests when using promise API. If you are
     * using callback API, this property is ignored and will be set to `null` forcely.
     */
    controller: null,

    /**
     * The name of the function that you are using to send requests. The value is set internally,
     * which can be `send`, `fetch`, `getJSONP` or `fetchJSONP`.
     */
    requestFunctionName: null,

    /**
     * The type of the request, can be `HTTP_REQUEST` or `JSONP_REQUEST`. The value is set
     * internally.
     */
    requestType: null,

    /**
     * The object contains the properties that will be set to the `XMLHttpRequest` instance.
     */
    xhrProps: null,

    /**
     * The username to use when call `XMLHttpRequest#open()`.
     */
    username: null,

    /**
     * The password to use when call `XMLHttpRequest#open()`.
     */
    password: null,

    /**
     * The object to hold http request body processors.
     */
    httpRequestBodyProcessor: {
        /**
         * The built-in processor `raw`. This processor process the request body by not
         * processing it. You can use this processor when you want to send `FormData`,
         * `ArrayBuffer`, `Blob` or anything that do not need to be processed.
         */
        raw: {
            /**
             * The higher the number, the higher the priority.
             */
            priority: 0,
            /**
             * No extra headers will be added when using `raw` processor.
             */
            headers: null,
            /**
             * The data will not be transformed when using `raw` processor.
             */
            processor: null
        },
        /**
         * The built-in processor `form`. This processor will transform the request body
         * (an object) to the `form-urlencoded` string and set the request header
         * `Content-Type` to `application/x-www-form-urlencoded; charset=UTF-8`.
         * You can change the charset by overwrite the headers of this processor.
         */
        form: {
            /**
             * The higher the number, the higher the priority.
             */
            priority: 1,
            /**
             * The extra headers to be added when using `form` processor.
             */
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
            },
            /**
             * The function used to process the request body.
             *
             * @param {Object.<string, *>} data The data to be processed.
             * @param {RequestOptions} options The request options.
             * @returns {string} Returns the processed data that will send to the server.
             */
            processor: function (data, options) {
                // encodeQueryString = require('x-query-string/encode')
                return encodeQueryString(data);
            }
        },
        /**
         * The built-in processor `json`. This processor will transform the request body
         * (an object) to a JSON string and set the header `Content-Type` to
         * `application/json; charset=UTF-8`. You can change the charset by overwrite the
         * headers of this processor.
         */
        json: {
            /**
             * The higher the number, the higher the priority.
             */
            priority: 2,
            /**
             * The extra headers to be added when using `json` processor.
             */
            headers: {
                'Content-Type': 'application/json; charset=UTF-8'
            },
            /**
             * The function used to process the request body.
             *
             * @param {Object.<string, *>} data The data to be processed.
             * @param {RequestOptions} options The request options.
             * @returns {string} Returns the processed data that will send to the server.
             */
            processor: function (data, options) {
                return JSON.stringify(data);
            }
        }
    },

    /**
     * The object to hold the mixins of the http response.
     */
    httpResponseMixin: {
        /**
         * The mixin function to parse the http response body as JSON string.
         *
         * @throws {SyntaxError} Throws error on parsing failed.
         * @returns {any} Returns the parsed data.
         */
        json: function () {
            var responseText = this.request.xhr.responseText;
            return responseText ? JSON.parse(responseText) : null;
        },
        /**
         * The mixin function to retrive the text of the response body.
         *
         * @returns {string} Returns the response text.
         */
        text: function () {
            return this.request.xhr.responseText;
        },
        /**
         * The mixin function to retrive the response status.
         *
         * @returns {number} Returns the response status.
         */
        status: function () {
            return this.request.xhr.status;
        }
    },

    /**
     * The object to hold the mixins of the jsonp response.
     */
    jsonpResponseMixin: {
        /**
         * The function to retrive the response JSON of JSONP request.
         *
         * @returns {any} Returns the response JSON.
         */
        json: function () {
            return this.request.responseJSON;
        }
    },

    /**
     * The object to hold the mixins of the http response error.
     */
    httpResponseErrorMixin: null,

    /**
     * The object to hold the mixins of the JSONP response error.
     */
    jsonpResponseErrorMixin: null,

    /**
     * The function to handle the request options. If this function is set,
     * it will be called before we using the request options.
     *
     * @param {RequestOptions} options The request options
     * @returns {void} The return value is ignored.
     */
    handleOptions: null,

    /**
     * The function to create an instance of `XMLHttpRequest`.
     *
     * @param {RequestOptions} options The request options.
     * @returns {XMLHttpRequest} Returns an instance of `XMLHttpRequest`.
     */
    createXHR: function (options) {
        return new XMLHttpRequest();
    },

    /**
     * The function to create the script element when sending JSONP request.
     *
     * @param {RequestOptions} options The request options.
     * @returns {HTMLScriptElement} Returns a script element.
     */
    createScript: function (options) {
        var script = document.createElement('script');

        script.setAttribute('type', 'text/javascript');
        script.setAttribute('charset', 'utf-8');

        return script;
    },

    /**
     * The function get the element that will be used to inject the script
     * element when sending JSONP request.
     *
     * @param {RequestOptions} options The request options.
     * @returns {HTMLElement} Returns an HTML element.
     */
    jsonpContainerNode: function (options) {
        return document.head || document.getElementsByName('head')[0];
    },

    /**
     * The function to create a unique callback name when sending JSONP request.
     *
     * @param {RequestOptions} options The request options.
     * @returns {string} Returns a string that will be used as JSONP callback name.
     */
    jsonpCallbackName: function (options) {
        return 'jsonp_' + uuid() + '_' + (new Date().getTime());
    },

    /**
     * The function to compile the URL.
     *
     * @param {string} url The url string to be compiled (with baseURL prepended if needed).
     * @param {Object.<string, *>} model The data used to compile the url.
     * @param {RequestOptions} options The request options.
     * @returns {string} Returns the compiled url.
     */
    compileURL: function (url, model, options) {
        return template(url, model);
    },

    /**
     * The function to encode the query string.
     *
     * @param {Object.<string, *>} query The data to be compiled to query string.
     * @param {RequestOptions} options The request options.
     * @returns {string} Returns the compiled query string.
     */
    encodeQueryString: function (query, options) {
        // encodeQueryString = require('x-query-string/encode')
        return encodeQueryString(query);
    },

    /**
     * The callback on `XMLHttpRequest` instance created.
     *
     * @param {XMLHttpRequest} xhr The created `XMLHttpRequest` instance.
     * @param {RequestOptions} options The request options.
     * @returns {void} The reutrn value is ignored.
     */
    onXhrCreated: null,

    /**
     * The callback on `XMLHttpRequest` opened.
     *
     * @param {XMLHttpRequest} xhr The `XMLHttpRequest` instance.
     * @param {RequestOptions} options The request options.
     * @returns {void} The reutrn value is ignored.
     */
    onXhrOpened: null,

    /**
     * The callback on `XMLHttpRequest` sent.
     *
     * @param {XMLHttpRequest} xhr The `XMLHttpRequest` instance.
     * @param {RequestOptions} options The request options.
     * @returns {void} The reutrn value is ignored.
     */
    onXhrSent: null,

    /**
     * The callback on request created.
     *
     * @param {HttpRequest|JSONPRequest} request The current request.
     * @returns {void} The reutrn value is ignored.
     */
    onRequestCreated: null,

    /**
     * The function to check whether the repsonse is ok.
     *
     * @param {string} requestType The request type, can be `HTTP_REQUEST` or `JSONP_REQUEST`.
     * @param {HttpResponse|JSONPResponse} response The response object.
     * @returns {boolean} Returns `truthy` on response is ok, otherwise returns `falsy`.
     */
    isResponseOk: function (requestType, response) {
        var isOk;
        var status;

        // Http request.
        if (requestType === HTTP_REQUEST) {
            status = +response.request.xhr.status;
            isOk = (status >= 200 && status < 300) || status === 304;
        // JSONP request.
        } else {
            isOk = true;
        }

        return isOk;
    },

    /**
     * The function to transform the response error. If it is `null` or not a function,
     * the response error will not be transformed.
     *
     * @param {string} requestType The request type, can be `HTTP_REQUEST` or `JSONP_REQUEST`.
     * @param {HttpResponseError|JSONPResponseError} error The response error object.
     * @returns {any} The return value of this function will be used as response error.
     */
    transformError: null,

    /**
     * The function to transform the response. If it is `null` or not a function, the
     * response will not be transformed.
     *
     * @param {string} requestType The request type, can be `HTTP_REQUEST` or `JSONP_REQUEST`.
     * @param {HttpResponse|JSONPResponse} response The response object.
     * @returns {any} The return value of this function will be used as response.
     */
    transformResponse: null,

    /**
     * The function to check whether to call the error callback on an error happend. If it is
     * `null` or not a function, the error callback will be called. If it is a function and
     * the function returns a `falsy` value the error callback will not be called. Otherwise
     * the error callback will be called.
     *
     * @param {string} requestType The request type, can be `HTTP_REQUEST` or `JSONP_REQUEST`.
     * @param {any} transformedError The transformed error (by `transformError`).
     * @param {HttpResponseError|JSONPResponseError} error The original response error.
     * @returns {boolean} Returns `truthy` to call the error callback.
     */
    shouldCallErrorCallback: null,

    /**
     * The function to check whether to call the success callback on request success. If it is
     * `null` or not a function, the success callback will be called. If it is a function and
     * the function returns a `falsy` value the success callback will not be called. Otherwise
     * the success callback will be called.
     *
     * @param {string} requestType The request type, can be `HTTP_REQUEST` or `JSONP_REQUEST`.
     * @param {any} transformedResponse The transformed response (by `transformResponse`).
     * @param {HttpResponse|JSONPResponse} response The original response.
     * @returns {boolean} Returns `truthy` to call the success callback.
     */
    shouldCallSuccessCallback: null
}
```
