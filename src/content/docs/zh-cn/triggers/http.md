---
title: "HTTP 端点与分发"
description: "创建、绑定、发布并运维 HTTP 脚本、工作流和代理端点。"
doc_id: triggers.http
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# HTTP 端点与分发

客户端访问 `/p/<slug>/<path>`；管理入口是 `/projects/<slug>/endpoints`。控制台 access token/PAT 不自动等于端点调用凭据。创建和编辑需要项目内容编辑权限，发布需要发布权限；实际调用权限由**已发布**的 authorizer 和授权 gate 单独决定。分支组织路径，普通叶子绑定一个脚本或工作流和一个 HTTP 方法。[CRUD](crud.md)、[入站 WebSocket](websocket-endpoints.md) 和代理挂载是不同目标类型。

本页示例均由源码推导、使用虚构数据，**未执行**；请在隔离项目操作，不代表已验证的在线部署。

## 创建、读取与调用

先创建名为 `echo` 的脚本，例如仓库 `scripts/echo.py`，再执行 `viat push`。

```python
def main(name: str = "world"):
    return {"hello": name}
```

```http
POST /projects/demo/endpoints
Authorization: Bearer <console-token>
Content-Type: application/json

{"segment":"hello","method":"GET","script_name":"echo","allowed_authorizers":["public"],"overrides":{"query_params":{"name":{"type":"string","default":"world"}},"strict":true}}
```

`public` 必须替换为项目实际的公开 authorizer 名称，不要猜测。创建返回端点视图，例如下列投影（省略无关可选字段）：

```json
{"id":"00000000-0000-4000-8000-000000000001","tree_id":"00000000-0000-4000-8000-000000000002","parent_id":null,"segment":"hello","method":"GET","script_name":"echo","workflow_name":null,"path":"/hello","allowed_authorizers":["public"],"authz_gates":null,"override_authorizers":false,"override_permissions":false,"published_snapshot_id":null,"draft_dirty":false,"status":"unpublished","overrides":{"query_params":{"name":{"type":"string","default":"world"}},"strict":true}}
```

用保存的 id 访问 `GET /projects/demo/endpoints/<id>`；以 `{}` 调用 `POST …/endpoints/<id>/publish` 后，`GET /p/demo/hello?name=Ada` 返回 `{"hello":"Ada"}`。保存发布响应并检查公开路由，不能只看编辑器测试。[快照](../publishing/snapshots.md)说明发布门禁和输出。

## 创建字段

| 字段 | 含义及默认值 |
| --- | --- |
| `tree_id` | 可选 UUID；省略/null 使用默认端点树。 |
| `parent_id` | 可选、属于所选项目/树的 UUID；省略/null 创建根节点。 |
| `segment` | 必填路径段；`:name` 声明路径参数。服务端检查保留路径和冲突。 |
| `method` | `GET`、`POST`、`PUT`、`PATCH`、`DELETE`；省略/null 通常创建分支，特殊目标类型另有规则。 |
| `script_name`、`workflow_name` | 可选 `folder/name`，彼此及与代理/CRUD/WS 绑定互斥；目标必须存在。 |
| `proxy_resource_name` | 可选 `http_api` 资源名；代理挂载不能设置 method。 |
| `proxy_strip_prefix` | 默认 `true`。 |
| `proxy_upstreams` | 可选“路径参数值 → 完整 http_api 资源名”映射；整个挂载路径必须恰有一个路径参数，未映射值使用默认上游。 |
| `crud_resource_name`、`crud_config` | PostgreSQL CRUD 绑定，见 [CRUD](crud.md)。 |
| `ws_config` | 入站 WebSocket 绑定，见 [WebSocket 端点](websocket-endpoints.md)。 |
| `allowed_authorizers` | authorizer 名称列表；省略/null 继承。最近的声明**替换**祖先列表，不累加。 |
| `authz_gates` | `{type,action}` 列表；省略/null 继承。沿树累加，直到 `override_permissions` 截断。 |
| `override_authorizers`、`override_permissions` | 默认 `false`，显式设置继承边界。 |
| `required_permissions` | 已退役：非空列表被拒绝，空列表无操作；请使用 gates。 |
| `overrides` | 下文契约对象；省略/null 没有覆盖层；`{}` 是显式存在的覆盖层。 |
| `path_override` | 可选完整叶子路径，分支不能设置。 |

`PUT …/endpoints/<id>/info` 是部分更新：省略保持；显式 null 清除 `method`、`script_name`、`workflow_name`、`overrides`、`path_override`，但仍必须满足绑定约束。`segment:null` 不会清空路径段。`crud_config`、`ws_config` 在对应目标上整体替换，null/省略不表示清除。权限通过单独的 `PUT …/<id>/auth` 更新：`authz_gates` 省略保持、null 恢复继承、数组声明。其余 auth 字段不是通用 merge patch：省略 authorizers 会恢复继承，省略 override 布尔值会变为 false；修改前应先读取。`PATCH …/<id>/move` 接收 `parent_id`（null/省略移到根）；`DELETE …/<id>` 可能删除子树。平台管理的内置认证节点拒绝破坏性修改。

