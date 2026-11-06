---
title: 创建项目并协作
description: 创建并选择项目、授予独立项目角色，以及安全交接或移除成员关系。
doc_id: projects.create-and-collaborate
verified_release: '1.1.0'
channel: stable
---

# 创建项目并协作

项目是端点和相关资产的命名空间，也是协作者访问边界。平台账号没有成员关系就看不到项目，即使其平台角色很高。本流程创建项目并添加协作者，同时明确区分项目终端用户。

## 前提与权限

- 已激活实例，以及 CLI `1.1.0` 或浏览器控制台访问。
- 已有平台登录，见[平台用户](../instance/platform-users.md)。创建处理器接受已认证平台用户，并把创建者设为项目 **Owner**，不要求平台 Admin。
- 管理已有项目成员需要项目 `owner` 或 `admin`。
- 预期协作者的平台邮箱。已有账号添加为成员，新账号通过邀请创建。

| 项目角色 | 典型允许操作 |
| --- | --- |
| `owner` | 内容、发布、设置和成员；最后一个 Owner 不能移除或降级 |
| `admin` | 内容管理、发布、项目设置和成员管理 |
| `developer` | 创建和编辑内容；不能发布或管理成员 |
| `operator` | 查看项目和日志；不能编辑内容 |

这些是**成员角色**，与每个人的平台 `owner`/`admin`/`developer`/`operator` 独立。业务 API 调用者使用项目认证器和终端用户角色，不使用此表。

## 1. 选择稳定 slug

项目 slug 为 **1–64 字符**，只允许小写 ASCII 字母、数字和连字符，在实例内唯一。`hello-lab` 有效；空格、下划线、大写和非 ASCII 文本无效。显示名称独立，可以使用便于人阅读的文本。

slug 会进入 `/p/hello-lab/...` 和管理 URL。发给客户端前先确定名称；本流程不提供 slug 重命名操作。

## 2. 只创建远程项目并选择

从已登录的私有 CLI 目录执行：

```sh
viat auth whoami
viat project create hello-lab "Hello Lab"
viat project select hello-lab
viat project list
viat project member ls --json
```

使用未占用 slug，并在后续始终使用同一值。预期创建输出为 `created hello-lab`，随后是 `selected hello-lab`；项目列表用 `*` 标记当前项。成员列表应包含创建者，项目角色为 `owner`。

创建还会初始化根挂载的 `default` 端点树、`public` 与 `system:scheduler` 等内置角色、`anonymous` 认证器，以及原生登录/注册端点。项目终端用户注册默认**关闭**（`allow_registration: false`），与平台注册独立。有内置认证端点不代表允许公开自助注册，也不需要把平台数据库资源交给脚本。

远程创建不会产生本地仓库骨架，选择项目也不会拉取资产或发布。项目命令使用保存的当前选择，修改前应核对。

### 替代方案：同时创建并初始化本地骨架

若目标是新建受版本控制的项目，请用本步骤**替代**前面的 create 命令：

```sh
viat project init hello-lab --name "Hello Lab"
cd hello-lab
```

`init` 创建远程项目、本地 `hello-lab/`、`viat.yaml`、`.viat/config.yaml` 和并列资产目录（`endpoints`、`scripts`、`workflows`、`schedules`、`watches`、`ws_triggers`、`resources`），并在该本地配置中选择项目。目标目录必须不存在。`--here` 在适当的空当前目录初始化，不要覆盖无关文件。

配置含会话凭据。初始化版本控制前，应忽略 `.viat/` 并保护其权限。`init` 不是完全原子的远程/本地事务：后续本地失败时，远程项目可能已经创建。失败后不要盲目重跑，先检查 `viat project list`。

## 3. 添加已有平台账号

项目 Owner/Admin 执行：

```sh
viat project select hello-lab
viat project member add colleague@example.com --role developer
viat project member ls --json
```

将邮箱改为预期已有账号，验证新行 `role: "developer"`。项目 Operator 可以读成员列表，但不能写。平台 Admin 若没有目标项目权限，也不足以执行此操作。

