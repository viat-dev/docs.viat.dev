---
title: "CMS: private drafts and published blog posts"
description: "A pushable single-newsroom CMS with PostgreSQL, reader/author/editor policy, version isolation and negative HTTP assertions."
doc_id: applications.cms
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# CMS: private drafts and published blog posts

The complete case lives at `examples/cms/`: a real `project/` checkout, preparation SQL, synthetic fixtures, bilingual README, offline `validate.py` and separately opted-in `acceptance.py`. YAML files use JSON syntax, a valid YAML subset. **Verification:** the offline validator passed; separate isolated real CLI/API/authz/PostgreSQL/worker acceptance passed twice, including after review fixes. `acceptance.py` itself was not invoked against a deployed customer server. See [verification status](../reference/validation.md) for evidence and remaining release boundaries. Stable server and CLI target: **1.1.0**.

This is one isolated newsroom, not a multi-tenant CMS, rich-text editor or arbitrary website generator. All business roles are non-admin. `cross_tenant:true` is intentional for this shared newsroom; it is not tenant isolation. The API is a small POST RPC rather than pretending arbitrary SQL is automatically protected by CRUD row scopes.

## What is implemented

| File / asset | Responsibility |
| --- | --- |
| `project/viat.yaml` | Complete intentional authorizers, roles and real authorization AST |
| `project/scripts/post_logic.py` | Shared pure validation, checked mutations and draft/public projections |
| `project/scripts/posts.py` | Trusted principal, `ctx.authz.check`, parameterized SQL and transactions |
| `project/resources/db.yaml` | Dedicated business PostgreSQL connection; `.invalid` hostname and labeled fixture credentials |
| `project/endpoints/default/posts.post.yaml` | Closed body contract, `cms-keys` admission, target `ref: posts` |
| `prepare.sql` | Table, grants and one synthetic unpublished `seed-post` |
| `fixtures/` | Registration bodies and input/expected results |
| `validate.py` / `acceptance.py` | Offline pure-unit layer / explicit live HTTP assertions |

Draft fields and published fields are separate columns. An editor's `publish` copies the current draft into the public columns in one transaction. Subsequent draft edits do not alter the published copy. `read` and `list` never return draft columns; `preview` is separately authorized. Ownership comes only from the authenticated principal at create and the persisted database row thereafter. Mutations lock that row until commit; read/preview use ordinary reads. There are no schedules or automatic sends in this case.

The `post` model permits:

| Role | Public read/list | Create own draft | Preview/edit own draft | Preview/edit another author's draft | Publish |
| --- | --- | --- | --- | --- | --- |
| reader | yes | no | no | no | no |
| author | yes | yes | yes | no | no |
| editor | yes | yes | yes | yes | yes |

Authors may edit their own draft even after publication; only an editor changes the public copy. The `owner` attribute compares to the verified `identity` subject. No matching permit means deny. This is script-side point enforcement: raw `db.query`/`execute` are **not** row-scoped automatically. Do not bind the resource to a second unreviewed script/CRUD endpoint. A SQL resource credential is still visible in the 1.1.0 worker projection; trust the script/dependency tree and never log it.

## Operator prerequisites and safety boundary

Use an activated isolated Viat 1.1.0 instance, matching CLI, an authenticated Owner/Admin (publish and metadata settings), server Python/uv, local Python 3, Bash, curl, jq, and a separately provisioned PostgreSQL service reachable from API nodes. No tools/services are installed by this case. Do not use Viat's platform database. SQL bootstrap below assumes an existing approved development container with PostgreSQL superuser `postgres`; adapt the connection transport, not the table/grant contract.

**Require a new project and a new business database.** Stop if `cms-example`, `cms_example`, `db` or these identities already belong to another exercise. To choose another project slug, change `project.slug`, the create/select commands and every `/p/` and `/projects/` URL together. Keep a private record of project slug, DB/container, endpoint UUID, authorizer/key UUIDs and user identities. API tokens and `.viat/` never go into source control.

`BASE` means the instance management API root, without a trailing slash. `PLATFORM_ACCESS_TOKEN` is an already obtained platform login token/PAT with appropriate scope, not an endpoint key. Authenticate the CLI separately using [CLI authentication](../cli/auth.md). Select and verify the exact server before each write.

## Apply (explicit remote-write opt-in)

From the documentation repository root, copy the case to a private working directory. Commands below remain operator instructions, not a claim that this sequence ran against your server.

```sh
set -euo pipefail
umask 077
CASE_DIR=$(mktemp -d "${TMPDIR:-/tmp}/viat-cms.XXXXXX")
cp -R examples/cms/. "$CASE_DIR/"
cd "$CASE_DIR"
mkdir records
python3 -I validate.py
```

