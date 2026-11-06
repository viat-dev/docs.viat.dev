---
title: "企业微信智能机器人"
description: "供应商前提、完整创建示例、能力边界与故障恢复。"
doc_id: triggers.wecom
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# 企业微信智能机器人

使用机器人的 **API 模式/长连接** 凭据（app_id 为 bot id，app_secret 为密钥），不是群 webhook URL，也不是普通企业应用回调配置。出站 WSS 默认 `wss://openws.work.weixin.qq.com`，部署需允许出网且供应商后台启用机器人。支持私聊和 @ 机器人的群消息；require_mention 不能再次缩小本来因 @ 才到达的消息。

每机器人只允许一个在线连接。Viat 用 lease 协调自己的实例，但相同凭据的外部 SDK 仍能抢占；应停止第二客户端，不要让两者反复重连。每 30 秒 ping，两次未确认视为断线，并区分供应商抢占与瞬态网络错误。

**通过触发脚本返回值回复；WeCom 不支持 `viat.im_send`。** 回复是绑定入站 req_id 的连接帧，不是通用 chat_id 主动发送。脚本较慢时平台约 1.5 秒开启占位流满足首回复期限，不表示结果已准备好，也不缩短脚本 timeout。它不是任意主动告警通道，连接丢失后返回值无法补救。

## 创建与响应

先阅读[完整公共字段、更新/清空、权限和身份契约](chat-accounts.md)，创建触发器前先建 `chat/reply` 脚本：

```python
def main(message):
    return "received: " + message["text"]
```

以下均为**未执行**的源码推导示例，凭据是占位值，未访问供应商。完成权限和目标复查前保持禁用。

```http
POST /projects/demo/im/accounts
Authorization: Bearer <console-token>
Content-Type: application/json

{"name":"assistant","platform":"wecom","enabled":false,"credentials":{"app_id":"<app-id>","app_secret":"<app-secret>"},"meta":{},"groups":[]}
```

```http
POST /projects/demo/im/triggers
Authorization: Bearer <console-token>
Content-Type: application/json

{"name":"assistant","platform":"wecom","enabled":false,"account":"assistant","chat_type":"any","require_mention":false,"target":{"kind":"script","name":"chat/reply"},"inputs":{},"params":{},"params_strict":false,"max_concurrent_runs":4,"identity_mode":"off"}
```

账号响应投影：`{"name":"assistant","platform":"wecom","enabled":false,"resource":null,"has_inline_credentials":true,"meta":{},"groups":[],"peer_identity":null,"status":"ok","status_message":null}`，另有 id/created_at/updated_at，永不返回 credentials。触发器响应以 `account_id:"<uuid>"`、`target_kind:"script"`、`target_name:"chat/reply"` 代替输入 account/target 对象，另有公共完整字段及 id/时间戳。保存返回 id，启用前读取列表/health；ok 不等于在线服务测试通过。

## 验证、恢复与清理

仅对明确授权的隔离供应商账号，以保留全部字段的 PUT 启用，发送一条虚构消息，核对规范化 text/发送者、回复、账本和执行日志，再验证拒绝身份。多个触发器可同时匹配，路由不当会重复回复。timeout/副作用按[公共投递契约](chat-accounts.md)，无自动 exactly-once/重放保证。degraded 应查出网、可见范围、凭据和争用连接；needs_reauth 要更新正确凭据，不要反复发消息。先禁用触发器/账号并处理在途工作，撤销测试邀请/身份绑定，再删隔离对象；供应商应用/凭据撤销另行处理。

控制台：Triggers → Chat 的 Accounts/Populations/Triggers。API：`/projects/<slug>/im/accounts`、`/im/triggers` 和账号 `/health`、`/messages`。仓库：`im/accounts/assistant.yaml`、`im/triggers/assistant.yaml`、`viat pull/push --only chat`；内联账号不导出、不因镜像缺失删除。没有独立 `wecom` CLI 或 MCP 连接器工具。

依据：`crates/viat-api/src/im/connector/wecom.rs`、`im/dispatch.rs`、`handlers/im.rs`；`crates/viat-core/src/types/im.rs`；`crates/viat-cli/src/repo/im.rs`。本页未执行供应商配置/权限或真实投递验证。
