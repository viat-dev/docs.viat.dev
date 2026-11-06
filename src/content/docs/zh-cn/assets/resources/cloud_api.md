---
title: "Cloud API 资源"
description: "仅支持 aliyun_rpc_v1、tencent_tc3 两种协议的签名动作调用，不是全云适配器，不支持 AWS SigV4、阿里云 ACS3 或任意厂商签名。资源固定产品端点，脚本不能将凭据改发到另一主机。"
doc_id: resource.cloud_api
verified_release: '1.1.0'
channel: stable
contract_ids: [resource.cloud_api]
---

# Cloud API 资源

仅支持 aliyun_rpc_v1、tencent_tc3 两种协议的签名动作调用，不是全云适配器，不支持 AWS SigV4、阿里云 ACS3 或任意厂商签名。资源固定产品端点，脚本不能将凭据改发到另一主机。

本页核对 Viat 1.1.0 稳定版。示例使用合成值/服务桩，未执行、未连接真实服务、未发送消息。先读[资源总览](index.md)。

## 前置条件与权限

准备仅授予所需产品动作的 RAM/CAM 子账号，使 provider、endpoint、API version 与产品协议匹配，并允许 API 节点出站。STS 材料须到期前轮换。

## 完整配置字段

表中“必填”描述结构解析；提供方/后端的条件必填、运行时默认及限制在下节补充。`null` 仅在类型明确允许时可用，数字格式的存储上限不等于有意义的业务范围。不要依赖未知键被忽略来检测拼写。

### `plain`

| 字段 | 类型/允许值 | 必填 | 省略默认 | 约束 | 含义 |
| --- | --- | --- | --- | --- | --- |
| `plain.api_version` | string | 是 | — | — | 云产品 API 版本，支持逐调用覆盖。 |
| `plain.endpoint` | string | 是 | — | — | 配置的服务端点，base/操作 URL 和规范化规则依类型而定。 |
| `plain.provider` | CloudProvider | 是 | — | — | 协议/提供方选择，条件必填要求见下文。 |
| `plain.proxy` | string / null | 否；可能条件必填 | `null` | — | 可选代理 URL，代理助手在平台侧应用，不要在 plain 内嵌密码。 |
| `plain.region` | string / null | 否；可能条件必填 | `null` | — | 签名/操作区域，提供方规则可能要求必填。 |
| `plain.service` | string / null | 否；可能条件必填 | `null` | — | TC3 签名服务，省略从端点主机名推导。 |

#### `CloudProvider`

允许结构/值：`"aliyun_rpc_v1" / "tencent_tc3"`。

### `secret`

| 字段 | 类型/允许值 | 必填 | 省略默认 | 约束 | 含义 |
| --- | --- | --- | --- | --- | --- |
| `secret.access_key_id` | SecretField | 否；可能条件必填 | `""` | — | 云凭据标识，可为原值或 secret 资源引用。 |
| `secret.access_key_secret` | SecretField | 否；可能条件必填 | `""` | — | 云签名秘密，可为原值或 secret 资源引用。 |
| `secret.security_token` | SecretField / null | 否；可能条件必填 | `null` | — | 可选云 STS token，可为原值或 secret 资源引用。 |

#### `SecretField`

允许结构/值：`string / map<string, string>`。

字符串原值，或仅含 `$secret` 字符串键的对象（例如 `{"$secret":"cloud_key"}`）。schema 的 map 形状不代表任意多键对象都可用；运行时会检查精确引用和 secret 类型目标。

## 运行规则、默认值与限制

endpoint 必须为通过出站限制的 HTTP(S) URL，api_version 不得为空白。tencent_tc3 要求 region，service 默认取端点主机名第一段。aliyun_rpc_v1 忽略独立 region，产品需要时将 RegionId 放动作 params。access_key_id/access_key_secret 可填字符串或精确 {"$secret":"name"}，可选 STS security_token 形状相同。引用必须已指向 secret 资源。结构默认空值不表示匿名签名调用可用。proxy 由平台应用。

