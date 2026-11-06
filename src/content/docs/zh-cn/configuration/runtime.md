---
title: 运行时、构建与调度配置
description: 工作池、执行通道、构建、持久队列、调度和 Rust 产物的完整部署参数。
doc_id: configuration.runtime
verified_release: '1.1.0'
channel: stable
---

# 运行时、构建与调度配置

先按[总览](overview.md)理解 S/F/D/W 及重启规则。本页所有变量除“编译必需”等条件要求外均可选。数字单位不通用：池参数通常是毫秒，执行和通道参数通常是秒。

## 执行与准入

| 变量 | 类型；二进制默认值 | 范围、作用域与覆盖 |
| --- | --- | --- |
| `VIAT_DEFAULT_TIMEOUT_SECS` | u64; `30` s | D。正数；0/非法回退。仅目标声明、项目默认均缺失时采用，再受上限约束。 |
| `VIAT_MAX_TIMEOUT_SECS` | u64; `300` s | D。正的同步上限；0/非法回退。目标/项目只能降低。也影响幂等占用与暂存清理期限。 |
| `VIAT_MAX_ASYNC_TIMEOUT_SECS` | u64; `1800` s | D。正的异步上限；0/非法回退。队列触发器校验使用正 i64，并与确认期限比较。 |
| `VIAT_ASYNC_MAX_INFLIGHT` | usize; `128` runs | F。正数，单进程异步在途信号量；不同于等待队列深度或长任务/流式许可。 |
| `VIAT_SHARED_MAX_TIMEOUT_SECS` | u64; `60` s | D。正数；适用脚本的解析后超时达到该阈值即进入长任务通道。它不是执行上限。 |
| `VIAT_LONGRUN_MAX_CONCURRENT` | usize; `8` runs | F。正数；单进程长任务一次性执行许可，不是所有进程内数据库/SQL 操作的统一上限。 |
| `VIAT_LONGRUN_QUEUE_WAIT_SECS` | u64; `5` s | D。正数；同步请求等待长任务许可后返回 503；持久队列任务可一直等到取消。 |
| `VIAT_STREAM_MAX_CONCURRENT` | usize; `8` streams | F。正数；单进程流式 worker 许可，与共享池分开。 |
| `VIAT_STREAM_QUEUE_WAIT_SECS` | u64; `30` s | D。正数；流式通道准入等待，不是流执行寿命。 |
| `VIAT_QUEUE_MAX_DEPTH` | i64; `1000` runs | D。正数；每个并发键的等待任务上限，满后拒绝新提交。 |
| `VIAT_DELAY_MAX_DEPTH` | i64; `100000` runs | D。正数；使用合成 _delay 键的纯延迟任务积压上限，不是执行并发。 |
| `VIAT_QUEUE_POLL_MS` | u64; `1000` ms | D（分发器初始化）。正数；本地唤醒之外的周期认领扫描，降低会增加数据库负载。 |
| `VIAT_TASK_MAX_DEPTH` | u16; `100` hops | D。正数；递归 task.call/task.delay 跳数上限，不限制同层兄弟任务数量。 |
| `VIAT_QUEUE_ACK_DEADLINE_SECS` | i64; `1500` s | D。正数，RabbitMQ 确认预算。默认异步上限 1800 大于本值：须协调预算，或明确接受触发器 ack_deadline_override 风险。 |
| `VIAT_SHUTDOWN_GRACE_SECS` | u64; `10` s | D（停机时）。接受 0；控制优雅排空，不把运行脚本持久化检查点。容器停止期限须更长。 |

## 工作池与依赖环境

