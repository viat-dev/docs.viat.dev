---
title: "委托平台应用"
description: "第三方平台应用的提供方差异、回调、授权存储、秘密轮换和支持边界。"
doc_id: auth.platform-apps
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# 委托平台应用

平台应用让项目以第三方服务商身份操作客户授权账号。它**不是**平台控制台 SSO、聊天账号或通用资源。自有社交登录使用自己的应用凭据；委托[社交认证器](authorizers.md)则引用 `platform_app` 和被授权账号 `app_id`。

## 提供方支持边界

| `config.provider` | 可委托社交提供方 | 票据/客户授权 |
| --- | --- | --- |
| `weixin_tp` | `weixin_mp`、`weixin_mini` | component ticket、客户授权链接、账号消息回调 |
| `wecom_tp` | `wecom` | suite ticket、安装链接、企业消息回调 |
| `alipay_isv` | `alipay`、`alipay_mini` | RSA 签名 ISV 网关、商户 `app_auth_token`，无平台推送票据 |
| `dingtalk_isv` | `dingtalk`、`dingtalk_app` | suite ticket 和企业授权推送；**不生成客户授权 URL** |
| `douyin_tp` | 仅 `douyin_mini` | 第三方小程序 ticket、授权链接、轮换委托凭据 |
| `kuaishou_tp` | 仅 `kuaishou_mini` | 提供方独有推送/密钥格式、授权链接、轮换委托凭据 |

抖音/快手小程序平台不等于委托网页登录支持。微信 component 不能代理 `weixin_open`；企业微信不能与微信互换。配置会校验兼容关系。这里的支持不承诺提供方全部 API、商户支付功能、发布流程、应用市场审核或任意事件转脚本能力。

## 前提与管理权限

需要已注册/审核且具备能力的提供方应用、提供方能访问的 HTTPS 公网回调、稳定实例公共 URL，以及项目编辑者成员（`owner`、`admin`、`developer`）。本页不执行或证明提供方注册。内网部署中，Viat 接受 URL 不表示提供方能访问它。

| 管理路由 | 用途 |
| --- | --- |
| `GET/POST /projects/{slug}/platforms` | 列表/创建 |
| `GET/PUT/DELETE .../platforms/{name}` | 读取/更新/删除 |
| `GET .../platforms/{name}/authorizations` | 客户授权清单 |
| `DELETE .../platforms/{name}/authorizations/{authorizer_ref}` | 删除本地授权并清除账号令牌缓存 |
| `POST .../platforms/{name}/authorize-url` | 无请求体；支持时生成新客户链接，返回 `{url,redirect_uri}` |

读取同样要求编辑者。它们不是匿名回调接口。提供方回调是检查签名/加密的公共协议路由，不是平台 bearer 管理接口。

## 完整创建/更新结构

创建要求 `{name,config,secret}`。`name` 是项目本地应用标识，使用 `fixture-component` 这样的路径安全名称。`config` 必须有 `provider`、`app_id`；`app_id` 非空、最多 128 字节。虽然 DTO 中 secret 可选，创建时仍必需。更新不能改变 provider；name 是路径标识，不是更新字段。

| config 字段 | 默认/校验 |
| --- | --- |
| `provider` | 必填，前述六个值之一 |
| `app_id` | 必填 component appid/suite id/ISV 应用 ID |
| `alipay_public_key` | 支付宝 ISV 必填验证 RSA 公钥，PEM/base64 |
| `post_authorize_redirect_uri` | 省略/null = Viat 完成页，提供时须可解析 URL |
| `api_base`、`auth_base` | 默认提供方地址；测试/出口覆盖源仅 HTTPS 或 loopback HTTP |
| `legacy_api_base` | 钉钉旧 tmp_auth_code 网关，默认 `https://oapi.dingtalk.com`，相同源校验 |

微信/企业微信/钉钉/抖音/快手 secret 必须含非空 `app_secret`（最多 1024 字节）、回调签名 `token`（最多 128 字节）、`encoding_aes_key`。通常 EncodingAESKey 是提供方的 43 字符材料；**快手使用 32 字节的 base64**，不是相同文本格式。支付宝用有效 RSA PEM/base64 `app_private_key` 和 config 公钥，不要求 ticket/token/EncodingAESKey。禁止把真实回调 token 或私钥复制到示例。

`POST /projects/demo/platforms` 的**源码推导、未执行**请求体：

```json
{"name":"fixture-component","config":{"provider":"weixin_tp","app_id":"fixture-component-appid","post_authorize_redirect_uri":"https://app.example.invalid/authorized"},"secret":{"app_secret":"REPLACE_WITH_PROVIDER_SECRET","token":"REPLACE_WITH_CALLBACK_TOKEN","encoding_aes_key":"REPLACE_WITH_VALID_PROVIDER_AES_KEY"}}
```

