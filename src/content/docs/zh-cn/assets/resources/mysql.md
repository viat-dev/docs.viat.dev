---
title: "MySQL 资源"
description: "通过原生 SQL、平台代理事务、viat_gql 和 CRUD 访问 MySQL/MariaDB 业务数据。只内省配置的一个数据库，不继承 PostgreSQL 的多 schema 或审计能力。"
doc_id: resource.mysql
verified_release: '1.1.0'
channel: stable
contract_ids: [resource.mysql]
---

# MySQL 资源

通过原生 SQL、平台代理事务、viat_gql 和 CRUD 访问 MySQL/MariaDB 业务数据。只内省配置的一个数据库，不继承 PostgreSQL 的多 schema 或审计能力。

本页核对 Viat 1.1.0 稳定版。示例使用合成值/服务桩，未执行、未连接真实服务、未发送消息。先读[资源总览](index.md)。

## 前置条件与权限

准备数据库及仅有所需 SELECT/写入/DDL 权限的账号，并允许所有 API 节点访问。ssl:true 时需要支持 TLS 的服务。

## 完整配置字段

表中“必填”描述结构解析；提供方/后端的条件必填、运行时默认及限制在下节补充。`null` 仅在类型明确允许时可用，数字格式的存储上限不等于有意义的业务范围。不要依赖未知键被忽略来检测拼写。

### `plain`

| 字段 | 类型/允许值 | 必填 | 省略默认 | 约束 | 含义 |
| --- | --- | --- | --- | --- | --- |
| `plain.authz_tables` | map<string, AuthzTableBinding> | 否；可能条件必填 | `{}` | — | 暴露表 → 授权类型或 {type,actions}，有绑定的引擎拒绝未绑定表。 |
| `plain.database` | string | 是 | — | — | 目标业务数据库，不是平台数据库。 |
| `plain.graphql_overlay` | string / null | 否；可能条件必填 | 无显式默认；见规则 | — | 数据库 GraphQL 引擎的 TOML 覆盖层，不是 GraphQL 请求。 |
| `plain.host` | string | 是 | — | — | 服务主机名/IP，不是 URL 或凭据。 |
| `plain.port` | integer | 是 | — | minimum: 0; format: "uint16"; 0–65535 | TCP 端口，必填时须显式提供，TLS 不会推导端口。 |
| `plain.ssl` | boolean | 否；可能条件必填 | `false` | — | 存储的 TLS 偏好，运行时版本限制见下文。 |

#### `AuthzTableBinding`

允许结构/值：`string / AuthzTableMapping`。

字符串是授权类型简写；对象使用下方 AuthzTableMapping。映射键为暴露表名，不是任意数据库限定名。

#### `AuthzTableMapping`

未知键会被拒绝。

| 字段 | 类型/允许值 | 必填 | 省略默认 | 约束 | 含义 |
| --- | --- | --- | --- | --- | --- |
| `AuthzTableMapping.actions` | map<string, string> | 否；可能条件必填 | `{}` | — | 隐含 read/create/update/delete → 模型操作名，未列项保留同名。 |
| `AuthzTableMapping.type` | string | 是 | — | — | 长形式表绑定中的授权模型类型名。 |

### `secret`

| 字段 | 类型/允许值 | 必填 | 省略默认 | 约束 | 含义 |
| --- | --- | --- | --- | --- | --- |
| `secret.password` | string | 是 | — | — | 账号密码/应用密码，不应作为明文配置。 |
| `secret.user` | string | 是 | — | — | 数据库登录用户，与 secret 一起加密。 |

## 运行规则、默认值与限制

host、database、secret.user 不得为空白。port 必填（通常 3306，但不会自动默认）。password 必须为字符串，服务允许时可为空。ssl 默认 false，false 选 Disabled，true 选 Preferred（并非 Required）。Preferred 可能回退明文，不保证严格 TLS 或证书验证。复制自 PostgreSQL 的 audit、graphql_schemas 会被明确拒绝。graphql_overlay 是可选 TOML，保存检查语法。authz_tables 的类型/操作映射与未绑定表拒绝规则同 PostgreSQL，只作用于 GraphQL/CRUD，不作用于原生 SQL。



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

**1.1.0 兼容/安全限制：** 本类型实际运行投影仍向 worker 注入含凭据连接 URL，虽然下列推荐操作由平台代理且不需要它。脚本及其依赖树应视为能接触该凭据。不要记录/返回整个资源，不要提取 URL 到应用代码；优先代理助手与最小上游权限。静态加密和 CRUD 掩码不能消除此 worker 暴露。

## 最小配置：管理 API / CLI 文件

下面是创建请求 JSON，同时也是合法 YAML，可作为 `resource.yaml` 交给真实 CLI 命令。域名/凭据均为测试值，生产使用前须替换并完成前置条件；不要把真实 secret 文件提交仓库。

```json
{
  "name": "demo",
  "folder": "",
  "kind": "mysql",
  "plain": {
    "host": "mysql.example.test",
    "port": 3306,
    "database": "demo",
    "ssl": true
  },
  "secret": {
    "user": "demo_reader",
    "password": "fixture-password-not-a-credential"
  }
}
```

