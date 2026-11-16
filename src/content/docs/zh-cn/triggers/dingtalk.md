---
title: "钉钉 Stream 机器人"
description: "供应商前提、完整创建示例、能力边界与故障恢复。"
doc_id: triggers.dingtalk
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# 钉钉 Stream 机器人

把钉钉机器人接入 Viat 前的准备与边界。供应商侧先完成:在钉钉后台创建
**Stream 模式**的机器人/应用,配置 AppKey/AppSecret、消息能力与组织可见
范围。字段对应:`app_id` = AppKey,`app_secret` = AppSecret;RobotCode
不同时,设账号 `meta.robot_code`。这不是"只有入群 webhook"的机器人,
也**不要求**暴露入站回调 URL。

传输机制:

- 默认 API `https://api.dingtalk.com` 获取 90 秒一次性 gateway ticket,
  再连 WSS;消息订阅为 `/v1.0/im/bot/messages/get`。
- 接收**私聊**与 **@ 机器人的群消息**;`require_mention` 不做额外筛选。
- 规范化 `text` 也处理供应商提供的富文本片段/语音转写;`raw` 保持平台
  原始格式。
- 每帧以 messageId 确认;EVENT claim 失败可用 LATER 请求重投。**成功 ack
  代表已持久 claim,不代表脚本成功。**
- 回复**不能**走事件 socket——POST 到入站 `reply_handle` 的短期
  sessionWebhook;过期的 webhook 不是永久收件地址。`viat.im_send` 用
  支持的主动机器人 API,受供应商约束。
- 超时:REST 15 秒;WSS connect 10 秒;每 30 秒检查 idle,95 秒静默断开。
  供应商常规连接到期会自动重连;**反复 bootstrap/auth 失败应排查凭据/
  权限,不是另建触发器。**

## 创建与响应

先读[完整公共字段、更新/清空、权限和身份契约](chat-accounts.md)。
创建触发器前先建脚本 `chat/reply`:

```python
def main(message):
    return "received: " + message["text"]
```

以下均为**未执行**的源码推导示例,凭据为占位值,未访问供应商;完成权限
与目标复查前保持禁用。

```http
POST /projects/demo/im/accounts
Authorization: Bearer <console-token>
Content-Type: application/json

{"name":"assistant","platform":"dingtalk","enabled":false,"credentials":{"app_id":"<app-id>","app_secret":"<app-secret>"},"meta":{},"groups":[]}
```

```http
POST /projects/demo/im/triggers
Authorization: Bearer <console-token>
Content-Type: application/json

{"name":"assistant","platform":"dingtalk","enabled":false,"account":"assistant","chat_type":"any","require_mention":false,"target":{"kind":"script","name":"chat/reply"},"inputs":{},"params":{},"params_strict":false,"max_concurrent_runs":4,"identity_mode":"off"}
```

账号响应投影:
`{"name":"assistant","platform":"dingtalk","enabled":false,"resource":null,"has_inline_credentials":true,"meta":{},"groups":[],"peer_identity":null,"status":"ok","status_message":null}`
(另有 id/created_at/updated_at;credentials 永不返回)。触发器响应以
`account_id:"<uuid>"`、`target_kind:"script"`、`target_name:"chat/reply"`
代替输入的 account/target 对象,另有公共完整字段与 id/时间戳。保存返回
id;启用前读列表/health——**status ok 不等于在线服务测试通过**。

## 验证、恢复与清理

- 验证:仅对明确授权的隔离供应商账号,以保留全部字段的 PUT 启用;发一条
  虚构消息,核对规范化 text/发送者、回复、账本与执行日志,再验证拒绝
  身份。多个触发器可同时匹配——路由不当会**重复回复**。
- 投递语义按[公共投递契约](chat-accounts.md):无自动 exactly-once/重放
  保证。
- 故障:`degraded` 查出网、可见范围、凭据与争用连接;`needs_reauth`
  要更新正确凭据,**不要反复发消息**。
- 清理:先禁用触发器/账号并处理在途工作 → 撤销测试邀请/身份绑定 → 删除
  隔离对象;供应商应用/凭据的撤销另行处理。

入口:控制台 **Triggers → Chat** 的 Accounts/Populations/Triggers;API
`/projects/<slug>/im/accounts`、`/im/triggers` 及账号 `/health`、
`/messages`;仓库 `im/accounts/assistant.yaml`、
`im/triggers/assistant.yaml`、`viat pull/push --only chat`(内联账号
不导出、不因镜像缺失而删除)。没有独立的 `dingtalk` CLI 或 MCP 连接器
工具。

## 核验依据

契约源码 `03751a67`:`crates/viat-api/src/im/connector/dingtalk.rs`、`im/dispatch.rs`、`handlers/im.rs`;`crates/viat-core/src/types/im.rs`;`crates/viat-cli/src/repo/im.rs`。本页未执行供应商配置/权限或真实投递验证。
