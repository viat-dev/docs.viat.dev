---
title: "资源参考总览"
description: "Viat 1.1.0 全部 20 种资源的配置、秘密边界和 SDK 使用参考。"
doc_id: resources.overview
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# 资源参考总览

资源是项目内有文件夹身份的配置资产，不是端点、不自动创建远程服务，也不自动启动触发器。本参考覆盖固定 1.1.0 契约的全部 20 种类型。每页包含完整 plain/secret 及嵌套字段、运行规则、配置、实际语言助手、失败恢复和清理。示例仅含合成值/服务桩，未执行，不代表已经测试。

## 类型目录

| wire kind | 用途与边界 |
| --- | --- |
| [`amqp`](amqp.md) | 为脚本确认发布和已实现队列消费触发器提供 AMQP 0-9-1/RabbitMQ。消费通过队列触发器，不是 .consume 助手。Kafka/AMQP 1.0/RocketMQ 不属本类型。 |
| [`cloud_api`](cloud_api.md) | 仅支持 aliyun_rpc_v1、tencent_tc3 两种协议的签名动作调用，不是全云适配器，不支持 AWS SigV4、阿里云 ACS3 或任意厂商签名。资源固定产品端点，脚本不能将凭据改发到另一主机。 |
| [`config`](config.md) | 在明文 plain.data 中保存可版本控制的 JSON 文档，并可用受限 JSON Schema 校验。适合非秘密配置，不是通用加密对象；秘密叶子应显式引用 secret 资源。 |
| [`crypto_key`](crypto_key.md) | 对平台持有的 aes/hmac/rsa/ecdsa_p256/ed25519/sm2/sm4 密钥执行操作。algorithm 选密钥类型，协议模式由调用参数决定。私密材料不进脚本，不是 CA、密钥发行方或通用 HSM。 |
| [`graphql`](graphql.md) | 调用现有远程 GraphQL HTTP 端点并返回 data 对象，即使 HTTP 200 也会在 GraphQL errors 时抛错。这不是 Viat 的数据库 viat_gql 引擎；该引擎属于 postgresql/mysql/sqlite 资源。 |
| [`http_api`](http_api.md) | 固定上游 base URL、认证和请求头，供脚本 HTTP 助手和代理端点使用。请求由平台发出，不是可随意指定目的地的带凭据抓取器。GraphQL 错误处理应使用 graphql，云动作签名应使用 cloud_api。 |
| [`imap`](imap.md) | 通过平台 IMAP 读邮件、列邮箱目录并显式标记 Seen，不是 SMTP、通用邮箱管理器，也不会仅因建资源就变成后台触发器。 |
| [`library`](library.md) | 以原调用者身份调用冻结 Rust/binary 脚本导出函数，不是 Python import、npm 包或 uses 模块。保存 library 即发布，仅改源代码不会改变冻结构建。 |
| [`llm`](llm.md) | Viat 的多提供方聊天契约支持 openai、anthropic、azure、custom，在不暴露 API key 的前提下统一聊天、工具调用结果和文本流。本页描述已发布适配器，不推荐最新模型，也不等价于完整提供方 SDK。 |
| [`mongodb`](mongodb.md) | 在一个配置 MongoDB 数据库执行文档 CRUD、聚合、计数，输入规范扩展 JSON、输出宽松扩展 JSON 以保留 BSON 身份，不是完整 driver、事务或 change-stream 接口。 |
| [`mysql`](mysql.md) | 通过原生 SQL、平台代理事务、viat_gql 和 CRUD 访问 MySQL/MariaDB 业务数据。只内省配置的一个数据库，不继承 PostgreSQL 的多 schema 或审计能力。 |
| [`postgresql`](postgresql.md) | 连接项目自己的 PostgreSQL 数据库，执行 SQL、事务、数据库 GraphQL、CRUD，并可启用业务数据审计。这不是访问 Viat 平台数据库的入口。应使用最小权限的应用角色，而非超级用户。 |
| [`push`](push.md) | stable 1.1.0 支持 JPush、FCM HTTP v1、APNs token 传输，含平台事件和脚本 .send。接受不代表手机送达。未发布分支的 APNs 加密 widget 概览快照不属稳定功能。 |
| [`redis`](redis.md) | 在指定逻辑数据库提供小型缓存、计数和发布助手，1.1.0 无代理 SCAN、Lua、任意命令、pipeline 或订阅助手。 |
| [`s3`](s3.md) | 直接读写现有 S3 兼容桶，并使用项目 S3 授权面。若文件需要项目 PostgreSQL 元数据、所有者、审计证据和受管下载链接，应选择 storage。 |
| [`secret`](secret.md) | 在配置的秘密后端保存一个不为空的字符串，可用于独立 token 或 config/请求头/cloud 凭据引用的目标。与代理凭据资源不同，其用途正是向声明它的脚本提供 value。 |
| [`smtp`](smtp.md) | 项目独立的出站邮件中继，与部署 VIAT_SMTP 告警设置分离。平台持有凭据并固定发件身份，脚本选择收件人、主题、内容，不能改 From。 |
| [`sqlite`](sqlite.md) | 平台打开的服务端 SQLite 文件，不是 Viat 平台数据库或浏览器数据库。SQL/事务/viat_gql/CRUD 适合单节点或复制只读数据，不适合多节点共享写。 |
| [`sqlserver`](sqlserver.md) | 通过 TDS、SQL 认证和池化 SQL/事务访问 Microsoft SQL Server。1.1.0 无 Windows/AD/Kerberos/Azure AD 认证、viat_gql/数据库 GraphQL/CRUD 引擎或业务 audit 块。 |
| [`storage`](storage.md) | 本地卷/S3 文件字节配合同项目 PostgreSQL 元数据，ID/键、所有者、策略和证据由平台管理。不同于原始 s3，不能用 MySQL/SQLite/平台数据库存元数据。 |

