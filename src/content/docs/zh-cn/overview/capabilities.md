---
title: 能力与操作入口
description: 按任务选择 Viat 能力，并理解稳定版运行时、客户端、权限和部署限制。
doc_id: overview.capabilities
verified_release: '1.1.0'
channel: stable
---

# 能力与操作入口

本页针对 **server/CLI 1.1.0** 提供选择依据，不承诺每个入口都暴露全部服务端操作。受保护的产品路由需要实例已激活。项目成员关系决定可见性；项目 `developer` 可编辑，项目 `owner`/`admin` 可发布并管理协作者。平台管理是另一条权限轴。

## 按目标选择能力

| 目标 | 能力 | 前提 / 重要限制 |
| --- | --- | --- |
| 用代码回答 HTTP 请求 | 脚本端点 | 脚本、方法和路径、已发布快照；编辑在发布前只是草稿 |
| 编排多个操作 | 工作流端点或直接工作流运行 | 有效工作流及引用目标；步骤可能产生真实外部写入 |
| 转发到上游 HTTP 服务 | 代理目标 | 已配置上游资源和路由；凭据留在平台侧 |
| 将业务表暴露为 REST | `crud` 目标 | 合适的数据库资源和 CRUD 配置；需明确设计写入范围与授权 |
| 维持双向连接 | WebSocket 目标 | 已发布路由与兼容客户端；浏览器应使用支持的 ticket 流程，不要把 bearer token 写入 URL |
| 定时执行或不占用 HTTP 连接 | 调度与异步运行 | 已激活服务端和合适预算；接受任务不等于任务完成 |
| 响应文件、队列、聊天或 WebSocket 消息源 | 已配置触发器 | 源连接与显式触发配置；并不是每个资源都会自动启动消费者 |
| 排查请求 | 执行记录、捕获输出、实时日志 | 项目可见性及配置的日志后端和保留期 |
| 使用版本控制协作 | CLI `pull`、`diff`、`push` | 已选择项目、受控本地工作副本；`push` 不是无害的文件上传 |
| 给 agent 提供管理能力 | `viat mcp` | 已认证的 CLI 上下文；共有 **46 个工具**，不是旧 README 写的六个 |

完整最小 HTTP 流程见[第一个端点](../getting-started/first-endpoint.md)；对象和权限边界见[核心概念](concepts.md)。

## 执行语言

稳定版 `ScriptLanguage` 协议值如下：

| 值 | 用途与前提 |
| --- | --- |
| `python` | 使用 `uv` 管理运行环境的 Python 函数；需保证解释器和依赖可用 |
| `typescript` | 使用 `bun` 执行 TypeScript；npm 依赖必须成功构建 |
| `sql` | 平台针对已声明数据库资源执行 SQL |
| `shell` | 每次启动新 shell 进程；发布镜像包含 Bash 和 `jq` |
| `graphql` | 针对对应资源执行 GraphQL 操作 |
| `viat_gql` | 面向支持的数据库资源的平台 GraphQL 层 |
| `llm` | 使用已配置模型资源的提示词目标；访问提供商可能产生费用 |
| `rust` | 编译后的 worker 程序；编译需构建工具链和 SDK，或外部提供的产物 |
| `binary` | 外部构建、实现 worker 协议的程序，需清单和上传产物；不是任意无协议可执行文件 |

普通镜像包含 **CLI** 和解释器，但不含 Rust 编译工具链。`1.1.0-build` 镜像增加固定版本的 Rust 工具链和 SDK。slim 节点可以运行匹配的已准备产物，但不能因为 `PATH` 中有 `viat` 就把它当 Rust 构建节点。

脚本超时依次取脚本头 → 项目默认 → 部署默认（`30` 秒），然后受部署上限约束。同步调用默认上限为 `300` 秒，后台运行默认使用独立的 `1800` 秒上限。只增大脚本头无法绕过部署上限。

## 资源家族

稳定资源种类包括：

