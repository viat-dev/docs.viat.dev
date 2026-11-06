---
title: "upsert_alert — 创建或替换告警规则"
description: "设置具名失败阈值及唯一的真实通知目标。"
doc_id: mcp.upsert_alert
verified_release: '1.1.0'
channel: stable
contract_ids: [mcp.upsert_alert]
---

# `upsert_alert` — 创建或替换告警规则

设置具名失败阈值及唯一的真实通知目标。

适用于稳定版 Viat 1.1.0。先阅读 [MCP 配置与结果处理](overview.md)。以下为合成的、从源码推导的预期形状，**不是已执行的响应**。编写本页没有访问服务、提供方或设备。

## 前提与权限

需要发布权限：项目 Owner 或 Admin；Developer 和 Viewer 被拒绝。PAT 所有者须具有该项目角色，且 PAT 范围允许访问该路由。

使用已激活的隔离实例，配置服务器和 bearer；除 list_projects 外须有 `mcp-lab` 项目。示例中的现有资产和 ID 以概览夹具为前提，用夹具实际返回 ID 替换合成 ID；示例不会自行创建依赖。

## 完整输入字段

必填表示导出输入合约的结构要求，不等于完整条件 API 验证。可选字段的显式 JSON null 与省略同样反序列化，包括未限定类型的 JSON 字段。空字符串、数组或对象是实际值，不是省略。数值 format 表示序列化边界，运行时限制和默认值另算。args 的模式 `default:null` 不等于其运行时默认 `{}`。

| 字段 | 类型 | 必填 | 省略 / 显式 null | 约束和含义 |
| --- | --- | --- | --- | --- |
| `channel_kind` | string | 是 | 无默认值，缺失或 null 无效。 | webhook \| chat \| email \| push，且有唯一匹配目标。 |
| `chat_account` | string / null | 否（可能条件必填） | 不向 API 提供，条件规则见下文。；null 等同省略。 | 现有聊天账号名，须与 chat_id 一同提供。 |
| `chat_id` | string / null | 否（可能条件必填） | 不向 API 提供，条件规则见下文。；null 等同省略。 | 聊天接收者或群 ID，须与 chat_account 一同提供。 |
| `email_to` | string / null | 否（可能条件必填） | 不向 API 提供，条件规则见下文。；null 等同省略。 | 逗号分隔邮件收件人。 |
| `enabled` | boolean / null | 否（可能条件必填） | true；null 等同省略。 | 存储的启用标志，upsert 默认 true，切换工具必须提供布尔值。 |
| `kind` | string | 是 | 无默认值，缺失或 null 无效。 | 告警类型 endpoint_errors \| schedule_failures。 |
| `name` | string | 是 | 无默认值，缺失或 null 无效。 | 精确资产名；身份与文件夹规则见本页说明。 |
| `project` | string / null | 否（可能条件必填） | VIAT_PROJECT / current_project；否则 project_required；null 等同省略。 | 项目 slug；省略或 null 使用 VIAT_PROJECT/current_project，否则 project_required。 |
| `push_resource` | string / null | 否（可能条件必填） | 不向 API 提供，条件规则见下文。；null 等同省略。 | 现有 push 资源名或限定路径。 |
| `threshold` | integer | 是 | 无默认值，缺失或 null 无效。 | format: "int64"; 失败阈值 >=1，API 为 int32。 |
| `webhook_url` | string / null | 否（可能条件必填） | 不向 API 提供，条件规则见下文。；null 等同省略。 | webhook 渠道的 HTTP/HTTPS 目标。 |
| `window_secs` | integer / null | 否（可能条件必填） | null；条件规则见下文；null 等同省略。 | format: "int64"; endpoint_errors 必填且 >=60，schedule_failures 禁止提供。 |

## 行为与验证

先列出规则决定 POST/PUT，保存后再读列表。需提供完整替换配置，enabled 默认 true。`kind:endpoint_errors` 需 `window_secs` >=60；`schedule_failures` 不能带窗口。`threshold` >=1（API 为 int32）。必须有且仅有一个与 `channel_kind` 匹配的目标：`webhook` 需 http/https 的 `webhook_url`；`chat` 同时需要现有 `chat_account` 名及 `chat_id`；`email` 需非空逗号分隔 `email_to`，保存时就需要 SMTP；`push` 需现有 `push_resource` 名或限定路径。混合目标会被拒绝，不会静默丢弃。

