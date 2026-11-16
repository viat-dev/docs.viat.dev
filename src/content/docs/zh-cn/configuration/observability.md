---
title: 日志、指标、追踪与保留配置
description: 诊断日志、行日志后端、指标、OTLP、审计、版本历史与保留参数。
doc_id: configuration.observability
verified_release: '1.1.0'
channel: stable
---

# 日志、指标、追踪与保留配置

按[总览](overview.md)理解作用域、默认值与重载;未标条件必填的项均可选。
日志可能含敏感业务数据——监控后端同样要管好访问与备份。

| 变量 | 类型;二进制默认值 | 单位、校验、作用域与覆盖 |
| --- | --- | --- |
| `RUST_LOG` | filter; `info` | S。tracing EnvFilter 过滤表达式;非法/未设回退 info(镜像设 info)。控制服务端**诊断**日志,不是脚本行日志保留。 |
| `VIAT_LOG_SPANS` | switch; 关闭 | S。设为非字面 `0`/`false` 的**任何值**(含空值)都开启 span 关闭时的忙/闲耗时日志。 |
| `VIAT_OTLP_ENDPOINT` | URL; 未设置 | S。非空启用 OTLP **gRPC span** 导出(服务名 viat)。初始化失败只记录并继续,不保证导出。不等于 OTLP/HTTP,也不自动导出指标。 |
| `VIAT_METRICS_TOKEN` | string; 未设置 | S。去空白后非空才挂载 `/metrics`,要求精确 bearer token。未设/空白返回 404——**不是开放接口**。 |
| `VIAT_LINE_LOG_BACKEND` | enum; `postgres` | S。严格 `postgres`/`clickhouse`/`loki`;空值→postgres,未知值阻止启动。只选**写入**;历史 API 读取仍走 PostgreSQL。 |
| `VIAT_CH_URL` | URL; 未设置 | S。选 clickhouse 时**必填**,HTTP 基地址。启动只检查配置存在,不创建远端服务/表。 |
| `VIAT_CH_DB` | string; `default` | S。ClickHouse 数据库标识符,用可信的简单名称。项目不可覆盖。 |
| `VIAT_CH_TABLE` | string; `line_logs` | S。预创建的表标识符;表结构兼容由运维负责。 |
| `VIAT_CH_USER` | string; 未设置 | S。仅 user/password **同时存在**才用可选 Basic auth;缺一个就不启用。 |
| `VIAT_CH_PASSWORD` | string; 未设置 | S。配对密码;传输用可信 HTTPS/私网保护。 |
| `VIAT_LOKI_URL` | URL; 未设置 | S。选 loki 时**必填**,基地址;实现会追加 `/loki/api/v1/push`——不要再带该后缀。 |
| `VIAT_LOKI_USER` | string; 未设置 | S。仅 user/password 同时存在才用 Basic auth。 |
| `VIAT_LOKI_PASSWORD` | string; 未设置 | S。配对 Basic auth 秘密。 |
| `VIAT_LOKI_TENANT` | string; 未设置 | S。可选 `X-Scope-OrgID` 头;**不是** Viat 项目标识,也不自动做租户 ACL。 |
| `VIAT_ALERT_INTERVAL_SECS` | u64; `60` 秒 | S。告警评估周期;解析接受 0 但定时器不支持——至少为 1。规则不能覆盖周期。 |
| `VIAT_SCRIPT_HISTORY_KEEP` | i64; `50` 版本 | D。每脚本保留的被替代版本数,夹在 1..1000。**不是天数**,也不是发布快照历史。 |
| `VIAT_PUBLISH_REVIAT_KEEP` | i64; `20` 个 revision | S。准确旧拼写含 REVIAT。解析未强制正数——请用正数;发布时裁剪。没有 `PUBLISH_REVISION_KEEP` 别名。 |
| `VIAT_AUDIT_DEFAULT_UNATTRIBUTED` | enum; `reject` | D。去空白、忽略大小写的 `record` 开启记录;其余→reject。资源 audit 块可覆盖。用于**业务表审计**,不是控制面 audit_logs。 |
| `VIAT_AUDIT_QUERY_MAX_ROWS` | i64; `1000` 行 | D。正数;业务审计查询分页/导出批次上限,请求只能更低。**不是**平台审计页上限(500)。 |
| `VIAT_RETENTION_ENABLED` | boolean; `true` | S。字面 `0` 或忽略大小写的 `false` 关闭清理循环——**连同**分区维护/过期凭据清理。空值/其他值开启。 |
| `VIAT_RETENTION_INTERVAL_HOURS` | u32; `24` 小时 | S。清理周期;启动后等**完整一个周期**才首次破坏性清理。解析接受 0 但定时器不支持;至少 1。 |
| `VIAT_RETENTION_EXECUTION_DAYS` | u32; `90` 天 | S。执行摘要保留天数;0 = 立即截止;无项目覆盖。 |
| `VIAT_RETENTION_LINE_DAYS` | u32; `14` 天 | S。PostgreSQL 行日志按**月分区**截止,不是精确逐行天数;不配置 ClickHouse/Loki 的 TTL。接受 0。 |
| `VIAT_RETENTION_ASYNC_DAYS` | u32; `7` 天 | S。已结束异步任务的行/结果;接受 0——结果不是永久保存。 |
| `VIAT_RETENTION_PAYLOAD_DAYS` | u32; `14` 天 | S。清除执行输入/输出与工作流步骤 I/O,摘要可更长;接受 0。 |
| `VIAT_RETENTION_IM_MESSAGE_DAYS` | u32; `90` 天 | S。聊天消息账本天数;接受 0。涉及个人/会话数据,不只是诊断日志。 |
| `VIAT_RETENTION_IM_PEER_DAYS` | u32; `180` 天 | S。按**对方无活动时长**遗忘 context token,不是创建年龄;接受 0。 |
| `VIAT_RETENTION_AUDIT_DAYS` | u32; `365` 天 | S。控制面 audit_logs 保留——不是业务库审计表;接受 0(会删证据)。 |
| `VIAT_RETENTION_IDEMPOTENCY_HOURS` | u32; `24` 小时 | S。幂等键/已存响应保留;接受 0。缩短前核对客户端重试窗口。 |
| `VIAT_RETENTION_FILE_ACCESS_DAYS` | u32; `90` 天 | S。文件读取审计保留;接受 0,应符合证据保留政策。 |

