---
title: "CLI：license"
description: "Viat 1.1.0 license 的完整语法、逐命令权限、输出、副作用与恢复。"
doc_id: cli.license
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.license.activate","cli.license.show"]
---

# CLI：license

先读 [CLI 总览](overview.md)：会话/目录、退出约定、角色边界、合成占位 ID 和执行授权规则在其中统一定义。本页逐叶补充例外；以下命令不是按顺序执行的脚本。

- [viat license activate](#viat-license-activate)
- [viat license show](#viat-license-show)

## viat license activate

**前提与权限。** 平台 Admin/Owner；项目角色不能赋予此平台权限。 仅在明确授权激活后，通过受保护 stdin 提供真实有效客户 code。可无 code 检查 argv 语法；此例不代表已签发 code 或可成功激活夹具。

```text
Usage: viat license activate [OPTIONS] <CODE>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `code`: `<CODE> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |

Clap 参数组（literal metadata）：`{"arguments":["code","json"],"id":"Activate","multiple":true,"required":false}`

**输入、行为与副作用。** POST /license/activate 以官方镜像内嵌验证 key 校验合法 code。CODE=- 从 stdin 读并去空白；不需项目。属于客户激活，不是厂商发 key/code。

**实际输出与退出。** 文本: activated. 然后许可证状态；--json 输出状态。接受后更新部署激活。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat license activate -
```

**失败处理、验证与清理。** 空/格式错/签名错/过期/不兼容 code 失败。勿自创或生成厂商签名 key。获取正确 code，之后 license show 验证；无 CLI deactivate/revoke。勿公开真实 code。

## viat license show

**前提与权限。** 已配置服务端并完成平台登录；无需选择项目。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat license show [OPTIONS]
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |

Clap 参数组（literal metadata）：`{"arguments":["json"],"id":"Show","multiple":true,"required":false}`

**输入、行为与副作用。** GET /license 读取部署激活状态，不需项目；未激活时仍可访问。

**实际输出与退出。** 文本为可用的 status/customer/expiry/activation/license ID 或 NOT ACTIVATED；--json 原状态。未激活也是读取成功（0）。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat license show --json
```

**失败处理、验证与清理。** 其他命令的 403 license_required 不能靠项目角色解决。通过授权供应方取得有效 code；无变更/清理。

## 实现核对依据

语法来自固定 Clap 合同与 main.rs；行为/权限核对以下源文件，路径相对产品仓库根。

- `crates/viat-cli/src/commands/license.rs`
- `crates/viat-api/src/handlers/license.rs`
