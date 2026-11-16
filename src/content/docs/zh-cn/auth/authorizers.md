---
title: "认证器参考"
description: "全部认证器类型、配置、秘密更新规则及外部登录边界。"
doc_id: auth.authorizers
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# 认证器参考

认证器属于一个项目,记录调用者**通过什么方式进入**。它不是业务角色、不是
资源凭据,也不是平台 SSO 提供方。所有操作——**含列表/详情读取**——都要求
项目编辑者成员(`owner`/`admin`/`developer`)。端点准入还要单独配置并发布,
见[端点认证](endpoints.md)。

## 管理请求与更新语义

`GET/POST /projects/{slug}/authorizers`;
`GET/PUT/DELETE .../authorizers/{name}`。

- 创建必填 `name`(1–64 字节)与 `kind`;可选 `config`(默认 JSON null)、
  可选/null `default_role`(指向已有角色)、可选/null `secret`(类型专用
  秘密)。有配置要求的类型应传对象——省略 config **不会**绕过校验。
- 响应字段 `id`、`project_id`、`name`、`kind`、`config`、
  `default_role_id`、`created_at`、`updated_at`——**不返回秘密/密文**。
- 更新**不能**改名或改 kind:省略/null `config` 保持,提供对象**整体
  替换**;省略/null `default_role` 保持,`""` 清除,非空名称解析已有角色;
  省略/null secret 保持已有秘密(委托社交转换例外,见下)。
- **原地轮换,不要删除重建**:删除认证器会级联删除其 API-key 关系——不是
  无害的改名。

源码推导、未执行的创建示例:

```sh
curl -sS "$BASE/projects/demo/authorizers" \
  -H "Authorization: Bearer $PLATFORM_ACCESS_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"machine","kind":"api_key","config":{"token_ttl_hours":1},"default_role":"public"}'
```

| `kind` | 凭据/入口 | 配置与边界 |
| --- | --- | --- |
| `password` | 原生身份/密码登录 | `failure_backoff`、交互会话配置;无资源秘密 |
| `anonymous` | 未建立身份的请求 | 必须通过具名匿名认证器显式公开;不创建终端用户 |
| `api_key` | `Bearer vsk_...` 或 `_token` 客户端凭据 | `token_ttl_hours` 默认 1,签发范围 1–24;key 属于项目用户 |
| `oauth_oidc` | 浏览器跳转外部 OIDC | issuer/client/scopes/redirect、加密 client secret、交互会话配置 |
| `jwt` | 外部非对称 JWT bearer | 必填 issuer/audience;PEM/JWKS 二选一 |
| `social` | 服务器兑换提供方授权码 | 提供方专用配置/秘密、可选平台应用委托、交互会话配置 |
| `chat` | 平台为已绑定聊天发送者创建 | 首次绑定时创建;**不能**手工创建;保留名称 `chat` 也被拒绝 |

`default_role` 由适用的用户创建流程使用,**不是**"每次请求覆盖所有已有
用户角色"的指令。聊天绑定的调用归属应是平台 `chat` 行,而不是当初用于
证明绑定的密码认证器。

## 密码失败退避与会话

- 省略/null `failure_backoff` 默认
  `{after_failures:5,max_delay_secs:900}`;内部 `after_failures` 为 0–86400
  整数(0 = 关闭),`max_delay_secs` 为 1–86400 整数;未知内部键/错误类型
  被拒绝。
- 退避按身份**和客户端地址**记录连续失败,等待 1、2、4…秒到上限,成功
  清零。多个密码认证器取已启用配置中**最严格**的组合——调用者不能挑最
  宽松入口。全局身份/IP 限流仍生效。
- 密码/OIDC/社交共享交互配置:`login_token_ttl_hours` 省略/null 为 12
  (整数 1–720);`session` 省略/null 为无刷新会话,对象必须含
  `idle_timeout_hours`(1–8760,不小于 token TTL),可选
  `max_lifetime_hours`(默认 720;显式值 ≥ idle 且 ≤ 8760)。要删除/重置
  键,发送**完整替换 config**,不是局部嵌套 patch。刷新与退出见
  [端点认证](endpoints.md)。

