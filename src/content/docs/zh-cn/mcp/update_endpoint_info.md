---
title: "update_endpoint_info — 更新端点结构和绑定"
description: "重命名路径段、替换 overrides 或重新绑定草稿叶节点。"
doc_id: mcp.update_endpoint_info
verified_release: '1.1.0'
channel: stable
contract_ids: [mcp.update_endpoint_info]
---

# `update_endpoint_info` — 更新端点结构和绑定

重命名路径段、替换 overrides 或重新绑定草稿叶节点。

适用于稳定版 Viat 1.1.0。先阅读 [MCP 配置与结果处理](overview.md)。以下为合成的、从源码推导的预期形状，**不是已执行的响应**。编写本页没有访问服务、提供方或设备。

## 前提与权限

需要编辑权限：项目 Owner、Admin 或 Developer；Viewer 被拒绝。PAT 所有者须具有该项目角色，且 PAT 范围允许访问该路由。

使用已激活的隔离实例，配置服务器和 bearer；除 list_projects 外须有 `mcp-lab` 项目。示例中的现有资产和 ID 以概览夹具为前提，用夹具实际返回 ID 替换合成 ID；示例不会自行创建依赖。

## 完整输入字段

必填表示导出输入合约的结构要求，不等于完整条件 API 验证。可选字段的显式 JSON null 与省略同样反序列化，包括未限定类型的 JSON 字段。空字符串、数组或对象是实际值，不是省略。数值 format 表示序列化边界，运行时限制和默认值另算。args 的模式 `default:null` 不等于其运行时默认 `{}`。

| 字段 | 类型 | 必填 | 省略 / 显式 null | 约束和含义 |
| --- | --- | --- | --- | --- |
| `crud_config` | JSON (any value) | 否（可能条件必填） | 不变；null 等同省略。 | CRUD 对象，必填 table/op 及选项见下文。 |
| `id` | string | 是 | 无默认值，缺失或 null 无效。 | 端点节点 UUID，不是树或脚本 ID。 |
| `method` | string / null | 否（可能条件必填） | 不变；null 等同省略。 | HTTP method，支持值和条件必填规则见下文。 |
| `overrides` | JSON (any value) | 否（可能条件必填） | 不变；null 等同省略。 | 端点覆盖对象，整体替换而非递归合并。 |
| `path_override` | string / null | 否（可能条件必填） | 不变；null 等同省略。 | 叶节点绝对路径覆盖，MCP 不支持用 null 清除。 |
| `project` | string / null | 否（可能条件必填） | VIAT_PROJECT / current_project；否则 project_required；null 等同省略。 | 项目 slug；省略或 null 使用 VIAT_PROJECT/current_project，否则 project_required。 |
| `script_name` | string / null | 否（可能条件必填） | 不变；null 等同省略。 | 脚本绑定名称，必要时带文件夹。 |
| `segment` | string / null | 否（可能条件必填） | 不变；null 等同省略。 | 单个路径段，字面值或 :param。 |
| `workflow_name` | string / null | 否（可能条件必填） | 不变；null 等同省略。 | 工作流绑定名称，必要时带文件夹。 |
| `ws_config` | JSON (any value) | 否（可能条件必填） | 不变；null 等同省略。 | 含 routes 的 WebSocket 配置，需 API 验证。 |

## 行为与验证

PUT 只发送已提供且非 null 的字段。只有 `id` 或仅有 null 更改会返回 `bad_input`。MCP 未暴露 API 的 null 清除字段语义，清除绑定要用控制台。JSON 配置对象会整体替换，不是递归合并，应保留无关设置。method 为 `GET`、`POST`、`PUT`、`PATCH`、`DELETE`。绑定组合、路径覆盖、WebSocket 和 CRUD 仍需 API 验证；复杂 JSON 字段与 create_endpoint 相同。

所有嵌套 JSON 字段请参阅 [完整 API 对象说明](create_endpoint.md#api-接受的-json-对象)，本工具采用相同验证。

## 输出与分页

端点对象包含字符串 `id`、`path`、`segment`、`tree_id`、`kind`；可选字符串 `method`、`parent_id`、`script_name`、`workflow_name`、`proxy_resource_name`；可选对象 `ws_routes`（路由 → 脚本字符串）及 `authz_gates` 数组（`{type, action}`）。可选字段省略而非返回 null。此投影不包含授权器列表、overrides 或完整 CRUD 配置，不能用作完整备份。

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
    "name": "update_endpoint_info",
    "arguments": {
      "project": "mcp-lab",
      "id": "00000000-0000-4000-8000-000000000001",
      "segment": "mcp-demo-renamed"
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
        "text": "{\"id\":\"00000000-0000-4000-8000-000000000001\",\"method\":\"GET\",\"path\":\"/mcp-demo-renamed\",\"segment\":\"mcp-demo-renamed\",\"tree_id\":\"00000000-0000-4000-8000-000000000001\",\"script_name\":\"mcp_demo\",\"kind\":\"script\"}"
      }
    ],
    "isError": false
  }
}
```

文本块内解码后的 JSON 值：

```json
{
  "id": "00000000-0000-4000-8000-000000000001",
  "method": "GET",
  "path": "/mcp-demo-renamed",
  "segment": "mcp-demo-renamed",
  "tree_id": "00000000-0000-4000-8000-000000000001",
  "script_name": "mcp_demo",
  "kind": "script"
}
```

## 失败与恢复

无更改返回 `bad_input`；保留或格式错误的路径、不兼容绑定和无效配置返回 API 错误。不能更改代理资源绑定或显式清空 `method`。

所有上游工具都可能因令牌过期或撤销、PAT 范围、项目权限、激活、网络或超时失败。无项目及默认值时为 `project_required`；控制面非 2xx 为 `http_4xx`/`http_5xx`。详见 [公共错误外层及重试规则](overview.md)。输入反序列化或未知工具可能在进入工具层前成为 JSON-RPC 协议错误，不要假定每个失败都有 isError。retryable 标志不保证幂等。

## 副作用、验证与清理

修改草稿拓扑，并可能把相关已发布端点标记为脏。保存原设置和绑定以便恢复；操作后检查 `list_endpoints` 和 `publish_plan`。不会自动发布。

验证应以观察为主：检查本文结果字段，获准修改前后使用对应读取工具。不要通过生产请求或删除无关对象来验证。

## 维护依据

输入清单：`contracts/1.1.0/mcp-tools.json`，工具 `update_endpoint_info`. 固定产品源码中的实现和测试： `endpoints.rs; handlers/endpoints.rs; tests/it/tool_update_endpoint.rs`. 工具模块文件名相对 `crates/viat-mcp/src/tools/`，API handler 相对 `crates/viat-api/src/handlers/`。公共传输和错误依据为 `crates/viat-mcp/src/tools/service.rs`、`http.rs`、`error.rs`；本次仅阅读测试，没有运行测试。
