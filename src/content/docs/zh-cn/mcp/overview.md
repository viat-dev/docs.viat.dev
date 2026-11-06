---
title: "MCP 参考与安全配置"
description: "配置 Viat stdio MCP 服务，了解 46 个工具、项目 PAT 权限、JSON 文本结果及操作安全边界。"
doc_id: mcp.overview
verified_release: '1.1.0'
channel: stable
contract_ids: [mcp.overview]
---

# MCP 参考与安全配置

Viat 1.1.0 通过 `viat mcp` stdio Model Context Protocol 服务暴露 **46 个工具**。它是 API 客户端，不是另一套 Viat 实例，也不是服务端 shell。有的工具只查看草稿，有的会修改实时路由、启用自动化、执行代码或真实发送通知。名称中的“test”不代表沙箱。

本参考依据固定的 1.1.0 工具输入合约、实现、HTTP/错误处理、集成测试及 API 权限 handler。示例是合成的、从源码推导的预期形状，编写时**没有执行**；没有生产、提供方或网络请求，没有安装、构建或测试。形状示例不能证明您的实例或提供方正常运行。

## 前提与传输

- 使用包含 `viat mcp` 的已安装 Viat 客户端及已激活的兼容 API 实例。参阅现有 [客户端安装页](../installation/clients.md)；产品与客户端版本独立。
- 通过控制台创建或选择隔离项目（如 `mcp-lab`），使用范围尽可能小的个人访问令牌 PAT。PAT 所有者必须具有工具要求的项目角色；实例平台角色不能代替项目成员身份。
- `viat mcp` 进程须能直接访问 API。reqwest 客户端使用 `no_proxy()`，HTTP 代理环境变量不会代理这些请求。使用可信服务 URL 和正常证书验证；本参考不提供 MCP 专用私有 CA 绕过方法。
- MCP 宿主以 `args:["mcp"]` 启动 `viat`。传输为 stdin/stdout 上的**换行分隔 JSON**，不是 HTTP MCP URL，也不是 Content-Length 分帧。stdout 仅用于协议，诊断输出到 stderr（`RUST_LOG`，默认 `info`）。
- 先 initialize，再发送 `notifications/initialized`，然后使用 `tools/list`、`tools/call`。初始化和清单读取在本地完成，不验证凭据或激活。SDK 默认服务标识为 `rmcp`，不能可靠判断 Viat 发布版本。仅注册工具，不提供 Viat resource/prompt 目录。

以下是 MCP 宿主注册形状。在本地替换 bearer 占位符，不要把真实 PAT 提交到宿主配置或对话记录。

```json
{
  "mcpServers": {
    "viat": {
      "command": "viat",
      "args": ["mcp"],
      "env": {
        "VIAT_SERVER": "http://127.0.0.1:8080",
        "VIAT_TOKEN": "<project-scoped PAT>",
        "VIAT_PROJECT": "mcp-lab"
      }
    }
  }
}
```

localhost URL 只是隔离夹具假设，不表示那里已有运行中服务。注册配置放在哪里取决于 MCP 宿主；Viat 不会安装或修改宿主设置。

## 配置与凭据：1.1.0 的重要限制

| 环境变量 | YAML 键 | 必填及行为 |
| --- | --- | --- |
| `VIAT_SERVER` | `server_url` | 必填字符串，含 scheme 的基础 URL。不会自动规范化斜杠，应省略末尾斜杠。 |
| `VIAT_TOKEN` | `token` | 必填 bearer 字符串，推荐项目范围 `vis_pat_` PAT；MCP 不实现刷新。 |
| `VIAT_PROJECT` | `current_project` | 可选默认项目 slug，各项目工具可通过 `project` 覆盖。 |
| `VIAT_CONFIG_DIR` | 无 | 可选，指向包含 `config.yaml` 的目录本身，不是父目录或 YAML 文件路径。纯空白覆盖值忽略。 |
| `RUST_LOG` | 无 | 诊断过滤器，默认 `info`，输出到 stderr。 |

每项已有环境值优先于 YAML，包括空字符串；存在不代表有效。配置目录发现顺序：`VIAT_CONFIG_DIR` → 从被启动进程工作目录向上查找 `.viat/config.yaml` → `cwd/.viat`。宿主自己选择 CWD，因此显式环境变量更不易误解。不可读 YAML 忽略，格式错误 YAML 忽略并警告。回退后缺少 server/token 会中止启动。值在服务启动时加载，更换凭据后重启。

