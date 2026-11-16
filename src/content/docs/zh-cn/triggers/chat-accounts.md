---
title: "聊天账号、路由与身份"
description: "完整公共账号/触发器契约、发送者绑定、投递与仓库同步。"
doc_id: triggers.chat-accounts
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# 聊天账号、路由与身份

本页是五个聊天平台的**公共契约**,与各平台页一起读:[企业微信](wecom.md)、
[个人微信](weixin.md)、[飞书](feishu.md)、[Lark](lark.md)、[钉钉](dingtalk.md)
——传输与发送能力不可互换。

模型一句话:**账号**持有凭据/连接;**触发器**筛选消息并绑定已存在的
脚本/工作流(不支持 endpoint 目标)。配置与目标草稿实时生效,**没有发布
步骤**。不提供原生 HomeAssistant/MQTT/Slurm 连接器。

权限分层:

| 操作 | 需要什么 |
| --- | --- |
| 账号/触发器 CRUD、账号 QR API | 项目成员 |
| 创建/撤销自助绑定链接 | 内容编辑权 |
| 查看链接/使用记录 | 项目成员 |
| 创建/删除发送者身份绑定 | 项目 Owner/Admin/Developer |
| 查看身份绑定 | 项目成员 |

> [!NOTE]
> 所有 API 示例源码推导、未执行;真实扫码、发送与供应商调用需明确授权。
> 管理凭据与消息解析出的最终用户身份是不同的东西。

## 完整账号契约

`POST /projects/<slug>/im/accounts` 创建、`GET …/im/accounts` 列表、
`PUT|DELETE …/im/accounts/<name>` 更新/删除。

| 字段 | 创建/更新 |
| --- | --- |
| `name` | 必填非空白;PUT 可按旧路径名重命名账号。 |
| `platform` | 必填 `wecom\|weixin\|feishu\|lark\|dingtalk`;编辑凭据时平台保持不变。 |
| `enabled` | 默认 true(含 PUT);编辑已暂停的账号要显式保留 false。 |
| `resource` | 凭据资源名;与 credentials 互斥。 |
| `credentials` | 内联 JSON,加密存储、从不回传。创建时与 resource **恰有一个**(微信扫码前用 `{}`);更新时两者都省略/null 保留当前来源,只发一个即切换来源。没有明文读取 API。 |
| `meta` | 创建默认 `{}`;更新省略/null 保持,`{}` 清空;随 `message.account.meta` 传入;bot_open_id/robot_code 由对应连接器读取。 |
| `groups` | 默认 `[]`;更新省略/null 保持,`[]` 清空。这是**账号分组(population)**,不是供应商群聊。 |
| `peer_identity` | 可选的平台侧个人身份,同平台全实例唯一;更新省略/null 保持、不能清除;冲突返回 409——避免静默抢占别人的绑定。 |

静态平台凭据用 `app_id`、`app_secret`,可选 `base_url` 受平台 host
allowlist 约束;凭据放资源的 secret 部分或加密内联字段,**不放 meta 或
仓库说明**。

AccountPublic 完整字段:
`id,name,platform,enabled,resource,has_inline_credentials,meta,groups,peer_identity,status,status_message,created_at,updated_at`
(resource/peer/status_message 可为 null)。`status` 是
`ok|degraded|needs_reauth`——**不证明消息送达**。`GET …/<name>/health`
查连接/lease;`GET …/<name>/messages` 查处理账本。默认上限:每项目 500、
总计 2000、每实例服务 200 个账号(运维配置)——超限不能靠反复创建解决。

## 完整触发器契约

`POST /projects/<slug>/im/triggers`、`GET …/im/triggers`、
`PUT|DELETE …/im/triggers/<name>`;创建与更新共用整体表单。

