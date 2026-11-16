---
title: "飞书长连接机器人"
description: "供应商前提、完整创建示例、能力边界与故障恢复。"
doc_id: triggers.feishu
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# 飞书长连接机器人

接入前在飞书侧完成:在**正确的飞书租户**创建**自建应用**,开启机器人、
选择**长连接**事件接收,授予并订阅业务所需消息事件(含
`im.message.receive_v1`),在供应商后台发布/启用并配置可见用户/群。保存
app_id/app_secret。商店应用不属于此长连接模式;**Viat 保存成功不替代
供应商权限与可见范围配置**。

传输机制:

- 默认 API `https://open.feishu.cn`。与国际版 Lark 共用实现,但
  platform/account 互不相同。
- 先 HTTP bootstrap,再走供应商的 **protobuf 二进制 WebSocket 协议**——
  不能用通用 JSON WS 订阅代替。
- 长连接事件 body 不加密;不要为此路径配置 Encrypt Key 来"替代"已认证
  传输。
- 接收私聊与群消息;`require_mention: true` 在这里有实际意义。把账号
  `meta.bot_open_id` 设为真实机器人 open id,才能区分"@ 本机器人"与
  "@ 任意机器人"。
- `text`/`raw` 会规范化;不承诺自动下载所有媒体。回复与 `viat.im_send`
  走供应商 REST,受权限/限流约束——**群可见与 API 接受不等于人收到**。
- bootstrap/connect/REST 均有限时;分片重组上限 5 秒、64 片、256 个未
  完成 payload——不是无限缓存。

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

{"name":"assistant","platform":"feishu","enabled":false,"credentials":{"app_id":"<app-id>","app_secret":"<app-secret>"},"meta":{},"groups":[]}
```

```http
POST /projects/demo/im/triggers
Authorization: Bearer <console-token>
Content-Type: application/json

{"name":"assistant","platform":"feishu","enabled":false,"account":"assistant","chat_type":"any","require_mention":false,"target":{"kind":"script","name":"chat/reply"},"inputs":{},"params":{},"params_strict":false,"max_concurrent_runs":4,"identity_mode":"off"}
```

账号响应投影:
`{"name":"assistant","platform":"feishu","enabled":false,"resource":null,"has_inline_credentials":true,"meta":{},"groups":[],"peer_identity":null,"status":"ok","status_message":null}`
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
不导出、不因镜像缺失而删除)。没有独立的 `feishu` CLI 或 MCP 连接器
工具。

## 核验依据

契约源码 `03751a67`:`crates/viat-api/src/im/connector/feishu.rs`、`im/dispatch.rs`、`handlers/im.rs`;`crates/viat-core/src/types/im.rs`;`crates/viat-cli/src/repo/im.rs`。本页未执行供应商配置/权限或真实投递验证。
