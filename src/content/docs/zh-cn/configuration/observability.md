---
title: 日志、指标、追踪与保留配置
description: 诊断日志、行日志后端、指标、OTLP、审计、版本历史与保留参数。
doc_id: configuration.observability
verified_release: '1.1.0'
channel: stable
---

# 日志、指标、追踪与保留配置

按[总览](overview.md)理解作用域、默认值与重载；未标记条件必填的项均可选。日志可能含敏感业务数据，监控后端也须控制访问和备份。

| 变量 | 类型；二进制默认值 | 单位、校验、作用域与覆盖 |
| --- | --- | --- |
| `RUST_LOG` | filter; `info` | S。tracing EnvFilter 过滤表达式；非法/未设回退 info。镜像设 info。控制服务端诊断，不是脚本行日志保留。 |
| `VIAT_LOG_SPANS` | switch; off / 关闭 | S。设置为非字面值 0/false 的任何值均开启 span 关闭时的忙/闲耗时日志；空值也开启。 |
| `VIAT_OTLP_ENDPOINT` | URL; unset / 未设置 | S。非空启用 OTLP gRPC span 导出，服务名 viat。初始化失败仅记录并继续，不保证导出。不等于 OTLP/HTTP 或自动导出指标。 |
| `VIAT_METRICS_TOKEN` | string; unset / 未设置 | S。去空白后非空才挂载 /metrics，要求精确 bearer token。未设/空白返回 404，不是开放接口。 |
| `VIAT_LINE_LOG_BACKEND` | enum; `postgres` | S。严格 postgres/clickhouse/loki；空值→postgres，未知值阻止启动。仅选择写入；历史 API 读取仍使用 PostgreSQL。 |
| `VIAT_CH_URL` | URL; unset / 未设置 | S。选择 clickhouse 时必填，HTTP 基地址。启动仅检查配置存在，不会创建远端服务/表。 |
| `VIAT_CH_DB` | string; `default` | S。ClickHouse 数据库标识符，应使用可信简单名称。项目不可覆盖。 |
| `VIAT_CH_TABLE` | string; `line_logs` | S。预创建 ClickHouse 表标识符；运维负责兼容表结构。 |
| `VIAT_CH_USER` | string; unset / 未设置 | S。只有 user/password 同时存在才使用可选 Basic auth；缺一则不使用 Basic auth。 |
| `VIAT_CH_PASSWORD` | string; unset / 未设置 | S。配对 ClickHouse 密码，应使用可信 HTTPS/私网保护传输。 |
| `VIAT_LOKI_URL` | URL; unset / 未设置 | S。选择 loki 时必填，基地址；实现追加 /loki/api/v1/push，不要重复该后缀。 |
| `VIAT_LOKI_USER` | string; unset / 未设置 | S。仅 user/password 同时存在才使用可选 Basic auth。 |
| `VIAT_LOKI_PASSWORD` | string; unset / 未设置 | S。配对 Loki Basic auth 秘密。 |
| `VIAT_LOKI_TENANT` | string; unset / 未设置 | S。可选 X-Scope-OrgID 头，不是 Viat 项目标识或自动租户 ACL。 |
| `VIAT_ALERT_INTERVAL_SECS` | u64; `60` s | S。告警评估周期；解析接受 0，但定时器不支持零。必须至少 1。规则不可覆盖周期。 |
| `VIAT_SCRIPT_HISTORY_KEEP` | i64; `50` versions | D。每脚本保留的被替代版本数，限制为 1..1000。不是天数，也不是发布快照历史。 |
| `VIAT_PUBLISH_REVIAT_KEEP` | i64; `20` revisions | S。准确旧拼写含 REVIAT。解析未强制正数，应使用正数；发布时裁剪。没有 PUBLISH_REVISION_KEEP 别名。 |
| `VIAT_AUDIT_DEFAULT_UNATTRIBUTED` | enum; `reject` | D。去空白且忽略大小写的 record 开启记录；其余→reject。资源 audit 块可覆盖。用于业务表审计，不是控制面 audit_logs。 |
| `VIAT_AUDIT_QUERY_MAX_ROWS` | i64; `1000` rows | D。正数；业务审计查询页/导出批次上限，请求只能降低。不是平台审计页上限（500）。 |
| `VIAT_RETENTION_ENABLED` | boolean; `true` | S。字面值 0 或忽略大小写的 false 关闭清理循环，连同分区维护/过期凭据清理。空值/其他值开启。 |
| `VIAT_RETENTION_INTERVAL_HOURS` | u32; `24` h | S。清理周期，启动后等待完整周期才首次破坏性清理。解析接受 0 但定时器不支持；至少 1。 |
| `VIAT_RETENTION_EXECUTION_DAYS` | u32; `90` days | S。执行摘要保留天数。0 表示立即截止；无项目覆盖。 |
| `VIAT_RETENTION_LINE_DAYS` | u32; `14` days | S。PostgreSQL 行日志按月分区截止，非精确逐行天数。不配置 ClickHouse/Loki TTL。接受 0。 |
| `VIAT_RETENTION_ASYNC_DAYS` | u32; `7` days | S。已结束异步任务行/结果。接受 0；结果不是永久保存。 |
| `VIAT_RETENTION_PAYLOAD_DAYS` | u32; `14` days | S。清除执行输入/输出及工作流步骤 I/O，可保留更长摘要。接受 0。 |
| `VIAT_RETENTION_IM_MESSAGE_DAYS` | u32; `90` days | S。聊天消息账本天数；接受 0。涉及个人/会话数据，不只是诊断日志。 |
| `VIAT_RETENTION_IM_PEER_DAYS` | u32; `180` days | S。按对方无活动时长遗忘 context token，不是创建年龄。接受 0。 |
| `VIAT_RETENTION_AUDIT_DAYS` | u32; `365` days | S。控制面 audit_logs 保留，不是业务库审计表。接受 0，会删除证据。 |
| `VIAT_RETENTION_IDEMPOTENCY_HOURS` | u32; `24` h | S。幂等键/已存响应保留。接受 0；缩短前核对客户端重试窗口。 |
| `VIAT_RETENTION_FILE_ACCESS_DAYS` | u32; `90` days | S。文件读取审计保留。接受 0；应符合证据保留政策。 |

