---
title: "MCP reference and safe setup"
description: "Configure Viat’s stdio MCP server, understand its 46 tools, project PAT permissions, JSON-text results and operational safety."
doc_id: mcp.overview
verified_release: '1.1.0'
channel: stable
contract_ids: [mcp.overview]
---

# MCP reference and safe setup

Viat 1.1.0 exposes **46 tools** through `viat mcp`, a stdio Model Context Protocol server. It is an API client, not a second Viat instance or a shell inside the server. Some tools inspect drafts; others change live routing, arm automation, execute code or actually send notifications. Tool names such as “test” do not imply a sandbox.

This reference is derived from the pinned 1.1.0 tool input contract and implementation, HTTP/error handling, integration tests and API permission handlers. Examples are synthetic, source-derived expected shapes; **none were executed** while authoring these pages. No production/provider/network requests, installs, builds or tests were performed. A shape example is not evidence that your instance or provider is working.

## Prerequisites and transport

- Use an installed Viat client that includes `viat mcp`, and an activated compatible API instance. See the existing [client installation page](../installation/clients.md); product and client releases are separate.
- Create/select an isolated project such as `mcp-lab` and use a narrowly scoped personal access token (PAT). The PAT owner must have the project role required by each tool. An instance platform role does not replace project membership.
- The process running `viat mcp` must reach the API directly. Its reqwest client uses `no_proxy()`; HTTP proxy environment variables do not route these requests. Use a trusted server URL and normal certificate verification; no MCP-specific private-CA bypass is documented here.
- The MCP host launches `viat` with `args: ["mcp"]`. The transport is **newline-delimited JSON over stdin/stdout**, not an HTTP MCP URL and not Content-Length framing. Keep stdout exclusively for protocol messages; diagnostics go to stderr (`RUST_LOG`, default `info`).
- Initialize the MCP session, send `notifications/initialized`, then use `tools/list` and `tools/call`. `initialize` and inventory listing are local; they do not validate credentials or activation. The default SDK server identification is `rmcp`, not a reliable Viat release detector. Only tools are registered; no Viat resource/prompt catalog is supplied.

An MCP host registration shape follows. Replace the bearer placeholder locally; never commit a real PAT in the host config or transcript.

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

The localhost URL is an isolated fixture assumption, not an assertion that a server is running there. Client-specific placement of this registration belongs to that MCP host; Viat does not install or mutate host settings.

## Configuration and credentials: important 1.1.0 limitation

| Environment | YAML key | Required / behavior |
| --- | --- | --- |
| `VIAT_SERVER` | `server_url` | Required string; base URL including scheme. No automatic slash normalization; use a base without a trailing slash. |
| `VIAT_TOKEN` | `token` | Required bearer string. Prefer a project-scoped `vis_pat_` PAT; no refresh is implemented in MCP. |
| `VIAT_PROJECT` | `current_project` | Optional default project slug; each project-aware tool can override with `project`. |
| `VIAT_CONFIG_DIR` | none | Optional directory containing `config.yaml` itself, not its parent and not a YAML path. Whitespace-only override is ignored. |
| `RUST_LOG` | none | Diagnostic filter, default `info`; diagnostics use stderr. |

For each value, an existing environment value overrides YAML, including an empty environment string; presence is not validation. Config-directory discovery is `VIAT_CONFIG_DIR` → upward search from the spawned process’s working directory for `.viat/config.yaml` → `cwd/.viat`. MCP hosts choose their own CWD, so explicit environment is less surprising. Unreadable YAML is ignored; malformed YAML is ignored with a warning. Missing server/token after fallback aborts startup. Values are loaded for the service; restart after replacing credentials.

**Do not assume a successful CLI login config works.** In the inspected 1.1.0 source, MCP deserializes only `server_url`, legacy `token` and `current_project`. CLI config can instead contain `access_token` and `refresh_token`; MCP neither reads those keys nor refreshes them. The startup message suggesting a CLI login is not a guarantee of interoperability. Set `VIAT_TOKEN` explicitly to a project PAT, or deliberately supply a valid legacy `token` value in the discovered YAML. Expired/revoked tokens fail on a later API call, not at startup.

