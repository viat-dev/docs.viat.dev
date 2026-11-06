---
title: "Library 资源"
description: "以原调用者身份调用冻结 Rust/binary 脚本导出函数，不是 Python import、npm 包或 uses 模块。保存 library 即发布，仅改源代码不会改变冻结构建。"
doc_id: resource.library
verified_release: '1.1.0'
channel: stable
contract_ids: [resource.library]
---

# Library 资源

以原调用者身份调用冻结 Rust/binary 脚本导出函数，不是 Python import、npm 包或 uses 模块。保存 library 即发布，仅改源代码不会改变冻结构建。

本页核对 Viat 1.1.0 稳定版。示例使用合成值/服务桩，未执行、未连接真实服务、未发送消息。先读[资源总览](index.md)。

## 前置条件与权限

先建同项目 rust/binary 脚本，根据 ctx.function 分派并自行校验参数/结果，配置资源声明与构建前置条件。Rust 不要求独立函数导出 manifest；binary 脚本须有正常的可执行 manifest/产物。library 不会替调用者获得另一主体。

## 完整配置字段

表中“必填”描述结构解析；提供方/后端的条件必填、运行时默认及限制在下节补充。`null` 仅在类型明确允许时可用，数字格式的存储上限不等于有意义的业务范围。不要依赖未知键被忽略来检测拼写。

### `plain`

未知键会被拒绝。

| 字段 | 类型/允许值 | 必填 | 省略默认 | 约束 | 含义 |
| --- | --- | --- | --- | --- | --- |
| `plain.script` | string | 是 | — | — | 相对资源文件夹解析的冻结 Rust/binary 导出脚本引用。 |

### `secret`

空对象 `{}`，本类型在这一半没有字段。

## 运行规则、默认值与限制

script 必填非空，裸名或 folder/name 从资源文件夹解析。plain 未知键拒绝，secret {}。保存解析脚本、检查语言、在可构建节点构建并冻结源码/产物，变更须再保存。移动/复制重新锚定解析。主机将函数名传给 ctx.function，不提供主机强制的函数白名单，库须自行拒绝未知名称。

### 完整测试库

保存资源前，先通过脚本编辑器/API 创建 name=scorer、folder=fixtures、language=rust 的脚本，内容如下。函数分派是应用契约，不是独立资源 schema。

```rust
use serde_json::{json, Value};
use viat::{Ctx, Error};

fn main() {
    viat::serve(|ctx: &Ctx, args: Value| -> Result<Value, Error> {
        if ctx.function.as_deref() != Some("score") {
            return Err(Error::new("unknown_function"));
        }
        let features = args.get("features").and_then(Value::as_array)
            .ok_or_else(|| Error::new("features must be an array"))?;
        let mut sum = 0.0;
        for item in features {
            sum += item.as_f64().ok_or_else(|| Error::new("features must be numbers"))?;
        }
        Ok(json!({"score": sum}))
    });
}
```

## 权限、身份与保存语义

管理 API 需要平台登录及项目成员身份。列举/查看需要成员身份；创建、PUT、PATCH、Test、refresh、copy、delete 需要有效项目角色 Owner/Admin/Developer；较低权限的 operator 角色不可写。管理权限不自动赋予上游账号权限，也不替代运行时的 s3/file/行级授权。MCP 只开放其工具清单实际声明的能力，不能把资源 schema 当作完整 MCP CRUD。

