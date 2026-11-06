---
title: "list_recent_runs — 列出近期端点执行"
description: "按 HTTP 状态、精确路径或脚本筛选执行摘要并向前翻页。"
doc_id: mcp.list_recent_runs
verified_release: '1.1.0'
channel: stable
contract_ids: [mcp.list_recent_runs]
---

# `list_recent_runs` — 列出近期端点执行

按 HTTP 状态、精确路径或脚本筛选执行摘要并向前翻页。

适用于稳定版 Viat 1.1.0。先阅读 [MCP 配置与结果处理](overview.md)。以下为合成的、从源码推导的预期形状，**不是已执行的响应**。编写本页没有访问服务、提供方或设备。

## 前提与权限

需要所选项目的成员身份（任意项目角色，包括 Viewer）。平台角色不等同于项目成员身份。PAT 必须有效且其范围允许访问该路由。

使用已激活的隔离实例，配置服务器和 bearer；除 list_projects 外须有 `mcp-lab` 项目。示例中的现有资产和 ID 以概览夹具为前提，用夹具实际返回 ID 替换合成 ID；示例不会自行创建依赖。

## 完整输入字段

必填表示导出输入合约的结构要求，不等于完整条件 API 验证。可选字段的显式 JSON null 与省略同样反序列化，包括未限定类型的 JSON 字段。空字符串、数组或对象是实际值，不是省略。数值 format 表示序列化边界，运行时限制和默认值另算。args 的模式 `default:null` 不等于其运行时默认 `{}`。

| 字段 | 类型 | 必填 | 省略 / 显式 null | 约束和含义 |
| --- | --- | --- | --- | --- |
| `before` | string / null | 否（可能条件必填） | 不向 API 提供，条件规则见下文。；null 等同省略。 | 分页游标，本页说明其来源和格式。 |
| `limit` | integer / null | 否（可能条件必填） | 20; 上限 200；null 等同省略。 | minimum: 0; format: "uint32"; 页大小，实际默认与边界见下文。 |
| `path_eq` | string / null | 否（可能条件必填） | 不向 API 提供，条件规则见下文。；null 等同省略。 | 精确路径筛选，不是前缀。 |
| `project` | string / null | 否（可能条件必填） | VIAT_PROJECT / current_project；否则 project_required；null 等同省略。 | 项目 slug；省略或 null 使用 VIAT_PROJECT/current_project，否则 project_required。 |
| `script` | string / null | 否（可能条件必填） | 不向 API 提供，条件规则见下文。；null 等同省略。 | 执行脚本名称筛选。 |
| `status_max` | integer / null | 否（可能条件必填） | 不向 API 提供，条件规则见下文。；null 等同省略。 | minimum: 0; maximum: 65535; format: "uint16"; 包含边界的最大状态筛选，uint16。 |
| `status_min` | integer / null | 否（可能条件必填） | 不向 API 提供，条件规则见下文。；null 等同省略。 | minimum: 0; maximum: 65535; format: "uint16"; 包含边界的最小状态筛选，uint16。 |

## 行为与验证

`status_min` 与 `status_max` 为包含边界的 uint16 筛选；`path_eq` 是精确匹配，不是前缀。`script` 为名称。limit 默认 20，MCP 上限 200；零值会传给 API，本地不设下限。缺失或 null 的筛选不进入查询。

## 输出与分页

返回 `{items:Run[],next_before?:string}`。Run 含字符串 `request_id`、`created_at`、`method`、`path`，整数 `status`、`latency_ms`，可选字符串 `error_kind`、`error_message`、`workflow_name`。缺失的可选值和游标会省略。

将返回的 `next_before` 作为 `before`，保持筛选条件不变。字段省略时停止，不要自造时间戳游标或假定满页必有下一页。

值会序列化成 JSON，放进一个 MCP `content` 文本块。请把 `result.content[0].text` 解析为 JSON。不承诺 `structuredContent` 或 `outputSchema`；注明省略的可选字段不能假定以 null 存在。

## 合成请求与预期形状

完成 MCP initialize/initialized 后，通过 stdio 以单行 JSON 发送此 tools/call 请求（此处格式化仅为便于阅读）。

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "list_recent_runs",
    "arguments": {
      "project": "mcp-lab",
      "limit": 20,
      "status_min": 500
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
        "text": "{\"items\":[]}"
      }
    ],
    "isError": false
  }
}
```

文本块内解码后的 JSON 值：

```json
{
  "items": []
}
```

## 失败与恢复

格式错误的筛选或游标可能被上游拒绝。这是执行历史，不是健康保证；历史缺失也可能由保留策略或日志策略造成。

所有上游工具都可能因令牌过期或撤销、PAT 范围、项目权限、激活、网络或超时失败。无项目及默认值时为 `project_required`；控制面非 2xx 为 `http_4xx`/`http_5xx`。详见 [公共错误外层及重试规则](overview.md)。输入反序列化或未知工具可能在进入工具层前成为 JSON-RPC 协议错误，不要假定每个失败都有 isError。retryable 标志不保证幂等。

## 副作用、验证与清理

只读：不修改资产，无需清理。请保护返回的源码、日志和标识符。

验证应以观察为主：检查本文结果字段，获准修改前后使用对应读取工具。不要通过生产请求或删除无关对象来验证。

## 维护依据

输入清单：`contracts/1.1.0/mcp-tools.json`，工具 `list_recent_runs`. 固定产品源码中的实现和测试： `executions.rs; handlers/logs.rs; tests/it/tool_list_recent_runs.rs`. 工具模块文件名相对 `crates/viat-mcp/src/tools/`，API handler 相对 `crates/viat-api/src/handlers/`。公共传输和错误依据为 `crates/viat-mcp/src/tools/service.rs`、`http.rs`、`error.rs`；本次仅阅读测试，没有运行测试。
