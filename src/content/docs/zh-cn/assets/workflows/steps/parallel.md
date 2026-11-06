---
title: 'parallel 步骤'
description: '有界独立分支、输出合并与快速失败。'
doc_id: workflow.step.parallel
verified_release: '1.1.0'
channel: stable
---

# parallel 步骤

Parallel 并发运行独立**条目**，不是带自创名称的 branch 对象列表。它没有自身输出 ID，也不会自动生成数组/映射。

| 字段 | 必填、默认与合法值 |
| --- | --- |
| `parallel` | 必填非空 StepEntry 映射序列，每项可以是七种变体之一。 |
| `max_concurrency` | 可选整数 1–16，与 parallel **同级**；缺失允许所有声明子项同时执行。 |

包装上写 id 不会生成可引用结果。子 ID 全局唯一，每项获得相同块前输入/输出/错误作用域以及外层 item/index/catch 别名，运行中不能读兄弟输出。全部成功后把新可见 output/error 合并到外层；if/catch/循环等子作用域边界仍有效。

上限计数子条目，子项仍可自行 fan-out；不同于根 max_concurrent 和部署 worker 上限。等待/工作共用 deadline。首个未处理错误丢弃兄弟 future，已发副作用仍可能完成，兄弟 end 日志可能缺失。没有自动回滚或包装级 retry/continue/catch/timeout，必要时在 script 内分别处理。

## 前置条件与验证

使用隔离项目，账号需编辑/运行权限，执行节点需 Python/uv。以 `scripts/wf_echo.py` 创建脚本资产 `wf_echo`，完整源码如下，无资源或外部副作用：

```python
def main(value):
    return value
```

将下文完整 YAML 保存为 `workflows/step_case.yaml`，创建固定脚本后使用页尾命令。这是手工用例，不声称已执行。草稿测试用实时保存定义，公共绑定端点使用发布快照。

```yaml
inputs: {}
steps:
  - parallel:
      - id: left
        script: wf_echo
        args: {value: left-value}
      - id: right
        script: wf_echo
        args: {value: right-value}
    max_concurrency: 2
outputs:
  left: $left.output
  right: $right.output
```

预期正文 `{"left":"left-value","right":"right-value"}`，与完成顺序无关。Right args 中引用 `$left.output` 非法，只有块后可读。Parallel 直接作 for_each 正文时，每次聚合值为 null；要收集对象，可调用内部 parallel、显式 outputs 的子工作流。

## CLI 与清理

```bash
viat script create --name wf_echo --language python --file scripts/wf_echo.py
viat workflow create case_parallel --file workflows/step_case.yaml
viat workflow test case_parallel --input '{}'
viat workflow update case_parallel --file workflows/step_case.yaml
```

已有共享固定脚本时不要重复创建。发布前检查结果与执行日志。一次性项目先移除绑定端点，再 `viat workflow delete case_parallel`，确认其他地方未用后才 `viat script delete wf_echo`。Test 不是离线，删除不撤销历史副作用。参见[完整语法](../overview.md)、[表达式](../expressions.md)、[错误](../error-handling.md)和[限制](../limits.md)。
