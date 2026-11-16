---
title: "已保存回归用例"
description: "持久保存脚本/工作流预期，理解真实资源发布门禁。"
doc_id: testing.saved-cases
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.testcase.create", "cli.testcase.list", "cli.testcase.run", "cli.testcase.update"]
---

# 已保存回归用例

保存用例存放在服务器上,记录**脚本/工作流草稿**的一组
`args + expected + match_mode`,并在每次发布前自动运行。它不是假资源单测,
不是端点 fixture,不是 HTTP status 断言,也不是发布快照——它是发布门禁的
最后一层。

两件事先说清楚:

- 执行用例会访问**真实资源**,并以 system 测试/scheduler principal 运行,
  不是控制台里那个人的调用者权限。保存不执行;但 run 和发布都可能真实
  写入、发消息、产生费用——隔离项目/数据,外部动作先获授权。
- 权限:list/read 任何项目成员可做;create/update/enable/disable/delete/
  **run** 都需要内容编辑权(Owner/Admin/Developer)。目标按
  kind/folder/name 定位而非端点 id;更新不能改变目标。

控制台可以从已观察的 Test 输出一键保存用例,再查看/修改/运行;API/CLI 也
能直接创建。

## 完整 API 与示例

源码推导、未执行。假设已有 `echo` 返回 `{hello: name}`:

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
| `target_kind` | 必填 `script`/`workflow`;没有 endpoint。 |
| `target_folder` | 创建时省略/null 为根 `""`;独立于 target_name。 |
| `target_name` | 必填叶名;用例先于执行存在,不证明目标存在/可运行。 |
| `name` | 必填,trim 后非空,同目标内唯一;重复返回 400,不覆盖。 |
| `args` | 创建省略/null 为 `{}`;必须是对象。 |
| `expected` | 必填 JSON;标量/对象/数组/null 都行。 |
| `match_mode` | 省略/null 为 `subset`,另一选项 `exact`。 |
| `enabled` | 新用例默认启用;创建 body 不控制它,用单独路由改。 |

其余路由:

- `GET /projects/<slug>/test-cases?target_kind=script&target_folder=&target_name=echo`
  列表;`GET …/test-cases/<id>` 完整读取。
- `PUT …/<id>` 是**部分更新**,只认 name/args/expected/match_mode;字段省略
  **或为 null** 都表示保留,`{}` 是无操作。注意两个坑:`args:{}` 会把参数
  **明确清空**;而更新 `expected:null` **不会**把预期改成 JSON null——要
  那种预期就新建用例。目标与 enabled 不能在这里改。
- `POST …/<id>/enabled {"enabled":false}` 返回 `{"enabled":false}`;true
  重新启用。
- `DELETE …/<id>` 返回 `{"deleted":"<id>"}`。

`POST …/<id>/run {}` 显式执行一次——enabled 只管自动门禁,不是这个动作的
开关。实际的 enum 序列化:

```json
{"outcome":"passed"}
```

```json
{"outcome":{"failed":{"mismatches":[{"path":"hello","expected":"Ada","actual":"Bob","absent":false}]}}}
```

`errored:{message}` 表示没有可比较的输出(解析/构建/运行/超时/stream);
`failed` 才是输出不匹配。与直接脚本测试的区别:`POST …/scripts/echo/test-run
{"args":{"name":"Ada"},"run_async":false,"record":false}` 返回
ok/output/stdout/stderr/execution_log_id/request_id/recorded/error——显式
ViatResponse 即使带真实 body,这里 **output 可为 null**;而保存用例比较的是
显式响应的 **body**,不是 HTTP status/header。流式目标没有单体 body,会
errored——需要专门的流/端点测试。

## 匹配与发布门禁范围

- `subset`:递归要求 expected 的对象键值在 actual 中存在,忽略 actual 的
  多余键。**两种模式下数组都要求等长并逐项比较**——subset 不是集合包含,
  也不是前缀。
- `exact`:完整相等。
- mismatch 记录 path(点分/索引)、expected、actual、absent;actual 为 null
  且 absent=true 表示**字段不存在**,不是"存在且为 null"。

`POST …/publish/apply` 与 `POST …/endpoints/<id>/publish` **都会**在
warning 之后、快照提交之前,运行本次发布目标的启用用例:

- 项目 apply 只覆盖可发布叶子,不是全项目所有草稿;单端点发布只覆盖该叶。
- workflow 会收集其冻结的 step 脚本、catch/控制分支与嵌套脚本闭包(去重)。
- **当前收集不会枚举 WebSocket route 脚本**——不能因为 route 会冻结源码,
  就承诺门禁覆盖它。
- 代理/CRUD/内置认证没有"已保存脚本目标"用例。

`failed`/`errored`/预算耗尽导致的 `skipped` 都以 **409
publish_test_failures** 附 test_results 阻止提交。
`VIAT_PUBLISH_REGRESSION_TIMEOUT_SECS` 默认 120、夹到 1–3600;预算只停止
**开始**新用例,不强制中止已运行用例的目标超时。disabled 的用例被忽略。

> [!WARNING]
> 当前实现在"读取启用用例失败"时记日志并放行——**发布成功不证明测试运行过**。
> `acknowledge_test_failures: true` 直接跳过整个 pass 判定,与 warning 豁免
> 相互独立,也不是重试。回归只证明当前草稿/环境,不证明新依赖的构建环境
> 可用,见[发布](../publishing/snapshots.md)。

## CLI 与生命周期

```sh
viat testcase create echo happy-path --args '{"name":"Ada"}' --expected '{"hello":"Ada"}'
viat testcase list echo --json
viat testcase run 00000000-0000-4000-8000-000000000001
viat testcase update 00000000-0000-4000-8000-000000000001 --match exact
viat testcase disable 00000000-0000-4000-8000-000000000001
```

示例未执行;用你隔离项目返回的 id。另有 show/enable/delete,适用命令可加
`--kind workflow`,完整参数见 [CLI testcase](../cli/testcase.md)。`run`
非 passed 时返回非零,不只是 HTTP 成功信号。

保存用例不是仓库 cassette——不要假定 push/pull 会携带它们。**仅为变绿而改
expected 会破坏断言**:先审查行为、确认是合法变更,再刷新预期。只禁用/删除
自己的用例;外部副作用另行清理——删除用例或日志不会撤销已发生的运行。

## 核验依据

契约源码 `03751a67`:`crates/viat-api/src/handlers/test_cases.rs`、`regression.rs`、`handlers/{scripts,publish,snapshots}.rs`;`crates/viat-core/src/types/test_case.rs` 的比较测试;`crates/viat-cli/src/commands/testcase.rs`。未执行用例、构建或真实资源调用。
