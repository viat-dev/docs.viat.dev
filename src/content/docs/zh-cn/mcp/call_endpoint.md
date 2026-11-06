---
title: "call_endpoint — 调用已发布端点"
description: "通过项目路由发送真实 HTTP 请求，查看状态、响应头和正文。"
doc_id: mcp.call_endpoint
verified_release: '1.1.0'
channel: stable
contract_ids: [mcp.call_endpoint]
---

# `call_endpoint` — 调用已发布端点

通过项目路由发送真实 HTTP 请求，查看状态、响应头和正文。

适用于稳定版 Viat 1.1.0。先阅读 [MCP 配置与结果处理](overview.md)。以下为合成的、从源码推导的预期形状，**不是已执行的响应**。编写本页没有访问服务、提供方或设备。

## 前提与权限

配置的 bearer 会转发到 `/p/{project}{path}`，由端点已发布的授权器和授权门决定是否放行。控制面读取成功不代表可以调用端点。项目 PAT 仍受项目范围限制，不能假定它是端点接受的项目用户凭据。

使用已激活的隔离实例，配置服务器和 bearer；除 list_projects 外须有 `mcp-lab` 项目。示例中的现有资产和 ID 以概览夹具为前提，用夹具实际返回 ID 替换合成 ID；示例不会自行创建依赖。

## 完整输入字段

必填表示导出输入合约的结构要求，不等于完整条件 API 验证。可选字段的显式 JSON null 与省略同样反序列化，包括未限定类型的 JSON 字段。空字符串、数组或对象是实际值，不是省略。数值 format 表示序列化边界，运行时限制和默认值另算。args 的模式 `default:null` 不等于其运行时默认 `{}`。

| 字段 | 类型 | 必填 | 省略 / 显式 null | 约束和含义 |
| --- | --- | --- | --- | --- |
| `body` | JSON (any value) | 否（可能条件必填） | 不发送正文；null 等同省略。 | JSON 正文，省略或 null 不发送正文。 |
| `headers` | object / null | 否（可能条件必填） | 无额外请求头；null 等同省略。 | 请求头映射，应使用字符串值。 |
| `method` | string | 是 | 无默认值，缺失或 null 无效。 | HTTP method，支持值和条件必填规则见下文。 |
| `path` | string | 是 | 无默认值，缺失或 null 无效。 | 项目内以 / 开始的路径，可带查询字符串。 |
| `project` | string / null | 否（可能条件必填） | VIAT_PROJECT / current_project；否则 project_required；null 等同省略。 | 项目 slug；省略或 null 使用 VIAT_PROJECT/current_project，否则 project_required。 |
| `timeout_ms` | integer / null | 否（可能条件必填） | 10000; 上限 60000；null 等同省略。 | minimum: 0; format: "uint64"; HTTP 等待毫秒数，默认与范围见本页说明。 |

## 行为与验证

`path` 必须以 `/` 开始，查询参数附在 path 中。`method` 必须是合法 HTTP token，不限于创建端点的枚举。`headers` 是对象，应使用字符串值；实现把非字符串变为空字符串。仍会附带配置的 Authorization，不能依赖 headers 安全切换身份。`body` 省略或 null 表示不发送 JSON 正文，不是发送 JSON null。超时默认 10000 ms，上限 60000，MCP 不设下限。响应先读取，再截断到 1 MiB，然后尝试解析 JSON，否则使用有损 UTF-8 字符串。

## 输出与分页

返回 `{status:integer,headers:object<string,string>,body:JSON,truncated:boolean}`，重复响应头会合并为单项。端点 4xx/5xx 通常仍是 MCP 普通成功结果，必须检查 `status`。JSON 截断后可能变成字符串。

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
    "name": "call_endpoint",
    "arguments": {
      "project": "mcp-lab",
      "method": "GET",
      "path": "/mcp-demo"
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
        "text": "{\"status\":200,\"headers\":{\"content-type\":\"application/json\"},\"body\":{\"ok\":true},\"truncated\":false}"
      }
    ],
    "isError": false
  }
}
```

文本块内解码后的 JSON 值：

```json
{
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "body": {
    "ok": true
  },
  "truncated": false
}
```

## 失败与恢复

无效路径、method 或头返回 `bad_input`；超时为 `upstream_timeout`。状态透传的例外是含 JSON `error:"license_required"` 的 403，会变为 MCP 错误。不支持 WebSocket 升级或流式会话。

所有上游工具都可能因令牌过期或撤销、PAT 范围、项目权限、激活、网络或超时失败。无项目及默认值时为 `project_required`；控制面非 2xx 为 `http_4xx`/`http_5xx`。详见 [公共错误外层及重试规则](overview.md)。输入反序列化或未知工具可能在进入工具层前成为 JSON-RPC 协议错误，不要假定每个失败都有 isError。retryable 标志不保证幂等。

## 副作用、验证与清理

这不是 dry run：任何 method 都可能按脚本逻辑写库、发送消息或调用提供方。示例假设隔离环境中已有无外部资源的已发布 GET 夹具，返回 `{ok:true}`。仅对该夹具操作，结束后下线并删除。超时不等于取消，自动重试可能重复副作用。

验证应以观察为主：检查本文结果字段，获准修改前后使用对应读取工具。不要通过生产请求或删除无关对象来验证。

## 维护依据

输入清单：`contracts/1.1.0/mcp-tools.json`，工具 `call_endpoint`. 固定产品源码中的实现和测试： `call.rs; http.rs; tests/it/tool_call_endpoint.rs; tests/it/tool_publish.rs`. 工具模块文件名相对 `crates/viat-mcp/src/tools/`，API handler 相对 `crates/viat-api/src/handlers/`。公共传输和错误依据为 `crates/viat-mcp/src/tools/service.rs`、`http.rs`、`error.rs`；本次仅阅读测试，没有运行测试。
