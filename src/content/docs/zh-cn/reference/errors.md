---
title: 错误与结果边界
description: 解析 Viat 错误外层，区分传输和执行失败，并在不盲目重试的前提下恢复。
doc_id: reference.errors
verified_release: '1.1.0'
channel: stable
---

# 错误与结果边界

分别检查**传输状态、响应外层、业务/执行结果**三层。HTTP 200、CLI 退出 0
或 MCP `isError: false`,都**不普遍保证**脚本成功、构建就绪或通知已送达。

## 标准管理错误

多数应用 handler 返回状态码加以下 JSON 形状:

```json
{"error":"bad_request","message":"A human-readable explanation"}
```

匹配该端点规定的机器字段;`message` 留作诊断——**不要**靠拆英文句子做
通用控制流。代理故障、连接故障与框架层异常响应可能没有这个外层:检查
Content-Type,**不能**把非 JSON 响应当成功。

| HTTP / `error` | 含义 | 恢复 |
| --- | --- | --- |
| 400 / `bad_request` | 输入无效或配置不兼容 | 修正字段、类型与条件;原样重复请求无益 |
| 401 / `unauthorized` | 当前表面缺有效凭据,或凭据过期 | 用正确的平台或项目身份;支持时刷新/重登——**不要**换用另一身份平面的 token |
| 403 / `forbidden` | 已识别身份无权,或策略拒绝 | 查项目成员、有效角色、PAT 限域与已发布 authz 契约;平台 Admin **不**绕过所有项目检查 |
| 403 / `license_required` | 产品激活门禁锁定 | 平台 Owner/Admin 激活或续期;换凭据或重启**不是**绕过 |
| 404 / `not_found` | 对象/路由不存在或不可用 | 核对实例、项目、folder/name 与 UUID,以及公开路由是否已发布 |
| 409 / `conflict` | 状态或身份冲突 | 读具体 message;重名、依赖引用与在途幂等请求是**不同**问题 |
| 429 / `rate_limited` | 凭据端点限流 | 遵守 `Retry-After`;不要紧循环重试密码或 token exchange |
| 500 / `internal` | 未处理的服务端失败 | 保存请求上下文、看运维日志;**不假定写入已回滚**。管理内部详情写日志、不原样返回 |

某些 handler 用更具体的顶层拒绝码与状态(如文件/链接错误),由对应功能
参考说明。`resource.<kind>.*` 等资源 DTO 标识常出现在 400 的 `message`
里——**不保证**是顶层 `error`;普通 409 的 message 提到依赖,也不代表
存在同名机器错误码。

## 刻意不同的外层

| 表面 | 差异 | 客户端要求 |
| --- | --- | --- |
| 工作流解析/验证 | 400 含 `error: bad_request` + 额外 `code` 与 `message` | 匹配工作流专用 `code`,见[工作流错误处理](../assets/workflows/error-handling.md) |
| 凭据限流 | 标准 JSON + `Retry-After` 头 | 保留该头并退避 |
| 项目 OAuth token 端点 `/p/{slug}/_token` | RFC 6749 的 `error`/`error_description` | 用 OAuth 客户端;**不要**要求一定有 `message` |
| 密码登录要求 MFA | 401 `mfa_required`/`mfa_enrollment_required` + `mfa_ticket` | 走指定 MFA/登记流程,不是重复输密码;**不要**记录 ticket |

工作流解析响应示意:

```json
{"error":"bad_request","code":"workflow.empty_parallel","message":"A workflow validation explanation"}
```

message 为示意,不是固定的服务端原句。

## 运行时与已发布 HTTP 失败

- 执行日志用 `error_kind` 分类:`unauthorized`、`forbidden`、`not_found`、
  `bad_request`、`runtime`、`system`、`user`、`conflict`、`overload`——
  它与响应里的 `error` 字符串**不是同一个字段**。runtime/system 通常映射
  HTTP 500 + `internal`;脚本显式 user error 可自带状态、code、message 与
  附加数据。
- 工作池队列耗尽、排队超时、脚本 broken、依赖环境未就绪或 worker 启动
  失败,都可能表现为 **503 `overload`**。dispatch 的 overload 响应带重试
  提示——但**不会**把永久的依赖安装失败变成瞬时问题:先看环境的实际
  错误;发布可能清除 broken 标记,却不修根因。
- 在途幂等请求冲突在 early dispatch 路径返回 `Retry-After: 1`——**不能**
  把它套到所有管理 409。超时或响应丢失也**不证明**上游写入没发生:重放
  前用端点真实的幂等契约,或检查持久业务状态。
- 工作流自动重试范围**刻意小于**"任意错误":含 queue-full/wait-timeout、
  broken/spawn failure、timeout 与 transport;user/script error 与
  environment-not-ready **不会**仅因外层类似 overload 就自动可重试;上游
  HTTP 错误响应**不是**网络 transport failure;取消绕过常规恢复。尝试
  次数、catch/continue 与边界见
  [工作流参考](../assets/workflows/error-handling.md)。

## 传输成功,操作未必成功

| 结果 | 要检查什么 |
| --- | --- |
| 资源 Test HTTP 200 | 正文可能 `ok: false` 且带 error;Test 可能已认证、发网络请求、建文件或写探针 |
| 脚本草稿测试 HTTP 响应 | 检查 `ok`、错误与日志;成功显式 `ViatResponse`/流可能仍 `output: null`——须另查发布 HTTP 响应 |
| Publish 接受 / CLI 退出 0 | 看每个 build 的 `ok`、诊断与 pending;配置允许时,接受可与失败/待完成构建**并存** |
| 异步请求接受 | 只表示 run 已接受,不是已完成;轮询正确的 run 并检查终态 |
| Workflow CLI 非零 | CLI 1.1.0 因**任一失败 attempt** 非零,即使 catch/continue/retry 后恢复;结合最终运行输出与 attempt 记录判断 |
| MCP `isError: false` | 解析 `result.content[0].text` 中的 JSON,再查端点状态或执行结果;工具传输成功不是业务成功 |
| 提供商接受推送/消息 | **不证明**设备已投递、显示或被用户阅读 |

## 安全的诊断顺序

1. 核对实例、项目、操作者与安装版本;记录方法/路径、时间窗与可用的
   request/run 标识。
2. 阅读 HTTP 状态与完整响应形状,区分管理请求、公开端点、OAuth、测试
   结果或 MCP 外层。
3. 检查匹配的执行、构建与环境证据;拒绝日志证明平台**看见**请求,不
   证明脚本**执行过**。
4. 401/403 先解决身份、成员、策略;无效输入修契约;overload 查容量/
   环境;transport 查**服务端**到上游的路径。
5. 重试修改前判断上次是否可能已生效。**不要**为消除错误而加确认旗标、
   移除门禁、关 TLS 验证或删无关对象。
6. 保存脱敏复现;不保存凭据、MFA ticket、Cookie、完整资源投影或私有
   用户数据。

选好获准项目后的只读日志示例:

```sh
viat logs query --limit 10 --json
viat script env hello --json
```

把 `hello` 换成实际脚本。普通环境读取**不是** build/probe;`--probe`
有不同权限并启动探测进程。只读操作无需清理对象,但导出证据按敏感程度
保存与移除。

## 核验依据

契约源码 `03751a67`:`crates/viat-api/src/error.rs`、`handlers/dispatch.rs`、runner 分类、`crates/viat-core/src/{error.rs,types/log.rs}`、`crates/viat-runtime/src/error.rs` 及各 CLI/MCP 参考。表格总结常见错误族,不封闭枚举应用可自行定义的全部 user error。