控制台中打开项目，进入 **Settings → Members**，选择添加已有账号，填写邮箱和角色并保存。所有成员可看列表，管理控件仅向项目 Owner/Admin 开放。

## 4. 邀请新账号直接加入项目

对于尚无平台账号的邮箱：

```sh
viat user invite --email teammate@example.com --display-name "Teammate" --project hello-lab --role operator
```

`--project` 和 `--role` 是一对参数。即使邀请者只是平台 Operator，只要是项目 Owner/Admin 就可以走此路径。它创建平台账号和成员关系，不创建项目终端用户。不带 `--project` 的邀请要求平台 Admin/Owner，且不创建成员关系。

生成的初始密码仅以 `temp_password` 显示一次，应使用批准的带外渠道传递。这是账号创建，不保证发邮件。请接收人登录、修改初始密码，并确认项目出现。不要把生成秘密放到截图或问题报告里。

## 5. 修改角色或交接所有权

```sh
viat project member set-role colleague@example.com admin
viat project member ls --json
```

`set-role` 的邮箱和角色都是**位置参数**，与使用 `--role` 的 `member add` 不同。它只改变当前项目成员角色。

交接所有权时，先将可信已有成员提升为 `owner`，验证对方能登录和管理项目，再按需降级/移除前任 Owner。服务端拒绝降级或移除**最后一个 Owner**；仅在还存在另一 Owner 时允许自我移除。不要直接删成员数据库行绕过保护。

## 6. 移除访问

```sh
viat project member rm teammate@example.com
viat project member ls --json
```

确认邮箱已不在列表。每个项目请求都实时重查成员关系，因此被移除用户的会话、项目限定 PAT 和 `vso_` 概览 reader 从下一次请求起失去该项目访问。其项目推送设备注册会随成员关系删除，重新加入后需重新注册设备。

移除不会删除平台账号、脚本或上游服务凭据，也不会回滚其已发布变更。离职流程若还需撤销 PAT、服务凭据和业务 API 身份，应分别检查。

## 仓库同步边界与安全协作

成员关系有意**不由** `viat push`/`pull` 携带。取得工作副本不会获得协作者访问。项目设置也存在仅控制台/API 暴露的字段，不应假定所有设置都在 `viat.yaml`。

对已有共享项目使用仓库同步前，先拉取到受控工作副本并检查 `viat project diff`。`push` 镜像同步受管理内容，可能移除本地没有的服务端对象；从不完整目录发布单个实验文件并不安全。发布与同步/编辑是独立操作。[第一个端点](../getting-started/first-endpoint.md)提供避免该歧义的远程命令流程。

## 失败处理与清理

| 问题 | 处理 |
| --- | --- |
| `slug already taken` | 换名称或选择预期已有项目，不要持续重建 |
| slug 无效 | 使用 1–64 个小写 ASCII 字母、数字或连字符 |
| `project not found or not accessible` | 核对实例、邮箱和成员关系；`select` 会按可见列表验证 |
| 添加成员找不到用户 | 使用 `--project --role` 邀请新账号，或改正邮箱 |
| 邀请提示邮箱存在 | 对已有账号使用 `project member add` |
| 成员写入返回 `403` | 检查当前项目的 Owner/Admin 角色 |
| 拒绝 message 包含 `last_owner` | 先提升另一 Owner，这是有意的安全检查 |
| 用户看得到项目但不能发布 | 项目角色可能为 `developer`/`operator`，决定因素不是平台角色 |

教程结束时，按[第一个端点](../getting-started/first-endpoint.md)清理创建的端点/脚本，移除临时协作者但保留一个 Owner，并在完成后清除本地会话凭据。CLI 没有 `project delete` 命令；不要编造，也不要直接删平台数据库行当清理捷径。

## 核验依据

契约源码 `03751a67`：`crates/viat-api/src/handlers/projects.rs`、`crates/viat-db/src/{projects,default_auth}.rs`、迁移 `0054_project_auth_endpoints.sql` 与 `0061_project_default_timeout.sql`、`crates/viat-cli/src/main.rs`、`crates/viat-cli/src/commands/project.rs`。
