---
title: "Cryptographic key resource"
description: "Platform-held aes/hmac/rsa/ecdsa_p256/ed25519/sm2/sm4 key operations. Algorithm selects the key type; partner-protocol modes are call arguments. Private material stays out of scripts. Not a CA, key issuer or universal HSM."
doc_id: resource.crypto_key
verified_release: '1.1.0'
channel: stable
contract_ids: [resource.crypto_key]
---

# Cryptographic key resource

Platform-held aes/hmac/rsa/ecdsa_p256/ed25519/sm2/sm4 key operations. Algorithm selects the key type; partner-protocol modes are call arguments. Private material stays out of scripts. Not a CA, key issuer or universal HSM.

Verified against stable Viat 1.1.0. Examples use synthetic values/provider stubs; they were not executed, connected to live services or used to send messages. Start with the [resource overview](index.md).

## Prerequisites and permissions

Obtain authorized material through your own key-management process and match the partner protocol. Save parses real material, so placeholder PEM cannot validate. The example is a harmless HMAC fixture, not a vendor signing key.

## Complete configuration fields

Required describes structural parsing; conditional provider/backend requirements, runtime defaults and limitations follow below. Use null only where the type allows it. Numeric storage bounds do not imply every value is operationally valid. Do not rely on unknown-key dropping to detect typos.

### `plain`

| Field | Type / allowed values | Required | Omitted default | Constraints | Meaning |
| --- | --- | --- | --- | --- | --- |
| `plain.algorithm` | CryptoAlgorithm | yes | — | — | Cryptographic key type; operation modes are separate call arguments. |
| `plain.key_encoding` | KeyEncoding | no; may be conditional | `"auto"` | — | Non-PEM key decoding; auto is algorithm-specific. |
| `plain.key_id` | string / null | no; may be conditional | `null` | — | Crypto envelope/JWT key label, or APNs signing-key identifier for push. |
| `plain.public_key` | string / null | no; may be conditional | `null` | — | Public asymmetric key, exportable; derived if only private material is supplied. |

#### `CryptoAlgorithm`

Allowed shape/values: `"aes" / "hmac" / "rsa" / "ecdsa_p256" / "ed25519" / "sm2" / "sm4"`.

#### `KeyEncoding`

Allowed shape/values: `"auto" / "base64" / "hex" / "utf8"`.

### `secret`

| Field | Type / allowed values | Required | Omitted default | Constraints | Meaning |
| --- | --- | --- | --- | --- | --- |
| `secret.key` | string | no; may be conditional | `""` | — | Symmetric key material for aes/hmac/sm4, encoded per key_encoding. |
| `secret.previous_key` | string | no; may be conditional | `""` | — | Rotation slot for AES sealed tokens/HMAC verification only. |
| `secret.private_key` | string | no; may be conditional | `""` | — | Asymmetric private material; absent allows supported public-only operations. |

## Runtime rules, defaults and limits

algorithm required. key_encoding defaults auto: hmac→utf8, aes/sm4→base64, raw asymmetric→hex; PEM BEGIN headers always recognized. aes/hmac/sm4 use secret.key: AES decoded length 16/24/32 bytes, SM4 16, HMAC nonempty. Asymmetric types use private_key or public_key; public-only can verify/encrypt where supported, never sign/decrypt. RSA parser accepts at least 1024 bits (use at least 2048 for new production keys; the older schema comment claiming a 2048-bit enforced minimum is inaccurate), ECDSA P-256, Ed25519/SM2 matching material. Save trims key strings and parses compatibility. key_id overrides the default first eight hex SHA-256 characters.

previous_key is only for AES sealed-envelope opening and HMAC verification during rotation, not raw AES mode key selection; SM4 refuses it. Symmetric resources must not include unrelated asymmetric material. Plan ciphertext/signature compatibility before retiring a key. PEM private keys support their algorithm’s accepted PKCS#8/PKCS#1/SEC1 encodings; SM2 raw scalar/point can use hex.

Decoded input is capped at 1 MiB per crypto call. key_id cannot contain a dot or whitespace. Cipher arguments data/encoding/output are string and utf8/base64/hex; encrypt input defaults utf8, decrypt input base64. AES raw gcm/cbc/ecb return ciphertext/IV data; use the same iv/aad (and iv_encoding/aad_encoding, default utf8 for AAD) to decrypt. RSA cipher hash is sha256 (default) or sha1, mgf1_hash can differ; padding oaep/default or pkcs1v15; chunked defaults false. SM2 layout is c1c3c2/default, c1c2c3 or asn1. Signature hash defaults sha256 (RSA/HMAC); RSA supports sha1/sha384/sha512 and legacy md5, HMAC excludes md5. RSA sign padding pkcs1v15/default or pss. ECDSA/SM2 sign format der/default or raw, verify detects 64-byte raw if omitted. SM2 uid defaults 1234567812345678. Do not pick legacy MD5/SHA-1/ECB for new designs.

