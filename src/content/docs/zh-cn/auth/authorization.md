---
title: "授权模型、门禁与行范围"
description: "类型、属性、规则 AST、主体来源、租户隔离及委托规则所有权。"
doc_id: auth.authorization
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# 授权模型、门禁与行范围

认证不等于业务授权。Viat 的项目授权模型由资源**类型**、对象**属性**、**动作**、声明的主体事实以及 permit/forbid **规则**组成。旧权限字符串目录已退役，非空 `permissions`/`required_permissions` 不是规则的替代方案。

## 谁能管理模型

控制台/平台凭据使用 `/projects/{slug}/authz`，要求项目编辑者（`owner`、`admin`、`developer`）。项目凭据使用 `/p/{slug}/_authz`，要求项目管理员，但不会获得平台成员身份。两者共享模型校验，规则归属不同。基础路径 `GET` 返回 `{types,rules,subject_attrs,version}`，每个 type 项为 `{type,attrs,actions}`。`GET .../lint` 检查覆盖/依赖问题，不证明所有业务决策都正确。

类型/属性/动作/主体逻辑名称为 1–64 字节，仅 ASCII 字母数字和 `_ - . :`，用于 URL 路径段。物理表/列名有独立标识符校验。不要在逻辑名称中使用斜线/空格。

## 模型管理输入

除特别说明外，下列后缀适用于两个基础路径。示例均**源码推导、未执行**；只在隔离项目 `demo` 操作，不要用生产用户属性实验。

| 方法和后缀 | 完整请求体/更新规则 |
| --- | --- |
| `POST /types` | `{name,cross_tenant?}`，布尔默认 false |
| `GET /types`、`GET /types/{name}` | 类型列表及详情 |
| `POST /types/{name}/rename` | `{name}`，保留引用的正式改名操作，不是删建 |
| `PUT /types/{name}/tenancy` | `{tenant_attr?,tenant_subject?,tenant_bypass?}`，替换租户指定；省略/null 移除指定/绕过覆盖，不是局部保持 |
| `POST /types/{name}/attrs` | `{name,kind,column_name?,rel_table?,rel_local_fk?,rel_ref_col?,rel_col?,is_set?}`，`kind` 为 `local`/`rel`，`is_set` 默认 false |
| `POST /types/{name}/actions` | `{name}` |
| `POST /subject-attrs` | `{name,source,from_key?,ty,is_set?}`，`is_set` 默认 false |
| `PUT /subject-attrs/{name}/tenant_bypass` | `{tenant_bypass:predicate-or-null}`，省略/null 清除维度默认 |
| `POST /rules` | `{type,action,effect,expr,descr?}`，`effect` 为 `permit`/`forbid`，描述可省略/null |
| `DELETE /rules/{id}` | 删除该规则，受归属检查限制 |
| `DELETE /types/{name}`、`/types/{name}/attrs/{attr}`、`/types/{name}/actions/{action}`、`/subject-attrs/{name}` | 依赖保护可能拒绝；先迁移/移除引用 |

`local` 属性指定 `column_name`；`rel` 必须指定 `rel_table`、`rel_local_fk`、`rel_ref_col`、`rel_col`，表示本地 FK 到父表的跳转，编译为相关存在性谓词，不是任意 SQL 片段。`is_set` 应匹配建模值，会影响合法的成员运算。创建接口不提供每个属性的通用局部更新，需有意识迁移引用。

创建顺序示例（向 `/projects/demo/authz` 下对应路径 POST）：

```json
{"name":"role","source":"role","ty":"text"}
```

```json
{"name":"report","cross_tenant":true}
```

再向 `/types/report/actions` 提交 `{"name":"read"}`，向 `/rules` 提交：

```json
{"type":"report","action":"read","effect":"permit","expr":{"subj_only":{"subj":"role","op":"eq","lit":"reader"}},"descr":"Fixture readers may read reports"}
```

先建主体、类型、动作，再建引用它们的规则。这里的 `cross_tenant:true` **不是**租户隔离配方，多租户上线前必须完成下方隔离配置。

## 主体属性

`ty` 为 `text`、`int`、`uuid`；`is_set:false` 表示标量，true 表示集合。事实来自已验证 principal，不来自普通请求输入：

| `source` | `from_key`/取值 |
| --- | --- |
| `claim` | 已验证外部令牌 claim 的键 |
| `meta` | 项目用户 metadata 的键 |
| `role` | 当前项目业务角色，无需键 |
| `identity` | 项目身份字符串，无需键 |
| `user_id` | 项目用户 UUID，使用 `ty:uuid`，无需键 |
| `admin` | 有效项目管理员状态，文本 `"true"`/`"false"`，不是 JSON boolean，无需键 |
| `const` | `from_key` 中编码的常量 |

缺失/类型错误不是通配符，组装主体会省略不可用值。匿名/系统上下文不会自动拥有终端用户 metadata。`system:scheduler` 是计划执行的内置角色，应针对实际执行上下文写规则，不能默认继承创建人的权限。

只有用户不能随意修改安全 metadata 时，来自 metadata 的租户才可信。针对攻击者可写 `meta.school_id` 的规则即使语法正确，也不是隔离。用户/角色 `is_admin` 控制管理入口；业务数据访问仍需显式规则，包括预期的跨租户绕过。

## 规则 JSON 语法

`expr` 是外部标签 AST，不是字符串表达式、Cedar 程序或 SQL：

