---
title: "CLI：tree"
description: "Viat 1.1.0 tree 的完整语法、逐命令权限、输出、副作用与恢复。"
doc_id: cli.tree
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.tree.create","cli.tree.delete","cli.tree.list","cli.tree.show","cli.tree.update"]
---

# CLI：tree

先读 [CLI 总览](overview.md)：会话/目录、退出约定、角色边界、合成占位 ID 和执行授权规则在其中统一定义。本页逐叶补充例外；以下命令不是按顺序执行的脚本。

- [viat tree create](#viat-tree-create)
- [viat tree delete](#viat-tree-delete)
- [viat tree list](#viat-tree-list)
- [viat tree show](#viat-tree-show)
- [viat tree update](#viat-tree-update)

## viat tree create

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat tree create --name <NAME> --path <PATH_OVERRIDE>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `name`: `--name` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `path_override`: `--path` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["name","path_override"],"id":"Create","multiple":true,"required":false}`

**输入、行为与副作用。** 以必填 --name 和 --path 覆盖建树；--path 是 URL 前缀，不是本地目录。服务端校验唯一性/形状。

**实际输出与退出。** stdout 为 id/name/path_override。不执行端点、不自动发布。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat tree create --name demo_tree --path /demo
```

**失败处理、验证与清理。** 路径重复/无效失败。tree show 验证；用完先查子端点，再删空演示树。

## viat tree delete

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat tree delete <ID_OR_NAME>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `id_or_name`: `<ID_OR_NAME> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["id_or_name"],"id":"Delete","multiple":true,"required":false}`

**输入、行为与副作用。** 解析 UUID/名称并删树，可级联其端点子树。视为破坏性路由变更，不是删空本地目录。

**实际输出与退出。** stdout: deleted &lt;name&gt; (&lt;UUID&gt;)；支持空 DELETE 响应。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat tree delete demo_tree
```

**失败处理、验证与清理。** 先检查子节点并备份端点仓库；若任一节点已发布，会以 409 conflict 拒绝，须先有意取消发布。list 验证；重建和发布须显式，旧 ID 不保证保留。

## viat tree list

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat tree list [OPTIONS]
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |

Clap 参数组（literal metadata）：`{"arguments":["json"],"id":"List","multiple":true,"required":false}`

**输入、行为与副作用。** 列端点树容器；此读取也需 editor。

**实际输出与退出。** 文本含 id/name/path_override；--json 列表。根覆盖单独显示。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat tree list --json
```

**失败处理、验证与清理。** 树不是文件系统目录/脚本文件夹。无变更/清理；show/update 使用此处 ID/名称。

## viat tree show

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat tree show [OPTIONS] <ID_OR_NAME>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `id_or_name`: `<ID_OR_NAME> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |

Clap 参数组（literal metadata）：`{"arguments":["id_or_name","json"],"id":"Show","multiple":true,"required":false}`

**输入、行为与副作用。** 接受 UUID 或精确 tree 名；按当前项目树列表解析名称。

**实际输出与退出。** 文本 id/name/path_override；--json 原始树对象。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat tree show demo_tree --json
```

**失败处理、验证与清理。** 名称/UUID 未知失败，不会创建。改前保存原 name/path；读取无需清理。

## viat tree update

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat tree update [OPTIONS] <ID_OR_NAME>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `id_or_name`: `<ID_OR_NAME> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `name`: `--name` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | — |
| `path`: `--path` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["id_or_name","name","path"],"id":"Update","multiple":true,"required":false}`

**输入、行为与副作用。** 解析 UUID/名称后 PATCH 提供的 --name/--path，省略字段不变。树改名不是移动脚本/资源文件夹。

**实际输出与退出。** stdout: id/name/path_override。改路径后检查端点草稿路径及发布状态。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat tree update demo_tree --name demo_tree_renamed
```

**失败处理、验证与清理。** 名称/路径冲突拒绝；保存旧值并 update 恢复。tree show 与 endpoint list 核查；线上快照变更需相应发布操作。

## 实现核对依据

语法来自固定 Clap 合同与 main.rs；行为/权限核对以下源文件，路径相对产品仓库根。

- `crates/viat-cli/src/commands/tree.rs`
- `crates/viat-api/src/handlers/trees.rs`
- `crates/viat-db/src/endpoint_trees.rs`
