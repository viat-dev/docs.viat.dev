---
title: '工作流 YAML 参考'
description: '完整定义结构、执行模型与发布生命周期。'
doc_id: workflow.overview
verified_release: '1.1.0'
channel: stable
---

# 工作流 YAML 参考

工作流是 Viat 解释的 YAML，不是脚本语言，也不是持久作业引擎。原生步骤仅七类：[script](steps/script.md)、[if](steps/if.md)、[parallel](steps/parallel.md)、[for_each](steps/for_each.md)、[while](steps/while.md)、[until](steps/until.md)、[workflow](steps/workflow.md)。变体由**对应键是否存在**决定，不使用 `type:` 判别。每条必须恰好有一个变体键。没有原生 approval、wait-event、持久检查点或 external-job 步骤。

## 根语法

| 键 | 类型、必填/默认与含义 |
| --- | --- |
| `inputs` | 映射，默认 `{}`。键声明 `$inputs` 下可用名称，值可为简写元数据（如 `string`）或映射（如 `{type: string, default: world}`）。 |
| `steps` | 必填序列，除显式并发外按声明顺序执行。可为空序列，不能省略。 |
| `outputs` | 映射，默认 `{}`。成功结束后递归解析，整个映射就是工作流返回值。省略返回 `{}`，不是最后一步。 |
| `timeout` | 可选无符号秒数，正值选择总预算；缺失/零/不可用在准入时回退到项目/部署默认，并受部署上限约束。不是每步独立超时。 |
| `max_concurrent` | 可选正 u32 后台执行限制，默认无目标限制。零/错误值不是“暂停”。 |
| `concurrency_key` | 可选共享预算名 `[A-Za-z_][A-Za-z0-9_-]{0,63}`，仅有 max_concurrent 才有效；缺失使用工作流身份。 |

引擎不把输入元数据当作完整运行时 JSON Schema 校验。映射内 `default` 在第一步前显式填入**缺失**键，不覆盖调用者已传的 null。`default: null` 让引用得到 null，而不是 missing-path。会检查声明名与引用，但不能只靠 `{type: integer}` 拒绝字符串。严格校验应放脚本或端点参数绑定。工作流不会自动获得脚本 main 的提取 Schema。

有名条目的 `id` 匹配 `[a-z][a-z0-9_]*`，整份定义内全局唯一，包含分支、catch 和循环。Parallel 没有自己的输出 ID。只能引用输入和当前作用域已可见结果，不能引用未来步骤。额外 YAML 键不是安全扩展机制：在错误变体上被忽略的 type/timeout/retry 不会实现相应功能。

## 完整无资源示例

用 `scripts/wf_echo.py` 创建脚本资产 `wf_echo`：

```python
def main(value):
    return value
```

保存 `workflows/echo.yaml`：

```yaml
inputs:
  value:
    type: string
    default: world
steps:
  - id: echo
    script: wf_echo
    args:
      value: $inputs.value
outputs:
  value: $echo.output
```

```bash
viat script create --name wf_echo --language python --file scripts/wf_echo.py
viat workflow create echo_flow --file workflows/echo.yaml
viat workflow test echo_flow --input '{"value":"Ada"}'
viat workflow test echo_flow --input '{}'
viat workflow update echo_flow --file workflows/echo.yaml
```

预期正文分别为 `{"value":"Ada"}`、`{"value":"world"}`。Test 执行当前保存的草稿，步骤有副作用时仍会真实发生；此固定示例没有。Python 需要 uv/Python。需项目编辑/运行权限，测试身份不能证明公共调用者有权限。

## 发布与清理

```bash
viat endpoint create --segment flow --method POST --workflow echo_flow
viat endpoint publish ENDPOINT_ID
```

将 ENDPOINT_ID 替换为创建响应的 ID。仍需配置端点认证/参数，创建方法路径不等于授权策略。发布冻结工作流 YAML、步骤脚本主体、嵌套定义和端点配置；草稿之后的编辑要重发才影响端点。**1.1.0 步骤 uses 模块仍实时解析**，嵌套也一样，见[限制与快照](limits.md)。直接 test/schedule 目标从实时定义构建。资源在运行时解析，不是把全部凭证嵌入发布 YAML。

一次性示例先取消发布并删端点，确认没有其他工作流引用后再 `viat workflow delete echo_flow` 和 `viat script delete wf_echo`。删除不会撤销历史副作用。本文未执行在线运行或清理。

## 组合规则

脚本/工作流 args 和最终 outputs 递归解析整值引用，没有字符串内嵌插值。If/catch 包装返回所选分支最后条目的值，内部 ID 不向外泄露。Parallel 成功后将子输出按子 ID 暴露。For_each 返回有序结果数组，while/until 返回顺序数组。Parallel 本身没有聚合结果，因此以 parallel 结束的包装得到 null，不会凭空生成分支 map。[表达式](expressions.md)、[错误处理](error-handling.md)及步骤页给出精确作用域、默认与示例。
