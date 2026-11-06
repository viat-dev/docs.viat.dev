---
title: 激活实例与续期
description: 为匹配的官方镜像应用有效激活码、查看状态和处理失败，不涉及生成厂商密钥。
doc_id: instance.activation
verified_release: '1.1.0'
channel: stable
---

# 激活实例与续期

官方 Viat 部署可以启动，但在获得有效激活码前，受保护的产品路由保持锁定。本页假定你**已经持有与官方镜像校验公钥匹配的有效激活码**。这里不编造购买/签发 URL，不介绍厂商签名密钥生成，也不把自行签出的码当成客户激活方式。

## 前提与权限

- 实例已运行，PostgreSQL 平台数据库和服务端必要秘密已配置。新安装见 [Docker Compose](../installation/docker-compose.md)。
- 适用于本服务端构建、未过期的有效激活码。校验离线进行，使用编译进服务端的公钥；其他密钥签发的码不能使用。
- 应用激活码需要**平台 `admin` 或 `owner`** 会话，仅有项目 Owner 不够。任意已认证平台用户可读取状态。
- 服务端时间正确。真实签名的码也可能按服务端时钟判断已过期。

无人值守初始化可通过 `VIAT_DEFAULT_ADMIN_EMAIL` 和 `VIAT_DEFAULT_ADMIN_PASSWORD` 引导首个平台 Owner；两者缺一不可，且不会覆盖已有账号。不需要为创建管理员而打开公开注册。

## 锁定时哪些入口仍可访问

激活门禁豁免根路径重定向、控制台静态内容（`/ui` 及后代）、平台认证（`/auth` 及后代）、激活端点（`/license` 及后代）、内置手册（`/_docs` 及后代）、`/healthz`、`/readyz`、`/metrics` 和 `/version`。

**门禁豁免不等于匿名授权。** `GET /license` 和 `/version` 仍需要平台登录，其他入口也保留自己的认证和配置。未激活或已过期实例的 `GET /healthz` 仍能返回 `200`，它是存活探针，不是许可证检查。大多数项目/产品路由返回：

```json
{"error":"license_required","message":"license_required: this deployment has not been activated; an administrator must submit an activation code"}
```

HTTP 状态为 `403`。已过期时 message 会描述过期情况。后台执行路径同样约束激活状态；进程活着不代表锁定后的调度继续执行。

## 方式 A：控制台

1. 打开实例 `/ui/`，使用平台 Admin/Owner 登录。
2. 在激活页完整粘贴获得的有效激活码。
3. 提交后，成功会安装激活码并显示状态、客户和到期信息，恢复正常项目导航。
4. 若其他服务进程暂时仍锁定，等待锁定节点约 **15 秒**的数据库重查窗口后重试。激活码存储在共享平台数据库，不是某个浏览器里。

不要把激活码、客户或许可证标识公开到截图和支持帖子中。

## 方式 B：CLI

使用匹配的 CLI，先完成[平台用户](platform-users.md)中的登录流程；不需要选择项目。

查看状态：

```sh
viat license show
viat license show --json
```

从未激活的实例返回以下最小 JSON 结构：

```json
{"activated":false,"expired":false}
```

已安装激活码返回 `activated: true`，以及 `expired`、`license_id`、`customer`、`issued_at`、`expires_at`、`activated_at`。`expires_at: null` 表示无到期日期；**只看 `activated: true` 不够**，已安装但过期的码仍会报告 activated，同时 `expired: true`。

为避免把激活码放进命令行参数和 shell 历史，将其保存在私下接收/准备的受保护文件，再通过 stdin 提交：

```sh
chmod 600 activation-code.txt
viat license activate - --json < activation-code.txt
viat license show --json
```

`-` 是表示“从 stdin 读取激活码”的字面位置参数，不是省略参数。CLI 会去除首尾空白，并在本地拒绝空输入。成功后应为 `activated: true`、`expired: false`；不带 JSON 的命令还会打印 `activated.` 和状态摘要。输出标识应按私有信息处理。

等价管理操作为平台 Admin/Owner 凭据调用 `POST /license/activate`，请求 JSON 为 `{"code":"..."}`。激活码具体拒绝原因使用 HTTP `400` 和普通 `error: "bad_request"`；原因放在 `message` 中，不是新的顶层 error 值。

## 方式 C：启动时激活

在受保护的服务环境中设置 `VIAT_LICENSE_CODE`。使用 [Compose 示例](../installation/docker-compose.md)时，编辑私有 `.env`，只重建应用服务：

```sh
docker compose up -d viat
```

通过控制台或 `viat license show --json` 核验。容器成功启动不代表激活码被接受。启动处理有意避免破坏已有状态：

- 未设置/空值：不改变状态。
- 格式错误、签名不匹配、不受支持或过期：记录并忽略，启动仍继续。
- 没有可用存量激活码：安装提供的有效码。
- 已有有效码：只有环境变量中的码**有效期严格更长**时才替换。永久码高于有日期的码；旧 `.env` 不应撤销后续续期。

所有副本可使用相同环境变量和共享数据库。启动规则与显式激活请求不同：手动端点会安装提交的有效码，因此有意替换更长激活码前应检查有效期。

## 续期与失败处理

续期使用同一 UI、CLI 命令或启动变量，提交新提供的有效码。不需要联网激活服务，也不需要本地厂商私钥。移除环境变量不会擦除已存于平台数据库的激活码。

| 现象 / message 原因 | 含义与处理 |
| --- | --- |
| `no activation code supplied` | CLI stdin/文件为空；检查受保护的输入文件 |
| `invalid_code: ... malformed` | 输入被截断或格式错误；重新复制完整激活码 |
| `invalid_code: ... signature does not verify` | 激活码与镜像编译公钥不匹配；向分发方确认产物/激活码组合 |
| `unsupported_code: ...` | 真实激活码格式/版本比服务端支持的新；使用兼容服务端/激活码组合 |
| `expired_code: ...` | 已过期；检查服务端时钟并使用当前有效续期码 |
| HTTP `401` | 使用平台账号登录，对外端点凭据不够 |
| 提交激活码时 HTTP `403` | 检查平台 Admin/Owner 角色，不是项目角色 |
| 启动成功但仍锁定 | 无效环境变量码会被忽略；检查状态和受限服务日志 |
| 其他节点短暂锁定 | 检查共享数据库，等待锁定节点重查周期；持续失败则查错误 |

不要通过替换服务端校验公钥、客户侧生成厂商密钥或削弱门禁来“修复”签名失败；这改变的是信任模型，不是激活官方部署。

## 验证与清理

确认 `activated: true`、`expired: false` 后，打开自己确实加入的项目。激活后项目权限拒绝是另一类访问问题。将原始激活码保存在受保护配置/记录中；如创建临时明文输入文件，按主机秘密处理策略移除。SSD 和备份文件系统上，删除文件不保证安全擦除。

激活状态随平台数据库持久化。备份恢复和主密钥管理仍需独立运维方案；激活不是备份机制，也不会创建项目成员关系。

## 核验依据

契约源码 `03751a67`：`crates/viat-api/src/license.rs`（`open_path`、`adopt_env_code`、重查间隔）、`crates/viat-api/src/handlers/license.rs`（权限、状态和错误）、`crates/viat-cli/src/commands/license.rs`（stdin 和输出）。
