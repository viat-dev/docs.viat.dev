---
title: "入站 WebSocket 端点"
description: "发布客户端连接的脚本路由 socket，了解 ticket 与连接生命周期。"
doc_id: triggers.websocket-endpoints
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# 入站 WebSocket 端点

这是**客户端连接 Viat**的方向——GET 叶子升级为 socket,按消息路由运行
脚本。与平台主动连出去的 [WebSocket 订阅](websocket-subscriptions.md)
是两回事。事件(connect/message/disconnect)只支持**脚本**,不支持
workflow;适合低频回合交互,不适合帧同步游戏循环、持久消息代理或二进制
协议服务。

权限与模型,三句话:

- 编辑需内容编辑权,发布/回滚需发布权;握手应用**已发布**的
  authorizer、gate 与端点限速。
- 连接时确定 principal,之后定期复查;事件沿用运行时的资源权限与
  timeout——socket 不自动赋予项目管理能力。
- 控制台的 Test 打开的是**真实已发布 socket**,不是草稿测试。

## 创建、发布、连接

源码推导、未执行。先创建脚本 `game/echo`:`def main(message): return message`。

```http
POST /projects/demo/endpoints
Authorization: Bearer <console-token>
Content-Type: application/json

{"segment":"play","ws_config":{"route_key":"type","routes":{"$default":{"script":"game/echo"}},"message_rate_limit":{"requests":20,"window_secs":10},"log_messages":"errors"},"allowed_authorizers":["password"]}
```

创建返回普通端点视图:含 `method:"GET"`、`path:"/play"`、
`ws_config.routes.$default:{"script_id":"<uuid>","script":"game/echo"}`,
普通 script/workflow 绑定为 null,尚未发布。记下 id 后
`POST …/endpoints/<id>/publish {}`;不带 upgrade 的普通 GET 返回 **426**。

浏览器 WebSocket 设置不了 Authorization header,用一次性 ticket 换取连接:

```http
POST /p/demo/_ws/ticket
Authorization: Bearer <endpoint-credential>

HTTP/1.1 200 OK
Content-Type: application/json

{"ticket":"<one-use-ticket>","expires_in":30}
```

30 秒内用 `wss://api.example.invalid/p/demo/play?ticket=<ticket>` 连接。
服务器/小程序客户端可直接在握手中带 bearer——**不要把长期 token 放进
URL**。发送 `{"type":"echo","id":1,"text":"hello"}` 会命中 `$default`,
原样返回一个文本帧。

## 完整 `ws_config`

| 字段 | 默认及验证 |
| --- | --- |
| `routes` | 必填;"路由 → `{script}` 或 `{script_id}`"映射,两者都有时 UUID 优先;脚本必须属于本项目;不能只有生命周期路由——至少要有一个消息路由。 |
| 路由名 | `$connect`、`$disconnect`、`$default`,或 1–64 个小写 ASCII 字母/数字/下划线。 |
| `route_key` | 默认 `"type"`;消息对象中用于选路的字符串字段。 |
| `message_rate_limit` | 可选 `{requests,window_secs,burst?}`;值为正,burst 默认 = requests;**每连接**计数,超限丢消息并返回错误帧。 |
| `log_messages` | 默认 `errors`,可选 `all`;失败与生命周期总有日志,errors 模式不保存成功消息日志及其行。 |

`PUT …/endpoints/<id>/info {"ws_config":{…}}` 在 WS 目标上**整体替换**
(省略/null 不会清空)。读取时返回 id 与当前名称(脚本删除后名称为 null,
重命名不丢绑定)。配置、路由脚本源码与符合条件的依赖按脚本快照规则在
发布时冻结,编辑后需重新发布;回滚恢复旧内容,见[快照](../publishing/snapshots.md)。

## 事件与推送契约

`ctx.ws` 提供 `connection_id`、`event`(`connect|message|disconnect`)、
`route`,断开时另有 `reason`:

