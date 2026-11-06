---
title: "原生 iLink 个人微信"
description: "私聊的扫码绑定、持久轮询 cursor、回复许可与重新认证。"
doc_id: triggers.weixin
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# 原生 iLink 个人微信

原生连接器是腾讯 **iLink**，不是浏览器桥接、企业微信、公众号 webhook 或通用 WebSocket 订阅。使用 HTTPS 长轮询与 QR 获取凭据。**已经确立的能力是私聊，原生群聊能力尚未确立。** 规范化代码能识别 payload 的 group_id，但解析测试不能证明供应商投递群流量；不能据此宣传群助手或使用 group-only 规则。require_mention 在原生微信无有效筛选意义。

先读[公共账号/触发器字段、权限、身份和投递](chat-accounts.md)。供应商绑定可用性/政策可能变化，本页未使用真实账号或扫码。旧文档关于永久单机器人绑定的文字不能由解析器证明：真实扫码前应告知 slot/抢占限制并验证当前政策；重新绑定可能替换旧 token 并影响现有助手。

## 创建、扫码、轮询、路由

源码推导/未执行，先有 `chat/reply`：

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

AccountPublic 返回 `id,name,platform,enabled,resource:null,has_inline_credentials:true,meta,groups,peer_identity,status,status_message,created_at,updated_at`；扫码前存了空 credentials 不表示已认证，不返回 bot_token。通过**服务器中介**开始/轮询，不要浏览器直接访问供应商：

```http
POST /projects/demo/im/accounts/personal/bind/start
Authorization: Bearer <console-token>
Content-Type: application/json

{}
```

返回 `{ "qr_url":"<renderable-QR-url>","poll_handle":"<sealed-handle>" }`。渲染 qr_url，供应商内部 qrcode 是轮询 ticket，不是图片地址。poll_handle 原样回传：

```http
POST /projects/demo/im/accounts/personal/bind/poll
Authorization: Bearer <console-token>
Content-Type: application/json

{"poll_handle":"<sealed-handle>"}
```

轮询到 confirmed/终态；等待或长轮询超时不是认证失败。handle 过期/无效要重新 start。确认后凭据存在服务器，不向浏览器暴露 token/uin/含秘密 base URL。发消息前读取当前账号/health，核对已准备好及 enabled 状态。QR 重定向/确认 base URL 受 `VIAT_IM_WEIXIN_HOSTS` 验证，默认 weixin.qq.com 域后缀，后续保存/轮询的值也受约束。

```http
POST /projects/demo/im/triggers
Authorization: Bearer <console-token>
Content-Type: application/json

{"name":"personal-reply","platform":"weixin","enabled":false,"account":"personal","chat_type":"direct","target":{"kind":"script","name":"chat/reply"},"inputs":{},"params":{},"params_strict":false,"max_concurrent_runs":1,"identity_mode":"off"}
```

TriggerPublic 返回 `account_id:"<account-uuid>"`、`target_kind:"script"`、`target_name:"chat/reply"`、id/时间及公共页中的全部规范化默认值。批量账号汇入可省略 account、以 account_groups 缩小范围，不是另一种连接器。以整体表单更新启用，保留筛选/身份策略。账号/触发器 API 写入需成员资格，自助邀请创建需 editor。

## 轮询、cursor 与回复上下文

默认 base `https://ilinkai.weixin.qq.com`，getupdates 通常挂起约 35 秒，客户端 40 秒 timeout，最少间隔 500ms；普通发送/QR API 有界 timeout（15 秒，长轮询路径除外）。空超时直接重轮询。get_updates_buf cursor 仅在批次持久 claim 后保存；崩溃可重投批次，由去重账本吸收通常重复。cursor 前进不表示脚本/回复都成功。去重优先 message_id，再 seq，再确定性发送者/时间/text 摘要。

只处理人发出的已完成消息，不把自身回复当新输入；text 拼接文本项，纯图片 text 空，可能不匹配 keyword。kind 可标识媒体，不承诺媒体下载/OCR/语音处理，原始字段在 message.raw。

**发送需要对方入站消息的 context_token**，它是会话回复许可，不是任意用户主动发送权限。自动回复和支持的 `viat.im_send` 必须遵守保存的 context 与供应商窗口；schedule 不能为沉默用户制造新许可。不要把 reply_handle 当永久凭据保存或泄露到公共日志；供应商接受也不是阅读回执。

`errcode:-14` 表示 bot_token 陈旧/被替换，是终态：账号进入 needs_reauth、停止轮询，没有 refresh-token 循环。应由正确的人重新扫码，确认替换凭据已保存且状态清除。反复切 enabled、重连或发送不能修复撤销认证；瞬态网络错误则按公共 2–60 秒退避恢复。

## 人的身份、邀请和清理

QR 绑定**机器人账号**，不自动建立项目用户 principal。message.account.meta 可携带邀请断言；发送者→项目用户另用 identity_mode 与 `(project,weixin,sender_key)` 绑定。要求认证用户的动作应 required；optional 未绑定消息没有该身份。逐人邀请必须在认证该人之后发短期单次链接，拿到共享邀请的人会获得其 meta 断言；见[公共绑定说明](chat-accounts.md)。

控制台 Accounts → Binding 处理 QR/poll，自助链接用 /im/bind-links 与配置的公共 base。`GET …/im/accounts/personal/health`、`/messages` 查看连接/处理；明确业务重放前检查失败/遗留运行，无通用可靠消息重放保证。禁用测试触发器/账号、撤销邀请和项目身份绑定、处理在途副作用后再删除隔离配置；删除 Viat 配置不等于供应商解绑/凭据撤销。内联/QR 账号 pull 跳过、push 不因本地缺失删除，资源账号和 `im/triggers/*.yaml` 用 `--only chat` 同步；没有 `viat weixin` 命令。

依据：`crates/viat-api/src/im/connector/weixin.rs`（去重/text/group 解析/stale-token 测试）、`im/dispatch.rs`、`handlers/{im,im_bind,im_identities}.rs`；`crates/viat-cli/src/repo/im.rs`。示例未执行；扫码政策、账号可用性、群投递、供应商配额和真实恢复仍是验证缺口，不可推断为支持能力。
