---
title: "Home Assistant：受控的通用 HTTP 适配器"
description: "读取状态与执行动作分离，动作必须通过服务端白名单、身份授权和显式开关。"
doc_id: applications.home-assistant
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# 通过通用 HTTP 访问 Home Assistant

`examples/home-assistant/` 提供真实可推送的资源、Python 处理器、只读工作流、端点绑定、共享合成状态及标准库验证器。这是 Home Assistant HTTP API 的**通用 `http_api` 适配器**，不是原生 Home Assistant 连接器、MQTT 集成或自然语言设备代理。没有模型选择服务、任意 URL 代理或无人值守动作计划。

**验证状态：** 协调者的离线验证环境已通过全部 **10 项单元测试**，使用真实处理器和明确的假上下文/资源。运行中的 Viat 服务端、真实 HTTP 代理、Home Assistant 及物理设备行为仍未验证。完整供应商/设备验证必然需要人工明确同意，参见[验证层次](../reference/validation.md)。

## 前提与默认状态

使用已激活的服务端/CLI **1.1.0**、服务端 Python/uv、平台登录，以及可编辑和发布的**全新隔离项目**（发布需 Owner/Admin）。工作站 Python 3 可运行离线验证器，无需第三方包。实例登录见[首个端点](../getting-started/first-endpoint.md)。默认夹具路径不需要 Home Assistant。

初始用户白名单为空，只能使用状态夹具，所有动作关闭。以下完整资源文件由脚本和验证器共享：

```json fixture=home-assistant/project/resources/ha_settings.yaml
{
  "name":"ha_settings","kind":"config",
  "plain":{"data":{
    "http_authorizers":["password"],
    "read_user_ids":[],"execute_user_ids":[],
    "read_mode":"fixture","read_network_enabled":false,"real_actions_enabled":false,
    "fixture_states":{
      "sensor.example_temperature":{"entity_id":"sensor.example_temperature","state":"21.5","attributes":{"unit_of_measurement":"°C"}},
      "light.example_desk":{"entity_id":"light.example_desk","state":"off","attributes":{"brightness":0}}
    }
  }},"secret":{}
}
```

`ha_api` 使用合成 `.example.test` HTTPS 地址、`auth_type:bearer`，但**没有 token**。缺少 bearer 不等于已认证。不要点击资源 Test，它会发送真实 GET。仓库 PATCH 的空 secret 对象会保留已有 secret，但不能创建凭据。本案例不安装计划或聊天触发器，不存在可误开启动作的后台调度。

## 仅应用自有内容

从手册仓库根目录开始，以下是人工命令，不是已执行证据：

```sh
cd examples/home-assistant
python3 -I validate.py
cd project
viat project create home-assistant-example "Home Assistant example"
viat project select home-assistant-example
viat project diff --only resources,scripts,workflows,endpoints
viat push --only resources,scripts,workflows,endpoints
viat endpoint list --json
viat script run ha_read --args '{}'
```

最后一条是有意的**负向验证**：默认配置必须以 `403 forbidden` 拒绝，不能匿名返回夹具。私下记录创建名称和实际端点 ID。若 slug 已被占用，选用另一个全新 slug，同步修改 `viat.yaml` 与命令。必须从 `project/` 推送。

不能用最小元数据执行全种类 push：省略的 authorizers/roles/scope claims 可能导致预置认证状态被镜像删除。`--only` 选整个种类，不按文件名前缀筛选；端点同步仍可能删除所访问树中的其他节点，必须使用新隔离项目并审查 `viat project diff`。验证器不包含 prune、迁移、发布或服务端执行。

## 配置已认证的夹具读取者

