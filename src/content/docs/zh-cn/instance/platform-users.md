---
title: 平台用户与登录
description: 引导 Owner、登录、邀请平台账号，并明确平台管理与项目成员关系的区别。
doc_id: instance.platform-users
verified_release: '1.1.0'
channel: stable
---

# 平台用户与登录

**平台用户**用于登录控制台、CLI 或原生应用——**不是**项目终端用户。平台
角色控制实例管理;每个项目由独立的成员角色控制。一个平台 `operator` 完全
可以同时是某项目的 `owner`。

## 前提与权限矩阵

需要实例基础 URL 与平台账号;引导新安装还需要主机权限。用户目录与项目
管理路由需要实例已激活——锁定时仍可登录和激活。

| 操作 | 所需权限 |
| --- | --- |
| 登录 / 查看自己的身份 | 本人平台凭据 + 要求的 MFA |
| 列出平台用户 | 平台 `admin` 或 `owner` |
| 邀请账号但不加入项目 | 平台 `admin` 或 `owner` |
| 邀请新账号加入项目 | 该项目 `admin` 或 `owner`;**不要求**平台 Admin |
| 改变平台角色 | 仅平台 `owner` |
| 重置其他账号 MFA | 仅平台 `owner` |
| 将已有账号加入项目 | 该项目 `admin` 或 `owner` |

角色字面值:`owner`、`admin`、`developer`、`operator`。修改平台角色
**不授予**项目成员资格,也不改项目角色;`viat p-user` 管理的项目调用者
属于另一身份平面。

## 1. 引导初始 Owner

新部署同时设置:

```dotenv
VIAT_DEFAULT_ADMIN_EMAIL=admin@example.com
VIAT_DEFAULT_ADMIN_PASSWORD=REPLACE_WITH_A_STRONG_PRIVATE_PASSWORD
VIAT_ALLOW_REGISTRATION=false
```

使用前替换邮箱与密码。要点:

- 这是**服务端配置**,不是注册用户的命令。启动会把缺失的账号创建为平台
  `owner`,**从不覆盖已有账号**;只有邮箱没有密码会跳过引导并告警;以后
  改变环境密码**不是**重置手段。
- 原生服务端注册默认 `true`,官方镜像覆盖为 **`false`**;关闭后公开注册
  路由返回 `403`。空平台首个创建的账号获得 `owner`,后续普通账号默认
  `operator`。**不要**临时暴露公开注册页抢首个 Owner——用受保护的引导
  配置。

## 2. 在控制台登录

1. 打开实例 URL(根路径通常重定向到 `/ui/`)。
2. 输入平台邮箱/密码,或选择运维配置的 OIDC 提供商。
3. 已登记验证器时输入新的 TOTP 或未用恢复码;部署要求先登记时,完成
   登记后再期待会话。
4. 需要激活时,由平台 Owner/Admin 按[激活](activation.md)操作。
5. 检查账号菜单与项目选择器——项目为空通常是**缺成员资格**,不是登录
   失败。

账号菜单的安全/会话控件用于:登记 MFA、管理恢复码、改自己的密码、查看
与撤销会话。恢复码只显示一次、每枚只用一次,私下保存。**不要**以为邀请
的"临时"密码自动一次性,也不要假定强制弹改密页——把修改初始密码当作
明确的首要任务。

## 3. 在 CLI 登录

使用 CLI `1.1.0`,从专用私有工作目录开始(不要在其他项目的工作副本里
操作)。以下提示用 **Bash** 语法:

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

- 本地 Compose 安装的基础 URL 是 `http://127.0.0.1:8080`;有反代挂载
  前缀时包含前缀,但**不要**追加 `/ui` 或 `/projects`。预期:`logged in
  as <your-email>` 开头;`whoami` 打印同一邮箱;`viat version` 显示 CLI
  版本及可用时的服务端版本。
- 密码登录必须同时给 `--email` 和 `--password`,省略**不会**弹提示;
  `read -s` 避免密码进历史,但参数短暂可被本机进程看到——用可信工作站。
  二次验证会交互提示;非交互用 `--totp CODE`;提示
  `mfa_enrollment_required` 时先去控制台登记。已配 SSO 用
  `viat auth login --server URL --oidc NAME`,**不要**混用密码参数。
