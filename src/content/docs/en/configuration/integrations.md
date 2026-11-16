---
title: Integrations, proxy, client and tool environments
description: SMTP, chat gateways, Redis, package proxies, CAs, CLI/MCP and test-variable classification.
doc_id: configuration.integrations
verified_release: '1.1.0'
channel: stable
---

# Integrations, proxy, client and tool environments

All examples are unexecuted; [overview conventions](overview.md) apply and
variables are optional except stated conditions. One governing rule:
**a resource's own config fields never become same-named environment
variables** — deployment-level SMTP/secret/artifact backends are not project
resources.

## SMTP, endpoint Redis and chat policy

| Variable | Type; default | Range, scope and precedence |
| --- | --- | --- |
| `VIAT_SMTP_HOST` | string; unset | D. Non-blank (after trimming) enables the deployment mail relay; **must be configured before saving email alert rules**. Not a project SMTP resource. |
| `VIAT_SMTP_TLS` | enum; `starttls` | D. Trimmed case-insensitive: `implicit`/`tls` = implicit TLS, `none`/`plain` = plaintext, **everything else (typos included) = STARTTLS**. |
| `VIAT_SMTP_PORT` | u16; `587` or `465` | D. Implicit TLS defaults to 465, otherwise 587; overridable. Parsing accepts 0, which is not a usable relay port. |
| `VIAT_SMTP_USER` | string; unset | D. Optional non-blank AUTH identity; pair with the password when the relay requires auth. |
| `VIAT_SMTP_PASSWORD` | string; unset | D. Optional relay secret; **in plaintext mode the password can hit the network in the clear**. |
| `VIAT_SMTP_FROM` | string; user or `viat@localhost` | D. Non-blank sender; explicit value > SMTP user > fallback; still bounded by relay and address validation. |
| `VIAT_RATELIMIT_REDIS_URL` | URL; unset | S. Optional shared endpoint rate limiting; configured-but-malformed blocks startup. On failure it degrades to per-instance in-memory limiting; credential limiting stays in PostgreSQL. |
| `VIAT_IM_BIND_BASE_URL` | URL; unset | D + S (route availability). Non-empty enables self-service chat bind links; **does not inherit** `VIAT_PUBLIC_URL`. Provide a trusted external address and a working bind UI. |
| `VIAT_IM_BIND_PAGE_PREFIX` | path; derived | D. Optional console-path override, normalized slashes; explicitly empty means the external UI sits at the root; default = deployment prefix + /ui. |
| `VIAT_IM_MAX_ACCOUNTS_PER_PROJECT` | i64; `500` accounts | D. Positive per-project cap; invalid/0 falls back; not a performance promise. |
| `VIAT_IM_MAX_ACCOUNTS_TOTAL` | i64; `2000` accounts | D. Positive deployment-wide cap, applied together with the project cap. |
| `VIAT_IM_MAX_ACCOUNTS_PER_INSTANCE` | i64 → usize; `200` accounts | D. Positive per-node lease/connection budget; beyond it the node claims no more accounts. |
| `VIAT_IM_BIND_LINK_MAX_TTL_HOURS` | i64; `168` h | D. Positive link-lifetime ceiling (7 days); individual links may be shorter. |
| `VIAT_IM_BIND_LINK_MAX_USES` | i64 → i32; `500` uses | D. Positive, then clamped 1..10000; individual links may lower it. |
| `VIAT_IM_BIND_RATELIMIT_IP_PER_MINUTE` | u32; `1200` req/min | S. Bind-route/IP rate limit; 0 disables; independent of login limits. |
| `VIAT_IM_BIND_RATELIMIT_IDENTITY_PER_MINUTE` | u32; `60` req/min | S. Bind-route/identity limit; 0 disables. |
| `VIAT_IM_WEIXIN_HOSTS` | CSV hosts; `weixin.qq.com` | D (connection config). Non-empty CSV **replaces** the default; trimmed, lowercased; matches the domain and subdomains. Not additive — keep the official suffixes you need. |
| `VIAT_IM_FEISHU_HOSTS` | CSV hosts; `feishu.cn,larksuite.com` | D. Replaces the Feishu/Lark allowed suffixes, parsed as above. Gateways receive account credentials — grant trust explicitly. |
| `VIAT_IM_DINGTALK_HOSTS` | CSV hosts; `dingtalk.com` | D. Replaces the DingTalk suffixes; **not** an inbound HTTP listen address. |
| `VIAT_SOCIAL_HOSTS` | CSV hosts; see below | D. Replaces the social-exchange allowlist; matches domain/subdomain; **not** a DNS/IP sandbox. Full default below. |

## Worker, client and local tooling

