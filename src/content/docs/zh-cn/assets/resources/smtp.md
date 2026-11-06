---
title: "SMTP 资源"
description: "项目独立的出站邮件中继，与部署 VIAT_SMTP 告警设置分离。平台持有凭据并固定发件身份，脚本选择收件人、主题、内容，不能改 From。"
doc_id: resource.smtp
verified_release: '1.1.0'
channel: stable
contract_ids: [resource.smtp]
---

# SMTP 资源

项目独立的出站邮件中继，与部署 VIAT_SMTP 告警设置分离。平台持有凭据并固定发件身份，脚本选择收件人、主题、内容，不能改 From。

本页核对 Viat 1.1.0 稳定版。示例使用合成值/服务桩，未执行、未连接真实服务、未发送消息。先读[资源总览](index.md)。

## 前置条件与权限

准备允许 from_address 发信的中继，满足发件域和限额要求，允许 API 节点 TCP/TLS 访问。示例使用隔离收信桩，不使用真实收件人。

## 完整配置字段

表中“必填”描述结构解析；提供方/后端的条件必填、运行时默认及限制在下节补充。`null` 仅在类型明确允许时可用，数字格式的存储上限不等于有意义的业务范围。不要依赖未知键被忽略来检测拼写。

### `plain`

| 字段 | 类型/允许值 | 必填 | 省略默认 | 约束 | 含义 |
| --- | --- | --- | --- | --- | --- |
| `plain.from_address` | string | 是 | — | — | 固定信封/头部 From，脚本不可覆盖。 |
| `plain.from_name` | string / null | 否；可能条件必填 | `null` | — | 可选固定发件显示名，不可含 CR/LF。 |
| `plain.host` | string | 是 | — | — | 服务主机名/IP，不是 URL 或凭据。 |
| `plain.port` | integer | 是 | — | minimum: 0; format: "uint16"; 0–65535 | TCP 端口，必填时须显式提供，TLS 不会推导端口。 |
| `plain.tls` | MailTls | 是 | — | — | 连接传输模式，具体要求见下文。 |

#### `MailTls`

允许结构/值：`"none" / "starttls" / "implicit"`。

### `secret`

| 字段 | 类型/允许值 | 必填 | 省略默认 | 约束 | 含义 |
| --- | --- | --- | --- | --- | --- |
| `secret.password` | string | 否；可能条件必填 | `""` | — | 账号密码/应用密码，不应作为明文配置。 |
| `secret.username` | string | 否；可能条件必填 | `""` | — | 账号名，可选/匿名规则随类型而异。 |

## 运行规则、默认值与限制

host 非空、port 非零、tls 必填。tls 为 none/starttls/implicit，587 STARTTLS、465 implicit 只是惯例而非默认。from_address 须形似可投递地址，host/from_address/from_name 拒绝 CR/LF。from_name 可省略。username 空表示匿名中继，只有 password 没有 username 会拒绝。send 不能改 From。TLS:none 只适合明确可信网络。

