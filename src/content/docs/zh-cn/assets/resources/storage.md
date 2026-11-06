---
title: "受管 Storage 资源"
description: "本地卷/S3 文件字节配合同项目 PostgreSQL 元数据，ID/键、所有者、策略和证据由平台管理。不同于原始 s3，不能用 MySQL/SQLite/平台数据库存元数据。"
doc_id: resource.storage
verified_release: '1.1.0'
channel: stable
contract_ids: [resource.storage]
---

# 受管 Storage 资源

本地卷/S3 文件字节配合同项目 PostgreSQL 元数据，ID/键、所有者、策略和证据由平台管理。不同于原始 s3，不能用 MySQL/SQLite/平台数据库存元数据。

本页核对 Viat 1.1.0 稳定版。示例使用合成值/服务桩，未执行、未连接真实服务、未发送消息。先读[资源总览](index.md)。

## 前置条件与权限

先建元数据 PostgreSQL，权限须可创建/协调表、索引和写行。本地需 VIAT_STORAGE_ROOTS 内可写挂载目录，S3 需桶/限范围凭据。配置项目 file 授权规则，owner 值本身不授予权限。

## 完整配置字段

表中“必填”描述结构解析；提供方/后端的条件必填、运行时默认及限制在下节补充。`null` 仅在类型明确允许时可用，数字格式的存储上限不等于有意义的业务范围。不要依赖未知键被忽略来检测拼写。

### `plain`

| 字段 | 类型/允许值 | 必填 | 省略默认 | 约束 | 含义 |
| --- | --- | --- | --- | --- | --- |
| `plain.allowed_types` | array&lt;string&gt; | 否；可能条件必填 | 无显式默认；见规则 | — | 允许的声明 MIME 类型，[] 表示任意，不是内容安全扫描。 |
| `plain.backend` | StorageBackend | 是 | — | — | 受管字节后端 local/s3，元数据始终为项目 PostgreSQL。 |
| `plain.bucket` | string / null | 否；可能条件必填 | 无显式默认；见规则 | — | 现有桶名，不是 URL/路径。 |
| `plain.endpoint` | string / null | 否；可能条件必填 | 无显式默认；见规则 | — | 配置的服务端点，base/操作 URL 和规范化规则依类型而定。 |
| `plain.max_file_bytes` | integer | 否；可能条件必填 | 无显式默认；见规则 | minimum: 0; format: "uint64"; 0–18446744073709551615 | 单文件上限，0 用部署上限，资源只能降低。 |
| `plain.metadata` | StorageMetadata | 是 | — | — | 保存受管文件行的项目 PostgreSQL 资源/表。 |
| `plain.path_style` | boolean | 否；可能条件必填 | 无显式默认；见规则 | — | 使用 endpoint/bucket/key，而非 bucket.endpoint/key。 |
| `plain.prefix` | string | 否；可能条件必填 | 无显式默认；见规则 | — | 相对后端键前缀，目录式用法应含末尾 /。 |
| `plain.region` | string / null | 否；可能条件必填 | 无显式默认；见规则 | — | 签名/操作区域，提供方规则可能要求必填。 |
| `plain.root` | string / null | 否；可能条件必填 | 无显式默认；见规则 | — | 运维允许根目录内的服务端绝对本地存储目录。 |

#### `StorageBackend`

允许结构/值：`"local" / "s3"`。

#### `StorageMetadata`

| 字段 | 类型/允许值 | 必填 | 省略默认 | 约束 | 含义 |
| --- | --- | --- | --- | --- | --- |
| `StorageMetadata.resource` | string | 是 | — | — | 按文件夹解析的资源引用，storage 元数据须指向 postgresql。 |
| `StorageMetadata.table` | string / null | 否；可能条件必填 | `"viat_files"` | — | 审计/元数据表名，运行时默认见下文。 |

### `secret`

| 字段 | 类型/允许值 | 必填 | 省略默认 | 约束 | 含义 |
| --- | --- | --- | --- | --- | --- |
| `secret.access_key` | string | 否；可能条件必填 | `""` | — | S3 兼容访问 key 标识。 |
| `secret.secret_key` | string | 否；可能条件必填 | `""` | — | S3 兼容签名秘密。 |
| `secret.session_token` | string / null | 否；可能条件必填 | `null` | — | 可选临时 STS token，到期前轮换，不自动刷新。 |

## 运行规则、默认值与限制

backend 必填 local 或 s3。local 要绝对 root 在 VIAT_STORAGE_ROOTS 内无父目录穿越，规范化清空 S3 字段/凭据；s3 要 bucket/region/access_key/secret_key 并清空 root。endpoint 同 s3 规范化，path_style 默认 false，session_token 可选不续期。prefix 默认空，相对且无 .. 或反斜杠，目录式前缀请带末尾 /，因为键直接拼接。metadata.resource 必填按文件夹解析，metadata.table 默认 viat_files，须简单 SQL 标识符。保存真正安装/协调元数据 DDL。

