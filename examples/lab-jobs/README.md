# Lab jobs / 实验室作业

**Target / 目标：Viat server + CLI 1.1.0 stable.**

- [Complete English operator guide](../../src/content/docs/en/applications/lab-jobs.md)
- [完整中文操作指南](../../src/content/docs/zh-cn/applications/lab-jobs.md)

## English

A real pushable registry, workflow, disabled submission/poll schedules, authenticated callback/poll APIs and separate external-cancel operation. PostgreSQL persists `job_id`, immutable payload, state, provider sequence and cancellation intent. `job_logic.py` is shared by deployed code, the synthetic adapter and offline unit checks. This is **not native Slurm**, a durable workflow engine, exactly-once delivery or an arbitrary Widget job UI. The Widget remains a platform overview. **Cancelling a Viat run does not cancel external jobs.**

### Prerequisites and apply

Use an activated isolated 1.1.0 server + CLI, Owner/Admin platform login, server Python/uv, local Python 3 standard library, Bash, jq, curl and an approved business PostgreSQL. Require new project `lab-jobs-example`, new DB/role `lab_jobs_example` and unused case names. Never use the platform database or overwrite an existing project's assets. Work from a private copy of this directory; record every created endpoint/key UUID, identity, schedule, DB and SQLite path. No real credentials belong in source control.

```sh
# From the copied case directory; no network, installation or services:
python3 -I validate.py
```

Unit checks import actual deployable logic and use an **explicitly labeled fake viat module** only for authorization-decision/default-I/O tests. **The offline validator passed**, as did all eight application validators. This is not real policy/DB/workflow/scheduler/provider acceptance; actual adapter/workflow/provider integration remains unverified. See [verification status](../../src/content/docs/en/reference/validation.md).

The linked guide provides exact PostgreSQL CREATE ROLE/CREATE DATABASE commands and `prepare.sql`, resource preparation, API user registration, key issuance and endpoint publication. Follow them in order and stop on any failure. Database bootstrap seeds no pretend jobs: only an opted-in submission creates `prepared`. Resource YAML is valid JSON/YAML and contains clearly labeled local fixture credentials with `.invalid` hostnames. Configure approved reachable addresses, or securely provision real resource secrets first and retain them using `$secret` placeholders. SQL resource worker projection in 1.1.0 can still include credentials; trust all script dependencies.

If separately approved, start the **local synthetic adapter** from the copied case directory in another terminal:

```sh
# First create a private records/ directory; adapter.sqlite must be a NEW owned path.
python3 -I adapter.py --db records/adapter.sqlite --token-file fixtures/adapter-token.txt
```

It binds only `127.0.0.1:8099`, simulates state in SQLite, sends no callbacks and launches no real jobs. Set resource `adapter` base_url to this loopback only if the API process shares that network. Otherwise use an explicitly approved development transport to the loopback server; never disable outbound guards or expose this fixture publicly. Its fixture token is not the separate Viat callback key.

After following DB/resource prerequisites and approving remote writes:

```sh
viat project create lab-jobs-example "Lab jobs isolated example"
viat project select lab-jobs-example
cd project
viat push --only meta,resources,scripts,workflows,schedules,endpoints
viat resource refresh db
cd ..
```

Metadata intentionally manages `password`, `lab-keys`, `callback-keys`, roles and model. Omitted authorizers may be pruned, so only a new isolated project is safe. Do not use a blanket push. Push does not run SQL or publish. Both schedules are **disabled and `inputs.opt_in:false`**. Manual calls also default to `opt_in:false` and perform no submission/poll/cancel I/O.

POST each `fixtures/users.json` object to `/projects/lab-jobs-example/users` using platform bearer. Issue a `lab-keys` key to `lab-operator-user`, saving `records/operator.key`, and a `callback-keys` key to `lab-adapter-user`, saving `records/callback.key`; record key row UUIDs separately. Operator and adapter are non-admin roles. Operator may submit/read/poll/cancel this shared lab's jobs; adapter may only send events; `system:scheduler` may submit/read/poll. This is intentionally **not tenant/per-owner isolation**.

Record and explicitly publish only `/jobs`, `/callback`, `/submission` UUIDs from the management endpoint list. `/submission` runs workflow `submit_job` and wraps output in `{job:...}`. Endpoint targets use `ref`; trigger targets use `name`. Workflow step `uses:` modules remain live in 1.1.0 even after publication; treat reducer changes accordingly.

