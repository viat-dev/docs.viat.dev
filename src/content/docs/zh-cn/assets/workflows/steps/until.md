---
title: 'until 步骤'
description: '有界顺序条件、计数、结果数组与迭代耗尽。'
doc_id: workflow.step.until
verified_release: '1.1.0'
channel: stable
---

# until 步骤

until 是有界**顺序**条件循环，不是遍历隐式集合的 for_each，也不是持久计时器或重试引擎。

| 字段 | 必填、默认与合法值 |
| --- | --- |
| `id` | 必填合法且全局唯一包装 ID。 |
| `until` | 必填条件**字符串**，结果需布尔，与 if 语法相同；无默认条件。 |
| `max_iterations` | 必填整数 1–1000，不存在隐式无限/默认次数。 |
| `do` | 必填单个 StepEntry 映射，不是列表，可为任一原生变体。 |
| `index_as` | 可选计数别名 `[a-z][a-z0-9_]*`，不能是 inputs/each/each_index/_error 或与已有步骤 ID 冲突。 |

## 上下文、输出与错误

可读 $inputs 和之前外层输出。While/until 没有当前 `$each` 项；`$each_index` 和具名别名提供计数，外层具名迭代别名仍可读。不能把包装自身输出当循环内可变状态。`$id.output` 为按执行顺序收集的正文值数组；parallel 正文无自身聚合输出，因此值为 null。

Until **先执行正文再判断**，获准执行时至少一次。成功后追加正文输出，增加内置计数，再判断是否停止，true 结束。因此条件首次就可读本轮正文结果。正文输出在局部跨迭代保留，不向外层暴露。Max_iterations 次后条件仍 false，则下一次迭代守卫报 `loop_max_iterations_exceeded`，不会截断成功。

1.1.0 计数细节：正文 `$each_index` 从零开始；后置判断读取增加后的 `$each_index`（首次为 1），但 index_as 别名仍为刚完成轮次的零起始下标（首次为 0）。不要假设二者在后置条件里相同，优先按示例使用正文结果判断。

预期正文 `{"values":[0,1]}`。字符串条件 `"true"` 也执行一次；`"false"` 到最大次数报错，而不是成功返回部分数组。

路径缺失、非布尔条件、未处理正文失败、次数耗尽、超时、取消都会失败。包装不支持 max_concurrency/retry/on_error，需要时在 script 处理。每轮和重试共用根 deadline。正文应有界且幂等，循环失败不会回滚之前效果。

## 完整无资源用例

在有编辑/运行权限、节点有 Python/uv 的隔离项目，用 `scripts/wf_echo.py` 创建 wf_echo：

```python
def main(value):
    return value
```

保存定义到 `workflows/until_case.yaml`：

```yaml
inputs: {}
steps:
  - id: loop
    until: '$tick.output == 1'
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
viat workflow create case_until --file workflows/until_case.yaml
viat workflow test case_until --input '{}'
viat workflow update case_until --file workflows/until_case.yaml
```

已有共享脚本不要重复创建。Test 执行实时草稿，不是发布端点或离线测试，此用例无副作用。检查结果/日志，先删一次性端点绑定，再 `viat workflow delete case_until`，wf_echo 无引用后才删。本文未在线验证。[语法](../overview.md)、[表达式](../expressions.md)、[错误处理](../error-handling.md)、[限制](../limits.md)说明通用行为。
