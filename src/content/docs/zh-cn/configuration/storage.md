---
title: 文件、缓存与持久存储配置
description: 目录白名单、上传暂存、S3 上限、响应缓存与持久化边界。
doc_id: configuration.storage
verified_release: '1.1.0'
channel: stable
---

# 文件、缓存与持久存储配置

按[配置总览](overview.md)理解类型与重载。未注明必填的项均可选。相关但
**互不替代**的白名单/参数:工作账号与目录属主在[安全配置](security.md),
Rust 产物在[运行时](runtime.md),SQLite 路径在[数据库配置](database.md)。

| 变量 | 类型;二进制默认值 | 范围、作用域与覆盖 |
| --- | --- | --- |
| `VIAT_STORAGE_ROOTS` | string; 未设置 | D。冒号分隔的绝对目录白名单,供 local storage 资源使用;未设则不允许保存本地存储根。资源 root 过路径检查后还须落在允许范围内。 |
| `VIAT_STORAGE_SPOOL_DIR` | path; `<tmp>/viat-spool` | S + D。必须是绝对路径;相对值警告并忽略。平台所有,Unix 权限 0711。**不要**交给 worker,也不要混入持久业务文件。 |
| `VIAT_STORAGE_MAX_FILE_BYTES` | u64; `104857600` 字节 | D。正的部署级单文件上限(默认 100 MiB);资源 `max_file_bytes` 只能更低。0/非法回退默认。 |
| `VIAT_S3_MULTIPART_THRESHOLD_BYTES` | u64; `67108864` 字节 | D。正阈值(默认 64 MiB),超过即分段上传;**不提高**资源单文件上限。 |
| `VIAT_S3_MULTIPART_PART_BYTES` | u64; `67108864` 字节 | D。正数,夹到 5 MiB..5 GiB;为不超过 10,000 段,实现可加大分段。 |
| `VIAT_S3_HELPER_MAX_BYTES` | u64; `8388608` 字节 | D。`ctx.resources` S3 helper 的 8 MiB 缓冲上限。接受 0,但**不是**"无限制"开关——大对象改用 /_s3 流式路径,不要一味放大缓冲。 |
| `VIAT_WATCH_ROOTS` | string; 未设置 | S + D。冒号分隔绝对目录白名单,供文件监听;未设即禁用。须是容器内路径;**不是** storage 或 SQLite 白名单。 |
| `VIAT_CACHE_REDIS_URL` | URL; 未设置 | S。可选共享响应缓存;已配置但格式错误的 URI 阻止启动。运行中故障按"未命中且不存储"处理,不让端点失败。设置后取代内存后端。 |
| `VIAT_CACHE_MEMORY_MAX_BYTES` | u64; `67108864` 字节 | F。单进程按权重计算的内存缓存预算(默认 64 MiB);仅在未配 Redis 时,0 才等于关闭缓存。**不是**进程总内存。 |
| `VIAT_CACHE_MAX_ENTRY_BYTES` | u64 → usize; `262144` 字节 | F。正的缓存响应体上限(默认 256 KiB);更大的响应正常返回但不缓存。0/非法回退。 |
| `VIAT_CACHE_MAX_TTL_SECS` | u32(经 u64); `86400` 秒 | D。正数且须适配 u32;端点 `ttl_secs` 只能更低。非法/0/超范围回退 24 小时。 |

## 规划目录与挂载

```dotenv
VIAT_STORAGE_ROOTS=/srv/viat-files
VIAT_STORAGE_SPOOL_DIR=/var/tmp/viat-spool
VIAT_STORAGE_MAX_FILE_BYTES=104857600
VIAT_WATCH_ROOTS=/srv/viat-input
```

未执行的示例。要点:

- 目录必须真实存在或允许服务端创建,并映射到容器内相同路径。
- 建议分开:持久文件、输入目录、上传暂存、解释器缓存、编译缓存。
- **不要**把平台数据目录、私钥目录、`/etc`、宿主根或 Docker socket 放进
  项目作者可选择的根目录。
- local storage 文件由平台后端访问——不需要为"可读"把整棵目录 chown 给
  脚本账号。脚本直写普通挂载目录是另一种能力:显式用
  `VIAT_WORKER_DATA_DIRS`,但它**递归改属主**;宿主已有固定 UID 时改用匹配
  的 worker UID,并把无需改属主的树从 adoption 列表移除。只读监听目录尽量
  只读挂载。检查的是**容器内**路径与账号权限,不只是宿主目录权限。

## 暂存、上传与失败清理

- multipart 文件按请求写入平台 spool,正常完成后删除。Unix 目录 0711
  (可遍历、不可列出);worker 只应读交给它的具体句柄。
- 崩溃残留在启动时与每小时按**保守年龄**清理;年龄与同步运行/幂等陈旧
  阈值相关——不是"上传后整点删除"。活跃请求存在时不要手工清空 spool;
  也不要用 spool 保存最终文件。
- 一次上传可能同时吃反代临时盘、平台 spool 与目标对象存储——单文件上限
  **不是**部署总配额。估算并发上传峰值与失败残留,监控磁盘/inode。遇到
  413 先分清:普通 2 MiB 缓冲体 / multipart 文本字段 / 文件上限 / 反代
  限制。S3 分段失败的残留分段应由对象存储生命周期规则兜底——不能假定
  平台清理永远成功。

## 缓存不是备份

- 未配 Redis 时,响应缓存**每进程独立、重启即失**;
  `VIAT_CACHE_MEMORY_MAX_BYTES=0` 只在该模式下关闭缓存。Redis 配置了但
  不可达时,运行请求按未命中处理——不保证命中率。
- 缓存键区分已发布快照与允许的调用方范围;命中仍经过认证/授权等检查。
  **不要把业务真相放在缓存里**;敏感共享响应要审查端点的 cache scope。
- 缓存 Redis 与端点限流 Redis(`VIAT_RATELIMIT_REDIS_URL`)是独立配置:
  可指向同一受控服务,但须分别预算、保护与验证。后者故障回退为每实例
  限流——**不是**严格集群限额,见[集成](integrations.md)。

## 备份范围与恢复验证

平台数据库保存资源配置与管理元数据;**不会自动备份** local storage 字节、
SQLite 文件、业务库、S3 桶或外部秘密。文件记录/审计可能在项目自己的
业务库里——恢复元数据与文件字节要选一致时点。Rust 本地产物若没有其他
副本/工具链,也可能是恢复必需数据;Cargo/uv 缓存通常可重建,但离线环境
不能假定可以重新下载。

用[备份与隔离恢复](../operations/backup-restore.md)演练:把原目录/桶
隔离 → 挂载恢复副本 → 检查权限与一个已知样本的哈希 → 验证脚本不会写回
生产。**恢复测试不能只证明 PostgreSQL 可以导入。**
