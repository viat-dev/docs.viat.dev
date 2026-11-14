---
title: "Full authorizer credential replacement (preview)"
description: "Atomically replace imported configuration and credentials, distinguishing absent secrets from undisclosed secrets."
doc_id: operations.authorizer-credentials-preview
verified_release: 'unreleased'
channel: preview
contract_ids: []
---

This unreleased follow-up to [migration reliability](migration-reliability-preview.md) is not a shipped 1.3.0 capability. It requires a destination server and CLI containing this fix. The stable reference and contract pin remain unchanged.

## Why ordinary editing is different

Ordinary `PUT /projects/{slug}/authorizers/{name}` is a form-edit endpoint: blank or `null` secrets retain existing values, and social credentials merge by field. That behavior remains unchanged. Sending source configuration and credentials to that endpoint does not mean full replacement; destination-only optional AES credentials can survive.

Import overwrite now uses a separate `PUT /projects/{slug}/authorizers/{name}/credentials`. Configuration and the entire secret blob change in one database statement; optional credentials absent from the source are not inherited from the destination. The destination blob is not read or decrypted, so even an unreadable old blob can be replaced by a complete valid source. Object ID, name, kind, and dependent references remain intact, and relevant authorizer caches are invalidated afterward.

## Request and permissions

The caller must hold the project's `owner`, `admin`, or `developer` membership role. The object must exist and have kind `oauth_oidc` or `social`. This is a management API, not a public route under `/p/:slug/`.

| Field | Rules |
| --- | --- |
| `config` | Required explicit complete JSON object, validated by the kind's existing configuration rules; omission or `null` is rejected |
| `secret` | Required explicit object or `null`; omission is rejected, not KEEP |
| `default_role` | Omission or `null` retains the current database value; `""` clears it; a nonempty string must name a role in this project |

Unknown top-level fields are rejected. OIDC secrets accept only `client_secret`, which must be a usable nonblank string. Social secrets accept only `app_secret`, `app_private_key`, and `aes_key`; the latter two allow `null`, and other value types are rejected. Self-managed social configuration still requires its provider's app secret or RSA private key. Delegated configuration still requires a valid `platform_app` binding, and Alipay mini-programs with `collect_phone` enabled still require their own AES key. Nonblank private keys and AES keys are format-validated, including AES keys supplied while phone collection is off. `client_secret` and `app_secret` are limited to 1024 bytes, and nonblank RSA private keys to 8192 bytes.

`secret: null` can clear the entire old blob only when the source configuration legitimately needs no credentials of its own; it does not bypass required secrets. Missing, null, or blank optional fields do not inherit destination values. Provider storage rules still apply: for example, delegated configuration retains only the AES credentials it is allowed to hold, rather than treating other credentials as a self-managed identity.

Success returns `200` with a redacted authorizer object, not the encrypted blob or plaintext secrets. Failed permission, project-scope, configuration, required-secret, or role validation performs no replacement. Unknown fields and invalid credential types/formats produce validation errors without echoing credential values. This endpoint cannot read secrets.

## How import proves the source has no secret

A `--with-secrets` export distinguishes these cases inside the encrypted envelope's `authorizers` map:

- Object: the source holds the exported credentials.
- Explicit `null`: the source database row's `encrypted_secret` is actually NULL.
- Missing entry: no disclosure evidence, possibly because of an older exporter or export scope; absence cannot be inferred.

Markers are written only for in-scope OIDC/social authorizers, remain inside the sealed payload, and do not count toward actual secret disclosure totals or name lists. Empty/corrupt blobs are not absence and must fail export. Even successfully decrypted non-NULL authorizer blobs must contain a JSON object: encrypted JSON `null`, arrays, or scalars are not absence evidence and cannot become markers authorizing destination clearing. The envelope remains v1; explicit-null markers require the updated CLI. Older CLIs cannot perform this replacement.

`--update-authorizers` still defaults to off. With it enabled, overwriting an existing OIDC/social authorizer requires complete source configuration and an object or explicit-null credential snapshot. Missing snapshots skip that authorizer and prevent the same invocation's `--publish`. Equal visible configuration does not skip full replacement. A new delegated authorizer that legitimately has no credentials can still be created without an envelope because there are no old destination credentials to retain.

If an older destination server does not support the new route, import fails and **never falls back to ordinary merging PUT**. Upgrade the destination and retry rather than removing the guard. Other assets may already have imported: this is atomic replacement of one authorizer's configuration and credentials, not a whole-project or external-provider transaction.

## Isolated verification and recovery

In an isolated destination, prepare a test authorizer holding optional AES credentials, then import a bundle containing an explicit source snapshot without AES/without secrets. Check default preservation and explicit overwrite separately. Unchanged public GET configuration is not evidence that credentials stayed unchanged; use a test identity provider or isolated login flow without printing secrets.

Also verify missing snapshots report skipped and block publication, old servers receive no fallback PUT, invalid source credentials leave the target unchanged, and role omission differs from explicit clearing. Regression tests use local HTTP stubs and isolated databases, not real identity providers.

After failure, correct the source configuration, credentials, or destination version and retry. Restoration requires a securely retained complete prior configuration/credential snapshot and another full replacement; this endpoint does not retain old credentials for automatic rollback. Store bundles and one-time keys separately, pass import keys through stdin rather than arguments, logs, or repositories, and remove unneeded copies after verification.

This capability is used by bundle CLI and management API. Ordinary Console forms and repository `push` keep their semantics; no separate CLI authorizer subcommand or MCP tool is added.
