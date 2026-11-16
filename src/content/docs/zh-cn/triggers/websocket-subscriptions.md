---
title: "出站 WebSocket 订阅"
description: "连接外部 JSON feed，以脚本路由、签名 open、心跳及可选 ack 消费消息。"
doc_id: triggers.websocket-subscriptions
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# 出站 WebSocket 订阅

这个方向里 **Viat 是客户端**:拨号连到外部 feed,把收到的 JSON 消息路由给
live **脚本**。它不是[入站 WS 端点](websocket-endpoints.md),不是工作流
触发器,也不是任意二进制 SDK。

权限与边界:

- 所有配置/状态 API 需项目**内容编辑权**。
- URL/headers 是**服务器出网能力**:遵守私网出站限制,凭据用 secret 引用。
- 没有"发布"步骤、没有快照——配置即 live;保存校验不等于真实 feed 兼容
  性测试,URL 校验也不保证 transport 完全免 DNS rebinding。

## 完整创建示例

先建脚本 `feeds/on_event`(`def main(message): return {"received": True}`),
它以 system:ws_trigger 运行,参数有 message、没有 HTTP 的 ctx.request。
源码推导、未执行:

```http
POST /projects/demo/ws-triggers
Authorization: Bearer <console-token>
Content-Type: application/json

{"name":"orders","enabled":false,"config":{"url":"wss://feed.example.invalid/events","headers":{},"routes":{"$default":{"script":"feeds/on_event"}},"message_id_path":"$.id","ack":{"frame":{"type":"ack","id":"{{message_id}}"}},"heartbeat":{"frame":{"type":"ping","ts":"{{now_ms}}"},"every_secs":30},"idle_timeout_secs":120,"hold":"single","max_concurrent":1,"queue_capacity":1000,"on_overflow":"disconnect","log_messages":"errors"}}
```

响应含 `id,name,enabled,config,created_at,updated_at`;config 回显默认值,
路由为 `{script_id:"<uuid>",script:"feeds/on_event"}`(脚本删除后名称为
null)。保存 id/name;启用前先读状态。本页没有连接任何 feed。

| 字段 | 默认/限制 |
| --- | --- |
| `name` | 必填;1–64 个 ASCII 字母/数字/`_-.`。 |
| `enabled` | API/仓库默认 true;显式 false 可安全分阶段创建。 |
| `config.url` | 必填;ws:// 或 wss://;保存时检查出站策略。 |
| `headers` | `{}`;header 名必须有效、无控制字符;完整值 `$secret:<name>` 在服务器侧解析 secret——缺失或非 secret 类型**保存即失败**。 |
| `routes` | 必填;script/script_id 映射(UUID 优先),至少一个消息路由;`$open` 在连接前运行,`$default` 兜底;普通路由名 1–128 个 ASCII 字母数字/下划线/连字符/点/冒号,无空格、不以 `$` 开头。 |
| `route_path` | 可选 RFC9535 JSONPath;**有命名消息路由时必需**,否则全部走 default。 |
| `message_id_path` | 可选 JSONPath;配置了 ack 时**必需**。 |
| `ack` | 可选 `{frame:<JSON>}`;执行成功后发送。 |
| `heartbeat` | 可选 `{frame:<JSON>,every_secs:<正整数>}`;应用层心跳,与原生 ping/pong 是两回事。 |
| `idle_timeout_secs` | 默认 120(≥5);任何收到的帧都会刷新存活;原生 ping 间隔为其一半。 |
| `hold` | 默认 `single`(租约式单连接);`per_instance` 每实例一条连接。 |
| `max_concurrent` | 默认 1;每连接 1–64。 |
| `queue_capacity` | 默认 1000;1–100000。 |
| `on_overflow` | 默认 `disconnect`;或 `drop_oldest`(丢弃并计数最旧的等待消息)。 |
| `log_messages` | 默认 `errors`,可 `all`;失败与 open 始终记录。 |

未知 config/ack/heartbeat 字段一律**拒绝**而非静默用默认。
`PUT /projects/<slug>/ws-triggers/<name>` 是 name/enabled/config 的整体
替换,不是 patch:省略恢复可选默认;null 可清可选的 JSONPath/ack/heartbeat,
不能清必需值/映射/布尔;读取到的路由可原样写回。对账约十秒内重连;脚本
编辑也经新连接生效。**其他触发器支持 workflow 不代表本功能支持。**

## Open 脚本与消息上下文

- `$open` 每次连接前运行,可返回 `{url?,headers?,frames?}`:替换 URL、
  覆盖同名 header、连接后立即发送 frames。计算出的 URL 仍会查出站策略。
- open 的输入/输出**不保留**(可能含凭据),只记执行成功/失败——不要在
  脚本里自行打印秘密。
- 文本帧:JSON 解析为值,非 JSON 文本作为字符串;`route_path` 选命名路由
  或 default;以 `$` 开头的消息值**不能**选 open。二进制帧丢弃并计数,
  不传给脚本。
- `ctx.trigger` 含 `trigger/event/route/message_id/connection_id`;event 为
  open/message;每次重连都是新的 connection_id。
- 脚本返回值**不会**自动作为 socket 回复发送——出站协议由
  ack/heartbeat/open frames 定义。
- 模板只替换完整字符串 `{{message_id}}`、`{{now_ms}}` 并保留类型;
  `id={{message_id}}` 是字面文本。要计算签名就写在脚本里,**没有**更多
  模板语言可虚构。

## 投递、状态与恢复

- 配置了 ack 时:执行**成功后**确认;失败/timeout/断线不确认。"至少一次"
  依赖 feed 真的会重投未确认消息——持久动作仍要按 message id 去重。
- 无匹配路由且无 default 的消息被**丢弃并 ack**,避免"故意忽略的类型"
  无限重投。
- 没配 ack 就没有任何重放/重试保证:断线间隙的消息丢失,失败不会本地
  自动重试。
- 并发为 1 时按到达顺序执行;更高并发下"完成即 ack"。`drop_oldest` 是
  **有意丢数据**;`disconnect` 依赖上游重放——都不是持久本地队列。

观测:`GET /projects/<slug>/ws-triggers` 与 `GET …/<name>` 看配置;
`GET …/<name>/status` 返回 `{name,enabled,connections:[…]}`——每实例
connecting/connected/backoff/standby/stopped、时间/last_error、
received/acked/failed/dropped 计数(任务重建清零)。重连退避 2–60 秒,
健康 30 秒后重置。执行日志 method 为 `WST:open` 或 `WST:message:<route>`,
path 为 `/_ws_trigger/<name>`;不记录含凭据的 URL——显示时去掉
userinfo/query,但这不代表可以把秘密放进 path。

验证用**本地虚构 feed**,覆盖:成功 ack、失败不 ack、溢出、重连、重复 id。
重试前依次查 last_error → 出站策略 → secret → 签名脚本 → 供应商上限。
清理:完整 PUT 保留配置并禁用;`DELETE` 不撤销运行中的副作用,也不撤销
`$open` 已建立的供应商订阅——供应商侧清理需另外授权。仓库文件
`ws_triggers/<name>.yaml` 支持 pull/push(`--only ws_triggers`);注意 API
路由是对象、仓库路由是脚本字符串;没有独立的 WS-trigger CLI/MCP。

## 核验依据

契约源码 `03751a67`:`crates/viat-core/src/types/ws_trigger.rs`;`crates/viat-api/src/handlers/ws_triggers.rs`、WS-trigger 连接/消息实现与 flow 测试;`crates/viat-cli/src/repo/ws_triggers.rs`。示例未执行;不宣称外部 feed 兼容。
