---
title: "项目设置参考"
description: "完整字段、替换/重置规则、认证钩子、claim、日志和 IdP 影响。"
doc_id: projects.settings
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# 项目设置参考

本页是项目设置的完整参考:每个字段的可修改范围、替换/重置规则,以及它们
对认证钩子、scope claims、载荷记录和 IdP 的实际影响。

读取与修改:

- 任何成员可 `GET /projects/{slug}`。
- 修改用 `PUT /projects/{slug}`,要求项目 `owner`/`admin`;
  `developer`/`operator` 被拒绝,平台角色不能替代成员关系。
- 创建与成员操作见[创建与协作](create-and-collaborate.md)。

> [!NOTE]
> 控制台的项目设置页含 General、Authentication、Identity Provider、
> Members、Devices 几组。General/认证表单需显式保存——未保存的表单不是
> 服务器状态;IdP 有独立的保存与密钥生命周期。多数设置**仅 API/控制台
> 提供**:不要虚构 `viat project set`,也不要假设 MCP 全量映射。仓库同步
> 只携带项目 `name`、`scope_claims` 及独立的认证器/角色/authz 元数据,
> 不是本页的全部设置。

## 全部可修改字段

PUT 的所有字段可选。除 timeout 三态外,可选设置的 JSON null 等同省略
(保持);提供数组/对象时是**整体替换**,不做递归合并。

| 字段 | 初始/默认 | 校验、影响与重置 |
| --- | --- | --- |
| `name` | 创建必填 | 显示名称字符串;省略/null 保持,不改 slug |
| `allow_registration` | false | 布尔;控制**原生项目用户**注册,不是平台注册;false 禁新注册,不删旧用户 |
| `default_timeout_secs` | null(未设置时响应可省略) | 正 i32 秒数;省略保持,null 回部署默认,数值即设置;0/负数拒绝 |
| `record_payloads` | true | 布尔;false 停止记录**新**执行的输入输出,不清除旧载荷 |
| `redact_keys` | `[]` | 附加脱敏键的**完整列表**;`[]` 清空项目增量,不能移除全局凭据遮罩 |
| `exposed_headers` | `[]` | 脚本可读的附加调用者请求头**完整列表**;`[]` 清附加项,不清固定安全列表 |
| `auth_hooks` | `{}` | **完整**钩子对象;`{}` 清空;替换对象中省略某阶段即清除该阶段 |
| `mfa_policy` | off | `off`/`optional`/`required`;项目密码 MFA,不是平台策略 |
| `idp_enabled` | false | 布尔;首次启用须有稳定 `VIAT_PUBLIC_URL`,先生成加密 ES256 签名钥再打开 |
| `scope_claims` | `[]` | 完整声明列表;`[]` 清空;来源/类型见下 |

只读字段:`id`、`slug`、`created_by`、`created_at`、`updated_at`。修改返回
完整 Project 行;`auth_hooks`/`scope_claims` 直接序列化为对象/数组,不带
SQL JSON 包装。

### 超时与载荷保留

超时优先级:脚本 `# timeout:` → 项目默认 → 部署
`VIAT_DEFAULT_TIMEOUT_SECS`,dispatch 再夹到 `VIAT_MAX_TIMEOUT_SECS`——
在这里设大数不能突破上限。重置必须显式:

```json
{"default_timeout_secs":null}
```

敏感数据优先考虑 `record_payloads:false`。脱敏是按键尽力保护,不能证明
"可以保存秘密"。旧载荷仍按部署保留期删除:关闭记录不加速已有行删除,也
不清除执行元数据/日志行。

`redact_keys` 的规范化:trim、去空值、每项截到 64 字符、排序去重、最多
64 项。匹配时移除 `-`/`_` 并转小写(`patient_id` 也遮 `patient-id`,但不
匹配 `patient_ids`)。全局凭据遮罩始终启用;不保证按语义识别字符串内容
或异名字段。

### 可暴露的调用者请求头

名称 trim/小写、去空值、去重,必须是合法 HTTP header,最多 64 个。**禁止**
`authorization`、`cookie`、`proxy-authorization`、
`x-forwarded-authorization` 以及**所有 `x-viat-*`**——脚本声明需要也不行。
该列表只是补充平台固定的安全头;它不能把"调用者自报的租户头"变成可信
身份,安全判断只用已验证事实。

### 认证钩子

```json
{"auth_hooks":{"login":{"pre":"auth/check_login","post":"auth/login_audit"},"register":{"pre":"auth/check_invite"}}}
```

- 内部 `login`、`register` 可选,各含可选/null 的脚本路径 `pre`/`post`。
  整体替换:上面的示例会**清除** `register.post` 及其他省略的绑定。
- 保存前检查每个非 null 路径可解析到已有脚本(`folder/name` 或根名称)。
  空字符串是路径不是重置;在 pair 里省略或 null 才是清除。
