---
title: "CLI：workflow"
description: "Viat 1.1.0 workflow 的完整语法、逐命令权限、输出、副作用与恢复。"
doc_id: cli.workflow
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.workflow.create","cli.workflow.delete","cli.workflow.list","cli.workflow.show","cli.workflow.test","cli.workflow.update"]
---

# CLI：workflow

先读 [CLI 总览](overview.md)：会话/目录、退出约定、角色边界、合成占位 ID 和执行授权规则在其中统一定义。本页逐叶补充例外；以下命令不是按顺序执行的脚本。

- [viat workflow create](#viat-workflow-create)
- [viat workflow delete](#viat-workflow-delete)
- [viat workflow list](#viat-workflow-list)
- [viat workflow show](#viat-workflow-show)
- [viat workflow test](#viat-workflow-test)
- [viat workflow update](#viat-workflow-update)

## 合成夹具与执行边界

这些文件只为下面例子提供输入；创建远程对象、执行脚本、数据库 SQL 或存储操作前，必须自行准备隔离项目并明确授权。生成文档不执行任何例子。

```yaml
# demo-workflow.yaml
inputs: {}
steps:
  - id: echo
    script: demo_echo
outputs:
  result: "$echo.output"
```

demo_echo 使用脚本页无资源的 Python 夹具。先创建脚本，再 workflow create，然后才可 test；编辑/测试的是草稿，不是已发布快照。

## viat workflow create

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 按本页合成夹具写 demo-workflow.yaml，并先创建 demo_echo。该脚本不使用提供方。

```text
Usage: viat workflow create --file <FILE> <NAME>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `file`: `--file` | `PathBuf`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["file","name"],"id":"Create","multiple":true,"required":false}`

**输入、行为与副作用。** 读取原始 YAML --file，POST name/folder/definition。名称可含文件夹。只建草稿，不执行/发布。

**实际输出与退出。** stdout: created &lt;name&gt; (vN)。服务端校验定义及引用结构。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat workflow create demo_flow --file demo-workflow.yaml
```

**失败处理、验证与清理。** 无效 YAML/定义或重名会失败。workflow show 验证；无引用时删除 demo_flow。

## viat workflow delete

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat workflow delete <NAME>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["name"],"id":"Delete","multiple":true,"required":false}`

**输入、行为与副作用。** 删除保存的工作流草稿，不撤销执行及资源副作用。

**实际输出与退出。** stdout: deleted &lt;name&gt;；DELETE 成功 0。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat workflow delete demo_flow
```

**失败处理、验证与清理。** 先有意移除依赖调度/端点并保留 YAML。list 确认不存在；重建需保存定义，不能靠旧日志。

## viat workflow list

**前提与权限。** 平台登录、已选择项目，并且是该项目成员（包括 Operator）。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat workflow list [OPTIONS]
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |

Clap 参数组（literal metadata）：`{"arguments":["json"],"id":"List","multiple":true,"required":false}`

**输入、行为与副作用。** 列各文件夹当前工作流草稿。

**实际输出与退出。** 文本为限定名和 vN；--json 输出服务端列表；空列表成功。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat workflow list --json
```

**失败处理、验证与清理。** 使用列表限定引用。不执行、不修改，无需清理。

## viat workflow show

**前提与权限。** 平台登录、已选择项目，并且是该项目成员（包括 Operator）。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat workflow show [OPTIONS] <NAME>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["json","name"],"id":"Show","multiple":true,"required":false}`

**输入、行为与副作用。** 读单个草稿，不是已发布端点快照。

**实际输出与退出。** 文本打印 # name (vN) 及 YAML 定义；--json 返回公开工作流对象。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat workflow show demo_flow --json
```

**失败处理、验证与清理。** 名称不存在/歧义会失败；限定文件夹。若需回退，update/delete 前保存此定义；只读本身无需清理。

## viat workflow test

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat workflow test [OPTIONS] <NAME>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `input`: `--input` / `--args` | `String`, 1, `Set` | 否；条件必填见行为; `{}` | — | 原始帮助：JSON object of inputs. `--args` is accepted too — the script commands spell it that way, and the two were confused constantly |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["input","name"],"id":"Test","multiple":true,"required":false}`

**输入、行为与副作用。** 以 --input JSON（默认 {}，别名 --args）向 /test_run 执行在线未发布定义。访问真实资源并可修改。

**实际输出与退出。** 逐尝试步骤状态写 stderr。仅 user_error 为 null 且 step_runs 没有任何 failed 行时 stdout 打印 outputs 并退出 0。任一失败尝试行都退出 1，即使后来重试成功或运行时恢复整体结果。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat workflow test demo_flow --input '{}'
```

**失败处理、验证与清理。** 失败时 stderr 打印 request_id、user_error 和失败步骤错误，不打印成功 outputs。用该 ID 查日志再决定重跑，重复执行可重复写入。不自动回滚资源。

## viat workflow update

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat workflow update --file <FILE> <NAME>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `file`: `--file` | `PathBuf`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["file","name"],"id":"Update","multiple":true,"required":false}`

**输入、行为与副作用。** 从 --file PATCH 完整定义，产生新草稿版本。发布前端点保持旧快照。

**实际输出与退出。** stdout: updated &lt;name&gt; → vN，附可能的待发布提示。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat workflow update demo_flow --file demo-workflow.yaml
```

**失败处理、验证与清理。** 定义校验失败退出 1。保留旧 YAML、show 核查；仅明确允许真实副作用后 test；恢复旧定义回退草稿。

## 实现核对依据

语法来自固定 Clap 合同与 main.rs；行为/权限核对以下源文件，路径相对产品仓库根。

- `crates/viat-cli/src/commands/workflow.rs:150–216`
- `crates/viat-api/src/handlers/workflows.rs`
