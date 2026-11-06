---
title: "SMTP resource"
description: "A project-specific outbound mail relay, separate from deployment VIAT_SMTP alert settings. The platform owns the credential and fixes sender identity; scripts choose recipients, subject and content, not From."
doc_id: resource.smtp
verified_release: '1.1.0'
channel: stable
contract_ids: [resource.smtp]
---

# SMTP resource

A project-specific outbound mail relay, separate from deployment VIAT_SMTP alert settings. The platform owns the credential and fixes sender identity; scripts choose recipients, subject and content, not From.

Verified against stable Viat 1.1.0. Examples use synthetic values/provider stubs; they were not executed, connected to live services or used to send messages. Start with the [resource overview](index.md).

## Prerequisites and permissions

Provision a relay authorized for from_address and satisfy its sender-domain/rate requirements. Permit API-node TCP/TLS access. Use an isolated capture relay for examples, not real recipients.

## Complete configuration fields

Required describes structural parsing; conditional provider/backend requirements, runtime defaults and limitations follow below. Use null only where the type allows it. Numeric storage bounds do not imply every value is operationally valid. Do not rely on unknown-key dropping to detect typos.

### `plain`

| Field | Type / allowed values | Required | Omitted default | Constraints | Meaning |
| --- | --- | --- | --- | --- | --- |
| `plain.from_address` | string | yes | — | — | Fixed envelope/header From; scripts cannot override it. |
| `plain.from_name` | string / null | no; may be conditional | `null` | — | Optional fixed sender display name, no CR/LF. |
| `plain.host` | string | yes | — | — | Server hostname/IP, not a URL or credential. |
| `plain.port` | integer | yes | — | minimum: 0; format: "uint16"; 0–65535 | TCP port. Explicitly supply it where required; TLS does not infer a port. |
| `plain.tls` | MailTls | yes | — | — | Connection transport mode; see provider-specific requirements below. |

#### `MailTls`

Allowed shape/values: `"none" / "starttls" / "implicit"`.

### `secret`

| Field | Type / allowed values | Required | Omitted default | Constraints | Meaning |
| --- | --- | --- | --- | --- | --- |
| `secret.password` | string | no; may be conditional | `""` | — | Account password/app password, never a plaintext config setting. |
| `secret.username` | string | no; may be conditional | `""` | — | Account name; optional/anonymous rules differ by kind. |

## Runtime rules, defaults and limits

host nonblank, port nonzero and tls are required. tls is none/starttls/implicit; 587 STARTTLS/465 implicit are conventions, not port defaults. from_address must look addressable; CR/LF is refused in host/from_address/from_name. from_name optional. Empty username means anonymous relay; password without username is rejected. From cannot be overridden in send. TLS:none is only for deliberately trusted networks.

Attachment mode limits: at most 20 attachments, 10 MiB decoded bytes total, 16 KiB combined metadata, filename/content-type fields at most 255 bytes without control characters, 1 MiB text+HTML total, and 16 MiB complete MIME. These attachment-mode caps are not a claim of an identical no-attachment body cap. Failures include too_many_attachments, attachments_too_large, invalid_attachment_metadata, invalid_transfer_encoding, mail_body_too_large and message_too_large. Provide a single safe filename and explicit content_type when needed; an attachment is bytes, never a local path for the platform to read.

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
  "kind": "smtp",
  "plain": {
    "host": "smtp-stub.example.test",
    "port": 587,
    "tls": "starttls",
    "from_address": "sender@example.test",
    "from_name": "Fixture sender"
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

Python send(to=None,subject="",text=None,html=None,cc=None,bcc=None,reply_to=None,attachments=None); TypeScript send({to,subject,text,html,cc,bcc,reply_to,attachments}). to/cc/bcc accept a string or list; require at least one recipient overall and text or html. Attachments are [{filename,content_type?,content}] (bytes/UTF-8 text) or body_base64 instead of content, never both; the platform never fetches an attachment path/URL. Returns {queued:true,accepted:n} for relay acceptance, not delivery. No inbox method.

Both complete scripts declare the same root resource demo. Use only an approved fixture run. Writes, sends, builds and deletion are not dry-run.

### Python

```python
# @resource demo
from viat import ctx

def main():
    return ctx.resources.demo.send(to="recipient@example.test", subject="Fixture", text="Reference message")
```

### TypeScript

```typescript
// @resource demo
import { ctx } from "viat";

export async function main() {
  return await ctx.resources.demo.send({ to: "recipient@example.test", subject: "Fixture", text: "Reference message" });
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
        ctx.resource("demo").call("mail_send", json!({"to":["recipient@example.test"],"subject":"Fixture","text":"Reference message"}))
    });
}
```

Shell has JSON environment projection, not method-decorated ctx.resources; these methods are not shell functions. Binary programs can implement corresponding worker-protocol RPC, not automatically Python/TypeScript methods. The sql lane supports the four SQL kinds; viat_gql only PostgreSQL/MySQL/SQLite; graphql targets remote graphql; llm targets llm. Unsupported lane/kind combinations are not automatically adapted.

### Expected result

A capture relay accepts one fixture recipient and returns queued:true/accepted:1. On a real relay send sends real mail; a dummy address does not make it dry-run.

## Test behavior and side effects

Connects/checks SMTP/TLS/auth without submitting a message. It still creates a real network/authentication event.

Management API: `POST /projects/{slug}/resources/{name}/test?folder=`; CLI: `viat resource test demo`. Inspect body ok: connection failures normally still return HTTP 200 `{ok:false,error:"…"}`, possibly with schema_warnings. Status alone is insufficient; CLI exits nonzero on failure. Run only after approving network/filesystem effects.

## Common failures and recovery

resource.smtp.empty_host/bad_port/bad_from_address/bad_from_name/password_without_username: fix save input. Sending can also reject recipient/body/header/attachment limits before SMTP. Auth/TLS errors require matching port, mode, certificate and account. A later bounce after acceptance is not a helper failure.

Management errors normally use {error,message}. DTO resource.&lt;kind&gt;.* identifiers often occur in the message of 400 bad_request, not the top-level error; they are not a universal enum returned by every runtime helper. For 401 restore platform auth, 403 check effective project role/runtime rules, 404 check folder/name, 409 resolve duplicate identity or resource_in_use references. Distinguish upstream refusals from platform refusals and determine whether work might already have applied before retrying.

## Production pitfalls and cleanup

Handle quotas, bounces and idempotency outside send; retrying an uncertain timeout can duplicate mail. Bound attachments and keep personal data out of logs. Resource deletion neither recalls mail nor revokes relay credentials.

General removal: disable callers, proxy/CRUD targets and related triggers, migrate dependencies and retain required evidence; then use `viat resource delete demo` or DELETE on the detail route. For 409 resource_in_use rebind/remove named endpoint holders first; do not bypass references. Removing an asset is not revoking third-party credentials, deleting external data or undoing prior side effects.

## Related resources and maintenance evidence

- [IMAP resource](imap.md)
- [Managed storage resource](storage.md)
- [Resource overview](index.md)

Pinned contract: `contracts/1.1.0/resources.json` → `resource.smtp`。

Reviewed implementation (product-repository-relative paths): viat-core/src/types/resource.rs (KindSpec/Plain/Secret); viat-api/src/dto.rs (normalization/validation); viat-api/src/handlers/resources.rs (CRUD/Test); viat-runtime/src/resource_io.rs, resources_json.rs, python.rs, typescript.rs; viat-api/src/runner/broker.rs; viat-cli/src/main.rs and repo/resources.rs; viat-core/src/types/snapshot.rs.
