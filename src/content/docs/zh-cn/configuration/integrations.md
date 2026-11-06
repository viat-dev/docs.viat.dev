---
title: 集成、代理、客户端与工具环境
description: SMTP、聊天网关、Redis、包源代理、CA、CLI/MCP 和测试变量的完整分类。
doc_id: configuration.integrations
verified_release: '1.1.0'
channel: stable
---

# 集成、代理、客户端与工具环境

所有示例均未执行。[总览约定](overview.md)适用，除显式条件要求外均可选。资源自己的配置字段不自动变成同名环境变量；不要把部署 SMTP/秘密/产物后端与项目资源混为一谈。

## SMTP、端点 Redis 与聊天策略

| 变量 | 类型；默认值 | 范围、作用域与优先级 |
| --- | --- | --- |
| `VIAT_SMTP_HOST` | string; unset / 未设置 | D。去空白后非空启用部署邮件中继；保存邮件告警规则前必须配置。不是项目 SMTP 资源。 |
| `VIAT_SMTP_TLS` | enum; `starttls` | D。去空白且忽略大小写：implicit/tls 为隐式 TLS，none/plain 为明文，其余含拼错均为 STARTTLS。 |
| `VIAT_SMTP_PORT` | u16; `587` or `465` | D。隐式 TLS 默认 465，其余 587。去空白数字可覆盖，解析接受 0，但不是可用中继端口。 |
| `VIAT_SMTP_USER` | string; unset / 未设置 | D。去空白非空的可选 AUTH 身份；中继要求认证时配合密码。 |
| `VIAT_SMTP_PASSWORD` | string; unset / 未设置 | D。去空白非空的可选中继秘密。明文模式可能在网络暴露密码。 |
| `VIAT_SMTP_FROM` | string; user or `viat@localhost` | D。去空白非空发件人；显式值 > SMTP user > 后备。仍受中继与地址校验限制。 |
| `VIAT_RATELIMIT_REDIS_URL` | URL; unset / 未设置 | S。可选共享端点限流；已配置但格式错误阻止启动。故障退回每实例内存限流；凭据限流仍在 PostgreSQL。 |
| `VIAT_IM_BIND_BASE_URL` | URL; unset / 未设置 | D + S 路由可用性。非空才启用自助聊天绑定链接，不继承 PUBLIC_URL。须提供可信外部地址和可工作的绑定 UI。 |
| `VIAT_IM_BIND_PAGE_PREFIX` | path; derived / 推导 | D。可选控制台路径覆盖，规范前导/尾斜杠；显式空值表示外部 UI 在根路径。默认使用部署前缀 + /ui。 |
| `VIAT_IM_MAX_ACCOUNTS_PER_PROJECT` | i64; `500` accounts | D。正的项目账号上限；非法/0 回退，不代表性能保证。 |
| `VIAT_IM_MAX_ACCOUNTS_TOTAL` | i64; `2000` accounts | D。正的部署账号总上限，与项目上限同时约束。 |
| `VIAT_IM_MAX_ACCOUNTS_PER_INSTANCE` | i64 → usize; `200` accounts | D。每节点正的租约/连接预算，超出不再认领账号。 |
| `VIAT_IM_BIND_LINK_MAX_TTL_HOURS` | i64; `168` h | D。正的链接有效期上限（7 天），单链接可降低。 |
| `VIAT_IM_BIND_LINK_MAX_USES` | i64 → i32; `500` uses | D。先取正数再限制到 1..10000，单链接可降低次数。 |
| `VIAT_IM_BIND_RATELIMIT_IP_PER_MINUTE` | u32; `1200` requests/min | S。绑定路由/IP 限流；0 关闭桶，与登录限流独立。 |
| `VIAT_IM_BIND_RATELIMIT_IDENTITY_PER_MINUTE` | u32; `60` requests/min | S。绑定路由/身份限流，0 关闭桶。 |
| `VIAT_IM_WEIXIN_HOSTS` | CSV hosts; `weixin.qq.com` | D（连接配置）。非空逗号列表替换默认，去空白转小写；匹配域或其子域。不是追加，须保留所需官方域后缀。 |
| `VIAT_IM_FEISHU_HOSTS` | CSV hosts; `feishu.cn,larksuite.com` | D。替换飞书/Lark 允许域后缀，同上解析。网关可接收账号凭据，须明确授信。 |
| `VIAT_IM_DINGTALK_HOSTS` | CSV hosts; `dingtalk.com` | D。替换钉钉允许域后缀，不是入站 HTTP 监听地址。 |
| `VIAT_SOCIAL_HOSTS` | CSV hosts; see below / 见下文 | D。替换社交交换允许域列表，匹配域/子域，不是 DNS/IP 沙箱。完整默认见下文。 |

