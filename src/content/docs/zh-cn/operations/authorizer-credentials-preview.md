---
title: "Authorizer 完整凭据替换（预览）"
description: "密钥包导入原子替换配置与凭据，显式区分无密钥和未导出。"
doc_id: operations.authorizer-credentials-preview
verified_release: 'unreleased'
channel: preview
contract_ids: []
---

这是[迁移可靠性修复](migration-reliability-preview.md)的未发布补修，不是 1.3.0 已有能力。使用它需要包含本修复的目标服务器与 CLI。稳定参考和契约 pin 不变。

## 为什么不复用普通编辑

普通 `PUT /projects/{slug}/authorizers/{name}` 是表单编辑接口：空白或 `null` 密钥保留旧值，social 密钥按字段合并。此行为仍然保留。把源配置与源密钥送到这个接口并不代表完整替换，目标独有的可选 AES 密钥可能留下。

导入覆盖改用独立的 `PUT /projects/{slug}/authorizers/{name}/credentials`。配置和整个密钥 blob 在一个数据库语句中更新；源里没有的可选凭据不会从目标继承。不会读取或解密目标旧 blob，因此损坏的旧 blob 也可被完整有效的源替换。对象 ID、名称、kind 以及依赖引用不变，完成后失效相关 authorizer 缓存。

## 请求与权限

调用者必须具有该项目的 `owner`、`admin` 或 `developer` 成员角色，对象必须已存在且 kind 为 `oauth_oidc` 或 `social`。这是管理 API，不是 `/p/:slug/` 下的公开调用接口。

| 字段 | 规则 |
| --- | --- |
| `config` | 必须显式提供完整 JSON 对象；按该 kind 的既有配置规则校验，不能省略或传 `null` |
| `secret` | 必须显式提供对象或 `null`；省略拒绝，不是 KEEP |
| `default_role` | 省略或 `null` 保留数据库当前值；`""` 清空；非空字符串必须命中本项目角色 |

顶层未知字段拒绝。OIDC secret 只接受 `client_secret`，并且必须是非空可用字符串。social secret 只接受 `app_secret`、`app_private_key`、`aes_key`；后两者允许 `null`，所有字段不接受其他值类型。自持凭据的 social 仍需其 provider 对应的 app secret 或 RSA 私钥；委托型仍需有效的 `platform_app` 绑定，Alipay 小程序开启 `collect_phone` 仍需自身 AES 密钥。非空私钥和 AES 密钥校验格式，即使当前未采集手机号也不接受损坏的 AES 密钥。`client_secret` 和 `app_secret` 长度上限 1024 字节，非空 RSA 私钥上限 8192 字节。

`secret: null` 仅在源配置合法地无需自身凭据时可清空整个旧 blob；不是绕过必需密钥的入口。可选字段缺席、`null` 或空白不继承目标值。这里仍复用 provider 的存储规则，例如委托型只保存其允许保留的 AES 凭据，不把其他凭据当成自持身份。

成功返回 `200` 和脱敏 authorizer 对象，不返回加密 blob 或明文密钥。权限、项目范围、配置、必需密钥或角色校验失败时不执行替换。未知字段、坏密钥类型/格式返回校验错误，不回显凭据值。该接口没有密钥读取能力。

## 导入如何证明“源没有密钥”

带 `--with-secrets` 的导出在加密信封 `authorizers` map 内区分：

- 对象：源对象持有导出的凭据。
- 显式 `null`：源数据库行的 `encrypted_secret` 确实为 NULL。
- 没有条目：没有披露证明，可能来自旧 exporter 或范围排除；不能推断无密钥。

标记只为导出范围内的 OIDC/social 写入，只存在于加密载荷中，不计入实际 secret 披露数量或名称列表。空字节/损坏 blob 不是“没有密钥”，必须让导出失败。非 NULL 的 authorizer blob 即使成功解密，也必须是 JSON 对象；加密的 JSON `null`、数组或标量都不是无密钥证明，不会被转换为清空目标的标记。信封版本仍为 v1，显式 null 标记需要本修复的 CLI；旧 CLI 不能完成这种替换。

`--update-authorizers` 仍默认关闭。显式开启后，覆盖已有 OIDC/social 必须有完整源配置和对象或显式 null 的凭据快照；缺少快照则跳过该 authorizer，并阻止同次 `--publish`。即使可见配置相同，也会提交完整替换。新建合法无自身密钥的委托型对象可继续没有信封，因为它没有旧目标密钥可残留。

旧目标服务器不支持新路由时，导入失败，**不回退普通 PUT 合并**。应升级目标并重新执行，而不是去掉安全检查。其他资产可能已经导入，本保证仅是单个 authorizer 配置与密钥的原子替换，不是整项目事务或外部身份提供商事务。

## 隔离验证与恢复

先在隔离目标中准备一个带可选 AES 凭据的测试 authorizer，再用包含显式无 AES/无密钥快照的包导入；确认默认保留和显式覆盖分别符合预期。不要仅凭公开 GET 配置未变化就断言密钥未变化；使用测试身份提供商或隔离登录流程验证，不打印密钥。

另行验证：无快照时报告 skipped 且不发布；旧服务器拒绝时不发普通 PUT；坏源密钥时目标保持不变；角色省略与显式清空不同。测试回归使用本地 HTTP 桩和隔离数据库，不调用真实身份提供商。

错误后先修正源配置、凭据或目标版本，再重新导入。需要恢复时使用事先安全保管的完整旧配置/凭据快照，重新执行完整替换；本接口不会保留旧密钥供自动回滚。包和一次性密钥分开保存，密钥只经 stdin 交给导入，不放进参数、日志或仓库；验证结束后清理不需要的副本。

本轮新增能力由 bundle CLI 和管理 API 使用，Console 普通表单与普通 `push` 语义不变；不新增独立 CLI authorizer 子命令或 MCP 工具。
