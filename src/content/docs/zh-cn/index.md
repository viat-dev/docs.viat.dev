---
title: Viat 产品手册
description: 从安装和首个接口开始，查阅 Viat 的配置、资源、脚本、工作流、触发器和操作参考。
doc_id: handbook.index
verified_release: '1.1.0'
channel: stable
---

Viat 将资源连接、脚本与工作流组织成可调用的接口和可触发的任务。本手册面向部署维护者、项目开发者及使用 CLI/MCP 的自动化助手；每项能力的前置条件、权限和失败边界与使用步骤同样重要。

## 从一个可验证的目标开始

| 你的目标 | 阅读路径 |
| --- | --- |
| 判断 Viat 是否适合当前任务 | [平台定位](overview/platform.md) → [概念与对象关系](overview/concepts.md) → [能力与限制](overview/capabilities.md) |
| 新建一个实例 | [Docker Compose 安装](installation/docker-compose.md) → [激活前置条件](instance/activation.md) → [平台用户](instance/platform-users.md) |
| 创建第一个可调用接口 | [项目与协作](projects/create-and-collaborate.md) → [第一个端点](getting-started/first-endpoint.md) |
| 使用裸二进制或自行构建 | [二进制与源码部署](installation/binary-source.md) |
| 在手机或 Mac 上使用客户端 | [客户端安装与兼容范围](installation/clients.md) |

配置、资产、触发器、CLI、MCP、运维和应用案例按主题出现在侧栏中。未完成的内容不会以空白占位页伪装成可用参考；重建期间完整覆盖清单仍是发布门槛。

## 先确认版本和作用域

本版的服务端/CLI 使用基线为 **1.1.0**，原生客户端版本独立管理。代码主线、开发分支和已经发布的镜像不一定具有相同能力。预览功能必须单独标记；例如尚未发布的加密 APNs Widget 快照不能作为 1.1.0 的安装前提。

平台账号用于管理 Viat；项目终端用户、API key 和 authorizer 用于调用业务接口。创建账号、加入项目、赋予业务权限是不同步骤，不能用其中一个代替另一个。

## 给 LLM 与自动化工具

从 [`llms.txt`](/llms.txt) 进入任务索引，读取当前版本的具体页面、参数表和完整示例。页面上的 **原始 Markdown** 链接不需要读取站点 HTML。结构化契约保留真实命令、输入 schema 和版本来源；它们不是运行时行为和权限说明的替代品。

不要猜测命令或盲目接受发布警告。先确认目标实例、项目和身份，检查现有状态，再执行测试、变更和发布。真实外部消息、模型调用和设备动作应显式启用；清理只能作用于自己创建的示例对象。

## 本站与离线手册

这里的中英文页面共享文档 ID、契约和示例来源。同一内容还会导出为随产品版本固定的离线书，保留内网部署的 `/_docs/` 使用方式。线上最新页面不应覆盖旧部署的实际行为；遇到差异时以对应版本的参考和已核实限制为准。
