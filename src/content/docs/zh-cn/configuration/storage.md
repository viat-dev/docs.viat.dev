---
title: 文件、缓存与持久存储配置
description: 目录白名单、上传暂存、S3 上限、响应缓存与持久化边界。
doc_id: configuration.storage
verified_release: '1.1.0'
channel: stable
---

# 文件、缓存与持久存储配置

按[配置总览](overview.md)理解类型和重载。未注明必填的项均可选。工作账号与目录属主参数在[安全配置](security.md)，Rust 产物参数在[运行时](runtime.md)，SQLite 路径在[数据库配置](database.md)。这些白名单互不替代。

| 变量 | 类型；二进制默认值 | 范围、作用域与覆盖 |
| --- | --- | --- |
| `VIAT_STORAGE_ROOTS` | string; unset / 未设置 | D。冒号分隔绝对目录白名单，用于 local storage 资源；未设不允许保存本地存储根。资源 root 经路径检查后须位于允许范围内。 |
| `VIAT_STORAGE_SPOOL_DIR` | path; `<tmp>/viat-spool` | S + D。须绝对路径；相对值警告并忽略。由平台拥有，Unix 权限 0711。不要交给 worker 或混入持久业务文件。 |
| `VIAT_STORAGE_MAX_FILE_BYTES` | u64; `104857600` bytes | D。正的部署单文件上限，默认 100 MiB；资源 max_file_bytes 只能降低。0/非法回退默认。 |
| `VIAT_S3_MULTIPART_THRESHOLD_BYTES` | u64; `67108864` bytes | D。正阈值，默认 64 MiB，超过时分段上传；不提高资源单文件上限。 |
| `VIAT_S3_MULTIPART_PART_BYTES` | u64; `67108864` bytes | D。正数，限制到 5 MiB..5 GiB；为不超过 10,000 段，实现可增大分段。 |
| `VIAT_S3_HELPER_MAX_BYTES` | u64; `8388608` bytes | D。ctx.resources S3 helper 的 8 MiB 缓冲上限。接受 0，但不是无限制开关。大对象改用 /_s3 流式路径，不要一味放大缓冲。 |
| `VIAT_WATCH_ROOTS` | string; unset / 未设置 | S + D。冒号分隔绝对目录白名单，用于文件监听；未设则禁用。须挂载容器内路径；不是 storage 或 SQLite 白名单。 |
| `VIAT_CACHE_REDIS_URL` | URL; unset / 未设置 | S。可选共享响应缓存；已配置但格式错误的 URI 阻止启动。运行中故障视为未命中且不存储，不让端点因此失败。设置 Redis 后取代内存后端。 |
| `VIAT_CACHE_MEMORY_MAX_BYTES` | u64; `67108864` bytes | F。单进程按权重计算的内存缓存预算，默认 64 MiB；仅未配置 Redis 时 0 才关闭缓存。不是进程总内存。 |
| `VIAT_CACHE_MAX_ENTRY_BYTES` | u64 → usize; `262144` bytes | F。正的缓存响应体上限，默认 256 KiB；更大响应正常返回但不缓存。0/非法回退。 |
| `VIAT_CACHE_MAX_TTL_SECS` | u32 via u64; `86400` s | D。正数且须适配 u32；端点 ttl_secs 只能降低。非法/0/超范围回退 24 小时。 |

## 规划目录与挂载

```dotenv
VIAT_STORAGE_ROOTS=/srv/viat-files
VIAT_STORAGE_SPOOL_DIR=/var/tmp/viat-spool
VIAT_STORAGE_MAX_FILE_BYTES=104857600
VIAT_WATCH_ROOTS=/srv/viat-input
```

这是未执行的示例，目录必须真实存在或允许服务端创建，并映射到容器相同路径。建议把持久文件、输入目录、上传暂存、解释器缓存、编译缓存分开。不要把平台数据目录、私钥目录、`/etc`、宿主根或 Docker socket 放进项目作者可选择的根目录。

local storage 文件由平台后端访问，不需要为了可读就把整棵目录 chown 给脚本账号。脚本直接写普通挂载目录是另一个能力，可显式使用 `VIAT_WORKER_DATA_DIRS`，但它递归更改属主；宿主已有固定 UID 时用匹配 worker UID，并从 adoption 列表移除无需改属主的树。只读监听目录尽量只读挂载。检查容器内路径和账号权限，而不只是宿主目录权限。

## 暂存、上传和失败清理

multipart 文件按请求写入平台 spool，正常完成后删除。Unix 目录为 0711（可遍历而不可列出），worker 只应读取交给它的具体句柄。崩溃残留在启动时及每小时按保守年龄清理；年龄与同步运行/幂等陈旧阈值相关，并非“文件上传后整点删除”。不要在还有活跃请求时手工清空 spool，也不要用 spool 保存最终文件。

上传可能同时消耗反代临时盘、平台 spool 和目标对象存储空间；单文件上限不是整个部署总配额。估算并发上传峰值与失败残留，监控磁盘/ inode。遇到 413 先区分普通 2 MiB 缓冲体、multipart 文本字段、文件上限和反代限制。S3 分段失败后的残留分段也应由对象存储生命周期规则兜底，不能假定平台清理永远成功。

## 缓存不是备份

未配置 Redis 时，响应缓存每进程独立，重启后消失；`VIAT_CACHE_MEMORY_MAX_BYTES=0` 只在此模式关闭。Redis 配置存在但不可达时，运行请求会未命中，不能保证缓存命中率。缓存键区分已发布快照和允许的调用方范围，命中仍经过认证/授权等检查。不要把业务真相放在缓存中；敏感共享响应须审查端点的 cache scope。

缓存 Redis 与端点限流 Redis（`VIAT_RATELIMIT_REDIS_URL`）是独立配置，可指向同一受控服务但须分别预算、保护和验证。后者故障会退回每实例限流，不是严格集群限额，详见[集成](integrations.md)。

## 备份范围和恢复验证

平台数据库保存资源配置及管理元数据；**不会自动备份** local storage 字节、SQLite 文件、业务库、S3 桶或外部秘密。文件记录/审计可能存在项目自己的业务数据库，恢复元数据与文件字节应选择一致时点。Rust 本地产物若没有其他可用副本/工具链，也可能是恢复必需数据；Cargo/uv 缓存通常可重建，但离线环境不能假定可以重新下载。

用[备份与隔离恢复](../operations/backup-restore.md)演练：把原目录/桶隔离，挂载恢复副本，检查权限与一个已知样本哈希，验证脚本不会写回生产。恢复测试不能只证明 PostgreSQL 可以导入。
