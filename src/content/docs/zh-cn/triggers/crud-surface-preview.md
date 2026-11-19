---
title: "CRUD 表面与契约对齐（预览）"
description: "CRUD 端点的草稿静态校验、OpenAPI 3.1 合成、执行预算以及 Console/CLI/MCP 视图对齐。"
doc_id: triggers.crud-surface-preview
verified_release: 'unreleased'
channel: preview
contract_ids: []
---

# CRUD 表面与契约对齐（预览）

这是[CRUD 端点](crud.md)与[CRUD 分页列表](crud-list-preview.md)的未发布后续改进，将管理 API、OpenAPI 导出、Console 标签页、CLI 与 MCP 投影中的 CRUD 行为对齐到同一契约。需要包含提交 `4219ede8` 的服务端、CLI 与 MCP 版本。`1.1.0` 稳定参考页基线保持不变。

> [!NOTE]
> 这些改动收紧了校验并统一呈现既有运行时语义；不新增新的过滤运算符、动态 `order_by`、关联表查询或 CRUD `response_transform`。

## 草稿保存时的静态 `crud_config` 校验

`POST /projects/{slug}/endpoints` 与 `PUT /projects/{slug}/endpoints/{id}/info` 现在在保存草稿前即执行静态 `crud_config` 校验，直接返回 `400 bad_request`，不再把结构性编写错误拖延到发布阶段。

| 规则 | 草稿保存时即拒绝的情形 |
| --- | --- |
| `table` | 表名为空或全空白。 |
| 仅 list 选项 | 在 `get_by_pk`、`insert`、`update_by_pk` 或 `delete_by_pk` 上设置非空 `filters`、非空 `order_by`、显式 `limit`、`pagination` 或 `search`。 |
| `pagination: "page"` | `order_by` 为空、`limit.default == 0`、`limit.max == 0`、`limit.default > limit.max`，或 `limit.max` 超出有符号 64 位整数范围。 |
| `filters` 与 `search.param` | 参数名不是合法 GraphQL 标识符、`search.param` 与过滤参数重名，或与保留分页参数冲突（`limit`、`offset`，以及 page 模式下的 `page`、`page_size`）。 |
| `search.columns` | 列列表为空、含空白列名或存在重复列。 |
| `writable` 与 `defaults` | `writable` 与 `defaults` 存在重叠列，或 `defaults` 值不属于 `$identity`、`$principal`、`$user_id`、`$role`、`$authorizer`、`$project_id`、`$now`、`$claim.<非空名称>`。 |

发布时仍执行完整的 schema 感知校验（表是否存在、映射列、主键、text/varchar 搜索列类型、`<table>_aggregate` 冲突与写入行范围策略），并再次运行静态校验作为旧版本遗留草稿行的纵深防御。

## OpenAPI 3.1 合成与执行预算

`GET /projects/{slug}/openapi.json`（见[HTTP API 概览](../api/overview.md)）现在更准确地反映已发布 CRUD 快照契约：

- **`insert` 状态码**：导出 `"201"`（`Created.`）而非 `"200"`，与运行时分发保持一致。
- **主键路径参数**：在 `get_by_pk`、`update_by_pk`、`delete_by_pk` 上，若 `overrides.path_params` 未声明对应主键，则从冻结的 `resolved.pk` 自动合成 `in: "path", required: true` 参数；若已通过 `overrides.path_params` 的 `as` 声明了外部别名，则为该别名补充冻结的主键类型而不重复输出内部列名。
- **闭集写入请求体**：在 `insert` 与 `update_by_pk` 上，根据冻结的 `resolved.writable` 列合并 `overrides.body_fields`（遵循 `as` 别名与 `nullable`）以及 `overrides.audit_reason`（当配置为 `body.<field>` 时）合成 JSON 对象 schema，并始终输出 `additionalProperties: false`（即便 `writable` 为空）。
- **执行预算**：`GET /projects/{slug}/endpoints/{id}` 为 CRUD 端点填充 `execution_budget`，使用 `in_process` 通道（`always_async: false`），超时取项目 `default_timeout_secs` 或部署级同步脚本超时上限。

以下为源码推导的已发布 `insert` 端点 OpenAPI 片段示例（`books` 表，`writable` 为 `["title"]`）：

```json
{
  "requestBody": {
    "required": true,
    "content": {
      "application/json": {
        "schema": {
          "type": "object",
          "properties": {
            "title": {
              "type": "string"
            }
          },
          "additionalProperties": false
        }
      }
    }
  },
  "responses": {
    "201": {
      "description": "Created."
    }
  }
}
```

