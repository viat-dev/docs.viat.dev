---
title: '应用：签名 Webhook 接入'
description: '使用 API key、原始请求体 HMAC、重放时间窗与持久本地幂等处理 Webhook，并提供隔离的 Python 验证器。'
doc_id: applications.webhook-ingestion
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# 签名 Webhook 接入

本例接收合成支付事件，对**精确 HTTP 请求体字节**验签，将事件账本和账户汇总一并提交。接入必须同时通过项目 API key 和 HMAC-SHA256。它不调用支付供应商、不发送消息，也不声称与外部系统构成 exactly-once 或分布式事务。

使用服务端 **1.1.0** 与 CLI **1.1.0**。从本手册仓库复制完整的 `examples/webhook-ingestion/` 到私有工作目录；真正推送的项目位于其 `project/`。不要只复制零散代码。`README.md` 与 `README.zh-cn.md` 共用同一组可执行文件。在线配置/部署/清理仍是**未执行的操作说明**，不是在线验收记录；协调者已完成的离线单元验证见下文。

## 文件、权限与前置条件

| 相对示例目录的路径 | 用途 |
| --- | --- |
| `project/viat.yaml` | 一次性项目 `example-webhook-ingestion` 的身份 |
| `project/resources/webhook_db.yaml` | 专属服务端 SQLite 文件 |
| `project/resources/webhook_key.yaml` | 平台持有的 HMAC 密钥；随例提供的值是公开假密钥 |
| `project/scripts/setup.py` | 完整两表 schema，需显式确认字符串才初始化 |
| `project/scripts/ingest.py` | 可部署 HTTP 入口与共用的 `process` 实现 |
| `project/endpoints/default/events.post.yaml` | API key 认证、原始请求体、必需请求头、限流 |
| `fixtures/event.json`、`fixtures/expected.json` | 精确合成输入与成功/失败预期 |
| `sign_fixture.py`、`validate.py`、`case.json` | 仅假密钥的签名器、标准库单元验证器、元数据 |

必须创建**全新项目**，创建者是 Owner。项目设置与发布需要 Owner/Admin，内容编辑可由 Owner/Admin/Developer 完成。平台会话/PAT 仅用于管理，不等于端点 API key。示例项目用户 `case_worker` 使用非管理员内置角色 `public`，只能通过 `case_machine` authorizer 接入。这些名字仅在新建的示例项目中算本例拥有。通过认证的机器可操作专属库中所有账户；本例没有租户/逐账户授权，raw SQL 不会自动套用行权限。

需要：已激活的非生产实例、可信工作站上的 Bash/`curl`/Python 3/匹配 CLI、服务端 `uv`/Python，以及能挂载专属可写 SQLite 文件的操作员。验证器无第三方依赖，不要安装同名 PyPI `viat` 包。

## 1. 不部署的本地验证

在复制后的示例目录：

```sh
python3 -I validate.py
```

验证器加载**实际部署**的 setup/ingest，使用其真实 SQL 操作临时标准库 SQLite，注入假 `viat.ctx`、`ViatError` 与加密 broker。覆盖首次事件、重复、不同字节冲突、错误签名、时间过期、非法 JSON、体积限制、汇总写失败回滚、重启及并发重复。签名器也仅使用公开假密钥。预期末行为 `webhook-ingestion: unit-only validation passed; no HTTP/provider calls`。

这是**单元级**验证，不启动 Viat，不证明真实 API key 准入、请求头暴露、raw-body dispatch、RPC 隔离、发布/构建就绪或多节点语义。协调者已在阻断网络与子进程调用的离线 harness 中成功运行此验证器。单元检查与真实服务验收的区别见[验证状态](../reference/validation.md)。

## 2. 仅配置隔离数据库

操作员在**服务端**配置 `VIAT_SQLITE_ROOTS`，选择其中一个全新的绝对文件路径，使父目录可被服务账号写入，并将同一文件挂载到运行本例的**唯一 API 节点**。把资源中的 `/approved-example-root` 改成批准的挂载根。不要使用 Viat 平台数据库、生产/已有文件、网络文件系统，或多节点上路径相同但内容不同的可写文件。

具有 `sqlite3` 的操作员可用服务账号创建新空库：

```sh
EXAMPLE_DB=/approved-example-root/webhook-ingestion.sqlite
test ! -e "$EXAMPLE_DB" && sqlite3 "$EXAMPLE_DB" 'PRAGMA user_version=1;'
```

路径已存在就**停止并换路径**，不要复用/截断。此操作创建文件，不启动服务。`create_if_missing:false` 刻意让挂载缺失/拼写错误失败，避免悄悄产生另一个库。参见 [SQLite 资源](../assets/resources/sqlite.md)。

完整 schema 就在 `setup.py`：`webhook_events` 保存唯一 `event_id`、精确字节 hash、接收时间、账户和金额；`webhook_totals` 按账户主键保存总额。handler 在一次 broker `db.transaction()` 内写两表。可写 SQLite 事务使用 **BEGIN IMMEDIATE**，竞争写者在查询账本前串行化。不能改成互相独立的资源调用，更不能持锁调用供应商。

