---
title: "管理认证与身份边界"
description: "平台会话、项目协作者、终端用户管理、密钥轮换和离职处理。"
doc_id: auth.management
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# 管理认证与身份边界

## 先确定身份平面

Viat 有三套独立身份;同一邮箱出现在两处**不代表**账号自动关联。

| 平面 | 账号与凭据 | 权限来源 |
| --- | --- | --- |
| 平台账号 | 控制台/CLI 用户;平台访问 JWT、刷新令牌或 `vis_pat_` PAT | 平台角色 + 显式项目成员关系 |
| 项目协作者 | 平台账号在某项目中的成员关系 | 成员角色 `owner`/`admin`/`developer`/`operator` |
| 项目终端用户 | 项目用户库中的记录;密码/社交/OIDC/JWT/API key 身份 | 项目业务角色、`is_admin`、授权规则 |

平台角色与成员角色用**相同四个值但分开授予**。平台 Owner **不会**自动
成为所有项目成员;项目创建者成为该项目 Owner;项目用户的
`is_admin: true` **不代表**控制台管理员,也不能经 `/projects/...` 改脚本。

分别参阅[项目协作](../projects/create-and-collaborate.md)、
[端点认证](endpoints.md)、[PAT](pats.md)与[授权模型](authorization.md)。
本页管理路由经源码核对——**不代表**产品提供完整管理 OpenAPI;项目
OpenAPI 描述的是已发布项目端点。

## 平台密码会话

前提:实例已激活、HTTPS、已有平台账号。公开注册受部署策略限制——先看
`GET /auth/config`,不要假设 `/auth/register` 永远开放。

以下请求按源码编写、**未执行**;`BASE` 为实例地址,变量放隔离测试账号的
凭据,不是生产密码。

```sh
curl -sS "$BASE/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"developer@example.invalid","password":"REPLACE_WITH_DISPOSABLE_PASSWORD"}'
```

- `POST /auth/login` 必须提供 `email`、`password`。成功 JSON 含
  `access_token`、`refresh_token`、`refresh_expires_at`、`user_id`、
  `email`,以及**仅此一次显示**的 `overview_token`。管理请求发
  `Authorization: Bearer $PLATFORM_ACCESS_TOKEN`。密码正确也可能先收到
  `401 mfa_required`/`mfa_enrollment_required` + `mfa_ticket`——完成
  [MFA](mfa.md) 才有会话。
- `POST /auth/register` 接受 `email`、`password` 与可省略/null 的
  `display_name`;它创建**平台账号**,不是项目客户。初始化、邀请与角色
  限制见[平台用户](../instance/platform-users.md)。

| 路由 | 输入 | 输出与影响 |
| --- | --- | --- |
| `GET /auth/whoami` | 平台 bearer | 公开账号身份/角色;不返回密码或令牌集合 |
| `POST /auth/refresh` | `{"refresh_token":"$PLATFORM_REFRESH_TOKEN"}` | 新访问/刷新对;绝对刷新有效期不变;**不含** `overview_token` |
| `POST /auth/logout` | 同上刷新令牌请求体 | 即使未知也返回 `{"ok":true}`;撤销该刷新记录;未轮换记录还会撤销该次登录的概览读取令牌 |
| `POST /auth/logout-all` | 平台 bearer | `{"ok":true,"revoked":N}`;撤销其他刷新会话(有当前 `sid` 时保留它);删除所有概览令牌 |
| `GET /auth/sessions` | 平台 bearer | 会话清单;用返回的 ID,不用令牌字符串 |
| `DELETE /auth/sessions/{id}` | 平台 bearer | 撤销**本人**拥有的会话;不能撤销任意他人会话 |
| `PUT /auth/password` | `old_password`、`new_password`、可选 `code` | 替换密码并返回新登录结果;已启用 MFA 时必须给当前验证码/恢复码 |

> [!WARNING]
> 刷新是**轮换**,不是可并行复用的长期令牌:原子保存最新令牌对、串行
> 刷新;重放已轮换的刷新令牌可能撤销账号的刷新会话与概览读取令牌。删除
> 刷新记录 ≠ 已签发 JWT 立即失效;退出也不是销毁所有 bearer 副本——
> 限制访问令牌寿命才是正解。

`vso_` 概览令牌只能对当前成员项目读 `GET /projects/{slug}/overview`:
不能编辑、不能读任意管理集合、不能调项目端点,也不是 PAT;刷新不会再次
显示。以上是**服务器**退出行为——CLI 的 `viat auth logout` **仅清除本地**
legacy/access/refresh 字段,保留 `project_token`。离职要显式撤销服务器
会话,并单独处理项目凭据。

## 实际项目成员权限