This validation imports the actual deployed pure module; decision callbacks are stubs, not a fake claim that Viat's policy engine was exercised. It checks publication-copy isolation, denial handling, trusted ownership, malformed input and fixture/manifest/model structure. It does not connect anywhere.

1. Prepare only the new database. Set `PG_CONTAINER` to your approved **business** database container. These fixture passwords are for isolated local development only; for nonlocal use provision a real secret outside this checkout and enforce transport security independently. The resource `ssl` boolean does not enforce peer verification in 1.1.0.

```sh
export PG_CONTAINER=your-owned-business-postgres
# Stop on any name conflict. Do not add IF NOT EXISTS or reuse another database.
docker exec "$PG_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "CREATE ROLE cms_example LOGIN PASSWORD 'local-fixture-only-not-for-production';"
docker exec "$PG_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c 'CREATE DATABASE cms_example OWNER postgres;'
docker exec -i "$PG_CONTAINER" psql -U postgres -d cms_example -v ON_ERROR_STOP=1 < prepare.sql
```

2. In the copied `project/resources/db.yaml`, replace `plain.host`/port with the reachable approved database address. The fixture role/password must match the bootstrap above. Keep the credential in `secret`, never `plain`. For a real secret, provision resource `db` securely first and replace both file secret values with string `$secret` before filtered push. A placeholder cannot create a new resource.

```sh
viat project create cms-example "CMS isolated example"
viat project select cms-example
viat version
cd project
viat push --only meta,resources,scripts,endpoints
viat resource refresh db
cd ..
```

The metadata is **complete and intentional** for this new project, including the native `password` authorizer and `cms-keys`; other server-only authorizers can be pruned. Never perform this push against an existing project or use an unrestricted all-kind push. `push` neither runs `prepare.sql` nor publishes. Resource refresh rebuilds introspection after DDL; script SQL itself is not protected by introspection policies.

3. Register the four local **project end users**, not platform members. Creation bodies are the exact objects in `fixtures/users.json`; no passwords are needed for these API-key-only users. No registration switch is enabled.

```sh
# Export BASE and PLATFORM_ACCESS_TOKEN through your private shell/session first.
set -o pipefail
jq -c '.[]' fixtures/users.json | while IFS= read -r user; do
  curl --fail-with-body -sS "$BASE/projects/cms-example/users" \
    -H "Authorization: Bearer $PLATFORM_ACCESS_TOKEN" \
    -H 'Content-Type: application/json' -d "$user" -w '\n'
done > records/users.jsonl
viat apikey create cms-keys --user cms-reader --name cms-reader-test > records/reader.key
viat apikey create cms-keys --user cms-author-a --name cms-author-test > records/author.key
viat apikey create cms-keys --user cms-author-b --name cms-other-test > records/other.key
viat apikey create cms-keys --user cms-editor --name cms-editor-test > records/editor.key
viat apikey list cms-keys > records/key-rows.txt
```

Keys are one-time secrets on stdout; the list records **row UUIDs** for revoke, not the token's short key ID. Inspect each user response's assigned role and stop on any failed registration; do not continue a partially seeded setup.

4. Locate only this case's endpoint and record its actual UUID. Publish explicitly.

```sh
curl --fail-with-body -sS "$BASE/projects/cms-example/endpoints" \
  -H "Authorization: Bearer $PLATFORM_ACCESS_TOKEN" > records/endpoints.json
POSTS_ID=$(jq -er '[.[] | select(.path=="/posts" and .method=="POST")] | if length==1 then .[0].id else error("expected one posts leaf") end' records/endpoints.json)
printf '%s\n' "$POSTS_ID" > records/posts-id.txt
viat endpoint publish "$POSTS_ID"
```

Inspect the publish plan/response and authorizer list, then call the **published** URL, not a draft editor test. Ordinary script dependencies are frozen with this endpoint unless a dependency is marked `(live)`; this case uses no live marker. Authorization model/resource/user settings remain live independently of snapshots.

## API contract and assertions

`POST /p/cms-example/posts`, bearer key from `cms-keys`. Required `op`; optional `post_id`, `title`, `body` default to empty strings. Unknown fields (including forged `owner`, `role`, `is_admin`) are 400. `post_id` is a lowercase slug, 1–64 characters; title is nonblank, at most 160 characters; body nonblank, at most 20,000. `list` ignores unused declared fields and returns the first 100 published posts ordered by ID. There is no pagination beyond that bounded example. Each listed row keeps an object-aware authorization check: a later owner-dependent rule must not be bypassed by reusing one subject-only allow decision. This costs up to 100 authorization RPCs, and a denied row fails the list rather than silently filtering it. For larger datasets, design and verify a paginated scoped query; do not replace these checks with a blanket cached allow.

