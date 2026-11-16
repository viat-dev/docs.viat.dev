---
title: "发布快照与门禁"
description: "发布冻结范围、完整 API、warning/测试门禁及构建就绪。"
doc_id: publishing.snapshots
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.publish.plan", "cli.publish.apply", "cli.endpoint.publish"]
---

# 发布快照与门禁

发布把端点的草稿状态固化成一份**不可变快照**,公开流量从这一刻起读取快照而不是
草稿。本页说明:发布到底冻结了什么、完整的管理 API、warning/回归用例如何
拦截发布、构建结果怎么读。

权限与影响,先记住三句话:

- 公开调用读 active 快照;改草稿不影响线上,直到再次发布。
- publish/unpublish/rollback/cache purge 与端点历史需要项目 **Owner/Admin**;
  Developer 可编辑但不能发布。plan/history/show 只需项目成员(含 Operator)。
- 控制台 token 不是终端用户端点凭据。

> [!WARNING]
> 发布可用**真实资源**运行回归用例、安装依赖、构建 worker、改变路由并触发
> 跨实例 reload。在真实项目上执行前必须获得明确授权。本页示例源自源码推导,
> 未执行。

## 冻结与 live 边界

| 目标/配置 | 发布边界 |
| --- | --- |
| 普通脚本端点 | 冻结 main 源码/版本/语言/folder/input schema。只有整个 uses 图**任意位置都没有 `(live)`** 才冻结全部依赖;任意 live 引用让整张依赖图走实时解析,不是只放行那一个分支。 |
| 工作流端点 | 冻结 definition、step 主脚本源码/版本/folder、嵌套 workflow/step 主源码;**step uses 始终 live(含嵌套工作流)**,主源码冻结不等于依赖图冻结。 |
| 入站 WS 端点 | 通过脚本快照验证冻结路由及脚本;与 live 的出站订阅不同。 |
| CRUD | 冻结作者配置及 schema 解析出的 PK/选择/filter/writable 类型;资源凭据、schema 健康、live 授权绑定/规则仍会影响。 |
| Proxy | 冻结挂载路径、strip 行为、资源绑定;http_api 设置与凭据是 live。 |
| Auth/overrides | 有效的 authorizer **绑定**、gate、path/method/input/response overrides 被冻结;authorizer 配置、用户/角色/key、授权模型与资源仍 live。内置认证代码/hook 不属于用户脚本快照。 |
| Schedule/watch/IM/queue/出站 WS | 触发器配置本身 live,不在端点发布范围内;直接指向脚本/工作流的目标读 live 草稿,schedule endpoint 跟随已发布端点。 |

由此推出两条经常被误解的结论:

- **rollback 不回滚**资源轮换、数据库 schema/数据、live 工作流模块、供应商
  状态或已发出的消息。
- 源码/导出仓库表示的是**草稿**,不是 active 快照的可移植导出;冻结模块变更
  需要重新发布,除非它明确是 live。

## Plan 与项目级 apply

`GET /projects/<slug>/publish/plan` 返回 `project_slug/publishable_count/
endpoints`;每项含 `id,tree_name,method,path,current_status,target_kind,
target_name,current_version,draft_version,diff_summary`(proxy 的 method、
无旧版本时为 null)。服务端会修复依赖闭包上陈旧的 dirty 标记,但不启用路由;
plan 不是锁或预约,不保证 apply 时草稿仍相同。

源码推导的响应示例:

```json
{"project_slug":"demo","publishable_count":1,"endpoints":[{"id":"00000000-0000-4000-8000-000000000001","tree_name":"default","method":"GET","path":"/hello","current_status":"unpublished","target_kind":"script","target_name":"echo","current_version":null,"draft_version":1,"diff_summary":"new endpoint"}]}
```

`POST /projects/<slug>/publish/apply` 的可选 body:

```http
POST /projects/demo/publish/apply
Authorization: Bearer <console-token>
Content-Type: application/json

{"acknowledge_warnings":false,"acknowledge_test_failures":false}
```

缺 body 或缺字段都按 `false`;布尔值不能用 null 清除。apply 在同一事务/revision
里发布**所有**可发布的 dirty/未发布叶子——不是任意脚本草稿,也不是只发最近
编辑的一条。空任务返回零项、不新建 revision。服务器没有 `require_tests` 字段,
那是本地 CLI 选项。

```json
{"project_slug":"demo","published_count":1,"endpoints":[{"id":"00000000-0000-4000-8000-000000000001","method":"GET","path":"/hello","snapshot_id":"00000000-0000-4000-8000-000000000003","snapshot_version":1}],"builds":[{"script":"echo","language":"python","ok":true,"error":null,"duration_ms":42}],"build_pending":false}
```

`builds` 每行含 `script/language/ok/error/duration_ms`,error 可带非空 Rust
diagnostics;`build_pending: true` 表示后台构建,此时 builds 通常为空。HTTP
`200` 表示路由启用成功,**不证明每个运行环境已就绪**。