Project-aware tools resolve non-null `project` first, then the configured default, otherwise `project_required`. Explicit null behaves like omission; an empty string does not. `list_projects` is the exception: it accepts `{}` and calls `/projects`. A project-scoped PAT is confined to its project routes and **cannot call list_projects** (403). Set `VIAT_PROJECT` instead. Passing another project does not widen the PAT’s scope. The configured bearer is used for upstream requests; there is no supported per-tool token/identity argument.

## Inventory and exact role gates

Roles below are **project roles**. “Member” includes Viewer; Editor means Owner/Admin/Developer; Publisher means Owner/Admin. PAT confinement and activation apply in addition to these gates. In particular, not all “list” tools are member-readable.

| Tools | Required permission |
| --- | --- |
| [list_projects](list_projects.md) | Authenticated user; project PAT cannot reach this route |
| [get_project](get_project.md), [list_resources](list_resources.md), [list_scripts](list_scripts.md), [read_script](read_script.md), [list_workflows](list_workflows.md), [read_workflow](read_workflow.md), [list_recent_runs](list_recent_runs.md), [read_logs](read_logs.md), [read_async_run](read_async_run.md), [list_files](list_files.md), [publish_plan](publish_plan.md) | Member |
| [list_schedules](list_schedules.md), [upsert_schedule](upsert_schedule.md), [delete_schedule](delete_schedule.md), [pause_schedule](pause_schedule.md), [resume_schedule](resume_schedule.md), [trigger_schedule](trigger_schedule.md), [read_schedule_runs](read_schedule_runs.md), [preview_cron](preview_cron.md), [list_alerts](list_alerts.md) | Member — including schedule mutations; alert destination redaction still applies |
| [list_endpoints](list_endpoints.md), [get_endpoint_tree](get_endpoint_tree.md), [create_endpoint](create_endpoint.md), [update_endpoint_auth](update_endpoint_auth.md), [update_endpoint_info](update_endpoint_info.md), [move_endpoint](move_endpoint.md), [delete_endpoint](delete_endpoint.md) | Editor (including both endpoint readers) |
| [write_script](write_script.md), [delete_script](delete_script.md), [test_run_script](test_run_script.md), [validate_workflow](validate_workflow.md), [write_workflow](write_workflow.md), [delete_workflow](delete_workflow.md), [list_queue_triggers](list_queue_triggers.md), [read_queue_trigger_fires](read_queue_trigger_fires.md), [set_queue_trigger_enabled](set_queue_trigger_enabled.md) | Editor |
| [read_audit](read_audit.md), [publish_apply](publish_apply.md), [publish_rollback](publish_rollback.md), [unpublish_endpoint](unpublish_endpoint.md), [upsert_alert](upsert_alert.md), [set_alert_enabled](set_alert_enabled.md), [delete_alert](delete_alert.md), [test_alert](test_alert.md) | Publisher |
| [call_endpoint](call_endpoint.md) | Published endpoint’s own authorizers/gates; control-plane role is not sufficient |

No tools here create projects/PATs/resources/trees, fully configure queue triggers, edit the authorization model, upload files/binaries, or cancel async runs. Use the supported console/API surfaces for those prerequisites rather than inventing tool names. See [project collaboration](../projects/create-and-collaborate.md) and [resource reference](../assets/resources/index.md).

## Input contract: omission is not a universal PATCH

The contract is a top-level object containing `count`, `schema_version`, source provenance and a `tools` array. Each of the 46 entries has `name`, `description`, `inputSchema`; it is not an output schema. Complete field tables on each page cover every input property, required field, nullable type and numeric constraint. Runtime behavior is verified separately.

- Optional Rust inputs collapse explicit JSON null to omission, even open JSON fields such as `body`, `overrides` and `inputs`. To inherit gates use `inherit_authz_gates:true`, not `authz_gates:null`. Null cannot clear endpoint bindings over MCP.
- Empty strings/arrays/objects are provided values. An empty authorizer/gate array is a declaration. `move_endpoint` with omitted/null parent **moves to the tree root**, not “leave unchanged”.
- Script writes patch only selected present fields; workflow writes replace full YAML; schedule/alert upserts replace configuration and can reset omitted policy fields. Schedule/alert upserts default `enabled` to **true**. Inspect tool-specific defaults before retrying an old request.
- The JSON schema sometimes leaves values fully open (`true` or no `type`); that does not waive API validation. CRUD, WebSocket, overrides and authorization gates have source-verified constraints described on [create_endpoint](create_endpoint.md).
- Do not depend on unknown-argument dropping for typo detection. Input type/deserialization failure can be a JSON-RPC error before the tool handler.

