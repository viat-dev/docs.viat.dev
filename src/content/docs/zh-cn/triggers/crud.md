---
title: "PostgreSQL CRUD 端点"
description: "用冻结 REST 契约和实时授权范围安全开放数据表。"
doc_id: triggers.crud
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# PostgreSQL CRUD 端点

CRUD 是原生端点目标，不是生成脚本或通用数据库浏览器。仅支持 **postgresql 资源**，使用 overlay 后暴露的表/列名称。每个叶子只做一种操作，沿用端点 authorizer、gate、限速和日志。创建/编辑需内容编辑权限，发布需发布权限；调用者必须同时满足已发布路由权限与行级授权。前提是资源 schema 已刷新映射、表存在，主键操作有主键，写入具有明确行范围策略。

## 创建与调用

下例从源码推导、未执行：隔离数据库有 `books(id,title)`，项目资源为 `db`，公开 authorizer 实际名为 `public`。

```http
POST /projects/demo/endpoints
Content-Type: application/json
Authorization: Bearer <console-token>

{"segment":"books","method":"GET","crud_resource_name":"db","crud_config":{"table":"books","op":"list","columns":["id","title"],"filters":{"title":{"column":"title","op":"ilike"}},"order_by":[{"column":"id","dir":"asc"}],"limit":{"default":50,"max":200}},"allowed_authorizers":["public"]}
```

`GET …/endpoints/<id>` 返回普通端点视图，包含 `crud_resource_name:"db"`、提交的 `crud_config`、`method:"GET"`、`path:"/books"`、`script_name:null`、`workflow_name:null`，开始时没有发布快照。先 `POST …/endpoints/<id>/publish {}`，再调用 `/p/demo/books?title=%25guide%25&limit=20&offset=0`。数据来自真实表，空列表不等于授权错误。完整端点视图与公共字段见 [HTTP](http.md)。

| 操作 | 方法 | 路径要求 | 结果 |
| --- | --- | --- | --- |
| `list` | GET | 集合 | 所选列的行数组。 |
| `get_by_pk` | GET | 每个主键列对应同名 `:column` | 单行或 404。 |
| `insert` | POST | 集合 | 插入后的所选行。 |
| `update_by_pk` | PATCH | 全部主键列 | 更新行或 404。 |
| `delete_by_pk` | DELETE | 全部主键列 | 删除行或 404。 |

列表成功 body 如 `[{"id":1,"title":"A guide"}]`；get/update/delete 是单行对象，不是单元素数组。主键类型从 schema 冻结并在 dispatch 转换。用树分支或 `path_override` 构建 `/books/:id`；复合主键必须提供所有列名，无主键不能发布主键操作。

## 完整 `crud_config`

拒绝未知顶层 config 字段。`table`、`op` 必填，其余默认如下。

| 字段 | 默认值及规则 |
| --- | --- |
| `columns` | `[]` 表示全部映射列；否则是响应 allowlist。注意新映射敏感列可能被默认暴露。 |
| `filters` | `{}`；仅 list，query 名称 → `{column,op:"eq"}`；支持 `eq,neq,gt,gte,lt,lte,like,ilike`，仅标量，无 `in` 或 null 运算符；未知 query 被拒绝而非忽略。 |
| `order_by` | `[]`；仅 list，固定 `{column,dir:"asc"|"desc"}` 数组，不允许调用者选择排序；未固定顺序时分页不稳定。 |
| `limit` | 省略/null 使用 `{default:50,max:200}`；调用者 limit 被限制到 max，`offset` 是偏移，无无限制写法。 |
| `writable` | `[]` 表示所有映射的非主键列；显式列表缩小写入列；未知或不可写 body 列被拒绝。省略字段不会自动置 null；SQL null 仍须满足表约束/schema。 |
| `defaults` | `{}`；平台填充列 → `$identity`、`$principal`、`$user_id`、`$role`、`$authorizer`、`$project_id`、`$claim.<name>`；不得与 writable 重叠，调用者不能提交这些列；值无法解析时拒绝，不写入 null。 |
| `authz_type` | 省略/null 继承资源表绑定；显式类型对 list/get 使用 `read`、insert 使用 `create`，另有 `update`、`delete`，对应 action 必须存在。继承的 authz_tables 可重映射 action。无允许规则则看不到/写不到行。 |
| `allow_unscoped_writes` | 默认 false；变更操作必须有 authz_type 或资源 authz_tables 绑定，否则发布拒绝。true 是明确的全表逃生口，不是自动授权。 |

`PUT …/endpoints/<id>/info {"crud_config":{…}}` 整体替换配置，省略/null 保持而非清除；替换不会改变目标资源种类。发布检查方法/操作、表/列/filter/order/主键兼容性并冻结解析后的类型。资源凭据、授权绑定和规则仍是 live，旋转凭据/改范围无需发布即可影响调用；运行时重查范围，移除 scope 不会默默开放无范围写入。底层 schema 漂移可能成为引擎错误，应刷新 schema、复查契约并重发，不修改历史快照。

## 限制、恢复与清理

body/query 先按 HTTP 契约绑定，再执行 CRUD 参数限制；平台施加资源凭据和审计 reason 策略。CRUD 同步执行，不支持脚本 hook、任意 join、multipart、workflow 目标、任意 SQL 或 async。GET 仅支持 **caller scope** 缓存；写入不会自动清缓存。认证后的变更支持 dispatch 幂等保护，但插入仍须业务/数据库唯一键。

用隔离 fixture 验证未知 filter、错误主键、缺失行、双租户和拒绝写入。404 可有意隐藏越权行，不应当作瞬态错误重试。引擎/schema 错误应查看资源健康、schema 和日志。超时/丢响应前可能已提交变更，重试前按业务键查询。先取消发布阻止新调用，再处理在途写入，最后删除隔离端点和测试表；删除端点不撤销历史写入。

仓库端点 YAML 使用 `target:{kind:crud,ref:db,config:{…}}`，经 `viat pull/push` 同步；命令见 [CLI endpoint](../cli/endpoint.md)，没有独立 `viat crud` 命令。

维护依据：`crates/viat-core/src/types/crud.rs`；`crates/viat-api/src/handlers/endpoints.rs`、`handlers/snapshots.rs`、`crud_dispatch.rs`；运行时 CRUD 分发与测试。示例源码推导/未执行，未操作数据库或供应商服务。