附件模式限制：最多 20 附件、总解码 10 MiB、合计元数据 16 KiB，文件名/content-type 最多 255 字节且无控制字符，text+HTML 合计 1 MiB，完整 MIME 16 MiB。这些附件模式上限不表示无附件正文也有相同上限。错误包括 too_many_attachments、attachments_too_large、invalid_attachment_metadata、invalid_transfer_encoding、mail_body_too_large、message_too_large。使用安全单文件名，必要时明确 content_type；附件传字节，不是让平台读取的本地路径。

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
  "kind": "smtp",
  "plain": {
    "host": "smtp-stub.example.test",
    "port": 587,
    "tls": "starttls",
    "from_address": "sender@example.test",
    "from_name": "Fixture sender"
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

Python 为 send(to=None,subject="",text=None,html=None,cc=None,bcc=None,reply_to=None,attachments=None)，TypeScript 为 send({to,subject,text,html,cc,bcc,reply_to,attachments})。to/cc/bcc 接受字符串或列表，总共至少一个收件人，text/html 至少一个。附件为 [{filename,content_type?,content}]（bytes/UTF-8 文本），或以 body_base64 替代 content，不能同时提供；平台不会拉取附件路径/URL。返回 {queued:true,accepted:n} 表示中继接受，不是送达。无收信方法。

这两个完整脚本均声明同一个根资源 demo；在获批准的测试运行中使用。写入、发送、构建和数据删除不是 dry-run。

### Python

```python
# @resource demo
from viat import ctx

def main():
    return ctx.resources.demo.send(to="recipient@example.test", subject="Fixture", text="Reference message")
```

### TypeScript

```typescript
// @resource demo
import { ctx } from "viat";

export async function main() {
  return await ctx.resources.demo.send({ to: "recipient@example.test", subject: "Fixture", text: "Reference message" });
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
        ctx.resource("demo").call("mail_send", json!({"to":["recipient@example.test"],"subject":"Fixture","text":"Reference message"}))
    });
}
```

Shell 没有方法装饰的 ctx.resources，仅有 JSON 环境投影；不能把上述方法名直接写成 shell 函数。binary 程序可按 worker 协议实现相应 RPC，并非自动拥有 Python/TypeScript 方法。sql 语言仅用于四种 SQL 数据源，viat_gql 仅用于 PostgreSQL/MySQL/SQLite，graphql 语言用于远程 graphql，llm 语言用于 llm；不支持的组合不会自动适配。

### 预期结果

收信桩接受一个测试收件人后返回 queued:true/accepted:1。真实中继上的 send 会真正发信，假地址不等于 dry-run。

## Test 行为与副作用

连接并检查 SMTP/TLS/认证，不提交邮件，但仍产生真实网络/认证事件。

管理 API 使用 `POST /projects/{slug}/resources/{name}/test?folder=`；CLI 为 `viat resource test demo`。API 检查响应体 `ok`：连接失败通常仍为 HTTP 200 `{ok:false,error:"…"}`，可能附 `schema_warnings`，不能只检查状态码。CLI 失败会非零退出。仅在允许出站/文件动作后执行。

## 常见失败与恢复

resource.smtp.empty_host/bad_port/bad_from_address/bad_from_name/password_without_username 应修正保存输入。发送时收件人/正文/头/附件限制也可能在 SMTP 前拒绝。认证/TLS 错误应匹配端口、模式、证书、账号。接受后退信不是助手调用失败。

管理错误一般为 `{error,message}`。DTO 的 `resource.<kind>.*` 经常位于 400 `bad_request` 的 message，而非顶层 error；不要把它们当成所有运行时助手都会返回的统一枚举。401 先恢复平台登录，403 检查有效项目角色/运行时规则，404 检查 folder/name，409 先解决同名或 `resource_in_use` 引用。远程拒绝与平台拒绝分开诊断，重试前判断上一次动作是否可能已生效。

## 生产注意与清理

send 之外处理配额、退信、幂等，超时不明时重试可能重复发信。附件有界，日志不放个人数据。删资源不会召回邮件或撤销中继凭据。

通用删除步骤：先停用调用脚本、代理/CRUD 目标及相关触发器，迁移依赖并保留需要的证据，再用 `viat resource delete demo` 或 DELETE 详情路由。409 `resource_in_use` 时先重新绑定/删除消息指出的端点，不应强行绕过引用。删除配置资产不等于撤销第三方凭据、删除外部数据或回滚已发生副作用。

## 相关资源与维护依据

- [IMAP 资源](imap.md)
- [受管 Storage 资源](storage.md)
- [资源总览](index.md)

固定契约：`contracts/1.1.0/resources.json` → `resource.smtp`。

核对实现（产品仓库相对路径）：viat-core/src/types/resource.rs (KindSpec/Plain/Secret); viat-api/src/dto.rs (normalization/validation); viat-api/src/handlers/resources.rs (CRUD/Test); viat-runtime/src/resource_io.rs, resources_json.rs, python.rs, typescript.rs; viat-api/src/runner/broker.rs; viat-cli/src/main.rs and repo/resources.rs; viat-core/src/types/snapshot.rs.