**不要假定 CLI 登录成功就能直接给 MCP 使用。** 检查到的 1.1.0 MCP 仅反序列化 `server_url`、旧 `token`、`current_project`。CLI 配置可能使用 `access_token`、`refresh_token`；MCP 不读取这些键，也不刷新它们。启动消息建议 CLI 登录不代表保证兼容。请显式把项目 PAT 放入 `VIAT_TOKEN`，或有意在发现的 YAML 中提供有效旧 `token`。过期或撤销的令牌在后续 API 调用时才失败，不在启动时失败。

项目工具优先解析非 null 的 `project`，然后使用默认项目，否则 `project_required`。显式 null 等同省略，空字符串不等同省略。`list_projects` 是例外：接受 `{}` 并访问 `/projects`。项目 PAT 受项目路由限制，**不能调用 list_projects**（403），请设置 `VIAT_PROJECT`。传其他项目不能扩大 PAT 范围。上游请求使用配置的 bearer，不支持逐工具令牌或身份参数。

## 清单与精确角色门槛

以下均为**项目角色**。Member 包括 Viewer；Editor 为 Owner/Admin/Developer；Publisher 为 Owner/Admin。此外仍受 PAT 范围及激活限制。尤其不是所有“list”工具都允许普通成员读取。

| 工具 | 所需权限 |
| --- | --- |
| [list_projects](list_projects.md) | 已认证用户，项目 PAT 不能访问该路由 |
| [get_project](get_project.md)、[list_resources](list_resources.md)、[list_scripts](list_scripts.md)、[read_script](read_script.md)、[list_workflows](list_workflows.md)、[read_workflow](read_workflow.md)、[list_recent_runs](list_recent_runs.md)、[read_logs](read_logs.md)、[read_async_run](read_async_run.md)、[list_files](list_files.md)、[publish_plan](publish_plan.md) | Member |
| [list_schedules](list_schedules.md)、[upsert_schedule](upsert_schedule.md)、[delete_schedule](delete_schedule.md)、[pause_schedule](pause_schedule.md)、[resume_schedule](resume_schedule.md)、[trigger_schedule](trigger_schedule.md)、[read_schedule_runs](read_schedule_runs.md)、[preview_cron](preview_cron.md)、[list_alerts](list_alerts.md) | Member，包括计划修改；告警目标仍有脱敏 |
| [list_endpoints](list_endpoints.md)、[get_endpoint_tree](get_endpoint_tree.md)、[create_endpoint](create_endpoint.md)、[update_endpoint_auth](update_endpoint_auth.md)、[update_endpoint_info](update_endpoint_info.md)、[move_endpoint](move_endpoint.md)、[delete_endpoint](delete_endpoint.md) | Editor，包括两个端点读取工具 |
| [write_script](write_script.md)、[delete_script](delete_script.md)、[test_run_script](test_run_script.md)、[validate_workflow](validate_workflow.md)、[write_workflow](write_workflow.md)、[delete_workflow](delete_workflow.md)、[list_queue_triggers](list_queue_triggers.md)、[read_queue_trigger_fires](read_queue_trigger_fires.md)、[set_queue_trigger_enabled](set_queue_trigger_enabled.md) | Editor |
| [read_audit](read_audit.md)、[publish_apply](publish_apply.md)、[publish_rollback](publish_rollback.md)、[unpublish_endpoint](unpublish_endpoint.md)、[upsert_alert](upsert_alert.md)、[set_alert_enabled](set_alert_enabled.md)、[delete_alert](delete_alert.md)、[test_alert](test_alert.md) | Publisher |
| [call_endpoint](call_endpoint.md) | 已发布端点自身的授权器及门，控制面角色不够 |

本工具集不能创建项目、PAT、资源、树，不能完整配置队列触发器、编辑授权模型、上传文件或二进制、取消异步运行。前提应通过支持的控制台/API 完成，不要虚构工具名。参阅 [项目协作](../projects/create-and-collaborate.md) 和 [资源参考](../assets/resources/index.md)。

## 输入合约：省略并不总是 PATCH

合约顶层对象含 `count`、`schema_version`、来源信息和 `tools` 数组。46 个条目各有 `name`、`description`、`inputSchema`，不是输出模式。各页完整字段表包含所有输入属性、必填项、nullable 类型和数值约束，运行时行为另从源码核实。

