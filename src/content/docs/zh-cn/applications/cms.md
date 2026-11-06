---
title: "CMS：私有草稿与已发布博客"
description: "可 push 的单编辑部 CMS，包含 PostgreSQL、读者/作者/编辑策略、版本隔离和 HTTP 越权反例。"
doc_id: applications.cms
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# CMS：私有草稿与已发布博客

完整案例位于 `examples/cms/`：真实 `project/` 仓库、建表 SQL、合成输入/预期输出、双语 README、离线 `validate.py` 和需单独授权的 `acceptance.py`。`.yaml` 文件使用 JSON 语法（合法 YAML 子集）。**验证状态：离线校验已通过；独立隔离环境中的真实 CLI/API/授权/PostgreSQL/worker 验收通过两次，包含审查修复后重跑。** `acceptance.py` 本身未对已部署客户服务器执行。证据及剩余发布边界见[验证状态](../reference/validation.md)。目标为稳定版服务端及 CLI **1.1.0**。

这是一个独立编辑部，不是多租户 CMS、富文本编辑器或网站生成器。所有业务角色均非管理员；`cross_tenant:true` 明确表示共享编辑部，不提供租户隔离。API 是小型 POST RPC，并未假装任意 SQL 会自动受到 CRUD 行范围保护。

## 可部署组成与实际策略

| 文件/资产 | 职责 |
| --- | --- |
| `project/viat.yaml` | 完整、有意管理的认证器、角色和真实授权 AST |
| `project/scripts/post_logic.py` | 部署脚本与离线测试共享的纯校验、授权分支、草稿/公开投影 |
| `project/scripts/posts.py` | 可信主体、`ctx.authz.check`、参数化 SQL 与事务 |
| `project/resources/db.yaml` | 独立业务 PostgreSQL；`.invalid` 主机与明确标注的本地夹具凭据 |
| `project/endpoints/default/posts.post.yaml` | 闭合参数契约、`cms-keys` 准入、目标 `ref: posts` |
| `prepare.sql` | 表、权限与一个未发布的合成 `seed-post` |
| `fixtures/` | 用户注册体、输入与预期结果 |
| `validate.py` / `acceptance.py` | 离线纯逻辑单元层 / 显式选择执行的在线 HTTP 断言 |

草稿与公开内容使用不同列。编辑执行 `publish` 时，在一个事务内把当前草稿复制到公开列；之后修改草稿不会改变已发布副本。`read`/`list` 永不返回草稿列；`preview` 单独鉴权。创建时的所有者来自认证主体，后续来自持久数据库行，绝不信任请求中的所有者。修改操作锁行直到事务提交；read/preview 使用普通读取。本例没有定时器或自动发送。

`post` 模型的权限如下：

| 角色 | 公开读取/列表 | 创建本人草稿 | 预览/修改本人草稿 | 预览/修改他人草稿 | 发布 |
| --- | --- | --- | --- | --- | --- |
| reader | 是 | 否 | 否 | 否 | 否 |
| author | 是 | 是 | 是 | 否 | 否 |
| editor | 是 | 是 | 是 | 是 | 是 |

作者可以修改已发布文章的草稿，只有编辑能更新公开副本。对象 `owner` 与可信 `identity` 主体比较；无 permit 即拒绝。本设计使用脚本点检查，原始 `db.query`/`execute` **不会自动附加行授权**。不要另建绕过检查的 SQL 脚本或 CRUD 入口。1.1.0 PostgreSQL 资源的工作进程投影仍可能包含连接凭据；必须信任脚本及依赖树，不得输出资源对象。

## 操作前提与安全边界

需要已激活的隔离 Viat 1.1.0 实例、匹配 CLI、已登录的 Owner/Admin（元数据设置及发布）、服务端 Python/uv、本地 Python 3、Bash、curl、jq，以及 API 节点可访问的独立 PostgreSQL。本案例不安装工具、不启动服务。**不得使用 Viat 平台数据库。** 下方引导命令假设已有经批准的开发容器及 `postgres` 超级用户；可调整连接方式，不要省略建表/授权。

**必须新建项目及业务数据库。** 若 `cms-example`、`cms_example`、`db` 或这些身份已被其他练习占用，立即停止。更换项目 slug 时，同步修改 `project.slug`、create/select 命令及所有 `/p/`、`/projects/` URL。私下记录 slug、数据库/容器、端点 UUID、认证器/密钥 UUID、用户身份；令牌及 `.viat/` 不得提交。

`BASE` 是不带结尾斜线的实例管理 API 根地址；`PLATFORM_ACCESS_TOKEN` 是已取得且范围足够的平台登录令牌/PAT，不是端点密钥。CLI 另行完成[登录](../cli/auth.md)，每次写入前核对实例及项目。

## 应用（显式授权远端写入）

在文档仓库根目录复制至私有工作目录。以下仍是操作者指令，不表示已对你的服务器执行过这套流程。

