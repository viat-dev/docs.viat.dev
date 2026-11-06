---
title: 'LLM 提示词脚本'
description: '现有多提供商模板语法、输出与安全限制。'
doc_id: script.llm
verified_release: '1.1.0'
channel: stable
---

# LLM 提示词脚本

`llm` 使用 Viat 1.1.0 已有的多提供商抽象：`openai`、`anthropic`、`azure`、`custom`，不是最新提供商 SDK 教程。必须恰好声明一个 `llm` 资源，配置**实际可用的模型/部署**、端点和凭证，不暗示存在通用模型 ID 或免费请求。没有明确同意不得真实调用或产生账单。

## 完整最小模板

已有 `assistant` 指向隔离固定服务或明确获准使用的模型时，保存 `scripts/summary.llm`：

```text
# @resource assistant
# timeout: 30
Summarise the following text in one sentence for {{ audience }}:

{{ text }}
```

```bash
viat script create --name summary --language llm --file scripts/summary.llm
viat script run summary --args '{"audience":"engineers","text":"The fixture is ready."}'
viat script update summary --file scripts/summary.llm
```

预期的是**形状**，不是固定文案：`{"content":"...","model":"configured model","usage":null,"tool_calls":[]}`，usage 也可能为提供商 token 对象。固定服务可返回 `content: "Fixture summary."`；真实模型措辞不是测试判据。运行时序列化共享 chat 结果，包含 `tool_calls`（模板不提供工具，因此通常为空）；当前提取输出 Schema 只列 content/model/usage。本文没有执行模型调用。

## 精确语法与默认值

非注释正文整体作为一条 user 提示词。所有左侧去空白后以 `#` 开头的行都会移除，不止已识别指令，因此 Markdown `#` 标题也会消失。剩余正文 trim 后必须非空。

只替换 `{{ name }}`，名称匹配 `[A-Za-z_][A-Za-z0-9_]*`，花括号内可有空白。缺失或 null 变量在调用提供商前失败，不会渲染为空。字符串直接插入；直接执行时其他 JSON 值插入紧凑 JSON，但端点提取输入将变量声明为必填 string。重复占位符在 Schema 中去重。不支持点路径、循环、条件、filter、include 或 system prompt 声明。未识别花括号不是新功能，不要假设会执行。

脚本用默认 chat 选项发送一条 `user` 消息，模型等默认来自资源；自定义参数放在资源或 helper 调用中。Azure 使用配置的部署名称。没有 requirements、main、`ctx`、原生工具调用或模板流式功能。

## 何时改用通用语言

Python/TypeScript 可调用 `ctx.resources.assistant.chat(messages, ...)`，支持 system/user/assistant/tool 消息、max_tokens、temperature、尽力 JSON 模式、tools、tool_choice 和提供商 extra。结果为 `{content,model,usage,tool_calls}`。工具形状 `{name,description?,parameters}`，调用形状 `{id,name,arguments}`；平台转换提供商格式，但不执行函数。必须限制循环次数、验证参数（错误参数可保留为原始字符串）、逐次授权，并把 assistant calls 和对应 tool results 加回对话。只请求工具的轮次 content 可为空，不算失败。

Python `chat_stream` / TypeScript `chatStream` 产生文本片段，带工具的流式请求会被拒绝。适当时与脚本 `ViatStream` 配合；`.llm` 模板始终缓冲返回。[运行时](runtime.md)说明流与取消限制。

## 错误、验证与清理

空提示词、错误/多个资源、缺失变量会在本地失败。网络传输、提供商 HTTP/API 拒绝、响应格式错误和超时不同；工作流重试分类不代表所有 429/500 响应体都自动重试。来自用户的提示词是不可信数据，不能把模型输出作为授权或直接执行的代码。

先用固定服务断言渲染后的 user 消息和结果形状，再明确同意付费验证。不要记录资源密钥或敏感提示词。公共端点仍需认证、限流/预算控制和显式发布。只删除一次性脚本/端点；删除 Viat 脚本不会撤销已有模型账单。[LLM 资源](../resources/llm.md)定义提供商字段，[测试](testing.md)区分离线与真实执行。