## 外部 OIDC(`oauth_oidc`)

- 必填 `config.issuer`、`client_id`、`post_login_redirect_uri`;可选/null
  `scopes` 默认 `["openid","profile","email"]`,显式列表必须含精确值
  `openid`;`discovery_cache_ttl_secs` 可选,60–86400。issuer 必须 HTTPS
  (localhost/127.0.0.1 允许 HTTP);client ID 非空 ≤512 字节;redirect 须
  可解析为 URL。
- 秘密格式 `{"client_secret":"..."}`:创建时必填非空 ≤1024 字节;更新
  省略/null/空白**保持旧值**,不清除。

```json
{"name":"external-login","kind":"oauth_oidc","config":{"issuer":"https://identity.example.invalid","client_id":"fixture-client","scopes":["openid","profile","email"],"post_login_redirect_uri":"https://app.example.invalid/signed-in","discovery_cache_ttl_secs":3600},"secret":{"client_secret":"REPLACE_WITH_PROVIDER_SECRET"},"default_role":"public"}
```

向外部提供方登记精确回调
`BASE/projects/demo/auth/oidc/external-login/callback`。流程:浏览器入口
`GET /projects/demo/auth/oidc/external-login/start` → 回调校验
state/code/提供方令牌 → 创建/解析项目身份 → 带 Viat 登录结果重定向到
应用地址。**不能**把提供方 secret 发给浏览器;这**不是**平台账号用的
`/auth/oidc/{name}/start`。本页未测试提供方注册、发现文档连接与真实
SSO。

## 外部 JWT(`jwt`)

`issuer`、`audience` 必填非空;`subject_claim` 默认 `sub`(提供时须非空)。
密钥模式二选一:

```json
{"name":"external-jwt","kind":"jwt","config":{"issuer":"https://identity.example.invalid","audience":"fixture-api","jwks_url":"https://identity.example.invalid/.well-known/jwks.json","subject_claim":"sub"},"default_role":"public"}
```

- **PEM**:`public_key_pem` + `algorithm:"RS256"` 或 `"ES256"`,需可解析
  且匹配的公钥——上游轮换后此钥可能过时。
- **JWKS**:`jwks_url`(HTTPS 或 loopback HTTP),按令牌 `kid` 选公钥;
  支持 RS256/384/512、PS256/384/512、ES256/384。**没有**共享对称密钥
  JWT 认证器,也没有 EdDSA 模式。

令牌必须通过签名、过期、issuer、audience、subject 校验。项目身份按
认证器隔离(`jwt:<authorizer>:<subject>`)——低信任的项目管理入口**不能**
预种联邦身份;只有经过验证的 claim 能成为已声明的 subject
attrs/scope claims,**普通请求体不能**。JWKS 轮换在上游留重叠期;替换
PEM 时发送完整 config。

## 社交提供方与授权码

必填 `config.provider`、`app_id`(appid/corpid/AppKey)。可选字段:

| 字段 | 默认/规则 |
| --- | --- |
| `agent_id` | 企业微信自建应用的 agent ID;普通 WeCom 应用配置要求提供 |
| `identity_key` | 有 unionid 时优先,否则原生键;可选值见下表 |
| `scopes` | 默认见下表;各项非空、≤64 字节 |
| `qr_login` | false;WeCom 为 true 时用扫码而非客户端 H5 |
| `collect_phone` | false;需要提供方权限和手机号授权/载荷 |
| `post_login_redirect_uri` | 跳转型提供方必填有效 URL;纯 code 型不需要 |
| `api_base`、`auth_base` | 默认提供方地址;测试/出口源必须 HTTPS 或 loopback HTTP,仍受 host allowlist 限制 |
| `alipay_public_key` | 支付宝验证用 RSA 公钥,适用配置必须提供;**不是**秘密 |
| `platform_app` | 省略/null = 自有应用;否则引用当前项目兼容的平台应用 |