## 三种不同的"日志"

1. **服务端诊断**写进程输出,由 `RUST_LOG`/`VIAT_LOG_SPANS` 控制;容器
   日志轮转归 Docker/采集系统,Viat 的保留循环不管它。
2. **执行产物**:执行摘要、工作流步骤与异步状态在平台 PostgreSQL;
   stdout/stderr/structured 行日志可选写入 PostgreSQL、ClickHouse 或
   Loki。
3. **审计**:控制面审计记录"谁改了配置";业务表审计记录行级变化;文件
   访问审计记录读取——它们不是执行日志的同义词。

日志读取与定位:[运行](../operations/runs.md)、[日志](../operations/logs.md)、
[审计](../operations/audit.md)。

## 先保护指标,再配置采集

```dotenv
VIAT_METRICS_TOKEN=REPLACE_WITH_RANDOM_SCRAPE_TOKEN
RUST_LOG=info
VIAT_LOG_SPANS=1
VIAT_OTLP_ENDPOINT=http://otel-collector:4317
```

示例未执行。要点:

- 只向可信监控网络开放指标;采集器带 `Authorization: Bearer TOKEN` 访问
  `/metrics`。未配 token 返回 404,错误 token 返回 401;`/healthz` 与
  `/readyz` 不需要 token——但它们不报告所有业务能力健康。采集 token
  **不授予**项目管理权限。
- OTLP 是 gRPC spans:不是日志后端、不是 `/metrics` 的替代,也不保证
  收集器已落盘;初始化错误不阻止启动。按需配置收集器网络与认证边界;
  **不要**虚构"Viat 专用 OTLP 用户/密码变量"。依赖库自身的标准
  `OTEL_*` 行为属依赖配置,按实际导出器验证。

## 更换行日志后端之前

- 默认 PostgreSQL 支持**控制台/CLI/API 历史读取与全文片段搜索**。切到
  ClickHouse/Loki 只改行日志**写入**:不迁移旧数据、不自动建远端表、
  不配置远端保留;历史读取仍指向 PostgreSQL,新行要用后端原生工具查询;
  搜索 API 在非 PostgreSQL 模式返回 **409**。
- 非 PostgreSQL 写入是**尽力而为**:远端不可达时警告并继续,不是可靠
  投递队列;"配置存在"不代表凭据、表结构与存储可用。
- 上线前先在隔离项目验证:发一条无敏感数据的 fixture 日志 → 在目标
  后端检索到 → 再切生产。建表范例与 Loki 标签见
  [日志运维](../operations/logs.md)。

## 保留与历史的安全含义

- 清理循环启动时创建当前及未来五个月的 PostgreSQL 行日志分区;**首次
  破坏性清理等一个周期**。行日志按删除整个旧月分区回收——不精确等于
  14 天,还会保留跨越截止日的整月。
- 执行与审计按批清理。**降低期限不等宽限期**:下次清理即删除已超龄
  数据;增大期限**不能恢复**已删内容。
- 关闭保留(`VIAT_RETENTION_ENABLED=false`)会连同分区维护、过期凭据
  清理一起关——不是无代价的长期存储策略。
- 脚本历史按数量、发布历史按 revision 数量清理;**都不是法规归档**。
  完整策略、外部后端 TTL 与合规导出见[保留运维](../operations/retention.md)。
