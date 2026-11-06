---
title: "端点契约测试"
description: "在可丢弃本地实例中以真实 dispatch 执行 fixture 请求。"
doc_id: testing.endpoint-tests
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.endpoint.test", "cli.script.run", "cli.workflow.test"]
---

# 端点契约测试

`viat endpoint test [dir]` 测 wire 契约：authorizer/gates、参数绑定/转换、raw body、脚本、response transform 和 HTTP 结果。直接单测不覆盖这些层。创建 scratch DB/本地 host，push 当前 checkout、发布端点，再带假资源执行进程内请求；不会到当前选定生产服务器运行 fixture，但**不是网络沙箱**：脚本直接网络和不走假资源的平台路径仍可能有副作用。使用虚构配置、无生产凭据、隔离 DB URL。

示例源码推导/未执行，本任务未运行测试、安装、DB 或供应商调用。

## 前提与命令

- 完整本地 Viat 项目/仓库，CLI 已选择 slug，CWD 为仓库根；session 发现不会改变 CWD。
- 同版本 viat-endpoint-test-host：先 `VIAT_ENDPOINT_TEST_HOST_BIN`，再 viat 同级，最后 PATH；CLI 先查版本，拒绝不匹配及不能报版本的旧 host。
- `VIAT_ENDPOINT_TEST_DB` 是具 CREATE DATABASE 权的 Postgres 基础 URL，不是应用 testdb 资源本身；host 在其中建/删 scratch DB，须预先准备隔离本地 Postgres。
- 脚本所需解释器/工具链/依赖（Python 的 uv、TypeScript 的 bun 等）；依赖可需缓存。“离线测试”指上游交互用 fake，不保证语言准备阶段不访问包仓库。

```sh
VIAT_ENDPOINT_TEST_DB='postgres://test:test@127.0.0.1:5432/postgres' viat endpoint test endpoint_tests
```

此命令**没有 --json**，默认目录 endpoint_tests。缺失/空/无 YAML 目录为错误，不是零测试成功；错误 fixture 记失败。输出逐项 ok/FAIL 和 `<n> passed, <n> failed`，任何失败 exit 1；host 内部行是 `{name,passed,detail?}`，通过时无 detail。

host 注册一次性控制台用户、建项目、导入资源/push，并以**两个 acknowledge 均 true** 发布，因此 fixture **不能证明发布门禁通过**。初始化权限只在 scratch 实例内，不证明 fixture 调用者能管理生产。

## 完整 fixture schema

每个 `.yaml`/`.yml` 一个对象：

```yaml
name: echoes the query
endpoint: hello
method: GET
headers: {}
query: {name: Ada}
resources: {}
expect:
  status: 200
  body_contains: '"hello":"Ada"'
```

针对 [HTTP echo](../triggers/http.md)，预期紧凑 JSON **子串**，不是结构相等，空白会影响匹配；不同 renderer 需先查看输出。

| 字段 | 默认/行为 |
| --- | --- |
| `name` | 可选/null 使用 `<method> <endpoint>`。 |
| `endpoint` | 必填 `/p/<slug>` 后的路径，允许前导斜杠，不是完整 URL。 |
| `method` | GET。 |
| `headers` | 空字符串映射；非法 header 构造失败，可自行提供 Authorization。 |
| `query` | 空字符串映射，自动 URL encode，不是多值重复键。 |
| `body` | 缺省/null 为空；字符串原样，object/array 序列化 JSON，除非显式设置 content type。 |
| `login` | 可选/null；`{authorizer,identity,credential}` 通过真实项目 authorizer 登录并发返回 bearer；匿名省略。存在时三个字段都必填，不是任意 claims 注入。 |
| `resources` | 空映射，每资源恰有一个下述 backing。 |
| `expect.status` | 必填 u16 HTTP 状态。 |
| `expect.body_contains` | 可选/null 字符串子串，无内置 exact JSON/header/流时间断言。 |

fake 例：`resources:{upstream:{cassette:cassettes/upstream.yaml},token:{secret:synthetic},db:{testdb:"postgres://test:test@127.0.0.1/test_data"},files:{storage:{}}}`。YAML 本身不执行源/预期文件，项目脚本仍是真代码。[fixtures](fixtures.md)说明 cassette 与隔离数据。

DTO 结构允许 cassette/secret/testdb/storage/config 恰一个，但**端点 config override 在运行时明确拒绝**，使用发布的 config 资源本身，不能因 DTO 有此字段就声称 `{config:{…}}` 可用。storage 可选 root、prefix 默认空、max_file_bytes 0、allowed_types 空，未设 root 用临时目录；secret fake 是字符串。fake 并不证明所有原生资源/目标（proxy/CRUD/auth/files）都同样被拦截，应验证实际路径并使用隔离地址。

## 隔离、失败、清理

fixture 顺序执行，各有资源 host/login；login hook 与端点用**独立 cassette cursor**，不会消耗端点首响应。同次 host 的 scratch 平台 DB 共享，不保证每 fixture 重置；TestDb 自有回滚事务及 savepoint 限制。响应收集上限 16 MiB，未结束流可等到运行时 timeout，不能用此格式断言实时 socket 协议或流时间。

CLI 在初始化/fixture 错误时尽力 shutdown/删 DB 并杀 host；强制终止仍应查残留本地 host/scratch DB，不能凭猜测名称删 DB，要确认归属本测试。不要靠 rollback 把 production URL 当安全数据源；显式 root 文件、直接网络、真实 tasks enqueue 可能另需清理。无通用 retry/cancel flag，先修版本/解释器/初始化/schema 或断言再有意重跑。

直接草稿测试又不同：`viat script run echo --args '{"name":"Ada"}'` 调 `/scripts/<name>/test-run`，使用真实资源并返回输出/日志，显式 ViatResponse 可 output:null。`viat workflow test flow --input '{}'` 调 `/workflows/<name>/test_run` 并输出 step；CLI **只要任何 step attempt 为 failed 即 exit 1，即使后续 retry/catch 恢复成功**，有 user_error 也失败。恢复完成不一定符合 CLI 绿色标准，不能与离线 fixture/保存预期混淆，见[保存用例](saved-cases.md)。

依据：`crates/viat-api/src/endpoint_test.rs`、endpoint-test-host 和 endpoint_test_flow 测试；`crates/viat-cli/src/commands/{endpoint_test,script,workflow}.rs`。未验证真实供应商、代理、socket 或依赖安装。
