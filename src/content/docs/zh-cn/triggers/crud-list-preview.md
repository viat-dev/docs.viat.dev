---
title: "CRUD分页列表与固定列搜索（预览）"
description: "显式启用page分页、授权后总数和固定搜索配置，不改变旧CRUD列表。"
doc_id: triggers.crud-list-preview
verified_release: 'unreleased'
channel: preview
contract_ids: []
---

这是基于[CRUD端点](crud.md)的未发布扩展。已有列表继续接受 `limit` / `offset` 并返回数组，除非已发布配置明确启用page模式。这不是脚本端点的自动迁移。

## 配置

在list端点的 `crud_config` 中添加以下字段：

| 字段 | 默认值与规则 |
| --- | --- |
| `pagination` | 省略/null保留旧数组契约。`"page"` 接受 `page` / `page_size`，返回 `{items,total}`。拒绝其他值。 |
| `search` | 省略/null关闭搜索。对象包含 `param`、非空且不重复的 `columns`，以及可选 `op`（默认ilike；仅允许like或ilike）。列必须是已映射的text/varchar列，不接受JSON、数值、枚举或时间列。拒绝未知search字段。 |
| `filters.<name>.skip_empty` | 默认false。为true时，在类型转换前忽略值恰好为空字符串的过滤。空白不等于空字符串，null也不等于空字符串。不显式配置就保持既有过滤行为。 |

三项能力都只适用于list。搜索也可用于旧数组列表。搜索参数名必须是裸标识符，不能与filters或保留参数冲突。`limit` / `offset` 始终保留；`page` / `page_size` 仅在page模式下保留，因此旧模式中同名的过滤参数继续工作。

page模式要求非空的固定 `order_by`。请加入唯一的次级排序键，例如全部主键列，保证翻页边界确定；非空排序本身并不保证唯一性。page模式还要求 `limit.default` 为正、`limit.default <= limit.max`、`limit.max` 不超出有符号64位整数范围。既有limit对象仍默认 `{default:50,max:200}`，并非新增不可配置的200行硬上限。

若映射中存在名为 `<table>_aggregate` 的真实表，它会遮蔽引擎合成的聚合入口。这种冲突会阻止发布page模式，执行时也会根据实时引擎schema重新检查。启用前必须通过资源schema/overlay解决冲突。

## 请求与响应

对于 `pagination: "page"`：

- `page` 是正整数，默认1。
- `page_size` 是正整数，默认 `limit.default`；超过 `limit.max` 时先夹到上限，再按实际页大小计算offset。
- 零、负数、小数、非法或超出范围的整数，以及offset乘法溢出，返回 `400 bad_request`。这刻意不同于Python式 `value or default` 对零的处理。
- 此模式不将limit/offset当作另一套分页输入。未知输入仍返回400。
- `items` 只包含该页选定的列；`total` 是分页前匹配且获授权的行数，不是本页长度。超过末页时，可以返回空items和非零total。

搜索值必须是字符串。运行时绑定 `%<value>%`，在指定列间OR，再与声明的filters作AND。空搜索字符串被忽略，不做trim。like与ilike分别按数据库后端的文本匹配行为执行区分大小写与不区分大小写的匹配。`%` / `_` 保留LIKE通配符含义：这是包含模式匹配，不是转义后的字面量子串搜索。请求值不能选择SQL标识符、运算符或表达式。

[HTTP参数声明](http.md)仍先执行：HTTP类型转换可能在CRUD的skip_empty之前拒绝空字符串，strict:true也要求声明每一个允许的query公开名称。如果as将公开参数名绑定成另一参数名，CRUD filter/search应配置绑定后的名称。请检查从脚本包装继承的别名，不要直接照抄。

## 示例形状

以下配置片段仅作说明、尚未执行；前提是资源已暴露这些表和列，并且入口及行级授权经过审查：

```json
{
  "table": "catalog",
  "op": "list",
  "pagination": "page",
  "columns": ["id", "title", "code"],
  "limit": {"default": 20, "max": 200},
  "order_by": [
    {"column": "updated_at", "dir": "desc"},
    {"column": "id", "dir": "desc"}
  ],
  "search": {
    "param": "q",
    "columns": ["title", "description", "code"],
    "op": "ilike"
  },
  "filters": {
    "category": {"column": "category", "op": "eq", "skip_empty": true}
  }
}
```

保存并发布该配置的端点后，形如 `GET /p/demo/catalog?q=sample&page=2&page_size=20` 的请求获取第二页，并使用相同搜索条件计算total。OpenAPI描述已发布模式；只编辑草稿不会改变公开响应，直到重新发布。Console的CRUD JSON编辑器及创建表单的高级配置保留这些字段。CLI端点YAML通过 `target.config` 携带它们；使用配套更新的CLI，确保diff/push等价比较正确。

## 授权、开销与验证边界

分页行与不分页聚合两个root放在同一次GraphQL操作中，完整经过既有scoped引擎路径。二者共享请求过滤与本次解析的行级策略，count不是另开的无授权查询。PostgreSQL下，引擎生成一个SQL SELECT，因此数据读取共享语句快照。授权模型单独加载，不意味着模型编辑和业务数据读取处于跨库原子快照。

计数可能扫描远多于返回页的行。分页上限不限制count的工作量，仍受既有执行超时约束。caller级响应缓存保持原语义，可以返回稍早的完整信封；缓存命中不代表重新求值实时规则。本扩展不增加写入驱动的自动缓存失效。

迁移前应在隔离fixture中对照脚本与CRUD：每个搜索列、大小写与通配符、空串/空白过滤、分页边界、夹限、同值排序、越界空页，以及两个身份各自可见的行。还要验证实时deny规则和草稿/已发布配置的区别。这些测试不证明生产性能或全部外部调用兼容。写入授权、数据库默认值、未知body字段和任意响应变换仍是独立的迁移问题，本扩展不放宽它们。
