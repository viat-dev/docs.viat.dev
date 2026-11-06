---
title: "已保存回归用例"
description: "持久保存脚本/工作流预期，理解真实资源发布门禁。"
doc_id: testing.saved-cases
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.testcase.create", "cli.testcase.list", "cli.testcase.run", "cli.testcase.update"]
---

# 已保存回归用例

保存用例是服务器中针对**脚本/工作流草稿**的 args/expected/match_mode，不是假资源单测、端点 fixture、HTTP status 断言或发布快照。执行会访问**真实资源**，以 system 测试/scheduler principal 而非控制台人的调用者权限运行。保存不执行，run 和发布可能真实写入、发消息、产生费用，须隔离项目/数据并明确授权外部动作。

项目成员可 list/read；create/update/enable/disable/delete/**run** 需内容编辑权（Owner/Admin/Developer）。目标按 kind/folder/name 而非端点 id，更新不能改目标。控制台从已观察 Test 输出保存用例，再查看/修改/运行；API/CLI 也可直接创建。

## 完整 API 与示例

源码推导未执行，已有 echo 返回 `{hello:name}`：

```http
POST /projects/demo/test-cases
Authorization: Bearer <console-token>
Content-Type: application/json

{"target_kind":"script","target_folder":"","target_name":"echo","name":"happy-path","args":{"name":"Ada"},"expected":{"hello":"Ada"},"match_mode":"subset"}
```

```json
{"id":"00000000-0000-4000-8000-000000000001","project_id":"00000000-0000-4000-8000-000000000002","target_kind":"script","target_folder":"","target_name":"echo","name":"happy-path","enabled":true,"args":{"name":"Ada"},"expected":{"hello":"Ada"},"match_mode":"subset","created_at":"2026-11-06T00:00:00Z","updated_at":"2026-11-06T00:00:00Z"}
```

| 字段 | 创建/更新语义 |
| --- | --- |
| `target_kind` | 必填 script/workflow，无 endpoint。 |
| `target_folder` | 创建省略/null 为根 `""`，独立于 target_name。 |
| `target_name` | 必填叶名；未执行前用例存在不证明目标存在/可运行。 |
| `name` | 必填、trim 后非空，同目标唯一；重复返回 400，不覆盖。 |
| `args` | 创建省略/null 为 `{}`，必须对象。 |
| `expected` | 必填 JSON，可标量/对象/数组/null。 |
| `match_mode` | 省略/null 为 subset，另 exact。 |
| `enabled` | 新用例启用，创建 body 不控制；用单独路由。 |

`GET /projects/<slug>/test-cases?target_kind=script&target_folder=&target_name=echo` 列表，`GET …/test-cases/<id>` 完整读取。`PUT …/<id>` 是**部分更新**，仅 name/args/expected/match_mode；省略**或 null** 都保留，`{}` 无操作。`args:{}` 明确清参数；更新 `expected:null` **不会**改为 JSON null，若要该预期需新建用例。这里不能改目标/enabled。`POST …/<id>/enabled {"enabled":false}` 返回 `{"enabled":false}`，true 启用；DELETE 返回 `{"deleted":"<id>"}`。

`POST …/<id>/run {}` 显式执行一次，enabled 管自动门禁，不是此动作的开关。实际 enum 序列化：

```json
{"outcome":"passed"}
```

```json
{"outcome":{"failed":{"mismatches":[{"path":"hello","expected":"Ada","actual":"Bob","absent":false}]}}}
```

errored:{message} 表示没有可比较输出（解析/构建/运行/timeout/stream）；failed 才是输出不匹配。直接脚本测试不同：`POST …/scripts/echo/test-run {"args":{"name":"Ada"},"run_async":false,"record":false}` 返回 ok/output/stdout/stderr/execution_log_id/request_id/recorded/error。显式 ViatResponse 即使有真实 body，在此 **output 可为 null**；保存用例会正确比较显式响应的 **body**，不是 HTTP status/header。流式目标无单一 body 会 errored，需专用流/端点测试。

## 匹配和发布门禁范围

subset 递归要求 expected 对象键值存在，忽略 actual 多余键；两种模式数组都要求等长并逐项比较，subset 不是集合包含/前缀。exact 要完整相等。mismatch 有点分/索引路径、expected、actual、absent；actual null 且 absent true 表示字段不存在，不是存在且 null。

`POST …/publish/apply` 和 `POST …/endpoints/<id>/publish` **都**在 warning 后、快照提交前运行本次发布目标的启用用例。项目 apply 只覆盖可发布叶子，不是全项目所有草稿；单端点只覆盖该叶。workflow 还收集其冻结 step 脚本、catch/控制分支、嵌套脚本闭包并去重。**当前目标收集不会枚举 WebSocket route 脚本**，不能因 route 会冻结源码就承诺门禁覆盖。代理/CRUD/内置认证没有已保存脚本目标用例。

failed/errored/预算耗尽 skipped 都以 **409 publish_test_failures** 和 test_results 阻止提交。`VIAT_PUBLISH_REGRESSION_TIMEOUT_SECS` 默认 120、夹到 1–3600；预算只停止**开始**新用例，不强制中止已运行用例的目标 timeout。disabled 忽略。读取启用用例失败时当前实现记日志并无门禁继续，发布成功不证明测试运行过。acknowledge_test_failures true 直接跳过整个 pass，与 warning acknowledgement 独立，不是重试。回归只证明当前草稿/环境，不证明新依赖构建环境可用，见[发布](../publishing/snapshots.md)。

## CLI 与生命周期

```sh
viat testcase create echo happy-path --args '{"name":"Ada"}' --expected '{"hello":"Ada"}'
viat testcase list echo --json
viat testcase run 00000000-0000-4000-8000-000000000001
viat testcase update 00000000-0000-4000-8000-000000000001 --match exact
viat testcase disable 00000000-0000-4000-8000-000000000001
```

示例未执行，须用隔离项目返回的 id；另有 show/enable/delete，适用命令可 `--kind workflow`，见[完整 CLI](../cli/testcase.md)。run 非 passed 返回非零，不只是 HTTP 成功信号。保存用例不是仓库 cassette，不要假定 push/pull 携带。仅为变绿而修改 expected 会破坏断言，应审查行为、确认合法改变再刷新预期。仅禁用/删除自己的测试用例，外部副作用另清；删除用例/日志不撤销运行。

依据：`crates/viat-api/src/handlers/test_cases.rs`、`regression.rs`、`handlers/{scripts,publish,snapshots}.rs`；`crates/viat-core/src/types/test_case.rs` 比较测试；`crates/viat-cli/src/commands/testcase.rs`。未执行用例、构建或真实资源调用。
