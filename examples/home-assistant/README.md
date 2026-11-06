# Home Assistant HTTP adapter / 家庭助手 HTTP 适配器

Viat **1.1.0** generic `http_api` integration, **not** a native Home Assistant/MQTT connector. State reads and action execution are different handlers. Server-side literal service/entity allowlists, trusted principal UUID allowlists and two action gates prevent caller-selected arbitrary services.

Viat **1.1.0** 通用 `http_api` 集成，**不是**原生 Home Assistant/MQTT 连接器。读取与执行使用独立处理器；服务端固定 service/entity 白名单、受信主体 UUID 授权及双重动作门槛拒绝任意服务调用。

## Guides / 指南

- [English prerequisites/configuration/apply/assert/cleanup](../../src/content/docs/en/applications/home-assistant.md)
- [中文前提、配置、应用、断言与清理](../../src/content/docs/zh-cn/applications/home-assistant.md)

## Offline units / 离线单元验证

From this directory / 在本目录：

```sh
python3 -I validate.py
```

Standard-library only; runs actual `ha_read.py` and `ha_execute.py` with explicit fake `viat.ctx`, fake `ViatError`, shared config/state fixtures and a fake HTTP resource. Tests defaults/negative cases, separate memberships, unsafe fields and exact fake requests. No device, provider or real Viat is invoked. The coordinator's offline harness **passed all 10 unit tests**; no real-server, provider or device integration coverage is claimed.

仅标准库；实际执行部署源码，明确注入假上下文/错误类型、共享配置/状态和假 HTTP 资源。验证默认拒绝、独立名单、危险字段和精确假请求，不调用设备/供应商/真实 Viat。协调者的离线验证环境已**通过全部 10 项单元测试**，不宣称真实服务端、供应商或设备集成覆盖。

## Files / 文件

- `project/viat.yaml`: minimal identity / 最小项目标识。
- `project/resources/ha_settings.yaml`: shared synthetic states and **empty** read/action UUID lists / 共享合成状态和**空**读/写 UUID 名单。
- `project/resources/ha_api.yaml`: inert HTTP origin, no bearer token / 无效 HTTP 地址，无 bearer 凭据。
- `project/scripts/ha_read.py`: allowlisted GET state read / 白名单 GET 状态读取。
- `project/scripts/ha_execute.py`: only `light.turn_on/off` for `light.example_desk` / 仅特定测试灯的开启/关闭。
- `project/workflows/ha_observe.yaml`: read path only / 仅只读路径。
- `project/endpoints/home-assistant/`: state GET and action POST, both **deny-all** / 读和动作端点均**拒绝全部**。
- `fixtures/requests.json`, `fixtures/expected.json`: shared inputs and expected values / 输入与期望输出。

JSON-compatible YAML avoids dependencies. No schedules or chat triggers are installed. Fixture reads still require an authorized project-user principal; empty policy returns `403 forbidden`, even for an admin. Real network reads and actions default off.

JSON 兼容 YAML 无需额外依赖。不安装计划/聊天触发器。即便读取夹具也必须是已授权项目用户，默认空名单返回 `403 forbidden`，管理员也不绕过。真实读取与动作默认关闭。

## Manual apply / 人工应用

From `project/`, after login and approval / 登录并授权后从 `project/`：

```sh
viat project create home-assistant-example "Home Assistant example"
viat project select home-assistant-example
viat project diff --only resources,scripts,workflows,endpoints
viat push --only resources,scripts,workflows,endpoints
```

Use a new isolated project; no all-kind push because minimal metadata can prune seeded authorizers. `--only` selects whole kinds, so inspect endpoint mirror deletions. No publish occurs automatically. Save returned IDs for explicit owned cleanup; no project DELETE/blanket prune.

使用全新隔离项目，不执行全种类 push，避免最小元数据清理预置认证器。`--only` 选择整类，仍需审查端点删除。不会自动发布；记录 ID 供明确清理，不使用项目 DELETE/blanket prune。

A usable authenticated fixture read requires a real active user UUID in `read_user_ids` and a deliberately published password-authenticated state endpoint. A real HA call additionally requires an approved origin/CA/network and a token safely provisioned in the resource secret. Real action also requires the separate `execute_user_ids`, server flag and per-call `confirm:true`, plus device-owner approval. HTTP acceptance is not physical-state confirmation; never automatically retry uncertain actions. Follow the full guides rather than enabling flags wholesale.

真实可用的认证夹具读取需实际激活用户 UUID 和明确发布的密码认证状态端点。真实 HA 还需获准 origin/CA/网络和安全保存的资源 secret。动作另需执行名单、服务端开关、逐次 confirm:true 及设备所有者授权。HTTP 接受不代表物理状态，不能自动重试不确定动作。按完整指南操作，不要一键全开。
