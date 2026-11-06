---
title: "list_files — 列出托管存储文件"
description: "读取一个 storage 资源的文件元数据，而非原始桶内容或文件正文。"
doc_id: mcp.list_files
verified_release: '1.1.0'
channel: stable
contract_ids: [mcp.list_files]
---

# `list_files` — 列出托管存储文件

读取一个 storage 资源的文件元数据，而非原始桶内容或文件正文。

适用于稳定版 Viat 1.1.0。先阅读 [MCP 配置与结果处理](overview.md)。以下为合成的、从源码推导的预期形状，**不是已执行的响应**。编写本页没有访问服务、提供方或设备。

## 前提与权限

需要所选项目的成员身份（任意项目角色，包括 Viewer）。平台角色不等同于项目成员身份。PAT 必须有效且其范围允许访问该路由。

使用已激活的隔离实例，配置服务器和 bearer；除 list_projects 外须有 `mcp-lab` 项目。示例中的现有资产和 ID 以概览夹具为前提，用夹具实际返回 ID 替换合成 ID；示例不会自行创建依赖。

## 完整输入字段

必填表示导出输入合约的结构要求，不等于完整条件 API 验证。可选字段的显式 JSON null 与省略同样反序列化，包括未限定类型的 JSON 字段。空字符串、数组或对象是实际值，不是省略。数值 format 表示序列化边界，运行时限制和默认值另算。args 的模式 `default:null` 不等于其运行时默认 `{}`。

| 字段 | 类型 | 必填 | 省略 / 显式 null | 约束和含义 |
| --- | --- | --- | --- | --- |
| `before` | string / null | 否（可能条件必填） | 不向 API 提供，条件规则见下文。；null 等同省略。 | 分页游标，本页说明其来源和格式。 |
| `folder` | string / null | 否（可能条件必填） | 不向 API 提供，条件规则见下文。；null 等同省略。 | 资源、脚本或工作流文件夹路径，空字符串选根目录，省略或 null 使用名称查找。非空路径最多 255 字节、8 层，各段为 [A-Za-z0-9_-]+，不能有开头、末尾或重复斜杠。 |
| `limit` | integer / null | 否（可能条件必填） | 100; API 范围 1..1000；null 等同省略。 | format: "int64"; 页大小，实际默认与边界见下文。 |
| `owner_id` | string / null | 否（可能条件必填） | 不向 API 提供，条件规则见下文。；null 等同省略。 | 记录的所属对象 ID 筛选。 |
| `owner_type` | string / null | 否（可能条件必填） | 不向 API 提供，条件规则见下文。；null 等同省略。 | 记录的所属对象类型筛选。 |
| `prefix` | string / null | 否（可能条件必填） | 不向 API 提供，条件规则见下文。；null 等同省略。 | 托管文件键的字面前缀。 |
| `project` | string / null | 否（可能条件必填） | VIAT_PROJECT / current_project；否则 project_required；null 等同省略。 | 项目 slug；省略或 null 使用 VIAT_PROJECT/current_project，否则 project_required。 |
| `resource` | string | 是 | 无默认值，缺失或 null 无效。 | 现有 storage 资源名称。 |

## 行为与验证

需要已有 `storage` 资源及配置的元数据数据库。`folder` 定位资源；`prefix` 是字面键前缀（SQL 通配符会转义）。`owner_type` 与 `owner_id` 独立筛选已记录所有权。limit 转发给 API，实际默认 100、范围 1..1000。已删除文件不返回。

## 输出与分页

API 透传对象 `{files:File[],next_cursor:string|null}`。元数据含 UUID 字符串 `id`，字符串 `storage`、`key`、`name`、`content_type`、`sha256`，整数 `size`，可为 null 的字符串 `owner_type`、`owner_id`，JSON 值 `meta`、`uploaded_by`，时间戳字符串 `uploaded_at`，可为 null 的时间戳 `replaced_at`、`deleted_at`。不返回二进制内容、签名下载链接或凭据。末页游标为 null，不省略。

将 `next_cursor` 原样作为 `before`，保留资源、文件夹和筛选。null 表示结束。按 uploaded_at 倒序并用 ID 区分同时间项；游标不透明，不是时间戳。

值会序列化成 JSON，放进一个 MCP `content` 文本块。请把 `result.content[0].text` 解析为 JSON。不承诺 `structuredContent` 或 `outputSchema`；注明省略的可选字段不能假定以 null 存在。

## 合成请求与预期形状

完成 MCP initialize/initialized 后，通过 stdio 以单行 JSON 发送此 tools/call 请求（此处格式化仅为便于阅读）。

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "list_files",
    "arguments": {
      "project": "mcp-lab",
      "resource": "files_stub",
      "limit": 10,
      "prefix": "demo/"
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
        "text": "{\"files\":[],\"next_cursor\":null}"
      }
    ],
    "isError": false
  }
}
```

文本块内解码后的 JSON 值：

```json
{
  "files": [],
  "next_cursor": null
}
```

## 失败与恢复

资源不存在返回 404；资源类型错误、元数据存储不可用或游标无效返回上游错误（伪造游标为 `bad_cursor`）。本工具不提供创建、删除或下载。

所有上游工具都可能因令牌过期或撤销、PAT 范围、项目权限、激活、网络或超时失败。无项目及默认值时为 `project_required`；控制面非 2xx 为 `http_4xx`/`http_5xx`。详见 [公共错误外层及重试规则](overview.md)。输入反序列化或未知工具可能在进入工具层前成为 JSON-RPC 协议错误，不要假定每个失败都有 isError。retryable 标志不保证幂等。

## 副作用、验证与清理

不写文件内容或元数据，但存储操作仍可能进入平台访问或审计日志。列表无需清理夹具，不要通过删除用户文件来验证。

验证应以观察为主：检查本文结果字段，获准修改前后使用对应读取工具。不要通过生产请求或删除无关对象来验证。

## 维护依据

输入清单：`contracts/1.1.0/mcp-tools.json`，工具 `list_files`. 固定产品源码中的实现和测试： `files.rs; handlers/files.rs; api/src/files.rs; tests/it/tool_list_files.rs`. 工具模块文件名相对 `crates/viat-mcp/src/tools/`，API handler 相对 `crates/viat-api/src/handlers/`。公共传输和错误依据为 `crates/viat-mcp/src/tools/service.rs`、`http.rs`、`error.rs`；本次仅阅读测试，没有运行测试。
