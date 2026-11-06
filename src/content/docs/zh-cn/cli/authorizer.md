---
title: "CLI：authorizer"
description: "Viat 1.1.0 authorizer 的完整语法、逐命令权限、输出、副作用与恢复。"
doc_id: cli.authorizer
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.authorizer.create","cli.authorizer.delete","cli.authorizer.list","cli.authorizer.show","cli.authorizer.update"]
---

# CLI：authorizer

先读 [CLI 总览](overview.md)：会话/目录、退出约定、角色边界、合成占位 ID 和执行授权规则在其中统一定义。本页逐叶补充例外；以下命令不是按顺序执行的脚本。

- [viat authorizer create](#viat-authorizer-create)
- [viat authorizer delete](#viat-authorizer-delete)
- [viat authorizer list](#viat-authorizer-list)
- [viat authorizer show](#viat-authorizer-show)
- [viat authorizer update](#viat-authorizer-update)

## viat authorizer create

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat authorizer create [OPTIONS] --name <NAME> --kind <KIND>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `default_role`: `--default-role` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `kind`: `--kind` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `name`: `--name` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["default_role","kind","name"],"id":"Create","multiple":true,"required":false}`

**输入、行为与副作用。** 以 name/kind/default_role 和 config={} 创建。无 config/secret 输入，需配置的 jwt/oauth_oidc/social 无法在此完整配置；改用控制台/API 或受支持仓库声明。anonymous/password/api_key 可用可选默认配置。

**实际输出与退出。** stdout: created authorizer &lt;name&gt; (&lt;kind&gt;)。不签发用户/key/token。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat authorizer create --name demo_password --kind password
```

**失败处理、验证与清理。** kind/默认角色错误或缺必需 config 会失败。show 验证；解绑端点并检查级联 key 损失后才删演示认证器。

## viat authorizer delete

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat authorizer delete <NAME>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["name"],"id":"Delete","multiple":true,"required":false}`

**输入、行为与副作用。** 删除项目认证器；所属 api_key key 会级联删除。依赖其认证的端点可失效。

**实际输出与退出。** stdout: deleted &lt;name&gt;；成功 0。不是单 key 的 token 撤销。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat authorizer delete demo_password
```

**失败处理、验证与清理。** 先盘点绑定/key。删除 key/提供方秘密不能从 pull/show 恢复；须显式重建配置并分发替代 key。list 验证不存在。

## viat authorizer list

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat authorizer list [OPTIONS]
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |

Clap 参数组（literal metadata）：`{"arguments":["json"],"id":"List","multiple":true,"required":false}`

**输入、行为与副作用。** 列所选项目认证器，不是平台登录提供方；读取也需 editor。

**实际输出与退出。** 文本含 name/kind/default-role UUID 或 -；--json 公开行/config，不含已存提供方秘密。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat authorizer list --json
```

**失败处理、验证与清理。** 无行也成功。default-role UUID 不是角色名：用 role list/show 解析。无变更/清理。

## viat authorizer show

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat authorizer show [OPTIONS] <NAME>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["json","name"],"id":"Show","multiple":true,"required":false}`

**输入、行为与副作用。** 读取单个项目认证器公开定义。

**实际输出与退出。** 文本含 name/kind/default-role UUID 或 -；--json 还含公开配置。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat authorizer show demo_password --json
```

**失败处理、验证与清理。** 名称未知失败。变更前保存公开配置，并单独保管原提供方秘密；show 无法恢复秘密。读取无需清理。

## viat authorizer update

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat authorizer update [OPTIONS] <NAME>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `clear_default_role`: `--clear-default-role` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | 原始帮助：Remove the default role |
| `default_role`: `--default-role` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 冲突 ID：clear_default_role; 原始帮助：The role every caller this authorizer admits gets |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["clear_default_role","default_role","name"],"id":"Update","multiple":true,"required":false}`

**输入、行为与副作用。** 必选 --default-role 或 --clear-default-role；PUT 只发 default_role（空字符串清除），保留 kind/config/提供方秘密。不能在此改 kind/配置 OIDC/JWT。

**实际输出与退出。** stdout: updated authorizer &lt;name&gt; (&lt;kind&gt;): default_role &lt;role-or-none&gt;。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat authorizer update demo_password --clear-default-role
```

**失败处理、验证与清理。** 无选项/角色不存在失败。记录旧角色名并 update 恢复；省略不等于清除。show 验证，审查新解析客户端身份的影响。

## 实现核对依据

语法来自固定 Clap 合同与 main.rs；行为/权限核对以下源文件，路径相对产品仓库根。

- `crates/viat-cli/src/commands/authorizer.rs`
- `crates/viat-api/src/handlers/authorizers.rs`
