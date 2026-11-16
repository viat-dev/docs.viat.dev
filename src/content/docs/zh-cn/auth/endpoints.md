---
title: "已发布端点的认证"
description: "项目登录、API key、OAuth2 授权、会话与端点认证继承。"
doc_id: auth.endpoints
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# 已发布端点的认证

两条路径,先分清:已发布调用走 `/p/{slug}/...`,管理调用走
`/projects/{slug}/...`;平台 JWT/PAT **不是**项目用户登录令牌。流程:先配
[认证器](authorizers.md) → 绑定到端点树并发布——草稿修改不改变活动快照。
认证确定"是谁";[授权门禁与行范围](authorization.md)决定"能做什么"。

以下示例均**来自源码、未执行**:使用隔离项目 `demo` 与夹具脚本 `hello`,
凭据经变量提供;示例不代表已完成提供方注册或 SSO 联调。

## 密码注册与登录

每个项目在 `/p/{slug}` 下有平台拥有的 `POST /auth/login`、
`/auth/register` 节点——**不要**用查询平台数据库的脚本替代它们。注册默认
关闭(`allow_registration: false`),由项目 Owner/Admin 在
[项目设置](../projects/settings.md)启用。

```sh
curl -sS "$BASE/p/demo/auth/login" -H 'Content-Type: application/json' \
  -d '{"identity":"fixture-user","credential":"REPLACE_WITH_DISPOSABLE_PASSWORD","authorizer":"password"}'
```

- 登录用有效身份/密码;原生入口的 `authorizer` 默认 `password`。注册必须
  提供非空 `identity` 与 `credential`,走密码认证器并受注册开关限制。
- 响应含 `token`、`expires_in`、`expires_at`、`user_id`、`project_slug`;
  启用交互会话时增加 `refresh_token`、`refresh_expires_at`。**不要**按
  平台登录的 `access_token` 字段解析。MFA 可能先返回 `401` + 票据,见
  [MFA](mfa.md)。
- 另有 `POST /projects/{slug}/auth/login`,必填
  `{authorizer,identity,credential}`,返回
  `{token,expires_in,expires_at,user_id,identity,role}` 与可选刷新字段
  ——它认证的是**项目用户**,不是协作者;不要发平台 `email/password`
  JSON。

```sh
curl -sS "$BASE/p/demo/hello?name=Reader" \
  -H "Authorization: Bearer $PROJECT_TOKEN"
```

密码登录可执行已配置的前/后钩子:前钩子拒绝或失败会**阻断**登录;后钩子
在操作提交后执行,失败只记录不回滚;钩子拿不到平台数据库凭据。停用用户
与角色变更读取**实时**状态——不信任调用者 JSON 里的角色。

## 交互会话

- `password`/`oauth_oidc`/`social` 的 `config.login_token_ttl_hours` 默认
  12(整数 1–720);它**不是** `token_ttl_hours`(`_token` 访问令牌参数)。
- 省略/null `session` = 关闭刷新会话;启用示例:

```json
{"login_token_ttl_hours":1,"session":{"idle_timeout_hours":36,"max_lifetime_hours":720}}
```

- `session.idle_timeout_hours` 必填,整数 1–8760 且 ≥ 登录令牌 TTL;
  `max_lifetime_hours` 默认 720(显式值 1–8760 且 ≥ idle)。未知 session
  键被拒绝。
- `POST /p/{slug}/_session/refresh` 与 `POST .../_session/logout` 请求体
  `{"refresh_token":"$PROJECT_REFRESH_TOKEN"}`。刷新返回 `token`、
  `expires_in`、`expires_at`、`refresh_token`、`refresh_expires_at`、
  `user_id`、`project_slug`;刷新令牌**原子替换**——重放会撤销整个会话族。
  退出始终返回 `{"ok":true}` 并结束会话族;已有访问令牌到过期前仍可用;
  关闭 session 后,既有会话在下一次刷新时失效。改密通过 epoch **立即**
  淘汰旧登录令牌。
