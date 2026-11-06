---
title: "CLI：project"
description: "Viat 1.1.0 project 的完整语法、逐命令权限、输出、副作用与恢复。"
doc_id: cli.project
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.project.create","cli.project.diff","cli.project.folderize","cli.project.init","cli.project.list","cli.project.member.add","cli.project.member.ls","cli.project.member.rm","cli.project.member.set-role","cli.project.select"]
---

# CLI：project

先读 [CLI 总览](overview.md)：会话/目录、退出约定、角色边界、合成占位 ID 和执行授权规则在其中统一定义。本页逐叶补充例外；以下命令不是按顺序执行的脚本。

- [viat project create](#viat-project-create)
- [viat project diff](#viat-project-diff)
- [viat project folderize](#viat-project-folderize)
- [viat project init](#viat-project-init)
- [viat project list](#viat-project-list)
- [viat project member add](#viat-project-member-add)
- [viat project member ls](#viat-project-member-ls)
- [viat project member rm](#viat-project-member-rm)
- [viat project member set-role](#viat-project-member-set-role)
- [viat project select](#viat-project-select)

## viat project create

**前提与权限。** 已配置服务端并完成平台登录；无需选择项目。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat project create <SLUG> <NAME>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `name`: `<NAME> (#2)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `slug`: `<SLUG> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["name","slug"],"id":"Create","multiple":true,"required":false}`

**输入、行为与副作用。** POST /projects 仅创建远程项目，创建者成为 Owner。不生成文件、不选择项目。slug 与显示名是两个位置参数。

**实际输出与退出。** stdout: created &lt;slug&gt;；响应成功后退出 0。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat project create cli-demo 'CLI Demo'
```

**失败处理、验证与清理。** slug 重复/无效时失败，不创建第二个。用 project list 验证并显式 select。不需要的演示项目通过控制台/API 删除（CLI 无 project delete）。

## viat project diff

**前提与权限。** 平台登录、已选择项目，并且是该项目成员（包括 Operator）。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat project diff [OPTIONS]
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `exit_code`: `--exit-code` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | 原始帮助：Exit 1 if there are any differences (matches `git diff --exit-code`) |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |
| `only`: `--only` | `String`, 1, `Append` | 否；条件必填见行为; Clap 无显式默认 | — | 值分隔符："," |

Clap 参数组（literal metadata）：`{"arguments":["exit_code","json","only"],"id":"Diff","multiple":true,"required":false}`

**输入、行为与副作用。** 比较 CWD 仓库与服务端草稿，不是发布状态或 push 请求计划。--only 校验类别，不支持 crate。仅服务端存在的脚本/工作流/资源只是信息，因为 push 不删这些。

**实际输出与退出。** 文本标记新增/移除/修改/仅服务端；--json 为各阶段 added/removed/changed/server_only 数组。--exit-code 仅真实差异退出 1，server_only 不算；不带该项有差异也退出 0。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat project diff --only scripts,workflows --exit-code
```

**失败处理、验证与清理。** 在完整仓库根执行并核对项目。未知类别失败；元数据读取可能需 editor。push 前解决草稿差异；没有远程变更需撤销。

## viat project folderize

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin；Developer/Operator 不可发布。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat project folderize [OPTIONS] --prefix <PREFIXES>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `apply`: `--apply` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | 原始帮助：Actually apply the migration (single server-side transaction) |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |
| `prefixes`: `--prefix` | `String`, 1, `Append` | 是; Clap 无显式默认 | — | 原始帮助：Prefix to split on (repeatable). `jzyx` moves `jzyx_util` to `jzyx/util` |

Clap 参数组（literal metadata）：`{"arguments":["apply","json","prefixes"],"id":"Folderize","multiple":true,"required":false}`

**输入、行为与副作用。** 默认预览；--apply 在服务端单事务中将前缀改为文件夹并重写引用，保留 UUID。可重复 --prefix。要求项目 Owner/Admin。

**实际输出与退出。** 打印计划/已执行的移动和重写；--json 返回计划/结果。已发布快照须重新发布才变。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat project folderize --prefix legacy --json
```

**失败处理、验证与清理。** 冲突时拒绝，不覆盖。先审查预览，再 apply 并 pull：旧本地路径已过时。无反向 folderize 选项；保留备份并显式重命名/重写恢复。

## viat project init

**前提与权限。** 已配置服务端并完成平台登录；无需选择项目。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat project init [OPTIONS] <SLUG>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `here`: `--here` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | 原始帮助：Scaffold in CWD instead of ./&lt;slug&gt;/. CWD must be empty (apart from .git/.idea/.claude) |
| `name`: `--name` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认；运行时：`slug` | — | — |
| `server`: `--server` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认；运行时：`配置中的 server_url` | — | 原始帮助：Override server URL (otherwise uses the loaded config) |
| `slug`: `<SLUG> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["here","name","server","slug"],"id":"Init","multiple":true,"required":false}`

**输入、行为与副作用。** 创建远程项目和本地仓库（默认 ./&lt;slug&gt;，--here 用 CWD）。运行时 --name 默认为 slug。--here 仅容许 .git/.idea/.claude/.vscode/.viat，其余非空目录拒绝。写入配置、viat.yaml 和 endpoints/scripts/workflows/schedules/watches/ws_triggers/resources 目录。--server 只覆盖目的地，不提供登录权限。

**实际输出与退出。** 打印远程创建、目录和项目选择；新仓库配置选中项目。不执行 push/publish。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat project init cli-demo --name 'CLI Demo'
```

**失败处理、验证与清理。** 远程与文件系统不是同一事务：失败可能留下目录或项目。重试前两边核查；勿盲删非演示项目。用完删除演示本地目录，并通过控制台/API 删除远程演示项目。

## viat project list

**前提与权限。** 已配置服务端并完成平台登录；无需选择项目。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat project list [OPTIONS]
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |

Clap 参数组（literal metadata）：`{"arguments":["json"],"id":"List","multiple":true,"required":false}`

**输入、行为与副作用。** GET /projects 仅列调用者可访问的项目；平台级别不自动赋予项目成员身份。

**实际输出与退出。** 文本显示 slug、显示名和所选项目的 *；--json 输出服务端列表。空列表也成功。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat project list --json
```

**失败处理、验证与清理。** 缺少项目需取得成员身份，不是反复 select。无变更，无需清理。

## viat project member add

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin；Developer/Operator 不可发布。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat project member add [OPTIONS] --role <ROLE> <EMAIL>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `email`: `<EMAIL> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |
| `role`: `--role` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | 原始帮助：Project role: owner&#124;admin&#124;developer&#124;operator |

Clap 参数组（literal metadata）：`{"arguments":["email","json","role"],"id":"Add","multiple":true,"required":false}`

**输入、行为与副作用。** 把现有平台邮箱加入项目并授予独立 owner/admin/developer/operator 角色。CLI 规范化角色大小写。不会邀请未注册账号。

**实际输出与退出。** 文本: &lt;email&gt; added to &lt;slug&gt; as &lt;role&gt;；--json 打印响应。成员身份立即生效。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat project member add teammate@example.invalid --role developer
```

**失败处理、验证与清理。** 邮箱不存在则失败：新账号用 user invite --project 并带 --role。用 member ls 验证；用 member rm 移除演示成员，受最后 Owner 保护。

## viat project member ls

**前提与权限。** 平台登录、已选择项目，并且是该项目成员（包括 Operator）。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat project member ls [OPTIONS]
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |

Clap 参数组（literal metadata）：`{"arguments":["json"],"id":"Ls","multiple":true,"required":false}`

**输入、行为与副作用。** GET 所选项目 /members；协作者是平台账号，不是 p-user 行。

**实际输出与退出。** 文本为邮箱、角色、显示名或 (no members)；--json 保留 user_id 与时间戳。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat project member ls --json
```

**失败处理、验证与清理。** 403 表示不是成员。向项目 Owner/Admin 申请；只读，无需清理。

## viat project member rm

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin；Developer/Operator 不可发布。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat project member rm [OPTIONS] <EMAIL>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `email`: `<EMAIL> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |

Clap 参数组（literal metadata）：`{"arguments":["email","json"],"id":"Rm","multiple":true,"required":false}`

**输入、行为与副作用。** 按邮箱 DELETE 成员；若另有 Owner 可移除自己。同时删除该成员项目推送设备注册；重新加入不会恢复注册。不能移除最后 Owner。

**实际输出与退出。** 文本: &lt;email&gt; removed from &lt;slug&gt;；--json 打印 {ok:true}。立即失去项目访问。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat project member rm teammate@example.invalid
```

**失败处理、验证与清理。** 最后 Owner 拒绝时先添加其他 Owner。以原角色重新 add 恢复成员，设备需另行注册。不删除平台账号本身。

## viat project member set-role

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin；Developer/Operator 不可发布。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat project member set-role [OPTIONS] <EMAIL> <ROLE>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `email`: `<EMAIL> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |
| `role`: `<ROLE> (#2)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["email","json","role"],"id":"SetRole","multiple":true,"required":false}`

**输入、行为与副作用。** 按邮箱 PUT 成员角色。项目角色独立于 user set-role 平台角色。不能降级最后项目 Owner。

**实际输出与退出。** 文本: &lt;email&gt; is now &lt;role&gt; in &lt;slug&gt;；--json 打印响应。权限立即改变。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat project member set-role teammate@example.invalid operator
```

**失败处理、验证与清理。** 降级前先提升另一 Owner；邮箱无效/非成员会失败。记录原角色并用 set-role 恢复；member ls 验证。

## viat project select

**前提与权限。** 已配置服务端并完成平台登录；无需选择项目。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat project select <SLUG>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `slug`: `<SLUG> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["slug"],"id":"Select","multiple":true,"required":false}`

**输入、行为与副作用。** 先以 GET /projects 核对 slug，再在本地配置保存 current_project。不切目录、不 pull、不生成目录，也不签发项目 token。

**实际输出与退出。** stdout: selected cli-demo；成功 0。本地选择会影响后续项目命令。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat project select cli-demo
```

**失败处理、验证与清理。** 未知/不可访问 slug 退出 1，不会选中。用 project list 核查；选回原 slug 即可恢复。

## 实现核对依据

语法来自固定 Clap 合同与 main.rs；行为/权限核对以下源文件，路径相对产品仓库根。

- `crates/viat-cli/src/commands/project.rs`
- `crates/viat-cli/src/commands/diff.rs`
- `crates/viat-cli/src/repo/diff.rs`
- `crates/viat-api/src/handlers/projects.rs`
