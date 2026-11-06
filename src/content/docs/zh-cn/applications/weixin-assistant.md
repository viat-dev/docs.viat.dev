---
title: "微信助手：原生 iLink 私聊"
description: "默认禁用、按发送者授权的命令处理器，以及人工扫码、轮询与重新认证流程。"
doc_id: applications.weixin-assistant
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# 微信私聊助手

完整模块 `examples/weixin-assistant/` 将**腾讯原生 iLink 私聊**路由到真实 Python 处理器 `wx_reply`。仅支持中英文固定帮助/状态命令，不提供群助手、企业微信、公众号 webhook、媒体转写、任意对话、设备控制或主动群发。`/status` 只表示命令处理器回答了，不声称设备/供应商健康。

**验证状态：** 协调者的离线验证环境已通过全部 **5 项单元测试**，使用真实部署处理器和明确的假上下文，不伪造供应商“绑定成功”。真实服务端路由、扫码、连接器轮询、账户登录、供应商回复及重新认证仍未验证。完整供应商交互无法离线验证，参见[验证层次](../reference/validation.md)。

## 前提与知情同意

使用已激活服务端/CLI **1.1.0**、服务端 Python/uv、平台登录及全新隔离项目。Developer/Owner/Admin 可编辑脚本/资源及发送者绑定；发布可选 HTTP 端点需 Owner/Admin。目前账户/触发器/扫码管理要求项目成员身份。工作站仅需 Python 3 即可进行离线单元验证。

真实交互还需供应商准入/可用性、服务端可访问获准的 iLink HTTPS 主机、有权使用且明确同意扫码的微信账户持有人，以及一个可登录/MFA 的已激活**项目最终用户**。扫码绑定的是机器人账户，**不是**项目用户身份。绑定名额、接管和供应商规则可能变化，扫码前核实；重新绑定可能替代现有助手 token。不要承诺永久认证或终身可复用绑定。

参考[原生微信](../triggers/weixin.md)、[聊天身份](../triggers/chat-accounts.md)、[项目用户认证](../auth/endpoints.md)。不存在 `viat weixin` 命令。

## 文件、输入与默认输出

- `project/scripts/wx_reply.py`：实际部署的处理器，无网络调用或 secret 读取。
- `project/resources/wx_settings.yaml`：账户名、**空** sender→user 授权映射、关闭的消息开关。
- `project/im/triggers/wx_private.yaml`：原生路由，固定账户 `wx-example`、`chat_type:direct`、`identity_mode:required`、**enabled:false**，脚本目标为 **`name:wx_reply`**。
- `manual/account-create.json`：真实账户创建请求体，**enabled:false**、空 credentials，刻意放在仓库同步的 `im/accounts/` **之外**。QR/行级 secret 账户不能伪装成可迁移的资源型账户文件。
- `project/workflows/wx_check.yaml` 和 `endpoints/weixin-assistant/weixin-check.post.yaml`：无副作用的诊断路径，不是微信 webhook。端点目标使用 **`ref`**，拒绝全部认证器且不发布。HTTP 调用者不能通过消息 JSON 伪造受信 chat 主体。
- `fixtures/inbound.json`：规范化合成的**未绑定**私聊输入，无 context token、无可用账户/发送者绑定。`fixtures/expected.json` 记录默认/未绑定的 null，以及明确假绑定单元上下文中的固定回复。

完整默认配置资源：

```json fixture=weixin-assistant/project/resources/wx_settings.yaml
{"name":"wx_settings","kind":"config","plain":{"data":{"account_name":"wx-example","messages_enabled":false,"sender_users":{}}},"secret":{}}
```

默认脚本输出 **null**，不触发自动回复。没有计划；触发器和人工创建的账户均禁用。原生 required 身份提示是另一条平台发送路径：开启路由后，即使 `messages_enabled:false`，**未绑定**发送者仍可能收到绑定链接。没有明确批准供应商交互时，不要启用路由。

## 应用无外部交互的内容

从手册根目录开始，只在有授权的隔离实例人工执行：

```sh
cd examples/weixin-assistant
python3 -I validate.py
cd project
viat project create weixin-assistant-example "Weixin assistant example"
viat project select weixin-assistant-example
viat project diff --only resources,scripts,workflows,endpoints
viat push --only resources,scripts,workflows,endpoints
viat workflow test wx_check --input '{}'
viat endpoint list --json
```

工作流预期为 `{"reply":null}`。私下记录创建对象的名称/ID。若执行上述测试会真正运行服务端草稿，离线验证器则不会。必要时选择另一个未占用 slug，同步改 `viat.yaml` 与命令。新建树前缀 `/weixin-assistant`，可选诊断路径为 `/p/weixin-assistant-example/weixin-assistant/weixin-check`，但保持未发布/拒绝全部。原生聊天运行**实时草稿**，不需要发布端点。