## 3. 建项目并按明确范围推送草稿

从复制后的 `project/` 开始。以下 loopback URL 仅是非生产示例，替换为获授权的实际实例。`.viat/` 包含凭据，必须私有且不纳入版本库。

```bash
umask 077
export VIAT_SERVER=http://127.0.0.1:8080
viat --version
read -r -p 'Platform email: ' VIAT_EMAIL
read -r -s -p 'Platform password: ' VIAT_PASSWORD; printf '\n'
viat auth login --server "$VIAT_SERVER" --email "$VIAT_EMAIL" --password "$VIAT_PASSWORD"
unset VIAT_PASSWORD
viat version
viat project create example-webhook-ingestion 'Webhook ingestion example'
viat project select example-webhook-ingestion
viat project member ls --json
viat authorizer create --name case_machine --kind api_key
viat p-user create --identity case_worker --role public
viat apikey create case_machine --user case_worker --name fixture-client
```

任何一步失败都停止。slug 已存在则另取新 slug，并同步改 `viat.yaml`、命令和 URL；不能接管已有项目。检查服务端/CLI 版本及 Owner 成员身份。密码参数会短暂暴露于本机进程信息，必须使用可信工作站并遵循 MFA 提示。安全保存 API key **一次性 secret 和行 UUID**；不要把 token 内的短 `key_id` 当撤销 ID，不要提交/记录到日志。

在控制台选择这个项目 → Project Settings，将 `x-event-timestamp`、`x-event-signature` 加到 **exposed headers**，保留原有条目。必需请求头声明不会自动把头暴露给脚本。本例保持关闭 payload recording，不暴露 `authorization`、cookie 或 `x-viat-*`。项目 API key 由平台验证，不靠脚本读取认证头。

仅做假数据演练可保留提供的假密钥；**不能用已公开的密钥把此路由暴露给不可信流量**。真实供应商需要另行安全配置获授权的 HMAC `crypto_key`，定义轮换和供应商特有签名格式。资源安全创建完成后，把仓库的 `secret.key` 改成字面量导出占位 `$secret`，后续 push 才保留服务端密钥；占位符不能创建新密钥。随例签名器不接受真实密钥，不是生产签名工具。参见 [加密密钥](../assets/resources/crypto_key.md)。

```sh
viat push --only resources,scripts,endpoints
viat script run setup --args '{"confirm":"webhook-ingestion-isolated-db"}'
viat endpoint list --json
```

push 先资源/脚本再端点，不执行初始化，不发布，不是一个全局事务。`--only` 选择整个类别，不是文件。刻意排除 `meta`，避免最小 `viat.yaml` 镜像裁剪刚建立的 authorizer。不能改成对已有项目无范围 push。初始化预期 `{ "ready": true, "tables": ["webhook_events","webhook_totals"] }`。

从列表仅记录 **POST /events** 的实际 UUID：

```bash
read -r -p 'POST /events endpoint UUID: ' ENDPOINT_ID
viat endpoint show "$ENDPOINT_ID" --json
viat publish plan --json
viat endpoint publish "$ENDPOINT_ID"
```

检查目标 `ingest`、authorizer `case_machine`、`raw_body:true`、必需请求头，不应有 cache/async。仓库端点 target 使用 `ref`，不要改成调度的 `name`。先修复发布警告/构建失败，不自动绕过；退出码 0 也需检查 build 输出。发布冻结端点/脚本，项目设置与资源仍为实时值。本例没有 `uses:` 依赖或后台调度。

## 4. 签名、调用、断言

仍在 `project/`，对**未改动**的 fixture 文件生成请求头：

```sh
python3 -I ../sign_fixture.py ../fixtures/event.json
```

复制输出的 `x-event-timestamp`、`x-event-signature`；五分钟内使用。签名消息是 ASCII Unix 秒 + `.` + 精确 body 字节，**包含文件尾换行**。改变 JSON 空格/格式也会改变签名。格式为小写十六进制 HMAC-SHA256，不是供应商的 `v1=` 封装。

```bash
read -r -s -p 'One-time project API key: ' CASE_API_KEY; printf '\n'
read -r -p 'x-event-timestamp: ' EVENT_TIMESTAMP
read -r -p 'x-event-signature: ' EVENT_SIGNATURE
curl --silent --show-error --include \
  "$VIAT_SERVER/p/example-webhook-ingestion/events" \
  -H "Authorization: Bearer $CASE_API_KEY" -H 'Content-Type: application/json' \
  -H "x-event-timestamp: $EVENT_TIMESTAMP" -H "x-event-signature: $EVENT_SIGNATURE" \
  --data-binary @../fixtures/event.json
```

新库预期 HTTP 200 与 `{"event_id":"evt_fixture_001","status":"processed"}`。在时间窗内重复**同一命令和字节**，预期 200、`status:"duplicate"`。若响应在提交后丢失，同样重试；时间窗外可对**同一 ID、同一字节**合法生成新时间戳/签名。不能只因响应丢失就换事件 ID。

