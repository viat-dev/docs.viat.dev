---
title: 'script 步骤'
description: '使用解析参数、重试和错误策略调用项目脚本。'
doc_id: workflow.step.script
verified_release: '1.1.0'
channel: stable
---

# script 步骤

调用现有项目脚本资产，不内嵌源码或选择语言。资源声明、解释器/构建需求和 helper 属于该脚本；工作流继承身份/请求，只传解析后的参数映射。

| 字段 | 必填、默认与合法值 |
| --- | --- |
| `id` | 必填字符串 `[a-z][a-z0-9_]*`，整份定义全局唯一。 |
| `script` | 必填资产引用，裸名或 folder/name；从工作流文件夹、根、唯一裸名匹配解析。不是上传文件路径或行内源码。 |
| `args` | 映射，默认 `{}`，值按当前作用域递归解析；不会自动转发全部工作流输入。 |
| `retry` | 可选，缺失只尝试一次。必填子字段 times 1–10 额外重试、initial_ms 10–60000、factor 1–10、max_ms initial_ms–60000；jitter 布尔默认 true。 |
| `on_error` | 默认 fail。字面值 fail/continue，或恰有 catch 键、内容为非空步骤序列的映射。 |

不能添加 `type: script`、每步独立 timeout、sleep 或 approval。脚本自身 timeout 不重置工作流总预算。Args 在尝试前只求值一次。成功将返回 JSON 值绑定 `$id.output`，可以是标量、数组、对象、null，不一定为 `{result:...}`。步骤响应是工作流内的值，不会自动成为最终公共 HTTP 响应。

快照脚本/资源缺失、类型不符、参数表达式错误、解释器/导入/构建错误、运行时异常或超时会失败。只重试分类的临时错误，不是所有异常或用户 ViatError。Continue 输出 null 并保存 `$id._error`；catch 用局部错误作用域，返回最后条目。取消不能吞掉。[错误处理](../error-handling.md)给出退避公式、分类与 catch 限制。

## 前置条件与验证

使用隔离项目，账号需编辑/运行权限，执行节点需 Python/uv。以 `scripts/wf_echo.py` 创建脚本资产 `wf_echo`，完整源码如下，无资源或外部副作用：

```python
def main(value):
    return value
```

将下文完整 YAML 保存为 `workflows/step_case.yaml`，创建固定脚本后使用页尾命令。这是手工用例，不声称已执行。草稿测试用实时保存定义，公共绑定端点使用发布快照。

```yaml
inputs:
  value: {type: integer, default: 7}
steps:
  - id: echo
    script: wf_echo
    args:
      value: $inputs.value
    retry:
      times: 2
      initial_ms: 100
      factor: 2.0
      max_ms: 1000
      jitter: false
    on_error: fail
outputs:
  value: $echo.output
```

预期正文 `{"value":7}`。成功固定脚本不会重试，此声明只演示策略语法，不产生网络流量。恢复测试使用错误页确定性的 ViatError，不要制造真实付费提供商错误。发布冻结步骤主体，但 1.1.0 步骤 uses 模块实时解析，依赖回滚前需了解快照例外。

## CLI 与清理

```bash
viat script create --name wf_echo --language python --file scripts/wf_echo.py
viat workflow create case_script --file workflows/step_case.yaml
viat workflow test case_script --input '{}'
viat workflow update case_script --file workflows/step_case.yaml
```

已有共享固定脚本时不要重复创建。发布前检查结果与执行日志。一次性项目先移除绑定端点，再 `viat workflow delete case_script`，确认其他地方未用后才 `viat script delete wf_echo`。Test 不是离线，删除不撤销历史副作用。参见[完整语法](../overview.md)、[表达式](../expressions.md)、[错误](../error-handling.md)和[限制](../limits.md)。
