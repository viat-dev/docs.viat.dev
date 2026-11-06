---
title: 安全与秘密后端配置
description: 密钥、登录策略、工作账号与秘密后端的实际边界和恢复要求。
doc_id: configuration.security
verified_release: '1.1.0'
channel: stable
---

# 安全与秘密后端配置

使用主机运维权限设置环境；项目编辑权限不足以修改此处参数。账号与角色管理参见[平台用户](../instance/platform-users.md)，激活参见[实例激活](../instance/activation.md)。所有示例均未执行。

[表格约定](overview.md)适用于本页。

| 变量 | 类型；二进制默认值 | 范围、作用域、覆盖与校验 |
| --- | --- | --- |
| `VIAT_MASTER_KEY` | string; required / 必填 | S。必须为 64 位十六进制（32 字节）。AES-GCM 主密钥；即便新秘密改用 Vault/AWS，仍然必填。项目不可覆盖。换值后旧 AES 密文无法解密。 |
| `VIAT_JWT_SECRET` | string; `dev-secret-change-me` | S。令牌签名字节；实现未强制最小长度。生产必须设强随机独立值；危险默认值只记录启动错误，不阻止启动。修改会使已签名令牌失效。 |
| `VIAT_ACCESS_TTL_SECONDS` | i64; `3600` s | S。解析成功后优先于旧小时参数，否则尝试旧值/默认值。AppConfig 不强制正数，应配置正的有效期。 |
| `VIAT_TOKEN_TTL_HOURS` | i64; unset / 未设置 | S。已废弃；仅秒数缺失或解析失败时作为后备，乘以 3600 并警告。不强制正数，建议改用秒。 |
| `VIAT_REFRESH_TTL_SECONDS` | i64; `2592000` s | S。30 天。AppConfig 不强制正数。影响后续有效期计算，不承诺重写已存过期时间。 |
| `VIAT_DEFAULT_ADMIN_EMAIL` | string; unset / 未设置 | S。非空邮箱启用初始 Owner 创建，并需要密码。已有账号不会因修改此值而重置密码或提升权限。 |
| `VIAT_DEFAULT_ADMIN_PASSWORD` | string; unset / 未设置 | S。创建初始账号时配合邮箱使用；缺失/空值跳过并警告。确认正常管理入口后，从持续部署配置移除初始凭据。 |
| `VIAT_ALLOW_REGISTRATION` | boolean; `true` | D。去空白后 false/no（忽略大小写）或 0 关闭，其余值开启。Docker 默认 false。控制平台注册，不替代项目终端用户策略。 |
| `VIAT_MFA_REQUIRED` | enum; `off` | D。忽略大小写，admins/admin 要求平台高权限角色；all/true/1/yes 要求所有密码用户；其他值含拼错均为 off。不为每次 PAT/OIDC/API key 调用额外加 TOTP。 |
| `VIAT_LICENSE_CODE` | string; unset / 未设置 | S。启动接纳与官方镜像匹配的有效激活码；无效/过期值记录日志并忽略，不降级已有更长期许可。未激活仍能启动但受锁定。 |
| `VIAT_EXPOSE_SCRIPT_ERRORS` | boolean; `false` | D。仅去空白后的字面值 1/true/yes 开启向调用方返回脚本错误详情。生产保持关闭；内部执行日志仍保留详情。 |
| `VIAT_OUTBOUND_DENY_PRIVATE` | boolean; `false` | D。去空白后 true/yes（忽略大小写）或 1 启用保存时 URL 主机检查。不是完整的 DNS 重绑定防御或网络沙箱，见下文。 |
| `VIAT_AUTH_RATELIMIT_IP_PER_MINUTE` | u32; `100` requests/min | S。按认证路由/IP 的每分钟预算。0 关闭此桶。凭据限流在 PostgreSQL 持久化并跨节点共享。 |
| `VIAT_AUTH_RATELIMIT_IDENTITY_PER_MINUTE` | u32; `20` requests/min | S。按认证路由/规范化身份限流。0 关闭此桶，不建议关闭；登录失败退避另行计算。 |
| `VIAT_SECRET_BACKEND` | enum; `aes_gcm` | S。严格为 aes_gcm/vault/aws；空值也用 AES。未知值阻止启动。只决定新写入，不自动迁移既有秘密。 |
| `VAULT_ADDR` | URL; unset / 未设置 | S。只要存在就初始化 Vault，即便它不是写后端；必须非空。Vault 写入及读取旧 Vault 引用都需要。 |
| `VAULT_TOKEN` | string; unset / 未设置 | S。设置 VAULT_ADDR 时必填且非空。静态令牌，不自动续期。仅授予指定 KV v2 范围的读取/创建/更新权限。 |
| `VAULT_KV_MOUNT` | string; `secret` | S。KV v2 挂载名称，不是完整 /v1/data URL。修改可能使旧引用无法读取。 |
| `VIAT_VAULT_PATH_PREFIX` | string; `viat` | S。新值写入 prefix/UUID 路径；旧引用保留自身路径。历史前缀仍需读取权限。 |
| `VIAT_SECRETS_AWS` | switch; unset / 未设置 | S。只有严格的 1 才初始化 AWS Secrets Manager。AWS 写入及读取旧 AWS 引用都需要；true 不会启用。 |
| `VIAT_AWS_SM_NAME_PREFIX` | string; `viat/` | S。新 Secrets Manager 名称前缀。AWS SDK 的区域/凭据链与 Rust S3 产物凭据不是一组配置。 |
| `VIAT_WORKER_DROP` | boolean; on / 开启 | F；仅 Unix。字面值 0/false/no 关闭降权。仍需要有特权的父进程及可解析的非 root 目标。Docker 父进程是 root，worker 为 10001/10001。 |
| `VIAT_WORKER_UID` | u32; unset / 未设置 | F；仅 Unix。显式非零正 UID 优先于账号查询。非法或 0 会警告并让 worker 保持服务端身份，不会强制阻止启动。 |
| `VIAT_WORKER_GID` | u32; explicit UID / 显式 UID | F；仅 Unix。仅配合显式 UID 使用；缺失/非法时使用 UID 数值。仍受操作系统权限限制。 |
| `VIAT_WORKER_USER` | string; `viat` | F；仅 Unix。未设 UID 时查询此账号；账号不存在或是 root 则不降权并警告。非特权服务端不能变更 worker UID。 |
| `VIAT_WORKER_DATA_DIRS` | string; unset / 未设置 | S。冒号分隔、已存在的绝对目录，不能是 /。按工作账号递归接管属主，受符号链接/属主检查限制。不要列入不允许改属主的共享宿主目录。 |

