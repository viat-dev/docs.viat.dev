---
title: "HTTP API 资源"
description: "固定上游 base URL、认证和请求头，供脚本 HTTP 助手和代理端点使用。请求由平台发出，不是可随意指定目的地的带凭据抓取器。GraphQL 错误处理应使用 graphql，云动作签名应使用 cloud_api。"
doc_id: resource.http_api
verified_release: '1.1.0'
channel: stable
contract_ids: [resource.http_api]
---

# HTTP API 资源

固定上游 base URL、认证和请求头，供脚本 HTTP 助手和代理端点使用。请求由平台发出，不是可随意指定目的地的带凭据抓取器。GraphQL 错误处理应使用 graphql，云动作签名应使用 cloud_api。

本页核对 Viat 1.1.0 稳定版。示例使用合成值/服务桩，未执行、未连接真实服务、未发送消息。先读[资源总览](index.md)。

## 前置条件与权限

允许 API 节点及所配代理出站访问，并准备最小权限的上游身份。身份断言要求启用项目身份提供方，上游还须验证项目 JWKS、正确的 issuer/audience 和有效期；勾选开关本身不会给上游用户授权。

## 完整配置字段

表中“必填”描述结构解析；提供方/后端的条件必填、运行时默认及限制在下节补充。`null` 仅在类型明确允许时可用，数字格式的存储上限不等于有意义的业务范围。不要依赖未知键被忽略来检测拼写。

### `plain`

| 字段 | 类型/允许值 | 必填 | 省略默认 | 约束 | 含义 |
| --- | --- | --- | --- | --- | --- |
| `plain.auth_type` | HttpAuthType | 是 | — | — | 认证方式选择，不是授权规则。 |
| `plain.base_url` | string | 是 | — | — | 配置的上游 base/传输覆盖地址，不是逐调用目的地。 |
| `plain.custom_headers` | map<string, string> | 否；可能条件必填 | `{}` | — | 每请求字符串头，凭据使用完整值 $secret: 引用。 |
| `plain.identity_assert` | boolean | 否；可能条件必填 | `false` | — | 仅代理使用的签名 X-Viat-Identity 断言。 |
| `plain.identity_forward_token` | boolean | 否；可能条件必填 | `false` | — | 仅代理转发原始外部 token。 |
| `plain.identity_ttl_secs` | integer / null | 否；可能条件必填 | `null` | minimum: 0; format: "uint32"; 0–4294967295 | 签发身份 token 有效期，运行时默认 60 秒、上限 3600。 |
| `plain.proxy` | string / null | 否；可能条件必填 | `null` | — | 可选代理 URL，代理助手在平台侧应用，不要在 plain 内嵌密码。 |

#### `HttpAuthType`

允许结构/值：`"none" / "bearer" / "basic" / "header_key" / "caller_token" / "viat_identity"`。

### `secret`

| 字段 | 类型/允许值 | 必填 | 省略默认 | 约束 | 含义 |
| --- | --- | --- | --- | --- | --- |
| `secret.header_name` | string / null | 否；可能条件必填 | `null` | — | header_key 的凭据头名称，存于 secret。 |
| `secret.password` | string / null | 否；可能条件必填 | `null` | — | 账号密码/应用密码，不应作为明文配置。 |
| `secret.token` | string / null | 否；可能条件必填 | `null` | — | 由 auth_type 选择的 bearer/header-key token。 |
| `secret.username` | string / null | 否；可能条件必填 | `null` | — | 账号名，可选/匿名规则随类型而异。 |

## 运行规则、默认值与限制

base_url 和 proxy 必须通过部署的出站 URL 限制。`auth_type` 必填：none；bearer 使用 secret.token；basic 使用 secret.username/password；header_key 使用 secret.header_name/token。DTO 未将这些可选秘密字段改为条件必填：凭据缺失或为空时不会生成对应认证头，因而保存成功不证明已认证。caller_token 借用原始调用者凭据，没有凭据的运行会失败。viat_identity 为已验证的项目用户主体签发 bearer，system 主体或未启用 IdP 时失败。`identity_ttl_secs` 运行时默认 60，上限 3600。

