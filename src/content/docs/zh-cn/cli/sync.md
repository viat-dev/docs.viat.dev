---
title: "CLI：push / pull / export / import"
description: "Viat 1.1.0 push / pull / export / import 的完整语法、逐命令权限、输出、副作用与恢复。"
doc_id: cli.sync
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.export","cli.import","cli.pull","cli.push"]
---

# CLI：push / pull / export / import

先读 [CLI 总览](overview.md)：会话/目录、退出约定、角色边界、合成占位 ID 和执行授权规则在其中统一定义。本页逐叶补充例外；以下命令不是按顺序执行的脚本。

- [viat export](#viat-export)
- [viat import](#viat-import)
- [viat pull](#viat-pull)
- [viat push](#viat-push)

## 合成夹具与执行边界

这些文件只为下面例子提供输入；创建远程对象、执行脚本、数据库 SQL 或存储操作前，必须自行准备隔离项目并明确授权。生成文档不执行任何例子。

仓库布局：viat.yaml；scripts/&lt;folder&gt;/&lt;name&gt;.&lt;ext&gt;；workflows/resources/schedules/watches/queue_triggers/ws_triggers 下的 YAML；im/accounts 与 im/triggers；endpoints/&lt;tree&gt;/ 的节点文件；crate/；migrations/&lt;resource&gt;/*.sql 与 authz/migrations/*.yaml（后两者不是同一套迁移）。文件夹是资产身份的一部分。

资源 secret 的字符串 $secret 是“不导出秘密”的占位，push 会去掉，不能创建凭据；{$secret: name} / "$secret:name" 是支持位置的资源引用，不是同一东西。顶层 plain 的 $keep 只保留服务端已有值，新资源不能用；不是深合并。

同步不会维护所有客户端面：项目设置、秘密、扫码聊天绑定等有明确边界。聊天仅能同步以资源持有凭据的账号；行秘密/扫码账号不会 pull 也不会因缺文件被 push 删除。publish 不等于 push，SQL 迁移也不会自动执行。

## viat export

**前提与权限。** 平台登录、已选择项目，并且是该项目成员（包括 Operator）。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat export [OPTIONS] [SLUG]
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `only`: `--only` | `String`, 1, `Append` | 否；条件必填见行为; Clap 无显式默认 | — | 值分隔符："," |
| `output`: `--output` / `-o` | `PathBuf`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认；运行时：`./<slug>.viatpkg` | — | 原始帮助：Output path (defaults to `./<slug>.viatpkg`) |
| `slug`: `<SLUG> (#1)` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认；运行时：`current_project` | — | 原始帮助：Project slug to export (defaults to the selected project) |

Clap 参数组（literal metadata）：`{"arguments":["only","output","slug"],"id":"Export","multiple":true,"required":false}`

**输入、行为与副作用。** 把所选/位置参数项目新 pull 到临时目录，打成 gzip tar .viatpkg 后清临时目录。输出默认 ./&lt;slug&gt;.viatpkg。--only 类别与权限同 pull。不导出凭据、不切项目。

**实际输出与退出。** 打印 pull 进度，再 exported project &lt;slug&gt; -> &lt;path&gt;；可覆盖已有输出文件。不是整服务端备份，也不备上游 DB/文件字节。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat export cli-demo --output demo.viatpkg
```

**失败处理、验证与清理。** 完整导出需 editor 读取；目标/文件权限错可在 pull 后失败。bundle 含 plain/源码/config，须保密。用完删除 demo.viatpkg；导入时秘密另行恢复。

## viat import

**前提与权限。** 已配置服务端并完成平台登录；无需选择项目。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat import [OPTIONS] <FILE>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `as_slug`: `--as` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Import under a different project slug than the bundle's own |
| `file`: `<FILE> (#1)` | `PathBuf`, 1, `Set` | 是; Clap 无显式默认 | — | 原始帮助：Path to the `.viatpkg` bundle |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `only`: `--only` | `String`, 1, `Append` | 否；条件必填见行为; Clap 无显式默认 | — | 值分隔符："," |
| `prune`: `--prune` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | 原始帮助：Mirror the bundle onto the server, deleting server-only items. Off by default (non-destructive upsert) |
| `update_resources`: `--update-resources` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | 原始帮助：Also update resources that already exist here and carry secrets. Off by default: a bundle's host/port are the source environment's |

Clap 参数组（literal metadata）：`{"arguments":["as_slug","file","only","prune","update_resources"],"id":"Import","multiple":true,"required":false}`

**输入、行为与副作用。** 解包 .viatpkg 到临时目录，读 viat.yaml，必要时创建目标项目；默认非破坏 upsert。--as 改目标 slug；当前选择不是目标覆盖。--prune 明确启用镜像删除。新含秘密资源被跳过；已有含秘密资源整体保留，除非 --update-resources，防止目标凭据连源主机。

**实际输出与退出。** 打印 imported project、待发布、缺秘密跳过/保留资源摘要；跳过/保留本身不导致失败。不发布/迁移，不改变当前项目。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat import demo.viatpkg --as cli-demo-copy
```

**失败处理、验证与清理。** 已有目标各阶段需正常成员/editor/Owner-Admin 设置权限。包无效/缺 viat.yaml/阶段错误退出 1，已写阶段保留，无批回滚。先备份目标，检查跳过资源、显式选目标核查、安全提供秘密、diff 后发布。检查后才删本地演示包/残留临时目录。

## viat pull

**前提与权限。** 平台登录、已选择项目，并且是该项目成员（包括 Operator）。 CWD 须为目标仓库根、项目须匹配。跳过托管 auth 节点/角色及无法重建的行秘密/扫码聊天账号（会提示）；缺失不表示可删除。

```text
Usage: viat pull [OPTIONS]
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |
| `only`: `--only` | `String`, 1, `Append` | 否；条件必填见行为; Clap 无显式默认 | — | 值分隔符："," |

Clap 参数组（literal metadata）：`{"arguments":["json","only"],"id":"Pull","multiple":true,"required":false}`

**输入、行为与副作用。** 远程草稿 → CWD 文件，不是发布快照。--only 类别同 push，未知类别静默忽略。写/覆盖所代表文件；不是通用本地 prune/reset（如远程已删脚本可仍留本地）。秘密字段写 $secret 占位；适用时保留已有顶层 plain $keep。

**实际输出与退出。** 打印已 pull 项；--json 最后附 {"ok":true}，不保证抑制阶段文本。更新本地 authz 模型版本记录。除常规登录刷新外不改远程内容。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat pull --only scripts,workflows
```

**失败处理、验证与清理。** 完整 pull/export 包含需 editor 的角色/认证器/tree/模型读取；成员只能拉有权限阶段。先备份未提交文件；失败可留下部分本地输出。push 前检查 diff 和旧文件；勿推不完整仓库。

## viat push

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 在完整目标仓库根运行，viat.yaml project.slug 须匹配所选项目；会话发现不替你定位仓库根。类别：meta,resources,scripts,workflows,schedules,watches,queue_triggers,ws_triggers,chat,endpoints,crate。跳过内建 auth 端点/角色及旧 system 资源。

```text
Usage: viat push [OPTIONS]
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `force_authz`: `--force-authz` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | 原始帮助：Push even though the server's authorization model changed since this checkout last pulled or pushed — overwriting that change |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |
| `only`: `--only` | `String`, 1, `Append` | 否；条件必填见行为; Clap 无显式默认 | — | 值分隔符：","; 原始帮助：Comma-separated kinds (e.g. scripts,endpoints), not individual files |
| `yes`: `--yes` / `-y` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | 原始帮助：Apply deletions from the authorization model or roles (types, attrs, actions, subject attrs, roles). Without it, a push that would delete any lists them and stops |

Clap 参数组（literal metadata）：`{"arguments":["force_authz","json","only","yes"],"id":"Push","multiple":true,"required":false}`

**输入、行为与副作用。** CWD 仓库 → 远程草稿。--only 选类别而非文件，空表示全部，未知类别静默无操作。meta/调度/watch/queue/ws trigger/可同步聊天账号及 trigger/端点已默认镜像删除；脚本/工作流/资源不因缺本地文件而删。push 没有 --prune 参数。

**实际输出与退出。** 打印各阶段写入/删除、待发布与未推差异摘要；--json 最后追加 {"ok":true}，前面仍可有阶段/提示文本（不是纯单 JSON）。不运行 DDL/发布。逐阶段生效，不是全局事务。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat push --only scripts,workflows
```

**失败处理、验证与清理。** 完整元数据/设置变更可需项目 Owner/Admin；纯内容阶段需 editor，部分运行阶段仅需成员。meta 写前 authz 版本过期则拒绝，--force-authz 才越过；模型/角色删除需 --yes。两个覆盖不同，不是整个破坏性同步确认。先 diff 并完整备份；部分失败保留已完成阶段。pull/核对草稿、显式迁移 DB，再有意发布。

## 实现核对依据

语法来自固定 Clap 合同与 main.rs；行为/权限核对以下源文件，路径相对产品仓库根。

- `crates/viat-cli/src/commands/sync.rs`
- `crates/viat-cli/src/commands/bundle.rs`
- `crates/viat-cli/src/repo/{viat_yaml,resources,scripts,workflows,schedules,watches,queue_triggers,ws_triggers,im,endpoints,crate_files,model_guard,authz_steps}.rs`
