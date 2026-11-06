---
title: "CLI：resource"
description: "Viat 1.1.0 resource 的完整语法、逐命令权限、输出、副作用与恢复。"
doc_id: cli.resource
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.resource.create","cli.resource.delete","cli.resource.edit","cli.resource.list","cli.resource.refresh","cli.resource.set-field","cli.resource.set-secret","cli.resource.show","cli.resource.test"]
---

# CLI：resource

先读 [CLI 总览](overview.md)：会话/目录、退出约定、角色边界、合成占位 ID 和执行授权规则在其中统一定义。本页逐叶补充例外；以下命令不是按顺序执行的脚本。

- [viat resource create](#viat-resource-create)
- [viat resource delete](#viat-resource-delete)
- [viat resource edit](#viat-resource-edit)
- [viat resource list](#viat-resource-list)
- [viat resource refresh](#viat-resource-refresh)
- [viat resource set-field](#viat-resource-set-field)
- [viat resource set-secret](#viat-resource-set-secret)
- [viat resource show](#viat-resource-show)
- [viat resource test](#viat-resource-test)

## 合成夹具与执行边界

这些文件只为下面例子提供输入；创建远程对象、执行脚本、数据库 SQL 或存储操作前，必须自行准备隔离项目并明确授权。生成文档不执行任何例子。

```json
{"name":"demo_config","kind":"config","plain":{"data":{"enabled":true}},"secret":{}}
```

保存为 demo-resource.yaml（JSON 是有效 YAML）。set-secret 例需另建 secret 类型 demo_secret：{"name":"demo_secret","kind":"secret","plain":{},"secret":{"value":"demo-only"}}。demo_db 是你自己配置的隔离数据库，不随示例创建。

## viat resource create

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 将 demo-resource.yaml 写为 {"name":"demo_config","kind":"config","plain":{"data":{"enabled":true}},"secret":{}}。JSON 是有效 YAML；此夹具无需提供方。

```text
Usage: viat resource create --file <FILE>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `file`: `--file` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |

Clap 参数组（literal metadata）：`{"arguments":["file"],"id":"Create","multiple":true,"required":false}`

**输入、行为与副作用。** 把 --file 读为 YAML/JSON 后 POST 对象：name、可选 folder、kind、完整 plain 和 secret。这里不去除仓库占位符。config 例需 plain.data，而非顶层 data。

**实际输出与退出。** stdout: created &lt;name&gt;；保存后退出 0。保存可执行 kind 验证，以及 PostgreSQL audit 配置的 DDL 安装。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat resource create --file demo-resource.yaml
```

**失败处理、验证与清理。** YAML 错误、保留名 system、重复身份或缺类型凭据会失败。用 resource show 验证；不用时删 demo_config。勿假定后续失败会撤销上游 schema 变更。

## viat resource delete

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat resource delete <NAME>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["name"],"id":"Delete","multiple":true,"required":false}`

**输入、行为与副作用。** 删除资源定义，不表示删除上游数据库/桶。运行时消费者可立即失效。

**实际输出与退出。** stdout: deleted &lt;name&gt;；DELETE 成功后 0。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat resource delete demo_config
```

**失败处理、验证与清理。** 409 resource_in_use 会列出需先重绑/删除的端点。盘点脚本并保存配置，只删可丢弃资源；重建需要原凭据，show/pull 无法恢复。

## viat resource edit

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat resource edit --file <FILE> <NAME>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `file`: `--file` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["file","name"],"id":"Edit","multiple":true,"required":false}`

**输入、行为与副作用。** 完整 PUT 替换而非合并：需 kind、完整 plain 和所有要保留秘密。直接 YAML 不等于 pull/push 占位格式。

**实际输出与退出。** stdout: updated &lt;name&gt;；资源立即改变，可在未发布端点时影响运行时调用。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat resource edit demo_config --file demo-resource.yaml
```

**失败处理、验证与清理。** 不可用 show 掩码重建秘密。单字段轮换用 set-secret，plain 用 set-field。替换前安全备份完整设置，再按需 show/test；用可信完整文件恢复。

## viat resource list

**前提与权限。** 平台登录、已选择项目，并且是该项目成员（包括 Operator）。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat resource list [OPTIONS]
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |

Clap 参数组（literal metadata）：`{"arguments":["json"],"id":"List","multiple":true,"required":false}`

**输入、行为与副作用。** 列所选项目所有文件夹资源，不连接上游。

**实际输出与退出。** 文本为限定路径、kind 和 plain JSON；--json 输出公开行（秘密摘要而非秘密值）。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat resource list --json
```

**失败处理、验证与清理。** plain 可能包含敏感非秘密设置：谨慎保存输出。编辑前在此核对名称；无需清理。

## viat resource refresh

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat resource refresh <NAME>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["name"],"id":"Refresh","multiple":true,"required":false}`

**输入、行为与副作用。** POST /schema/refresh 跨实例使 schema 缓存失效，下次使用重读；不运行迁移/DDL。

**实际输出与退出。** stdout: refreshed &lt;name&gt;: every instance re-reads the schema on its next use。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat resource refresh demo_db
```

**失败处理、验证与清理。** DDL 后还需重新发布冻结列的 CRUD 端点。不支持类型/资源不存在会失败；先 show。缓存失效无需撤销，也不能修复 schema 本身。

## viat resource set-field

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat resource set-field [OPTIONS] <NAME> <FIELD>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `field`: `<FIELD> (#2)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `file`: `--file` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Read the new value from a file (for multi-line values like an overlay document) |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | 原始帮助：Parse the value as JSON instead of storing it as a string |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `value`: `--value` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 冲突 ID：file; 原始帮助：The new value, as a string |

Clap 参数组（literal metadata）：`{"arguments":["field","file","json","name","value"],"id":"SetField","multiple":true,"required":false}`

**输入、行为与副作用。** 运行时 --value/--file 必选其一。默认存字符串；--json 解析 JSON（不是输出格式）。读取 plain，改一键，将完整 plain PATCH，再检查返回字段存在。--json --value null 移除已设置可选字段。

**实际输出与退出。** stdout: set 或 removed &lt;name&gt;.&lt;field&gt;。未知/被丢弃字段在尝试写入后失败；规范化可改变值。删除 PostgreSQL audit 会删触发器但保留轨迹表。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat resource set-field demo_config data --json --value '{"enabled":false}'
```

**失败处理、验证与清理。** 用 resource show 检查前后并保存旧字段回退；plain 是读改写，可覆盖并发编辑。JSON/类型错误会失败；不可假定未写入而盲重试。

## viat resource set-secret

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 已有 secret 类型 demo_secret。shell 示例：printf %s demo-only | viat resource set-secret demo_secret value。argv 清单仅存 CLI token，stdin 另供。

```text
Usage: viat resource set-secret <NAME> <FIELD>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `field`: `<FIELD> (#2)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help (see a summary with '-h') |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["field","name"],"id":"SetSecret","multiple":true,"required":false}`

**输入、行为与副作用。** 先 GET kind，按声明秘密字段名校验，再读 stdin。拒绝终端输入、空输入和未知字段；去除末尾 CR/LF。PATCH 只覆盖该秘密字段。

**实际输出与退出。** stdout: set &lt;name&gt;.&lt;field&gt;；不回显秘密或长度，其他字段保留。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat resource set-secret demo_secret value
```

**失败处理、验证与清理。** 使用受保护文件或 printf 管道，不放 argv。不能创建不存在资源。经明确授权后连通性检查；旧秘密不可读回，确认轮换前须安全保留回退凭据。

## viat resource show

**前提与权限。** 平台登录、已选择项目，并且是该项目成员（包括 Operator）。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat resource show [OPTIONS] <NAME>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["json","name"],"id":"Show","multiple":true,"required":false}`

**输入、行为与副作用。** 解析带文件夹的资源名，只读公开数据。

**实际输出与退出。** 文本为 name (kind) 与格式化 plain；--json 还含公开元数据/秘密掩码，不含凭据。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat resource show demo_config --json
```

**失败处理、验证与清理。** 引用缺失/歧义会失败：从 resource list 复制限定名。*** 掩码不能作为 edit 的值。无变更，无需清理。

## viat resource test

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat resource test <NAME>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["name"],"id":"Test","multiple":true,"required":false}`

**输入、行为与副作用。** 调用平台按类型提供的连接/密钥探测，可能访问真实提供方。http_api 携凭据 GET base_url：传输错误/5xx 失败，401/404/405 可成功（可达不等于已授权）。数据库/消息/邮件/云握手会认证；crypto_key 测本地密码学。

**实际输出与退出。** stdout 为 ok 或 fail: &lt;error&gt;；ok=false 退出 1。成功附 schema 警告写 stderr，仍 0；无效 authz_tables 绑定可失败。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat resource test demo_config
```

**失败处理、验证与清理。** 未经上游授权勿运行。检查凭据/schema 及警告，不只看退出 0。不承诺提供方回退；不是脚本执行，也不保证通知到达。

## 实现核对依据

语法来自固定 Clap 合同与 main.rs；行为/权限核对以下源文件，路径相对产品仓库根。

- `crates/viat-cli/src/commands/resource.rs`
- `crates/viat-cli/src/repo/resources.rs`
- `crates/viat-api/src/handlers/resources.rs`
