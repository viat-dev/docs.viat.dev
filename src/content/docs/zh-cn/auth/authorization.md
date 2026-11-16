---
title: "授权模型、门禁与行范围"
description: "类型、属性、规则 AST、主体来源、租户隔离及委托规则所有权。"
doc_id: auth.authorization
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# 授权模型、门禁与行范围

认证回答"是谁",授权回答"能做什么"——两件事分开。Viat 的项目授权模型由
资源**类型**、对象**属性**、**动作**、声明的主体事实与 permit/forbid
**规则**组成。旧的权限字符串目录已退役:非空的
`permissions`/`required_permissions` **不是**规则的替代。

## 谁能管理模型

- 控制台/平台凭据走 `/projects/{slug}/authz`,要求项目编辑者
  (`owner`/`admin`/`developer`)。
- 项目凭据走 `/p/{slug}/_authz`,要求项目管理员——但**不会**获得平台成员
  身份。两个入口共享模型校验,规则归属不同。
- 基础路径 `GET` 返回 `{types,rules,subject_attrs,version}`,每个 type 项
  为 `{type,attrs,actions}`;`GET .../lint` 检查覆盖/依赖问题——**不证明**
  所有业务决策正确。

命名规则:类型/属性/动作/主体逻辑名 1–64 字节,仅 ASCII 字母数字与
`_ - . :`(用于 URL 路径段);物理表/列名有独立校验;逻辑名里不要用斜线/
空格。

## 模型管理输入

除特别说明外,下列后缀适用于两个基础路径。示例均**源码推导、未执行**;
只在隔离项目操作,不要拿生产用户属性实验。

| 方法和后缀 | 完整请求体/更新规则 |
| --- | --- |
| `POST /types` | `{name,cross_tenant?}`,布尔默认 false |
| `GET /types`、`GET /types/{name}` | 类型列表与详情 |
| `POST /types/{name}/rename` | `{name}`;保留引用的正式改名,不是删建 |
| `PUT /types/{name}/tenancy` | `{tenant_attr?,tenant_subject?,tenant_bypass?}`;替换租户指定,省略/null 是**移除**指定/绕过覆盖,不是局部保持 |
| `POST /types/{name}/attrs` | `{name,kind,column_name?,rel_table?,rel_local_fk?,rel_ref_col?,rel_col?,is_set?}`;`kind` 为 `local`/`rel`,`is_set` 默认 false |
| `POST /types/{name}/actions` | `{name}` |
| `POST /subject-attrs` | `{name,source,from_key?,ty,is_set?}`;`is_set` 默认 false |
| `PUT /subject-attrs/{name}/tenant_bypass` | `{tenant_bypass:谓词或null}`;省略/null 清除维度默认 |
| `POST /rules` | `{type,action,effect,expr,descr?}`;`effect` 为 `permit`/`forbid`,描述可省略 |
| `DELETE /rules/{id}` | 删除该规则,受归属检查限制 |
| `DELETE /types/{name}`、`/types/{name}/attrs/{attr}`、`/types/{name}/actions/{action}`、`/subject-attrs/{name}` | 依赖保护可能拒绝;先迁移/移除引用 |

属性语义:`local` 指定 `column_name`;`rel` 必须指定 `rel_table`、
`rel_local_fk`、`rel_ref_col`、`rel_col`(本地 FK 到父表的跳转,编译为
相关存在性谓词,**不是**任意 SQL 片段)。`is_set` 要与建模值一致,影响
合法的成员运算。创建接口没有"每属性局部更新”——引用要有意识地迁移。

创建顺序示例(向 `/projects/demo/authz` 下对应路径 POST):

```json
{"name":"role","source":"role","ty":"text"}
```

```json
{"name":"report","cross_tenant":true}
```

再向 `/types/report/actions` 提交 `{"name":"read"}`,向 `/rules` 提交:

```json
{"type":"report","action":"read","effect":"permit","expr":{"subj_only":{"subj":"role","op":"eq","lit":"reader"}},"descr":"Fixture readers may read reports"}
```

顺序:先主体、类型、动作,再引用它们的规则。示例里的 `cross_tenant:true`
**不是**租户隔离配方——多租户上线必须完成下文的隔离配置。

## 主体属性

`ty` 为 `text`/`int`/`uuid`;`is_set:false` 为标量,true 为集合。事实来自
**已验证的 principal**,不是普通请求输入:

| `source` | `from_key`/取值 |
| --- | --- |
| `claim` | 已验证外部令牌 claim 的键 |
| `meta` | 项目用户 metadata 的键 |
| `role` | 当前项目业务角色(无需键) |
| `identity` | 项目身份字符串(无需键) |
| `user_id` | 项目用户 UUID,用 `ty:uuid`(无需键) |
| `admin` | 有效项目管理员状态;文本 `"true"`/`"false"`,**不是** JSON 布尔(无需键) |
| `const` | `from_key` 中编码的常量 |

- 缺失/类型错误**不是通配符**:组装主体会省略不可用值;匿名/系统上下文
  不会自动拥有终端用户 metadata。
- `system:scheduler` 是计划执行的内置角色——规则要针对**实际执行上下文**
  写,不能默认继承创建人的权限。
- **metadata 租户只有在用户不能随意修改安全 metadata 时才可信**:针对
  攻击者可写 `meta.school_id` 写的规则,语法再正确也不是隔离。
- 用户/角色 `is_admin` 只控制管理入口;业务数据访问仍需显式规则,包括
  预期的跨租户绕过。

## 规则 JSON 语法

`expr` 是外部标签 AST——不是字符串表达式、Cedar 程序或 SQL:

```json
{"all":[{"subj_only":{"subj":"role","op":"eq","lit":"reader"}},{"obj":{"attr":"owner","op":"eq","subj":"uid"}}]}
```

支持的节点:

- `{"all":[...]}`、`{"any":[...]}`、`{"not":<node>}`。
- `{"obj":{"attr":"owner","op":"eq","subj":"uid"}}`(`subj` 可换 `lit`,
  右操作数必须二选一)。
- `{"subj_only":{"subj":"role","op":"eq","lit":"reader"}}`。
- `{"is_null":{"attr":"deleted_at","negated":false}}`——false(默认)= IS
  NULL,true = IS NOT NULL;**省略属性 ≠ 显式 JSON null**。

运算符:`eq`、`in`、`lt`、`lte`、`gt`、`gte`、`like`、`ilike`(SQL LIKE
通配符)。字面量为文本或有符号整数——不接受布尔/对象。`in` 对声明的集合
做成员判断(subject-only 语义是"literal 是否在主体集合中");两个标量用
`eq`。类型/形状错误与未知引用都是错误——**不会**隐式转换或放行。

判定语义:**默认拒绝**;至少一个 permit 匹配才通过;匹配的 forbid 覆盖
permit。缺少必要事实/属性不得扩大权限;不能用空/残缺对象逃避 forbid;
**构造不出安全行范围时拒绝执行**,而不是退化为无范围查询。

## 三种执行面

1. **端点门禁**:`authz_gates:[{type,action}]` 在运行前做**仅主体**检查;
   沿祖先累积,遇 `override_permissions` 停止。依赖行属性的 permit 不能
   证明能通过仅主体门禁。
2. **单对象检查**:`ctx.authz.check(type, action, attrs)` 判断提供的对象
   ——传入对象**真实可信**的属性,不要直接信任请求体;代码必须在执行操作
   前处理检查结果。
3. **行范围**:CRUD `authz_type` 与受支持数据库资源的 `authz_tables` 把
   同一模型降为每请求谓词。可写 `"reports":"report"` 或
   `{"type":"report","actions":{"read":"list"}}`(动作映射只改变隐含
   action);连接/overlay 配置见各资源参考。**模型存在不会让任意直接
   SQL 自动受行范围保护。**

项目 `scope_claims` 是另一套东西:供 `$claim.<name>` 默认值/策略使用的
身份参数声明 `{name,type,source,from?}`(`type` 为 `uuid|text|int`,
`source` 为 `meta|token`)。它**不是**授权 `subject_attrs`,也不是 OAuth
scope;引用缺失/类型错误的 claim 失败关闭,未声明 claim 在更早的校验失败。
更新/重置语义见[项目设置](../projects/settings.md)。

## 租户隔离与绕过

- 类型默认 `cross_tenant:false`,但**只有同时指定 `tenant_attr`(对象的
  local 属性)和 `tenant_subject`(已声明的主体租户属性)才会注入隔离**;
  仅默认 false 不会自动识别租户列。标量主体用等值,集合支持成员判断。
  隔离会添加跨租户 forbid——宽泛 permit 越不过它。

维度默认(`PUT .../subject-attrs/schools/tenant_bypass`):

```json
{"tenant_bypass":{"subj":"role","op":"eq","lit":"admin"}}
```

类型指定(`PUT .../types/report/tenancy`):

```json
{"tenant_attr":"school","tenant_subject":"schools","tenant_bypass":false}
```

- bypass 用**无额外 AST 包装**的 `{subj,op,lit}`,只允许 `eq`/`in`。
  类型上省略/null 继承维度默认;对象覆盖默认;JSON `false` 明确禁止该类型
  绕过;主体维度 null 清除默认。
- **bypass 只移除匹配调用者的租户隔离,本身不是 permit**;
  `cross_tenant:true` 是明确取消隔离——不要用它"消除"多租户拒绝测试。

## 规则归属与仓库安全

- 控制台/CLI 模型接口创建 `origin:platform`;`_authz` 创建
  `origin:delegated`。
- `viat pull` **不导出** delegated 规则;`viat push` 不写入/裁剪它们,并
  保护其依赖的类型/动作。控制台删除 delegated 规则需要显式交接
  (`PUT /projects/{slug}/authz/rules/{id}/origin`,body `{origin:"platform"}`)、
  在委托侧删除,或使用明确的强制删除支持——**不在 YAML 里不代表过时**。
- 这不是第二套策略引擎:两种来源都参与决策。

[仓库同步](../projects/repo-sync.md)说明版本/删除保护与
`authz/migrations/`。回滚端点快照**不回滚**实时模型/用户 metadata——模型
修改与发布要协调。

## 必做的拒绝验证

用隔离用户验证:错误角色拒绝;同角色跨租户拒绝;缺租户 claim 拒绝;null
与省略的对象属性不意外放行;forbid 覆盖 permit;伪造请求 `role`/`is_admin`
无效;认证器有效但不在发布列表仍拒绝;Developer 改不了 Owner/Admin 专属
设置;委托管理员变不成平台编辑者。每次修改后查 lint 与审计。清理可能被
引用阻挡:先删测试规则,依赖解除后再删动作/属性/类型与主体属性。

## 核验依据

契约源码 `03751a67`:`crates/viat-policy/src/lib.rs`、`crates/viat-core/src/types/authz.rs`、`crates/viat-api/src/{handlers/authz_admin.rs,handlers/authz_console.rs,authz_decision.rs}`、`crates/viat-db/src/endpoints.rs`、`crates/viat-cli/src/repo/viat_yaml.rs`。本页仅源码验证,未运行策略运行时、数据库、提供方、CLI 或集成测试。