- 可选 Rust 输入将显式 JSON null 折叠成省略，包括 `body`、`overrides`、`inputs` 等开放 JSON。继承门请使用 `inherit_authz_gates:true`，不是 `authz_gates:null`。MCP 不能通过 null 清除端点绑定。
- 空字符串、数组、对象是提供值。空授权器或门数组是声明。`move_endpoint` 省略或 null 的父节点表示**移到树根**，不是不修改。
- 脚本写入仅 patch 所选已提供字段；工作流替换完整 YAML；计划及告警 upsert 替换配置，省略策略字段可能重置。计划及告警 upsert 的 `enabled` 默认 **true**。重试旧请求前检查各工具默认。
- 模式可能完全开放（`true` 或没有 `type`），但不免除 API 验证。CRUD、WebSocket、overrides、授权门的源码约束见 [create_endpoint](create_endpoint.md)。
- 不要依赖忽略未知参数来发现拼写错误。输入类型或反序列化失败可能在进入工具 handler 前成为 JSON-RPC 错误。

## 实际成功外层：文本内的 JSON

成功调用的 JSON-RPC `result.content` 含一个**文本**块。`ContentBlock::json` 将工具值序列化为 JSON 字符串，应解析该文本获取值。此实现不声明工具 `outputSchema`，也不填充 `structuredContent`。

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [{"type": "text", "text": "{\"slug\":\"mcp-lab\",\"name\":\"MCP lab\",\"created_at\":\"2026-01-01T00:00:00Z\",\"allow_registration\":false,\"idp_enabled\":false,\"mfa_policy\":\"off\"}"}],
    "isError": false
  }
}
```

可选输出字段通常省略而非 null。例外按工具说明：端点列表 nullable 键、计划 `next_due_at` 和 API 原样透传对象可能保留 null。API 204 删除内部解码为 null，但计划删除构造 `{deleted:"name"}`，而非返回 null。

**工具传输成功不等于工作成功。** 必须检查 `call_endpoint.status`、同步试跑 `ok`、工作流验证 `ok`、异步运行 `status`、测试告警 `delivered`。端点、脚本、渠道失败也可能是正常结果数据。

## 错误外层与安全重试

工具层失败使用 `isError:true`，JSON 仍编码在文本块中。以下是形状示例，不是执行过的失败响应：

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [{"type": "text", "text": "{\"error_kind\":\"project_required\",\"message\":\"project_required: no project arg and no default configured\",\"retryable\":false}"}],
    "isError": true
  }
}
```

| `error_kind` | `http_status` | `retryable` | 恢复 |
| --- | --- | --- | --- |
| `http_4xx` | 原 HTTP 状态 | false | 检查 message（原 API 正文字符串）。修复令牌、范围、项目、输入；409 发布门需要审阅，不要盲目接受。429 在此分类中也为不可重试，不要据此进行激进循环。 |
| `http_5xx` | 原 HTTP 状态 | true | 检查实例健康；重放修改前核对状态。 |
| `network` | 省略 | true | 检查直接连通性、DNS、TLS 和可信 URL。响应丢失可能发生在修改已完成之后。 |
| `upstream_timeout` | 504 | true | HTTP 等待超时，重复前检查运行、日志、配置，不代表取消。 |
| `project_required` | 省略 | false | 提供 `project` 或设置 `VIAT_PROJECT`。 |
| `bad_input` | 省略 | false | 修复本地语义验证或 JSON 解码问题；部分 API 无效输入会以 http_4xx 表达。 |
| `license_required` | 403 | true | 平台 Admin/Owner 必须通过激活入口使用有效匹配激活码。换凭据重试无用，参阅 [激活](../instance/activation.md)。 |

`message` 是字符串，可选状态字段按表省略。协议失败（坏参数、未知工具、会话错误）是 JSON-RPC 错误，不一定使用此外层；内部序列化失败也可能绕过它。MCP 不自动刷新，也不实现应用级重试循环。默认上游 HTTP 等待 30 秒；`call_endpoint` 和脚本试跑按各页覆盖。

`call_endpoint` 通常在普通结果中携带上游 4xx/5xx。特例是 JSON 正文含 `error:"license_required"` 的 403，会变为工具错误，因而可区分端点自身授权 403 和未激活实例。锁定实例的清单和 initialize 仍可能正常，因为是本地操作。

## 分页因工具而异

| 工具 | 如何继续 | 停止及限制 |
| --- | --- | --- |
| list_recent_runs | `next_before` → `before`，保留筛选 | next_before 缺失；MCP 默认 20、上限 200 |
| read_audit | 同时 `next_before` → `before`、`next_before_id` → `before_id` | 游标对缺失；默认 100、范围 1..500 |
| list_files | 不透明 `next_cursor` → `before` | null；API 默认 100、范围 1..1000 |
| read_schedule_runs | 最旧返回行 `started_at` → `before` | 裸数组，无下一页标志；默认 20、范围 1..200；同时间戳无 ID 续页 |
| read_logs | 无续页 | line_limit 默认 500，最多 2000，检查 truncated |
| read_queue_trigger_fires | 无续页 | 仅最近 50 条 |
| 其余列表 | 无分页参数或游标 | API 完整集合或投影，不存在虚构游标协议 |

