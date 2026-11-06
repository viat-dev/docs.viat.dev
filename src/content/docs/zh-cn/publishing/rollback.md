---
title: "回滚与取消发布"
description: "恢复旧端点快照或撤销当前项目发布 revision，不把它误称为数据回滚。"
doc_id: publishing.rollback
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.publish.rollback", "cli.publish.history", "cli.publish.show", "cli.endpoint.rollback", "cli.endpoint.unpublish"]
---

# 回滚与取消发布

回滚恢复**指向已有不可变快照的路由指针**，不是源码 checkout、DB rollback、消息撤回、触发器回滚，也不恢复用户/资源/秘密。两个 rollback API 及端点 history/unpublish 都需项目 Owner/Admin 发布权，项目 revision history/show 只需成员。两个作用域不能混淆。

示例源码推导未执行；操作改变调用者执行内容，并可 warm worker/reload 路由，真实回滚/smoke/外部清理须明确授权。

## 选择恢复范围

| 需求 | 入口 | 精确范围 |
| --- | --- | --- |
| 停止一个叶子新调用 | `POST /projects/<slug>/endpoints/<id>/unpublish` | 清 active pointer、留历史，内置 auth 叶拒绝。 |
| 恢复该叶前一版本 | `POST …/endpoints/<id>/rollback` | 选择**比当前 active version 小**的最大快照版本，不接受任意 version/id；需有适用 active/history。 |
| 撤销最新 active 发布 revision | `POST /projects/<slug>/publish/rollback` | 锁最新未回滚项目 revision，恢复其中每项 before pointer；首次发布 before=null 会取消发布。 |

rollback 不需要 body/version/id/warning ack/测试预期。省略/null body 不代表任选历史 release，选择由路由决定。没有 `publish rollback <revision-id>` 或按 snapshot 正向 promote API；`viat publish show <id-or-prefix>` 只读取。

## 改流量前先读取

`GET /projects/<slug>/publish/history?limit=20&offset=0` 返回 project_slug/total/limit/offset/revisions，limit 夹到 1–100，offset >=0。revision 含 `id,created_at,created_by_email,endpoint_count,rolled_back_at,rolled_back_by_email,summary`。`GET …/publish/revisions/<uuid-or-prefix>` 返回 `id,project_slug,created_at,created_by_email,rolled_back_at,rolled_back_by_email,endpoints,warnings?`，无 warning 时省略；端点项含 `node_id,method,path,before_snapshot_id,before_snapshot_version,after_snapshot_id,after_snapshot_version,target_kind,target_name`。前缀需项目内唯一，歧义 400，未知 404。

`GET …/endpoints/<id>/history` 返回完整 [SnapshotView](snapshots.md) 数组，不含源码 blob。先比 active id/path/method/target version；history/plan 不是流量锁，应协调操作者并停止并发发布/编辑自动化。

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

标记 revision 已回滚、刷新 registry、清受影响 cache 代次、对账 worker pool。restored id/version null 表示取消发布，不是删除；无可回滚返回 400。重复成功的项目 rollback 可继续撤销**更旧的下一 active revision**，因此**不幂等**。丢响应先查 history/current pointer，不能盲重试，管理路由无 Idempotency-Key 契约。

单端点 `POST /projects/demo/endpoints/<id>/rollback {}` 直接返回 SnapshotView：

```json
{"id":"00000000-0000-4000-8000-000000000003","node_id":"00000000-0000-4000-8000-000000000001","version":1,"method":"GET","path_pattern":"/hello","target_kind":"script","script_name":"echo","script_version":1,"workflow_name":null,"workflow_version":null,"proxy_resource_name":null,"created_by":"00000000-0000-4000-8000-000000000004","created_at":"2026-11-06T00:00:00Z"}
```

选择旧快照而非创建新快照，reload 并使缓存失效；会按当前角色/能力限制重查恢复的 project_users_grant/current_user_grant，历史有效不足以保证今日有效。项目 rollback 是另一个批量指针恢复路径，不承诺执行全部单端点 publish/grant/回归检查，应显式复查恢复的安全绑定与当前 policy；rollback 不运行保存用例发布门禁。

## 无法保证的恢复

- 草稿仍是草稿，不被重写成历史源码；之后 apply 可能重新发布不想要的 dirty 草稿，应检查 plan、修仓库/草稿。
- 普通冻结依赖图随快照恢复；含 `(live)` 的图及 **workflow step uses（含嵌套）**仍 live，恢复主源码不恢复它们。
- 资源凭据/配置、authorizer、授权规则/用户、DB schema/data、触发器保持当前。旧脚本可与新 schema 不兼容。
- 在途 HTTP/async 保留已接受 payload，现有 WS/当前消息效果不构成全局事务切换；rollback/timeout/cancel 不撤销提交写入/已发消息。
- 项目 revision 历史按配置保留（默认 20），与 snapshot 持久保存不同；删除端点不会因旧 revision 自动重建。草稿 export 不是快照历史/业务数据备份。

## CLI、验证与清理

```sh
viat publish history --limit 20 --offset 0 --json
viat publish show 00000000-0000-4000-8000-000000000010 --json
viat publish rollback --yes --json
viat endpoint rollback 00000000-0000-4000-8000-000000000001
```

这些是替代操作，**不是一起顺序执行**。项目 rollback 无 --yes/--json 会确认，拒绝也可 exit 0；端点 rollback 无 revision 参数，完整 flags 见 [CLI publish](../cli/publish.md)/[endpoint](../cli/endpoint.md)。

成功后核对 pointer/version、build/env、允许/拒绝调用者、公开 path/method、各实例 cache 新鲜度。超时不要自动重试，可能响应丢失前已提交。旧快照不兼容今日资源/schema 时先 unpublish 阻止新流量，再修兼容配置/代码并有意发布。启用触发器/重放任务另需授权。测试清理在 drain 后取消发布/删除，保留恢复/审计证据，不应删除生产快照/日志掩盖失败。

依据：`crates/viat-api/src/handlers/{publish,snapshots}.rs`；`crates/viat-db/src/{revisions,snapshots}.rs`（before=null/指针回滚测试）；`crates/viat-core/src/types/snapshot.rs`；CLI 发布/端点实现。未执行回滚、构建、测试、供应商动作。
