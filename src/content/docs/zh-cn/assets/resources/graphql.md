---
title: "GraphQL 上游资源"
description: "调用现有远程 GraphQL HTTP 端点并返回 data 对象，即使 HTTP 200 也会在 GraphQL errors 时抛错。这不是 Viat 的数据库 viat_gql 引擎；该引擎属于 postgresql/mysql/sqlite 资源。"
doc_id: resource.graphql
verified_release: '1.1.0'
channel: stable
contract_ids: [resource.graphql]
---

# GraphQL 上游资源

调用现有远程 GraphQL HTTP 端点并返回 data 对象，即使 HTTP 200 也会在 GraphQL errors 时抛错。这不是 Viat 的数据库 viat_gql 引擎；该引擎属于 postgresql/mysql/sqlite 资源。

本页核对 Viat 1.1.0 稳定版。示例使用合成值/服务桩，未执行、未连接真实服务、未发送消息。先读[资源总览](index.md)。

## 前置条件与权限

准备上游 schema/账号，并允许 API 节点通过所需网络/代理访问。caller_token 要求同步调用者携带可用凭据。viat_identity 要求启用项目 IdP、已验证的项目用户和上游 JWT 校验器。

## 完整配置字段

表中“必填”描述结构解析；提供方/后端的条件必填、运行时默认及限制在下节补充。`null` 仅在类型明确允许时可用，数字格式的存储上限不等于有意义的业务范围。不要依赖未知键被忽略来检测拼写。

### `plain`

| 字段 | 类型/允许值 | 必填 | 省略默认 | 约束 | 含义 |
| --- | --- | --- | --- | --- | --- |
| `plain.auth_type` | GraphQlAuthType | 否；可能条件必填 | `"token"` | — | 认证方式选择，不是授权规则。 |
| `plain.endpoint` | string | 是 | — | — | 配置的服务端点，base/操作 URL 和规范化规则依类型而定。 |
| `plain.headers` | map<string, string> | 否；可能条件必填 | `{}` | — | 每查询字符串头，原始值可读取/导出。 |
| `plain.identity_ttl_secs` | integer / null | 否；可能条件必填 | `null` | minimum: 0; format: "uint32"; 0–4294967295 | 签发身份 token 有效期，运行时默认 60 秒、上限 3600。 |
| `plain.proxy` | string / null | 否；可能条件必填 | `null` | — | 可选代理 URL，代理助手在平台侧应用，不要在 plain 内嵌密码。 |

#### `GraphQlAuthType`

允许结构/值：`"token" / "caller_token" / "viat_identity"`。

### `secret`

| 字段 | 类型/允许值 | 必填 | 省略默认 | 约束 | 含义 |
| --- | --- | --- | --- | --- | --- |
| `secret.auth_token` | string / null | 否；可能条件必填 | `null` | — | token 认证模式使用的可选已存 bearer。 |

## 运行规则、默认值与限制

endpoint 是绝对 HTTP(S) 操作 URL，不会自动追加 /graphql。auth_type 默认 token，将可选 secret.auth_token 作为 Bearer 发送，缺失/空值则不加 Authorization。caller_token 和 viat_identity 遵循 HTTP 的无调用者即拒绝规则。identity_ttl_secs 签发时默认 60，上限 3600。headers 明文存储，应使用完整值 "$secret:header_secret" 引用，不要放原始凭据或拼接字符串。代理由平台应用。DTO 检查 URL 和引用目标，不检查远程查询/schema。



## 权限、身份与保存语义

管理 API 需要平台登录及项目成员身份。列举/查看需要成员身份；创建、PUT、PATCH、Test、refresh、copy、delete 需要有效项目角色 Owner/Admin/Developer；较低权限的 operator 角色不可写。管理权限不自动赋予上游账号权限，也不替代运行时的 s3/file/行级授权。MCP 只开放其工具清单实际声明的能力，不能把资源 schema 当作完整 MCP CRUD。

