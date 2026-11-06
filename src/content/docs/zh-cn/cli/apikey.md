---
title: "CLI：apikey"
description: "Viat 1.1.0 apikey 的完整语法、逐命令权限、输出、副作用与恢复。"
doc_id: cli.apikey
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.apikey.create","cli.apikey.list","cli.apikey.revoke"]
---

# CLI：apikey

先读 [CLI 总览](overview.md)：会话/目录、退出约定、角色边界、合成占位 ID 和执行授权规则在其中统一定义。本页逐叶补充例外；以下命令不是按顺序执行的脚本。

- [viat apikey create](#viat-apikey-create)
- [viat apikey list](#viat-apikey-list)
- [viat apikey revoke](#viat-apikey-revoke)

## viat apikey create

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat apikey create [OPTIONS] --user <USER> --name <NAME> <AUTHORIZER>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `authorizer`: `<AUTHORIZER> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `expires`: `--expires` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `name`: `--name` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `user`: `--user` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["authorizer","expires","name","user"],"id":"Create","multiple":true,"required":false}`

**输入、行为与副作用。** 先按 --user 精确查项目用户 identity，再在 api_key 认证器下签发 key。--expires 是绝对服务端时间戳，不是 humantime TTL。不是平台 PAT。

**实际输出与退出。** stdout 仅完整一次性 vsk_<key_id>.&lt;secret&gt;；stderr 为行 UUID/key_id/last4 摘要。秘密不能读回。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat apikey create demo_keys --user demo_user --name demo-client
```

**失败处理、验证与清理。** 身份不存在/认证器类型错/到期无效失败。安全保存，勿贴文档；清理用 list 的行 UUID revoke。输出丢失需撤销重签。

## viat apikey list

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat apikey list <AUTHORIZER>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `authorizer`: `<AUTHORIZER> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |

Clap 参数组（literal metadata）：`{"arguments":["authorizer"],"id":"List","multiple":true,"required":false}`

**输入、行为与副作用。** 列此 api_key 认证器下 key 元数据，不是账号 PAT。

**实际输出与退出。** 文本含 UUID、短 key_id、name、last4、revoked/active、created。无秘密，无 --json。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat apikey list demo_keys
```

**失败处理、验证与清理。** 认证器类型错失败。revoke 用首列 UUID，不是短 key_id。只读，无需清理。

## viat apikey revoke

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat apikey revoke <AUTHORIZER> <KEY_ID>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `authorizer`: `<AUTHORIZER> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `key_id`: `<KEY_ID> (#2)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["authorizer","key_id"],"id":"Revoke","multiple":true,"required":false}`

**输入、行为与副作用。** 撤销指定认证器的一个 key 行。位置参数名 key_id 易误导：必须是行 UUID，不是 token 中 12 字符 key_id。

**实际输出与退出。** stdout: revoked api_key id=&lt;UUID&gt; at=&lt;time&gt;。后续此 key 认证被拒绝。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat apikey revoke demo_keys 00000000-0000-4000-8000-000000000001
```

**失败处理、验证与清理。** apikey list 获取 UUID。无恢复撤销 CLI；重签并更新客户端，list 核查 revoked 时间/状态。

## 实现核对依据

语法来自固定 Clap 合同与 main.rs；行为/权限核对以下源文件，路径相对产品仓库根。

- `crates/viat-cli/src/commands/apikey.rs`
- `crates/viat-api/src/handlers/api_keys.rs`
