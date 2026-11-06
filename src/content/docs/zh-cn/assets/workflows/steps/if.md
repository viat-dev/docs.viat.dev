---
title: 'if 步骤'
description: '布尔条件、局部分支与包装结果。'
doc_id: workflow.step.if
verified_release: '1.1.0'
channel: stable
---

# if 步骤

If 选择恰好一个分支，不是“语言为 YAML 的脚本”。

| 字段 | 必填、默认与合法值 |
| --- | --- |
| `id` | 必填，合法且全局唯一。 |
| `if` | 必填**字符串**条件，最终值需为布尔。字面 true/false 条件也需加引号成为字符串。 |
| `then` | 必填非空条目序列。 |
| `else` | 可选，存在时必须非空；省略表示 false 不执行。 |

条件支持引用、比较、!、&&、||、括号，不支持算术或真值字符串。在外围作用域执行，包括外层迭代/catch 别名。每个分支复制外层，可读之前外层结果，分支内后项可读前项。内部 ID 后续不可见，且两分支间仍必须唯一。

`$id.output` 为所选分支最后条目值。False 且没有 else 为 null。以 parallel 结束也为 null，因为 parallel 没有自身值；需汇总多个结果时添加最终脚本。没有包装级 retry/on_error 或 timeout。分支未处理错误导致整个工作流失败，应在可能失败的 script 上恢复。

## 前置条件与验证

使用隔离项目，账号需编辑/运行权限，执行节点需 Python/uv。以 `scripts/wf_echo.py` 创建脚本资产 `wf_echo`，完整源码如下，无资源或外部副作用：

```python
def main(value):
    return value
```

将下文完整 YAML 保存为 `workflows/step_case.yaml`，创建固定脚本后使用页尾命令。这是手工用例，不声称已执行。草稿测试用实时保存定义，公共绑定端点使用发布快照。

```yaml
inputs:
  enabled: {type: boolean, default: true}
steps:
  - id: choose
    if: '$inputs.enabled == true'
    then:
      - id: yes_value
        script: wf_echo
        args: {value: yes-branch}
    else:
      - id: no_value
        script: wf_echo
        args: {value: no-branch}
outputs:
  value: $choose.output
```

默认输入返回 `{"value":"yes-branch"}`；`{"enabled":false}` 返回 `{"value":"no-branch"}`；删除 else 后 false 返回 `{"value":null}`。根 outputs 引用 `$yes_value.output` 非法，即使真实走过 true 分支。具体路径缺失会失败，不会当作 false。

## CLI 与清理

```bash
viat script create --name wf_echo --language python --file scripts/wf_echo.py
viat workflow create case_if --file workflows/step_case.yaml
viat workflow test case_if --input '{}'
viat workflow update case_if --file workflows/step_case.yaml
```

已有共享固定脚本时不要重复创建。发布前检查结果与执行日志。一次性项目先移除绑定端点，再 `viat workflow delete case_if`，确认其他地方未用后才 `viat script delete wf_echo`。Test 不是离线，删除不撤销历史副作用。参见[完整语法](../overview.md)、[表达式](../expressions.md)、[错误](../error-handling.md)和[限制](../limits.md)。