```sh
set -euo pipefail
umask 077
CASE_DIR=$(mktemp -d "${TMPDIR:-/tmp}/viat-cms.XXXXXX")
cp -R examples/cms/. "$CASE_DIR/"
cd "$CASE_DIR"
mkdir records
python3 -I validate.py
```

离线校验导入真实部署纯模块，检查发布复制隔离、拒绝分支、可信所有者、非法输入、夹具和模型结构。授权回调是桩，不代表运行过 Viat 策略引擎；不访问网络或数据库。

1. 只准备新数据库。设置 `PG_CONTAINER` 为自己获准操作的**业务**数据库容器。夹具密码仅用于隔离本地开发；非本地场景应在仓库外安全提供真实秘密，独立验证传输安全。1.1.0 的资源 `ssl` 布尔值不保证对端校验。

```sh
export PG_CONTAINER=your-owned-business-postgres
# 任意名称冲突都应停止，不添加 IF NOT EXISTS，也不复用别人的数据库。
docker exec "$PG_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "CREATE ROLE cms_example LOGIN PASSWORD 'local-fixture-only-not-for-production';"
docker exec "$PG_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c 'CREATE DATABASE cms_example OWNER postgres;'
docker exec -i "$PG_CONTAINER" psql -U postgres -d cms_example -v ON_ERROR_STOP=1 < prepare.sql
```

2. 在复制出的 `project/resources/db.yaml` 中，将 `plain.host`/port 改为批准且 API 可达的地址。账号密码须匹配引导结果，凭据放 `secret` 而非 `plain`。使用真实凭据时，先安全创建服务端 `db`，再将文件中的两个秘密值改为字符串 `$secret` 后 push；占位符不能创建新凭据。

```sh
viat project create cms-example "CMS isolated example"
viat project select cms-example
viat version
cd project
viat push --only meta,resources,scripts,endpoints
viat resource refresh db
cd ..
```

元数据是为新项目**完整且有意**声明的，包含原生 `password` 和 `cms-keys`；服务器独有认证器可能被剪除。不可指向已有项目，也不可改成无筛选的全量 push。`push` 不执行 `prepare.sql`，也不发布；refresh 更新 DDL 后的内省，不能让原始 SQL 自动鉴权。

3. 创建四个**项目终端用户**，不是平台协作者。请求体为 `fixtures/users.json` 中的每个对象；本例只发 API key，不需要密码，也不启用开放注册。

```sh
# 先在私有会话中导出 BASE、PLATFORM_ACCESS_TOKEN。
set -o pipefail
jq -c '.[]' fixtures/users.json | while IFS= read -r user; do
  curl --fail-with-body -sS "$BASE/projects/cms-example/users" \
    -H "Authorization: Bearer $PLATFORM_ACCESS_TOKEN" \
    -H 'Content-Type: application/json' -d "$user" -w '\n'
done > records/users.jsonl
viat apikey create cms-keys --user cms-reader --name cms-reader-test > records/reader.key
viat apikey create cms-keys --user cms-author-a --name cms-author-test > records/author.key
viat apikey create cms-keys --user cms-author-b --name cms-other-test > records/other.key
viat apikey create cms-keys --user cms-editor --name cms-editor-test > records/editor.key
viat apikey list cms-keys > records/key-rows.txt
```

stdout 的完整密钥只展示一次；撤销需要列表中的**行 UUID**，不是短 key ID。逐一检查用户响应的角色；任何失败都停止，不应在半初始化状态下继续。

4. 仅定位本例叶子并记录实际 UUID，再明确发布。

```sh
curl --fail-with-body -sS "$BASE/projects/cms-example/endpoints" \
  -H "Authorization: Bearer $PLATFORM_ACCESS_TOKEN" > records/endpoints.json
POSTS_ID=$(jq -er '[.[] | select(.path=="/posts" and .method=="POST")] | if length==1 then .[0].id else error("expected one posts leaf") end' records/endpoints.json)
printf '%s\n' "$POSTS_ID" > records/posts-id.txt
viat endpoint publish "$POSTS_ID"
```

检查发布计划/响应及认证器名单，验收**已发布**路径，不只运行草稿测试。普通脚本 `uses:` 依赖在没有 `(live)` 标记时随端点冻结，本例没有 live 标记；授权模型、资源、用户设置独立保持实时。

## API 与断言

使用 `cms-keys` 下的 bearer key 调用 `POST /p/cms-example/posts`。`op` 必填，`post_id`、`title`、`body` 默认空字符串。未知字段（包括伪造的 `owner`、`role`、`is_admin`）返回 400。ID 为 1–64 字符的小写 slug；标题非空且不超过 160 字符，正文非空且不超过 20,000 字符。`list` 忽略未使用的已声明字段，按 ID 固定排序最多返回 100 篇公开文章；本例没有更深分页。每行保留携带对象属性的授权检查，避免后续添加所有者规则时，被一个复用的 subject-only 允许结果绕过。代价是最多 100 次授权 RPC；有一行被拒绝时，整个列表失败，而不是静默过滤。扩大数据量时应设计并验证带 scope 的分页查询，不能用一个缓存的允许结果替代这些检查。

