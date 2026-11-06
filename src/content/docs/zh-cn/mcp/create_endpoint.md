---
title: "create_endpoint — 创建端点或目录"
description: "把草稿路径节点绑定到一个目标，或创建无绑定目录。"
doc_id: mcp.create_endpoint
verified_release: '1.1.0'
channel: stable
contract_ids: [mcp.create_endpoint]
---

# `create_endpoint` — 创建端点或目录

把草稿路径节点绑定到一个目标，或创建无绑定目录。

适用于稳定版 Viat 1.1.0。先阅读 [MCP 配置与结果处理](overview.md)。以下为合成的、从源码推导的预期形状，**不是已执行的响应**。编写本页没有访问服务、提供方或设备。

## 前提与权限

需要编辑权限：项目 Owner、Admin 或 Developer；Viewer 被拒绝。PAT 所有者须具有该项目角色，且 PAT 范围允许访问该路由。

使用已激活的隔离实例，配置服务器和 bearer；除 list_projects 外须有 `mcp-lab` 项目。示例中的现有资产和 ID 以概览夹具为前提，用夹具实际返回 ID 替换合成 ID；示例不会自行创建依赖。

## 完整输入字段

必填表示导出输入合约的结构要求，不等于完整条件 API 验证。可选字段的显式 JSON null 与省略同样反序列化，包括未限定类型的 JSON 字段。空字符串、数组或对象是实际值，不是省略。数值 format 表示序列化边界，运行时限制和默认值另算。args 的模式 `default:null` 不等于其运行时默认 `{}`。

| 字段 | 类型 | 必填 | 省略 / 显式 null | 约束和含义 |
| --- | --- | --- | --- | --- |
| `allowed_authorizers` | array&lt;string&gt; / null | 否（可能条件必填） | 继承；null 等同省略。 | 本节点声明的授权器名称，[] 是显式值。 |
| `authz_gates` | array&lt;JSON&gt; / null | 否（可能条件必填） | 继承；null 等同省略。 | {type,action} 门对象数组，[] 不等于继承。 |
| `crud_config` | JSON (any value) | 否（可能条件必填） | 不向 API 提供，条件规则见下文。；null 等同省略。 | CRUD 对象，必填 table/op 及选项见下文。 |
| `crud_resource_name` | string / null | 否（可能条件必填） | 不向 API 提供，条件规则见下文。；null 等同省略。 | 用于表 CRUD 的现有 postgresql 资源。 |
| `method` | string / null | 否（可能条件必填） | 不向 API 提供，条件规则见下文。；null 等同省略。 | HTTP method，支持值和条件必填规则见下文。 |
| `override_authorizers` | boolean / null | 否（可能条件必填） | false；null 等同省略。 | 已存储授权器覆盖开关，更新省略时保留现值。 |
| `overrides` | JSON (any value) | 否（可能条件必填） | 不向 API 提供，条件规则见下文。；null 等同省略。 | 端点覆盖对象，整体替换而非递归合并。 |
| `parent_id` | string / null | 否（可能条件必填） | 树根；null 等同省略。 | 父端点 UUID，省略或 null 的创建及移动语义见下文。 |
| `path_override` | string / null | 否（可能条件必填） | 不向 API 提供，条件规则见下文。；null 等同省略。 | 叶节点绝对路径覆盖，MCP 不支持用 null 清除。 |
| `project` | string / null | 否（可能条件必填） | VIAT_PROJECT / current_project；否则 project_required；null 等同省略。 | 项目 slug；省略或 null 使用 VIAT_PROJECT/current_project，否则 project_required。 |
| `proxy_resource_name` | string / null | 否（可能条件必填） | 不向 API 提供，条件规则见下文。；null 等同省略。 | 现有 http_api 资源绑定。 |
| `proxy_strip_prefix` | boolean / null | 否（可能条件必填） | true；null 等同省略。 | 剥离挂载前缀，创建 API 默认 true。 |
| `proxy_upstreams` | map<string,string> / null | 否（可能条件必填） | 不向 API 提供，条件规则见下文。；null 等同省略。 | 路径参数值 → http_api 资源名映射。 |
| `script_name` | string / null | 否（可能条件必填） | 不向 API 提供，条件规则见下文。；null 等同省略。 | 脚本绑定名称，必要时带文件夹。 |
| `segment` | string | 是 | 无默认值，缺失或 null 无效。 | 单个路径段，字面值或 :param。 |
| `tree` | string / null | 否（可能条件必填） | 唯一的树，否则条件必填；null 等同省略。 | 树名称，会解析为 UUID，不是 ID。 |
| `workflow_name` | string / null | 否（可能条件必填） | 不向 API 提供，条件规则见下文。；null 等同省略。 | 工作流绑定名称，必要时带文件夹。 |
| `ws_config` | JSON (any value) | 否（可能条件必填） | 不向 API 提供，条件规则见下文。；null 等同省略。 | 含 routes 的 WebSocket 配置，需 API 验证。 |

