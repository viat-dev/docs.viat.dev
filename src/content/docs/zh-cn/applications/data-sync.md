---
title: '应用：增量数据同步'
description: '包含只追加源适配器、确定性 upsert、原子 checkpoint、重启验证与禁用调度的可推送工作流。'
doc_id: applications.data-sync
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# 增量数据同步

本例将有序变更日志复制到物化目标表，支持更新和删除墓碑。**整页变更全部应用成功后**才推进持久 cursor。源与目标刻意使用同一专属 SQLite 资源中的惰性本地 SQL 适配器：这是可推送项目，不是假称的 ERP/Salesforce 连接器或跨数据库事务。

目标版本为服务端 **1.1.0**、CLI **1.1.0**。从手册仓库复制完整 `examples/data-sync/` 到私有目录；所有部署文件在 `project/`。双语 README、fixture 与验证器共用这些源文件。在线配置/部署/清理说明仍**未执行**；协调者已完成的离线单元验证见下文。

## 内容、权限和前置条件

| 相对示例目录的路径 | 用途 |
| --- | --- |
| `project/viat.yaml` | 新隔离项目 `example-data-sync` 的身份 |
| `project/resources/sync_db.yaml` | 专属服务端 SQLite |
| `project/scripts/setup.py` | 完整 schema 与四条合成变更 |
| `project/scripts/sync_batch.py` | 实际分页、版本化 upsert、checkpoint 事务 |
| `project/workflows/sync.yaml` | 一个明确脚本步骤，返回 `{page:…}` |
| `project/endpoints/default/sync.post.yaml` | 认证的 `POST /sync` 工作流端点 |
| `project/schedules/sync-hourly.yaml` | 禁用的每小时间隔调度，skip、不补跑、不自动重试 |
| `fixtures/{input,expected}.json`、`validate.py`、`case.json` | 输入、精确预期与单元 runner |

需要已激活的非生产服务、工作站 Bash/`curl`/Python 3/CLI、服务端 `uv`/Python 和操作员批准的单节点 SQLite 挂载。验证器只需标准库，不要安装同名 `viat` Python 包。新建项目的创建者为 Owner；Owner/Admin 发布，Owner/Admin/Developer 编辑。调度使用平台 scheduler 身份，不是最后一个 HTTP 调用者；本例仅使用专属 fixture 数据库，不依靠调用者租户属性。

管理凭据与端点凭据不同。`case_machine` authorizer 接纳非管理员项目用户 `case_worker`（`public` 角色）的 API key；任何获准机器都能推进此单一流。没有逐项/多租户授权，raw SQL 不会自动应用行权限，不能指向共享业务表。

## 1. 不启动服务的单元验证

在复制后的示例目录：

```sh
python3 -I validate.py
```

预期末行为 `data-sync: unit-only validation passed; no workflow/HTTP/source-provider calls`。

验证器加载**实际部署的 setup/sync 函数**，使用其 SQL 操作临时标准库 SQLite，注入假 Viat 上下文。断言非法批大小、目标写后/checkpoint 前失败、回滚、重启、两页顺序结果、墓碑、完成后的空页、旧版本重放与独立连接的并发调用。不解析/执行工作流 YAML，不运行真实 broker/调度，不发布，也不访问实际源/目标供应商。它是单元级验证；协调者已在阻断网络与子进程调用的离线 harness 中成功运行此验证器。单元检查与真实服务验收的区别见[验证状态](../reference/validation.md)。

## 2. 数据库隔离与 schema

操作员需配置 `VIAT_SQLITE_ROOTS`，创建服务账号可写的新目录，并挂载到**唯一执行节点**。将资源的 `/approved-example-root/data-sync.sqlite` 替换为批准的路径。禁止使用平台 DB、已有/生产文件、网络文件系统，以及多节点上同路径却相互独立的可写库。`create_if_missing:false` 让缺失挂载显式失败，不悄悄创建替代库。参见 [SQLite](../assets/resources/sqlite.md)。

在服务端用服务账号选择新路径后：

```sh
EXAMPLE_DB=/approved-example-root/data-sync.sqlite
test ! -e "$EXAMPLE_DB" && sqlite3 "$EXAMPLE_DB" 'PRAGMA user_version=1;'
```

文件已存在就停止并换路径，不截断/复用。完整 schema 位于实际部署 `setup.py` 的 `SCHEMA`：

- `source_changes(seq PRIMARY KEY,item_id,value,deleted)`：**只追加**日志，正整数 seq 严格增长，每个不可变变更对应稳定唯一序列。可有空洞，但不能在 checkpoint 以下迟到插入。
- `sync_items(item_id PRIMARY KEY,value,source_seq,deleted)`：保留最新修订的确定性投影；删除保存为持久墓碑，不物理删行。
- `sync_checkpoint(stream PRIMARY KEY,cursor)`：固定流 `fixture-v1`，初始 cursor 为 0。

