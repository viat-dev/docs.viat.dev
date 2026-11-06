---
title: '应用：SQL 报表与显式启用的通知'
description: '聚合有界 UTC 销售窗口，持久保存不可变文本报表，并通过可选 SMTP 与持久发送状态恢复通知。'
doc_id: applications.reports
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# SQL 报表与显式启用的通知

本例执行真实 SQL 聚合，生成并保存确定性纯文本报表，**仅在明确请求时**提交到 SMTP。HTTP、工作流及默认禁用调度都使用 `send:false`。验证使用假 mail，不发送邮件。SMTP 接受不是收件人收到，工作流也不能原子提交数据库与邮件。

使用服务端 **1.1.0**、CLI **1.1.0**。从本手册仓库复制完整 `examples/reports/` 到私有目录，从其 `project/` 部署。双语 README 指向同一组源文件。在线配置/部署/清理命令仍为**未执行的操作说明**，不是在线验收证据；协调者已完成的离线单元验证见下文。

## 文件、权限和前置条件

| 相对示例目录的路径 | 用途 |
| --- | --- |
| `project/viat.yaml` | 新隔离项目 `example-reports` 的身份 |
| `project/resources/report_db.yaml` | 服务端专属可写 SQLite |
| `project/resources/report_mail.yaml` | 捕获中继配置，仅显式启用发送时使用 |
| `project/scripts/setup.py` | 完整 schema、时间索引与四笔合成销售 |
| `project/scripts/build_report.py` | SQL count/aggregate、限制、格式化、不可变持久化 |
| `project/scripts/notify_report.py` | 显式 send、持久 claim、SMTP 与未知结果处理 |
| `project/workflows/daily_report.yaml` | build → notify 与明确输出 |
| `project/endpoints/default/report.post.yaml` | 认证严格输入的 `POST /report` |
| `project/schedules/report-daily.yaml` | 禁用的 UTC 00:05 调度，发送关闭 |
| `fixtures/{input,expected}.json`、`validate.py`、`case.json` | 固定窗口、完整预期和单元 runner |

需要已激活的非生产实例、可信工作站的 Bash/`curl`/Python 3/CLI、服务端 `uv`/Python，以及操作员批准的单节点 SQLite 挂载。验证器只用标准库，不安装同名 `viat` 包。创建者是新项目 Owner；Owner/Admin 发布/改项目设置，Owner/Admin/Developer 编辑资产。调度采用 scheduler 身份，不是前一 HTTP 调用者。

`case_machine` 与非管理员项目用户 `case_worker`（`public`）仅在这个**全新项目**中算本例拥有。任何获准机器均可生成该专属数据集报表，并明确请求向脚本固定收件人发送。没有租户/逐客户授权，raw SQL 不会自动做行权限过滤，不能连接共享敏感表。平台 session/PAT 是管理凭据，不是端点 API key。

## 1. 不发送邮件的本地单元验证

在复制的示例目录：

```sh
python3 -I validate.py
```

预期末行为 `reports: unit-only validation passed; fake relay assertions only, no email sent`。

验证器加载**实际可部署** setup、builder、notifier，用其 SQL 操作临时标准库 SQLite，并提供假 Viat/mail 对象。断言精确聚合、窗口边界、默认不发送、非法窗口/类型、行数/文本限制、迟到数据下的不可变重放、去重、并发 claim、SMTP 未知结果及假接受后 DB 确认失败。不执行 YAML、真实 RPC、HTTP 认证、cron、资源 Test 或 SMTP。这是**单元级验证**；协调者已在阻断网络与子进程调用的离线 harness 中成功运行此验证器。单元检查与真实服务验收的区别见[验证状态](../reference/validation.md)。

## 2. 数据库隔离与不活跃的邮件配置

操作员配置 `VIAT_SQLITE_ROOTS`，将新可写目录挂载到**唯一执行节点**，选择一个全新文件。将资源中的 `/approved-example-root/reports.sqlite` 改为批准路径。禁止平台 DB、已有/生产文件、网络文件系统、多节点同路径不同文件。用服务账号及 `sqlite3` 创建空文件：

```sh
EXAMPLE_DB=/approved-example-root/reports.sqlite
test ! -e "$EXAMPLE_DB" && sqlite3 "$EXAMPLE_DB" 'PRAGMA user_version=1;'
```

