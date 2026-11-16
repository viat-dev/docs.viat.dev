---
title: 数据库配置
description: 平台与业务数据库的连接、权限、迁移预算和 TLS 限制。
doc_id: configuration.database
verified_release: '1.1.0'
channel: stable
---

# 数据库配置

平台元数据**必须用 PostgreSQL**——SQLite、MySQL、缓存资源都不能替代。它
保存账号、项目、草稿、已发布快照、秘密密文(或外部秘密引用)、运行与控制
面审计。业务资源连接是**另一组凭据、另一组连接池**,别混为一谈。

## 参数

| 变量 | 类型;二进制默认值 | 范围、作用域与行为 |
| --- | --- | --- |
| `DATABASE_URL` | string; **必填** | S。平台 PostgreSQL 连接 URI。无默认连接,缺失/空值/格式错误/连接失败都无法启动。密码特殊字符要 URL 编码;TLS 用 sqlx 支持的 PostgreSQL URI 参数。项目不可覆盖。 |
| `VIAT_DB_MIGRATION_TIMEOUT_SECS` | u64; `600` 秒 | D。正整数秒,零或非法回退 600。只控制**资源数据库迁移请求**,不管平台启动迁移;请求不能提高该预算。 |
| `VIAT_GRAPHQL_MAX_RELATION_DEPTH` | usize; `8` 层 | D(创建引擎时)。0 关闭上限。资源/GraphQL 作者不能突破部署上限;调高前先验证深层查询。 |
| `VIAT_GRAPHQL_MAX_TABLE_READS` | usize; `64` 次读 | D(创建引擎时)。0 关闭上限。限制单次执行中的表读取数,**不是**平台 PostgreSQL 池大小。 |
| `VIAT_SQLITE_ROOTS` | string; 未设置 | D。冒号分隔的绝对目录白名单;不设则不允许任何 SQLite 资源路径。路径按服务端文件系统解析,还须过规范路径校验。 |

## 连接、权限与迁移

```dotenv
DATABASE_URL=postgres://viat:REPLACE_WITH_URL_ENCODED_PASSWORD@postgres:5432/viat
VIAT_DB_MIGRATION_TIMEOUT_SECS=600
```

未执行的配置示例。要点:

- 数据库必须**预先存在**;启动账号要能登录目标库并执行随版本附带的 DDL
  迁移;日常运行要能读写平台表、使用序列与数据库通知。不要用业务库的
  只读账号,也不要为排错长期给超级用户——先在隔离副本核实所需权限。
- 服务端平台池上限固定 **10 条连接/进程**,没有受支持的
  `VIAT_DB_POOL_SIZE` 变量;启动还会为通知等另建连接——为管理、备份和
  其他客户端预留余量。资源池单独计数:PostgreSQL/MySQL 资源缓存池通常
  上限 **8 条/资源/进程**。加实例只会叠加连接预算,共享数据库容量不会
  自动增加。
- 所有内置迁移在 HTTP 监听**之前**执行;`VIAT_DB_MIGRATION_TIMEOUT_SECS`
  只约束 `viat db` 对业务资源的迁移,不是启动迁移的保险丝。遇到
  `db connect`/`db migrate`/校验和错误:先停止反复重启、保留日志与备份;
  **不要**修改已应用迁移记录或删除校验和。

## TLS 的真实边界

- 平台 `DATABASE_URL` 用 sqlx 连接 URI:生产环境应按 PostgreSQL 驱动能力
  设置证书验证,并从运行环境实际验证证书链与主机名。
- **业务 `postgresql` 资源的 `ssl` 布尔值目前被其连接构造路径忽略**——
  不能当作"已启用/已验证 TLS"的证据。
- 业务 `mysql` 资源的 `ssl=true` 映射为 **Preferred**(允许回退),不是
  Require/VerifyIdentity。平台库 URI 的 TLS 设置不影响这些资源。

> [!WARNING]
> 有强制加密/身份验证要求时,用数据库服务端拒绝明文、经验证的网络隧道/
> 代理等**外部措施**并实际验证连接——资源保存成功不是合规证据。证书错误
> 不要靠全局关闭验证来"修复"。

## 运维检查与恢复

| 现象 | 处理 |
| --- | --- |
| 新部署起不来 | 先核对地址、容器网络/DNS、端口、库名与账号,再启动应用;容器内 `localhost` 指容器自身 |
| `PoolTimedOut` | 区分数据库不可达 / 连接配额耗尽 / 长事务与锁 / 应用负载;查 `/readyz` 与数据库端连接/锁视图,不要直接调大并发 |
| 业务资源迁移超时 | 核对目标库、迁移账本、锁与具体 SQL;连接中断不保证语句全部回滚——先核对状态再重试 |
| 迁移后要回退版本 | 按[升级](../operations/upgrades.md)与[备份恢复](../operations/backup-restore.md)操作;没有通用自动降级迁移承诺 |

SQLite 文件、WAL/SHM、外部数据库与审计表**都不在**平台库备份内,见
[存储](storage.md)。
