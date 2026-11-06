---
title: "CLI：p-user"
description: "Viat 1.1.0 p-user 的完整语法、逐命令权限、输出、副作用与恢复。"
doc_id: cli.p-user
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.p-user.activate","cli.p-user.assign-role","cli.p-user.create","cli.p-user.deactivate","cli.p-user.delete","cli.p-user.import","cli.p-user.list","cli.p-user.reset-mfa","cli.p-user.set-admin","cli.p-user.set-password","cli.p-user.update"]
---

# CLI：p-user

先读 [CLI 总览](overview.md)：会话/目录、退出约定、角色边界、合成占位 ID 和执行授权规则在其中统一定义。本页逐叶补充例外；以下命令不是按顺序执行的脚本。

- [viat p-user activate](#viat-p-user-activate)
- [viat p-user assign-role](#viat-p-user-assign-role)
- [viat p-user create](#viat-p-user-create)
- [viat p-user deactivate](#viat-p-user-deactivate)
- [viat p-user delete](#viat-p-user-delete)
- [viat p-user import](#viat-p-user-import)
- [viat p-user list](#viat-p-user-list)
- [viat p-user reset-mfa](#viat-p-user-reset-mfa)
- [viat p-user set-admin](#viat-p-user-set-admin)
- [viat p-user set-password](#viat-p-user-set-password)
- [viat p-user update](#viat-p-user-update)

## 合成夹具与执行边界

这些文件只为下面例子提供输入；创建远程对象、执行脚本、数据库 SQL 或存储操作前，必须自行准备隔离项目并明确授权。生成文档不执行任何例子。

```json
[{"identity":"demo_import_user","display_name":"Imported Demo"}]
```

保存为 demo-users.json。demo_role 先通过 role create --name demo_role 创建；demo_user 是独立演示终端用户，不是平台登录邮箱。无密码行仅用于迁移形状，设置凭据后才能密码登录。

## viat p-user activate

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat p-user activate <IDENTITY>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `identity`: `<IDENTITY> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["identity"],"id":"Activate","multiple":true,"required":false}`

**输入、行为与副作用。** 启用已有项目终端用户 active 标记。不是许可证激活/平台登录/项目成员。

**实际输出与退出。** stdout: &lt;identity&gt; is_active=true。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat p-user activate demo_user
```

**失败处理、验证与清理。** identity 不存在失败；p-user list 验证。deactivate 可反转标记，不能撤销过去/进行中业务效果。

## viat p-user assign-role

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat p-user assign-role [OPTIONS] <IDENTITY>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `identity`: `<IDENTITY> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `role`: `--role` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["identity","role"],"id":"AssignRole","multiple":true,"required":false}`

**输入、行为与副作用。** 给已有 identity PUT 角色名；省略 --role 显式赋 null（取消分配），不是保留。

**实际输出与退出。** stdout: assigned role -> &lt;identity&gt; (now role_id=&lt;UUID-or-&gt;)。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat p-user assign-role demo_user --role demo_role
```

**失败处理、验证与清理。** 用户/角色不存在失败。保存原角色、list 核查、再赋原角色回退；取消分配不清用户自身 admin。

## viat p-user create

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat p-user create [OPTIONS] --identity <IDENTITY>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `display_name`: `--display-name` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `identity`: `--identity` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `password`: `--password` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 冲突 ID：password_hash |
| `password_hash`: `--password-hash` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Instead of `--password`: an argon2 (`$argon2id$…`) or bcrypt (`$2a$`/`$2b$`/`$2y$`) hash from the system being migrated from |
| `role`: `--role` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["display_name","identity","password","password_hash","role"],"id":"Create","multiple":true,"required":false}`

**输入、行为与副作用。** 创建项目终端用户 identity，可选显示名/角色及明文密码或导入 argon2/bcrypt hash（二者不同时）。不是平台协作者加入项目。

**实际输出与退出。** stdout: created project user &lt;identity&gt;。不打印密码/hash、不登录新用户。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat p-user create --identity demo_user --display-name 'Demo User' --role demo_role
```

**失败处理、验证与清理。** identity 重复、hash 错/密码过短（至少 8 字符）失败。真实凭据勿放 argv；批迁用受保护文件 import。p-user list 验证，delete demo_user 清理。

## viat p-user deactivate

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat p-user deactivate <IDENTITY>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `identity`: `<IDENTITY> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["identity"],"id":"Deactivate","multiple":true,"required":false}`

**输入、行为与副作用。** 停用已有项目终端用户 active 标记。不是许可证激活/平台登录/项目成员。

**实际输出与退出。** stdout: &lt;identity&gt; is_active=false。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat p-user deactivate demo_user
```

**失败处理、验证与清理。** identity 不存在失败；p-user list 验证。activate 可反转标记，不能撤销过去/进行中业务效果。

## viat p-user delete

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat p-user delete <IDENTITY>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `identity`: `<IDENTITY> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["identity"],"id":"Delete","multiple":true,"required":false}`

**输入、行为与副作用。** 删除项目终端用户身份，不是平台用户/协作者成员。可影响关联授权/凭据引用。

**实际输出与退出。** stdout: deleted &lt;identity&gt;；成功 0。不撤销其先前业务写入。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat p-user delete demo_user
```

**失败处理、验证与清理。** 先盘点依赖，仅删演示用户。p-user list 核查；重建同 identity 不自动恢复旧 UUID/MFA/key/授权。

## viat p-user import

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 demo-users.json 写 [{"identity":"demo_import_user","display_name":"Imported Demo"}]。此合成行无密码，设置前不可用于密码登录。

```text
Usage: viat p-user import --file <FILE>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `file`: `--file` | `PathBuf`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |

Clap 参数组（literal metadata）：`{"arguments":["file"],"id":"Import","multiple":true,"required":false}`

**输入、行为与副作用。** 读 JSON 数组或 JSON Lines；每行 identity，可选 password/password_hash/display_name/email/phone/role/meta。每行拒绝未知字段。有效行逐 POST；失败继续，不是批事务。

**实际输出与退出。** stdout 为 ok/FAILED #行及 &lt;N&gt; created, &lt;N&gt; failed。任一失败行在全部报告后退出 1；先前成功保留。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat p-user import --file demo-users.json
```

**失败处理、验证与清理。** 保护输入文件。重试前核对成功行，避免 identity 重复；清理仅删已创建演示身份。

## viat p-user list

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat p-user list [OPTIONS]
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |

Clap 参数组（literal metadata）：`{"arguments":["json"],"id":"List","multiple":true,"required":false}`

**输入、行为与副作用。** 读取 limit=500 一页，含 source/email。CLI 无分页/搜索参数；--json 仍是该页，不是全部。

**实际输出与退出。** 文本含 identity/source/role_id/显示名/邮箱/电话及 inactive 标记，附截断提示。--json 保留 page/total。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat p-user list --json
```

**失败处理、验证与清理。** 其余行用控制台/API ?q=&offset=&limit=。个人数据输出需保护；无变更/清理。

## viat p-user reset-mfa

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat p-user reset-mfa <IDENTITY>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `identity`: `<IDENTITY> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["identity"],"id":"ResetMfa","multiple":true,"required":false}`

**输入、行为与副作用。** 作为运维恢复 DELETE 终端用户二次验证，不重置平台账号 MFA。

**实际输出与退出。** stdout 报告 cleared 或 had no two-factor authentication。项目策略可要求重新注册。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat p-user reset-mfa demo_user
```

**失败处理、验证与清理。** 先在带外确认身份。用户不存在失败；CLI 不可逆。用户需注册新验证器/恢复码，并验证下次授权登录遵循项目策略。

## viat p-user set-admin

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat p-user set-admin --admin <ADMIN> <IDENTITY>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `admin`: `--admin` | `bool`, 1, `Set` | 是; Clap 无显式默认 | `{"aliases":[],"help":null,"hidden":false,"name":"false"}` / `{"aliases":[],"help":null,"hidden":false,"name":"true"}` | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `identity`: `<IDENTITY> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["admin","identity"],"id":"SetAdmin","multiple":true,"required":false}`

**输入、行为与副作用。** 用 --admin true|false 设置用户自身 is_admin。所分配角色可独立授予 admin，故角色仍 admin 时仅设置 false 不等于完全降级。

**实际输出与退出。** stdout: user &lt;identity&gt; admin=&lt;bool&gt;。改项目终端用户管理权限，不是平台权限。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat p-user set-admin demo_user --admin false
```

**失败处理、验证与清理。** identity 不存在/布尔无效失败。检查自身标记与角色；需要时恢复旧布尔并查公开用户数据。

## viat p-user set-password

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat p-user set-password [OPTIONS] <IDENTITY>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `identity`: `<IDENTITY> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `password`: `--password` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 冲突 ID：password_hash |
| `password_hash`: `--password-hash` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["identity","password","password_hash"],"id":"SetPassword","multiple":true,"required":false}`

**输入、行为与副作用。** 以 --password/--password-hash 之一替换终端用户本地密码。导入 hash 支持 argon2/bcrypt；明文至少 8 字符。

**实际输出与退出。** stdout: password set for &lt;identity&gt;。不暴露旧密码/hash。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat p-user set-password demo_user --password demo-only-password
```

**失败处理、验证与清理。** 无凭据/两种同时或 hash 无效失败。示例仅合成密码；真实 argv 可被进程/历史看到。经授权隔离登录核查；需恢复时用安全保管凭据，不能从输出推导旧值。

## viat p-user update

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat p-user update [OPTIONS] <IDENTITY>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `display_name`: `--display-name` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | — |
| `email`: `--email` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `identity`: `<IDENTITY> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `meta`: `--meta` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：A JSON object, replacing the stored meta whole |
| `phone`: `--phone` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["display_name","email","identity","meta","phone"],"id":"Update","multiple":true,"required":false}`

**输入、行为与副作用。** PATCH 提供的 display-name/email/phone/meta；meta 解析 JSON。省略保留；空资料字符串按 API 清除/验证，不是通用 null 参数。

**实际输出与退出。** stdout: updated &lt;identity&gt; display_name=... email=... phone=...。不改凭据/角色。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat p-user update demo_user --display-name 'Demo Renamed' --meta '{"demo":true}'
```

**失败处理、验证与清理。** JSON/邮箱/电话无效失败。电话可用常见符号及 5–20 位数字；校验邮箱形状。保存旧资料再逐字段恢复；list/API 验证。

## 实现核对依据

语法来自固定 Clap 合同与 main.rs；行为/权限核对以下源文件，路径相对产品仓库根。

- `crates/viat-cli/src/commands/project_user.rs`
- `crates/viat-api/src/handlers/project_users.rs`
