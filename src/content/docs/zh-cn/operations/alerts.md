---
title: 配置与运维告警
description: 定义项目健康规则、授权目标、安全验证投递并处理失败，避免错误保证。
doc_id: operations.alerts
verified_release: '1.1.0'
channel: stable
---

# 配置与运维告警

告警观察的是**整个项目**,不是单个端点或调度。权限与边界:

- 项目成员可列表;创建/替换、启停、删除与发送测试,需要具有发布权限的
  **Owner/Admin**——Developer/Operator 不能改投递目标。
- 带签名的 webhook URL 就是凭据;无发布权限的列表返回脱敏 URL。
- **所有示例均未执行**;评估和测试接口可能真实发送 HTTP、邮件、聊天或
  推送——只用受控测试目标,投递测试前获得明确批准,绝不误发真实值班组。

## 字段与语义

| 字段 | 必填、默认与校验 | 含义 |
| --- | --- | --- |
| `name` | 必填非空白,项目内名称 | 用于 API 路径与消息前缀;改名 = 完整替换。 |
| `enabled` | 布尔,默认 true | 准备规则时显式 false。 |
| `kind` | `endpoint_errors` / `schedule_failures` | **不支持**任意指标查询表达式。 |
| `threshold` | 必填整数 ≥1 | 是**数量**,不是百分比。 |
| `window_secs` | endpoint_errors 必填且 ≥60;schedule_failures 必须不传/null | 服务端错误的滚动窗口;**连续失败次数不会因时间流逝而过期**。 |
| `channel_kind` | `webhook`/`email`/`chat`/`push` | 只能选一组对应目标。 |
| `webhook_url` | webhook 必填,非空 HTTP(S) URL | 其他目标字段必须缺失/null——空字符串也算冲突。 |
| `email_to` | email 必填,逗号分隔地址 | 部署须已配置 SMTP;语法检查不证明送达。 |
| `chat_account`、`chat_id` | chat 必填:本项目现有账号名 + 非空接收方 | 平台限制见下文。 |
| `push_resource` | push 必填,本项目 push 资源引用 | 保存时解析并固定限定引用——不证明凭据/设备受众有效。 |

两种 kind 的统计口径:

- `endpoint_errors`:窗口内状态 ≥500 的**生产**执行行(排除测试)。不是
  延迟/SLO 错误率;完全写不了日志的服务它监控不到。
- `schedule_failures`:启用调度的**连续**失败;只有成功结束才断开——
  running/skipped 不代表恢复,禁用的调度不计入。消息只报告最严重的调度,
  不是每个调度一个事件。

## 先禁用创建,验证后启用

在可信编辑器准备 `alert.json`(此处不是可投递的真实目标):

```json
{
  "name": "server-errors",
  "enabled": false,
  "kind": "endpoint_errors",
  "threshold": 5,
  "window_secs": 300,
  "channel_kind": "webhook",
  "webhook_url": "https://alerts.example.com/controlled-fixture"
}
```

```sh
curl --fail-with-body -X POST "$BASE/projects/$PROJECT/alerts" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  --data-binary @alert.json
curl --fail-with-body "$BASE/projects/$PROJECT/alerts" \
  -H "Authorization: Bearer $TOKEN"
```

- `GET/POST /projects/PROJECT/alerts` 列表/创建。
- `PUT /projects/PROJECT/alerts/NAME` 用**完整 body 替换**——缺省字段按
  默认/null 处理,不是部分 patch;同路径 `PATCH` 只接受
  `{"enabled":true|false}`;`DELETE` 删除规则。
- 变更前可保存列表作为恢复记录——其中目标要按秘密保管。

明确批准后,`POST /projects/PROJECT/alerts/NAME/test` 会**真实发送**,但不
改变 firing 状态。HTTP **200** 仍可能是
`{"delivered":false,"error":"..."}`——**必须读 delivered 字段**,并在
受控目标核对收信;provider 接受不等于人已阅读。端到端验证后再启用;测试
夹具随后禁用/删除。

## 评估、恢复与发送失败

- 默认周期 60 秒,首次评估等**完整一个周期**。规则状态含
  `ok`/`firing`、`state_since`、`last_notified_at`、`last_error`。
- 只在**状态边沿**发送(含恢复),不是每周期提醒。发送失败也会记录转态,
  **不会**对同一未变化边沿每分钟自动重发——读 `last_error`、修好目标后
  明确测试,不要等待不存在的重试循环。
- 每规则一把 PostgreSQL advisory lock,减少跨节点的重复边沿发送;**不**
  代表网络/数据库提交故障下的 exactly-once。禁用阻止未来评估,不一定
  中止已在发送的 provider 请求。
- "恢复"也可能只是窗口内错误过期、或失败调度被禁用——**不证明根因已
  解决**。

### 目标限制

| 通道 | 限制 |
| --- | --- |
| Webhook | 仅 HTTP(S);保护签名 URL;检查出口/SSRF 策略——保存时 URL 合法不证明可达。 |
| Email | 需配置[部署 SMTP](../configuration/integrations.md)、发件人、中继权限与 TLS;未设中继时保存返回 400;端口要与 STARTTLS/implicit 匹配。 |
| Chat | 企业微信在此连接器下**不能**主动接收无入站上下文的告警(保存即拒绝);微信依赖接收者近期交互许可,不能当无条件可靠呼叫通道;飞书/Lark/钉钉依赖账号可用与接收方/平台权限。 |
| Push | 需有效 push 资源与已登记且符合条件的设备;稳定功能以实际 provider/资源协议为准,不含未发布的 APNs widget 快照;provider 成功 = 接纳,**不**表示设备收到或已读。 |

## 运维升级处理

用**外部**监控发现进程、数据库、激活或评估器的无声故障——进程/数据库/
出口宕机时,不能依赖进程自身的告警。排查:健康探针(见
[troubleshooting](troubleshooting.md))→ `last_error` → SMTP/provider 日志
→ 启用状态。保存失败投递的证据;修复后经批准测试,并用独立渠道通知事件
负责人。**不要**为制造边沿而盲目切换生产规则——那只会产生误导性的恢复
与重复消息。