占位符故意不是有效注册/加密钥，仅在获得批准的真实配置中提交提供方材料，本次文档工作不执行。

`PUT .../{name}` 更新：省略/null `config` 保持，提供 config **整体替换**；省略/null secret 保持。提供 secret 时逐字段合并非空值，空白保持旧值，因此轮换 `app_secret` 不会清空相邻 callback token/AES key。没有“空白擦除秘密”操作。更新清除应用令牌缓存，防止旧凭据继续复用。换提供方要创建另一个应用，而不是局部秘密补丁。

## 回调地址与配置顺序

应用响应包含 `id`、`name`、`provider`、`config`、`uses_ticket`、`has_ticket`、可空 `ticket_at`、`callback_url`、可空 `message_callback_url`、`has_authorize_url`、可空 `authorized_url`、`created_at`、`updated_at`，不暴露秘密 blob 或 ticket 字符串。**复制响应里的 URL**，保留部署前缀和名称转义：

- 提供方推送/验证：`BASE/p/demo/_platform/fixture-component/callback`（GET/POST）。
- 微信账号消息：同根路径 `/callback/$APPID$`。
- 企业微信消息：同根路径 `/callback/$CORPID$`。
- 支持的客户返回页：同根路径 `/authorized`（GET）。

1. 以匹配的提供方凭据创建应用，在提供方控制台登记返回 callback 和适用账号模板。
2. 完成回调验证。票据型提供方需要真实推送 ticket，`has_ticket:false` 表示等待，不表示授权可用；支付宝 `uses_ticket:false` 是正常状态。
3. `has_authorize_url:true` 时请求**新**授权链接并让客户访问，预授权 code 会过期，不应永久发布生成链接。钉钉由市场/应用内开通/提供方控制台部署二维码授权，结果作为 push 到达；调用 authorize-url 会返回诊断错误。
4. 客户返回/推送保存账号授权和加密凭据，或标记撤销。适用返回流程有签名 state 保护，不要伪造返回查询参数。
5. 检查授权清单，再创建兼容社交认证器 `{provider,app_id:<被授权账号>,platform_app:<名称>}`，它仍需角色和已发布端点准入。
6. 获得明确批准后用真实提供方 code 测登录；静态配置/`has_ticket` 不是 SSO 已工作的证明。

授权项包含 `id`、`authorizer_ref`、`kind`、可空 `display_name`、`scopes` 数组、`meta` 对象、`status`（`active`/`revoked`）、`authorized_at`、可空 `revoked_at`、`updated_at`，不返回凭据或密文字节。active 反映 Viat 保存的授权状态，不保证每项 provider scope 或下游请求都成功。

## 秘密、撤销与退场

客户委托 refresh/授权材料只留在平台侧。抖音/快手的一次性轮换 refresh 凭据不能安全复制给两个独立刷新者。不要把完整上游载荷记录到日志。支付宝小程序即使通过 ISV 获得网关访问，采集手机号仍可能需要小程序自己的 AES key。

提供方撤销事件将本地授权标记 revoked 并阻止使用。删除本地授权是本地清理，**不是向提供方请求客户解除授权**。只要还有社交认证器引用，删除应用会被阻止（`409`，详情含 `platform.in_use`），应先有意识地迁移/删除引用。删除应用清理本地状态/缓存，不取消上游注册或客户合同。

原地轮换非空秘密字段，验证回调和新委托登录后，按提供方批准顺序退役旧材料。callback token/AES 轮换可能需两侧协调，暂时不匹配不能靠关闭验证修复。退场时停用依赖登录入口，按需在提供方撤销授权，再清理本地授权/依赖；如需移除项目用户/角色，另行操作。

## 失败与验证限制

重试前检查平台族、app ID、key 编码、稳定回调源、provider scopes、首个 ticket、客户 active 授权以及网络/信任。配置错误 `400`、同名冲突、应用不存在 `404`、非编辑者 `403`；签名/解密失败不能当作接受推送。HTTP 回调确认不是用户登录成功或消息进入脚本的证明。

未执行提供方注册、授权、通知、ticket 注入、SSO、网络或远端清理。本页仅源码检查。**依据：** `crates/viat-api/src/platform/{mod.rs,handlers.rs,weixin_tp.rs,wecom_tp.rs,alipay_isv.rs,dingtalk_isv.rs,douyin_tp.rs,kuaishou_tp.rs}`、`crates/viat-api/src/{social/mod.rs,handlers/authorizers.rs,lib.rs}`。完整社交配置归[认证器](authorizers.md)所有，资源凭据仍由已有资源页负责。
