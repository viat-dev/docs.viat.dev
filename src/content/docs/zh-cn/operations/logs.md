---
title: 执行日志与诊断证据
description: 查询关联与实时日志，保护捕获的负载，并运维 PostgreSQL、ClickHouse 或 Loki 后端。
doc_id: operations.logs
verified_release: '1.1.0'
channel: stable
---

# 执行日志与诊断证据

项目成员(含 Operator)可读执行日志——但成员资格**不等于**编辑、发布或
取消权限。管理 API 需要平台会话/PAT;端点 API key 或单次运行能力不能
替代。以下命令/DDL **均未执行**;远端后端建表需管理员批准。

## 查询与关联

用控制台的项目日志页或 [CLI 日志](../cli/logs.md)。从调用方拿到
`request_id`——不要混淆执行行 ID、异步 `run_id`、端点 ID 与工作流
`step_id`。

```sh
curl --fail-with-body --get "$BASE/projects/$PROJECT/executions" \
  -H "Authorization: Bearer $TOKEN" \
  --data-urlencode 'limit=50' --data-urlencode 'status_min=500' \
  --data-urlencode 'since=2026-01-01T00:00:00Z'
curl --fail-with-body "$BASE/projects/$PROJECT/executions/$REQUEST_ID" \
  -H "Authorization: Bearer $TOKEN"
```

时间替换为实际事件窗口。要点:

- 列表返回 `{items,next_before}`;过滤支持 `endpoint_id`、`request_id`、
  `status_min`、`status_max`、`since`、`until`、`limit`、`before`、
  `path_eq`、`script`、`script_folder`、`is_test`、`target_kind`、
  `target_ref`。limit 默认 50、范围 1..200;`before` 用返回的
  `RFC3339,UUID` 游标。
- `script_folder=''` 固定根目录;不传则同名脚本可匹配多个文件夹。
- `is_test=false` 选生产日志;`true` **只选测试**——不是"两类都含"。
- 详情返回 `{execution,lines,input,output}`。负载为 null 可能是关闭捕获、
  已清理或该路径不记录——**不一定是请求为空**;错误或流式执行可能没有
  输出。工作流快照路径
  `/projects/PROJECT/executions/REQUEST_ID/workflow_snapshot` 用来看
  **当次记录**,不是今天改过的草稿。

### 搜索与实时日志

```sh
curl --fail-with-body --get "$BASE/projects/$PROJECT/log-lines" \
  -H "Authorization: Bearer $TOKEN" \
  --data-urlencode 'q=fixture' --data-urlencode 'limit=50'
curl --no-buffer --fail-with-body \
  "$BASE/projects/$PROJECT/logs/tail?backfill=20" \
  -H "Authorization: Bearer $TOKEN"
```

- 搜索词去空白后**至少 3 个字符**;支持 `since/until/stream/limit/before`,
  返回 `{items,next_before}`。**仅 PostgreSQL 行日志支持搜索**——选了
  其他后端返回 **409**。
- SSE tail 发送 execution/line 事件与 keepalive;`backfill` 默认 0,可先
  回放有限近期执行;跨节点靠轮询补充本地实时事件。订阅者落后可能丢事件
  ——**重连/tail 不是可靠审计导出**;用历史查询补齐并按 ID 去重。
- 配置好[代理的流式行为](tls-proxy.md),避免缓冲伪装成执行延迟。

## 负载隐私

- 项目 `record_payloads` 决定执行/工作流 I/O 是否捕获;`redact_keys`
  扩充脱敏字段。内置规则把键转小写、去掉连字符/下划线后做**整键匹配**
  (password/token/authorization 等)——**不是**所有敏感子串。
- 超过 **64 KiB** 的捕获值替换为截断标记。脱敏有深度边界:不能自动理解
  任意业务个人数据或自由文本里的秘密。
- 日志 sink 会屏蔽已知资源/调用方秘密,但**不是防外传边界**;部分资源
  对象仍向脚本投射凭据——绝不可打印。
- 做法:用无敏感信息的夹具验证自定义脱敏键;不需要时关闭负载捕获;
  负载保留期应短于摘要。服务端/容器诊断与外部 sink 同样要访问控制与
  轮转。

## PostgreSQL 与外部行日志后端

执行摘要/工作流行**始终**保留在 PostgreSQL。`VIAT_LINE_LOG_BACKEND` 只改
**行日志写入**:不迁移历史、不集成远端历史读取——新的远端行不会自动
出现在 PostgreSQL 的历史详情/搜索里,要用后端原生工具查询;实时流不能
替代持久远端日志。写入尽力而为:失败警告后继续,**没有**保证重放的
spool。

### ClickHouse

有权限的 ClickHouse 管理员先建兼容表(未执行的 DDL,库/表名与保留规则
须审阅):

```sql
CREATE TABLE IF NOT EXISTS line_logs (
    id UUID DEFAULT generateUUIDv4(),
    project_id UUID,
    request_id UUID,
    execution_log_id UUID,
    stream Enum8('stdout'=1, 'stderr'=2, 'structured'=3),
    seq Int32,
    content String,
    step_id Nullable(String),
    created_at DateTime64(6, 'UTC') DEFAULT now64()
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(created_at)
ORDER BY (project_id, execution_log_id, seq);
```

设置 `VIAT_LINE_LOG_BACKEND=clickhouse`、`VIAT_CH_URL`、库/表与配对
Basic auth,见[配置](../configuration/observability.md)。客户端以 HTTP
JSONEachRow 写入,超时 10 秒。采用 HTTPS、仅授 INSERT 的受限权限、独立
TTL/备份;先按执行 ID 找到无敏感夹具再正式使用。

### Loki

配置 `VIAT_LINE_LOG_BACKEND=loki`、基地址 `VIAT_LOKI_URL`、可选配对认证
与 `VIAT_LOKI_TENANT`。writer 自动追加 `/loki/api/v1/push`——URL 里不要
重复。标签:`viat_project`、`viat_stream`、可选 `viat_step_id`;文本含
`exec=EXECUTION_ID seq=NUMBER`。原生查询示例
`{viat_project="PROJECT_UUID"} |= "exec=EXECUTION_ID"`(替换实际 ID)。
租户授权与保留在 Loki 侧配置;Viat 的 PostgreSQL 清理**不会**删远端行。

## 错误与恢复

| 现象 | 处理 |
| --- | --- |
| 切后端后详情/搜索为空 | 先核对**写**后端,不要断定执行摘要丢失 |
| 搜索/游标 400 | 搜索词 ≥3 字符;游标用返回的原始值 |
| 401/403 | 用管理身份与真实项目成员资格,不是运行 API key |
| 近期行缺失 | 查 sink 错误、代理缓冲、订阅落后与外部保留;**没有日志不等于代码没运行** |
| 磁盘满 | 先抑制失控日志源、保存事件证据,再审慎清理;[保留](retention.md)、外部 TTL 与容器轮转**分开**调 |

收集完成后:限制导出文件权限、撤销临时的高日志级别、轮换已泄露凭据。
**不要**把数据库原始错误或业务负载贴进公开报告。