- 创建：`POST /projects/{slug}/resources`，请求为 `{name,folder?,kind,plain,secret}`。name 长度 1–64 字节且不可含 /；system 为保留名。folder 省略/空字符串表示根，非空为 [A-Za-z0-9_-]+ 段，最多 8 层/255 字节，无首尾或连续 /。
- 资源身份为同项目 `(folder,name)`，不是全项目裸名。同名可以位于不同文件夹。详情路由用 `/resources/{name}?folder=team` 显式定位；CLI 用 `team/name`。脚本裸引用按自身文件夹、根、全项目唯一名顺序解析，建议跨文件夹显式限定，Python 用 `getattr(ctx.resources, "team/name")`，TypeScript 用 `ctx.resources["team/name"]`，而非属性链。
- PUT 是完整替换：须重发正确 kind、完整 plain 与全部要保留的秘密值，不能从 show 的掩码恢复秘密。PATCH 的 kind 固定；省略 plain 保留，提供 plain 则整体替换（不是深合并）；secret 仅逐字段覆盖，省略字段保留。移动 folder 时引用在新位置重检。
- 清除可选秘密用 PATCH 显式 null（仅允许 null 的字段）或空字符串（仅允许空值的字段）；必需/条件必需字段不能清空。清除可选 plain 字段需发送去掉该字段的完整 plain，让类型默认/缺省生效。不要用 null 代替所有类型，也不要把 *** 当作旧值。
- `$keep` 是仅 PATCH/仓库同步使用的**顶层 plain 字段**占位符，保留服务端已有同名字段，连数字/布尔也可保留；新资源/不存在字段不能使用。嵌套 `$keep` 不是深合并指令。
- 仓库文件 `resources/<folder>/<name>.yaml` 由路径承载 folder，name 仍是裸名。`viat pull` 将 secret 字段写为字符串 `$secret`；`viat push` 去掉这些占位（也接受旧 !secret 标签），对已有资源 PATCH，绝不把占位当凭据。新资源必须先安全提供实际必需秘密；占位不能创建凭据。顶层 allowed_authorizers 是仓库访问同步元数据，不要擅自塞进 plain。

`$secret` 占位与凭据引用不同：`{"$secret":"name"}` 在 config/cloud 支持位置命名另一个 secret 资源；HTTP/GraphQL 字符串头用整个 `"$secret:name"`。它们不等于秘密明文，保存/读取/导出保留引用，使用时解析。目标按消费资源文件夹锚定并须已存在且为 secret 类型，不能用字符串拼接插值。

公开响应含资源标识、kind、folder、plain 及秘密摘要，不返回秘密值；摘要 *** 表示该种类声明的字段，不证明每个可选凭据实际已填。plain 会原样可读/导出；secret 通过部署秘密后端加密。脚本/依赖的发布版本按快照规则冻结，uses 无 (live) 时亦冻结，不可把所有依赖描述为每次读 live；资源读取/代理操作和显式实时 secret IO 是不同边界。

## 脚本秘密边界

提供方凭据/私密材料由平台代理操作应用，不交给脚本助手。不可使用已移除的 r.secret/r.auth_headers 写法。plain 原始头/配置仍可见，应在支持位置使用引用。

## 最小配置：管理 API / CLI 文件

下面是创建请求 JSON，同时也是合法 YAML，可作为 `resource.yaml` 交给真实 CLI 命令。域名/凭据均为测试值，生产使用前须替换并完成前置条件；不要把真实 secret 文件提交仓库。

```json
{
  "name": "demo",
  "folder": "",
  "kind": "graphql",
  "plain": {
    "endpoint": "https://graphql-stub.example.test/graphql",
    "auth_type": "token",
    "headers": {}
  },
  "secret": {}
}
```

```sh
viat project select <slug>
viat resource create --file resource.yaml
viat resource show demo --json
```

等价 API 为 `POST /projects/{slug}/resources`（相对实例管理 API 根），请求体如上。预期得到已保存资源的公开表示和掩码摘要，不是秘密回显；示例名已存在则 409。仓库同步时去掉 folder，把配置放 `resources/demo.yaml`；`viat push` 可同步完整 plain 及未被占位过滤的 secret。创建成功不保证每个远程动作成功。

## SDK 操作与示例

Python 为 query(query,variables=None,operation=None)，TypeScript 为 query(query,variables={},operation=null)。多操作文档通过 operation 选择 operationName。结果是 data 本身，不是 {data,errors}。任何非空 errors 数组都会拒绝，不会悄悄返回部分 data。mutation 是真实副作用，不会自动重试。

这两个完整脚本均声明同一个根资源 demo；在获批准的测试运行中使用。写入、发送、构建和数据删除不是 dry-run。

