---
title: "多因素认证"
description: "平台和项目 TOTP 登记、登录票据、恢复码与管理员重置。"
doc_id: auth.mfa
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# 多因素认证

Viat 为**密码入口**提供 TOTP 验证器与一次性恢复码。平台与项目用户的
因素、策略、票据相互独立。边界先立住:

- OIDC/社交登录依赖上游身份保证——**不会**对每个 bearer 请求额外要求
  密码第二因素;API key、PAT、刷新操作也不是交互 TOTP 登录。
- MFA **不是**授权规则的授予。

## 策略与前提

使用 HTTPS、有密码的账号、可信验证器、正确的服务器/设备时间与安全的
离线恢复码存储。**不得**公开 TOTP 二维码/secret、恢复码或 MFA 票据;
强制策略前保留另一个平台 Owner 恢复通道。

- 平台 `VIAT_MFA_REQUIRED`:默认 `off`(仍可主动登记)、`admins`
  (Owner/Admin)、`all`;`true` 映射 all,`false` 映射 off。检查的是
  **平台角色**不是项目成员角色。**未知字符串解析为 off**——务必用明确
  值并核对状态。
- 项目 `mfa_policy`(`off`/`optional`/`required`,由项目 Owner/Admin 在
  项目设置修改):`off` 忽略已登记项目因素并拒绝自助接口;`optional`
  询问已登记的密码用户;`required` 强制未登记的密码用户完成登记。
  切回 off **不表示**秘密已删除。
- 平台 SSO-only 无密码账号报告 `available:false`——不要靠编造本地密码
  登记。

## 密码登录是两步协议

密码正确也可能返回 **401** 而非 200:

```json
{"error":"mfa_required","message":"...","mfa_ticket":"11111111-2222-4333-8444-555555555555","expires_at":"2026-11-06T12:05:00Z"}
```

也可能是 `mfa_enrollment_required`。**这是挑战,不是密码错误。**票据
寿命 300 秒、最多五次验证码尝试,并限定账号、用途与身份平面;另有账号
级限流。必须用实际响应的票据,不是上面的示意 UUID;登录票据不是
bearer,也不能冒充登记票据。

- 已登记**平台**用户调 `POST /auth/mfa/verify`(必填 `mfa_ticket`、
  `code`),成功返回普通平台登录响应(access/refresh、身份与概览令牌)。
- **项目**用户调 `POST /p/{slug}/auth/mfa/verify`(相同必填键),原生
  完成返回项目登录/会话结果——**不是**平台账号。项目托管登录页在其
  表单内处理导航。

源码推导、未执行的平台请求:

```sh
curl -sS "$BASE/auth/mfa/verify" -H 'Content-Type: application/json' \
  -d '{"mfa_ticket":"11111111-2222-4333-8444-555555555555","code":"REPLACE_WITH_CURRENT_CODE"}'
```

## 登记及自助路由

| 操作 | 平台路由 | 项目路由 |
| --- | --- | --- |
| 状态 | `GET /auth/mfa` | `GET /p/{slug}/auth/mfa` |
| 开始登记 | `POST /auth/mfa/totp/setup` | `POST /p/{slug}/auth/mfa/totp/setup` |
| 确认 | `POST /auth/mfa/totp/confirm` | `POST /p/{slug}/auth/mfa/totp/confirm` |
| 关闭 | `DELETE /auth/mfa` | `DELETE /p/{slug}/auth/mfa` |
| 替换恢复码集合 | `POST /auth/mfa/recovery-codes` | `POST /p/{slug}/auth/mfa/recovery-codes` |

平台自助要求**交互平台会话**(不接受 PAT);项目自助要求对应的有效项目
密码登录身份且策略非 off(不接受平台会话或机器 key)。

1. 已登录的平台 setup 传 `{"password":"..."}`;项目 setup 用
   **`{"credential":"..."}`**。强制登记分支也可在无会话时传
   `{mfa_ticket}`——登记票据代表"刚通过密码检查"。不适用的可选
   ticket/password 键可省略/null。
2. setup 精确返回 `{secret,otpauth_uri,issuer,account}`:`secret` 为
   base32,`otpauth_uri` 可导入验证器。此时只是 **pending**——未确认的
   secret 可重新生成替换。
