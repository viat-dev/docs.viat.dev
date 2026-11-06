---
title: 'Shell 脚本'
description: 'Bash 环境、输入头、响应和错误辅助函数。'
doc_id: script.shell
verified_release: '1.1.0'
channel: stable
---

# Shell 脚本

语言值 `shell`。每次执行启动 Bash（部署可指定可执行文件），启用 `set -euo pipefail`；响应/日志/错误函数依赖 **jq**。没有 main 函数，也没有 Python 式 `ctx`。平台先加载辅助函数，再执行正文。允许 shebang，但它不用于选择任意其他运行时。

## 完整最小脚本

保存 `scripts/shell_echo.sh`：

```bash
#!/bin/bash
# @input name:string
viat_log_info "greet" "who=$VIAT_ARGS_NAME"
viat_response "$(jq -nc --arg name "$VIAT_ARGS_NAME" '{hello:$name}')"
```

```bash
viat script create --name shell_echo --language shell --file scripts/shell_echo.sh
viat script run shell_echo --args '{"name":"Ada"}'
viat script update shell_echo --file scripts/shell_echo.sh
```

预期**已发布 HTTP 正文**为 `{"hello":"Ada"}`。1.1.0 对显式响应执行 `viat script run` 会打印 `null`，因为草稿 API 不把响应信封放进 output。需明确绑定/发布一次性端点后验证公共正文。作为工作流步骤时，shell 结果为 `{"body":{"hello":"Ada"}}`，读取 `$step.output.body`。仅用平台辅助函数，不需资源或网络。需要项目编辑/执行权限。[测试](testing.md)提供端点发布与清理；`viat script test` 不是通用 shell 测试器。

## 环境契约

`VIAT_ARGS_JSON` 是完整 JSON 对象；`VIAT_ARGS_<NAME>` 使用大写顶层参数名。字符串值直接传入，其他值 JSON 编码。需要区分 null/数值/字符串时用 jq 读取 `VIAT_ARGS_JSON`，变量展开必须加引号。`VIAT_REQUEST`、`VIAT_PRINCIPAL`、`VIAT_RESOURCES` 为 JSON。仅启用 raw-body 端点时 `VIAT_REQUEST_BODY_FILE` 才指向原始正文；必须在本次执行内使用文件，不能延后。

声明资源的投影还可暴露 `VIAT_RESOURCE_<NAME>_<FIELD>`。不要用它们提取认证凭证；需要资源调用时选择有 broker helper 的 Python/TypeScript/Rust。Shell 没有 `ctx.tasks` 或通用 broker 封装。环境先清空再重建 PATH/HOME 和运维允许透传项，不能直接读取任意服务器环境变量。

## 辅助函数

| 函数 | 参数与结果 |
| --- | --- |
| `viat_log_info`、`viat_log_warn`、`viat_log_error` | `MESSAGE [key=value ...]`，结构化日志。字段值为字符串，多余 `=` 保留在值中。 |
| `viat_log_sensitive` | 同样参数，字段值替换为 `***`，消息本身不遮盖。 |
| `viat_response` | `BODY [STATUS] [CONTENT_TYPE]`，默认 200；jq 接受时作为 JSON，否则文本。显式响应，不支持 header 选项。 |
| `viat_error` | `STATUS CODE MESSAGE [key=value ...]`，带 extra 的有意拒绝，退出码 87。不要绕过 helper 自行 exit 87。 |

拒绝示例：`viat_error 400 invalid_name "name must not be blank"`。其他非零退出为运行时失败，详情在 stderr。没有显式响应时结果为 null，捕获 stdout 只是日志，不会解析为返回值。Helper 用 `jq -e .` 判断 JSON，因此顶层 `false`、`null` 虽是合法 JSON，也走文本分支。需要 JSON 契约时把它们包装进对象。Echo 类似协议 sentinel 的行不能伪造响应。

`# @input name:type[=default]` 只在第一条命令前的注释头读取。未知类型回退 string，输出 Schema 始终开放并警告。默认值是 Schema 字符串，允许省略时自行实现运行时回退，如 `${VIAT_ARGS_NAME:-world}`。类型列表见[指令](annotations.md)。

## 限制与验证

超时终止执行/进程组，后台子进程不会成为托管持久任务。不支持 `ViatStream`，没有 requirements 安装器，也没有自动 shell 资源 RPC。先用安全本地 Bash/jq 固定数据验证，再执行无资源草稿。`set -u` 因变量缺失失败时查看 stderr。绝不把不可信输入交给 `eval` 或拼接命令字符串。主动调用的外部命令可有真实副作用，需要独立授权与幂等设计。
