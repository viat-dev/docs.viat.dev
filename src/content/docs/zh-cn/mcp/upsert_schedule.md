---
title: "upsert_schedule — 创建或替换计划"
description: "替换一个具名自动化计划；省略选项会重置为默认值。"
doc_id: mcp.upsert_schedule
verified_release: '1.1.0'
channel: stable
contract_ids: [mcp.upsert_schedule]
---

# `upsert_schedule` — 创建或替换计划

替换一个具名自动化计划；省略选项会重置为默认值。

适用于稳定版 Viat 1.1.0。先阅读 [MCP 配置与结果处理](overview.md)。以下为合成的、从源码推导的预期形状，**不是已执行的响应**。编写本页没有访问服务、提供方或设备。

## 前提与权限

需要所选项目的成员身份（任意项目角色，包括 Viewer）。平台角色不等同于项目成员身份。PAT 必须有效且其范围允许访问该路由。

使用已激活的隔离实例，配置服务器和 bearer；除 list_projects 外须有 `mcp-lab` 项目。示例中的现有资产和 ID 以概览夹具为前提，用夹具实际返回 ID 替换合成 ID；示例不会自行创建依赖。

## 完整输入字段

必填表示导出输入合约的结构要求，不等于完整条件 API 验证。可选字段的显式 JSON null 与省略同样反序列化，包括未限定类型的 JSON 字段。空字符串、数组或对象是实际值，不是省略。数值 format 表示序列化边界，运行时限制和默认值另算。args 的模式 `default:null` 不等于其运行时默认 `{}`。

| 字段 | 类型 | 必填 | 省略 / 显式 null | 约束和含义 |
| --- | --- | --- | --- | --- |
| `at` | string / null | 否（可能条件必填） | 不向 API 提供，条件规则见下文。；null 等同省略。 | 一次触发 RFC3339 时刻，最多未来十年。 |
| `catch_up` | boolean / null | 否（可能条件必填） | true；null 等同省略。 | 错过的触发是否延后执行，默认 true。 |
| `cron` | string / null | 否（可能条件必填） | 不向 API 提供，条件规则见下文。；null 等同省略。 | 五段 cron 表达式。 |
| `enabled` | boolean / null | 否（可能条件必填） | true；null 等同省略。 | 存储的启用标志，upsert 默认 true，切换工具必须提供布尔值。 |
| `every_secs` | integer / null | 否（可能条件必填） | 不向 API 提供，条件规则见下文。；null 等同省略。 | format: "int64"; 间隔秒数，10..86400。 |
| `inputs` | JSON (any value) | 否（可能条件必填） | {}；null 等同省略。 | 计划输入对象，默认 {}。 |
| `max_attempts` | integer / null | 否（可能条件必填） | 1；null 等同省略。 | format: "int64"; 每次触发尝试数，默认 1，范围 1..10。 |
| `name` | string | 是 | 无默认值，缺失或 null 无效。 | 精确资产名；身份与文件夹规则见本页说明。 |
| `on_overlap` | string / null | 否（可能条件必填） | skip；null 等同省略。 | skip（默认）\| queue \| parallel。 |
| `project` | string / null | 否（可能条件必填） | VIAT_PROJECT / current_project；否则 project_required；null 等同省略。 | 项目 slug；省略或 null 使用 VIAT_PROJECT/current_project，否则 project_required。 |
| `queue_cap` | integer / null | 否（可能条件必填） | null；null 等同省略。 | format: "int64"; 正数排队容量，仅适用于 on_overlap queue。 |
| `retry_backoff_secs` | integer / null | 否（可能条件必填） | 60；null 等同省略。 | format: "int64"; 重试延迟，默认 60，范围 1..86400 秒。 |
| `target_kind` | string | 是 | 无默认值，缺失或 null 无效。 | script \| workflow \| endpoint，决定条件必填目标字段。 |
| `target_method` | string / null | 否（可能条件必填） | 不向 API 提供，条件规则见下文。；null 等同省略。 | 已发布端点目标 method。 |
| `target_path` | string / null | 否（可能条件必填） | 不向 API 提供，条件规则见下文。；null 等同省略。 | 已发布端点目标路径。 |
| `target_script` | string / null | 否（可能条件必填） | 不向 API 提供，条件规则见下文。；null 等同省略。 | 现有脚本目标名称。 |
| `target_workflow` | string / null | 否（可能条件必填） | 不向 API 提供，条件规则见下文。；null 等同省略。 | 现有工作流目标名称。 |
| `timezone` | string / null | 否（可能条件必填） | 部署时区（默认 UTC）；null 等同省略。 | IANA 时区，省略或 null 使用部署计划默认值。 |
| `trigger_kind` | string | 是 | 无默认值，缺失或 null 无效。 | cron \| interval \| once，决定条件必填触发字段。 |

## 行为与验证