源生产者的序列必须遵循**提交可见顺序**。事务先分配自增 ID、很久以后才提交，并不自动构成安全水位。本地 fixture 是静态数据；生产适配器需要稳定分页边界/CDC cursor，并明确迟到与保留语义。

## 3. 创建、配置与推送

从复制后的 `project/` 执行，不是在手册根目录或已有项目。以下 loopback 仅为示例，替换为获授权的非生产服务地址。

```bash
umask 077
export VIAT_SERVER=http://127.0.0.1:8080
viat --version
read -r -p 'Platform email: ' VIAT_EMAIL
read -r -s -p 'Platform password: ' VIAT_PASSWORD; printf '\n'
viat auth login --server "$VIAT_SERVER" --email "$VIAT_EMAIL" --password "$VIAT_PASSWORD"
unset VIAT_PASSWORD
viat version
viat project create example-data-sync 'Incremental data sync example'
viat project select example-data-sync
viat project member ls --json
viat authorizer create --name case_machine --kind api_key
viat p-user create --identity case_worker --role public
viat apikey create case_machine --user case_worker --name fixture-client
```

逐步检查，失败立即停。slug 被占用就换全新值，并同步修改 `viat.yaml`、命令、URL，**不能接管已有项目**。核对版本和 Owner 成员身份，遵循 MFA；密码参数会短暂可被本机进程检查。保护 `.viat/config.yaml`、一次性 API key secret 及其**行 UUID**，不纳入版本库。token 内短 `key_id` 不是撤销用 UUID。

```sh
viat push --only resources,scripts,workflows,schedules,endpoints
viat script run setup --args '{"confirm":"data-sync-isolated-db"}'
viat schedule show sync-hourly --json
viat endpoint list --json
```

初始化应返回 `{"ready":true,"source_rows":4}`；调度应为 `enabled:false`、`catch_up:false`、`on_overlap:"skip"`、`max_attempts:1`。源 fixture 依次为 A=alpha（seq 1）、B=beta（2）、A=alpha-v2（3）、B 墓碑（4）。重复 setup 不重置 cursor，也不覆盖已有变更，不能当作清空重来。

push 不执行 schema，不发布，各阶段非全局原子。明确 `--only` 排除 `meta`，**保留单独建立的 authorizer**，也排除无关触发器类别。它是按类别而非文件过滤；调度/端点可镜像删除相应范围内缺失对象，所以只能用于新隔离项目，不能作为已有项目的部分 checkout。不存在 `push --prune`。

端点目标使用 `target: {kind: workflow, ref: sync}`；调度使用 `target: {kind: workflow, name: sync}`，不要互换字段。仅记录 `POST /sync` 的 UUID：

```bash
read -r -p 'POST /sync endpoint UUID: ' ENDPOINT_ID
viat endpoint show "$ENDPOINT_ID" --json
viat publish plan --json
viat endpoint publish "$ENDPOINT_ID"
```

确认 `case_machine`、工作流 `sync`、严格输入，不发布无关叶子。修复警告/构建失败，不自动绕过；发布退出 0 不证明环境就绪。公开请求使用发布的工作流/步骤快照，草稿测试和调度使用实时定义。本例无 `uses:` 模块；1.1.0 中工作流步骤模块若存在则仍实时解析。

## 4. 有界分页调用与断言

输入实际一次性端点 API key。每个请求只修改隔离 fixture 库：

```bash
read -r -s -p 'Project API key: ' CASE_API_KEY; printf '\n'
curl --silent --show-error --include \
  "$VIAT_SERVER/p/example-data-sync/sync" \
  -H "Authorization: Bearer $CASE_API_KEY" -H 'Content-Type: application/json' \
  --data-binary @../fixtures/input.json
```

新库第一次预期 HTTP 200 与 `{"page":{"cursor_before":0,"cursor":2,"read":2,"more":true}}`。第二次为 `cursor_before:2,cursor:4,read:2,more:false`；第三次为 `cursor_before:4,cursor:4,read:0,more:false`。完整预期在 `fixtures/expected.json`。`more:true` 时再调用一个有界页，工作流内部不做无限循环。

操作员在服务端用**只读**连接检查持久数据：

```sh
sqlite3 -readonly /approved-example-root/data-sync.sqlite \
  'SELECT stream,cursor FROM sync_checkpoint; SELECT item_id,value,source_seq,deleted FROM sync_items ORDER BY item_id;'
```

两页后预期 `fixture-v1|4`、`A|alpha-v2|3|0`、`B||4|1`。空 value 且 `deleted=1` 表示墓碑，不是漏同步。通过 `viat logs query --endpoint "$ENDPOINT_ID" --limit 10 --json` 核对拒绝/运行证据。草稿运行成功不证明端点认证正确。

也可用 `viat workflow test sync --input '{"batch_size":2}'` 检查草稿，但它**真实执行下一页**，不能插入上述“新库”断言中。手工触发/启用调度同样会改变 cursor，断言期间不能做。

## Checkpoint、重启与补偿契约