| 变量 | 类型；二进制默认值 | 范围、作用域与覆盖 |
| --- | --- | --- |
| `VIAT_POOL_SHARED_MAX` | usize; `16` workers | S。共享热 worker 数；解析接受 0，运维应至少为 1。独占/一次性通道不包含在此数值内。 |
| `VIAT_POOL_QUEUE_DEPTH` | usize; `32` requests | S。共享池等待队列，接受 0；不同于持久异步队列。 |
| `VIAT_POOL_QUEUE_WAIT_MS` | u64; `5000` ms | S。池等待期限；接受 0，相当于不留等待宽限。 |
| `VIAT_POOL_READY_TIMEOUT_MS` | u64; `10000` ms | S。请求路径等 worker READY 的期限，不是脚本执行预算；接受 0，但正常冷启动无法使用。 |
| `VIAT_POOL_BUILD_TIMEOUT_MS` | u64; `300000` ms | S。发布/环境构建默认预算。脚本 build-timeout 可在 build_timeout_max 内覆盖；解析接受 0。 |
| `VIAT_POOL_BUILD_TIMEOUT_MAX_MS` | u64; `3600000` ms | S。脚本 build-timeout 的部署上限；解析接受 0，应与默认预算协调。 |
| `VIAT_POOL_AUTO_PROMOTE_QPS` | f64; `10.0` requests/s | S。自动升为独占的 QPS 阈值；0.0 关闭自动切换。未严格校验有限性/非负性，应使用有限非负值。 |
| `VIAT_POOL_AUTO_DEMOTE_QPS` | f64; `2.0` requests/s | S。promote>0 且 demote>=promote 时，实际降级阈值改为 promote/2。应使用有限非负值。 |
| `VIAT_POOL_AUTO_WINDOW_SECS` | usize; `60` s | S。滚动 QPS 窗口，至少为 1。 |
| `VIAT_POOL_AUTO_DEDICATED_COUNT` | usize; `2` workers | S。自动升独占时的 worker 数，至少为 1。会增加进程，不代表 CPU 预留。 |
| `VIAT_POOL_AUTO_MIN_DWELL_SECS` | u64; `60` s | S。升独占后最短驻留再允许降级；接受 0。 |
| `VIAT_POOL_AUTO_TICK_SECS` | u64; `5` s | S。自动协调周期，至少为 1。 |
| `VIAT_BOOT_WARM` | boolean; on / 开启 | S。字面值 0/false 关闭启动后台预热。不阻塞 HTTP 启动；readyz 正常时预热仍可能未完成。 |
| `VIAT_ENV_GATE` | boolean; off / 关闭 | D。严格 1/true 开启对已知环境构建失败的运行拒绝。默认关闭，不负责安装依赖。 |
| `VIAT_ENV_RETRY_BACKOFF_SECS` | i64; `300` s | D。失败环境重试退避，限制为 >=0；0 允许立即重试。 |
| `VIAT_PYTHON_PRELOAD` | string; `psycopg2-binary` | W。空格/逗号分隔包规格；显式空值关闭预装。会改变依赖环境，不只是日志行为。 |
| `VIAT_SHELL_BIN` | path; `/bin/bash` | W。shell 可执行文件必须存在且 worker 可执行。Docker 显式设置 /bin/bash。 |

## 发布、调度与 Rust

| 变量 | 类型；二进制默认值 | 范围、作用域与覆盖 |
| --- | --- | --- |
| `VIAT_PUBLISH_BUILD_BLOCK` | boolean; off / 关闭 | D。严格 1/true 在构建失败时以 409 阻止发布。默认仅记录诊断不阻止；不同于回归门禁。 |
| `VIAT_PUBLISH_BUILD_ASYNC` | boolean; off / 关闭 | D。严格 1/true 开启后台构建且路由立即生效；此时不能指望同步构建阻断保护路由。 |
| `VIAT_PUBLISH_REGRESSION_TIMEOUT_SECS` | u64; `120` s | D。整组发布回归测试预算；解析值限制到 1..3600。 |
| `SCHEDULER_ENABLED` | boolean; `true` | S。字面值 false/0 仅关闭调度器。镜像设 true。队列、告警、聊天、监听和清理是独立循环。 |
| `VIAT_DEFAULT_SCHEDULE_TZ` | IANA zone; `UTC` | D（保存调度时）。去空白，空值→UTC；未知时区拒绝保存。时区写入每条调度，改默认不会移动已有调度。 |
| `VIAT_SCHEDULE_MISFIRE_GRACE_SECS` | i64; `60` s | D。正数；到期 cron 超过此延迟会记录/跳过误触发，不会重放全部错过的时间点。 |
| `VIAT_RUST_AUTHORING` | boolean; on / 开启 | D。去空白且忽略大小写的 0/false/off/no/disabled 禁止 Rust 创建/更新（400 bad_request）；已有发布二进制仍可运行。 |
| `VIAT_BUILD_ENABLED` | boolean; on / 开启 | D。与 Rust authoring 相同的关闭值禁止本节点编译。开启仍需 SDK/工具链；只运行节点须有兼容的预编译产物。 |
| `VIAT_RUST_ARTIFACT_UPLOAD` | boolean; off / 关闭 | D。产物上传显式启用开关，准确拼写见下文。只允许有权限的上传，不是匿名部署可执行程序。 |
| `VIAT_RUST_SDK_PATH` | path; unset / 未设置 | D。编译必需，获取/运行兼容产物不需要。-build 镜像为 /opt/viat/rust-sdk；SDK 摘要必须匹配服务端。 |
| `VIAT_RUST_ARTIFACT_DIR` | path; `<tmp>/viat-rust-artifacts` | D。本地产物/缓存。-build 镜像为 /var/lib/viat/rust-artifacts。应持久化或配置共享存储；本地缓存不是集群分发。 |
| `VIAT_RUST_TARGET_DIR` | path; `<tmp>/viat-rust-build` | D。Cargo target 目录。-build 镜像为 /var/lib/viat/rust-target。与产物 LRU 分开估算磁盘；也用于客户端编译覆盖。 |
| `VIAT_RUST_BUILD_TIMEOUT_SECS` | u64; `300` s | D。一次 cargo build 期限；接受 0。不同于 Python READY/构建预算和 CLI 等待期限。 |
| `VIAT_RUST_CACHE_MAX_BYTES` | u64; `5368709120` bytes | D。5 GiB 本地产物缓存 LRU 上限；0 取消上限。不限制 Cargo target 或共享桶。 |
| `VIAT_RUST_S3_BUCKET` | string; unset / 未设置 | D。非空启用共享产物桶，本地目录作前置缓存。不是项目 S3 资源。 |
| `VIAT_RUST_S3_REGION` | string; `us-east-1` | D。空白回退默认。用于签名和推导端点。 |
| `VIAT_RUST_S3_ENDPOINT` | URL; derived / 自动推导 | D。兼容对象存储端点；不设则推导 AWS 区域 S3 端点。 |
| `VIAT_RUST_S3_ACCESS_KEY` | string; empty / 空 | D。显式平台产物凭据；需要认证的桶实际必需。本配置没有 AWS SDK 身份链回退。 |
| `VIAT_RUST_S3_SECRET_KEY` | string; empty / 空 | D。与 access key 配对，默认不向运行工作进程透传。 |
| `VIAT_RUST_S3_SESSION_TOKEN` | string; unset / 未设置 | D。临时凭据会话令牌；随部署凭据维护有效期。 |
| `VIAT_RUST_S3_PATH_STYLE` | boolean; off / 关闭 | D。严格 1/true 使用 path-style URL，适用于部分兼容存储。 |
| `VIAT_RUST_S3_GC` | boolean; off / 关闭 | D。严格 1/true 开启发布后的共享产物回收。混合架构/工具链或滚动升级时不安全；不能证明 live-set 完整就保持关闭。 |

