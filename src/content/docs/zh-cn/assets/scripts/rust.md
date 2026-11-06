---
title: 'Rust 脚本'
description: '将源码编译为原生产物并从类型化处理器生成 Schema。'
doc_id: script.rust
verified_release: '1.1.0'
channel: stable
---

# Rust 脚本

`rust` 表示平台使用自身 `viat` SDK 编译源码；不同于自行上传已构建协议程序的 [binary](binary.md)。构建节点需要 Rust/Cargo 和匹配 SDK；只运行节点只能获取已有产物，不能靠编译修复缺失。需要认证后的项目编辑权限；依赖在构建节点执行代码，必须审核。

## 完整最小源码

保存 `scripts/rust_echo.rs`：

```rust
#[derive(serde::Deserialize, schemars::JsonSchema)]
struct Input { value: i64 }
#[derive(serde::Serialize, schemars::JsonSchema)]
struct Output { value: i64 }
fn main() {
    viat::serve_typed(|_ctx, args: Input| -> viat::Result<Output> {
        Ok(Output { value: args.value })
    });
}
```

```bash
viat script create --name rust_echo --language rust --file scripts/rust_echo.rs
viat script build rust_echo --wait
viat script run rust_echo --args '{"value":7}'
viat script update rust_echo --file scripts/rust_echo.rs
```

预期正文 `{"value":7}`。自动生成的单文件 crate 已含 serde derive、serde_json、schemars。自带项目 manifest 需保留兼容依赖，特别是 SDK 约束要求 schemars **0.8**。无需数据库或资源。构建返回诊断；构建节点编译失败会阻止发布，不会把不存在的程序当作可运行端点。端点创建、发布、清理见[测试](testing.md)。

## 入口与上下文

`fn main()` 将控制权交给 `viat::serve` 或 `serve_typed`。Untyped 形状为 `viat::serve(|ctx: &viat::Ctx, args: serde_json::Value| -> Result<serde_json::Value, viat::Error> { ... })`。处理器需实现 `Fn`，不能消耗捕获值形成 `FnOnce`，因为预热进程会重复调用。返回 JSON/可序列化值或 SDK 错误，不要靠打印正文代替 SDK 结果。

上下文包含 `ctx.project_id`，request 的 `.method()/.path()/.query()/.header(name)/.raw()`，principal 的 `.identity()/.role()/.claims()/.is_admin()`，`ctx.log(message)`，主动读 secret 的 `ctx.get_resource(name)`，`ctx.resource(name)` broker 调用及 `ctx.ws()`。优先使用 broker 的策略/审计路径，即使旧投影存在，也不要提取连接凭证。Rust SDK **没有** `ctx.tasks`。它不等同于 Python/TypeScript 对象 API。

## 依赖、产物与 Schema

`// deps: package = "=version"` 每行增加一个 Cargo 依赖。Rust 没有 `uses:` 导入图或 pip/npm `requirements:` 环境。共享代码放项目 crate，平台拥有生成的 bin 路径和 SDK 依赖。固定版本或提交项目 Cargo.lock；按源码缓存不是依赖更新器。发布产物包含冻结 crate 输入；修改共享 crate 会使受影响 Rust 端点需要重新发布，不会修改正在服务的二进制。

类型化 Schema 来自**已编译可执行文件**的 `--viat-schema`。`serve_typed` 输出输入/输出 Schema，untyped `serve` 没有类型契约。保存清除旧 Schema，编译/发布刷新。探测会运行 main 到 serve 调用前，因此前置代码不能有副作用；探测不执行处理器本体。

产物按内容寻址并包含 SDK、工具链、host 协议输入。升级改变这些时，即使源码不变也可能需重建。普通短执行复用预热产物进程，长执行和排队执行使用单次进程。全局变量可跨调用者保留，只缓存基础设施，不缓存身份/请求。`dedicated` 不会创建 Rust 专属池。1.1.0 Rust 执行**不可取消**，但仍有超时。

## 外部编译与验证

```bash
viat script compile rust_echo --push
viat script compile --all --push
```

这是本地编译，不同于服务器 `script build`。需匹配服务器 OS/架构和 SDK digest，可用 `--sdk-path PATH` 指定。上传需运维开启产物上传。`--all` 准备已发布 Rust 产物，不是任意编辑器草稿。不要把笔记本原生程序用在不同目标上。用 `#[cfg(test)]` 和 `viat script test` 测纯函数，再构建/执行无资源示例；已发布行为需独立验证。删脚本不等于清理产物仓库。
