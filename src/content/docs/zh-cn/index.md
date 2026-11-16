---
title: Viat 产品手册
description: 从安装和首个接口开始，查阅 Viat 的配置、资源、脚本、工作流、触发器和操作参考。
doc_id: handbook.index
verified_release: '1.1.0'
channel: stable
---

# Viat 产品手册

Viat 把**资源连接、脚本和工作流**变成一组可调用的 HTTP 接口和可触发的定时任务:
你在控制台或 CLI 里写一个函数、绑一条路由、点一次发布,它就变成一个带认证、
日志和版本的线上 API。

![控制台中的项目总览](/screenshots/zh-cn/projects.png)

上方截图来自本地演示实例:登录后先看到项目列表,进入一个项目就能管理它的
脚本、端点与发布。想在 10 分钟内走完"安装 → 发布第一个接口 → 调用成功",
直接从下面第一条路径开始。

## 按目标选择路径

| 你的目标 | 阅读路径 |
| --- | --- |
| 快速发布第一个 HTTP 接口 | [Docker Compose 安装](installation/docker-compose.md) → [激活实例](instance/activation.md) → [第一个端点](getting-started/first-endpoint.md) |
| 判断 Viat 是否适合当前任务 | [平台定位](overview/platform.md) → [核心概念](overview/concepts.md) → [能力与限制](overview/capabilities.md) |
| 用脚本/工作流对接数据库、API、模型 | [资源总览](assets/resources/index.md) → [脚本](assets/scripts/python.md) → [工作流](assets/workflows/overview.md) |
| 让任务定时/按事件自动执行 | [调度](triggers/schedules.md) → [HTTP 触发](triggers/http.md) → [队列触发](triggers/queues.md) |
| 在手机或 Mac 上使用客户端 | [客户端安装](installation/clients.md) |
| 用 CLI 或 MCP 自动化一切 | [CLI 总览](cli/overview.md) → [MCP 总览](mcp/overview.md) |

配置、资产、触发器、运维和应用案例按主题出现在侧栏。未完成的内容不会以
空白占位页伪装成可用参考;重建期间完整覆盖清单仍是发布门槛。

## 三个先决概念

1. **平台账号与项目角色是两回事。** 平台账号用于登录控制台和 CLI;项目内的
   `owner`/`admin`/`developer` 角色决定你能编辑、发布哪些项目。详见
   [核心概念](overview/concepts.md)。
2. **编辑草稿不等于对外发布。** 外部调用方访问的永远是**已发布快照**;改完
   代码需要再次发布才会生效。
3. **服务端与客户端版本独立。** 本手册基线为 server/CLI **1.1.0**;原生客户端
   另有版本号。预览功能单独标注,未发布的能力不会写成安装前提。

> [!NOTE]
> 给 LLM 与自动化工具:从 [`llms.txt`](/llms.txt) 进入任务索引;每个页面顶部
> 有**原始 Markdown** 链接,无需解析站点 HTML。执行前先确认实例、项目与身份;
> 不要猜测命令或盲目接受发布警告。

## 本站与离线手册

这里的中英文页面共享文档 ID、契约和示例来源。同一内容还会导出为随产品版本
固定的离线书,保留内网部署的 `/_docs/` 使用方式。线上最新页面不应覆盖旧部署
的实际行为;遇到差异时以对应版本的参考和已核实限制为准。