规则名不能全为空白。email 规则即使禁用，保存时也必须配置 SMTP，并验证收件地址。WeCom 账号无法接收此类主动告警，会被拒绝；可改用 webhook 或支持的 Feishu/Lark/DingTalk 账号。WeChat 允许保存，但投递取决于接收者近期消息所授予的发送许可。push 保存会验证资源引用和类型，并固定限定文件夹，但不验证提供方凭据或证明手机收到。

## 输出与分页

返回重读列表构造的 `{created:boolean,alert:Alert}`。 告警对象包含字符串 `name`、`kind`、`channel_kind`、`state`、`state_since`、`updated_at`，布尔值 `enabled`，整数 `threshold`，可选整数 `window_secs`，可选字符串 `webhook_url`、`chat_id`、`email_to`、`push_resource`、`last_notified_at`、`last_error`，以及可选 JSON 值 `chat_account`（当前为解析后的账号名）。可选字段为 null 时省略。非发布者看到的现有 webhook URL 为 `[redacted]`。

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
    "name": "upsert_alert",
    "arguments": {
      "project": "mcp-lab",
      "name": "mcp_alert",
      "enabled": false,
      "kind": "endpoint_errors",
      "threshold": 5,
      "window_secs": 300,
      "channel_kind": "webhook",
      "webhook_url": "http://127.0.0.1:9999/alert-stub"
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
        "text": "{\"created\":true,\"alert\":{\"name\":\"mcp_alert\",\"enabled\":false,\"kind\":\"endpoint_errors\",\"threshold\":5,\"window_secs\":300,\"channel_kind\":\"webhook\",\"webhook_url\":\"http://127.0.0.1:9999/alert-stub\",\"state\":\"ok\",\"state_since\":\"2026-01-01T00:00:00Z\",\"updated_at\":\"2026-01-01T00:00:00Z\"}}"
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
  "alert": {
    "name": "mcp_alert",
    "enabled": false,
    "kind": "endpoint_errors",
    "threshold": 5,
    "window_secs": 300,
    "channel_kind": "webhook",
    "webhook_url": "http://127.0.0.1:9999/alert-stub",
    "state": "ok",
    "state_since": "2026-01-01T00:00:00Z",
    "updated_at": "2026-01-01T00:00:00Z"
  }
}
```

## 失败与恢复

缺失、混合或类型不匹配的目标返回本地 `bad_input`；无效窗口、收件人、缺失聊天或 push 资源返回上游错误。写后重读可能在规则已保存后失败，重试前用 `list_alerts` 核对。

所有上游工具都可能因令牌过期或撤销、PAT 范围、项目权限、激活、网络或超时失败。无项目及默认值时为 `project_required`；控制面非 2xx 为 `http_4xx`/`http_5xx`。详见 [公共错误外层及重试规则](overview.md)。输入反序列化或未知工具可能在进入工具层前成为 JSON-RPC 协议错误，不要假定每个失败都有 isError。retryable 标志不保证幂等。

## 副作用、验证与清理

可能启用真实通知（默认 true），不是只验证模式。示例禁用，并指向 API 主机上由操作者控制的本地 stub，不要使用公共提供方 URL。新夹具用 `delete_alert`；现有规则先保存并恢复完整配置，包括启用状态。禁用无法收回已发送消息。

验证应以观察为主：检查本文结果字段，获准修改前后使用对应读取工具。不要通过生产请求或删除无关对象来验证。

## 维护依据

输入清单：`contracts/1.1.0/mcp-tools.json`，工具 `upsert_alert`. 固定产品源码中的实现和测试： `alerts.rs; handlers/alerts.rs; tests/it/tool_upsert_alert.rs`. 工具模块文件名相对 `crates/viat-mcp/src/tools/`，API handler 相对 `crates/viat-api/src/handlers/`。公共传输和错误依据为 `crates/viat-mcp/src/tools/service.rs`、`http.rs`、`error.rs`；本次仅阅读测试，没有运行测试。
