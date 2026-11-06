---
title: "入站 WebSocket 端点"
description: "发布客户端连接的脚本路由 socket，了解 ticket 与连接生命周期。"
doc_id: triggers.websocket-endpoints
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# 入站 WebSocket 端点

这里是**客户端连接 Viat**，与平台主动连接外部 feed 的 [WebSocket 订阅](websocket-subscriptions.md)不同。GET 叶子升级为 socket，connect/message/disconnect 事件只运行**脚本**，不支持 workflow。适合低频回合交互，不是帧同步游戏循环、持久消息代理或二进制协议服务。

编辑需内容编辑权，发布/回滚需发布权。握手应用已发布的 authorizer、gate 和端点限速。连接时确定 principal，随后定期复查；事件沿用运行时资源权限和 timeout，socket 不自动赋予项目管理能力。

## 创建、发布、连接

源码推导/未执行示例：先创建 `game/echo`，内容为 `def main(message): return message`。

```http
POST /projects/demo/endpoints
Authorization: Bearer <console-token>
Content-Type: application/json

{"segment":"play","ws_config":{"route_key":"type","routes":{"$default":{"script":"game/echo"}},"message_rate_limit":{"requests":20,"window_secs":10},"log_messages":"errors"},"allowed_authorizers":["password"]}
```

创建返回普通端点视图，含 `method:"GET"`、`path:"/play"`、`ws_config.routes.$default:{"script_id":"<uuid>","script":"game/echo"}`，普通 script/workflow 绑定为 null，尚未发布。读取保存的 id 后执行 `POST …/endpoints/<id>/publish {}`。没有 upgrade 的普通 GET 返回 **426**。

浏览器 WebSocket 无法设置 Authorization，可交换一次性 ticket：

```http
POST /p/demo/_ws/ticket
Authorization: Bearer <endpoint-credential>

HTTP/1.1 200 OK
Content-Type: application/json

{"ticket":"<one-use-ticket>","expires_in":30}
```

30 秒内连接 `wss://api.example.invalid/p/demo/play?ticket=<ticket>`。服务器/小程序客户端可直接在握手设置 bearer；不要把长期 token 放 URL。发送 `{"type":"echo","id":1,"text":"hello"}`，由 `$default` 接收并原样返回一个文本帧。控制台 Test 打开**真实已发布 socket**，不是测试草稿。

## 完整 `ws_config`

| 字段 | 默认及验证 |
| --- | --- |
| `routes` | 必填路由 → `{script}` 或 `{script_id}` 映射，两者都有时 UUID 优先；脚本必须属于项目；不能只有生命周期路由，至少有一个消息路由。 |
| 路由名 | `$connect`、`$disconnect`、`$default`，或 1–64 个小写 ASCII 字母/数字/下划线。 |
| `route_key` | 默认 `"type"`，消息对象中选路由的字符串字段。 |
| `message_rate_limit` | 可选 `{requests,window_secs,burst?}`，值为正数，burst 默认 requests；每连接计数，超限丢消息并返回错误帧。 |
| `log_messages` | 默认 `errors`，可选 `all`；失败和生命周期总有日志，errors 模式不保存成功消息日志及其行。 |

`PUT …/endpoints/<id>/info {"ws_config":{…}}` 在 WS 目标上整体替换；省略/null 不会清空。读取返回 id 和当前名称（删除后名称 null），重命名不丢绑定。配置、路由脚本源码及符合条件的依赖按脚本快照规则在发布时冻结，编辑后需重新发布；回滚恢复旧内容，见[快照](../publishing/snapshots.md)。

## 事件与推送契约

`ctx.ws` 含 `connection_id`、`event`（`connect|message|disconnect`）、`route`，断开时有 `reason`。消息参数为 `{message:<object>}`，生命周期无 message。`$connect` 可读握手 `ctx.request`；返回 >=400 或抛错拒绝 upgrade。此时尚未连接，向自身推送会丢弃。入站消息必须是 JSON 对象文本帧；未知路由交给 `$default`，否则返回 `unknown_route`。返回非 null JSON/显式响应 body 会发一帧，null 不回复。消息错误通常不关闭连接：

```json
{"type":"error","error":"unknown_route","message":"…","id":1}
```

其他错误包括 `bad_frame`、`rate_limited`、`overloaded` 和运行时错误码。`$disconnect` 等当前消息完成后运行，不能回复已关闭 socket；reason 包括 `client`、`server`、`idle`、`lifetime`、`revoked`、`overloaded`、`handshake_failed`、`instance_lost`。

项目脚本可调用 `ctx.ws.send(id,data)`、`close(id,1000|4000..4999,reason)`、`join(id,room)`、`leave`、`broadcast(room,data,exclude=[…])`、`members(room)`、`connections(user_id)`；TypeScript 要 await。room 是项目内 1–200 字符字符串，其他项目 id 视为未知。send 接受**不等于客户端收到**；推送至多一次、支持跨实例、同脚本调用有序，断线后须恢复持久状态。disconnect 处理后清理房间，因此处理器还能读取旧成员关系。

## 顺序、限制与恢复

同连接按到达顺序串行运行，`VIAT_WS_QUEUE_DEPTH` 默认 32；溢出拒绝该消息但保持连接。不同连接并发，共享状态需数据库事务/锁。没有自动重试或消息幂等账本，业务 id 应放进帧。

默认帧上限 64 KiB（`VIAT_WS_MAX_MESSAGE_BYTES`），每实例连接 10000（`VIAT_WS_MAX_CONNECTIONS`，超限 503 + Retry-After），最大生命 86400 秒，每 300 秒复查身份。token 自身过期不会直接断开；用户停用、authorizer 删除、会话撤销、角色/admin 变化、API key 过期/撤销可在复查时以 **4401** 断开。每 30 秒 ping，两次无响应以 **1001** 断开；二进制帧 **1003**，lifetime/idle 为 1001；慢读者可因 256 个待发帧或写阻塞被 **1008** 关闭。优雅重启用 **1012**，拒绝新连接并限时执行断开清理。实例失联 90 秒后，存活实例对遗留连接执行一次 disconnect；旧实例恢复后关闭已回收连接，不重复处理。

反向代理必须转发 Upgrade/Connection 并设足够长 read timeout；使用 WSS 和客户端平台 socket 域名白名单。重连会产生新 id，不能期待间隙推送补发。[fixtures](../testing/fixtures.md) 可验证处理器决策，传输仍需明确授权的真实 socket 测试。取消发布停止新握手，不代表撤销既有事件副作用；关闭测试 socket、通过关闭清房间，再删除隔离端点/脚本。

仓库 `endpoints/play.get.yaml` 使用 `target:{kind:websocket,routes:{…}}`，经 `viat pull/push` 同步，端点/项目 CLI 发布。依据：`crates/viat-core/src/types/websocket.rs`；`crates/viat-api/src/handlers/endpoints.rs`、`handlers/snapshots.rs`、WebSocket 分发/会话模块与测试；`crates/viat-cli/src/repo/endpoints.rs`。本页未执行传输或供应商调用。