- 自助 `POST /p/{slug}/auth/password` 必须持密码登录令牌,请求
  `{"current":"...","new":"...","code":"..."}`;启用且已登记 MFA 时需要
  `code`。机器 API key 不能改所属用户的密码。

## API key 与客户端凭据交换

编辑者创建 `api_key` 认证器与项目用户后调用:

```sh
curl -sS "$BASE/projects/demo/authorizers/machine/keys" \
  -H "Authorization: Bearer $PLATFORM_ACCESS_TOKEN" -H 'Content-Type: application/json' \
  -d '{"project_user_id":"11111111-2222-4333-8444-555555555555","name":"fixture-worker","expires_at":null}'
```

- `project_user_id`、`name` 必填;省略/null `expires_at` 表示不设到期。
  用户与认证器必须属于当前项目,认证器必须是 `api_key`。
- 创建返回公开元数据与**仅显示一次**的完整 `token`:
  `vsk_<key_id>.<secret>`。`GET .../keys` 找不回秘密;
  `DELETE .../keys/{key_id}` 撤销。用实际创建返回的令牌,不要用示例
  UUID。

可以直接 `Authorization: Bearer $API_KEY`,也可以拆成两部分换取 OAuth2
令牌:`client_id` 是**不含** `vsk_` 的 `<key_id>`,`client_secret` 是点号
之后的部分。

```sh
curl -sS "$BASE/p/demo/_token" \
  -u "$API_KEY_ID:$API_KEY_SECRET" \
  --data-urlencode 'grant_type=client_credentials'
```

- 入口接受标准表单或 JSON `{grant_type,client_id,client_secret}`;同时
  提供时 HTTP Basic 优先。成功返回
  `{access_token,token_type:"Bearer",expires_in}` 并带
  `Cache-Control: no-store`。
- API-key 认证器 `token_ttl_hours` 默认 1,签发时夹在 1–24 小时;此
  grant **不返回**刷新令牌。
- 项目不符、key 过期/撤销、用户停用都折叠为 `invalid_client`——**不能用
  它枚举账号**。
- 撤销 key 阻止之后的使用/交换;但已换到的 JWT 不是原 key——考虑其剩余
  寿命。**禁止**把 key 放查询参数;平台 PAT 不能当 `client_secret`。

## 项目作为 OAuth2/OIDC 提供方

这与"接受外部 OIDC 认证器"是两回事。Owner/Admin 配置稳定的
`VIAT_PUBLIC_URL` 并启用项目 IdP 后,`POST /projects/{slug}/oauth-clients`
创建客户端:

```json
{"name":"fixture-web","redirect_uris":["http://127.0.0.1:8080/callback"],"public":true,"allowed_scopes":["openid","profile","email"],"audience":null}
```

- 必填:非空 `name`、非空且**精确**的 `redirect_uris` 列表(URL 可解析、
  禁 fragment/通配符、HTTP 仅限 loopback)。处理器并未把所有非 HTTP
  scheme 限制为 HTTPS——原生自定义 scheme 不会被这项检查拒绝;网页客户端
  应使用 HTTPS。`public` 默认 false:公开客户端无秘密且**必须**用 PKCE;
  机密客户端的 `client_secret` 仅创建时显示。
- `allowed_scopes` 默认 `["openid","profile","email"]`,每项非空且不含
  空格。`audience` 省略/null 为 `project:<slug>`;自定义 audience 的令牌
  供**外部资源服务器**使用,**不被 Viat 自身接受**。
- `PATCH .../{client_id}` 部分更新 `name`/`redirect_uris`/
  `allowed_scopes`(列表整体替换);`audience` 省略保持、null 重置、字符串
  设置;**不能** patch 客户端类型。删除为 `DELETE .../{client_id}`。
- 发现文档 `GET /p/{slug}/.well-known/openid-configuration`;JWKS
  `GET /p/{slug}/.well-known/jwks.json`。
