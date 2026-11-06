---
title: "test_run_script — 执行脚本草稿"
description: "不发布，直接以同步或分离模式运行实时草稿。"
doc_id: mcp.test_run_script
verified_release: '1.1.0'
channel: stable
contract_ids: [mcp.test_run_script]
---

# `test_run_script` — 执行脚本草稿

不发布，直接以同步或分离模式运行实时草稿。

适用于稳定版 Viat 1.1.0。先阅读 [MCP 配置与结果处理](overview.md)。以下为合成的、从源码推导的预期形状，**不是已执行的响应**。编写本页没有访问服务、提供方或设备。

## 前提与权限

需要编辑权限：项目 Owner、Admin 或 Developer；Viewer 被拒绝。PAT 所有者须具有该项目角色，且 PAT 范围允许访问该路由。

使用已激活的隔离实例，配置服务器和 bearer；除 list_projects 外须有 `mcp-lab` 项目。示例中的现有资产和 ID 以概览夹具为前提，用夹具实际返回 ID 替换合成 ID；示例不会自行创建依赖。

## 完整输入字段

必填表示导出输入合约的结构要求，不等于完整条件 API 验证。可选字段的显式 JSON null 与省略同样反序列化，包括未限定类型的 JSON 字段。空字符串、数组或对象是实际值，不是省略。数值 format 表示序列化边界，运行时限制和默认值另算。args 的模式 `default:null` 不等于其运行时默认 `{}`。

| 字段 | 类型 | 必填 | 省略 / 显式 null | 约束和含义 |
| --- | --- | --- | --- | --- |
| `args` | object / null | 否（可能条件必填） | {}；null 等同省略。 | default: null; 脚本输入对象，省略或 null 变为 {}。 |
| `folder` | string / null | 否（可能条件必填） | 不向 API 提供，条件规则见下文。；null 等同省略。 | 资源、脚本或工作流文件夹路径，空字符串选根目录，省略或 null 使用名称查找。非空路径最多 255 字节、8 层，各段为 [A-Za-z0-9_-]+，不能有开头、末尾或重复斜杠。 |
| `name` | string | 是 | 无默认值，缺失或 null 无效。 | 精确资产名；身份与文件夹规则见本页说明。 |
| `project` | string / null | 否（可能条件必填） | VIAT_PROJECT / current_project；否则 project_required；null 等同省略。 | 项目 slug；省略或 null 使用 VIAT_PROJECT/current_project，否则 project_required。 |
| `record` | boolean / null | 否（可能条件必填） | false；null 等同省略。 | 同步运行记录资源调用，默认 false。 |
| `run_async` | boolean / null | 否（可能条件必填） | false；null 等同省略。 | 分离运行，默认 false。 |
| `timeout_ms` | integer / null | 否（可能条件必填） | 30000; 范围 1000..60000；null 等同省略。 | minimum: 0; format: "uint64"; HTTP 等待毫秒数，默认与范围见本页说明。 |

## 行为与验证

`args` 省略或 null 变为 `{}`；`run_async` 与 `record` 默认 false。超时默认 30000 ms，限制为 1000..60000；这是 HTTP 等待超时，不是脚本超时或取消保证。`record` 仅在同步模式记录资源调用。测试绕过端点授权器，以平台身份运行，而非端点用户。

## 输出与分页

始终包含 `is_async:boolean`、`request_id:string`。分离模式另有可选字符串 `run_id`、`status`，然后通过 `read_async_run` 轮询。同步模式有可选 `ok:boolean`、JSON 值 `output`、字符串 `stdout`、`stderr`、`execution_log_id`、JSON 值 `recorded`、`error`。可选值为 null 或缺失时省略。MCP 把 API 的 `async` 键改名为 `is_async`。

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
    "name": "test_run_script",
    "arguments": {
      "project": "mcp-lab",
      "name": "mcp_demo",
      "folder": "",
      "args": {}
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
        "text": "{\"is_async\":false,\"request_id\":\"00000000-0000-4000-8000-000000000001\",\"ok\":true,\"output\":{\"ok\":true},\"stdout\":\"\",\"stderr\":\"\",\"execution_log_id\":\"00000000-0000-4000-8000-000000000001\"}"
      }
    ],
    "isError": false
  }
}
```

文本块内解码后的 JSON 值：

```json
{
  "is_async": false,
  "request_id": "00000000-0000-4000-8000-000000000001",
  "ok": true,
  "output": {
    "ok": true
  },
  "stdout": "",
  "stderr": "",
  "execution_log_id": "00000000-0000-4000-8000-000000000001"
}
```

## 失败与恢复

脚本运行失败通常仍是 MCP 成功结果，用 `ok:false` 和 `error` 表达，而非 `isError:true`。HTTP、认证、传输失败仍是工具错误。客户端超时不证明执行已停止；重放写操作前先查看日志。

所有上游工具都可能因令牌过期或撤销、PAT 范围、项目权限、激活、网络或超时失败。无项目及默认值时为 `project_required`；控制面非 2xx 为 `http_4xx`/`http_5xx`。详见 [公共错误外层及重试规则](overview.md)。输入反序列化或未知工具可能在进入工具层前成为 JSON-RPC 协议错误，不要假定每个失败都有 isError。retryable 标志不保证幂等。

## 副作用、验证与清理

执行真实代码，可能写库、发送消息并生成执行日志。仅使用本页无资源的惰性 `mcp_demo` 夹具。移除引用后删除夹具；外部副作用需单独明确回滚，删除日志不会撤销副作用。

验证应以观察为主：检查本文结果字段，获准修改前后使用对应读取工具。不要通过生产请求或删除无关对象来验证。

## 维护依据

输入清单：`contracts/1.1.0/mcp-tools.json`，工具 `test_run_script`. 固定产品源码中的实现和测试： `scripts.rs; handlers/scripts.rs; tests/it/tool_test_run_script.rs`. 工具模块文件名相对 `crates/viat-mcp/src/tools/`，API handler 相对 `crates/viat-api/src/handlers/`。公共传输和错误依据为 `crates/viat-mcp/src/tools/service.rs`、`http.rs`、`error.rs`；本次仅阅读测试，没有运行测试。
