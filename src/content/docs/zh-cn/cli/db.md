---
title: "CLI：db"
description: "Viat 1.1.0 db 的完整语法、逐命令权限、输出、副作用与恢复。"
doc_id: cli.db
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.db.baseline","cli.db.migrate","cli.db.repair","cli.db.status"]
---

# CLI：db

先读 [CLI 总览](overview.md)：会话/目录、退出约定、角色边界、合成占位 ID 和执行授权规则在其中统一定义。本页逐叶补充例外；以下命令不是按顺序执行的脚本。

- [viat db baseline](#viat-db-baseline)
- [viat db migrate](#viat-db-migrate)
- [viat db repair](#viat-db-repair)
- [viat db status](#viat-db-status)

## 合成夹具与执行边界

这些文件只为下面例子提供输入；创建远程对象、执行脚本、数据库 SQL 或存储操作前，必须自行准备隔离项目并明确授权。生成文档不执行任何例子。

```sql
-- migrations/demo_db/0001_demo.sql; isolated PostgreSQL/MySQL/SQLite only
CREATE TABLE cli_demo (id INTEGER PRIMARY KEY);
```

先配置可写隔离 demo_db 资源并备份。baseline 仅在该表已按文件精确存在时使用；repair 仅在确有已手工修复的失败行时使用，不把这四命令当作顺序执行教程。清理表需你审核并授权的新迁移；本页不执行 SQL。

## viat db baseline

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin；Developer/Operator 不可发布。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat db baseline --through <THROUGH> <RESOURCE>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `resource`: `<RESOURCE> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `through`: `--through` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["resource","through"],"id":"Baseline","multiple":true,"required":false}`

**输入、行为与副作用。** 将本地至必填 --through ID 的所有文件标已应用，不跑 SQL。仅用于已精确具备这些 schema 的库，不是隐藏漂移。需可写受支持资源 DB 和匹配文件。

**实际输出与退出。** 文本报告 baseline 数量/资源；写 ledger/checksum，不跑业务 DDL。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat db baseline demo_db --through 0001_demo
```

**失败处理、验证与清理。** through 文件缺失/ledger 冲突拒绝失败。baseline 前独立验证 schema，再 db status。错误 baseline 需备份支持下有意修 ledger；无 unbaseline CLI。

## viat db migrate

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin；Developer/Operator 不可发布。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat db migrate [OPTIONS] [RESOURCE]
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `allow_out_of_order`: `--allow-out-of-order` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | 原始帮助：Apply a pending file even if it sorts before one already applied |
| `dry_run`: `--dry-run` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | 原始帮助：List what would run, run nothing |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `resource`: `<RESOURCE> (#1)` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认；运行时：`所有发现迁移目录` | — | — |

Clap 参数组（literal metadata）：`{"arguments":["allow_out_of_order","dry_run","resource"],"id":"Migrate","multiple":true,"required":false}`

**输入、行为与副作用。** 按字典 ID 顺序执行待迁移 SQL，首错停止。拒绝被改已应用文件、失败 ledger 行和乱序文件（除非 --allow-out-of-order）。--dry-run 只读/计划（editor 足够）；省略资源则所有发现目录。无目录会在登录前成功无操作。

**实际输出与退出。** 文本为 would apply/up to date/applied（时长）/already applied。真实变更使用平台资源凭据。PostgreSQL/SQLite 文件和 ledger 同事务；MySQL DDL 自动提交，可留部分状态/失败行。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat db migrate demo_db --dry-run
```

**失败处理、验证与清理。** 示例仅用已授权隔离 DB。超时/断连可仍在执行 SQL，重试前查 status。dry-run 读取 ledger 不初始化表。先备份；回退需新审核迁移/手工修库，无 CLI down。push 不代跑。

## viat db repair

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin；Developer/Operator 不可发布。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat db repair <RESOURCE> <ID>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `id`: `<ID> (#2)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | 原始帮助：The migration's id (the file's stem) |
| `resource`: `<RESOURCE> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | 原始帮助：The resource (as under migrations/, e.g. `db` or `lab/db`) |

Clap 参数组（literal metadata）：`{"arguments":["id","resource"],"id":"Repair","multiple":true,"required":false}`

**输入、行为与副作用。** 手工修复部分应用 MySQL 文件后，只清其失败 ledger 行，使下次 migrate 整文件重跑。绝不清已应用行，不自动修 SQL。

**实际输出与退出。** 文本为 cleared the failed row ... 或服务端结果；只变 ledger 状态。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat db repair demo_db 0001_demo
```

**失败处理、验证与清理。** 清除前确认真实 DB 和幂等性，否则重跑可重复 DDL/数据。不存在/非失败行可拒绝或按响应无操作；db status 验证、保留诊断/备份并有意恢复。

## viat db status

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat db status [RESOURCE]
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `resource`: `<RESOURCE> (#1)` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认；运行时：`所有发现迁移目录` | — | 原始帮助：One resource (as under migrations/, e.g. `db` or `lab/db`); all if omitted |

Clap 参数组（literal metadata）：`{"arguments":["resource"],"id":"Status","multiple":true,"required":false}`

**输入、行为与副作用。** 发现 CWD migrations/<folder/resource>/*.sql 并将文件 checksum 与资源 DB ledger 比。省略 resource 表示全部发现资源。支持 PostgreSQL/MySQL/SQLite，不是平台迁移/SQL Server。无迁移目录时即使未登录也早期成功无操作。

**实际输出与退出。** 文本为 applied/baseline/pending/CHANGED/FAILED 及仅 ledger 行。报告 changed/failed 本身不使 status 非零。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat db status demo_db
```

**失败处理、验证与清理。** 需可读 SQL 与可达资源 DB。ledger 读取不会创建 ledger 表；从未迁移的数据库返回空 ledger。恢复被改已应用文件，以新迁移纠正，勿改已应用历史。无自动破坏性清理。

## 实现核对依据

语法来自固定 Clap 合同与 main.rs；行为/权限核对以下源文件，路径相对产品仓库根。

- `crates/viat-cli/src/commands/db.rs`
- `crates/viat-api/src/handlers/db_migrations.rs`
- `crates/viat-runtime/src/db_migrate.rs`