- 创建：`POST /projects/{slug}/resources`，请求为 `{name,folder?,kind,plain,secret}`。name 长度 1–64 字节且不可含 /；system 为保留名。folder 省略/空字符串表示根，非空为 [A-Za-z0-9_-]+ 段，最多 8 层/255 字节，无首尾或连续 /。
- 资源身份为同项目 `(folder,name)`，不是全项目裸名。同名可以位于不同文件夹。详情路由用 `/resources/{name}?folder=team` 显式定位；CLI 用 `team/name`。脚本裸引用按自身文件夹、根、全项目唯一名顺序解析，建议跨文件夹显式限定，Python 用 `getattr(ctx.resources, "team/name")`，TypeScript 用 `ctx.resources["team/name"]`，而非属性链。
- PUT 是完整替换：须重发正确 kind、完整 plain 与全部要保留的秘密值，不能从 show 的掩码恢复秘密。PATCH 的 kind 固定；省略 plain 保留，提供 plain 则整体替换（不是深合并）；secret 仅逐字段覆盖，省略字段保留。移动 folder 时引用在新位置重检。
- 清除可选秘密用 PATCH 显式 null（仅允许 null 的字段）或空字符串（仅允许空值的字段）；必需/条件必需字段不能清空。清除可选 plain 字段需发送去掉该字段的完整 plain，让类型默认/缺省生效。不要用 null 代替所有类型，也不要把 *** 当作旧值。
- `$keep` 是仅 PATCH/仓库同步使用的**顶层 plain 字段**占位符，保留服务端已有同名字段，连数字/布尔也可保留；新资源/不存在字段不能使用。嵌套 `$keep` 不是深合并指令。
- 仓库文件 `resources/<folder>/<name>.yaml` 由路径承载 folder，name 仍是裸名。`viat pull` 将 secret 字段写为字符串 `$secret`；`viat push` 去掉这些占位（也接受旧 !secret 标签），对已有资源 PATCH，绝不把占位当凭据。新资源必须先安全提供实际必需秘密；占位不能创建凭据。顶层 allowed_authorizers 是仓库访问同步元数据，不要擅自塞进 plain。

`$secret` 占位与凭据引用不同：`{"$secret":"name"}` 在 config/cloud 支持位置命名另一个 secret 资源；HTTP/GraphQL 字符串头用整个 `"$secret:name"`。它们不等于秘密明文，保存/读取/导出保留引用，使用时解析。目标按消费资源文件夹锚定并须已存在且为 secret 类型，不能用字符串拼接插值。

公开响应含资源标识、kind、folder、plain 及秘密摘要，不返回秘密值；摘要 *** 表示该种类声明的字段，不证明每个可选凭据实际已填。plain 会原样可读/导出；secret 通过部署秘密后端加密。脚本/依赖的发布版本按快照规则冻结，uses 无 (live) 时亦冻结，不可把所有依赖描述为每次读 live；资源读取/代理操作和显式实时 secret IO 是不同边界。

## 脚本秘密边界

提供方凭据/私密材料由平台代理操作应用，不交给脚本助手。不可使用已移除的 r.secret/r.auth_headers 写法。plain 原始头/配置仍可见，应在支持位置使用引用。

## 最小配置：管理 API / CLI 文件

下面是创建请求 JSON，同时也是合法 YAML，可作为 `resource.yaml` 交给真实 CLI 命令。域名/凭据均为测试值，生产使用前须替换并完成前置条件；不要把真实 secret 文件提交仓库。

```json
{
  "name": "demo",
  "folder": "",
  "kind": "library",
  "plain": {
    "script": "fixtures/scorer"
  },
  "secret": {}
}
```

```sh
viat project select <slug>
viat resource create --file resource.yaml
viat resource show demo --json
```

等价 API 为 `POST /projects/{slug}/resources`（相对实例管理 API 根），请求体如上。预期得到已保存资源的公开表示和掩码摘要，不是秘密回显；示例名已存在则 409。仓库同步时去掉 folder，把配置放 `resources/demo.yaml`；`viat push` 可同步完整 plain 及未被占位过滤的 secret。创建成功不保证每个远程动作成功。

## SDK 操作与示例

Python call(function,args=None,**kwargs) 可用字典或 kwargs，不能并用；TS call(function,args={})；Rust ctx.library(name).call(function,args)。参数作为运行 args 对象进入，非对象包装为 {value:…}。库自行校验参数/结果，资源不强制逐函数 schema。返回函数结果（响应包装取 body），不能为流。类型化失败传播。调用共用原调用者剩余超时及日志，最多嵌套四层并拒绝循环。离线 viat script test 不执行库调用。不表示 Python 导入或共享库 ABI。

这两个完整脚本均声明同一个根资源 demo；在获批准的测试运行中使用。写入、发送、构建和数据删除不是 dry-run。

### Python

