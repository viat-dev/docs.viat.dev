---
title: 运行时、构建与调度配置
description: 工作池、执行通道、构建、持久队列、调度和 Rust 产物的完整部署参数。
doc_id: configuration.runtime
verified_release: '1.1.0'
channel: stable
---

# 运行时、构建与调度配置

先按[总览](overview.md)理解 S/F/D/W 作用域与重启规则。本页变量除标注
"编译必需"等条件外均可选。注意单位不通用:**池参数通常是毫秒,执行与
通道参数通常是秒**。

## 执行与准入

| 变量 | 类型;二进制默认值 | 范围、作用域与覆盖 |
| --- | --- | --- |
| `VIAT_DEFAULT_TIMEOUT_SECS` | u64; `30` 秒 | D。正数;0/非法回退。仅当目标声明与项目默认**都缺失**时采用,再受上限约束。 |
| `VIAT_MAX_TIMEOUT_SECS` | u64; `300` 秒 | D。正的**同步**上限;0/非法回退。目标/项目只能降不能升。也影响幂等占用与暂存清理期限。 |
| `VIAT_MAX_ASYNC_TIMEOUT_SECS` | u64; `1800` 秒 | D。正的**异步**上限;0/非法回退。队列触发器校验取正 i64 并与确认期限比较。 |
| `VIAT_ASYNC_MAX_INFLIGHT` | usize; `128` 个运行 | F。正数;单进程异步在途信号量——不同于等待队列深度或长任务/流式许可。 |
| `VIAT_SHARED_MAX_TIMEOUT_SECS` | u64; `60` 秒 | D。正数;脚本解析后的超时达到该阈值即进入长任务通道。**它不是执行上限。** |
| `VIAT_LONGRUN_MAX_CONCURRENT` | usize; `8` 个运行 | F。正数;单进程长任务一次性执行许可,不是进程内全部数据库/SQL 操作的统一上限。 |
| `VIAT_LONGRUN_QUEUE_WAIT_SECS` | u64; `5` 秒 | D。正数;同步请求等不到长任务许可返回 503;持久队列任务可一直等到取消。 |
| `VIAT_STREAM_MAX_CONCURRENT` | usize; `8` 条流 | F。正数;单进程流式 worker 许可,与共享池分开。 |
| `VIAT_STREAM_QUEUE_WAIT_SECS` | u64; `30` 秒 | D。正数;流式通道的**准入等待**,不是流的执行寿命。 |
| `VIAT_QUEUE_MAX_DEPTH` | i64; `1000` 个运行 | D。正数;每个并发键的等待任务上限,满后拒绝新提交。 |
| `VIAT_DELAY_MAX_DEPTH` | i64; `100000` 个运行 | D。正数;纯延迟任务(合成 `_delay` 键)的积压上限,不是执行并发。 |
| `VIAT_QUEUE_POLL_MS` | u64; `1000` 毫秒 | D(分发器初始化)。正数;本地唤醒之外的周期认领扫描——调低会加大数据库负载。 |
| `VIAT_TASK_MAX_DEPTH` | u16; `100` 跳 | D。正数;递归 task.call/task.delay 的跳数上限,不限制同层兄弟数量。 |
| `VIAT_QUEUE_ACK_DEADLINE_SECS` | i64; `1500` 秒 | D。正数;RabbitMQ 确认预算。**默认异步上限 1800 大于本值**:须协调预算,或明确接受触发器 `ack_deadline_override` 的风险。 |
| `VIAT_SHUTDOWN_GRACE_SECS` | u64; `10` 秒 | D(停机时)。接受 0;控制优雅排空,**不**把运行中脚本持久化为检查点。容器停止期限要设得更长。 |

## 工作池与依赖环境

