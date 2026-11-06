---
title: 'GraphQL 脚本'
description: '向上游 GraphQL 资源传入变量并选择操作。'
doc_id: script.graphql
verified_release: '1.1.0'
channel: stable
---

# GraphQL 脚本

`graphql` 将文档发送到**上游 GraphQL 服务器**，不同于通过 Viat 引擎查询数据库的 [viat_gql](viat_gql.md)。必须恰好声明一个 `graphql` 资源。URL、请求头、认证和 TLS/代理策略由资源配置持有，优先使用它而不是把 HTTP 凭证写入源码。没有解释器、main 或 `ctx`。

## 完整最小文档

隔离固定服务需提供 `Query.hello(name: String!): String!`，输入 `name: "Ada"` 返回 `Hello, Ada`。配置 `upstream` 资源指向该服务，保存 `scripts/gql_hello.graphql`：

```graphql
# @resource upstream
query Hello($name: String!) {
  hello(name: $name)
}
```

```bash
viat script create --name gql_hello --language graphql --file scripts/gql_hello.graphql
viat script run gql_hello --args '{"name":"Ada"}'
viat script update gql_hello --file scripts/gql_hello.graphql
```

预期正文 `{"hello":"Hello, Ada"}`，**不是** `{"data":...}`。服务和资源是前置条件，不是内置功能。本文没有调用真实服务。需项目编辑/运行和上游权限。[测试](testing.md)说明离线 GraphQL cassette、端点发布与清理。

## 变量与操作选择

正文为标准 query/mutation 文档，请求参数作为变量。多个操作时 `__operation` 选择上游操作名：

```bash
viat script run gql_hello --args '{"name":"Ada","__operation":"Hello"}'
```

优先每个资产一个操作：提取器只取第一个，多个时警告，不会按运行时 `__operation` 切换。Int/Float/String/ID/Boolean 和列表映射输入 Schema；无默认值的 non-null 必填，声明 GraphQL 默认值后可省略。自定义 scalar/enum/input object 不展开。GraphQL 文档默认值由上游应用，不是模板语言。没有 `{{...}}` 或 SQL 占位符语法。

## 输出、失败与预算

运行器仅返回响应的 `data`。上游 `errors` 数组只要非空就失败，即使有部分 data，也不能当成功。非成功 HTTP 状态、JSON 错误、网络失败和超时也会失败。静态提取输出描述 data/errors 信封，**不是**实际运行输出契约，需验证真实结果。

`# timeout: N` 受部署上限约束。不提供原生 subscription 传输、`ViatStream`、tasks 或资源 helper。分支、多次请求、工具调用和流式请用 Python/TypeScript。Mutation 有真实副作用，不能假定自动重试安全。Caller_token 认证需要真实调用凭证，排队/延后执行不保留它。

验证固定服务收到的 variables/operationName 和返回 data 对象。先用隔离只读服务，检查错误但不记录上游凭证，明确发布后再公开。删除 `gql_hello` 前先取消发布并删除一次性端点；删脚本不会删除上游数据。
