---
title: "飞书长连接机器人"
description: "供应商前提、完整创建示例、能力边界与故障恢复。"
doc_id: triggers.feishu
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# 飞书长连接机器人

在正确飞书租户创建**自建应用**，开启机器人、选择长连接事件接收，授予并订阅业务所需消息事件（包括 `im.message.receive_v1`），在供应商后台发布/启用并配置可见用户/群。保存 app_id/app_secret；商店应用不属于此长连接模式。Viat 保存成功不替代供应商权限和可见范围。

默认 API 为 `https://open.feishu.cn`。与国际 Lark 共用实现，但 platform/account 不同。先 HTTP bootstrap，再使用供应商 protobuf 二进制 WebSocket 协议，不能用通用 JSON WS 订阅代替。长连接事件 body 不加密，不应为此路径配置 Encrypt Key 来替代已认证传输。

接收私聊和群消息，require_mention true 有实际意义。设置账号 `meta.bot_open_id` 为真实机器人 open id，才能区分 @ 本机器人与 @ 任意机器人。text/raw 会规范化，不承诺所有媒体自动下载。回复及 `viat.im_send` 使用供应商 REST，受权限/限流约束，群可见和 API 接受不等于人收到。bootstrap/connect/REST 都有限时，分片重组上限 5 秒、64 片、256 个未完成 payload，并非无限缓存。

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

{"name":"assistant","platform":"feishu","enabled":false,"credentials":{"app_id":"<app-id>","app_secret":"<app-secret>"},"meta":{},"groups":[]}
```

```http
POST /projects/demo/im/triggers
Authorization: Bearer <console-token>
Content-Type: application/json

{"name":"assistant","platform":"feishu","enabled":false,"account":"assistant","chat_type":"any","require_mention":false,"target":{"kind":"script","name":"chat/reply"},"inputs":{},"params":{},"params_strict":false,"max_concurrent_runs":4,"identity_mode":"off"}
```

账号响应投影：`{"name":"assistant","platform":"feishu","enabled":false,"resource":null,"has_inline_credentials":true,"meta":{},"groups":[],"peer_identity":null,"status":"ok","status_message":null}`，另有 id/created_at/updated_at，永不返回 credentials。触发器响应以 `account_id:"<uuid>"`、`target_kind:"script"`、`target_name:"chat/reply"` 代替输入 account/target 对象，另有公共完整字段及 id/时间戳。保存返回 id，启用前读取列表/health；ok 不等于在线服务测试通过。

## 验证、恢复与清理

仅对明确授权的隔离供应商账号，以保留全部字段的 PUT 启用，发送一条虚构消息，核对规范化 text/发送者、回复、账本和执行日志，再验证拒绝身份。多个触发器可同时匹配，路由不当会重复回复。timeout/副作用按[公共投递契约](chat-accounts.md)，无自动 exactly-once/重放保证。degraded 应查出网、可见范围、凭据和争用连接；needs_reauth 要更新正确凭据，不要反复发消息。先禁用触发器/账号并处理在途工作，撤销测试邀请/身份绑定，再删隔离对象；供应商应用/凭据撤销另行处理。

控制台：Triggers → Chat 的 Accounts/Populations/Triggers。API：`/projects/<slug>/im/accounts`、`/im/triggers` 和账号 `/health`、`/messages`。仓库：`im/accounts/assistant.yaml`、`im/triggers/assistant.yaml`、`viat pull/push --only chat`；内联账号不导出、不因镜像缺失删除。没有独立 `feishu` CLI 或 MCP 连接器工具。

依据：`crates/viat-api/src/im/connector/feishu.rs`、`im/dispatch.rs`、`handlers/im.rs`；`crates/viat-core/src/types/im.rs`；`crates/viat-cli/src/repo/im.rs`。本页未执行供应商配置/权限或真实投递验证。
