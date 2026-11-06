---
title: 'Application: incremental data synchronization'
description: 'A pushable workflow with an append-only source adapter, deterministic upserts, atomic checkpoints, restart tests and a disabled schedule.'
doc_id: applications.data-sync
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# Incremental data synchronization

This case copies an ordered change log into a materialized table, including updates and tombstones. A durable cursor advances **only after every change in the page is applied**. The source and sink are deliberately inert local SQL adapters in one dedicated SQLite resource: this is a real pushable project, not a claimed Salesforce/ERP connector or a cross-database transaction.

Target server **1.1.0** and matching CLI **1.1.0**. Copy the whole handbook directory `examples/data-sync/` to private storage; all deployable files are under `project/`. The bilingual READMEs, fixture JSON and validator use these same sources. Online setup/deployment/cleanup instructions remain **unexecuted**; completed coordinator offline unit validation is recorded below.

## Contents and prerequisites

| Case-relative path | Purpose |
| --- | --- |
| `project/viat.yaml` | New isolated `example-data-sync` project identity |
| `project/resources/sync_db.yaml` | Dedicated server SQLite resource |
| `project/scripts/setup.py` | Complete schema and four synthetic source changes |
| `project/scripts/sync_batch.py` | Real page selection, versioned upsert and checkpoint transaction |
| `project/workflows/sync.yaml` | One explicit script step; outputs `{page:…}` |
| `project/endpoints/default/sync.post.yaml` | Authenticated `POST /sync` workflow endpoint |
| `project/schedules/sync-hourly.yaml` | Disabled hourly interval, overlap skip, no catch-up or automatic retry |
| `fixtures/{input,expected}.json`, `validate.py`, `case.json` | Inputs, exact expectations and unit-only runner |

Use an activated non-production server, workstation Bash/`curl`/Python 3/CLI, server `uv`/Python, and an operator-approved single-node SQLite mount. The validator needs only Python's standard library, not an installed `viat` package. Project creation makes you Owner; Owner/Admin publish, Owner/Admin/Developer edit. Scheduler executions use the platform scheduler identity, not the last HTTP caller; this case uses only its own dedicated fixture database and no caller-derived tenant scope.

Management credentials and endpoint credentials are separate. `case_machine` admits project API keys for non-admin `case_worker` (`public` role). Any admitted machine may advance this one stream; there is no per-item or multi-tenant authorization. Raw SQL helpers do not automatically enforce row scopes. Do not point this fixture at shared business tables.

## 1. Unit validation, without a server

From the copied case directory:

```sh
python3 -I validate.py
```

Expected final line: `data-sync: unit-only validation passed; no workflow/HTTP/source-provider calls`.

The validator imports the **deployed setup and sync functions**, executes their actual SQL against a temporary stdlib SQLite file, and supplies a fake Viat context. It asserts invalid sizes, failure after sink writes/before checkpoint, rollback, restart, two ordered pages, tombstones, no-op completion, replay of old revisions and simultaneous callers on separate connections. It does not parse/run workflow YAML, exercise a real broker or scheduler, publish anything or contact a real source/sink. It is unit-only; the coordinator ran this validator successfully through the offline harness with network and subprocess calls blocked. See [verification status](../reference/validation.md) for the distinction between unit checks and real-stack acceptance.

## 2. Database isolation and schema

An operator must configure `VIAT_SQLITE_ROOTS`, create a new parent directory writable by the server account and mount it into the **single execution node**. Replace `/approved-example-root/data-sync.sqlite` in the resource with the approved path. Never use the platform database, an existing/production file, a network filesystem, or independent writable files at the same path on several nodes. The resource has `create_if_missing:false`; a missing mount should fail rather than create an empty alternate database. See [SQLite](../assets/resources/sqlite.md).

On that server, as the intended server account, after selecting the new path:

```sh
EXAMPLE_DB=/approved-example-root/data-sync.sqlite
test ! -e "$EXAMPLE_DB" && sqlite3 "$EXAMPLE_DB" 'PRAGMA user_version=1;'
```

If the file exists, stop and choose another. The complete schema is the `SCHEMA` tuple in deployable `setup.py`:

- `source_changes(seq PRIMARY KEY, item_id, value, deleted)`: **append-only**, strictly increasing positive sequence, stable unique sequence per immutable change. Gaps are allowed; late insertion below the checkpoint is not.
- `sync_items(item_id PRIMARY KEY, value, source_seq, deleted)`: deterministic latest-revision projection; deletion is a durable tombstone, not physical removal.
- `sync_checkpoint(stream PRIMARY KEY, cursor)`: stream is fixed to `fixture-v1`; initialized to 0.

The source producer must allocate sequences in **committed visibility order**. Do not assume a database auto-increment allocated before a long transaction commits is a safe incremental watermark. This local fixture is static; production source adapters need a stable page boundary/CDC cursor with a documented late-arrival and retention contract.

## 3. Create, configure and push

