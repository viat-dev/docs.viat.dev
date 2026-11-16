---
title: "原生 iLink 个人微信"
description: "私聊的扫码绑定、持久轮询 cursor、回复许可与重新认证。"
doc_id: triggers.weixin
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# 原生 iLink 个人微信

原生连接器走腾讯 **iLink**:HTTPS 长轮询 + 扫码获取凭据。它不是浏览器
桥接、企业微信、公众号 webhook,也不是通用 WebSocket 订阅。

能力边界先立住:

- **已确立的能力是私聊;原生群聊能力尚未确立。** 规范化代码能识别
  payload 里的 group_id,但解析测试不能证明供应商会投递群流量——不能
  据此宣传"群助手"或使用 group-only 规则。
- `require_mention` 在原生微信没有有效筛选意义。
- 先读[公共账号/触发器字段、权限、身份和投递](chat-accounts.md)。
  供应商绑定可用性/政策可能变化;本页未使用真实账号或扫码。旧文档关于
  "永久单机器人绑定"的文字无法由解析器证明——真实扫码前告知 slot/抢占
  限制并验证当前政策;重新绑定可能替换旧 token 并影响现有助手。

## 创建、扫码、轮询、路由

源码推导、未执行。先建脚本 `chat/reply`:

```python
def main(message):
    return "received: " + message["text"]
```

```http
POST /projects/demo/im/accounts
Authorization: Bearer <console-token>
Content-Type: application/json

{"name":"personal","platform":"weixin","enabled":false,"credentials":{},"meta":{},"groups":["test"]}
```

AccountPublic 返回
`id,name,platform,enabled,resource:null,has_inline_credentials:true,meta,groups,peer_identity,status,status_message,created_at,updated_at`。
扫码前保存的空 credentials **不表示已认证**;bot_token 不会返回。

扫码走**服务器中介**(不要让浏览器直连供应商):

```http
POST /projects/demo/im/accounts/personal/bind/start
Authorization: Bearer <console-token>
Content-Type: application/json

{}
```

返回 `{ "qr_url":"<renderable-QR-url>","poll_handle":"<sealed-handle>" }`。
渲染 `qr_url`;供应商内部的 qrcode 是轮询 ticket,**不是**图片地址。
`poll_handle` 原样回传:

```http
POST /projects/demo/im/accounts/personal/bind/poll
Authorization: Bearer <console-token>
Content-Type: application/json

{"poll_handle":"<sealed-handle>"}
```

轮询到 confirmed 或终态;等待/长轮询超时**不是**认证失败。handle 过期/
无效就重新 start。确认后凭据存在服务器——token/uin/含秘密的 base URL
不会暴露给浏览器。发消息前读账号/health,核对"已准备好"与 enabled。
QR 重定向/确认的 base URL 受 `VIAT_IM_WEIXIN_HOSTS` 验证(默认
weixin.qq.com 域后缀),后续保存/轮询的值同样受约束。

```http
POST /projects/demo/im/triggers
Authorization: Bearer <console-token>
Content-Type: application/json

{"name":"personal-reply","platform":"weixin","enabled":false,"account":"personal","chat_type":"direct","target":{"kind":"script","name":"chat/reply"},"inputs":{},"params":{},"params_strict":false,"max_concurrent_runs":1,"identity_mode":"off"}
```

TriggerPublic 返回 `account_id:"<account-uuid>"`、
`target_kind:"script"`、`target_name:"chat/reply"`、id/时间及公共页的
全部规范化默认值。批量汇入多账号可省略 `account`、用 `account_groups`
缩小范围——**这不是另一种连接器**。更新用整体表单,保留筛选/身份策略;
账号/触发器 API 写入需成员资格,自助邀请创建需 editor。

## 轮询、cursor 与回复上下文

- 默认 base `https://ilinkai.weixin.qq.com`;getupdates 通常挂起约 35
  秒,客户端 40 秒超时,最少间隔 500ms;普通发送/QR API 有限时(15 秒,
  长轮询路径除外)。空超时直接重轮询。
- `get_updates_buf` cursor 只在**批次持久 claim 后**保存;崩溃可能重投
  整批,重复通常由去重账本吸收。**cursor 前进不表示脚本/回复都成功。**
  去重优先 message_id,其次 seq,再次确定性的"发送者/时间/text"摘要。
- 只处理**人发出的已完成消息**,不把自身回复当新输入;text 拼接文本项,
  纯图片消息 text 为空、可能不匹配 keyword;kind 可标识媒体,但不承诺
  下载/OCR/语音处理,原始字段在 `message.raw`。

> [!WARNING]
> **发送需要对方入站消息的 context_token**——它是会话回复许可,不是
> "向任意用户主动发送"的权限。自动回复与受支持的 `viat.im_send` 必须遵守
> 保存的 context 与供应商窗口;schedule 不能为沉默用户制造新许可。不要
> 把 reply_handle 当永久凭据保存,也不要泄露到公共日志;供应商接受发送
> 不是阅读回执。

**`errcode:-14`** 表示 bot_token 陈旧/被替换,是**终态**:账号进入
`needs_reauth`、停止轮询,没有 refresh-token 循环。处理:由正确的人重新
扫码,确认替换凭据已保存且状态清除。反复切 enabled、重连或发送都不能
修复已撤销的认证;瞬态网络错误则按公共的 2–60 秒退避恢复。

## 人的身份、邀请和清理

- QR 绑定的是**机器人账号**,不自动建立项目用户 principal。
  `message.account.meta` 可携带邀请断言;发送者→项目用户的映射另走
  `identity_mode` 与 `(project,weixin,sender_key)` 绑定。要求认证用户
  的动作用 `required`;`optional` 下未绑定消息没有该身份。
- 逐人邀请必须在**认证该人之后**发短期单次链接;拿到共享邀请的人会
  获得其 meta 断言——见[公共绑定说明](chat-accounts.md)。
- 控制台 **Accounts → Binding** 处理 QR/poll;自助链接用 `/im/bind-links`
  与配置的公共 base。`GET …/im/accounts/personal/health`、`/messages`
  查看连接与处理;明确业务重放前检查失败/遗留运行——**没有**通用可靠
  的消息重放保证。
- 清理:禁用测试触发器/账号 → 撤销邀请与项目身份绑定 → 处理在途副作用
  → 删除隔离配置。**删除 Viat 配置不等于供应商解绑/凭据撤销。**内联/
  QR 账号 pull 跳过、push 不因本地缺失删除;资源账号与
  `im/triggers/*.yaml` 用 `--only chat` 同步;没有 `viat weixin` 命令。

## 核验依据

契约源码 `03751a67`:`crates/viat-api/src/im/connector/weixin.rs`(去重/text/group 解析/stale-token 测试)、`im/dispatch.rs`、`handlers/{im,im_bind,im_identities}.rs`;`crates/viat-cli/src/repo/im.rs`。示例未执行;扫码政策、账号可用性、群投递、供应商配额与真实恢复仍是验证缺口,不可推断为支持能力。