```json
{"all":[{"subj_only":{"subj":"role","op":"eq","lit":"reader"}},{"obj":{"attr":"owner","op":"eq","subj":"uid"}}]}
```

支持节点：

- `{"all":[...]}`、`{"any":[...]}`、`{"not":<node>}`。
- `{"obj":{"attr":"owner","op":"eq","subj":"uid"}}`，或将 `subj` 换成 `lit`；右操作数必须二选一。
- `{"subj_only":{"subj":"role","op":"eq","lit":"reader"}}`。
- `{"is_null":{"attr":"deleted_at","negated":false}}`，false 默认表示 IS NULL，true 表示 IS NOT NULL。省略属性不等于显式 JSON null。

运算符：`eq`、`in`、`lt`、`lte`、`gt`、`gte`、`like`、`ilike`。字面量为文本或有符号整数，不接受布尔/对象。`in` 对声明的集合做成员判断（subject-only 预设检查 literal 是否在主体集合中）；两个标量用 `eq`。类型/形状错误和未知引用是错误，不会隐式转换或放行。`like`/`ilike` 使用 SQL LIKE 通配符。

默认拒绝：至少一个 permit 匹配，匹配的 forbid 覆盖 permit。缺少必要事实/属性不得扩大权限。不能通过提交空/残缺对象逃避 forbid；构造不出安全行范围时拒绝执行，而不是退化为无范围查询。

## 三种执行面

1. **端点门禁**：`authz_gates:[{type,action}]` 在运行前检查仅主体权限。沿祖先累积，遇 `override_permissions` 停止。依赖行属性的 permit 不能证明可通过仅主体门禁。
2. **单对象检查**：`ctx.authz.check(type, action, attrs)` 判断提供的对象。传入对象的真实可信属性，不要直接信任请求体。代码必须在执行操作前处理检查结果。
3. **行范围**：CRUD `authz_type` 及支持的数据库资源 `authz_tables` 把相同模型降为每请求谓词。可写 `"reports":"report"` 或 `{"type":"report","actions":{"read":"list"}}`，动作映射只改变隐含 action。连接/overlay 配置见已有资源参考。仅仅存在模型，不会让任意直接 SQL 自动受行范围保护。

项目 `scope_claims` 是另一套供 `$claim.<name>` 默认值/策略使用的身份参数声明：`{name,type,source,from?}`，`type` 为 `uuid|text|int`，`source` 为 `meta|token`。它不是授权 `subject_attrs`，也不是 OAuth scope。引用缺失/类型错误的 claim 失败关闭，未声明 claim 在更早校验中失败。[项目设置](../projects/settings.md)定义更新/重置语义。

## 租户隔离与绕过

类型默认 `cross_tenant:false`，但只有同时指定 **`tenant_attr`**（对象的 local 属性）和 **`tenant_subject`**（已声明主体租户属性）才注入隔离。仅默认 false 不会自动识别租户列。标量主体使用等值，集合支持成员判断。隔离添加跨租户 forbid，因此宽泛 permit 不能越过它。

维度默认 `PUT .../subject-attrs/schools/tenant_bypass`：

```json
{"tenant_bypass":{"subj":"role","op":"eq","lit":"admin"}}
```

类型指定 `PUT .../types/report/tenancy`：

```json
{"tenant_attr":"school","tenant_subject":"schools","tenant_bypass":false}
```

bypass 使用**无额外 AST 包装**的 `{subj,op,lit}`，只允许 `eq`/`in`。类型上省略/null 继承维度默认，对象覆盖默认，JSON false 明确禁止该类型绕过。主体维度 null 清除默认。bypass 只是移除匹配调用者的租户隔离，本身不是 permit。`cross_tenant:true` 明确取消隔离，不要用它消除多租户拒绝测试。

## 规则归属与仓库安全

控制台/CLI 模型接口创建 `origin:platform`，`_authz` 创建 `origin:delegated`。`viat pull` 不导出 delegated 规则；`viat push` 不写入/裁剪它们，并保护其依赖类型/动作。控制台删除 delegated 规则须显式交接（`PUT /projects/{slug}/authz/rules/{id}/origin`，`{origin:"platform"}`）、在委托侧删除或使用明确的强制删除支持；不在 YAML 中不代表过时。这不是第二套策略引擎，两种来源都参与决策。

[仓库同步](../projects/repo-sync.md)说明版本/删除保护和 `authz/migrations/`。回滚端点快照不回滚实时模型/用户 metadata，需协调模型修改和发布。

## 必做的拒绝验证

用隔离用户验证：错误角色拒绝；同角色跨租户拒绝；缺租户 claim 拒绝；null 与省略对象属性不应意外放行；forbid 覆盖 permit；伪造请求 `role`/`is_admin` 无效；认证器有效但不在发布列表中仍拒绝；Developer 不能改 Owner/Admin 专属设置；委托管理员不能变成平台编辑者。每次修改后检查 lint 与审计。清理可能受引用阻挡，先删测试规则，再在依赖解除后删动作/属性/类型及主体属性。

本页仅源码验证，未运行策略运行时、数据库、提供方、CLI 或集成测试。**依据：** `crates/viat-policy/src/lib.rs`、`crates/viat-core/src/types/authz.rs`、`crates/viat-api/src/{handlers/authz_admin.rs,handlers/authz_console.rs,authz_decision.rs}`、`crates/viat-db/src/endpoints.rs`、`crates/viat-cli/src/repo/viat_yaml.rs`。
