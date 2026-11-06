---
title: "论文摘要：RSS、持久去重与来源引用"
description: "以夹具为默认路径，按需开启 HTTP 采集、模型摘要、SQLite 去重和投递。"
doc_id: applications.paper-digest
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# 论文摘要

完整源码位于手册仓库的 `examples/paper-digest/`。这是可推送的项目，不是平台内置的论文连接器：读取 RSS 2.0 摘要，规范化 HTTPS 来源 URL，逐篇生成带引用的摘要，并可选择向已批准的投递服务发送 POST。它不下载 PDF、不搜索网页、不验证科学结论，也不支持 Atom。

**验证状态：** 协调者的离线验证环境已通过全部 **9 项单元测试**，使用真实处理器、假资源和本地临时数据。这不验证运行中的 Viat 服务端、真实资源代理、调度器、在线 feed、付费模型或投递；这些仍需人工明确授权后检查。参见[验证层次](../reference/validation.md)。

## 前提与安全边界

- 已激活的服务端及 CLI **1.1.0**、平台登录、服务端 Python/uv，以及创建隔离项目的权限。Developer 可编辑，发布需 Owner/Admin。登录步骤见[首个端点](../getting-started/first-endpoint.md)，此案例不提供虚构的部署命令。
- 工作站安装 Python 3。标准库验证器给真实的 `project/scripts/pd_run.py` 注入明确的假 `viat.ctx`；它不是实际 worker、SQL 代理、调度器或模型集成测试。
- 推送资源前，运维须将 `/var/lib/viat/examples` 纳入 `VIAT_SQLITE_ROOTS` 并准备可写、持久化的服务端目录；也可修改 `pd_store.yaml` 使用已批准的绝对路径。这不是工作站路径。`create_if_missing:true` 允许连接或 Test 时创建文件，不要随意点击资源测试。多节点必须另行设计存储/执行位置；各节点各有本地文件不等于共享去重。
- `*.example.test` 和合成模型 key 都是无效占位，不是真实服务或凭据。环境可能连保存资源也要求已批准的 URL；请按环境配置，不要放宽出站保护。

默认：`source_mode:fixture`、`model_mode:fixture`，`network_enabled`、`paid_calls_enabled`、`durable_enabled`、`delivery_enabled` 全为 `false`。计划禁用，端点拒绝全部认证器。默认脚本仅读取合成配置并返回 JSON。保存资源不代表已经连通。

## 文件与共享输入

`project/viat.yaml` 指向 `paper-digest-example`。`resources/pd_settings.yaml` 内嵌 RSS（含带片段的重复 URL）及固定摘要，部署脚本和验证器共用这些输入。`fixtures/expected.json` 是默认脚本的精确结果：一篇合成论文、一个来源引用，`skipped:0`、`durable:false`、`delivery_enabled:false`。同一批 feed 内先去重；`skipped` 统计既有持久占位，不统计批内重复。

`pd_run.py` 声明配置 `pd_settings`、HTTP `pd_feed`、LLM `pd_model`、SQLite `pd_store`、HTTP `pd_delivery` 五个资源。凭据留在平台代理侧。下方是工作流文件的全部内容：

```json fixture=paper-digest/project/workflows/pd_daily.yaml
{
  "inputs": {},
  "steps": [{"id":"digest","script":"pd_run","args":{}}],
  "outputs": {"digest":"$digest.output"},
  "timeout": 120,
  "max_concurrent": 1
}
```

JSON 属于合法 YAML；案例的 `.yaml` 故意采用 JSON 兼容写法，验证器无需 YAML 包。端点目标用 **`ref`**，计划目标用 **`name`**。新建树 `paper-digest` 默认前缀 `/paper-digest`，因此路径为 `POST /p/paper-digest-example/paper-digest/digest`；复用对象时先核对实际树路径。

## 应用默认无外部调用项目

以下是**未执行的人工远程操作**。从手册仓库根目录开始：