## 隔离夹具操作与清理

以下是**明确授权后可进行的本地练习说明**，不是本文执行过的步骤。发送任何请求前，在控制台创建已激活的隔离 `mcp-lab` 项目、PAT 和 `main` 端点树。草稿操作的 PAT 所有者需 Editor；实时发布还需 Publisher。不要用共享项目的待发布计划做练习。

1. 先用 `get_project`、`list_scripts`。项目 PAT 不要通过 list_projects 验证。若已有同名项，先保留，不要覆盖；`mcp_*` 名称是合成的，不是保留名。
2. `write_script` 使用 `name:"mcp_demo"`、`folder:""`、`language:"python"` 和下列惰性源码。执行需服务端有正常 Python 运行时；配置成功不保证解释器已安装。

   ```python
   def main():
       return {"ok": True}
   ```

3. 可选 `test_run_script` 使用 `{name:"mcp_demo",folder:"",args:{}}`，检查 `ok`。分离运行使用 `run_async:true`，再用返回 run_id 调用 `read_async_run`。此无资源代码无需录制资源调用。
4. 工作流示例需要先有夹具脚本，再验证和写入以下 `mcp_flow`，`folder:""`：

   ```yaml
   inputs:
   steps:
     - id: hello
       script: mcp_demo
       args: {}
   outputs:
     result: "$hello.output"
   ```

5. 端点示例假设 `create_endpoint` 使用 `tree:"main"`、`segment:"mcp-demo"`、`method:"GET"`、`script_name:"mcp_demo"`。记录**实际返回的端点 ID**。各页重复 UUID 只是合成占位符，不能原样发送。草稿列表不表示 HTTP 已上线。
6. 只有明确选择实时路由时：审阅每个 `publish_plan` 项，发现无关更改就停止。`publish_apply` 会发布全部待发布叶节点。`call_endpoint` 需要已发布夹具及实际接受该凭据的授权策略，不要为了示例降低生产授权。
7. 计划示例依赖惰性脚本，使用 `mcp_timer`、间隔 60 秒、`enabled:false`。告警示例使用禁用 `mcp_alert`，指向**从 API 主机可达**且由操作者控制的本地 HTTP stub；调用 test_alert 时即使禁用仍会真实发送。队列示例需控制台已有隔离 `queue_stub` AMQP 资源和 `mcp_queue`，本文不隐含 broker、提供方配置或调用。`list_files` 假设已有 `files_stub` storage 资源和可用元数据数据库，空列表不会创建资源。
8. 有意清理：暂停或删除夹具计划；禁用或删除夹具告警；队列保持禁用，仅通过获准控制台操作删除。若已发布夹具端点，先下线再删节点。移除工作流引用后删 mcp_flow，最后在不再被使用时删 mcp_demo。用相应列表或读取工具核对。在令牌管理入口撤销练习 PAT，并从宿主配置中移除。

清理不能撤回通知、恢复业务库写入或取消已经运行的任务。MCP 没有通用事务、取消、撤销删除或“撤销全部”工具。项目回滚恢复服务修订，**不恢复实时 `uses:` 模块**或外部副作用。执行、审计记录按保留策略继续存在，不要为表面整洁删除它们。

## 维护依据与已知差异

- 清单及输入：`contracts/1.1.0/mcp-tools.json`；实际注册和结果包装：`crates/viat-mcp/src/tools/service.rs`。模式是机械字段依据，不是各页语义来源。
- 配置、HTTP、错误：`crates/viat-mcp/src/config.rs`、`http.rs`、`error.rs`、`lib.rs`；CLI 凭据键比较：`crates/viat-cli/src/config.rs`。本文明确说明 MCP/CLI token 键差异，不声称支持刷新。
- 工具行为及集成回归案例：`crates/viat-mcp/src/tools/*.rs`、`crates/viat-mcp/tests/it/`。角色门槛检查了 API 的 endpoints、trees、scripts、workflows、schedules、alerts、queue triggers、files、logs、async runs、audit、resources、projects、publishing handlers。
- 现有源码文字把读取工具泛称为只读或成员可用，但实际端点及树读取 handler 需要 Editor。read_script 模式描述说歧义会列出文件夹，但实际 409 只要求 folder，不枚举候选；应使用 list_scripts。
- 示例、时间戳、合成 ID、本地提供方 stub 和预期形状均**未通过执行验证**。本参考不宣称完成端到端提供方投递、网络就绪、可执行示例验证或发布批准。
