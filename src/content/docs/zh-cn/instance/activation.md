---
title: 激活实例与续期
description: 为匹配的官方镜像应用有效激活码、查看状态和处理失败，不涉及生成厂商密钥。
doc_id: instance.activation
verified_release: '1.1.0'
channel: stable
---

# 激活实例与续期

官方 Viat 部署可以启动,但在获得有效激活码前,受保护的产品路由保持锁定。
本页假定你**已持有与官方镜像校验公钥匹配的有效激活码**;这里不编造购买/签发
URL,不介绍厂商签名密钥生成,也不把自行签出的码当作客户激活方式。

登录后控制台会直接把未激活的部署引导到激活页:

![未激活实例的激活页](/screenshots/zh-cn/activation.png)

## 前提与权限

- 实例已运行,PostgreSQL 平台数据库与必要秘密已配置;新安装见
  [Docker Compose](../installation/docker-compose.md)。
- 适用于本服务端构建、未过期的有效激活码。校验离线进行,使用编译进服务端的
  公钥;其他密钥签发的码不能使用。
- 应用激活码需要**平台 `admin` 或 `owner`** 会话;项目 Owner 不够。任意已认证
  平台用户可读取状态。
- 服务端时间正确——真实签名的码也可能按服务端时钟判定过期。

无人值守初始化可用 `VIAT_DEFAULT_ADMIN_EMAIL` 与 `VIAT_DEFAULT_ADMIN_PASSWORD`
引导首个平台 Owner;两者缺一不可,且不会覆盖已有账号,无需开放注册。

## 锁定时哪些入口仍可访问

激活门禁豁免:根路径重定向、控制台静态内容(`/ui` 及后代)、平台认证
(`/auth`)、激活端点(`/license`)、内置手册(`/_docs`)、`/healthz`、`/readyz`、
`/metrics`、`/version`。

**豁免不等于匿名授权**:`GET /license`、`GET /version` 仍需平台登录,
`/healthz` 返回 `200` 只代表进程存活,不是许可证检查。大多数项目/产品路由
返回:

```json
{"error":"license_required","message":"license_required: this deployment has not been activated; an administrator must submit an activation code"}
```

HTTP 状态为 `403`。后台执行路径同样受激活状态约束;进程活着不代表锁定后的
调度继续执行。

## 提交激活码

三种方式二选一即可,效果相同;续期也只是再次提交新码。

:::tabs id=activate

::tab 控制台

1. 打开实例 `/ui/`,用平台 Admin/Owner 登录;未激活时会自动进入激活页。
2. 将完整激活码粘贴进输入框并提交。
3. 成功后页面显示状态、客户与到期信息,并恢复正常项目导航。
4. 若其他服务进程暂时仍锁定,等待约 **15 秒**的数据库重查窗口后重试——
   激活码存在共享平台数据库里,不在浏览器里。

![已激活实例的许可证状态页](/screenshots/zh-cn/license.png)

::tab CLI

先完成[平台用户](platform-users.md)的登录;不需要选择项目。

查看状态:

```sh
viat license show
viat license show --json
```

未激活实例返回最小结构:

```json
{"activated":false,"expired":false}
```

已安装激活码返回 `activated: true`,以及 `expired`、`license_id`、
`customer`、`issued_at`、`expires_at`、`activated_at`。**只看
`activated: true` 不够**:已安装但过期的码仍报告 `activated: true`,同时
`expired: true`;`expires_at: null` 表示无到期日期。

为避免激活码进入命令行参数和 shell 历史,保存到受保护文件后经 stdin 提交:

```sh
chmod 600 activation-code.txt
viat license activate - --json < activation-code.txt
viat license show --json
```

`-` 是"从 stdin 读取"的字面位置参数,不是省略参数。CLI 会去除首尾空白并
本地拒绝空输入;成功后应为 `activated: true`、`expired: false`。输出标识按
私有信息处理。

::tab 启动时自动激活

在受保护的服务环境设置 `VIAT_LICENSE_CODE`(如 Compose 的 `.env`),然后只
重建应用服务:

```sh
docker compose up -d viat
```

通过控制台或 `viat license show --json` 核验。启动处理有意避免破坏已有状态:

- 未设置/空值:不改变状态。
- 格式错误、签名不匹配、不受支持或过期:记录并忽略,启动继续。
- 无有效存量激活码:安装提供的有效码。
- 已有有效码:仅当环境变量中的码**有效期严格更长**时才替换(永久码高于
  有日期的码);旧 `.env` 不会撤销后续续期。

所有副本可共用同一环境变量和共享数据库;手动端点会安装提交的任何有效码,
因此替换更长激活码前先比较有效期。

:::

## 失败处理

| 现象 / message 原因 | 含义与处理 |
| --- | --- |
| `no activation code supplied` | CLI stdin/文件为空;检查受保护的输入文件 |
| `invalid_code: ... malformed` | 输入被截断或格式错误;重新复制完整激活码 |
| `invalid_code: ... signature does not verify` | 激活码与镜像编译公钥不匹配;向分发方确认产物/激活码组合 |
| `unsupported_code: ...` | 激活码格式/版本比服务端支持的新;使用兼容的服务端/激活码组合 |
| `expired_code: ...` | 已过期;检查服务端时钟并使用当前有效的续期码 |
| HTTP `401` | 使用平台账号登录;对外端点凭据不够 |
| 提交激活码时 HTTP `403` | 检查平台 Admin/Owner 角色,项目角色无效 |
| 启动成功但仍锁定 | 无效环境变量码被忽略;检查状态与服务端日志 |
| 其他节点短暂锁定 | 检查共享数据库,等待重查周期;持续失败再查错误 |

等价管理操作:平台 Admin/Owner 调 `POST /license/activate`,请求体
`{"code":"..."}`;拒绝原因是 HTTP `400` 加普通 `error: "bad_request"`,细节
在 `message` 中,不是新的顶层 error 值。

> [!WARNING]
> 不要通过替换服务端校验公钥、客户侧生成厂商密钥或削弱门禁来"修复"签名
> 失败——这改变的是信任模型,不是激活官方部署。

## 验证与清理

确认 `activated: true`、`expired: false` 后,打开你确实加入的项目——激活后
的项目权限拒绝属于另一类访问问题。原始激活码保存在受保护配置中;临时明文
输入文件按主机秘密策略移除(SSD/备份文件系统上删除不等于安全擦除)。

激活状态随平台数据库持久化。备份恢复与主密钥管理仍需独立运维方案;激活不是
备份机制,也不会创建项目成员关系。不要把激活码、客户或许可证标识公开到截图
和支持帖子里。

## 核验依据

契约源码 `03751a67`:`crates/viat-api/src/license.rs`(`open_path`、`adopt_env_code`、重查间隔)、`crates/viat-api/src/handlers/license.rs`(权限、状态与错误)、`crates/viat-cli/src/commands/license.rs`(stdin 与输出)。