## 建议的调参流程

1. 先查看端点执行预算中的来源、是否被截断和预测通道。`# timeout:` 或工作流超时声明优先于项目默认；只有缺失时才使用部署默认。异步上限与同步上限独立。增加 `VIAT_MAX_TIMEOUT_SECS` 不会改变 always-async 端点的异步上限。
2. 区分四类等待：持久队列等待、通道许可、共享池队列、worker READY。把 READY 超时改成执行超时不会修好冷装依赖；应检查镜像源、包、缓存和构建状态。
3. 用隔离项目的真实代表性脚本测量冷/热启动、尾延迟、RSS、PID/线程、连接数和磁盘增长；一次改一组参数。没有跨硬件的官方吞吐承诺。
4. 短请求共享池、独占槽、长任务、流式任务和进程内资源调用不是一个总并发数。提高一个限制可能只把瓶颈推到数据库或内存。详见[容量](../operations/capacity.md)。

## 发布与离线依赖

默认发布会尝试构建依赖，但构建失败不一定阻止路由生效。需要阻断时使用同步构建并设置 `VIAT_PUBLISH_BUILD_BLOCK=1`，在隔离项目验证失败发布响应。`VIAT_PUBLISH_BUILD_ASYNC=1` 会把构建放入后台，路由先上线；不要同时依赖同步阻断的安全感。回归测试门禁与构建门禁不同。

持久化 `/home/viat/.cache/uv`，配置可信 Python/npm 镜像源，必要时把 `VIAT_PYTHON_PRELOAD` 设为空。镜像带预热 CPython 3.12 与默认 psycopg2 包缓存，不代表所有用户依赖均离线可用。重建容器、清缓存或改变依赖版本后，必须重新验证构建。环境代理/CA 透传规则见[集成](integrations.md)。

普通镜像无 Rust 工具链；需要在线编译的节点用匹配版本 `-build` 产物并验证 SDK。只运行节点用 `VIAT_BUILD_ENABLED=0`，配置共享产物或通过有权限的兼容上传流程供给。`VIAT_RUST_ARTIFACT_UPLOAD` 对去空白并忽略大小写的 `1`、`true`、`yes`、`on`、`enabled` 开启；其他值关闭。不要把代码编译能力暴露给不可信作者，Cargo 构建脚本具有编译进程权限。

## 调度、队列和重启恢复

`SCHEDULER_ENABLED=false` 只停 cron，不停持久队列、聊天、消息队列触发器、文件监听、告警和保留清理。新 cron 的默认时区会写入行，已有调度需逐条修改。误触发宽限不是“停机期间全部补跑”。

RabbitMQ 默认确认期限 1500 秒小于异步上限 1800 秒，创建/更新触发器可能因此拒绝。先把 broker 的 consumer timeout、部署执行上限和确认期限调整为一致的保守预算，再保存；`ack_deadline_override` 表示主动接受长任务尚未结束就重投递的风险，不是延长 broker 限制。消费为至少一次，处理逻辑应幂等。

停止时队列停止认领，后台任务尝试排空；未开始的持久队列行可跨重启保留。已运行脚本不是可恢复进程，崩溃后可能标记 interrupted/failed；外部副作用可能已经发生。重试前按[运行运维](../operations/runs.md)核对。