## 权限、身份与保存语义

管理 API 需要平台登录及项目成员身份。列举/查看需要成员身份；创建、PUT、PATCH、Test、refresh、copy、delete 需要有效项目角色 Owner/Admin/Developer；较低权限的 operator 角色不可写。管理权限不自动赋予上游账号权限，也不替代运行时的 s3/file/行级授权。MCP 只开放其工具清单实际声明的能力，不能把资源 schema 当作完整 MCP CRUD。

- 创建：`POST /projects/{slug}/resources`，请求为 `{name,folder?,kind,plain,secret}`。name 长度 1–64 字节且不可含 /；system 为保留名。folder 省略/空字符串表示根，非空为 [A-Za-z0-9_-]+ 段，最多 8 层/255 字节，无首尾或连续 /。
- 资源身份为同项目 `(folder,name)`，不是全项目裸名。同名可以位于不同文件夹。详情路由用 `/resources/{name}?folder=team` 显式定位；CLI 用 `team/name`。脚本裸引用按自身文件夹、根、全项目唯一名顺序解析，建议跨文件夹显式限定，Python 用 `getattr(ctx.resources, "team/name")`，TypeScript 用 `ctx.resources["team/name"]`，而非属性链。
- PUT 是完整替换：须重发正确 kind、完整 plain 与全部要保留的秘密值，不能从 show 的掩码恢复秘密。PATCH 的 kind 固定；省略 plain 保留，提供 plain 则整体替换（不是深合并）；secret 仅逐字段覆盖，省略字段保留。移动 folder 时引用在新位置重检。
- 清除可选秘密用 PATCH 显式 null（仅允许 null 的字段）或空字符串（仅允许空值的字段）；必需/条件必需字段不能清空。清除可选 plain 字段需发送去掉该字段的完整 plain，让类型默认/缺省生效。不要用 null 代替所有类型，也不要把 *** 当作旧值。
- `$keep` 是仅 PATCH/仓库同步使用的**顶层 plain 字段**占位符，保留服务端已有同名字段，连数字/布尔也可保留；新资源/不存在字段不能使用。嵌套 `$keep` 不是深合并指令。
- 仓库文件 `resources/<folder>/<name>.yaml` 由路径承载 folder，name 仍是裸名。`viat pull` 将 secret 字段写为字符串 `$secret`；`viat push` 去掉这些占位（也接受旧 !secret 标签），对已有资源 PATCH，绝不把占位当凭据。新资源必须先安全提供实际必需秘密；占位不能创建凭据。顶层 allowed_authorizers 是仓库访问同步元数据，不要擅自塞进 plain。

