---
title: "个人访问令牌（PAT）"
description: "管理令牌的创建、作用域、使用、轮换、撤销，以及与项目凭据的区别。"
doc_id: auth.pats
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# 个人访问令牌(PAT)

`vis_pat_` PAT 以**平台账号**身份执行管理自动化:使用该账号**当前的**
成员关系/角色——不冻结、不授予权限;不创建项目用户;也不是已发布端点的
API key。CI 优先使用"限定项目 + 有到期时间"的 PAT。作用域只能**缩小**
权限,不会把 Operator 提升为 Developer。

## 前提与创建

先完成平台会话登录(含要求的 [MFA](mfa.md))。PAT 管理走
`require_session`——**不能用 PAT 自己**创建/列举/撤销 PAT。设置
`project_slug` 时,账号必须是该项目成员。

源码推导、未执行的请求:

```sh
curl -sS "$BASE/auth/tokens" \
  -H "Authorization: Bearer $PLATFORM_ACCESS_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"fixture-ci","project_slug":"demo","ttl_seconds":86400}'
```

`POST /auth/tokens` 字段:

| 字段 | 规则 |
| --- | --- |
| `name` | 必填非空,≤64 字节,同一账号内唯一;冲突 `409` |
| `project_slug` | 省略/null = 账号可访问的全部项目;字符串 = 已存在项目且要求当前成员关系 |
| `ttl_seconds` | 省略/null = 2592000(30 天);0 = 永不过期;其他非负整数为寿命秒数;负数 `400` |

响应:`id`、`name`、可空 `project_slug`、`prefix`、**`secret`**、
`created_at`、可空 `expires_at`。`secret` 是完整令牌、**仅返回一次**,
服务端只存哈希,不可恢复明文——不要期待 `token`/`access_token` 字段;
`expires_at:null` 表示**无到期**,不是已过期;PAT 没有刷新接口。

## 使用与作用域

```sh
curl -sS "$BASE/projects/demo" -H "Authorization: Bearer $VIAT_PAT"
```

- 限定项目的 PAT 只对**精确**的 `/projects/demo` 及其 `/...` 子路径、
  精确的 `/p/demo` 及其子路径通过作用域检查。`/auth/whoami`、
  `/auth/logout`、`/auth/logout-all` 是提取器的显式例外——但不改变
  处理器本身的会话/凭据要求(`/auth/logout` 仍需刷新令牌请求体)。
  作用域**不允许**:`/projects`、`/users`、`/admin/...`、其他项目,或
  `/projects/demo-other` 这类前缀近似项。
- 经 `/p/demo/...` 通过作用域**不代表** PAT 成了项目凭据:项目中间件
  仍要求有效**项目身份**;普通已发布调用用项目用户令牌/API key。
  Developer 成员的 PAT 能更新脚本,但**仍不能**发布或改 Owner/Admin
  专属设置。
- CLI 的 `VIAT_TOKEN` 与配置凭据优先级见 [CLI 概览](../cli/overview.md)
  与 [auth 命令](../cli/auth.md)。**不要**把 PAT 直接写进已提交的
  `viat.yaml` 或 shell 历史。MCP 配置另有 legacy 差异:`viat mcp` 的
  配置加载器读 `VIAT_TOKEN` 或存储的旧 `token` 字段,**不读**现代
  access/refresh 令牌对;普通 CLI 登录不保证旧字段已填。不要宣称生成的
  MCP 配置支持刷新登录,也不要把 refresh token 放进 `VIAT_TOKEN`,见
  [MCP CLI](../cli/utilities.md)。

## 清单、撤销、轮换

- 平台会话 `GET /auth/tokens` 返回 `{items:[...]}`,每项含 `id`、
  `name`、可空 `project_slug`、`prefix`、`created_at`、可空
  `expires_at`、`last_used_at`、`revoked_at`——秘密不会再出现;保存
  操作所需的 ID/名称/前缀即可,**不要**到处复制完整 bearer。
- 本人平台会话 `DELETE /auth/tokens/{id}` 返回 `{"revoked":true}`;
  不属于自己的 ID 得 `404`;对本人已撤销记录重复撤销是安全的。
- **没有**用于改名/延长 TTL/改作用域的 PATCH。轮换 = 创建**不同名称**
  的替代令牌 → 更新所有消费者 → 验证预期操作与拒绝边界 → 撤销旧 ID。
  名称在账号内持续唯一——用新的轮换名称,不要假设撤销会释放名字。
- 每次 PAT 管理请求都检查过期/撤销状态。PAT 未过期但成员关系被移除,
  项目访问照样被阻止。改密/MFA/会话变更**不是** PAT 撤销;离职要单独
  盘点并撤销。CLI 本地退出不是 PAT 撤销,也单独保留 `project_token`。

## 拒绝验证与清理

创建后验证:`GET /auth/whoami` → 一个允许的项目读取 → 一个**故意禁止**
的其他项目路径。项目 Operator 仍应读不了端点/树等编辑者入口;即使未限定
项目,PAT 也管不了 `/auth/tokens`。**不要**为了让 CI 跑通就把作用域扩到
全部项目。错误形状:缺失/过期/撤销令牌 `401`;有效但越路径/角色 `403`;
创建时项目不存在 `404`、非成员 `403`。

完成后撤销 `fixture-ci` 并删除 CI/本地配置副本——只清空环境变量**不等于**
撤销。本页未执行创建/撤销/网络调用。

## 核验依据

契约源码 `03751a67`:`crates/viat-api/src/{handlers/auth_tokens.rs,middleware_auth.rs}`、`crates/viat-auth/src/pat.rs`、`crates/viat-cli/src/{config.rs,commands/auth.rs,commands/mcp.rs}`。管理请求形状来自实现,不是完整管理 OpenAPI 导出。