## 三种不同日志

1. 服务端诊断写到进程输出，由 `RUST_LOG`、`VIAT_LOG_SPANS` 控制；容器日志轮转由 Docker/日志采集系统负责，Viat 的保留循环不控制它。
2. 执行摘要、工作流步骤及异步状态在平台 PostgreSQL；stdout/stderr/structured 行日志可选写入 PostgreSQL、ClickHouse 或 Loki。
3. 控制面审计记录谁修改了配置；业务表审计记录行级变化；文件访问审计记录读取。它们不是执行日志的同义词。

日志读取与定位见[运行](../operations/runs.md)、[日志](../operations/logs.md)、[审计](../operations/audit.md)。

## 先保护指标，再配置采集

```dotenv
VIAT_METRICS_TOKEN=REPLACE_WITH_RANDOM_SCRAPE_TOKEN
RUST_LOG=info
VIAT_LOG_SPANS=1
VIAT_OTLP_ENDPOINT=http://otel-collector:4317
```

示例未执行。只向可信监控网络开放指标；采集器以 `Authorization: Bearer TOKEN` 访问 `/metrics`。未配置 token 返回 404，错误 token 返回 401。`/healthz` 与 `/readyz` 不需要该 token；它们不报告所有业务能力健康。采集 token 不授予项目管理权限。

OTLP 为 gRPC spans，不是日志后端或 `/metrics` 的替代，也不保证收集器已落盘。初始化错误不会阻止服务启动。按需配置收集器网络和认证边界，不要以不存在的 Viat 专用 OTLP 用户/密码变量编造能力。SDK 自身的标准 `OTEL_*` 行为属于依赖库配置，需按实际导出器验证。

## 更换行日志后端之前

默认 PostgreSQL 支持控制台/CLI/API 历史读取和全文片段搜索。切到 ClickHouse/Loki 仅改变行日志**写入**，不会迁移旧数据、不会自动创建远端表或配置远端保留；历史读取仍指向 PostgreSQL，新行应使用后端原生工具查询。搜索 API 在非 PostgreSQL 模式返回 409。

非 PostgreSQL 写入为尽力而为；远端不可达时警告并继续，**不是可靠投递队列**。完整配置存在不表示凭据、表结构和存储可用。先在隔离项目验证发送一条无敏感数据的 fixture 日志、在目标后端检索到，再切生产。建表范例和 Loki 标签见[日志运维](../operations/logs.md)。

## 保留与历史的安全含义

清理循环默认启动时创建当前和未来五个月的 PostgreSQL 行日志分区，首次破坏性清理等一个周期。行日志通过删除整个旧月分区回收，不精确等于 14 天；还会保留跨越截止日期的月份。执行和审计按批次清理。降低期限不会等待新的“宽限期”，下次清理即可删除已经超龄的数据，增大期限不能恢复被删内容。

关闭保留也会关闭这条循环承担的分区维护和过期凭据等清理，不能当作无代价的长期存储策略。脚本历史按数量、发布历史按 revision 数量清理；都不是法规归档。完整策略、外部后端 TTL 与合规导出见[保留运维](../operations/retention.md)。
