---
title: "委托平台应用"
description: "第三方平台应用的提供方差异、回调、授权存储、秘密轮换和支持边界。"
doc_id: auth.platform-apps
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# 委托平台应用

平台应用让项目以**第三方服务商**身份操作客户授权的账号。它不是平台
控制台 SSO、不是聊天账号、不是通用资源。自有社交登录用自有应用凭据;
**委托**的[社交认证器](authorizers.md)则引用 `platform_app` 与被授权
账号的 `app_id`。

## 提供方支持边界

| `config.provider` | 可委托的社交提供方 | 票据/客户授权 |
| --- | --- | --- |
| `weixin_tp` | `weixin_mp`、`weixin_mini` | component ticket、客户授权链接、账号消息回调 |
| `wecom_tp` | `wecom` | suite ticket、安装链接、企业消息回调 |
| `alipay_isv` | `alipay`、`alipay_mini` | RSA 签名 ISV 网关、商户 `app_auth_token`;**无**平台推送票据 |
| `dingtalk_isv` | `dingtalk`、`dingtalk_app` | suite ticket 与企业授权推送;**不生成客户授权 URL** |
| `douyin_tp` | 仅 `douyin_mini` | 第三方小程序 ticket、授权链接、轮换委托凭据 |
| `kuaishou_tp` | 仅 `kuaishou_mini` | 提供方独有推送/密钥格式、授权链接、轮换委托凭据 |

抖音/快手**小程序**平台 ≠ 委托网页登录支持;微信 component 不能代理
`weixin_open`;企业微信不能与微信互换——配置会校验兼容关系。这里的支持
**不承诺**提供方全部 API、商户支付、发布流程、应用市场审核或任意事件
转脚本能力。

## 前提与管理权限

需要:已注册/审核且具备能力的提供方应用、提供方**能访问**的 HTTPS 公网
回调、稳定的实例公共 URL,以及项目编辑者成员(`owner`/`admin`/
`developer`)。本页不执行或证明提供方注册;内网部署中"Viat 接受 URL"
**不代表**提供方能访问它。

| 管理路由 | 用途 |
| --- | --- |
| `GET/POST /projects/{slug}/platforms` | 列表/创建 |
| `GET/PUT/DELETE .../platforms/{name}` | 读取/更新/删除 |
| `GET .../platforms/{name}/authorizations` | 客户授权清单 |
| `DELETE .../platforms/{name}/authorizations/{authorizer_ref}` | 删除本地授权并清除账号令牌缓存 |
| `POST .../platforms/{name}/authorize-url` | 无请求体;支持时生成新客户链接,返回 `{url,redirect_uri}` |

**读取同样要求编辑者**;这些不是匿名回调接口。提供方回调是校验签名/
加密的公共协议路由,不是平台 bearer 管理接口。

## 完整创建/更新结构

- 创建要求 `{name,config,secret}`:`name` 是项目本地应用标识(用
  `fixture-component` 这类路径安全名称);`config` 必须有 `provider` 与
  `app_id`(非空、≤128 字节);**DTO 里 secret 虽可选,创建时必需**。
  更新**不能**改 provider;`name` 是路径标识,不是更新字段。

| config 字段 | 默认/校验 |
| --- | --- |
| `provider` | 必填,前述六个值之一 |
| `app_id` | 必填;component appid / suite id / ISV 应用 ID |
| `alipay_public_key` | 支付宝 ISV 必填的验证 RSA 公钥(PEM/base64) |
| `post_authorize_redirect_uri` | 省略/null = Viat 完成页;提供时须可解析 URL |
| `api_base`、`auth_base` | 默认提供方地址;测试/出口覆盖源仅 HTTPS 或 loopback HTTP |
| `legacy_api_base` | 钉钉旧 tmp_auth_code 网关,默认 `https://oapi.dingtalk.com`,相同源校验 |

秘密:微信/企业微信/钉钉/抖音/快手必须含非空 `app_secret`(≤1024 字节)、
回调签名 `token`(≤128 字节)与 `encoding_aes_key`——通常是提供方的
43 字符材料,但**快手用 32 字节 base64**,不是同一文本格式;支付宝用
有效 RSA PEM/base64 的 `app_private_key` + config 公钥,**不要求**
ticket/token/AESKey。**禁止**把真实回调 token 或私钥复制进示例。

`POST /projects/demo/platforms` 的源码推导、未执行请求体:

```json
{"name":"fixture-component","config":{"provider":"weixin_tp","app_id":"fixture-component-appid","post_authorize_redirect_uri":"https://app.example.invalid/authorized"},"secret":{"app_secret":"REPLACE_WITH_PROVIDER_SECRET","token":"REPLACE_WITH_CALLBACK_TOKEN","encoding_aes_key":"REPLACE_WITH_VALID_PROVIDER_AES_KEY"}}
```

