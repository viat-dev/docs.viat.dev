# Weixin private-chat assistant / 微信私聊助手

Viat **1.1.0**, native **Tencent iLink**, private chat only. Fixed bilingual commands with sender→project-user authorization; no group/WeCom/webhook/permanent-auth claim, device actions or LLM calls.

Viat **1.1.0**、**腾讯原生 iLink**，仅私聊。固定双语命令和发送者→项目用户授权；不声称群聊/企业微信/webhook/永久认证，不调用设备或模型。

## Full manual guides / 完整人工指南

- [English QR/poll/binding/authorization/assertion/cleanup](../../src/content/docs/en/applications/weixin-assistant.md)
- [中文扫码、轮询、身份授权、断言与清理](../../src/content/docs/zh-cn/applications/weixin-assistant.md)

## Offline units / 离线验证

From this directory / 在本目录：

```sh
python3 -I validate.py
```

Standard-library only. Loads **actual deployed `wx_reply.py`**, the shared settings and normalized inbound fixture. Default input is unbound; tests explicitly fabricate an **in-memory fake context**, never a valid server binding, for enabled safe replies and denial cases. No provider/binding/poll/send is invoked. The coordinator's offline harness **passed all 5 unit tests**; real-server, QR, polling, provider replies and reauthentication remain unverified.

仅标准库，加载**真实部署的 wx_reply.py**、共享设置及规范化入站夹具。默认输入未绑定；测试仅在内存中明确构造**假上下文**以覆盖安全回复和拒绝，从不制造有效服务端绑定。不联系供应商、不绑定/轮询/发消息。协调者的离线验证环境已**通过全部 5 项单元测试**；真实服务端、扫码、轮询、供应商回复及重新认证仍未验证。

## Layout / 目录

- `project/viat.yaml`: minimal project identity / 最小项目标识。
- `project/scripts/wx_reply.py`: real handler / 真实处理器。
- `project/resources/wx_settings.yaml`: **messages off, sender map empty** / **回复关闭、发送者映射为空**。
- `project/im/triggers/wx_private.yaml`: **disabled**, direct only, required identity, pinned account / **禁用**、仅私聊、强制身份、固定账户。
- `manual/account-create.json`: disabled QR account creation payload, deliberately outside repo-sync / 禁用扫码账户请求，刻意不放入同步账户目录。
- `project/workflows/wx_check.yaml`, `project/endpoints/weixin-assistant/`: inert diagnostic; endpoint deny-all, unpublished / 无副作用诊断，端点拒绝全部、不发布。
- `fixtures/inbound.json`: synthetic unbound message, no context permit / 合成未绑定消息、无会话许可。
- `fixtures/expected.json`: null default plus safe fake-context replies / 默认 null 和假上下文中的固定回复。

JSON-compatible YAML needs no YAML package. No schedules. QR accounts contain inline server secrets and do not round-trip through `im/accounts/*.yaml`; no fake portable account is shipped.

JSON 兼容 YAML，无需 YAML 包。没有计划。扫码账户使用服务端行级凭据，不能通过 im/accounts/*.yaml 往返同步，因此不提供假的可迁移账户。

## Apply inert content / 应用关闭状态的内容

From `project/`, after login and approval / 登录并授权后从 `project/`：

```sh
viat project create weixin-assistant-example "Weixin assistant example"
viat project select weixin-assistant-example
viat project diff --only resources,scripts,workflows,endpoints
viat push --only resources,scripts,workflows,endpoints
viat workflow test wx_check --input '{}'
```

Expected `{"reply":null}`. Create the disabled `wx-example` account using the **manual registered API** in the guide before `viat push --only chat`. Use a new isolated project and reviewed diff: chat mirrors entire collections. Never use all-kind push with minimal metadata (seeded authorizers could be pruned). Retain owned IDs; no project DELETE or blanket prune.

预期 `{"reply":null}`。必须先按指南用**真实已注册 API**人工创建禁用 wx-example 账户，才推送 chat。新隔离项目并审查 diff，chat 镜像整个集合。最小元数据不能全种类推送，可能删除预置认证器。保留自有 ID，不使用项目 DELETE/blanket prune。

Real provider access necessarily remains manual: consent/current provider eligibility → QR start/poll → authenticated project-user binding → verified sender map → separately approved replies. Enabling required routing can send a native login-binding prompt even with application replies off. `context_token` is an inbound conversation permit, not permanent send authorization. `-14` means `needs_reauth`: stop and rescan with the intended human; toggling enabled does not refresh a revoked token. Deleting Viat config does not perform provider-side unbinding.

真实供应商交互必须人工完成：同意与当前准入 → QR start/poll → 项目用户认证绑定 → 核实发送者映射 → 独立授权回复。开启 required 路由后，即便应用回复关闭，也可能发送原生登录绑定提示。context_token 是入站会话许可，不是永久发送权；-14 进入 needs_reauth，应停止并由本人重新扫码，切换 enabled 不能刷新撤销凭据。删除 Viat 配置不代表供应商解绑。