完整替换，不是 PATCH。名称 1..63 字符，以 ASCII 小写字母开头，其余为小写字母、数字、`_`、`-`。`trigger_kind`：`cron` 需五段 `cron`，可选 IANA `timezone`（部署默认，通常 UTC）；`interval` 需 10..86400 的 `every_secs`；`once` 需不超过未来十年的 RFC3339 `at`（允许过去时间，会到期）。`target_kind`：`script` 需 `target_script`，`workflow` 需 `target_workflow`，`endpoint` 需 `target_method`、`target_path` 指向已发布端点。非所选类型的字段被 MCP 忽略。`inputs` 省略或 null 变为 `{}`，且必须是对象。`enabled` 默认 true；`on_overlap` 默认 `skip`，还支持 `queue`、`parallel`。`queue_cap` 须为正数且仅适用于 `queue`。`max_attempts` 默认 1、范围 1..10；`retry_backoff_secs` 默认 60、范围 1..86400；`catch_up` 默认 true。即使更新，省略或 null 也会重置这些策略。

once 计划触发后自动禁用。已触发 once 用同一时刻替换时，即使 `enabled:true` 也不会重新启用；新时刻才是新一次触发。应检查返回 enabled，不能假定请求标志一定胜出。

## 输出与分页

返回 `{created:boolean,schedule:Schedule}`。 计划对象包含字符串 `name`、`on_overlap`、`updated_at`，布尔值 `enabled`、`catch_up`，JSON 对象 `trigger`、`target`、`inputs`。`next_due_at` 始终存在，值为时间戳字符串或 null。可选 `last_fired_at` 为时间戳字符串，`last_run_id` 为 UUID 字符串；`max_attempts` 为整数，`queue_cap`、`retry_backoff_secs` 为可选整数。其余可选字段缺失时省略。`trigger` 为 `{kind:"cron",cron,timezone}`、`{kind:"interval",every_secs}` 或 `{kind:"once",at}`；`target` 为 `{kind:"script"|"workflow",name}` 或 `{kind:"endpoint",method,path}`；损坏的旧端点目标可能返回 `{kind:"endpoint",raw}`。

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
    "name": "upsert_schedule",
    "arguments": {
      "project": "mcp-lab",
      "name": "mcp_timer",
      "trigger_kind": "interval",
      "every_secs": 60,
      "target_kind": "script",
      "target_script": "mcp_demo",
      "enabled": false,
      "inputs": {}
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
        "text": "{\"created\":true,\"schedule\":{\"name\":\"mcp_timer\",\"enabled\":false,\"trigger\":{\"kind\":\"interval\",\"every_secs\":60},\"target\":{\"kind\":\"script\",\"name\":\"mcp_demo\"},\"inputs\":{},\"next_due_at\":\"2026-01-01T00:00:00Z\",\"on_overlap\":\"skip\",\"max_attempts\":1,\"retry_backoff_secs\":60,\"catch_up\":true,\"updated_at\":\"2026-01-01T00:00:00Z\"}}"
      }
    ],
    "isError": false
  }
}
```

文本块内解码后的 JSON 值：

```json
{
  "created": true,
  "schedule": {
    "name": "mcp_timer",
    "enabled": false,
    "trigger": {
      "kind": "interval",
      "every_secs": 60
    },
    "target": {
      "kind": "script",
      "name": "mcp_demo"
    },
    "inputs": {},
    "next_due_at": "2026-01-01T00:00:00Z",
    "on_overlap": "skip",
    "max_attempts": 1,
    "retry_backoff_secs": 60,
    "catch_up": true,
    "updated_at": "2026-01-01T00:00:00Z"
  }
}
```

## 失败与恢复

不支持的类型或缺少条件必填字段返回本地 `bad_input`。API 验证范围、目标存在性及端点已发布要求；未发布端点返回 400。先 GET 决定 PUT/POST，因此并发 upsert 可能竞争。

所有上游工具都可能因令牌过期或撤销、PAT 范围、项目权限、激活、网络或超时失败。无项目及默认值时为 `project_required`；控制面非 2xx 为 `http_4xx`/`http_5xx`。详见 [公共错误外层及重试规则](overview.md)。输入反序列化或未知工具可能在进入工具层前成为 JSON-RPC 协议错误，不要假定每个失败都有 isError。retryable 标志不保证幂等。

## 副作用、验证与清理

enabled 默认 TRUE，可能立即开始真实执行，包括过去的 once 触发。示例明确为 false，并指向惰性草稿脚本；仍是实际配置写入。新夹具用 `delete_schedule`；修改已有计划时保存并恢复全部策略，而非仅更改字段。

验证应以观察为主：检查本文结果字段，获准修改前后使用对应读取工具。不要通过生产请求或删除无关对象来验证。

## 维护依据

输入清单：`contracts/1.1.0/mcp-tools.json`，工具 `upsert_schedule`. 固定产品源码中的实现和测试： `schedules.rs; handlers/schedules.rs; tests/it/tool_upsert_schedule.rs`. 工具模块文件名相对 `crates/viat-mcp/src/tools/`，API handler 相对 `crates/viat-api/src/handlers/`。公共传输和错误依据为 `crates/viat-mcp/src/tools/service.rs`、`http.rs`、`error.rs`；本次仅阅读测试，没有运行测试。