- 数据库与数据：`postgresql`、`mysql`、`sqlserver`、`sqlite`、`mongodb`、`redis`。
- 请求与计算：`http_api`、`graphql`、`llm`、`cloud_api`、`library`。
- 文件与消息：`s3`、`storage`、`amqp`、`smtp`、`imap`、`push`。
- 配置与安全：`config`、`secret`、`crypto_key`。

资源种类表示平台能力，不代表各提供商具有完全相同的 API。例如 SQL Server 认证和各云 API 的 action 都有自身限制。`sqlite` 是配置根目录下的服务端资源文件，绝不是平台数据库。本稳定基线存在 `push` 资源，也不能证明尚未发布的直接 APNs 加密快照投递已可用。

资源可能访问真实数据库、发邮件、发布消息或调用付费提供商。连接测试或草稿运行不一定无副作用。生产集成应先使用隔离样例，并取得明确授权。不要在示例中放真实凭据，也不要提交资源秘密。

## 应该使用哪个入口

| 入口 | 适合 | 边界 |
| --- | --- | --- |
| `/ui/` 浏览器控制台 | 完整编写与配置、项目成员、发布审查 | 浏览器需能访问服务端；控件取决于成员关系和角色 |
| `viat` CLI | 脚本和端点操作、仓库同步、日志、特定管理任务 | 部分设置需要控制台/API；本地 `.viat/config.yaml` 包含凭据 |
| 管理 API | 自动化 `/projects/...`、`/users`、`/license` 等操作 | 使用平台会话/PAT 和操作权限，不是对外项目 API key |
| 已发布 API | 应用客户端调用 `/p/<slug>/...` | 遵循端点已发布的认证器和门禁 |
| 原生客户端 0.1 | 多实例登录、项目状态、近期运行和日志及部分操作 | 产物和版本独立；不能替代控制台所有编辑器 |
| MCP | agent 使用 CLI 支撑的管理工具目录 | 仍受服务端权限约束；有工具不等于有权限 |

Apple 安装和 CLI 暴露方式见[客户端](../installation/clients.md)。本页不承诺稳定的原生 Windows/Linux 发行版；存在开发代码不等于承诺发行产物。

## 不运行业务代码地检查可用性

完成[登录和项目选择](../getting-started/first-endpoint.md)后：

```sh
viat --version
viat version
viat script list --json
viat resource list --json
viat endpoint list --json
```

`viat --version` 查看本地二进制；`viat version` 在可用时额外读取需认证的服务端版本。列表命令返回当前项目资产，未使用时可返回空数组，不会发布端点或执行业务目标。使用 `viat <command> --help` 检查本机实际参数：`script create` 使用 `--name --language --file`；`resource create` 使用 **`--file`**，不要猜测内联 `--kind`/`--name` 参数。

## 故障处理与非目标

- **客户端缺少某操作：** 若控制台/API 支持，就使用该入口，不要编造 CLI 命令。
- **发布后构建结果显示失败：** 默认发布不会因每个构建失败而阻止。修复环境、重新构建并验证端点后，再认定部署健康。
- **触发器没有触发：** 检查激活状态、源配置、连通性、启用状态和目标权限。只创建资源并不会配置触发器。
- **Widget 过期：** 看原始更新时间和网络连通性。操作系统调度不提供实时 SLA；这里不要求或承诺未发布的 APNs 快照配置。
- **超过保留期后日志不存在：** 日志不是永久审计备份，依赖历史数据前先确认保留策略。

清理时，只删除自己有意创建的资产，先停止或禁用相关触发器，并通过凭据签发系统撤销外部凭据。删除 Viat 资源不代表会删除上游业务数据或撤销提供商凭据。

## 核验依据

契约源码 `03751a67`：`crates/viat-core/src/types/{script,resource}.rs`、`crates/viat-cli/src/main.rs`、`docs/mcp.md`、`docs/scripting.md`、`Dockerfile`、`client/README.md`。server/CLI 产物基线为 `fd340879`；原生客户端版本独立。
