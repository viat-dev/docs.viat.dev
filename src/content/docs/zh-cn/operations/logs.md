---
title: 执行日志与诊断证据
description: 查询关联与实时日志，保护捕获的负载，并运维 PostgreSQL、ClickHouse 或 Loki 后端。
doc_id: operations.logs
verified_release: '1.1.0'
channel: stable
---

# 执行日志与诊断证据

包括 Operator 在内的项目成员可读执行日志；成员资格不等于编辑、发布或取消权限。管理 API 需要平台会话/PAT，端点 API key/单运行能力不能代替。以下命令/DDL **均未执行**；远端后端建表需要管理员批准。

## 查询与关联

使用控制台项目日志或 [CLI 日志](../cli/logs.md)。从调用方获取 `request_id`，不要混淆执行行 ID、异步 `run_id`、端点 ID 与工作流 `step_id`。

```sh
curl --fail-with-body --get "$BASE/projects/$PROJECT/executions" \
  -H "Authorization: Bearer $TOKEN" \
  --data-urlencode 'limit=50' --data-urlencode 'status_min=500' \
  --data-urlencode 'since=2026-01-01T00:00:00Z'
curl --fail-with-body "$BASE/projects/$PROJECT/executions/$REQUEST_ID" \
  -H "Authorization: Bearer $TOKEN"
```

时间应替换为实际事件窗口。列表返回 `{items,next_before}`；支持 `endpoint_id`、`request_id`、`status_min`、`status_max`、`since`、`until`、`limit`、`before`、`path_eq`、`script`、`script_folder`、`is_test`、`target_kind`、`target_ref`。limit 默认 50、范围 1..200；before 使用返回的 `RFC3339,UUID` 游标。`script_folder=''` 固定根目录，未传则同名可匹配多个文件夹。`is_test=false` 选生产日志，`true` **只选测试**，不是包含两类。

详情返回 `{execution,lines,input,output}`。负载 null 可表示关闭捕获、已清理或该路径不记录，不一定是请求为空。错误或流式执行可能没有输出。工作流快照路径为 `/projects/PROJECT/executions/REQUEST_ID/workflow_snapshot`，用于查看当次记录，不是今天已经修改的草稿。

### 搜索与实时日志

```sh
curl --fail-with-body --get "$BASE/projects/$PROJECT/log-lines" \
  -H "Authorization: Bearer $TOKEN" \
  --data-urlencode 'q=fixture' --data-urlencode 'limit=50'
curl --no-buffer --fail-with-body \
  "$BASE/projects/$PROJECT/logs/tail?backfill=20" \
  -H "Authorization: Bearer $TOKEN"
```

搜索去空白后至少三字符，支持 `since`、`until`、`stream`、`limit`、`before`，返回 `{items,next_before}`。仅支持 PostgreSQL 行日志，其他选定后端返回 **409**。SSE tail 发送 execution/line 事件和 keepalive；backfill 默认 0，可先给有限近期执行。跨节点轮询补充本地实时事件。订阅者落后可能丢事件，重连/tail 不是可靠审计导出。通过历史查询补齐并按 ID 去重。配置[代理流式行为](tls-proxy.md)，避免缓冲伪装成执行延迟。

## 负载隐私

项目 `record_payloads` 决定执行/工作流 I/O 捕获，`redact_keys` 扩充脱敏字段。内置规则将键转小写并去掉连字符/下划线后，**整键匹配** password/token/authorization 等，不是所有敏感子串。超过 **64 KiB** 的捕获值替换为截断标记。脱敏有深度边界，不能自动理解任意业务个人数据或自由文本内秘密。

日志 sink 会屏蔽已知资源/调用方秘密，但不是防外传边界。部分资源对象仍向脚本投射凭据，绝不可打印。用无敏感信息夹具验证自定义脱敏键；不需要时关闭负载捕获，负载期限应短于摘要。服务端/容器诊断和外部 sink 也需访问控制与轮转。

## PostgreSQL 与外部行日志后端

执行摘要/工作流行保留在 PostgreSQL。`VIAT_LINE_LOG_BACKEND` 只改变**行日志写入**，不自动迁移历史，不集成远端历史读取。新远端行不会自动出现在 PostgreSQL 历史详情/搜索。应使用后端原生工具，实时流不能替代持久远端日志。写入尽力而为，失败警告后继续，没有保证重放的 spool。

### ClickHouse

有权限的 ClickHouse 管理员先建立兼容表（未执行 DDL，数据库/表名及保留规则须审阅）：

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

设置 `VIAT_LINE_LOG_BACKEND=clickhouse`、`VIAT_CH_URL`、数据库/表和配对 Basic auth，参见[配置](../configuration/observability.md)。客户端以 HTTP JSONEachRow 写入，超时 10 秒。采用 HTTPS、受限 INSERT 权限、独立 TTL/备份；先按执行 ID 找到无敏感夹具，再正式使用。

### Loki

配置 `VIAT_LINE_LOG_BACKEND=loki`、基地址 `VIAT_LOKI_URL`、可选配对认证和 `VIAT_LOKI_TENANT`。writer 追加 `/loki/api/v1/push`，不要重复。标签为 `viat_project`、`viat_stream` 和可选 `viat_step_id`；文本含 `exec=EXECUTION_ID seq=NUMBER`。原生查询示例 `{viat_project="PROJECT_UUID"} |= "exec=EXECUTION_ID"`，应替换实际 ID。租户授权和保留在 Loki 配置，Viat 的 PostgreSQL 清理不删除远端行。

## 错误与恢复

- 切后端后详情/搜索为空：先核对写后端，不要认定执行摘要丢失。
- 搜索/游标 400：使用至少三字符和返回的原始游标。
- 401/403：使用管理身份与实际项目成员资格，不是运行 API key。
- 近期行缺失：排查 sink 错误、代理缓冲、订阅落后及外部保留；没有日志不能证明代码未运行。
- 磁盘满：先抑制失控日志源、保存事件证据，再审慎清理；[保留](retention.md)、外部 TTL 和容器轮转分开调。

收集完成后限制导出文件权限，撤销临时高日志级别，泄露的凭据要轮换。不要把数据库原始错误或业务负载贴入公开报告。
