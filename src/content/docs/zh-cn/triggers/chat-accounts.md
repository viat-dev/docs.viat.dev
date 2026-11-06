---
title: "聊天账号、路由与身份"
description: "完整公共账号/触发器契约、发送者绑定、投递与仓库同步。"
doc_id: triggers.chat-accounts
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# 聊天账号、路由与身份

本页是[企业微信](wecom.md)、[个人微信](weixin.md)、[飞书](feishu.md)、[Lark](lark.md)、[钉钉](dingtalk.md)的公共契约，请与平台页一起读，传输和发送能力不可互换。账号持有凭据/连接，触发器筛选消息并绑定已存在的**脚本/工作流**，不支持 endpoint 目标。配置和目标草稿实时生效，无发布步骤；不提供原生 HomeAssistant、MQTT、Slurm 连接器。

所有 API 示例均源码推导/未执行；真实扫码、发送和供应商调用需明确授权。账号/触发器 CRUD 及账号 QR API 当前要求**项目成员**；创建/撤销自助链接需内容编辑权，查看链接/使用记录需成员资格；创建/删除发送者身份绑定需 Owner/Admin/Developer 项目权，查看需成员资格。管理凭据与消息解析出的最终用户身份不同。

## 完整账号契约

`POST /projects/<slug>/im/accounts` 创建，`GET …/im/accounts` 列表，`PUT|DELETE …/im/accounts/<name>` 更新/删除。

| 字段 | 创建/更新 |
| --- | --- |
| `name` | 必填非空白；PUT 可重命名由旧路径名指定的账号。 |
| `platform` | 必填 `wecom|weixin|feishu|lark|dingtalk`，编辑凭据时保留平台。 |
| `enabled` | 默认 true，包括 PUT；编辑已暂停账号须显式保留 false。 |
| `resource` | 凭据资源名，与 credentials 互斥。 |
| `credentials` | 内联 JSON，加密存储，从不回传；创建时与 resource 必须恰有一个，微信扫码前用 `{}`。更新时两者省略/null 保留当前来源，发送一个则切换来源，无明文读取 API。 |
| `meta` | 创建默认 `{}`，更新省略/null 保持，`{}` 清空；随 message.account.meta 传入，bot_open_id/robot_code 会由对应连接器读取。 |
| `groups` | 默认 `[]`，更新省略/null 保持，`[]` 清空；这是账号 population，不是供应商群聊。 |
| `peer_identity` | 可选平台侧人的身份，同平台全实例唯一；更新省略/null 保持，不清除；冲突返回 409，避免静默抢占绑定。 |

静态平台凭据使用 `app_id`、`app_secret`，可选 `base_url` 受平台 host allowlist 约束。凭据放资源 secret 部分或加密内联字段，不放 meta/仓库说明。AccountPublic 完整字段为 `id,name,platform,enabled,resource,has_inline_credentials,meta,groups,peer_identity,status,status_message,created_at,updated_at`；resource/peer/status_message 可为 null。status 是 `ok|degraded|needs_reauth`，不证明消息送达。`GET …/<name>/health` 查连接/lease，`GET …/<name>/messages` 查处理账本。默认上限每项目 500、总计 2000、每实例服务 200 账号，由运维配置；超限不能靠反复创建解决。

## 完整触发器契约

`POST /projects/<slug>/im/triggers`、`GET …/im/triggers`、`PUT|DELETE …/im/triggers/<name>`；创建和更新共用整体表单。

| 字段 | 默认/条件 |
| --- | --- |
| `name`、`platform`、`target` | 必填名称、平台枚举、已存在 `{kind:script|workflow,name:"folder/name"}`。 |
| `enabled` | true。 |
| `account` | 省略/null 汇入项目中所有该平台启用账号；名称固定一个账号，平台必须一致。 |
| `account_groups` | `[]` 无 population 限制，非空按账号所属 population 缩小范围。 |
| `chat_type` | 默认 any，可 direct/group；过滤器不能创造平台不支持的流量。 |
| `keyword` | 省略/null 匹配全部，否则对规范化 text 做不区分大小写的子串匹配；纯媒体 text 可能空。 |
| `require_mention` | false；仅飞书/Lark 有意义；企业微信/钉钉群消息本来就因 @ 才到达，原生微信群聊支持尚未确立。 |
| `inputs` | 默认 null；执行只合并对象常量，建议 `{}`。 |
| `params` | 默认 `{}`，参数名 → `{from:<点分路径>,required:false,default?:<JSON>}`，如 message.text/message.raw.priority。缺失/null 叶子有 default 则使用，无默认的 required 失败，可选缺失保持不存在；这里没有 HTTP 类型转换声明。 |
| `params_strict` | false 同时传 message 和声明参数；true 不传 message，常量仍合并；声明值覆盖同名常量。 |
| `max_concurrent_runs` | 4，连接建立时读取，按账号约束，修改在重连生效；不是全局按触发器顺序保证。 |
| `identity_mode` | off，也支持 optional/required，下述。 |
| `identity_key` | 省略/null 使用 message.sender_id；点分 envelope 路径。 |
| `identity_rule` | 可选模板，必须含 `{key}`。 |
| `identity_prompt` | 可选未绑定回复，必须含 `{url}`。mode off 时所有 identity 字段必须空白/省略。 |

