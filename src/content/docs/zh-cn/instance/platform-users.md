---
title: 平台用户与登录
description: 引导 Owner、登录、邀请平台账号，并明确平台管理与项目成员关系的区别。
doc_id: instance.platform-users
verified_release: '1.1.0'
channel: stable
---

# 平台用户与登录

**平台用户**用于登录控制台、CLI 或原生应用，不是项目终端用户。平台角色控制实例管理；每个项目由独立的成员角色控制。一个平台 `operator` 完全可以同时是项目 `owner`。

## 前提与权限矩阵

需要实例基础 URL 和平台账号；引导新安装时则需要主机权限。用户目录和项目管理路由需要实例已激活，锁定时仍可登录和激活。

| 操作 | 所需权限 |
| --- | --- |
| 登录 / 查看自己的身份 | 本人平台凭据和要求的 MFA |
| 列出平台用户 | 平台 `admin` 或 `owner` |
| 邀请账号但不加入项目 | 平台 `admin` 或 `owner` |
| 邀请新账号加入项目 | 该项目 `admin` 或 `owner`；不要求平台 Admin |
| 改变平台角色 | 仅平台 `owner` |
| 重置其他账号 MFA | 仅平台 `owner` |
| 将已有账号加入项目 | 该项目 `admin` 或 `owner` |

角色字面值为 `owner`、`admin`、`developer`、`operator`。修改平台角色不授予项目成员资格，也不改变项目角色。由 `viat p-user` 管理的项目调用者属于另一身份平面。

## 1. 引导初始 Owner

新部署同时设置：

```dotenv
VIAT_DEFAULT_ADMIN_EMAIL=admin@example.com
VIAT_DEFAULT_ADMIN_PASSWORD=REPLACE_WITH_A_STRONG_PRIVATE_PASSWORD
VIAT_ALLOW_REGISTRATION=false
```

使用前替换邮箱和密码。这是服务端配置，不是注册用户的命令。启动会将缺失账号创建为平台 `owner`，从不覆盖已有账号。只有邮箱而没有密码会跳过引导并告警。以后改变环境密码不是重置步骤。

原生服务端注册默认是 `true`，官方镜像将其覆盖为 **`false`**。关闭注册后，公开注册路由返回 `403`。空平台首个创建的账号获得 `owner`，后续普通账号默认 `operator`。不要临时暴露全新公开注册页来争抢首个 Owner，应使用受保护的引导配置。

## 2. 在控制台登录

1. 打开实际实例 URL，通常根路径重定向到 `/ui/`。
2. 输入平台邮箱/密码，或选择运维配置的 OIDC 提供商。
3. 已登记验证器时，输入新的 TOTP 或未用恢复码。若部署要求先登记，应先完成登记再期待会话。
4. 若需要激活，由平台 Owner/Admin 按[激活](activation.md)操作。
5. 检查账号菜单和项目选择器。项目为空通常是缺成员资格，不是登录失败。

账号菜单的安全/会话控件用于登记 MFA、管理恢复码、修改自己的密码，以及查看和撤销会话。恢复码只显示一次、每个只能用一次，务必私下保存。不要以为邀请中的“临时”密码自动一次性，也不要假定一定强制弹出改密页；应把修改初始密码作为明确的首要任务。

## 3. 在 CLI 登录

使用 CLI `1.1.0`。从专用私有工作目录开始，不要在其他项目工作副本中操作。以下提示使用 **Bash** 语法：

```bash
mkdir viat-session
cd viat-session
umask 077
read -r -p 'Instance base URL: ' VIAT_SERVER
read -r -p 'Platform email: ' VIAT_EMAIL
read -r -s -p 'Platform password: ' VIAT_PASSWORD; printf '\n'
viat auth login --server "$VIAT_SERVER" --email "$VIAT_EMAIL" --password "$VIAT_PASSWORD"
unset VIAT_PASSWORD
viat auth whoami
viat version
```

本地 Compose 安装的基础 URL 输入 `http://127.0.0.1:8080`。有反向代理挂载前缀时应包含前缀，但不要追加 `/ui` 或 `/projects`。预期输出以 `logged in as <your-email>` 开始，`whoami` 打印该邮箱；`viat version` 显示 CLI 版本，并在可用时显示服务端版本。

密码登录必须同时给 `--email` 和 `--password`；省略它们**不会**弹出输入提示。上面的 shell 提示避免把密码字面值写入历史，但 CLI 密码参数短暂可被本机进程检查看到，应使用可信工作站。需要二次验证时，CLI 会交互提示；非交互使用需给 `--totp CODE`。若提示 `mfa_enrollment_required`，先在控制台登记一次再重试。已配置 SSO 可改用 `viat auth login --server URL --oidc NAME`，不要混用密码参数。

