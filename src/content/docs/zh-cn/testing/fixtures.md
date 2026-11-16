---
title: "离线 fixture 与假资源"
description: "脚本测试准备、cassette 匹配、数据库回滚及离线宿主边界。"
doc_id: testing.fixtures
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.script.test", "cli.script.run", "cli.publish.apply"]
---

# 离线 fixture 与假资源

三种"测试"各管一层,先分清:

| 层 | 工具 | 资源 |
| --- | --- | --- |
| 本地处理器逻辑 | `viat script test`(本页) | 假资源 |
| 完整 HTTP dispatch | [端点 fixture](endpoint-tests.md) | 假资源 + scratch 实例 |
| 服务端发布门禁 | [保存用例](saved-cases.md) | **真实资源** |

本地测试不请求服务器,所以不需要项目 API 授权;但 checkout 与数据库 URL
本身仍是本地访问能力。"test"不是权限边界,也不保证脚本的直接网络访问被
阻断。支持 Python/pytest、TypeScript/bun test、Rust 内联 cargo tests——
生产有九种语言**不等于**九种对等的离线 SDK。

> [!NOTE]
> 本页示例均源码推导、未执行,数据为虚构;本任务没有安装或运行任何示例。

## 前提、发现与结果

```sh
viat script test
viat script test tests/echo
viat script test --json
```

- **Python**:uv 创建含 pytest 与声明依赖的临时环境;测试放 `tests`,脚本
  放 `scripts`。`load("folder/script")` 按 Python 的 uses 规则相对优先解析
  并做模块隔离——扁平 import 可能选错同名 `common`。
- **TypeScript**:按 bun 的 `.test.ts`/`.spec.ts` 发现;npm 依赖须已安装。
  CLI 临时注入 `node_modules/viat`,已有真实模块则拒绝覆盖,结束时移除。
- **Rust**:测试写在脚本 `.rs` 的 `cfg(test)` 里,以临时 crate/声明依赖编译;
  需要 `VIAT_RUST_SDK_PATH` 与工具链。
- **host 版本必须匹配 CLI**,查找顺序 `VIAT_TEST_HOST_BIN` → viat 同级 →
  PATH。上游用 fake 不代表包准备阶段绝不访问 registry/cache。

混合项目会运行各语言套件,任一失败即非零——不要只看第一份。`--json` 的
stdout 结构随语言不同,runner 输出走 stderr,**exit code 才是可靠的通过
信号**;解释器缺失或初始化失败不等于"覆盖了"。`viat publish apply
--require-tests` 先跑这些本地测试:它不自动运行 endpoint fixtures,也不
替代服务端用例门禁。

## 完整 fake 面

Python 用 `ctx_with(request=?,principal=?,resources=?,project_users=?,authz=?,ws=?)`
安装上下文;TypeScript 是异步 `await ctxWith({...})`,helper 名用 camelCase。
测试分支应显式设置 request/principal——省略它们不等于"生产已认证身份"。

| Fake | backing 与限制 |
| --- | --- |
| `FakeHttp(cassette)` | http_api 调用走真实 host 分发。 |
| `FakeGraphql(cassette)` | GraphQL document。 |
| `FakeCloud(cassette)` | cloud_api action。 |
| `FakeSecret(value)` | get_resource/value 的虚构值;不能放真实凭据。 |
| `FakeConfig(dict)` | 本地文档;Python `from_resource(name)` 读资源 YAML 的 plain.data,保留 `$secret` 占位值;端点 fixture **不支持** config override。 |
| `TestDb(url)` | 真实 scratch PostgreSQL,每测试一个回滚事务;不是通用 DB 模拟。 |
| `FakeStorage(root?,prefix?,max_file_bytes?,allowed_types?)` | 默认临时目录/内存元数据(显式 root 除外);沿用校验/错误形状,建模部署默认 100 MiB;URL 是 `viat-test://`,不是真实签名链接,无文件 authz/audit。 |
| `FakeUpload(path,filename?,content_type?,field?)` | `request.files` 的本地句柄,不是 HTTP multipart parser。 |
| `FakeProjectUsers(initial,fail?)` | 独立 project_users 参数而非资源;可查用户状态/注入失败;`principal is_admin false` 会拒绝;省略则 fake 不设 admin 门禁,不复现全部角色/提权防护。 |
| `FakeAuthz(model)` | 独立 authz 参数;读取 viat.yaml authz/export/dict,用**生产 policy engine**;principal 的 identity/user_id/role/admin/meta/claims 提供属性;缺失 fail closed,不是 allow-all。 |
| `FakeWs(...)` | Python/TS 本地记录连接/房间/发送/关闭,同 UUID/code 校验,无真实 socket;默认空 fake,send 为 false。Rust 有 WS event context,没有对等连接 fake。 |

