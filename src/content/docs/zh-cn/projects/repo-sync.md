---
title: "项目仓库与同步"
description: "磁盘文件、真实 push/pull 删除替换语义、模型迁移及导入差异。"
doc_id: projects.repo-sync
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# 项目仓库与同步

仓库(磁盘上的这棵目录)描述的是远端**草稿**资产。三条边界先立住:

- `push` 只同步草稿:不发布、不执行数据库迁移。
- `pull` 拉取的是草稿,不是"最后发布的版本"。
- 仓库不是完整备份:账号状态、发布快照、秘密都不在其中。

精确参数见 [CLI 同步](../cli/sync.md),会话发现见 [CLI 概览](../cli/overview.md)。
本页命令/片段均**来自源码、未执行**;`demo`/`hello` 出自隔离的首端点指南,
`cli-demo`/`demo.viatpkg` 出自 CLI 示例。

## 前提与权限

必须从预期的仓库根目录运行:凭据发现可以向上查找 `.viat/config.yaml`,但
资产同步使用**当前工作目录**,不是找到配置的目录。当前项目须与
`viat.yaml.project.slug` 一致。写操作前核对服务器/项目;pull 前备份完整目录
并检查本地改动。

- push/内容修改/完整 pull/export 中的端点、树、角色、认证器与模型读取,
  需要编辑者角色(`owner`/`admin`/`developer`)——Operator 不具备这些读取权。
- 修改项目 name/scope claims 等元数据进一步要求 Owner/Admin:能编辑内容
  不等于能改设置。
- 筛选同步(`--only`)不提升权限,也不会让残缺仓库变安全。

## 目录与身份

```text
viat.yaml
resources/<folder>/<name>.yaml
scripts/<folder>/<name>.<ext>
workflows/<folder>/<name>.yaml
endpoints/<tree>/<branch>/[id].get.yaml
schedules/<name>.yaml
watches/<name>.yaml
queue-triggers/<name>.yaml
ws_triggers/<name>.yaml
im/accounts/<name>.yaml
im/triggers/<name>.yaml
crate/Cargo.toml
crate/src/lib.rs
authz/migrations/<id>.yaml
migrations/<resource>/*.sql
```

- `<folder>` 可省略,但它是资源/脚本/工作流**身份**的一部分:
  `scripts/reports/hello.py` 是 `reports/hello`,不是根下的 `hello`。
- 资产递归遍历,跳过点目录,按路径排序;触发器集合是平面目录。
- **磁盘上 `queue-triggers` 用连字符**,而 `--only` 选择器写
  `queue_triggers`。
- SQL 迁移由独立的 `viat db migrate` 执行;授权模型迁移不是 SQL(见下文)。

脚本扩展名:`.py` Python、`.ts` TypeScript、`.sql` SQL、`.sh` shell、
`.graphql` GraphQL、`.vgql` viat_gql、`.prompt` llm、`.rs` Rust、
`.yaml`/`.yml` binary manifest;未知扩展名 push 时跳过。二进制程序的字节是
artifact,不在 manifest 里——拉到 YAML 不等于备份了程序。工作流只读
`.yaml`,definition 原样携带。脚本示例使用真实的
`examples/hello-endpoint/hello.py`,不要另维护改写副本。

## `viat.yaml` 完整元数据

必填 `project:{slug,name}`。`authorizers`、`roles`、`scope_claims` 可选、
默认空列表;`authz` 省略/null 表示**不管理模型**,不是"空模型"。旧
`permissions`、`roles[].permissions` 仅为拒绝非空退役数据而保留解析。

```yaml
project:
  slug: demo
  name: Demo
authorizers:
  - name: machine
    kind: api_key
    default_role: public
    config:
      token_ttl_hours: 1
roles:
  - name: reader
    is_admin: false
    description: Fixture reader
scope_claims:
  - name: tenant
    type: text
    source: meta
```

- `authorizers[]`:必填 `name`、`kind`;`default_role` 省略/null 表示不管理
  服务端默认角色;`config` 省略/null 表示不管理 config,提供则是**完整
  替换**。秘密不拉取。kind 变更会报告并跳过,不会删除重建;原地改
  role/config 保留已有 key。首次创建需要秘密的 OIDC/社交认证器,必须另行
  在服务端安全配置秘密——别指望导出里有它们。平台创建的 `chat` 不归仓库
  管理。
- `roles[]`:必填 `name`;`is_admin` 省略/null 保持服务端标志,
  `description` 省略/null 保持、`""` 清除。内置 `public`、
  `system:scheduler` 不导出、也不被裁剪。
