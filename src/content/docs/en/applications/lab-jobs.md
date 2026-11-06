---
title: "Lab jobs: durable submission through an HTTP adapter"
description: "A pushable job registry with workflow/scheduler submission, authenticated callbacks and polling, duplicate handling and separate external cancellation."
doc_id: applications.lab-jobs
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# Lab jobs: durable submission through an HTTP adapter

`examples/lab-jobs/` contains a complete pushable `project/`, SQL, fixtures, bilingual README, offline unit checks, an opt-in local synthetic adapter and separate HTTP acceptance. **The offline validator passed**, along with all eight application validators. Actual adapter/workflow/callback/provider integration remains unverified; the separate HTTP acceptance program has not been run. See [verification status](../reference/validation.md). Target server/CLI: stable **1.1.0**. YAML files use JSON syntax, a valid YAML subset.

This is an application-owned job registry, **not a native Slurm integration**. Your approved generic HTTP adapter owns the actual scheduler/provider mapping. The bundled adapter starts **no real processes/jobs**, sends no callbacks and persists only synthetic state in SQLite. Viat workflows are bounded orchestration, not durable external-job engines. The application database holds the durable `job_id` and job state; a Viat `run_id` is a different identifier.

**Cancelling a Viat run does not cancel an external job.** External cancel is a separate authenticated application operation against the adapter. The Widget is a platform overview, not an arbitrary job-status UI. Use this application's `read` API or build an appropriately authorized application UI; do not promise per-job Widget tiles.

## Deployed files and policy

| Asset | Responsibility |
| --- | --- |
| `project/scripts/job_logic.py` | Shared pure ID/payload/event validation and monotonic state reducer |
| `project/scripts/jobs.py` | Real `ctx.authz.require`, durable SQL transactions and brokered HTTP |
| `project/workflows/submit_job.yaml` | Calls script `jobs`, returns `{job: ...}`, defaults `opt_in:false` |
| `project/schedules/submit-fixture.yaml` | Disabled hourly workflow submission; target uses `name` |
| `project/schedules/poll-fixture.yaml` | Disabled hourly polling; target uses `name` |
| `project/endpoints/default/{jobs,callback,submission}.post.yaml` | Script/script/workflow endpoints; targets use `ref` |
| `project/resources/{db,adapter}.yaml` | Business PostgreSQL + fixed-origin bearer-auth HTTP resource |
| `project/viat.yaml` | Complete intentional roles/authorizers/real authorization model |
| `prepare.sql`, `fixtures/`, `validate.py`, `acceptance.py`, `adapter.py` | Bootstrap, synthetic data, unit layer, opt-in acceptance and local provider stub |

Both `lab-operator` and `adapter` are **non-admin business roles**. `lab-operator` can submit/read/poll/cancel any job in this single shared lab. `adapter` can only submit events, admitted through `callback-keys`. `lab-keys` admits operators. Built-in `system:scheduler` may submit/read/poll, not cancel or forge callbacks. This is not per-owner/multi-tenant isolation; `cross_tenant:true` deliberately shares one lab registry. Body fields cannot grant a role.

## Adapter contract and durable behavior

Every provider operation is authenticated by the platform's `adapter` resource, never by extracting secrets in a script. Provision the callback credential separately: Viat's API key for `callback-keys` belongs to project user `lab-adapter-user`, and is **not** the adapter's upstream bearer credential.

| Request | Required behavior / result |
| --- | --- |
| `POST /jobs {job_id,payload}` | Durably idempotent by `job_id`; repeated identical payload returns the same external job; different payload conflicts, never submits twice |
| `GET /jobs/{job_id}` | Return current event; unknown ID 404, not fabricated success |
| `POST /jobs/{job_id}/cancel {}` | Explicit external-cancel request; returns observed state, not an unconditional “cancelled” promise |
| Event body | Exactly `{job_id,state,seq}`; state `queued|running|succeeded|failed|cancelled`; integer seq 0..2^63−1, monotonically increasing per job |
| Callback to Viat | `POST /p/lab-jobs-example/callback` with separate callback bearer and `{op:"event",job_id,event:{...}}` |

