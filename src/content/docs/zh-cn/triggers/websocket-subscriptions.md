---
title: "出站 WebSocket 订阅"
description: "连接外部 JSON feed，以脚本路由、签名 open、心跳及可选 ack 消费消息。"
doc_id: triggers.websocket-subscriptions
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# 出站 WebSocket 订阅

Viat 是**客户端**，拨号外部 feed，只运行 live **脚本**；不是[入站 WS 端点](websocket-endpoints.md)、工作流触发器或任意二进制 SDK。所有配置/状态 API 需项目内容编辑权。URL/headers 是服务器出网能力，须遵守私网出站限制并使用 secret 引用；无发布门禁/快照。

## 完整创建示例

先建 feeds/on_event，内容可为 `def main(message): return {"received": True}`；以 system:ws_trigger 运行，有 message，没有 HTTP ctx.request。源码推导/未执行示例：

```http
POST /projects/demo/ws-triggers
Authorization: Bearer <console-token>
Content-Type: application/json

{"name":"orders","enabled":false,"config":{"url":"wss://feed.example.invalid/events","headers":{},"routes":{"$default":{"script":"feeds/on_event"}},"message_id_path":"$.id","ack":{"frame":{"type":"ack","id":"{{message_id}}"}},"heartbeat":{"frame":{"type":"ping","ts":"{{now_ms}}"},"every_secs":30},"idle_timeout_secs":120,"hold":"single","max_concurrent":1,"queue_capacity":1000,"on_overflow":"disconnect","log_messages":"errors"}}
```

响应含 `id,name,enabled,config,created_at,updated_at`；config 回显默认值，路由为 `{script_id:"<uuid>",script:"feeds/on_event"}`，脚本删除后名称 null。保存 id/name，完整 PUT 启用前先看状态。本页没有连接 feed。

| 字段 | 默认/限制 |
| --- | --- |
| `name` | 必填 1–64 个 ASCII 字母/数字/`_-.`。 |
| `enabled` | API/仓库默认 true，显式 false 可安全分阶段创建。 |
| `config.url` | 必填 ws:// 或 wss://，检查出站策略。 |
| `headers` | `{}`；header 名有效、无控制字符；完整值 `$secret:<name>` 在服务器解析 secret，缺失/非 secret 保存即失败。 |
| `routes` | 必填 script/script_id 映射，UUID 优先，至少一个消息路由；$open 连接前、$default 兜底，普通名 1–128 个 ASCII 字母数字/下划线/连字符/点/冒号，无空格、不以 $ 开头。 |
| `route_path` | 可选 RFC9535 JSONPath；有命名消息路由时必需，否则都走 default。 |
| `message_id_path` | 可选 JSONPath，配置 ack 时必需。 |
| `ack` | 可选 `{frame:<JSON>}`，成功后发送。 |
| `heartbeat` | 可选 `{frame:<JSON>,every_secs:<正整数>}`，应用层心跳，与原生 ping/pong 不同。 |
| `idle_timeout_secs` | 120，>=5；任何收到的帧刷新存活，原生 ping 间隔为其一半。 |
| `hold` | 默认 single 租约单连接，per_instance 每实例连接。 |
| `max_concurrent` | 1，每连接 1–64。 |
| `queue_capacity` | 1000，1–100000。 |
| `on_overflow` | 默认 disconnect，或 drop_oldest 丢弃/计数最旧等待消息。 |
| `log_messages` | 默认 errors，可 all；失败和 open 总记录。 |

未知 config/ack/heartbeat 字段拒绝而非静默使用默认。`PUT /projects/<slug>/ws-triggers/<name>` 整体替换 name/enabled/config，不是 patch。省略恢复可选默认，null 可清可选 JSONPath/ack/heartbeat，不能清必需值/映射/布尔。读取路由可原样写回。对账约十秒内重连，脚本编辑也经新连接生效；其他触发器支持 workflow 不代表本功能支持。

## Open 脚本与消息上下文

$open 每次连接前运行，可返回 `{url?,headers?,frames?}`：替换 URL、覆盖同名 header，连接后立即发送 frames。计算 URL 再查出站策略。因可能含凭据，open 输入/输出不保留，仅记执行成功/失败，不应自行打印秘密。保存校验不等于真实凭据/feed 兼容测试；URL 校验也不保证 transport 完全免 DNS rebinding。

文本 JSON 解析为值，非 JSON 文本作为字符串；route_path 选命名或 default，以 $ 开头的消息值不能选择 open。二进制帧丢弃计数，不传给脚本。`ctx.trigger` 含 trigger/event/route/message_id/connection_id，event 为 open/message，每次重连新 connection_id。返回值**不自动作为任意 socket 回复发送**，出站协议由 ack/heartbeat/open frames 定义。

模板只替换完整字符串 `{{message_id}}`、`{{now_ms}}` 并保留类型；`id={{message_id}}` 是字面文本，计算签名应写脚本，不能虚构模板语言。

## 投递、状态与恢复

有 ack 时执行成功后确认，失败/timeout/断线不确认。至少一次**依赖 feed 确实重投未确认消息**，持久动作按 message id 去重。无匹配且无 default 的消息被丢弃**并 ack**，避免故意忽略类型无限重投。无 ack 则无重放/重试保证，断线间隙消息丢失，失败不会本地自动重试。并发 1 按到达顺序执行，更高并发完成即 ack；drop_oldest 有意丢数据，disconnect 依赖上游重放，不是持久本地队列。

`GET /projects/<slug>/ws-triggers`、`GET …/<name>` 查配置；`GET …/<name>/status` 返回 `{name,enabled,connections:[…]}`，每实例 connecting/connected/backoff/standby/stopped、时间/last_error、received/acked/failed/dropped 计数，任务重建清零。重连 2–60 秒退避，健康 30 秒后重置。执行日志 method 为 `WST:open` 或 `WST:message:<route>`，path 为 `/_ws_trigger/<name>`，不记录含凭据 URL；显示 URL 去除 userinfo/query，不代表可以把秘密塞 path。

授权测试应使用本地虚构 feed，覆盖成功 ack、失败不 ack、溢出、重连、重复 id。重试前查 last_error、出站策略、secret、签名脚本和供应商上限。完整 PUT 保留配置并禁用；DELETE 不撤销运行中副作用或 $open 已建立的供应商订阅，供应商清理需另外授权。仓库 `ws_triggers/<name>.yaml` 支持 pull/push `--only ws_triggers`，API 路由为对象，仓库路由为脚本字符串；无独立 WS-trigger CLI/MCP。

依据：`crates/viat-core/src/types/ws_trigger.rs`；`crates/viat-api/src/handlers/ws_triggers.rs`、WS-trigger 连接/消息实现和 flow 测试；`crates/viat-cli/src/repo/ws_triggers.rs`。示例未执行，不宣称外部 feed 兼容。
