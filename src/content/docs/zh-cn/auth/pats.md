---
title: "个人访问令牌（PAT）"
description: "管理令牌的创建、作用域、使用、轮换、撤销，以及与项目凭据的区别。"
doc_id: auth.pats
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# 个人访问令牌（PAT）

`vis_pat_` PAT 以**平台账号**身份执行管理自动化，使用该账号当前成员关系/角色，不冻结或授予权限，不创建项目用户，也不是已发布端点 API key。CI 应优先使用限定项目且有到期时间的 PAT。作用域只缩小权限，不会把 Operator 提升为 Developer。

## 前提与创建

先完成平台会话登录，包括要求的 [MFA](mfa.md)。PAT 管理使用 `require_session`，不能用 PAT 自己创建、列举或撤销 PAT。设置 `project_slug` 时，账号必须是该项目成员。

**源码推导、未执行**的请求：

```sh
curl -sS "$BASE/auth/tokens" \
  -H "Authorization: Bearer $PLATFORM_ACCESS_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"fixture-ci","project_slug":"demo","ttl_seconds":86400}'
```

`POST /auth/tokens` 字段：

| 字段 | 规则 |
| --- | --- |
| `name` | 必填非空字符串，最多 64 字节，同一账号唯一，冲突 `409` |
| `project_slug` | 省略/null = 账号可访问的全部项目；字符串 = 已存在项目且要求当前成员关系 |
| `ttl_seconds` | 省略/null = 2592000（30 天）；0 = 永不过期；其他非负整数为寿命秒数；负数 `400` |

响应：`id`、`name`、可空 `project_slug`、`prefix`、**`secret`**、`created_at`、可空 `expires_at`。`secret` 是完整显示令牌，仅返回一次，服务端只保存哈希，不可恢复明文。不要期待 `token` 或 `access_token` 字段。`expires_at:null` 表示无到期时间，不是已过期。PAT 没有刷新接口。

## 使用与作用域

```sh
curl -sS "$BASE/projects/demo" -H "Authorization: Bearer $VIAT_PAT"
```

限定项目的 PAT 仅对精确 `/projects/demo` 及其 `/...` 子路径、精确 `/p/demo` 及其子路径通过管理提取器作用域检查。`/auth/whoami`、`/auth/logout`、`/auth/logout-all` 是显式提取器例外，但不改变处理器本身的会话/凭据要求；`/auth/logout` 仍需要刷新令牌请求体。作用域不允许 `/projects`、`/users`、`/admin/...`、其他项目，或 `/projects/demo-other` 这类前缀近似项。

通过 `/p/demo/...` 路径作用域不表示 PAT 是项目凭据：项目中间件仍要求有效项目身份。普通已发布调用使用项目用户令牌/API key。Developer 成员的 PAT 可以更新脚本，但仍不能发布或修改 Owner/Admin 专属设置。

CLI 的 `VIAT_TOKEN` 和配置凭据优先级见 [CLI 概览](../cli/overview.md)、[auth 命令](../cli/auth.md)。不要把 PAT 直接写进已提交 `viat.yaml` 或 shell 历史。MCP 配置还有 legacy 差异：`viat mcp` 配置加载器读取 `VIAT_TOKEN` 或存储的旧 `token` 字段，不读取现代 access/refresh 令牌对；普通 CLI 登录不保证旧字段已填充。不要宣称生成的 MCP 配置支持刷新登录，也不要把 refresh token 放进 `VIAT_TOKEN`，见 [MCP CLI](../cli/utilities.md)。

## 清单、撤销、轮换

平台会话调用 `GET /auth/tokens` 返回 `{items:[...]}`，每项包含 `id`、`name`、可空 `project_slug`、`prefix`、`created_at`、可空 `expires_at`、`last_used_at`、`revoked_at`。秘密不会再次出现，应保存操作所需 ID/名称/前缀，而非到处复制完整 bearer。

本人平台会话调用 `DELETE /auth/tokens/{id}` 返回 `{"revoked":true}`，不属于自己的 ID 为 `404`。对本人已撤销记录重复撤销安全。没有用于改名、延长 TTL、改变作用域的 PATCH。轮换应创建不同名称的替代令牌、更新所有消费者、验证预期操作与拒绝边界，再撤销旧 ID。名称在账号内保持唯一，应使用新的轮换名称，不要假设撤销会释放名称。

每次 PAT 管理请求检查过期/撤销状态。即使 PAT 尚未过期，移除成员关系也会阻止项目访问。改密/MFA/会话变更不能当作 PAT 撤销，离职须单独盘点并撤销。CLI 本地退出不是 PAT 撤销，也单独保留 `project_token`。

## 拒绝验证与清理

创建后验证 `GET /auth/whoami`、一个允许的项目读取和一个故意禁止的其他项目路径。项目 Operator 仍应无法读取端点/树等编辑者入口。即使未限定项目，PAT 也不能管理 `/auth/tokens`。不要为了测通 CI 把作用域扩大到全部项目。缺失/过期/撤销令牌为 `401`；有效但越过路径/角色权限为 `403`；创建时不存在项目为 `404`，非成员为 `403`。

完成后撤销 `fixture-ci` 并删除 CI/本地配置副本；只清空环境变量不等于撤销。本页未执行创建/撤销/网络调用。

**依据：** `crates/viat-api/src/{handlers/auth_tokens.rs,middleware_auth.rs}`、`crates/viat-auth/src/pat.rs`、`crates/viat-cli/src/{config.rs,commands/auth.rs,commands/mcp.rs}`。管理请求形状来自实现，不是完整管理 OpenAPI 导出。
