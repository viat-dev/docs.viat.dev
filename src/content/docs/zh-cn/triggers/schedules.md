---
title: "定时任务：cron、interval 与 once"
description: "完整定时字段、时区、重叠、重试和重放语义。"
doc_id: triggers.schedules
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# 定时任务：cron、interval 与 once

Schedule 是实时配置，不是端点快照。直接 script/workflow 目标在触发时解析**草稿**；endpoint 目标跟随当前发布快照，二者不是同等部署保证。管理 API 当前要求认证后的**项目成员**，写入和手动触发也如此，不要套用队列/WS 订阅的 editor-only 限制。端点目标以 scheduler system principal 执行，需 scheduler 角色的对应授权，而非控制台操作者权限；保存时必须已发布，后续仍可因目标/权限变化而失败。

## 创建与整体更新

源码推导、未执行示例，脚本 `reports/nightly` 已存在：

```http
POST /projects/demo/schedules
Authorization: Bearer <console-token>
Content-Type: application/json

{"name":"nightly","trigger":{"kind":"cron","cron":"0 2 * * *","timezone":"Asia/Shanghai"},"target":{"kind":"script","name":"reports/nightly"},"inputs":{},"enabled":false,"on_overlap":"skip","max_attempts":1,"retry_backoff_secs":60,"catch_up":true}
```

201 响应示例，id/时间均为虚构：

```json
{"id":"00000000-0000-4000-8000-000000000001","project_id":"00000000-0000-4000-8000-000000000002","name":"nightly","enabled":false,"trigger":{"kind":"cron","cron":"0 2 * * *","timezone":"Asia/Shanghai"},"target":{"kind":"script","name":"reports/nightly"},"inputs":{},"next_due_at":"2026-11-06T18:00:00Z","last_fired_at":null,"last_run_id":null,"on_overlap":"skip","queue_cap":null,"max_attempts":1,"retry_backoff_secs":60,"catch_up":true,"retry_attempt":0,"created_at":"2026-11-06T00:00:00Z","updated_at":"2026-11-06T00:00:00Z"}
```

| 字段 | 默认/验证 |
| --- | --- |
| `name` | 必填，1–63 位小写 ASCII 字母/数字/`_`/`-`，首位为字母；PUT body 必须与路径一致。 |
| `trigger` | 必填带 kind 对象，支持下述 cron/interval/once。 |
| `target` | `{kind:script|workflow,name:"folder/name"}`，或 `{kind:endpoint,method:"POST",path:"/reports"}`；端点方法 GET/POST/PUT/PATCH/DELETE，路径以 `/` 开始，无 query/fragment。 |
| `inputs` | 必须 JSON 对象。虽然反序列化缺省值为 null，验证会拒绝，所以要显式发送 `{}`。 |
| `enabled` | API/仓库默认 **true**；控制台新 schedule 也初始化 true。安全分阶段创建请显式 false；队列控制台默认不同。 |
| `on_overlap` | 省略/null 为 skip；另支持 queue、parallel。 |
| `queue_cap` | 省略/null 没有配置上限；仅 queue 模式可用正整数。 |
| `max_attempts` | 省略/null 为 1；范围 1–10，包括首次自动尝试。 |
| `retry_backoff_secs` | 省略/null 为 60，固定间隔，范围 1–86400 秒。 |
| `catch_up` | 省略/null 为 true；false 将足够迟到的触发记为 skipped，而非补执行。 |

`PUT /projects/<slug>/schedules/<name>` 是**整体替换**，不是 PATCH。必填 name/trigger/target/inputs 均须发送；省略可选项恢复默认。仅改 enabled 请用 pause/resume，改别的字段也要保留策略。null 仅适用于 Option 字段，不适用于普通布尔/对象。更新会重算 due。响应总回显具体 cron timezone；`retry_attempt > 0` 表示 next_due 是重试时间。

### 时间模式

