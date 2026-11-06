---
title: '脚本异步任务'
description: '不阻塞调用者地提交、查询和取消项目工作。'
doc_id: script.async-tasks
verified_release: '1.1.0'
channel: stable
---

# 脚本异步任务

`ctx.tasks` 仅适用于 Python/TypeScript。它创建普通项目运行队列任务，不是新的工作流步骤、周期调度或外部作业适配器。需要父执行和目标的项目权限。示例只有在你明确连接实例执行后才会创建真实任务。

## 输入与输出

Python 签名：`ctx.tasks.enqueue(script=None, workflow=None, endpoint=None, args=None, delay=None, run_at=None, immediate=False)`。TypeScript：`await ctx.tasks.enqueue({script?, workflow?, endpoint?, args?, delay?, run_at?, immediate?})`。

| 字段 | 契约 |
| --- | --- |
| 目标 | `script`、`workflow`、`endpoint` 恰选一个。脚本/工作流使用资产路径；端点为含方法与路径的 `"POST /path"`。Proxy/CRUD 不能作为任务目标。 |
| `args` | JSON 对象，默认 `{}`，序列化最多 1 MiB。大数据传 ID 或 storage key。 |
| `delay` | 秒；Python 也接受 `timedelta`。与 `run_at` 互斥。 |
| `run_at` | RFC 3339 时间戳；Python 接受带时区的 `datetime`，TypeScript 接受 `Date`。最多延后 30 天；两者都不填表示尽快准入。 |
| `immediate` | 布尔值，默认 false。False 延后到父执行成功结束才持久化；true 在本次调用立即写入。 |

句柄为 `{run_id, status:"queued", scheduled_for?, deferred, target_kind, target_ref}`。`get(run_id)` 返回本项目执行或 null/None，包括 status、output、error_kind/error_message、http_status、progress、时间戳和 parent_request_id。延后句柄可能还没有数据行。`cancel(run_id)` 返回 `{cancelled,status,reason?,detail?}`：可撤销未写入任务，移除队列行，或对可取消的运行发送信号。原因包括 `already_finished`、`not_cancellable`、`owner_unreachable`。

## 最小安全生产者

创建目标资产 `task_target`：

```python
def main(value: int):
    return {"value": value}
```

创建生产者 `task_producer`：

```python
from viat import ctx

def main(value: int):
    return ctx.tasks.enqueue(script="task_target", args={"value": value}, delay=60)
```

TypeScript 生产者：

```typescript
import { ctx } from "viat";
export async function main(args: { value: number }) {
  return await ctx.tasks.enqueue({ script: "task_target", args, delay: 60 });
}
```

输入 `{"value":7}` 返回排队句柄，不是目标结果。生产者成功结束且延迟到达后，目标结果为 `{"value":7}`。用 `get` 观察，不要在连接中的请求里忙轮询。离线 `viat script test` 只记录提交；控制台 Test 和草稿运行会**真实提交**。

## 身份、发布与事务边界

直接脚本/工作流目标读取实时内容，在 enqueue 时冻结；端点目标使用其发布快照。任务带父执行认证身份，不携带原始凭证，因此 `caller_token` 无凭证可转发。端点授权 gate 在 enqueue 时检查，拒绝会立即返回 `403 forbidden`，而不是数小时后才失败。

默认只在整个父执行无错误结束后提交。异常、超时、`ViatError`、显式 4xx/5xx 响应都会丢弃延后任务。工作流步骤创建的任务要等**整个工作流**成功。这不是与业务数据库的分布式事务：先前数据库写入可能已保留，而后续错误导致任务被丢弃。`immediate=True` 绕过延后，父执行之后失败也不会撤销。流式响应按状态行决定成功；生成器在之后失败时任务可能早已提交。

目标队列声明控制准入；任务链深度由部署限制，通常为 100，超限 `429 task_depth_exceeded`。不支持周期形式，重复工作使用调度。取消不是撤销副作用：已产生效果时需检查最终状态并业务补偿。队列行跨重启保留，已启动执行不会从检查点恢复。[运行时](runtime.md)说明取消限制，[测试](testing.md)说明离线记录器。
