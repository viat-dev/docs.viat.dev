---
title: "移动 Push 资源"
description: "stable 1.1.0 支持 JPush、FCM HTTP v1、APNs token 传输，含平台事件和脚本 .send。接受不代表手机送达。未发布分支的 APNs 加密 widget 概览快照不属稳定功能。"
doc_id: resource.push
verified_release: '1.1.0'
channel: stable
contract_ids: [resource.push]
---

# 移动 Push 资源

stable 1.1.0 支持 JPush、FCM HTTP v1、APNs token 传输，含平台事件和脚本 .send。接受不代表手机送达。未发布分支的 APNs 加密 widget 概览快照不属稳定功能。

本页核对 Viat 1.1.0 稳定版。示例使用合成值/服务桩，未执行、未连接真实服务、未发送消息。先读[资源总览](index.md)。

## 前置条件与权限

准备提供方应用和匹配环境注册测试设备。JPush 需 app key/master secret，FCM 需项目/RSA 服务账号 JSON，APNs 需 bundle/topic、EC .p8 和 key/team ID。允许 HTTPS（APNs HTTP/2）。真实发送/设备动作须 opt-in，默认桩。

## 完整配置字段

表中“必填”描述结构解析；提供方/后端的条件必填、运行时默认及限制在下节补充。`null` 仅在类型明确允许时可用，数字格式的存储上限不等于有意义的业务范围。不要依赖未知键被忽略来检测拼写。

### `plain`

| 字段 | 类型/允许值 | 必填 | 省略默认 | 约束 | 含义 |
| --- | --- | --- | --- | --- | --- |
| `plain.apns_production` | boolean | 否；可能条件必填 | `false` | — | JPush APNs 分发环境开关，默认 false。 |
| `plain.app_key` | string | 否；可能条件必填 | `""` | — | JPush 公开 app key，配 master_secret。 |
| `plain.base_url` | string / null | 否；可能条件必填 | `null` | — | 配置的上游 base/传输覆盖地址，不是逐调用目的地。 |
| `plain.bundle_id` | string | 否；可能条件必填 | `""` | — | APNs 应用 bundle/topic 标识。 |
| `plain.environment` | string / null | 否；可能条件必填 | `null` | — | APNs sandbox/production，故意不提供隐含环境。 |
| `plain.project_id` | string | 否；可能条件必填 | `""` | — | FCM Firebase 项目标识，不是 Viat 项目 UUID。 |
| `plain.provider` | PushProvider | 是 | — | — | 协议/提供方选择，条件必填要求见下文。 |

#### `PushProvider`

允许结构/值：`"jpush" / "fcm" / "apns"`。

### `secret`

| 字段 | 类型/允许值 | 必填 | 省略默认 | 约束 | 含义 |
| --- | --- | --- | --- | --- | --- |
| `secret.key_id` | string | 否；可能条件必填 | `""` | — | crypto 信封/JWT key 标签，push 中为 APNs 签名 key 标识。 |
| `secret.master_secret` | string | 否；可能条件必填 | `""` | — | JPush 私密半部。 |
| `secret.p8_key` | string | 否；可能条件必填 | `""` | — | APNs EC 签名 key PEM。 |
| `secret.service_account` | string | 否；可能条件必填 | `""` | — | FCM 完整服务账号 JSON，作为一个加密字符串。 |
| `secret.team_id` | string | 否；可能条件必填 | `""` | — | APNs Apple 开发者团队标识。 |

## 运行规则、默认值与限制

