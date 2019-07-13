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

## 未完待续...