- `scope_claims[]`:`{name,type,source,from?}`,完整校验见[设置](settings.md)。
  省略列表默认为空,因此**镜像 push 最终会移除服务端独有声明**——不能像
  省略 authz 那样解释为"不管理"。默认 import 只添加不删除。
- `authz` 的 `subject_attrs`/`types`/`rules` 都可选、默认 `[]`;显式空对象
  可以裁剪模型。委托规则不序列化、不镜像。

`authz` 内部完整结构:

| 列表 | 结构 |
| --- | --- |
| `subject_attrs` | `name`、`source`、可选 `from_key`、`ty`、默认 `is_set:false`、可选 `tenant_bypass` |
| `types` | `name`、默认 `cross_tenant:false`、可选 `tenant_attr`/`tenant_subject`/`tenant_bypass`,默认 `attrs:[]`/`actions:[]` |
| `types[].attrs` | `name`、`kind`;可选 `column_name`、`rel_table`、`rel_local_fk`、`rel_ref_col`、`rel_col`;默认 `is_set:false` |
| `types[].actions` | 动作名字符串 |
| `rules` | `type`、`action`、`effect`、`expr` AST;按内容匹配,不导出服务端 ID |

经审核后才能附加到隔离元数据的模型片段:

```yaml
authz:
  subject_attrs:
    - name: role
      source: role
      ty: text
  types:
    - name: report
      cross_tenant: true
      actions: [read]
  rules:
    - type: report
      action: read
      effect: permit
      expr:
        subj_only: {subj: role, op: eq, lit: reader}
```

完整 AST 与租户语义见[授权](../auth/authorization.md)。此跨租户夹具不是
生产隔离方案;连接秘密不能写进 `viat.yaml`。

## 资源、秘密与环境值

- 资源文件必填 `name`、`kind`、`plain`,可选 `secret`;
  `allowed_authorizers` 默认 `[]`。父目录提供 folder,文件名不能替代正文
  `name`。各 kind 的完整 plain/secret schema 由[资源参考](../assets/resources/index.md)
  负责,本页不移植凭据。
- pull 写出**字符串 `$secret`** 占位;旧 YAML 的 `!secret` push 仍接受。两者
  提交前都会从 secret 字段剔除,保留服务端已有秘密——它们不是凭据。支持
  位置的 `$secret:<name>`、`{$secret:name}` 资源引用是另一种功能。
- 顶层 `plain` 字段 `$keep` 保留已有服务端值:不是递归合并、不是重置,也不
  能初始化不存在的值;pull 会保留已有适用的 `$keep` 选择。已有资源通过
  PATCH 更新(不是整对象替换),字段遵循资源 API 的 patch 规则。
- **资源不会因为文件缺失而被删除**;`system`/平台资源被跳过,不会导出平台
  数据库凭据。
- 正常 push 中,新资源若仍带 `$secret`/`!secret` 或 `$keep` 会失败:先在目标
  安全创建,再保留占位。`secret` kind 先于依赖它的 config 资源;`library`
  最后保存,冻结的是刚推送的脚本版本而不是旧版。

## 端点文件与不可无损往返项

每棵树一个目录,分支为目录,`:id` 写作 `[id]`,叶文件是
`<segment>.<小写方法>.yaml`;正文 method 必须与文件名一致。端点 target 用
`ref`,触发器用 `name`:

```yaml
method: GET
target: {kind: script, ref: hello}
allowed_authorizers: null
authz_gates: []
override_authorizers: false
override_permissions: false
```

target 可为 `{kind:script,ref}`、`{kind:workflow,ref}`、`{kind:crud,ref,config}`,
或 `{kind:websocket,routes:{message_type:script_path},route_key?,message_rate_limit?,log_messages?}`;
WebSocket 默认 `route_key:type`、`log_messages:errors`。**改变 target 类型/
绑定可能需要有意识的删建**,不是原子重命名。

- `allowed_authorizers`:省略/null 继承,`[]` 拒绝所有,具体名称替换祖先。
- repo 的 `authz_gates`:省略/null 表示不管理(push 不发送该字段);`[]` 声明
  本地无门禁但仍保留祖先,除非 `override_permissions:true`。两个 override
  默认 false。`overrides` 省略/null 不管理,显式 `{}` 清空;非空旧
  `required_permissions` 拒绝。[端点认证](../auth/endpoints.md)描述**不同的
  API 三态**:API 的 gate null 是明确的"继承"。
- 系统 login/register 不拉取且受保护;代理挂载无法表示——pull 警告并跳过,
  push 保留服务端 proxy;引用已删除脚本的 WebSocket 无法序列化,同样跳过/
  保护到控制台修复。
