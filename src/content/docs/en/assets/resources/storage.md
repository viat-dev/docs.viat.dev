---
title: "Managed storage resource"
description: "Managed file bytes on local volume/S3 with metadata in a same-project PostgreSQL resource. IDs/keys, owners, policy and evidence are platform-managed. Unlike raw s3, it cannot use MySQL/SQLite/platform DB metadata."
doc_id: resource.storage
verified_release: '1.1.0'
channel: stable
contract_ids: [resource.storage]
---

# Managed storage resource

Managed file bytes on local volume/S3 with metadata in a same-project PostgreSQL resource. IDs/keys, owners, policy and evidence are platform-managed. Unlike raw s3, it cannot use MySQL/SQLite/platform DB metadata.

Verified against stable Viat 1.1.0. Examples use synthetic values/provider stubs; they were not executed, connected to live services or used to send messages. Start with the [resource overview](index.md).

## Prerequisites and permissions

Create metadata PostgreSQL first with create/reconcile table/index and row-write privileges. Local needs server-writable mounted directory under VIAT_STORAGE_ROOTS; S3 needs bucket/scoped credentials. Grant appropriate project file authorization rules; an owner value alone is not a grant.

## Complete configuration fields

Required describes structural parsing; conditional provider/backend requirements, runtime defaults and limitations follow below. Use null only where the type allows it. Numeric storage bounds do not imply every value is operationally valid. Do not rely on unknown-key dropping to detect typos.

### `plain`

| Field | Type / allowed values | Required | Omitted default | Constraints | Meaning |
| --- | --- | --- | --- | --- | --- |
| `plain.allowed_types` | array&lt;string&gt; | no; may be conditional | no explicit default; see rules | — | Permitted declared MIME types; [] means any, not content security scanning. |
| `plain.backend` | StorageBackend | yes | — | — | Managed file byte backend: local or s3; metadata is always project PostgreSQL. |
| `plain.bucket` | string / null | no; may be conditional | no explicit default; see rules | — | Existing bucket name only, not a URL/path. |
| `plain.endpoint` | string / null | no; may be conditional | no explicit default; see rules | — | Configured service endpoint; exact base-vs-operation and normalization rules depend on kind. |
| `plain.max_file_bytes` | integer | no; may be conditional | no explicit default; see rules | minimum: 0; format: "uint64"; 0–18446744073709551615 | Per-file ceiling; 0 uses deployment cap, resource can only lower it. |
| `plain.metadata` | StorageMetadata | yes | — | — | Project PostgreSQL resource/table holding managed file rows. |
| `plain.path_style` | boolean | no; may be conditional | no explicit default; see rules | — | Use endpoint/bucket/key rather than bucket.endpoint/key. |
| `plain.prefix` | string | no; may be conditional | no explicit default; see rules | — | Relative backend key prefix; include trailing / if desired. |
| `plain.region` | string / null | no; may be conditional | no explicit default; see rules | — | Signing/operation region; provider rules may require it. |
| `plain.root` | string / null | no; may be conditional | no explicit default; see rules | — | Server-side absolute local-storage directory under operator allow-listed roots. |

#### `StorageBackend`

Allowed shape/values: `"local" / "s3"`.

#### `StorageMetadata`

| Field | Type / allowed values | Required | Omitted default | Constraints | Meaning |
| --- | --- | --- | --- | --- | --- |
| `StorageMetadata.resource` | string | yes | — | — | Folder-aware resource reference; storage metadata must target postgresql. |
| `StorageMetadata.table` | string / null | no; may be conditional | `"viat_files"` | — | Audit trail or metadata table name; runtime defaults documented below. |

### `secret`

| Field | Type / allowed values | Required | Omitted default | Constraints | Meaning |
| --- | --- | --- | --- | --- | --- |
| `secret.access_key` | string | no; may be conditional | `""` | — | S3-compatible access-key identifier. |
| `secret.secret_key` | string | no; may be conditional | `""` | — | S3-compatible signing secret. |
| `secret.session_token` | string / null | no; may be conditional | `null` | — | Optional temporary STS token; rotate before expiry, no automatic refresh. |

## Runtime rules, defaults and limits

backend required: local or s3. local requires absolute root in VIAT_STORAGE_ROOTS without parent traversal; normalization clears S3 fields/credentials. s3 requires bucket/region/access_key/secret_key and clears root. endpoint normalized like s3, path_style false; session_token optional, no renewal. prefix defaults empty, relative without .. or backslash; include trailing / for directory-style prefix because keys concatenate. metadata.resource required, folder-resolved; metadata.table defaults viat_files, a simple SQL identifier. Save actually installs/reconciles metadata DDL.

