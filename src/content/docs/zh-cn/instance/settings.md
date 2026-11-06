---
title: "实例与账号设置"
description: "控制台设置、部署专属配置、平台 SSO 与账号安全管理。"
doc_id: instance.settings
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# 实例与账号设置

实例管理不是一个通用可写 settings 对象。控制台区分激活、平台用户、身份提供方、账号安全/会话和实例观测；进程配置来自部署环境，不存在可凭空使用的 `PUT /settings`。[项目设置](../projects/settings.md)只影响单个项目，平台角色决定实例管理权限。

## 设置地图与权限

| 界面 | 实际路由/权限 | 持久化与影响 |
| --- | --- | --- |
| 激活 | `GET /license`、`POST /license/activate`，见[激活](activation.md) | 需要匹配官方镜像的有效激活码，不是供应商签发 |
| 平台用户 | `/users`、`/users/invite`、`/users/{email}/role`，见[平台用户](platform-users.md) | 平台账号/角色，不是项目终端用户 |
| 平台 OIDC | `/admin/oidc-providers`，**平台 Owner** | 提供方注册、加密秘密及登录策略 |
| 账号安全 | `/auth/mfa`、`/auth/password`，适用时要求交互会话 | 当前账号密码/因素，见 [MFA](../auth/mfa.md) |
| 会话与 PAT | `/auth/sessions`、`/auth/tokens` | 独立刷新会话和长期管理令牌 |
| 实例 | `GET /admin/instances`，平台 Owner/Admin | 只读活动节点清单，不提供重启/升级 |
| 工作池观测 | `/admin/pool/stats`、`/admin/pool/stats/cluster`，平台管理权限 | 运行观察，不是持久配置替换 |

真实平台角色为 `owner`、`admin`、`developer`、`operator`。项目 Owner 不自动是实例 Owner；平台 Owner 不绕过项目显式成员关系。普通项目成员也不一定能读端点/树，这些读取要求编辑者。[管理身份](../auth/management.md)解释完整边界。

## 仅部署可改的配置

`DATABASE_URL`、`VIAT_PUBLIC_URL`、令牌/加密密钥、注册/MFA 策略、运行时限制、保留期、存储及网络信任，应通过部署环境/秘密机制管理。控制台不是环境文件编辑器。进程参数可能要求受控重启/重部署，不会隐式重新加密已有秘密或删除历史载荷。迁移/恢复时保留原始加密材料。

启用项目 IdP、登记回调时，`VIAT_PUBLIC_URL` 必须是稳定外部 URL，含有意设置的部署前缀。不能让随意请求 Host 成为身份 issuer。私网/私有 CA 需要所有参与验证者/提供方实际信任和可达，接受字符串配置不是连接验证。不要靠关闭 TLS 验证“修复”登录。

环境默认值及重启规则见已有[配置参考](../configuration/overview.md)，不要猜测新 settings 路由。激活、公开注册、MFA、上游身份是独立前提；激活成功不表示允许自助注册。

## 平台 OIDC 提供方

这些路由为**平台账号**登录控制台/CLI，不是项目 `oauth_oidc` 认证器，也不是国内委托平台应用。Owner 专属 `GET/POST /admin/oidc-providers`；`GET/PATCH/DELETE .../{name}`。

| 创建字段 | 默认/校验 |
| --- | --- |
| `name` | 必填，`^[a-z][a-z0-9_-]{0,62}$`，稳定路由标识 |
| `display_name` | 必填字符串，登录按钮名称 |
| `issuer` | 必填 URL，HTTPS 或 localhost/127.0.0.1 HTTP，创建会主动请求 discovery |
| `client_id` | 必填提供方 client 标识 |
| `client_secret` | 可选/null/空为无秘密，非空加密保存 |
| `scopes` | 可选/null **空格分隔字符串**，默认 `openid profile email`，校验要求包含 openid（大小写不敏感） |
| `audience` | 可选/null 提供方 audience |
| `default_role` | 可选/null 默认平台 `operator`，真实四个角色之一 |
| `trust_email_claim` | 可选/null 默认 true，应按提供方邮箱保证显式决定 |