触发器 PUT 是**整体替换**，省略可选字段恢复默认；按字段用 `[]`、`{}`、null、显式 false，不是 merge patch。账号更新保留语义是上节单独的例外。一条消息可匹配多个触发器，各运行一次，不是首个匹配即停止。

TriggerPublic 返回 `account_id`（可空 UUID），不是提交的账号名；返回 `target_kind,target_name`，不是嵌套 target。其余字段为 `id,name,enabled,platform,account_groups,chat_type,keyword,require_mention,inputs,params,params_strict,max_concurrent_runs,identity_mode,identity_key,identity_rule,identity_prompt,created_at,updated_at`。

## 输入、输出与共享身份

默认参数是常量加 `message:{platform,account:{id,name,meta},chat_type,chat_id,sender_id,kind,text,mentioned,raw,reply_handle}`。kind 为 text/image/voice/file/video/event；raw/媒体字段因平台而异，不代表所有连接器自动下载或转录。reply_handle 是敏感路由能力，不是永久通用目标。identity_mode off 不添加 message.identity，以 system:im 运行；optional 添加绑定用户对象或 null；required 阻止未绑定发送者。绑定后沿用 active 项目用户的 principal 做授权/资源身份转发，绑定本身不授予权限。

共享绑定键为 `(project,platform,sender_key)`，不依赖某个机器人账号。先查已有绑定，再尝试 identity_rule；模板匹配已存在 active 项目用户 identity，成功持久化绑定。只有供应商 key 与 IdP subject 确实一致才可用 `identity_rule:"jwt:corp:{key}"`；它不创建用户，也不证明任意 meta。手动绑定：

```http
POST /projects/demo/im/identities
Content-Type: application/json

{"platform":"feishu","sender_key":"synthetic-open-id","user":"alice"}
```

响应含 `id,platform,sender_key,project_user_id,identity,display_name,bound_via:"admin",bound_at`；可按 `?user=alice&platform=feishu` 查看，`DELETE …/im/identities/<id>` 移除。required 下未绑定私聊用户可收到签名的 **15 分钟**项目登录链接；`/p/<slug>/_chat/bind` 页面要求项目凭据并执行 login pre-hook。群聊只提示转私聊，不向所有成员泄露发送者绑定链接。已停用用户不视为有效绑定。账号 population、peer_identity、邀请 meta、项目用户身份绑定是不同机制，互不自动赋予信任。

返回平台适用文本/JSON 自动回复，null 不自动发送。企业微信沿连接回复，其他平台有各自发送约束。脚本成功或供应商 API 接受都不证明人已阅读。

## 投递、健康与恢复

每账号一个持 lease 实例持有连接。先 claim 去重账本，再 ack/持久化 cursor；每个匹配触发器有独立消息身份。可抑制通常重复投递，但**不保证外部副作用 exactly-once**。供应商 ack 可以发生在持久 claim 之后、脚本成功之前，与 RabbitMQ success→ack 不同。不保证每次脚本失败自动重试，也无通用重放 API。遗留旧工作按一小时阈值标记失败，账本不是完整 payload 重放档案；关键业务需独立持久 outbox/工作表和业务 id。

瞬态断线 2–60 秒退避，健康会话重置；撤销/配置错误停在 needs_reauth，需要人修复，更新凭据可清此状态，仅切 enabled 不是凭据修复。并发按账号，没有全局严格顺序；脚本编辑 live，连接级设置重连生效。timeout 不回滚写入或已发送消息；禁用/删除需等对账停止新路由/连接，不原子取消在途副作用。检查 health、账本、执行日志，修复目标/凭据，再确认既有副作用后重试业务。

## 自助邀请及仓库生命周期

原生微信 QR 建立机器人账号，与发送者→项目用户绑定不同。editor 可 `POST …/im/bind-links`，字段 `{platform:"weixin",label?,ttl_hours:24,max_uses:50,groups:[],meta?:{…}}`。TTL 必须为正，受部署最大默认 168h 限制；max_uses 夹到 1–配置上限（默认 500）；meta 必须对象且编码 <=4096 字节。响应 `{id,url,expires_at,max_uses}` 只展示一次 URL。需要 `VIAT_IM_BIND_BASE_URL`；页面前缀默认 `/ui`，代理 IP 限流需要可信代理配置。URL 是未认证创建账号能力；逐人身份断言必须由**已认证人的业务系统**发短期单次链接，邀请 meta 优先于自己填的 display_name。清理前查看/撤销链接及 uses；撤销仅挡未来使用，不停止已创建账号。

仓库支持 **chat**，没有独立聊天 CLI 命令：`im/accounts/<name>.yaml`、`im/triggers/<name>.yaml`，`viat pull/push --only chat`。资源凭据账号与触发器正常镜像；内联/扫码账号 pull 跳过，push 不因缺失而删除。因此引用这些账号的触发器并非完全可移植。本地缺失资源账号/触发器会删除远端，先 diff。禁用测试触发器/账号、撤销邀请、移除测试身份绑定后再删除隔离配置；本地文件删除不撤销供应商凭据或外部消息。

依据：`crates/viat-api/src/handlers/{im,im_bind,im_identities}.rs`、`im/{mod,dispatch}.rs`、`im/connector/*`；`crates/viat-core/src/types/im.rs`；`crates/viat-cli/src/repo/im.rs`。本任务未验证真实供应商行为。
