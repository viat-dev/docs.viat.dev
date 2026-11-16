---
title: 集成、代理、客户端与工具环境
description: SMTP、聊天网关、Redis、包源代理、CA、CLI/MCP 和测试变量的完整分类。
doc_id: configuration.integrations
verified_release: '1.1.0'
channel: stable
---

# 集成、代理、客户端与工具环境

所有示例均未执行;[总览约定](overview.md)适用,除显式条件要求外均可选。
一个总原则:**资源自己的配置字段不会自动变成同名环境变量**——不要把部署
级 SMTP/秘密/产物后端与项目资源混为一谈。

## SMTP、端点 Redis 与聊天策略

| 变量 | 类型;默认值 | 范围、作用域与优先级 |
| --- | --- | --- |
| `VIAT_SMTP_HOST` | string; 未设置 | D。去空白后非空即启用部署邮件中继;**保存邮件告警规则前必须配置**。不是项目 SMTP 资源。 |
| `VIAT_SMTP_TLS` | enum; `starttls` | D。去空白、忽略大小写:`implicit`/`tls` 为隐式 TLS,`none`/`plain` 为明文,**其余(含拼错)都是 STARTTLS**。 |
| `VIAT_SMTP_PORT` | u16; `587` 或 `465` | D。隐式 TLS 默认 465,其余 587;可覆盖,解析接受 0 但那不是可用端口。 |
| `VIAT_SMTP_USER` | string; 未设置 | D。去空白非空的可选 AUTH 身份;中继要求认证时配密码。 |
| `VIAT_SMTP_PASSWORD` | string; 未设置 | D。可选中继秘密;**明文模式下密码可能在网络暴露**。 |
| `VIAT_SMTP_FROM` | string; user 或 `viat@localhost` | D。去空白非空发件人;显式值 > SMTP user > 后备;仍受中继与地址校验限制。 |
| `VIAT_RATELIMIT_REDIS_URL` | URL; 未设置 | S。可选共享端点限流;已配置但格式错误阻止启动。故障退回每实例内存限流;凭据限流仍在 PostgreSQL。 |
| `VIAT_IM_BIND_BASE_URL` | URL; 未设置 | D + S(路由可用性)。非空才启用自助聊天绑定链接;**不继承** `VIAT_PUBLIC_URL`。须提供可信外部地址与可用的绑定 UI。 |
| `VIAT_IM_BIND_PAGE_PREFIX` | path; 推导 | D。可选控制台路径覆盖,规范化首尾斜杠;显式空值表示外部 UI 在根路径;默认 = 部署前缀 + /ui。 |
| `VIAT_IM_MAX_ACCOUNTS_PER_PROJECT` | i64; `500` 个 | D。正的项目账号上限;非法/0 回退,不代表性能保证。 |
| `VIAT_IM_MAX_ACCOUNTS_TOTAL` | i64; `2000` 个 | D。正的部署总上限,与项目上限同时约束。 |
| `VIAT_IM_MAX_ACCOUNTS_PER_INSTANCE` | i64 → usize; `200` 个 | D。每节点正的租约/连接预算,超出不再认领账号。 |
| `VIAT_IM_BIND_LINK_MAX_TTL_HOURS` | i64; `168` 小时 | D。正的链接有效期上限(7 天),单链接只能更短。 |
| `VIAT_IM_BIND_LINK_MAX_USES` | i64 → i32; `500` 次 | D。先取正数再夹到 1..10000,单链接可降低。 |
| `VIAT_IM_BIND_RATELIMIT_IP_PER_MINUTE` | u32; `1200` 次/分 | S。绑定路由/IP 限流;0 关闭;与登录限流独立。 |
| `VIAT_IM_BIND_RATELIMIT_IDENTITY_PER_MINUTE` | u32; `60` 次/分 | S。绑定路由/身份限流;0 关闭。 |
| `VIAT_IM_WEIXIN_HOSTS` | CSV hosts; `weixin.qq.com` | D(连接配置)。非空逗号列表**替换**默认;去空白转小写;匹配域及其子域。不是追加——要保留所需官方域后缀。 |
| `VIAT_IM_FEISHU_HOSTS` | CSV hosts; `feishu.cn,larksuite.com` | D。替换飞书/Lark 允许域后缀,解析同上。网关会接收账号凭据,须明确授信。 |
| `VIAT_IM_DINGTALK_HOSTS` | CSV hosts; `dingtalk.com` | D。替换钉钉允许域后缀;**不是**入站 HTTP 监听地址。 |
| `VIAT_SOCIAL_HOSTS` | CSV hosts; 见下文 | D。替换社交交换允许域列表;匹配域/子域;**不是** DNS/IP 沙箱。完整默认见下文。 |