1. 在项目 Users 控制台创建一次性、已激活项目用户，安全设置密码（至少 8 字符，遵守项目 MFA 策略），记录返回的用户 UUID。也可先 `viat p-user create --identity home-reader-example`，再通过控制台设置私密密码；`viat p-user list --json` 可查真实 UUID。平台协作者/PAT **不是**该项目用户。
2. 只把实际 UUID 加入 `ha_settings.plain.data.read_user_ids`。保持 `execute_user_ids:[]`、网络读取和真实动作关闭。HTTP 认证器为 `password`；若改用其他已有项目用户认证器，须同时明确修改 `http_authorizers` 和端点列表。不要加入 anonymous，也不要信任 `is_admin`、角色标签、请求体或头里的身份声明。
3. 将 `endpoints/home-assistant/home-state.get.yaml` 的 `allowed_authorizers:[]` 改为 `["password"]`，动作端点继续拒绝全部。执行 `viat push --only resources,endpoints`，审查 `viat publish plan --json`，仅用**状态叶子的真实 ID**执行 `viat endpoint publish STATE_ENDPOINT_ID`。
4. 该最终用户向 `POST /p/home-assistant-example/auth/login` 发送 `{identity,credential,authorizer:"password"}` 登录；按需完成 MFA ticket 流程。返回的是 `token`，不是控制台 `access_token`。私下保存为 `PROJECT_TOKEN`，不提交密码/token，参见[端点认证](../auth/endpoints.md)。

新建树默认路径下，已授权的人工读取示例：

```sh
curl --fail --silent --show-error \
  "$BASE/p/home-assistant-example/home-assistant/home-state?entity=sensor.example_temperature" \
  -H "Authorization: Bearer $PROJECT_TOKEN"
```

`BASE` 为已有实例地址。期望 `fixtures/expected.json` 中 `read`：`{"entity_id":"sensor.example_temperature","state":"21.5","fixture":true}`。新仓库树以树名作路径前缀，仍应核对 list 返回的实际路径。验证无 token、未列入名单的另一用户及未准入认证器均被拒绝，不要靠开放公共访问“修复”拒绝。

## 真实只读适配器

只有明确批准网络访问后，才把 `ha_api.plain.base_url` 改为真实 HA **origin**（不带 `/api`，脚本会添加），并通过控制台在 **`secret.token`** 安全保存最小权限长期访问 token。确保 Viat 出站 URL 策略允许该地址。凭据不得写入明文头、脚本、夹具或 base URL。私有 CA 需在 API 节点安装适当信任链，不要关闭 TLS 验证。HTTPS、路由/防火墙、HA 账户权限是环境前提，不是夹具验证过的能力。

设 `read_mode:http`、`read_network_enabled:true`，保持动作关闭，仅推送 resources。读取处理器仅允许 `sensor.example_temperature` 和 `light.example_desk`，调用 `GET /api/states/<entity>`，超时 5 秒，只返回 entity_id、字符串 state 和 fixture 标记；忽略其他属性，避免回显坐标、token 或上游元数据。若专用测试实体名称不同，须明确修改**两个处理器代码白名单**、共享状态和测试请求，审核并重新发布受影响端点。404、超时或非法状态不是夹具回退，也不证明真实设备读数。

## 严格动作契约与显式开启

`ha_execute.py` 与 `ha_read.py` 分离，只读工作流永不调用执行处理器。发送任何 POST 前均检查：

- 平台解析的非空 `ctx.principal.user_id`、明确允许的 `ctx.principal.authorizer`，以及独立的 `execute_user_ids` UUID 名单。管理员不自动绕过。可编辑这些受信策略的项目编辑者不属于普通运行时调用者边界。
- 代码内的固定白名单：仅 `light.turn_on` / `light.turn_off`，且仅实体 `light.example_desk`。由映射确定 domain/service，调用者不能提供 URL。
- `data` 必须为对象（null 视为 `{}`）。turn_on 仅允许可选 brightness，且必须是 **1–255 的真正整数**，不是 Python 布尔值或字符串；turn_off 不允许任何字段。拒绝额外字段、entity_id 覆盖、all、路径、模板、锁、告警、脚本、shell 和自动化服务。
- 服务端配置 `real_actions_enabled is True` **且**每次调用的 `confirm is True`。确认是额外意图门槛，不是身份认证或持久审批。

已授权用户提交合法白名单请求，默认返回 `{"executed":false,"reason":"actions_disabled_or_unconfirmed"}`；名单为空时则返回 `403 forbidden`。非法 service/entity/data 为 `400 bad_request`。合法 JSON 或其中的身份声明均不授予权限。

