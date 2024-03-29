# HttpClient.js

[![npm version](https://img.shields.io/npm/v/x-http-client.svg)](https://www.npmjs.com/package/x-http-client)
[![Build Status](https://travis-ci.org/john-yuan/HttpClient.js.svg?branch=master)](https://travis-ci.org/john-yuan/HttpClient.js)
[![install size](https://packagephobia.now.sh/badge?p=x-http-client)](https://packagephobia.now.sh/result?p=x-http-client)
[![npm downloads](https://img.shields.io/npm/dm/x-http-client.svg)](http://npm-stat.com/charts.html?package=x-http-client)

一个致力于简化网络请求的工具，既支持 HTTP 请求，也支持 JSONP 请求，同时提供 Promise 和回调函数风格的接口。本工具简化了请求参数的封装过程，并提供了非常灵活的配置选项，使得你可以根据项目的实际需要快速定制一个项目专属的网络请求工具。

[Click here to read the English version of this document](./README.md)

## 功能

* 支持 HTTP 请求和 JSONP 请求；
* 支持取消请求、超时设定、禁用缓存等；
* 支持路径变量编译、查询字符串编译及自定义请求头等；
* 可配置的请求数据预处理程序（预置的处理程序有 JSON、FORM 表单、原始数据）；
* 可配置的请求错误判定程序、响应数据转换程序及错误转换程序；
* 可配置的请求响应 Mixin；
* 丰富灵活的配置选项；

## 安装

```sh
npm i x-http-client
```

## 目录

* [HttpClient.js](#httpclientjs)
    * [功能](#功能)
    * [安装](#安装)
    * [目录](#目录)
    * [示例](#示例)
    * [HttpClient](#httpclient)
        * [new HttpClient(\[defaults, \[handleDefaults, \[handleRequestOptions\]\]\])](#new-httpclientdefaults-handledefaults-handlerequestoptions)
        * [client.fetch(options)](#clientfetchoptions)
        * [client.send(options, \[onsucess, \[onerror\]\])](#clientsendoptions-onsucess-onerror)
        * [client.fetchJSONP(options)](#clientfetchjsonpoptions)
        * [client.getJSONP(options, \[onsucess, \[onerror\]\])](#clientgetjsonpoptions-onsucess-onerror)
        * [client.copyOptions()](#clientcopyoptions)
        * [client.mergeOptions(options)](#clientmergeoptionsoptions)
    * [默认配置](#默认配置)

## 示例

```js
import HttpClient from 'x-http-client';

/**
 * 创建一个实例，并传入默认配置（最好将此实例单独保存在一个模块中，供整个项目使用）
 */
const client = new HttpClient({
    baseURL: 'https://example.com'
});

/**
 * 发送一个 PUT 请求并返回一个 Promise，假设接口定义为：
 *
 * PUT https://example.com/posts/{id}?categoryId={categoryId}
 */
client.fetch({
    // 请求方法，默认是 `GET`，此处指定为 `PUT`
    method: 'PUT',

    // 请求地址，可以为相对地址，也可以为绝对地址。如果为相对地址，且 `baseURL` 是一个字符串，
    // 则会自动添加 `baseURL`。可以在请求地址中添加占位符（使用 `{}`），发送请求前 url 会
    // 被编译成完整的请求地址
    url: '/posts/{ post.id }',

    // 用于编译 url 的数据，此处的 id 会替换 url 中的 `{ post.id }`
    model: {
        post: {
            id: 1234
        }
    },

    // 请求地址中的查询字符串，这里的数据会被编译为 categoryId=1 并被添加到 url 中
    query: {
        categoryId: 1
    },

    // 经过以上配置之后，最终编译出来的请求地址为：
    // https://example.com/posts/1234?categoryId=1

    // 自定义请求头
    headers: {
        'X-My-Custom-Header': 'testing'
    },

    // 请求体（body）中包含的数据
    body: {
        // json 这个键名表示我们需要发送的数据格式为 JSON。我们会根据 json 这个关键字找
        // 到 JSON 的请求数据预处理程序。JSON 预处理程序会将数据转换为 JSON 字符串，并
        // 将请求头里的 `Content-Type` 设置为 `application/json; charset=UTF-8`
        //（可配置）。预置的请求数据预处理程序有 JSON（json）、FORM 表单（form）、和原
        // 始数据（raw），我们不会对原始数据（raw）做任何处理
        // P.S: 你可以重写、删除预置的请求数据预处理程序，也可以添加新的请求数据预处理程序
        json: {
            title: 'Try HttpClient.js'
        }
    }
}).then(response => {
    // 读取返回的数据（假定返回的内容是一个合法的 JSON 字符串）
    const data = response.json();
}).catch(error => {
    // 打印错误信息
    console.error(error);
});
```

## HttpClient

### new HttpClient([defaults, [handleDefaults, [handleRequestOptions]]])

* `defaults` {RequestOptions} （可选）默认的请求配置信息
* `handleDefaults` {HandleOptionsFunction} （可选）一个用于处理默认配置的函数，该函数的参数为默认配置对象，调用方可在函数内修改该配置对象的属性，此函数的返回值会被自动忽略
* `handleRequestOptions` {HandleOptionsFunction} （可选）一个用于处理请求配置的函数，每次发送请求时使用的请求配置对象都会被传递到这个函数进行处理，调用方可在函数内修改该配置对象的属性，此函数的返回值会被自动忽略

### client.fetch(options)

* `options` {RequestOptions} 请求配置信息
* Returns: {Promise<HttpResponse>} 返回一个 `Promise` 对象，该 `Promise` 决议时，参数为一个 `HttpResponse` 实例或是经过 `transformResponse` 转换后的数据，拒绝时参数为一个 `HttpResponseError` 实例或是经过 `transformError` 转换后的数据

### client.send(options, [onsucess, [onerror]])

* `options` {RequestOptions} 请求配置信息
* `onsucess` {RequestSuccessCallback} （可选）请求成功回调函数，参数为一个 `HttpResponse` 实例或是经过 `transformResponse` 转换后的数据
* `onerror` {RequestErrorCallback} （可选）请求失败回调函数，参数为一个 `HttpResponseError` 实例或是经过 `transformError` 转换后的数据
* Returns: {HttpRequest} 返回一个 `HttpRequest` 对象

### client.fetchJSONP(options)

* `options` {RequestOptions} 请求配置信息
* Returns: {Promise<JSONPResponse>} 返回一个 `Promise` 对象，该 `Promise` 决议时，参数为一个 `JSONPResponse` 实例或是经过 `transformResponse` 转换后的数据，拒绝时参数为一个 `JSONPResponseError` 实例或是经过 `transformError` 转换后的数据

### client.getJSONP(options, [onsucess, [onerror]])

* `options` {RequestOptions} 请求配置信息
* `onsucess` {RequestSuccessCallback} （可选）请求成功回调函数，参数为一个 `JSONPResponse` 实例或是经过 `transformResponse` 转换后的数据
* `onerror` {RequestErrorCallback} （可选）请求失败回调函数，参数为一个 `JSONPResponseError` 实例或是经过 `transformError` 转换后的数据
* Returns: {JSONPRequest} 返回一个 `JSONPRequest` 对象

### client.copyOptions()

* Returns: {RequestOptions} 返回一个当前 `HttpClient` 对象使用的默认请求配置信息的副本

此方法用于复制一个当前 `HttpClient` 对象使用的默认请求配置信息。_注意，此方法仅存在于该实例上，不存在于 `HttpClient` 的原型链上。_


### client.mergeOptions(options)

* `options` {RequestOptions} 请求配置信息
* Returns: {RequestOptions} 返回一个合并后的请求配置信息对象

此方法用于将给定的请求配置信息合并到一个当前 `HttpClient` 对象使用的默认请求配置信息的副本中，并将该副本返回。此副本在返回前会经过 `handleRequestOptions` 函数的处理。_注意，此方法仅存在于该实例上，不存在于 `HttpClient` 的原型链上。_

## 默认配置

```js
{
    /**
     * 发送 HTTP 请求时使用的方法，默认为 `GET`
     */
    method: 'GET',

    /**
     * URL 路径前缀，当 `url` 为相对路径时使用，默认为空字符串
     */
    baseURL: '',

    /**
     * 请求地址，可以包含占位符 `{}`，在发送前此 `url` 会被编译，默认为空字符串
     */
    url: '',

    /**
     * 用于编译 `url` 的数据
     */
    model: null,

    /**
     * 用于编译查询字符串的数据
     */
    query: null,

    /**
     * 自定义请求头
     */
    headers: null,

    /**
     * 需要发送的数据，是一个普通对象，其中的数据键名用于指定请求数据的类型，在发送数据前我们
     * 会根据这个键名找到配置好的请求数据处理程序来处理这个数据。默认的请求数据处理程序有：
     * json - 处理 JSON 数据（application/json; charset=UTF-8）
     * form - 处理 FORM 表单数据（application/x-www-form-urlencoded; charset=UTF-8）
     * raw - 原始数据，不做任何处理，比如 FormData、ArrayBuffer、Blob 等
     */
    body: null,

    /**
     * 超时设置，单位为毫秒，默认为 0，表示不设置定时器
     */
    timeout: 0,

    /**
     * 发送 JSONP 请求时的默认超时时间，即当 timeout 小于等于 0 时，这个值会被当做
     * timeout 使用。如果想禁用 JSONP 定时器（不推荐），需要将 jsonpDefaultTimeout
     * 和 timeout 都设置为 0
     */
    jsonpDefaultTimeout: 60000,

    /**
     * 如果这个值被设置为 `true`，则 `xhr.withCredentials` 的值也会被设置为 `true`
     */
    cors: false,

    /**
     * 是否禁用缓存，默认为 `false`
     */
    noCache: false,

    /**
     * `noCache` 被设置为 `true` 时，需要设置的请求的头
     */
    noCacheHeaders: {
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
    },

    /**
     * 发送 JSONP 请求时，用于携带回调函数名称的 url 参数名，默认为 `callback`
     */
    jsonp: 'callback',

    /**
     * 预留的设置配置对象，内部不会使用这个属性里面包含的任何值，供用户定制的时候使用
     */
    settings: {},

    /**
     * 在使用 `fetch` 和 `fetchJSONP` 发送请求时，指定用于取消请求的 `CancelController`
     * 此配置在使用 `send` 和 `sendJSONP` 发送请求时无效，且会被强制设置为 `null`
     */
    controller: null,

    /**
     * 此属性的值为内部设置，用户传入的任何值都将被丢弃，这值用来标识发送这个请求时使用的方法，
     * 可能的值为 `fetch`，`fetchJSONP`，`send` 和 `getJSONP`
     */
    requestFunctionName: null,

    /**
     * 请求类型，值为一个字符串 `HTTP_REQUEST` 或者 `JSONP_REQUEST`，这个值由内部设定，
     * 用户传入的任何值都会被覆盖
     */
    requestType: null,

    /**
     * 一个对象，里面的键值对都会设置到 `XHR` 对象上
     */
    xhrProps: null,

    /**
     * `XHR` 认证时使用的用户名
     */
    username: null,

    /**
     * `XHR` 认证时使用的密码
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
     * @param {any} transformedResponse 已转换的请求响应对象
     * @param {HttpResponse|JSONPResponse} response 原始的请求响应对象
     * @returns {boolean} 如果返回一个真值，则会调用成功回调，否则，成功回调不会被调用
     */
    shouldCallSuccessCallback: null
}
```

## 未完待续...
