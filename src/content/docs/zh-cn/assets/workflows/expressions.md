---
title: '工作流表达式与作用域'
description: '整值引用、条件语法、别名和缺失路径错误。'
doc_id: workflow.expressions
verified_release: '1.1.0'
channel: stable
---

# 工作流表达式与作用域

工作流值从 YAML 转为 JSON。Args/outputs 的对象、数组递归处理，null、数值、布尔保持字面值。**不以 `$` 开头**的字符串保持原样；以 `$` 开头的是整值引用，保留引用值的 JSON 类型，不是字符串模板。

```yaml
args:
  value:
    number: $inputs.count
    label: "count=$inputs.count"
    fixed: [1, true, null]
```

Count 为 7 时 number 为数值 7，label 为原样 `count=$inputs.count`，fixed 为 `[1,true,null]`。给 `"$inputs.count"` 加引号不能转义执行；普通字面文本不要让 `$` 成为首字符。没有已文档化的 `$$` 转义、`${...}`、函数调用、拼接或值引用算术。动态文本和计算应放脚本。

## 引用语法

| 引用 | 可用范围与结果 |
| --- | --- |
| `$inputs` / `$inputs.name` | 应用默认值后的本工作流输入。嵌套工作流输入是自己的 args，不是父映射全体；需声明引用键。 |
| `$step.output` / `$step.output.rows[0].id` | 之前已可见步骤输出，必须有 `.output`。数组下标为零起始非负整数，不支持 wildcard/JSONPath。 |
| `$value.output.length` | 末端数组项数或字符串 Unicode 字符数；对象真实的 length 键优先。 |
| `$each`、`$each.field`、`$each_index` | For_each 正文中的当前项和零起始下标，不是全局输入变量。 |
| `$item.field`、`$pos` | For_each 的可选 `as: item` / `index_as: pos`；外层别名保留，嵌套同名时内层优先。 |
| While/until 的 `$each_index`、`$pos` | 循环计数及可选 index_as；没有当前 `$each` 值。后置判断计数时机见步骤页。 |
| `$step._error.code` | 已记录的 continue 脚本错误，不是成功步骤总会存在的状态对象。 |
| `$_error.message`、`$owner._error.kind` | 仅 catch 分支内；catch 成功不把局部 error map 导出为 owner 错误。 |

根/路径缺失、下标越界、类型不符或缺 `.output` 都是表达式错误，不会隐式变成空串、null 或默认值。Args/outputs 校验检查可见根和声明输入，具体对象路径需运行时验证。条件校验解析语法，其中不可用的引用仍可能到求值时才失败。Null 本身合法，但不能继续读取其字段。

## 条件语言（仅 if/while/until）

条件必须是**字符串**，与值替换使用不同解析器：

```yaml
if: '$inputs.enabled && ($inputs.count >= 2 || $inputs.mode == "force")'
```

字面值包括 true/false/null、数值、单/双引号字符串。操作符为 `!`、`==`、`!=`、`<`、`<=`、`>`、`>=`、`&&`、`||` 和括号；优先级为一元 not、比较、and、or。相等比较 JSON 值，大小比较只能用于数值，逻辑运算和最终条件需布尔，不使用 Python/JavaScript truthiness。`&&`、`||` 短路，`false && $missing.output` 不读取右侧。没有算术、in、正则、方法调用、赋值和自动插值。条件字符串字面量不提供通用转义语言，嵌入文本保持简单并正确使用 YAML 引号。

## 作用域边界

顺序条目可读取前面同级输出。If 的 then/else 与 catch 复制作用域：可读外层，内部 ID 保持局部，包装结果为最后条目输出（无分支或末尾 parallel 时为 null）。即使互斥分支也必须全局唯一 ID。

Parallel 子项只看到块前作用域，看不到并发兄弟。全部成功后新输出合并，后续可见。For_each 各迭代看到循环前外层值与 item/index/别名；正文 ID 不单独泄露，只导出有序数组。While/until 在自身迭代间复用正文作用域，后续条件/正文可读前次输出，但这些 ID 不成为外层输出。While 首次前置条件不能读取未初始化正文结果。

嵌套工作流步骤作用域独立；显式传 args，通过 `$call.output` 读取输出映射。Principal/request 通过执行上下文继承，不存在 `$ctx` 之类隐式根。读取请求/身份应执行脚本。参见[步骤参考](overview.md)和[错误处理](error-handling.md)。

## 独立表达式固定用例

无需脚本或资源，保存为 `workflows/values.yaml`：

```yaml
inputs:
  count: {type: integer, default: 7}
steps: []
outputs:
  number: $inputs.count
  literal: "count=$inputs.count"
  values: [true, null, 3]
```

```bash
viat workflow create values --file workflows/values.yaml
viat workflow test values --input '{}'
```

预期正文 `{"number":7,"literal":"count=$inputs.count","values":[true,null,3]}`。在一次性项目用 `viat workflow delete values` 清理。草稿测试不发布。本例是手动验证用例，不声称已经执行。