不要执行全种类 push：最小元数据未管理 authorizers/roles/scope claims，可能镜像删除预置认证配置。`--only` 选整个种类，不按名称筛选。端点同步可能清理访问树中的节点；chat 同步可能删除其他资源型账户/触发器，即使其本地文件不存在。必须隔离并审查 diff。没有可额外添加的 `push --prune` 安全模式。

## 先创建禁用的扫码账户，再登记禁用触发器

`manual/account-create.json` 是完整创建请求体。从 `project/` 发起控制台认证请求：

```sh
viat call --console --method POST /projects/weixin-assistant-example/im/accounts \
  --body '{"name":"wx-example","platform":"weixin","enabled":false,"credentials":{},"meta":{},"groups":["weixin-assistant-example"]}'
viat call --console /projects/weixin-assistant-example/im/accounts
viat project diff --only chat
viat push --only chat
viat call --console /projects/weixin-assistant-example/im/triggers
```

账户必须**先于**引用它的触发器存在。响应应包含真实 UUID、`resource:null`、`has_inline_credentials:true`、`enabled:false`；空 credentials **不表示就绪或已认证**。触发器响应将目标展开为 target_kind/target_name，并返回 account_id 而不是账户名。核对 enabled:false、chat_type:direct、identity_mode:required、账户 UUID 和 wx_reply 目标。出现意外删除/修改立即停止，不要为了消除重名覆盖真实助手。

## 人工扫码 start/poll

这些操作会联系供应商，需预先明确同意。可用控制台 Accounts → Binding，或携控制台凭据调用真实路由：

```sh
viat call --console --method POST /projects/weixin-assistant-example/im/accounts/wx-example/bind/start --body '{}'
```

返回 qr_url 与密封 poll_handle。私下渲染二维码，由预期人扫码确认，再把**原样返回的 handle**提交：

```http
POST /projects/weixin-assistant-example/im/accounts/wx-example/bind/poll
Content-Type: application/json
Authorization: Bearer <platform-token>

{"poll_handle":"<actual-sealed-handle-from-start>"}
```

轮询至确认或终态；等待/长轮询超时不等于认证失败。handle 无效/过期需重新 start。确认响应为 state:"confirmed"、already_bound、peer_identity，供应商凭据保留在服务端。不把 token、QR handle、二维码截图写入仓库或日志；供应商内部轮询票据不是二维码图片 URL。QR/确认主机受 `VIAT_IM_WEIXIN_HOSTS` 限制，不要绕过。实际实验前账户保持禁用，通过账户列表/health 确认状态，不靠“扫过码”猜测。

## 绑定并授权真实发送者

触发器要求平台解析出的有效项目用户绑定，处理器还会独立检查：

1. message.platform 必须为 weixin，direct 私聊，账户名为配置值。
2. **受信** ctx.principal.user_id 非空，ctx.principal.authorizer 为 chat，且与 message.identity.user_id 一致。
3. 服务端自有 wx_settings.plain.data.sender_users 将真实 message.sender_id 映射为同一个 UUID。
4. kind 为 text、文本不超过 256 字符、messages_enabled 必须是真布尔 true。

账户 meta、扫码 peer_identity、邀请断言、显示名、原始用户输入都不能替代这些检查。绑定键为 `(project,weixin,sender_key)`，并非某个机器人账户；共享邀请可能绑定错人。不要编造 identity_rule 把合成 ID 变为“有效身份”。

选择一种真实绑定流程：

- **自助：** 明确批准轮询和原生绑定提示后，通过控制台启用账户（保留凭据），并以完整原策略启用触发器（required、direct、固定账户）。应用回复继续关闭。预期人发送一条私聊文本后，原生 dispatcher 可能发出有效期 **15 分钟**的项目登录链接，由本人以自己的已激活项目账户完成登录/MFA。平台持久保存绑定，但不会因此自动授予应用权限。审查结果期间再次暂停路由。
- **管理员协助：** 编辑者独立核实供应商 sender key 和人的既有项目用户 identity，然后向 `POST /projects/<slug>/im/identities` 提交 `{platform:"weixin",sender_key:<verified-key>,user:<existing-user-identity>}`。user 是真实 identity 字符串，不是猜测的 UUID。不得提交本案例合成夹具作为绑定。通过 `GET /projects/<slug>/im/identities?platform=weixin` 检查，记录返回的绑定 ID 供所有权清理。

获得同意后的入站事件可在账户 `/messages` 账本中看到 sender_id；应与认证绑定及实际用户 UUID（`viat p-user list --json`）匹配，不信未经验证的截图/名字。仅把核实映射存入 sender_users，真实个人标识不得提交到公共夹具。`viat push --only resources` 实时更新应用策略，不需要发布。然后取得**回复**的独立同意才设 messages_enabled:true，并在授权会话期间启用账户/触发器。控制台触发器更新是完整替换，需保留所有过滤、目标、输入、并发和 required 身份字段。若使用仓库 enabled:true，先 `viat project diff --only chat`；不要提交已启用的运行副本，默认源码仍应关闭。

