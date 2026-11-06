---
title: "CLI：publish"
description: "Viat 1.1.0 publish 的完整语法、逐命令权限、输出、副作用与恢复。"
doc_id: cli.publish
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.publish.apply","cli.publish.history","cli.publish.plan","cli.publish.rollback","cli.publish.show"]
---

# CLI：publish

先读 [CLI 总览](overview.md)：会话/目录、退出约定、角色边界、合成占位 ID 和执行授权规则在其中统一定义。本页逐叶补充例外；以下命令不是按顺序执行的脚本。

- [viat publish apply](#viat-publish-apply)
- [viat publish history](#viat-publish-history)
- [viat publish plan](#viat-publish-plan)
- [viat publish rollback](#viat-publish-rollback)
- [viat publish show](#viat-publish-show)

## viat publish apply

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin；Developer/Operator 不可发布。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat publish apply [OPTIONS]
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `acknowledge_test_failures`: `--acknowledge-test-failures` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | 原始帮助：Publish even if enabled test cases (the server regression gate) fail |
| `acknowledge_warnings`: `--acknowledge-warnings` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | 原始帮助：Publish even if the server reports warnings (parameter declarations that disagree with the script, …) — they are recorded on the revision. Without it any warning refuses the whole batch |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |
| `require_tests`: `--require-tests` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | 原始帮助：Run the project's offline tests (`viat script test`) first and refuse to publish if any fail |
| `yes`: `--yes` / `-y` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |

Clap 参数组（literal metadata）：`{"arguments":["acknowledge_test_failures","acknowledge_warnings","json","require_tests","yes"],"id":"Apply","multiple":true,"required":false}`

**输入、行为与副作用。** 以单版本事务发布全部脏端点。无 --yes/--json 则询问；拒绝打印 Aborted 并退出 0。--require-tests 先跑本地 script test。已启用服务端回归用例跑真实资源；警告/失败阻止整个批次，除非相应 --acknowledge-*。

**实际输出与退出。** 文本列快照/构建结果或 Nothing to publish。--json 原样打印响应/拒绝体，非 2xx 退出 1。已接受发布内的构建失败/待构建本身不导致 CLI 非零；安装失败/进行中路由也可已生效。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat publish apply --yes
```

**失败处理、验证与清理。** 应修复用例/警告，不自动确认。核查 history/show、build/env 和授权冒烟请求。publish rollback 只恢复最新版本快照，不回退资源、schema 或测试副作用。

## viat publish history

**前提与权限。** 平台登录、已选择项目，并且是该项目成员（包括 Operator）。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat publish history [OPTIONS]
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |
| `limit`: `--limit` | `u32`, 1, `Set` | 否；条件必填见行为; `20` | — | — |
| `offset`: `--offset` | `u32`, 1, `Set` | 否；条件必填见行为; `0` | — | — |

Clap 参数组（literal metadata）：`{"arguments":["json","limit","offset"],"id":"History","multiple":true,"required":false}`

**输入、行为与副作用。** 按 limit/offset 列项目发布版本；服务端 limit 限 1–100，offset 最小 0。

**实际输出与退出。** 文本版本摘要，或 --json 的 total/limit/offset/revisions 对象。默认 20 和 0。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat publish history --limit 20 --offset 0 --json
```

**失败处理、验证与清理。** 只需成员，不同于需 publisher 的 endpoint history。旧版本须分页；无变更/清理。

## viat publish plan

**前提与权限。** 平台登录、已选择项目，并且是该项目成员（包括 Operator）。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat publish plan [OPTIONS]
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |

Clap 参数组（literal metadata）：`{"arguments":["json"],"id":"Plan","multiple":true,"required":false}`

**输入、行为与副作用。** 列项目可发布脏叶与草稿/活跃摘要。服务端也修复依赖闭包过期 dirty 标记；不激活路由。

**实际输出与退出。** 文本含目标/版本/状态/差异；--json 返回含 publishable_count 计划。空计划退出 0。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat publish plan --json
```

**失败处理、验证与清理。** 计划不是预留：并发编辑可改变 apply。除内部标记修复外对调用者只读，无需回退。apply 前审查真实测试/构建副作用。

## viat publish rollback

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin；Developer/Operator 不可发布。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat publish rollback [OPTIONS]
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |
| `yes`: `--yes` / `-y` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |

Clap 参数组（literal metadata）：`{"arguments":["json","yes"],"id":"Rollback","multiple":true,"required":false}`

**输入、行为与副作用。** 回滚最新项目发布版本，包括原先未发布端点。不接受任意版本参数。无 --yes/--json 则询问；拒绝退出 0。

**实际输出与退出。** 文本逐端点打印恢复快照/未发布；--json 返回响应。询问模式无版本时打印 Nothing to roll back 并退出 0。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat publish rollback --yes
```

**失败处理、验证与清理。** 操作前后检查 history/show。外部库/资源和当前草稿不回退。恢复较新变更前检查草稿再发布；勿假定重复 rollback 安全切换。

## viat publish show

**前提与权限。** 平台登录、已选择项目，并且是该项目成员（包括 Operator）。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat publish show [OPTIONS] <REVISION_ID>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |
| `revision_id`: `<REVISION_ID> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["json","revision_id"],"id":"Show","multiple":true,"required":false}`

**输入、行为与副作用。** 以完整 UUID 或无歧义前缀读项目版本，不是端点快照 ID。

**实际输出与退出。** 文本为前后快照变更；--json 完整版本详情。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat publish show 00000000-0000-4000-8000-000000000001 --json
```

**失败处理、验证与清理。** 前缀不存在/歧义会失败：用 history 完整 ID。读取不回滚/发布，无需清理。

## 实现核对依据

语法来自固定 Clap 合同与 main.rs；行为/权限核对以下源文件，路径相对产品仓库根。

- `crates/viat-cli/src/commands/publish.rs`
- `crates/viat-api/src/handlers/publish.rs`
- `crates/viat-api/src/handlers/snapshots.rs`