## 行为与验证

最多选择一个绑定：`script_name`、`workflow_name`、`proxy_resource_name`、`crud_resource_name`、`ws_config`。无绑定且无 method 表示目录。脚本、工作流、CRUD 叶节点需要 method；代理挂载不带 method；WebSocket 使用 GET。`tree` 是名称，仅项目恰有一棵树时可省略。`parent_id` 省略或 null 表示根节点。`segment` 是单个字面段或 `:param`，不是多段路径。代理 strip 默认 true。空授权器或门数组是显式声明，不是省略；授权器替换继承列表，而门会累积。复杂 JSON 字段见下文。

segment 须为 1..64 字节，不能只有 `:`，不能含 `/` 或空白。WebSocket 可省略 method（API 设为 GET），提供时必须为 GET。`ws_config.routes` 同时提供 `script_id` 和 `script` 时 ID 优先。路由名为 `[a-z0-9_]{1,64}` 或 `$connect`、`$disconnect`、`$default`；至少有一个非 connect/disconnect 的消息路由。`route_key` 不能为空白且最多 64 字节，quota 数值必须为正。

### API 接受的 JSON 对象

- `authz_gates`：对象数组，每项必须有字符串 `type`、`action`；模型须声明该类型和动作，且类型能用作不带对象的门。省略表示继承，空数组表示本层无门。门沿祖先累积，直到已有 override 边界；MCP 不提供修改此边界的参数。
- `ws_config`：必填 `routes` 映射，每个值通过 `script` 字符串或 `script_id` UUID 字符串指定脚本。可选 `route_key` 默认 `"type"`，可选 `message_rate_limit` 为 quota；`log_messages` 为 `all` 或默认 `errors`。未知顶层配置键被拒绝，写入时解析现有脚本。此配置不会为 MCP 启用 WebSocket 传输。
- `crud_config`：必填 `table:string`、`op`（`list|get_by_pk|insert|update_by_pk|delete_by_pk`）。`columns:string[]` 默认 []；`filters` 默认 {}，把查询名映射到 `{column:string,op?:eq|neq|gt|gte|lt|lte|like|ilike}`，op 默认 eq；`order_by` 默认 []，元素为 `{column:string,dir:asc|desc}`；可选 `limit` 内整数 `default` 默认 50、`max` 默认 200。`writable:string[]` 默认 []；`defaults` 默认 {}，把列名映射到身份 scope 字符串；可选 `authz_type:string` 省略时继承资源表绑定；`allow_unscoped_writes:boolean` 默认 false。未知键被拒绝。列表使用筛选、排序和上限，其他操作拒绝这些选项；limit.max 必须为正，limit.default 不能超过它。空 columns 选择所有映射列，空 writable 选择映射的非主键列。主键操作从映射表推导路径主键。写操作需行范围授权（authz_type 或资源绑定），除非有意选择不限定范围；不要只为消除发布拒绝就启用不受限写入。
- `overrides`：整体替换的对象。`path_params`、`query_params`、`body_fields` 默认 {}，把线协议名称映射到 `{type:int|float|bool|string|json,required?:boolean,nullable?:boolean,default?:JSON,as?:string}`。required 默认 false；缺少 nullable 不接受 null；default/as 默认缺失。正文的 nullable 与 required 独立。`required_headers:string[]` 默认 []，`response_headers:map<string,string>` 默认 {}；可选 `response_transform:string` 为 RFC9535 JSONPath。`strict`、`raw_body`、`run_async` 默认 false。可选 `audit_reason:string` 选择经过验证的原因来源。可选 `rate_limit` 含可选或 null 的 `endpoint`/`subject` quota，`subject_key` 默认 `identity`，也可为 `ip`。quota 必须有正整数 `requests`、`window_secs`，可选正整数 `burst` 默认 requests。可选 `multipart` 含 `max_file_bytes` 默认 0（部署上限）、`max_files` 默认 0（实际 1，最大 32）、`fields:string[]` 默认 []（所有文本字段）。可选 `cache` 必须有部署上限内的正整数 `ttl_secs`；`scope` 默认 `caller`，可为 `shared`；`vary_headers:string[]`、`ignore_params:string[]` 默认 []。可选 `project_users_grant` 含 `roles:string[]` 默认 []；可选 `current_user_grant` 含 `read_social_identity:boolean` 默认 false、`provision_meta_keys:string[]` 默认 []。这些是权限授予，不是无害注释。

