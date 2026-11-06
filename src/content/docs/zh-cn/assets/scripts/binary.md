---
title: 'Binary 程序'
description: '清单、目标产物和必须实现的 worker 协议。'
doc_id: script.binary
verified_release: '1.1.0'
channel: stable
---

# Binary 程序

`binary` 用于自有工具链构建并实现 [worker 协议 1](worker-protocol.md) 的程序。它**不是任意源码上传**、shell 命令执行器或自行监听 HTTP 端口的服务器。脚本正文是 YAML 产物清单，平台不编译，也不提取其 I/O Schema。

## 清单与生命周期

创建 `scripts/echo.binary.yaml`：

```yaml
# timeout: 30
protocol: 1
programs: []
```

这是便于上传的合法空清单，**还不能执行**。填充后的每项包含 `target: <os>/<arch>` 和 `sha256: <64 个小写十六进制字符>`，每目标一项且不能重复。Protocol 必须是服务器支持的 1；未知协议、错误 digest/target、`uses:` 均拒绝。支持普通 `# @resource`、timeout 和队列注释，不提供 requirements/deps 安装。

```bash
viat script create --name binary_echo --language binary --file scripts/echo.binary.yaml
viat script upload binary_echo --binary out/echo-worker --target linux/x86_64
viat script build binary_echo
viat script run binary_echo --args '{"name":"Ada"}'
```

前提：`out/echo-worker` 是**声明目标**的可执行文件，实现单次和 `--loop`；运维已启用产物上传（`VIAT_RUST_ARTIFACT_UPLOAD=1`）。应使用实际部署目标，不一定是 linux/x86_64。Upload 将文件 digest 写入清单。[Worker 协议](worker-protocol.md)的完整无资源程序对该输入返回 `{"hello":"Ada"}`。其 Python shebang 演示需要节点有 Python；原生程序不需要。

`script build` 查询清单和可用性，不编译 binary 内容。之后用 `viat script update binary_echo --file scripts/echo.binary.yaml` 更新清单；重新应用本地空清单前应先拉取上传后版本，否则会抹掉目标项。绑定端点发布前先确认所需目标产物存在。

## 产物校验与错误

服务器检查 SHA-256 与目标的可执行格式/机器类型（ELF/Mach-O；shebang 可接受但仍需解释器）。产物按 protocol/target/digest 寻址，可由多个脚本/节点共享。Pull/push 传清单，不传可执行文件。节点缺少自身目标项或产物时明确失败，不会尝试编译。发布可警告缺产物，确认警告不会安装它。

进程使用 worker 账号、清空重建的环境、stdin 信封和 fd 3 控制帧。必须保留 request_id，每请求一个结果。只读 stdin 并把 JSON 打印到 stdout 的程序不符合协议。资源调用是 host RPC，不是内嵌提供商客户端；凭证与主动读 secret 按资源类型处理。

## Schema、超时与验证

Binary 不运行 `--viat-schema`，即使程序实现了该参数。没有提取输入/输出 Schema，端点输入开放，因此程序内部需校验，或显式配置端点绑定。预热进程可跨调用者保留状态，长/排队路径可单次执行。不能宣称支持 Rust 类型 Schema 或通用取消；需实现协议并采用运行时支持的通道。执行仍有超时，但不会回滚副作用。

在隔离项目验证单次/预热、错误输入、结构化用户拒绝和缺产物行为。协议页给出无资源确定性程序，不调用消息或模型服务。删脚本前先取消发布并删除端点。删除清单不代表可删除共享产物，产物保留另行管理。
