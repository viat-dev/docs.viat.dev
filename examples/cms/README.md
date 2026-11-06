# CMS / 博客内容管理

**Target / 目标：Viat server + CLI 1.1.0 stable.**

Complete operator guides (same executable files in both languages):

- [English guide](../../src/content/docs/en/applications/cms.md)
- [中文完整指南](../../src/content/docs/zh-cn/applications/cms.md)

## English

This is an executable single-newsroom application, not just an architecture sketch. `project/` is a real pushable checkout. The model in `viat.yaml` grants readers public reads, authors creation and their own draft preview/edit, and editors cross-author editing and publication. All are non-admin roles. The script uses actual `ctx.authz.check` calls against persisted ownership. Published columns are copies, never aliases of draft columns. This is **not tenant isolation** or an automatic raw-SQL policy.

### Prerequisites and safe application

Use an activated isolated 1.1.0 server, matching CLI, authenticated Owner/Admin, server Python/uv, local Python 3, Bash, curl, jq and an already-approved reachable business PostgreSQL. Require **new** project `cms-example`, database/role `cms_example`, and the identities in `fixtures/users.json`. Stop on any collision. Do not use Viat's own DB. From the docs repository, copy `examples/cms/` to a private operator directory; work from that copy, not a checkout containing real secrets. Record every created UUID/name, and never commit `.viat/` or API keys.

From the case directory, the only default validation command is:

```sh
python3 -I validate.py
```

It imports deployed `post_logic.py`; authorization decisions are unit stubs. It performs no I/O beyond local fixture reads. **The offline validator passed.** Separately, the coordinator's isolated real CLI/API/authz/PostgreSQL/worker acceptance passed twice, including after review fixes; that evidence is not supplied by this unit test. See [verification status](../../src/content/docs/en/reference/validation.md).

The linked guide supplies exact `docker exec ... psql` role/database creation and `prepare.sql` application, JSON API user registration, secure key capture, endpoint ID discovery and publish steps. Do these in order, stopping on errors. The SQL creates one unpublished `seed-post` and grants database CONNECT, schema USAGE and table SELECT/INSERT/UPDATE to the resource role. Point the copied resource at that approved DB. Shipped credentials are explicitly local-only fixtures; for a real connection create resource `db` securely first, then retain its secrets with `$secret` file placeholders.

```sh
# Run only after approving remote writes and following DB preparation in the guide.
viat project create cms-example "CMS isolated example"
viat project select cms-example
cd project
viat push --only meta,resources,scripts,endpoints
viat resource refresh db
cd ..
```

Metadata intentionally includes `password`, `cms-keys`, all roles and policy. Push may prune omitted authorizers: never reuse an existing project and never replace the exact filtered command with blanket push. Push does not apply SQL or publish. Create project users by POSTing each object in `fixtures/users.json` to `/projects/cms-example/users` with **platform** bearer. Issue API keys under `cms-keys` to `cms-reader`, `cms-author-a`, `cms-author-b`, `cms-editor`; save them privately as `records/{reader,author,other,editor}.key`. Record key **row UUIDs**. Locate `/posts` in `GET /projects/cms-example/endpoints`, record its UUID and explicitly `viat endpoint publish UUID`.

### Assertions and cleanup

After approving writes to the isolated DB, using `BASE` as the API root:

```sh
python3 -I acceptance.py --url "$BASE/p/cms-example/posts" \
  --reader-key-file records/reader.key --author-key-file records/author.key \
  --other-key-file records/other.key --editor-key-file records/editor.key \
  --allow-remote-writes
```

This is a separate explicitly networked assertion program; **`acceptance.py` itself was not invoked against a deployed customer server**. It creates `fixture-post`, checks HTTP 401/403/404/409/400 negative cases, editor publication and draft/public copy isolation. It leaves data and fails rather than silently recycling an existing fixture ID. Inputs/expected bodies live in `fixtures/`. The isolated real-stack path passed separately; customer deployment, production recovery and load acceptance remain outside that evidence.