- **前钩子**在平台操作项目用户之前执行:可返回 `{error:...}` 拒绝,或
  `{args:{...}}` 合并改写输入;已配置的前钩子失败不会静默跳过。
- **后钩子**在提交/签发之后执行:可附加 `{response:{...}}`,不能覆盖保留的
  身份/令牌字段;失败只记录,不回滚已成功的注册/登录。
- 钩子就是普通脚本:可使用项目资源、有独立日志,不访问平台数据库。钩子
  绑定与其共享模块是**实时配置**,不属于端点回滚内容。

### Scope claims

```json
{"scope_claims":[{"name":"school_id","type":"uuid","source":"meta"},{"name":"tenant","type":"text","source":"token","from":"org"}]}
```

每项必填 `name`、`type`、`source`;可选/null `from` 指定来源键,省略取
`name` 本身。

- `name`:1–64 个 ASCII `[A-Za-z0-9_]`,唯一、无首尾空格;保留值
  `principal`、`user_id`、`project_id`、`role`、`authorizer`、`identity`。
- `type`:`uuid`、`text`、`int`。
- `source`:`meta`(本地/社交/key 用户的资料)或 `token`(已验证的外部
  令牌 claim)——**不是**请求 JSON。

类型规则:uuid 必须可解析;text 接受非空字符串或可转文本的数值;int 接受
整 JSON 数或可解析整数字符串,不接受浮点。缺失/形状错误的值不会进入
resolved claims——引用它的策略与 default 会拒绝,而不是放大权限。CRUD
default 的 `$claim.<name>` 必须在发布前声明。这与[授权主体属性](../auth/authorization.md)
或 OAuth scopes 是不同概念。

> [!WARNING]
> 改变来源/租户 claim 会影响**实时**数据访问;变更后必须测试跨租户拒绝。

## 请求配方

源码推导、未执行的局部修改:

```sh
curl -sS -X PUT "$BASE/projects/demo" \
  -H "Authorization: Bearer $PLATFORM_ACCESS_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Demo","record_payloads":false,"redact_keys":["patient_id"],"exposed_headers":["x-trace-id"],"mfa_policy":"optional"}'
```

这条命令保持了超时、钩子、注册、IdP、scope claims 不变。重置附加配置要
显式发:

```json
{"default_timeout_secs":null,"auth_hooks":{},"redact_keys":[],"exposed_headers":[],"scope_claims":[]}
```

不要盲目发 reset:清空 claim/钩子可能移除业务安全检查。只重置一个钩子时,
发送**保留其他绑定的完整对象**;`auth_hooks:null` **不会**清空全部钩子。

## IdP 与 MFA 影响

- 首次启用 IdP 要求 `VIAT_PUBLIC_URL`;生成/加密/存储任一失败都保持关闭。
  关闭会隐藏 discovery/JWKS、未来改回 HS256,但**保留密钥**——本地已签发
  令牌仍可验证至过期;重新启用复用原钥。Owner/Admin 单独管理签名钥与
  OAuth 客户端,见[端点 OAuth](../auth/endpoints.md);这不配置外部平台 SSO。
- MFA:`off` 忽略/隐藏项目因素;`optional` 询问已登记用户;`required` 强制
  密码用户登记。上游 SSO/社交与 API key 是独立入口。对已有用户的项目启用
  `required` 前,先读 [MFA](../auth/mfa.md) 并保留恢复权限。
- Devices 是独立的注册对象,不是嵌在 settings 里的字段。

## 验证、失败与回退

保存后:读回 Project、刷新控制台,并按意图抽查——新注册的允许/拒绝、
超时上限、新 MFA 登录、新载荷脱敏、安全头暴露、缺失/错租户 claim 的
拒绝。读回成功不证明提供方 TLS、钩子副作用或策略正确。

设置一般实时生效;端点认证/绑定仍需发布,**端点快照回滚不恢复项目设置**。

| HTTP | 含义 |
| --- | --- |
| `403` | 非成员,或不是项目 Owner/Admin |
| `400` | 非正超时、钩子脚本不存在、禁止的请求头/错误 claim、无公共 URL 启用 IdP 等 |
| `404` | 项目不存在 |

修复时提交完整字段,不要靠匿名访问绕过。整体替换前先保存旧完整值,按意图
恢复——没有通用的"恢复出厂"路由。

## 核验依据

契约源码 `03751a67`:`crates/viat-api/src/{dto.rs,handlers/projects.rs}`、`crates/viat-core/src/types/project.rs`、`crates/viat-db/src/projects.rs`、对应字段迁移、`web/src/pages/projects/ProjectSettingsPage.tsx`、`crates/viat-cli/src/repo/viat_yaml.rs`。[CLI project](../cli/project.md) 与[仓库同步](repo-sync.md)解释较窄的命令面。本页未执行 API、钩子、MFA、数据库/提供方操作。