max_file_bytes defaults 0 = deployment VIAT_STORAGE_MAX_FILE_BYTES (default 100 MiB); a resource may lower, never raise it. allowed_types [] accepts any; entries trimmed/lowercased and check declared MIME, not malware. Save ensures file authz/metadata audit integration. Failed reconciliation rolls back the declaration; treat external DDL/evidence as real side effects.

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
  "kind": "storage",
  "plain": {
    "backend": "s3",
    "bucket": "demo-files",
    "region": "us-east-1",
    "endpoint": "https://s3-stub.example.test",
    "path_style": true,
    "prefix": "reference/",
    "metadata": {
      "resource": "metadata_db",
      "table": "viat_files"
    },
    "max_file_bytes": 1048576,
    "allowed_types": [
      "text/plain"
    ]
  },
  "secret": {
    "access_key": "fixture-access",
    "secret_key": "fixture-secret-not-a-credential"
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

Python store(pathOrUpload,key?,name?,content_type?,owner?,meta?) → row {id,key,name,size,content_type,sha256,…}; replace(id,pathOrUpload,…) preserves id/key; register(path,…) local-only for bytes already under root/prefix. TypeScript uses options objects. get(id), find(key), list/list_page (TS listPage) → files/{files,next_cursor}; pass cursor as before. delete(id) soft-deletes metadata and removes bytes. download(id,dest_path) streams; read_range(id,start,length) (TS readRange) → bytes capped by VIAT_S3_HELPER_MAX_BYTES (default 8 MiB). url(id,expires_secs=300,disposition?) (TS options) mints platform bearer download link, max 7 days; presign(id,expires_secs=900) is S3-only bucket-direct GET → {url,expires_at}. Read policy is checked at minting; links are capabilities until expiry. ctx.request.files upload handles can go directly to store. No backend path is exposed.

Both complete scripts declare the same root resource demo. Use only an approved fixture run. Writes, sends, builds and deletion are not dry-run.

### Python

```python
# @resource demo
from viat import ctx

def main():
    return ctx.resources.demo.list_page(limit=5)
```

### TypeScript

```typescript
// @resource demo
import { ctx } from "viat";

export async function main() {
  return await ctx.resources.demo.listPage({ limit: 5 });
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
        ctx.resource("demo").call("storage", json!({"op":"list","limit":5}))
    });
}
```

Shell has JSON environment projection, not method-decorated ctx.resources; these methods are not shell functions. Binary programs can implement corresponding worker-protocol RPC, not automatically Python/TypeScript methods. The sql lane supports the four SQL kinds; viat_gql only PostgreSQL/MySQL/SQLite; graphql targets remote graphql; llm targets llm. Unsupported lane/kind combinations are not automatically adapted.

### Expected result

Create metadata_db as same-project postgresql and authorize file reads first. With no managed rows list-page returns {files:[],next_cursor:null}; no upload occurs. store would copy bytes and write metadata/audit.

## Test behavior and side effects

Local writes/removes an empty .viat-probe-* file (cleanup best-effort). S3 sends signed ListObjectsV2 max-keys=1. Save also contacts metadata PostgreSQL and creates/reconciles table/index/audit structures: neither is schema-only dry-run.

Management API: `POST /projects/{slug}/resources/{name}/test?folder=`; CLI: `viat resource test demo`. Inspect body ok: connection failures normally still return HTTP 200 `{ok:false,error:"…"}`, possibly with schema_warnings. Status alone is insufficient; CLI exits nonzero on failure. Run only after approving network/filesystem effects.

## Common failures and recovery

resource.storage.root_not_allowed/empty_root: fix mounted allowed root; bad_prefix/bad_table: fix names; empty_metadata_resource: name PostgreSQL; missing_credentials/empty_bucket/empty_region: complete S3. Forbidden needs file rules or DB/bucket grants. Size/type rejection needs allowed input, not bypassing metadata.

Management errors normally use {error,message}. DTO resource.&lt;kind&gt;.* identifiers often occur in the message of 400 bad_request, not the top-level error; they are not a universal enum returned by every runtime helper. For 401 restore platform auth, 403 check effective project role/runtime rules, 404 check folder/name, 409 resolve duplicate identity or resource_in_use references. Distinguish upstream refusals from platform refusals and determine whether work might already have applied before retrying.

## Production pitfalls and cleanup

Back up metadata/bytes together and reconcile orphans. Local roots are node-local unless properly shared; never overlap SQLite roots. Keep signed links out of public logs. Resource deletion preserves table/bytes as evidence and removes naming rules; delete external bytes only after a retention decision.

General removal: disable callers, proxy/CRUD targets and related triggers, migrate dependencies and retain required evidence; then use `viat resource delete demo` or DELETE on the detail route. For 409 resource_in_use rebind/remove named endpoint holders first; do not bypass references. Removing an asset is not revoking third-party credentials, deleting external data or undoing prior side effects.

## Related resources and maintenance evidence

- [S3 resource](s3.md)
- [PostgreSQL resource](postgresql.md)
- [SQLite resource](sqlite.md)
- [Resource overview](index.md)

Pinned contract: `contracts/1.1.0/resources.json` → `resource.storage`。

Reviewed implementation (product-repository-relative paths): viat-core/src/types/resource.rs (KindSpec/Plain/Secret); viat-api/src/dto.rs (normalization/validation); viat-api/src/handlers/resources.rs (CRUD/Test); viat-runtime/src/resource_io.rs, resources_json.rs, python.rs, typescript.rs; viat-api/src/runner/broker.rs; viat-cli/src/main.rs and repo/resources.rs; viat-core/src/types/snapshot.rs.