文件已存在就停止并换路径，不截断/复用。`create_if_missing:false` 刻意捕获挂载缺失。参见 [SQLite](../assets/resources/sqlite.md)。

完整 schema 在 `setup.py` 的 `SCHEMA`：带时间索引的 `sales(order_id PRIMARY KEY,occurred_at,currency,amount_cents)`，`report_runs(report_id PRIMARY KEY,start_date,end_date,report_text,rows_json)`，以及 `report_deliveries(report_id PRIMARY KEY/FK,state,attempt_id,accepted)`。币种限 `CNY|USD`，每笔金额为 0–1000000000 整数分。源写者必须将时间规范为**固定宽度 `YYYY-MM-DDTHH:MM:SSZ` UTC 文本**；混用时区偏移/精度或本地时间不适用词典序比较。本例只有合成 setup 写源数据。

默认验证**不启动中继、不执行资源 Test**。SMTP 配置为匿名 `127.0.0.1:2525`、`tls:none`、固定发件人 `sender@example.test`；notifier 固定收件人 `reports@example.test`。loopback 指 API 服务/容器自身网络命名空间，不是工作站。保存/解析资源不能证明连接可用。即使收件地址以 `.test` 结尾，只要真实中继接受就发生真实 SMTP 提交，域名不会自动变成 dry-run。

## 3. 创建、配置与应用

从复制的 `project/` 开始；把 loopback 示例替换为获授权的非生产实例：

```bash
umask 077
export VIAT_SERVER=http://127.0.0.1:8080
viat --version
read -r -p 'Platform email: ' VIAT_EMAIL
read -r -s -p 'Platform password: ' VIAT_PASSWORD; printf '\n'
viat auth login --server "$VIAT_SERVER" --email "$VIAT_EMAIL" --password "$VIAT_PASSWORD"
unset VIAT_PASSWORD
viat version
viat project create example-reports 'SQL reports example'
viat project select example-reports
viat project member ls --json
viat authorizer create --name case_machine --kind api_key
viat p-user create --identity case_worker --role public
viat apikey create case_machine --user case_worker --name fixture-client
viat push --only resources,scripts,workflows,schedules,endpoints
viat script run setup --args '{"confirm":"reports-isolated-db"}'
viat schedule show report-daily --json
viat endpoint list --json
```

逐步检查，失败即停，确认双方版本和 Owner 身份。slug 已存在就选新值，同步改 `viat.yaml`、命令、URL，不接管已有项目。遵循 MFA；密码参数会短暂可被本机进程读取。保护 `.viat/`、一次性 API key secret 和**行 UUID**，不要提交；token 中短 `key_id` 不是撤销 UUID。

setup 应为 `{"ready":true,"source_rows":4}`；调度应为 `enabled:false`、`inputs.send:false`、timezone `UTC`、`catch_up:false`、`max_attempts:1`。setup 不重置已有报表/发送账本。

明确 `--only` 排除 `meta`，避免裁剪单独创建的 authorizer。selector 按整个类别而非文件；schedules/endpoints 可镜像删除范围内缺失对象，只能用于全新隔离项目，不能用于已有项目的部分 checkout。push 各阶段独立，不执行初始化、不发布。端点 target 用 **`ref: daily_report`**，调度 target 用 **`name: daily_report`**。

仅记录 `POST /report` 的实际 UUID：

```bash
read -r -p 'POST /report endpoint UUID: ' ENDPOINT_ID
viat endpoint show "$ENDPOINT_ID" --json
viat publish plan --json
viat endpoint publish "$ENDPOINT_ID"
```

核对 `daily_report`、`case_machine`、严格绑定。修复警告/构建失败，不绕过 gate；退出码 0 也要检查 build 输出。发布冻结步骤主源码；资源、直接/调度草稿仍实时生效。本例无 `uses:`；1.1.0 工作流步骤依赖若存在则仍实时解析。

## 4. 生成与断言，不连接 SMTP

仍在 `project/`：