### Python

```python
# @resource demo
from viat import ctx

def main():
    return ctx.resources.demo.query("query { __typename }")
```

### TypeScript

```typescript
// @resource demo
import { ctx } from "viat";

export async function main() {
  return await ctx.resources.demo.query("query { __typename }");
}
```

### Rust

Rust 的已验证表面是 `ctx.resource(name)` 的通用 `call(op,req)`（library 用 `ctx.library`）；不是照搬 Python 方法名。下面展示对应协议调用，返回原始操作结果，可能不同于上方复合示例。

```rust
// @resource demo
use serde_json::{json, Value};
use viat::{Ctx, Error};

fn main() {
    viat::serve(|ctx: &Ctx, _args: Value| -> Result<Value, Error> {
        ctx.resource("demo").call("graphql", json!({"query":"query { __typename }","variables":{}}))
    });
}
```

Shell 没有方法装饰的 ctx.resources，仅有 JSON 环境投影；不能把上述方法名直接写成 shell 函数。binary 程序可按 worker 协议实现相应 RPC，并非自动拥有 Python/TypeScript 方法。sql 语言仅用于四种 SQL 数据源，viat_gql 仅用于 PostgreSQL/MySQL/SQLite，graphql 语言用于远程 graphql，llm 语言用于 llm；不支持的组合不会自动适配。

### 预期结果

测试桩返回 {"data":{"__typename":"Query"}} 时，助手得到 {"__typename":"Query"}。若同时含非空 errors，即使有 data 也会抛错。

## Test 行为与副作用

带配置头和已存 bearer POST {__typename}，检查 HTTP、JSON 和 GraphQL 错误。不会合成 caller_token/viat_identity 主体，因此 Test 不能证明逐调用者授权正确。POST 会出站，但发送的是 query，不是有意的 mutation。

管理 API 使用 `POST /projects/{slug}/resources/{name}/test?folder=`；CLI 为 `viat resource test demo`。API 检查响应体 `ok`：连接失败通常仍为 HTTP 200 `{ok:false,error:"…"}`，可能附 `schema_warnings`，不能只检查状态码。CLI 失败会非零退出。仅在允许出站/文件动作后执行。

## 常见失败与恢复

resource.graphql.bad_url/empty_endpoint/bad_proxy_url 表示输入问题；HTTP 401/403 应修正上游认证；GraphQL errors 可表示查询校验、行策略或字段权限问题。resource.config.unknown_secret/not_a_secret 应修正头部秘密引用。部分数据被拒绝时应按失败处理，不能作为成功结果持久化。

管理错误一般为 `{error,message}`。DTO 的 `resource.<kind>.*` 经常位于 400 `bad_request` 的 message，而非顶层 error；不要把它们当成所有运行时助手都会返回的统一枚举。401 先恢复平台登录，403 检查有效项目角色/运行时规则，404 检查 folder/name，409 先解决同名或 `resource_in_use` 引用。远程拒绝与平台拒绝分开诊断，重试前判断上一次动作是否可能已生效。

## 生产注意与清理

对不可信值使用 GraphQL 变量，限制列表大小，不要在没有幂等保障时重试 mutation。删除资源不会删上游数据，也不会撤销其 token。

通用删除步骤：先停用调用脚本、代理/CRUD 目标及相关触发器，迁移依赖并保留需要的证据，再用 `viat resource delete demo` 或 DELETE 详情路由。409 `resource_in_use` 时先重新绑定/删除消息指出的端点，不应强行绕过引用。删除配置资产不等于撤销第三方凭据、删除外部数据或回滚已发生副作用。

## 相关资源与维护依据

- [HTTP API 资源](http_api.md)
- [PostgreSQL 资源](postgresql.md)
- [Secret 资源](secret.md)
- [资源总览](index.md)

固定契约：`contracts/1.1.0/resources.json` → `resource.graphql`。

核对实现（产品仓库相对路径）：viat-core/src/types/resource.rs (KindSpec/Plain/Secret); viat-api/src/dto.rs (normalization/validation); viat-api/src/handlers/resources.rs (CRUD/Test); viat-runtime/src/resource_io.rs, resources_json.rs, python.rs, typescript.rs; viat-api/src/runner/broker.rs; viat-cli/src/main.rs and repo/resources.rs; viat-core/src/types/snapshot.rs.
