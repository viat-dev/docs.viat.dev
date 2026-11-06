---
title: HTTP API 表面与请求约定
description: 选择正确的管理或调用 API，准确寻址资产、解释响应，并导出已发布端点 OpenAPI。
doc_id: api.overview
verified_release: '1.1.0'
channel: stable
---

# HTTP API 表面与请求约定

Viat 的**管理 API**用于平台/项目管理，**调用 API**提供已发布业务接口，两者身份不能互换。CLI 和控制台主要调用管理 API；不带 `--console` 的 `viat call` 访问调用 API。

下列路径相对实例基础 URL，包括运维配置的反代/base-path 前缀。不要在 API 基础地址添加 `/ui`。受信本地夹具以外应使用 HTTPS，凭据不要放进 URL、源码或共享记录。

## 选择正确的表面

| 表面 | 代表路径 | 认证与含义 |
| --- | --- | --- |
| 进程探针 | `/healthz`、`/readyz` | 刻意无需认证且豁免激活门禁；进程健康不证明激活有效或脚本可运行。 |
| 平台登录/会话 | `/auth/login`、`/auth/refresh`、`/auth/sessions` | 平台账号和操作对应的会话/MFA 规则，不是项目终端用户登录。 |
| 平台管理 | `/users`、`/license`、`/admin/...` | 路由特定的平台角色/会话规则。 |
| 项目管理 | `/projects/{slug}/...` | 平台认证、成员身份和操作对应的有效项目角色/PAT 限制。 |
| 已发布业务路由 | `/p/{slug}/{path}` | **已发布端点**的认证器/门禁，不自动使用管理登录。 |
| 内置项目身份/文件/run 路由 | 项目前缀下 `/p/{slug}/auth/...`、`/_token`、`/_files/...`、`/_runs/...` | 各自有协议和权限，这些名字是平台保留路径。 |
| 概览读取 | `/projects/{slug}/overview` | 普通管理访问，或按登录签发、范围很窄的 `vso_` reader；它不授权相邻管理路由。 |

各自契约见[管理认证](../auth/management.md)、[端点认证](../auth/endpoints.md)、[HTTP 端点](../triggers/http.md)及[错误处理](../reference/errors.md)。不要仅凭 HTTP GET 就推断所需角色。

## 不复制 token 的管理调用

完成[平台登录](../getting-started/first-endpoint.md)后，使用 CLI 的可刷新会话：

```sh
viat call --console --method GET /version
viat call --console --method GET /projects
```

命令先输出状态，再输出正文，不是纯 JSON。`/version` 返回例如 `{"version":"1.1.0"}` 的对象；`/projects` 返回该平台身份可见项目。这些读取不发布或执行脚本。限域项目 PAT 不保证能访问全局 `/projects`，应使用其已知项目及允许路由。

**只有明确准备在未使用 slug 下创建临时项目时**，才使用以下创建请求：

```sh
viat call --console --method POST /projects --body '{"slug":"api-docs-lab","name":"API Docs Lab"}'
```

`slug`、`name` 均为必填字符串。响应是创建后的项目表示，包括服务端生成的身份/状态，不只是提交对象。已有 slug 冲突。继续前检查响应和[项目规则](../projects/create-and-collaborate.md)。本示例来自源码核对；与另行实测的首个端点流程不同，这条具体调用不是已执行响应记录。

直接 HTTP 客户端应在 `Authorization: Bearer ...` 中提供正确凭据，在要求 JSON 的路由设置对应 `Content-Type`。平台 access/refresh 对有轮换语义，不能重放已消耗 refresh 凭据，也不能悄悄用其他账号替换失败会话。完整生命周期见认证参考。

## 名称、文件夹、方法与载荷

| 事项 | 规则 |
| --- | --- |
| 项目身份 | `{slug}` 是项目 slug，不是显示名或 UUID。 |
| 资产身份 | 文件夹内脚本/资源/工作流在对应管理路由使用裸 `{name}` 和 `?folder=...`。CLI 的 `shared/lookup` 是便利限定名，不必直接成为多个 URL path segment。 |
| 编码 | 分别百分号编码动态 path segment 和 query value，不要把含 `?`/`#` 的资源名直接拼进 URL。 |
| 端点身份 | 管理动作使用节点 UUID；调用请求使用已发布方法/路径，不是该 UUID。 |
| 创建/更新 | POST/PUT/PATCH 语义因对象而异，不能假定 PUT 总是替换、PATCH 总是 JSON Merge Patch，应看功能字段表。 |
| 省略/null/空值 | 可能代表保留、继承、清空或拒绝；空数组可能是显式策略选择。 |
| 秘密 | 普通资源表示返回摘要/脱敏，不提供秘密恢复；不要把返回掩码作为新秘密提交。 |
| 分页 | 没有统一外层。执行查询使用 `items`/`next_before`，其他数组、截断结果和游标各不相同。 |
| 测试 | 测试路由可能执行当前代码或访问资源；Test 一词不保证 dry-run。 |

例如，读取限定脚本时显式指定文件夹：

```sh
viat call --console --method GET '/projects/hello-lab/scripts/lookup?folder=shared'
```