Start in the copied `project/` directory, not the repository root or a pre-existing project. The URL is a loopback example; replace it with your authorized non-production instance.

```bash
umask 077
export VIAT_SERVER=http://127.0.0.1:8080
viat --version
read -r -p 'Platform email: ' VIAT_EMAIL
read -r -s -p 'Platform password: ' VIAT_PASSWORD; printf '\n'
viat auth login --server "$VIAT_SERVER" --email "$VIAT_EMAIL" --password "$VIAT_PASSWORD"
unset VIAT_PASSWORD
viat version
viat project create example-data-sync 'Incremental data sync example'
viat project select example-data-sync
viat project member ls --json
viat authorizer create --name case_machine --kind api_key
viat p-user create --identity case_worker --role public
viat apikey create case_machine --user case_worker --name fixture-client
```

Stop on failure. If the slug is taken, choose a new one and consistently update `viat.yaml`, commands and URLs; **do not adopt an existing project**. Check versions and Owner membership. Follow MFA prompts; password arguments can be visible to local process inspection. Protect `.viat/config.yaml`, the one-time API-key secret, and its **row UUID**, all outside version control. The short `key_id` inside a token is not its revocation UUID.

```sh
viat push --only resources,scripts,workflows,schedules,endpoints
viat script run setup --args '{"confirm":"data-sync-isolated-db"}'
viat schedule show sync-hourly --json
viat endpoint list --json
```

Expect setup `{"ready":true,"source_rows":4}` and schedule `enabled:false`, `catch_up:false`, `on_overlap:"skip"`, `max_attempts:1`. Source fixture is A=alpha (seq 1), B=beta (2), A=alpha-v2 (3), B tombstone (4). Setup does not reset a cursor or overwrite an existing source change; re-running it is not a clean restart.

Push does not run schema initialization or publish, and stages are not globally atomic. The explicit `--only` excludes `meta` to **preserve manually created authorizers**, and excludes all unrelated trigger families. Selectors are whole kinds, not filename filters. Schedule and endpoint stages can prune missing items in visited scope; these commands are safe only in this new isolated project, not a partial checkout of an existing project. No `push --prune` exists.

Endpoint uses `target: {kind: workflow, ref: sync}`; the schedule uses `target: {kind: workflow, name: sync}`. Do not swap `ref` and `name`. After saving the UUID of only `POST /sync`:

```bash
read -r -p 'POST /sync endpoint UUID: ' ENDPOINT_ID
viat endpoint show "$ENDPOINT_ID" --json
viat publish plan --json
viat endpoint publish "$ENDPOINT_ID"
```

Verify `case_machine`, workflow `sync`, strict input, and no other leaf. Fix warnings or failed build output instead of automatically acknowledging them. A publish exit 0 alone is not proof of build readiness. Public execution uses the published workflow/step snapshot; draft tests and schedules use live definitions. There are no `uses:` modules here; 1.1.0 workflow step dependencies would otherwise remain live.

## 4. Run one bounded page and assert

Read the actual one-time endpoint API key. Each request mutates only the isolated fixture database:

```bash
read -r -s -p 'Project API key: ' CASE_API_KEY; printf '\n'
curl --silent --show-error --include \
  "$VIAT_SERVER/p/example-data-sync/sync" \
  -H "Authorization: Bearer $CASE_API_KEY" -H 'Content-Type: application/json' \
  --data-binary @../fixtures/input.json
```

On a freshly initialized database expect HTTP 200 with `{"page":{"cursor_before":0,"cursor":2,"read":2,"more":true}}`. Repeat: expect `cursor_before:2`, `cursor:4`, `read:2`, `more:false`. Repeat again: `cursor_before:4`, `cursor:4`, `read:0`, `more:false`. `fixtures/expected.json` contains the full page objects and final rows. If `more:true`, invoke another bounded page; no unbounded loop runs inside the workflow.

An operator can assert durable state with a **read-only** connection on the server:

```sh
sqlite3 -readonly /approved-example-root/data-sync.sqlite \
  'SELECT stream,cursor FROM sync_checkpoint; SELECT item_id,value,source_seq,deleted FROM sync_items ORDER BY item_id;'
```

After two pages expect `fixture-v1|4`, `A|alpha-v2|3|0`, and `B||4|1`. Empty value plus `deleted=1` is a tombstone, not a missed row. Inspect `viat logs query --endpoint "$ENDPOINT_ID" --limit 10 --json` for refusal/runtime evidence. A successful test run is not evidence of endpoint authentication.

To inspect draft behavior instead of the endpoint, `viat workflow test sync --input '{"batch_size":2}'` is supported, but it **really executes another page**. Do not run it between the fresh-state assertions above. Likewise, do not manually trigger or enable the schedule during those assertions.

## Checkpoint, restart and compensation contract

`batch_size` defaults to 2; only a real integer 1–100 is accepted. A writable SQLite **BEGIN IMMEDIATE** serializes callers before reading the checkpoint. Within one transaction the script reads `seq > cursor ORDER BY seq LIMIT batch_size`, upserts each item only if its incoming `source_seq` is newer, then updates the checkpoint and determines whether more exists. It returns success only after commit.