| 操作 | 项目成员角色要求 |
| --- | --- |
| 读项目设置、成员、资源元数据 | 任意成员(含 `operator`) |
| 读端点列表/详情、端点树 | `owner`/`admin`/`developer`——**不是**所有成员可读 |
| 认证器、角色、项目用户、授权模型读写 | 编辑者(`owner`/`admin`/`developer`) |
| 编辑脚本/工作流/资源/端点 | 编辑者 |
| 发布;项目设置与成员修改 | `owner` 或 `admin`(仍受成员提权限制) |

实例用户/SSO 管理检查的是**平台角色**,不是项目角色。菜单可见 ≠ 请求
有权:Operator 能读项目元数据,但 `GET /projects/demo/trees` 会 `403`;
Developer 能编辑端点但不能发布。移除项目成员后,即使 PAT 仍在,也不再
有该项目的管理权限。

## 项目终端用户管理

- 两个入口:控制台/API 编辑者用 `/projects/{slug}/users`;项目管理员应用
  用 `/p/{slug}/_users`。两者都**不是**平台 `/users`。命令见
  [CLI 项目用户](../cli/user.md)与[委托用户管理](../cli/p-user.md)。
- 创建 JSON:必填 `identity`;可选/null 的 `password` **或**
  `password_hash`(不能同时)、`display_name`、`email`、`phone`、`role`、
  `meta`。导入哈希支持 Argon2 PHC 或 bcrypt——**不是**任意哈希;没有凭据
  不代表用户有可用密码;`role` 必须指向已有项目角色。列表接受
  `q`/`limit`/`offset`,返回 `{items,total,limit,offset}`。
- 编辑者 `PATCH /projects/{slug}/users/{identity}`:省略资料字段保持,
  显式 `null` 清空 `display_name`/`email`/`phone`;提供 `meta` 是**整体
  替换**,不是递归合并。委托 `PUT /p/{slug}/_users/{identity}/meta`
  接受 `{meta,merge}`:`merge` 默认 true 只**浅合并**顶层键,false 则替换。
  密码替换必须且只能选 `password`/`password_hash` 之一;激活/管理员控制
  分别接受 `{"is_active":false}`/`{"is_admin":true}`;用户自助改密走
  `POST /p/{slug}/auth/password`。
- 委托 `_users` 要求当前项目用户具有项目管理权限:只管理**本地密码**
  身份(拒绝 `jwt:`/`oidc:`/`social:`);不能授予管理员角色;不能删除/
  停用自己或改自己的角色。端点 `project_users_grant` 可限定脚本侧用户
  操作范围——**不会**把调用者变成平台编辑者。委托写操作记录审计;
  登录请求里自行加 `is_admin` 不会授予权限。

## 轮换与离职检查单

1. 分别盘点:管理会话/PAT、项目成员、终端用户/API key、IdP 客户端、
   认证器上游秘密、资源凭据。
2. 泄露时撤销 PAT/key,**不只是改名**;创建替代凭据 → 更新消费者 →
   验证 → 撤销旧凭据。创建的秘密通常只显示一次,列表无法恢复。
3. 移除协作者成员关系,并**单独**停用其项目用户——同邮箱不会传播这些
   操作。
4. 项目密码泄露时更换密码:项目会话 epoch 使旧登录令牌及相关刷新/code/
   MFA 状态失效。仅撤销 API key **不会**抹掉已换取的 JWT。
5. 显式撤销平台刷新会话/概览读取令牌;本地 CLI 退出不是服务器撤销;
   单独删除 `project_token` 与 CI/部署里的凭据副本。
6. 按各参考页轮换上游/资源秘密;安全备份实例加密密钥/secret backend——
   只换钥不重加密会让已有秘密不可读。
7. 同时验证允许与拒绝案例;审计时**不要**把令牌复制进日志或工单。

不得把资源秘密送给脚本,也不得放进 URL 查询参数、仓库 YAML 或截图;
秘密由平台侧应用。控制台设置与部署级参数见[实例设置](../instance/settings.md)。

## 失败与验证

管理错误通常是 `{"error":"<code>","message":"<detail>"}`:`401` =
缺少/无效/过期凭据;`403` 也可能是身份平面错、无成员关系、角色不足或
PAT 项目作用域不符;`404` = 项目/对象不存在。先核对 `whoami`、当前项目
与成员关系——**不要**用"把已发布端点改成匿名"来修编辑权限。

## 核验依据

契约源码 `03751a67`:`crates/viat-api/src/{dto.rs,middleware_auth.rs,handlers/auth.rs,handlers/project_users.rs,handlers/project_user_admin.rs}`、`crates/viat-core/src/types/project.rs`、`crates/viat-cli/src/commands/auth.rs`。示例仅完成源码检查、未执行;本页没有创建账号、SSO 提供方或远端清理任务。
