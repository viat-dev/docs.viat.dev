# Paper digest / 论文摘要

Viat server/CLI **1.1.0**. Complete fixture-first RSS → cited summary project; generic HTTP ingestion/delivery, an optional LLM resource, and a SQLite claim ledger. No native research/email connector is implied.

Viat 服务端/CLI **1.1.0**。完整的夹具优先 RSS → 引用摘要项目，包含通用 HTTP 采集/投递、可选 LLM 资源和 SQLite 占位账本；不声称存在原生论文/邮件连接器。

## Read first / 先阅读

- [English deployment and cleanup guide](../../src/content/docs/en/applications/paper-digest.md)
- [中文配置、应用、断言与清理指南](../../src/content/docs/zh-cn/applications/paper-digest.md)

## Offline validation / 离线验证

From this directory / 在本目录运行：

```sh
python3 -I validate.py
```

Standard-library only. Executes **the deployed `project/scripts/pd_run.py`**, not a second implementation. The fake context uses shared feed/summary config, fake HTTP/model resources and a temporary SQLite file to check durable claims across connections, citation rejection and uncertain-delivery non-retry. It does not invoke Viat, a model, HTTP, scheduling or delivery. The coordinator's offline harness **passed all 9 unit tests**; real Viat/broker, scheduler and provider integration remains unverified.

仅标准库，执行**实际部署的脚本**，不是另写一份算法。假上下文共用 feed/摘要配置、假 HTTP/模型资源及临时 SQLite 文件，验证跨连接去重、引用拒绝与不确定投递不自动重试。不调用 Viat、模型、HTTP、调度或投递。协调者的离线验证环境已**通过全部 9 项单元测试**；真实 Viat/资源代理、调度器和供应商集成仍未验证。

## Layout / 目录

- `case.json`: release and validation command / 版本与验证命令。
- `project/viat.yaml`: minimal project identity, **not full auth metadata** / 最小项目标识，**不是完整认证元数据**。
- `project/resources/`: `pd_settings`, `pd_feed`, `pd_model`, `pd_store`, `pd_delivery`.
- `project/scripts/pd_run.py`: actual RSS parsing, citation validation and claim/delivery logic / 真实采集、引用检查与占位/投递逻辑。
- `project/workflows/pd_daily.yaml`, `project/schedules/pd_daily.yaml`: daily 08:00 UTC, **disabled** / 每日 UTC 08:00，**禁用**。
- `project/endpoints/paper-digest/digest.post.yaml`: strict no-argument workflow endpoint, **deny-all** / 严格无参数端点，**拒绝全部**。
- `fixtures/expected.json`: exact default script output; workflow wraps it in `digest` / 默认精确结果，工作流外包 `digest`。

All `.yaml` files use JSON-compatible YAML so no YAML dependency is needed. Shared feed includes two copies of one URL; the expected result contains one cited synthetic abstract. No real publication is claimed.

所有 `.yaml` 使用兼容 JSON 的 YAML，无需 YAML 依赖。共享 feed 含同 URL 两份记录，期望输出仅一篇带引用的合成摘要，不冒充真实论文。

## Apply safely / 安全应用

After prerequisite approval, from `project/` only / 满足指南前提后，仅从 `project/`：

```sh
viat project create paper-digest-example "Paper digest example"
viat project select paper-digest-example
viat project diff --only resources,scripts,workflows,schedules,endpoints
viat push --only resources,scripts,workflows,schedules,endpoints
viat workflow test pd_daily --input '{}'
```

These are manual **remote writes/execution**, not offline validation. Use an unused isolated project. Do not run all-kind push: minimal metadata can prune seeded authorizers. `--only` is a kind filter, not a name filter; review schedule/endpoint mirror deletions. Retain returned IDs for owned cleanup; no project DELETE or blanket prune.

这些是人工**远程写入/执行**，不是离线验证。使用未占用的隔离项目，不执行全种类 push，以免最小元数据删除预置认证器。`--only` 不是名称过滤器，须审查计划/端点镜像删除。保留创建 ID，只清理自有对象，不用项目 DELETE 或 blanket prune。

Default network/model/durable/delivery flags are off. Operator-approved persistent SQLite path/root is still needed to save `pd_store`; do not press resource Test. Real feed/model/delivery require separate explicit opt-in, credentials and approved destinations. Existing failed/claimed keys are held for manual recovery; a timeout never proves a POST did not happen. See both guides for the precise recovery and cleanup order.

默认网络/模型/持久写入/投递均关闭。保存 pd_store 仍需运维批准持久 SQLite 路径与根目录，不要点击资源 Test。真实 feed/模型/投递需独立授权、凭据和出站许可。failed/claimed key 留待人工恢复；超时不代表 POST 没发生。恢复与清理顺序见双语指南。