- Failure before checkpoint or commit: the whole page, including sink writes, rolls back. Restart the same workflow; it reads the same durable cursor.
- Lost response after commit: the next run reads the advanced cursor. No response-derived cursor is trusted.
- Concurrent manual/HTTP/scheduled runs: local DB locking serializes them; after a busy timeout (roughly 5 seconds), retry a bounded page. Schedule `on_overlap:skip` is extra load control, not a global mutex against HTTP calls.
- Replaying an older change cannot replace a newer value or resurrect a newer tombstone. The validator explicitly rewinds only its **temporary test checkpoint** to assert this; do not casually rewind a deployed stream.
- This fixture has no external compensation because source/sink/checkpoint share one database. For a different sink, first obtain sink acknowledgement using a deterministic `(stream,seq)` key, then persist the source checkpoint; a failure in between must replay safely. Use a durable outbox or target-local unique receipt plus reconciliation. No Viat workflow transaction spans two resource connections or a remote API.
- Corrections must be **new, higher-sequence changes**, including reversal/tombstone events. Never edit history in place below the checkpoint. If history is lost, pause processing and deliberately rebuild a new stream/projection from a retained snapshot; do not just skip ahead. Retain source changes until every required consumer checkpoint/backup has passed them.

The disabled `sync-hourly` schedule performs one page per interval, `max_attempts:1`, no catch-up. It is not a full drain job or exactly-once scheduler. For explicit opt-in after inspecting capacity and permissions, change `enabled` to true in its file and `viat push --only schedules`; this changes **all schedules in this isolated project's mirrored kind**. `viat schedule pause sync-hourly` stops new automatic starts, not existing writes. Keep source changes per hour below consumption capacity, or deliberately adjust batch size/frequency under the 100-row/page limit. Do not add hidden automatic retries for non-idempotent external adapters.

## Errors and limits

| Failure | Action |
| --- | --- |
| `400 invalid_batch_size` | Supply integer 1–100, not bool/string/null; workflow input metadata alone is not runtime type enforcement |
| Strict HTTP `400 bad_request` | Remove unknown fields/fix coercion; script validation remains authoritative for direct workflow runs |
| `409 checkpoint_missing`, missing table | Initialize only the dedicated database using setup; do not guess a cursor |
| API key rejected / project `403` | Distinguish endpoint user from platform membership and Owner/Admin publication rights |
| Locked/read-only/missing SQLite file | Check one-node topology, mount, roots and writable resource; do not bypass isolation |
| Runtime timeout / lost response | Inspect cursor and restart the bounded page; do not infer rollback solely from transport failure |
| Late inserted/edited source history | Outside this cursor contract; halt and reconcile rather than silently claiming completeness |

Text values and source row sizes are fixed tiny fixtures; this is not a bulk-loader benchmark. Script budget is 15 seconds, workflow 30 seconds, under deployment ceilings. Raw-SQL table access is intentionally scoped by physical isolation, not tenant policies. No schema migration framework or production service connector is introduced.

## Cleanup

Stop callers, leave/pause the schedule, and wait for active runs. In this exact project, using only the recorded endpoint UUID and API-key **row UUID**:

```sh
viat schedule pause sync-hourly
viat schedule delete sync-hourly
viat endpoint unpublish "$ENDPOINT_ID"
viat endpoint delete "$ENDPOINT_ID"
viat apikey revoke case_machine API_KEY_ROW_UUID
viat p-user delete case_worker
viat authorizer delete case_machine
viat workflow delete sync
viat script delete sync_batch
viat script delete setup
viat resource delete sync_db
unset CASE_API_KEY
```

Replace `API_KEY_ROW_UUID` with creation stderr's UUID or the UUID shown by `viat apikey list case_machine`, never the short token `key_id`. Do not prune other projects or drop shared tables. Resource deletion leaves its data file intact; after retaining required evidence and confirming no runs/resources use it, the operator may remove only the exact newly created SQLite file and its sidecars. Local credential removal/logout is separate from server revocation. **No project DELETE route exists in 1.1.0**; leave the empty isolated project.

## Evidence and unverified boundaries

See [repo-sync](../projects/repo-sync.md), [Python context](../assets/scripts/context.md), [workflows](../assets/workflows/overview.md), [HTTP](../triggers/http.md), [schedules](../triggers/schedules.md), [SQLite](../assets/resources/sqlite.md) and [CLI synchronization](../cli/sync.md). Targeted source: `crates/viat-runtime/src/python.rs` (transaction/query/execute), `crates/viat-api/src/runner/broker.rs` (SQLite locking), and the CLI repo endpoint/resource serializers. Unit fixtures cannot establish real scheduler identity/lease behavior, broker timeout/rollback behavior, publication or an external system's CDC/idempotency semantics; those require separately approved integration checks.