RPC v1 以 HMAC-SHA1 将签名 POST 表单发送至 /，TC3 用 HMAC-SHA256 发送签名 JSON 与动作头。非字符串参数会 JSON 序列化为扁平字符串映射，助手不会自动生成产品的点分列表参数。可逐调用覆盖 api_version，不能覆盖 endpoint/provider。

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
  "kind": "cloud_api",
  "plain": {
    "provider": "aliyun_rpc_v1",
    "endpoint": "https://cloud-stub.example.test",
    "api_version": "2015-11-23"
  },
  "secret": {
    "access_key_id": "fixture-access",
    "access_key_secret": "fixture-secret-not-a-credential"
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

Python 为 action(name,params=None,api_version=None,check=True)，TypeScript 为 action(name,params={}, {apiVersion,check})。返回厂商 JSON（腾讯 Response 拆包）。check:true 即使 HTTP 200 也将厂商错误码视为失败，只有明确知道业务 Code 不是错误时才用 check:false。没有通用 get/post、自动重试或凭据续期。

这两个完整脚本均声明同一个根资源 demo；在获批准的测试运行中使用。写入、发送、构建和数据删除不是 dry-run。

### Python

```python
# @resource demo
from viat import ctx

def main():
    return ctx.resources.demo.action("DescribeRegions", {})
```

### TypeScript

```typescript
// @resource demo
import { ctx } from "viat";

export async function main() {
  return await ctx.resources.demo.action("DescribeRegions", {});
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
        ctx.resource("demo").call("cloud", json!({"action":"DescribeRegions","params":{},"check":true}))
    });
}
```

Shell 没有方法装饰的 ctx.resources，仅有 JSON 环境投影；不能把上述方法名直接写成 shell 函数。binary 程序可按 worker 协议实现相应 RPC，并非自动拥有 Python/TypeScript 方法。sql 语言仅用于四种 SQL 数据源，viat_gql 仅用于 PostgreSQL/MySQL/SQLite，graphql 语言用于远程 graphql，llm 语言用于 llm；不支持的组合不会自动适配。

### 预期结果

测试桩须实现所选签名协议并为 DescribeRegions 返回确定 JSON。并非所有真实产品支持此动作，本例是提供方桩，不是可对邮件/短信产品执行的业务操作。

## Test 行为与副作用

发送签名 DescribeRegions 探测。签名类拒绝判失败，其他结果（含未知动作）可通过。只是有限的签名/可达性信号，不证明动作权限或服务健康。它会真正请求，但不会故意选择发邮件/短信等写操作。

管理 API 使用 `POST /projects/{slug}/resources/{name}/test?folder=`；CLI 为 `viat resource test demo`。API 检查响应体 `ok`：连接失败通常仍为 HTTP 200 `{ok:false,error:"…"}`，可能附 `schema_warnings`，不能只检查状态码。CLI 失败会非零退出。仅在允许出站/文件动作后执行。

## 常见失败与恢复

resource.cloud_api.bad_endpoint/empty_api_version/region_required/bad_proxy_url 应修正输入。签名错误核对账号密钥对、region/service/version、时钟偏差、STS 到期。厂商动作拒绝/未知动作应修正策略/协议，不是扩大凭据权限。签名前先修正缺失引用。

管理错误一般为 `{error,message}`。DTO 的 `resource.<kind>.*` 经常位于 400 `bad_request` 的 message，而非顶层 error；不要把它们当成所有运行时助手都会返回的统一枚举。401 先恢复平台登录，403 检查有效项目角色/运行时规则，404 检查 folder/name，409 先解决同名或 `resource_in_use` 引用。远程拒绝与平台拒绝分开诊断，重试前判断上一次动作是否可能已生效。

## 生产注意与清理

按产品拆资源，临时凭据在外部轮换。签名 key 虽留平台，业务参数/响应仍需脱敏。删除资源不会取消云侧已接受任务或撤销 key，迁移调用方后应单独撤销。

通用删除步骤：先停用调用脚本、代理/CRUD 目标及相关触发器，迁移依赖并保留需要的证据，再用 `viat resource delete demo` 或 DELETE 详情路由。409 `resource_in_use` 时先重新绑定/删除消息指出的端点，不应强行绕过引用。删除配置资产不等于撤销第三方凭据、删除外部数据或回滚已发生副作用。

## 相关资源与维护依据

- [Secret 资源](secret.md)
- [Config 资源](config.md)
- [HTTP API 资源](http_api.md)
- [S3 资源](s3.md)
- [资源总览](index.md)

固定契约：`contracts/1.1.0/resources.json` → `resource.cloud_api`。

核对实现（产品仓库相对路径）：viat-core/src/types/resource.rs (KindSpec/Plain/Secret); viat-api/src/dto.rs (normalization/validation); viat-api/src/handlers/resources.rs (CRUD/Test); viat-runtime/src/resource_io.rs, resources_json.rs, python.rs, typescript.rs; viat-api/src/runner/broker.rs; viat-cli/src/main.rs and repo/resources.rs; viat-core/src/types/snapshot.rs.
