---
title: "实验室作业：通过 HTTP 适配器持久提交"
description: "可 push 的作业登记应用，包含工作流/定时提交、认证回调与轮询、重复乱序处理及独立外部取消。"
doc_id: applications.lab-jobs
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# 实验室作业：通过 HTTP 适配器持久提交

`examples/lab-jobs/` 提供完整可 push 的 `project/`、SQL、夹具、双语 README、离线单元校验、需主动启动的本地合成适配器，以及单独授权的 HTTP 验收。**本例离线校验已通过，八个应用校验器也全部通过。** 实际适配器/工作流/回调/供应商集成仍未验证，独立 HTTP 验收程序尚未执行。参见[验证状态](../reference/validation.md)。 目标为稳定版服务端/CLI **1.1.0**；`.yaml` 使用合法 YAML 子集 JSON 语法。

这是应用自有的持久作业登记表，**不是原生 Slurm 集成**。实际调度器/供应商映射由你批准的通用 HTTP 适配器负责。附带适配器**不启动真实进程或作业**，不发送回调，只在 SQLite 中保存合成状态。Viat 工作流是有界编排，不是持久外部作业引擎；持久 `job_id`、状态由应用数据库保存，Viat `run_id` 是另一种标识。

**取消 Viat 运行不会取消外部作业。** 外部取消是经独立认证、调用适配器的应用操作。Widget 是平台概览，不是任意作业状态 UI；应调用本应用的 `read` API 或构建正确授权的应用界面，不能承诺每个作业的 Widget 卡片。

## 部署文件与策略

| 资产 | 职责 |
| --- | --- |
| `project/scripts/job_logic.py` | 部署与测试共用的纯 ID/载荷/事件校验和单调状态归约 |
| `project/scripts/jobs.py` | 真实 `ctx.authz.require`、持久 SQL 事务与平台代理 HTTP |
| `project/workflows/submit_job.yaml` | 调用 `jobs`，返回 `{job:...}`，默认 `opt_in:false` |
| `project/schedules/submit-fixture.yaml` | 默认禁用的每小时工作流提交，目标用 `name` |
| `project/schedules/poll-fixture.yaml` | 默认禁用的每小时轮询，目标用 `name` |
| `project/endpoints/default/{jobs,callback,submission}.post.yaml` | 脚本/脚本/工作流端点，目标用 `ref` |
| `project/resources/{db,adapter}.yaml` | 业务 PostgreSQL 与固定上游 bearer HTTP 资源 |
| `project/viat.yaml` | 完整且有意管理的角色/认证器/真实授权模型 |
| `prepare.sql`、`fixtures/`、`validate.py`、`acceptance.py`、`adapter.py` | 初始化、合成数据、单元层、显式验收及本地供应商桩 |

`lab-operator`、`adapter` 都是**非管理员业务角色**。前者经 `lab-keys` 准入，可提交/读取/轮询/取消这个共享实验室内的全部作业；后者经 `callback-keys` 准入，只能提交事件。内置 `system:scheduler` 可提交/读取/轮询，不能取消或伪造回调。这不是按所有者或多租户隔离；`cross_tenant:true` 有意共享一个实验室登记表。请求字段不能赋予角色。

## 适配器协议与持久行为

平台通过 `adapter` 资源认证上游请求，脚本不得提取秘密。回调凭据另行配置：Viat `callback-keys` 下、属于项目用户 `lab-adapter-user` 的 API key，**不是**适配器上游 bearer token。

| 请求 | 必须实现的行为/结果 |
| --- | --- |
| `POST /jobs {job_id,payload}` | 以 `job_id` 持久幂等；相同载荷返回同一外部作业，载荷变化冲突，绝不重复提交 |
| `GET /jobs/{job_id}` | 返回当前事件；未知 ID 为 404，不伪造成功 |
| `POST /jobs/{job_id}/cancel {}` | 明确请求取消外部作业，返回观察到的状态，不无条件声称已取消 |
| 事件体 | 恰为 `{job_id,state,seq}`；state 为 `queued|running|succeeded|failed|cancelled`；seq 是 0..2^63−1 的整数，每个作业单调递增 |
| 回调 Viat | `POST /p/lab-jobs-example/callback`，独立回调 bearer，体为 `{op:"event",job_id,event:{...}}` |