| 变量 | 类型;二进制默认值 | 范围、作用域与覆盖 |
| --- | --- | --- |
| `VIAT_POOL_SHARED_MAX` | usize; `16` 个 worker | S。共享热 worker 数;解析接受 0,运维应至少为 1。独占/一次性通道不在此数内。 |
| `VIAT_POOL_QUEUE_DEPTH` | usize; `32` 个请求 | S。共享池等待队列;接受 0。不同于持久异步队列。 |
| `VIAT_POOL_QUEUE_WAIT_MS` | u64; `5000` 毫秒 | S。池等待期限;接受 0(即不留等待宽限)。 |
| `VIAT_POOL_READY_TIMEOUT_MS` | u64; `10000` 毫秒 | S。请求路径等待 worker READY 的期限,**不是**脚本执行预算;接受 0,但正常冷启动无法工作。 |
| `VIAT_POOL_BUILD_TIMEOUT_MS` | u64; `300000` 毫秒 | S。发布/环境构建默认预算;脚本 build-timeout 可在 max 内覆盖;解析接受 0。 |
| `VIAT_POOL_BUILD_TIMEOUT_MAX_MS` | u64; `3600000` 毫秒 | S。脚本 build-timeout 的部署上限;接受 0,应与默认预算协调。 |
| `VIAT_POOL_AUTO_PROMOTE_QPS` | f64; `10.0` 次/秒 | S。自动升独占的 QPS 阈值;`0.0` 关闭自动切换。未严格校验有限/非负——请用有限非负值。 |
| `VIAT_POOL_AUTO_DEMOTE_QPS` | f64; `2.0` 次/秒 | S。当 promote>0 且 demote≥promote 时,实际降级阈值变为 promote/2。请用有限非负值。 |
| `VIAT_POOL_AUTO_WINDOW_SECS` | usize; `60` 秒 | S。滚动 QPS 窗口;至少为 1。 |
| `VIAT_POOL_AUTO_DEDICATED_COUNT` | usize; `2` 个 worker | S。自动升独占时的 worker 数;至少 1。会增加进程,**不代表 CPU 预留**。 |
| `VIAT_POOL_AUTO_MIN_DWELL_SECS` | u64; `60` 秒 | S。升独占后的最短驻留时间;接受 0。 |
| `VIAT_POOL_AUTO_TICK_SECS` | u64; `5` 秒 | S。自动协调周期;至少 1。 |
| `VIAT_BOOT_WARM` | boolean; 开启 | S。字面 `0`/`false` 关闭启动后台预热。不阻塞 HTTP 启动;readyz 正常时预热可能仍未完成。 |
| `VIAT_ENV_GATE` | boolean; 关闭 | D。严格 `1`/`true` 开启"已知环境构建失败则拒绝运行"。默认关闭;它不负责安装依赖。 |
| `VIAT_ENV_RETRY_BACKOFF_SECS` | i64; `300` 秒 | D。失败环境重试退避;限制 ≥0,`0` 允许立即重试。 |
| `VIAT_PYTHON_PRELOAD` | string; `psycopg2-binary` | W。空格/逗号分隔的包规格;显式空值关闭预装。会改变依赖环境,不只是日志行为。 |
| `VIAT_SHELL_BIN` | path; `/bin/bash` | W。shell 可执行文件必须存在且 worker 可执行;Docker 显式设 /bin/bash。 |

## 发布、调度与 Rust

| 变量 | 类型;二进制默认值 | 范围、作用域与覆盖 |
| --- | --- | --- |
| `VIAT_PUBLISH_BUILD_BLOCK` | boolean; 关闭 | D。严格 `1`/`true` 在构建失败时以 409 阻止发布。默认只记诊断不阻止;不同于回归门禁。 |
| `VIAT_PUBLISH_BUILD_ASYNC` | boolean; 关闭 | D。严格 `1`/`true` 开启后台构建且路由立即生效——此时不能指望同步构建阻断保护路由。 |
| `VIAT_PUBLISH_REGRESSION_TIMEOUT_SECS` | u64; `120` 秒 | D。整组发布回归测试预算;解析值夹到 1..3600。 |
| `SCHEDULER_ENABLED` | boolean; `true` | S。字面 `false`/`0` 只停**调度器**。镜像设 true;队列、告警、聊天、监听与清理是独立循环。 |
| `VIAT_DEFAULT_SCHEDULE_TZ` | IANA 时区; `UTC` | D(保存调度时)。去空白,空值→UTC,未知时区拒绝保存。时区**写入每条调度**——改默认不会移动已有调度。 |
| `VIAT_SCHEDULE_MISFIRE_GRACE_SECS` | i64; `60` 秒 | D。正数;到期 cron 超过此延迟记为误触发并跳过,不会重放全部错过的时点。 |
| `VIAT_RUST_AUTHORING` | boolean; 开启 | D。去空白且忽略大小写的 `0/false/off/no/disabled` 禁止 Rust 创建/更新(400 bad_request);已发布的二进制仍可运行。 |
| `VIAT_BUILD_ENABLED` | boolean; 开启 | D。与 Rust authoring 相同的关闭值禁止本节点编译。开启仍需 SDK/工具链;只运行节点须有兼容的预编译产物。 |
| `VIAT_RUST_ARTIFACT_UPLOAD` | boolean; 关闭 | D。产物上传显式启用开关(拼写见下文)。只允许有权限的上传,不是匿名部署可执行程序。 |
| `VIAT_RUST_SDK_PATH` | path; 未设置 | D。**编译必需**;获取/运行兼容产物不需要。-build 镜像为 /opt/viat/rust-sdk;SDK 摘要必须与服务端匹配。 |
| `VIAT_RUST_ARTIFACT_DIR` | path; `<tmp>/viat-rust-artifacts` | D。本地产物/缓存;-build 镜像为 /var/lib/viat/rust-artifacts。应持久化或配共享存储;本地缓存不是集群分发。 |
| `VIAT_RUST_TARGET_DIR` | path; `<tmp>/viat-rust-build` | D。Cargo target 目录;-build 镜像为 /var/lib/viat/rust-target。与产物 LRU 分开估算磁盘;客户端编译覆盖也用它。 |
| `VIAT_RUST_BUILD_TIMEOUT_SECS` | u64; `300` 秒 | D。一次 cargo build 期限;接受 0。不同于 Python READY/构建预算与 CLI 等待期限。 |
| `VIAT_RUST_CACHE_MAX_BYTES` | u64; `5368709120` 字节 | D。5 GiB 本地产物缓存 LRU 上限;0 取消上限。不限制 Cargo target 或共享桶。 |
| `VIAT_RUST_S3_BUCKET` | string; 未设置 | D。非空即启用共享产物桶,本地目录作前置缓存。**不是**项目 S3 资源。 |
| `VIAT_RUST_S3_REGION` | string; `us-east-1` | D。空白回退默认;用于签名与端点推导。 |
| `VIAT_RUST_S3_ENDPOINT` | URL; 自动推导 | D。兼容对象存储端点;不设则按区域推导 AWS S3 端点。 |
| `VIAT_RUST_S3_ACCESS_KEY` | string; 空 | D。显式平台产物凭据;需要认证的桶实际必需。**没有** AWS SDK 身份链回退。 |
| `VIAT_RUST_S3_SECRET_KEY` | string; 空 | D。与 access key 配对;默认不向运行中的工作进程透传。 |
| `VIAT_RUST_S3_SESSION_TOKEN` | string; 未设置 | D。临时凭据会话令牌;有效期随部署凭据维护。 |
| `VIAT_RUST_S3_PATH_STYLE` | boolean; 关闭 | D。严格 `1`/`true` 用 path-style URL,适用于部分兼容存储。 |
| `VIAT_RUST_S3_GC` | boolean; 关闭 | D。严格 `1`/`true` 开启发布后的共享产物回收。**混合架构/工具链或滚动升级时不安全**;不能证明 live-set 完整就保持关闭。 |

