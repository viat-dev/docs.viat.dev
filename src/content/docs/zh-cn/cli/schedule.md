---
title: "CLI：schedule"
description: "Viat 1.1.0 schedule 的完整语法、逐命令权限、输出、副作用与恢复。"
doc_id: cli.schedule
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.schedule.create","cli.schedule.delete","cli.schedule.list","cli.schedule.pause","cli.schedule.resume","cli.schedule.show","cli.schedule.trigger","cli.schedule.update"]
---

# CLI：schedule

先读 [CLI 总览](overview.md)：会话/目录、退出约定、角色边界、合成占位 ID 和执行授权规则在其中统一定义。本页逐叶补充例外；以下命令不是按顺序执行的脚本。

- [viat schedule create](#viat-schedule-create)
- [viat schedule delete](#viat-schedule-delete)
- [viat schedule list](#viat-schedule-list)
- [viat schedule pause](#viat-schedule-pause)
- [viat schedule resume](#viat-schedule-resume)
- [viat schedule show](#viat-schedule-show)
- [viat schedule trigger](#viat-schedule-trigger)
- [viat schedule update](#viat-schedule-update)

## viat schedule create

**前提与权限。** 平台登录、已选择项目，并且是该项目成员（包括 Operator）。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat schedule create [OPTIONS] <NAME>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `cron`: `--cron` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 冲突 ID：every_secs |
| `disabled`: `--disabled` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |
| `every_secs`: `--every-secs` | `i64`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 冲突 ID：cron |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `inputs`: `--inputs` | `String`, 1, `Set` | 否；条件必填见行为; `{}` | — | — |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `script`: `--script` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 冲突 ID：workflow |
| `workflow`: `--workflow` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 冲突 ID：script |

Clap 参数组（literal metadata）：`{"arguments":["cron","disabled","every_secs","inputs","name","script","workflow"],"id":"Create","multiple":true,"required":false}`

**输入、行为与副作用。** 创建调度：运行时 --cron/--every-secs 必选其一，--script/--workflow 必选其一。--inputs 须为 JSON 对象。默认 enabled=true、inputs={}；--disabled 保存为暂停。未暴露逐调度时区/重试/端点目标参数。

**实际输出与退出。** stdout: created &lt;name&gt;。启用后可执行真实目标副作用；保存不走草稿/发布流程。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat schedule create demo_tick --every-secs 3600 --script demo_echo --disabled
```

**失败处理、验证与清理。** 触发器无效、缺目标、非对象输入或目标不存在会失败。本版本这些 API 写入不同于内容编辑，只需成员身份。用 schedule show 验证；用完 pause/delete demo_tick。update 前保存完整旧 trigger/target/inputs/enabled。

## viat schedule delete

**前提与权限。** 平台登录、已选择项目，并且是该项目成员（包括 Operator）。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat schedule delete <NAME>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["name"],"id":"Delete","multiple":true,"required":false}`

**输入、行为与副作用。** 删除调度配置，不删除已发出执行及目标脚本/工作流。

**实际输出与退出。** stdout: deleted &lt;name&gt;；DELETE 可处理服务端空 204 响应。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat schedule delete demo_tick
```

**失败处理、验证与清理。** 名称不存在失败。list 验证；需要时从完整保存配置重建。删除不能召回运行中任务。

## viat schedule list

**前提与权限。** 平台登录、已选择项目，并且是该项目成员（包括 Operator）。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat schedule list [OPTIONS]
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |

Clap 参数组（literal metadata）：`{"arguments":["json"],"id":"List","multiple":true,"required":false}`

**输入、行为与副作用。** 读已保存的运行调度，不是仓库 YAML 或发布快照。

**实际输出与退出。** 文本为名称、active/paused、触发器、目标、next_due；--json 返回行。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat schedule list --json
```

**失败处理、验证与清理。** 未选项目/无权限会失败。空列表成功，不证明调度器健康。只读，无需清理。

## viat schedule pause

**前提与权限。** 平台登录、已选择项目，并且是该项目成员（包括 Operator）。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat schedule pause <NAME>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["name"],"id":"Pause","multiple":true,"required":false}`

**输入、行为与副作用。** 禁用后续自动调度，不取消正在运行执行。

**实际输出与退出。** stdout: paused &lt;name&gt;；服务端返回变更行。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat schedule pause demo_tick
```

**失败处理、验证与清理。** 不存在则失败。show 确认 paused；resume 恢复时重算 next_due，而非旧到期时间。

## viat schedule resume

**前提与权限。** 平台登录、已选择项目，并且是该项目成员（包括 Operator）。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat schedule resume <NAME>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["name"],"id":"Resume","multiple":true,"required":false}`

**输入、行为与副作用。** 启用调度并相对现在重算 cron/interval 的 next_due，使用已存时区。CLI 不能创建 once 调度，其 API resume 语义不同。

**实际输出与退出。** stdout: resumed &lt;name&gt; (next_due now: &lt;timestamp&gt;)。之后可发生真实自动执行。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat schedule resume demo_tick
```

**失败处理、验证与清理。** 恢复前 show 核查 next_due 和输入。再 pause 可停止后续执行，但不会撤销已发生/进行中的副作用。

## viat schedule show

**前提与权限。** 平台登录、已选择项目，并且是该项目成员（包括 Operator）。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat schedule show [OPTIONS] <NAME>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["json","name"],"id":"Show","multiple":true,"required":false}`

**输入、行为与副作用。** 读单个调度，含输入、启用状态及执行指针。

**实际输出与退出。** 文本为 name/status/trigger/target/inputs/next_due/last_fired/last_run；--json 完整对象。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat schedule show demo_tick --json
```

**失败处理、验证与清理。** 404 不是暂停：查 list。跟随 last_run 查执行效果，不只看 next_due。无变更/清理。

## viat schedule trigger

**前提与权限。** 平台登录、已选择项目，并且是该项目成员（包括 Operator）。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat schedule trigger <NAME>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["name"],"id":"Trigger","multiple":true,"required":false}`

**输入、行为与副作用。** 手动触发已存目标一次，与未来到期独立；即使诊断也可发生真实副作用。

**实际输出与退出。** stdout 仅裸 request_id。退出 0 表示触发响应成功，不必然是最终运行成功。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat schedule trigger demo_tick
```

**失败处理、验证与清理。** 用 logs show <request_id> 查完成后再重试。断连后勿盲试；可重复变更。无自动撤销。

## viat schedule update

**前提与权限。** 平台登录、已选择项目，并且是该项目成员（包括 Operator）。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat schedule update [OPTIONS] <NAME>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `cron`: `--cron` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 冲突 ID：every_secs |
| `disabled`: `--disabled` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |
| `every_secs`: `--every-secs` | `i64`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 冲突 ID：cron |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `inputs`: `--inputs` | `String`, 1, `Set` | 否；条件必填见行为; `{}` | — | — |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `script`: `--script` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 冲突 ID：workflow |
| `workflow`: `--workflow` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 冲突 ID：script |

Clap 参数组（literal metadata）：`{"arguments":["cron","disabled","every_secs","inputs","name","script","workflow"],"id":"Update","multiple":true,"required":false}`

**输入、行为与副作用。** 完整 PUT upsert，不是部分更新：运行时 --cron/--every-secs 必选其一，--script/--workflow 必选其一。--inputs 须为 JSON 对象。默认 enabled=true、inputs={}；--disabled 保存为暂停。未暴露逐调度时区/重试/端点目标参数。

**实际输出与退出。** stdout: updated &lt;name&gt;。启用后可执行真实目标副作用；保存不走草稿/发布流程。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat schedule update demo_tick --every-secs 3600 --script demo_echo --disabled
```

**失败处理、验证与清理。** 触发器无效、缺目标、非对象输入或目标不存在会失败。本版本这些 API 写入不同于内容编辑，只需成员身份。用 schedule show 验证；用完 pause/delete demo_tick。update 前保存完整旧 trigger/target/inputs/enabled。

## 实现核对依据

语法来自固定 Clap 合同与 main.rs；行为/权限核对以下源文件，路径相对产品仓库根。

- `crates/viat-cli/src/commands/schedule.rs`
- `crates/viat-api/src/handlers/schedules.rs`
