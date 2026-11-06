---
title: "LLM resource"
description: "Viat’s multi-provider chat contract supports openai, anthropic, azure and custom. It normalizes chat, tool-call replies and text streaming without exposing the API key. This reference describes the shipped adapter, not current model recommendations or a general provider SDK."
doc_id: resource.llm
verified_release: '1.1.0'
channel: stable
contract_ids: [resource.llm]
---

# LLM resource

Viat’s multi-provider chat contract supports openai, anthropic, azure and custom. It normalizes chat, tool-call replies and text streaming without exposing the API key. This reference describes the shipped adapter, not current model recommendations or a general provider SDK.

Verified against stable Viat 1.1.0. Examples use synthetic values/provider stubs; they were not executed, connected to live services or used to send messages. Start with the [resource overview](index.md).

## Prerequisites and permissions

Obtain an account/key and a model or Azure deployment you are allowed to use; provision a protocol-compatible local stub for initial verification. Allow API-node outbound access and configure a proxy if required. Model execution can incur charges and export prompt/tool data: real calls require explicit approval.

## Complete configuration fields

Required describes structural parsing; conditional provider/backend requirements, runtime defaults and limitations follow below. Use null only where the type allows it. Numeric storage bounds do not imply every value is operationally valid. Do not rely on unknown-key dropping to detect typos.

### `plain`

| Field | Type / allowed values | Required | Omitted default | Constraints | Meaning |
| --- | --- | --- | --- | --- | --- |
| `plain.endpoint` | string / null | no; may be conditional | `null` | — | Configured service endpoint; exact base-vs-operation and normalization rules depend on kind. |
| `plain.extra_params` | object | no; may be conditional | `{}` | — | Arbitrary JSON request-body overrides; review as behavior, not harmless labels. |
| `plain.model` | string | yes | — | — | Configured model identifier; Azure uses a deployment name. No discovery/substitution. |
| `plain.provider` | LlmProvider | yes | — | — | Wire protocol/provider selector; conditional requirements follow below. |
| `plain.proxy` | string / null | no; may be conditional | `null` | — | Optional proxy URL; broker helpers apply it on the platform. Do not embed passwords in plain. |

#### `LlmProvider`

Allowed shape/values: `"openai" / "anthropic" / "azure" / "custom"`.

### `secret`

| Field | Type / allowed values | Required | Omitted default | Constraints | Meaning |
| --- | --- | --- | --- | --- | --- |
| `secret.api_key` | string | yes | — | — | Provider API credential, applied by the platform. |

## Runtime rules, defaults and limits

