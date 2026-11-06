---
title: "CLI：script"
description: "Viat 1.1.0 script 的完整语法、逐命令权限、输出、副作用与恢复。"
doc_id: cli.script
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.script.build","cli.script.compile","cli.script.create","cli.script.delete","cli.script.env","cli.script.list","cli.script.logs","cli.script.run","cli.script.show","cli.script.test","cli.script.update","cli.script.upload"]
---

# CLI：script

先读 [CLI 总览](overview.md)：会话/目录、退出约定、角色边界、合成占位 ID 和执行授权规则在其中统一定义。本页逐叶补充例外；以下命令不是按顺序执行的脚本。

- [viat script build](#viat-script-build)
- [viat script compile](#viat-script-compile)
- [viat script create](#viat-script-create)
- [viat script delete](#viat-script-delete)
- [viat script env](#viat-script-env)
- [viat script list](#viat-script-list)
- [viat script logs](#viat-script-logs)
- [viat script run](#viat-script-run)
- [viat script show](#viat-script-show)
- [viat script test](#viat-script-test)
- [viat script update](#viat-script-update)
- [viat script upload](#viat-script-upload)

## 合成夹具与执行边界

这些文件只为下面例子提供输入；创建远程对象、执行脚本、数据库 SQL 或存储操作前，必须自行准备隔离项目并明确授权。生成文档不执行任何例子。

```python
# demo.py (also scripts/demo_echo.py in a repo checkout)
def main():
    return {"ok": True}
```

先用 script create 创建 demo_echo，再运行 show/update/run 等例子。Rust/binary 示例还须你自己的匹配 SDK/可执行程序，并非此 Python 夹具；不能用文本文件冒充二进制。离线测试须另外编写真正断言的 tests/ 夹具，空套件不等于成功覆盖。

## viat script build

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat script build [OPTIONS] <NAME>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `wait`: `--wait` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | 原始帮助：Poll until the install finishes instead of returning immediately |

Clap 参数组（literal metadata）：`{"arguments":["name","wait"],"id":"Build","multiple":true,"required":false}`

**输入、行为与副作用。** 构建已保存草稿，不发布。Python/TypeScript 预热依赖、复用单次安装；--wait 轮询。Rust 立即编译，--wait 无意义。Binary 报告 manifest 目标与本实例 artifact，而非编译。

**实际输出与退出。** 文本报告环境/构建；不带 --wait 时退出 0 仍可在安装。--wait 安装失败/超时退出 1。Rust 失败打印源码诊断和 rustc 输出，退出 1。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat script build demo_echo --wait
```

**失败处理、验证与清理。** 需服务端构建能力/工具链/包访问；可安装下载依赖，须明确允许。修复后 build 重试，逐节点 env 验证。无 CLI 撤销来删除环境/artifact。

## viat script compile

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat script compile [OPTIONS] [NAME]
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `all`: `--all` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | 原始帮助：Every rust script in the project, one after another — before switching traffic to a release that retired the artifacts. Skips those the deployment already has; exits 1 if any failed |
| `folder`: `--folder` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 冲突 ID：all; 原始帮助：Folder half of the script's identity, when the bare name is ambiguous |
| `force`: `--force` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | 原始帮助：Build even when the deployment already has this artifact |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help (see a summary with '-h') |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 冲突 ID：all |
| `push`: `--push` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | 原始帮助：Upload the binary to the deployment's artifact store |
| `sdk_path`: `--sdk-path` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认；运行时：`VIAT_RUST_SDK_PATH，否则报错` | — | 原始帮助：The `viat` SDK crate the deployment was built with. Defaults to $VIAT_RUST_SDK_PATH |

Clap 参数组（literal metadata）：`{"arguments":["all","folder","force","name","push","sdk_path"],"id":"Compile","multiple":true,"required":false}`

**输入、行为与副作用。** 仅本地 Rust 编译，使用服务端提供的精确 crate/artifact key。指定一个 name 或 --all（已发布冻结程序，不是草稿）。--push 才上传；默认不传。--force 绕过已有跳过；--sdk-path 或 VIAT_RUST_SDK_PATH 的 SDK digest 须匹配。

**实际输出与退出。** 打印编译/artifact/上传进度。--all 逐个继续，报告失败，有任一失败退出 1。已有 artifact 可成功跳过。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat script compile demo_rust --sdk-path ./viat-sdk
```

**失败处理、验证与清理。** 需本地 cargo/rustup、匹配 SDK 与服务端 OS/架构；编译可下载 crate。上传另需服务端启用；artifact key 变化会拒绝。保留源码/诊断；按需清理演示构建输出，勿盲删共享缓存。

## viat script create

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 demo.py 写 def main(): return {"ok": True}（return 放在下一缩进行）。不使用资源；之后执行需服务端 Python/uv。

```text
Usage: viat script create --name <NAME> --language <LANGUAGE> --file <FILE>
```

**命令别名：** `viat script new`

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `file`: `--file` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `language`: `--language` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `name`: `--name` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["file","language","name"],"id":"Create","multiple":true,"required":false}`

**输入、行为与副作用。** 读取 UTF-8 --file 创建草稿。--name 可为 folder/name；--language 在服务端校验。别名 new。不发布、不执行。 允许语言：python、typescript、sql、graphql、shell、llm、viat_gql、rust、binary。

**实际输出与退出。** stdout: created &lt;name&gt; (v&lt;version&gt;)。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat script create --name demo_echo --language python --file demo.py
```

**失败处理、验证与清理。** 文件缺失/语言无效/重名会失败。script show 验证；移除依赖夹具/端点后可删演示脚本。

## viat script delete

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat script delete <NAME>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["name"],"id":"Delete","multiple":true,"required":false}`

**输入、行为与副作用。** 删除保存脚本草稿，不撤销先前执行或业务资源写入。发布依赖处理与草稿删除是不同操作。

**实际输出与退出。** stdout: deleted &lt;name&gt;；DELETE 成功后 0。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat script delete demo_echo
```

**失败处理、验证与清理。** 先盘点端点/工作流/调度依赖并保存源码。list 和 publish plan 验证；需要时从保存源码重建。勿以删草稿安全撤下某路由：应使用 endpoint unpublish。

## viat script env

**前提与权限。** 平台登录、已选择项目，并且是该项目成员（包括 Operator）。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat script env [OPTIONS] <NAME>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `probe`: `--probe` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | 原始帮助：Ask the package cache instead of reporting what is recorded |

Clap 参数组（literal metadata）：`{"arguments":["json","name","probe"],"id":"Env","multiple":true,"required":false}`

**输入、行为与副作用。** GET 回答实例的依赖环境状态；--probe 检查包缓存而非仅已记录状态。不安装、不执行脚本。 普通读取只需成员；--probe 会派生探测进程，额外要求项目 Owner/Admin/Developer。

**实际输出与退出。** 文本含 key、包、状态（ready/building/failed/未构建）、安装错误与可选 probe；--json 返回原状态。环境 failed 是信息，不必然导致 CLI 非零退出。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat script env demo_echo --json
```

**失败处理、验证与清理。** 多实例须逐节点查；单次响应不代表集群就绪。用 script build 显式重试安装。读取/探测无需撤销。

## viat script list

**前提与权限。** 平台登录、已选择项目，并且是该项目成员（包括 Operator）。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat script list [OPTIONS]
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |

Clap 参数组（literal metadata）：`{"arguments":["json"],"id":"List","multiple":true,"required":false}`

**输入、行为与副作用。** 列所有文件夹当前草稿脚本，不是发布快照。

**实际输出与退出。** 文本为限定路径、语言、v&lt;version&gt;；--json 输出公开脚本列表。空列表成功。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat script list --json
```

**失败处理、验证与清理。** 使用限定名避免歧义。只读，无需清理。

## viat script logs

**前提与权限。** 平台登录、已选择项目，并且是该项目成员（包括 Operator）。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat script logs <NAME>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["name"],"id":"Logs","multiple":true,"required":false}`

**输入、行为与副作用。** 先解析脚本，再合并一页端点执行与一页草稿测试，按新到旧。工作流步骤执行归属工作流，此处没有。

**实际输出与退出。** stdout 为格式化 {items:[...]} 或无执行说明；任一源达到 50 行时 stderr 警告。没有 --json：非空输出已是 JSON。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat script logs demo_echo
```

**失败处理、验证与清理。** 旧执行/工作流步骤用 logs query/show 分页。脚本不存在则失败，不伪装空列表。无远程变更/清理。

## viat script run

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat script run [OPTIONS] <NAME>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `args`: `--args` / `--input` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认；运行时：`{}` | — | 原始帮助：JSON object of inputs. `--input` is accepted too — the workflow commands spell it that way, and the two were confused constantly |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `record`: `--record` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Record this run's http/graphql/cloud calls as cassettes under this directory (one `<resource>.yaml` each), for `viat script test` |

Clap 参数组（literal metadata）：`{"arguments":["args","name","record"],"id":"Run","multiple":true,"required":false}`

**输入、行为与副作用。** 以 JSON --args（运行时默认 {}）执行在线草稿。别名 --input。可发生真实资源调用/写入，并非离线。--record 成功后写回 http/graphql/cloud cassette。

**实际输出与退出。** 成功 stdout 格式化 output，捕获 stderr 写 stderr；ok=false 打印错误并退出 1。显式 ViatResponse/流的 output=None：成功 CLI 输出可为 null，不代表 HTTP 失败。Shell stdout 是日志，不是结果。草稿 API 不返回完整 HTTP 响应信封。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat script run demo_echo --args '{}'
```

**失败处理、验证与清理。** 运行前审查外部副作用。用 logs 核查请求；HTTP 状态/头须用发布/隔离端点验证。Cassette 不存请求凭据但可含敏感响应体：审查/删除生成文件；CLI 不能撤销外部写入。

## viat script show

**前提与权限。** 平台登录、已选择项目，并且是该项目成员（包括 Operator）。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat script show [OPTIONS] <NAME>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["json","name"],"id":"Show","multiple":true,"required":false}`

**输入、行为与副作用。** 读已保存草稿源码、版本和 dedicated worker 设置。

**实际输出与退出。** 文本含 # name (language, vN)、content、dedicated 与 dedicated_count；--json 返回完整公开对象。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat script show demo_echo --json
```

**失败处理、验证与清理。** 404/歧义：核对项目并限定文件夹。源码可能意外硬编码秘密；保护输出。无变更/清理。

## viat script test

**前提与权限。** 无需已有平台登录或选择项目；仍须本地文件/进程权限及下述命令专属前提。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat script test [OPTIONS] [TARGETS]...
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | 原始帮助：Emit a machine-readable JSON summary (for CI) |
| `targets`: `<TARGETS> (#1)` | `String`, 1..∞, `Append` | 否；条件必填见行为; Clap 无显式默认；运行时：`tests/；无显式目标时 Rust 发现 scripts/` | — | — |

Clap 参数组（literal metadata）：`{"arguments":["json","targets"],"id":"Test","multiple":true,"required":false}`

**输入、行为与副作用。** 本地通过 uv 跑 Python pytest、bun test 跑 TypeScript，并跑发现的 Rust 内嵌测试。默认发现 tests/，Rust 用 scripts/。匹配版本 viat-test-host 提供假资源，不使用登录服务端。但用户测试代码本身不受网络沙箱限制。

**实际输出与退出。** 流式输出运行器结果；--json 捕获机器报告，诊断写 stderr。传播汇总非零测试状态。缺前提会失败；无测试可打印 no tests found，不代表覆盖。 完全未发现测试时明确退出 0（no tests found），与 endpoint test 的空夹具失败不同。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat script test --json
```

**失败处理、验证与清理。** 需相应语言 uv/bun/cargo 和匹配 host（VIAT_TEST_HOST_BIN 可覆盖）。TypeScript 临时注入 node_modules/viat 后清理。检查夹具是否外呼；审查后可删本地报告。

## viat script update

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat script update [OPTIONS] <NAME>
```

**命令别名：** `viat script edit`

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `dedicated`: `--dedicated` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |
| `dedicated_count`: `--dedicated-count` | `i32`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | — |
| `file`: `--file` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `no_dedicated`: `--no-dedicated` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | 冲突 ID：dedicated |

Clap 参数组（literal metadata）：`{"arguments":["dedicated","dedicated_count","file","name","no_dedicated"],"id":"Update","multiple":true,"required":false}`

**输入、行为与副作用。** 部分 PATCH；加载配置前要求至少 --file/--dedicated/--no-dedicated/--dedicated-count 之一。edit 是别名。只改传入字段；变更草稿，不改已发布快照。

**实际输出与退出。** stdout: updated &lt;name&gt; → vN，可附待发布端点提示。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat script update demo_echo --file demo.py
```

**失败处理、验证与清理。** dedicated 冲突/数量或文件无效会失败。保存旧源码/设置，show 核查后有意发布；恢复旧草稿并重新发布可回退已交付变更。

## viat script upload

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat script upload [OPTIONS] --binary <BINARY> <NAME>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `binary`: `--binary` | `PathBuf`, 1, `Set` | 是; Clap 无显式默认 | — | 原始帮助：The executable |
| `folder`: `--folder` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Folder half of the script's identity, when the bare name is ambiguous |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `target`: `--target` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认；运行时：`CLI 机器 OS/架构` | — | 原始帮助：`<os>/<arch>` it was built for; defaults to this machine's |

Clap 参数组（literal metadata）：`{"arguments":["binary","folder","name","target"],"id":"Upload","multiple":true,"required":false}`

**输入、行为与副作用。** 仅 binary 语言：读取非空可执行文件，以 update_manifest=1 上传；服务端随后把 digest 记为新草稿版本。--target 默认 CLI 机器 OS/架构，不探测远程；--folder 消歧。

**实际输出与退出。** 打印字节数、目标、digest、manifest 新版本或未变，以及待发布端点。不发布。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat script upload demo_binary --binary ./demo-worker --target linux/x86_64
```

**失败处理、验证与清理。** 需服务端允许上传、匹配可执行格式及 binary manifest 脚本。语言错误/空文件/不支持目标会失败。show/build 核查后有意发布；回退需旧 manifest 和 artifact（show 不取字节）。

## 实现核对依据

语法来自固定 Clap 合同与 main.rs；行为/权限核对以下源文件，路径相对产品仓库根。

- `crates/viat-cli/src/commands/script.rs`
- `crates/viat-api/src/handlers/scripts.rs`
- `crates/viat-api/src/handlers/rust_artifact.rs`