要授权一次真实动作：先取得设备所有者同意，确认无危险的专用测试灯，将实际 UUID 加入 `execute_user_ids`，配置 HA 凭据、开启服务端动作开关，仅把**动作叶子**认证器改为 `["password"]`，推送经审阅的 resources/endpoints 并发布真实 ID。这也会允许之后的调用，实验后应及时关开关/路由。夹具请求为：

```json
{"action":"light.turn_on","entity":"light.example_desk","data":{"brightness":64},"confirm":true}
```

它精确发送 `POST /api/services/light/turn_on`，JSON 为 `{"entity_id":"light.example_desk","brightness":64}`，超时 5 秒。未单独获准不得对设备执行。HA 响应应为列表；`executed:true` 仅表示 HTTP 被接受，**不证明物理状态**，需独立确认。超时或非法响应可能发生在动作已生效之后，不能盲目重试。适配器没有持久动作账本或恰好一次保证；平台可选的 `Idempotency-Key` 不能代替业务核对。

完成后将 `real_actions_enabled:false`、`execute_user_ids:[]` 及动作路由拒绝全部恢复，推送并对已发布路由重新发布。只改草稿不会替换发布快照的认证；资源开关是实时的，但不能取消在途 POST。

## 本地断言与人工验证

`validate.py` 加载**实际部署的两个源码文件**，注入假受信主体和假 HTTP 资源，读取同一配置/状态夹具。覆盖默认拒绝、管理员不绕过、已授权夹具读取、独立动作名单、危险 service/entity/data、brightness 布尔值拒绝、双重动作门槛以及精确假 GET/POST 参数。不会安装 SDK、打开 socket 或控制设备。假 ViatError 只验证处理器预期状态/代码，不验证真实 HTTP 序列化。

部署检查仍需人工：严格 query/body 绑定、实际主体解析、发布后匿名/未列名拒绝、secret 脱敏、出站/TLS、HA 服务权限、读取时序与物理状态。`ha_observe` 只为已授权主体返回 `{"state":...}`；没有项目用户 UUID 的平台草稿运行或 scheduler 会被有意拒绝，不存在调度绕过。运行时与 dispatch 拒绝分别写日志，两者都要看。

## 仅清理记录中的自有对象

先关动作开关、取消两个自有叶子的发布、核对在途请求和物理影响，再使用记录的实际 ID：

```sh
viat endpoint unpublish STATE_ENDPOINT_ID
viat endpoint unpublish ACTION_ENDPOINT_ID
viat endpoint delete STATE_ENDPOINT_ID
viat endpoint delete ACTION_ENDPOINT_ID
viat workflow delete ha_observe
viat script delete ha_execute
viat script delete ha_read
viat resource delete ha_api
viat resource delete ha_settings
```

从未发布的叶子跳过 unpublish。仅当 `home-assistant` 为本次创建且已检查为空时才 `viat tree delete home-assistant`。在 HA 个人资料安全设置撤销**此次一次性 token**；删除资源不会撤销 token，也不会把灯恢复原状。仅当用户为本次创建且无人复用，才 `viat p-user delete home-reader-example`。审阅后清理私有本地会话文件。1.1.0 没有项目 DELETE 路由，保留隔离空项目，不虚构清理调用，不删除其他端点/资源/用户，不用镜像 prune 清理。

## 参考与剩余前提

[HTTP 资源](../assets/resources/http_api.md)、[脚本上下文](../assets/scripts/context.md)、[端点绑定](../triggers/http.md)、[认证](../auth/endpoints.md)、[仓库同步](../projects/repo-sync.md)。维护证据：固定版本产品的 `crates/viat-runtime/src/{python,resources_json}.rs`、`crates/viat-cli/src/repo/endpoints.rs`、`crates/viat-api/src/lib.rs` 注册处理器。

仍需实际准备：获准 HA 地址/CA/路由、安全保存的 token、真实隔离实体 ID、已激活项目用户 UUID 与登录、设备授权及人工集成验证。离线单元测试不是连接器或设备覆盖证明。