- 授权码流程:浏览器访问 `GET /p/{slug}/_authorize`,带
  `response_type=code`、创建返回的 `client_id`、精确注册的
  `redirect_uri`、请求的 `scope`、随机 `state` 与 PKCE
  `code_challenge`/`code_challenge_method=S256`——**授权页不是访问令牌
  本身**。
- 交换:向 `_token` 传 `grant_type=authorization_code`、`client_id`、
  `code`、相同 `redirect_uri`、`code_verifier`;机密客户端另用秘密认证。
  刷新传 `grant_type=refresh_token`、`refresh_token` 及适用的客户端认证;
  **保存轮换后的刷新凭据**。用 bearer 读 `_userinfo`(支持的端点以发现
  文档为准)。`openid`/`profile`/`email` 是 OIDC 信息披露范围,**不是**
  项目授权规则的授予。提供方退出是 `GET /p/{slug}/_logout`,不是平台
  退出。
- 签名密钥:`GET /projects/{slug}/idp/keys` 列表;`POST .../rotate` 新增
  签名钥;经消费者/令牌重叠期后 `POST .../{kid}/retire` 退役旧钥。它们
  不是可导出的资源秘密。关闭 IdP 会隐藏 discovery/JWKS、停止 ES256
  签发但保留密钥行——已签发令牌本地仍可验证至过期;外部验证方要单独
  规划 JWKS 可用性与轮换。

## 认证器继承是替换

编辑者调用 `PUT /projects/{slug}/endpoints/{id}/auth`:

```json
{"allowed_authorizers":["password","machine"],"authz_gates":[{"type":"report","action":"read"}],"override_authorizers":false,"override_permissions":false}
```

- `allowed_authorizers` 是**认证器名称,不是角色**。最近节点的非 null 列表
  **替换**祖先列表;`[]` 拒绝所有调用;null/省略表示**继承**(不是"保持
  原字段");无列表时 `override_authorizers:true` 截断继承并拒绝所有人。
- 相反,`authz_gates` 沿祖先**累积**:省略键保持已有门禁;null 删除本地
  声明/继承;`[]` 仅声明本地无门禁,**不清除**祖先门禁;
  `override_permissions:true` 停止向上累积。
- 两个布尔字段每次请求默认 false——**务必显式发送期望值**。已退役的非空
  `required_permissions` 被拒绝,不再执行。

修改后:查看发布计划 → 发布 → 验证"必须通过的调用者"与"必须拒绝的调用者"。
草稿匿名测试成功**不能**认定线上门禁有效。

## 拒绝案例与恢复

| 案例 | 说明 |
| --- | --- |
| 平台 PAT | 即使限定当前项目,也不会变成项目用户 |
| 认证器不在发布列表 | 项目令牌有效,但其认证器不在已发布路由的有效列表中,仍被拒 |
| 匿名认证器 | 添加它是**公开访问决策**,不是修过期令牌;无法识别的 bearer 可解析为匿名——允许匿名的路由不是"所有无效令牌必拒绝"服务 |
| 门禁失败 | 身份有效但门禁失败在运行前拒绝;角色名叫 `admin` 不等于自动能读所有行 |
| OAuth 错误形状 | `{error,error_description}`(如 `invalid_client`、`invalid_grant`、`unsupported_grant_type`),不同于普通 `{error,message}`;限流是 `429` + `Retry-After` |

清理要显式做:撤销隔离 key/client、删除夹具用户/端点并发布预期移除——
清空 shell 变量**不等于**撤销。参阅 [CLI auth](../cli/auth.md)、
[API key](../cli/apikey.md)、[端点命令](../cli/endpoint.md)。

## 核验依据

契约源码 `03751a67`:`crates/viat-api/src/{lib.rs,auth_native.rs,middleware_project.rs,project_session.rs,handlers/project_token.rs,handlers/idp_oauth.rs,handlers/oauth_clients.rs,dto.rs}`、`crates/viat-db/src/endpoints.rs`。未执行网络/提供方流程。