Payload is deliberately bounded to `{"task":"synthetic"}` or `{"task":"analysis"}`; no shell commands or caller-selected URLs. A real adapter must map the allowlisted `analysis` task to an approved template, not execute user text. The bundled adapter only simulates **both** labels. An accepted event must match the already-recorded ID. The provider's external identity is this same durable ID, not a fresh ID per retry.

Submission first commits a `prepared` row and immutable canonical payload, **then** sends POST outside the transaction. Two simultaneous submissions may both send the same ID: durable provider idempotency is mandatory. A lost response/crash can leave `prepared` even after real acceptance. Retry **the same ID and payload**, or poll if the provider knows it; never allocate another ID because a Viat request timed out. A changed local payload conflicts with 400; the upstream protocol uses 409. Jobs and provider idempotency records must outlive retries—do not reuse cleaned IDs for unrelated real work.

Callbacks and polls lock the same row and share `reduce_event`: seq ≤ stored seq → `stale`; any new event after a terminal outcome → `terminal`; running → queued → `regression`; otherwise apply and advance seq. Rejected events do not modify state/seq. Completion may skip intermediate states. `cancel_requested` records intent; only a confirmed event changes state to `cancelled`. Terminal outcomes never change, even if a later event claims otherwise; provider contradictions require manual incident review, not automatic resurrection. Unknown callback ID is 404. No database transaction is held while waiting for the adapter.

## Prerequisites and preparation

Use an activated isolated server and matching CLI 1.1.0, Owner/Admin platform access, server Python/uv, local Python 3 standard library, Bash, jq, curl, and a separate business PostgreSQL. Existing approved PostgreSQL development container with superuser `postgres` is assumed below; nothing here installs or starts it. The new project `lab-jobs-example`, database/role `lab_jobs_example`, resource names `db`/`adapter`, schedule names and user identities must be unused. Stop on collision. Changing slug requires changing metadata and all commands/URLs together.

`BASE` is the management API root without trailing slash. Export an existing appropriately scoped `PLATFORM_ACCESS_TOKEN` privately and authenticate the CLI separately ([authentication](../cli/auth.md)). Record instance, project slug, DB/container, all endpoint UUIDs, key row UUIDs, schedule names and private local paths. Never commit `.viat/`, actual provider tokens or key files. The upstream resource uses a `.invalid` hostname, a clearly labeled fixture token, and both schedules are **disabled with `opt_in:false`**. Only explicit operator approval may change these barriers.

```sh
# From the documentation repository root:
set -euo pipefail
umask 077
CASE_DIR=$(mktemp -d "${TMPDIR:-/tmp}/viat-lab-jobs.XXXXXX")
cp -R examples/lab-jobs/. "$CASE_DIR/"
cd "$CASE_DIR"
mkdir records
python3 -I validate.py
```

Unit checks load the deployed reducer and actual script entry point. An explicitly labeled fake `viat` module supplies only a decision stub and a resource trap for default no-I/O paths. These checks are **not** Viat policy, database, workflow, scheduler, transport or provider integration acceptance. The offline checks passed; that result does not execute the separate HTTP acceptance program.

## Apply (explicitly approve DB and control-plane writes)

1. Bootstrap a **new business database**, not Viat's platform database. Do not make name conflicts silently succeed.

```sh
export PG_CONTAINER=your-owned-business-postgres
docker exec "$PG_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "CREATE ROLE lab_jobs_example LOGIN PASSWORD 'local-fixture-only-not-for-production';"
docker exec "$PG_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c 'CREATE DATABASE lab_jobs_example OWNER postgres;'
docker exec -i "$PG_CONTAINER" psql -U postgres -d lab_jobs_example -v ON_ERROR_STOP=1 < prepare.sql
```