3. confirm 必填 `code`、可选/null `mfa_ticket`。平台返回
   `{recovery_codes,session?}`——`session` 仅当登记是登录的缺失步骤时
   包含,已登录登记省略。项目 confirm 完成对应项目登录入口,**不返回**
   平台会话。
4. 关闭展示前,把**仅显示一次**的恢复码保存到安全离线位置;服务端只存
   哈希,状态接口无法恢复字符串。
5. 核对状态并重新登录验证挑战分支;不要复用已消费的 TOTP 时间步——
   重放保护会拒绝。

共享状态字段:`enabled`、`pending`、可空 `confirmed_at`、
`recovery_codes_remaining`、可空 `last_used_step`;平台另有
`required`、`available`,项目另有 `policy`、`required`。重放水位超出
当前时间步可能是时钟回拨/状态恢复而非用户输错——先查服务器时间与恢复
记录。

关闭/替换恢复码需重新认证:平台 `{password,code}`,项目
**`{credential,code}`**,都必填;`code` 可为当前 TOTP 或未用恢复码。关闭
返回 `{ok:true}` 并清除因素/恢复码——即使策略要求也允许(便于换设备),
下次密码登录会要求重新登记。恢复码替换返回 `{recovery_codes:[...]}`,
旧集合**立即失效**。

## 丢失、重置与会话

- 丢验证器但有恢复码:在登录 verify 步骤用一枚,再重新认证以关闭/重登
  或生成新恢复码。恢复码**一次性消费**,不是可复用的备用密码——不要
  发给管理员。
- 两者都丢:先带外确认身份,再用**正确的管理平面**:

| 平面 | 操作 | 权限与效果 |
| --- | --- | --- |
| 平台 | `DELETE /users/{email}/mfa` | **仅平台 Owner 且会话认证**(Owner PAT 也不行);返回 `{ok,had_mfa,sessions_revoked}`,清除因素并撤销平台刷新会话与概览读取令牌——**不表示**所有 PAT 已撤销 |
| 项目 | `DELETE /projects/{slug}/users/{identity}/mfa` | 项目编辑者(`owner`/`admin`/`developer`);返回 `{ok,had_mfa}`;清除项目 MFA,但该处理器**不**撤销项目登录/刷新会话,也不提升密码 epoch——疑似泄露时应另行停用用户/改密并盘点 key/会话,不要依据旧"项目令牌无状态"注释承诺撤销会话 |

改密是另一回事:平台 `PUT /auth/password` 用
`{old_password,new_password,code?}`;项目 `POST /p/{slug}/auth/password`
用 `{current,new,code?}`;适用时已有 MFA 需要 `code`。**移除因素不是
更换密码。**

## 失败处理与验证

- 过期/耗尽/用途错误的票据或错误因素可返回 `401`;不可用/策略关闭及
  畸形请求会失败而非创建因素;限流 `429`/`Retry-After`。票据过期 → 从
  密码登录重新开始;pending 尝试耗尽 → 重新合法 setup,**不要暴力
  confirm**。排障时不要记录 ticket/code/secret 请求体。
- 拒绝检查:项目票据必须不能在平台或其他项目 verify;PAT 不能平台
  setup/reset;机器 key 不能改密;重新生成后旧恢复码必须失效;required
  策略下未登记登录必须不能在 confirm 前拿到会话。只用隔离账号并恢复
  预期策略;管理员重置真实账号需操作人明确批准。
- 控制台账号安全页实现"密码 → setup → confirm → 一次性恢复码展示";
  会话清单是独立页面。本页未执行验证器登记、真实 SSO、提供方调用或
  账号重置。

## 核验依据

契约源码 `03751a67`:`crates/viat-api/src/{mfa_engine.rs,handlers/mfa.rs,handlers/project_mfa.rs,handlers/users.rs,handlers/project_users.rs,auth_native.rs}`、`web/src/pages/settings/{SecurityPage.tsx,EnrolForm.tsx,RecoveryCodes.tsx,SessionsPage.tsx}`。上述项目重置/会话差异来自实际处理器,不来自旧计划。
