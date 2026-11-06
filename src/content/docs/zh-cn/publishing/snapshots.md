---
title: "发布快照与门禁"
description: "发布冻结范围、完整 API、warning/测试门禁及构建就绪。"
doc_id: publishing.snapshots
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.publish.plan", "cli.publish.apply", "cli.endpoint.publish"]
---

# 发布快照与门禁

编辑脚本/端点不会自动改变普通公开调用。registry 读取 active 不可变快照，经 DB 通知跨实例刷新；草稿测试有意不同。publish/unpublish/rollback/cache purge 和端点历史需项目 **Owner/Admin** 发布权，Developer 可编辑但不能发布；项目 plan/history/show 需成员（含 Operator）。控制台 token 不是最终用户端点凭据。

示例源码推导未执行。发布可用**真实资源**运行用例、安装依赖/构建 worker、改变路由、触发跨实例 reload，真实项目执行前须明确授权。

## 冻结与 live 边界

| 目标/配置 | 发布边界 |
| --- | --- |
| 普通脚本端点 | 冻结 main 源码/版本/语言/folder/input schema。只有整个 uses 图**任意位置都没有 `(live)`** 才冻结全部依赖；任意 live 引用让依赖图走实时解析，不是仅冻结其余分支。 |
| 工作流端点 | 冻结 definition、step 主脚本源码/版本/folder、嵌套 workflow/step 主源码；**step uses 始终 live，包含嵌套工作流**，主源码冻结不等于依赖图冻结。 |
| 入站 WS 端点 | 通过脚本快照验证冻结路由及脚本，与 live 出站订阅不同。 |
| CRUD | 冻结作者配置及 schema 解析出的 PK/选择/filter/writable 类型；资源凭据/schema 健康、live 授权绑定/规则仍影响。 |
| Proxy | 冻结挂载路径、strip 行为、资源绑定，http_api 设置/凭据 live。 |
| Auth/overrides | 有效 authorizer **绑定**、gate、path/method/input/response overrides 冻结；authorizer 配置、用户/角色/key、授权模型/资源仍 live；内置认证代码/hook 不是用户脚本快照。 |
| Schedule/watch/IM/queue/出站 WS | 触发器配置 live，不属于端点发布；直接脚本/工作流目标读 live 草稿，schedule endpoint 跟随已发布端点。 |

所以 rollback 不回滚资源旋转、DB schema/data、live workflow 模块、供应商状态或已发送消息。普通冻结模块变更需重新发布，除非明确 live。源码/导出仓库表示**草稿**，不是 active immutable snapshot 的可移植导出。

## Plan 与项目 apply

`GET /projects/<slug>/publish/plan` 返回 project_slug/publishable_count/endpoints；各项含 `id,tree_name,method,path,current_status,target_kind,target_name,current_version,draft_version,diff_summary`，proxy method/无旧版本可 null。服务端修复依赖闭包陈旧 dirty 标记，但不启用路由；plan 不是锁/预约，不保证 apply 仍是相同草稿。

源码推导响应例：

```json
{"project_slug":"demo","publishable_count":1,"endpoints":[{"id":"00000000-0000-4000-8000-000000000001","tree_name":"default","method":"GET","path":"/hello","current_status":"unpublished","target_kind":"script","target_name":"echo","current_version":null,"draft_version":1,"diff_summary":"new endpoint"}]}
```

`POST /projects/<slug>/publish/apply` 可选 body：

```http
POST /projects/demo/publish/apply
Authorization: Bearer <console-token>
Content-Type: application/json

{"acknowledge_warnings":false,"acknowledge_test_failures":false}
```

缺 body/字段均 false，不可用 null 清布尔。apply 在同一事务/revision 发布**所有可发布 dirty/未发布叶子**，不是任意脚本草稿，也不是只发布最近编辑的一条。空任务返回零项，不新建 revision。服务器没有 require_tests 字段，那是本地 CLI 选项。

```json
{"project_slug":"demo","published_count":1,"endpoints":[{"id":"00000000-0000-4000-8000-000000000001","method":"GET","path":"/hello","snapshot_id":"00000000-0000-4000-8000-000000000003","snapshot_version":1}],"builds":[{"script":"echo","language":"python","ok":true,"error":null,"duration_ms":42}],"build_pending":false}
```

builds 行含 script/language/ok/error/duration_ms，可有非空 Rust diagnostics；build_pending true 表示后台构建，通常 builds 空。200 表示路由启用成功，**不证明每个环境就绪**。

## 单端点发布与完整快照响应

