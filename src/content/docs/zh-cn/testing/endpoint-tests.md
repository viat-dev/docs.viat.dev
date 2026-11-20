---
title: "端点契约测试"
description: "在可丢弃本地实例中以真实 dispatch 执行 fixture 请求。"
doc_id: testing.endpoint-tests
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.endpoint.test", "cli.script.run", "cli.workflow.test"]
---

# 端点契约测试

`viat endpoint test [dir]` 验证的是 **wire 契约**:authorizer/gates、参数
绑定与转换、raw body、脚本执行、response transform、最终 HTTP 结果——
这些层是直接单测覆盖不到的。

工作方式:创建一个一次性 scratch 数据库和本地 host,把当前 checkout push
上去、发布端点,然后带着**假资源**逐条执行 fixture 请求。它不会在你当前
选定的生产服务器上跑 fixture。

> [!WARNING]
> 这**不是网络沙箱**:脚本里的直接网络访问、以及不走假资源的平台路径仍可能
  产生副作用。使用虚构配置、无生产凭据、隔离的数据库 URL。本页示例源码推导
  /未执行,本任务未运行测试、安装、DB 或供应商调用。

## 前提

- 完整的本地 Viat 项目/仓库;CLI 已选择 slug;CWD 为仓库根(session 发现
  不会改变 CWD)。
- **同版本**的 `viat-endpoint-test-host`:查找顺序为
  `VIAT_ENDPOINT_TEST_HOST_BIN` → viat 同级目录 → PATH。CLI 会先查版本,
  拒绝不匹配以及不能报版本的旧 host。
- `VIAT_ENDPOINT_TEST_DB`:具有 CREATE DATABASE 权限的 Postgres 基础 URL
  (不是应用的 testdb 资源本身);host 在其中创建/删除 scratch 库,需要预先
  准备好隔离的本地 Postgres。
- 脚本所需解释器/工具链/依赖(Python 的 uv、TypeScript 的 bun 等);依赖
  可以走缓存。"离线测试"指上游交互用 fake,**不保证**语言准备阶段不访问
  包仓库。

## 运行

```sh
VIAT_ENDPOINT_TEST_DB='postgres://test:test@127.0.0.1:5432/postgres' viat endpoint test endpoint_tests
```

默认目录就是 `endpoint_tests`,该命令**没有 `--json`**。目录缺失/为空/没有
YAML 视为错误,不是"零测试通过";有错误的 fixture 记为失败。输出逐项
`ok`/`FAIL` 和 `<n> passed, <n> failed`,任何失败 exit 1。host 内部每行为
`{name,passed,detail?}`,通过时不带 detail。

host 会注册一次性控制台用户、建项目、导入资源并 push,发布时**两个
acknowledge 均为 true**——因此 fixture 通过**不能证明发布门禁会通过**;
初始化得到的权限只存在于 scratch 实例,不证明 fixture 调用者能管理生产。

## 完整 fixture schema

每个 `.yaml`/`.yml` 文件一个对象:

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

本例针对 [HTTP echo](../triggers/http.md):`body_contains` 是紧凑 JSON 的
**子串**匹配,不是结构化相等——空白差异会导致不匹配,换 renderer 前先看
一眼实际输出。

| 字段 | 默认/行为 |
| --- | --- |
| `name` | 可选;null 时用 `<method> <endpoint>`。 |
| `endpoint` | 必填;`/p/<slug>` 之后的路径,允许前导斜杠,不是完整 URL。 |
| `method` | `GET`。 |
| `headers` | 空字符串映射;非法 header 直接构造失败;可自行提供 Authorization。 |
| `query` | 空字符串映射;自动 URL encode;不支持多值重复键。 |
| `body` | 缺省/null 为空;字符串原样发送,object/array 序列化为 JSON——除非显式设置 content type。 |
| `login` | 可选/null;`{authorizer,identity,credential}` 会走真实项目 authorizer 登录并在返回中带 bearer;匿名则省略。存在时三个字段都必填,不是任意 claims 注入。 |
| `resources` | 空映射;每个资源恰好配一个下述 backing。 |
| `expect.status` | 必填;u16 HTTP 状态码。 |
| `expect.body_contains` | 可选/null;字符串子串;没有内置 exact-JSON/header/流时序断言。 |

fake 资源示例:
`resources:{upstream:{cassette:cassettes/upstream.yaml},token:{secret:synthetic},db:{testdb:"postgres://test:test@127.0.0.1/test_data"},files:{storage:{}}}`。
YAML 不会执行源码/预期文件,项目脚本仍是真代码;cassette 与隔离数据的准备
见 [fixtures](fixtures.md)。

DTO 结构允许每资源恰选 cassette/secret/testdb/storage/config 之一,但注意:

> [!WARNING]
> **端点 config override 在运行时明确被拒绝**——测试使用已发布的 config
> 资源本身。不能因为 DTO 里有这个字段,就声称 `{config:{…}}` 可用。
> storage 可选 `root`(缺省用临时目录)、`prefix` 默认空、`max_file_bytes`
> 为 0、`allowed_types` 为空;secret fake 就是一个字符串。在 `1.1.0` 基线中，fake
> 不保证所有原生资源/目标(proxy/CRUD/auth/files)都被同样拦截——`1.6.0` 起 CRUD 与
> `viat_gql` 的离线 `testdb` 拦截见[CRUD 表面与契约对齐（预览）](../triggers/crud-surface-preview.md)，
> 其余路径仍应验证实际行为并使用隔离地址。

## 隔离、失败与清理

- fixture 顺序执行,各自有资源 host/login;login hook 与端点使用**独立的
  cassette cursor**,不会"吃掉"端点的第一个响应。
- 同一次 host 的 scratch 平台库是共享的,不保证逐 fixture 重置;TestDb 有
  自己的回滚事务与 savepoint 限制。
- 响应收集上限 16 MiB;未结束的流会等到运行时超时——这个格式不能断言实时
  socket 协议或流时序。

CLI 在初始化或 fixture 错误时会尽力 shutdown、删库并杀掉 host;强制终止后
仍应检查残留的本地 host/scratch 库——删除前确认归属本测试,不要凭名字猜测。
不要靠 rollback 把生产 URL 当安全数据源;显式 root 文件、直接网络、真实
tasks enqueue 可能需要额外清理。没有通用 retry/cancel flag:修好版本/
解释器/初始化/schema 或断言后,再有意识地重跑。

## 与草稿直测的区别

`viat script run echo --args '{"name":"Ada"}'` 调用
`/scripts/<name>/test-run`,使用**真实资源**,返回输出/日志;显式 ViatResponse
时 output 可为 null。

`viat workflow test flow --input '{}'` 调用 `/workflows/<name>/test_run` 并
输出各 step;CLI 的判定是:**只要有任何 step attempt 为 failed 即 exit 1,
即使后续 retry/catch 已恢复成功**(有 user_error 同样失败)。恢复完成不一定
等于 CLI 绿色。这条链路与离线 fixture、保存用例是三种不同的"测试",不要
混用,见[保存用例](saved-cases.md)。

## 核验依据

契约源码 `03751a67`:`crates/viat-api/src/endpoint_test.rs`、endpoint-test-host 与 endpoint_test_flow 测试;`crates/viat-cli/src/commands/{endpoint_test,script,workflow}.rs`。未验证真实供应商、代理、socket 或依赖安装。