There are no fake “submitted” seed rows. The first explicitly opted-in submission inserts the durable row. Configure the copied `project/resources/db.yaml` host/port for a reachable approved address. The shipped SQL password is a local-only fixture. For real credentials, securely provision `db` first and use string `$secret` placeholders in both file secret fields. A new resource cannot be initialized from a missing secret. Do not rely on 1.1.0's PostgreSQL `ssl` field to enforce TLS/peer verification; verify transport separately. Trust the script tree: this release's SQL worker projection can still contain a credential-bearing connection URL.

2. Provision only the **local synthetic adapter** if approved. In another terminal, from the same copied case directory:

```sh
# records must be private and adapter.sqlite must be a NEW owned fixture path.
python3 -I adapter.py --db records/adapter.sqlite --token-file fixtures/adapter-token.txt
```

It listens on **127.0.0.1:8099** only and remains foreground until interrupted. It does not submit real work or send callbacks. Set the copied `project/resources/adapter.yaml` `plain.base_url` to `http://127.0.0.1:8099` **only when the API process shares this loopback network**. Otherwise use an explicitly approved development transport/reverse proxy to this loopback server and configure that reachable fixed origin. Container loopback is not host loopback. The deployment outbound guard must explicitly allow the approved fixture destination; never disable the global guard to get around a refusal. Resource secret token must match `fixtures/adapter-token.txt`; it is only a synthetic local fixture credential. Any nonlocal exposure needs separately reviewed TLS/auth/network deployment, not a public-bind flag.

For real use, replace this resource with a separately approved adapter implementing the complete contract and securely provision its secret; **do not run the synthetic acceptance program against real jobs**. Real-provider acceptance remains a separate unverified task.

3. Create the isolated project and push only the named kinds.

```sh
viat project create lab-jobs-example "Lab jobs isolated example"
viat project select lab-jobs-example
viat version
cd project
viat push --only meta,resources,scripts,workflows,schedules,endpoints
viat resource refresh db
cd ..
```

Metadata intentionally manages `password`, `lab-keys`, `callback-keys`, roles and policy. Omitted authorizers can be pruned; **new isolated project only**. Do not use an unrestricted push or mirror an incomplete checkout. Push does not run SQL or publish. Schedule creation is live, not snapshot-gated; keep both `enabled:false` and `inputs.opt_in:false`.

4. Register project identities, then issue separate keys. No passwords or open registration are needed.

```sh
set -o pipefail
jq -c '.[]' fixtures/users.json | while IFS= read -r user; do
  curl --fail-with-body -sS "$BASE/projects/lab-jobs-example/users" \
    -H "Authorization: Bearer $PLATFORM_ACCESS_TOKEN" \
    -H 'Content-Type: application/json' -d "$user" -w '\n'
done > records/users.jsonl
viat apikey create lab-keys --user lab-operator-user --name lab-operator-test > records/operator.key
viat apikey create callback-keys --user lab-adapter-user --name lab-callback-test > records/callback.key
viat apikey list lab-keys > records/operator-key-rows.txt
viat apikey list callback-keys > records/callback-key-rows.txt
```

Check the two roles in registration responses. Store one-time keys privately; revoke uses the row UUID from list, not the short key ID. A production adapter stores the callback key in its own secret backend, never in a callback body or this repository.

5. Record and publish **only** the three case leaves. The management list returns an array.

```sh
curl --fail-with-body -sS "$BASE/projects/lab-jobs-example/endpoints" \
  -H "Authorization: Bearer $PLATFORM_ACCESS_TOKEN" > records/endpoints.json
for path in /jobs /callback /submission; do
  id=$(jq -er --arg path "$path" '[.[] | select(.path==$path and .method=="POST")] | if length==1 then .[0].id else error("expected one case leaf") end' records/endpoints.json)
  printf '%s %s\n' "$path" "$id" >> records/published-leaves.txt
  viat endpoint publish "$id"
done
```

