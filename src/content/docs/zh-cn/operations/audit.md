---
title: 控制面、业务数据与文件访问审计
description: 区分审计存储、权限、归因、查询导出与证据保留责任。
doc_id: operations.audit
verified_release: '1.1.0'
channel: stable
---

# 控制面、业务数据与文件访问审计

审计不是一张表或一种权限——先确认你要回答的问题,再选对入口。普通执行
日志见[日志](logs.md)。所有请求/数据库操作示例**均未执行**;导出可能含
身份、IP 与敏感业务值,必须限制访问与保留。

| 审计 | 存储与内容 | 读取权限 |
| --- | --- | --- |
| 控制面 | 平台 PostgreSQL `audit_logs`:有身份的配置/对象修改——方法、路径、状态、操作者、IP;**不是**通用 body diff | 项目 Owner/Admin 读项目范围;全实例 `/admin/audit` **仅平台 Owner** |
| 业务数据 | postgresql 资源自己的审计表/触发器:行变化、身份、理由、请求关联 | 管理入口任意项目成员;数据面调用需 authz audit 类型的 read 授权 |
| 文件访问 | 平台的文件读取记录,与文件修改/业务元数据独立 | 按其管理/访问接口授权——持有文件链接不等于能看全部记录 |

## 控制面审计

覆盖范围:项目、admin 与用户管理路径的 POST/PUT/PATCH/DELETE,含可归因的
**被拒绝尝试**。**不**记录:每次读取、无身份的匿名噪声、`/auth` 会话
事件、普通 `/p` 数据面请求。不保存通用请求体/diff(个别操作可附刻意
设计的摘要)——因此记录证明"某次操作及其响应",不证明所有下游语义变化,
也不是防篡改的全活动录像。

```sh
curl --fail-with-body --get "$BASE/projects/$PROJECT/audit" \
  -H "Authorization: Bearer $TOKEN" --data-urlencode 'limit=100'
curl --fail-with-body --get "$BASE/admin/audit" \
  -H "Authorization: Bearer $OWNER_TOKEN" --data-urlencode 'limit=100'
```

过滤:`actor` 邮箱、`since` RFC3339、`limit`(默认 100,范围 1..500)与
成对的 `before`/`before_id`。返回 `{entries,next_before?,next_before_id?}`;
翻页须**同时回传两个游标**,缺一返回 400——只按时间翻页会漏行。Admin 或
非平台 Owner 的项目 Owner 访问 `/admin/audit` 得到 403 属预期:平台角色与
项目角色彼此独立。

## 业务数据审计前提

- 仅 `postgresql` 资源支持;完整 audit 块字段见
  [PostgreSQL 资源](../assets/resources/postgresql.md)。
- 资源数据库账号须能:安装审计 schema/表/函数与各表 trigger、查询审计表。
  被审计表必须有主键;名称/忽略列须通过校验。
- **保存 audit 块或显式安装会在业务库执行 DDL**——不是只改平台元数据。
- 与业务库负责人一起规划:备份目标 → 盘点所有非平台写入者 → 选默认
  `unattributed=reject` 还是明确 `record` → 决定每表
  `reason_required`/忽略列。启用 reject 可能使原有外部导入失败——**不要
  上线后才发现**。事后改全局默认不会自动重写已有 trigger:须协调资源并
  验证。
- 理由(attribution):默认取去空白的 UTF-8 `X-Viat-Reason` 头;端点
  `overrides.audit_reason` 可选 `header.NAME`、`body.FIELD`(JSON 字符串
  字段)或 `none`;raw-body 端点不能提取 body 字段。经批准的夹具写入可发
  `X-Viat-Reason: fixture validation`。**是否必需由表策略决定**——不代表
  每个端点都会提供。
- 写路径语义:平台在支持的写路径附加 operator/request/reason,trigger 在
  **同一事务**内强制/记录变化——回滚的事务不会留下已提交审计事件。无
  平台身份的外部写入默认拒绝,显式配置后可记为 unattributed。数据库
  owner/superuser 仍可绕过或修改 trigger:**它不是独立于特权 DBA 的不可变
  账本**。

### 查询与导出

```sh
curl --fail-with-body --get \
  "$BASE/projects/$PROJECT/resources/$RESOURCE/audit" \
  -H "Authorization: Bearer $TOKEN" \
  --data-urlencode 'table=public.samples' --data-urlencode 'limit=100'
```

- 管理查询:资源可选 `folder`,过滤 `table/record_id/operator/request_id/
  since/until/limit/before`;返回 `{items,next_before,limit}`;默认 100、
  上限 `VIAT_AUDIT_QUERY_MAX_ROWS`(1000);`before` 为返回的
  `RFC3339,整数ID`。导出 = 同管理路径追加 `/export`;完整流式导出命令/
  格式见 [CLI 审计](../cli/audit.md)。
- 数据面:`GET /p/PROJECT/_audit/RESOURCE` 及 `/_export` 后缀——用项目
  认证 + authz `audit` 类型的 `read` 动作(属性 `resource`/`table`)。
  **声明类型不会自动授予任何人权限**,必须写明确规则。查询/导出用资源库
  凭据,不是平台库账号。
- 边界:审计表不存在可能返回**空页而非 404**;未配置 audit 的现有
  PostgreSQL 资源也可按默认位置 `public.viat_audit` 查询——所以**空结果
  不能证明每次写入都被审计**。非 PostgreSQL 资源被拒绝。

## 错误、保留与证据

| 现象 | 处理 |
| --- | --- |
| `400 audit_reason_required` | 通过受支持的请求/脚本接口提供理由;不要把删 trigger 当常规绕过 |
| `403 audit_unattributed` | 未附加身份——先确定写入来自平台还是外部导入,再作明确策略决定 |
| DDL/主键/权限失败 | 停止上线,修复目标权限/模式并协调;不要给所有脚本 superuser |
| 资源不可达 | 管理端错误更详细;公开数据面**刻意**隐藏数据库详情——看有权限的内部日志,不靠公开探测 |

保留:`VIAT_RETENTION_AUDIT_DAYS=365` 只管平台控制面;文件读取是
`VIAT_RETENTION_FILE_ACCESS_DAYS=90`;**业务审计的生命周期由资源库另行
管理**——保留证据与 trigger/schema 一致,并纳入业务库备份与隔离恢复。
PostgreSQL 行/导出文件不会自动成为 WORM/签名证据;合规要求使用批准的
外部不可变存储。

导出时:记录范围、时间、过滤条件与游标是否走完;计算完整文件哈希并受限
保存。**截图或一页数据不是完整审计。**清理/恢复前先读
[保留](retention.md)与[备份恢复](backup-restore.md)。
