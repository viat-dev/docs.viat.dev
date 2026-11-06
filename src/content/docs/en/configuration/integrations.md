---
title: Integrations, proxy, client and tool environments
description: SMTP, chat gateways, Redis, package proxies, CAs, CLI/MCP and test-variable classification.
doc_id: configuration.integrations
verified_release: '1.1.0'
channel: stable
---

# Integrations, proxy, client and tool environments

All examples are unexecuted. [Overview conventions](overview.md) apply; variables are optional except stated conditions. Resource fields do not automatically become environment variables. Deployment mail/secret/artifact backends differ from project resources.

## SMTP, endpoint Redis and chat policy

| Variable | Type; default | Range, scope and precedence |
| --- | --- | --- |
| `VIAT_SMTP_HOST` | string; unset / 未设置 | D. Trimmed nonblank enables deployment mail relay; required to save email alert rules. Not project SMTP resource configuration. |
| `VIAT_SMTP_TLS` | enum; `starttls` | D. Trim/case-fold implicit/tls → implicit TLS; none/plain → plaintext; anything else including typo → STARTTLS. |
| `VIAT_SMTP_PORT` | u16; `587` or `465` | D. 465 for implicit TLS, otherwise 587. Trimmed numeric override, 0 accepted by parser but not a useful relay port. |
| `VIAT_SMTP_USER` | string; unset / 未设置 | D. Trimmed nonblank optional AUTH identity; use with password when relay requires it. |
| `VIAT_SMTP_PASSWORD` | string; unset / 未设置 | D. Trimmed nonblank optional relay secret. Plaintext TLS mode can expose this on the network. |
| `VIAT_SMTP_FROM` | string; user or `viat@localhost` | D. Trimmed nonblank sender; explicit > SMTP user > fallback. Relay/address validation still applies. |
| `VIAT_RATELIMIT_REDIS_URL` | URL; unset / 未设置 | S. Optional shared endpoint rate-limit buckets; malformed configured URI fails startup. Outage falls back to per-instance memory limits; credential throttle stays PostgreSQL. |
| `VIAT_IM_BIND_BASE_URL` | URL; unset / 未设置 | D + S route availability. Nonempty opts into self-service chat binding links. No automatic fallback to PUBLIC_URL. Operator must provide trusted external base and working binding UI. |
| `VIAT_IM_BIND_PAGE_PREFIX` | path; derived / 推导 | D. Optional console path override; normalized leading/no trailing slash; explicit empty means root-mounted external UI. Default uses deployment base path + /ui. |
| `VIAT_IM_MAX_ACCOUNTS_PER_PROJECT` | i64; `500` accounts | D. Positive project cap; invalid/0 → default. Not a performance guarantee. |
| `VIAT_IM_MAX_ACCOUNTS_TOTAL` | i64; `2000` accounts | D. Positive deployment cap; project cap does not replace it. |
| `VIAT_IM_MAX_ACCOUNTS_PER_INSTANCE` | i64 → usize; `200` accounts | D. Positive lease/connection budget per node; beyond it node stops acquiring accounts. |
| `VIAT_IM_BIND_LINK_MAX_TTL_HOURS` | i64; `168` h | D. Positive maximum minted link lifetime (7d); individual link can lower. |
| `VIAT_IM_BIND_LINK_MAX_USES` | i64 → i32; `500` uses | D. Positive then clamped 1..10000; link can request fewer uses. |
| `VIAT_IM_BIND_RATELIMIT_IP_PER_MINUTE` | u32; `1200` requests/min | S. Binding route/IP throttle; 0 disables bucket. Separate from login throttle. |
| `VIAT_IM_BIND_RATELIMIT_IDENTITY_PER_MINUTE` | u32; `60` requests/min | S. Binding route/identity throttle; 0 disables bucket. |
| `VIAT_IM_WEIXIN_HOSTS` | CSV hosts; `weixin.qq.com` | D (connector config). Nonblank CSV replaces defaults, lowercased/trimmed; allowed host or subdomain. Not additive; preserve needed official suffixes. |
| `VIAT_IM_FEISHU_HOSTS` | CSV hosts; `feishu.cn,larksuite.com` | D. Replaces Feishu/Lark allowed suffixes; same parsing rule. Gateway can receive account credentials; trust deliberately. |
| `VIAT_IM_DINGTALK_HOSTS` | CSV hosts; `dingtalk.com` | D. Replaces DingTalk allowed suffixes. Not an inbound HTTP bind address. |
| `VIAT_SOCIAL_HOSTS` | CSV hosts; see below / 见下文 | D. Replaces social exchange allowlist; host/subdomain validation, not DNS/IP sandbox. See full defaults below. |

## Worker environment, clients and local tools