API 拒绝不兼容选项：multipart 与 raw_body/run_async；raw_body 与 body_fields；cache 与 raw_body/multipart/run_async。缓存仅服务 GET。strict 模式需要声明路径参数；重复绑定、错误 JSONPath 或头名称会失败。`path_override` 仅用于叶节点，须为绝对路径、最多 256 字符，不能含 `//`、反斜杠或 `..`，不能占用平台保留路径。字符串 `null` 不是清除命令。

## 输出与分页

返回 `{endpoint:Endpoint}`。 端点对象包含字符串 `id`、`path`、`segment`、`tree_id`、`kind`；可选字符串 `method`、`parent_id`、`script_name`、`workflow_name`、`proxy_resource_name`；可选对象 `ws_routes`（路由 → 脚本字符串）及 `authz_gates` 数组（`{type, action}`）。可选字段省略而非返回 null。此投影不包含授权器列表、overrides 或完整 CRUD 配置，不能用作完整备份。

无分页或续页游标。

值会序列化成 JSON，放进一个 MCP `content` 文本块。请把 `result.content[0].text` 解析为 JSON。不承诺 `structuredContent` 或 `outputSchema`；注明省略的可选字段不能假定以 null 存在。

## 合成请求与预期形状

完成 MCP initialize/initialized 后，通过 stdio 以单行 JSON 发送此 tools/call 请求（此处格式化仅为便于阅读）。

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "create_endpoint",
    "arguments": {
      "project": "mcp-lab",
      "tree": "main",
      "segment": "mcp-demo",
      "method": "GET",
      "script_name": "mcp_demo"
    }
  }
}
```

预期 MCP 外层形状（ID、时间戳、头和计算值均为示意，不是确定值断言）。

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"endpoint\":{\"id\":\"00000000-0000-4000-8000-000000000001\",\"method\":\"GET\",\"path\":\"/mcp-demo\",\"segment\":\"mcp-demo\",\"tree_id\":\"00000000-0000-4000-8000-000000000001\",\"script_name\":\"mcp_demo\",\"kind\":\"script\"}}"
      }
    ],
    "isError": false
  }
}
```

文本块内解码后的 JSON 值：

```json
{
  "endpoint": {
    "id": "00000000-0000-4000-8000-000000000001",
    "method": "GET",
    "path": "/mcp-demo",
    "segment": "mcp-demo",
    "tree_id": "00000000-0000-4000-8000-000000000001",
    "script_name": "mcp_demo",
    "kind": "script"
  }
}
```

## 失败与恢复

混合绑定、无绑定却带 method、孤立 `crud_config` 或无代理资源的代理片段会返回本地 `bad_input`。API 拒绝无效 method、缺失目标、保留路径、无效模式或门，以及路径冲突。CRUD 叶节点必须同时有资源和配置。

所有上游工具都可能因令牌过期或撤销、PAT 范围、项目权限、激活、网络或超时失败。无项目及默认值时为 `project_required`；控制面非 2xx 为 `http_4xx`/`http_5xx`。详见 [公共错误外层及重试规则](overview.md)。输入反序列化或未知工具可能在进入工具层前成为 JSON-RPC 协议错误，不要假定每个失败都有 isError。retryable 标志不保证幂等。

## 副作用、验证与清理

仅创建草稿，不要为这个节点盲目发布整个项目，应先查看 `publish_plan`。新夹具用 `delete_endpoint` 清理，已发布则先下线；删除目录会删除子树。

验证应以观察为主：检查本文结果字段，获准修改前后使用对应读取工具。不要通过生产请求或删除无关对象来验证。

## 维护依据

输入清单：`contracts/1.1.0/mcp-tools.json`，工具 `create_endpoint`. 固定产品源码中的实现和测试： `endpoints.rs; handlers/endpoints.rs; core/types/endpoint.rs; core/types/crud.rs; tests/it/tool_create_endpoint.rs`. 工具模块文件名相对 `crates/viat-mcp/src/tools/`，API handler 相对 `crates/viat-api/src/handlers/`。公共传输和错误依据为 `crates/viat-mcp/src/tools/service.rs`、`http.rs`、`error.rs`；本次仅阅读测试，没有运行测试。