载荷明确限制为 `{"task":"synthetic"}` 或 `{"task":"analysis"}`，不接收 shell 命令或调用者选择的 URL。真实适配器必须把 allowlist 中 `analysis` 映射到批准的模板，而不是执行用户文本；附带适配器对**两种**标签都只做模拟。事件必须匹配已登记 ID。上游使用同一个持久 ID，不能每次重试分配新身份。

提交先写入并提交 `prepared` 行及不可变规范化载荷，**然后**在事务外发 POST。并发重复提交可能发出同 ID 的两次请求，因此上游持久幂等是硬前提。丢失响应/崩溃可能在外部已接受后仍留下 `prepared`。应以**同 ID、同载荷**重试，或在供应商已知该 ID 时轮询；Viat 请求超时不是新建 ID 的理由。应用中同 ID 改载荷返回 400，上游协议使用 409。作业和供应商幂等记录须覆盖重试期限；已清理 ID 不得用于无关真实工作。

回调与轮询锁定同一行，并共用 `reduce_event`：seq ≤ 已存值为 `stale`；终态后的新事件为 `terminal`；running → queued 为 `regression`；否则应用状态并更新序号。忽略事件不修改状态/序号，完成事件可跳过中间状态。`cancel_requested` 只是意图，只有确认事件才能变成 `cancelled`。任何终态不可自动复活，供应商自相矛盾时需人工调查。未知回调 ID 返回 404。等待 HTTP 时不持有数据库事务。

## 前提与准备

需要激活的隔离 1.1.0 服务端及匹配 CLI、Owner/Admin 平台权限、服务端 Python/uv、本地 Python 3 标准库、Bash、jq、curl 和独立业务 PostgreSQL。下方假设已有批准的 PostgreSQL 开发容器及 `postgres` 超级用户；本例不安装或启动数据库。新项目 `lab-jobs-example`、数据库/角色 `lab_jobs_example`、资源 `db`/`adapter`、定时器及用户名称必须未被占用，冲突就停止。更改 slug 须同时修改元数据及所有命令/URL。

`BASE` 是不带末尾斜线的管理 API 根地址。私下导出有效且范围足够的 `PLATFORM_ACCESS_TOKEN`，CLI 另行[登录](../cli/auth.md)。记录实例、slug、数据库/容器、端点 UUID、密钥行 UUID、定时器名称及本地私有路径。不得提交 `.viat/`、真实供应商令牌或密钥文件。上游默认 `.invalid` 地址和明确标记的本地夹具 token；两个定时器均为 **`enabled:false` 且 `opt_in:false`**，只有单独批准后才可解除。

```sh
# 从文档仓库根目录开始。
set -euo pipefail
umask 077
CASE_DIR=$(mktemp -d "${TMPDIR:-/tmp}/viat-lab-jobs.XXXXXX")
cp -R examples/lab-jobs/. "$CASE_DIR/"
cd "$CASE_DIR"
mkdir records
python3 -I validate.py
```

单元检查导入实际部署归约模块和脚本入口。明确标注的假 `viat` 模块只提供授权决定桩与禁止默认 I/O 的资源陷阱，**不是** Viat 策略、数据库、工作流、定时器、HTTP 或供应商验收。离线检查已通过，但这一结果没有执行独立 HTTP 验收程序。

## 应用（明确批准数据库及管理面写入）

1. 创建**全新业务数据库**，不是平台数据库；不能让名称冲突静默通过。

```sh
export PG_CONTAINER=your-owned-business-postgres
docker exec "$PG_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "CREATE ROLE lab_jobs_example LOGIN PASSWORD 'local-fixture-only-not-for-production';"
docker exec "$PG_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c 'CREATE DATABASE lab_jobs_example OWNER postgres;'
docker exec -i "$PG_CONTAINER" psql -U postgres -d lab_jobs_example -v ON_ERROR_STOP=1 < prepare.sql
```