`$secret` 占位与凭据引用不同：`{"$secret":"name"}` 在 config/cloud 支持位置命名另一个 secret 资源；HTTP/GraphQL 字符串头用整个 `"$secret:name"`。它们不等于秘密明文，保存/读取/导出保留引用，使用时解析。目标按消费资源文件夹锚定并须已存在且为 secret 类型，不能用字符串拼接插值。

公开响应含资源标识、kind、folder、plain 及秘密摘要，不返回秘密值；摘要 *** 表示该种类声明的字段，不证明每个可选凭据实际已填。plain 会原样可读/导出；secret 通过部署秘密后端加密。脚本/依赖的发布版本按快照规则冻结，uses 无 (live) 时亦冻结，不可把所有依赖描述为每次读 live；资源读取/代理操作和显式实时 secret IO 是不同边界。

## 选择与操作边界

SQL 与事务支持 postgresql/mysql/sqlserver/sqlite；数据库 viat_gql、graphql 助手和 CRUD 引擎仅 PostgreSQL/MySQL/SQLite。远程 graphql 是另一种 HTTP 上游资源。amqp 同时有脚本发布与单独配置的队列触发器消费；storage 是本地/S3 字节加项目 PostgreSQL 元数据；library 是冻结 Rust/binary 导出而非 Python import；cloud_api 仅两种签名协议。push 已有 JPush/FCM/APNs 及脚本 send，但未发布 APNs widget 加密快照不在 1.1.0 stable。

Python/TypeScript 提供资源方法，Rust 以已验证通用 RPC 或特定助手调用，shell 只有 JSON 投影而无同名方法。不要从 schema 推断不存在的 CLI/MCP/SDK 能力。Test 可能真实出站、认证、创建 SQLite 文件或写本地 storage 探针；保存 audit/storage/library 更可能有 DDL/构建副作用，不能统一称 dry-run。

## 1.1.0 秘密与传输限制

HTTP/GraphQL/LLM/cloud/mail/storage/crypto/push 的凭据由平台操作应用，移除的 r.secret/r.auth_headers 不可恢复使用。secret.value 和 config 中解析的秘密则有意提供给脚本，两者必须区分。兼容投影仍会向 worker 暴露 postgresql/mysql/redis/mongodb/amqp 的带凭据 URL、sqlserver 的 ADO/账号秘密及 s3 key；即使只调用代理助手，整个依赖树也必须可信。不要提取/返回这些值，优先代理助手、最小账号权限。

PostgreSQL 的 ssl 字段在 1.1.0 SQL/GraphQL 池及 Test 中未应用，不能据此声称强制 TLS；MySQL ssl:true 使用 Preferred，可能回退明文。严格传输要求需由部署/数据库约束并独立验证，成功 Test 不是严格 TLS 证明。RSA 解析实际接受至少 1024 位，生产新 key 建议至少 2048 位。

## 管理入口

[平台用户](../../instance/platform-users.md)与[项目协作](../../projects/create-and-collaborate.md)说明登录/角色前置条件。实际 CLI 包括 resource list/show/create --file/edit --file/test/refresh/delete/set-secret/set-field；edit 是完整 PUT，set-secret 从 stdin 读取单字段并 PATCH。仓库 push 对已有资源使用 PATCH；没有必要杜撰 resource apply 或 create --kind 等不存在的命令。
