---
title: '脚本上下文与辅助 API'
description: '请求、调用身份、参数、资源和平台辅助方法。'
doc_id: script.context
verified_release: '1.1.0'
channel: stable
---

# 脚本上下文与辅助 API

Python 从 `viat` 导入 `ctx`；TypeScript 从 `"viat"` 导入。即使进程复用，它也按请求绑定。Python `main` 接收关键字参数；TypeScript `main` 接收一个参数对象（第二参数可接收 `ctx`）。参数映射不是 `ctx.request`：路径、查询和正文已经由端点绑定。除非端点的绑定接受，不要假定任意 JSON 正文键都会成为参数。

```python
from viat import ctx

def main(name: str = "world"):
    ctx.logger.info("greet", who=name)
    return {"hello": name, "method": ctx.request.method,
            "admin": ctx.principal.is_admin}
```

直接草稿执行输入 `{"name":"Ada"}`，结果包含 `hello: "Ada"`；没有 HTTP 请求时 `method` 为 null。身份取决于认证后的执行，不应把固定身份写入断言。

## 数据字段

| 字段 | 形状与语义 |
| --- | --- |
| `ctx.project_id` | 当前项目 ID，不是由调用方选择的跨项目权限。 |
| `ctx.request.request_id`、`.ip` | 请求/跟踪标识、平台确定的客户端地址；IP 可为 null。 |
| `.method`、`.path`、`.query` | HTTP 方法、**线上原始路径**（不是路由模式）、不带 `?` 的原始查询串；没有 HTTP 请求时为 null。保留百分号编码。调度调用端点时有 method/path，但没有调用者 IP 和请求头。 |
| `.headers` | 小写键；固定允许 `x-request-id`、`x-forwarded-for`、`x-real-ip`、`accept`、`accept-language`、`content-type`、`user-agent`、`referer`，再加项目 `exposed_headers`。永不暴露 `authorization`、`cookie`、`x-viat-*`。这是不可信输入，不是身份。 |
| `.body`、`.body_base64` | 仅 raw-body 端点：原始 UTF-8 文本，非 UTF-8 时为 base64。其他情况为 null。原始正文不生成参数。 |
| `.files` | multipart 上传句柄 `{field, filename, content_type, size, path}`。文件不是正文参数。路径执行后失效，要保留请交给 storage 资源存储。 |
| `ctx.principal` | `user_id`、`identity`、`role`、`authorizer`、`claims`、`is_admin`。字段可为 null；不能以缺失值推断权限。没有权限字符串列表。 |
| `ctx.resources` | 执行开始时解析的已声明资源；Python 使用属性（非标识符名用 `getattr(ctx.resources, "folder/name")`），TypeScript 使用对象/下标访问。Config 数据、主动读取的 secret 与认证凭证不是同一概念。 |
| `ctx.trigger` | WebSocket trigger 元数据 `{trigger,event,route,message_id,connection_id}`，或 null。不是通用触发历史。 |

平台在写入 `.ip` 前已按可信代理规则处理；直接读取调用方提供的转发头不能替代它。Multipart 与 raw-body 必须配置在端点上，脚本头无法启用。Multipart 文件句柄不能延后交给异步执行。

## 日志与进度

Python 使用 `ctx.logger.debug/info/warn/error(message, **fields)`；TypeScript 使用 `ctx.logger.info(message, fields)` 及其他等级。`.sensitive(message, fields)` 只遮盖**字段值**，不遮盖消息文本，因此消息内不得写凭证。普通 `print`/`console.log` 作为输出捕获，不会被当作协议帧执行。即使日志接收器会屏蔽已知秘密，也应避免输出敏感数据。

Python `ctx.progress(percent=50, message="halfway")`；TypeScript `ctx.progress(50, "halfway")` 上报后台执行进度，不是返回值。同步执行的进度可能被丢弃。判断完成应查看最终执行状态，而不是 100% 进度。

## 资源调用的输入与输出