SQL 不种入假“已提交”行，只有显式选择提交才建立持久行。修改复制的 `project/resources/db.yaml` 中 host/port 为 API 可达、获准的地址。示例密码只用于本地夹具。真实密码应先安全创建 `db`，文件两个秘密值改为字符串 `$secret`；缺少真实秘密时占位符无法初始化资源。1.1.0 的 PostgreSQL `ssl` 字段不能保证 TLS/对端校验，需单独验证；该版 SQL 工作进程投影仍可能包含带凭据 URL，因此须信任脚本树且不得输出资源对象。

2. 仅在批准后启动**本地合成适配器**。在另一个终端进入同一复制目录：

```sh
# records 必须私有；adapter.sqlite 必须是新建且属于本次的夹具路径。
python3 -I adapter.py --db records/adapter.sqlite --token-file fixtures/adapter-token.txt
```

仅监听 **127.0.0.1:8099**，前台运行到中断；不提交真实工作、不发送回调。只有 API 与其共享 loopback 网络时，才把复制的 `project/resources/adapter.yaml` 的 `plain.base_url` 改为 `http://127.0.0.1:8099`。否则需单独批准的开发传输/反向代理接入这个 loopback 服务，并配置可达的固定 origin；容器 loopback 不等于宿主机 loopback。部署出站防护需明确允许该夹具目的地，不能关闭全局防护绕过拒绝。资源 secret token 须与 `fixtures/adapter-token.txt` 匹配，仅为合成本地夹具凭据。非本机暴露需单独审查 TLS/认证/网络，不能靠添加公网监听参数解决。

真实场景应改用单独批准、实现全部协议的适配器，安全设置秘密；**禁止对真实作业运行合成验收程序**。真实供应商验收仍是独立且未验证的任务。

3. 新建隔离项目，仅 push 明确列出的种类。

```sh
viat project create lab-jobs-example "Lab jobs isolated example"
viat project select lab-jobs-example
viat version
cd project
viat push --only meta,resources,scripts,workflows,schedules,endpoints
viat resource refresh db
cd ..
```

元数据有意完整管理 `password`、`lab-keys`、`callback-keys`、角色与策略；遗漏的认证器可能被剪除，因此**只适用于新隔离项目**。不要无筛选 push 或用残缺仓库做镜像。push 不执行 SQL、不发布；定时器创建即属实时配置，不受发布快照保护，务必保留两重禁用。

4. 创建项目身份，再签发独立密钥，不需要密码或开放注册。

```sh
set -o pipefail
jq -c '.[]' fixtures/users.json | while IFS= read -r user; do
  curl --fail-with-body -sS "$BASE/projects/lab-jobs-example/users" \
    -H "Authorization: Bearer $PLATFORM_ACCESS_TOKEN" \
    -H 'Content-Type: application/json' -d "$user" -w '\n'
done > records/users.jsonl
viat apikey create lab-keys --user lab-operator-user --name lab-operator-test > records/operator.key
viat apikey create callback-keys --user lab-adapter-user --name lab-callback-test > records/callback.key
viat apikey list lab-keys > records/operator-key-rows.txt
viat apikey list callback-keys > records/callback-key-rows.txt
```

检查用户响应的两个角色，任何失败都停止。一次性密钥私下保存；撤销用列表中行 UUID，不是短 key ID。生产适配器的回调密钥放其自身秘密后端，不放回调体或本仓库。

5. 记录并只发布本例三个叶子。管理列表返回数组。

```sh
curl --fail-with-body -sS "$BASE/projects/lab-jobs-example/endpoints" \
  -H "Authorization: Bearer $PLATFORM_ACCESS_TOKEN" > records/endpoints.json
for path in /jobs /callback /submission; do
  id=$(jq -er --arg path "$path" '[.[] | select(.path==$path and .method=="POST")] | if length==1 then .[0].id else error("expected one case leaf") end' records/endpoints.json)
  printf '%s %s\n' "$path" "$id" >> records/published-leaves.txt
  viat endpoint publish "$id"
done
```

