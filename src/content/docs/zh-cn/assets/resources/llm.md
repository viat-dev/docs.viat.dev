---
title: "LLM 资源"
description: "Viat 的多提供方聊天契约支持 openai、anthropic、azure、custom，在不暴露 API key 的前提下统一聊天、工具调用结果和文本流。本页描述已发布适配器，不推荐最新模型，也不等价于完整提供方 SDK。"
doc_id: resource.llm
verified_release: '1.1.0'
channel: stable
contract_ids: [resource.llm]
---

# LLM 资源

Viat 的多提供方聊天契约支持 openai、anthropic、azure、custom，在不暴露 API key 的前提下统一聊天、工具调用结果和文本流。本页描述已发布适配器，不推荐最新模型，也不等价于完整提供方 SDK。

本页核对 Viat 1.1.0 稳定版。示例使用合成值/服务桩，未执行、未连接真实服务、未发送消息。先读[资源总览](index.md)。

## 前置条件与权限

准备有权使用的账号/key 和模型或 Azure 部署；首次验证应准备协议兼容测试桩。允许 API 节点出站，必要时配置代理。模型执行可能收费并外发提示词/工具数据，真实调用必须明确批准。

## 完整配置字段

表中“必填”描述结构解析；提供方/后端的条件必填、运行时默认及限制在下节补充。`null` 仅在类型明确允许时可用，数字格式的存储上限不等于有意义的业务范围。不要依赖未知键被忽略来检测拼写。

### `plain`

| 字段 | 类型/允许值 | 必填 | 省略默认 | 约束 | 含义 |
| --- | --- | --- | --- | --- | --- |
| `plain.endpoint` | string / null | 否；可能条件必填 | `null` | — | 配置的服务端点，base/操作 URL 和规范化规则依类型而定。 |
| `plain.extra_params` | object | 否；可能条件必填 | `{}` | — | 任意 JSON 请求体覆盖项，应按行为而非无害标签审查。 |
| `plain.model` | string | 是 | — | — | 所配模型标识，Azure 使用部署名，不会发现/替换。 |
| `plain.provider` | LlmProvider | 是 | — | — | 协议/提供方选择，条件必填要求见下文。 |
| `plain.proxy` | string / null | 否；可能条件必填 | `null` | — | 可选代理 URL，代理助手在平台侧应用，不要在 plain 内嵌密码。 |

#### `LlmProvider`

允许结构/值：`"openai" / "anthropic" / "azure" / "custom"`。

### `secret`

| 字段 | 类型/允许值 | 必填 | 省略默认 | 约束 | 含义 |
| --- | --- | --- | --- | --- | --- |
| `secret.api_key` | string | 是 | — | — | 提供方 API 凭据，由平台应用。 |

## 运行规则、默认值与限制

model 和 api_key 不得为空白。openai 的 endpoint 可省略（https://api.openai.com/v1），anthropic 可省略（https://api.anthropic.com），azure/custom 必须提供。openai/custom 追加 /chat/completions 并使用 bearer，兼容 custom 服务需要 /v1 时应将其写入 base。anthropic 追加 /v1/messages，发送 x-api-key 和 anthropic-version 2023-06-01。Azure 追加 /openai/deployments/{model}/chat/completions?api-version=2024-02-01，使用 api-key，并将 model 当作部署名而非请求体字段。覆盖 endpoint 应填 base，而非最终操作 URL。不会自动发现模型或替换成最新模型。

