---
title: '运行时、错误与流式响应'
description: '预算、响应、取消与流式执行。'
doc_id: script.runtime
verified_release: '1.1.0'
channel: stable
---

# 运行时、错误与流式响应

端点运行已发布源码，不是编辑器文本。`viat script run` 直接执行草稿并可使用真实资源。保存不等于依赖已构建或发布。共享模块遵循明确的[快照规则及工作流例外](dependencies.md)。

## 执行预算与通道

先取合法 `timeout:`，再取项目默认，最后部署默认（通常 30 秒）。随后受部署上限约束：连接中的调用者通常 300 秒，后台、调度/watch/chat 通常 1800 秒。申请预算不能绕过上限。编辑器支持 1–86400 秒，底层解析器在截断前接受最多六位正整数。

Python/TypeScript 低于共享阈值（通常 60 秒）使用预热共享进程，达到阈值使用有上限的 long-run 通道，也可配置专属进程；`stream: true` 选择有上限的流通道。显式 live 依赖强制单次执行，冻结依赖仍可使用预热池。SQL/GraphQL/viat_gql/llm 经平台客户端执行；shell 每次启动 Bash。Rust/binary 产物也有预热与单次路径；语言契约标志不代表产物进程永不复用。

工作流只有一个总超时。每个步骤获得剩余预算，自己的脚本头不会重置它。通道按**声明的工作流总预算**选定，不按剩余秒数切换。资源 I/O 和重试共用这只时钟。

## 响应与错误

普通返回值作为 JSON 响应，通常 200，并可经过端点响应变换。Python 显式响应：

```python
from viat import ViatError, ViatResponse

def main(name: str):
    if not name.strip():
        raise ViatError(status=400, code="invalid_name", message="name must not be blank")
    return ViatResponse({"hello": name}, status=201, headers={"x-example": "1"})
```

TypeScript 等价写法：

```typescript
import { ViatError, ViatResponse } from "viat";
export async function main(args: { name: string }) {
  if (!args.name.trim()) throw new ViatError({ status: 400, code: "invalid_name", message: "name must not be blank" });
  return new ViatResponse({ body: { hello: args.name }, status: 201, headers: { "x-example": "1" } });
}
```

`ViatResponse` 在 `body`、`file`、`bytes` 中恰选一个；body 只能是对象/数组/字符串，不能为标量或 null。默认 status 200、headers `{}`、content type null；状态为整数 100–599。File 是托管存储引用（Python 文件行或 `(storage,id_or_key)`），不是任意服务器路径。Bytes 有大小上限，文件读取仍经过授权。`filename`、`disposition`（`attachment`/`inline`）控制下载方式。

`ViatError` 是有意的 HTTP 拒绝，包含 status、code、message、可选 extra 对象。意外异常是运行时失败，详情写日志；不要向调用者发送 traceback 或资源配置。端点参数 Schema 拒绝发生在脚本前。资源缺失、类型不符、导入/协议错误、环境不可用、过载与超时不同，增加超时不能修复它们。返回 4xx/5xx 信封还会影响任务延后提交。

1.1.0 草稿回读注意：服务器 script test-run API 提供普通 output、stdout、stderr，不将显式响应信封作为 output 暴露。因此成功返回 `ViatResponse` 时 `viat script run` 打印 null，不能靠此验证 HTTP 状态/头或流。应通过明确发布的一次性端点或相应端点契约固定用例验证，不要为了满足草稿回读而把正确的显式响应改为普通返回。

## 流式响应

Python 返回包裹生成器或异步生成器的 `ViatStream`：

```python
# stream: true
from viat import ViatStream

def main():
    def items():
        yield {"n": 1}
        yield {"n": 2}
    return ViatStream(items())
```

TypeScript 必须使用**异步可迭代对象**，不支持同步生成器：

```typescript
// stream: true
import { ViatStream } from "viat";
export async function main() {
  async function* items() { yield { n: 1 }; yield { n: 2 }; }
  return new ViatStream({ generator: items() });
}
```

默认得到两行 NDJSON：先 `{"n":1}` 后 `{"n":2}`，每项独占一行。SSE 端点按 SSE 封装。状态、请求头和 content_type 的默认值同响应信封。Yield 必须可 JSON 序列化，顶层 `_viat_error` 为保留键。开始发送后不能修改 HTTP 状态；中途失败通过流内错误/结束表示，不会替换成普通 JSON 错误。指令只声明通道准入，不把普通返回值变成流。单次路径不支持预热池流协议，不能假设 live `uses:` 与流式兼容。

取消取决于通道。工作流在条目、重试、迭代之间检查；独立进程通道也可停止进行中的进程。共享预热执行、SQL 和部分路径可能要等当前步骤结束。此版本 Rust 不可取消。取消不会回滚数据库写入、外部请求、消息和 immediate 任务，需要幂等与补偿设计。队列执行可在进程启动前删除，已运行任务没有持久检查点。

## 目标队列限制与重启

`max_concurrent` 控制符合条件的异步端点和 tasks，不限制同步调用者。队列行冻结输入、认证身份和目标，不保留调用方 Authorization 头，因此 `caller_token` 不能在延后执行中借用凭证。限制按项目/key 跨实例计数，部署通道上限仍约束启动数量。默认队列深度 1000、轮询 1 秒。调度和直接测试不会自动排队。

排队行跨重启保留，丢失实例上已开始的执行标记 interrupted，不会恢复。取消、超时、重试都不让副作用具有原子性。[测试](testing.md)区分离线测试和真实草稿执行。