## 参数绑定与类型转换

运行时收到扁平参数对象，不是 HTTP 请求对象。没有声明时 path/query 是字符串，JSON body 保留 JSON 类型。空 body 合法；非空普通 body 必须是 JSON **对象**，不能是数组、标量或错误 JSON。先检查必需 header，再按 path → query（不能覆盖路径参数）→ body（**可以覆盖路径/query**）合并；优先级按 `as` 后的参数名计算。同一部分中，已声明字段优先于与别名冲突的未声明字段。允许 body 透传时，不应把 path 值当作绝不可覆盖的业务身份。

`overrides.path_params`、`query_params`、`body_fields` 都是 wire 名称 → 声明映射。每项必填 `type`（`int|float|bool|string|json`），`required` 默认 false，可选 `default`、参数别名 `as`、`nullable`。缺少无默认值的可选项会保持“不存在”，脚本自身默认值可生效。每部分处理完后按最终参数名补默认值，因此前一部分已有同名参数也满足该存在性检查；`required` 不等于必须从那个特定部分发送。显式 null 不是缺失，也不自动替换成默认值。body 的 `nullable:true` 放行 null；false/省略通常拒绝标量 null；`json` 接受包括 null 的任意 JSON。`nullable:false` 还表示已确认与 nullable 脚本输入不同的设计，影响发布 lint。path/query 没有 null 表达方式。

字符串转换：`int` 解析有符号 64 位十进制；`float` 解析有限数；`bool` 接受不区分大小写的 `true/1/yes` 或 `false/0/no`；`string` 原样保留；path/query 的 `json` 解析 JSON 文本。body 字符串可按数字/bool 声明转换，body `json` 则保留字符串。body 数字会通过数字转换，随后有效 JSON Schema 可施加更严格的整数限制。无效、缺失或未知参数在执行前返回 `400 bad_request`。`strict:false` 透传未声明 query/body；true 拒绝它们，并要求配置时声明全部路径参数。只有存在 overrides 对象时才启用冻结后的有效输入 schema 校验；完全省略覆盖层保留旧的宽松分发行为。

## 完整 overrides 字段

| 字段 | 默认值与约束 |
| --- | --- |
| `path_params`、`query_params`、`body_fields` | 默认空映射；声明见上。 |
| `required_headers` | 默认空数组；大小写不敏感地检查存在，不校验值，也不自动暴露给脚本。 |
| `response_headers` | 默认空响应 header 映射。 |
| `response_transform` | 省略/null 不变换；RFC 9535 JSONPath 在最终响应处理前变换 JSON 输出。 |
| `rate_limit` | 省略不限速。`endpoint`、`subject` 两个可选 quota 各需正数 `requests`、`window_secs`，可选正数 `burst` 默认 requests；两个桶都必须放行。`subject_key:identity` 默认按身份，匿名退化为 IP；`ip` 始终按 IP。无共享后端时实例本地计数；拒绝为 429，含 `Retry-After`。 |
| `audit_reason` | 默认 `header.X-Viat-Reason`；也支持 `body.<field>`、`none`。是否必须提供由审计资源/表决定。 |
| `raw_body` | 默认 false；精确字节在 `ctx.request.body`（UTF-8）或 `body_base64` 中，不进入参数；与 `body_fields`、multipart、cache 互斥。Webhook 验签所需 header 还要在项目设置中暴露。 |
| `multipart` | 省略关闭。`{max_file_bytes:0,max_files:0,fields:[]}`：0 字节使用部署上限，0 文件表示一个，空 fields 接收所有文本字段；文件流式落盘为 `ctx.request.files` 句柄，未列出的文本字段丢弃。每文件上限不得超出部署存储限制。与 raw body、async、CRUD 互斥。 |
| `run_async` | 默认 false；true 总是返回异步句柄。代理、内置认证、CRUD、WS 不支持此目标模式。 |
| `cache` | 省略关闭；仅 GET 脚本/工作流/CRUD；`{ttl_secs,scope:"caller",vary_headers:[],ignore_params:[]}`。CRUD 不支持 shared；与 raw body、multipart、async、current-user grant 互斥。 |
| `project_users_grant` | 可选 `{roles:[]}`；发布脚本仅获操作所列非管理员角色用户的能力，永不包含项目管理员；不等于给调用者授予角色。 |
| `current_user_grant` | 可选 `{read_social_identity:false,provision_meta_keys:[]}`；仅未缓存的同步脚本端点。直接、测试、库、排队执行没有此能力；宿主验证当前原生社交/外部 JWT 身份，不能指定其他用户。 |
| `strict` | 默认 false；true 关闭未声明参数入口。 |

## 响应、流与请求生命周期