检查发布响应与认证器名单。普通脚本端点在没有 `(live)` 时冻结依赖；**1.1.0 工作流步骤的 `uses:` 模块仍实时读取**，即使步骤主源码已发布冻结。归约模块修改必须按工作流实时行为变更审查；资源/模型设置同样实时。

## API、验收与定时器选择启用

三个入口均为 POST、闭合请求体，未知字段为 400。ID 是 1–64 字符小写 slug。`/jobs` 必需 `op`、`job_id`，可选 `payload:{}`、`event:{}`、`opt_in:false`。op 为 `submit|read|poll|event|cancel`，真实授权发生在 dry-run 返回前。`/callback` 使用同一脚本契约但只允许 `callback-keys`，adapter 角色只能 `event`。`/submission` 绑定工作流 `submit_job`，必需 job_id，payload 默认 `{"task":"synthetic"}`、opt_in 默认 false，输出包在 `{job:...}` 中。

- 默认 submit/poll/cancel 返回 `{dry_run:true,job_id,op}`，不访问数据库或 HTTP。
- 显式 opt-in 的提交/轮询/取消及回调返回 `{job_id,state,event_seq,cancel_requested}`，有时含 `decision`。
- `read` 只读数据库，不联系供应商；未知 ID 为 404。
- `submit` 且 true 时先持久化再 POST；`poll` 且 true 时认证访问供应商并归约事件。
- `cancel` 且 true 时记录意图并单独调用外部取消；仍为 `prepared` 则 409，先协调同 ID 提交。已终态则直接返回，不再次外部取消。

批准合成适配器流量及数据库写入后，在 `CASE_DIR` 执行：

```sh
python3 -I acceptance.py --base "$BASE/p/lab-jobs-example" \
  --operator-key-file records/operator.key --callback-key-file records/callback.key \
  --allow-synthetic-adapter-io
```

程序从工作流入口开始，断言重复提交、改载荷拒绝、错误认证器 403、匿名回调 401、已认证回调转换、重复/乱序/终态处理、认证轮询，以及对 `fixture-cancel` 的**独立外部取消**。仅留下业务 ID `fixture-job`、`fixture-cancel`。合成回调有意领先适配器当前状态，后续旧轮询不得回退终态。这些是对抗性合成断言，**不是实际调度器完成工作的证据**。序列/预期见 `fixtures/events.json`、`expected.json`；已有夹具行时，不检查并明确重置这两条及对应适配器行就不能重跑。

手动推进合成供应商时，可由获准操作者用夹具 bearer 对本地 `/jobs/<已记录ID>/advance` POST `{"state":"running"}` 或 `{"state":"succeeded"}`，再用 operator key 调 `/jobs`，体为 `{op:"poll",job_id:"<已记录ID>",opt_in:true}`。`/advance` **仅属夹具**，不要求生产适配器提供。真实验收应使用实际观察到的供应商事件、服务凭据、崩溃/恢复及持久幂等；本次均未验证。

定时器需另行批准：在复制的 `submit-fixture.yaml` 选择**新且记录的 job ID**，将 `enabled` 和 `inputs.opt_in` 都改为 true；如需轮询，同步修改 `poll-fixture.yaml` 的 ID 和 opt-in。在 `project/` 仅 `viat push --only schedules`（不要带 meta），查看两个定时器及运行后，立即 `viat schedule pause submit-fixture` 和 `viat schedule pause poll-fixture`。定时执行是 `system:scheduler`，不是创建者。固定 ID 提交有意幂等，不代表“每小时新建一个作业”；生产周期工作需有意设计业务 ID 生产者。本次没有运行调度器。

## 故障与明确不支持的承诺

401/403 应修正身份/认证器/策略，不能改成匿名回调。未知/非法事件按 400/404 关闭失败。`stale|terminal|regression` 是成功无操作，不是重试信号。上游 4xx/5xx 会使资源 helper 抛 `upstream_error`；SQL/网络失败可能发生在持久写入或供应商接受之后。重试前检查数据库及外部 ID。取消失败可能留下 `cancel_requested:true` 和仍运行的作业，应轮询后按需再次显式取消。