extra_params 是请求体覆盖项，在建模默认值之后合并；单次调用的额外参数最后覆盖资源 extra_params。它们也能改变 model/messages/预算，因此应按行为变更审查，而非视为无害元数据。代理由平台应用。anthropic 省略 max_tokens 时默认 4096，其他适配器不设置则不发送。JSON 模式仅尽力而为（anthropic 不强制 JSON 模式），输出仍须自行解析和校验。

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
  "kind": "llm",
  "plain": {
    "provider": "custom",
    "model": "fixture-model",
    "endpoint": "https://llm-stub.example.test/v1",
    "extra_params": {}
  },
  "secret": {
    "api_key": "fixture-key-not-a-credential"
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

Python 提供 chat(messages,max_tokens=None,temperature=None,json=False,tools=None,tool_choice=None,**extra)、ask(prompt,**kw)（仅 content）和 chat_stream(messages,…)（文本迭代器）。TypeScript 对应 chat(messages,opts)、ask(prompt,opts)、chatStream(messages,opts)（异步文本迭代器）。messages 可为字符串或 [{role,content,tool_calls?,tool_call_id?}]，role 为 system/user/assistant/tool。chat 返回 {content,model,usage,tool_calls}，usage 可为 null，请求工具时 content 可为空。工具定义为 [{name,description?,parameters}]，返回调用为 [{id,name,arguments}]，arguments 已解码为 JSON。脚本须校验、授权并执行工具，追加 assistant 请求和匹配的 role:tool 结果，并限制循环次数。流仅含文本且拒绝工具，不可用流推断完整工具调用。

这两个完整脚本均声明同一个根资源 demo；在获批准的测试运行中使用。写入、发送、构建和数据删除不是 dry-run。

### Python

```python
# @resource demo
from viat import ctx

def main():
    return ctx.resources.demo.chat("Reply with the word ready", max_tokens=16)
```

### TypeScript

```typescript
// @resource demo
import { ctx } from "viat";

export async function main() {
  return await ctx.resources.demo.chat("Reply with the word ready", { max_tokens: 16 });
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
        ctx.resource("demo").call("llm", json!({"messages":[{"role":"user","content":"Reply with the word ready"}],"max_tokens":16}))
    });
}
```

Shell 没有方法装饰的 ctx.resources，仅有 JSON 环境投影；不能把上述方法名直接写成 shell 函数。binary 程序可按 worker 协议实现相应 RPC，并非自动拥有 Python/TypeScript 方法。sql 语言仅用于四种 SQL 数据源，viat_gql 仅用于 PostgreSQL/MySQL/SQLite，graphql 语言用于远程 graphql，llm 语言用于 llm；不支持的组合不会自动适配。

### 预期结果

协议兼容测试桩可返回 content="ready"、model="fixture-model"、usage 和 tool_calls=[]。示例模型/key 不是有效厂商凭据。配置及聊天示例均未执行。

## Test 行为与副作用

真正发送带认证的模型列表 GET：openai/custom 为 {base}/models，anthropic 为 {base}/v1/models，azure 为 {base}/openai/models?api-version=2024-02-01。不生成 token，但仍会联系服务。custom 服务没有列表接口时可能 Test 失败但聊天可用；Test 成功不证明所配模型/部署或工具能力可用。

管理 API 使用 `POST /projects/{slug}/resources/{name}/test?folder=`；CLI 为 `viat resource test demo`。API 检查响应体 `ok`：连接失败通常仍为 HTTP 200 `{ok:false,error:"…"}`，可能附 `schema_warnings`，不能只检查状态码。CLI 失败会非零退出。仅在允许出站/文件动作后执行。

## 常见失败与恢复

400 bad_request 消息可能含 resource.llm.empty_model、empty_api_key、endpoint_required、bad_url、bad_proxy_url，应修正对应字段。提供方 401/403 应轮换或授权 key，404 应检查 base 和 Azure 部署，429 应遵循配额并限制重试。JSON 或工具参数无效时应做应用校验，不能将文本当作可信命令。

管理错误一般为 `{error,message}`。DTO 的 `resource.<kind>.*` 经常位于 400 `bad_request` 的 message，而非顶层 error；不要把它们当成所有运行时助手都会返回的统一枚举。401 先恢复平台登录，403 检查有效项目角色/运行时规则，404 检查 folder/name，409 先解决同名或 `resource_in_use` 引用。远程拒绝与平台拒绝分开诊断，重试前判断上一次动作是否可能已生效。

## 生产注意与清理

显式设置 token、超时、工具轮数和费用预算。不要将凭据放入 extra_params 或提示词。审查外发内容。删除资源不会取消提供方已接受请求，也不会撤销 API key；应先停用调用方，再单独撤销 key。

通用删除步骤：先停用调用脚本、代理/CRUD 目标及相关触发器，迁移依赖并保留需要的证据，再用 `viat resource delete demo` 或 DELETE 详情路由。409 `resource_in_use` 时先重新绑定/删除消息指出的端点，不应强行绕过引用。删除配置资产不等于撤销第三方凭据、删除外部数据或回滚已发生副作用。

## 相关资源与维护依据

- [HTTP API 资源](http_api.md)
- [Config 资源](config.md)
- [Secret 资源](secret.md)
- [资源总览](index.md)

固定契约：`contracts/1.1.0/resources.json` → `resource.llm`。

核对实现（产品仓库相对路径）：viat-core/src/types/resource.rs (KindSpec/Plain/Secret); viat-api/src/dto.rs (normalization/validation); viat-api/src/handlers/resources.rs (CRUD/Test); viat-runtime/src/resource_io.rs, resources_json.rs, python.rs, typescript.rs; viat-api/src/runner/broker.rs; viat-cli/src/main.rs and repo/resources.rs; viat-core/src/types/snapshot.rs.
