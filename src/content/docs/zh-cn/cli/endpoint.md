---
title: "CLI：endpoint"
description: "Viat 1.1.0 endpoint 的完整语法、逐命令权限、输出、副作用与恢复。"
doc_id: cli.endpoint
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.endpoint.create","cli.endpoint.delete","cli.endpoint.history","cli.endpoint.list","cli.endpoint.publish","cli.endpoint.purge-cache","cli.endpoint.rollback","cli.endpoint.show","cli.endpoint.test","cli.endpoint.unpublish","cli.endpoint.update-auth","cli.endpoint.update-info"]
---

# CLI：endpoint

先读 [CLI 总览](overview.md)：会话/目录、退出约定、角色边界、合成占位 ID 和执行授权规则在其中统一定义。本页逐叶补充例外；以下命令不是按顺序执行的脚本。

- [viat endpoint create](#viat-endpoint-create)
- [viat endpoint delete](#viat-endpoint-delete)
- [viat endpoint history](#viat-endpoint-history)
- [viat endpoint list](#viat-endpoint-list)
- [viat endpoint publish](#viat-endpoint-publish)
- [viat endpoint purge-cache](#viat-endpoint-purge-cache)
- [viat endpoint rollback](#viat-endpoint-rollback)
- [viat endpoint show](#viat-endpoint-show)
- [viat endpoint test](#viat-endpoint-test)
- [viat endpoint unpublish](#viat-endpoint-unpublish)
- [viat endpoint update-auth](#viat-endpoint-update-auth)
- [viat endpoint update-info](#viat-endpoint-update-info)

## viat endpoint create

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat endpoint create [OPTIONS] --segment <SEGMENT>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `authorizers`: `--authorizers` | `String`, 1, `Append` | 否；条件必填见行为; Clap 无显式默认 | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `method`: `--method` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | — |
| `override_authorizers`: `--override-authorizers` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |
| `override_permissions`: `--override-permissions` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |
| `parent`: `--parent` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | — |
| `script`: `--script` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | — |
| `segment`: `--segment` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `tree`: `--tree` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | — |
| `workflow`: `--workflow` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | 冲突 ID：script |

Clap 参数组（literal metadata）：`{"arguments":["authorizers","method","override_authorizers","override_permissions","parent","script","segment","tree","workflow"],"id":"Create","multiple":true,"required":false}`

**输入、行为与副作用。** 创建草稿分支/叶，使用 --segment、可选 parent/tree、method 和 script/workflow。--tree 可解析 UUID/名称。--authorizers 每次一名称，可重复；本命令不按逗号拆分。此命令不能表达 CRUD/proxy/authz gate 配置；使用仓库/控制台 API。

**实际输出与退出。** stdout: created &lt;method-or-DIR&gt; &lt;path&gt;，再 id: &lt;UUID&gt;。不激活发布路由。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat endpoint create --segment demo --method GET --script demo_echo
```

**失败处理、验证与清理。** 保留路径、父节点/segment/目标组合无效、tree 不存在会失败。list/show 验证后有意发布。清理时用返回 ID 删除演示叶。

## viat endpoint delete

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat endpoint delete <ID>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `id`: `<ID> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["id"],"id":"Delete","multiple":true,"required":false}`

**输入、行为与副作用。** 删除节点；分支级联删除子节点，可移除活跃路由。不只是 unpublish。内建 auth 节点受保护。

**实际输出与退出。** stdout: deleted &lt;id&gt;；DELETE 成功 0。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat endpoint delete 00000000-0000-4000-8000-000000000001
```

**失败处理、验证与清理。** 先备份仓库/定义、检查后代。用 list 与路由验证；重建需新节点和有意发布，不是简单 rollback 删除。

## viat endpoint history

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin；Developer/Operator 不可发布。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat endpoint history <ID>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `id`: `<ID> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["id"],"id":"History","multiple":true,"required":false}`

**输入、行为与副作用。** 读单端点快照历史；不同于项目 publish history，此读取需 publisher。

**实际输出与退出。** 文本行含 vN、method（或 *）、路径及可用的 script/workflow@version。无 --json。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat endpoint history 00000000-0000-4000-8000-000000000001
```

**失败处理、验证与清理。** UUID 不存在/非叶会失败。用于确认发布/回滚版本；无变更/清理。

## viat endpoint list

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat endpoint list [OPTIONS]
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |

Clap 参数组（literal metadata）：`{"arguments":["json"],"id":"List","multiple":true,"required":false}`

**输入、行为与副作用。** 列草稿端点节点，不是运行时请求。文本是缩减视图；ID/发布状态元数据须用 --json。

**实际输出与退出。** 文本为 method/DIR、path、script 绑定、authorizer 名称/inherit 和 type.action gate/inherit（无 UUID）；--json 完整列表。此读取需 editor，不同于 script list。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat endpoint list --json
```

**失败处理、验证与清理。** 即使能读项目其他内容，无此权限仍失败。后续端点命令用返回 UUID；无变更/清理。

## viat endpoint publish

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin；Developer/Operator 不可发布。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat endpoint publish [OPTIONS] <ID>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `acknowledge_test_failures`: `--acknowledge-test-failures` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | 原始帮助：Publish even if enabled test cases (the server regression gate) fail |
| `acknowledge_warnings`: `--acknowledge-warnings` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | 原始帮助：Publish even if the server reports warnings (they are recorded on the revision); without it a warning refuses the publish |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `id`: `<ID> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["acknowledge_test_failures","acknowledge_warnings","id"],"id":"Publish","multiple":true,"required":false}`

**输入、行为与副作用。** 发布此叶草稿快照并构建依赖。仅相应 --acknowledge-* 可越过警告/回归拒绝；不询问确认。改变线上路由。

**实际输出与退出。** 打印 published METHOD path as vN、build ok/FAILED 与可选环境待构建说明。成功发布响应即使含失败 build，CLI 仍 0：须检查行，不只退出码。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat endpoint publish 00000000-0000-4000-8000-000000000001
```

**失败处理、验证与清理。** 警告/测试可通过 HTTP 错误拒绝；修复或审查后显式确认。用例可访问真实资源。history 和经授权路由验证；rollback 恢复旧快照，不撤销外部测试/构建效果。

## viat endpoint purge-cache

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin；Developer/Operator 不可发布。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat endpoint purge-cache <ID>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `id`: `<ID> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["id"],"id":"PurgeCache","multiple":true,"required":false}`

**输入、行为与副作用。** POST cache/purge，跨实例失效此端点响应缓存；不删端点、不改缓存配置。

**实际输出与退出。** stdout: purged the cached responses of &lt;id&gt;。后续匹配 GET 可重新执行运行时。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat endpoint purge-cache 00000000-0000-4000-8000-000000000001
```

**失败处理、验证与清理。** 需端点存在及 publisher，只有 editor 不足。用授权请求/缓存指标核查；无反向填缓存命令，之后触发运行效果不可撤销。

## viat endpoint rollback

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin；Developer/Operator 不可发布。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat endpoint rollback <ID>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `id`: `<ID> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["id"],"id":"Rollback","multiple":true,"required":false}`

**输入、行为与副作用。** 恢复上一个端点快照，不接受任意版本参数。不恢复当前草稿、不回退外部数据库。

**实际输出与退出。** stdout: rolled back to vN (&lt;snapshot-id&gt;)；立即改变线上路由内容。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat endpoint rollback 00000000-0000-4000-8000-000000000001
```

**失败处理、验证与清理。** 无前快照/非叶/不存在端点会失败。操作前后读 history；之后 publish 使用当前草稿，重发前先检查。

## viat endpoint show

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat endpoint show [OPTIONS] <ID>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `id`: `<ID> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `json`: `--json` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |

Clap 参数组（literal metadata）：`{"arguments":["id","json"],"id":"Show","multiple":true,"required":false}`

**输入、行为与副作用。** 按 UUID 读草稿节点及有效配置；UUID 不是路由路径/脚本名。

**实际输出与退出。** 默认文本为缩减 EndpointView 的格式化 JSON（id/parent/segment/method/script/path/authorizer/gate/override）；--json 输出服务端完整对象，包含额外目标/发布字段。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat endpoint show 00000000-0000-4000-8000-000000000001 --json
```

**失败处理、验证与清理。** 项目/UUID 错误会失败。编辑前保存；show 不证明线上调用已使用草稿。无需清理。

## viat endpoint test

**前提与权限。** 配置中必须已选择项目 slug，并在本地仓库根运行；不需可用平台会话/服务端，执行使用临时 host 和专用 PostgreSQL 基础 URL。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat endpoint test [DIR]
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `dir`: `<DIR> (#1)` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认；运行时：`endpoint_tests/` | — | 原始帮助：Directory of `*.yaml` fixtures (default: `endpoint_tests/`) |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |

Clap 参数组（literal metadata）：`{"arguments":["dir"],"id":"Test","multiple":true,"required":false}`

**输入、行为与副作用。** 通过临时实例真实 dispatch 和假资源运行端点夹具（默认 endpoint_tests/）。在临时服务端植入/push/publish 本地仓库。需 VIAT_ENDPOINT_TEST_DB 专用基础 PostgreSQL URL 和匹配 viat-endpoint-test-host，不是登录服务端。

**实际输出与退出。** 文本逐夹具 ok/FAIL，再 N passed, N failed。任一失败退出 1。目录不存在或未发现任何 YAML/YML 夹具也是错误（不是空套件绿色通过）。dispatch 前核对 host 版本；临时 publish 显式确认警告和保存回归用例失败。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat endpoint test endpoint_tests
```

**失败处理、验证与清理。** 创建后删除临时数据库；使用有建库/删库权限的隔离 PostgreSQL 账号，不用生产。启动/清理失败查 host 诊断，确认无进程使用后仅删指定临时库。测试代码本身仍需审查外呼。

## viat endpoint unpublish

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin；Developer/Operator 不可发布。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat endpoint unpublish <ID>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `id`: `<ID> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["id"],"id":"Unpublish","multiple":true,"required":false}`

**输入、行为与副作用。** 从路由移除此叶活跃快照，保留草稿/历史。

**实际输出与退出。** stdout: unpublished &lt;id&gt;；立即影响线上可用性。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat endpoint unpublish 00000000-0000-4000-8000-000000000001
```

**失败处理、验证与清理。** 非叶/受保护/不存在端点会失败。history/show 核查；有意 publish 恢复（当前草稿可不同于刚移除快照）。

## viat endpoint update-auth

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat endpoint update-auth [OPTIONS] <ID>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `authorizers`: `--authorizers` | `String`, 1, `Append` | 否；条件必填见行为; Clap 无显式默认 | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `id`: `<ID> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `override_authorizers`: `--override-authorizers` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |
| `override_permissions`: `--override-permissions` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |

Clap 参数组（literal metadata）：`{"arguments":["authorizers","id","override_authorizers","override_permissions"],"id":"UpdateAuth","multiple":true,"required":false}`

**输入、行为与副作用。** PUT 草稿 allowed_authorizers 和 override。最近声明认证器列表替换祖先；authz gate 累加到 override_permissions 停止。无旧 permissions 参数，也不编辑 gate。省略 override 布尔仍发送 false。省略 --authorizers 会发 null，将本地列表重置为继承，并非保留。多个名称重复 --authorizers（不拆逗号）。CLI 不发送 authz_gates，已有 gate 保留。

**实际输出与退出。** stdout: updated auth for &lt;path&gt;。发布前运行时快照不变；子节点可继承草稿变化。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat endpoint update-auth 00000000-0000-4000-8000-000000000001 --authorizers demo_password
```

**失败处理、验证与清理。** 未知认证器/受保护内建节点会失败。先检查旧有效认证并保存；若已交付，恢复认证并重发受影响端点。

## viat endpoint update-info

**前提与权限。** 平台登录、已选择项目，有效项目角色为 Owner/Admin/Developer。Operator 不可用，包括只读形式。 以下合成名称仅用于隔离演示项目；标识符请替换成该项目 list/create 返回的值。

```text
Usage: viat endpoint update-info [OPTIONS] <ID>
```

**命令别名：** 无。

| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |
| --- | --- | --- | --- | --- |
| `clear_method`: `--clear-method` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |
| `clear_script`: `--clear-script` | `bool`, 0, `SetTrue` | 否；条件必填见行为; `false` | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | 否；条件必填见行为; Clap 无显式默认 | — | 原始帮助：Print help |
| `id`: `<ID> (#1)` | `String`, 1, `Set` | 是; Clap 无显式默认 | — | — |
| `method`: `--method` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | — |
| `script`: `--script` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | — |
| `segment`: `--segment` | `String`, 1, `Set` | 否；条件必填见行为; Clap 无显式默认 | — | — |

Clap 参数组（literal metadata）：`{"arguments":["clear_method","clear_script","id","method","script","segment"],"id":"UpdateInfo","multiple":true,"required":false}`

**输入、行为与副作用。** PUT 只发送提供的 segment/method/script；--clear-method/--clear-script 显式发 null。不能重绑所有目标类型（无 workflow/resource 替换参数）。

**实际输出与退出。** stdout: updated info for &lt;path&gt;；改草稿标识/绑定，不改活跃快照。 除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。

**合成调用示例（只校验语法，不执行）。**

```sh
viat endpoint update-info 00000000-0000-4000-8000-000000000001 --segment demo-renamed
```

**失败处理、验证与清理。** clear 不是解析冲突：同时传值和其 clear 标记时以 clear 为准。结果分支/叶状态无效仍可在服务端校验失败。保存 show 输出，核查节点后有意发布；回退旧字段并发布以撤销线上变更。

## 实现核对依据

语法来自固定 Clap 合同与 main.rs；行为/权限核对以下源文件，路径相对产品仓库根。

- `crates/viat-cli/src/commands/endpoint.rs`
- `crates/viat-cli/src/commands/endpoint_test.rs`
- `crates/viat-api/src/handlers/endpoints.rs`
- `crates/viat-api/src/handlers/snapshots.rs`