- `create`: requires ID/title/body; returns `{post_id,revision}`; duplicate ID → 409.
- `edit`: requires existing ID/title/body; changes only draft; returns `{post_id,revision}`.
- `publish`: existing ID; copies draft to public; returns `{post_id,revision}`.
- `read`: public `{post_id,title,body}` or 404 if absent/unpublished.
- `preview`: draft projection, permission checked first; unauthorized → 403.
- `list`: array of public projections; initially `[]` even though SQL seeded a draft.

All mutations use short database transactions and row locks. There is no optimistic revision precondition; two authorized editors serialize and the later edit wins. IDs are business uniqueness keys; after timeout inspect by ID/preview before retrying rather than assuming rollback. SQL/network failures still need operator investigation.

After explicitly approving remote writes to the new project/database, run the prepared live assertion program from `CASE_DIR`:

```sh
python3 -I acceptance.py --url "$BASE/p/cms-example/posts" \
  --reader-key-file records/reader.key --author-key-file records/author.key \
  --other-key-file records/other.key --editor-key-file records/editor.key \
  --allow-remote-writes
```

It creates **only `fixture-post`**, verifies unpublished reads 404, reader mutations 403, other-author preview/edit 403, author publish 403, anonymous access 401, strict forged fields 400, duplicate create 409, editor publish, and a later private draft that does not alter the public response. The expected bodies are in `fixtures/expected.json`. It leaves data for inspection; it is not safely rerunnable after success without deliberately cleaning the two recorded fixture IDs. The coordinator's separate isolated real-stack acceptance passed; **this `acceptance.py` program itself was not invoked against a deployed customer server**. Neither result establishes production recovery, load or customer-environment acceptance.

Inspect refusal and execution logs without printing tokens. A 403 is not fixed by turning the endpoint anonymous; a 404 may mean no public version; 409 duplicate requires examining the existing ID. Endpoint rollback does not roll back data, roles or model edits. This example omits deletion, media uploads, approvals, audit-retention policy and production pagination deliberately.

## Cleanup (owned names/IDs only)

Stop callers, then unpublish and delete only the recorded leaf; do not mirror an empty directory or blanket-delete a tree.

```sh
viat endpoint unpublish "$POSTS_ID"
viat endpoint delete "$POSTS_ID"
# For EACH of the four UUIDs in records/key-rows.txt, after checking its name:
viat apikey revoke cms-keys KEY_ROW_UUID
# Delete exactly these identities with platform auth; repeat for the other three.
curl --fail-with-body -sS -X DELETE "$BASE/projects/cms-example/users/cms-reader" \
  -H "Authorization: Bearer $PLATFORM_ACCESS_TOKEN"
```

The other three identities are `cms-author-a`, `cms-author-b`, `cms-editor`. With keys revoked and users removed, delete `cms-keys` and `password` only if this recorded new project still has no other dependents, using `DELETE /projects/cms-example/authorizers/{name}` with the platform bearer. Remove the recorded model rule IDs first (`GET /projects/cms-example/authz` → `rules[].id`, then `DELETE .../authz/rules/{id}`), then `DELETE .../authz/types/post`, then `.../authz/subject-attrs/identity` and `.../authz/subject-attrs/role`, then `DELETE .../roles/reader`, `.../roles/author`, `.../roles/editor`. Stop on dependency conflicts; never force-delete an unexpected dependent.

```sh
viat script delete posts
viat script delete post_logic
viat resource delete db
# Inspect these two owned rows before deleting; leave all other rows alone.
docker exec "$PG_CONTAINER" psql -U postgres -d cms_example -v ON_ERROR_STOP=1 \
  -c "SELECT post_id, owner FROM cms_posts WHERE post_id IN ('seed-post','fixture-post');"
docker exec "$PG_CONTAINER" psql -U postgres -d cms_example -v ON_ERROR_STOP=1 \
  -c "DELETE FROM cms_posts WHERE post_id IN ('seed-post','fixture-post');"
```

Retain the schema/database for inspection by default. Only after proving exclusive ownership and no additional rows/dependents may the database owner separately drop this case's table/database/role; that is not implied by resource deletion. Keep necessary evidence, then remove only the exact private `CASE_DIR` you recorded. **There is no registered project DELETE route or project-delete CLI in 1.1.0**; leave the empty isolated project. Token revocation, DB cleanup and local key-file removal are separate operations.

## Related contracts and evidence

[Repo sync](../projects/repo-sync.md), [authorization](../auth/authorization.md), [HTTP](../triggers/http.md), [CRUD alternative](../triggers/crud.md), [PostgreSQL](../assets/resources/postgresql.md). The explicit script checks are needed because this design does not use CRUD. Targeted implementation evidence: `crates/viat-cli/src/repo/{viat_yaml.rs,endpoints.rs}`, `crates/viat-api/src/{lib.rs,handlers/endpoints.rs}`, `crates/viat-runtime/src/{python.rs,annotations.rs}`. Source review is not integration acceptance.