不承诺 exactly-once、原生 Slurm、持久工作流检查点、自动外部取消、结果文件服务、任意作业 Widget UI、自动告警发送或生产 outbox worker。取消 Viat 运行、客户端断连、取消发布、端点回滚都不能撤销供应商副作用。删除记录前先禁用调用方并在外部协调；按实验室策略保留供应商/幂等证据。

## 清理（只处理已记录的本例资产）

先暂停两个定时器，清点另行定时创建的 ID。真实工作先显式取消/协调，并确认供应商终态；删除 Viat 行/资源或停止合成适配器均不取消真实作业。

```sh
viat schedule pause submit-fixture
viat schedule pause poll-fixture
# 每对 /path UUID 都须核对属于本项目。
while read -r path id; do
  viat endpoint unpublish "$id"
  viat endpoint delete "$id"
done < records/published-leaves.txt
viat schedule delete submit-fixture
viat schedule delete poll-fixture
# 只撤销两份 key-row 记录中属于本次的 UUID。
viat apikey revoke lab-keys OPERATOR_KEY_ROW_UUID
viat apikey revoke callback-keys CALLBACK_KEY_ROW_UUID
viat workflow delete submit_job
viat script delete jobs
viat script delete job_logic
viat resource delete adapter
viat resource delete db
```

用平台 bearer 精确 DELETE `/projects/lab-jobs-example/users/lab-operator-user` 和同项目的 `/users/lab-adapter-user`。确认没有新增依赖后，DELETE `.../authorizers/{name}` 中本例的 `lab-keys`、`callback-keys`、`password`。GET `.../authz` 记录规则 UUID，只删除本例 `.../authz/rules/{id}`，再删除 `.../authz/types/job`、`.../authz/subject-attrs/role`，最后 `.../roles/lab-operator`、`.../roles/adapter`；均为项目管理路由、平台认证。遇到未知依赖冲突立即停止，不强删、不对既有项目做整体 prune。

```sh
# 协调后，先检查这两个精确 ID，再只删对应夹具行。
docker exec "$PG_CONTAINER" psql -U postgres -d lab_jobs_example -v ON_ERROR_STOP=1 \
  -c "SELECT job_id,state,cancel_requested FROM lab_jobs WHERE job_id IN ('fixture-job','fixture-cancel');"
docker exec "$PG_CONTAINER" psql -U postgres -d lab_jobs_example -v ON_ERROR_STOP=1 \
  -c "DELETE FROM lab_jobs WHERE job_id IN ('fixture-job','fixture-cancel');"
```

另行启用定时器若建立其他 ID，只能协调并删除对应已记录行。Ctrl-C 停止适配器后，只保留或删除本次记录的私有 `records/adapter.sqlite` 及同名 SQLite journal 文件。默认保留业务表/数据库，删除独占夹具基础设施需另获所有者授权。真实供应商凭据须另行撤销；保留必要证据后只移除已记录工作目录/密钥。**1.1.0 未注册项目 DELETE，应留下隔离项目。**

## 参考与依据

[仓库同步](../projects/repo-sync.md)、[授权](../auth/authorization.md)、[HTTP](../triggers/http.md)、[定时器](../triggers/schedules.md)、[工作流](../assets/workflows/overview.md)、[PostgreSQL](../assets/resources/postgresql.md)、[HTTP 资源](../assets/resources/http_api.md)。定向核对 `crates/viat-cli/src/repo/{viat_yaml.rs,endpoints.rs,schedules.rs}`、`crates/viat-api/src/{lib.rs,handlers/endpoints.rs}`、`crates/viat-runtime/src/{python.rs,annotations.rs}`。离线逻辑、集成/数据库、调度器、真实供应商是不同验收层。离线单元校验已通过；实际适配器/工作流/回调/供应商集成仍未验证，参见[验证状态](../reference/validation.md)。