| Variable | Type; default | Range, scope and precedence |
| --- | --- | --- |
| `VIAT_RUNTIME_ENV_PASSTHROUGH` | CSV names; empty | W. Extra variable names or trailing-`*` prefixes, comma-separated; unset sources are skipped; the deny list wins. Passed values are **visible** to worker code — not a secret vault. |
| `VIAT_CONFIG_DIR` | path; discovered | C, CLI/MCP. Non-empty points at the **config directory itself** (not a parent); otherwise `.viat/config.yaml` is searched upward, falling back to `cwd/.viat`. Never affects the server. |
| `VIAT_NO_PROXY` | boolean; off | C, CLI HTTP client. Trimmed case-insensitive: non-empty and not `0`/`false`/`no` bypasses environment proxies. Changes no server egress; MCP adherence is not guaranteed. |
| `VIAT_SERVER` | URL; from config | C, MCP. Present in the environment it overrides the legacy YAML server_url; both missing is an error. **Not** a server bind setting. |
| `VIAT_TOKEN` | string; from config | C, MCP. Present in the environment it overrides the legacy YAML token; both missing is an error. The CLI's newer access/refresh fields do not auto-equal the legacy token; give MCP an explicit least-privilege token. |
| `VIAT_PROJECT` | string; from config | C, MCP. Optional default-project override; tools may also take a project parameter. Not a server-side project selection. |
| `VIAT_BUILD_WAIT_SECS` | u64; `1800` s | C, CLI. `--wait` budget, accepts 0; **not** a server build timeout — the client stopping its wait never cancels the server build. |
| `VIAT_TEST_HOST_BIN` | path; discovery | C, CLI script tests. Overrides the local viat-test-host executable; otherwise looks beside the CLI/built locations; must match the CLI version. |
| `VIAT_ENDPOINT_TEST_HOST_BIN` | path; discovery | C, CLI endpoint tests. Overrides viat-endpoint-test-host; must match versions. |
| `VIAT_ENDPOINT_TEST_DB` | PostgreSQL URI; required for local endpoint tests | C. Base URL for disposable endpoint-test databases; needs database-creation rights. **Never point it at production**; it is not a replacement for the server's DATABASE_URL. |
| `VIAT_TEST_HOST` | path; tool-provided | Local SDK/test process. Selects the real-database resource test host; not a deployment parameter or permission bypass. |

## Package sources, proxies and CAs: three distinct trust domains

**Server outbound requests, dependency installation and user-script networking
are not one client.** Several platform clients call `.no_proxy()` explicitly
(shared HTTP and Vault included) — setting `HTTPS_PROXY` does not proxy
everything. Explicit proxy fields on `http_api`/`graphql` resources win for
those resources; other backends validate per their own implementation.
**Never pretend one global proxy funnels every path.**

Workers receive `PATH`, `HOME` and the `UV_*`/`PIP_*`/`BUN_CONFIG_*`/
`NPM_CONFIG_*`/`npm_config_*` namespaces by default — the tools interpret
these open prefixes and Viat does not validate each field:

