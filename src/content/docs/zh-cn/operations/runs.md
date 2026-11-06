---
title: 运行检查、队列与取消
description: 追踪请求、执行和异步任务，解释进度、安全取消并处理重启中断。
doc_id: operations.runs
verified_release: '1.1.0'
channel: stable
---

# 运行检查、队列与取消

本流程适用于端点变慢、队列积压和后台任务中断。**所有命令均为未执行模板**；提交或取消前先选择隔离夹具。读取需要平台会话/PAT 与项目成员资格。生产取消要求项目 **Owner/Admin/Developer**，Operator 只能观察。终端用户端点凭据、单任务能力令牌与管理凭据不是一回事。

## 先定位，再修改

记录项目 slug、UTC 时间窗口、方法/端点路径、发布版本、`request_id`、异步 `run_id`、调用方与执行预算，并隐藏凭据。请求可能在进入运行时前因路由、方法、认证或大小限制被拒绝，也可能进入 worker 后失败；两类都可产生执行摘要。草稿测试成功不能证明已发布快照正确。

在控制台项目运行/日志页按时间、状态和目标筛选，检查错误、耗时和工作流步骤。CLI 替代见 [CLI 日志](../cli/logs.md)。工作流步骤用 `(index, step_id, iteration, attempt)` 识别；嵌套工作流可把 index 从零重新计数，不能只看 index，应看带点调用路径的 `step_id`。

## 管理 API

`BASE` 为含挂载前缀的部署 URL，`PROJECT` 为项目 slug。`TOKEN` 是已安全提供且具有权限的管理令牌，不是端点 API key。避免 verbose curl 或把令牌写入历史。

```sh
curl --fail-with-body --get "$BASE/projects/$PROJECT/async-runs" \
  -H "Authorization: Bearer $TOKEN" --data-urlencode 'limit=50'
curl --fail-with-body "$BASE/projects/$PROJECT/async-runs/$RUN_ID" \
  -H "Authorization: Bearer $TOKEN"
```

列表返回 `{runs,counts}`，counts 为各状态数量。limit 默认 50、范围 1..200。可选过滤 status、before（已展示的最旧 created_at 时间）和 request_id（按单请求查询，忽略其他过滤）。使用任务时间戳，不编造 offset。管理详情按项目成员授权，可能含内部错误/输出，不要直接转发给端点终端用户。

| 状态 | 含义 | 操作 |
| --- | --- | --- |
| `queued` | 已持久接收；可能等待 `not_before`、并发键名额、本地在途容量或执行通道。 | 先查计划时间、key、`max_concurrent`、位置和节点容量，不急于调大限制。 |
| `pending` | 已接收后台运行，尚未执行目标。 | 查环境、准入和开始时间；与持久 queued 不同。 |
| `running` | 已认领执行，不保证正在产生有效进度。 | 检查 `started_at`、进度时间、worker/环境和外部依赖。 |
| `succeeded` | 目标成功结束，结果只保留有限时间。 | 检查 HTTP 状态、输出和副作用；应用自定义语义仍需自行判断。 |
| `failed` | 运行时、系统、超时或中断失败。 | 保留关联 ID 和错误，重放前确认外部副作用。 |
| `cancelled` | 已记录取消。 | 确认终态和外部已提交工作；取消不等于回滚。 |

`progress_percent`、`progress_message`、`progress_at` 是脚本报告的进度，不是平台预测的 ETA。很久未更新的 40% 与刚更新的 40% 不同；没有进度本身不证明 worker 已死。

## 异步端点调用协议

请求带 `X-Viat-Async: true`，或端点发布了 always-async 策略时，可返回 **202** 与任务 ID、查询能力。使用返回 URL/凭据，不要假设管理令牌可替代。查询接受 `X-Viat-Run-Token` 或 `token` 查询参数；建议使用头，避免 URL 进入日志/历史。缺失/错误令牌或未知任务均有意返回 **404**，而不是可被枚举的 401。

查询含状态、时间和进度；排队任务可含队列位置/并发信息。成功含 `http_status` 与 `output`，失败/取消含已面向调用方过滤的错误类型/消息，不是完整控制台 traceback。超过保留期限后，曾有效的能力令牌也可能返回 404。

`X-Viat-Delay` 为非负整秒，0 不延迟；`X-Viat-Run-At` 接受未来 RFC3339 时间或 `X-Viat-Tz`（IANA，默认 UTC）中的下一次 `HH:MM[:SS]`。两种头互斥，最远 **30 天**。接收入队不承诺在任意负载下准点执行。

## 明确批准后再取消

以下命令**修改执行状态并可能终止 worker**，只有获得授权和事件负责人批准后才执行：

```sh
curl --fail-with-body -X POST \
  "$BASE/projects/$PROJECT/async-runs/$RUN_ID/cancel" \
  -H "Authorization: Bearer $TOKEN"
```

必须读取 `{cancelled,status,reason,detail}`，不能只看 HTTP 200：

- `cancelled:true`：已取消排队行，或信号已到达活跃执行。继续查询到终态；它不是事务回滚。
- `reason:not_cancellable`：执行路径不读取消信号，例如共享热脚本或无 worker 的操作。工作流在步骤间检查，但外部调用未必立即中止。
- `reason:already_finished`：已经结束，无需取消。
- `reason:owner_unreachable`：另一个节点拥有该任务但未及时确认，**不能证明取消或执行成功/失败**。

## 重启、重试与清理

优雅停机停止认领新任务，并在 `VIAT_SHUTDOWN_GRACE_SECS` 内排空（默认 10 秒）。未开始的持久队列行可跨重启保留。运行脚本不保存检查点；失活实例清理最终会使孤儿运行失败。数据库故障/心跳延迟下不能承诺 exactly-once。

重试前检查下游事务、已发消息/文件和幂等记录。代理 504 后目标仍可能成功。仅在有意重试同一请求且符合端点支持的幂等语义时复用 `Idempotency-Key`；不能为外部服务发明 exactly-once 保证。队列消费为至少一次。

事件结束后留最少必要脱敏证据，仅清理隔离项目的夹具，撤销临时调参，并验证队列深度/年龄恢复趋势。参见[容量](capacity.md)、[日志](logs.md)、[保留](retention.md)、[故障排查](troubleshooting.md)。
