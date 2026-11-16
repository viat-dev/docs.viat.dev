---
title: 运行检查、队列与取消
description: 追踪请求、执行和异步任务，解释进度、安全取消并处理重启中断。
doc_id: operations.runs
verified_release: '1.1.0'
channel: stable
---

# 运行检查、队列与取消

本流程处理端点变慢、队列积压与后台任务中断。**所有命令均为未执行模板**;
提交或取消前先选好隔离夹具。读取需要平台会话/PAT 与项目成员资格;生产
取消要求项目 **Owner/Admin/Developer**,Operator 只能观察。终端用户的端点
凭据、单任务能力令牌、管理凭据是三种不同的东西。

## 先定位,再修改

1. 记录:项目 slug、UTC 时间窗、方法/端点路径、发布版本、`request_id`、
   异步 `run_id`、调用方与执行预算——隐藏凭据。
2. 记住两类失败都可能留下执行摘要:**进入运行时之前**被拒(路由/方法/
   认证/大小限制)与**进入 worker 之后**失败。草稿测试成功不能证明已发布
   快照正确。
3. 定位:控制台项目"运行/日志"页按时间、状态与目标筛选,检查错误、耗时
   与工作流步骤;CLI 替代见[CLI 日志](../cli/logs.md)。
4. 工作流步骤用 `(index, step_id, iteration, attempt)` 识别;嵌套工作流的
   index 会**从零重新计数**——不能只看 index,要看带点调用路径的
   `step_id`。

## 管理 API

`BASE` 是含挂载前缀的部署 URL,`PROJECT` 是 slug,`TOKEN` 是安全提供且有
权限的管理令牌(**不是**端点 API key)。避免 verbose curl 或把令牌写进
历史。

```sh
curl --fail-with-body --get "$BASE/projects/$PROJECT/async-runs" \
  -H "Authorization: Bearer $TOKEN" --data-urlencode 'limit=50'
curl --fail-with-body "$BASE/projects/$PROJECT/async-runs/$RUN_ID" \
  -H "Authorization: Bearer $TOKEN"
```

- 列表返回 `{runs,counts}`(counts 为各状态数量);limit 默认 50、范围
  1..200;可选过滤 `status`、`before`(已展示的最旧 created_at)与
  `request_id`(单请求查询,忽略其他过滤)。用任务时间戳,**不编造
  offset**。
- 管理详情按项目成员授权,可能含内部错误/输出——不要直接转发给端点
  终端用户。

| 状态 | 含义 | 操作 |
| --- | --- | --- |
| `queued` | 已持久接收;可能在等 `not_before`、并发键名额、本地在途容量或执行通道 | 先查计划时间、key、`max_concurrent`、位置与节点容量,别急着调大限制 |
| `pending` | 已接收后台运行,目标尚未执行 | 查环境、准入与开始时间;与持久 queued 不同 |
| `running` | 已认领执行——不保证正在产生有效进度 | 检查 `started_at`、进度时间、worker/环境与外部依赖 |
| `succeeded` | 目标成功结束;结果只保留有限时间 | 检查 HTTP 状态、输出与副作用;业务语义仍需自行判断 |
| `failed` | 运行时/系统/超时/中断失败 | 保留关联 ID 与错误;重放前确认外部副作用 |
| `cancelled` | 已记录取消 | 确认终态与已提交的外部工作——**取消不等于回滚** |

`progress_percent`/`progress_message`/`progress_at` 是**脚本自己报告的**
进度,不是平台预测的 ETA:很久没更新的 40% 与刚更新的 40% 是两回事;
没有进度也不证明 worker 已死。

## 异步端点调用协议

- 请求带 `X-Viat-Async: true`(或端点发布 always-async 策略)时可能返回
  **202** + 任务 ID 与查询能力——用返回的 URL/凭据,不要假设管理令牌可
  替代。
- 查询接受 `X-Viat-Run-Token` 头或 `token` 查询参数——**建议用头**,避免
  URL 进日志/历史。缺失/错误令牌或未知任务都**有意返回 404**,而不是可被
  枚举的 401。
- 查询含状态、时间与进度;排队任务可含队列位置/并发信息。成功含
  `http_status` 与 `output`;失败/取消含面向调用方过滤过的错误类型/消息,
  不是完整控制台 traceback。超过保留期后,曾有效的能力令牌也可能 404。
- 延迟:`X-Viat-Delay` 为非负整秒(0 = 不延迟);`X-Viat-Run-At` 接受未来
  RFC3339 时间或 `X-Viat-Tz`(IANA,默认 UTC)里的下一次 `HH:MM[:SS]`。
  两头互斥,最远 **30 天**。接收入队**不承诺**在任意负载下准点执行。

## 明确批准后再取消

以下命令**修改执行状态并可能终止 worker**——获得授权与事件负责人批准后
才执行:

```sh
curl --fail-with-body -X POST \
  "$BASE/projects/$PROJECT/async-runs/$RUN_ID/cancel" \
  -H "Authorization: Bearer $TOKEN"
```

必须读取 `{cancelled,status,reason,detail}`,不能只看 HTTP 200:

- `cancelled:true`:排队行已取消,或信号已到达活跃执行——继续查询到终态;
  **它不是事务回滚**。
- `reason:not_cancellable`:执行路径不读取消信号(如共享热脚本或无 worker
  的操作);工作流在步骤间检查,但外部调用未必立即中止。
- `reason:already_finished`:已经结束,无需取消。
- `reason:owner_unreachable`:另一节点持有该任务但未及时确认——**不能
  证明取消或执行成败**。

## 重启、重试与清理

- 优雅停机:停止认领新任务,在 `VIAT_SHUTDOWN_GRACE_SECS`(默认 10 秒)内
  排空;未开始的持久队列行可跨重启保留。运行脚本**不保存检查点**;失活
  实例的清理最终会使孤儿运行失败。数据库故障/心跳延迟下没有 exactly-once。
- 重试前:检查下游事务、已发消息/文件与幂等记录——**代理 504 后目标仍
  可能成功**。只在有意重试同一请求且符合端点幂等语义时复用
  `Idempotency-Key`;不能为外部服务发明 exactly-once。队列消费至少一次。
- 事件收尾:保留最少必要的脱敏证据;只清理隔离项目的夹具;撤销临时调参;
  验证队列深度/年龄恢复趋势。参见[容量](capacity.md)、[日志](logs.md)、
  [保留](retention.md)、[故障排查](troubleshooting.md)。
