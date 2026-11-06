---
title: "项目设置参考"
description: "完整字段、替换/重置规则、认证钩子、claim、日志和 IdP 影响。"
doc_id: projects.settings
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# 项目设置参考

当前任意成员可 `GET /projects/{slug}`。修改用 `PUT /projects/{slug}`，要求项目 `owner`/`admin`，`developer`/`operator` 被拒绝。平台角色不能替代项目成员关系。创建和成员操作见[创建与协作](create-and-collaborate.md)。

控制台项目设置包含 General、Authentication、Identity Provider、Members、Devices。General/认证表单需要显式保存，未保存表单不是服务器状态；IdP 有独立保存/密钥生命周期。多数设置**仅 API/控制台提供**，不要虚构 `viat project set` 或假设 MCP 全量映射。仓库同步只携带项目 `name`、`scope_claims` 及独立认证器/角色/authz 元数据，不是以下全部设置。

## 全部可修改字段

PUT 所有字段可选。除 timeout 三态外，可选设置的 JSON null 等同省略（保持）；提供数组/对象时整体替换，不递归合并。

| 字段 | 初始/默认 | 校验、影响与重置 |
| --- | --- | --- |
| `name` | 创建必填 | 显示名称字符串；省略/null 保持，不改变 slug |
| `allow_registration` | false | 布尔，控制原生项目用户注册，不是平台注册；false 禁止新注册，不删除旧用户 |
| `default_timeout_secs` | null；未设置时响应可省略 | 正 i32 秒数；省略保持，null 回到部署默认，数值设置；0/负数拒绝 |
| `record_payloads` | true | 布尔；false 停止记录**新**执行输入输出，不清除旧载荷 |
| `redact_keys` | `[]` | 附加脱敏键完整列表，`[]` 清空项目增量，不能移除全局凭据遮罩 |
| `exposed_headers` | `[]` | 脚本可读附加调用者请求头完整列表；`[]` 清附加项，不清固定安全列表 |
| `auth_hooks` | `{}` | 完整钩子对象，`{}` 清空；替换对象中省略阶段即清除该阶段 |
| `mfa_policy` | `off` | `off`、`optional`、`required`，项目密码 MFA，不是平台策略 |
| `idp_enabled` | false | 布尔；首次启用须有稳定 `VIAT_PUBLIC_URL`，先生成加密 ES256 签名钥再打开 |
| `scope_claims` | `[]` | 完整声明列表，`[]` 清空，来源/类型见下 |

只读字段还有 `id`、`slug`、`created_by`、`created_at`、`updated_at`。修改返回完整 Project 行。`auth_hooks`/`scope_claims` 直接序列化为对象/数组，不包含 SQL JSON 包装。

### 超时与载荷保留

超时优先级：脚本 `# timeout:` → 项目默认 → 部署 `VIAT_DEFAULT_TIMEOUT_SECS`，dispatch 再限制到 `VIAT_MAX_TIMEOUT_SECS`。设置大数不代表可突破上限。重置必须显式：

```json
{"default_timeout_secs":null}
```

敏感数据优先考虑 `record_payloads:false`。脱敏只是按键尽力保护，不能证明可以保存秘密。旧载荷仍按部署保留期删除，关闭记录不加速已有行删除，也不清除执行元数据/日志行。

`redact_keys` 会 trim、删除空值、每项截至 64 字符、排序去重、保留最多 64 项。匹配时移除 `-`/`_` 并转小写（`patient_id` 也遮罩 `patient-id`，不匹配 `patient_ids`）。全局凭据遮罩仍启用，不保证能按语义识别字符串内容或异名字段。

### 可暴露调用者请求头

名称 trim/小写、删除空值、去重，必须合法 HTTP header，最多 64 个。禁止 `authorization`、`cookie`、`proxy-authorization`、`x-forwarded-authorization`、**所有 `x-viat-*`**；即使脚本要求也不能暴露。此列表仅补充平台固定安全头，不让调用者自报租户 header 变成可信身份，安全判断使用已验证事实。

### 认证钩子

```json
{"auth_hooks":{"login":{"pre":"auth/check_login","post":"auth/login_audit"},"register":{"pre":"auth/check_invite"}}}
```

内部 `login`、`register` 可选，各含可选/null 脚本路径 `pre`、`post`。整体替换意味着示例清除 `register.post` 及其他省略绑定。保存前检查每个非 null 路径可解析已有脚本（`folder/name` 或根名称）。空字符串是路径，不是重置；在 pair 中省略或 null 清除。