## 主密钥、JWT 与初始账号

用私密终端中的 `openssl rand -hex 32` 生成独立主密钥和 JWT 随机值，放进受限服务环境。命令仅为示例；不要复制示例密码。主密钥与数据库备份分开保管并演练共同恢复。JWT 值相同的多个节点可识别同一组令牌；随机换一台节点的密钥会造成间歇性登录/解密失败。

初始 Owner 只在账号不存在时创建。修改 `VIAT_DEFAULT_ADMIN_PASSWORD` **不能重置已有账号密码**，也不会把已有低权限用户提升为 Owner。关闭注册前先确认可用 Owner、OIDC 或恢复通道。设置 `VIAT_MFA_REQUIRED=admins` 前先让受影响人员登记验证器并离线保管恢复码；`all` 会扩大受影响范围。MFA 必需策略拼错会关闭强制要求，不会给出安全的拒绝启动。

## AES、Vault 与 AWS 的实际操作

- **AES-GCM**：默认；密文在平台 PostgreSQL，解密依赖原 `VIAT_MASTER_KEY`。
- **Vault KV v2**：先准备 KV v2 mount、TLS 信任和受限 token，再设置以下参数；示例不创建真实秘密。

```dotenv
VIAT_SECRET_BACKEND=vault
VAULT_ADDR=https://vault.example.com:8200
VAULT_TOKEN=REPLACE_WITH_SCOPED_TOKEN
VAULT_KV_MOUNT=secret
VIAT_VAULT_PATH_PREFIX=viat
```

平台写入 `/v1/secret/data/viat/UUID`，JSON 为 `{"data":{"v":"BASE64_VALUE"}}`；读取同一路径，期望 `data.data.v`。Base64 不是加密，依赖 Vault 自身安全。token 不自动续期；续期/轮换和进程重启由运维负责。该客户端显式不使用环境代理。

- **AWS Secrets Manager**：设置 `VIAT_SECRETS_AWS=1` 和 `VIAT_SECRET_BACKEND=aws`；使用 AWS SDK 默认凭据/区域链（优先采用受限工作负载身份）。以 `VIAT_AWS_SM_NAME_PREFIX` 限制可创建/读取的名字；至少需要对应 `CreateSecret`、`GetSecretValue`，如配置 KMS 则须相应密钥权限。不要把 Rust 产物存储的 `VIAT_RUST_S3_*` 当作 Secrets Manager 凭据。

后端标记随每个 blob 保存：`0x01` AES、`0x02` Vault 路径、`0x03` AWS 秘密名。改变写后端**不会重加密旧数据**。迁移/回退期间保留所有历史读取后端、mount、密钥和权限。恢复数据库而未恢复外部秘密，会留下不可用引用。禁止假设删除资源会替你清理所有历史外部秘密；生命周期清理由备份/合规策略另行安排。

在隔离项目写入一个测试秘密并通过合法资源调用验证读取；不要把秘密打印到日志。失败时检查 blob 对应后端、token 过期、区域/权限、路径/mount 和网络；恢复旧读取配置，不要覆盖密文“修复”。

## 重要：凭据投射并非绝对隔离

平台会清空工作进程环境并禁止透传核心平台密钥，许多资源通过平台侧代理调用并屏蔽已知秘密。但是 **1.1.0 部分数据库、缓存、AMQP、S3 资源对象仍向脚本投射凭据**。因此不能宣称“所有资源秘密永远不会进入脚本”。开发者能够执行代码，应按其可访问资源的敏感级别授信；日志屏蔽不等于阻止主动外传，也不能替代最小权限资源账号。

容器默认 UID 分离只能减少同 UID 的 `/proc` 读取风险，**不是任意恶意代码的完整沙箱**。没有工作账号、显式错误 UID、非 root 父进程或禁用降权，都可能让 worker 与服务端同身份。生产必须核对启动日志，并限制容器内存/PID、挂载、网络出口和主机权限。Rust 编译可执行构建脚本，编译主机也是敏感信任边界。

`VIAT_OUTBOUND_DENY_PRIVATE` 只是选定保存路径的主机校验；不解析所有 DNS 结果，也不约束脚本任意 socket。对不可信作者用网络防火墙/隔离实例实施策略。完整操作清单见[安全运维](../operations/security.md)。
