---
title: "多因素认证"
description: "平台和项目 TOTP 登记、登录票据、恢复码与管理员重置。"
doc_id: auth.mfa
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# 多因素认证

Viat 为**密码入口**提供 TOTP 验证器及一次性恢复码。平台和项目用户的因素、策略、票据相互独立。OIDC/社交登录依赖上游身份保证，不会对每个 bearer 请求额外要求密码第二因素。API key、PAT、刷新操作不是交互 TOTP 登录。MFA 也不是授权规则授予。

## 策略与前提

使用 HTTPS、有密码的账号、可信验证器、正确服务器/设备时间及安全离线恢复码存储。不得公开 TOTP 二维码/secret、恢复码或 MFA 票据。强制策略前保留另一个平台 Owner 恢复通道。

- 平台 `VIAT_MFA_REQUIRED`：默认 `off`（仍可主动登记）、`admins`（Owner/Admin）、`all`；true 映射 all，false 映射 off。检查平台角色，不是项目成员角色。未知字符串解析为 off，务必使用明确值并核对状态。
- 项目 `mfa_policy`：默认 `off`、`optional`、`required`，由 Owner/Admin 在项目设置修改。`off` 忽略已登记项目因素并拒绝自助接口；`optional` 询问已登记密码用户；`required` 强制未登记密码用户完成登记。切换 off 不表示秘密已删除。
- 平台 SSO-only 无密码账号报告 `available:false`，不要靠编造本地密码登记。

## 密码登录是两步协议

密码正确也可能返回 **401** 而非 200：

```json
{"error":"mfa_required","message":"...","mfa_ticket":"11111111-2222-4333-8444-555555555555","expires_at":"2026-11-06T12:05:00Z"}
```

也可能是 `mfa_enrollment_required`。这是挑战，不是密码错误。票据寿命 300 秒，最多五次验证码尝试，并限定账号、用途、身份平面；另有账号限流。必须用实际响应票据，不是上面的示意 UUID。登录票据不是 bearer，也不能冒充登记票据。

已登记平台用户调用 `POST /auth/mfa/verify`，必填 `mfa_ticket`、`code`，成功返回普通平台登录响应（access/refresh、身份和概览令牌）。项目用户用 `POST /p/{slug}/auth/mfa/verify`，相同必填键；原生完成返回项目登录/会话结果，不是平台账号。项目托管登录页在其表单内处理导航。

**源码推导、未执行**的平台请求：

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

平台自助要求交互平台会话，不接受 PAT。项目自助要求对应有效项目密码登录身份且策略非 off，不接受平台会话或机器 key。

1. 已登录平台 setup 传 `{"password":"..."}`；项目 setup 使用 **`{"credential":"..."}`**。强制登记分支也可在无会话时传 `{mfa_ticket}`，登记票据代表刚通过密码检查。不适用的可选 ticket/password 键可省略/null。
2. setup 精确返回 `{secret,otpauth_uri,issuer,account}`。`secret` 为 base32，`otpauth_uri` 可导入验证器。此时只是 pending，不是已强制 MFA；未确认 secret 可重新生成替换。
3. confirm 必填 `code`，可选/null `mfa_ticket`。平台返回 `{recovery_codes,session?}`，只有登记是登录缺失步骤时才包含 `session`，已登录登记省略。项目 confirm 完成对应项目登录入口，不返回平台会话。
4. 关闭展示前，将仅显示一次的恢复码保存到安全离线位置。服务端仅保存哈希，状态接口无法恢复字符串。
5. 核对状态并重新登录验证挑战分支。不要反复复用已经消费的 TOTP 时间步，重放保护会拒绝。

共享状态字段：`enabled`、`pending`、可空 `confirmed_at`、`recovery_codes_remaining`、可空 `last_used_step`。平台额外有 `required`、`available`；项目额外有 `policy`、`required`。重放水位超出当前时间步可能是时钟回拨/状态恢复，而非用户输错；先检查服务器时间和恢复记录。

关闭/替换恢复码需重新认证：平台 `{password,code}`，项目 **`{credential,code}`**，都必填。`code` 可为当前 TOTP 或未用恢复码。关闭返回 `{ok:true}`，清除因素/恢复码；即使策略要求也允许，以便换设备，下次密码登录会要求重新登记。恢复码替换返回 `{recovery_codes:[...]}`，旧集合立即失效。

## 丢失、重置与会话

丢失验证器但有恢复码：在登录 verify 步骤用一枚，再重新认证以关闭/重登或生成新恢复码。恢复码一次性消费，不是可复用备用密码，不要发给管理员。

两者都丢失时先通过带外方式确认身份，再使用正确管理平面：

- 平台 `DELETE /users/{email}/mfa`：**仅平台 Owner 且会话认证**，Owner PAT 也不行。返回 `{ok,had_mfa,sessions_revoked}`，清除因素，撤销平台刷新会话和概览读取令牌；不表示所有 PAT 已撤销。
- 项目 `DELETE /projects/{slug}/users/{identity}/mfa`：项目编辑者（`owner`、`admin`、`developer`），返回 `{ok,had_mfa}`。清除项目 MFA，但该处理器**不**撤销项目登录/刷新会话，也不提升密码 epoch。若可能是泄露而非简单丢失，应另行停用用户/改密并盘点 key/会话，不能依据旧“项目令牌无状态”的注释承诺撤销会话。

改密是另一操作：平台 `PUT /auth/password` 用 `{old_password,new_password,code?}`；项目 `POST /p/{slug}/auth/password` 用 `{current,new,code?}`。适用时已有 MFA 需要 code。移除因素不是更换密码。

## 失败处理与验证

过期/耗尽/用途错误票据或错误因素可返回 `401`；不可用/策略关闭及畸形请求会失败而非创建因素；限流为 `429`/`Retry-After`。票据过期从密码登录重新开始。pending 尝试耗尽后重新合法 setup，不要暴力确认。排障不要记录 ticket/code/secret 请求体。

拒绝检查：项目票据必须不能在平台或其他项目 verify；PAT 不能平台 setup/reset；机器 key 不能改密；重新生成后旧恢复码不能用；required 策略未登记登录必须不能在 confirm 前拿会话。只用隔离账号并恢复预期策略，管理员重置真实账号需要操作人明确批准。

控制台账号安全页实现密码 → setup → confirm → 一次性恢复码展示；会话清单独立。本页未执行验证器登记、真实 SSO、提供方调用或账号重置。

**依据：** `crates/viat-api/src/{mfa_engine.rs,handlers/mfa.rs,handlers/project_mfa.rs,handlers/users.rs,handlers/project_users.rs,auth_native.rs}`、`web/src/pages/settings/{SecurityPage.tsx,EnrolForm.tsx,RecoveryCodes.tsx,SessionsPage.tsx}`。上述项目重置/会话差异来自实际处理器，不来自旧计划。
