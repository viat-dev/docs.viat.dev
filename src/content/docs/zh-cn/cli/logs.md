---
title: "CLI：logs"
description: "Viat 1.1.0 logs 的完整语法、逐命令权限、输出、副作用与恢复。"
doc_id: cli.logs
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.logs.query","cli.logs.search","cli.logs.show","cli.logs.tail"]
---

# CLI：logs

先读 [CLI 总览](overview.md)：会话/目录、退出约定、角色边界、合成占位 ID 和执行授权规则在其中统一定义。本页逐叶补充例外；以下命令不是按顺序执行的脚本。

- [viat logs query](#viat-logs-query)
- [viat logs search](#viat-logs-search)
- [viat logs show](#viat-logs-show)
- [viat logs tail](#viat-logs-tail)

## viat logs query

**前提与权限。** 平台登录、已选择项目，并且是该项目成员（包括 Operator）。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat logs query [OPTIONS]
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `before`: `--before` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Pagination cursor from previous --json output |
| `endpoint`: `--endpoint` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Filter to a single endpoint node id (UUID) |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | 原始帮助：Emit raw JSON response |
| `limit`: `--limit` | `i64`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认；运行时：`服务端 50，限 1–200` | — | 原始帮助：Max rows to return (default 50) |
| `path_eq`: `--path-eq` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Exact-string filter on request path column |
| `request`: `--request` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Filter to a single request_id (UUID) |
| `since`: `--since` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Lower-bound timestamp (RFC3339, inclusive) |
| `status_max`: `--status-max` | `i16`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：HTTP status <= this |
| `status_min`: `--status-min` | `i16`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：HTTP status >= this (e.g. 400 for errors only) |
| `until`: `--until` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Upper-bound timestamp (RFC3339, exclusive) |

Clap 参数组（literal metadata）：`{"arguments":["before","endpoint","json","limit","path_eq","request","since","status_max","status_min","until"],"id":"QueryArgs","multiple":true,"required":false}`

**输入、行为与副作用。** 查询所选项目执行元数据；可按端点 UUID/请求 UUID/状态范围/UTC RFC3339 时间/精确路径筛。--before 用返回游标。不查任意业务表。

**实际输出与退出。** 文本含时间/请求/状态/时长/路径及下一页提示；--json 分页响应。无匹配退出 0。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat logs query --limit 10 --json
```

**失败处理、验证与清理。** UUID/时间/游标/范围无效失败。分页原样沿用游标和筛选。只读；保护输出中的身份/载荷相关元数据。

## viat logs search

**前提与权限。** 平台登录、已选择项目，并且是该项目成员（包括 Operator）。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat logs search [OPTIONS] <QUERY>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `before`: `--before` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Pagination cursor from a previous run's "next page" hint |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | 原始帮助：Emit raw JSON response |
| `limit`: `--limit` | `i64`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认；运行时：`服务端 50，限 1–200` | — | 原始帮助：Max rows to return (default 50, max 200) |
| `query`: `<QUERY> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | 原始帮助：Substring to search for in log line content (case-insensitive, min 3 chars) |
| `since`: `--since` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Lower-bound timestamp (RFC3339, inclusive) |
| `stream`: `--stream` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Restrict to a single stream: stdout &#124; stderr &#124; structured |
| `until`: `--until` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Upper-bound timestamp (RFC3339, inclusive) |

Clap 参数组（literal metadata）：`{"arguments":["before","json","limit","query","since","stream","until"],"id":"SearchArgs","multiple":true,"required":false}`

**输入、行为与副作用。** 子串搜索日志内容（至少 3 字符）；--stream 可选 stdout/stderr/structured。仅 PostgreSQL 日志后端可用，不是所有 sink。

**实际输出与退出。** 文本含匹配请求/时间/stream/content 及游标；--json 搜索页。无匹配 0。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat logs search demo --limit 10 --json
```

**失败处理、验证与清理。** 短查询/后端不支持/时间错失败。缩小时间并 --before 分页；工作流输出只有作为日志行才可搜。无变更/清理。

## viat logs show

**前提与权限。** 平台登录、已选择项目，并且是该项目成员（包括 Operator）。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat logs show [OPTIONS] <REQUEST_ID>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |
| `request_id`: `<REQUEST_ID> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["json","request_id"],"id":"Show","multiple":true,"required":false}`

**输入、行为与副作用。** 按 request_id 获取单执行和日志行，不是内部 execution_log_id/端点 UUID。

**实际输出与退出。** 文本含请求/时间/方法/路径/状态/时长/错误及日志行；--json 完整详情。无日志行不证明没有执行。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat logs show 00000000-0000-4000-8000-000000000001 --json
```

**失败处理、验证与清理。** 404 时核对 query/run 的请求 ID、项目及保留期。日志可含敏感业务数据；只读，不执行/清理。

## viat logs tail

**前提与权限。** 平台登录、已选择项目，并且是该项目成员（包括 Operator）。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat logs tail [OPTIONS]
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `endpoint`: `--endpoint` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Filter to a single endpoint node id (UUID) |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | 原始帮助：Emit each event as one JSON line (newline-delimited) |

Clap 参数组（literal metadata）：`{"arguments":["endpoint","json"],"id":"TailArgs","multiple":true,"required":false}`

**输入、行为与副作用。** SSE 流新项目执行/日志事件，无初始回填，排除测试执行。其他节点完成后约 2 秒 DB 轮询出现；跨节点日志行需 PostgreSQL 后端。

**实际输出与退出。** 文本格式化事件；--json 每行事件数据（不是一个 JSON 数组）。重连/错误写 stderr；连续五次失败后报错停止。否则持续到中断。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat logs tail --json
```

**失败处理、验证与清理。** Ctrl-C 仅停本地读取（信号退出码不属 0/1 命令约定）。重连不重放，缺口用 query/show 查。不取消脚本，无远程清理。

## 实现核对依据

语法来自固定 Clap 合同与 main.rs；行为/权限核对以下源文件，路径相对产品仓库根。

- `crates/viat-cli/src/commands/logs.rs`
- `crates/viat-api/src/handlers/logs.rs`
- `crates/viat-db/src/logs.rs`