Inspect publish responses and authorizer lists. Ordinary script endpoint dependencies freeze unless `(live)`; **workflow step `uses:` modules remain live in 1.1.0**, even with published workflow step main sources. Review any reducer edit as a live workflow change. Resource/model settings also remain live.

## API, acceptance and scheduler opt-in

All three routes are POST with closed body contracts; unknown fields are 400. IDs are lowercase slugs, 1–64 characters. `/jobs` requires `op` and `job_id`, optional `payload:{}`, `event:{}`, `opt_in:false`. Operations: `submit`, `read`, `poll`, `event`, `cancel`. The script's real policy check happens before any dry-run response. `/callback` uses the same script contract but only admits `callback-keys`; adapter role may only `event`. `/submission` binds workflow `submit_job`, requires `job_id`, defaults payload to `{"task":"synthetic"}` and `opt_in:false`, and wraps the result in `{job:...}`.

- Default submit/poll/cancel returns `{dry_run:true,job_id,op}` without DB/HTTP access.
- Opted-in submit/poll/cancel and callbacks return `{job_id,state,event_seq,cancel_requested}`, sometimes with reducer `decision`.
- `read` only reads the database and never contacts a provider; unknown ID → 404.
- `submit` with `opt_in:true` persists then posts. `poll` with true authenticates to the adapter and reduces its current event.
- `cancel` with true records intent and sends an external cancel. A still-`prepared` record is 409: reconcile the same submission first. A terminal row is returned without another external cancel.

After explicitly approving local synthetic adapter traffic and DB writes, run from `CASE_DIR`:

```sh
python3 -I acceptance.py --base "$BASE/p/lab-jobs-example" \
  --operator-key-file records/operator.key --callback-key-file records/callback.key \
  --allow-synthetic-adapter-io
```

This uses the workflow endpoint, then tests duplicate submission, changed-payload rejection, wrong-authorizer 403, anonymous callback 401, authenticated callback transitions, duplicate/out-of-order/terminal handling, authenticated polling, and **separate external cancel** of `fixture-cancel`. It leaves only business IDs `fixture-job` and `fixture-cancel`. The synthetic callbacks deliberately include events ahead of the adapter's current fixture state; a later old poll must not regress the terminal record. These are adversarial synthetic assertions, **not evidence of a real scheduler completing work**. The trace and expectations are in `fixtures/events.json` / `expected.json`. Do not rerun over existing fixture rows without inspecting and deliberately resetting only these records and their matching synthetic adapter rows.

For a manual synthetic-provider transition, an approved operator can POST `{"state":"running"}` or `{"state":"succeeded"}` to the local adapter `/jobs/<recorded-id>/advance` with its fixture bearer, then call `/jobs` with `{op:"poll",job_id:"<recorded-id>",opt_in:true}` using the operator key. `/advance` is **fixture-only**, not a required production adapter API. Real callbacks/polling must be accepted using real observed provider events, service credentials, failure/restart behavior and durable idempotency; that remains unverified.

To exercise scheduling only after separate approval: in the copied `submit-fixture.yaml`, choose a **new recorded job ID**, change both `enabled` and `inputs.opt_in` to true; update `poll-fixture.yaml` to the same ID and opt-in only if desired. Push `--only schedules` from `project/` (not meta), inspect the two schedules/runs, then immediately `viat schedule pause submit-fixture` and `viat schedule pause poll-fixture`. Schedules run as `system:scheduler`, not their creator. Fixed-ID submission is intentionally idempotent, not “create another job every hour”; use a deliberate business-ID producer for a production periodic workload. No scheduler execution was performed here.

## Failure handling and unsupported claims

401/403 require fixing identity/authorizer/policy, not making callbacks anonymous. Unknown or malformed events fail closed (400/404). A stale/terminal/regression `decision` is a successful no-op, not a retry instruction. HTTP 4xx/5xx raises the resource helper's `upstream_error`; SQL/network failures can happen after durable writes or provider acceptance. Inspect DB state and provider ID before retrying. A failed cancel may leave `cancel_requested:true` and a running external job: poll, then resend the same explicit cancel as needed.

