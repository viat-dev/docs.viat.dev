---
title: 安全与秘密后端配置
description: 密钥、登录策略、工作账号与秘密后端的实际边界和恢复要求。
doc_id: configuration.security
verified_release: '1.1.0'
channel: stable
---

# 安全与秘密后端配置

本页参数全部需要**主机运维权限**设置环境——项目编辑权不覆盖这里。账号与
角色管理见[平台用户](../instance/platform-users.md);激活见
[实例激活](../instance/activation.md)。示例均未执行;[表格约定](overview.md)
适用于本页。

| 变量 | 类型;二进制默认值 | 范围、作用域、覆盖与校验 |
| --- | --- | --- |
| `VIAT_MASTER_KEY` | string; **必填** | S。必须 64 位十六进制(32 字节)。AES-GCM 主密钥;即使新秘密改用 Vault/AWS 仍必填。项目不可覆盖。**换值后旧 AES 密文无法解密。** |
| `VIAT_JWT_SECRET` | string; `dev-secret-change-me` | S。令牌签名字节,实现未强制最小长度。生产必须设强随机独立值;危险默认值只记启动错误、**不阻止启动**。修改会使已签名令牌全部失效。 |
| `VIAT_ACCESS_TTL_SECONDS` | i64; `3600` 秒 | S。解析成功时优先于旧小时参数,否则退回旧值/默认值。AppConfig 不强制正数——请配置正的有效期。 |
| `VIAT_TOKEN_TTL_HOURS` | i64; 未设置 | S。已废弃;仅当秒数缺失或解析失败时作后备(×3600 并警告)。建议改用秒。 |
| `VIAT_REFRESH_TTL_SECONDS` | i64; `2592000` 秒 | S。30 天。不强制正数;影响后续有效期计算,**不**重写已存的过期时间。 |
| `VIAT_DEFAULT_ADMIN_EMAIL` | string; 未设置 | S。非空邮箱启用初始 Owner 创建(需同时给密码)。已有账号**不会**因此重置密码或提权。 |
| `VIAT_DEFAULT_ADMIN_PASSWORD` | string; 未设置 | S。与邮箱配合创建初始账号;缺失/空值跳过并警告。确认正常管理入口可用后,从持续部署配置中移除。 |
| `VIAT_ALLOW_REGISTRATION` | boolean; `true` | D。去空白后 `false`/`no`(忽略大小写)或 `0` 关闭,其余开启。Docker 默认 false。控制的是**平台**注册,不替代项目终端用户策略。 |
| `VIAT_MFA_REQUIRED` | enum; `off` | D。忽略大小写:`admins`/`admin` 要求平台高权限角色;`all`/`true`/`1`/`yes` 要求所有密码用户;**其他值(含拼错)都是 off**。不为每次 PAT/OIDC/API key 调用额外加 TOTP。 |
| `VIAT_LICENSE_CODE` | string; 未设置 | S。启动接纳与官方镜像匹配的有效激活码;无效/过期记录日志并忽略,不降级已有更长期许可。未激活仍可启动但受锁定。 |
| `VIAT_EXPOSE_SCRIPT_ERRORS` | boolean; `false` | D。仅去空白后的字面 `1`/`true`/`yes` 开启向调用方返回脚本错误详情。生产保持关闭;内部执行日志仍保留详情。 |
| `VIAT_OUTBOUND_DENY_PRIVATE` | boolean; `false` | D。去空白后 `true`/`yes`(忽略大小写)或 `1` 启用保存时的 URL 主机检查。**不是**完整的 DNS 重绑定防御或网络沙箱(见文末)。 |
| `VIAT_AUTH_RATELIMIT_IP_PER_MINUTE` | u32; `100` 次/分 | S。按认证路由/IP 的每分钟预算;0 关闭该桶。凭据限流持久化在 PostgreSQL,跨节点共享。 |
| `VIAT_AUTH_RATELIMIT_IDENTITY_PER_MINUTE` | u32; `20` 次/分 | S。按认证路由/规范化身份限流;0 关闭该桶(不建议)。登录失败退避另行计算。 |
| `VIAT_SECRET_BACKEND` | enum; `aes_gcm` | S。严格为 `aes_gcm`/`vault`/`aws`;空值也用 AES;未知值阻止启动。只决定**新写入**,不自动迁移既有秘密。 |
| `VAULT_ADDR` | URL; 未设置 | S。只要存在就初始化 Vault(即使不是写后端);必须非空。Vault 写入与旧 Vault 引用读取都需要它。 |
| `VAULT_TOKEN` | string; 未设置 | S。设置了 `VAULT_ADDR` 时必填且非空。静态令牌,**不自动续期**;只授予指定 KV v2 范围的读/建/改权限。 |
| `VAULT_KV_MOUNT` | string; `secret` | S。KV v2 挂载名,不是完整 `/v1/data` URL。修改可能使旧引用不可读。 |
| `VIAT_VAULT_PATH_PREFIX` | string; `viat` | S。新值写入 `prefix/UUID` 路径;旧引用保留自身路径——历史前缀仍需读权限。 |
| `VIAT_SECRETS_AWS` | switch; 未设置 | S。**只有严格的 `1`** 才初始化 AWS Secrets Manager;`true` 不会启用。AWS 写入与旧 AWS 引用读取都需要。 |
| `VIAT_AWS_SM_NAME_PREFIX` | string; `viat/` | S。新 Secrets Manager 名称前缀。AWS SDK 的区域/凭据链与 Rust S3 产物凭据**不是**一组配置。 |
| `VIAT_WORKER_DROP` | boolean; 开启 | F;仅 Unix。字面 `0`/`false`/`no` 关闭降权。仍需有特权的父进程与可解析的非 root 目标;Docker 下父进程 root、worker 10001/10001。 |
| `VIAT_WORKER_UID` | u32; 未设置 | F;仅 Unix。显式非零正 UID 优先于账号查询;非法或 0 会警告并保持服务端身份,不阻止启动。 |
| `VIAT_WORKER_GID` | u32; 显式 UID 时生效 | F;仅 Unix。仅配合显式 UID 使用;缺失/非法时用 UID 数值。仍受 OS 权限限制。 |
| `VIAT_WORKER_USER` | string; `viat` | F;仅 Unix。未设 UID 时查询此账号;账号不存在或为 root 则不降权并警告。非特权服务端不能变更 worker UID。 |
| `VIAT_WORKER_DATA_DIRS` | string; 未设置 | S。冒号分隔、**已存在**的绝对目录(不能是 `/`);按工作账号递归接管属主,受符号链接/属主检查限制。不要列入不允许改属主的共享宿主目录。 |

