---
title: 'while 步骤'
description: '有界顺序条件、计数、结果数组与迭代耗尽。'
doc_id: workflow.step.while
verified_release: '1.1.0'
channel: stable
---

# while 步骤

while 是有界**顺序**条件循环，不是遍历隐式集合的 for_each，也不是持久计时器或重试引擎。

| 字段 | 必填、默认与合法值 |
| --- | --- |
| `id` | 必填合法且全局唯一包装 ID。 |
| `while` | 必填条件**字符串**，结果需布尔，与 if 语法相同；无默认条件。 |
| `max_iterations` | 必填整数 1–1000，不存在隐式无限/默认次数。 |
| `do` | 必填单个 StepEntry 映射，不是列表，可为任一原生变体。 |
| `index_as` | 可选计数别名 `[a-z][a-z0-9_]*`，不能是 inputs/each/each_index/_error 或与已有步骤 ID 冲突。 |

## 上下文、输出与错误

可读 $inputs 和之前外层输出。While/until 没有当前 `$each` 项；`$each_index` 和具名别名提供计数，外层具名迭代别名仍可读。不能把包装自身输出当循环内可变状态。`$id.output` 为按执行顺序收集的正文值数组；parallel 正文无自身聚合输出，因此值为 null。

While 在每次迭代**之前**检查条件。首次 false 时不执行正文，返回空数组。首次前置条件不能读尚不存在的正文输出，应使用输入/下标，或在循环前初始化状态。正文输出在循环局部跨迭代保留，后续条件可读，但不会导出外层。每次成功追加正文值，再增加计数。完成 max_iterations 次后若条件仍 true，报 `loop_max_iterations_exceeded`，不是截断成功；若边界条件 false，则正常结束。

示例检查下标 0、1，追加值后在 2 退出，预期正文 `{"values":[0,1]}`。条件改为字符串 `"false"` 时空数组，改为 `"true"` 时三次后失败，而非成功返回三项。

路径缺失、非布尔条件、未处理正文失败、次数耗尽、超时、取消都会失败。包装不支持 max_concurrency/retry/on_error，需要时在 script 处理。每轮和重试共用根 deadline。正文应有界且幂等，循环失败不会回滚之前效果。

## 完整无资源用例

在有编辑/运行权限、节点有 Python/uv 的隔离项目，用 `scripts/wf_echo.py` 创建 wf_echo：

```python
def main(value):
    return value
```

保存定义到 `workflows/while_case.yaml`：

```yaml
inputs: {}
steps:
  - id: loop
    while: '$each_index < 2'
    max_iterations: 3
    index_as: iteration
    do:
      id: tick
      script: wf_echo
      args: {value: $iteration}
outputs:
  values: $loop.output
```

```bash
viat script create --name wf_echo --language python --file scripts/wf_echo.py
viat workflow create case_while --file workflows/while_case.yaml
viat workflow test case_while --input '{}'
viat workflow update case_while --file workflows/while_case.yaml
```

已有共享脚本不要重复创建。Test 执行实时草稿，不是发布端点或离线测试，此用例无副作用。检查结果/日志，先删一次性端点绑定，再 `viat workflow delete case_while`，wf_echo 无引用后才删。本文未在线验证。[语法](../overview.md)、[表达式](../expressions.md)、[错误处理](../error-handling.md)、[限制](../limits.md)说明通用行为。