## 工作环境、客户端与本地工具

| 变量 | 类型;默认值 | 范围、作用域与优先级 |
| --- | --- | --- |
| `VIAT_RUNTIME_ENV_PASSTHROUGH` | CSV names; 空 | W。额外变量名或带 `*` 的前缀,逗号分隔;源变量未设则跳过;禁止列表优先。透传值对 worker 代码**可见**——不是秘密保险箱。 |
| `VIAT_CONFIG_DIR` | path; 自动查找 | C,CLI/MCP。非空时指向**配置目录本身**(不是父目录);否则向上查找 `.viat/config.yaml`,再回退 `cwd/.viat`。不影响服务端。 |
| `VIAT_NO_PROXY` | boolean; 关闭 | C,CLI HTTP 客户端。去空白、忽略大小写后,非空且非 `0`/`false`/`no` 则绕过环境代理。不改服务端出口;不保证 MCP 遵循。 |
| `VIAT_SERVER` | URL; 配置值 | C,MCP。环境存在则覆盖旧 YAML server_url;都缺失则报错。**不是**服务端绑定设置。 |
| `VIAT_TOKEN` | string; 配置值 | C,MCP。环境存在则覆盖旧 YAML token;都缺失则报错。CLI 新的 access/refresh 字段不自动等同旧 token;MCP 建议显式配最小权限令牌。 |
| `VIAT_PROJECT` | string; 配置值 | C,MCP。可选默认项目覆盖;工具也可能接受项目参数。不是服务端项目选择。 |
| `VIAT_BUILD_WAIT_SECS` | u64; `1800` 秒 | C,CLI。`--wait` 等待预算,接受 0;**不是**服务端构建超时——客户端停止等待不代表服务端构建被取消。 |
| `VIAT_TEST_HOST_BIN` | path; 自动查找 | C,CLI 脚本测试。覆盖本地 viat-test-host 可执行文件;否则查同目录已安装/构建位置;须匹配 CLI 版本。 |
| `VIAT_ENDPOINT_TEST_HOST_BIN` | path; 自动查找 | C,CLI 端点测试。覆盖 viat-endpoint-test-host;须匹配版本。 |
| `VIAT_ENDPOINT_TEST_DB` | PostgreSQL URI; 本地端点测试必填 | C。为可丢弃端点测试库提供基础 URL,需要建库权限。**绝不指向生产**;不是服务端 DATABASE_URL 的替代。 |
| `VIAT_TEST_HOST` | path; 工具注入 | 本地 SDK/测试进程。选择真实数据库资源测试 host;不是部署参数或权限绕过。 |

## 包源、代理与 CA:三个不同的信任域

**服务端出站请求、依赖安装、用户脚本自身网络,不是同一个客户端。** 多个
平台客户端显式 `.no_proxy()`(含共享 HTTP/Vault)——不能指望设了
`HTTPS_PROXY` 就代理所有请求。`http_api`/`graphql` 等资源的显式 proxy
字段对这些资源优先;其他后端按各自实现校验。**不要用一个全局代理假装
所有路径都走同一出口。**

默认向 worker 传递 `PATH`、`HOME` 与 `UV_*`/`PIP_*`/`BUN_CONFIG_*`/
`NPM_CONFIG_*`/`npm_config_*` 命名空间——这些开放前缀由对应工具解释,Viat
不逐一校验:

