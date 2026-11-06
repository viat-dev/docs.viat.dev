---
title: 'Worker 协议 1'
description: '进程通道、信封、帧与完整兼容程序。'
doc_id: script.worker-protocol
verified_release: '1.1.0'
channel: stable
---

# Worker 协议 1

这是 [binary 程序](binary.md)及平台语言运行器的进程契约，不是 HTTP API。无论 Go/C++/Python 编写，binary 都必须实现。清单协议版本字面值为 `1`。

## 进程与通道

平台以 worker 账号启动程序，环境清空重建，工作目录为临时目录，执行时间有上限。**stdin** 包含逐行 JSON 请求信封和 RPC 回应。**fd 3** 是控制管道：UTF-8 sentinel 后立即接 JSON 和换行，每次写完 flush。普通 stdout/stderr 只是日志，不是协议。单次进程收到一个请求，结果后 exit 0。`--loop` 表示预热进程：先 READY，顺序服务多个请求，stdin EOF 后退出；可保留基础设施状态，不可保留上一调用者数据。

```json
{"request_id":"fixture-1","args":{"name":"Ada"},"ctx":{"project_id":"fixture","request":{},"principal":{},"resources":{}}}
```

`ctx` 含 request/principal/resources/project_id，以及可选 function（library 导出名）、ws、trigger。请求字段与凭证差异见[上下文](context.md)。每个结果必须保留 request_id。

## 帧

| Marker | 正文与方向 |
| --- | --- |
| `___VIAT_READY___` | 裸行，worker→host；**仅预热模式**，请求前发送。 |
| `___VIAT_RESULT___` | `{request_id,ok: JSON}`，或 `{request_id,response:{body_kind,body,status,headers,content_type}}`，或 `{request_id,error:{kind,status?,code?,message,extra?}}`，每请求一个结果。 |
| `___VIAT_LOG___` | `{level,msg,fields}`，debug/info/warn/error 结构化输出。 |
| `___VIAT_STDOUT___` | Marker 后为原始文本，不是 JSON，用于预热输出归属。 |
| `___VIAT_PROGRESS___` | `{percent?,message?}`，后台进度。 |
| `___VIAT_RPC___` | `{id,op,name?,req?...}`，worker→host。 |
| `___VIAT_RPC_REPLY___` | `{id,value}` 或类型化错误，host→worker，走 **stdin**。 |
| `___VIAT_STREAM_BEGIN___` | `{request_id,status,headers,content_type}`，预热流开始，代替 RESULT。 |
| `___VIAT_CHUNK___` | `{request_id,data: JSON}`，一项。 |
| `___VIAT_STREAM_END___` | `{request_id,outcome:{ok:true}}` 或 `{request_id,outcome:{error:{...}}}`，必须有 **outcome 包装**。 |

Response 的 `body_kind` 为 `json`、`text`、`file`、`bytes`。File 为 `{storage,id 或 key,filename?,disposition?}`，平台授权并读取；bytes 为 `{base64,filename?,disposition?}`，受 helper 字节上限限制。`viat` 错误保留有意的 status/code/message/extra；runtime/contract/import/protocol 为系统执行失败。流必须由预热流驱动处理，单次流为契约错误。开始发送后失败不能改变 HTTP 状态。

预热取消信封为 `{"request_id":"...","cancel":true}`，不要为 cancel 再发第二个结果。长处理器要真正支持取消，需要在执行中仍能读取信号；忽略信号不等于“可取消”。

## 完整无资源 worker

保存为 `out/echo-worker`，在构建机赋予可执行权限，再使用 [Binary](binary.md)的上传命令。Python 仅用于演示可移植进程协议，不使用 Viat Python SDK。执行节点需 Python 3，同时支持单次和 --loop，不调用资源。示例顺序执行，不声称可以打断进行中的长处理器。

```python
#!/usr/bin/env python3
import json
import os
import sys

control = os.fdopen(3, "w", buffering=1)
loop = "--loop" in sys.argv

def frame(marker, body=None):
    control.write(marker + ("" if body is None else json.dumps(body)) + "\n")
    control.flush()

if loop:
    frame("___VIAT_READY___")
for line in sys.stdin:
    envelope = json.loads(line)
    if envelope.get("cancel"):
        continue
    request_id = envelope["request_id"]
    args = envelope.get("args") or {}
    if not isinstance(args.get("name"), str):
        frame("___VIAT_RESULT___", {"request_id": request_id, "error": {
            "kind": "viat", "status": 400, "code": "invalid_name",
            "message": "name must be a string", "extra": {}}})
    else:
        frame("___VIAT_RESULT___", {"request_id": request_id,
              "ok": {"hello": args["name"]}})
    if not loop:
        break
```

