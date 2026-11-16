---
title: 创建项目并协作
description: 创建并选择项目、授予独立项目角色，以及安全交接或移除成员关系。
doc_id: projects.create-and-collaborate
verified_release: '1.1.0'
channel: stable
---

# 创建项目并协作

读完本页,你会有:一个新项目(含默认端点树与内置认证器)、几位角色明确的
协作者,以及一套交接/移除访问的安全做法。

核心模型一句话:**项目是端点与资产的命名空间,也是协作者的访问边界**。
平台账号即使角色再高,没有成员关系也看不到项目;项目角色与平台角色彼此
独立;业务 API 调用者走项目认证器,不在这张表里。

## 前提

- 已激活实例;CLI `1.1.0` 或浏览器控制台。
- 已有平台登录(见[平台用户](../instance/platform-users.md))。创建项目不
  要求平台 Admin:任何已认证平台用户都可创建,创建者自动成为项目
  **Owner**。
- 管理已有项目的成员,需要该项目 `owner` 或 `admin`。
- 预期协作者的平台邮箱:已有账号直接加成员,新账号走邀请。

| 项目角色 | 典型允许操作 |
| --- | --- |
| `owner` | 内容、发布、设置与成员;最后一个 Owner 不能被移除或降级 |
| `admin` | 内容管理、发布、项目设置与成员管理 |
| `developer` | 创建与编辑内容;不能发布、不能管成员 |
| `operator` | 查看项目与日志;不能编辑内容 |

## 1. 选定 slug

slug 规则:**1–64 个字符**,仅小写 ASCII 字母、数字、连字符,实例内唯一。
`hello-lab` 合法;空格、下划线、大写、非 ASCII 都不行。显示名称独立,可用
人类可读文本。

slug 会进入 `/p/hello-lab/...` 与管理 URL,且**没有重命名操作**——发给
客户端之前先定好名。

## 2. 创建远程项目并选择

在已登录的私有 CLI 目录执行:

```sh
viat auth whoami
viat project create hello-lab "Hello Lab"
viat project select hello-lab
viat project list
viat project member ls --json
```

预期依次:`created hello-lab` → `selected hello-lab` → 列表中 `*` 标记
当前项目 → 成员列表里创建者的角色为 `owner`。

创建同时会初始化:根挂载的 `default` 端点树、`public` 与 `system:scheduler`
等内置角色、`anonymous` 认证器、原生登录/注册端点。项目终端用户注册默认
**关闭**(`allow_registration: false`),与平台注册互不影响;有内置认证端点
不等于开放自助注册,也不需要把平台数据库资源交给脚本。

远程创建不生成本地仓库骨架,选择项目也不会拉取或发布任何资产;后续项目
命令使用保存的当前选择,改动前先核对。

### 替代:创建并初始化本地骨架

目标是新建受版本控制的项目时,用下面的命令**替代**前面的 `create`:

```sh
viat project init hello-lab --name "Hello Lab"
cd hello-lab
```

`init` 会创建远程项目 + 本地 `hello-lab/` 目录(`viat.yaml`、
`.viat/config.yaml` 与 `endpoints`/`scripts`/`workflows`/`schedules`/
`watches`/`ws_triggers`/`resources` 资产目录),并在该本地配置里选好项目。
目标目录必须不存在;`--here` 可在合适的空当前目录初始化,不会覆盖无关
文件。

> [!WARNING]
> 配置含会话凭据:初始化版本控制前把 `.viat/` 加入忽略并收紧权限。
> `init` 不是完全原子的远程/本地事务——后续本地步骤失败时远程项目可能已
> 创建;失败后先 `viat project list` 核实,不要盲目重跑。

## 3. 添加已有平台账号

:::tabs id=member-add

::tab 控制台

打开目标项目,进入 **Settings → Members**,选择添加已有账号,填写邮箱与
角色后保存。所有成员都能看到列表;管理控件只对项目 Owner/Admin 开放。

::tab CLI

项目 Owner/Admin 执行:

```sh
viat project select hello-lab
viat project member add colleague@example.com --role developer
viat project member ls --json
```

