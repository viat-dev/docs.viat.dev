---
title: 'workflow 步骤'
description: '隔离作用域、继承身份和共享预算的嵌套调用。'
doc_id: workflow.step.workflow
verified_release: '1.1.0'
channel: stable
---

# workflow 步骤

在同次执行内同步调用另一个项目工作流，不是 tasks 提交、HTTP 端点调用或外部作业适配器。

| 字段 | 必填、默认与合法值 |
| --- | --- |
| `id` | 必填合法且在父定义全局唯一的步骤 ID。 |
| `workflow` | 必填现有工作流引用，裸名或 folder/name，从调用工作流文件夹相对优先解析。 |
| `args` | 映射，默认 `{}`，在父作用域递归求值，成为子 inputs。 |

没有 `type: workflow`、包装 retry/on_error、每次调用 timeout、wait-event 或 checkpoint。子工作流应用自己的缺失输入默认值，但**只**接收 args，不隐式继承父 inputs。子步骤 ID/错误隔离，可与独立父定义重名。包装 `$id.output` 是子 **outputs 映射**，不是自动取最后一步。

继承调用者 principal、request、resources、取消上下文，不增加权限。子调用使用父剩余超时和根声明通道预算，子 timeout 不生成新预算。构建快照时拒绝静态循环，运行时调用深度计数上限 4；缺少冻结子工作流、非法定义、args 表达式错误、子失败均向上传播。此变体没有外层 catch，应在子 script 处理预期失败或返回显式应用结果。

## 完整无资源工作流对

空步骤示例不需脚本、解释器或资源。在有工作流编辑/运行权限的隔离项目，保存 `workflows/child.yaml`：

```yaml
inputs:
  value: {type: string, default: child-default}
steps: []
outputs:
  value: $inputs.value
```

父定义保存为 `workflows/parent.yaml`：

```yaml
inputs:
  value: {type: string, default: Ada}
steps:
  - id: child_call
    workflow: child_flow
    args:
      value: $inputs.value
outputs:
  value: $child_call.output.value
```

```bash
viat workflow create child_flow --file workflows/child.yaml
viat workflow create parent_flow --file workflows/parent.yaml
viat workflow test parent_flow --input '{}'
viat workflow test parent_flow --input '{"value":"Grace"}'
viat workflow update child_flow --file workflows/child.yaml
```

预期正文 `{"value":"Ada"}`、`{"value":"Grace"}`。要使用 child-default，需从**父调用 args**省略 value；仅调用者不传，仍会用父 Ada 默认值。缺少子 outputs 键为运行时表达式错误，不自动变 null。

## 发布、日志与清理

端点发布递归冻结子定义与脚本主体。编辑子实时行改变直接父测试，不改变已有发布端点，需要显式重发。1.1.0 工作流步骤 uses 模块即使在嵌套中仍是实时例外。子工作流自己的公共端点（若有）不是此步骤的调用路径。

嵌套日志路径如 child_call.inner，迭代内如 child_call[0].inner，需结合 path/iteration/attempt，不能只看 step_index。子失败同时记录叶子和调用包装；重启不在子边界恢复。先移除一次性绑定端点，删 parent_flow，再确认无引用后删 child_flow。删除不撤销外部效果。[语法](../overview.md)、[作用域](../expressions.md)、[限制](../limits.md)说明通用行为。本文未在线验证。