未支持的资源/操作应当**失败**,而不是静默访问真实资源;不要因为生产有某个
kind,就推断 mysql、raw s3 或所有资源都可 fake。已覆盖:HTTP/GraphQL/cloud/
secret/config/Postgres/storage;TestDb 不复现 transaction.graphql 与独立
重叠连接的并发。

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

如果处理器调用 `ctx.resources.upstream.get("/thing/1")`,提供
`FakeHttp("cassettes/upstream.yaml")`;预期对象是宿主的 wire response,不是
虚构的 requests.Response:

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

cassette 匹配规则:

- 每项需要 `op`/`name` 与对应的 response;`match` 只钉住列出的请求字段,
  省略的字段是通配。
- HTTP 匹配 method/path 及可选 query/body;GraphQL document、cloud action
  用各自字段;`ignore` 在比较前移除波动 body 键。
- 重复匹配**按序消费,耗尽后重复最后一个响应**;无匹配明确失败。
- 相同 path 不同操作要钉住 body/query,或拆分情景目录;宽松录制"重放成功"
  不证明操作匹配正确。

## 回滚、副作用与取消边界

- **TestDb** 需要真实隔离 schema;裸 query 与事务块共用**一个连接**。脚本
  的 transaction 变为外层回滚事务内的 savepoint——可测顺序/嵌套,不能复现
  重叠的独立事务。块内裸 query 能看到未提交写;生产中另起连接未必可见。
  rollback 不会让 production URL 变安全:非事务/外部副作用与隔离假设仍是
  风险。
- **tasks**:离线 `ctx.tasks.enqueue` 只记录、不调度;`ctx.tasks.enqueued`
  有序,`get` 返回 queued,`cancel` 标 cancelled;会检查 target/delay/range
  语法,不检查目标存在或端点授权。控制台 Test/端点测试不自动等于纯本地
  task recorder。
- **cache**:`ctx.cache.purge` 只把规范化 GET 路径记入 `ctx.cache.purged`,
  没有真实缓存清理。
- **FakeWs** 接受不等于真实送达;**FakeStorage** 不证明文件授权/审计。

任何测试的 timeout/cancel 都不撤销已提交的外部效果。用小型确定性输入、
隔离 root/DB schema;看失败、修 fake/schema/setup 后再重跑;只清理自己创建
的产物——不能为了"看看 fake 能否工作"而真实重发消息。

## 录制是真实运行

```sh
viat script run <name> --args '<json>' --record cassettes/scenario/
```

录制会**请求真实服务器/资源**并捕获 HTTP/GraphQL/cloud 交互——这不是离线
操作。每个资源的 YAML **覆盖而非追加**,不同情景用不同目录。平台施加的
请求凭据与 secret 资源不会被录制,但**响应体原样保留**:OAuth/业务响应可能
含 token 或个人数据,提交前检查脱敏,不要录制返回秘密的流程。录制仅同步;
async 句柄不能立即返回完整 cassette。权限与副作用等同于真实草稿运行。

## 核验依据

契约源码 `03751a67`:`crates/viat-runtime/src/testing.rs`、Python/TypeScript/Rust SDK 的 testing helper;`crates/viat-api/src/endpoint_test.rs`、`handlers/scripts.rs`;`crates/viat-cli/src/commands/script.rs` 与本地 runner。未执行 runtime/DB/供应商示例;真实传输、配额、并发事务需另行验证。