- `create`：ID/标题/正文必需，返回 `{post_id,revision}`，重复 ID 为 409。
- `edit`：现有 ID/标题/正文，只改草稿，返回 `{post_id,revision}`。
- `publish`：现有 ID，把草稿复制到公开列，返回 `{post_id,revision}`。
- `read`：公开 `{post_id,title,body}`；不存在或尚未发布时 404。
- `preview`：草稿投影，先检查权限，越权 403。
- `list`：公开投影数组；SQL 虽种入草稿，初始仍为 `[]`。

写操作使用短事务和行锁；没有乐观 revision 前置条件，两位合法编辑串行写入时后者覆盖前者。超时不等于回滚，应先按业务 ID 检查/预览，不能盲目重试。SQL/网络故障需另行调查。

批准对新项目/数据库写入后，在 `CASE_DIR` 运行准备好的在线断言：

```sh
python3 -I acceptance.py --url "$BASE/p/cms-example/posts" \
  --reader-key-file records/reader.key --author-key-file records/author.key \
  --other-key-file records/other.key --editor-key-file records/editor.key \
  --allow-remote-writes
```

程序**仅创建 `fixture-post`**，检查未发布读取 404、读者写入 403、其他作者预览/修改 403、作者发布 403、匿名 401、伪造字段 400、重复创建 409、编辑发布，以及后续草稿改动不影响公开结果。预期体见 `fixtures/expected.json`。程序留下数据供检查；成功后未明确清理两个已记录夹具 ID 前不可直接重跑。协调者的独立隔离真实栈验收已通过；**`acceptance.py` 本身未对已部署客户服务器执行**。这些结果均不代表生产恢复、负载或客户环境验收完成。

检查拒绝日志与执行日志，不输出密钥。不要用匿名化端点解决 403；404 可能只是没有公开版本；409 应先检查原 ID。回滚端点不回滚业务数据、角色或模型。本例明确不涵盖删除接口、媒体上传、审批、审计保留和生产分页。

## 清理（仅自己记录的名称/ID）

先停止调用方，再取消发布并删除记录的叶子，不能通过空目录镜像或整树删除清理。

```sh
viat endpoint unpublish "$POSTS_ID"
viat endpoint delete "$POSTS_ID"
# 核对 records/key-rows.txt 中四个 UUID 的名称后逐一撤销。
viat apikey revoke cms-keys KEY_ROW_UUID
# 用平台认证精确删除这四个身份，以下为第一个。
curl --fail-with-body -sS -X DELETE "$BASE/projects/cms-example/users/cms-reader" \
  -H "Authorization: Bearer $PLATFORM_ACCESS_TOKEN"
```

其余身份是 `cms-author-a`、`cms-author-b`、`cms-editor`。撤销密钥并删除用户后，仅在仍无其他依赖时，用平台 bearer 对 `DELETE /projects/cms-example/authorizers/{name}` 删除本例的 `cms-keys`、`password`。先 `GET /projects/cms-example/authz` 记录本例 `rules[].id`，逐个 `DELETE .../authz/rules/{id}`；再删除 `.../authz/types/post`，然后 `.../authz/subject-attrs/identity`、`.../authz/subject-attrs/role`，最后 `DELETE .../roles/reader`、`.../roles/author`、`.../roles/editor`。遇到依赖冲突立即停止，不能强删未知依赖。

```sh
viat script delete posts
viat script delete post_logic
viat resource delete db
# 先检查这两个记录的业务行，再精确删除；保留其他行。
docker exec "$PG_CONTAINER" psql -U postgres -d cms_example -v ON_ERROR_STOP=1 \
  -c "SELECT post_id, owner FROM cms_posts WHERE post_id IN ('seed-post','fixture-post');"
docker exec "$PG_CONTAINER" psql -U postgres -d cms_example -v ON_ERROR_STOP=1 \
  -c "DELETE FROM cms_posts WHERE post_id IN ('seed-post','fixture-post');"
```

默认保留表/数据库供检查。仅在证明独占且没有新增行/依赖后，数据库所有者才可另行删除本例表、数据库、角色；删除资源不包含这些操作。保留必要证据后只删除准确记录的私有 `CASE_DIR`。**1.1.0 未注册项目 DELETE 路由，也没有 project-delete CLI**，应留下空隔离项目。撤销令牌、数据库清理、本地密钥文件清理互相独立。

## 相关契约与依据

[仓库同步](../projects/repo-sync.md)、[授权](../auth/authorization.md)、[HTTP](../triggers/http.md)、[CRUD 替代方案](../triggers/crud.md)、[PostgreSQL](../assets/resources/postgresql.md)。本设计未用 CRUD，因此必须保留显式脚本检查。定向核对实现：`crates/viat-cli/src/repo/{viat_yaml.rs,endpoints.rs}`、`crates/viat-api/src/{lib.rs,handlers/endpoints.rs}`、`crates/viat-runtime/src/{python.rs,annotations.rs}`。源码核对不是在线验收。
