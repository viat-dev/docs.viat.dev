---
title: 'for_each 步骤'
description: '数组迭代、别名、有界并发与有序结果。'
doc_id: workflow.step.for_each
verified_release: '1.1.0'
channel: stable
---

# for_each 步骤

For_each 解析一个数组，为每项运行一个正文条目。它是并发 map，不是共享可变状态的顺序循环。

| 字段 | 必填、默认与合法值 |
| --- | --- |
| `id` | 必填合法且唯一的包装 ID。 |
| `for_each` | 必填映射，包含以下子字段。 |
| `over` | 必填**字符串引用**，输入/之前输出路径且结果为数组，如 `$inputs.items`、`$fetch.output.rows`；不是行内数组或通用条件。嵌套可用带路径的迭代别名。 |
| `max_concurrency` | 位于 for_each 内，整数 1–16，默认 4。 |
| `do` | 必填**单个 StepEntry 映射**，不是序列；可为任一原生变体。 |
| `as` | 可选项别名，匹配 ID 语法。 |
| `index_as` | 可选零起始下标别名，匹配 ID 语法。 |

别名不能是保留名 inputs/each/each_index/_error，也不能与已有步骤 ID 冲突；内层可遮盖外层别名。定义别名后 `$each`、`$each_index` 仍存在，跨嵌套保留外层访问请用具名别名。Over 在进入新迭代前解析，因此可读外层别名。各正文获得外层作用域的新副本，不共享前次结果。

`$id.output` 是按**输入顺序**而非完成顺序排列的数组；空输入返回 `[]`。元素为正文输出，parallel 正文无聚合值，因此元素 null。内部 ID 不外泄。Over 缺失/类型错误会失败，不是空迭代。任一未处理错误快速失败并丢弃其他 future，但不撤销副作用。恢复/重试配置在正文 script，而非包装上。Max_concurrency 不限制内存，应独立限制数组大小。

## 前置条件与验证

使用隔离项目，账号需编辑/运行权限，执行节点需 Python/uv。以 `scripts/wf_echo.py` 创建脚本资产 `wf_echo`，完整源码如下，无资源或外部副作用：

```python
def main(value):
    return value
```

将下文完整 YAML 保存为 `workflows/step_case.yaml`，创建固定脚本后使用页尾命令。这是手工用例，不声称已执行。草稿测试用实时保存定义，公共绑定端点使用发布快照。

```yaml
inputs:
  values: {type: array, default: [3, 1, 2]}
steps:
  - id: mapped
    for_each:
      over: $inputs.values
      max_concurrency: 2
      as: item
      index_as: pos
      do:
        id: echo_item
        script: wf_echo
        args:
          value:
            item: $item
            index: $pos
outputs:
  values: $mapped.output
```

预期正文 `{"values":[{"item":3,"index":0},{"item":1,"index":1},{"item":2,"index":2}]}`。`{"values":[]}` 输出空数组；`{"values":null}` 失败，不当作空数组。根引用 `$echo_item.output` 超出作用域。

## CLI 与清理

```bash
viat script create --name wf_echo --language python --file scripts/wf_echo.py
viat workflow create case_for_each --file workflows/step_case.yaml
viat workflow test case_for_each --input '{}'
viat workflow update case_for_each --file workflows/step_case.yaml
```

已有共享固定脚本时不要重复创建。发布前检查结果与执行日志。一次性项目先移除绑定端点，再 `viat workflow delete case_for_each`，确认其他地方未用后才 `viat script delete wf_echo`。Test 不是离线，删除不撤销历史副作用。参见[完整语法](../overview.md)、[表达式](../expressions.md)、[错误](../error-handling.md)和[限制](../limits.md)。
