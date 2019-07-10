# HttpClient.js

[![npm version](https://img.shields.io/npm/v/x-http-client.svg)](https://www.npmjs.com/package/x-http-client)

HttpClient.js is a library that aims to make it easier to send data to the server and to parse the data returned by the
server in the browsers. It provides both Promise-style and Callback-style API and can be used to send http requests or
JSONP requests. It is highly configurable which make it very easy to extend the functionality of this library.

## Features

* Path variables compilation.
* Query string compilation.
* Request body processing (JSON, Form, Raw).
* Response content processing.
* Http requests and JSONP requests.
* Timeout and request cancellation.
* Promise-style and Callback-style API.

## Installation

```sh
npm i x-http-client
```

## Contents

* [HttpClient.js](#httpclientjs)
    * [Features](#features)
    * [Installation](#installation)
    * [Contents](#contents)
    * [Getting Started](#getting-started)
        * [1. Creating HttpClient instance](#1-creating-httpclient-instance)
        * [2. Sending HTTP requests](#2-sending-http-requests)
        * [3. Sending JSONP requests](#3-sending-jsonp-requests)
        * [4. Using Promise](#4-using-promise)
    * [Classes](#classes)
        * [HttpClient](#httpclient)
    * [Default Request Options](#default-request-options)

## Getting Started

### 1. Creating HttpClient instance

Sending requests with HttpClient.js is really easy. The first thing we should do is to create an instance of
`HttpClient`. When using HttpClient.js, the best practice is to save the configured `HttpClient` instance in
a single module, and reuse that instance many times.

```js
var HttpClient = require('x-http-client');
var client = new HttpClient({
    baseURL: 'https://api.example.com',
});
```

The signature of this `HttpClient` constructor is:

```js
/**
 * @class
 * @param {RequestOptions} [defaultOptions] The default request options.
 * @param {HandleOptionsFunction} [handleOptions] The function to handle the mereged default options.
 */
HttpClient([defaultOptions, [handleOptions]]);
```

### 2. Sending HTTP requests

After creating the `HttpClient` instance, now we can use that instance to send http requests. In the following example,
we are going to send an HTTP `PUT` request to the server.

```js
/**
 * @type {HttpRequest} The return value of `send(...)` is an instance of `HttpRequest`.
 */
var request = client.send({
    // PUT https://api.example.com/posts/1?category=javascript
    method: 'PUT',
    url: '/posts/{postId}',
    param: {
        postId: 1
    },
    query: {
        category: 'javascript'
    },
    headers: {
        'X-My-Custom-Header': 'header-value'
    },
    body: {
        // The property name `json` here tells the library that the type
        // of the data we are going to send to the server is JSON.
        // That means we should use `JSON.stringify(data)` to encode the
        // data before sending it to the server, and set the request
        // header `Content-Type` to `application/json; charset=UTF-8`.
        // The library will use the name `json` to find a request body
        // processor in the `options.httpRequestBodyProcessor` and use
        // that processor to process the data and set request headers.
        // The library provides three processors. They are `json`, `form`
        // and `raw`. You can rewrite them, delete them or add a new one
        // by merge your options to the default options.
        json: {
            title: 'Introducing HttpClient.js',
            content: 'The content of the post...'
        }
    }
}, function (response) {
    var data = response.json();
    console.log(data);
}, function (error) {
    console.log(error.message);
});
```

### 3. Sending JSONP requests

You can also use HttpClient instance to send a JSONP request.

```js
/**
 * @type {JSONPRequest} The return value of `getJSONP(...)` is an instance of `JSONPRequest`.
 */
var request = client.getJSONP({
    url: '/dictionary/search',
    query: {
        word: 'javascript'
    },
    timeout: 6000
}, function (response) {
    var data = response.json();
    console.log(data);
}, function (error) {
    console.log(error.message);
});
```

### 4. Using Promise

If you prefer the Promise-style API, just change the method name from `send` to `fetch`, `getJSONP` to `fetchJSONP`.

```js
// Sending HTTP request with Promise-style API:
client.fetch({
    // PUT https://api.example.com/posts/1?category=javascript
    method: 'PUT',
    url: '/posts/{postId}',
    param: {
        postId: 1
    },
    query: {
        category: 'javascript'
    },
    headers: {
        'X-My-Custom-Header': 'header-value'
    },
    body: {
        json: {
            title: 'Introducing HttpClient.js',
            content: 'The content of the post...'
        }
    }
}).then(function (response) {
    var data = response.json();
    console.log(data);
}).catch(function (error) {
    console.log(error.message);
});

// Sending JSONP request with Promise-style API:
client.fetchJSONP({
    url: '/dictionary/search',
    query: {
        word: 'javascript'
    },
    timeout: 6000
}).then(function (response) {
    var data = response.json();
    console.log(data);
}).catch(function (error) {
    console.log(error.message);
});
```

## Default Request Options

```js
{
    // The http request method. The default method is `GET`.
    method: 'GET',

    // The request base url. If the `url` is relative url, and the `baseURL` is not `null`,
    // the `baseURL` will be prepend to the `url`.
    baseURL: null,

    // The request url that can contain any number of placeholders, and will be compiled with
    // the data that passed in with `options.param`.
    url: null,

    // The data used to compile the request url.
    param: null,

    // The data that will be compiled to query string.
    query: null,

    // The object that contains the headers to set when sending the request.
    // Only the non-undefined and non-null headers are set.
    headers: null,

    // The object that contains the content which will be send to the server. This object
    // has only one property. The name of the property is the content type of the content,
    // which will be used to find a processor in `options.httpRequestBodyProcessor`.
    // The processor is used to process the value of the property. The processed value
    // which the processor returns will be send to the server as the request body.
    body: null,

    // The object to keep the extra information that the user passed in. The library itself
    // will not touch this property. You can use this property to hold any information that
    // you want, when you extend the functionality of your own instance of `HttpClient`.
    // The default value of this property is an empty object.
    extra: {},

    // The `CancelController` used to cancel the request. It only works when using `fetch`
    // or `fetchJSONP` to send request. If the you send request using `send` or `getJSONP`,
    // the `options.controller` will be set to `null`.
    controller: null,

    // The name of the function that send the request. Can be `send`, `fetch`, `getJSONP`,
    // `fetchJSONP`. This value is set by the library, don't change it.
    requestFunctionName: null,

    // The request type of this request. The value of it is set by the library itself,
    // can be `HTTP_REQUEST` or `JSONP_REQUEST`. Any other value the user passed in is
    // ignored. You can use this property to get the type of the current request.
    requestType: null,

    // Whether to set `withCredentials` property of the `XMLHttpRequest` to `true`.
    // The default value is `false`.
    cors: false,

    // The object that contains the properties to set on the instance of the `XMLHttpRequest`.
    xhrProps: null,

    // The user name to use for authentication purposes. The defualt value is `null`.
    username: null,

    // The password to use for authentication purposes. The defualt value is `null`.
    password: null,

    // The number of milliseconds the request can take before it finished. If the timeout
    // value is `0`, no timer will be set. If the request does not finsihed within the given
    // time, a timeout error will be thrown. The default value is `0`.
    timeout: 0,

    // Whether to disable the cache. If the value is `true`, the headers in
    // `options.noCacheHeaders` will be set. The default value is `false`.
    noCache: false,

    // The headers to set when `options.noCache` is set to `true`.
    noCacheHeaders: {
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
    },

    // The query string key to hold the value of the callback name when sending JSONP request.
    // The default values is `callback`.
    jsonp: 'callback',

    // The object that contains the http request body processors.
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

    // The object that contains the http response parsers.
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

    // The object that contains the jsonp response parsers.
    jsonpResponseParser: {
        json: function () {
            return this.request.responseJSON;
        }
    },

    // The object that contains the http response error parsers.
    httpResponseErrorParser: null,

    // The object that contains the jsonp response error parsers.
    jsonpResponseErrorParser: null,

    // The function to handle the options.
    handleOptions: null,

    // The function to create the `XMLHttpRequest` instance.
    createXHR: function (options) {
        return new XMLHttpRequest();
    },

    // The function to create the `HTMLScriptElement` instance.
    createScript: function (options) {
        var script = document.createElement('script');

        script.setAttribute('type', 'text/javascript');
        script.setAttribute('charset', 'utf-8');

        return script;
    },

    // The function that returns the container node, which will be used to append the
    // script element when sending jsonp request.
    jsonpContainerNode: function (options) {
        return document.head || document.getElementsByName('head')[0];
    },

    // The function to generate the unique callback name when sending jsonp request.
    jsonpCallbackName: function (options) {
        return 'jsonp_' + uuid() + '_' + (new Date().getTime());
    },

    // The function to compile url.
    compileURL: function (url, param, options) {
        return template(url, param);
    },

    // The function to encode the query string.
    encodeQueryString: function (data, options) {
        return QS.encode(data);
    },

    // The function to call on xhr created.
    onXhrCreated: null,

    // The functon to call on xhr opened.
    onXhrOpened: null,

    // The function to call on xhr sent.
    onXhrSent: null,

    // The function to call on request created.
    onRequestCreated: null,

    // The function to check whether the response is ok.
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

    // The function to transfrom the response error.
    // The return value of this function will be passed to the `onerror` callback.
    transformError: null,

    // The function to transfrom the response.
    // The return value of this function will be passed to the `onsuccess` callback.
    transformResponse: null,

    // The function to check whether to call the error callback.
    shouldCallErrorCallback: null,

    // The function to check whether to call the success callback.
    shouldCallSuccessCallback: null
}
```