```python
# @resource demo
from viat import ctx

def main():
    return ctx.resources.demo.call("score", {"features": [1.0, 2.5]})
```

### TypeScript

```typescript
// @resource demo
import { ctx } from "viat";

export async function main() {
  return await ctx.resources.demo.call("score", { features: [1.0, 2.5] });
}
```

### Rust

Rust 的已验证表面是 `ctx.resource(name)` 的通用 `call(op,req)`（library 用 `ctx.library`）；不是照搬 Python 方法名。下面展示对应协议调用，返回原始操作结果，可能不同于上方复合示例。

```rust
// @resource demo
use serde_json::{json, Value};
use viat::{Ctx, Error};

fn main() {
    viat::serve(|ctx: &Ctx, _args: Value| -> Result<Value, Error> {
        ctx.library("demo").call("score", json!({"features":[1,2.5]}))
    });
}
```

Shell 没有方法装饰的 ctx.resources，仅有 JSON 环境投影；不能把上述方法名直接写成 shell 函数。binary 程序可按 worker 协议实现相应 RPC，并非自动拥有 Python/TypeScript 方法。sql 语言仅用于四种 SQL 数据源，viat_gql 仅用于 PostgreSQL/MySQL/SQLite，graphql 语言用于远程 graphql，llm 语言用于 llm；不支持的组合不会自动适配。

### 预期结果

先将下方测试 Rust 脚本建为 fixtures/scorer。score 分派接受 {features:number[]}，求和得 {score:3.5}。目标脚本不存在则保存失败。源码供获批准测试运行，本页未执行。

## Test 行为与副作用

检查冻结构建存在、源脚本仍存在且草稿版本等于冻结版本。草稿更新时 Test 失败提示再保存，但调用者仍运行旧构建。Test 不调用库函数，保存可能调用构建工具链。

管理 API 使用 `POST /projects/{slug}/resources/{name}/test?folder=`；CLI 为 `viat resource test demo`。API 检查响应体 `ok`：连接失败通常仍为 HTTP 200 `{ok:false,error:"…"}`，可能附 `schema_warnings`，不能只检查状态码。CLI 失败会非零退出。仅在允许出站/文件动作后执行。

## 常见失败与恢复

resource.library.empty_script 选脚本，resource.library.script_missing/script_language/build_failed 应修复 rust/binary 脚本再保存。未知函数/参数错误来自库自身校验，须对齐冻结实现。只修源码不再保存不会更新调用。

管理错误一般为 `{error,message}`。DTO 的 `resource.<kind>.*` 经常位于 400 `bad_request` 的 message，而非顶层 error；不要把它们当成所有运行时助手都会返回的统一枚举。401 先恢复平台登录，403 检查有效项目角色/运行时规则，404 检查 folder/name，409 先解决同名或 `resource_in_use` 引用。远程拒绝与平台拒绝分开诊断，重试前判断上一次动作是否可能已生效。

## 生产注意与清理

契约版本化，破坏性变更前部署兼容调用方。嵌套资源最小权限，调用保留原身份。删除前停用调用方，源脚本和已有外部写入保留。

通用删除步骤：先停用调用脚本、代理/CRUD 目标及相关触发器，迁移依赖并保留需要的证据，再用 `viat resource delete demo` 或 DELETE 详情路由。409 `resource_in_use` 时先重新绑定/删除消息指出的端点，不应强行绕过引用。删除配置资产不等于撤销第三方凭据、删除外部数据或回滚已发生副作用。

## 相关资源与维护依据

- [Config 资源](config.md)
- [PostgreSQL 资源](postgresql.md)
- [资源总览](index.md)

固定契约：`contracts/1.1.0/resources.json` → `resource.library`。

核对实现（产品仓库相对路径）：viat-core/src/types/resource.rs (KindSpec/Plain/Secret); viat-api/src/dto.rs (normalization/validation); viat-api/src/handlers/resources.rs (CRUD/Test); viat-runtime/src/resource_io.rs, resources_json.rs, python.rs, typescript.rs; viat-api/src/runner/broker.rs; viat-cli/src/main.rs and repo/resources.rs; viat-core/src/types/snapshot.rs.