model and api_key must be nonblank. endpoint is optional for openai (https://api.openai.com/v1) and anthropic (https://api.anthropic.com), required for azure/custom. openai/custom append /chat/completions and use bearer auth; include /v1 in a compatible custom base when needed. anthropic appends /v1/messages and uses x-api-key plus anthropic-version 2023-06-01. Azure appends /openai/deployments/{model}/chat/completions?api-version=2024-02-01, uses api-key and treats model as the deployment name, not a body model field. Endpoint override is a base, not the final operation URL. No automatic model discovery or newest-model substitution occurs.

extra_params are request-body overrides merged after modeled defaults; per-call extra fields override resource extras last. They can change model/messages/budget too, so review them as behavior, not harmless metadata. Proxy is applied by the platform. With anthropic, max_tokens defaults to 4096 if omitted; other adapters omit it unless set. JSON mode is best-effort (no enforced JSON mode for anthropic); parse and validate output yourself.

## Permissions, identity and save semantics

Management API requires platform authentication and project membership. List/show require membership; create, PUT, PATCH, Test, refresh, copy and delete require an effective project Owner/Admin/Developer role; the lower-privilege operator role cannot write. Management access grants neither upstream privileges nor runtime s3/file/row-policy access. MCP exposes only its actual listed tools; a resource schema is not a full MCP CRUD interface.

- Create: `POST /projects/{slug}/resources`, body `{name,folder?,kind,plain,secret}`. name is 1–64 bytes without /; system is reserved. Omitted/empty folder means root; otherwise [A-Za-z0-9_-]+ segments, at most 8 levels/255 bytes, no leading/trailing/repeated /.
- Identity is project-local `(folder,name)`, not a global bare name. Duplicate names may exist in different folders. Use `/resources/{name}?folder=team` to locate detail routes explicitly; CLI uses `team/name`. Script bare names resolve own folder, root, then globally unique name; qualify cross-folder references, using Python `getattr(ctx.resources, "team/name")` or TypeScript `ctx.resources["team/name"]`, not a property chain.
- PUT fully replaces: resend correct kind, complete plain and all secret values to retain; show masks cannot recover them. PATCH fixes kind; omitted plain preserves it, supplied plain replaces the entire document (not a deep merge); secret overlays only supplied fields, retaining omitted fields. Folder moves recheck references at the new anchor.
- Clear an optional secret by explicit null (only nullable fields) or empty string (only fields allowing empty). Required/conditionally required fields cannot be cleared. To clear optional plain fields, send complete plain without them so defaults/absence take effect. Null is not universal and *** is never an old-secret value.
- `$keep` is a PATCH/repo sentinel only at **top-level plain fields**, retaining an existing server value even for numeric/boolean fields. It cannot initialize a new resource or missing field. Nested `$keep` is not a deep-merge instruction.
- Repo file `resources/<folder>/<name>.yaml` carries folder through its path, with a bare name inside. `viat pull` writes string `$secret` placeholders for secret fields; `viat push` removes them (also accepts legacy !secret tags) and PATCHes existing resources, never using markers as credentials. Safely supply real required secrets before creating a new resource; a placeholder cannot create credentials. Top-level allowed_authorizers is repo access-sync metadata, not something to insert into plain arbitrarily.

The `$secret` placeholder differs from a credential reference: `{"$secret":"name"}` names another secret resource in supported config/cloud positions; HTTP/GraphQL string headers use the entire `"$secret:name"` value. These are not plaintext credentials. Save/read/export retain references; use resolves them. Targets resolve relative to the consuming resource folder and must already exist with kind secret. No substring interpolation.

Public responses contain resource identifiers, kind, folder, plain and a secret summary, never secret values. Summary *** denotes declared fields, not proof every optional credential is populated. Plain is readable/exportable; secret uses the deployment encrypted backend. Published script/dependency code follows snapshot rules: uses is frozen unless (live), not blanket live on every run. Resource projection, broker operations and explicit live secret IO are different boundaries.

## Script secret boundary

Provider credential/private material is applied by the platform’s broker operation, not handed to the script helper. Do not use removed r.secret/r.auth_headers patterns. Plain literal headers/config remain visible: use references in supported positions.

## Minimal configuration: management API / CLI file

This create-request JSON is also valid YAML for `resource.yaml` and the real CLI command below. Domains/credentials are fixtures; replace them and satisfy prerequisites before real use. Never commit a file containing actual secrets.

```json
{
  "name": "demo",
  "folder": "",
  "kind": "llm",
  "plain": {
    "provider": "custom",
    "model": "fixture-model",
    "endpoint": "https://llm-stub.example.test/v1",
    "extra_params": {}
  },
  "secret": {
    "api_key": "fixture-key-not-a-credential"
  }
}
```

```sh
viat project select <slug>
viat resource create --file resource.yaml
viat resource show demo --json
```

Equivalent API: `POST /projects/{slug}/resources`, relative to the instance management API root, with the body above. Expect the saved public resource and masked summary, not echoed secrets; an existing fixture name conflicts with 409. For repo sync omit folder and put it in `resources/demo.yaml`; `viat push` synchronizes complete plain and non-placeholder secret fields. Saving does not prove every remote operation works.

## SDK operations and examples

Python chat(messages,max_tokens=None,temperature=None,json=False,tools=None,tool_choice=None,**extra), ask(prompt,**kw) (content only), chat_stream(messages,…) (text iterator). TypeScript chat(messages,opts), ask(prompt,opts), chatStream(messages,opts) (async text iterator). messages may be a string or [{role,content,tool_calls?,tool_call_id?}]; role is system/user/assistant/tool. chat returns {content,model,usage,tool_calls}; usage may be null, and content may be empty when tools are requested. Tools are [{name,description?,parameters}] and returned calls are [{id,name,arguments}] with decoded JSON arguments. The script must validate/authorize and execute tools, append the assistant request and matching role:tool replies, and bound the loop. Streams carry text only and refuse tools; do not use streaming to infer complete tool calls.

Both complete scripts declare the same root resource demo. Use only an approved fixture run. Writes, sends, builds and deletion are not dry-run.

### Python

```python
# @resource demo
from viat import ctx

def main():
    return ctx.resources.demo.chat("Reply with the word ready", max_tokens=16)
```

### TypeScript

```typescript
// @resource demo
import { ctx } from "viat";

export async function main() {
  return await ctx.resources.demo.chat("Reply with the word ready", { max_tokens: 16 });
}
```

### Rust

The verified Rust surface uses generic `ctx.resource(name).call(op,req)` (library uses `ctx.library`), not invented Python-shaped methods. This shows the corresponding protocol operation and returns its raw result, which can differ from the composite example above.

```rust
// @resource demo
use serde_json::{json, Value};
use viat::{Ctx, Error};

fn main() {
    viat::serve(|ctx: &Ctx, _args: Value| -> Result<Value, Error> {
        ctx.resource("demo").call("llm", json!({"messages":[{"role":"user","content":"Reply with the word ready"}],"max_tokens":16}))
    });
}
```

Shell has JSON environment projection, not method-decorated ctx.resources; these methods are not shell functions. Binary programs can implement corresponding worker-protocol RPC, not automatically Python/TypeScript methods. The sql lane supports the four SQL kinds; viat_gql only PostgreSQL/MySQL/SQLite; graphql targets remote graphql; llm targets llm. Unsupported lane/kind combinations are not automatically adapted.

### Expected result

A protocol-compatible fixture can return content="ready", model="fixture-model", usage and tool_calls=[]. The dummy model/key are not valid vendor credentials. Neither the configuration nor the chat examples were executed.

## Test behavior and side effects

A real authenticated model-list GET: openai/custom {base}/models; anthropic {base}/v1/models; azure {base}/openai/models?api-version=2024-02-01. It does not generate tokens, but still contacts the service. A custom service without model listing may fail Test while chat works; Test success does not prove the configured model/deployment or tool compatibility.

Management API: `POST /projects/{slug}/resources/{name}/test?folder=`; CLI: `viat resource test demo`. Inspect body ok: connection failures normally still return HTTP 200 `{ok:false,error:"…"}`, possibly with schema_warnings. Status alone is insufficient; CLI exits nonzero on failure. Run only after approving network/filesystem effects.

## Common failures and recovery

400 bad_request messages: resource.llm.empty_model, empty_api_key, endpoint_required, bad_url, bad_proxy_url. Fix the named field. Provider 401/403: rotate/authorize the key; 404: check base and Azure deployment; 429: respect provider limits and bound retries. Invalid JSON/tool arguments require application validation, not treating text as a trusted command.

Management errors normally use {error,message}. DTO resource.&lt;kind&gt;.* identifiers often occur in the message of 400 bad_request, not the top-level error; they are not a universal enum returned by every runtime helper. For 401 restore platform auth, 403 check effective project role/runtime rules, 404 check folder/name, 409 resolve duplicate identity or resource_in_use references. Distinguish upstream refusals from platform refusals and determine whether work might already have applied before retrying.

## Production pitfalls and cleanup

Set explicit token, timeout, tool-iteration and spending budgets. Never place credentials in extra_params or prompts. Audit what leaves the network. Deleting this resource does not cancel already accepted provider requests or revoke the API key; disable callers, then revoke the key separately.

General removal: disable callers, proxy/CRUD targets and related triggers, migrate dependencies and retain required evidence; then use `viat resource delete demo` or DELETE on the detail route. For 409 resource_in_use rebind/remove named endpoint holders first; do not bypass references. Removing an asset is not revoking third-party credentials, deleting external data or undoing prior side effects.

## Related resources and maintenance evidence

- [HTTP API resource](http_api.md)
- [Config resource](config.md)
- [Secret resource](secret.md)
- [Resource overview](index.md)

Pinned contract: `contracts/1.1.0/resources.json` → `resource.llm`。

Reviewed implementation (product-repository-relative paths): viat-core/src/types/resource.rs (KindSpec/Plain/Secret); viat-api/src/dto.rs (normalization/validation); viat-api/src/handlers/resources.rs (CRUD/Test); viat-runtime/src/resource_io.rs, resources_json.rs, python.rs, typescript.rs; viat-api/src/runner/broker.rs; viat-cli/src/main.rs and repo/resources.rs; viat-core/src/types/snapshot.rs.
