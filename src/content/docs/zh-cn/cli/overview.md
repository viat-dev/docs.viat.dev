---
title: "CLI 完整参考"
description: "Viat 1.1.0 CLI 的 144 个命令、语法、权限、输出、副作用与恢复索引。"
doc_id: cli.overview
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# CLI 完整参考

此参考对应稳定服务端/CLI 1.1.0：固定 Clap 合同共有 171 个节点、144 个叶命令。结构来自 contracts/1.1.0/cli.json，行为核对实际 CLI、仓库同步与 API 权限实现（功能源码 03751a67，版本发布提交 fd340879），不是从预览分支或历史计划推测。CLI 版本与桌面/移动客户端营销版本独立。

## 命令分组

- [viat apikey](apikey.md) — 3 个叶命令
- [viat audit](audit.md) — 2 个叶命令
- [viat auth](auth.md) — 6 个叶命令
- [viat authorizer](authorizer.md) — 5 个叶命令
- [viat authz](authz.md) — 2 个叶命令
- [viat db](db.md) — 4 个叶命令
- [viat endpoint](endpoint.md) — 12 个叶命令
- [viat files](files.md) — 4 个叶命令
- [viat license](license.md) — 2 个叶命令
- [viat logs](logs.md) — 4 个叶命令
- [viat p-user](p-user.md) — 11 个叶命令
- [viat project](project.md) — 10 个叶命令
- [viat publish](publish.md) — 5 个叶命令
- [viat resource](resource.md) — 9 个叶命令
- [viat role](role.md) — 5 个叶命令
- [viat schedule](schedule.md) — 8 个叶命令
- [viat script](script.md) — 12 个叶命令
- [viat push / pull / export / import](sync.md) — 4 个叶命令
- [viat testcase](testcase.md) — 8 个叶命令
- [viat tree](tree.md) — 5 个叶命令
- [viat user](user.md) — 14 个叶命令
- [viat version / call / mcp](utilities.md) — 3 个叶命令
- [viat workflow](workflow.md) — 6 个叶命令

## 安装、版本与本地前提

使用已发布 1.1.0 viat 二进制并放在 PATH。macOS 正式应用附带的 viat、viat-test-host、viat-endpoint-test-host 位于 Viat.app/Contents/MacOS；应用安装后的 Resources/install-cli.sh 可安装同级链接（本参考不执行安装）。本地测试 host 必须与 CLI 完全同版本，uv/bun/cargo 等语言工具不会由 CLI 自动提供。先 viat --version（本地）、需要服务端比较时用 viat version；不要把 --version 成功当成登录/服务端就绪。

## 会话、目录与网络约定

会话查找顺序：VIAT_CONFIG_DIR（指向配置目录本身）→ 从 CWD 向上找实际含 config.yaml 的 .viat → CWD/.viat。文件为 config.yaml，键有 server_url、access_token、refresh_token、refresh_expires_at、current_project、project_token，以及兼容旧 token。access_token 优先于旧 token。配置含凭据，须限制访问，不提交仓库。登录/刷新会写回配置；普通控制面请求遇 401 可刷新一次、重试一次，并持久化轮换 token。无可用刷新时重新 auth login。

此目录发现不改变 CWD：push/pull/project diff/db 等仍以当前目录为仓库根。没有全局 --server 或 --json；只使用各叶声明的参数。-h/--help 与根 -V/--version 正常打印即退出 0；无效语法通常退出 2，尚未发 API。参数表的“无显式默认”是 Clap 结构事实，不否认下述运行时/API 默认。

普通 CLI 使用环境 HTTP_PROXY/HTTPS_PROXY/ALL_PROXY；访问本地实例可设 NO_PROXY=localhost,127.0.0.1，或 VIAT_NO_PROXY=1 绕过所有代理。普通 viat call 与 MCP 永远绕过代理，call --console 则走普通可刷新客户端并遵守代理。

## 身份、权限与结果边界

平台账号的角色不等于其项目成员角色，也不等于项目 p-user/role。有效项目角色为 owner/admin/developer/operator：editor 为前三个，publisher 仅前两个。此参考逐命令标出例外：role/authorizer/apikey/p-user/tree/endpoint 读取也需 editor，schedule 写只需成员，project publish history 读取只需成员而 endpoint history 需 publisher。API 原有检查才是权限，不能从动词推测。

控制面一般使用平台登录/PAT（auth token 管理及平台 MFA 重置只接受会话）；运行时 call 使用另存的 project_token，登录不会自动创建它。未激活部署可返回 403 license_required；换项目/角色不能激活。auth 与 license 相关入口保留可用，但启动 MCP/列工具并不证明其远程调用可用。

正常完成退出 0；运行/文件/HTTP 错误通常 1；本页各叶明确列出差异、成功空结果、持续流以及测试的非零条件。API 非 2xx 常呈 HTTP &lt;status&gt;: &lt;body&gt;，license_required/rate_limited/forbidden 有定向说明。输出不是统一结构：--json 仅在声明处有效，resource set-field --json 是输入解析，push/pull --json 仍可夹阶段文本，call 输出状态+body，apikey create 输出一次性秘密。不要把文本“FAILED”、output:null 或启动成功自动等同某种退出码/HTTP 结果。

## 合成示例的准备与清理

以下为隔离实例的语法示例，不会被文档脚本执行。账号、密码和邮箱均为合成值，不是产品默认凭据；你必须已有授权平台账号。只有主动同意远程变更后，才把地址/账号换为自己的隔离实例并执行。

```sh
viat auth login --server http://127.0.0.1:28080 --email operator@example.invalid --password demo-only-not-a-real-password
viat project create cli-demo "CLI Demo"
viat project select cli-demo
viat project list --json
```

创建后对象 ID 由服务端返回。示例 UUID 00000000-0000-4000-8000-000000000001 只是语法有效的合成占位；运行 show/delete/revoke 等前，必须用同项目 list/create 返回的真实演示 UUID 替换。不要把 request_id、execution_log_id、endpoint ID、snapshot ID、revision ID、file ID 和 API key 的短 key_id 混用。每组页补充本地文件和远程对象前提；license activate 不可能用伪 code 成功，必须取得官方有效 code。

例子 argv 的单一来源为 examples/cli-argv.json（token 数组的数组、argv[0]=viat），与页面由同一数据生成。它只供语法验证，不是可循环执行的脚本：例如 delete/rollback/trigger/baseline 不能按清单顺序跑。读/写/执行/发布分开授权，真实提供方、付费调用、发送消息、设备动作和活库清理必须另行明确同意。

各节给出验证与清理。保留修改前源码/config/数据库备份；远程多阶段命令通常不是全局事务。1.1.0 没有 project delete CLI，管理路由也没有项目 DELETE；不要编造控制台/API 删除入口。只能按已有入口清理所创建资产、触发器与成员，留下空项目；外部数据库、桶、文件和已发消息仍需分别处理。删除本地生成的夹具/导出文件前先核对路径，并单独撤销演示令牌。

## 不支持或不是本版本命令

没有 project push、tokens create、push --prune、全局 --json、旧 endpoint --permissions。使用 viat push、viat auth token create；只有 import 有 --prune。CLI/MCP 不刻意镜像全部控制台设置或 API，不能从某个 schema 推出存在某个命令。

## 维护证据

固定语法：`contracts/1.1.0/cli.json`; `crates/viat-cli/src/main.rs`. 通用客户端/配置：`crates/viat-cli/src/{client,config,pathref}.rs`. 权限定义：`crates/viat-core/src/types/project.rs:5–24`. 行为来源各组列出；源文件路径是维护证据，不替代本参考步骤。
