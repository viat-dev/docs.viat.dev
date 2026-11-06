---
title: "CLI：role"
description: "Viat 1.1.0 role 的完整语法、逐命令权限、输出、副作用与恢复。"
doc_id: cli.role
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.role.create","cli.role.delete","cli.role.list","cli.role.set-admin","cli.role.show"]
---

# CLI：role

先读 [CLI 总览](overview.md)：会话/目录、退出约定、角色边界、合成占位 ID 和执行授权规则在其中统一定义。本页逐叶补充例外；以下命令不是按顺序执行的脚本。

- [viat role create](#viat-role-create)
- [viat role delete](#viat-role-delete)
- [viat role list](#viat-role-list)
- [viat role set-admin](#viat-role-set-admin)
- [viat role show](#viat-role-show)

## viat role create

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat role create [OPTIONS] --name <NAME>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `admin`: `--admin` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | 原始帮助：Every user in this role administers the project (the delegated `/p/<slug>/_users` surface and `ctx.project.*`) |
| `description`: `--description` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `name`: `--name` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["admin","description","name"],"id":"Create","multiple":true,"required":false}`

**输入、行为与副作用。** 创建非内建项目角色；--admin 给所有该角色终端用户项目用户管理权限，不是平台登录角色。默认 admin=false。

**实际输出与退出。** stdout: created role &lt;name&gt;，true 时有 (admin)。不分配用户。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat role create --name demo_role --description 'Synthetic demo role'
```

**失败处理、验证与清理。** 重名/保留名失败。role show 验证；删除前取消演示用户分配。描述通过仓库/控制台/API 管理，无 update-description CLI。

## viat role delete

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat role delete <NAME>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["name"],"id":"Delete","multiple":true,"required":false}`

**输入、行为与副作用。** 删除非内建项目角色。影响用户角色与授权，不删除平台账号。

**实际输出与退出。** stdout: deleted &lt;name&gt;。API 拒绝删除内建角色。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat role delete demo_role
```

**失败处理、验证与清理。** 盘点已分配用户和规则，只删演示角色。role list 验证；同名重建不保证恢复旧 UUID/分配/规则。

## viat role list

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat role list [OPTIONS]
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |

Clap 参数组（literal metadata）：`{"arguments":["json"],"id":"List","multiple":true,"required":false}`

**输入、行为与副作用。** 列项目终端用户角色，不是平台/项目协作者角色分配。

**实际输出与退出。** 文本为角色名和 builtin/admin 标签；--json 角色行。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat role list --json
```

**失败处理、验证与清理。** 读取也需 editor。内建角色由平台管理、仓库同步略过；无变更/清理。

## viat role set-admin

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat role set-admin --admin <ADMIN> <NAME>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `admin`: `--admin` | `bool`, 1, `Set` | 是; Clap 无显式默认 | `{"aliases":[],"help":null,"hidden":false,"name":"false"}` / `{"aliases":[],"help":null,"hidden":false,"name":"true"}` | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["admin","name"],"id":"SetAdmin","multiple":true,"required":false}`

**输入、行为与副作用。** 以 --admin true|false PUT 项目角色；所有该角色用户获得/失去角色来源项目管理能力。不可改内建角色。

**实际输出与退出。** stdout: role &lt;name&gt; admin=&lt;bool&gt;。即使角色 false，用户自身 is_admin 仍可授予权限。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat role set-admin demo_role --admin false
```

**失败处理、验证与清理。** 提升前检查分配。role show 与相关用户核查；恢复旧布尔回退。不是 user set-role/project member set-role。

## viat role show

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat role show [OPTIONS] <NAME>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["json","name"],"id":"Show","multiple":true,"required":false}`

**输入、行为与副作用。** 读项目终端用户角色；角色含 admin/描述而非权限字符串列表。数据访问由授权规则定义。

**实际输出与退出。** 文本为 # name 及 builtin/admin 标签；--json 完整公开行。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat role show demo_role --json
```

**失败处理、验证与清理。** 未知角色失败。描述/id 用 JSON；无变更/清理。

## 实现核对依据

语法来自固定 Clap 合同与 main.rs；行为/权限核对以下源文件，路径相对产品仓库根。

- `crates/viat-cli/src/commands/role.rs`
- `crates/viat-api/src/handlers/roles.rs`