| 变量/族 | 类型、默认、覆盖与作用域 |
| --- | --- |
| `PATH`、`HOME` | W 字符串,继承服务端;镜像 HOME 为 `/home/viat`。决定可执行文件与包缓存,须存在且权限合适。 |
| `UV_INDEX_URL`、`UV_DEFAULT_INDEX`、`PIP_INDEX_URL` | W URL,未设用工具默认;设置后默认透传——用可信内部源替代公共源。空值/优先级语义由工具版本决定。 |
| `UV_NATIVE_TLS`、其他 `UV_*`/`PIP_*` | W 工具自定义布尔/字符串,默认由 uv/pip 决定。只属于安装器,**不是** Viat 的 TLS 服务开关。 |
| `npm_config_registry`、`NPM_CONFIG_*`、`BUN_CONFIG_*` | W 工具自定义值,默认由 npm/bun 决定;配置可信仓库。包源认证值会进入 worker 环境,也可能被脚本读取。 |
| `npm_config_proxy`、`npm_config_https_proxy` | W URL,未设用工具默认;命名空间变量默认透传——**不等于**所有脚本 HTTP 自动代理。 |
| `HTTP_PROXY`、`HTTPS_PROXY`、`ALL_PROXY`、`NO_PROXY`(含小写) | 字符串/URL,无 Viat 专用默认;服务端是否采用取决于具体客户端。**worker 默认不透传**,需点名启用;`NO_PROXY` 的通配符/CIDR 支持由客户端决定。 |
| `SSL_CERT_FILE`、`SSL_CERT_DIR`、`REQUESTS_CA_BUNDLE`、`CURL_CA_BUNDLE`、`NODE_EXTRA_CA_CERTS` | 文件/目录路径,默认工具信任库;worker 默认不透传,需 W 显式启用并挂载可读证书。部分变量是**替换**而非扩展原信任库,并非所有运行时通用。 |
| `AWS_REGION`、`AWS_DEFAULT_REGION`、`AWS_PROFILE`、`AWS_ACCESS_KEY_ID`、`AWS_SECRET_ACCESS_KEY`、`AWS_SESSION_TOKEN` | 服务端 AWS SDK 链配置;未设时走 SDK 其他来源;Secrets Manager 所需身份/区域必须可解析。**不是** Rust S3 显式凭据的别名。核心 AWS 凭据禁止透传。 |
| `CARGO_HOME`、`RUSTUP_HOME`、`CARGO_TARGET_DIR`、`CARGO_BUILD_JOBS`、`CARGO_REGISTRIES_*_TOKEN`、`SSH_*` | 编译器/本地 CLI 工具配置,语义由工具定义;不是运行 worker 的服务器参数。`CARGO_*`、`SSH_*` 明确禁止透传给 worker。`-build` 镜像设置 Cargo/rustup 目录;CLI 编译 target 顺序:`VIAT_RUST_TARGET_DIR` → `CARGO_TARGET_DIR` → 临时目录。 |
| `PYTHONPATH` | C,本地 CLI 脚本测试会拼接已有值;不是服务端解释器选择变量。 |

示例(未执行)同时启用依赖代理与内网直连排除——**必须把变量实际传入容器,
再创建新环境**:

```dotenv
UV_INDEX_URL=https://packages.example.com/pypi/simple
npm_config_registry=https://packages.example.com/npm/
VIAT_RUNTIME_ENV_PASSTHROUGH=HTTPS_PROXY,NO_PROXY
HTTPS_PROXY=http://proxy.example.com:3128
NO_PROXY=localhost,127.0.0.1,.example.internal
```

> [!WARNING]
> 无论 passthrough 怎么设,`DATABASE_URL`、`VIAT_MASTER_KEY`、
> `VIAT_JWT_SECRET`、`VAULT_ADDR`、`VAULT_TOKEN`、三个核心 AWS 凭据名及
> `CARGO_*`/`SSH_*` 都**禁止传入** worker。该禁止表不会自动识别所有可能
> 的秘密名——不要用宽泛 `*` 规则把 SMTP、产物或其他自定义凭据传给脚本。
> 多项资源仍会投射凭据,见[安全边界](security.md)。