max_file_bytes 默认 0 = 部署 VIAT_STORAGE_MAX_FILE_BYTES（默认 100 MiB），资源只能降低。allowed_types [] 接受任意，条目裁剪转小写，检查声明 MIME 而非恶意软件。保存确保 file 授权/元数据审计集成，协调失败回退声明，但外部 DDL/证据仍为真实副作用。

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
  "kind": "storage",
  "plain": {
    "backend": "s3",
    "bucket": "demo-files",
    "region": "us-east-1",
    "endpoint": "https://s3-stub.example.test",
    "path_style": true,
    "prefix": "reference/",
    "metadata": {
      "resource": "metadata_db",
      "table": "viat_files"
    },
    "max_file_bytes": 1048576,
    "allowed_types": [
      "text/plain"
    ]
  },
  "secret": {
    "access_key": "fixture-access",
    "secret_key": "fixture-secret-not-a-credential"
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

Python store(pathOrUpload,key?,name?,content_type?,owner?,meta?) 返回行 {id,key,name,size,content_type,sha256,…}，replace(id,pathOrUpload,…) 保留 id/key；register(path,…) 仅本地 root/prefix 已就位字节。TS 用选项对象。get(id)、find(key)、list/list_page（TS listPage）返回文件/列表或 {files,next_cursor}，cursor 作为 before 传回。delete(id) 软删除元数据并移除字节。download(id,dest_path) 流式，read_range(id,start,length)（TS readRange）返回字节，受 VIAT_S3_HELPER_MAX_BYTES 限制（默认 8 MiB）。url(id,expires_secs=300,disposition?)（TS 选项）签发平台 bearer 下载链接，最长 7 天；presign(id,expires_secs=900) 仅 S3 桶直连 GET，返回 {url,expires_at}。读取策略在签发时检查，链接到期前为能力凭证。ctx.request.files 上传句柄可直接交 store，不暴露后端路径。

这两个完整脚本均声明同一个根资源 demo；在获批准的测试运行中使用。写入、发送、构建和数据删除不是 dry-run。

### Python

```python
# @resource demo
from viat import ctx

def main():
    return ctx.resources.demo.list_page(limit=5)
```

### TypeScript

```typescript
// @resource demo
import { ctx } from "viat";

export async function main() {
  return await ctx.resources.demo.listPage({ limit: 5 });
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
        ctx.resource("demo").call("storage", json!({"op":"list","limit":5}))
    });
}
```

Shell 没有方法装饰的 ctx.resources，仅有 JSON 环境投影；不能把上述方法名直接写成 shell 函数。binary 程序可按 worker 协议实现相应 RPC，并非自动拥有 Python/TypeScript 方法。sql 语言仅用于四种 SQL 数据源，viat_gql 仅用于 PostgreSQL/MySQL/SQLite，graphql 语言用于远程 graphql，llm 语言用于 llm；不支持的组合不会自动适配。

### 预期结果

先建同项目 postgresql 类型 metadata_db 并授权 file 读取。无受管行时 list-page 返回 {files:[],next_cursor:null}，不上传。store 会复制字节并写元数据/审计。

## Test 行为与副作用

本地写入/删除空 .viat-probe-* 文件（尽力清理），S3 发签名 ListObjectsV2 max-keys=1。保存还联系元数据 PostgreSQL 并创建/协调表、索引、审计，均非仅 schema dry-run。

管理 API 使用 `POST /projects/{slug}/resources/{name}/test?folder=`；CLI 为 `viat resource test demo`。API 检查响应体 `ok`：连接失败通常仍为 HTTP 200 `{ok:false,error:"…"}`，可能附 `schema_warnings`，不能只检查状态码。CLI 失败会非零退出。仅在允许出站/文件动作后执行。

## 常见失败与恢复

resource.storage.root_not_allowed/empty_root 修正挂载允许根，bad_prefix/bad_table 修正名称，empty_metadata_resource 填 PostgreSQL，missing_credentials/empty_bucket/empty_region 补 S3。forbidden 需 file 规则或数据库/桶授权，大小/类型拒绝需合规输入，不能绕过元数据。

管理错误一般为 `{error,message}`。DTO 的 `resource.<kind>.*` 经常位于 400 `bad_request` 的 message，而非顶层 error；不要把它们当成所有运行时助手都会返回的统一枚举。401 先恢复平台登录，403 检查有效项目角色/运行时规则，404 检查 folder/name，409 先解决同名或 `resource_in_use` 引用。远程拒绝与平台拒绝分开诊断，重试前判断上一次动作是否可能已生效。

## 生产注意与清理

联合备份元数据/字节并核对孤儿。本地根默认节点本地，除非正确共享，不能与 SQLite 根重叠。签名链接不进公开日志。删资源保留表/字节证据并移除指名规则，外部字节须保留决策后才能删。

通用删除步骤：先停用调用脚本、代理/CRUD 目标及相关触发器，迁移依赖并保留需要的证据，再用 `viat resource delete demo` 或 DELETE 详情路由。409 `resource_in_use` 时先重新绑定/删除消息指出的端点，不应强行绕过引用。删除配置资产不等于撤销第三方凭据、删除外部数据或回滚已发生副作用。

## 相关资源与维护依据

- [S3 资源](s3.md)
- [PostgreSQL 资源](postgresql.md)
- [SQLite 资源](sqlite.md)
- [资源总览](index.md)

固定契约：`contracts/1.1.0/resources.json` → `resource.storage`。

核对实现（产品仓库相对路径）：viat-core/src/types/resource.rs (KindSpec/Plain/Secret); viat-api/src/dto.rs (normalization/validation); viat-api/src/handlers/resources.rs (CRUD/Test); viat-runtime/src/resource_io.rs, resources_json.rs, python.rs, typescript.rs; viat-api/src/runner/broker.rs; viat-cli/src/main.rs and repo/resources.rs; viat-core/src/types/snapshot.rs.
