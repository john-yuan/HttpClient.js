# HttpClient.js

[![npm version](https://img.shields.io/npm/v/x-http-client.svg)](https://www.npmjs.com/package/x-http-client)

一个致力于简化网络请求的工具，既支持 HTTP 请求，也支持 JSONP 请求，同时提供 Promise 和回调函数风格的接口。本工具简化了请求参数的封装过程，并提供了非常灵活的配置选项，使得你可以根据项目的实际需要快速定制一个项目专属的网络请求工具。

## 功能

* 支持 HTTP 请求和 JSONP 请求；
* 支持取消请求、超时设定、禁用缓存等；
* 支持路径变量编译、查询字符串编译及自定义请求头等；
* 可配置的请求数据预处理程序（预置的处理程序有 JSON、FORM 表单、原始数据）；
* 可配置的请求错误判定程序、响应数据转换程序及错误转换程序；
* 可配置的请求响应解析程序；
* 丰富灵活的配置选项；

## 安装

```sh
npm i x-http-client
```

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

## 默认配置

```js
{
    /**
     * 发送 HTTP 请求时使用的方法，默认为 `GET`
     */
    method: 'GET',

    /**
     * URL 路径前缀，当 `url` 为相对路径时使用，默认为空
     */
    baseURL: null,

    /**
     * 请求地址，可以包含占位符 `{}`，在发送前此 `url` 会被编译
     */
    url: null,

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
     * raw - 原始数据，不做任何处理
     */
    body: null,

    /**
     * 超时设置，单位为毫秒，默认为 0，表示不设置定时器
     */
    timeout: 0,

    /**
     * 是否开启跨域（默认为 `false`）：
     * 1. 如果为 HTTP 请求，且设置为 `true`，会将 `xhr.withCredentials` 的属性设置为 `true`
     * 2. 如果为 JSONP 请求，且设置为 `true`，会将 `script` 标签的 `crossorigin` 属性 设置为
     * `use-credentials`
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
            // @return {any} 发送到服务端的数据（请求 body）
            processor: function (data, options) {
                return QS.encode(data);
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
            // @return {any} 发送到服务端的数据（请求 body）
            processor: function (data, options) {
                return JSON.stringify(data);
            }
        }
    },

    /**
     * HTTP 响应解析程序
     */
    httpResponseParser: {
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
     * JSONP 响应解析程序
     */
    jsonpResponseParser: {
        // 添加一个 `json` 函数，当调用 `response.json()` 时返回服务端返回的 JSON 数据
        json: function () {
            return this.request.responseJSON;
        }
    },

    /**
     * HTTP 响应错误解析程序，默认为 `null`
     */
    httpResponseErrorParser: null,

    /**
     * JSONP 响应错误解析程序，默认为 `null`
     */
    jsonpResponseErrorParser: null,

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
     * @param {Object.<string, *>} model 用来编译查询字符串的数据对象
     * @param {RequestOptions} options 当前配置信息
     * @returns {string} 返回编译完成的查询字符串
     */
    encodeQueryString: function (query, options) {
        return QS.encode(query);
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

## 未完待续...
