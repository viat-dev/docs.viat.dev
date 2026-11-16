---
title: "回滚与取消发布"
description: "恢复旧端点快照或撤销当前项目发布 revision，不把它误称为数据回滚。"
doc_id: publishing.rollback
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.publish.rollback", "cli.publish.history", "cli.publish.show", "cli.endpoint.rollback", "cli.endpoint.unpublish"]
---

# 回滚与取消发布

回滚做的事只有一件:**把路由指针拨回一份已存在的不可变快照**。它不是源码
checkout、不是数据库回滚、不是撤回消息,也不恢复用户/资源/秘密。

两个 rollback API 与端点 history/unpublish 都需要项目 Owner/Admin 发布权;
项目 revision history/show 只需成员。两个作用域(单端点/整项目)不能混用。

> [!WARNING]
> 回滚立即改变调用者执行的内容,并可能 warm worker、reload 路由。真实回滚、
> smoke 与外部清理须明确授权。本页示例源码推导、未执行。

## 先选对恢复范围

| 需求 | 入口 | 精确行为 |
| --- | --- | --- |
| 停止一个叶子的新调用 | `POST /projects/<slug>/endpoints/<id>/unpublish` | 清除 active 指针、保留历史;内置 auth 叶拒绝。 |
| 恢复该叶子的上一版本 | `POST …/endpoints/<id>/rollback` | 选择**小于当前 active version 的最大快照版本**;不接受任意 version/id;需存在适用的 active/history。 |
| 撤销最近一次项目发布 | `POST /projects/<slug>/publish/rollback` | 锁定最新未回滚的项目 revision,恢复其中每项的 before 指针;首次发布 before=null 会变成取消发布。 |

rollback 不需要 body、version、id、warning 豁免或测试预期。省略 body 或
body 为 null 不代表"任选历史版本"——选择规则由路由决定。没有
`publish rollback <revision-id>`,也没有按 snapshot 的正向 promote API;
`viat publish show <id-or-prefix>` 是只读的。

## 改流量前先读取

`GET /projects/<slug>/publish/history?limit=20&offset=0` 返回
`project_slug/total/limit/offset/revisions`(limit 夹在 1–100,offset ≥ 0)。
revision 含
`id,created_at,created_by_email,endpoint_count,rolled_back_at,rolled_back_by_email,summary`。

`GET …/publish/revisions/<uuid-or-prefix>` 返回
`id,project_slug,created_at,created_by_email,rolled_back_at,rolled_back_by_email,endpoints,warnings?`
(无 warning 时省略该字段);端点项含
`node_id,method,path,before_snapshot_id,before_snapshot_version,after_snapshot_id,after_snapshot_version,target_kind,target_name`。
前缀必须项目内唯一:歧义返回 400,未知返回 404。

`GET …/endpoints/<id>/history` 返回完整 [SnapshotView](snapshots.md) 数组,
不含源码 blob。对比 active 的 id/path/method/target 版本后再动手;history 与
plan 都不是流量锁——先协调操作者,暂停并发的发布/编辑自动化。

## 完整项目示例

```http
POST /projects/demo/publish/rollback
Authorization: Bearer <console-token>
Content-Type: application/json

{}
```

```json
{"project_slug":"demo","revision_id":"00000000-0000-4000-8000-000000000010","rolled_back_count":1,"endpoints":[{"id":"00000000-0000-4000-8000-000000000001","method":"GET","path":"/hello","restored_snapshot_id":"00000000-0000-4000-8000-000000000003","restored_snapshot_version":1}]}
```

服务端会标记该 revision 已回滚、刷新 registry、清除受影响缓存代次并对账
worker pool。`restored_*` 为 null 表示取消发布,不是删除;无可回滚项返回
400。

> [!WARNING]
> 重复成功的项目 rollback 会继续撤销**更旧的下一个 active revision**——它
> **不幂等**。丢失响应时先查 history/current 指针再决定,不要盲重试;管理
> 路由没有 Idempotency-Key 契约。

单端点 `POST /projects/demo/endpoints/<id>/rollback {}` 直接返回
SnapshotView:

```json
{"id":"00000000-0000-4000-8000-000000000003","node_id":"00000000-0000-4000-8000-000000000001","version":1,"method":"GET","path_pattern":"/hello","target_kind":"script","script_name":"echo","script_version":1,"workflow_name":null,"workflow_version":null,"proxy_resource_name":null,"created_by":"00000000-0000-4000-8000-000000000004","created_at":"2026-11-06T00:00:00Z"}
```

它选择旧快照而不是创建新快照,随后 reload 并使缓存失效。恢复时按**当前**
角色/能力重新校验 project_users_grant/current_user_grant——历史上有效不
保证今天仍有效。项目 rollback 是另一条批量指针恢复路径:它**不**执行单端点
publish 那套 grant/回归检查,恢复后应显式复查安全绑定与当前策略;rollback
不运行保存用例的发布门禁。

## 无法保证的恢复

- **草稿仍是草稿**,不会被重写成历史源码;之后 apply 可能重新发布你不想要
  的 dirty 草稿——检查 plan,修仓库/草稿。
- 普通冻结依赖图随快照恢复;含 `(live)` 的图与 **workflow step uses(含嵌套)**
  仍为 live,恢复主源码不恢复它们。
- 资源凭据/配置、authorizer、授权规则/用户、数据库 schema/数据、触发器都
  保持当前状态;旧脚本可能与新 schema 不兼容。
- 在途 HTTP/async 保留已接受的 payload;现有 WS 与已发消息的效果不构成全局
  事务切换——rollback/超时/取消都不撤销已提交的写入或已发出的消息。
- 项目 revision 历史按配置保留(默认 20 条),与快照的持久保存不同;删除端点
  不会因旧 revision 自动重建。草稿 export 不是快照历史或业务数据备份。

## CLI、验证与清理

```sh
viat publish history --limit 20 --offset 0 --json
viat publish show 00000000-0000-4000-8000-000000000010 --json
viat publish rollback --yes --json
viat endpoint rollback 00000000-0000-4000-8000-000000000001
```

这些是**互相替代**的操作,不是按顺序一起执行。项目 rollback 不带
`--yes/--json` 会交互确认,拒绝也可能 exit 0;端点 rollback 没有 revision
参数。完整 flags 见 [CLI publish](../cli/publish.md) 与
[endpoint](../cli/endpoint.md)。

成功后核对:指针/版本、build/env、允许与拒绝的调用者、公开 path/method、
各实例缓存新鲜度。超时不要自动重试——响应可能在丢失前已提交。旧快照与今日
资源/schema 不兼容时,先 unpublish 阻止新流量,修好兼容配置/代码后再有意
发布。重新启用触发器或重放任务需要另外授权。

测试环境的清理:drain 之后取消发布/删除,保留恢复与审计证据;不要靠删除
生产快照/日志来掩盖失败。

## 核验依据

契约源码 `03751a67`:`crates/viat-api/src/handlers/{publish,snapshots}.rs`;`crates/viat-db/src/{revisions,snapshots}.rs`(before=null 与指针回滚测试);`crates/viat-core/src/types/snapshot.rs`;CLI 发布/端点实现。未执行回滚、构建、测试或供应商动作。