- `{"kind":"cron","cron":"0 2 * * *","timezone":"Europe/London"}`：标准五段分/时/日/月/星期，解析器前置秒 0，也支持其 year 扩展。IANA 时区在**写入时**默认取 `VIAT_DEFAULT_SCHEDULE_TZ`（默认 UTC）并固化到行，部署默认变化不会重解释旧任务；错误时区/表达式返回 400。
- `{"kind":"interval","every_secs":60}`：10–86400 秒，绝对间隔，不是时区墙上时钟；首次为 now + interval，停机不会形成逐次持久事件档案。
- `{"kind":"once","at":"2027-01-01T00:00:00Z"}`：RFC3339，最多未来十年；接受过去时间，下一 tick 即到期。claim 一次后自动禁用；失败重试策略可重新武装该次任务。重复 PUT **已执行的同一 instant** 即使 enabled true 也不重新启用，新的 instant 才是新任务。显式 resume 则有意重新武装旧 instant，过去时间会立即触发。

DST：秋季重复墙上时刻只执行**第一次**；春季不存在的时刻移到缺口后的第一个有效时刻；多个匹配折叠到同一缺口结束 instant 时仅执行一次。预览入口 `POST /projects/<slug>/cron/preview {"cron":"30 1 * * *","timezone":"Europe/London","count":5}`，count 默认 5、夹到 1–20；返回 `{"upcoming":["<UTC-instant>"],"timezone":"Europe/London"}`。合法但未来无匹配可返回空数组。

## 触发、重叠、重试和重放

`GET …/schedules` 列表，`GET …/<name>` 详情；`POST …/<name>/pause`、`/resume` 返回更新后的 schedule。暂停阻止新的自动工作，不回滚在途副作用；cron/interval 恢复从 now 重算，不逐次补跑暂停历史。catch-up 用于停机迟到，不是所有 tick 的重放档案。skip 拒绝重叠，queue 保存待运行项到可选 cap，parallel 允许并发。集群 claim/lease 协调实例，不保证外部副作用 exactly-once。自动失败可按固定延迟重试；手动触发/重放是显式动作，不保证执行完整的自动重试序列；成功手动动作可清除预约重试。业务必须幂等。

`POST …/<name>/trigger` 返回 `{"request_id":"<uuid>"}`；409 表示已在运行/队列忙/满，403 表示 scheduler 授权不足。`GET …/<name>/runs?limit=50&before=<timestamp>` 的 limit 夹到 1–200；行含 `id,schedule_id,request_id,target,inputs,status,attempt,started_at,finished_at,error_message`，status 为 running/succeeded/failed/skipped。`GET …/runs/<run_id>` 查单次，`POST …/runs/<run_id>/rerun` 使用**历史 inputs 与当前 target**，不是历史源码，返回新 request id，也不是快照回滚。

timeout 按每次执行预算施加，排队不等于无限资源调用。没有专用 schedule cancel 路由；pause 只挡未来触发，若另外有可取消 async-run 句柄应走该 API，不能声称 pause 已杀死脚本。重放超时变更前先检查运行与执行日志。

## CLI、仓库、验证和清理

支持 `viat schedule create nightly --cron '0 2 * * *' --script reports/nightly --inputs '{}' --disabled`，以及 list/show/update/delete/pause/resume/trigger。独立 create/update CLI 只支持 cron/interval、script/workflow，不应猜造 once/timezone/endpoint/retry flags；完整面用 API 或 `schedules/nightly.yaml`。仓库文件携带 trigger/target/inputs/enabled/overlap/retry/catch-up，`viat pull/push` 镜像同步；本地缺失可删除远端 schedule，先对完整 checkout 做 diff。窄 CLI 的整体更新可能重置未发送的策略。

先隔离验证 disabled 创建、cron 预览、scheduler 权限和一次手动运行的日志，再启用。停止时 pause，处理当前运行/排队工作，再 `DELETE …/<name>`（204）；删除不撤销写入/消息。没有原生 HomeAssistant、MQTT、Slurm 定时连接器，需要显式脚本/资源/适配器，不能虚构目标种类。

依据：`crates/viat-api/src/handlers/schedules.rs`、`scheduler.rs`、`schedule_target.rs`、`scheduler_cluster.rs`；`crates/viat-db/src/schedules.rs`、`schedules_due.rs`（DST 测试）；`crates/viat-cli/src/repo/schedules.rs`、`commands/schedule.rs`；控制台 `pages/schedules/ScheduleDrawer.tsx`。示例未执行。