上述输入的 RESULT 中 `ok` 为 `{"hello":"Ada"}`；缺失或非字符串 name 返回 `400 invalid_name`。没有资源、付费模型或消息发送。不要不带 fd 3 直接当普通脚本运行，它为平台启动而设计。

## 资源 RPC 与安全

在 fd 3 发送 `___VIAT_RPC___{"id":1,"op":"http","name":"api","req":{"method":"GET","path":"/health"}}`，从 stdin 读取 `___VIAT_RPC_REPLY___{"id":1,"value":...}`。失败含 error，可有 error_code/status/extra，应保留类型化拒绝，不要全变成 500。按 id 匹配回应；预热 stdin 可穿插后续信封与取消，因此用单一读取器并暂存非回应。并发 RPC 必须按多个未完成 id 分发。

资源需 `# @resource` 声明；broker 检查类型、项目和操作策略。优先 broker，不提取认证字段。Config/secret 可有意进入应用；旧连接型投影与仅 broker 的请求资源不同。不能承诺所有字段均无凭证，更不能整份记录投影。

| 操作 | 主要请求/结果契约 |
| --- | --- |
| `get`、`set` | 声明的 secret；get 返回 string/null，set 使用帧 value，返回 null。 |
| `http`、`graphql` | HTTP `{method,path,query?,headers?,json? 或 body_text?/body_b64?}` → `{status,headers,body}`；GraphQL `{query,variables?,operation?}` → data。 |
| `sql_query`、`pg_graphql`、`db_tx` | 绑定 SQL `{sql,params?,execute?}` → rows/affected；PG/MySQL/SQLite GraphQL document/variables；事务 begin/query/execute/graphql/set_reason/commit/rollback。 |
| `llm`、`llm_stream` | messages/options → chat；流为相同 id 的 delta 回应，最后 done:true，不是一个 value。 |
| `s3`、`storage` | 对象/文件操作；S3 使用含 s3_op 的帧字段，不是通用 req；storage 使用带 op 的 req。 |
| `cloud`、`crypto` | Cloud action/params 与 crypto op；平台应用凭证/密钥。 |
| `mail_send`、`imap`、`push_send`、`amqp_publish` | 发送/读取/消息操作；接受不代表送达。 |
| `redis`、`mongo`、`library_call` | 带 op 的缓存/文档操作；library `{function,args}` 在冻结构建和调用身份下返回函数结果。 |
| `authz_check`、`cache_purge`、`tasks` | `{type,action,attrs}` → `{allowed}`；`{endpoint}` → `{purged}`；任务 enqueue/get/cancel。存在裸 tasks RPC 不等于 Rust/shell SDK 提供该 API。 |
| `project_users`、`project_roles`、`project_read_social_identity`、`project_provision_meta` | 管理操作或更窄的当前用户 grant，不是调用方任意选择用户的权限。 |
| `ws`、`im`、`platform_call`、`social_app_call` | 套接字/聊天/平台操作，仍受资源、账号和项目限制。 |

各类完整选项见[资源参考](../resources/index.md)，guest helper 输入输出见[上下文](context.md)。未知操作、错误资源类型会失败。没有统一 RPC 自动重试，写入不可无幂等地重放。

## Schema、失败与兼容性

Rust 编译后用 `--viat-schema` 探测 stdout 一行 `___VIAT_SCHEMA___{"input":...,"output":...}`。**Binary 不会探测**，实现 flag 也不能自动生成端点 Schema。非零退出、没有结果、帧错误或结果形状非法均失败。超时可能直接终止进程，没有预先信号；取消按通道支持。Cancel 不等于持久恢复或回滚。

破坏必需帧/信封的变更需升级协议版本；可选字段/操作可在版本 1 添加。应忽略未知可选信封字段，同时校验必填字段。在实际目标验证两种模式，再明确上传发布。协议固定测试不应包含秘密或提供商真实调用。