- 分支目录不编码全部分支契约/认证字段:**pull 不是任意树状态的无损 dump**;
  删除分支可能级联子孙,镜像前必须检查。

## 触发器文件参考

普通 trigger target 为 `{kind:script,name:<限定路径>}` 或
`{kind:workflow,name:<限定路径>}`;仅计划任务还支持
`{kind:endpoint,method,path}`。引用的资产/资源必须已存在。

| 文件 | 完整顶层字段/默认 |
| --- | --- |
| `schedules/*.yaml` | 必填 `name`、`trigger`、`target`;默认 `inputs:null`、`enabled:true`、`on_overlap:skip`(`skip\|queue\|parallel`)、可选 `queue_cap`(仅 queue)、`max_attempts:1`、`retry_backoff_secs:60`、`catch_up:true` |
| `watches/*.yaml` | 必填 `name`、`source`、`target`;默认 `on:[created,modified]`、`filter:{}`、`timing:{}`、`inputs:null`、`enabled:true` |
| `queue-triggers/*.yaml` | 必填 `name`、`resource`(AMQP)、`queue`、`target`;默认 `max_concurrent_runs:1`、`ack_deadline_override:false`、`inputs:{}`、`enabled:true` |
| `ws_triggers/*.yaml` | 必填 `name`、`config`;`enabled:true`;config 的 routes 从消息类型映射脚本路径,不是服务端 ID |
| `im/accounts/*.yaml` | 必填 `name`、`platform`、`resource`;默认 `enabled:true`、`groups:[]`、`meta:null`;没有 credentials 字段 |
| `im/triggers/*.yaml` | 必填 `name`、`platform`、`target`;默认 `enabled:true`,可选 `account`、`account_groups:[]`、`chat_type:any`、可选 `keyword`、`require_mention:false`、`inputs:null`、`max_concurrent_runs:4`、`identity_mode:off`,可选 `identity_key`/`identity_rule`/`identity_prompt` |

- 计划 trigger:`{kind:cron,cron,timezone?}`(IANA 时区)、
  `{kind:interval,every_secs}`、`{kind:once,at}`(RFC3339)。
- watch 的 `source:{path,recursive:true,max_depth?}`:path 是**服务器绝对
  路径**,且必须位于 `VIAT_WATCH_ROOTS` 内;filter 支持 include/exclude 列表
  与 min/max size;timing 默认 `settle_secs:5`、`reconcile_secs:300`、
  `max_fires_per_tick:50`、`max_concurrent_runs:4`、`max_entries:20000`。
- WS config 默认 `idle_timeout_secs:120`、`hold:single`、`max_concurrent:1`、
  `queue_capacity:1000`、`on_overflow:disconnect`、`log_messages:errors`;
  完整嵌套配置由服务器校验。
- 省略 IM account 表示该平台多账号汇入,不是自动选"当前账号"。

```yaml
name: fixture-interval
trigger: {kind: interval, every_secs: 3600}
target: {kind: script, name: hello}
inputs: {name: Reader}
enabled: false
```

> [!WARNING]
> 示例有意 `enabled: false`:创建/启用 trigger 后,可能无需额外 HTTP 就会
> 执行代码。只有资源凭据型聊天账号可往返;行秘密/二维码绑定账号留在服务
> 端,缺失不代表可删除;账号秘密属于资源,不在 `im/` YAML 里。

## 真实 push 顺序与删除范围

`viat push` 对支持裁剪的阶段**已经是镜像模式**,没有 `push --prune`。各阶段
串行执行,不在同一事务:

1. 元数据/版本保护与 pending authz steps;角色 → 认证器 → 模型,并新增/
   扩展 scope claims。
2. 非 library 资源,secret 先于依赖它的 config。
3. 资源对账后移除 scope claims。
4. 脚本,然后工作流。
5. schedules → watches → queue → WS → 聊天账号,然后聊天触发器。
6. 端点、项目 crate,最后是 library 资源。

模型添加按"主体/类型/属性/动作先于规则";裁剪按逆依赖顺序(规则先于属性/
动作/类型/主体)。引用保护与委托归属可能报告跳过——不保证最终完全相等。
元数据的认证器/角色可裁剪,但受内置项/引用保护。**脚本、工作流、资源只
upsert:删除文件不会删除服务器资产。**

