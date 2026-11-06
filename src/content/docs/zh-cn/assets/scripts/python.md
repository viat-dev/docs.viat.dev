---
title: 'Python 脚本'
description: '入口、解释器、参数、Schema 与 Python 辅助 API。'
doc_id: script.python
verified_release: '1.1.0'
channel: stable
---

# Python 脚本

语言值为 `python`，不是 Python 版本字符串。执行节点需要 `uv`、Python；平台提供 `viat` 模块，不要安装同名但无关的 PyPI 包。额外包通过 `# requirements:` 声明，见[指令](annotations.md)和[依赖](dependencies.md)。

## 完整最小脚本

保存为 `scripts/hello.py`：

```python
from viat import ctx

def main(name: str = "world") -> dict:
    ctx.logger.info("greet", who=name)
    return {"hello": name}
```

```bash
viat script create --name hello --language python --file scripts/hello.py
viat script run hello --args '{"name":"Ada"}'
viat script update hello --file scripts/hello.py
```

预期正文 `{"hello":"Ada"}`。省略 `name` 使用 Python 默认值，返回 `{"hello":"world"}`。这些是认证后的服务器**草稿**操作，不是离线测试；账号需要项目编辑/执行权限。发布是独立步骤，[测试](testing.md)给出端点创建、发布、清理的精确命令。本例不需要资源。

## 函数与绑定规则

定义顶层 `main`；worker 导入模块并执行 `main(**args)`。`async def main(...)` 会被等待。未知参数可能触发 Python unexpected-keyword 错误，除非签名接受 `**kwargs`；缺少必填参数也会失败。使用显式带类型参数生成有用的端点 Schema，不要把 `**kwargs` 当作校验。导入时代码在 worker 加载时执行，不一定每次请求都执行；复用进程中不要将请求数据放进模块全局变量。

保存时按注解尽力提取输入/输出 Schema。支持基本类型、容器和部分本地结构声明；未知或导入的复杂类型可能保持开放。Optional 注解和默认 None 接受 null，并检查非 null 值。未注解字段不校验类型，不是自动变成 string。检查提取警告、验证端点绑定，不能假设所有 Python 类型都支持。

## 上下文、资源与错误

`from viat import ctx, ViatError, ViatResponse, ViatStream` 提供请求、身份、已声明资源和响应。Python 资源辅助方法为同步，即使位于 async main；写 `await ctx.resources.api.get(...)` 不会让它变异步。不适合属性语法的名称使用 `getattr(ctx.resources, "folder/name")`。支持 `ctx.tasks`，不能把 Rust/shell 的调用方式混用。

`raise ViatError(status=400, code="invalid_name", message="...")` 表示有意拒绝。普通异常为失败，traceback 写日志。返回可 JSON 表达的值或显式响应；只返回生成器不符合流协议。流式需返回 `ViatStream(generator)` 并声明 `# stream: true`。完整信封、取消和流中错误见[运行时](runtime.md)；请求与 helper 见[上下文](context.md)。

## 验证与不支持项

先运行[测试](testing.md)的无资源离线用例，再安全地执行草稿，检查 Schema/环境警告后发布。`uses:` 只导入项目资产，普通包仍需 requirements。Multipart 文件句柄执行后失效。进程隔离不等于任意恶意包构建脚本都安全。超时和取消不是数据库事务，也不会自动重试。一次性端点先取消发布并删除，再删除脚本。