## 工作环境、客户端与本地工具

| 变量 | 类型；默认值 | 范围、作用域与优先级 |
| --- | --- | --- |
| `VIAT_RUNTIME_ENV_PASSTHROUGH` | CSV names; empty / 空 | W。额外变量名或末尾 * 前缀，逗号分隔；源变量未设则跳过，禁止列表优先。透传值对 worker 代码可见，不是秘密保险箱。 |
| `VIAT_CONFIG_DIR` | path; discovered / 自动查找 | C，CLI/MCP。非空覆盖指配置目录自身，不是父目录；否则向上找 .viat/config.yaml，再回退 cwd/.viat。不影响服务端。 |
| `VIAT_NO_PROXY` | boolean; off / 关闭 | C，CLI HTTP 客户端。去空白且忽略大小写后，非空且非 0/false/no 则绕过环境代理。不改变服务端出口，也不保证 MCP 使用该开关。 |
| `VIAT_SERVER` | URL; config server_url / 配置值 | C，MCP。环境存在则覆盖旧 YAML server_url；均缺失则报错。不是服务端绑定设置。 |
| `VIAT_TOKEN` | string; config token / 配置值 | C，MCP。环境存在则覆盖旧 YAML token；均缺失则报错。CLI 新 access/refresh 字段并不自动等于旧 token；MCP 建议显式给最小权限令牌。 |
| `VIAT_PROJECT` | string; current_project / 配置值 | C，MCP。可选默认项目覆盖，工具也可能接受项目参数。不是服务端项目选择。 |
| `VIAT_BUILD_WAIT_SECS` | u64; `1800` s | C，CLI。--wait 等待预算，接受 0；不是服务端构建超时，客户端停止等待不代表服务器构建取消。 |
| `VIAT_TEST_HOST_BIN` | path; discovery / 自动查找 | C，CLI 脚本测试。覆盖本地 viat-test-host 可执行文件，否则查找同目录已安装文件/构建位置。须匹配 CLI 版本。 |
| `VIAT_ENDPOINT_TEST_HOST_BIN` | path; discovery / 自动查找 | C，CLI 端点测试。覆盖 viat-endpoint-test-host，须匹配版本。 |
| `VIAT_ENDPOINT_TEST_DB` | PostgreSQL URI; required for local endpoint tests / 本地端点测试必填 | C。为可丢弃端点测试数据库提供基础 PostgreSQL URL，需要建库权限。绝不能指向生产；不是服务端 DATABASE_URL 替代。 |
| `VIAT_TEST_HOST` | path; tool-provided / 工具注入 | 本地 SDK/测试进程。选择真实数据库资源测试 host，不是部署参数或权限绕过。 |

## 包源、代理和 CA：三个不同信任域

服务端出站请求、安装依赖、用户脚本自身网络不是同一个客户端。多个平台客户端显式 `.no_proxy()`（包括共享 HTTP/Vault），不能承诺设置 `HTTPS_PROXY` 会代理所有请求。`http_api`/`graphql` 等资源的显式 proxy 字段优先用于这些资源；其他后端按自己的实现校验。不要使用一个全局代理来假装所有路径都经过同一出口。

