---
title: "离线 fixture 与假资源"
description: "脚本测试准备、cassette 匹配、数据库回滚及离线宿主边界。"
doc_id: testing.fixtures
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.script.test", "cli.script.run", "cli.publish.apply"]
---

# 离线 fixture 与假资源

`viat script test [path]` 测本地处理器，[端点 fixture](endpoint-tests.md)加真实 HTTP dispatch，[保存用例](saved-cases.md)在服务器访问真实资源。本地测试不请求服务器执行，所以不需要项目 API 授权，但 checkout/数据库 URL 本身仍是本地访问能力；“test”不是权限边界，也不保证脚本直接网络被阻断。

示例均源码推导/未执行、虚构数据；本任务没有安装/运行。支持 Python/pytest、TypeScript/bun test、Rust 内联 cargo tests，生产有九种语言**不等于**九种对等离线 SDK。

## 前提、发现与结果

```sh
viat script test
viat script test tests/echo
viat script test --json
```

Python 用 uv 创建含 pytest/声明依赖的临时环境，测试在 tests、脚本在 scripts。`load("folder/script")` 支持 Python 的 uses 相对优先解析与模块隔离，扁平 import 可能选错同名 common。TypeScript 按 bun 的 .test.ts/.spec.ts 发现；npm 依赖须已安装。CLI 临时注入 node_modules/viat，已有真实模块则拒绝覆盖，结束移除注入 SDK。Rust 在脚本 rs 的 cfg(test) 中测试，以临时 crate/声明 deps 编译，需 `VIAT_RUST_SDK_PATH` 和工具链。host 版本必须匹配 CLI，查找 `VIAT_TEST_HOST_BIN`、同级、PATH。上游用 fake 不代表包准备绝不访问 registry/cache。

混合项目运行各语言套件，任一失败非零，不要只看第一份。--json stdout 结构随语言不同，runner 输出到 stderr，**exit code 才是可靠通过信号**；解释器缺失/初始化失败不等于覆盖。`viat publish apply --require-tests` 先运行这些本地测试，不自动运行 endpoint fixtures，也不替代服务端用例门禁。

## 完整 fake 面

Python `ctx_with(request=?,principal=?,resources=?,project_users=?,authz=?,ws=?)` 安装上下文；TypeScript 为异步 `await ctxWith({...})`，helper 用 camelCase。测试分支应显式设 request/principal，省略事实不等于生产已认证身份。

| Fake | backing 与限制 |
| --- | --- |
| `FakeHttp(cassette)` | http_api 调用走真实 host 分发。 |
| `FakeGraphql(cassette)` | GraphQL document。 |
| `FakeCloud(cassette)` | cloud_api action。 |
| `FakeSecret(value)` | get_resource/value 的虚构值，不能放真实凭据。 |
| `FakeConfig(dict)` | 本地文档；Python from_resource(name) 读资源 YAML plain.data，保留 $secret 占位值；端点 fixture **不支持** config override。 |
| `TestDb(url)` | 真实 scratch PostgreSQL，每测试一个回滚事务，不是通用 DB 模拟。 |
| `FakeStorage(root?,prefix?,max_file_bytes?,allowed_types?)` | 默认临时目录/内存元数据，显式 root 除外；沿用校验/错误形状，建模部署默认 100 MiB；URL 是 viat-test://，不是真实签名链接，无文件 authz/audit。 |
| `FakeUpload(path,filename?,content_type?,field?)` | request.files 的本地句柄，不是 HTTP multipart parser。 |
| `FakeProjectUsers(initial,fail?)` | 独立 project_users 参数而非资源，可查用户状态/注入失败；principal is_admin false 会拒绝，省略则 fake 不设 admin 门禁，不复现全部角色/提权防护。 |
| `FakeAuthz(model)` | 独立 authz 参数，读取 viat.yaml authz/export/dict，用生产 policy engine；principal 的 identity/user_id/role/admin/meta/claims 提供属性，缺失 fail closed，不是 allow-all。 |
| `FakeWs(...)` | Python/TS 本地连接/房间/发送/关闭记录，同 UUID/code 校验，无真实 socket；默认空 fake，send false。Rust 有 WS event context，没有对等连接 fake。 |

未支持资源/操作应失败，而非静默访问真实资源；不要因生产有某 kind 就推断 mysql、raw s3 或所有资源都可 fake。已覆盖 HTTP/GraphQL/cloud/secret/config/Postgres/storage；TestDb 不复现 transaction.graphql 和独立重叠连接并发。

## 最小脚本和测试

```python
# scripts/echo.py
def main(name="world"):
    return {"hello": name}
```

```python
# tests/test_echo.py
from viat.testing import ctx_with, load

def test_echo():
    ctx_with(resources={})
    assert load("echo").main(name="Ada") == {"hello": "Ada"}
```

若处理器调用 `ctx.resources.upstream.get("/thing/1")`，提供 `FakeHttp("cassettes/upstream.yaml")`，预期为宿主 wire response，不是虚构 requests.Response：

```yaml
interactions:
  - op: http
    name: upstream
    match:
      method: GET
      path: /thing/1
    response:
      status: 200
      content_type: application/json
      text: '{"id":1,"label":"synthetic"}'
```

每项 op/name 及对应 response，match 只钉住列出的请求字段，省略为通配。HTTP 匹配 method/path 及可选 query/body，GraphQL document/cloud action 用各自字段；ignore 在比较前移除波动 body 键。重复匹配**依序消费，之后重复最后响应**，无匹配明确失败。相同 path 不同操作需钉 body/query 或分情景目录；宽松录制重放成功不证明操作匹配正确。

## 回滚、副作用与取消边界

TestDb 需真实隔离 schema，裸 query 与事务块共用**一个连接**；脚本 transaction 变为外层回滚事务内 savepoint，可测顺序/嵌套，不可复现重叠独立事务。块内裸 query 在此能看到未提交写，生产另连接未必可见。rollback 不让 production URL 安全，非事务/外部副作用和隔离假设仍危险。

离线 ctx.tasks.enqueue 只记录，不调度；ctx.tasks.enqueued 有序，get 返回 queued，cancel 标 cancelled；检查 target/delay/range 语法，不查目标存在/端点授权。ctx.cache.purge 只记 ctx.cache.purged 规范化 GET 路径，无真实缓存清理。控制台 Test/端点测试不自动等于纯本地 task recorder。FakeWs 接受不是真实送达，FakeStorage 不证明文件授权/审计。

任何测试 timeout/cancel 都不撤销已提交外部效果。用小型确定性输入、隔离 root/DB schema，查看失败、修 fake/schema/setup 后再重跑，仅清自己创建的产物；不能为了“看看 fake 能否工作”真实重发消息。

## 录制是真实运行

`viat script run <name> --args '<json>' --record cassettes/scenario/` 请求真实服务器/资源并捕获 HTTP/GraphQL/cloud，不是离线录制。每资源 YAML **覆盖而非追加**，不同情景用不同目录。平台施加的请求凭据和 secret 资源不录制，但**响应体原样保留**，OAuth/业务响应可能有 token/个人数据；提交前检查脱敏，不录返回秘密的流程。仅同步录制，async 句柄不能立即返回完整 cassette。权限与副作用等同真实草稿运行。

依据：`crates/viat-runtime/src/testing.rs`、Python/TypeScript/Rust SDK testing helper；`crates/viat-api/src/endpoint_test.rs`、`handlers/scripts.rs`；`crates/viat-cli/src/commands/script.rs` 和本地 runner。未执行 runtime/DB/provider 示例，真实传输、配额、并发事务需另验。