`batch_size` 默认 2，仅接受真实整数 1–100。可写 SQLite **BEGIN IMMEDIATE** 在读取 checkpoint 前串行化调用者。单一事务内读取 `seq > cursor ORDER BY seq LIMIT batch_size`，仅在输入 `source_seq` 更新时 upsert，最后推进 checkpoint 并检查是否还有页，提交成功后才返回。

- checkpoint/commit 前失败：整页回滚，包括目标写入；重新调用仍从持久 cursor 开始。
- 提交后响应丢失：下一次读取已推进 cursor，不信任客户端从响应保存的游标。
- HTTP/手工/调度并发：本地 DB 锁串行处理；约 5 秒 busy timeout 后可重试有界页。调度 `on_overlap:skip` 仅辅助控负载，不是隔绝 HTTP 的全局锁。
- 旧变更重放不会覆盖新版本，也不会复活更新的墓碑。验证器只回退其**临时测试库** checkpoint 来证明此性质，不表示可以随意倒退已部署流。
- 本例源/目标/checkpoint 同库，因此不需要外部补偿。换远端目标时，应先使用确定性的 `(stream,seq)` 键取得目标确认，再持久推进源 checkpoint；两者之间失败必须可安全重放。用持久 outbox、目标本地唯一回执与对账；Viat 工作流不跨两资源连接或远端 API 形成事务。
- 纠正必须追加**更高序列新变更**，包括反向/墓碑事件；不能原地修改 cursor 以下历史。历史丢失则暂停，从保留快照明确重建新流/投影，不能直接跳 cursor。源日志至少保留到所有消费者 checkpoint/备份均通过所需位置。

默认禁用的 `sync-hourly` 每小时仅执行一页，`max_attempts:1`，不补跑；不是自动全量 drain，也不是 exactly-once scheduler。在确认容量/权限并**显式批准**后，可把其 YAML `enabled` 改为 true，再于隔离项目 `viat push --only schedules`，此类别镜像会作用于该新项目的所有 schedules。`viat schedule pause sync-hourly` 只停止新自动启动，不撤销在途写。每小时源变更量须低于消费能力，否则有意调整频率/批大小，仍遵守每页最多 100 行。非幂等外部适配器不可暗中增加自动重试。

## 错误与限制

| 失败 | 处理 |
| --- | --- |
| `400 invalid_batch_size` | 用整数 1–100，不用 bool/字符串/null；工作流输入元数据不是运行时类型校验 |
| HTTP `400 bad_request` | 删除未知字段、修复转换；直接工作流调用仍由脚本验证 |
| `409 checkpoint_missing` / 缺表 | 仅对专属库运行 setup，不猜测 cursor |
| API key 拒绝 / 管理 `403` | 区分端点用户、平台项目成员、Owner/Admin 发布权限 |
| SQLite 缺失/只读/锁定 | 核对单节点、挂载、允许根、可写资源，不绕过隔离 |
| 超时/响应丢失 | 检查 cursor，重启有界页，不能仅凭传输失败推断回滚 |
| cursor 以下迟到插入/修改 | 超出契约，应停流对账，不能默报完整 |

源文本/行大小是固定小 fixture，不是大批量加载基准。脚本预算 15 秒、工作流 30 秒，受部署上限约束。raw SQL 的安全边界是专属物理数据集，不是租户权限。本例不引入通用迁移框架或生产服务连接器。

## 精确清理

停止调用，暂停调度并等待在途运行结束。在这个项目中使用记录的端点 UUID 与 API key **行 UUID**：

```sh
viat schedule pause sync-hourly
viat schedule delete sync-hourly
viat endpoint unpublish "$ENDPOINT_ID"
viat endpoint delete "$ENDPOINT_ID"
viat apikey revoke case_machine API_KEY_ROW_UUID
viat p-user delete case_worker
viat authorizer delete case_machine
viat workflow delete sync
viat script delete sync_batch
viat script delete setup
viat resource delete sync_db
unset CASE_API_KEY
```

`API_KEY_ROW_UUID` 是创建 stderr 或 `viat apikey list case_machine` 的实际行 UUID，不是短 `key_id`。不裁剪其他项目，不删共享表。删除资源不删除数据文件；保留证据并确认无运行/资源占用后，操作员只能移除创建时记录的精确新文件及 sidecar。本地注销/凭据清理与服务端撤销分开处理。**1.1.0 不支持项目 DELETE**，保留空隔离项目。

## 依据与未验证边界

参见 [repo-sync](../projects/repo-sync.md)、[上下文](../assets/scripts/context.md)、[工作流](../assets/workflows/overview.md)、[HTTP](../triggers/http.md)、[调度](../triggers/schedules.md)、[SQLite](../assets/resources/sqlite.md)、[CLI 同步](../cli/sync.md)。定点依据为 `crates/viat-runtime/src/python.rs` 的事务/query/execute、`crates/viat-api/src/runner/broker.rs` 的 SQLite 锁及 CLI 资源/端点序列化。单元 fixture 不能证明真实 scheduler 身份/lease、broker timeout/rollback、发布或外部系统 CDC/幂等语义，需另行授权集成验证。