| 字段 | 默认/条件 |
| --- | --- |
| `name`、`platform`、`target` | 必填:名称、平台枚举、已存在的 `{kind:script\|workflow,name:"folder/name"}`。 |
| `enabled` | true。 |
| `account` | 省略/null = 汇入项目中该平台**所有**启用账号;指定名称则固定一个账号,平台必须一致。 |
| `account_groups` | `[]` 无 population 限制;非空则按账号所属 population 缩小范围。 |
| `chat_type` | 默认 any,可选 direct/group;过滤器创造不出平台不支持的流量。 |
| `keyword` | 省略/null 匹配全部;否则对规范化 text 做不区分大小写子串匹配;纯媒体消息的 text 可能为空。 |
| `require_mention` | false;仅飞书/Lark 有意义;企业微信/钉钉群消息本来就因 @ 才到达;原生微信群聊支持尚未确立。 |
| `inputs` | 默认 null;执行只合并对象常量——建议 `{}`。 |
| `params` | 默认 `{}`;"参数名 → `{from:<点分路径>,required:false,default?:<JSON>}`",如 `message.text`/`message.raw.priority`。缺失/null 叶子有 default 则用 default;required 且无 default 则失败;可选缺失保持不存在。**这里没有 HTTP 式类型转换声明。** |
| `params_strict` | false:同时传 message 与声明参数;true:不传 message(常量仍合并);声明值覆盖同名常量。 |
| `max_concurrent_runs` | 4;连接建立时读取、按账号约束,修改经重连生效;**不是**全局按触发器的顺序保证。 |
| `identity_mode` | 默认 off;另有 optional/required(见下)。 |
| `identity_key` | 省略/null 用 `message.sender_id`;点分 envelope 路径。 |
| `identity_rule` | 可选模板,必须含 `{key}`。 |
| `identity_prompt` | 可选的未绑定回复,必须含 `{url}`。mode 为 off 时所有 identity 字段必须空白/省略。 |

触发器 PUT 是**整体替换**:省略可选字段恢复默认;清空按字段用 `[]`/`{}`/
null/显式 false——不是 merge patch(账号更新那节的"保留"语义是单独例外)。
一条消息可匹配多个触发器,**各运行一次**,不是首配即停。

TriggerPublic 返回 `account_id`(可空 UUID)而不是提交的账号名;返回
`target_kind,target_name` 而不是嵌套 target;其余字段为
`id,name,enabled,platform,account_groups,chat_type,keyword,require_mention,inputs,params,params_strict,max_concurrent_runs,identity_mode,identity_key,identity_rule,identity_prompt,created_at,updated_at`。

## 输入、输出与共享身份

默认参数 = 常量 + `message:{platform,account:{id,name,meta},chat_type,
chat_id,sender_id,kind,text,mentioned,raw,reply_handle}`:

- `kind` 为 text/image/voice/file/video/event;`raw` 与媒体字段因平台而异
  ——不代表所有连接器会自动下载或转录。
- `reply_handle` 是敏感的路由能力,**不是**永久通用目标。
- `identity_mode: off` 不添加 `message.identity`,以 system:im 运行;
  `optional` 添加绑定用户对象或 null;`required` 阻止未绑定的发送者。
  绑定后沿用**当前活跃项目用户**的 principal 做授权/资源身份转发——
  绑定本身不授予任何权限。

共享绑定键是 `(project,platform,sender_key)`,不依赖某个机器人账号。
流程:先查已有绑定 → 再尝试 `identity_rule`;模板匹配到已存在的活跃
项目用户 identity 即持久化绑定。`identity_rule:"jwt:corp:{key}"` 只有在
供应商 key 与 IdP subject 确实一致时才可用——它不创建用户,也不能证明
任意 meta。手动绑定:

```http
POST /projects/demo/im/identities
Content-Type: application/json

{"platform":"feishu","sender_key":"synthetic-open-id","user":"alice"}
```

响应含
`id,platform,sender_key,project_user_id,identity,display_name,bound_via:"admin",bound_at`;
按 `?user=alice&platform=feishu` 查看,`DELETE …/im/identities/<id>` 移除。

