---
title: "publish_apply — 发布全部待发布叶节点"
description: "通过一个快照修订把项目可发布草稿端点上线。"
doc_id: mcp.publish_apply
verified_release: '1.1.0'
channel: stable
contract_ids: [mcp.publish_apply]
---

# `publish_apply` — 发布全部待发布叶节点

通过一个快照修订把项目可发布草稿端点上线。

适用于稳定版 Viat 1.1.0。先阅读 [MCP 配置与结果处理](overview.md)。以下为合成的、从源码推导的预期形状，**不是已执行的响应**。编写本页没有访问服务、提供方或设备。

## 前提与权限

需要发布权限：项目 Owner 或 Admin；Developer 和 Viewer 被拒绝。PAT 所有者须具有该项目角色，且 PAT 范围允许访问该路由。

使用已激活的隔离实例，配置服务器和 bearer；除 list_projects 外须有 `mcp-lab` 项目。示例中的现有资产和 ID 以概览夹具为前提，用夹具实际返回 ID 替换合成 ID；示例不会自行创建依赖。

## 完整输入字段

必填表示导出输入合约的结构要求，不等于完整条件 API 验证。可选字段的显式 JSON null 与省略同样反序列化，包括未限定类型的 JSON 字段。空字符串、数组或对象是实际值，不是省略。数值 format 表示序列化边界，运行时限制和默认值另算。args 的模式 `default:null` 不等于其运行时默认 `{}`。

| 字段 | 类型 | 必填 | 省略 / 显式 null | 约束和含义 |
| --- | --- | --- | --- | --- |
| `acknowledge_test_failures` | boolean / null | 否（可能条件必填） | false；null 等同省略。 | 接受已审阅失败测试门，默认 false。 |
| `acknowledge_warnings` | boolean / null | 否（可能条件必填） | false；null 等同省略。 | 接受已审阅发布警告，默认 false。 |
| `project` | string / null | 否（可能条件必填） | VIAT_PROJECT / current_project；否则 project_required；null 等同省略。 | 项目 slug；省略或 null 使用 VIAT_PROJECT/current_project，否则 project_required。 |

## 行为与验证

必须先调用 `publish_plan`。这是项目级发布，不是单端点发布。两个 acknowledge 开关省略或 null 时均为 false。409 消息会列出警告或失败测试门；应修复，或审阅后只明确接受对应类别，不应默认启用这些开关。

## 输出与分页

返回 `{project_slug:string,published_count:integer,endpoints:JSON[],builds:JSON[],build_pending:boolean}`。端点及构建条目由 API 原样传递，不是固定 MCP 输出模式。`build_pending:true` 且 `builds` 为空表示后台构建，不表示已就绪。数组不分页。

固定 API 中每个端点项含 UUID 字符串 `id`，可为 null 的字符串 `method`，字符串 `path`，UUID 字符串 `snapshot_id`，整数 `snapshot_version`。每个构建项含字符串 `script`、`language`，布尔值 `ok`，可为 null 的字符串 `error`，整数 `duration_ms`，可选 `diagnostics` 数组（空数组省略）。Rust 诊断含字符串 `level`、`message`、`rendered`，可选字符串 `code`、`source`、`path`，可选无符号整数 `line`、`column`（缺失时省略）。构建 `ok:false` 是结果数据，即使工具调用成功也要检查。

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
    "name": "publish_apply",
    "arguments": {
      "project": "mcp-lab"
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
        "text": "{\"project_slug\":\"mcp-lab\",\"published_count\":0,\"endpoints\":[],\"builds\":[],\"build_pending\":false}"
      }
    ],
    "isError": false
  }
}
```

文本块内解码后的 JSON 值：

```json
{
  "project_slug": "mcp-lab",
  "published_count": 0,
  "endpoints": [],
  "builds": [],
  "build_pending": false
}
```

## 失败与恢复

409 code 包括 `publish_warnings_unacknowledged`、`publish_test_failures`；原 API 正文以字符串保存在 MCP 错误 message 中。构建或网络失败应先检查状态，不要盲目接受。

所有上游工具都可能因令牌过期或撤销、PAT 范围、项目权限、激活、网络或超时失败。无项目及默认值时为 `project_required`；控制面非 2xx 为 `http_4xx`/`http_5xx`。详见 [公共错误外层及重试规则](overview.md)。输入反序列化或未知工具可能在进入工具层前成为 JSON-RPC 协议错误，不要假定每个失败都有 isError。retryable 标志不保证幂等。

## 副作用、验证与清理

以修订为单位原子修改实时路由，也可能安装依赖和构建。本工具无 dry-run。保存旧修订信息；`publish_rollback` 是项目级回滚，`unpublish_endpoint` 可单独下线夹具端点。两者都不会撤销外部脚本副作用或实时共享模块。

验证应以观察为主：检查本文结果字段，获准修改前后使用对应读取工具。不要通过生产请求或删除无关对象来验证。

## 维护依据

输入清单：`contracts/1.1.0/mcp-tools.json`，工具 `publish_apply`. 固定产品源码中的实现和测试： `publish.rs; handlers/publish.rs; tests/it/tool_publish.rs`. 工具模块文件名相对 `crates/viat-mcp/src/tools/`，API handler 相对 `crates/viat-api/src/handlers/`。公共传输和错误依据为 `crates/viat-mcp/src/tools/service.rs`、`http.rs`、`error.rs`；本次仅阅读测试，没有运行测试。