## 验证私聊路由与安全回复

在真实授权绑定和回复开关开启后，`/help`、`帮助` 返回固定帮助；`/status`、`状态` 返回固定处理器可用文本。未知命令只返回简短双语拒绝，不回显输入。纯图片、超长文本、其他平台/群聊/账户/未授权发送者返回 null。**原生群聊并非已确立能力**：解析器识别 group_id 不代表供应商支持群投递，require_mention 也不能创造该能力。

处理器不泄露 raw、reply_handle、QR token 或上下文许可，没有 LLM/工具/动作路径。validate.py 加载**真实部署的 wx_reply.py**、共享配置和合成入站文件，仅在内存中明确创建**测试专用**假主体/绑定，覆盖回复开启和全部授权拒绝；没有部署或声称获得有效假绑定。通过单元检查不证明真实身份注入、供应商规范化、轮询或发送成功。

人工观测路由：

```sh
viat call --console /projects/weixin-assistant-example/im/accounts/wx-example/health
viat call --console /projects/weixin-assistant-example/im/accounts/wx-example/messages
```

结合账户状态、去重/消息结果与执行日志判断。ok、脚本成功或供应商接受不代表送达/已读。成功和拒绝都需验证；required 模式未绑定拒绝可能发原生绑定提示，已绑定但不在应用名单的发送者不会收到处理器回复。

## 轮询游标、context_token 与 `-14` 恢复

原生 iLink 通过 HTTPS getupdates 长轮询（约 35 秒，客户端超时 40 秒），空超时后继续轮询，持久认领批次后再保存 get_updates_buf。普通重放由去重账本吸收；认领/推进游标不等于每个脚本和回复成功。聊天路由不是恰好一次执行或通用重放队列。

回复需要收件人入站消息携带的 **context_token** 会话许可。原生 connector/dispatcher 保存并用于发送处理器返回文本；应用不会创建许可，不把它当永久凭据，也不能任意发给其他人。夹具故意没有有效许可。计划任务无法替沉默的收件人制造发消息权限，所以单元函数返回成功**不是供应商发送测试**。

供应商 errcode:-14 表示机器人 token 已失效/被替换：账户进入 needs_reauth，停止轮询。不要循环刷新、重复发送或切换 enabled 期待修复。暂停触发器，由预期人重新扫码，核对确认后的凭据状态及 `/health`，再次明确批准才恢复。区分 handle 过期与机器人凭据撤销；暂时网络错误使用 2–60 秒重连退避。不承诺永久认证、自动刷新 token 或恢复全部失败消息，人工业务重放前必须核对已有影响。

## 仅清理拥有的已注册对象

先设 messages_enabled:false、本地触发器恢复 enabled:false，通过控制台用完整保留策略禁用自有账户/触发器。等待协调并核对在途回复，禁用不是瞬时取消。只撤销自己实际创建的邀请（本模块无需创建邀请）。检查记录的所有权后：

```sh
viat call --console --method DELETE /projects/weixin-assistant-example/im/triggers/wx_private
viat call --console --method DELETE /projects/weixin-assistant-example/im/accounts/wx-example
viat endpoint delete CHECK_ENDPOINT_ID
viat workflow delete wx_check
viat script delete wx_reply
viat resource delete wx_settings
```

CHECK_ENDPOINT_ID 只能是记录的自有诊断叶子；若曾明确发布，先取消发布。仅当确认其他机器人不依赖该项目级绑定，才 `DELETE /projects/weixin-assistant-example/im/identities/<recorded-binding-id>` 删除**自有**发送者绑定。一次性用户仅在本次创建时删除。`weixin-assistant` 树仅在本次新建且检查为空时才 `viat tree delete weixin-assistant`。

删除配置不会在供应商侧解绑/撤销凭据或抹去已发消息，供应商侧撤销需按当前政策单独处理。QR/行级凭据账户被 pull 跳过、push 也保护其免于因本地缺失而删除，所以删除本地文件**不是清理**。触发器会镜像删除，不要用不完整 checkout/blanket prune 清理。1.1.0 没有注册项目 DELETE 路由，空项目可以保留。

## 证据与剩余人工前提

固定版本产品证据：`crates/viat-cli/src/repo/{im,endpoints}.rs`、`crates/viat-api/src/im/{dispatch,connector/weixin}.rs`、`handlers/{im,im_identities}.rs`、`crates/viat-api/src/lib.rs` 注册路由和 Python 主体/资源投影。[仓库同步](../projects/repo-sync.md)说明镜像语义。

仍需准备并人工验证：真实准入账户、当前绑定政策与同意、获准主机、实际 QR/poll 确认、项目用户登录绑定、核实的发送者映射、新鲜会话许可、真实私聊路由/回复观测，以及获得授权后的撤销 token 重新认证实验。离线夹具不宣称覆盖供应商/群聊/永久认证。