- 会话存在 `.viat/config.yaml`(含 bearer/refresh 凭据):不要提交或粘贴;
  常规查找向上搜索 `.viat/config.yaml`;`VIAT_CONFIG_DIR` 指的是配置
  **目录本身**。不同服务端的登录会避免覆盖祖先会话,但主动分目录最安全;
  目录与备份同样要保护。

## 4. 有意邀请和加入成员

平台 Admin/Owner 可邀请账号而不给项目访问:

```sh
viat user invite --email colleague@example.com --display-name "Colleague"
viat user ls --json
```

- 换成真实预期接收人地址。邀请输出含 `invited: ...` 与**仅显示一次**的
  `temp_password`——带外传达,不写进聊天日志或提交的终端记录。此操作
  创建账号,**不承诺**发送邀请邮件;加入项目前该账号看不到任何项目。
- 项目 Owner/Admin 一步创建并加入:

```sh
viat user invite --email teammate@example.com --project hello-lab --role developer
```

  `--project` 与 `--role` 必须同时提供。邮箱已存在会冲突——改用
  [添加项目成员](../projects/create-and-collaborate.md),不是再次邀请。
  可选 `--temp-password` 可预设 ≥8 字符初始密码,但会把秘密放进参数;
  交互管理更适合用生成密码流程。

## 5. 委派平台权限

- 平台 Owner 提升已有账号:

```sh
viat user set-role colleague@example.com admin
viat user ls --json
```

  这赋予**平台**管理权限,不是项目 Admin——项目权限走项目成员流程。
  只有 Owner 能改平台角色;**最后一个平台 Owner 不能被降级**;移除唯一
  恢复通道前,先建立第二个可信 Owner 并验证其登录。
- Owner 可用 `viat user reset-mfa colleague@example.com` 处理 MFA 丢失:
  清除二次验证并把该账号退出所有会话;策略要求 MFA 时须重新登记。这是
  **事故恢复**操作,不是常规绕过。最后一个 Owner 锁死需要受控的运维
  恢复流程——不要向普通用户分发直接改数据库的恢复命令。

## 排错

| 现象 | 检查 |
| --- | --- |
| 登录正确却无项目 | 请项目 Owner/Admin 添加成员;平台角色独立 |
| 邀请收到 `403` | 无 `--project` 需平台 Admin/Owner;有该参数需目标项目 Admin/Owner |
| `--project`/`--role` 校验错误 | 两者同时提供,或都不提供 |
| 邮箱已存在冲突 | 添加已有账号为成员,不是重新邀请 |
| `401 mfa_required` | 完成当前挑战:新验证器码或未用恢复码 |
| 所有 TOTP 失败 | 时钟、是否正确实例的验证器条目、是否复用已消费的码 |
| `429` | 遵守 `Retry-After`;不断重试密码会加重限流 |
| 修改引导密码无效 | 引导从不覆盖已有用户;走账号控件改密 |
| `403 license_required` | 平台 Admin/Owner 激活;用户目录不豁免激活门禁 |

默认 access token 有效期 **3600 秒**,refresh 会话 **2592000 秒**(30 天),
可由运维调整;刷新**不会**再问 TOTP。refresh 凭据被盗应视为**会话泄露**,
不只是一个小时的风险。

## 退出与移除访问

- `viat auth logout` 清除解析到的 CLI 配置中的本地登录凭据与当前项目。
  本发行中它是**本地清理**,不是服务端撤销——不能当作用来终止被盗会话;
  服务端会话在控制台会话管理里撤销,PAT 另行撤销。此命令**不会**清除
  已保存的 `project_token`:退出登录 ≠ 完整抹除凭据。退役工作站时,
  私下检查实际使用的配置文件,并在签发系统撤销后移除残留项目凭据。
- 从项目移除成员见[创建项目并协作](../projects/create-and-collaborate.md):
  下一次请求即失去该项目管理访问,平台账号与项目内容**不会**被删除。
  **不要**编造 `viat user delete`——本 CLI 没有该命令。

## 核验依据

契约源码 `03751a67`:`crates/viat-api/src/handlers/{auth,users}.rs`、`crates/viat-db/src/users.rs`、`crates/viat-cli/src/{main,config}.rs`、`crates/viat-cli/src/commands/{auth,user}.rs`、`Dockerfile`。