操作员在服务端以只读连接断言：

```sh
sqlite3 -readonly /approved-example-root/webhook-ingestion.sqlite \
  'SELECT event_id,account_id,amount_cents FROM webhook_events ORDER BY event_id; SELECT account_id,total_cents FROM webhook_totals ORDER BY account_id;'
```

两次调用后应恰有 `evt_fixture_001|acct_fixture|1250` 与 `acct_fixture|1250`，不是 2500。若改了路径，使用实际批准路径。查看 `viat logs query --endpoint "$ENDPOINT_ID" --limit 10 --json`，同时核对拒绝与运行日志，不把 HTTP 连接成功当业务成功。

## 失败、重放与并发策略

| 情形 | 预期/处理 |
| --- | --- |
| 无/错误 API key | 平台在执行前拒绝；使用正确项目凭据，不是控制台 token |
| 缺少必需头 | 平台 `400 bad_request`，必须同时发送两个头 |
| 头未暴露、格式错误、字节被改 | 脚本 `401 invalid_signature`，检查暴露与原始字节，不能关闭验签 |
| 时间戳过去或未来超过 300 秒 | `401 stale_event`，同步时钟并合法重新签名，不靠扩大时间窗逃避检查 |
| 合法签名但 JSON/字段/标识符/金额非法 | `400 invalid_event`；仅允许 `event_id`、`account_id`、`amount_cents`，ID 为 `[A-Za-z0-9_-]{1,64}`，金额必须是 1–1000000 的整数分，bool/float 不可 |
| 同事件 ID、不同已签名字节 | `409 event_conflict`，隔离调查，不能覆盖账本 |
| 超过 65536 字节 | 脚本 `413 event_too_large`；平台自己的 2 MiB 上限可能更早拒绝更大的请求 |
| 同事件同字节并发 | 第一个提交处理，后续串行写者返回 duplicate；约 5 秒 busy wait 超时则失败，用同 ID/字节及有效签名重试 |
| DB 错误、超时、断线 | 结果可能未知，重试同业务身份；账本/汇总一起提交或回滚，但响应传递独立 |
| 限流 | 平台 `429` 与 `Retry-After`，退避且确保签名时间有效 |

时间戳仅限制新鲜度，**不是持久 nonce 库**。持久重放防护依赖这个单一供应商流的事件唯一账本。ID/hash 至少保留完整供应商重试周期；删除后，同业务 ID 在新签名下可再处理。本例不自动保留/清理。多供应商须使用不同命名空间或 provider/event 联合键。汇总和账本必须一起做 SQLite 感知备份；复制一个独立账本不等于共享去重。

只有本地 SQL 账本/汇总具有原子性。若增加 SMTP、HTTP、队列、支付，要使用持久 outbox、下游幂等与对账；数据库事务无法原子提交外部副作用。本例**不依赖**平台 `Idempotency-Key` 的尽力传输重放保护来保证业务幂等。

## 只清理本例拥有的对象

停止调用并等待在途运行结束。确保仍选择新建项目、核对记录的叶端点/密钥行 ID，然后：

```sh
viat endpoint unpublish "$ENDPOINT_ID"
viat endpoint delete "$ENDPOINT_ID"
viat apikey revoke case_machine KEY_ID_FROM_CREATE
viat p-user delete case_worker
viat authorizer delete case_machine
viat script delete ingest
viat script delete setup
viat resource delete webhook_key
viat resource delete webhook_db
unset CASE_API_KEY EVENT_SIGNATURE EVENT_TIMESTAMP
```

虽然 CLI 参数叫 key ID，`KEY_ID_FROM_CREATE` 必须替换为创建时 stderr 或 `viat apikey list case_machine` 中的 **API key 行 UUID**，不是 `vsk_…` 内的短 `key_id`，也不能用猜测/示例 UUID。不删除父分支，不做全量 prune。资源删除不会删除 SQLite 文件；保留证据并确认无资源/运行占用后，操作员仅可移除记录的**精确新文件及其 SQLite sidecar**。若保留空项目，仅移除本次加的两个 exposed headers。私有本地凭据另行安全清理；`viat auth logout` 不等于撤销所有服务端凭据。

**1.1.0 不支持项目 DELETE。** 保留空隔离项目，不虚构项目删除 CLI/API。不要在其他项目套用这些清理名称。

## 契约依据与未验证边界

参见 [repo-sync](../projects/repo-sync.md)、[HTTP](../triggers/http.md)、[脚本上下文](../assets/scripts/context.md)、[端点认证](../auth/endpoints.md)、SQLite/crypto 参考。定点源码依据：`crates/viat-runtime/src/python.rs` 的 `_Sql`、`_Tx`、crypto verify，`crates/viat-api/src/runner/broker.rs` 的 SQLite 事务，`crates/viat-cli/src/repo/{resources,endpoints}.rs`。读源码不等于在线验证；真实供应商签名兼容、密钥轮换、broker/并发、网络与发布还需独立获授权的集成检查，单元验证不作这些承诺。