会话保存在 `.viat/config.yaml`，含 bearer/refresh 凭据，不要提交或粘贴。常规查找会向上搜索 `.viat/config.yaml`；`VIAT_CONFIG_DIR` 明确指定的是配置**目录本身**。不同服务端的登录会避免覆盖祖先目录会话，但主动分开目录仍最安全，也应保护目录和备份。

## 4. 有意邀请和加入成员

平台 Admin/Owner 可邀请账号而不授予项目访问：

```sh
viat user invite --email colleague@example.com --display-name "Colleague"
viat user ls --json
```

请换成真实预期接收人的地址。邀请输出包含 `invited: ...`，并且仅显示一次生成的 `temp_password`。应通过带外方式传达，不要写进聊天日志或提交的终端记录。此操作创建账号，不承诺发送邀请邮件；加入项目前，该账号看不到项目。

项目 Owner/Admin 若希望一步创建并加入：

```sh
viat user invite --email teammate@example.com --project hello-lab --role developer
```

`--project` 与 `--role` 必须同时提供。邮箱已存在会冲突，应使用[添加项目成员](../projects/create-and-collaborate.md)，不是再次邀请。可选 `--temp-password` 可预设至少八字符的初始密码，但会把秘密放进参数，交互管理更适合用生成密码流程。

## 5. 委派平台权限

平台 Owner 可以提升已有账号：

```sh
viat user set-role colleague@example.com admin
viat user ls --json
```

这赋予平台管理权限，**不是**项目 Admin。项目权限使用项目成员流程。只有 Owner 可修改平台角色；最后一个平台 Owner 不能被降级。移除唯一恢复通道前，应建立第二个可信 Owner 并验证其登录。

Owner 可用 `viat user reset-mfa colleague@example.com` 处理 MFA 丢失。此操作清除二次验证并将该账号从所有会话退出；若策略要求 MFA，账号必须重新登记。这是事故恢复操作，不是常规绕过 MFA 的办法。最后一个 Owner 锁死需要另受控制的运维恢复流程，不应向普通用户分发直接改数据库的恢复命令。

## 排错

| 现象 | 检查 |
| --- | --- |
| 登录正确却无项目 | 请项目 Owner/Admin 添加成员；平台角色独立 |
| 邀请收到 `403` | 无 `--project` 需平台 Admin/Owner；有该参数需目标项目 Admin/Owner |
| `--project`/`--role` 校验错误 | 两者同时提供，或都不提供 |
| 邮箱已存在冲突 | 添加已有账号为成员，不是重新邀请 |
| `401 mfa_required` | 完成当前挑战，使用新验证器码或未用恢复码 |
| 所有 TOTP 均失败 | 检查时钟、是否是正确实例的验证器条目、是否复用了已消费的码 |
| `429` | 遵守 `Retry-After`，不断重试密码会加重限流 |
| 修改引导密码无效 | 引导从不覆盖已有用户；通过账号控件改密 |
| `403 license_required` | 由平台 Admin/Owner 激活；用户目录不豁免激活门禁 |

默认 access token 有效期 **3600 秒**，refresh 会话 **2592000 秒**（30 天），可由运维调整。刷新不再次询问 TOTP。refresh 凭据被盗应视为会话泄露，而不只是一个小时的风险。

## 退出与移除访问

`viat auth logout` 清除解析到的 CLI 配置中的本地登录凭据和当前项目。本发行中它是**本地清理**，不是服务端撤销请求；不能把它当成终止被盗会话。服务端会话通过控制台会话管理撤销，个人访问令牌另行撤销。1.1.0 的此命令不会清除已保存的 `project_token`，所以退出登录不等于完整抹除凭据。退役工作站时，应私下检查实际使用的配置文件，并在签发系统撤销后移除残留的项目凭据。

从项目移除成员见[创建项目并协作](../projects/create-and-collaborate.md)。下一次请求即失去该项目管理访问，但平台账号和项目内容不会被删除。不要编造 `viat user delete`，本 CLI 没有该命令。

## 核验依据

契约源码 `03751a67`：`crates/viat-api/src/handlers/{auth,users}.rs`、`crates/viat-db/src/users.rs`、`crates/viat-cli/src/{main,config}.rs`、`crates/viat-cli/src/commands/{auth,user}.rs`、`Dockerfile`。
