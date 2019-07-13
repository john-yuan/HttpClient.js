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
 * 创建一个实例，并传入默认配置（最好将此实例单独保存在一个模块中，供整个项目使用）。
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
    // 请求方法，默认是 `GET`，此处指定为 `PUT`。
    method: 'PUT',

    // 请求地址，可以为相对地址，也可以为绝对地址。如果为相对地址，且 `baseURL` 是一个字符串，
    // 则会自动添加 `baseURL`。可以在请求地址中添加占位符（使用 `{}`），发送请求前 url 会
    // 被编译成完整的请求地址。
    url: '/posts/{ post.id }',

    // 用于编译 url 的数据，此处的 id 会替换 url 中的 `{ post.id }`。
    model: {
        post: {
            id: 1234
        }
    },

    // 请求地址中的查询字符串，这里的数据会被编译为 categoryId=1 并被添加到 url 中。
    query: {
        categoryId: 1
    },

    // 经过以上配置之后，最终编译出来的请求地址为：
    // https://example.com/posts/1234?categoryId=1

    // 自定义请求头。
    headers: {
        'X-My-Custom-Header': 'testing'
    },

    // 请求体（body）中包含的数据。
    body: {
        // json 这个键名表示我们需要发送的数据格式为 JSON。我们会根据 json 这个关键字找
        // 到 JSON 的请求数据预处理程序。JSON 预处理程序会将数据转换为 JSON 字符串，并
        // 将请求头里的 `Content-Type` 设置为 `application/json; charset=UTF-8`
        //（可配置）。预置的请求数据预处理程序有 JSON（json）、FORM 表单（form）、和原
        // 始数据（raw），我们不会对原始数据（raw）做任何处理。
        // P.S: 你可以重写、删除预置的请求数据预处理程序，也可以添加新的请求数据预处理程序。
        json: {
            title: 'Try HttpClient.js'
        }
    }
}).then(response => {
    // 读取返回的数据（假定返回的内容是一个合法的 JSON 字符串）。
    const data = response.json();
}).catch(error => {
    // 打印错误信息
    console.error(error);
});
```

## 默认配置

```js
{
    // HTTP 请求方法，默认 `GET`。
    method: 'GET',

    // URL 路径前缀，当 `url` 为相对路径时使用，默认为空。
    baseURL: null,

    // 请求地址，可以包含占位符 `{}`，在发送前此 `url` 会被编译。
    url: null,

    // 用于编译 `url` 的数据。
    model: null,

    // 用于编译查询字符串的数据。
    query: null,

    // 自定义请求头。
    headers: null,

    // 需要发送的数据，是一个普通对象，其中的数据键名用于指定请求数据的类型，在发送数据前我们
    // 会根据这个键名找到配置好的请求数据处理程序来处理这个数据。默认的请求数据处理程序有：
    // json - 处理 JSON 数据（application/json; charset=UTF-8）
    // form - 处理 FORM 表单数据（application/x-www-form-urlencoded; charset=UTF-8）
    // raw - 原始数据，不做任何处理
    body: null,

    // 预留的设置配置对象，内部不会使用这个属性里面包含的任何值，供用户定制的时候使用。
    settings: {},

    // 在使用 `fetch` 和 `fetchJSONP` 发送请求时，指定用于取消请求的 `CancelController`。
    // 此配置在使用 `send` 和 `sendJSONP` 发送请求时无效，且会被强制设置为 `null`。
    controller: null,

    // 此属性的值为内部设置，用户传入的任何值都将被丢弃，这值用来标识发送这个请求时使用的方法，
    // 可能的值为 `fetch`，`fetchJSONP`，`send` 和 `getJSONP`。
    requestFunctionName: null,

    // TODO...
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
}
```

## 未完待续...