```sh
cd examples/paper-digest
python3 -I validate.py
cd project
viat project create paper-digest-example "Paper digest example"
viat project select paper-digest-example
viat project diff --only resources,scripts,workflows,schedules,endpoints
viat push --only resources,scripts,workflows,schedules,endpoints
viat schedule show pd_daily --json
viat endpoint list --json
viat workflow test pd_daily --input '{}'
```

使用未占用的 slug；更名需同步修改 `viat.yaml` 和全部命令/路径。若已存在，不要假定是自己的测试项目。必须从 **`project/`** 推送，不是手册根目录。私下记录本次创建的名称、端点 ID，作为清理所有权凭据。

不要执行全种类 push：最小 `viat.yaml` 未列出 authorizers/roles/scope claims，元数据镜像可能删除项目预置认证器。`--only` 选择整个种类，而不是只选案例前缀。计划及端点同步仍会在镜像范围内删除其他对象，因此必须使用全新隔离项目、审查 diff，发现意外删除就停止。脚本/工作流/资源仅 upsert；push 不发布，也不初始化业务表。

### 断言夹具结果

本地验证器应通过真实处理器分支、临时 SQLite 文件跨连接去重、非法引用、失败占位、投递不确定状态及精确假 HTTP 请求等单元检查。临时数据库不是服务端数据库；通过并不证明部署集成成功。

人工工作流测试应返回 `{"digest": ...}` 包装的 `fixtures/expected.json`。检查实际 JSON 和失败步骤；计划必须仍为 `enabled:false`，端点保持未发布/拒绝全部。不要把 `viat script test` 当此验证器的别名，它调用另一套语言测试工具。

## 明确开启持久采集

1. 保持计划暂停、投递关闭。审查 `pd_feed.plain.base_url`：适配器只调用 `GET /feed.xml`，超时 10 秒。准备该路径上的已批准 RSS 服务。文本上限 256 KiB、最多处理前 20 个 item、标题不超过 300 字符、摘要不超过 12000；拒绝 DOCTYPE/实体声明。HTTP helper 在应用大小检查前已缓冲响应，仍需运维限制上游响应体。脚本不会访问文章链接。
2. 确认持久 SQLite 文件后，才将 `pd_settings.plain.data.durable_enabled` 设为 `true`。首次持久运行只创建自有 `pd_items` 表；push 不隐式运行迁移。只有批准网络运行后才设 `source_mode:http`、`network_enabled:true`。
3. 不用付费模型时保持 fixture 模式，并按规范化来源 URL 填写经审阅的 `fixture_summaries`。缺少夹具会失败，不会自动回退到模型。要用真实模型，需设 `model_mode:resource`、`paid_calls_enabled:true`，按 [LLM 资源](../assets/resources/llm.md)配置 provider/endpoint/model，并通过控制台安全保存真实 secret。替换服务端合成 key 后，将仓库 key 改为 `"$secret"` 以便后续推送保留真实值；占位本身不能创建新凭据。本案例不发现模型或注册供应商。
4. `viat push --only resources` 推送经审核的配置，然后人工测试一次 `pd_daily` 并看执行日志。提示词只发送标题、摘要和来源，不是全文。模型输出必须是 JSON：非空 summary、不超过 2000 字符，citations 必须恰好为给定 URL；工具调用和虚构 URL 都拒绝。这仅检查引用来源，**不验证摘要是否由原文支持或事实正确**。来源内容可能含提示注入，扩大投递前需人工审核。

### 去重、失败与恢复

处理器在任何外部调用前要求 HTTP feed、resource 模型和投递模式必须同时启用 `durable_enabled:true`。这些开关是服务端配置，不是端点参数。

持久 key 为 HTTPS URL 的 SHA-256：authority 转小写、去掉 fragment，保留 path/query。本案例永久抑制同 URL 的修订，不同 query 当作不同来源，不使用 RSS GUID。若不符合你的 feed 身份规则，须明确调整。