默认向 worker 传递 `PATH`、`HOME` 和命名空间 `UV_*`、`PIP_*`、`BUN_CONFIG_*`、`NPM_CONFIG_*`、`npm_config_*`。这些开放前缀由相应工具解释，Viat 不额外校验其全部字段：

| 变量/族 | 类型、默认、覆盖与作用域 |
| --- | --- |
| `PATH`、`HOME` | W 字符串，继承服务端；镜像 HOME 为 `/home/viat`。决定可执行文件与包缓存，须存在且权限合适。 |
| `UV_INDEX_URL`、`UV_DEFAULT_INDEX`、`PIP_INDEX_URL` | W URL，未设时工具自身默认；设置会被默认透传，用可信内部源替代公共源。空值/源优先级由工具版本决定。 |
| `UV_NATIVE_TLS`、其他 `UV_*`/`PIP_*` | W 工具自定义布尔/字符串，默认由 uv/pip 决定。配置仅属于安装器，不是 Viat TLS 服务开关。 |
| `npm_config_registry`、`NPM_CONFIG_*`、`BUN_CONFIG_*` | W 工具自定义值，默认由 npm/bun 决定；配置可信仓库。包源认证值进入 worker 环境，也可能被脚本读取。 |
| `npm_config_proxy`、`npm_config_https_proxy` | W URL，未设时工具默认；命名空间变量默认透传，不等同于所有脚本 HTTP 自动代理。 |
| `HTTP_PROXY`、`HTTPS_PROXY`、`ALL_PROXY`、`NO_PROXY` 及小写形式 | 字符串/URL，未设无 Viat 专用默认；服务端是否采用取决于具体客户端。**worker 默认不透传**，需点名启用；NO_PROXY 的通配符/CIDR 支持由客户端决定。 |
| `SSL_CERT_FILE`、`SSL_CERT_DIR`、`REQUESTS_CA_BUNDLE`、`CURL_CA_BUNDLE`、`NODE_EXTRA_CA_CERTS` | 文件/目录路径，默认工具信任库；worker 默认不透传。需 W 显式启用并挂载可读证书。有的变量替换而非扩展原信任库，不是所有运行时通用。 |
| `AWS_REGION`、`AWS_DEFAULT_REGION`、`AWS_PROFILE`、`AWS_ACCESS_KEY_ID`、`AWS_SECRET_ACCESS_KEY`、`AWS_SESSION_TOKEN` | 服务端 AWS SDK 链配置，未设用 SDK 其他来源；Secrets Manager 所需身份/区域必须可解析。不是 Rust S3 显式凭据的别名。核心 AWS 凭据禁止透传。 |
| `CARGO_HOME`、`RUSTUP_HOME`、`CARGO_TARGET_DIR`、`CARGO_BUILD_JOBS`、`CARGO_REGISTRIES_*_TOKEN`、`SSH_*` | 编译器/本地 CLI 工具配置，类型/默认/范围由工具定义；不是运行 worker 的服务器参数。`CARGO_*`、`SSH_*` 明确禁止透传运行 worker。`-build` 镜像设置 Cargo/rustup 目录；CLI 编译 target 优先 `VIAT_RUST_TARGET_DIR`，再 `CARGO_TARGET_DIR`，再临时目录。 |
| `PYTHONPATH` | C，本地 CLI 脚本测试会拼接已有值；不是服务端解释器选择变量。 |

示例（未执行）同时启用依赖代理与内网直连排除；必须把变量实际传入容器，再创建新环境：

```dotenv
UV_INDEX_URL=https://packages.example.com/pypi/simple
npm_config_registry=https://packages.example.com/npm/
VIAT_RUNTIME_ENV_PASSTHROUGH=HTTPS_PROXY,NO_PROXY
HTTPS_PROXY=http://proxy.example.com:3128
NO_PROXY=localhost,127.0.0.1,.example.internal
```