| 提供方 | 入口/默认 scopes | 显式 `identity_key` 可选值 |
| --- | --- | --- |
| `weixin_mp` | 微信 H5 / `snsapi_userinfo` | `unionid`、`openid` |
| `weixin_open` | 网站扫码 / `snsapi_login` | `unionid`、`openid` |
| `weixin_mini` | 仅 `wx.login` code / 空 | `unionid`、`openid` |
| `wecom` | 客户端 H5 或扫码 / `snsapi_base` | `userid` |
| `dingtalk` | 浏览器 / `openid` | `unionid`、`openid` |
| `dingtalk_app` | 仅 `dd.getAuthCode` / 空 | `unionid`、`userid` |
| `alipay` | 浏览器 / `auth_user` | `user_id`、`open_id` |
| `alipay_mini` | 仅 `my.getAuthCode` / `auth_base` | `user_id`、`open_id` |
| `douyin` | 浏览器 / `user_info` | `unionid`、`open_id` |
| `douyin_mini` | 仅 `tt.login` / 空 | `unionid`、`open_id` |
| `kuaishou` | 浏览器 / `user_info` | `open_id` |
| `kuaishou_mini` | 仅 `ks.login` / 空 | `open_id` |

秘密:非支付宝的自有应用要求 `secret.app_secret` 非空 ≤1024 字节;支付宝
用 `app_private_key`(RSA PEM/base64,≤8192 字节)+ 公开验证钥;支付宝
小程序采集手机号若需自行 AES 解密则必须有 `aes_key`。更新按字段把**非空**
社交秘密合并进已有秘密,省略/空白不抹相邻字段;切换配置后仍须具备新
提供方所需凭据。

路由与语义:

- 浏览器:`GET /p/{slug}/_social/{name}/start` 与提供方回调
  `GET .../callback`;授权码入口 `POST .../exchange` 必填 `code`,可选
  `phone_code`、`phone_data`、`client_id`、`client_secret`、`link`。
- 小程序手机号载荷因提供方而异;`collect_phone:true` **不能**伪造手机号
  许可。Viat 登录结果遵循交互会话策略。
- `link` 要求已有已认证身份:随意提交 code/自称 unionid **不能**证明账号
  所有权。unionid 受平台族/作用域限制,openid 受应用限制——不能凭裸字符
  串合并不同的人。
- 委托模式用 `platform_app` + 被授权账号 `app_id`(兼容关系见
  [平台应用](platform-apps.md))。转入委托时**移除旧应用秘密**,避免日后
  悄悄恢复;支付宝小程序手机号 AES 钥按需单独保留。转回自有应用必须提供
  有效自有秘密。

## 安全、失败与清理

- 配置通过校验**不代表**提供方联调成功:验证回调源/TLS 信任、提供方
  权限、项目角色、已发布认证器列表与拒绝案例。
- 常见错误:配置错 `400`、同名冲突 `409`、对象不存在 `404`、编辑权限
  不足 `403`;登录/交换还可能因 state、上游网络、令牌、scope 失败。
  **不要**把 issuer/audience 变可选或关闭 TLS 验证来"绕过"问题。
- 轮换:原地轮换秘密,验证新登录后再退役上游旧凭据;删除 Viat 行**不会**
  注销上游应用。
- 清理:移除隔离认证器前先清端点引用并查看发布计划;凭据**不进**
  repo-sync config,不复制的提供方响应。

## 核验依据

契约源码 `03751a67`:`crates/viat-core/src/types/authorizer.rs`、`crates/viat-api/src/{dto.rs,handlers/authorizers.rs,handlers/oidc.rs,social/mod.rs,social/handlers.rs,login_backoff.rs,project_session.rs,middleware_project.rs}`、`crates/viat-auth/src/jwt.rs`。所有配方均未执行。