占位符故意不是有效注册/加密钥;仅在获批的真实配置中提交提供方材料。

`PUT .../{name}` 更新:省略/null `config` 保持,提供则**整体替换**;
省略/null secret 保持;提供 secret 时**逐字段合并非空值**,空白保持
旧值——因此轮换 `app_secret` 不会清掉相邻的 callback token/AES key。
**没有**"空白擦除秘密"操作。更新会清除应用令牌缓存,防旧凭据复用。
换提供方 = 新建另一个应用,不是局部秘密补丁。

## 回调地址与配置顺序

应用响应含 `id`、`name`、`provider`、`config`、`uses_ticket`、
`has_ticket`、可空 `ticket_at`、`callback_url`、可空
`message_callback_url`、`has_authorize_url`、可空 `authorized_url`、
`created_at`、`updated_at`——**不暴露**秘密 blob 或 ticket 字符串。
**复制响应里的 URL**(保留部署前缀与名称转义):

- 提供方推送/验证:`BASE/p/demo/_platform/fixture-component/callback`
  (GET/POST)。
- 微信账号消息:同根路径 `/callback/$APPID$`。
- 企业微信消息:同根路径 `/callback/$CORPID$`。
- 受支持的客户返回页:同根路径 `/authorized`(GET)。

配置顺序:

1. 用匹配的提供方凭据创建应用,在提供方控制台登记返回的 callback 与
   适用账号模板。
2. 完成回调验证。票据型提供方需要**真实推送 ticket**:`has_ticket:false`
   表示等待中,不表示授权可用;支付宝 `uses_ticket:false` 是正常状态。
3. `has_authorize_url:true` 时请求**新**授权链接给客户访问——预授权
   code 会过期,不要永久发布生成链接。钉钉由市场/应用内开通/控制台部署
   二维码授权,结果以 push 到达;调 authorize-url 会返回诊断错误。
4. 客户返回/推送保存账号授权与加密凭据,或标记撤销;适用返回流程有签名
   state 保护——**不要**伪造返回查询参数。
5. 检查授权清单后,创建兼容的社交认证器
   `{provider,app_id:<被授权账号>,platform_app:<名称>}`——它仍需角色与
   已发布端点准入。
6. 获明确批准后用**真实提供方 code** 测登录;静态配置/`has_ticket` 不是
   SSO 已工作的证明。

授权项含 `id`、`authorizer_ref`、`kind`、可空 `display_name`、`scopes`
数组、`meta` 对象、`status`(`active`/`revoked`)、`authorized_at`、
可空 `revoked_at`、`updated_at`——不返回凭据或密文字节。`active` 反映
Viat 保存的授权状态,**不保证**每项 provider scope 或下游请求都成功。

## 秘密、撤销与退场

- 客户委托的 refresh/授权材料只留在平台侧;抖音/快手的一次性轮换
  refresh 凭据**不能**安全复制给两个独立刷新者;不要把完整上游载荷记入
  日志。支付宝小程序即使经 ISV 获网关访问,采集手机号仍可能需要小程序
  自己的 AES key。
- 提供方撤销事件会把本地授权标记 revoked 并阻止使用;删除本地授权只是
  **本地清理**,不是向提供方请求客户解除授权。
- 只要还有社交认证器引用,删除应用会被阻止(`409`,详情含
  `platform.in_use`)——先有意识地迁移/删除引用。删除应用清理本地状态/
  缓存,**不**取消上游注册或客户合同。
- 轮换:原地轮换非空秘密字段 → 验证回调与新委托登录 → 按提供方批准
  顺序退役旧材料。callback token/AES 轮换可能需两侧协调——暂时不匹配
  **不能**靠关闭验证修复。
- 退场:停用依赖登录入口 → 按需在提供方撤销授权 → 清理本地授权/依赖;
  需要移除项目用户/角色时另行操作。

## 失败与验证限制

重试前按序查:平台族 → app ID → key 编码 → 稳定回调源 → provider
scopes → 首个 ticket → 客户 active 授权 → 网络/信任。配置错 `400`、
同名冲突、应用不存在 `404`、非编辑者 `403`;签名/解密失败**不能**当
"接受推送"。HTTP 回调确认**不是**用户登录成功或消息进入脚本的证明。

## 核验依据

契约源码 `03751a67`:`crates/viat-api/src/platform/{mod.rs,handlers.rs,weixin_tp.rs,wecom_tp.rs,alipay_isv.rs,dingtalk_isv.rs,douyin_tp.rs,kuaishou_tp.rs}`、`crates/viat-api/src/{social/mod.rs,handlers/authorizers.rs,lib.rs}`。未执行提供方注册、授权、通知、ticket 注入、SSO、网络或远端清理;本页仅源码检查。完整社交配置归[认证器](authorizers.md)所有;资源凭据由各资源页负责。
