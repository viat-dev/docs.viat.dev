---
title: '测试与提取 Schema'
description: '离线测试、真实草稿执行和 Schema 提取限制。'
doc_id: script.testing
verified_release: '1.1.0'
channel: stable
---

# 测试与提取 Schema

三种操作不同：`viat script test` 运行**本地离线**测试；`viat script run NAME --args JSON` 在服务器执行已保存的**实时草稿**；发布端点才冻结公共调用目标。离线通过或草稿成功都不会修改已发布端点。

## 最小 Python 离线用例

在已有本地项目保存 `scripts/hello.py`：

```python
from viat import ctx

def main(name: str = "world"):
    ctx.logger.info("greet", who=name)
    return {"hello": name}
```

保存 `tests/test_hello.py`：

```python
from viat.testing import ctx_with
from hello import main

def test_hello():
    ctx_with()
    assert main(name="Ada") == {"hello": "Ada"}
```

```bash
viat script test tests/test_hello.py
viat script test --json
```

本地需要 `uv`、Python。CLI 构建含脚本 requirements 的临时 pytest 环境，将 `scripts/`、`tests/` 加入导入路径。文件夹内 `uses:` 使用 `from viat.testing import load`，再调用 `load("folder/name").main(...)`；平铺导入无法隔离不同文件夹的同名模块。

TypeScript 需要 Bun。对应 `scripts/hello.ts` 和 `tests/hello.test.ts`：

```typescript
// scripts/hello.ts
import { ctx } from "viat";
export async function main(args: { name: string }): Promise<{ hello: string }> {
  ctx.logger.info("greet", { who: args.name });
  return { hello: args.name };
}
```

```typescript
// tests/hello.test.ts
import { test, expect } from "bun:test";
import { ctxWith } from "viat/testing";
import { main } from "../scripts/hello";
test("hello", async () => {
  ctxWith({});
  expect(await main({ name: "Ada" })).toEqual({ hello: "Ada" });
});
```

```bash
viat script test tests/hello.test.ts
```

运行器按找到的语言选择 pytest、Bun 和 Rust `#[cfg(test)]` 测试，不是通用 SQL/shell/LLM 解释器。缺失本地工具是未满足前置条件，不能算测试通过。

## 替身、权限与副作用

测试 host 用固定数据回答真实资源 RPC。支持 HTTP、GraphQL、cloud、secret、config、托管存储与 PostgreSQL 等替身。`TestDb(url)` 使用**真实的临时 PostgreSQL 数据库**，每个测试包裹在回滚事务中，broker 事务用 savepoint 模拟。因此并非完全无网络，绝不能指向生产。单连接不能忠实复现并发重叠事务。

`ctx_with(resources={...}, request={...}, principal={...})` / `ctxWith({...})` 提供上下文。涉及授权、用户管理、WebSocket 时使用 FakeAuthz/FakeProjectUsers/FakeWs；宽松或缺失的替身不能证明生产授权正确。不支持的 helper 会失败，不会偷偷访问真实资源。1.1.0 尚未覆盖 MySQL、S3 和事务内 GraphQL。Cassette 记录/重放 HTTP 型 I/O，不代表所有协议。

`ctx.tasks.enqueue` 记录到 `ctx.tasks.enqueued`，`get/cancel` 操作记录器，`ctx.cache.purged` 记录清除请求。只有离线测试如此。服务器草稿/Test 可真实发送邮件、push、消息、写 secret 和创建任务。`viat script run hello --record cassettes` 本身也是真实执行；需要明确同意，并检查 cassette 中是否含敏感业务数据。

## 提取矩阵

| 语言 | 输入/输出提取及限制 |
| --- | --- |
| Python | 解析 `main` 注解、默认值和支持的本地类型结构。缺失/不支持的注解使字段开放并可能警告；`Optional[T]`、`T \| None`、默认 None 接受 null。返回注解不能证明所有运行时返回。 |
| TypeScript | 优先 `export function main(args: { ... }): Promise<{ ... }>`；支持基本类型、数组、对象字面类型和联合。命名/导入/复杂类型可退化为 `{}`，不是全程序类型检查。可选属性不等于可空。运行时可接受默认导出，但提取器寻找具名 main 声明。 |
| SQL | `:name` 配合 `-- @input name:type[=default]`；未注解占位符默认必填 string 并警告。输出只有 rows/affected 结构，不含精确列。提取扫描器比实际 SQL 绑定简单，特殊 cast/dollar quote 可能产生误导性参数。 |
| Shell | 头部 `# @input`；无法静态提取输出，总有警告。默认值为字符串。 |
| GraphQL | 只取**第一个**操作的变量，多操作警告。自定义 scalar/enum/input object 不展开。提取输出描述 data/errors 信封，但真实运行器只返回 `data`，不能当作观察结果。 |
| `viat_gql` | 尚不支持提取，开放 Schema 并警告。数据库 Schema 内省是另一回事。 |
| `llm` | `{{name}}` 形成必填 string 输入；输出 content/model/usage，不验证模型事实正确性。 |
| Rust | 编译后运行 `--viat-schema`；`serve_typed` 提供 serde/schemars Schema。保存会清空，编译/发布刷新。Untyped serve 没有类型化 Schema。 |
| Binary | 不提取 I/O Schema、不运行 Schema 探测；端点输入开放，但必须满足进程协议。 |

提取失败通常是警告/开放 Schema，不是统一拒绝源码。检查 `schema_warnings` 与保存的 Schema，再验证端点绑定和拒绝行为。不能假设 JSON Schema 默认值会填充缺失输入；工作流引擎会显式应用工作流输入默认值，见[工作流语法](../workflows/overview.md)。

## 草稿、发布与清理命令

执行前先[完成实例认证](../../instance/platform-users.md)，再[选择隔离项目](../../projects/create-and-collaborate.md)。`ENDPOINT_ID` 替换为创建返回的 ID，不是名称参数。

```bash
viat script create --name hello --language python --file scripts/hello.py
viat script update hello --file scripts/hello.py
viat script run hello --args '{"name":"Ada"}'
viat endpoint create --segment hello --method POST --script hello
viat endpoint publish ENDPOINT_ID
viat script logs hello
viat endpoint unpublish ENDPOINT_ID
viat endpoint delete ENDPOINT_ID
viat script delete hello
```

预期脚本正文为 `{"hello":"Ada"}`，`script run` 将成功输出美化为 JSON 打印到 stdout，诊断 stderr 单独显示。发布可能因警告或测试门槛拒绝，应修复，不要自动确认。CLI 不绕过项目成员、编辑权限或公共端点认证。删除是真实操作，不属于离线测试。本文没有执行测试或真实服务调用。
