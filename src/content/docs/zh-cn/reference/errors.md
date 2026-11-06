---
title: 错误与结果边界
description: 解析 Viat 错误外层，区分传输和执行失败，并在不盲目重试的前提下恢复。
doc_id: reference.errors
verified_release: '1.1.0'
channel: stable
---

# 错误与结果边界

应分别检查**传输状态、响应外层和业务/执行结果**。HTTP 200、CLI 退出 0 或 MCP `isError: false`，都不普遍保证脚本成功、构建就绪或通知已送达。

## 标准管理错误

多数应用 handler 返回状态码和以下 JSON 形状：

```json
{"error":"bad_request","message":"A human-readable explanation"}
```

匹配该端点规定的机器字段；保留 message 用于诊断，但不要通过拆分英文句子实现通用控制流。代理故障、连接故障及框架层异常响应可能没有这个外层，应检查内容类型，不能把非 JSON 响应当成功。

| HTTP / `error` | 含义 | 恢复 |
| --- | --- | --- |
| 400 / `bad_request` | 输入无效或配置不兼容 | 修正字段、类型和条件；原样重复请求无益。 |
| 401 / `unauthorized` | 当前表面缺少有效凭据，或凭据过期 | 使用正确的平台或项目身份；在支持时刷新/重新登录，不要换用另一个身份平面的 token。 |
| 403 / `forbidden` | 已识别身份无权访问，或策略拒绝 | 检查项目成员、有效角色、PAT 限域和已发布 authz 契约。平台 Admin 不绕过所有项目检查。 |
| 403 / `license_required` | 产品激活门禁锁定 | 平台 Owner/Admin 激活或续期；更换凭据或重启不是绕过方法。 |
| 404 / `not_found` | 对象/路由不存在或不可用 | 核对实例、项目、folder/name 与 UUID，以及公开路由是否已发布。 |
| 409 / `conflict` | 状态或身份冲突 | 阅读具体 message；重名、依赖引用和正在执行的幂等请求是不同问题。 |
| 429 / `rate_limited` | 凭据端点限流 | 遵守 `Retry-After`，不要紧密循环重试密码或 token exchange。 |
| 500 / `internal` | 未处理的服务端失败 | 保存请求上下文、查看运维日志，不假定写入已回滚。管理内部详情写日志，不原样返回。 |

某些 handler 会使用更具体的顶层拒绝码和状态，例如文件/链接错误，由对应功能参考说明。`resource.<kind>.*` 等资源 DTO 标识经常位于 400 的 `message` 中，**不保证**是顶层 `error`。普通 409 的 message 提到依赖，不代表存在一个同名机器错误码。

## 刻意不同的外层

| 表面 | 差异 | 客户端要求 |
| --- | --- | --- |
| 工作流解析/验证 | 400 含 `error: bad_request`、额外 `code` 和 `message` | 匹配工作流专用 `code`，见[工作流错误处理](../assets/workflows/error-handling.md)。 |
| 凭据限流 | 标准 JSON，加 `Retry-After` 头 | 保留该头并退避。 |
| 项目 OAuth token 端点 `/p/{slug}/_token` | RFC 6749 的 `error`、`error_description` | 使用 OAuth 客户端，不要要求一定有 `message`。 |
| 密码登录要求 MFA | 401 `mfa_required` 或 `mfa_enrollment_required`，含 `mfa_ticket` | 继续指定 MFA/登记流程，不是重复输密码；不要记录 ticket。 |

工作流解析响应示意：

```json
{"error":"bad_request","code":"workflow.empty_parallel","message":"A workflow validation explanation"}
```

这里的 message 是示意，不是固定的服务端原句。

## 运行时与已发布 HTTP 失败

执行日志使用 `error_kind` 分类：`unauthorized`、`forbidden`、`not_found`、`bad_request`、`runtime`、`system`、`user`、`conflict`、`overload`。它与响应中的 `error` 字符串**不是同一个字段**。runtime/system 通常映射为 HTTP 500 和 `internal`；脚本显式 user error 可以提供自己的状态、code、message 和额外数据。

工作池队列耗尽、排队超时、脚本 broken、依赖环境未就绪或工作进程启动失败，都可能表现为 **503 `overload`**。dispatch 的 overload 响应带重试提示，但这不会把永久依赖安装失败变成瞬时问题，应先查看环境的实际错误。发布可能清除 broken 标记，却不修复根因。

正在执行的幂等请求冲突在 early dispatch 路径返回 `Retry-After: 1`，不能把它套到所有管理 409。超时或响应丢失也不证明上游写入没有发生；重放前使用端点真实的幂等契约，或检查持久业务状态。

工作流自动重试范围刻意小于“任意错误”：包括 queue-full/wait-timeout、broken/spawn failure、timeout 和 transport。user/script error、environment-not-ready 不会仅因外层状态类似 overload 就自动可重试。上游 HTTP 错误响应不是网络 transport failure；取消绕过常规恢复。尝试次数、catch/continue 和边界见[工作流参考](../assets/workflows/error-handling.md)。

## 传输成功，操作未必成功

| 结果 | 要检查什么 |
| --- | --- |
| 资源 Test HTTP 200 | 正文可能 `ok: false` 并带 error；Test 可能已经认证、发网络请求、建文件或写探针。 |
| 脚本草稿测试 HTTP 响应 | 检查 `ok`、错误和日志。成功显式 `ViatResponse`/流可能仍为 `output: null`，须另查发布 HTTP 响应。 |
| Publish 接受 / CLI 退出 0 | 查看每个 build 的 `ok`、诊断和 pending；配置允许时，接受可与失败/待完成构建并存。 |
| 异步请求接受 | 只表示 run 已接受，不是已完成；轮询正确 run 并检查终态。 |
| Workflow CLI 非零 | CLI 1.1.0 会因任一失败 attempt 非零，即使 catch/continue/retry 后恢复；结合最终运行输出和 attempt 记录判断。 |
| MCP `isError: false` | 解析 `result.content[0].text` 中的 JSON，再检查端点状态或执行结果；工具传输成功不是业务成功。 |
| 提供商接受推送/消息 | 不证明设备已投递、显示或被用户阅读。 |

## 安全的诊断顺序

1. 核对实例、项目、操作者和安装版本，记录方法/路径、时间窗及可用的 request/run 标识。
2. 阅读 HTTP 状态和完整响应形状，区分管理请求、公开端点、OAuth、测试结果或 MCP 外层。
3. 检查匹配的执行、构建和环境证据。拒绝日志证明平台看见请求，不证明脚本执行过。
4. 401/403 先解决身份、成员、策略；无效输入修契约；overload 查容量/环境；transport 查**服务端**到上游的路径。
5. 重试修改前判断上次是否可能已生效。不要为消除错误而添加确认标志、移除门禁、关闭 TLS 验证或删除无关对象。
6. 保存脱敏复现，不保存凭据、MFA ticket、Cookie、完整资源投影或私有用户数据。

选好获准项目后的只读日志示例：

```sh
viat logs query --limit 10 --json
viat script env hello --json
```

把 `hello` 换成实际脚本。普通环境读取不是 build/probe；`--probe` 有不同权限并启动探测进程。只读操作不需清理对象，但导出证据应按敏感程度保存和移除。

## 核验依据

`crates/viat-api/src/error.rs`、`handlers/dispatch.rs`、runner 分类、`crates/viat-core/src/{error.rs,types/log.rs}`、`crates/viat-runtime/src/error.rs` 及各 CLI/MCP 参考。表格总结常见错误族，不封闭枚举应用可自行定义的全部 user error。