JWT: jwt_sign(claims,algorithm=None,headers=None,expires_in=None) / jwtSign(claims,opts) defaults HS256/RS256/ES256/EdDSA by supported key; expires_in adds exp and missing iat, alg/kid are platform-set. jwt_verify(token,algorithm=None,audience=None,issuer=None,leeway=None) / jwtVerify(token,opts) returns {claims,header}; exp is checked when present, audience/issuer only when supplied, leeway defaults 60 seconds. Set intended audience/issuer explicitly and require expiry in your application contract. export_public_key returns {public_key,algorithm,key_id}; default PEM, RSA pkcs1 or EC/Ed/SM2 hex/base64 as supported. generate_data_key(bytes=32) accepts 16/24/32 and returns {plaintext_key,wrapped_key}.

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
  "kind": "crypto_key",
  "plain": {
    "algorithm": "hmac",
    "key_encoding": "utf8",
    "key_id": "fixture-hmac"
  },
  "secret": {
    "key": "documentation-fixture-key-not-for-production"
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

Python sign/verify/encrypt/decrypt, jwt_sign/jwt_verify, export_public_key, generate_data_key; TypeScript sign/verify/encrypt/decrypt, jwtSign/jwtVerify, exportPublicKey, generateDataKey. Strings default UTF-8 unless encoding base64/hex; bytes auto-encode. Signature/ciphertext defaults base64, decrypted text UTF-8; output="bytes" (TS option) returns bytes. verify returns bool. Per-call options include hash/padding/mode/iv/aad/format/layout/uid when applicable: RSA signing defaults PKCS#1 v1.5, encryption OAEP; ECDSA is P-256/SHA-256; SM2 uses SM3 and C1C3C2 default ciphertext; SM4 defaults CBC. AES without a raw mode uses randomized authenticated sealed tokens. CBC/ECB are interoperability modes, not recommended new formats. generate_data_key deliberately returns plaintext data-key material plus a wrapped version: protect that result.

Both complete scripts declare the same root resource demo. Use only an approved fixture run. Writes, sends, builds and deletion are not dry-run.

### Python

```python
# @resource demo
from viat import ctx

def main():
    signature = ctx.resources.demo.sign("fixture payload")
    return {"valid": ctx.resources.demo.verify("fixture payload", signature)}
```

### TypeScript

```typescript
// @resource demo
import { ctx } from "viat";

export async function main() {
  const signature = await ctx.resources.demo.sign("fixture payload");
  return { valid: await ctx.resources.demo.verify("fixture payload", signature) };
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
        ctx.resource("demo").call("crypto", json!({"op":"sign","data":"fixture payload"}))
    });
}
```

Shell has JSON environment projection, not method-decorated ctx.resources; these methods are not shell functions. Binary programs can implement corresponding worker-protocol RPC, not automatically Python/TypeScript methods. The sql lane supports the four SQL kinds; viat_gql only PostgreSQL/MySQL/SQLite; graphql targets remote graphql; llm targets llm. Unsupported lane/kind combinations are not automatically adapted.

### Expected result

HMAC sign→verify returns {valid:true}, with no network/provider call.

## Test behavior and side effects

Parses and self-tests sign→verify/seal→open where possible; public-only proves parseability only. No external activation/signing service.

Management API: `POST /projects/{slug}/resources/{name}/test?folder=`; CLI: `viat resource test demo`. Inspect body ok: connection failures normally still return HTTP 200 `{ok:false,error:"…"}`, possibly with schema_warnings. Status alone is insufficient; CLI exits nonzero on failure. Run only after approving network/filesystem effects.

## Common failures and recovery

resource.crypto_key.&lt;code&gt; includes the material/operation reason: fix encoding, size, PEM or incompatible fields. Public-only cannot sign/decrypt. Invalid signatures may return false; authenticated-decrypt failure is tampering/wrong key/format, not grounds to disable authentication.

Management errors normally use {error,message}. DTO resource.&lt;kind&gt;.* identifiers often occur in the message of 400 bad_request, not the top-level error; they are not a universal enum returned by every runtime helper. For 401 restore platform auth, 403 check effective project role/runtime rules, 404 check folder/name, 409 resolve duplicate identity or resource_in_use references. Distinguish upstream refusals from platform refusals and determine whether work might already have applied before retrying.

## Production pitfalls and cleanup

Never reuse IV/nonce where the chosen protocol requires uniqueness; agree encoding and SM2 UID. Back up keys securely outside Git and retain old material for validation. Resource deletion can make retained ciphertext unreadable; it is not reversible cleanup.

General removal: disable callers, proxy/CRUD targets and related triggers, migrate dependencies and retain required evidence; then use `viat resource delete demo` or DELETE on the detail route. For 409 resource_in_use rebind/remove named endpoint holders first; do not bypass references. Removing an asset is not revoking third-party credentials, deleting external data or undoing prior side effects.

## Related resources and maintenance evidence

- [Secret resource](secret.md)
- [Config resource](config.md)
- [Resource overview](index.md)

Pinned contract: `contracts/1.1.0/resources.json` → `resource.crypto_key`。

Reviewed implementation (product-repository-relative paths): viat-core/src/types/resource.rs (KindSpec/Plain/Secret); viat-api/src/dto.rs (normalization/validation); viat-api/src/handlers/resources.rs (CRUD/Test); viat-runtime/src/resource_io.rs, resources_json.rs, python.rs, typescript.rs; viat-api/src/runner/broker.rs; viat-cli/src/main.rs and repo/resources.rs; viat-core/src/types/snapshot.rs.