把邮箱换成目标已有账号,确认新行 `role: "developer"`。

:::

项目 Operator 可以读成员列表但不能写;平台 Admin 若没有目标项目权限,
同样执行不了这个操作。

## 4. 邀请新账号直接加入项目

对还没有平台账号的邮箱:

```sh
viat user invite --email teammate@example.com --display-name "Teammate" --project hello-lab --role operator
```

`--project` 与 `--role` 成对出现:即使邀请者只是平台 Operator,只要是本项目
Owner/Admin 就能走这条路。它同时创建平台账号和成员关系,**不**创建项目终端
用户。不带 `--project` 的邀请要求平台 Admin/Owner,且不建立成员关系。

> [!WARNING]
> 初始密码只在 `temp_password` 里显示一次,用批准的带外渠道传递;这是账号
> 创建,不保证发邮件。接收人登录后改掉初始密码并确认项目可见。不要把生成
> 的秘密放进截图或问题报告。

## 5. 修改角色或交接所有权

```sh
viat project member set-role colleague@example.com admin
viat project member ls --json
```

`set-role` 的邮箱和角色都是**位置参数**——与使用 `--role` 的
`member add` 不同;它只改当前项目的成员角色。

交接所有权的安全顺序:先把可信成员提升为 `owner` → 验证对方确实能登录并
管理项目 → 再降级/移除前任 Owner。服务端拒绝降级或移除**最后一个
Owner**;只有还存在另一 Owner 时才允许自我移除。不要直接删成员数据库行
绕过保护。

## 6. 移除访问

```sh
viat project member rm teammate@example.com
viat project member ls --json
```

确认邮箱已从列表消失。每个项目请求都会实时重查成员关系,所以被移除者的
会话、项目限定 PAT 与 `vso_` 概览 reader 从**下一次请求**起失去该项目访问;
其项目推送设备注册随成员关系删除,重新加入后需要重新注册设备。

移除不会删除平台账号、脚本或上游服务凭据,也不回滚其已发布的变更——离职
流程若还需撤销 PAT、服务凭据和业务 API 身份,分别检查。

## 仓库同步边界

成员关系有意**不**随 `viat push`/`pull` 携带:拿到工作副本不等于获得协作者
访问。项目设置里也有仅控制台/API 暴露的字段,不要假定一切都在
`viat.yaml`。

对共享项目启用仓库同步前,先拉到受控工作副本并检查 `viat project diff`。
`push` 是镜像语义,可能移除本地没有的服务端对象;从不完整目录发布单个实验
文件并不安全。发布与同步/编辑是独立操作;[第一个端点](../getting-started/first-endpoint.md)
的远程命令流程可避开这类歧义。

## 失败处理

| 问题 | 处理 |
| --- | --- |
| `slug already taken` | 换名或改用预期的已有项目,不要反复重建 |
| slug 无效 | 用 1–64 个小写 ASCII 字母、数字或连字符 |
| `project not found or not accessible` | 核对实例、邮箱与成员关系;`select` 按可见列表校验 |
| 添加成员找不到用户 | 用 `--project --role` 邀请新账号,或改正邮箱 |
| 邀请提示邮箱已存在 | 已有账号改用 `project member add` |
| 成员写入返回 `403` | 检查当前项目的 Owner/Admin 角色 |
| 拒绝 message 含 `last_owner` | 先提升另一 Owner——这是有意的安全检查 |
| 能看项目但不能发布 | 项目角色是 `developer`/`operator`;与平台角色无关 |

## 清理

教程结束时:按[第一个端点](../getting-started/first-endpoint.md)清理创建的
端点/脚本;移除临时协作者但保留至少一个 Owner;完成后清掉本地会话凭据。
CLI 没有 `project delete` 命令——不要编造,也不要直接删平台数据库行当捷径。

## 核验依据

契约源码 `03751a67`:`crates/viat-api/src/handlers/projects.rs`、`crates/viat-db/src/{projects,default_auth}.rs`、迁移 `0054_project_auth_endpoints.sql` 与 `0061_project_default_timeout.sql`、`crates/viat-cli/src/main.rs`、`crates/viat-cli/src/commands/project.rs`。