| Variable/family | Type, default, override and scope |
| --- | --- |
| `PATH`, `HOME` | W strings inherited from the server; the image's HOME is `/home/viat`. They determine executables and package caches — must exist with sane permissions. |
| `UV_INDEX_URL`, `UV_DEFAULT_INDEX`, `PIP_INDEX_URL` | W URLs, tool defaults when unset; forwarded by default — point them at trusted internal mirrors instead of public ones. Empty-value/precedence semantics depend on the tool version. |
| `UV_NATIVE_TLS`, other `UV_*`/`PIP_*` | W tool-defined booleans/strings, defaults decided by uv/pip. Installer-only — **not** Viat TLS server switches. |
| `npm_config_registry`, `NPM_CONFIG_*`, `BUN_CONFIG_*` | W tool-defined values, defaults from npm/bun; configure trusted registries. Registry credentials enter the worker environment and can be read by scripts. |
| `npm_config_proxy`, `npm_config_https_proxy` | W URLs, tool defaults when unset; namespace variables pass through by default — **not** automatic proxying of all script HTTP. |
| `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY`, `NO_PROXY` (any case) | Strings/URLs with no Viat-specific default; server adoption depends on the concrete client. **Workers do not forward them by default** — name them explicitly; `NO_PROXY` wildcard/CIDR support is client-dependent. |
| `SSL_CERT_FILE`, `SSL_CERT_DIR`, `REQUESTS_CA_BUNDLE`, `CURL_CA_BUNDLE`, `NODE_EXTRA_CA_CERTS` | File/directory paths, tool trust stores by default; not forwarded to workers without explicit W opt-in and readable mounted certificates. Some **replace** rather than extend the trust store — not universal across runtimes. |
| `AWS_REGION`, `AWS_DEFAULT_REGION`, `AWS_PROFILE`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN` | Server-side AWS SDK chain; unset falls to other SDK sources; the identity/region needed by Secrets Manager must resolve. **Not** aliases for the Rust S3 explicit credentials. Core AWS credentials are denied passthrough. |
| `CARGO_HOME`, `RUSTUP_HOME`, `CARGO_TARGET_DIR`, `CARGO_BUILD_JOBS`, `CARGO_REGISTRIES_*_TOKEN`, `SSH_*` | Compiler/local-CLI configuration with tool-defined semantics; not server parameters for running workers. `CARGO_*` and `SSH_*` are explicitly denied worker passthrough. The -build image sets the Cargo/rustup directories; CLI compile targets prefer `VIAT_RUST_TARGET_DIR`, then `CARGO_TARGET_DIR`, then a temp dir. |
| `PYTHONPATH` | C; local CLI script tests append to any existing value; not a server interpreter selector. |

Example (unexecuted) enabling the dependency proxy with an intranet exclusion —
the variables must **actually reach the container before creating new
environments**:

```dotenv
UV_INDEX_URL=https://packages.example.com/pypi/simple
npm_config_registry=https://packages.example.com/npm/
VIAT_RUNTIME_ENV_PASSTHROUGH=HTTPS_PROXY,NO_PROXY
HTTPS_PROXY=http://proxy.example.com:3128
NO_PROXY=localhost,127.0.0.1,.example.internal
```

> [!WARNING]
> Regardless of passthrough, `DATABASE_URL`, `VIAT_MASTER_KEY`,
> `VIAT_JWT_SECRET`, `VAULT_ADDR`, `VAULT_TOKEN`, the three core AWS
> credential names and `CARGO_*`/`SSH_*` are **never** forwarded to workers.
> That deny list does not auto-recognize every possible secret name — do not
> use broad `*` rules to hand scripts your SMTP, artifact or custom
> credentials. Several resources still project credentials; see
> [security boundaries](security.md).

## Chat/social gateways and rate limiting

- Full `VIAT_SOCIAL_HOSTS` default:
  `weixin.qq.com,dingtalk.com,alipay.com,alipaydev.com,douyin.com,toutiao.com,kuaishou.com`.
  Matching covers the domain and subdomains; a non-empty CSV **replaces**
  rather than appends; gateways receive application secrets and need explicit
  operational approval. An allowlist is **not** a DNS-rebinding firewall.
- Self-service binding is a separate opt-in, not enabled by setting
  `VIAT_PUBLIC_URL`; a bind link is a bearer capability that creates
  accounts — limit its lifetime/uses and provide a working page.
- On endpoint-Redis failure, limiting degrades to per-node buckets: several
  nodes may jointly admit up to the **sum** of their quotas — degraded mode
  is **not** a strict cluster quota. Identity login limiting independently
  uses PostgreSQL.
- SMTP plaintext-with-password logs a warning and may still AUTH in the
  clear; production uses trusted TLS with correct relay authorization and
  sender domain.

## Client and test variables are not production tuning

- `VIAT_CONFIG_DIR` points at the directory itself (for example
  `/home/operator/viat-session` containing `config.yaml`). Session files
  hold access/refresh tokens: restrict directory permissions, keep them out
  of version control, and prefer this explicit path across working
  directories.
- The MCP legacy-YAML reader honors only the legacy `token` and **never**
  auto-reads the CLI's `access_token`/`refresh_token` fields; use an
  explicit token per [MCP](../mcp/overview.md) — never fake session values.
- CLI project roles and the local endpoint-test actor use
  **operator/developer/admin/owner** — there is no viewer role to copy.
  Commands: [CLI](../cli/overview.md). Local endpoint tests **create
  temporary databases and execute code** — not a read-only check; the
  endpoint-test notes on this page have not been executed as a configuration
  acceptance step.
- Development/verification only: `VIAT_UPDATE_BINDINGS` (exact `1` writes
  generated TS bindings), `SQLX_OFFLINE` (build-time SQL cache),
  `DOC_CONTRACT_EXAMPLES`/`DOC_EXAMPLE_ROOT`/`DOC_EXAMPLE_CLI` (doc
  fixtures), and `MYSQL_TEST_URL`/`REDIS_TEST_URL`/`MONGO_TEST_URL`/
  `AMQP_TEST_URL`/`SQLSERVER_TEST_*`/`MINIO_TEST_*`/`KEYCLOAK_URL`/
  `LOCALSTACK_AWS`/`PGPASSWORD` (integration-test services/fixtures). They
  carry no production meaning — **never** open test services in production
  just to stop tests from skipping.

## Runtime variables the platform injects (not yours to set)

- `VIAT_ARGS_JSON`, `VIAT_RESOURCES`, `VIAT_REQUEST`, `VIAT_PRINCIPAL` and
  `VIAT_REQUEST_BODY_FILE` are the per-run context injected into **shell
  workers**; `___VIAT_*___` are protocol sentinels — none are installer
  settings.
- Expanded names such as `VIAT_ARGS_NAME`, `VIAT_ARGS_USER_ID`,
  `VIAT_RESOURCE_DB_HOST`, `VIAT_RESOURCE_DB_PORT`,
  `VIAT_RESOURCE_DB_DATABASE` and `VIAT_RESOURCE_DB_URL` come from each
  run's argument/resource projection — **not** standalone startup switches.
  Internal tests also assert that nested `secret` fields
  (`VIAT_RESOURCE_DB_PASSWORD`, `VIAT_RESOURCE_DB_USER`) are not expanded —
  which does **not** guarantee 1.1.0's top-level projection or
  `VIAT_RESOURCES` is credential-free.
- Never log these environment values or treat the names as a
  "secret-recovery API"; the documented resource-projection limits apply to
  shell equally.