```bash
read -r -s -p 'Project API key: ' CASE_API_KEY; printf '\n'
curl --silent --show-error --include \
  "$VIAT_SERVER/p/example-reports/report" \
  -H "Authorization: Bearer $CASE_API_KEY" -H 'Content-Type: application/json' \
  --data-binary @../fixtures/input.json
```

预期 HTTP 200，完整对象见 `fixtures/expected.json`：报表 ID 为 `daily-v1:2026-11-03:2026-11-04`，CNY 为 `orders:1,total_cents:800`，USD 为 `orders:2,total_cents:2000`，通知为 `{"state":"disabled","attempted":false}`。文本是 UTC 窗口标题和两个按币种排序的行。这是纯文本报表，不是邮件投递回执。

操作员可用服务端只读连接断言：

```sh
sqlite3 -readonly /approved-example-root/reports.sqlite \
  'SELECT report_id FROM report_runs; SELECT COUNT(*) FROM report_deliveries;'
```

新库应只有这个报表 ID，delivery 行数为 **0**。重复请求仍返回保存的相同内容，不建 claim、不发送。查看 `viat logs query --endpoint "$ENDPOINT_ID" --limit 10 --json`。也可 `viat workflow test daily_report --input '{"start_date":"2026-11-03","end_date":"2026-11-04","send":false}'`，但它真正执行草稿/读写报表，不是离线 dry-run。

## 窗口、限制与禁用调度

- 日期为标准 `YYYY-MM-DD`，两者均显式提供或均为空。SQL 范围是 **[起日 UTC 零点,结束日 UTC 零点)**，长度 1–31 天。非法/单侧空值返回 `400 invalid_window`。
- 两者为空时取**执行时前一 UTC 日**，不是过去 24 小时，也不是调度发生时刻。补跑历史必须用显式日期。非 UTC 报表需要刻意转换边界并定义 key，不能仅改 cron timezone；DST 本地日不一定 86400 秒。
- 未缓存生成最多 **10000 源行**、**65536 UTF-8 文本字节**。币种分开，不跨币求和、不做浮点换算。count、aggregate、持久化在一次短 SQLite 写事务内获得一致快照。每脚本超时 15 秒，工作流 45 秒，并受部署上限约束。
- 首次生成按 `REPORT_VERSION`（`daily-v1`）及日期冻结 rows/text。迟到数据不会悄悄改变已发送报表。获批准的纠正须明确采用新版本/key 策略，保留旧证据并生成独立身份的报表；不能靠清除发送记录暗改内容/收件人。
- 默认调度**禁用**，cron `5 0 * * *`，timezone `UTC`，`send:false`，skip、不 catch-up、一次尝试。00:05 执行选昨天，五分钟不保证源完整，冻结前需确认源水位。
- 显式启用**仅生成**：保留 `send:false`，把 YAML 的 `enabled` 改 true，在隔离项目 `viat push --only schedules`。用 `viat schedule pause report-daily` 暂停。skip 不隔绝 HTTP，数据库 key 才协调各入口。自动发送还需下面的独立授权与明确审核的 `send:true` 策略。

空窗口输出 `No sales`，仍仅在 opt-in 时发送。超时/断线不撤销已提交报表或已接受邮件。

## 5. 可选 SMTP 提交：独立明确授权

默认跳过本节。操作员必须明确批准捕获中继、服务端网络命名空间/出口和合成收件人。配置 `report_mail.yaml` 中实际可达 host/port/TLS/sender；随例 `tls:none` 仅适用于刻意信任的捕获网络。真实中继需遵循 TLS/auth 与发件权限。通过受保护资源 secret 配置凭据，再在仓库用 `$secret` 占位；不能写到 `plain` 或脚本。资源 Test 本身会连接/认证，也需 opt-in。

审核后在隔离项目 `viat push --only resources`。修改 `notify_report.py` 的固定收件人或格式，需要同时审核报表版本/去重策略，按范围推送脚本并重新发布端点。完成后才可明确请求：

```sh
curl --silent --show-error --include \
  "$VIAT_SERVER/p/example-reports/report" \
  -H "Authorization: Bearer $CASE_API_KEY" -H 'Content-Type: application/json' \
  --data '{"start_date":"2026-11-03","end_date":"2026-11-04","send":true}'
```