`POST /projects/<slug>/endpoints/<id>/publish` 接受相同两个可选 flags，只发布该叶子，成功形状不同：

```json
{"snapshot":{"id":"00000000-0000-4000-8000-000000000003","node_id":"00000000-0000-4000-8000-000000000001","version":1,"method":"GET","path_pattern":"/hello","target_kind":"script","script_name":"echo","script_version":1,"workflow_name":null,"workflow_version":null,"proxy_resource_name":null,"created_by":"00000000-0000-4000-8000-000000000004","created_at":"2026-11-06T00:00:00Z"},"builds":[],"build_pending":false}
```

这是**完整 SnapshotView**，有意不含源码、workflow definition、step blob、凭据、override 内部值；端点 history/单端点 rollback 也用此形状。version 是端点快照版本，不是脚本/服务器 release。CRUD/WS 有各自 target_kind，普通 script/workflow name 可 null。

## Warning、回归与构建门禁

两个发布路由都在提交前**先 warning，再保存用例回归**；失败回滚快照/revision 写入，**不回滚已执行测试的外部副作用**。

- **409 publish_warnings_unacknowledged**：单端点返回 warnings 字符串数组；项目 apply 返回 `endpoint_warnings:[{endpoint_id,path,warnings}]`。需逐项阅读；acknowledge_warnings true 只越过 warning，不越过硬验证/测试。warning 存 revision detail。目标缺失/保留路径/绑定/schema/auth capability 非法可为不可豁免错误。
- **409 publish_test_failures**：二者均 error/message/test_results；各结果为 case/target_kind/target/outcome（passed/failed/errored/skipped）。单端点覆盖该叶，项目覆盖实际将上线目标。含 workflow 冻结 step/嵌套脚本，当前 collector **不枚举 WS route 脚本**。预算默认 120 秒，范围 1–3600，停止开始新用例，skipped 阻塞；读取用例失败当前会记日志并放行，绿色响应不证明执行过测试。
- acknowledge_test_failures true 直接跳过 pass，不只是把红色转 warning，是独立应急决策。测试跑**草稿/当前环境**，不是构建后流量模拟。stream 无单体可比 body；显式 response 用例比较 body，见[保存用例](../testing/saved-cases.md)。
- 默认构建验证在 commit/registry swap **之后**执行，失败会报告但不撤销上线。`VIAT_PUBLISH_BUILD_ASYNC` 可后台 warmup；`VIAT_PUBLISH_BUILD_BLOCK` 启用**提交前全项目构建拒绝**并强制同步，因此无关脚本失败也可挡单端点发布。Rust 编译能力/产物配置影响节点能验证什么；这些是部署设置，不是请求 flag。

冷/失败环境应看脚本 env/build error/Rust diagnostics，修依赖、工具链、产物后有意重建/发布。CLI 成功不证明 ready，不应反复 acknowledge missing-main/schema 警告隐藏部署缺陷。

## CLI、验证与清理

```sh
viat publish plan --json
viat publish apply --require-tests --yes --json
viat endpoint publish 00000000-0000-4000-8000-000000000001
```

用隔离项目返回 id，不是示例 UUID。--require-tests 先跑**本地 script tests**，不跑 endpoint fixtures；--json 不再提示确认、暴露原始成功/拒绝 body，普通非 2xx 非零，但接受发布中 build 失败/pending 仍可 exit 0。单端点 CLI 的 acknowledgement 面比 API 窄，只用 [CLI publish](../cli/publish.md)/[endpoint](../cli/endpoint.md)已文档 flags，不猜 --force。

发布后核对 history/show、快照版本、build/env、允许/拒绝调用者及已授权公开 smoke。跨实例通知收敛不是全局原子流量切换，在途请求保留启动 payload；取消/断线不撤销已提交副作用。超时结果不明时先查 history/current snapshot，再决定重试；publish 不按 Idempotency-Key 去重，重试可新建 revision 或无 dirty 工作。

`POST …/endpoints/<id>/unpublish` 返回 `{"unpublished":true}`，停止新普通流量、保留历史，不撤销运行效果；内置 auth 叶拒绝。删除隔离端点前处理 pending/外部数据。路由恢复见[回滚](rollback.md)，跨环境见[提升](promotion.md)。

依据：`crates/viat-api/src/handlers/{publish,snapshots}.rs`、registry.rs、regression.rs、runner 依赖解析；`crates/viat-core/src/types/snapshot.rs`；`crates/viat-db/src/{snapshots,revisions}.rs`；CLI 发布代码。示例未执行，未构建/测试/reload/调用供应商。