需要实际存在的项目/脚本和该路由读取权限。路径的精确拼写也重要：脚本使用 `/{name}/test-run`，工作流使用 `/{name}/test_run`，不要凭猜测统一连字符和下划线。

## 功能与 API 索引

以下是路由族，**不代表**每个前缀支持全部 CRUD 方法。完整请求/响应、条件字段、错误、权限和副作用由所属参考页说明。

| 能力 | 管理路由族 | 所属参考 |
| --- | --- | --- |
| 项目设置/成员 | `/projects/{slug}`、`/members`、`/members/{email}` | [设置](../projects/settings.md)、[协作](../projects/create-and-collaborate.md) |
| 资源配置/Test/schema | `/projects/{slug}/resources`、`/{name}`、`/{name}/test`、`/{name}/schema/refresh` | [20 类资源参考](../assets/resources/index.md) |
| 数据库迁移 | `.../resources/{name}/migrations` | [CLI 数据库操作](../cli/db.md) |
| 受管文件与业务审计 | `.../resources/{name}/files`、`.../audit`、`.../audit/export` | [Storage](../assets/resources/storage.md)、[审计](../operations/audit.md) |
| 脚本、环境、产物 | `/projects/{slug}/scripts`、`/{name}/env`、`/build`、`/artifact`、`/binary` | [脚本上下文](../assets/scripts/context.md)、[运行时](../assets/scripts/runtime.md)、[CLI 脚本](../cli/script.md) |
| 工作流 | `/projects/{slug}/workflows`、`/{name}/validate`、`/{name}/test_run` | [工作流](../assets/workflows/overview.md) |
| 端点/树契约 | `/projects/{slug}/endpoints`、`/trees` | [HTTP](../triggers/http.md)、[CRUD](../triggers/crud.md)、[入站 WebSocket](../triggers/websocket-endpoints.md) |
| 发布 | `.../endpoints/{id}/publish`、`/unpublish`；`/projects/{slug}/publish/plan`、`/apply`、`/rollback`、`/history` | [快照](../publishing/snapshots.md)、[回滚](../publishing/rollback.md) |
| 调度 | `/projects/{slug}/schedules`、`/{name}/pause`、`/resume`、`/trigger`、`/runs` | [调度](../triggers/schedules.md) |
| 文件系统、RabbitMQ、出站 WebSocket | `/projects/{slug}/watches`、`/queue-triggers`、`/ws-triggers` | [监听](../triggers/watches.md)、[队列](../triggers/queues.md)、[WS 订阅](../triggers/websocket-subscriptions.md) |
| 聊天账号/身份/触发器 | `/projects/{slug}/im/accounts`、`/identities`、`/bind-links`、`/triggers` | [个人微信](../triggers/weixin.md)及其他提供商页面 |
| 授权模型 | `/projects/{slug}/authz`、`/types`、`/rules`、`/subject-attrs`、`/lint` | [授权](../auth/authorization.md) |
| 观测 | `/projects/{slug}/overview`、`/executions`、`/async-runs`、`/audit` | [Runs](../operations/runs.md)、[日志](../operations/logs.md)、[审计](../operations/audit.md) |
| 已发布项目 OpenAPI | `/projects/{slug}/openapi.json` | 下节 |

同一单元格内的短后缀相对紧邻的路由族，不是全局路由。存在 API 能力，不代表存在对应 CLI 命令或 MCP 工具；[CLI](../cli/overview.md)、[MCP](../mcp/overview.md)均有明确清单。

## 导出已发布应用的 OpenAPI

经过认证的项目成员可请求：

```sh
viat call --console --method GET /projects/hello-lab/openapi.json
```

文档使用 **OpenAPI 3.1.0**，从**当前活动已发布快照**及认证器元数据构建。`servers` 指向实例 base path 加 `/p/{slug}`。草稿编辑不自动改变活动快照所代表的公开契约。生成的 `info.version` 不是运行服务端发行版本，应使用 `/version` 核对后者。

该导出描述项目已发布的调用接口，**不是完整管理 API 规范**。它刻意放在成员认证的管理路由，而不是公开 `/p/{slug}/_openapi.json`，不要编造后者。成员可审阅并向集成方提供脱敏契约，但文档本身不签发调用凭据，也不豁免 authz 门禁。使用客户端生成器前，应阅读流式、异步、代理/CRUD 及 schema 限制说明，不能假定生成器编码了全部运行规则。

## 验证与安全清理

集成应先读取、记录实际对象 ID，再仅在隔离命名空间执行明确打算进行的修改，同时检查状态和操作专属结果字段。发布不代表所有构建就绪，异步接受不代表完成，资源 Test 可能 HTTP 200 但 `ok: false`；通用判断见[错误与结果边界](../reference/errors.md)。

停止相关触发器、解决依赖后，只移除集成自己创建的对象。导出 API 契约/日志即使不含秘密，也可能暴露私有路由或数据，应私下保存并明确清理临时副本。本页不会执行管理示例，也不授权生产清理。

## 核验依据

固定源码 `03751a67`：`crates/viat-api/src/lib.rs` 路由装配、`dto.rs`、各 handler、`handlers/openapi.rs`/`openapi.rs`，以及 CLI `commands/{endpoint,script}.rs`。资源/语言/CLI/MCP 契约单独固定，不冒充完整自动生成的管理 OpenAPI。
