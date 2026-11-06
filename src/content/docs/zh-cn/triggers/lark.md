---
title: "Lark 国际版机器人"
description: "供应商前提、完整创建示例、能力边界与故障恢复。"
doc_id: triggers.lark
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# Lark 国际版机器人

使用开启机器人能力的 **Lark 自建应用**，配置长连接事件接收、消息订阅（`im.message.receive_v1`）、读/发消息权限和目标租户/用户/群可见性。app_id/app_secret 必须属于国际部署，不能拿国内飞书账号替代；先在供应商侧启用/发布。

platform 是 `lark`，默认 API 为 `https://open.larksuite.com`，不是 open.feishu.cn。与飞书共用 HTTP bootstrap、认证后的 protobuf/二进制 WS、明文 JSON 事件体实现；商店应用和为此长连接路径设置 Encrypt Key 不是支持的替代方案。共同的 `VIAT_IM_FEISHU_HOSTS` allowlist 覆盖两者，不要为了任意 URL 随意放宽。

支持私聊/群聊，require_mention 同样有意义；meta.bot_open_id 应指定本机器人而非任意 @。回复和 `viat.im_send` 用 REST，不走事件 socket；供应商权限/限流/配额仍有效，接受不等于阅读。bootstrap/connect/REST 和分片边界与飞书一致：分片 5 秒、最多 64 片/256 个未完成 payload。

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

{"name":"assistant","platform":"lark","enabled":false,"credentials":{"app_id":"<app-id>","app_secret":"<app-secret>"},"meta":{},"groups":[]}
```

```http
POST /projects/demo/im/triggers
Authorization: Bearer <console-token>
Content-Type: application/json

{"name":"assistant","platform":"lark","enabled":false,"account":"assistant","chat_type":"any","require_mention":false,"target":{"kind":"script","name":"chat/reply"},"inputs":{},"params":{},"params_strict":false,"max_concurrent_runs":4,"identity_mode":"off"}
```

账号响应投影：`{"name":"assistant","platform":"lark","enabled":false,"resource":null,"has_inline_credentials":true,"meta":{},"groups":[],"peer_identity":null,"status":"ok","status_message":null}`，另有 id/created_at/updated_at，永不返回 credentials。触发器响应以 `account_id:"<uuid>"`、`target_kind:"script"`、`target_name:"chat/reply"` 代替输入 account/target 对象，另有公共完整字段及 id/时间戳。保存返回 id，启用前读取列表/health；ok 不等于在线服务测试通过。

## 验证、恢复与清理

仅对明确授权的隔离供应商账号，以保留全部字段的 PUT 启用，发送一条虚构消息，核对规范化 text/发送者、回复、账本和执行日志，再验证拒绝身份。多个触发器可同时匹配，路由不当会重复回复。timeout/副作用按[公共投递契约](chat-accounts.md)，无自动 exactly-once/重放保证。degraded 应查出网、可见范围、凭据和争用连接；needs_reauth 要更新正确凭据，不要反复发消息。先禁用触发器/账号并处理在途工作，撤销测试邀请/身份绑定，再删隔离对象；供应商应用/凭据撤销另行处理。

控制台：Triggers → Chat 的 Accounts/Populations/Triggers。API：`/projects/<slug>/im/accounts`、`/im/triggers` 和账号 `/health`、`/messages`。仓库：`im/accounts/assistant.yaml`、`im/triggers/assistant.yaml`、`viat pull/push --only chat`；内联账号不导出、不因镜像缺失删除。没有独立 `lark` CLI 或 MCP 连接器工具。

依据：`crates/viat-api/src/im/connector/feishu.rs`、`im/dispatch.rs`、`handlers/im.rs`；`crates/viat-core/src/types/im.rs`；`crates/viat-cli/src/repo/im.rs`。本页未执行供应商配置/权限或真实投递验证。
