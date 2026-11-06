---
title: "RabbitMQ 队列触发器"
description: "完整 AMQP 配置、确认映射、顺序、背压和恢复。"
doc_id: triggers.queues
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# RabbitMQ 队列触发器

通过项目 **amqp** 资源消费已有 RabbitMQ 队列，每次投递运行实时脚本/工作流。不支持 endpoint、RocketMQ/MQTT，也无发布步骤。全部管理、读取、fire 历史 API 都需项目**内容编辑权**，不同于成员可用的 schedule/watch。拓扑、路由、持久性、DLX/DLQ、投递上限、consumer timeout 由 broker 运维负责；保存触发器不创建/测试队列。

## 完整创建与响应

源码推导/未执行：先建 amqp 资源 mq、broker 队列 demo.incoming 和 ingest 脚本：

```python
def main(message, message_meta):
    return {"accepted": True, "message_id": message_meta["message_id"]}
```

```http
POST /projects/demo/queue-triggers/incoming
Authorization: Bearer <console-token>
Content-Type: application/json

{"resource":"mq","queue":"demo.incoming","max_concurrent_runs":1,"ack_deadline_override":false,"target":{"kind":"script","name":"ingest"},"inputs":{},"enabled":false}
```

名称在**路径**中，不是必填 body。创建/更新返回 row，列表/详情另有 recent_fires。row 示例：

```json
{"id":"00000000-0000-4000-8000-000000000001","project_id":"00000000-0000-4000-8000-000000000002","name":"incoming","enabled":false,"resource":"mq","queue":"demo.incoming","max_concurrent_runs":1,"ack_deadline_override":false,"target_kind":"script","target_name":"ingest","inputs":{},"created_at":"2026-11-06T00:00:00Z","updated_at":"2026-11-06T00:00:00Z"}
```

| 字段 | 默认/限制 |
| --- | --- |
| `resource` | 必填项目 amqp 资源名，可带 folder；凭据留在平台。 |
| `queue` | 非空白、<=255 字节、无控制字符；被动消费，broker 管声明。 |
| `max_concurrent_runs` | 默认 1，整数 1–16，同时是 broker prefetch。 |
| `ack_deadline_override` | false，绕过保存时 timeout 安全检查，不会修改 broker。 |
| `target` | 已存在 `{kind:script|workflow,name:"folder/name"}`。 |
| `inputs` | 默认 null，运行时合并对象常量；建议 `{}`，保留 message/message_meta 会覆盖同名常量。 |
| `enabled` | API/仓库及整体 PUT 默认 **true**，但**控制台新建默认暂停/false**；API 分阶段创建须显式 false。 |
| `expected_updated_at` | 可选/null 无条件更新；PUT 应原样使用返回 timestamp，包含小数秒；不一致返回 409 且不应用任何字段，创建无需此项。 |

`PUT …/queue-triggers/<name>` 整体替换，省略可选项恢复默认，必填不能 null。紧急暂停用 `POST …/<name>/enabled {"enabled":false}`，避免过时完整表单覆盖。控制台保存含 expected_updated_at；冲突应重新打开当前数据并有意合并，不能盲删前置条件。修改约十秒对账生效，执行配置改变重启消费者，已运行投递保留启动配置。

## ack deadline 与实际投递

保存会拒绝资源缺失/类型错误、目标缺失、队列/并发非法，或部署 `VIAT_MAX_ASYNC_TIMEOUT_SECS`（默认 1800）大于 `VIAT_QUEUE_ACK_DEADLINE_SECS`（默认 1500），除非 override true。因此完全默认的部署可能**无法保存**新触发器：应根据 broker 真实 consumer_timeout 提高 deadline、降低运行时上限，或验证 broker 后明确 override；否则长任务仍在运行就可能重投，override 不防重复。

参数为 message（JSON 解析；非 JSON 为 `{raw_body_b64:"…"}`）、message_meta（`message_id,routing_key,redelivered`）及常量。以 queue-trigger system principal 而非 HTTP 调用者运行，资源授权/目标 timeout 仍适用。**没有去重账本**，至少一次投递，即使有 message_id 也需业务幂等。

| 运行结果 | broker 动作 |
| --- | --- |
| 成功 | ack。 |
| 脚本拒绝/客户端错误分类 | nack、requeue false；配置 DLX 则死信，否则可能丢弃。 |
| timeout、overload、传输/内部/服务端失败 | nack、requeue true；由 broker 投递策略限制 poison loop，Viat 无通用重试次数/退避。 |
| 项目缺失、目标删除/无法解析 | ack 并记录配置错误，避免无限 requeue；修复配置不会复活已确认消息。 |

副作用成功后 ack 失败/断线仍可重投；fire 历史是观测，不是 broker 状态真相。不能声称没 DLQ 就一定保留拒绝消息。显式 HTTP 风格 response 不代替 runner 错误分类，应正确使用拒绝/错误 API。

## 顺序、背压、运维和清理

并发 semaphore 与 basic_qos prefetch 共用上限。1 时单消费者逐条处理；多 Viat 实例/其他消费者要全局顺序，应在 broker 配 **x-single-active-consumer:true**，仅并发 1 不是跨消费者全序。>1 可完成乱序，requeue/reconnect 即使串行也可改变到达顺序，由 broker 仲裁而非 Viat claim 账本。

`GET /projects/<slug>/queue-triggers`、`GET …/<name>`、`GET …/<name>/fires` 观测配置/投递。fire 含 `id,trigger_id,execution_id,message_id,routing_key,redelivered,outcome,detail,fired_at`，outcome 为 ack/dlq/requeue。应合看 broker ready/unacked、死信路由和运行时日志。连接错误会退避重连；缺权限/队列要修 broker，不是反复新建触发器。

无独立队列触发器 CLI；支持 `queue_triggers/<name>.yaml`、`viat pull/push --only queue_triggers`。镜像会删除本地缺失远端项，先 diff。仅在授权隔离队列/DLQ 验证成功/拒绝/timeout/重投。先 pause，处理在途/unacked，再 DELETE 触发器；不会删除/清空 broker 队列、重投已 ack 消息或撤销写入。人工 DLQ 重放需单独授权并做业务去重，取消/暂停不是事务回滚。

依据：`crates/viat-api/src/handlers/queue_triggers.rs`、`queue_trigger.rs`；`crates/viat-core/src/types/queue_trigger.rs`；`crates/viat-cli/src/repo/queue_triggers.rs`；控制台队列编辑器/测试。示例源码推导未执行，无 broker/网络调用。