普通返回值直接输出 JSON。显式 `ViatResponse` 控制 status、headers、content type、body，也可返回受管文件；脚本错误使用平台结构 `{"error":"code","message":"detail"}`。端点响应 header/transform 在 dispatch 执行，不应用于直接脚本测试。显式响应的**草稿脚本测试**可显示 `output:null`，不代表实际 HTTP body 是 null；已保存用例会单独比较显式响应 body。

流式脚本输出分块流；Python/TypeScript generator 和语言专用接口见脚本参考。HTTP 状态一旦发送就不能在后续流错误时更改。代理流和文件不等于可重放的缓冲 JSON。客户端断开/超时不会回滚已提交的资源写入；使用业务事务和持久工作记录，不能仅因丢失响应就重试变更请求。

普通缓冲请求在运行前限制为 **2 MiB**；multipart 使用独立的流式/落盘限制，代理流式转发不受这个 JSON 上限约束。运行 timeout 由脚本/工作流预算及部署上限解析，不存在请求级“无限 timeout”。代理或负载均衡器可能比仍在运行的脚本更早超时。

## 异步、幂等与缓存

`X-Viat-Async:true` 或 `run_async:true` 启动异步脚本/工作流。`X-Viat-Delay` 秒数或 `X-Viat-Run-At` 时间用于延迟排队，二者互斥，最远 30 天；`X-Viat-Tz` 解释本地时间。202 返回 `run_id`、`run_token`、`poll_path`，排队时还可有时间信息。以 `X-Viat-Run-Token:<run_token>` 轮询 `GET <poll_path>`；此 token 是单次运行读取能力，不能记入日志。异步结果存储不能完整表达所有流、文件、显式 HTTP 响应，不保证与同步渲染等价。控制台取消入口为 `POST /projects/<slug>/async-runs/<id>/cancel`；尽力取消可能返回 `not_cancellable`、`already_finished`、`owner_unreachable`，不会撤销既有副作用。multipart 拒绝 async/delay 和幂等 header；内置认证/CRUD 不转后台，向不支持目标请求延迟会被拒绝。

认证后的同步 `POST|PUT|PATCH|DELETE` 可用最长 255 字节的 `Idempotency-Key`，按项目、方法、具体路径、调用者隔离。指纹包含 query/body；同 key 不同请求冲突；并发在途请求冲突而非再次执行，已完成重放含重放标识。匿名 eligible keyed 请求被拒绝；GET、测试、代理不属于此保证。成功和客户端错误的缓冲响应可保存，服务端错误、流/文件及超过 **256 KiB** 的响应不保存。这是尽力的重试保护，不是业务 exactly-once：DB claim/保存失败和陈旧 claim 回收可能再次执行。不可逆动作仍需业务唯一键。

GET 缓存 key 包含发布快照/代次、绑定参数（排除 `ignore_params`）、配置的 vary headers，默认还包含调用者身份/角色/claims。`shared` 明确断言结果与调用者无关；命中仍执行认证、授权、限速和参数绑定。只保存适用的成功缓冲响应，可查看 `X-Viat-Cache`。外部 DB 写入不会自动清缓存：调用 `POST …/endpoints/<id>/cache/purge` 或 `ctx.cache.purge("GET /path")`；发布/回滚让旧答案不可达。用户管理或调用者敏感输出不能配置 shared。

## 代理与清理

代理绑定 `http_api` 且不设 method，转发前缀下所有方法，默认剥离挂载前缀。仍应用已发布的 authorizers/gates/限速/日志，但不插入脚本参数绑定、后台队列、响应缓存或平台幂等重放。资源凭据在平台侧应用；入站平台 authorization、cookies、逐跳 header 会过滤。可选身份断言在上游资源配置。资源设置保持 live，编辑后可立即影响已发布挂载。响应流式转发；此 HTTP 代理不是 WebSocket upgrade 隧道。传输 timeout/出站策略来自 HTTP 资源和部署，不来自脚本 timeout 注解；不能允许调用者任意选择上游地址。

在隔离 fixture 中验证错误输入、无权限调用者、合法调用者和 timeout/retry，分别检查拒绝日志与执行日志。停止新调用应 `POST …/<id>/unpublish`，不要以编辑/删除脚本替代。清理隔离端点/脚本前检查排队任务和外部副作用。仓库入口为 `endpoints/*.get.yaml` 等方法文件、`viat push`、`viat endpoint publish`、`viat call`，见 [CLI](../cli/endpoint.md)和[端点测试](../testing/endpoint-tests.md)。

## 维护依据

源码：`crates/viat-api/src/dto.rs`、`handlers/endpoints.rs`、`handlers/dispatch.rs`、`handlers/proxy.rs`、`handlers/async_runs.rs`、`idempotency.rs`、`endpoint_cache.rs`；`crates/viat-core/src/types/endpoint.rs`；`crates/viat-runtime/src/override_coerce.rs`。示例按源码推导、未执行；供应商、代理和负载行为需要单独授权验证。