**源码推导、未执行**的 Owner 请求（真实执行时会访问 discovery）：

```sh
curl -sS "$BASE/admin/oidc-providers" \
  -H "Authorization: Bearer $PLATFORM_ACCESS_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"fixture-sso","display_name":"Fixture SSO","issuer":"https://identity.example.invalid","client_id":"fixture-console","client_secret":"REPLACE_WITH_PROVIDER_SECRET","scopes":"openid profile email","default_role":"operator","trust_email_claim":false}'
```

公开选择器为 `GET /auth/oidc/providers`，浏览器 start/callback 为 `GET /auth/oidc/{name}/start`、`/callback`，须在提供方登记精确 callback。`POST /auth/oidc/exchange` 完成一次性 Viat 交接；CLI 使用自己的 `POST /auth/oidc/{name}/cli-init`、`GET .../cli-poll`。优先使用 [CLI 登录](../cli/auth.md)，不要手工拼内部交接码。公开选择器/详情不暴露提供方秘密。`trust_email_claim` 影响身份关联，不能为合并同邮箱而信任不可信 issuer。

PATCH 可选 `display_name`、`issuer`、`client_id`、`scopes`、`default_role`、`trust_email_claim`，省略/null 保持。issuer 修改重新校验和 discovery。DTO 的 `client_secret` 为嵌套 Option，**实际反序列化将显式 null 视为省略**（没有 double-option 自定义处理），尽管注释说 null 清除。非空字符串替换，`""` 清除。`audience` 有相同 null/omit 限制，本版本显式 null 不是可靠 reset。不要把项目设置 null-reset 规则套用到此接口。provider `name` 固定。

改变/删除提供方不会自动注销已创建平台账号、PAT 或项目成员关系，必须分别盘点撤销。删除唯一 SSO 前验证另一个 Owner 登录。本页未测试真实注册、discovery/SSO、code 交换或身份关联。

## 实例清单与版本核对

`GET /admin/instances` 返回当前活动节点数组 `{id,hostname,version,started_at,last_heartbeat_at}`，按启动时间排序。旧/未上报版本可能为 null，不代表升级成功。控制台每 15 秒刷新并提示混合版本。这是心跳窗口，不是历史资产清单或负载下 readiness 证明。节点缺失可能是停止/过期/不可达，应调查服务与数据库，不要删行“修复”。

**源码推导、未执行**的读取：

```sh
curl -sS "$BASE/admin/instances" -H "Authorization: Bearer $PLATFORM_ACCESS_TOKEN"
```

将每个预期服务节点版本与部署稳定版核对，客户端另有版本体系。该接口不能推镜像、改配置、重启 worker，也不证明 TLS/设备/提供方互通。

## 账号秘密与安全变更步骤

1. 修改 issuer、注册或 MFA 策略前，准备第二个 Owner 恢复路径并备份配置/加密数据钥。
2. 每次只改一个面，检查 `whoami`、真实成员关系、因素状态及**新建**会话；缓存登录可能掩盖后续登录已坏。
3. 泄露时 PAT 与会话分别撤销；CLI 退出仅本地且保留项目 token；项目客户身份再次独立。
4. 截图、日志、导出配置须脱敏，资源秘密在平台侧，不能作为补丁发送给脚本。
5. 回退实际部署/提供方配置，不要假设端点回滚恢复实例设置。写管理操作留审计。

无效凭据为 `401`、平台角色不符 `403`、提供方校验/discovery 失败 `400`、提供方不存在 `404`。即使有项目操作权限，Operator 仍应不能看实例拓扑；Developer PAT 也不能通过不可访问路由的 `default_role` 给自己 Owner。

未执行测试/构建/安装、环境修改、网络、提供方操作或清理。**依据：** `crates/viat-api/src/{dto.rs,handlers/admin_oidc_providers.rs,handlers/platform_oidc.rs,handlers/admin_instances.rs,middleware_auth.rs}`、`web/src/pages/settings/{InstancesPage.tsx,SecurityPage.tsx,SessionsPage.tsx}`、`web/src/pages/projects/ProjectSettingsPage.tsx`。OIDC null-reset 差异来自实现，不是虚构支持操作。