无论 passthrough 如何设置，`DATABASE_URL`、`VIAT_MASTER_KEY`、`VIAT_JWT_SECRET`、`VAULT_ADDR`、`VAULT_TOKEN`、三个核心 AWS 凭据名及 `CARGO_*`/`SSH_*` 都禁止传入。该禁止表**不是对所有可能秘密名的自动识别**；不要用宽泛 `*` 规则把 SMTP、产物或其他自定义凭据传给脚本。多项资源仍会投射凭据，参见[安全边界](security.md)。

## 聊天/社交网关与限流

`VIAT_SOCIAL_HOSTS` 默认完整列表为 `weixin.qq.com,dingtalk.com,alipay.com,alipaydev.com,douyin.com,toutiao.com,kuaishou.com`。域列表匹配自身及子域，非空 CSV 是替换不是追加；网关会收到应用秘密，必须运维批准。不能把 allowlist 当 DNS 重绑定防火墙。自助绑定单独 opt-in，不因设置 `VIAT_PUBLIC_URL` 自动开启；绑定链接是可创建账号的 bearer capability，须限制寿命/次数并提供可用页面。

端点 Redis 限流故障时退回单节点桶，因此多个节点可能合计放行到约各自额度之和；不能把降级模式当严格集群配额。身份登录限流独立使用 PostgreSQL。SMTP 明文模式加密码会发出警告，仍可能明文 AUTH；生产采用受信 TLS，中继授权和发件域亦需正确。

## 客户端与测试变量不属于生产调参

`VIAT_CONFIG_DIR` 指向目录自身，例如 `/home/operator/viat-session` 内的 `config.yaml`。会话文件含访问/刷新令牌，应限制目录权限并排除版本控制；跨工作目录优先使用此显式路径。MCP 旧 YAML 读取只看 legacy `token`，不自动读取 CLI 的 `access_token`/`refresh_token` 字段；按[MCP](../mcp/overview.md)使用显式令牌，不要伪造会话值。

CLI 项目角色/本地端点测试 actor 使用 **operator/developer/admin/owner**，不存在应照搬的 viewer 角色。详细命令见 [CLI](../cli/overview.md)。本地端点测试会创建临时数据库并执行代码，不是只读检查；本页的本地端点测试说明尚未作为配置参考的验收步骤执行。

仅开发/验证用途还有 `VIAT_UPDATE_BINDINGS`（精确 1 写生成 TS 绑定）、`SQLX_OFFLINE`（构建时 SQL 缓存选择）、`DOC_CONTRACT_EXAMPLES`/`DOC_EXAMPLE_ROOT`/`DOC_EXAMPLE_CLI`（文档夹具）、`MYSQL_TEST_URL`/`REDIS_TEST_URL`/`MONGO_TEST_URL`/`AMQP_TEST_URL`/`SQLSERVER_TEST_*`/`MINIO_TEST_*`/`KEYCLOAK_URL`/`LOCALSTACK_AWS`/`PGPASSWORD`（集成测试服务或夹具）。它们没有生产配置默认或重载约定，不要为“让测试不跳过”而在生产开放测试服务。

`VIAT_ARGS_JSON`、`VIAT_RESOURCES`、`VIAT_REQUEST`、`VIAT_PRINCIPAL`、`VIAT_REQUEST_BODY_FILE` 是平台向 shell worker 注入的每次运行上下文，不是安装者要填写的变量。`___VIAT_*___` 是协议哨兵，也不是配置。

展开名称示例 `VIAT_ARGS_NAME`、`VIAT_ARGS_USER_ID`、`VIAT_RESOURCE_DB_HOST`、`VIAT_RESOURCE_DB_PORT`、`VIAT_RESOURCE_DB_DATABASE`、`VIAT_RESOURCE_DB_URL` 来自每次运行的参数/资源投影，不是独立启动开关。内部测试还在断言嵌套 `secret` 字段不被展开时提及 `VIAT_RESOURCE_DB_PASSWORD`、`VIAT_RESOURCE_DB_USER`。这**不保证** 1.1.0 的顶层投影或 `VIAT_RESOURCES` 不含凭据。不要记录这些环境值，也不要把这些名称当作秘密恢复 API；已记录的资源投影限制同样适用于 shell。