```sh
viat project select <slug>
viat resource create --file resource.yaml
viat resource show demo --json
```

等价 API 为 `POST /projects/{slug}/resources`（相对实例管理 API 根），请求体如上。预期得到已保存资源的公开表示和掩码摘要，不是秘密回显；示例名已存在则 409。仓库同步时去掉 folder，把配置放 `resources/demo.yaml`；`viat push` 可同步完整 plain 及未被占位过滤的 secret。创建成功不保证每个远程动作成功。

## SDK 操作与示例

query(sql,params={}) 返回 {rows,affected}，execute 仅返回影响行数。Python transaction() 是上下文管理器，TypeScript transaction(async tx => …) 在回调成功时提交。两者均有 graphql(document,variables={})，tx 上也可用，并在同一事务内保留授权行级过滤。原生 query/execute 不执行这种过滤。命名 :参数 使用绑定，缺失值绑定 NULL，对象/列表绑定 JSON 文本。集合判断应使用 MySQL JSON 函数，而非 PostgreSQL 类型转换。语句失败会立即回滚并使代理事务失效。

这两个完整脚本均声明同一个根资源 demo；在获批准的测试运行中使用。写入、发送、构建和数据删除不是 dry-run。

### Python

```python
# @resource demo
from viat import ctx

def main():
    return ctx.resources.demo.query("SELECT :n AS answer", {"n": 42})
```

### TypeScript

```typescript
// @resource demo
import { ctx } from "viat";

export async function main() {
  return await ctx.resources.demo.query("SELECT :n AS answer", { n: 42 });
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
        ctx.resource("demo").call("sql_query", json!({"sql":"SELECT :n AS answer","params":{"n":42}}))
    });
}
```

Shell 没有方法装饰的 ctx.resources，仅有 JSON 环境投影；不能把上述方法名直接写成 shell 函数。binary 程序可按 worker 协议实现相应 RPC，并非自动拥有 Python/TypeScript 方法。sql 语言仅用于四种 SQL 数据源，viat_gql 仅用于 PostgreSQL/MySQL/SQLite，graphql 语言用于远程 graphql，llm 语言用于 llm；不支持的组合不会自动适配。

### 预期结果

SELECT 返回 answer=42 的一行，无需业务表。精确 decimal 可能以字符串返回，应核对 MySQL 列类型，不要假定所有数字都是 JavaScript number。

## Test 行为与副作用

按 TLS 配置建立单次连接并执行 SELECT 1，再执行 GraphQL 诊断。不会验证所有表的写权限。

管理 API 使用 `POST /projects/{slug}/resources/{name}/test?folder=`；CLI 为 `viat resource test demo`。API 检查响应体 `ok`：连接失败通常仍为 HTTP 200 `{ok:false,error:"…"}`，可能附 `schema_warnings`，不能只检查状态码。CLI 失败会非零退出。仅在允许出站/文件动作后执行。

## 常见失败与恢复

resource.mysql.empty_host/empty_database/empty_user 应补对应字段。resource.mysql.graphql_schemas_unsupported 应移除列表，每个数据库建独立资源。audit_unsupported_kind 应移除 audit。引擎 schema 错误应修正覆盖层/绑定后 refresh。数据库认证/TLS 错误应修正授权或证书。

管理错误一般为 `{error,message}`。DTO 的 `resource.<kind>.*` 经常位于 400 `bad_request` 的 message，而非顶层 error；不要把它们当成所有运行时助手都会返回的统一枚举。401 先恢复平台登录，403 检查有效项目角色/运行时规则，404 检查 folder/name，409 先解决同名或 `resource_in_use` 引用。远程拒绝与平台拒绝分开诊断，重试前判断上一次动作是否可能已生效。

## 生产注意与清理

事务保持短小，事务内操作均走 tx，不要调用外层资源。DDL 后用 viat resource refresh demo。删除资源不会删除数据库或撤销登录，备份与轮换需单独处理。

通用删除步骤：先停用调用脚本、代理/CRUD 目标及相关触发器，迁移依赖并保留需要的证据，再用 `viat resource delete demo` 或 DELETE 详情路由。409 `resource_in_use` 时先重新绑定/删除消息指出的端点，不应强行绕过引用。删除配置资产不等于撤销第三方凭据、删除外部数据或回滚已发生副作用。

## 相关资源与维护依据

- [PostgreSQL 资源](postgresql.md)
- [SQLite 资源](sqlite.md)
- [SQL Server 资源](sqlserver.md)
- [资源总览](index.md)

固定契约：`contracts/1.1.0/resources.json` → `resource.mysql`。

核对实现（产品仓库相对路径）：viat-core/src/types/resource.rs (KindSpec/Plain/Secret); viat-api/src/dto.rs (normalization/validation); viat-api/src/handlers/resources.rs (CRUD/Test); viat-runtime/src/resource_io.rs, resources_json.rs, python.rs, typescript.rs; viat-api/src/runner/broker.rs; viat-cli/src/main.rs and repo/resources.rs; viat-core/src/types/snapshot.rs.