For cleanup, follow the exact guide: unpublish/delete only the recorded `/posts` leaf, revoke the four recorded key UUIDs, DELETE only the four named project identities, remove only case-owned rules/type/subject attrs/roles and unreferenced authorizers, then delete scripts `posts`, `post_logic` and resource `db`. Inspect and DELETE **only** `seed-post` and `fixture-post` in `cms_posts`. Leave unrelated rows and keep the DB/schema by default. Conflicts mean stop and inspect, not force or prune. Retain required evidence then remove only your recorded private directory/keys. No project DELETE route or project-delete CLI exists in 1.1.0. Deleting resources does not drop databases; endpoint rollback does not roll back data/policy.

## 中文

这是完整可部署的单编辑部应用，而非架构草图。`project/` 可真实 push；`viat.yaml` 的实际规则允许读者读取公开内容、作者创建及预览/修改本人草稿、编辑跨作者修改与发布。业务角色都非管理员。脚本使用真实 `ctx.authz.check` 和数据库中的所有者；公开列是草稿副本而非实时别名。**不提供租户隔离，也不让原始 SQL 自动鉴权。**

### 前提与安全应用

需要激活的隔离 1.1.0 实例、匹配 CLI、Owner/Admin 登录、服务端 Python/uv、本地 Python 3、Bash、curl、jq、已批准且可达的独立业务 PostgreSQL。必须新建 `cms-example` 项目、`cms_example` 数据库/角色及夹具身份，名称冲突就停止，不能使用平台数据库。复制 `examples/cms/` 到私有目录操作，记录每个 UUID/名称，不提交真实秘密或 `.viat/`。

上方 `python3 -I validate.py` 是默认离线校验，直接导入部署纯模块；授权回调为单元桩，无网络或数据库操作。**离线校验已通过。** 另有协调者的隔离真实 CLI/API/授权/PostgreSQL/worker 验收通过两次，包含审查修复后重跑；后者不是这个单元测试提供的证据。参见[验证状态](../../src/content/docs/zh-cn/reference/validation.md)。

完整中文指南提供精确的 PostgreSQL 建库/建角色命令、`prepare.sql`、项目用户 JSON API 注册、密钥私密保存、叶子 UUID 定位和发布步骤，必须按顺序并遇错停止。SQL 种入一个未发布的 `seed-post`，资源角色得到数据库 CONNECT、schema USAGE 与表 SELECT/INSERT/UPDATE。修改复制的 DB 地址；示例凭据仅用于本地夹具，真实秘密需先在服务端安全创建 `db`，文件用 `$secret` 保留。

按指南完成数据库准备并批准远端写入后，使用上方严格筛选的 create/select/push/refresh 命令。元数据完整声明 `password`、`cms-keys`、角色和模型，遗漏认证器可能被 prune，故不能复用已有项目或改成全量 push。push 不执行 SQL、不发布。用平台 bearer 把 `fixtures/users.json` 中每个对象 POST 到 `/projects/cms-example/users`；为四个身份分别在 `cms-keys` 下签发密钥，私密保存到 `records/{reader,author,other,editor}.key`，记录密钥**行 UUID**。GET 端点列表，记录 `/posts` UUID，再明确发布。

### 断言与清理

批准数据库写入后运行上方 `acceptance.py` 命令。它创建 `fixture-post`，断言 HTTP 401/403/404/409/400 拒绝、编辑发布和草稿/公开隔离；已有夹具 ID 时失败，不自动回收。它会访问网络，**`acceptance.py` 本身未对已部署客户服务器执行**；输入/预期见 `fixtures/`。隔离真实栈路径已另行通过，不能据此声称客户部署、生产恢复或负载验收完成。

按完整指南清理：仅取消发布/删除记录的 `/posts` 叶子，撤销四个已记录密钥 UUID，精确删除四个项目身份，再移除本例规则/类型/主体属性/角色及无依赖认证器，最后删除 `posts`、`post_logic` 和资源 `db`。数据库中先检查，再仅删除 `seed-post`、`fixture-post`；保留其他行，默认保留表/库。依赖冲突要停止，不强删、不整项目 prune。保留必要证据后仅删除记录的私有目录/密钥。1.1.0 没有项目 DELETE 路由或 CLI；资源删除不等于删数据库，快照回滚不回滚数据或授权模型。
