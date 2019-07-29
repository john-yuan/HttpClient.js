# HttpClient.js

An http client to simplify sending requests (Http & JSONP) in the browser.

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
    url: 'posts/{ postId }',
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
     * HTTP 请求数据处理程序
     */
    httpRequestBodyProcessor: {
        // 原始数据
        raw: {
            // 数值越大优先级越高
            priority: 0,
            // 不添加任何请求头
            headers: null,
            // 原始数据不做处理
            processor: null
        },
        // FORM 表单数据
        form: {
            // 数值越大优先级越高
            priority: 1,
            // 添加 FORM 表单数据头部信息
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
            },
            // 序列化表单数据
            // @param {any} data 需要处理的数据
            // @param {RequestOptions} options 当前请求的配置信息
            // @returns {any} 发送到服务端的数据（请求 body）
            processor: function (data, options) {
                // encodeQueryString = require('x-query-string/encode')
                return encodeQueryString(data);
            }
        },
        // JSON 数据
        json: {
            // 数值越大优先级越高
            priority: 2,
            // 添加 JSON 数据头部信息
            headers: {
                'Content-Type': 'application/json; charset=UTF-8'
            },
            // 序列化 JSON 数据
            // @param {any} data 需要处理的数据
            // @param {RequestOptions} options 当前请求的配置信息
            // @returns {any} 发送到服务端的数据（请求 body）
            processor: function (data, options) {
                return JSON.stringify(data);
            }
        }
    },

    /**
     * HTTP 响应 Mixin
     */
    httpResponseMixin: {
        // 添加一个 `json` 函数，用于解析 JSON 数据，当调用 `response.json()` 时返回
        // 解析完成的 JSON 数据。解析失败（非法的 JSON 字符串）时会抛出错误
        json: function () {
            var responseText = this.request.xhr.responseText;
            return responseText ? JSON.parse(responseText) : null;
        },
        // 添加一个 `text` 函数，当调用 `response.text()` 时返回服务端返回的文本数据
        text: function () {
            return this.request.xhr.responseText;
        },
        // 添加一个 `status` 函数，当调用 `response.status()` 时返回服务端返回的状态码
        status: function () {
            return this.request.xhr.status;
        }
    },

    /**
     * JSONP 响应 Mixin
     */
    jsonpResponseMixin: {
        // 添加一个 `json` 函数，当调用 `response.json()` 时返回服务端返回的 JSON 数据
        json: function () {
            return this.request.responseJSON;
        }
    },

    /**
     * HTTP 响应错误 Mixin，默认为 `null`
     */
    httpResponseErrorMixin: null,

    /**
     * JSONP 响应错误 Mixin，默认为 `null`
     */
    jsonpResponseErrorMixin: null,

    /**
     * 用于处理当前请求配置的函数
     *
     * @param {RequestOptions} options 当前配置信息
     * @returns {void} 返回值将被忽略
     */
    handleOptions: null,

    /**
     * 发送 HTTP 请求时，用于创建 `XMLHttpRequest` 对象的函数
     *
     * @param {RequestOptions} options 当前配置信息
     * @returns {XMLHttpRequest} 返回一个 `XHR` 实例
     */
    createXHR: function (options) {
        return new XMLHttpRequest();
    },

    /**
     * 发送 JSONP 请求时，用于创建 script 节点的函数
     *
     * @param {RequestOptions} options 当前配置信息
     * @returns {HTMLScriptElement} 返回一个 script 节点
     */
    createScript: function (options) {
        var script = document.createElement('script');

        script.setAttribute('type', 'text/javascript');
        script.setAttribute('charset', 'utf-8');

        return script;
    },

    /**
     * 发送 JSONP 请求时，用于注入 script 节点的容器节点
     *
     * @param {RequestOptions} options 当前配置信息
     * @returns {HTMLElement} 返回一个 DOM 节点
     */
    jsonpContainerNode: function (options) {
        return document.head || document.getElementsByName('head')[0];
    },

    /**
     * 发送 JSONP 请求时，用于创建回调函数名称的函数
     *
     * @param {RequestOptions} options 当前配置信息
     * @returns {string} 返回一个合法 JavaScript 函数名称
     */
    jsonpCallbackName: function (options) {
        return 'jsonp_' + uuid() + '_' + (new Date().getTime());
    },

    /**
     * 用于编译 URL 的函数
     *
     * @param {string} url 需要编译的 URL
     * @param {Object.<string, *>} model 用来编译 URL 的数据对象
     * @param {RequestOptions} options 当前配置信息
     * @returns {string} 返回编译完成的 URL
     */
    compileURL: function (url, model, options) {
        return template(url, model);
    },

    /**
     * 用于编译查询字符串的函数
     *
     * @param {Object.<string, *>} query 用来编译查询字符串的数据对象
     * @param {RequestOptions} options 当前配置信息
     * @returns {string} 返回编译完成的查询字符串
     */
    encodeQueryString: function (query, options) {
        // encodeQueryString = require('x-query-string/encode')
        return encodeQueryString(query);
    },

    /**
     * `XHR` 创建完成回调
     *
     * @param {XMLHttpRequest} xhr `XHR` 实例
     * @param {RequestOptions} options 当前配置信息
     * @returns {void}
     */
    onXhrCreated: null,

    /**
     * `XHR` 打开回调
     *
     * @param {XMLHttpRequest} xhr `XHR` 实例
     * @param {RequestOptions} options 当前配置信息
     * @returns {void}
     */
    onXhrOpened: null,

    /**
     * `XHR` 发送回调
     *
     * @param {XMLHttpRequest} xhr `XHR` 实例
     * @param {RequestOptions} options 当前配置信息
     * @returns {void}
     */
    onXhrSent: null,

    /**
     * 请求创建完成回调
     *
     * @param {HttpRequest|JSONPRequest} request 当前请求对象
     * @returns {void}
     */
    onRequestCreated: null,

    /**
     * 用于检测请求返回结果是否正确的函数
     *
     * @param {string} requestType 请求类型，可能值为 `HTTP_REQUEST` 或 `JSONP_REQUEST`
     * @param {HttpResponse|JSONPResponse} response 请求响应
     * @returns {boolean} 请求正确时返回真值（truthy），出错时返回假值（falsy）
     */
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

    /**
     * 用于转换错误对象的函数，如果此函数被设置为 `null`，则不会转换错误对象
     *
     * @param {string} requestType 请求类型，可能值为 `HTTP_REQUEST` 或 `JSONP_REQUEST`
     * @param {HttpResponseError|JSONPResponseError} error 错误对象
     * @returns {any} 返回的任何值都会被当做新的错误对象
     */
    transformError: null,

    /**
     * 用于转换请求响应的函数，如果此函数被设置为 `null`，则不会转换请求响应
     *
     * @param {string} requestType 请求类型，可能值为 `HTTP_REQUEST` 或 `JSONP_REQUEST`
     * @param {HttpResponse|JSONPResponse} response 请求响应
     * @returns {any} 返回的任何值都会被当做新的请求响应
     */
    transformResponse: null,

    /**
     * 一个用于判断是否需要调用错误回调的函数，如果此函数返回一个假值（falsy），则错误回调将永
     * 远不会被调用，如果这个函数被设置为 `null`，默认会调用错误回调
     *
     * @param {string} requestType 请求类型，可能值为 `HTTP_REQUEST` 或 `JSONP_REQUEST`
     * @param {any} transformedError 已转换的错误对象
     * @param {HttpResponseError|JSONPResponseError} error 原始的错误对象
     * @returns {boolean} 如果返回一个真值，则会调用错误回调，否则，错误回调不会被调用
     */
    shouldCallErrorCallback: null,

    /**
     * 一个用于判断是否需要调用成功回调的函数，如果此函数返回一个假值（falsy），则成功回调将永
     * 远不会被调用，如果这个函数被设置为 `null`，默认会调用成功回调
     *
     * @param {string} requestType 请求类型，可能值为 `HTTP_REQUEST` 或 `JSONP_REQUEST`
     * @param {any} transformedError 已转换的请求响应对象
     * @param {HttpResponse|JSONPResponse} error 原始的请求响应对象
     * @returns {boolean} 如果返回一个真值，则会调用成功回调，否则，成功回调不会被调用
     */
    shouldCallSuccessCallback: null
}
```
