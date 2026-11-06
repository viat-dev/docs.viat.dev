---
title: 数据库配置
description: 平台与业务数据库的连接、权限、迁移预算和 TLS 限制。
doc_id: configuration.database
verified_release: '1.1.0'
channel: stable
---

# 数据库配置

平台元数据**必须使用 PostgreSQL**；SQLite、MySQL、缓存资源都不能替代它。平台库保存账号、项目、草稿、已发布快照、秘密密文或外部秘密引用、运行和控制面审计等。业务资源连接是另一组凭据和另一组连接池。

## 参数

| 变量 | 类型；二进制默认值 | 范围、作用域与行为 |
| --- | --- | --- |
| `DATABASE_URL` | string; **required / 必填** | S。平台 PostgreSQL 连接 URI。没有默认连接；缺失则无法启动。空值、格式错误或连接失败均不能正常启动。密码特殊字符须 URL 编码；TLS 使用 sqlx 支持的 PostgreSQL URI 参数。项目不可覆盖。 |
| `VIAT_DB_MIGRATION_TIMEOUT_SECS` | u64; `600` s | D。正整数秒；零或非法值回退 600。控制资源数据库迁移请求，不控制平台启动迁移；请求不可提高该预算。 |
| `VIAT_GRAPHQL_MAX_RELATION_DEPTH` | usize; `8` levels / 层 | D（创建引擎时）。0 关闭该上限。资源或 GraphQL 作者不能突破部署上限；提高前先验证深层查询。 |
| `VIAT_GRAPHQL_MAX_TABLE_READS` | usize; `64` reads / 次 | D（创建引擎时）。0 关闭该上限。限制一次执行中的表读取，不是平台 PostgreSQL 池大小。 |
| `VIAT_SQLITE_ROOTS` | string; unset / 未设置 | D。冒号分隔的绝对目录白名单；不设则不允许 SQLite 资源路径。路径以服务端文件系统为准，还须通过规范路径校验。 |

## 连接、权限和迁移

```dotenv
DATABASE_URL=postgres://viat:REPLACE_WITH_URL_ENCODED_PASSWORD@postgres:5432/viat
VIAT_DB_MIGRATION_TIMEOUT_SECS=600
```

这是未执行的配置示例。数据库必须预先存在。启动数据库账号须能登录目标库并执行随版本附带的 DDL 迁移，日常运行须能读写平台表、使用序列和数据库通知。不要使用业务数据库的只读账号。不要为了排错长期授予超级用户；先在隔离副本核实所需迁移权限。

服务端平台池上限固定为 **10 条连接/进程**，没有受支持的 `VIAT_DB_POOL_SIZE` 环境变量。启动还会建立用于通知等工作的数据库连接；为管理、备份和其他客户端预留余量。资源池另外计数，PostgreSQL/MySQL 资源缓存池通常上限为 **8 条/资源/进程**。增加实例数会叠加连接预算，不会让共享数据库容量自动增加。

所有内置迁移在 HTTP 监听前执行。`VIAT_DB_MIGRATION_TIMEOUT_SECS` 只约束 `viat db` 对业务资源执行的迁移，不是启动迁移的保险丝。出现 `db connect`、`db migrate` 或校验和错误时先停重复重启、保留日志和备份；不要修改已应用迁移记录或删除迁移校验和。

## TLS 的真实边界

平台 `DATABASE_URL` 使用 sqlx 的连接 URI；生产应根据 PostgreSQL 驱动能力设置证书验证，并从运行环境验证证书链与主机名。**业务 `postgresql` 资源的 `ssl` 布尔值目前被其连接构造路径忽略**，不能当作已经启用或验证 TLS 的证据。业务 `mysql` 资源 `ssl=true` 映射为 **Preferred**，允许回退，并不是 Require/VerifyIdentity。平台库 URI 的 TLS 设置不改变这些资源行为。

有强制加密/身份验证要求时，用数据库服务端拒绝明文、经验证的网络隧道/代理等外部措施，并实际验证连接；不要把资源保存成功当合规证据。证书错误不要用全局关闭验证修复。

## 运维检查与恢复

- 新部署：先确认地址、容器网络/DNS、端口、数据库名和账号，再启动应用；容器内 `localhost` 指容器自身。
- `PoolTimedOut`：区分数据库不可达、连接配额耗尽、长事务/锁与应用负载。检查 `/readyz` 和数据库端连接/锁视图，不要直接把并发调大。
- 业务资源迁移超时：确认目标库、迁移账本、锁和具体 SQL。连接中断不保证数据库语句全部回滚；先核对状态，再重试。
- 迁移后需要回滚版本：按[升级](../operations/upgrades.md)和[备份恢复](../operations/backup-restore.md)操作。没有通用的自动降级迁移承诺。

SQLite 文件、WAL/SHM、外部数据库和审计表都不包含在平台库备份内，详见[存储](storage.md)。