## Actual success envelope: JSON inside text

A successful call is a JSON-RPC response whose `result.content` has one **text** block. `ContentBlock::json` serializes the tool result to a JSON string; parse that text to obtain the value. Viat does not declare a tool `outputSchema` or populate `structuredContent` in this implementation.

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

Optional output fields are often omitted, not null. Exceptions are documented per tool: list endpoint nullable keys, schedule `next_due_at`, and raw API pass-through objects can retain null. A 204 API delete is decoded as null internally, but schedule deletion constructs `{deleted:"name"}` rather than returning null.

**Successful tool transport is not successful work.** Inspect `call_endpoint.status`, synchronous test-run `ok`, workflow validation `ok`, async run `status`, and test alert `delivered`. A failed endpoint/script/channel can be useful normal result data.

## Error envelope and safe retry

Tool-layer failures use `isError:true`, again with JSON encoded in the text block. Example shape (not an executed failure):

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

| `error_kind` | `http_status` | `retryable` | Recovery |
| --- | --- | --- | --- |
| `http_4xx` | Original HTTP status | false | Inspect message (original API body as a string). Fix token/scope/project/input; 409 publish gates require review, not blind acknowledgement. This classification also leaves 429 non-retryable; do not override with aggressive loops. |
| `http_5xx` | Original HTTP status | true | Inspect instance health; reconcile mutations before replay. |
| `network` | Omitted | true | Check direct connectivity, DNS, TLS and trusted server URL. A lost response may follow a completed mutation. |
| `upstream_timeout` | 504 | true | HTTP wait elapsed; check run/log/config state before repeating. Not cancellation. |
| `project_required` | Omitted | false | Supply `project` or configure `VIAT_PROJECT`. |
| `bad_input` | Omitted | false | Fix local semantic validation or JSON decoding; some API-invalid input is instead http_4xx. |
| `license_required` | 403 | true | A platform Admin/Owner must activate the deployment with a valid matching code through the activation surface. Retrying credentials does not help. See [activation](../instance/activation.md). |

`message` is a string; optional status fields are omitted where listed. Protocol errors (bad arguments, unknown tool, session errors) are JSON-RPC errors rather than necessarily this envelope. Internal serialization errors can also bypass it. MCP automatically sends no refresh and implements no application-level retry loop. Default upstream HTTP wait is 30 seconds; `call_endpoint` and script test runs override it as documented.

`call_endpoint` normally carries upstream 4xx/5xx in an ordinary result. The specific exception is a 403 JSON body with `error:"license_required"`, converted to a tool error. Thus an endpoint’s own authorization 403 and an unactivated instance are distinguishable. Inventory/initialize can still work on a locked instance because they are local.

## Pagination is tool-specific

| Tool | How to continue | Stop / limitation |
| --- | --- | --- |
| list_recent_runs | `next_before` → `before`, same filters | Missing next_before; MCP default 20, cap 200 |
| read_audit | Both `next_before` → `before` AND `next_before_id` → `before_id` | Missing pair; default 100, clamp 1..500 |
| list_files | Opaque `next_cursor` → `before` | null; API default 100, clamp 1..1000 |
| read_schedule_runs | Oldest returned `started_at` → `before` | Bare array, no next marker; default 20, clamp 1..200; timestamp-only ties have no ID continuation |
| read_logs | No continuation | Raise line_limit from default 500 to max 2000; inspect truncated |
| read_queue_trigger_fires | No continuation | Latest 50 only |
| Other lists | No pagination input or cursor | Complete API collection/projection, not a fabricated cursor protocol |

## Isolated fixture walkthrough and cleanup

These are **instructions for an explicitly authorized local exercise**, not steps executed by this reference. Before sending anything, create an activated isolated `mcp-lab` project, PAT and `main` endpoint tree through the console. Choose a PAT owner with Editor rights for draft operations; Publisher is additionally required for live publishing. Do not use a shared project’s pending publish plan for this exercise.

