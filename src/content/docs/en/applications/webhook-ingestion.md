---
title: 'Application: signed webhook ingestion'
description: 'An authenticated raw-body webhook with HMAC, replay limits and durable local idempotency, plus an isolated Python validator.'
doc_id: applications.webhook-ingestion
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# Signed webhook ingestion

This complete case accepts a synthetic payment event, verifies its **exact HTTP body bytes**, and commits an event ledger and account total together. It has two admission checks: a project API key and an HMAC-SHA256 signature. It does not send messages, call a payment provider or claim an external exactly-once guarantee.

Use server **1.1.0** and CLI **1.1.0**. The project files are in `examples/webhook-ingestion/project/` in this handbook repository; copy the **whole** `examples/webhook-ingestion/` directory into a private working directory. Do not copy only a code fragment. `README.md` and `README.zh-cn.md` describe the same executable files. Online setup/deployment/cleanup commands remain instructions, **not executed acceptance evidence**; completed coordinator offline unit validation is recorded below.

## Files and permissions

| File below the case directory | Purpose |
| --- | --- |
| `project/viat.yaml` | Disposable project identity `example-webhook-ingestion` |
| `project/resources/webhook_db.yaml` | Dedicated server-side SQLite file |
| `project/resources/webhook_key.yaml` | Platform-held HMAC key; supplied key is publicly known dummy data |
| `project/scripts/setup.py` | Actual two-table schema, initialization guarded by an explicit confirmation string |
| `project/scripts/ingest.py` | Deployable HTTP entrypoint and shared `process` implementation |
| `project/endpoints/default/events.post.yaml` | `POST /events`, API-key admission, raw body, required headers and rate limit |
| `fixtures/event.json`, `fixtures/expected.json` | Exact synthetic input bytes and expected results/failure codes |
| `sign_fixture.py`, `validate.py`, `case.json` | Dummy-only local signer, standard-library unit validator and case metadata |

Create a **new** project; the creator is its Owner. Owner/Admin is required for project settings and publishing; Owner/Admin/Developer can edit content. A platform session/PAT is management authentication, not the endpoint API key. The example project user `case_worker` has the built-in non-admin `public` role, admitted only through authorizer `case_machine`. These names are example-owned **only in this newly created project**. An admitted machine can process all events for this dedicated database: there is no tenant or per-account authorization model. Raw SQL is not automatically row-scoped.

Prerequisites: an activated non-production instance; a trusted workstation with Bash, `curl`, Python 3 and matching `viat`; server `uv`/Python support; and an operator who can mount a dedicated writable SQLite file. No third-party Python package is needed for the validator. Do not install a PyPI package named `viat`.

## 1. Check locally without deploying

From the copied case directory:

```sh
python3 -I validate.py
```

The validator imports **the actual setup and ingestion scripts**, uses their SQL against a temporary stdlib SQLite database and emulates `viat.ctx`, `ViatError` and the crypto broker. It checks a first delivery, repeat, changed bytes, bad signature, stale timestamp, invalid JSON, body limit, rollback on a projection failure, restart and concurrent duplicate deliveries. The local signer also uses only the documented dummy key. Expected final line is `webhook-ingestion: unit-only validation passed; no HTTP/provider calls`.

This is **unit-only**, not a running Viat instance: it does not verify actual API-key admission, header exposure, raw-body dispatch, broker isolation, publish/build readiness or multi-node behavior. The coordinator ran this validator successfully through the offline harness with network and subprocess calls blocked. See [verification status](../reference/validation.md) for the distinction between unit checks and real-stack acceptance.

## 2. Provision only an isolated database

On the **server**, the operator chooses a new absolute file path under configured `VIAT_SQLITE_ROOTS`, makes its parent writable by the server account, and mounts that same file into the one API node that will execute the example. Replace `/approved-example-root` in the resource YAML with that approved mounted root. Do not use Viat's platform database, a production file, a network filesystem or different writable files on different nodes.

An operator with `sqlite3` can create the new empty example file as the server account:

```sh
EXAMPLE_DB=/approved-example-root/webhook-ingestion.sqlite
test ! -e "$EXAMPLE_DB" && sqlite3 "$EXAMPLE_DB" 'PRAGMA user_version=1;'
```

If the path already exists, **stop** and choose another; do not reuse or truncate it. This instruction creates a file, not a service. `create_if_missing:false` deliberately makes missing mounts/typos fail instead of silently creating another database. See [SQLite resource](../assets/resources/sqlite.md).

`setup.py` is the schema source: `webhook_events` has unique `event_id`, exact-byte hash, receive time, account and amount; `webhook_totals` has one primary-keyed account total. The handler inserts both within one brokered `db.transaction()`. SQLite writable transactions use **BEGIN IMMEDIATE**, so competing writers serialize before checking the ledger. Do not replace this with separate resource calls or hold the lock across a provider call.

## 3. Create the project and apply scoped drafts

