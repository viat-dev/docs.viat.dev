---
title: "CLI：authz"
description: "Viat 1.1.0 authz 的完整语法、逐命令权限、输出、副作用与恢复。"
doc_id: cli.authz
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.authz.rule.list","cli.authz.rule.set-origin"]
---

# CLI：authz

先读 [CLI 总览](overview.md)：会话/目录、退出约定、角色边界、合成占位 ID 和执行授权规则在其中统一定义。本页逐叶补充例外；以下命令不是按顺序执行的脚本。

- [viat authz rule list](#viat-authz-rule-list)
- [viat authz rule set-origin](#viat-authz-rule-set-origin)

## viat authz rule list

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat authz rule list [OPTIONS]
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |
| `origin`: `--origin` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Only `platform` or only `delegated` rules |
| `ty`: `--type` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Only rules on this type |

Clap 参数组（literal metadata）：`{"arguments":["json","origin","ty"],"id":"List","multiple":true,"required":false}`

**输入、行为与副作用。** 读服务端授权规则；--origin 可选 platform/delegated，--type 筛模型类型。不是项目角色/端点认证设置。

**实际输出与退出。** 文本为规则 ID/origin/effect/type.action/表达式；--json 筛后规则数组。无匹配成功。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat authz rule list --origin platform --json
```

**失败处理、验证与清理。** origin 无效在本地失败。用此 ID 交接；不改策略，无需清理。读取版本不保证之后 push 不变。

## viat authz rule set-origin

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat authz rule set-origin [OPTIONS] --origin <ORIGIN> [IDS]...
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `dry_run`: `--dry-run` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | 原始帮助：List what would change, change nothing |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `ids`: `<IDS> (#1)` | `String`, 1..∞, `Append` | 否；条件必填见行为; Clap 无显式默认 | — | — |
| `not_in_file`: `--not-in-file` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |
| `origin`: `--origin` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | 原始帮助：`delegated` (a business screen owns it; push leaves it alone) or `platform` (the repo owns it; push mirrors it) |

Clap 参数组（literal metadata）：`{"arguments":["dry_run","ids","not_in_file","origin"],"id":"SetOrigin","multiple":true,"required":false}`

**输入、行为与副作用。** 选择显式规则 ID 或 --not-in-file，不能同时/都不选。--not-in-file 需 CWD viat.yaml 有 authz 并 --origin delegated；按内容选文件未声明 platform 规则。--dry-run 列变更。实际逐规则 PUT，同 origin 跳过。

**实际输出与退出。** 文本为 would-set/set/nothing-to-change。失败报告已改和剩余；部分写保留。成功交接后仅原本当前 checkout 的模型版本记录前进，过期 checkout 仍过期。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat authz rule set-origin 00000000-0000-4000-8000-000000000001 --origin delegated --dry-run
```

**失败处理、验证与清理。** 移交前检查预览：未来 push 仅镜像 platform 规则。回退需把同 ID 显式设回旧 origin。部分失败后 list/核对再续；无全规则事务。

## 实现核对依据

语法来自固定 Clap 合同与 main.rs；行为/权限核对以下源文件，路径相对产品仓库根。

- `crates/viat-cli/src/commands/authz.rs`
- `crates/viat-cli/src/repo/model_guard.rs`
- `crates/viat-api/src/handlers/authz_console.rs`
