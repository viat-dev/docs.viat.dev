---
title: "企业微信智能机器人"
description: "供应商前提、完整创建示例、能力边界与故障恢复。"
doc_id: triggers.wecom
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# 企业微信智能机器人

接入企业微信智能机器人用的是 **API 模式/长连接**凭据(`app_id` = bot id,
`app_secret` = 密钥)——不是群 webhook URL,也不是普通企业应用的回调配置。
出站 WSS 默认 `wss://openws.work.weixin.qq.com`:部署需允许出网,供应商
后台需启用机器人。支持私聊与 @ 机器人的群消息;`require_mention` 无法
进一步缩小"本来就因 @ 才到达"的消息。

连接与回复模型,四条关键事实:

- **每机器人只允许一个在线连接。** Viat 用 lease 协调自己的实例,但用
  相同凭据的外部 SDK 仍能抢占——应停掉第二个客户端,不要让两者反复
  重连。
- 每 30 秒 ping,两次未确认视为断线;平台会区分供应商抢占与瞬态网络
  错误。
- **回复只能通过触发脚本的返回值;WeCom 不支持 `viat.im_send`。** 回复是
  绑定入站 req_id 的连接帧,不是"向任意 chat_id 主动发送"。
- 脚本较慢时,平台约 1.5 秒开启占位流以满足首回复期限——这不代表结果
  已就绪,也不会缩短脚本 timeout。它不是任意主动告警通道;连接丢失后,
  返回值无法补救。

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

{"name":"assistant","platform":"wecom","enabled":false,"credentials":{"app_id":"<app-id>","app_secret":"<app-secret>"},"meta":{},"groups":[]}
```

```http
POST /projects/demo/im/triggers
Authorization: Bearer <console-token>
Content-Type: application/json

{"name":"assistant","platform":"wecom","enabled":false,"account":"assistant","chat_type":"any","require_mention":false,"target":{"kind":"script","name":"chat/reply"},"inputs":{},"params":{},"params_strict":false,"max_concurrent_runs":4,"identity_mode":"off"}
```

账号响应投影:
`{"name":"assistant","platform":"wecom","enabled":false,"resource":null,"has_inline_credentials":true,"meta":{},"groups":[],"peer_identity":null,"status":"ok","status_message":null}`
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
- 故障:`degraded` 查出网、可见范围、凭据与争用连接(包括外部 SDK 抢
  占);`needs_reauth` 要更新正确凭据,**不要反复发消息**。
- 清理:先禁用触发器/账号并处理在途工作 → 撤销测试邀请/身份绑定 → 删除
  隔离对象;供应商应用/凭据的撤销另行处理。

入口:控制台 **Triggers → Chat** 的 Accounts/Populations/Triggers;API
`/projects/<slug>/im/accounts`、`/im/triggers` 及账号 `/health`、
`/messages`;仓库 `im/accounts/assistant.yaml`、
`im/triggers/assistant.yaml`、`viat pull/push --only chat`(内联账号
不导出、不因镜像缺失而删除)。没有独立的 `wecom` CLI 或 MCP 连接器
工具。

## 核验依据

契约源码 `03751a67`:`crates/viat-api/src/im/connector/wecom.rs`、`im/dispatch.rs`、`handlers/im.rs`;`crates/viat-core/src/types/im.rs`;`crates/viat-cli/src/repo/im.rs`。本页未执行供应商配置/权限或真实投递验证。