## 单端点发布与完整快照响应

`POST /projects/<slug>/endpoints/<id>/publish` 接受同样两个可选 flag,只发布
该叶子,成功响应形状不同:

```json
{"snapshot":{"id":"00000000-0000-4000-8000-000000000003","node_id":"00000000-0000-4000-8000-000000000001","version":1,"method":"GET","path_pattern":"/hello","target_kind":"script","script_name":"echo","script_version":1,"workflow_name":null,"workflow_version":null,"proxy_resource_name":null,"created_by":"00000000-0000-4000-8000-000000000004","created_at":"2026-11-06T00:00:00Z"},"builds":[],"build_pending":false}
```

这是**完整 SnapshotView**:有意不含源码、workflow definition、step blob、
凭据与 override 内部值;端点 history 与单端点 rollback 也用同一形状。
`version` 是端点快照版本,不是脚本或服务器 release;CRUD/WS 有各自的
target_kind,普通 script/workflow 的 name 可为 null。

## Warning、回归与构建门禁

两个发布路由都在提交前**先检查 warning,再执行保存用例回归**;失败会回滚
快照/revision 写入,但**不回滚已执行测试的外部副作用**。

**`409 publish_warnings_unacknowledged`** —— 单端点返回 warnings 字符串数组;
项目 apply 返回 `endpoint_warnings:[{endpoint_id,path,warnings}]`。逐项阅读
后,`acknowledge_warnings: true` 只越过 warning 层,不越过硬验证或测试。
warning 记录在 revision detail 中。目标缺失、保留路径、绑定、schema 或 auth
capability 非法属于**不可豁免**错误。

**`409 publish_test_failures`** —— 两者都返回 `error/message/test_results`;
每个结果为 `case/target_kind/target/outcome`(passed/failed/errored/skipped)。
单端点覆盖该叶子;项目 apply 覆盖实际将上线的目标,含工作流冻结 step 与嵌套
脚本;当前 collector **不枚举 WS route 脚本**。测试预算默认 120 秒、范围
1–3600;超时停止开启新用例;`skipped` 也阻塞。读取用例失败当前记日志并放行
——**绿色响应不证明执行过测试**。

`acknowledge_test_failures: true` 直接跳过 pass 判定,不是把红色转成 warning;
这是一次独立的应急决策。测试跑在**草稿/当前环境**,不是构建后的流量模拟;
stream 无单体可比 body,显式 response 用例的比较规则见
[保存用例](../testing/saved-cases.md)。

> [!NOTE]
> 默认构建验证在 commit/registry swap **之后**执行:失败会报告,但不撤销上线。
> `VIAT_PUBLISH_BUILD_ASYNC` 把 warmup 移到后台;`VIAT_PUBLISH_BUILD_BLOCK`
> 启用**提交前全项目构建拒绝**并强制同步——无关脚本的失败也可能挡住单端点
> 发布。Rust 编译能力与产物配置决定节点能验证什么;这些是部署设置,不是
> 请求 flag。冷/失败环境看脚本 env/build error/Rust diagnostics,修好依赖、
> 工具链或产物后再有意重建/发布;不要反复 acknowledge missing-main/schema
> 警告来掩盖部署缺陷。

## CLI、验证与清理

```sh
viat publish plan --json
viat publish apply --require-tests --yes --json
viat endpoint publish 00000000-0000-4000-8000-000000000001
```

用隔离项目返回的 id,不要照抄示例 UUID。`--require-tests` 先跑**本地
script tests**(不跑 endpoint fixtures);`--json` 不再交互确认并输出原始
成功/拒绝 body,普通非 2xx 时非零退出——但"发布中 build 失败/pending"仍可
exit 0。单端点 CLI 的豁免面比 API 窄:只用 [CLI publish](../cli/publish.md)
与 [endpoint](../cli/endpoint.md) 已文档化的 flags,不存在 `--force`。

发布后核对:

- history/show 的快照版本与 build/env 状态;
- 允许与拒绝的调用者各来一次公开 smoke。

跨实例通知收敛不是全局原子流量切换:在途请求保留启动时的 payload;取消或
断线不撤销已提交的副作用。超时后结果不明时,先查 history/current snapshot
再决定是否重试——publish 不按 Idempotency-Key 去重,重试可能新建 revision
或无事发生。

`POST …/endpoints/<id>/unpublish` 返回 `{"unpublished":true}`:停止新普通
流量、保留历史,不撤销已发生的运行效果;内置 auth 叶拒绝删除。删除隔离端点
前先处理 pending 项与外部数据。

路由恢复见[回滚](rollback.md),跨环境流转见[提升](promotion.md)。

## 核验依据

契约源码 `03751a67`:`crates/viat-api/src/handlers/{publish,snapshots}.rs`、registry.rs、regression.rs 与 runner 依赖解析;`crates/viat-core/src/types/snapshot.rs`;`crates/viat-db/src/{snapshots,revisions}.rs`;CLI 发布代码。示例未执行,未构建/测试/reload/调用供应商。