首次确认中继接受后 notification 为 `{"state":"accepted","attempted":true,"accepted":1}`；重复为 `{"state":"accepted","attempted":false}`，不重发。另行核对捕获中继证据。**接受不是入箱，也不排除之后退信。** 本例编写/验证没有发送消息。不暗示存在 chat 连接器；增加 chat 必须定义其供应商接受/去重/恢复策略。

## 发送去重与恢复

notifier 在 SMTP **之前**提交 `sending` claim，释放 DB 锁，提交邮件后标 `accepted`。任何已存在状态都阻止自动重发。发送异常/结果未知时尽量写 `uncertain` 并抛 `502 delivery_uncertain`；进程崩溃或 DB 确认失败可能停在 `sending`。两种状态都不会自动过期。

此方式避免并发自动重复，却可能阻塞尚未发出的邮件；SQL+SMTP **不是 exactly-once**。遇到卡住的 `sending`/`uncertain`：

1. 暂停调度、停止手工发送、等待所有在途 attempt 完成，必要时取消发布。记录精确项目、报表 ID、attempt ID 和中继证据。
2. 用批准的可写连接只访问**本例文件**，查看精确 claim/报表。若证据证明已接受，只按**该报表 ID 和观察到的 attempt ID** 条件更新 `accepted` 及已知接受数量，不重发。
3. 若证据证明没有提交，先将原证据保存到行之外，再明确批准重试，仅按该报表/观察到的 attempt、`state IN ('sending','uncertain')` 条件删除**这一行**，然后调用一次 `send:true`。不能清空表或触碰 accepted 行。
4. 无法确认则保持阻塞。人可作为明确业务决策授权可能重复，不能把它称作自动重试保证。

通过操作员支持参数的客户端绑定 ID，不提供面向生产的广泛 SQL reset。报表/claim 至少保留完整去重周期。删除 claim 会重新允许发送；删资源不能召回邮件。

## 错误与精确清理

脚本错误包括 `400 invalid_window`、`400 invalid_send`（必须真实 bool）、`400 invalid_report_id`、`404 report_missing`、`413 report_row_limit`、`413 report_size_limit`、`502 delivery_uncertain`。严格 HTTP 可能更早拒绝输入；工作流元数据不是类型校验。端点 key 失败与管理 `401/403` 不同。允许根/挂载、SQLite 锁/只读、SMTP transport/TLS/auth、资源配置应在对应层修复，不能改匿名或关闭 TLS 验证来绕过。已存在 `sending`/`uncertain` 且 `attempted:false` 表示**阻塞，不是已发送**。

停流/停调度并结清在途尝试后，仅清理本项目拥有的精确对象：

```sh
viat schedule pause report-daily
viat schedule delete report-daily
viat endpoint unpublish "$ENDPOINT_ID"
viat endpoint delete "$ENDPOINT_ID"
viat apikey revoke case_machine API_KEY_ROW_UUID
viat p-user delete case_worker
viat authorizer delete case_machine
viat workflow delete daily_report
viat script delete notify_report
viat script delete build_report
viat script delete setup
viat resource delete report_mail
viat resource delete report_db
unset CASE_API_KEY
```

使用创建 stderr 或 `viat apikey list case_machine` 的实际**行 UUID**，不是 token 的短 `key_id`。不级联删父分支、不全量 prune、不删共享表或共享中继邮件。经证据保留/依赖检查后，操作员仅移除精确的新 SQLite 文件及 sidecar。额外中继凭据撤销和私有本地会话清理分开进行。**1.1.0 不支持项目 DELETE**，保留空项目。

## 依据与未验证边界

参见 [SMTP](../assets/resources/smtp.md)、[SQLite](../assets/resources/sqlite.md)、[工作流](../assets/workflows/overview.md)、[上下文](../assets/scripts/context.md)、[HTTP](../triggers/http.md)、[调度](../triggers/schedules.md)、[repo-sync](../projects/repo-sync.md)。定点源码：`crates/viat-runtime/src/python.rs` 的 SQL transaction/execute/mail，`crates/viat-api/src/runner/broker.rs` 的 SQLite 事务和 repo-sync 序列化。实际中继连通/TLS/供应商接受、真实 broker 故障、cron 时机与发布 HTTP 需单独授权集成验证；单元测试不能证明邮件投递。
