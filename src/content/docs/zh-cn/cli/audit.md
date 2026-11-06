---
title: "CLI：audit"
description: "Viat 1.1.0 audit 的完整语法、逐命令权限、输出、副作用与恢复。"
doc_id: cli.audit
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.audit.export","cli.audit.query"]
---

# CLI：audit

先读 [CLI 总览](overview.md)：会话/目录、退出约定、角色边界、合成占位 ID 和执行授权规则在其中统一定义。本页逐叶补充例外；以下命令不是按顺序执行的脚本。

- [viat audit export](#viat-audit-export)
- [viat audit query](#viat-audit-query)

## viat audit export

**前提与权限。** 平台登录、已选择项目，并且是该项目成员（包括 Operator）。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat audit export [OPTIONS] <RESOURCE>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `folder`: `--folder` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：The resource's folder ('' = project root); needed only when the name is ambiguous |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `operator`: `--operator` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Who: an identity, user id, email, or a kind (`unattributed`, `system`, `console`) |
| `out`: `--out` | `PathBuf`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Write here instead of stdout |
| `record`: `--record` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：One record, by its primary key as text |
| `request`: `--request` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：The request whose writes to show (UUID) |
| `resource`: `<RESOURCE> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | 原始帮助：The `postgresql` resource whose trail to read |
| `since`: `--since` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Lower-bound timestamp (RFC3339, inclusive) |
| `table`: `--table` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：A table (`samples` or `lab.samples`) |
| `until`: `--until` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Upper-bound timestamp (RFC3339, exclusive) |

Clap 参数组（literal metadata）：`{"arguments":["folder","operator","record","request","resource","since","table","until"],"id":"Filters","multiple":true,"required":false}`

**输入、行为与副作用。** 将所有匹配资源业务审计导出 CSV；除无分页大小/before 外与 query 同筛选。通过服务端访问资源 DB。

**实际输出与退出。** stdout 为 UTF-8 BOM CSV；--out 写本地文件，stderr 报路径/行数。不是 JSON；大导出可能很大。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat audit export demo_db --out demo-audit.csv
```

**失败处理、验证与清理。** 资源/筛选/DB 连接/文件写入错误会失败。缩小时间/表筛选，安全保存或删除 demo-audit.csv；导出不删服务端轨迹。

## viat audit query

**前提与权限。** 平台登录、已选择项目，并且是该项目成员（包括 Operator）。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat audit query [OPTIONS] <RESOURCE>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `before`: `--before` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Pagination cursor from the previous page's "next page" hint |
| `folder`: `--folder` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：The resource's folder ('' = project root); needed only when the name is ambiguous |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | 原始帮助：Emit the raw JSON response |
| `limit`: `--limit` | `i64`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认；运行时：`服务端 100，受配置上限约束` | — | 原始帮助：Max rows (default 100; the server caps it) |
| `operator`: `--operator` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Who: an identity, user id, email, or a kind (`unattributed`, `system`, `console`) |
| `record`: `--record` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：One record, by its primary key as text |
| `request`: `--request` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：The request whose writes to show (UUID) |
| `resource`: `<RESOURCE> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | 原始帮助：The `postgresql` resource whose trail to read |
| `since`: `--since` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Lower-bound timestamp (RFC3339, inclusive) |
| `table`: `--table` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：A table (`samples` or `lab.samples`) |
| `until`: `--until` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Upper-bound timestamp (RFC3339, exclusive) |

Clap 参数组（literal metadata）：`{"arguments":["folder","operator","record","request","resource","since","table","until"],"id":"Filters","multiple":true,"required":false}`

**输入、行为与副作用。** 用平台持有的资源凭据读 PostgreSQL 业务数据审计轨迹，不是控制面 /projects/:slug/audit。--record 是 record_id；--operator 匹配 identity/用户 ID/邮箱/kind。

**实际输出与退出。** 文本按事务分组变更字段行，并给 --before；--json 为 items/next_before/limit。服务端默认 100，受部署上限约束。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat audit query demo_db --limit 10 --json
```

**失败处理、验证与清理。** 需可达 PostgreSQL 及已安装/保留轨迹；无轨迹可为空，不必 404。游标/时间错或非 PostgreSQL 失败。无写入/清理；输出含个人/业务数据。

## 实现核对依据

语法来自固定 Clap 合同与 main.rs；行为/权限核对以下源文件，路径相对产品仓库根。

- `crates/viat-cli/src/commands/audit.rs`
- `crates/viat-api/src/handlers/audit_trail.rs`
