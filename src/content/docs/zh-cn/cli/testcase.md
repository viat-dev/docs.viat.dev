---
title: "CLI：testcase"
description: "Viat 1.1.0 testcase 的完整语法、逐命令权限、输出、副作用与恢复。"
doc_id: cli.testcase
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.testcase.create","cli.testcase.delete","cli.testcase.disable","cli.testcase.enable","cli.testcase.list","cli.testcase.run","cli.testcase.show","cli.testcase.update"]
---

# CLI：testcase

先读 [CLI 总览](overview.md)：会话/目录、退出约定、角色边界、合成占位 ID 和执行授权规则在其中统一定义。本页逐叶补充例外；以下命令不是按顺序执行的脚本。

- [viat testcase create](#viat-testcase-create)
- [viat testcase delete](#viat-testcase-delete)
- [viat testcase disable](#viat-testcase-disable)
- [viat testcase enable](#viat-testcase-enable)
- [viat testcase list](#viat-testcase-list)
- [viat testcase run](#viat-testcase-run)
- [viat testcase show](#viat-testcase-show)
- [viat testcase update](#viat-testcase-update)

## viat testcase create

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat testcase create [OPTIONS] --expected <EXPECTED> <TARGET> <NAME>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `args`: `--args` | `String`, 1, `Set` | 否；条件必填见行为; `{}` | — | 原始帮助：Arguments to send, as a JSON object |
| `expected`: `--expected` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | 原始帮助：Expected output, as JSON |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |
| `kind`: `--kind` | `String`, 1, `Set` | 否；条件必填见行为; `script` | — | 原始帮助：Target kind: script &#124; workflow |
| `match`: `--match` | `String`, 1, `Set` | 否；条件必填见行为; `subset` | — | 原始帮助：Match mode: subset (expected keys must appear) or exact |
| `name`: `<NAME> (#2)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | 原始帮助：A name for this case, unique per target |
| `target`: `<TARGET> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | 原始帮助：Target name (folder-qualified) |

Clap 参数组（literal metadata）：`{"arguments":["args","expected","json","kind","match","name","target"],"id":"Create","multiple":true,"required":false}`

**输入、行为与副作用。** 保存 target/name/args/expected 与 subset/exact 比较。--args 须对象；expected 是 JSON，不是文件路径。启用用例会阻挡未来 publish apply 并执行在线目标，非离线假资源。保存本身不立即运行。

**实际输出与退出。** 文本: created test case &lt;name&gt; (UUID)；--json 打印创建行。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat testcase create demo_echo demo_ok --expected '{"ok":true}' --json
```

**失败处理、验证与清理。** JSON/match 错误、用例重名或目标无效会失败。保存 UUID 并 show，明确允许后再 run。清理用 testcase delete &lt;id&gt;；disable 保留数据但不再阻挡。

## viat testcase delete

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat testcase delete [OPTIONS] <ID>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `id`: `<ID> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |

Clap 参数组（literal metadata）：`{"arguments":["id","json"],"id":"Delete","multiple":true,"required":false}`

**输入、行为与副作用。** 删除一个保存用例及未来发布门槛，不删除目标/执行历史。

**实际输出与退出。** 文本: deleted test case &lt;id&gt;；--json 输出服务端响应。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat testcase delete 00000000-0000-4000-8000-000000000001
```

**失败处理、验证与清理。** 保留 show 输出回退；ID 不存在失败。list 核查；用原 args/expected/match 重建并恢复启用状态（UUID 会变）。

## viat testcase disable

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat testcase disable [OPTIONS] <ID>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `id`: `<ID> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |

Clap 参数组（literal metadata）：`{"arguments":["id","json"],"id":"Disable","multiple":true,"required":false}`

**输入、行为与副作用。** 禁用此保存用例的发布回归门槛。不运行，不移除 expected/args。

**实际输出与退出。** 文本: disabled test case &lt;id&gt;；--json 返回更新行。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat testcase disable 00000000-0000-4000-8000-000000000001
```

**失败处理、验证与清理。** UUID 不存在会失败。testcase show 核查；用 enable 反转。禁用门槛可放过坏发布，应记录原因。

## viat testcase enable

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat testcase enable [OPTIONS] <ID>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `id`: `<ID> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |

Clap 参数组（literal metadata）：`{"arguments":["id","json"],"id":"Enable","multiple":true,"required":false}`

**输入、行为与副作用。** 启用此保存用例的发布回归门槛。不运行，不移除 expected/args。

**实际输出与退出。** 文本: enabled test case &lt;id&gt;；--json 返回更新行。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat testcase enable 00000000-0000-4000-8000-000000000001
```

**失败处理、验证与清理。** UUID 不存在会失败。testcase show 核查；用 disable 反转。未来发布会执行在线目标，应先审查副作用。

## viat testcase list

**前提与权限。** 平台登录、已选择项目，并且是该项目成员（包括 Operator）。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat testcase list [OPTIONS] <TARGET>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |
| `kind`: `--kind` | `String`, 1, `Set` | 否；条件必填见行为; `script` | — | 原始帮助：Target kind: script &#124; workflow |
| `target`: `<TARGET> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | 原始帮助：Target name (folder-qualified, e.g. `lab/ingress`) |

Clap 参数组（literal metadata）：`{"arguments":["json","kind","target"],"id":"List","multiple":true,"required":false}`

**输入、行为与副作用。** 列某个限定脚本/工作流目标的已保存回归用例；--kind 默认 script。

**实际输出与退出。** 文本含数量、on/off、名称、UUID 和 match；--json 为数组。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat testcase list demo_echo --json
```

**失败处理、验证与清理。** 这些读取不执行目标，也不验证当前输出。用例不存在/kind 无效会失败。无远程变更；保存的 args/输出可能敏感。

## viat testcase run

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat testcase run [OPTIONS] <ID>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `id`: `<ID> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |

Clap 参数组（literal metadata）：`{"arguments":["id","json"],"id":"Run","multiple":true,"required":false}`

**输入、行为与副作用。** 立即针对在线草稿目标和真实资源跑用例；不是 script test/endpoint test。

**实际输出与退出。** 文本为 PASS/FAIL/ERROR/SKIPPED 及不匹配路径；--json 返回 outcome。仅 passed 退出 0；skipped/failed/errored/其他均 1。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat testcase run 00000000-0000-4000-8000-000000000001 --json
```

**失败处理、验证与清理。** 改 expected 前区分不匹配与运行错误。重跑可重复业务写入，无自动撤销。使用隔离资源夹具，明确授权后清理其数据。

## viat testcase show

**前提与权限。** 平台登录、已选择项目，并且是该项目成员（包括 Operator）。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat testcase show [OPTIONS] <ID>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `id`: `<ID> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |

Clap 参数组（literal metadata）：`{"arguments":["id","json"],"id":"Show","multiple":true,"required":false}`

**输入、行为与副作用。** 按 UUID 读已存回归用例，包括准确 args 和 expected。

**实际输出与退出。** 文本含 name/target/enabled/match/args/expected；--json 为对象。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat testcase show 00000000-0000-4000-8000-000000000001 --json
```

**失败处理、验证与清理。** 这些读取不执行目标，也不验证当前输出。用例不存在/kind 无效会失败。无远程变更；保存的 args/输出可能敏感。

## viat testcase update

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat testcase update [OPTIONS] <ID>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `args`: `--args` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：New arguments, as a JSON object |
| `expected`: `--expected` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：New expected output, as JSON |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `id`: `<ID> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |
| `match`: `--match` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：New match mode: subset &#124; exact |
| `name`: `--name` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：New name (unique per target) |

Clap 参数组（literal metadata）：`{"arguments":["args","expected","id","json","match","name"],"id":"Update","multiple":true,"required":false}`

**输入、行为与副作用。** 部分 PUT 只发传入 --name/--args/--expected/--match，至少一项。不改目标绑定、不执行。

**实际输出与退出。** 文本: updated test case &lt;id&gt;；--json 返回更新对象。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat testcase update 00000000-0000-4000-8000-000000000001 --expected '{"ok":true}'
```

**失败处理、验证与清理。** JSON/match/无选项会失败；保存旧 expected/args，避免误改削弱门槛。show 核查；再 update 旧值回退。

## 实现核对依据

语法来自固定 Clap 合同与 main.rs；行为/权限核对以下源文件，路径相对产品仓库根。

- `crates/viat-cli/src/commands/test_case.rs`
- `crates/viat-api/src/handlers/test_cases.rs`