| Variable | Type; default | Range, scope and precedence |
| --- | --- | --- |
| `VIAT_RUNTIME_ENV_PASSTHROUGH` | CSV names; empty / 空 | W. Additional exact names or trailing-* prefixes. Unset source variables skipped. Explicit denylist still wins. Every forwarded value is visible to worker code; not a secret-vault interface. |
| `VIAT_CONFIG_DIR` | path; discovered / 自动查找 | C, CLI/MCP. Nonblank override names config directory itself, not parent. Else search cwd ancestors for .viat/config.yaml, else cwd/.viat. No server effect. |
| `VIAT_NO_PROXY` | boolean; off / 关闭 | C, CLI HTTP client. Trim/case-fold nonempty other than 0/false/no bypasses environment proxies. Does not change server egress or guarantee MCP transport uses it. |
| `VIAT_SERVER` | URL; config server_url / 配置值 | C, MCP. Environment presence overrides legacy YAML server_url; missing both is startup error. Not a general server bind setting. |
| `VIAT_TOKEN` | string; config token / 配置值 | C, MCP. Environment presence overrides legacy YAML token; required by loader if no token. Current CLI access/refresh fields are not automatically the same legacy field; prefer explicit least-privilege token for MCP. |
| `VIAT_PROJECT` | string; current_project / 配置值 | C, MCP. Optional default project override; tools may also accept project. Not server project selection. |
| `VIAT_BUILD_WAIT_SECS` | u64; `1800` s | C, CLI. Client --wait budget, 0 accepted; not server build timeout and does not cancel a server build when client stops waiting. |
| `VIAT_TEST_HOST_BIN` | path; discovery / 自动查找 | C, CLI script testing. Override local viat-test-host executable; otherwise sibling installed binary then build-location discovery. Must match CLI release. |
| `VIAT_ENDPOINT_TEST_HOST_BIN` | path; discovery / 自动查找 | C, CLI endpoint testing. Override viat-endpoint-test-host executable; matching release required. |
| `VIAT_ENDPOINT_TEST_DB` | PostgreSQL URI; required for local endpoint tests / 本地端点测试必填 | C. Base PostgreSQL URL for disposable endpoint-test databases. Requires database-creation privileges; never point at production. Not the server DATABASE_URL replacement. |
| `VIAT_TEST_HOST` | path; tool-provided / 工具注入 | Local SDK/test process. Selects real-DB resource test host. Not a deployment knob or permission bypass. |

## Package sources, proxies and CAs: three trust domains

Server egress, dependency installation and user-script networking are different clients. Several platform clients explicitly use `.no_proxy()` (including shared HTTP/Vault); setting `HTTPS_PROXY` does not proxy every request. Prefer explicit resource proxy fields for `http_api`/`graphql` where supported and verify other backends separately. One global proxy is not evidence of one universal egress path.

Workers receive `PATH`, `HOME` and namespaced `UV_*`, `PIP_*`, `BUN_CONFIG_*`, `NPM_CONFIG_*`, `npm_config_*` by default. These open prefixes are interpreted by their tools; Viat does not validate every possible tool field:

| Variable/family | Type, default, override and scope |
| --- | --- |
| `PATH`, `HOME` | W strings, inherited from server; image HOME is `/home/viat`. Executable/cache paths must exist with appropriate permissions. |
| `UV_INDEX_URL`, `UV_DEFAULT_INDEX`, `PIP_INDEX_URL` | W URLs, tool defaults when absent; forwarded by default. Use trusted internal sources. Empty/precedence behavior belongs to the installed tool version. |
| `UV_NATIVE_TLS`, other `UV_*`/`PIP_*` | W tool-defined boolean/string values with uv/pip defaults. Installer options, not Viat listener-TLS switches. |
| `npm_config_registry`, `NPM_CONFIG_*`, `BUN_CONFIG_*` | W tool-defined values/defaults; configure trusted registries. Registry authentication enters the worker environment and can be read by script code. |
| `npm_config_proxy`, `npm_config_https_proxy` | W URLs, tool defaults when absent; namespaced variables forward automatically, not universal script HTTP proxying. |
| `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY`, `NO_PROXY` and lowercase variants | Strings/URLs, no Viat-specific default. Adoption by server clients varies. **Not forwarded to workers by default**: explicit opt-in required; wildcard/CIDR NO_PROXY syntax varies by client. |
| `SSL_CERT_FILE`, `SSL_CERT_DIR`, `REQUESTS_CA_BUNDLE`, `CURL_CA_BUNDLE`, `NODE_EXTRA_CA_CERTS` | File/directory paths, tool trust-store defaults. Not forwarded to workers by default; explicitly opt in and mount readable certificates. Some replace rather than extend trust; no variable works for every runtime. |
| `AWS_REGION`, `AWS_DEFAULT_REGION`, `AWS_PROFILE`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN` | Server AWS SDK chain inputs; absent values use other SDK providers. Secrets Manager still needs a resolvable identity/region. Not aliases for Rust S3 explicit credentials. Core AWS credentials are blocked from passthrough. |
| `CARGO_HOME`, `RUSTUP_HOME`, `CARGO_TARGET_DIR`, `CARGO_BUILD_JOBS`, `CARGO_REGISTRIES_*_TOKEN`, `SSH_*` | Compiler/local CLI tool configuration with tool-defined types/defaults/ranges, not runtime-worker server knobs. `CARGO_*`/`SSH_*` are blocked from runtime passthrough. The -build image sets Cargo/rustup directories. CLI compilation chooses `VIAT_RUST_TARGET_DIR`, then `CARGO_TARGET_DIR`, then a temporary target directory. |
| `PYTHONPATH` | C; local CLI script testing appends an existing value. Not server interpreter selection. |

Unexecuted example for dependency proxying with explicit internal-host exclusions; forward the variables into the container and create new worker environments:

```dotenv
UV_INDEX_URL=https://packages.example.com/pypi/simple
npm_config_registry=https://packages.example.com/npm/
VIAT_RUNTIME_ENV_PASSTHROUGH=HTTPS_PROXY,NO_PROXY
HTTPS_PROXY=http://proxy.example.com:3128
NO_PROXY=localhost,127.0.0.1,.example.internal
```

Regardless of passthrough, `DATABASE_URL`, `VIAT_MASTER_KEY`, `VIAT_JWT_SECRET`, `VAULT_ADDR`, `VAULT_TOKEN`, the three core AWS credential names and `CARGO_*`/`SSH_*` are blocked. This is **not automatic recognition of every secret name**. Never use broad `*` rules to forward SMTP, artifact or custom credentials. Some resource objects still project credentials; see [security boundaries](security.md).

## Chat/social gateways and throttles

The full default `VIAT_SOCIAL_HOSTS` list is `weixin.qq.com,dingtalk.com,alipay.com,alipaydev.com,douyin.com,toutiao.com,kuaishou.com`. Lists match hosts/subdomains; a nonblank CSV replaces, not appends. A gateway receives app secrets and needs operator approval. An allowlist is not a DNS-rebinding firewall. Self-service binding is a separate opt-in, not enabled by `VIAT_PUBLIC_URL`; links are bearer capabilities to create accounts, so bound lifetime/use count and provide a functioning UI.

When endpoint Redis limiting fails, each node falls back to local buckets; combined admissions can approach the sum of each node's allowance. Do not treat this as a strict fleet quota. Login identity throttling independently uses PostgreSQL. SMTP plaintext plus credentials warns but can still send AUTH unencrypted: use trusted TLS and correctly authorized relay/sender domains.

## Client/test variables are not production tuning

`VIAT_CONFIG_DIR` names the directory itself, e.g. `config.yaml` inside `/home/operator/viat-session`. Session files contain access/refresh tokens: restrict directory permissions and exclude from version control. Prefer an explicit path across working directories. MCP's legacy YAML loader reads `token`, not automatically the CLI `access_token`/`refresh_token` fields. Follow [MCP](../mcp/overview.md) for explicit credentials instead of inventing session values.

CLI project roles/local endpoint-test actors are **operator/developer/admin/owner**, not an invented viewer role. See the full [CLI](../cli/overview.md). Local endpoint testing creates disposable databases and executes code; it is not read-only. This page's local endpoint-test instructions have not been executed as part of its configuration reference acceptance.

Development/verification inputs also include `VIAT_UPDATE_BINDINGS` (exactly 1 regenerates TS bindings), `SQLX_OFFLINE` (build-time query-cache selection), `DOC_CONTRACT_EXAMPLES`/`DOC_EXAMPLE_ROOT`/`DOC_EXAMPLE_CLI` (documentation fixtures), and `MYSQL_TEST_URL`/`REDIS_TEST_URL`/`MONGO_TEST_URL`/`AMQP_TEST_URL`/`SQLSERVER_TEST_*`/`MINIO_TEST_*`/`KEYCLOAK_URL`/`LOCALSTACK_AWS`/`PGPASSWORD` (integration-service fixtures). These have no production configuration default/reload contract. Do not expose test services on production just to avoid skipped tests.

`VIAT_ARGS_JSON`, `VIAT_RESOURCES`, `VIAT_REQUEST`, `VIAT_PRINCIPAL`, `VIAT_REQUEST_BODY_FILE` are per-run context injected into shell workers, not installer inputs. `___VIAT_*___` strings are protocol sentinels, not configuration.

Expanded examples `VIAT_ARGS_NAME`, `VIAT_ARGS_USER_ID`, `VIAT_RESOURCE_DB_HOST`, `VIAT_RESOURCE_DB_PORT`, `VIAT_RESOURCE_DB_DATABASE` and `VIAT_RESOURCE_DB_URL` are derived from per-run inputs/resource projections, not independent startup knobs. Internal tests also name `VIAT_RESOURCE_DB_PASSWORD` and `VIAT_RESOURCE_DB_USER` when checking that nested `secret` fields are not flattened. That does **not** guarantee that top-level projections or `VIAT_RESOURCES` are credential-free in 1.1.0. Do not log resource environment values or use these names as a credential-recovery API; the documented projection limitations apply to shell too.