### Assertions, adapter semantics and cleanup

Only against the approved **synthetic** adapter and new DB:

```sh
python3 -I acceptance.py --base "$BASE/p/lab-jobs-example" \
  --operator-key-file records/operator.key --callback-key-file records/callback.key \
  --allow-synthetic-adapter-io
```

This separate HTTP acceptance program remains unexecuted; the passing offline validator does not exercise it. It creates only `fixture-job` and `fixture-cancel`; tests workflow submission, duplicate/changed payload, wrong/anonymous callback identities, sequence/terminal handling, authenticated polling and explicit external cancel. Synthetic callbacks intentionally run ahead of adapter state to test stale polling. Never run this program against real provider jobs. Real DB/provider/restart/scheduler acceptance is still unverified.

The production adapter must persist idempotency by job_id for POST `/jobs`, support authenticated GET `/jobs/{id}` and POST `/jobs/{id}/cancel`, and emit `{job_id,state,seq}` with monotonic nonnegative integer seq. Allowed tasks are `synthetic` and `analysis`, never arbitrary commands. The fixture simulates both. Submission commits before HTTP; a lost reply can leave `prepared`. Retry the same ID/payload, not a fresh job. A changed local payload is 400. Stale, terminal-conflicting and running→queued events are no-ops. `cancel_requested` is intent, not proof of cancellation. Terminal states never resurrect. Do not reuse cleaned real job IDs or expire provider idempotency before retries end.

Only after additional approval may you change a copied schedule to a new recorded ID, `enabled:true` and `inputs.opt_in:true`, then `viat push --only schedules` from `project/`. Fixed-ID schedules are idempotent, not a stream of fresh jobs. Pause both immediately after inspection; none were enabled/run during authoring.

Cleanup follows the complete guide: pause `submit-fixture` and `poll-fixture`, reconcile/cancel real external jobs separately, unpublish/delete only the three recorded leaves, delete only those two schedules, revoke recorded key UUIDs, delete workflow `submit_job`, scripts `jobs`/`job_logic`, resources `adapter`/`db`. Delete only the two named project identities, owned model rules/type/subject attr/roles and unreferenced authorizers. Inspect then delete only `fixture-job`/`fixture-cancel` DB rows (plus any separately recorded schedule ID). Stop the local adapter before handling its recorded SQLite file. No blanket prune, unknown-ID deletion or forced dependency removal. Keep DB/schema by default. Resource deletion is not external cancellation or credential revocation. Retain evidence, then remove only recorded private files. There is **no project DELETE** in 1.1.0; leave the isolated project.

## 中文

这是实际可 push 的作业登记应用：工作流、默认禁用的提交/轮询定时器、认证回调/轮询 API，以及独立外部取消。PostgreSQL 持久保存 `job_id`、不可变载荷、状态、供应商序号与取消意图；部署代码、合成适配器及离线检查共用 `job_logic.py`。**不提供原生 Slurm、持久工作流、exactly-once 或任意 Widget 作业 UI。** Widget 仍是平台概览，**取消 Viat 运行不会取消外部作业**。

### 前提与应用

需要激活的隔离 1.1.0 服务端/CLI、Owner/Admin 平台登录、服务端 Python/uv、本地 Python 3 标准库、Bash、jq、curl、批准的独立业务 PostgreSQL。必须新建 `lab-jobs-example` 项目、`lab_jobs_example` 库/角色，名称冲突就停止；不使用平台数据库、不覆盖既有项目。复制本目录到私有路径操作，记录所有端点/密钥 UUID、身份、定时器及数据库/SQLite 路径，不提交真实秘密。

默认命令为上方 `python3 -I validate.py`，导入真实部署逻辑；只有授权决定和默认无 I/O 路径使用**明确标注的假 viat 模块**。**本例离线校验已通过，八个应用校验器也全部通过**，但不代表真实策略/数据库/工作流/定时器/供应商验收；实际适配器/工作流/供应商集成仍未验证。参见[验证状态](../../src/content/docs/zh-cn/reference/validation.md)。