`identity_assert` 和 `identity_forward_token` 只影响代理。前者去除入站伪造断言后添加平台签名的 X-Viat-Identity；后者仅通过 X-Forwarded-Authorization 转发原始外部 JWT，绝不转发 Viat 会话/API key。两者不改变脚本助手调用。`custom_headers` 明文存储且可导出；凭据头应将整个值写成 `"$secret:vendor_key"`，完整请求头值存入对应 secret。`Bearer $secret:vendor_key` 这种插值无效。目标 secret 必须在保存前存在。

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
  "kind": "http_api",
  "plain": {
    "base_url": "https://api.example.test/v1",
    "auth_type": "none",
    "custom_headers": {
      "Accept": "application/json"
    }
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

Python 提供 request(method,path,query=None,headers=None,json=None,body=None,timeout=None,raw=False) 以及 get/post/put/patch/delete/head。TypeScript 使用 request(method,path,opts) 和同名动词，opts 含 query/headers/json/body/timeout/raw。JSON 响应解码为值，文本为字符串，raw 为 bytes/Uint8Array。4xx/5xx 会抛出 ViatError(upstream_error)，保留上游状态和有界响应详情。助手每次只发一个请求，分页和安全重试需显式实现。使用配置源站下的相对路径，凭据由平台应用。

这两个完整脚本均声明同一个根资源 demo；在获批准的测试运行中使用。写入、发送、构建和数据删除不是 dry-run。

### Python

```python
# @resource demo
from viat import ctx

def main():
    return ctx.resources.demo.get("/health", query={"verbose": "false"})
```

### TypeScript

```typescript
// @resource demo
import { ctx } from "viat";

export async function main() {
  return await ctx.resources.demo.get("/health", { query: { verbose: "false" } });
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
        ctx.resource("demo").call("http", json!({"method":"GET","path":"/health"}))
    });
}
```

Shell 没有方法装饰的 ctx.resources，仅有 JSON 环境投影；不能把上述方法名直接写成 shell 函数。binary 程序可按 worker 协议实现相应 RPC，并非自动拥有 Python/TypeScript 方法。sql 语言仅用于四种 SQL 数据源，viat_gql 仅用于 PostgreSQL/MySQL/SQLite，graphql 语言用于远程 graphql，llm 语言用于 llm；不支持的组合不会自动适配。

### 预期结果

当测试桩以 application/json 为 GET /v1/health 返回 {"ok":true} 时，两个助手均返回该对象；示例域名不是真实公共服务。

## Test 行为与副作用

向 base_url 真正发送 GET，带已存头、认证和代理，超时 5 秒。只有传输失败和 5xx 判失败，401/404/405 也可能得到 ok:true。Test 无调用者，caller_token/viat_identity 不带依赖运行的认证。base URL 应无害：GET 在上游也可能产生副作用。

管理 API 使用 `POST /projects/{slug}/resources/{name}/test?folder=`；CLI 为 `viat resource test demo`。API 检查响应体 `ok`：连接失败通常仍为 HTTP 200 `{ok:false,error:"…"}`，可能附 `schema_warnings`，不能只检查状态码。CLI 失败会非零退出。仅在允许出站/文件动作后执行。

## 常见失败与恢复

`upstream_error`：检查状态后修正上游认证、路径或限流，不要盲目重试写操作。出站拒绝应由运维批准目标，而非关闭校验。`resource.config.unknown_secret`/`not_a_secret`：在正确文件夹建立 secret 类型目标。无调用者凭据的运行应改用服务认证资源，而非 caller_token。

管理错误一般为 `{error,message}`。DTO 的 `resource.<kind>.*` 经常位于 400 `bad_request` 的 message，而非顶层 error；不要把它们当成所有运行时助手都会返回的统一枚举。401 先恢复平台登录，403 检查有效项目角色/运行时规则，404 检查 folder/name，409 先解决同名或 `resource_in_use` 引用。远程拒绝与平台拒绝分开诊断，重试前判断上一次动作是否可能已生效。

## 生产注意与清理

不要将凭据放入 base_url、代理 URL 用户信息或明文 custom_headers：plain 可读取、可导出。不要记录上游回显的敏感响应。删除资源不会撤销上游凭据；应移除代理/脚本引用并单独撤销身份。

通用删除步骤：先停用调用脚本、代理/CRUD 目标及相关触发器，迁移依赖并保留需要的证据，再用 `viat resource delete demo` 或 DELETE 详情路由。409 `resource_in_use` 时先重新绑定/删除消息指出的端点，不应强行绕过引用。删除配置资产不等于撤销第三方凭据、删除外部数据或回滚已发生副作用。

## 相关资源与维护依据

- [GraphQL 上游资源](graphql.md)
- [Cloud API 资源](cloud_api.md)
- [Secret 资源](secret.md)
- [资源总览](index.md)

固定契约：`contracts/1.1.0/resources.json` → `resource.http_api`。

核对实现（产品仓库相对路径）：viat-core/src/types/resource.rs (KindSpec/Plain/Secret); viat-api/src/dto.rs (normalization/validation); viat-api/src/handlers/resources.rs (CRUD/Test); viat-runtime/src/resource_io.rs, resources_json.rs, python.rs, typescript.rs; viat-api/src/runner/broker.rs; viat-cli/src/main.rs and repo/resources.rs; viat-core/src/types/snapshot.rs.