前钩子在平台操作项目用户前执行，可以返回 `{error:...}` 拒绝，或 `{args:{...}}` 合并改写输入。已配置前钩子失败不得静默跳过。后钩子在提交/签发后执行，可增加 `{response:{...}}`，不能覆盖保留身份/令牌字段；失败只记录，不回滚成功注册/登录。钩子是使用项目资源、有独立日志的普通脚本，不访问平台数据库。绑定和共享模块是实时配置，不是端点回滚内容。

### Scope claims

```json
{"scope_claims":[{"name":"school_id","type":"uuid","source":"meta"},{"name":"tenant","type":"text","source":"token","from":"org"}]}
```

每项必填 `name`、`type`、`source`；可选/null `from` 指定来源键，省略取 `name`。name 为 1–64 ASCII `[A-Za-z0-9_]`，唯一、无首尾空格；保留值 `principal`、`user_id`、`project_id`、`role`、`authorizer`、`identity`。`type` 为 `uuid`、`text`、`int`；`source` 为 `meta`（本地/社交/key 用户资料）或 `token`（已验证外部令牌 claim），不是请求 JSON。

UUID 必须可解析；text 接受非空字符串或转文本的数值；int 接受整 JSON 数或可解析整数字符串，不接受浮点。缺失/形状错误值不会进入 resolved claims，引用它的策略/default 拒绝而非扩大。CRUD default 的 `$claim.<name>` 必须发布前声明。这不同于[授权主体属性](../auth/authorization.md)或 OAuth scopes。改变来源/租户 claim 可影响实时数据访问，须测跨租户拒绝。

## 请求配方

**源码推导、未执行**的局部修改：

```sh
curl -sS -X PUT "$BASE/projects/demo" \
  -H "Authorization: Bearer $PLATFORM_ACCESS_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Demo","record_payloads":false,"redact_keys":["patient_id"],"exposed_headers":["x-trace-id"],"mfa_policy":"optional"}'
```

它保持超时、钩子、注册、IdP、scope claims。重置附加配置需显式：

```json
{"default_timeout_secs":null,"auth_hooks":{},"redact_keys":[],"exposed_headers":[],"scope_claims":[]}
```

不可盲目发送 reset：清空 claim/钩子可能移除业务安全检查。只重置一个钩子时，发送保留其他绑定的完整对象。`auth_hooks:null` **不会**清空全部钩子。

## IdP 与 MFA 影响

首次启用 IdP 要求 `VIAT_PUBLIC_URL`；生成/加密/存储失败保持关闭。关闭隐藏 discovery/JWKS、未来改回 HS256，但保留密钥，本地已签发令牌仍可验证至过期；重启用复用钥。Owner/Admin 单独管理签名钥和 OAuth 客户端，见[端点 OAuth](../auth/endpoints.md)。这不配置外部平台 SSO。

MFA off 忽略/隐藏项目因素，optional 询问已登记用户，required 强制密码用户登记。上游 SSO/社交和 API key 是独立入口。对已有用户项目启用 required 前阅读 [MFA](../auth/mfa.md)并保留恢复权限。Devices 为独立注册对象，不是嵌入 settings 的字段。

## 验证、失败与回退

保存后读取返回 Project、刷新控制台，检查新注册允许/拒绝、超时上限、新 MFA 登录、新载荷脱敏、安全头暴露和缺失/错租户 claim。读回不证明提供方 TLS、钩子副作用或策略正确。设置一般实时生效，端点认证/绑定仍需发布。端点快照回滚不恢复项目设置。

`403` 是非成员或不是 Owner/Admin；`400` 可能为非正超时、钩子脚本不存在、禁止请求头/错误 claim、无公共 URL 启用 IdP；项目不存在 `404`。修复完整提交字段，不要靠匿名访问绕过。整体替换前保存旧完整值，按意图恢复，没有通用“恢复出厂”路由。

未执行 API、钩子、MFA、数据库/提供方操作。**依据：** `crates/viat-api/src/{dto.rs,handlers/projects.rs}`、`crates/viat-core/src/types/project.rs`、`crates/viat-db/src/projects.rs`、对应字段迁移、`web/src/pages/projects/ProjectSettingsPage.tsx`、`crates/viat-cli/src/repo/viat_yaml.rs`。[CLI project](../cli/project.md)和[仓库同步](repo-sync.md)解释较窄命令面。
