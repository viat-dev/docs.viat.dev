---
title: "validate_workflow — 验证工作流但不保存"
description: "替换存储定义前检查 YAML 解析和工作流结构。"
doc_id: mcp.validate_workflow
verified_release: '1.1.0'
channel: stable
contract_ids: [mcp.validate_workflow]
---

# `validate_workflow` — 验证工作流但不保存

替换存储定义前检查 YAML 解析和工作流结构。

适用于稳定版 Viat 1.1.0。先阅读 [MCP 配置与结果处理](overview.md)。以下为合成的、从源码推导的预期形状，**不是已执行的响应**。编写本页没有访问服务、提供方或设备。

## 前提与权限

需要编辑权限：项目 Owner、Admin 或 Developer；Viewer 被拒绝。PAT 所有者须具有该项目角色，且 PAT 范围允许访问该路由。

使用已激活的隔离实例，配置服务器和 bearer；除 list_projects 外须有 `mcp-lab` 项目。示例中的现有资产和 ID 以概览夹具为前提，用夹具实际返回 ID 替换合成 ID；示例不会自行创建依赖。

## 完整输入字段

必填表示导出输入合约的结构要求，不等于完整条件 API 验证。可选字段的显式 JSON null 与省略同样反序列化，包括未限定类型的 JSON 字段。空字符串、数组或对象是实际值，不是省略。数值 format 表示序列化边界，运行时限制和默认值另算。args 的模式 `default:null` 不等于其运行时默认 `{}`。

| 字段 | 类型 | 必填 | 省略 / 显式 null | 约束和含义 |
| --- | --- | --- | --- | --- |
| `definition` | string | 是 | 无默认值，缺失或 null 无效。 | 完整工作流 YAML 文本，不是文件路径。 |
| `name` | string | 是 | 无默认值，缺失或 null 无效。 | 精确资产名；身份与文件夹规则见本页说明。 |
| `project` | string / null | 否（可能条件必填） | VIAT_PROJECT / current_project；否则 project_required；null 等同省略。 | 项目 slug；省略或 null 使用 VIAT_PROJECT/current_project，否则 project_required。 |

## 行为与验证

`name` 是验证路由所需参数，但无需对应现有工作流；检查对象是 `definition`。POST 仅发送定义。虽然不保存，仍需编辑权限。

## 输出与分页

返回 `{ok:boolean,code?:string,message?:string}`。YAML 或结构无效时通常 HTTP 200，用普通结果的 `ok:false` 表达，不自动成为工具错误。

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
    "name": "validate_workflow",
    "arguments": {
      "project": "mcp-lab",
      "name": "mcp_flow",
      "definition": "inputs:\nsteps:\n  - id: hello\n    script: mcp_demo\n    args: {}\noutputs:\n  result: \"$hello.output\"\n"
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
        "text": "{\"ok\":true}"
      }
    ],
    "isError": false
  }
}
```

文本块内解码后的 JSON 值：

```json
{
  "ok": true
}
```

## 失败与恢复

写入前检查 `ok`。传输和认证失败与验证不通过不同。验证不会试运行脚本，也不能证明资源可达。

所有上游工具都可能因令牌过期或撤销、PAT 范围、项目权限、激活、网络或超时失败。无项目及默认值时为 `project_required`；控制面非 2xx 为 `http_4xx`/`http_5xx`。详见 [公共错误外层及重试规则](overview.md)。输入反序列化或未知工具可能在进入工具层前成为 JSON-RPC 协议错误，不要假定每个失败都有 isError。retryable 标志不保证幂等。

## 副作用、验证与清理

不保存、不执行脚本，无需清理；验证成功不会发布任何内容。

验证应以观察为主：检查本文结果字段，获准修改前后使用对应读取工具。不要通过生产请求或删除无关对象来验证。

## 维护依据

输入清单：`contracts/1.1.0/mcp-tools.json`，工具 `validate_workflow`. 固定产品源码中的实现和测试： `workflows.rs; handlers/workflows.rs; tests/it/tool_validate_workflow.rs`. 工具模块文件名相对 `crates/viat-mcp/src/tools/`，API handler 相对 `crates/viat-api/src/handlers/`。公共传输和错误依据为 `crates/viat-mcp/src/tools/service.rs`、`http.rs`、`error.rs`；本次仅阅读测试，没有运行测试。
