---
title: "CLI：files"
description: "Viat 1.1.0 files 的完整语法、逐命令权限、输出、副作用与恢复。"
doc_id: cli.files
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.files.get","cli.files.list","cli.files.put","cli.files.rm"]
---

# CLI：files

先读 [CLI 总览](overview.md)：会话/目录、退出约定、角色边界、合成占位 ID 和执行授权规则在其中统一定义。本页逐叶补充例外；以下命令不是按顺序执行的脚本。

- [viat files get](#viat-files-get)
- [viat files list](#viat-files-list)
- [viat files put](#viat-files-put)
- [viat files rm](#viat-files-rm)

## 合成夹具与执行边界

这些文件只为下面例子提供输入；创建远程对象、执行脚本、数据库 SQL 或存储操作前，必须自行准备隔离项目并明确授权。生成文档不执行任何例子。

demo.txt 只含合成文本。demo_storage 必须已配置受管文件存储、元数据 PostgreSQL 和 local/S3 字节后端；CLI 不会为你开通存储/桶/数据库。文件 UUID 用 files list/put 实际返回值替换。

## viat files get

**前提与权限。** 平台登录、已选择项目，并且是该项目成员（包括 Operator）。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat files get [OPTIONS] <STORAGE> <ID>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `folder`: `--folder` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `id`: `<ID> (#2)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | 原始帮助：The file's id |
| `info`: `--info` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | 原始帮助：Print the row instead of downloading |
| `out`: `--out` | `PathBuf`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认；运行时：`清理后的已存名称，回退 file` | — | 原始帮助：Write the bytes here (default: the file's own name in the current directory). `-` for stdout |
| `storage`: `<STORAGE> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | 原始帮助：The `storage` resource |

Clap 参数组（literal metadata）：`{"arguments":["folder","id","info","out","storage"],"id":"GetArgs","multiple":true,"required":false}`

**输入、行为与副作用。** 先读元数据。--info 仅打印行 JSON；否则下载字节。默认目标为清理后的存储名称 basename；--out - 写原始 stdout。--info 不下载。

**实际输出与退出。** 仅 --out - 下载时 stdout 为原字节；文件模式 stderr 报路径/大小。可覆盖指定本地文件。--info 在 stdout 格式化 JSON。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat files get demo_storage 00000000-0000-4000-8000-000000000001 --info
```

**失败处理、验证与清理。** 文件不存在/已删或字节后端不可用失败。先 --info，再显式安全 --out 避免误覆盖；检查字节/类型，本地删除演示下载。无远程变更。

## viat files list

**前提与权限。** 平台登录、已选择项目，并且是该项目成员（包括 Operator）。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat files list [OPTIONS] <STORAGE>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `before`: `--before` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：The previous page's cursor (a `viat files list` run printed it) — keyset pagination for tables larger than one page |
| `folder`: `--folder` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：The resource's folder ('' = project root); needed only when the name is ambiguous |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | 原始帮助：Emit the raw JSON response |
| `limit`: `--limit` | `i64`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认；运行时：`服务端 100，限 1–1000` | — | 原始帮助：Max rows (default 100; the server caps it at 1000) |
| `owner_id`: `--owner-id` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：…and its id |
| `owner_type`: `--owner-type` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Files of one business object: its type… |
| `prefix`: `--prefix` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Keys under this prefix |
| `storage`: `<STORAGE> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | 原始帮助：The `storage` resource |

Clap 参数组（literal metadata）：`{"arguments":["before","folder","json","limit","owner_id","owner_type","prefix","storage"],"id":"ListArgs","multiple":true,"required":false}`

**输入、行为与副作用。** 从 storage 资源列受管文件元数据，可按 owner/prefix/游标筛。控制台成员授权读取；数据面 file authz 是另一边界。

**实际输出与退出。** 文本为 UUID/大小/owner/上传/key 和下一游标；--json 含分页元数据。无 --limit 用服务端默认页大小。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat files list demo_storage --limit 10 --json
```

**失败处理、验证与清理。** 需配置元数据 PostgreSQL 和字节后端；storage/folder/游标错误失败。get/rm 复制真实 UUID。不改字节；保护输出。

## viat files put

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 已有隔离 demo_storage，包括元数据 PostgreSQL 和 local/S3 字节后端；demo.txt 为合成文本。无真实配置存储不能成功。

```text
Usage: viat files put [OPTIONS] <STORAGE> <FILE>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `content_type`: `--content-type` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认；运行时：`服务端按已存名称推断` | — | 原始帮助：The content type (default: guessed from the name by the server) |
| `file`: `<FILE> (#2)` | `PathBuf`, 1, `Set` | 是; Clap 无显式默认 | — | 原始帮助：The local file to store |
| `folder`: `--folder` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |
| `key`: `--key` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认；运行时：`<新 UUID>/<name>` | — | 原始帮助：The key (default: `<id>/<name>`); refused when a live file has it |
| `name`: `--name` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认；运行时：`本地文件 basename` | — | 原始帮助：The stored name (default: the local file's) |
| `owner_id`: `--owner-id` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | — |
| `owner_type`: `--owner-type` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | — |
| `reason`: `--reason` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：The reason, for a metadata table whose audit block requires one |
| `storage`: `<STORAGE> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | 原始帮助：The `storage` resource |

Clap 参数组（literal metadata）：`{"arguments":["content_type","file","folder","json","key","name","owner_id","owner_type","reason","storage"],"id":"PutArgs","multiple":true,"required":false}`

**输入、行为与副作用。** 读本地文件以控制台账号上传；可带 key/name/content-type/owner/reason。默认 key 为生成 id/name；key 冲突拒绝，不替换。脚本不获得 storage 凭据。

**实际输出与退出。** 文本含新 UUID/key/大小；--json 元数据行。写字节后端及元数据/审计；真实存储立即生效。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat files put demo_storage demo.txt --reason 'synthetic demo upload' --json
```

**失败处理、验证与清理。** 409 file_exists/413 file_too_large/415 file_type_not_allowed 或缺审计 reason 可失败。以返回 UUID 执行 files get --info 验证。清理用 files rm 并给需要 reason；仅删本地源文件不够。

## viat files rm

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat files rm [OPTIONS] <STORAGE> <ID>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `folder`: `--folder` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `id`: `<ID> (#2)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | 原始帮助：The file's id |
| `reason`: `--reason` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：The reason, on the audit trail (required by a `reason_required` table) |
| `storage`: `<STORAGE> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | 原始帮助：The `storage` resource |

Clap 参数组（literal metadata）：`{"arguments":["folder","id","reason","storage"],"id":"RmArgs","multiple":true,"required":false}`

**输入、行为与副作用。** 以控制台身份软删元数据（行保留删除标记）并删除字节。元数据审计策略要求时必须 --reason。

**实际输出与退出。** stdout: deleted &lt;UUID&gt;。不是可恢复回收站，也不删本地上传源。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat files rm demo_storage 00000000-0000-4000-8000-000000000001 --reason 'remove synthetic demo'
```

**失败处理、验证与清理。** UUID 错/文件不存在/缺 reason/后端失败可报错。list 确认不再列出；删除前保留源/备份。重传是新文件身份，不自动恢复旧行/授权。

## 实现核对依据

语法来自固定 Clap 合同与 main.rs；行为/权限核对以下源文件，路径相对产品仓库根。

- `crates/viat-cli/src/commands/files.rs`
- `crates/viat-api/src/handlers/files.rs`
