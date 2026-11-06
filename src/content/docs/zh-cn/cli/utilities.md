---
title: "CLI：version / call / mcp"
description: "Viat 1.1.0 version / call / mcp 的完整语法、逐命令权限、输出、副作用与恢复。"
doc_id: cli.utilities
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.call","cli.mcp","cli.version"]
---

# CLI：version / call / mcp

先读 [CLI 总览](overview.md)：会话/目录、退出约定、角色边界、合成占位 ID 和执行授权规则在其中统一定义。本页逐叶补充例外；以下命令不是按顺序执行的脚本。

- [viat call](#viat-call)
- [viat mcp](#viat-mcp)
- [viat version](#viat-version)

## viat call

**前提与权限。** 普通模式需服务端配置和所选项目；端点认证器决定是否需项目 token。控制台模式需平台登录及目标路由自身角色。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat call [OPTIONS] <PATH>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `body`: `--body` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | — |
| `console`: `--console` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `method`: `--method` | `String`, 1, `Set` | 否；条件必填见行为; `GET` | — | — |
| `path`: `<PATH> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["body","console","method","path"],"id":"Call","multiple":true,"required":false}`

**输入、行为与副作用。** 默认请求 {server}/p/{selected-project}{path}，用可选 project_token 而非 access_token；无 token 仍可访问公开路由。普通模式绕过代理，仅 GET/POST/PUT/PATCH/DELETE。--console 改为绝对控制台路径，使用登录刷新/代理设置及该路由权限；无需所选项目。--body 作为 JSON content-type 字符串发送，不校验 JSON。

**实际输出与退出。** stdout 先 HTTP 状态行、再原始 body。非 2xx 先打印再退出 1。不把有效 HTTP 错误当成功业务结果。流不是实时事件渲染：收集响应文本。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat call --console /auth/whoami
```

**失败处理、验证与清理。** 可修改任意有权限路由；授权前检查 method/path/body。平台登录不自动签 project_token。401 需区分控制台会话与运行时认证器；勿把 PAT 放公开示例。以相应读取验证并显式回退，无通用撤销/重试安全。

## viat mcp

**前提与权限。** 配置 URL 和平台 JWT/PAT 字符串；启动不需已验证会话或所选项目。之后每个工具各自校验账号/项目角色。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat mcp
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |

**输入、行为与副作用。** 启动 stdio JSON-RPC 服务，不是单次工具调用。VIAT_SERVER/VIAT_TOKEN/VIAT_PROJECT 覆盖发现配置。启动需 URL/token 字符串；项目可逐工具提供。凭据在调用时验证。此客户端始终绕过 HTTP 代理；不要假定普通 CLI 的 401 刷新也适用。

**实际输出与退出。** stdout 只协议帧，诊断写 stderr。持续到客户端/stdio 关闭；配置/协议启动错误非零。进程运行或 tools/list 成功不证明服务端已激活/有访问权。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat mcp
```

**失败处理、验证与清理。** 由 MCP host 用受控配置/PAT 范围启动；之后 write/trigger/call 工具按 token 所有人项目角色产生真实效果。停止 host 只停传输，演示 PAT 须另撤销；停止不撤凭据、不撤销调用。

## viat version

**前提与权限。** 无需已有平台登录或选择项目；仍须本地文件/进程权限及下述命令专属前提。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat version
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |

**输入、行为与副作用。** 先打印 CLI 版本；若配置中有服务端和登录，再尝试认证 GET /version。与从不访问服务端的 viat --version 不同。

**实际输出与退出。** stdout 为 viat 1.1.0 (cli)，可附服务端行或不可用/未登录说明。次版本不同在 stderr 警告。服务端查询失败仍退出 0。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat version
```

**失败处理、验证与清理。** 同步前比较 CLI/服务端次版本。无需撤销；认证请求可能刷新本地会话。

## 实现核对依据

语法来自固定 Clap 合同与 main.rs；行为/权限核对以下源文件，路径相对产品仓库根。

- `crates/viat-cli/src/commands/auth.rs:277–324`
- `crates/viat-cli/src/commands/endpoint.rs:325–380`
- `crates/viat-cli/src/commands/mcp.rs`
- `crates/viat-mcp/src/{config,http,lib}.rs`