`required` 模式下,未绑定的**私聊**用户会收到签名的 **15 分钟**项目登录
链接;`/p/<slug>/_chat/bind` 页面要求项目凭据并执行 login pre-hook。
群聊只提示转私聊——不向全体成员泄露发送者绑定链接。已停用用户不算有效
绑定。账号 population、peer_identity、邀请 meta、项目用户身份绑定是
**四种不同机制**,互不自动赋予信任。

脚本返回平台适用的文本/JSON 会自动回复,null 不发送;企业微信沿连接
回复,其他平台各有发送约束。**脚本成功或供应商 API 接受都不证明人已阅读。**

## 投递、健康与恢复

- 每个账号由一个持 lease 的实例持有连接;先写 claim 去重账本,再
  ack/持久化 cursor;每个匹配的触发器有独立的消息身份。重复投递通常被
  抑制,但**不保证外部副作用 exactly-once**。
- 供应商 ack 可能发生在"持久 claim 之后、脚本成功之前"——与 RabbitMQ
  的 success→ack 顺序不同。不保证脚本失败自动重试,也没有通用重放 API;
  遗留旧工作按一小时阈值标记失败,账本不是完整 payload 重放档案。
  **关键业务要独立的持久 outbox/工作表和业务 id。**
- 瞬态断线 2–60 秒退避,健康会话重置;撤销/配置错误停在 `needs_reauth`,
  需要人工修复——更新凭据可清此状态,仅切 enabled 不是凭据修复。
- 并发按账号计,没有全局严格顺序;脚本编辑 live 生效,连接级设置经重连
  生效。timeout 不回滚写入或已发消息;禁用/删除等对账停止新路由/连接,
  **不原子取消**在途副作用。
- 排查顺序:health → 账本 → 执行日志 → 修复目标/凭据 → 确认既有副作用
  后再重试业务。

## 自助邀请与仓库生命周期

- 原生微信 QR 建立**机器人账号**,与"发送者→项目用户"绑定是两回事。
- 内容编辑者可 `POST …/im/bind-links`,字段
  `{platform:"weixin",label?,ttl_hours:24,max_uses:50,groups:[],meta?:{…}}`:
  TTL 必须为正、受部署上限(默认 168h);max_uses 夹到 1–配置上限(默认
  500);meta 必须是对象、编码后 ≤4096 字节。响应
  `{id,url,expires_at,max_uses}`——**URL 只展示一次**。
- 需要 `VIAT_IM_BIND_BASE_URL`;页面前缀默认 `/ui`;代理 IP 限流需要可信
  代理配置。

> [!WARNING]
> 绑定 URL 是**未认证的账号创建能力**:逐人身份断言必须由已认证人的业务
> 系统签发短期单次链接;邀请 meta 优先于用户自填的 display_name。清理前
> 查看/撤销链接及用量;撤销只挡未来使用,**不停止已创建的账号**。

仓库支持 **chat** 集合,没有独立聊天 CLI:`im/accounts/<name>.yaml`、
`im/triggers/<name>.yaml`、`viat pull/push --only chat`。资源凭据账号与
触发器正常镜像;**内联/扫码账号 pull 跳过,push 不因缺失而删除**——因此
引用这类账号的触发器并非完全可移植。本地缺失的资源账号/触发器会删除
远端,先 diff。清理顺序:禁用测试触发器/账号 → 撤销邀请 → 移除测试身份
绑定 → 删除隔离配置;本地文件删除不撤销供应商凭据或外部消息。

## 核验依据

契约源码 `03751a67`:`crates/viat-api/src/handlers/{im,im_bind,im_identities}.rs`、`im/{mod,dispatch}.rs`、`im/connector/*`;`crates/viat-core/src/types/im.rs`;`crates/viat-cli/src/repo/im.rs`。本任务未验证真实供应商行为。