## 建议的调参流程

1. 先看端点执行预算的来源、是否被截断与预测通道:`# timeout:` 或工作流
   超时声明优先于项目默认,都缺失才用部署默认。异步上限与同步上限独立
   ——调大 `VIAT_MAX_TIMEOUT_SECS` 不改变 always-async 端点的异步上限。
2. 分清**四类等待**:持久队列等待、通道许可、共享池队列、worker READY。
   把 READY 超时改成执行超时修不好冷装依赖——去查镜像源、包、缓存与
   构建状态。
3. 用隔离项目的代表性脚本实测冷/热启动、尾延迟、RSS、PID/线程、连接数
   与磁盘增长;一次只改一组参数。没有跨硬件的官方吞吐承诺。
4. 短请求共享池、独占槽、长任务、流式任务与进程内资源调用**不是同一个
   总并发数**;提高一个限制可能只是把瓶颈推给数据库或内存。见
   [容量](../operations/capacity.md)。

## 发布与离线依赖

- 默认发布会尝试构建依赖,但构建失败不一定阻止路由生效。需要阻断时:
  同步构建 + `VIAT_PUBLISH_BUILD_BLOCK=1`,并在隔离项目验证失败发布的
  响应。`VIAT_PUBLISH_BUILD_ASYNC=1` 把构建放后台、路由先上线——不要
  同时依赖"同步阻断"的安全感。回归门禁与构建门禁是两回事。
- 离线依赖:持久化 `/home/viat/.cache/uv`,配置可信 Python/npm 镜像源,
  必要时把 `VIAT_PYTHON_PRELOAD` 置空。镜像自带预热的 CPython 3.12 与
  默认 psycopg2 包缓存,**不代表**所有用户依赖离线可用;重建容器、清缓存
  或改依赖版本后必须重新验证构建。环境代理/CA 透传见[集成](integrations.md)。
- Rust:普通镜像无工具链;在线编译节点用匹配版本的 `-build` 产物并验证
  SDK;只运行节点设 `VIAT_BUILD_ENABLED=0`,用共享产物或有权限的兼容
  上传流程供给。`VIAT_RUST_ARTIFACT_UPLOAD` 对去空白、忽略大小写的
  `1/true/yes/on/enabled` 开启,其他值关闭。**不要**把编译能力暴露给
  不可信作者——Cargo 构建脚本具有编译进程的权限。

## 调度、队列与重启恢复

- `SCHEDULER_ENABLED=false` 只停 cron;持久队列、聊天、消息队列触发器、
  文件监听、告警与保留清理照常运行。新 cron 的默认时区会写入行;已有
  调度需逐条修改。误触发宽限**不是**"停机期间全部补跑"。
- RabbitMQ:默认确认期限 1500 秒 < 异步上限 1800 秒,创建/更新触发器可能
  因此被拒。先把 broker 的 consumer timeout、部署执行上限与确认期限调成
  一致的保守预算再保存;`ack_deadline_override` 是主动接受"长任务未结束
  即重投"的风险,**不是**延长 broker 限制。消费至少一次,处理逻辑要幂等。
- 停止:队列停止认领,后台任务尝试排空;未开始的持久队列行可跨重启保留。
  已运行脚本不是可恢复进程——崩溃后可能标记 interrupted/failed,外部
  副作用可能已经发生。重试前按[运行运维](../operations/runs.md)核对。
