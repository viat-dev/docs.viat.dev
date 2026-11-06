---
title: "AMQP resource"
description: "AMQP 0-9-1/RabbitMQ for publisher-confirmed script publishing and the implemented queue-consumer trigger. Consuming is a queue trigger, not a .consume helper. Kafka/AMQP 1.0/RocketMQ are not this kind."
doc_id: resource.amqp
verified_release: '1.1.0'
channel: stable
contract_ids: [resource.amqp]
---

# AMQP resource

AMQP 0-9-1/RabbitMQ for publisher-confirmed script publishing and the implemented queue-consumer trigger. Consuming is a queue trigger, not a .consume helper. Kafka/AMQP 1.0/RocketMQ are not this kind.

Verified against stable Viat 1.1.0. Examples use synthetic values/provider stubs; they were not executed, connected to live services or used to send messages. Start with the [resource overview](index.md).

## Prerequisites and permissions

Create vhost, exchanges, queues, bindings and a user with appropriate configure/write/read rights. Default-exchange routing needs an existing queue matching the routing key. Allow API-node TCP/TLS; durability requires durable topology and persistent messages.

## Complete configuration fields

Required describes structural parsing; conditional provider/backend requirements, runtime defaults and limitations follow below. Use null only where the type allows it. Numeric storage bounds do not imply every value is operationally valid. Do not rely on unknown-key dropping to detect typos.

### `plain`

| Field | Type / allowed values | Required | Omitted default | Constraints | Meaning |
| --- | --- | --- | --- | --- | --- |
| `plain.host` | string | yes | — | — | Server hostname/IP, not a URL or credential. |
| `plain.port` | integer | no; may be conditional | `5672` | minimum: 0; format: "uint16"; 0–65535 | TCP port. Explicitly supply it where required; TLS does not infer a port. |
| `plain.tls` | boolean | no; may be conditional | `false` | — | Connection transport mode; see provider-specific requirements below. |
| `plain.vhost` | string | no; may be conditional | `"/"` | — | AMQP virtual host, encoded as a path segment. |

### `secret`

| Field | Type / allowed values | Required | Omitted default | Constraints | Meaning |
| --- | --- | --- | --- | --- | --- |
| `secret.password` | string | no; may be conditional | `""` | — | Account password/app password, never a plaintext config setting. |
| `secret.username` | string | no; may be conditional | `""` | — | Account name; optional/anonymous rules differ by kind. |

## Runtime rules, defaults and limits

host required/nonblank, excludes @/?#%/whitespace. port defaults 5672, nonzero; tls defaults false and does not change the port automatically. vhost defaults / and is percent-encoded wholesale. username/password default empty; both empty selects broker guest (normally loopback-only), otherwise both required. Guest is not a production remote account.



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

**1.1.0 compatibility/security limitation:** this kind’s active runtime projection still injects a credential-bearing connection URL into the worker, even though the recommended operations below are brokered and do not need it. Treat the script and its dependency tree as trusted with that credential. Do not log/return the resource or extract a URL into application code; prefer the brokered helpers and least-privilege upstream credentials. Encryption at rest and CRUD masking do not remove this worker exposure.

## Minimal configuration: management API / CLI file

This create-request JSON is also valid YAML for `resource.yaml` and the real CLI command below. Domains/credentials are fixtures; replace them and satisfy prerequisites before real use. Never commit a file containing actual secrets.

```json
{
  "name": "demo",
  "folder": "",
  "kind": "amqp",
  "plain": {
    "host": "rabbit.example.test",
    "port": 5671,
    "vhost": "demo",
    "tls": true
  },
  "secret": {
    "username": "fixture-user",
    "password": "fixture-password-not-a-credential"
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

Python publish(routing_key,payload,exchange="",headers=None,persistent=True); TypeScript publish(routing_key,payload,{exchange,headers,persistent}). String payloads are text/plain verbatim, other JSON application/json. Headers are flat strings; persistent defaults true (delivery mode 2). Publisher confirmation means broker acceptance, not consumer processing. Queue triggers share the resource and implement at-least-once ack/dead-letter/requeue based on execution outcome; configuring only the resource does not start a consumer.

Both complete scripts declare the same root resource demo. Use only an approved fixture run. Writes, sends, builds and deletion are not dry-run.

### Python

```python
# @resource demo
from viat import ctx

def main():
    return ctx.resources.demo.publish("reference.jobs", {"id": "fixture-1"})
```

### TypeScript

```typescript
// @resource demo
import { ctx } from "viat";

export async function main() {
  return await ctx.resources.demo.publish("reference.jobs", { id: "fixture-1" });
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
        ctx.resource("demo").call("amqp_publish", json!({"routing_key":"reference.jobs","payload":{"id":"fixture-1"},"exchange":"","persistent":true,"headers":{}}))
    });
}
```

Shell has JSON environment projection, not method-decorated ctx.resources; these methods are not shell functions. Binary programs can implement corresponding worker-protocol RPC, not automatically Python/TypeScript methods. The sql lane supports the four SQL kinds; viat_gql only PostgreSQL/MySQL/SQLite; graphql targets remote graphql; llm targets llm. Unsupported lane/kind combinations are not automatically adapted.

### Expected result

A fixture vhost with queue reference.jobs accepts one JSON message. This is a real publish; no topology is created or automatically drained.

## Test behavior and side effects

Authenticated AMQP/vhost handshake, then deadline-bounded close. No declaration, publish or consumption.

Management API: `POST /projects/{slug}/resources/{name}/test?folder=`; CLI: `viat resource test demo`. Inspect body ok: connection failures normally still return HTTP 200 `{ok:false,error:"…"}`, possibly with schema_warnings. Status alone is insufficient; CLI exits nonzero on failure. Run only after approving network/filesystem effects.

## Common failures and recovery

resource.amqp.partial_credentials: provide both halves or neither. bad_host/bad_port/empty_host: fix values. ACCESS_REFUSED: repair vhost/user policy; missing exchange/queue: provision topology. Retries need message IDs/deduplication because confirmation is not application completion.

Management errors normally use {error,message}. DTO resource.&lt;kind&gt;.* identifiers often occur in the message of 400 bad_request, not the top-level error; they are not a universal enum returned by every runtime helper. For 401 restore platform auth, 403 check effective project role/runtime rules, 404 check folder/name, 409 resolve duplicate identity or resource_in_use references. Distinguish upstream refusals from platform refusals and determine whether work might already have applied before retrying.

## Production pitfalls and cleanup

Configure dead-lettering, backpressure and idempotent consumers. Disable triggers/publishers before removal; deleting this resource does not purge queues, delete exchanges or revoke users.

General removal: disable callers, proxy/CRUD targets and related triggers, migrate dependencies and retain required evidence; then use `viat resource delete demo` or DELETE on the detail route. For 409 resource_in_use rebind/remove named endpoint holders first; do not bypass references. Removing an asset is not revoking third-party credentials, deleting external data or undoing prior side effects.

## Related resources and maintenance evidence

- [Redis resource](redis.md)
- [Mobile push resource](push.md)
- [Resource overview](index.md)

Pinned contract: `contracts/1.1.0/resources.json` → `resource.amqp`。

Reviewed implementation (product-repository-relative paths): viat-core/src/types/resource.rs (KindSpec/Plain/Secret); viat-api/src/dto.rs (normalization/validation); viat-api/src/handlers/resources.rs (CRUD/Test); viat-runtime/src/resource_io.rs, resources_json.rs, python.rs, typescript.rs; viat-api/src/runner/broker.rs; viat-cli/src/main.rs and repo/resources.rs; viat-core/src/types/snapshot.rs.