No exactly-once execution, native Slurm command, durable workflow checkpoint, automatic external cancellation, result-file serving, arbitrary job Widget UI, automatic alert send or production outbox worker is claimed. In-flight run cancellation, client disconnect, unpublish and endpoint rollback cannot undo a provider side effect. Disable callers and reconcile jobs externally before deleting records. Retain provider/idempotency evidence according to your lab's policy.

## Cleanup (only recorded case assets)

Pause both named schedules **before** cleanup. Account for any separately scheduled ID. For real work, explicitly cancel/reconcile external jobs and confirm provider terminal states first; deleting a Viat row/resource or stopping the fixture process does not cancel a real job.

```sh
viat schedule pause submit-fixture
viat schedule pause poll-fixture
# Read each recorded /path UUID pair; verify it belongs to this project.
while read -r path id; do
  viat endpoint unpublish "$id"
  viat endpoint delete "$id"
done < records/published-leaves.txt
viat schedule delete submit-fixture
viat schedule delete poll-fixture
# Revoke only the owned UUIDs in the two recorded key-row lists.
viat apikey revoke lab-keys OPERATOR_KEY_ROW_UUID
viat apikey revoke callback-keys CALLBACK_KEY_ROW_UUID
viat workflow delete submit_job
viat script delete jobs
viat script delete job_logic
viat resource delete adapter
viat resource delete db
```

Using platform bearer, delete exactly `/projects/lab-jobs-example/users/lab-operator-user` and `/users/lab-adapter-user`. Then remove `lab-keys`, `callback-keys`, and `password` via `DELETE .../authorizers/{name}` only if no new dependents exist. Record `GET .../authz` rule UUIDs, delete only this case's `.../authz/rules/{id}`, then `.../authz/types/job`, `.../authz/subject-attrs/role`, then `.../roles/lab-operator` and `.../roles/adapter` using DELETE. All these are project-scoped management routes with platform auth. Stop on unexpected dependency conflicts; never force-delete or blanket prune an existing project.

```sh
# Inspect these exact IDs, then delete only these fixture rows after reconciliation.
docker exec "$PG_CONTAINER" psql -U postgres -d lab_jobs_example -v ON_ERROR_STOP=1 \
  -c "SELECT job_id,state,cancel_requested FROM lab_jobs WHERE job_id IN ('fixture-job','fixture-cancel');"
docker exec "$PG_CONTAINER" psql -U postgres -d lab_jobs_example -v ON_ERROR_STOP=1 \
  -c "DELETE FROM lab_jobs WHERE job_id IN ('fixture-job','fixture-cancel');"
```

If separately opted-in schedules created another ID, inspect and remove only that recorded row after reconciliation. Stop the local adapter with Ctrl-C; retain or remove only its recorded private `records/adapter.sqlite` and any same-name SQLite journal files after stopping. Retain business DB/schema by default; dropping exclusive fixture infrastructure is a separate owner-approved operation. Revoke provider credentials separately for real adapters. Retain audit evidence then remove only the recorded private working directory/key files. **Project DELETE is not registered in 1.1.0; leave the isolated project.**

## References and evidence

[Repo sync](../projects/repo-sync.md), [authorization](../auth/authorization.md), [HTTP](../triggers/http.md), [schedules](../triggers/schedules.md), [workflows](../assets/workflows/overview.md), [PostgreSQL](../assets/resources/postgresql.md), [HTTP API resource](../assets/resources/http_api.md). Targeted source: `crates/viat-cli/src/repo/{viat_yaml.rs,endpoints.rs,schedules.rs}`, `crates/viat-api/src/{lib.rs,handlers/endpoints.rs}`, `crates/viat-runtime/src/{python.rs,annotations.rs}`. Local logic, integration/DB, scheduler and real-provider acceptance remain distinct layers. Offline unit validation passed; actual adapter/workflow/callback/provider integration remains unverified. See [verification status](../reference/validation.md).