创建 plain 提供 provider jpush/fcm/apns。JPush 需 app_key/master_secret，apns_production 默认 false，分发 iOS 需 true。FCM 需 project_id，service_account 为一个含 client_email/private_key/token_uri 的 JSON 字符串，保存解析 RSA PEM。APNs 需 bundle_id、精确 sandbox/production 的 environment，以及 p8_key/key_id/team_id，保存解析 EC PEM。无关提供方字段不可替代必需项。base_url 覆盖须 HTTPS，HTTP 仅 loopback，有 host、无用户信息/query/fragment，执行出站策略，只用批准兼容桩/端点。



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
  "kind": "push",
  "plain": {
    "provider": "jpush",
    "app_key": "fixture-app-key",
    "apns_production": false,
    "base_url": "https://push-stub.example.test"
  },
  "secret": {
    "master_secret": "fixture-master-secret-not-a-credential"
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

Python 为 send(registration_ids,content,title="",extras=None)，TS 为 send(registration_ids,content,{title,extras})。代理每调用允许 1–10000 ID（旧 SDK 注释写 1000），按提供方分批。ID 为 1–256 可见 ASCII 字节，无空白。content 非空白 ≤2000 Unicode 字符，title ≤128；extras ≤20 字符串对，键 ≤64 字节、值 ≤256 字符。提供方字节限制仍适用，APNs JSON/extras 共 ≤4096 字节。返回 {accepted:n,delivery:"accepted-by-provider"}，部分接受有意义。脚本提供 ID/维护用户设备映射，不自动发现项目所有设备。

这两个完整脚本均声明同一个根资源 demo；在获批准的测试运行中使用。写入、发送、构建和数据删除不是 dry-run。

### Python

```python
# @resource demo
from viat import ctx

def main():
    return ctx.resources.demo.send(["fixture-rid-1"], "Fixture notification", title="Reference", extras={"case": "fixture"})
```

### TypeScript

```typescript
// @resource demo
import { ctx } from "viat";

export async function main() {
  return await ctx.resources.demo.send(["fixture-rid-1"], "Fixture notification", { title: "Reference", extras: { case: "fixture" } });
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
        ctx.resource("demo").call("push_send", json!({"registration_ids":["fixture-rid-1"],"content":"Fixture notification","title":"Reference","extras":{"case":"fixture"}}))
    });
}
```

Shell 没有方法装饰的 ctx.resources，仅有 JSON 环境投影；不能把上述方法名直接写成 shell 函数。binary 程序可按 worker 协议实现相应 RPC，并非自动拥有 Python/TypeScript 方法。sql 语言仅用于四种 SQL 数据源，viat_gql 仅用于 PostgreSQL/MySQL/SQLite，graphql 语言用于远程 graphql，llm 语言用于 llm；不支持的组合不会自动适配。

### 预期结果

批准的 JPush 兼容桩接受合成 fixture-rid-1 并返回 accepted:1/delivery:"accepted-by-provider"，本页不声称送达，也未执行发送。

## Test 行为与副作用

不通知手机的提供方校验：JPush 校验端点，FCM 虚拟 token validate_only（可能获取 OAuth token），APNs 无效测试 token 探测。仍是真实出站/认证事件，不是仅 schema，成功不证明真实 token/环境兼容。

管理 API 使用 `POST /projects/{slug}/resources/{name}/test?folder=`；CLI 为 `viat resource test demo`。API 检查响应体 `ok`：连接失败通常仍为 HTTP 200 `{ok:false,error:"…"}`，可能附 `schema_warnings`，不能只检查状态码。CLI 失败会非零退出。仅在允许出站/文件动作后执行。

## 常见失败与恢复

resource.push.empty_app_key/empty_master_secret/empty_project_id/empty_service_account/empty_bundle_id/empty_p8_key/empty_key_id/empty_team_id 补提供方字段。bad_service_account_json/key、bad_p8_key 修材料；bad_environment 用精确 sandbox/production；bad_url/outbound_denied 修批准 base。无效 token 重注册，超时可能已接受，盲目重试会重复。

管理错误一般为 `{error,message}`。DTO 的 `resource.<kind>.*` 经常位于 400 `bad_request` 的 message，而非顶层 error；不要把它们当成所有运行时助手都会返回的统一枚举。401 先恢复平台登录，403 检查有效项目角色/运行时规则，404 检查 folder/name，409 先解决同名或 `resource_in_use` 引用。远程拒绝与平台拒绝分开诊断，重试前判断上一次动作是否可能已生效。

## 生产注意与清理

有意选环境，减少敏感正文/extras，退役无效 token 并去重。凭据留平台。删资源不撤回通知或撤销厂商 key，应停用调用/事件后单独撤销。不可承诺 1.1.0 后台 widget 快照。

通用删除步骤：先停用调用脚本、代理/CRUD 目标及相关触发器，迁移依赖并保留需要的证据，再用 `viat resource delete demo` 或 DELETE 详情路由。409 `resource_in_use` 时先重新绑定/删除消息指出的端点，不应强行绕过引用。删除配置资产不等于撤销第三方凭据、删除外部数据或回滚已发生副作用。

## 相关资源与维护依据

- [HTTP API 资源](http_api.md)
- [Config 资源](config.md)
- [Secret 资源](secret.md)
- [资源总览](index.md)

固定契约：`contracts/1.1.0/resources.json` → `resource.push`。

核对实现（产品仓库相对路径）：viat-core/src/types/resource.rs (KindSpec/Plain/Secret); viat-api/src/dto.rs (normalization/validation); viat-api/src/handlers/resources.rs (CRUD/Test); viat-runtime/src/resource_io.rs, resources_json.rs, python.rs, typescript.rs; viat-api/src/runner/broker.rs; viat-cli/src/main.rs and repo/resources.rs; viat-core/src/types/snapshot.rs.
