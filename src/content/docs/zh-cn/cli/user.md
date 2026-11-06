---
title: "CLI：user"
description: "Viat 1.1.0 user 的完整语法、逐命令权限、输出、副作用与恢复。"
doc_id: cli.user
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.user.authorizer.create","cli.user.authorizer.delete","cli.user.authorizer.list","cli.user.authorizer.show","cli.user.authorizer.update","cli.user.invite","cli.user.ls","cli.user.reset-mfa","cli.user.role.create","cli.user.role.delete","cli.user.role.list","cli.user.role.set-admin","cli.user.role.show","cli.user.set-role"]
---

# CLI：user

先读 [CLI 总览](overview.md)：会话/目录、退出约定、角色边界、合成占位 ID 和执行授权规则在其中统一定义。本页逐叶补充例外；以下命令不是按顺序执行的脚本。

- [viat user authorizer create](#viat-user-authorizer-create)
- [viat user authorizer delete](#viat-user-authorizer-delete)
- [viat user authorizer list](#viat-user-authorizer-list)
- [viat user authorizer show](#viat-user-authorizer-show)
- [viat user authorizer update](#viat-user-authorizer-update)
- [viat user invite](#viat-user-invite)
- [viat user ls](#viat-user-ls)
- [viat user reset-mfa](#viat-user-reset-mfa)
- [viat user role create](#viat-user-role-create)
- [viat user role delete](#viat-user-role-delete)
- [viat user role list](#viat-user-role-list)
- [viat user role set-admin](#viat-user-role-set-admin)
- [viat user role show](#viat-user-role-show)
- [viat user set-role](#viat-user-set-role)

## viat user authorizer create

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat user authorizer create [OPTIONS] --name <NAME> --kind <KIND>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `default_role`: `--default-role` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `kind`: `--kind` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `name`: `--name` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["default_role","kind","name"],"id":"Create","multiple":true,"required":false}`

**输入、行为与副作用。** viat authorizer create 的完全分发别名。虽有 user 前缀，仍针对所选项目，权限相同。以 name/kind/default_role 和 config={} 创建。无 config/secret 输入，需配置的 jwt/oauth_oidc/social 无法在此完整配置；改用控制台/API 或受支持仓库声明。anonymous/password/api_key 可用可选默认配置。

**实际输出与退出。** stdout: created authorizer &lt;name&gt; (&lt;kind&gt;)。不签发用户/key/token。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat user authorizer create --name demo_password --kind password
```

**失败处理、验证与清理。** kind/默认角色错误或缺必需 config 会失败。show 验证；解绑端点并检查级联 key 损失后才删演示认证器。

## viat user authorizer delete

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat user authorizer delete <NAME>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["name"],"id":"Delete","multiple":true,"required":false}`

**输入、行为与副作用。** viat authorizer delete 的完全分发别名。虽有 user 前缀，仍针对所选项目，权限相同。删除项目认证器；所属 api_key key 会级联删除。依赖其认证的端点可失效。

**实际输出与退出。** stdout: deleted &lt;name&gt;；成功 0。不是单 key 的 token 撤销。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat user authorizer delete demo_password
```

**失败处理、验证与清理。** 先盘点绑定/key。删除 key/提供方秘密不能从 pull/show 恢复；须显式重建配置并分发替代 key。list 验证不存在。

## viat user authorizer list

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat user authorizer list [OPTIONS]
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |

Clap 参数组（literal metadata）：`{"arguments":["json"],"id":"List","multiple":true,"required":false}`

**输入、行为与副作用。** viat authorizer list 的完全分发别名。虽有 user 前缀，仍针对所选项目，权限相同。列所选项目认证器，不是平台登录提供方；读取也需 editor。

**实际输出与退出。** 文本含 name/kind/default-role UUID 或 -；--json 公开行/config，不含已存提供方秘密。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat user authorizer list --json
```

**失败处理、验证与清理。** 无行也成功。default-role UUID 不是角色名：用 role list/show 解析。无变更/清理。

## viat user authorizer show

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat user authorizer show [OPTIONS] <NAME>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["json","name"],"id":"Show","multiple":true,"required":false}`

**输入、行为与副作用。** viat authorizer show 的完全分发别名。虽有 user 前缀，仍针对所选项目，权限相同。读取单个项目认证器公开定义。

**实际输出与退出。** 文本含 name/kind/default-role UUID 或 -；--json 还含公开配置。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat user authorizer show demo_password --json
```

**失败处理、验证与清理。** 名称未知失败。变更前保存公开配置，并单独保管原提供方秘密；show 无法恢复秘密。读取无需清理。

## viat user authorizer update

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat user authorizer update [OPTIONS] <NAME>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `clear_default_role`: `--clear-default-role` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | 原始帮助：Remove the default role |
| `default_role`: `--default-role` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 冲突 ID：clear_default_role; 原始帮助：The role every caller this authorizer admits gets |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["clear_default_role","default_role","name"],"id":"Update","multiple":true,"required":false}`

**输入、行为与副作用。** viat authorizer update 的完全分发别名。虽有 user 前缀，仍针对所选项目，权限相同。必选 --default-role 或 --clear-default-role；PUT 只发 default_role（空字符串清除），保留 kind/config/提供方秘密。不能在此改 kind/配置 OIDC/JWT。

**实际输出与退出。** stdout: updated authorizer &lt;name&gt; (&lt;kind&gt;): default_role &lt;role-or-none&gt;。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat user authorizer update demo_password --clear-default-role
```

**失败处理、验证与清理。** 无选项/角色不存在失败。记录旧角色名并 update 恢复；省略不等于清除。show 验证，审查新解析客户端身份的影响。

## viat user invite

**前提与权限。** 已配置服务端并完成平台登录；无需选择项目。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat user invite [OPTIONS] --email <EMAIL>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `display_name`: `--display-name` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | — |
| `email`: `--email` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help (see a summary with '-h') |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |
| `project`: `--project` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Optional: also enroll the new user in this project |
| `role`: `--role` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Required iff --project given. owner&#124;admin&#124;developer&#124;operator |
| `temp_password`: `--temp-password` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Pre-set the initial password (>= 8 chars). If omitted, the server generates one and returns it once |

Clap 参数组（literal metadata）：`{"arguments":["display_name","email","json","project","role","temp_password"],"id":"Invite","multiple":true,"required":false}`

**输入、行为与副作用。** 创建新平台账号。不带 --project 需平台 Admin/Owner；带 --project 和 --role 需该项目 Owner/Admin，而非平台级别。两个参数须同时。不会发送邀请邮件：生成凭据需带外交付。

**实际输出与退出。** 文本含 invited email (UUID)、可选一次性 temp_password 与加入项目。--json 含 user 和适用时生成 temp_password。自设密码不再打印，至少 8 字符。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat user invite --email teammate@example.invalid --project cli-demo --role developer
```

**失败处理、验证与清理。** 邮箱已存在/角色无效/缺配对失败。保护输出并安全交付；有权限时 user ls、project member ls 验证。移除演示成员不删平台账号；账号清理由控制台/API 完成，无 user delete CLI。

## viat user ls

**前提与权限。** 平台 Admin/Owner；项目角色不能赋予此平台权限。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat user ls [OPTIONS]
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |

Clap 参数组（literal metadata）：`{"arguments":["json"],"id":"Ls","multiple":true,"required":false}`

**输入、行为与副作用。** GET /users 列平台用户目录，不是项目终端用户/项目成员。无需选项目但须平台 Admin/Owner。

**实际输出与退出。** 文本为 email/平台 role/显示名；--json 公开行/id/时间戳。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat user ls --json
```

**失败处理、验证与清理。** 仅项目 Owner 也可 403。向平台 Owner 申请；不改用户，保护个人数据输出。

## viat user reset-mfa

**前提与权限。** 平台 Owner；仅平台 Admin 或项目 Owner 不足。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat user reset-mfa [OPTIONS] <EMAIL>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `email`: `<EMAIL> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help (see a summary with '-h') |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |

Clap 参数组（literal metadata）：`{"arguments":["email","json"],"id":"ResetMfa","multiple":true,"required":false}`

**输入、行为与副作用。** 除平台 Owner 外还需平台登录会话（PAT 拒绝）。清目标平台 MFA 并撤销会话，即使原来无验证器也撤销会话。项目 p-user reset-mfa 另算。

**实际输出与退出。** 文本为已清除/原无验证器和登出会话数；--json 保留 had_mfa/sessions_revoked。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat user reset-mfa teammate@example.invalid --json
```

**失败处理、验证与清理。** 先带外核实本人。不能恢复旧验证器/恢复码：用户须控制台重注册再登录；运维策略可强制注册。

## viat user role create

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat user role create [OPTIONS] --name <NAME>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `admin`: `--admin` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | 原始帮助：Every user in this role administers the project (the delegated `/p/<slug>/_users` surface and `ctx.project.*`) |
| `description`: `--description` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `name`: `--name` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["admin","description","name"],"id":"Create","multiple":true,"required":false}`

**输入、行为与副作用。** viat role create 的完全分发别名。虽有 user 前缀，仍针对所选项目，权限相同。创建非内建项目角色；--admin 给所有该角色终端用户项目用户管理权限，不是平台登录角色。默认 admin=false。

**实际输出与退出。** stdout: created role &lt;name&gt;，true 时有 (admin)。不分配用户。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat user role create --name demo_role --description 'Synthetic demo role'
```

**失败处理、验证与清理。** 重名/保留名失败。role show 验证；删除前取消演示用户分配。描述通过仓库/控制台/API 管理，无 update-description CLI。

## viat user role delete

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat user role delete <NAME>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["name"],"id":"Delete","multiple":true,"required":false}`

**输入、行为与副作用。** viat role delete 的完全分发别名。虽有 user 前缀，仍针对所选项目，权限相同。删除非内建项目角色。影响用户角色与授权，不删除平台账号。

**实际输出与退出。** stdout: deleted &lt;name&gt;。API 拒绝删除内建角色。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat user role delete demo_role
```

**失败处理、验证与清理。** 盘点已分配用户和规则，只删演示角色。role list 验证；同名重建不保证恢复旧 UUID/分配/规则。

## viat user role list

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat user role list [OPTIONS]
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |

Clap 参数组（literal metadata）：`{"arguments":["json"],"id":"List","multiple":true,"required":false}`

**输入、行为与副作用。** viat role list 的完全分发别名。虽有 user 前缀，仍针对所选项目，权限相同。列项目终端用户角色，不是平台/项目协作者角色分配。

**实际输出与退出。** 文本为角色名和 builtin/admin 标签；--json 角色行。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat user role list --json
```

**失败处理、验证与清理。** 读取也需 editor。内建角色由平台管理、仓库同步略过；无变更/清理。

## viat user role set-admin

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat user role set-admin --admin <ADMIN> <NAME>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `admin`: `--admin` | `bool`, 1, `Set` | 是; Clap 无显式默认 | `{"aliases":[],"help":null,"hidden":false,"name":"false"}` / `{"aliases":[],"help":null,"hidden":false,"name":"true"}` | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["admin","name"],"id":"SetAdmin","multiple":true,"required":false}`

**输入、行为与副作用。** viat role set-admin 的完全分发别名。虽有 user 前缀，仍针对所选项目，权限相同。以 --admin true|false PUT 项目角色；所有该角色用户获得/失去角色来源项目管理能力。不可改内建角色。

**实际输出与退出。** stdout: role &lt;name&gt; admin=&lt;bool&gt;。即使角色 false，用户自身 is_admin 仍可授予权限。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat user role set-admin demo_role --admin false
```

**失败处理、验证与清理。** 提升前检查分配。role show 与相关用户核查；恢复旧布尔回退。不是 user set-role/project member set-role。

## viat user role show

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat user role show [OPTIONS] <NAME>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["json","name"],"id":"Show","multiple":true,"required":false}`

**输入、行为与副作用。** viat role show 的完全分发别名。虽有 user 前缀，仍针对所选项目，权限相同。读项目终端用户角色；角色含 admin/描述而非权限字符串列表。数据访问由授权规则定义。

**实际输出与退出。** 文本为 # name 及 builtin/admin 标签；--json 完整公开行。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat user role show demo_role --json
```

**失败处理、验证与清理。** 未知角色失败。描述/id 用 JSON；无变更/清理。

## viat user set-role

**前提与权限。** 平台 Owner；仅平台 Admin 或项目 Owner 不足。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat user set-role [OPTIONS] <EMAIL> <ROLE>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `email`: `<EMAIL> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help (see a summary with '-h') |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |
| `role`: `<ROLE> (#2)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["email","json","role"],"id":"SetRole","multiple":true,"required":false}`

**输入、行为与副作用。** 按邮箱设置平台 owner/admin/developer/operator 角色，规范化大小写。独立于 project member set-role 和终端用户 role。不能降级最后平台 Owner。

**实际输出与退出。** 文本: &lt;email&gt; is now &lt;role&gt;；--json 公开账号响应。影响平台管理访问。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat user set-role teammate@example.invalid operator
```

**失败处理、验证与清理。** 降级最后 Owner 前先提升另一个。记录旧角色、user ls 验证，恢复旧值回退。不要为修项目成员问题而提升平台权限。

## 实现核对依据

语法来自固定 Clap 合同与 main.rs；行为/权限核对以下源文件，路径相对产品仓库根。

- `crates/viat-cli/src/main.rs:1246–1273,1502–1527`
- `crates/viat-cli/src/commands/user.rs`
- `crates/viat-cli/src/commands/role.rs`
- `crates/viat-cli/src/commands/authorizer.rs`
- `crates/viat-api/src/handlers/users.rs`