Start in the copied case's `project/` directory. Use the actual authorized instance URL; the loopback URL below is only a non-production example. Keep `.viat/` private and untracked.

```bash
umask 077
export VIAT_SERVER=http://127.0.0.1:8080
viat --version
read -r -p 'Platform email: ' VIAT_EMAIL
read -r -s -p 'Platform password: ' VIAT_PASSWORD; printf '\n'
viat auth login --server "$VIAT_SERVER" --email "$VIAT_EMAIL" --password "$VIAT_PASSWORD"
unset VIAT_PASSWORD
viat version
viat project create example-webhook-ingestion 'Webhook ingestion example'
viat project select example-webhook-ingestion
viat project member ls --json
viat authorizer create --name case_machine --kind api_key
viat p-user create --identity case_worker --role public
viat apikey create case_machine --user case_worker --name fixture-client
```

Stop on any failed command. If the slug already exists, choose a fresh slug and change `viat.yaml`, commands and URLs consistently; never adopt an existing project. Login arguments are briefly visible to process inspection; use a trusted workstation and follow MFA prompts. Verify both client/server version and your Owner membership. Securely record the API key's **one-time secret and row UUID** (not the short `key_id` embedded in the token); do not commit them or paste them into logs.

In the console, select this exact project → Project Settings and add `x-event-timestamp` and `x-event-signature` to **exposed headers**, retaining any existing entries. Required headers do not automatically become script-visible. Leave payload recording off for this example. Never expose `authorization`, cookies or `x-viat-*` headers. The server applies the project API key independently of script-visible headers.

For the dummy-only exercise keep the supplied key; **never expose this route to untrusted traffic using that known key**. A real provider requires a separately provisioned `crypto_key` resource with an authorized HMAC key, rotation policy and provider-specific signature grammar. After secure provisioning, replace repo `secret.key` with the literal export placeholder `$secret` so a later push preserves it; a placeholder cannot create a new key. The included signer cannot accept a real key and is not a production signing tool. See [crypto keys](../assets/resources/crypto_key.md).

```sh
viat push --only resources,scripts,endpoints
viat script run setup --args '{"confirm":"webhook-ingestion-isolated-db"}'
viat endpoint list --json
```

Push applies resources and scripts before endpoints; it does **not** run setup or publish. It is not one transaction. `--only` names whole kinds, not individual files. Deliberately exclude `meta`: the minimal `viat.yaml` must not mirror-prune the authorizer just created. Never replace this with unscoped push into an existing project. Expect setup `{ "ready": true, "tables": ["webhook_events","webhook_totals"] }`.

Record the UUID of **only** `POST /events` from the list:

```bash
read -r -p 'POST /events endpoint UUID: ' ENDPOINT_ID
viat endpoint show "$ENDPOINT_ID" --json
viat publish plan --json
viat endpoint publish "$ENDPOINT_ID"
```

Verify target `ingest`, authorizer `case_machine`, `raw_body:true`, required headers and no cache/async configuration. Endpoint repo targets use `target.ref`, not schedule `target.name`. Fix publish warnings/build failures rather than bypassing the gates. Inspect build lines even when exit status is zero. Publication freezes the endpoint and this script; project settings/resources remain live. This example has no `uses:` dependency or background schedule.

## 4. Sign, call and assert

Still in `project/`, make headers using the **unaltered** fixture file:

```sh
python3 -I ../sign_fixture.py ../fixtures/event.json
```

Copy its `x-event-timestamp` and `x-event-signature` values; they expire after five minutes. The signed message is ASCII Unix seconds + `.` + exact body bytes, including the fixture's trailing newline. JSON whitespace/reformatting changes the signature. The expected signature is lowercase hex HMAC-SHA256, not a provider-specific `v1=` envelope.

```bash
read -r -s -p 'One-time project API key: ' CASE_API_KEY; printf '\n'
read -r -p 'x-event-timestamp: ' EVENT_TIMESTAMP
read -r -p 'x-event-signature: ' EVENT_SIGNATURE
curl --silent --show-error --include \
  "$VIAT_SERVER/p/example-webhook-ingestion/events" \
  -H "Authorization: Bearer $CASE_API_KEY" -H 'Content-Type: application/json' \
  -H "x-event-timestamp: $EVENT_TIMESTAMP" -H "x-event-signature: $EVENT_SIGNATURE" \
  --data-binary @../fixtures/event.json
```

Expect HTTP 200 and `{"event_id":"evt_fixture_001","status":"processed"}`. Repeat **the same command and bytes** within the window: expect 200 with `status:"duplicate"`. A response lost after commit is recovered the same way; outside the window create a new valid timestamp/signature for the **same** event and bytes. Do not assign a new event ID merely because a response was lost.

For a fresh database, an operator can verify the projection with a read-only connection:

```sh
sqlite3 -readonly /approved-example-root/webhook-ingestion.sqlite \
  'SELECT event_id,account_id,amount_cents FROM webhook_events ORDER BY event_id; SELECT account_id,total_cents FROM webhook_totals ORDER BY account_id;'
```

Expect exactly `evt_fixture_001|acct_fixture|1250` and `acct_fixture|1250` after the two calls, not 2500. Use your approved replacement path if changed. View refusal/runtime evidence with `viat logs query --endpoint "$ENDPOINT_ID" --limit 10 --json`; do not infer successful processing from an HTTP connection alone.

## Failure, replay and concurrency policy

| Condition | Expected outcome / recovery |
| --- | --- |
| No/wrong endpoint API key | Platform admission refuses before processing; restore the correct project credential, not a console token |
| Missing required headers | Platform `400 bad_request`; configure/send both headers |
| Header not exposed, bad syntax or altered bytes | Script `401 invalid_signature`; check exposure and exact bytes, never disable verification |
| Timestamp more than 300 seconds old **or future** | `401 stale_event`; sync clocks and legitimately re-sign; do not widen the window to bypass replay checks |
| Signed malformed JSON, extra keys, invalid identifiers, bool/float/nonpositive/overlarge amount | `400 invalid_event`; accepted keys are exactly `event_id`, `account_id`, `amount_cents`; IDs match `[A-Za-z0-9_-]{1,64}`, amount is integer 1–1000000 cents |
| Same event ID, different signed body bytes | `409 event_conflict`; quarantine for investigation, do not overwrite the ledger |
| Body above 65536 bytes | `413 event_too_large` from script; platform can reject bodies above its own 2 MiB ceiling earlier |
| Concurrent same event/bytes | First commit processes; next serialized writer returns duplicate. If the approximately 5-second SQLite busy wait expires, that run fails; retry the same ID/bytes with a valid signature |
| DB error, timeout or disconnect | Outcome may be unknown; retry identical business identity. Ledger plus projection either commit together or roll back, but response delivery is separate |
| Endpoint quota exceeded | Platform `429` with `Retry-After`; back off and sign within the timestamp window |

The timestamp is a freshness bound, **not** a persistent nonce store. Persistent replay protection is the unique event ledger, scoped to this single provider stream. Keep event IDs/hash rows for at least the provider's complete retry horizon; deleting them re-enables old business IDs under a new signature. No automatic retention is implemented. Distinct providers must have distinct namespaces or a composite provider/event key. Totals and ledger need SQLite-aware backup together. A clone with a different ledger is not shared deduplication.

Only the local SQL ledger/projection is transactional. Adding SMTP, HTTP, queues or payments requires a durable outbox and downstream idempotency/reconciliation; a database transaction cannot atomically commit an unrelated provider side effect. Platform `Idempotency-Key` is optional best-effort transport replay protection and is **not used as the business guarantee here**.

## Cleanup only what this case owns

Stop callers and wait for in-flight runs. With this new project still selected, verify the saved endpoint/key IDs and remove only the case-owned objects:

```sh
viat endpoint unpublish "$ENDPOINT_ID"
viat endpoint delete "$ENDPOINT_ID"
viat apikey revoke case_machine KEY_ID_FROM_CREATE
viat p-user delete case_worker
viat authorizer delete case_machine
viat script delete ingest
viat script delete setup
viat resource delete webhook_key
viat resource delete webhook_db
unset CASE_API_KEY EVENT_SIGNATURE EVENT_TIMESTAMP
```

Despite the CLI argument name, `KEY_ID_FROM_CREATE` must be the actual **API-key row UUID** from creation stderr or `viat apikey list case_machine`, not the short `key_id` inside `vsk_…`. Never use a guessed/example UUID. Do not cascade-delete a branch or use blanket pruning. Resource deletion does not remove the SQLite file; after preserving needed evidence and confirming no resource/run uses it, the operator may remove **only the exact new file and its SQLite sidecars** that they recorded. Clear only the two added exposed-header entries if keeping the empty project. Remove local credentials securely; `viat auth logout` clears local session fields but does not revoke every server credential.

**Project DELETE is unsupported in 1.1.0.** Leave the empty isolated project; do not invent a project-delete CLI/API command. Never apply these cleanup names in another project.

## Contract and unverified boundaries

Based on [repo-sync](../projects/repo-sync.md), [HTTP dispatch](../triggers/http.md), [script context](../assets/scripts/context.md), [endpoint auth](../auth/endpoints.md) and the SQLite/crypto references. Targeted implementation evidence: `crates/viat-runtime/src/python.rs` (`_Sql`, `_Tx`, crypto verify), `crates/viat-api/src/runner/broker.rs` (SQLite transaction opening), `crates/viat-cli/src/repo/{resources,endpoints}.rs`. Source reading is not live verification. Provider signature compatibility, credential rotation, real broker/concurrency behavior, deployment networking and publication still need separately approved integration checks; this validator makes no such claim.