主键上的 `INSERT OR IGNORE` 在模型调用前原子占位。占位后崩溃会留下 `claimed`；模型输出不合法记录 `failed`；成功保存带引用结果并置 `ready`。后续运行跳过所有已存在 key，包括 failed/claimed。这避免自动重复计费，却可能保留未完成工作；**不是恰好一次或持久工作流承诺**，也没有自动恢复占位。

运维可在该资源的查询控制台只读检查自有账本：

```sql
SELECT item_key, source_url, state, delivery_state, result_json FROM pd_items;
```

不要盲删占位。先核对模型费用、已有结果和下游效果，备份账本；批准重试后才可通过数据库 helper/查询工具用绑定 `:key` 删除**一个经核查的 key**，不要用清空整表“修复”重试。跨重启保留账本才是持久去重，Python 本地集合不是。

## 计划、端点与投递的独立授权

计划是每天 **08:00 UTC**，重叠 `skip`、一次尝试、不 catch-up。直接工作流计划使用实时草稿和 scheduler 主体，不是发布快照或个人 token。单次运行核验、且明确授权未来成本后，可 `viat schedule resume pd_daily`；`viat schedule pause pd_daily` 仅在协调后停止新触发，不取消在途执行。

可选端点默认拒绝全部。要开放，先在文件把 `allowed_authorizers` 改为实际存在的项目用户认证器（例如 `password`），仅推送 endpoints，审查 `viat publish plan --json`，再用实际叶子 ID 执行 `viat endpoint publish ENDPOINT_ID`。使用**项目登录** token，不是平台 PAT；还要确认未认证请求被拒绝。严格参数契约不接受 query/body 参数，调用者不能改写服务端安全开关。

投递需另外授权：固定 `pd_delivery` 的已批准 base URL 与平台代理凭据，取得接收方同意，再在持久模式设 `delivery_enabled:true`。每篇向 `POST /digest` 发送一份 JSON，不是原生邮件/聊天连接器。发送前持久状态变为 `uncertain`，成功返回后变为 `accepted`；超时或响应丢失不自动重试，accepted 不代表最终送达。旧的 claimed/ready 条目不会因开启开关而补发。恢复需人工核对，或另行审查支持供应商幂等的 outbox；本案例不提供全量重放。

## 只清理自有对象

先暂停 `pd_daily`、关闭投递、取消自有叶子发布，并核算在途执行。仅替换为**已记录的自有端点 ID**：

```sh
viat schedule pause pd_daily
viat endpoint unpublish ENDPOINT_ID
viat endpoint delete ENDPOINT_ID
viat schedule delete pd_daily
viat workflow delete pd_daily
viat script delete pd_run
viat resource delete pd_delivery
viat resource delete pd_model
viat resource delete pd_feed
viat resource delete pd_store
viat resource delete pd_settings
```

从未发布的叶子跳过 unpublish。仅当 `paper-digest` 树确为本次创建，且检查节点确认已空，才 `viat tree delete paper-digest`。删除资源不会删除 SQLite 文件或撤销投递；指定文件的归档/删除、上游凭据撤销需运维单独批准。不要删除共享文件/表，不要 blanket prune，不要虚构项目 DELETE 路由；1.1.0 没有注册该路由，空项目可以保留。

## 契约与待验证事项

参考[仓库同步](../projects/repo-sync.md)、[HTTP 资源](../assets/resources/http_api.md)、[SQLite](../assets/resources/sqlite.md)、[工作流](../assets/workflows/overview.md)、[计划](../triggers/schedules.md)、[端点认证](../auth/endpoints.md)。维护证据：固定版本产品的 `crates/viat-cli/src/repo/{resources,endpoints,schedules}.rs`、`crates/viat-runtime/src/python.rs`、`crates/viat-api/src/lib.rs` 注册路由。

仍需人工验证：服务端路径与出站策略、资源解析、RSS 编码/大小、并发 worker 下 SQL 代理行为、所选模型 JSON/费用/隐私、调度准入与时间、发布后的认证拒绝、下游幂等与送达。离线夹具不证明这些集成能力。
