---
title: "read_logs — 读取执行记录和行日志"
description: "读取一个请求的原始执行摘要及有上限的输出行。"
doc_id: mcp.read_logs
verified_release: '1.1.0'
channel: stable
contract_ids: [mcp.read_logs]
---

# `read_logs` — 读取执行记录和行日志

读取一个请求的原始执行摘要及有上限的输出行。

适用于稳定版 Viat 1.1.0。先阅读 [MCP 配置与结果处理](overview.md)。以下为合成的、从源码推导的预期形状，**不是已执行的响应**。编写本页没有访问服务、提供方或设备。

## 前提与权限

需要所选项目的成员身份（任意项目角色，包括 Viewer）。平台角色不等同于项目成员身份。PAT 必须有效且其范围允许访问该路由。

使用已激活的隔离实例，配置服务器和 bearer；除 list_projects 外须有 `mcp-lab` 项目。示例中的现有资产和 ID 以概览夹具为前提，用夹具实际返回 ID 替换合成 ID；示例不会自行创建依赖。

## 完整输入字段

必填表示导出输入合约的结构要求，不等于完整条件 API 验证。可选字段的显式 JSON null 与省略同样反序列化，包括未限定类型的 JSON 字段。空字符串、数组或对象是实际值，不是省略。数值 format 表示序列化边界，运行时限制和默认值另算。args 的模式 `default:null` 不等于其运行时默认 `{}`。

| 字段 | 类型 | 必填 | 省略 / 显式 null | 约束和含义 |
| --- | --- | --- | --- | --- |
| `line_limit` | integer / null | 否（可能条件必填） | 500; 上限 2000；null 等同省略。 | minimum: 0; format: "uint"; 返回日志行数，默认 500，上限 2000。 |
| `project` | string / null | 否（可能条件必填） | VIAT_PROJECT / current_project；否则 project_required；null 等同省略。 | 项目 slug；省略或 null 使用 VIAT_PROJECT/current_project，否则 project_required。 |
| `request_id` | string | 是 | 无默认值，缺失或 null 无效。 | 供 read_logs 使用的执行请求 UUID。 |

## 行为与验证

`request_id` 是执行请求 UUID，不是脚本 ID 或异步 run ID。`line_limit` 默认 500、上限 2000；零返回零行。MCP 先获取 API 返回的完整行数组，再截断。

## 输出与分页

返回 `{execution:JSON,lines:Line[],truncated:boolean,total_lines:integer}`。Line 含整数 `seq`、字符串 `stream`、`content`、可选字符串 `step_id`（为 null 时省略）。`execution` 为 API 的 ExecutionLog：ID 字段 `id`、`project_id`、`request_id`；字符串 `method`、`path`、`principal_kind`、`created_at`；整数 `status`、`latency_ms`；布尔值 `is_test`、`cache_hit`；可为 null 的 `endpoint_node_id`、`project_user_id`、`authorizer_id`、`ip`、`error_kind`、`error_message`、`workflow_id`、`workflow_name`、`workflow_version`、`target_kind`、`target_ref`。UUID 和时间戳为字符串，非空 `workflow_version` 为整数。

无游标。`truncated:true` 仅表示返回行数超过 `line_limit`，可提高到 2000；不支持后续页。

值会序列化成 JSON，放进一个 MCP `content` 文本块。请把 `result.content[0].text` 解析为 JSON。不承诺 `structuredContent` 或 `outputSchema`；注明省略的可选字段不能假定以 null 存在。

## 合成请求与预期形状

完成 MCP initialize/initialized 后，通过 stdio 以单行 JSON 发送此 tools/call 请求（此处格式化仅为便于阅读）。

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "read_logs",
    "arguments": {
      "project": "mcp-lab",
      "request_id": "00000000-0000-4000-8000-000000000001",
      "line_limit": 500
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
        "text": "{\"execution\":{\"id\":\"00000000-0000-4000-8000-000000000001\",\"project_id\":\"00000000-0000-4000-8000-000000000001\",\"request_id\":\"00000000-0000-4000-8000-000000000001\",\"endpoint_node_id\":null,\"method\":\"GET\",\"path\":\"/mcp-demo\",\"status\":200,\"latency_ms\":1,\"principal_kind\":\"anonymous\",\"project_user_id\":null,\"authorizer_id\":null,\"ip\":null,\"error_kind\":null,\"error_message\":null,\"workflow_id\":null,\"workflow_name\":null,\"workflow_version\":null,\"is_test\":false,\"target_kind\":\"script\",\"target_ref\":\"mcp_demo\",\"cache_hit\":false,\"created_at\":\"2026-01-01T00:00:00Z\"},\"lines\":[],\"truncated\":false,\"total_lines\":0}"
      }
    ],
    "isError": false
  }
}
```

文本块内解码后的 JSON 值：

```json
{
  "execution": {
    "id": "00000000-0000-4000-8000-000000000001",
    "project_id": "00000000-0000-4000-8000-000000000001",
    "request_id": "00000000-0000-4000-8000-000000000001",
    "endpoint_node_id": null,
    "method": "GET",
    "path": "/mcp-demo",
    "status": 200,
    "latency_ms": 1,
    "principal_kind": "anonymous",
    "project_user_id": null,
    "authorizer_id": null,
    "ip": null,
    "error_kind": null,
    "error_message": null,
    "workflow_id": null,
    "workflow_name": null,
    "workflow_version": null,
    "is_test": false,
    "target_kind": "script",
    "target_ref": "mcp_demo",
    "cache_hit": false,
    "created_at": "2026-01-01T00:00:00Z"
  },
  "lines": [],
  "truncated": false,
  "total_lines": 0
}
```

## 失败与恢复

格式正确但不存在的 UUID 返回 404。`total_lines` 统计配置日志后端返回的数组，不保证过期或外部日志仍存在。本工具不暴露工作流步骤日志或 spans。

所有上游工具都可能因令牌过期或撤销、PAT 范围、项目权限、激活、网络或超时失败。无项目及默认值时为 `project_required`；控制面非 2xx 为 `http_4xx`/`http_5xx`。详见 [公共错误外层及重试规则](overview.md)。输入反序列化或未知工具可能在进入工具层前成为 JSON-RPC 协议错误，不要假定每个失败都有 isError。retryable 标志不保证幂等。

## 副作用、验证与清理

只读：不修改资产，无需清理。请保护返回的源码、日志和标识符。

验证应以观察为主：检查本文结果字段，获准修改前后使用对应读取工具。不要通过生产请求或删除无关对象来验证。

## 维护依据

输入清单：`contracts/1.1.0/mcp-tools.json`，工具 `read_logs`. 固定产品源码中的实现和测试： `executions.rs; handlers/logs.rs; core/types/log.rs; tests/it/tool_read_logs.rs`. 工具模块文件名相对 `crates/viat-mcp/src/tools/`，API handler 相对 `crates/viat-api/src/handlers/`。公共传输和错误依据为 `crates/viat-mcp/src/tools/service.rs`、`http.rs`、`error.rs`；本次仅阅读测试，没有运行测试。
