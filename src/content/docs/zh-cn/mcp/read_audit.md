---
title: "read_audit — 读取控制面审计记录"
description: "按操作者和时间查看谁修改了项目配置，并使用成对游标翻页。"
doc_id: mcp.read_audit
verified_release: '1.1.0'
channel: stable
contract_ids: [mcp.read_audit]
---

# `read_audit` — 读取控制面审计记录

按操作者和时间查看谁修改了项目配置，并使用成对游标翻页。

适用于稳定版 Viat 1.1.0。先阅读 [MCP 配置与结果处理](overview.md)。以下为合成的、从源码推导的预期形状，**不是已执行的响应**。编写本页没有访问服务、提供方或设备。

## 前提与权限

需要发布权限：项目 Owner 或 Admin；Developer 和 Viewer 被拒绝。PAT 所有者须具有该项目角色，且 PAT 范围允许访问该路由。

使用已激活的隔离实例，配置服务器和 bearer；除 list_projects 外须有 `mcp-lab` 项目。示例中的现有资产和 ID 以概览夹具为前提，用夹具实际返回 ID 替换合成 ID；示例不会自行创建依赖。

## 完整输入字段

必填表示导出输入合约的结构要求，不等于完整条件 API 验证。可选字段的显式 JSON null 与省略同样反序列化，包括未限定类型的 JSON 字段。空字符串、数组或对象是实际值，不是省略。数值 format 表示序列化边界，运行时限制和默认值另算。args 的模式 `default:null` 不等于其运行时默认 `{}`。

| 字段 | 类型 | 必填 | 省略 / 显式 null | 约束和含义 |
| --- | --- | --- | --- | --- |
| `actor` | string / null | 否（可能条件必填） | 不向 API 提供，条件规则见下文。；null 等同省略。 | 审计操作者邮箱或系统主体筛选。 |
| `before` | string / null | 否（可能条件必填） | 不向 API 提供，条件规则见下文。；null 等同省略。 | 分页游标，本页说明其来源和格式。 |
| `before_id` | string / null | 否（可能条件必填） | 不向 API 提供，条件规则见下文。；null 等同省略。 | 与 before 配对的审计 ID 游标。 |
| `limit` | integer / null | 否（可能条件必填） | 100; 范围 1..500；null 等同省略。 | format: "int64"; 页大小，实际默认与边界见下文。 |
| `project` | string / null | 否（可能条件必填） | VIAT_PROJECT / current_project；否则 project_required；null 等同省略。 | 项目 slug；省略或 null 使用 VIAT_PROJECT/current_project，否则 project_required。 |
| `since` | string / null | 否（可能条件必填） | 不向 API 提供，条件规则见下文。；null 等同省略。 | 包含边界的 RFC3339 起始时间。 |

## 行为与验证

这是平台控制面审计，不是业务数据库行审计。`actor` 筛选操作者邮箱或系统主体；`since` 是包含边界的 RFC3339 时间。limit 默认 100，范围 1..500。`before` 与 `before_id` 必须同时提供或同时省略，单边游标在本地失败。

## 输出与分页

返回 `{entries:JSON[],next_before?:string,next_before_id?:string}`。条目透传 API AuditEntry：UUID 字符串 `id`，时间戳 `at`，字符串 `method`、`path`，整数 `status`，以及可为 null 的字符串 `actor_user_id`（UUID）、`actor_email`、`actor_ip`、`project_slug`、`detail`。MCP 省略缺失的续页字段。

同时复制 `next_before` → `before` 和 `next_before_id` → `before_id`，保留筛选条件。未返回游标对时停止；ID 用于区分相同时间戳。

值会序列化成 JSON，放进一个 MCP `content` 文本块。请把 `result.content[0].text` 解析为 JSON。不承诺 `structuredContent` 或 `outputSchema`；注明省略的可选字段不能假定以 null 存在。

## 合成请求与预期形状

完成 MCP initialize/initialized 后，通过 stdio 以单行 JSON 发送此 tools/call 请求（此处格式化仅为便于阅读）。

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "read_audit",
    "arguments": {
      "project": "mcp-lab",
      "limit": 100,
      "actor": "operator@example.invalid"
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
        "text": "{\"entries\":[]}"
      }
    ],
    "isError": false
  }
}
```

文本块内解码后的 JSON 值：

```json
{
  "entries": []
}
```

## 失败与恢复

单边游标返回 `bad_input`；时间戳或 UUID 格式错误为上游 400；无发布权限为 403。审计保留限制可用历史，记录缺失不能证明未发生业务数据写入。

所有上游工具都可能因令牌过期或撤销、PAT 范围、项目权限、激活、网络或超时失败。无项目及默认值时为 `project_required`；控制面非 2xx 为 `http_4xx`/`http_5xx`。详见 [公共错误外层及重试规则](overview.md)。输入反序列化或未知工具可能在进入工具层前成为 JSON-RPC 协议错误，不要假定每个失败都有 isError。retryable 标志不保证幂等。

## 副作用、验证与清理

只读：不修改资产，无需清理。请保护返回的源码、日志和标识符。

验证应以观察为主：检查本文结果字段，获准修改前后使用对应读取工具。不要通过生产请求或删除无关对象来验证。

## 维护依据

输入清单：`contracts/1.1.0/mcp-tools.json`，工具 `read_audit`. 固定产品源码中的实现和测试： `audit.rs; handlers/audit.rs; db/src/audit.rs; tests/it/tool_read_audit.rs`. 工具模块文件名相对 `crates/viat-mcp/src/tools/`，API handler 相对 `crates/viat-api/src/handlers/`。公共传输和错误依据为 `crates/viat-mcp/src/tools/service.rs`、`http.rs`、`error.rs`；本次仅阅读测试，没有运行测试。