## 聊天/社交网关与限流

- `VIAT_SOCIAL_HOSTS` 完整默认列表:
  `weixin.qq.com,dingtalk.com,alipay.com,alipaydev.com,douyin.com,toutiao.com,kuaishou.com`。
  域列表匹配自身及子域;非空 CSV 是**替换**不是追加;网关会收到应用秘密,
  必须运维批准。allowlist **不是** DNS 重绑定防火墙。
- 自助绑定是单独的 opt-in,不因设置 `VIAT_PUBLIC_URL` 自动开启;绑定链接
  是"可创建账号的 bearer capability"——限制寿命/次数并提供可用页面。
- 端点 Redis 限流故障时退回单节点桶:多节点合计可能放行到"各自额度之和"
  ——**降级模式不是严格集群配额**。身份登录限流独立用 PostgreSQL。
- SMTP 明文模式加密码会告警,仍可能明文 AUTH;生产用受信 TLS,中继授权
  与发件域也要正确。

## 客户端与测试变量不属于生产调参

- `VIAT_CONFIG_DIR` 指向目录本身(如 `/home/operator/viat-session` 内含
  `config.yaml`)。会话文件含访问/刷新令牌:限制目录权限、排除版本控制;
  跨工作目录时优先用这个显式路径。
- MCP 的旧 YAML 读取只认 legacy `token`,**不会**自动读 CLI 的
  `access_token`/`refresh_token` 字段;按 [MCP](../mcp/overview.md) 用
  显式令牌,不要伪造会话值。
- CLI 项目角色/本地端点测试 actor 使用
  **operator/developer/admin/owner**——没有可照搬的 viewer 角色。命令见
  [CLI](../cli/overview.md)。本地端点测试会**创建临时数据库并执行代码**,
  不是只读检查;本页的相关说明尚未作为配置参考的验收步骤执行。
- 仅开发/验证用途:`VIAT_UPDATE_BINDINGS`(精确 `1` 写生成 TS 绑定)、
  `SQLX_OFFLINE`(构建时 SQL 缓存)、`DOC_CONTRACT_EXAMPLES`/
  `DOC_EXAMPLE_ROOT`/`DOC_EXAMPLE_CLI`(文档夹具)、`MYSQL_TEST_URL`/
  `REDIS_TEST_URL`/`MONGO_TEST_URL`/`AMQP_TEST_URL`/`SQLSERVER_TEST_*`/
  `MINIO_TEST_*`/`KEYCLOAK_URL`/`LOCALSTACK_AWS`/`PGPASSWORD`(集成测试
  服务/夹具)。它们没有生产配置语义——**不要**为"让测试不跳过"而在生产
  开放测试服务。

## 平台注入的运行时变量(不是你要填的)

- `VIAT_ARGS_JSON`、`VIAT_RESOURCES`、`VIAT_REQUEST`、`VIAT_PRINCIPAL`、
  `VIAT_REQUEST_BODY_FILE` 是平台向 **shell worker** 注入的每次运行上下文;
  `___VIAT_*___` 是协议哨兵——都不是安装配置。
- 展开名如 `VIAT_ARGS_NAME`、`VIAT_ARGS_USER_ID`、
  `VIAT_RESOURCE_DB_HOST`、`VIAT_RESOURCE_DB_PORT`、
  `VIAT_RESOURCE_DB_DATABASE`、`VIAT_RESOURCE_DB_URL` 来自每次运行的
  参数/资源投影,**不是**独立启动开关。内部测试还断言嵌套 `secret` 字段
  (如 `VIAT_RESOURCE_DB_PASSWORD`、`VIAT_RESOURCE_DB_USER`)不被展开——
  这**不保证** 1.1.0 的顶层投影或 `VIAT_RESOURCES` 不含凭据。
- 不要记录这些环境值,也不要把这些名称当"秘密恢复 API";已记录的资源
  投影限制同样适用于 shell。
