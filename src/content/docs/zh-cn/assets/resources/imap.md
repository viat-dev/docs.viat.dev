---
title: "IMAP 资源"
description: "通过平台 IMAP 读邮件、列邮箱目录并显式标记 Seen，不是 SMTP、通用邮箱管理器，也不会仅因建资源就变成后台触发器。"
doc_id: resource.imap
verified_release: '1.1.0'
channel: stable
contract_ids: [resource.imap]
---

# IMAP 资源

通过平台 IMAP 读邮件、列邮箱目录并显式标记 Seen，不是 SMTP、通用邮箱管理器，也不会仅因建资源就变成后台触发器。

本页核对 Viat 1.1.0 稳定版。示例使用合成值/服务桩，未执行、未连接真实服务、未发送消息。先读[资源总览](index.md)。

## 前置条件与权限

启用 IMAP，准备有读/标记权限的邮箱账号/应用密码，并允许 API 节点访问。使用合成邮件测试邮箱，读取生产邮箱可能接触个人数据。

## 完整配置字段

表中“必填”描述结构解析；提供方/后端的条件必填、运行时默认及限制在下节补充。`null` 仅在类型明确允许时可用，数字格式的存储上限不等于有意义的业务范围。不要依赖未知键被忽略来检测拼写。

### `plain`

| 字段 | 类型/允许值 | 必填 | 省略默认 | 约束 | 含义 |
| --- | --- | --- | --- | --- | --- |
| `plain.host` | string | 是 | — | — | 服务主机名/IP，不是 URL 或凭据。 |
| `plain.port` | integer | 是 | — | minimum: 0; format: "uint16"; 0–65535 | TCP 端口，必填时须显式提供，TLS 不会推导端口。 |
| `plain.tls` | MailTls | 是 | — | — | 连接传输模式，具体要求见下文。 |

#### `MailTls`

允许结构/值：`"none" / "starttls" / "implicit"`。

### `secret`

| 字段 | 类型/允许值 | 必填 | 省略默认 | 约束 | 含义 |
| --- | --- | --- | --- | --- | --- |
| `secret.password` | string | 是 | — | — | 账号密码/应用密码，不应作为明文配置。 |
| `secret.username` | string | 是 | — | — | 账号名，可选/匿名规则随类型而异。 |

## 运行规则、默认值与限制

host、port、tls 必填，host 非空无 CR/LF，port 非零。tls 为 none/starttls/implicit，993 implicit 是惯例而非自动设置。username 非空白，password 为必需字符串。无匿名读邮箱模式。调用可选目录和 IMAP SEARCH 条件，不能改主机/凭据。

