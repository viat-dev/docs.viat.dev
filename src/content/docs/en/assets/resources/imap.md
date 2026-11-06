---
title: "IMAP resource"
description: "Read messages, list mailboxes and explicitly mark Seen through platform IMAP. Not SMTP, a general mailbox administrator or a background trigger by itself."
doc_id: resource.imap
verified_release: '1.1.0'
channel: stable
contract_ids: [resource.imap]
---

# IMAP resource

Read messages, list mailboxes and explicitly mark Seen through platform IMAP. Not SMTP, a general mailbox administrator or a background trigger by itself.

Verified against stable Viat 1.1.0. Examples use synthetic values/provider stubs; they were not executed, connected to live services or used to send messages. Start with the [resource overview](index.md).

## Prerequisites and permissions

Enable IMAP and obtain a mailbox/app password with read/flag rights. Permit API-node access. Use a fixture mailbox of synthetic mail: production reads expose personal data.

## Complete configuration fields

Required describes structural parsing; conditional provider/backend requirements, runtime defaults and limitations follow below. Use null only where the type allows it. Numeric storage bounds do not imply every value is operationally valid. Do not rely on unknown-key dropping to detect typos.

### `plain`

| Field | Type / allowed values | Required | Omitted default | Constraints | Meaning |
| --- | --- | --- | --- | --- | --- |
| `plain.host` | string | yes | — | — | Server hostname/IP, not a URL or credential. |
| `plain.port` | integer | yes | — | minimum: 0; format: "uint16"; 0–65535 | TCP port. Explicitly supply it where required; TLS does not infer a port. |
| `plain.tls` | MailTls | yes | — | — | Connection transport mode; see provider-specific requirements below. |

#### `MailTls`

Allowed shape/values: `"none" / "starttls" / "implicit"`.

### `secret`

| Field | Type / allowed values | Required | Omitted default | Constraints | Meaning |
| --- | --- | --- | --- | --- | --- |
| `secret.password` | string | yes | — | — | Account password/app password, never a plaintext config setting. |
| `secret.username` | string | yes | — | — | Account name; optional/anonymous rules differ by kind. |

## Runtime rules, defaults and limits

host, port, tls required; host nonblank without CR/LF and port nonzero. tls is none/starttls/implicit; 993 implicit is conventional, not automatic. username must be nonblank; password is a required string. No anonymous mailbox mode. Calls may select mailbox and IMAP SEARCH criteria, not host/credential.

Without attachments, individual mail fetches are limited to 1 MiB and returned text is bounded at 64 KiB per message. With attachments enabled, MIME may be up to 16 MiB; at most 20 parts, 10 MiB decoded attachment bytes, 16 KiB metadata and 16 MiB serialized reply bounds apply. Check truncated and per-message completeness/error fields instead of assuming all bytes arrived. Mailbox and SEARCH strings cannot contain CR/LF; data is not a way to inject IMAP commands.

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
  "kind": "imap",
  "plain": {
    "host": "imap-stub.example.test",
    "port": 993,
    "tls": "implicit"
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

Python fetch(mailbox="INBOX",search="ALL",limit=20,mark_seen=False,include_attachments=False); TypeScript fetch(options). Returns {messages:[{uid,message_id,from,to,subject,date,text,…}],truncated}, newest first. Limit caps at 200; bytes are bounded (about 4 MiB without attachment mode). BODY.PEEK does not mark Seen by default. mark_seen(uids,mailbox="INBOX") → {updated:n}; mailboxes() → {mailboxes:[…]} (same underscore in TypeScript). Attachments opt-in returns bounded body_base64 and attachments_complete/attachments_error per message: failures return no partial attachments. mark_seen:true flags successfully returned messages; leave false and acknowledge after durable processing for at-least-once work.

Both complete scripts declare the same root resource demo. Use only an approved fixture run. Writes, sends, builds and deletion are not dry-run.

### Python

```python
# @resource demo
from viat import ctx

def main():
    return ctx.resources.demo.fetch(search="UNSEEN", limit=5)
```

### TypeScript

```typescript
// @resource demo
import { ctx } from "viat";

export async function main() {
  return await ctx.resources.demo.fetch({ search: "UNSEEN", limit: 5 });
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
        ctx.resource("demo").call("imap", json!({"op":"fetch","mailbox":"INBOX","search":"UNSEEN","limit":5,"mark_seen":false,"include_attachments":false}))
    });
}
```

Shell has JSON environment projection, not method-decorated ctx.resources; these methods are not shell functions. Binary programs can implement corresponding worker-protocol RPC, not automatically Python/TypeScript methods. The sql lane supports the four SQL kinds; viat_gql only PostgreSQL/MySQL/SQLite; graphql targets remote graphql; llm targets llm. Unsupported lane/kind combinations are not automatically adapted.

### Expected result

A fixture with one unseen message returns it with truncated:false and leaves Seen unchanged. The snippet does not acknowledge processing.

## Test behavior and side effects

Connects/authenticates through IMAP without sending mail. This does not prove every message/attachment is processable.

Management API: `POST /projects/{slug}/resources/{name}/test?folder=`; CLI: `viat resource test demo`. Inspect body ok: connection failures normally still return HTTP 200 `{ok:false,error:"…"}`, possibly with schema_warnings. Status alone is insufficient; CLI exits nonzero on failure. Run only after approving network/filesystem effects.

## Common failures and recovery

resource.imap.bad_host/bad_port/empty_username: fix fields. IMAP auth/TLS/mailbox errors require account/mode/name correction. truncated:true is not a completed drain. attachments_complete:false requires recovery/quarantine before mark_seen; never discard silently.

Management errors normally use {error,message}. DTO resource.&lt;kind&gt;.* identifiers often occur in the message of 400 bad_request, not the top-level error; they are not a universal enum returned by every runtime helper. For 401 restore platform auth, 403 check effective project role/runtime rules, 404 check folder/name, 409 resolve duplicate identity or resource_in_use references. Distinguish upstream refusals from platform refusals and determine whether work might already have applied before retrying.

## Production pitfalls and cleanup

Persist work before Seen and deduplicate mailbox/message identity; concurrent readers can see the same mail. UIDs are mailbox/UIDVALIDITY-scoped. Fetch attachment bytes only when needed. Resource deletion does not delete mail or revoke the login.

General removal: disable callers, proxy/CRUD targets and related triggers, migrate dependencies and retain required evidence; then use `viat resource delete demo` or DELETE on the detail route. For 409 resource_in_use rebind/remove named endpoint holders first; do not bypass references. Removing an asset is not revoking third-party credentials, deleting external data or undoing prior side effects.

## Related resources and maintenance evidence

- [SMTP resource](smtp.md)
- [Managed storage resource](storage.md)
- [Resource overview](index.md)

Pinned contract: `contracts/1.1.0/resources.json` → `resource.imap`。

Reviewed implementation (product-repository-relative paths): viat-core/src/types/resource.rs (KindSpec/Plain/Secret); viat-api/src/dto.rs (normalization/validation); viat-api/src/handlers/resources.rs (CRUD/Test); viat-runtime/src/resource_io.rs, resources_json.rs, python.rs, typescript.rs; viat-api/src/runner/broker.rs; viat-cli/src/main.rs and repo/resources.rs; viat-core/src/types/snapshot.rs.