1. Start with `get_project` and `list_scripts`. A project PAT must not be tested with list_projects. Save any pre-existing names rather than overwriting them; the `mcp_*` names are synthetic, not reserved.
2. `write_script` with `name:"mcp_demo"`, `folder:""`, `language:"python"` and this inert source. For execution the server needs a functioning Python runtime; configuration success does not guarantee that interpreter is installed.

   ```python
   def main():
       return {"ok": True}
   ```

3. Optionally `test_run_script` with `{name:"mcp_demo",folder:"",args:{}}`; inspect `ok`. For detached runs use `run_async:true`, then `read_async_run` with the returned run_id. No resource recording is needed for this inert code.
4. For workflow pages, validate then write the following as `mcp_flow` at `folder:""`, with the fixture script already present:

   ```yaml
   inputs:
   steps:
     - id: hello
       script: mcp_demo
       args: {}
   outputs:
     result: "$hello.output"
   ```

5. Endpoint examples assume `create_endpoint` with `tree:"main"`, `segment:"mcp-demo"`, `method:"GET"`, `script_name:"mcp_demo"`. Record the **returned endpoint ID**. The repeated UUID on these pages is a synthetic placeholder, not an ID you can send unchanged. Draft listing does not mean HTTP is live.
6. Only if you explicitly opt into live routing: inspect every `publish_plan` item; stop if unrelated changes exist. `publish_apply` publishes all pending leaves. `call_endpoint` requires that published fixture and an authorizer policy that actually accepts the supplied credential. Do not weaken production authorization to make an example pass.
7. Schedule examples require the inert script and use `mcp_timer`, interval 60 seconds, `enabled:false`. Alert examples use disabled `mcp_alert` with an operator-owned local HTTP stub reachable **from the API host**. Disabled alerts still really send when test_alert is called. Queue examples require an existing isolated `queue_stub` AMQP resource and `mcp_queue` configured in the console; no broker/provider setup or call is implied by these pages. `list_files` assumes an existing `files_stub` storage resource and working metadata database; an empty list does not create it.
8. Cleanup deliberately: pause/delete the fixture schedule; disable/delete the fixture alert; leave any queue fixture disabled and remove it only through an authorized console operation. Unpublish the fixture endpoint if published, then delete its node. Remove workflow references, delete mcp_flow, then delete mcp_demo when unused. Verify with the corresponding list/read tools. Revoke the exercise PAT in the token management surface and remove it from the host config.

Cleanup does not retract notifications, restore business database writes or cancel already running tasks. MCP has no universal transaction, cancellation, undelete or “undo everything” tool. Project rollback restores serving revisions, **not live `uses:` modules** or external effects. Execution/audit records can remain according to retention policy; do not delete them as a cosmetic cleanup step.

## Maintenance evidence and known discrepancies

- Inventory/inputs: `contracts/1.1.0/mcp-tools.json`; actual registration and result wrapping: `crates/viat-mcp/src/tools/service.rs`. Schemas are mechanical field evidence, not the semantic source of these pages.
- Config/HTTP/errors: `crates/viat-mcp/src/config.rs`, `http.rs`, `error.rs`, `lib.rs`; CLI credential-key comparison: `crates/viat-cli/src/config.rs`. The MCP/CLI token-key mismatch is documented above rather than claiming refresh support.
- Tool-specific behavior and integration regression cases: `crates/viat-mcp/src/tools/*.rs`, `crates/viat-mcp/tests/it/`. Role gates were checked in the API handlers for endpoints, trees, scripts, workflows, schedules, alerts, queue triggers, files, logs, async runs, audit, resources, projects and publishing.
- Existing source prose broadly describes readers as read-only/member-accessible; actual endpoint/tree reader handlers require Editor. The read_script schema description says ambiguity names folders, but the actual 409 asks for folder without enumerating them: use list_scripts.
- Examples, timestamp values, synthetic IDs, local provider stubs and expected shapes are **unverified by execution**. This reference does not claim end-to-end provider delivery, network readiness, executable-example validation or publication approval.