## 主密钥、JWT 与初始账号

- 在私密终端用 `openssl rand -hex 32` 为主密钥与 JWT 各生成一个独立随机
  值,放进受限服务环境;命令仅为示例,不要复制示例密码。
- **主密钥与数据库备份分开保管**,并演练"两者共同恢复"。
- JWT 值相同的多个节点能识别同一组令牌;只随机换其中一台的密钥,会造成
  间歇性登录/解密失败。
- 初始 Owner 只在账号**不存在**时创建:修改
  `VIAT_DEFAULT_ADMIN_PASSWORD` **不能重置已有账号密码**,也不会把已有
  低权限用户提升为 Owner。
- 关闭注册前,先确认仍有可用的 Owner/OIDC/恢复通道。
- 设 `VIAT_MFA_REQUIRED=admins` 前,先让受影响人员登记验证器并离线保存
  恢复码;`all` 扩大受影响范围。**拼错的 MFA 策略等于关闭强制要求**,
  不会安全地拒绝启动。

## AES、Vault 与 AWS 的实际操作

- **AES-GCM**(默认):密文存平台 PostgreSQL,解密依赖原
  `VIAT_MASTER_KEY`。
- **Vault KV v2**:先备好 KV v2 mount、TLS 信任与受限 token,再设置:

```dotenv
VIAT_SECRET_BACKEND=vault
VAULT_ADDR=https://vault.example.com:8200
VAULT_TOKEN=REPLACE_WITH_SCOPED_TOKEN
VAULT_KV_MOUNT=secret
VIAT_VAULT_PATH_PREFIX=viat
```

  平台写 `/v1/secret/data/viat/UUID`,JSON 为
  `{"data":{"v":"BASE64_VALUE"}}`;读取同路径,期望 `data.data.v`。
  Base64 不是加密——安全依赖 Vault 本身。token 不自动续期,续期/轮换与
  进程重启由运维负责;该客户端显式不走环境代理。
- **AWS Secrets Manager**:设 `VIAT_SECRETS_AWS=1` 且
  `VIAT_SECRET_BACKEND=aws`;用 AWS SDK 默认凭据/区域链(优先受限的
  工作负载身份);用 `VIAT_AWS_SM_NAME_PREFIX` 限制可建/可读的名字;至少
  需要 `CreateSecret`、`GetSecretValue`,配了 KMS 还要相应密钥权限。
  **不要**把 Rust 产物存储的 `VIAT_RUST_S3_*` 当 Secrets Manager 凭据。

> [!WARNING]
> 后端标记随每个 blob 保存(`0x01` AES、`0x02` Vault 路径、`0x03` AWS
> 秘密名)。**切换写后端不会重加密旧数据**:迁移/回退期间要保留所有历史
> 读取后端、mount、密钥与权限;只恢复数据库而不恢复外部秘密,会留下不可
> 用引用。删除资源也不会替你清理历史外部秘密——生命周期清理由备份/合规
> 策略另行安排。

验证:在隔离项目写入一个测试秘密,经合法资源调用验证读取;**不要**把秘密
打印到日志。失败时按序查:blob 对应后端 → token 过期 → 区域/权限 →
路径/mount → 网络;恢复旧读取配置,**不要用覆盖密文来"修复"**。

## 重要:凭据投射并非绝对隔离

平台会清空工作进程环境、禁止透传核心平台密钥,许多资源走平台侧代理并屏蔽
已知秘密。**但 1.1.0 的部分数据库、缓存、AMQP、S3 资源对象仍向脚本投射
凭据**——因此不能宣称"所有资源秘密永不进入脚本"。能执行代码的开发者应按
其可访问资源的敏感级别授信;日志屏蔽不等于阻止主动外传,也不能替代最小
权限的资源账号。

容器默认的 UID 分离只减少同 UID 的 `/proc` 读取风险,**不是**任意恶意代码
的完整沙箱:没有工作账号、显式错误 UID、非 root 父进程或禁用降权,都可能
让 worker 与服务端同身份。生产必须核对启动日志,并限制容器内存/PID、
挂载、网络出口与主机权限;Rust 编译可执行构建脚本,编译主机也是敏感信任
边界。

`VIAT_OUTBOUND_DENY_PRIVATE` 只是选定保存路径的主机校验:不解析所有 DNS
结果,也不约束脚本的任意 socket。对不可信作者,用网络防火墙/隔离实例
实施策略。完整清单见[安全运维](../operations/security.md)。
