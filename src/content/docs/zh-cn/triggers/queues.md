---
title: "RabbitMQ 队列触发器"
description: "完整 AMQP 配置、确认映射、顺序、背压和恢复。"
doc_id: triggers.queues
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# RabbitMQ 队列触发器

队列触发器通过项目的 **amqp** 资源消费已有 RabbitMQ 队列,每次投递运行
实时的脚本/工作流。没有发布步骤,也不支持 endpoint 目标或
RocketMQ/MQTT——需要它们的场景要显式适配。

权限与边界,先记三条:

- 全部管理、读取与 fire 历史 API 都需项目**内容编辑权**——不同于成员即可
  用的 schedule/watch。
- 拓扑、路由、持久化、DLX/DLQ、投递上限、consumer timeout 都由 broker
  运维负责;**保存触发器不会创建或测试队列**。
- 执行以 queue-trigger system principal 运行,不是 HTTP 调用者;资源授权
  与目标 timeout 仍然适用。

## 完整创建与响应

源码推导、未执行。先建 amqp 资源 `mq`、broker 队列 `demo.incoming` 与
脚本 `ingest`:

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

名称在**路径**里,不是必填 body。创建/更新返回 row(列表/详情另含
recent_fires):

```json
{"id":"00000000-0000-4000-8000-000000000001","project_id":"00000000-0000-4000-8000-000000000002","name":"incoming","enabled":false,"resource":"mq","queue":"demo.incoming","max_concurrent_runs":1,"ack_deadline_override":false,"target_kind":"script","target_name":"ingest","inputs":{},"created_at":"2026-11-06T00:00:00Z","updated_at":"2026-11-06T00:00:00Z"}
```

| 字段 | 默认/限制 |
| --- | --- |
| `resource` | 必填;项目 amqp 资源名,可带 folder;凭据留在平台侧。 |
| `queue` | 非空白、≤255 字节、无控制字符;**被动消费**,声明由 broker 管。 |
| `max_concurrent_runs` | 默认 1;整数 1–16;同时是 broker 的 prefetch。 |
| `ack_deadline_override` | 默认 false;绕过保存时的 timeout 安全检查,**不会修改 broker**。 |
| `target` | 已存在的 `{kind:script\|workflow,name:"folder/name"}`。 |
| `inputs` | 默认 null;运行时合并的对象常量。建议 `{}`——保留的 message/message_meta 同名常量会被覆盖。 |
| `enabled` | API/仓库及整体 PUT 默认 **true**,但**控制台新建默认暂停(false)**;API 分阶段创建须显式 false。 |
| `expected_updated_at` | 可选/null 为无条件更新;PUT 应原样使用返回的 timestamp(含小数秒);不一致返回 409 且**不应用任何字段**;创建不需要。 |

`PUT …/queue-triggers/<name>` 是整体替换:省略可选项恢复默认,必填不能
null。紧急暂停用 `POST …/<name>/enabled {"enabled":false}`,避免过时的
完整表单覆盖。控制台保存带 expected_updated_at;冲突时应重新打开当前数据
有意合并,不能盲删前置条件。修改约十秒对账生效;执行配置变化会重启消费者,
已运行的投递保留其启动时的配置。

## ack deadline 与实际投递

保存时会拒绝:资源缺失/类型错、目标缺失、队列/并发非法,以及部署
`VIAT_MAX_ASYNC_TIMEOUT_SECS`(默认 1800)> `VIAT_QUEUE_ACK_DEADLINE_SECS`
(默认 1500)——除非 override true。

> [!WARNING]
> 全默认的部署可能因此**无法保存**新触发器。按 broker 真实的
> consumer_timeout 提高 deadline 或降低运行时上限,验证 broker 后再明确
> override。长任务仍在运行时消息可能重投——**override 不防重复**。

脚本参数:`message`(JSON 解析;非 JSON 为 `{"raw_body_b64":"…"}`)、
`message_meta`(`message_id,routing_key,redelivered`)以及常量。
**没有去重账本**:投递语义是至少一次,即使有 message_id 也必须业务幂等。

| 运行结果 | broker 动作 |
| --- | --- |
| 成功 | ack。 |
| 脚本拒绝/客户端错误分类 | nack、requeue=false;配置了 DLX 则死信,否则可能丢弃。 |
| timeout、overload、传输/内部/服务端失败 | nack、requeue=true;由 broker 投递策略限制 poison loop——Viat 没有通用重试次数/退避。 |
| 项目缺失、目标删除/无法解析 | **ack 并记录配置错误**(避免无限 requeue);修复配置不会复活已确认的消息。 |

副作用成功后 ack 失败/断线仍可能重投;fire 历史是观测,不是 broker 状态的
真相。不能声称"没有 DLQ 就一定保留拒绝消息";显式 HTTP 风格 response 不
代替 runner 的错误分类——正确使用拒绝/错误 API。

## 顺序、背压、运维和清理

- 并发 semaphore 与 `basic_qos` prefetch 共用上限:为 1 时单消费者逐条
  处理;跨多 Viat 实例/其他消费者要全局顺序,应在 broker 配
  **`x-single-active-consumer:true`**——仅"并发 1"不是跨消费者全序。
  >1 时完成可能乱序;requeue/重连即使串行也可改变到达顺序,由 broker 仲裁,
  不是 Viat 的 claim 账本。
- 观测:`GET /projects/<slug>/queue-triggers`、`GET …/<name>`、
  `GET …/<name>/fires`。fire 含
  `id,trigger_id,execution_id,message_id,routing_key,redelivered,outcome,detail,fired_at`,
  outcome 为 ack/dlq/requeue。应与 broker 的 ready/unacked、死信路由、
  运行时日志**合看**。连接错误自动退避重连;缺权限/队列要去修 broker,
  不是反复新建触发器。
- 工具面:没有独立的队列触发器 CLI;仓库支持 `queue_triggers/<name>.yaml`
  与 `viat pull/push --only queue_triggers`。镜像是删除语义(本地缺失即删
  远端),先 diff。
- 验证与清理:仅在授权的隔离队列/DLQ 上验证成功/拒绝/timeout/重投;先
  pause,处理在途/unacked,再 `DELETE` 触发器——**不会**删除/清空 broker
  队列、重投已 ack 消息或撤销写入。人工 DLQ 重放需单独授权并做业务去重;
  取消/暂停不是事务回滚。

## 核验依据

契约源码 `03751a67`:`crates/viat-api/src/handlers/queue_triggers.rs`、`queue_trigger.rs`;`crates/viat-core/src/types/queue_trigger.rs`;`crates/viat-cli/src/repo/queue_triggers.rs`;控制台队列编辑器/测试。示例源码推导、未执行,无 broker/网络调用。
