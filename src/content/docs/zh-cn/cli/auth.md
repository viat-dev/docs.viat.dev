---
title: "CLI：auth"
description: "Viat 1.1.0 auth 的完整语法、逐命令权限、输出、副作用与恢复。"
doc_id: cli.auth
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.auth.login","cli.auth.logout","cli.auth.token.create","cli.auth.token.list","cli.auth.token.revoke","cli.auth.whoami"]
---

# CLI：auth

先读 [CLI 总览](overview.md)：会话/目录、退出约定、角色边界、合成占位 ID 和执行授权规则在其中统一定义。本页逐叶补充例外；以下命令不是按顺序执行的脚本。

- [viat auth login](#viat-auth-login)
- [viat auth logout](#viat-auth-logout)
- [viat auth token create](#viat-auth-token-create)
- [viat auth token list](#viat-auth-token-list)
- [viat auth token revoke](#viat-auth-token-revoke)
- [viat auth whoami](#viat-auth-whoami)

## viat auth login

**前提与权限。** 无需已有平台登录或选择项目；仍须本地文件/进程权限及下述命令专属前提。 隔离实例上的现有平台账号。示例密码仅演示语法，不是产品预置凭据。OIDC 还需配置平台 OIDC 提供方并能打开浏览器。

```text
Usage: viat auth login [OPTIONS] --server <SERVER>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `email`: `--email` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 冲突 ID：oidc |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `oidc`: `--oidc` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 冲突 ID：email, password; 原始帮助：Use OIDC SSO with the named platform provider |
| `password`: `--password` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 冲突 ID：oidc |
| `server`: `--server` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `totp`: `--totp` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 冲突 ID：oidc; 原始帮助：Second-factor code for an account with two-factor authentication. Prompted for on the terminal when omitted; needed on the command line only when stdin is not a terminal |

Clap 参数组（literal metadata）：`{"arguments":["email","oidc","password","server","totp"],"id":"Login","multiple":true,"required":false}`

**输入、行为与副作用。** 密码模式运行时同时需要 --email 和 --password；--oidc 选择浏览器登录。密码 MFA 使用 --totp 或提示输入，同票最多五次。要求注册 MFA 时必须在控制台完成。OIDC 打印浏览器 URL，每 2 秒轮询、最多 5 分钟。

**实际输出与退出。** stdout: logged in as &lt;email&gt;。将 access/refresh token 保存到解析出的 .viat/config.yaml；不选择项目。同服务端复用祖先会话；换服务端会在 CWD 新建会话，除非显式 VIAT_CONFIG_DIR。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat auth login --server http://127.0.0.1:28080 --email operator@example.invalid --password demo-only-not-a-real-password
```

**失败处理、验证与清理。** 凭据/MFA 错误、浏览器流程超时或要求注册均退出 1。核对 URL 并在控制台注册，不要反复重试（有速率限制）。用 auth logout 清理本地登录；保护 config.yaml，勿把真实密码写入历史。

## viat auth logout

**前提与权限。** 无需已有平台登录或选择项目；仍须本地文件/进程权限及下述命令专属前提。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat auth logout
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |

**输入、行为与副作用。** 清除配置中的旧 token、access/refresh token、刷新到期时间和 current_project。实现不调用服务端撤销，并保留 server_url 与 project_token。

**实际输出与退出。** stdout: logged out；配置保存成功即退出 0，不需要在线服务端。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat auth logout
```

**失败处理、验证与清理。** 保存失败退出 1；修复文件权限。真正撤销会话/PAT 应使用服务端账号管理；若不应保留 project_token，请从受保护本地配置中移除。恢复使用需重新登录并选择项目。

## viat auth token create

**前提与权限。** 平台登录会话，不接受个人访问令牌（PAT）；无需选择项目。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat auth token create [OPTIONS] --name <NAME>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |
| `name`: `--name` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | 原始帮助：Human label, max 64 chars, unique per user |
| `project`: `--project` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Restrict to a single project |
| `ttl`: `--ttl` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认；运行时：`30d；never → 不过期` | — | 原始帮助：Expiry duration, e.g. 30d, 12h, 7d, never. Default 30d |

Clap 参数组（literal metadata）：`{"arguments":["json","name","project","ttl"],"id":"Create","multiple":true,"required":false}`

**输入、行为与副作用。** POST /auth/tokens；--project 限定项目，省略表示用户可访问的所有项目。运行时 --ttl 默认 30d，接受 12h 等 humantime 时长；--ttl never 发送零表示不过期。时长截断到整秒，避免不足一秒被转为零/不过期。权限仍来自账号：PAT 不授予角色。 名称须 1–64 字节，且同账号内唯一；scoped 项目必须已有成员身份。

**实际输出与退出。** 文本打印元数据及仅显示一次的 Secret；--json 返回含 secret 的响应。须安全保存；成功退出 0。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat auth token create --name demo-ci --ttl 12h
```

**失败处理、验证与清理。** TTL/名称/范围无效或用 PAT 管理令牌会失败。若输出丢失，请按 ID 撤销重建；auth token list 无法恢复秘密。

## viat auth token list

**前提与权限。** 平台登录会话，不接受个人访问令牌（PAT）；无需选择项目。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat auth token list [OPTIONS]
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |

Clap 参数组（literal metadata）：`{"arguments":["json"],"id":"List","multiple":true,"required":false}`

**输入、行为与副作用。** GET /auth/tokens，仅列当前平台账号，不是其他账号或 api_key authorizer 的 key。

**实际输出与退出。** 表列名称、项目、前缀、创建/到期/最后使用时间及状态；--json 返回 items 对象，无秘密。文本状态为尽力判断（expired 比较不是可靠的当前时间判断）；应查看到期时间。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat auth token list --json
```

**失败处理、验证与清理。** PAT 认证被拒绝；使用登录会话。除常规刷新持久化外只读，无需清理。

## viat auth token revoke

**前提与权限。** 平台登录会话，不接受个人访问令牌（PAT）；无需选择项目。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat auth token revoke <ID_OR_NAME>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `id_or_name`: `<ID_OR_NAME> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["id_or_name"],"id":"Revoke","multiple":true,"required":false}`

**输入、行为与副作用。** UUID 直接使用；其他字符串按未撤销 token 名称解析。零匹配或重名均拒绝，不随意选择。DELETE /auth/tokens/{id}。

**实际输出与退出。** stdout: Revoked token: &lt;id-or-name&gt;；成功 0。秘密不再授权；撤销不是本地退出。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat auth token revoke 00000000-0000-4000-8000-000000000001
```

**失败处理、验证与清理。** 重名时 list 并使用 ID。无法撤销此操作：创建替代 token 并更新调用方。用 auth token list --json 核查。

## viat auth whoami

**前提与权限。** 已配置服务端并完成平台登录；无需选择项目。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat auth whoami
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |

**输入、行为与副作用。** 以控制台凭据 GET /auth/whoami；不是查询项目终端用户身份。

**实际输出与退出。** stdout 仅输出已登录邮箱；成功退出 0。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat auth whoami
```

**失败处理、验证与清理。** 会话过期且无法刷新时退出 1：重新登录再查。无项目变更，无需清理。

## 实现核对依据

语法来自固定 Clap 合同与 main.rs；行为/权限核对以下源文件，路径相对产品仓库根。

- `crates/viat-cli/src/commands/auth.rs`
- `crates/viat-cli/src/commands/auth_token.rs`
- `crates/viat-api/src/handlers/auth_tokens.rs`