schedule/watch/queue 目录不存在则跳过,但**目录存在且为空会镜像删除**服务
器端条目;WS trigger、可同步的 IM 账号/触发器即使目录不存在也可能被裁剪
——残缺 checkout 不得全量 push。端点裁剪发生在遍历过的树/父节点内,该处
缺叶/分支即删除(前述保护项保留);不能推断未遍历的服务端树会被全局删除。
`crate/` 不存在表示不管理;存在但为空会镜像清空服务端可管 crate。crate 仅
发送允许路径(Cargo/lock/build/toolchain、`src/` 但不含 `src/bin/`、Rust
test/bench/example),跳过隐藏/target/不支持文件。

## pull 是覆盖,不是通用本地清理

pull 把远端草稿写到本地对应路径、替换 `viat.yaml`、记录 authz 版本。它
**一般不删除**过时的本地脚本/工作流/资源/触发器/端点——服务端已删除的
文件可能残留,并在下次 push 时复活。**crate 是例外**:pull 会删除远端不
存在的可推送 crate 文件(保留不支持文件/构建输出),不能把这一行为推广到
其他集合。

`--only` 选 kind:`meta,resources,scripts,workflows,schedules,watches,
queue_triggers,ws_triggers,chat,endpoints,crate`——它是类别选择,不是文件
过滤;未知字符串可能被静默排除,注意拼写。筛选 push 会报告未推送的漂移与
待发布项;`--json` 可能跟在人类可读的阶段输出之后,不保证单一纯 JSON 流。

## Authz 迁移及 push 保护

`authz/migrations/<id>.yaml`(也接受 `.yml`)是非空操作列表,按文件 stem 作为
ID 排序,checksum 固定已应用的文本。未执行的改名示例:

```yaml
- rename_type: {from: report, to: document}
- rename_action: {type: document, from: read, to: view}
```

支持的操作:`rename_type:{from,to}`、`rename_attr:{type,from,to}`、
`rename_action:{type,from,to}`、`rename_subject_attr:{from,to}`、
`set_origin:{origin,where:in_file|not_in_file}`、
`delete_type:{name,cascade:false}`。最终 `viat.yaml` 必须一致;已应用的
ID/checksum 不能改写历史,纠正一律用新 step。pending steps 在模型镜像前
执行,删除保护先针对其预计结果计算。

`--force-authz` 覆盖"服务器模型自本 checkout 上次看到后已变更"的拒绝;
`--yes` 批准类型/属性/动作/主体/角色的删除,**不是**所有破坏性同步的总确认;
只删 platform 规则属于普通镜像。版本记录在本地
`.viat/authz-versions.json`,按服务器/项目/规范 checkout 路径区分,pull/push
时更新;部分失败的 push 也可能已更新模型版本——不保证回滚。再次强调:省略
authz 是"不管理",显式空 authz 是"裁剪",两者不同。

## 导出/导入差异与恢复

`viat export` 先拉到 staging 再打包 gzip-tar 的 `.viatpkg`:不是任意 CWD 的
文件归档,也不是数据库/文件字节/密钥的备份。`viat import demo.viatpkg --as
cli-demo-copy` 在目标项目缺失时创建、否则更新,不改变当前选择。

- 默认 import 是**无裁剪 upsert**:只添加 scope claims、合并 crate,不执行
  checkout 的模型保护/迁移步骤。
- `--prune` 显式启用支持的镜像删除;`--update-resources` 才会更新默认整体
  保持的已有含秘密资源——避免源环境连接覆盖目标环境。
- 新资源缺 secret 时**跳过并汇总**(不同于正常 push 的硬失败)。目标秘密
  另行配置;skipped/kept 汇总不证明部署完整。

push 前:核对完整 checkout、服务器/项目、diff、陈旧文件、委托规则与破坏性
类别。push 后:检查逐阶段/skipped/待发布输出,独立执行预期的 DB 迁移,查看
[发布计划](../cli/publish.md)并明确发布。中途失败会保留先前写入(远端与
本地 pull),用备份主动恢复/对账——端点回滚撤销不了实时设置/模型/触发器的
变更。隔离 bundle 检查后再本地删除;远端删除/撤销另行批准,不要假设存在
项目级 DELETE 路由。

## 核验依据

契约源码 `03751a67`:`crates/viat-cli/src/commands/{sync.rs,bundle.rs}`、`crates/viat-cli/src/repo/{viat_yaml.rs,resources.rs,endpoints.rs,schedules.rs,watches.rs,queue_triggers.rs,ws_triggers.rs,im.rs,crate_files.rs,authz_steps.rs,model_guard.rs}`、API DTO 与权限实现。旧注释仍写 `!secret`、笼统"镜像"甚至缺少 project GET;实际是 `$secret`、按集合的专用裁剪与 `GET /projects/{slug}`——本页遵循代码而非注释。本页未运行 CLI、网络、触发器、迁移、提供方或测试。
