---
title: 'viat_gql 脚本'
description: '在 PostgreSQL、MySQL、SQLite 上执行带范围约束的 GraphQL。'
doc_id: script.viat_gql
verified_release: '1.1.0'
channel: stable
---

# viat_gql 脚本

`viat_gql` 通过 Viat 引擎直接向数据库执行 GraphQL。必须恰好声明一个 `postgresql`、`mysql` 或 `sqlite` 资源。**不支持 SQL Server**（[SQL](sql.md) 支持）。它不是 GraphQL 资源代理，没有 `main` 或 `ctx`。

## 完整最小查询

前置条件：隔离 PostgreSQL 资源 `db`，表 `doc_items(id integer primary key, name text not null)`，一行 `(7,'fixture')`。只在一次性数据库通过资源查询工具或迁移流程创建固定数据。资源 GraphQL 暴露/overlay 和 scope 规则必须允许此表和调用者。

保存 `scripts/gql_item.graphql`：

```graphql
# @resource db
query Item($id: Int!) {
  doc_items(where: {id: {_eq: $id}}, limit: 1) {
    id
    name
  }
}
```

```bash
viat script create --name gql_item --language viat_gql --file scripts/gql_item.graphql
viat script run gql_item --args '{"id":7}'
viat script update gql_item --file scripts/gql_item.graphql
```

调用者可见该行时，预期正文 `{"doc_items":[{"id":7,"name":"fixture"}]}`。不可见可能返回空列表，不允许的操作可能被拒绝。这是满足前置条件即可运行的示例，不代表每个资源都有 `doc_items`。本文未创建或查询固定数据。需项目编辑/运行、数据库和 scope 权限。

## 文档语法与 Schema

表成为查询字段，外键成为关系。使用 GraphQL selection set、变量声明和类型值，不是 SQL 文本。列表常用 `where`、`order_by`、`limit`、`offset`；谓词使用生成 Schema 支持的 `_eq`、`_in`、`_and`、`_or` 等操作符。关系、聚合、mutation、distinct/分页和方言标量取决于内省 Schema 和资源 overlay，不是任意 SQL 透传。小型有界端点应只选必要列，显式设置 limit/order。

请求参数成为变量，结果为 `data` 本身，不是 data/errors 信封。数据库 Schema 会内省并缓存，DDL 后刷新：

```bash
viat resource refresh db
```

这与**脚本 I/O Schema 提取**不同，后者目前**不支持** viat_gql。即使数据库引擎有类型化 GraphQL Schema，保存脚本仍产生开放 Schema 和警告。不能宣称已提取端点参数校验。应在隔离资源上验证真实查询和变量错误。

## 有界形状变量：`@choices` 与 `@optional`

二者是 **GraphQL 变量定义指令**，不是注释头或通用模板。默认变量可填 `_eq`、`_in`、`_is_null`、limit/offset 等值位置，不能自由改变 `order_by: $sort` 这样的已编译 SQL 形状。

- `@choices(values: [...])` 声明有限 JSON/GraphQL 值列表，每项编译一个形状；请求超出列表为 400 变量错误。多个 choices 相乘，最多 256 种形状。没有隐式列表或自动排序白名单。
- `@optional` 无参数，变量必须可空，且作为合取（隐式 AND 或 `_and`）内比较的**完整操作数**。显式 null 删除该比较；缺失仍报错，除非文档提供 `= null` 等默认值。拒绝用于 `_or`/`_not`，以免删谓词改变过滤/授权含义。也适用 `_is_null`：true 选空值、false 非空、null 删除测试。
- 可组合：choices 约束非空值，optional 增加丢弃比较的 null 形状。Optional 已用 null 表示删除时，不要再把 null 放 choices。不能据此假设任意自定义指令可用。

现有 doc_items 固定表可用以下完整替代文档，sort 只接受 `[{id: "asc"}]` 或 `[{id: "desc"}]`，name 必须传入但可显式 null：

```graphql
# @resource db
query ($sort: [doc_items_order_by!]! @choices(values: [[{id: asc}], [{id: desc}]]), $name: String @optional) {
  doc_items(where: {name: {_eq: $name}}, order_by: $sort, limit: 20) { id name }
}
```

输入 `{"sort":[{"id":"asc"}],"name":null}` 不加 name 比较，返回固定行；name 为 other 则空列表。直接 `_eq: null` 不是替代，应按需求用 `_is_null` 或 optional。这些注解也不会让脚本 Schema 提取变为受支持。

## 写入与拒绝

生成 Schema 可提供 insert/update/delete 与 returning，因此 viat_gql **并非天生只读**。只读视图/表及 overlay 可拒绝写，scope 同样约束写入行。仅在隔离固定表、身份获准时，可用：

```graphql
# @resource db
mutation ($name: String!) {
  update_doc_items(where: {id: {_eq: 7}}, _set: {name: $name}) {
    returning { id name }
  }
}
```

输入 `{"name":"changed"}` 返回 id 7、name changed 的 returning 行；执行即真实修改。之后仅显式恢复自己的固定行。缺声明变量是调用者错误；文档错误、未知字段、深度超限为脚本错误；违反 scope 的写入可为 403。不能把所有空列表都当授权失败，也不要把数据库内部诊断发给调用者。

## 授权与方言边界

资源 GraphQL scope policy 和 authz 表绑定按调用者身份执行，不使用绕过权限的服务身份。缺失身份字段会省略，不会凭空补 null；策略需要无法提供的字段时可拒绝/失败。关系和 mutation 同样受行范围约束；声明资源不等于允许暴露所有表。通过引擎/broker 使用时数据库认证由平台处理，不应复制到查询文本。

PostgreSQL/MySQL/SQLite 的标量/操作符不同，不能把 PostgreSQL jsonb/timetz 规则套到另两者。拒绝 SQL Server 和远程 GraphQL 资源。引擎 Schema 校验、不支持结构、错误排序、结果/深度超限、scope 拒绝和数据库错误都会产生分类错误；超时使用执行预算。没有 tasks、subscription 或逐行增量流。

发布前分别测试允许与拒绝的身份。刷新后再查一次以识别过期内省。清理先取消发布并删一次性端点/脚本；只删除明确创建的固定行/表，不要删共享表。[测试](testing.md)说明草稿/发布差异；[资源](../resources/index.md)说明数据库、overlay、scope 配置。