无附件模式单封获取限 1 MiB，返回正文每封最多 64 KiB。开启附件时 MIME 可达 16 MiB，适用最多 20 部件、10 MiB 解码附件、16 KiB 元数据和 16 MiB 序列化响应界限。必须检查 truncated 和逐邮件完整性/错误字段，不能假定字节已全到。mailbox 与 SEARCH 字符串不可含 CR/LF，不能通过数据注入 IMAP 命令。

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
  "kind": "imap",
  "plain": {
    "host": "imap-stub.example.test",
    "port": 993,
    "tls": "implicit"
  },
  "secret": {
    "username": "fixture-user",
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

Python 为 fetch(mailbox="INBOX",search="ALL",limit=20,mark_seen=False,include_attachments=False)，TypeScript 为 fetch(options)。按新到旧返回 {messages:[{uid,message_id,from,to,subject,date,text,…}],truncated}，limit 上限 200，字节有界（无附件模式约 4 MiB）。默认 BODY.PEEK 不标 Seen。mark_seen(uids,mailbox="INBOX") 返回 {updated:n}，mailboxes() 返回 {mailboxes:[…]}，TypeScript 也用下划线名称。显式附件模式返回有界 body_base64 和逐邮件 attachments_complete/attachments_error，失败不给部分附件。mark_seen:true 标记成功返回邮件；至少一次工作应保持 false，持久处理后再确认。

这两个完整脚本均声明同一个根资源 demo；在获批准的测试运行中使用。写入、发送、构建和数据删除不是 dry-run。

### Python

```python
# @resource demo
from viat import ctx

def main():
    return ctx.resources.demo.fetch(search="UNSEEN", limit=5)
```

### TypeScript

```typescript
// @resource demo
import { ctx } from "viat";

export async function main() {
  return await ctx.resources.demo.fetch({ search: "UNSEEN", limit: 5 });
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
        ctx.resource("demo").call("imap", json!({"op":"fetch","mailbox":"INBOX","search":"UNSEEN","limit":5,"mark_seen":false,"include_attachments":false}))
    });
}
```

Shell 没有方法装饰的 ctx.resources，仅有 JSON 环境投影；不能把上述方法名直接写成 shell 函数。binary 程序可按 worker 协议实现相应 RPC，并非自动拥有 Python/TypeScript 方法。sql 语言仅用于四种 SQL 数据源，viat_gql 仅用于 PostgreSQL/MySQL/SQLite，graphql 语言用于远程 graphql，llm 语言用于 llm；不支持的组合不会自动适配。

### 预期结果

测试邮箱一封未读邮件时返回该邮件和 truncated:false，不改 Seen，片段不确认已处理。

## Test 行为与副作用

通过 IMAP 连接并认证，不发送邮件，不证明所有邮件/附件均能处理。

管理 API 使用 `POST /projects/{slug}/resources/{name}/test?folder=`；CLI 为 `viat resource test demo`。API 检查响应体 `ok`：连接失败通常仍为 HTTP 200 `{ok:false,error:"…"}`，可能附 `schema_warnings`，不能只检查状态码。CLI 失败会非零退出。仅在允许出站/文件动作后执行。

## 常见失败与恢复

resource.imap.bad_host/bad_port/empty_username 应修正字段。认证/TLS/目录错误应修正账号/模式/名称。truncated:true 不是已读完。attachments_complete:false 应恢复/隔离后再 mark_seen，不能悄悄丢弃。

管理错误一般为 `{error,message}`。DTO 的 `resource.<kind>.*` 经常位于 400 `bad_request` 的 message，而非顶层 error；不要把它们当成所有运行时助手都会返回的统一枚举。401 先恢复平台登录，403 检查有效项目角色/运行时规则，404 检查 folder/name，409 先解决同名或 `resource_in_use` 引用。远程拒绝与平台拒绝分开诊断，重试前判断上一次动作是否可能已生效。

## 生产注意与清理

先持久化再 Seen，并按邮箱/邮件身份去重，并发读者可能看见相同邮件。UID 受邮箱/UIDVALIDITY 约束，只在需要时取附件。删资源不删邮件或撤销登录。

通用删除步骤：先停用调用脚本、代理/CRUD 目标及相关触发器，迁移依赖并保留需要的证据，再用 `viat resource delete demo` 或 DELETE 详情路由。409 `resource_in_use` 时先重新绑定/删除消息指出的端点，不应强行绕过引用。删除配置资产不等于撤销第三方凭据、删除外部数据或回滚已发生副作用。

## 相关资源与维护依据

- [SMTP 资源](smtp.md)
- [受管 Storage 资源](storage.md)
- [资源总览](index.md)

固定契约：`contracts/1.1.0/resources.json` → `resource.imap`。

核对实现（产品仓库相对路径）：viat-core/src/types/resource.rs (KindSpec/Plain/Secret); viat-api/src/dto.rs (normalization/validation); viat-api/src/handlers/resources.rs (CRUD/Test); viat-runtime/src/resource_io.rs, resources_json.rs, python.rs, typescript.rs; viat-api/src/runner/broker.rs; viat-cli/src/main.rs and repo/resources.rs; viat-core/src/types/snapshot.rs.