> [!WARNING]
> OpenAPI 仍只描述**当前已发布的活动快照**，不包含未保存或未发布的草稿改动。生成客户端 SDK 也不会编码实时行级授权规则、数据库约束或 `defaults` 解析失败。

## Console CRUD 标签页对齐

在 Web Console 中查看 CRUD 端点时：

- **Contract 标签页**：展示闭集 CRUD 入参契约（主键路径绑定、`list` 查询参数 `filters`/`search`/`limit`/`offset` 或 `page`/`page_size`、可写请求体列与 `audit_reason: body.<field>`，以及含 `$now` 的平台填充 `defaults`），不再按脚本端点显示开放请求体透传。`overrides` 默认值与 CRUD 参数的组合语义见[参数显式 null 默认值](null-default-preview.md)。
- **Test 标签页**：按 `crud_config` 与 `overrides` 预填路径、查询与请求体示例，并隐藏仅适用于脚本的 `X-Viat-Async` 异步开关。
- **Info、Cache、Auth 与历史抽屉**：Info 显示 `pagination` 与 `search`；Cache 保持仅 GET 的 caller scope 缓存规则；Auth 展示生效的行级授权范围（`authz_type`、继承的资源 `authz_tables` 或 `allow_unscoped_writes`）；快照历史将 CRUD 快照格式化为 `crud=<resource>:<table>.<op>`。

## CLI、仓库同步与 MCP 投影

- **CLI 端点查看**（见 [CLI endpoint](../cli/endpoint.md)）：
  - `viat endpoint list` 对非脚本叶节点展示真实目标摘要（`crud=<resource>:<table>.<op>`、`workflow=<name>`、`proxy=<name>`、`ws`、`auth=<kind>`），不再统一显示 `script=-`。
  - `viat endpoint show` 的文本视图在字段存在时包含 `workflow_name`、`proxy_resource_name`、`crud_resource_name`、`crud_config`、`ws_config` 与 `auth_kind`。
  - `viat endpoint history` 利用 `EndpointSnapshotView` 新增的 `crud_resource_name`、`crud_table`、`crud_op` 字段展示 `crud=<resource>:<table>.<op>`。
- **CLI 仓库差异**：`viat project diff` 在渲染统一 diff 时归一化 `TargetRef::Crud` 的默认值（`filters.<name>.op: "eq"`、`filters.<name>.skip_empty: false`、省略或默认 `limit`），避免本地 YAML 省略默认值时产生噪音差异。
- **MCP 端点工具**（见 [MCP create_endpoint](../mcp/create_endpoint.md)）：
  - `list_endpoints`、`get_endpoint_tree`、`create_endpoint`、`update_endpoint_info`、`update_endpoint_auth` 与 `move_endpoint` 在字段存在时回传可选的 `proxy_resource_name`、`crud_resource_name` 与 `crud_config`（不存在时省略）。
  - `create_endpoint` 导出 schema 中 `crud_resource_name` 的描述明确列出 `postgresql`、`mysql` 或 `sqlite`。

## 验证与升级边界

升级现有项目前，在隔离夹具上核对草稿保存、OpenAPI 导出与 CLI diff：

1. 验证非法 `crud_config`（如 `pagination: "page"` 但 `order_by` 为空，或 `writable` 与 `defaults` 重叠）在草稿保存时即返回 `400 bad_request`。
2. 发布 `list`、`get_by_pk`、`insert`、`update_by_pk`、`delete_by_pk` 夹具，检查 `/projects/{slug}/openapi.json` 中 `insert` 为 `201`、主键路径参数齐全且写入请求体带 `additionalProperties: false`。
3. 使用配套升级后的 CLI 运行 `viat endpoint list`、`viat endpoint show <id>`、`viat endpoint history <id>` 与 `viat project diff`；旧版 CLI 不会展示新增快照字段，也不会在 diff 中归一化 CRUD 默认值。

数据库中既有的历史草稿行不会被自动修改；发布前需先修正并重新保存不合规草稿。

## 核验依据

契约源码 `4219ede8`：`crates/viat-core/src/types/{crud,snapshot}.rs`；`crates/viat-runtime/src/crud.rs`；`crates/viat-api/src/{openapi.rs,handlers/endpoints.rs,runner/budget.rs}`；`crates/viat-mcp/src/tools/endpoints.rs`；`crates/viat-cli/src/{commands/endpoint.rs,repo/diff.rs}`；`web/src/pages/endpoints/{crudContract.ts,NodeContractTab.tsx,NodeTestTab.tsx,NodeInfoTab.tsx,NodeAuthTab.tsx,NodeCacheTab.tsx,NodePublishTab.tsx,PublishHistoryDrawer.tsx}`。