- 消息事件参数为 `{message:<object>}`;生命周期事件没有 message。
- `$connect` 可读握手 `ctx.request`;返回 ≥400 或抛错即**拒绝 upgrade**
  ——此时尚未连接,向自身推送会被丢弃。
- 入站消息必须是 **JSON 对象**的文本帧;未知路由交给 `$default`,否则回
  `unknown_route`。返回非 null JSON(或显式响应 body)会发一帧;返回 null
  不回复。
- 消息级错误通常**不关闭连接**,而是回错误帧:

```json
{"type":"error","error":"unknown_route","message":"…","id":1}
```

  其他错误码:`bad_frame`、`rate_limited`、`overloaded` 及运行时错误码。
- `$disconnect` 在当前消息完成后运行,**不能**向已关闭的 socket 回复;
  reason 包括 `client`、`server`、`idle`、`lifetime`、`revoked`、
  `overloaded`、`handshake_failed`、`instance_lost`。

项目脚本可用的推送 API:`ctx.ws.send(id,data)`、
`close(id,1000|4000..4999,reason)`、`join(id,room)`、`leave`、
`broadcast(room,data,exclude=[…])`、`members(room)`、
`connections(user_id)`(TypeScript 需 await)。room 是项目内 1–200 字符的
字符串,其他项目的连接 id 对它不可见。

> [!WARNING]
> `send` 成功**不等于客户端收到**:推送至多一次、支持跨实例、同一脚本的
> 调用有序;断线重连后必须自行恢复持久状态。disconnect 处理完成后房间
> 即清理——处理器执行期间仍能读到旧成员关系。

## 顺序、限制与恢复

- **顺序**:同一连接按到达顺序串行运行,队列深度 `VIAT_WS_QUEUE_DEPTH`
  默认 32;溢出拒绝该消息但保持连接。不同连接并发,共享状态要用数据库
  事务/锁。没有自动重试或消息幂等账本——把业务 id 放进帧里。
- **限制**:默认帧上限 64 KiB(`VIAT_WS_MAX_MESSAGE_BYTES`);每实例连接
  10000(`VIAT_WS_MAX_CONNECTIONS`,超限 503 + `Retry-After`);最大生命
  86400 秒;每 300 秒复查身份。token 自身过期不会直接断开——但用户停用、
  authorizer 删除、会话撤销、角色/admin 变化、API key 过期/撤销,会在
  复查时以 **4401** 断开。
- **断开码**:每 30 秒 ping,两次无响应以 **1001** 断开;二进制帧
  **1003**;lifetime/idle 为 1001;慢读者因 256 个待发帧或写阻塞以
  **1008** 关闭;优雅重启用 **1012**(拒绝新连接并限时执行断开清理)。
  实例失联 90 秒后,存活实例对遗留连接执行一次 disconnect;旧实例恢复后
  关闭已被回收的连接,不重复处理。
- **代理与恢复**:反向代理必须转发 Upgrade/Connection 并设置足够长的
  read timeout;使用 WSS 与客户端平台的 socket 域名白名单。重连会产生
  新的 connection id,**不能**期待间隙内的推送补发。
- **验证与清理**:[fixtures](../testing/fixtures.md) 可验证处理器的决策,
  真实传输仍需明确授权的 socket 测试。取消发布只停止新握手,不撤销既有
  事件副作用;关闭测试 socket、通过关闭清理房间,再删除隔离端点/脚本。

仓库侧:`endpoints/play.get.yaml` 使用
`target:{kind:websocket,routes:{…}}`,经 `viat pull/push` 同步,用端点/
项目 CLI 发布。

## 核验依据

契约源码 `03751a67`:`crates/viat-core/src/types/websocket.rs`;`crates/viat-api/src/handlers/endpoints.rs`、`handlers/snapshots.rs`、WebSocket 分发/会话模块与测试;`crates/viat-cli/src/repo/endpoints.rs`。本页未执行传输或供应商调用。