优先使用 broker 辅助方法，由平台连接并应用资源认证。不要提取凭证或自行拼接认证头。部分旧的连接型投影有差异，声明资源不等于保证所有语言的所有字段都不含凭证。主动读取 `secret` 和解析后的 `config` 是应用数据，其结果仍须按敏感数据处理。

| Python 调用 | TypeScript 调用 | 结果 |
| --- | --- | --- |
| `ctx.resources.api.get("/health")` | `await ctx.resources.api.get("/health")` | 解码后的 JSON/文本；非 2xx 抛出类型化拒绝。Python `raw=True` / TS `{raw:true}` 返回字节。 |
| `api.post("/items", json={"name":"A"})` | `await api.post("/items", {json:{name:"A"}})` | 返回正文；可选 query、headers、timeout，仍受资源策略限制。 |
| `db.query("SELECT :id AS id", {"id": 1})` | `await db.query("SELECT :id AS id", {id:1})` | `{rows:[...], affected:n}`，参数绑定而非拼接。`.execute` 用于写入。 |
| `gql.query(document, variables, operation)` | `await gql.query(document, variables, operation)` | 上游 GraphQL 的 `data`，不是整个信封。 |
| `model.chat(messages, max_tokens=100)` | `await model.chat(messages, {max_tokens:100})` | `{content,model,usage,tool_calls}`；不会自动执行工具。 |
| 从 `viat` 导入后 `get_resource("token")` | 从 `viat` 导入后 `await getResource("token")` | 主动读取的 secret 值或 null。 |
| 从 `viat` 导入后 `set_resource("token", "new")` | `await setResource("token", "new")` | 更新已声明且已存在的 `secret`；当前执行资源快照不是实时可变配置视图。 |

本版本有 **20 种资源**，不止表中这些。Push 的 `.send(...)`、AMQP 的 `.publish(...)` 均已实现；成功只表示提供商/消息代理接受，不等于最终用户收到。队列消费是 trigger，不是 AMQP 辅助方法。[各类资源参考](../resources/index.md)拥有其选项、授权门槛和限制。需要 broker 审计和资源策略时，不要换成裸 SDK 调用。

## 授权、缓存和用户管理

`ctx.authz.check(type, action, attrs)` 返回布尔值，TypeScript 需 await。`require(...)` 允许时正常返回，否则抛出 `403 forbidden`。`attrs` 是对象属性映射，不是自报的权限列表。端点 gate 和行范围策略独立于脚本自身检查。

`ctx.cache.purge("GET /reports/:id")` 返回清除结果，TS 需 await。格式为方法、恰好一个空格和不含 query/fragment 的路径；用于写入后清除端点响应缓存，不会删除业务数据。

`ctx.project.users`、`.roles` 管理项目的**终端用户**，不是平台用户。需要 `ctx.principal.is_admin`，且仍受角色授予和防提权规则限制。`users.get(identity)`、`.list(...)`、`.create(identity, ...)`、`.set_password(identity, password)`、`.set_role(identity, role)`、`.set_active(identity, active)`、`.set_meta(identity, meta)` 作用于当前项目。TypeScript 复合名称使用 camelCase。用户响应不含密码。当前用户社交身份读取和元数据预配是更窄的、显式授权的同步已发布脚本操作，不是管理员绕过；工作流、任务、直接测试不可用。

## WebSocket 与任务

`ctx.ws` 为套接字事件提供 `connection_id/event/route/reason`，其他执行为 null。Python 的 `send(id,data)` 返回已知连接是否接受该帧；`close(id,code=1000,reason="")` 无返回值；`join(id,room)`/`leave(id,room)` 返回布尔值；`broadcast(room,data,exclude=[])` 返回寻址数；`members(room)`、`connections(user_id)` 返回列表。TypeScript 方法异步。关闭码为 1000 或 4000–4999。接受不等于客户端收到。

`ctx.tasks.enqueue/get/cancel` 只在 Python、TypeScript 可用，见[异步任务](async-tasks.md)。Rust 使用自己的 SDK；shell 使用环境变量和辅助函数；SQL、GraphQL、viat_gql、llm 没有 `ctx`。参见[语言参考](python.md)与[运行时响应处理](runtime.md)。
