---
title: 配置与运维告警
description: 定义项目健康规则、授权目标、安全验证投递并处理失败，避免错误保证。
doc_id: operations.alerts
verified_release: '1.1.0'
channel: stable
---

# 配置与运维告警

告警观察**整个项目**，不是单个端点或调度。项目成员可列表；创建/替换、启停、删除和发送测试需要具有发布权限的 **Owner/Admin**。Developer/Operator 不可修改投递目标。带签名 webhook URL 是凭据；无发布权限的列表返回脱敏 URL。

所有示例**均未执行**。评估和测试接口可能真实发送 HTTP、邮件、聊天或推送。只能使用受控测试目标，并在投递测试前获得明确批准，绝不能误发到真实值班组。

## 字段与语义

| 字段 | 必填、默认与校验 | 含义 |
| --- | --- | --- |
| `name` | 必填非空白字符串，项目内名称 | 用于 API 路径及消息前缀；需改名时使用完整替换。 |
| `enabled` | 布尔，默认 true | 准备规则时显式 false。 |
| `kind` | `endpoint_errors` / `schedule_failures` | 不支持任意指标查询表达式。 |
| `threshold` | 必填整数 >=1 | 是数量，**不是百分比**。 |
| `window_secs` | endpoint_errors 必填且 >=60；schedule_failures 必须不传/null | 服务端错误滚动窗口；失败连续次数不会只因时间过去而过期。 |
| `channel_kind` | `webhook`、`email`、`chat`、`push` | 只可选择一组对应目标。 |
| `webhook_url` | webhook 必填非空 HTTP(S) URL | 其他目标字段须缺失/null，空字符串也算冲突。 |
| `email_to` | email 必填，逗号分隔地址 | 部署须已配置 SMTP；语法检查不证明送达。 |
| `chat_account`、`chat_id` | chat 必填，本项目现有账号名和非空接收方 | 平台限制见下文。 |
| `push_resource` | push 必填，本项目 push 资源引用 | 保存时解析并固定限定引用，不证明凭据/设备受众有效。 |

`endpoint_errors` 统计窗口内状态 >=500 的生产执行行，排除测试，不是延迟/SLO 错误率，也无法监控完全不能写日志的服务。`schedule_failures` 统计启用调度的连续失败，只有成功结束才断开；running/skipped 不代表恢复，禁用调度不计入。消息报告最严重调度，不是每个调度一个独立事件。

## 先禁用创建，验证后启用

在可信编辑器准备 `alert.json`（此处不是可投递的真实目标）：

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

`GET/POST /projects/PROJECT/alerts` 列表/创建。`PUT /projects/PROJECT/alerts/NAME` 使用完整 body 替换；缺省字段按默认/null 处理，不能当部分 patch。相同路径 `PATCH` 接受 `{"enabled":true}` 或 false，`DELETE` 删除规则。变更前可保存列表作为恢复记录，但其中目标要按秘密保管。

明确批准后，`POST /projects/PROJECT/alerts/NAME/test` 会**真实发送**，不改变 firing 状态。HTTP **200** 仍可为 `{"delivered":false,"error":"..."}`；必须读取 delivered，并在受控目标核对收信。provider 接受不保证人已阅读。端到端验证后再启用，测试夹具随后禁用/删除。

## 评估、恢复和发送失败

默认周期 60 秒，首次等待完整周期。规则含 `ok`/`firing`、`state_since`、`last_notified_at`、`last_error`。只在**状态边沿**发送，包括恢复，不是每周期提醒。发送失败也会记录转态，**不会对相同未变化边沿每分钟自动重发**。读取 last_error、修目标后明确测试，不要等待不存在的重试循环。

每规则 PostgreSQL advisory lock 减少跨节点重复边沿发送，不代表网络/数据库提交故障下 exactly-once。禁用会阻止未来评估，不一定中止已在发送的 provider 请求。恢复也可能只是窗口内错误过期或失败调度被禁用，不证明根因已解决。

### 目标限制

- Webhook：仅 HTTP(S)，保护签名 URL，检查出口/SSRF 策略；保存时 URL 合法不证明可达。
- Email：配置[部署 SMTP](../configuration/integrations.md)、发件人、中继权限与 TLS。未设中继时保存返回 400；端口须与 STARTTLS/implicit 匹配。
- Chat：此连接器下企业微信不能主动接收无入站上下文的告警，保存时拒绝。微信依赖接收者近期交互许可，不能作为无条件可靠呼叫通道。飞书/Lark/钉钉仍依赖账号可用及接收方/平台权限。
- Push：需要有效 push 资源及已登记且符合条件的设备。稳定功能以实际 provider/资源协议为准，不含未发布 APNs widget 快照。provider 成功表示接纳，不表示设备收到或已读。

## 运维升级处理

用**外部**监控发现进程、数据库、激活或评估器无声故障；进程/数据库/出口宕机时不能依赖进程自身告警。检查[健康探针](troubleshooting.md)、last_error、SMTP/provider 日志和启用状态。保存失败投递证据；修好后经批准测试，并用独立渠道通知事件负责人。不要为了制造边沿盲目切换生产规则，避免误导的恢复/重复消息。
