---
title: 控制面、业务数据与文件访问审计
description: 区分审计存储、权限、归因、查询导出与证据保留责任。
doc_id: operations.audit
verified_release: '1.1.0'
channel: stable
---

# 控制面、业务数据与文件访问审计

审计不是一张表或一种权限。先确认要回答的问题；普通执行日志参见[日志](logs.md)。所有请求/数据库操作示例**均未执行**。导出可能含身份、IP 和敏感业务值，必须限制访问与保留。

| 审计 | 存储与内容 | 读取权限 |
| --- | --- | --- |
| 控制面 | 平台 PostgreSQL `audit_logs`：有身份的配置/对象修改，方法、路径、状态、操作者、IP，不是通用 body diff | 项目 Owner/Admin 读项目范围；全实例 `/admin/audit` **仅平台 Owner** |
| 业务数据 | postgresql 资源自己的审计表/触发器：行变化、身份、理由、请求关联 | 管理入口任意项目成员；数据面调用需 authz audit 类型的 read 授权 |
| 文件访问 | 平台文件读取记录，与文件修改/业务元数据独立 | 按其管理/访问接口授权，不因持有文件链接而公开所有记录 |

## 控制面审计

修改层覆盖项目、admin、用户管理路径的 POST/PUT/PATCH/DELETE，包括可归因的被拒绝尝试。**不**记录每次读取、无身份匿名噪声、`/auth` 会话事件或普通 `/p` 数据面请求。不保存通用请求体/diff，个别操作可附刻意设计的摘要。因此记录说明某次操作及响应，不证明所有下游语义变化，也不是防篡改全活动录像。

```sh
curl --fail-with-body --get "$BASE/projects/$PROJECT/audit" \
  -H "Authorization: Bearer $TOKEN" --data-urlencode 'limit=100'
curl --fail-with-body --get "$BASE/admin/audit" \
  -H "Authorization: Bearer $OWNER_TOKEN" --data-urlencode 'limit=100'
```

过滤字段：`actor` 邮箱、`since` RFC3339、`limit`（默认 100，范围 1..500）及成对 `before`/`before_id`。返回 `{entries,next_before?,next_before_id?}`，下一页须同时回传两个游标，缺一返回 400；只按时间翻页会漏行。Admin 或非平台 Owner 的项目 Owner 访问 `/admin/audit` 返回 403 是预期。平台/项目角色彼此不同。

## 业务数据审计前提

仅 `postgresql` 资源支持，完整 audit 块字段见 [PostgreSQL 资源](../assets/resources/postgresql.md)。资源数据库账号须可安装审计 schema/表/函数及各表 trigger，并查询审计表。被审计表必须有主键，名称/忽略列须通过校验。保存 audit 块或显式安装会在业务库执行 DDL，**不是只改平台元数据**。

与业务库负责人一起规划：备份目标、盘点所有非平台写入者、选择默认 `unattributed=reject` 或明确 `record`，并决定每表 `reason_required`/忽略列。启用 reject 可使原有外部导入失败，不能上线后才发现。事后改全局默认不会自动重写已有 trigger，须协调资源并验证。

默认理由来自去空白的 UTF-8 `X-Viat-Reason` 头。端点 `overrides.audit_reason` 可选 `header.NAME`、`body.FIELD`（JSON 字符串字段）或 `none`；raw-body 不能提取 body 字段。经批准的夹具写入可发送 `X-Viat-Reason: fixture validation`。是否必需由表策略决定，不代表每个端点都会提供。

平台在支持的写路径附加 operator/request/reason，触发器在同事务强制/记录变化。回滚事务不会成为已提交审计事件。无平台身份的外部写入默认拒绝，显式配置后可记为 unattributed。数据库 owner/superuser 仍可绕过或修改 trigger；它不是独立于特权 DBA 的不可变账本。

### 查询与导出

```sh
curl --fail-with-body --get \
  "$BASE/projects/$PROJECT/resources/$RESOURCE/audit" \
  -H "Authorization: Bearer $TOKEN" \
  --data-urlencode 'table=public.samples' --data-urlencode 'limit=100'
```

管理查询支持资源可选 `folder`，以及 `table`、`record_id`、`operator`、`request_id`、`since`、`until`、`limit`、`before`，返回 `{items,next_before,limit}`。默认 100，上限 `VIAT_AUDIT_QUERY_MAX_ROWS`（1000）；before 为返回的 `RFC3339,整数ID`。导出为同管理路径追加 `/export`；完整流式导出命令/格式见 [CLI 审计](../cli/audit.md)。

数据面对应 `GET /p/PROJECT/_audit/RESOURCE` 及 `/_export` 后缀，使用项目认证和 authz `audit` 类型的 `read` 动作，属性 `resource`/`table`。声明类型不会自动授予任何人权限，必须写明确规则。查询/导出使用资源库凭据，而非平台库账号。

审计表不存在可能返回空页而非 404；未配置 audit 的现有 PostgreSQL 资源也可按默认位置 `public.viat_audit` 查询。空结果不能证明每次写入都已审计。非 PostgreSQL 资源会被拒绝。

## 错误、保留与证据

- `400 audit_reason_required`：通过受支持请求/脚本接口提供理由，不要把删 trigger 当常规绕过。
- `403 audit_unattributed`：没有附加身份，先确定写入来自平台还是外部导入，再作明确策略决定。
- DDL、主键或权限失败：停止上线，修复目标权限/模式并协调，不要给所有脚本 superuser。
- 资源不可达：管理错误可更详细，公开数据面刻意隐藏数据库详情。看有权限的内部日志，不靠公开探测。

`VIAT_RETENTION_AUDIT_DAYS=365` 只控制平台控制面，不控制外部业务表；文件读取为 `VIAT_RETENTION_FILE_ACCESS_DAYS=90`。业务审计生命周期由资源库另行管理，保留证据与 trigger/schema 一致性。纳入业务库备份及隔离恢复。PostgreSQL 行/导出文件不会自动成为 WORM/签名证据，合规要求应使用批准的外部不可变存储。

导出时记录范围、时间、过滤条件及游标是否完成，计算完整文件哈希并受限保存。截图或一页数据不是完整审计。清理/恢复前阅读[保留](retention.md)与[备份恢复](backup-restore.md)。
