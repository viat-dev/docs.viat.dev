---
title: '工作流错误与重试'
description: '重试分类、退避和 fail/continue/catch 行为。'
doc_id: workflow.error-handling
verified_release: '1.1.0'
channel: stable
---

# 工作流错误与重试

只有 **script 步骤**拥有 `retry`、`on_error`，它们不是 if/parallel/循环/workflow 包装通用字段。不能添加 `type: retry` 或独立 catch 变体。默认只尝试一次然后失败。Args 表达式在脚本尝试循环前求值，重试不能修复该阶段错误。

## 重试配置

```yaml
- id: fetch
  script: read_fixture
  args: {}
  retry:
    times: 3
    initial_ms: 100
    factor: 2.0
    max_ms: 5000
    jitter: false
  on_error: fail
```

该条目需要现有脚本 `read_fixture`，不是整份工作流。完整独立用例见下文及 [script 步骤](steps/script.md)。

| 字段 | 必填、默认与范围 |
| --- | --- |
| `times` | 必填整数 1–10，表示**额外重试**，总尝试最多 times + 1。 |
| `initial_ms` | 必填整数 10–60000。 |
| `factor` | 必填有限数 1.0–10.0。 |
| `max_ms` | 必填整数，不小于 initial_ms，不大于 60000。 |
| `jitter` | 布尔，默认 true。 |

第 n 次重试前（首次失败后 n=1），基础延迟为 `min(initial_ms * factor^(n-1), max_ms)`，下限 initial_ms。Jitter 乘以 0.75–1.25 均匀随机数并四舍五入毫秒；max_ms 限制的是**基础值**，不是抖动后的最终值。关闭 jitter 时示例依次等待 100、200、400 ms。Args 只求值一次，各次不变；每次单独记录日志。

可重试运行时类别精确为：queue full、queue wait timeout、script broken、pool spawn failure、timeout、transport。用户 `ViatError`、普通脚本异常、注释错误、资源缺失/类型不符、environment-not-ready、工作流编排错误都**不会**自动重试。作为 script failure 的上游 API 拒绝不同于 transport。不按“所有 HTTP 500”这样的文本规则匹配；新错误变体默认不可重试。

等待和尝试共享工作流 deadline。采样退避加 10 ms 余量能放进剩余预算才允许重试，实际 jitter 可再次抽样。因此 times 不是必定执行次数。前次副作用可能已保留，开启重试前先保证写入幂等。

## 错误策略

| `on_error` 值 | 最后一次或不可重试失败后的行为 |
| --- | --- |
| 缺失或 `fail` | 整个工作流失败；用户拒绝保留 status/code，系统失败标记步骤归属。 |
| `continue` | `$step.output` 为 null，记录 `$step._error` 后继续，整个工作流仍可成功。 |
| `{catch: [entries...]}` | 执行非空局部恢复分支，成功用最后条目输出替换 owner；恢复失败则工作流失败。Catch 分支内任何层级都不能再嵌 catch。 |

Continue 错误形状 `{code,message,kind,extra?}`。用户错误 kind 为 user，保留 code/message/extra，没有独立 status 字段；过载为 overload，超时为 timeout，普通失败为 runtime。`$_error` 和 `$owner._error` **仅在 catch 内**暴露捕获错误。恢复内部 output/error map 不外泄；catch 成功后不能在外部读取 `$owner._error`。最后为 parallel 时没有自身值，catch 输出 null。取消绕过 continue/catch，策略不能推翻运维停止请求。

## 完整确定性 catch 用例

创建 `wf_fail`：

```python
from viat import ViatError

def main():
    raise ViatError(status=409, code="fixture_conflict", message="fixture refusal")
```

创建 `wf_echo`：

```python
def main(value):
    return value
```

保存 `workflows/recover.yaml`：

```yaml
inputs: {}
steps:
  - id: request
    script: wf_fail
    on_error:
      catch:
        - id: recovery
          script: wf_echo
          args:
            value:
              recovered: true
              code: $_error.code
outputs:
  result: $request.output
```

```bash
viat script create --name wf_fail --language python --file scripts/wf_fail.py
viat script create --name wf_echo --language python --file scripts/wf_echo.py
viat workflow create recover --file workflows/recover.yaml
viat workflow test recover --input '{}'
```

预期**工作流运行时输出**为 `{"result":{"recovered":true,"code":"fixture_conflict"}}`。1.1.0 CLI 注意：`workflow test` 只要看到任一失败尝试行，就判为失败，即使 catch/continue 或后续重试已恢复。因此可能只打印失败步骤并 exit 1，不打印成功输出。应在控制台/API 检查工作流最终输出与状态，不能把 CLI 退出判断当作引擎恢复语义。即使加 retry，此用户错误也不会重试。验证 continue 时改为 `on_error: continue`，outputs 中 result 为 `$request.output`、code 为 `$request._error.code`，预期 result null、code fixture_conflict。Catch 外不能引用 recovery。

草稿可有真实副作用，本固定用例刻意没有。一次性项目先移除绑定端点，再删工作流与脚本。被捕获失败的步骤创建的延后 tasks 仍可能在整个工作流恢复成功后提交：延后按**整次成功**，不是每步事务。不要假定 catch 会回滚工作，必要时显式补偿。[限制](limits.md)说明并发失败、取消、重启。