中文完整指南给出精确的建角色/建数据库、`prepare.sql`、资源配置、API 用户注册、密钥签发和发布步骤，需按序执行并遇错停止。SQL 不种入假作业，只有显式提交才写 `prepared`。资源文件默认 `.invalid` 主机与明确的本地夹具密码；改为批准且可达的地址，真实秘密先在服务端安全创建，再以 `$secret` 保留。1.1.0 SQL 工作进程投影仍可能含凭据，须信任依赖树。

另获批准后，在另一个终端运行上方 `adapter.py` 命令；先建立私有 `records/`，SQLite 路径必须新建且属于本次。服务仅监听 `127.0.0.1:8099`，只模拟 SQLite 状态，不发送回调、不运行真实作业。只有 API 共享 loopback 网络才可将 HTTP 资源指向该地址；否则需单独批准的开发传输，不能关闭出站防护或直接公网暴露。夹具 token 与 Viat 回调密钥是两套凭据。

按指南完成数据库/资源准备并批准写入后，使用上方严格筛选的 create/select/push/refresh 命令。元数据完整有意管理 `password`、`lab-keys`、`callback-keys`、角色和模型；遗漏认证器可能被剪除，只能用于新隔离项目，不改成全量 push。push 不建表、不发布。两个定时器**默认禁用且 opt_in 为 false**，手动提交/轮询/取消同样默认不发外部请求。

用平台 bearer 将 `fixtures/users.json` 各对象 POST 至 `/projects/lab-jobs-example/users`；为 `lab-operator-user` 在 `lab-keys` 下签发密钥存 `records/operator.key`，为 `lab-adapter-user` 在 `callback-keys` 下签发密钥存 `records/callback.key`，另记录密钥行 UUID。两种角色非管理员；operator 可操作共享实验室全部作业，adapter 只发事件，`system:scheduler` 可提交/读取/轮询。**不做租户/所有者隔离。**

从管理列表记录并只发布 `/jobs`、`/callback`、`/submission` 三个叶子；`/submission` 调用 `submit_job` 工作流并返回 `{job:...}`。端点目标用 `ref`，定时器用 `name`。1.1.0 工作流步骤的 `uses:` 模块在发布后仍实时读取，修改归约器要按实时工作流变更审查。

### 断言、协议与清理

只对批准的**合成适配器**及新数据库执行上方 `acceptance.py`，不能指向真实作业。程序本次未执行；仅创建 `fixture-job`、`fixture-cancel`，检查工作流提交、重复/改载荷、错误/匿名回调、序号/终态、认证轮询及单独外部取消。回调有意领先夹具状态来测试旧轮询，不能声称真实调度器完成了工作。真实数据库/供应商/恢复/定时器验收仍未完成。

真实适配器须以 job_id 持久幂等处理 POST `/jobs`，提供认证 GET `/jobs/{id}` 和 POST `/jobs/{id}/cancel`，输出含单调非负整数 seq 的 `{job_id,state,seq}`。仅允许 `synthetic`、`analysis` 模板，不能执行任意命令；夹具对两者都只模拟。提交先落库再 HTTP，丢失响应可能留下 `prepared`；同 ID/载荷重试，不能换 ID。改载荷本地为 400；旧序号、终态冲突及 running→queued 为无操作。取消意图不证明取消完成，终态不能复活；真实 ID 不得清理后复用，幂等保留须覆盖重试。

只有另获批准，才可在复制的定时器中选新记录 ID，并同时改 `enabled:true` 和 `inputs.opt_in:true`，然后在 `project/` 仅 push schedules。固定 ID 有意幂等，不代表不断创建新作业，检查后立即暂停。本次没有启用或运行调度器。

按完整指南清理：先暂停两个定时器，独立协调/取消真实外部工作，再取消发布/删除记录的三个叶子、精确删除两个定时器、撤销已记录密钥 UUID、删除 `submit_job`、`jobs`/`job_logic`、`adapter`/`db`。只删除两个命名项目身份、本例规则/类型/主体属性/角色及无依赖认证器。数据库先检查后仅删 `fixture-job`、`fixture-cancel`（和另行记录的定时 ID）；先停止适配器再处理记录的 SQLite 文件。不整项目 prune、不删除未知 ID、不强制解除依赖，默认保留库/表。资源删除不等于外部取消或凭据撤销；保留证据后只删记录的私有文件。**1.1.0 没有项目 DELETE**，留下隔离项目。
