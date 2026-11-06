---
title: 'Application: SQL reports with opt-in notification'
description: 'Aggregate a bounded UTC sales window, persist an immutable text report and optionally notify through SMTP with durable delivery recovery.'
doc_id: applications.reports
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# SQL reports with opt-in notification

This case executes a real SQL aggregate, formats and persists a deterministic plain-text report, and **only when explicitly requested** submits it to SMTP. Default HTTP input, workflow input and the disabled schedule all have `send:false`. Validation uses fake mail and sends nothing. SMTP acceptance is not recipient delivery, and a workflow cannot atomically commit database plus email.

Use server **1.1.0** and CLI **1.1.0**. Copy the complete handbook directory `examples/reports/` into private storage; deploy from its `project/` directory. Both READMEs refer to these same executable sources. Online setup/deployment/cleanup commands remain **unexecuted instructions**, not live acceptance evidence; completed coordinator offline unit validation is recorded below.

## Files, permissions and prerequisites

| Case-relative path | Purpose |
| --- | --- |
| `project/viat.yaml` | New isolated `example-reports` identity |
| `project/resources/report_db.yaml` | Dedicated writable server SQLite file |
| `project/resources/report_mail.yaml` | Capture-relay configuration, unused unless sending is opted into |
| `project/scripts/setup.py` | Complete schema, window index and four synthetic sales |
| `project/scripts/build_report.py` | SQL count/aggregate, limits, formatting and immutable persistence |
| `project/scripts/notify_report.py` | Explicit send flag, durable claim, SMTP and uncertainty handling |
| `project/workflows/daily_report.yaml` | Build → notify, explicit outputs |
| `project/endpoints/default/report.post.yaml` | Authenticated strict `POST /report` |
| `project/schedules/report-daily.yaml` | Disabled 00:05 UTC schedule with sending off |
| `fixtures/{input,expected}.json`, `validate.py`, `case.json` | Fixed window, exact result and unit runner |

You need an activated non-production instance, trusted Bash/`curl`/Python 3/CLI workstation, server `uv`/Python and an operator-approved single-node SQLite mount. The validator uses only the standard library, not an installed `viat` package. The new project's creator is Owner; Owner/Admin publish/change project settings, Owner/Admin/Developer edit assets. Schedules run with scheduler identity, not the previous HTTP caller.

`case_machine` and non-admin project user `case_worker` (`public`) are case-owned **only in this new project**. Any admitted machine can generate this dedicated dataset's report and explicitly request sending to the fixed recipient. There is no tenant/per-customer authorization; raw SQL is not automatically row-scoped. Do not connect shared/sensitive tables. Platform sessions/PATs are management credentials, not endpoint API keys.

## 1. Unit validation without email

From the copied case directory:

```sh
python3 -I validate.py
```

Expected final line: `reports: unit-only validation passed; fake relay assertions only, no email sent`.

The validator imports the **actual deployable setup, builder and notifier**, executes their SQL in temporary stdlib SQLite and supplies fake Viat context/mail. It asserts exact aggregation and window boundaries, dry notification, invalid windows/types, row/text caps, immutable replay despite late data, deduplication, overlapping claim, unknown SMTP outcome and failed DB acknowledgement after fake acceptance. It does not execute YAML, real RPC, HTTP auth, cron, resource Test or SMTP. This is **unit-only**; the coordinator ran this validator successfully through the offline harness with network and subprocess calls blocked. See [verification status](../reference/validation.md) for the distinction between unit checks and real-stack acceptance.

## 2. Database setup and inert mail configuration

The operator configures `VIAT_SQLITE_ROOTS`, mounts a new writable directory into the **single execution node**, and chooses a new file. Replace `/approved-example-root/reports.sqlite` in the resource with that approved path. Never use the platform DB, an existing/production file, network filesystem or different files behind the same path on multiple nodes. As the server account, an operator with `sqlite3` may create the empty file:

```sh
EXAMPLE_DB=/approved-example-root/reports.sqlite
test ! -e "$EXAMPLE_DB" && sqlite3 "$EXAMPLE_DB" 'PRAGMA user_version=1;'
```

If it exists, stop and choose another; do not truncate/reuse it. `create_if_missing:false` deliberately catches missing mounts. See [SQLite](../assets/resources/sqlite.md).

The complete schema is `SCHEMA` in `setup.py`: `sales(order_id PRIMARY KEY,occurred_at,currency,amount_cents)` with a time index, `report_runs(report_id PRIMARY KEY,start_date,end_date,report_text,rows_json)`, and `report_deliveries(report_id PRIMARY KEY/FK,state,attempt_id,accepted)`. Currency is `CNY|USD`, each amount is 0–1000000000 integer cents. Source writers must normalize timestamps to **fixed-width `YYYY-MM-DDTHH:MM:SSZ` UTC text**. Lexical comparisons do not support mixed offsets/precision or local time. Only synthetic setup writes source data here.

Do **not** start a relay or run resource Test during default validation. Supplied SMTP is anonymous `127.0.0.1:2525`, `tls:none`, fixed sender `sender@example.test`; notifier recipient is fixed in script as `reports@example.test`. Loopback means the API server/container namespace, not your workstation. Saving/resolving the resource does not prove connectivity. A `.test` recipient still generates real SMTP submission if a real relay accepts it; its domain does not make a dry-run.

## 3. Create, configure and apply

Start in the copied `project/` directory. Replace this loopback URL with your authorized non-production instance:

```bash
umask 077
export VIAT_SERVER=http://127.0.0.1:8080
viat --version
read -r -p 'Platform email: ' VIAT_EMAIL
read -r -s -p 'Platform password: ' VIAT_PASSWORD; printf '\n'
viat auth login --server "$VIAT_SERVER" --email "$VIAT_EMAIL" --password "$VIAT_PASSWORD"
unset VIAT_PASSWORD
viat version
viat project create example-reports 'SQL reports example'
viat project select example-reports
viat project member ls --json
viat authorizer create --name case_machine --kind api_key
viat p-user create --identity case_worker --role public
viat apikey create case_machine --user case_worker --name fixture-client
viat push --only resources,scripts,workflows,schedules,endpoints
viat script run setup --args '{"confirm":"reports-isolated-db"}'
viat schedule show report-daily --json
viat endpoint list --json
```

Stop on each error; check both versions and Owner membership. If the slug exists, choose a fresh one and consistently update `viat.yaml`, commands and URLs; never adopt an existing project. Follow MFA prompts. Password arguments are briefly process-visible. Keep `.viat/`, the one-time API-key secret and its **row UUID** private/untracked; the short token `key_id` is not its revocation UUID.

Expect setup `{"ready":true,"source_rows":4}` and schedule `enabled:false`, `inputs.send:false`, timezone `UTC`, `catch_up:false`, `max_attempts:1`. Setup does not reset an existing report/delivery ledger.

Explicit `--only` excludes `meta` to avoid pruning the separately created authorizer. Selectors are whole kinds, not files; schedules/endpoints can mirror-prune missing objects within their scope. This is safe only in the new isolated project, not a partial checkout of a shared one. Push applies stages separately, does not initialize SQL and does not publish. Endpoint targets use **`ref: daily_report`**, schedule targets **`name: daily_report`**.

Record only `POST /report`'s UUID:

```bash
read -r -p 'POST /report endpoint UUID: ' ENDPOINT_ID
viat endpoint show "$ENDPOINT_ID" --json
viat publish plan --json
viat endpoint publish "$ENDPOINT_ID"
```

Verify workflow `daily_report`, `case_machine` and strict bindings. Fix warnings/build failures rather than bypassing gates; inspect build output even if exit status is zero. Published step main sources are frozen, while resources and direct/scheduled drafts remain live. No `uses:` modules are used here; workflow step dependencies would remain live in 1.1.0.

## 4. Generate and assert, without SMTP

Still in `project/`:

```bash
read -r -s -p 'Project API key: ' CASE_API_KEY; printf '\n'
curl --silent --show-error --include \
  "$VIAT_SERVER/p/example-reports/report" \
  -H "Authorization: Bearer $CASE_API_KEY" -H 'Content-Type: application/json' \
  --data-binary @../fixtures/input.json
```

Expect HTTP 200 with the exact object in `fixtures/expected.json`: report ID `daily-v1:2026-11-03:2026-11-04`, CNY `orders:1,total_cents:800`, USD `orders:2,total_cents:2000`, and notification `{"state":"disabled","attempted":false}`. Text is a UTC window header and two sorted currency lines. This is a plain-text report, not a delivery receipt.

The operator can assert durable state through a server read-only connection:

```sh
sqlite3 -readonly /approved-example-root/reports.sqlite \
  'SELECT report_id FROM report_runs; SELECT COUNT(*) FROM report_deliveries;'
```

For a fresh case expect only that report ID and delivery count **0**. Repeating the request returns the same persisted content, creates no claim and sends nothing. Inspect `viat logs query --endpoint "$ENDPOINT_ID" --limit 10 --json`. The alternative `viat workflow test daily_report --input '{"start_date":"2026-11-03","end_date":"2026-11-04","send":false}'` really executes draft scripts and writes/reads report data; it is not offline.

## Window, limits and disabled schedule

- Dates must be canonical `YYYY-MM-DD`, both explicit or both empty. The SQL interval is **[start midnight UTC,end midnight UTC)**, 1–31 days. Bad/one-sided windows fail `400 invalid_window`.
- Both empty selects the **previous UTC calendar day at execution time**, not a rolling 24 hours or the schedule occurrence timestamp. Replay with explicit dates. Non-UTC reports require deliberate boundary conversion and key policy, not only another cron timezone; DST days cannot be assumed to be 86400 seconds.
- At most **10000 source rows** and **65536 UTF-8 report bytes** per uncached build. Currencies remain separate; no cross-currency sum or floating-point conversion. Count, aggregate and persistence use one short SQLite write transaction for a consistent snapshot. Script timeouts are 15 seconds each, workflow 45 seconds under deployment ceilings.
- The first build freezes rows/text under `REPORT_VERSION` (`daily-v1`) plus dates. Late data does not silently alter an already delivered report. An approved correction needs a deliberately new report-version/key policy and separately identified report, retaining old evidence. Do not clear delivery rows to silently change content/recipients.
- Default schedule is **disabled**, cron `5 0 * * *`, timezone `UTC`, `send:false`, overlap skip, `catch_up:false`, one attempt. At 00:05 it selects yesterday; five minutes is not a completeness guarantee. Confirm source watermark before freezing the report.
- To opt into automated **generation only**, retain `send:false`, set `enabled:true` in its YAML and `viat push --only schedules` in this isolated project. Pause with `viat schedule pause report-daily`. Overlap skip does not exclude HTTP; database keys coordinate those callers. Sending also needs the separate approval below and an explicitly reviewed `send:true` policy.

An empty window renders `No sales`; it still sends only with opt-in. Timeouts/disconnects cannot undo committed reports or accepted mail.

## 5. Optional SMTP submission: separate explicit approval

Skip for default use. An operator must explicitly approve a capture relay, server network namespace/egress and synthetic recipient. Configure reachable host/port/TLS/sender in `report_mail.yaml`; shipped `tls:none` is for a deliberately trusted capture network only. Real relays require their documented TLS/auth and sender permissions. Provision credentials in protected resource secrets, then use `$secret` placeholders in repo files; never put credentials in `plain` or scripts. Resource Test itself connects/authenticates and is opt-in too.

After review, apply `viat push --only resources` in this isolated project. Changing the fixed recipient in `notify_report.py` or formatting requires reviewing report-version/dedup policy, scoped script push and endpoint republish. Only then explicitly request:

```sh
curl --silent --show-error --include \
  "$VIAT_SERVER/p/example-reports/report" \
  -H "Authorization: Bearer $CASE_API_KEY" -H 'Content-Type: application/json' \
  --data '{"start_date":"2026-11-03","end_date":"2026-11-04","send":true}'
```

First confirmed relay acceptance returns notification `{"state":"accepted","attempted":true,"accepted":1}`; repeat returns `{"state":"accepted","attempted":false}` without resubmission. Independently inspect capture-relay evidence. **Acceptance is not inbox delivery or absence of later bounce.** No message was sent while writing/validating this case. No chat connector is implied; adding chat needs its own provider/dedup/recovery policy.

## Delivery deduplication and recovery

The notifier commits a `sending` claim **before** SMTP, releases the DB lock, submits, then marks `accepted`. Any existing state blocks automatic resubmission. A send exception/unknown outcome marks `uncertain` when possible and raises `502 delivery_uncertain`; a crash or failed DB acknowledgement can leave `sending`. Neither state expires automatically.

This prevents concurrent automatic duplicates but can block an unsent message; it is **not exactly-once** across SMTP and SQL. For stuck `sending`/`uncertain`:

1. Pause schedule, stop manual sending, wait for every active attempt (unpublish if necessary). Record exact project, report ID, attempt ID and relay evidence.
2. Using an approved writable connection to **only this case file**, inspect the exact claim/report. If evidence proves acceptance, conditionally update **that report ID and observed attempt ID** to `accepted` with the known accepted count. Do not resend.
3. If evidence proves no submission, explicitly authorize retry by deleting **only that exact row**, conditional on observed attempt ID and `state IN ('sending','uncertain')`, then invoke `send:true` once. Preserve original evidence outside the row first. Never clear the table or touch accepted rows.
4. If unknowable, keep blocked. A human can authorize possible duplication as a conscious business decision, never an automatic retry guarantee.

Use bound IDs through an operator's parameter-capable client; no broad production SQL reset is supplied. Retain report/claim rows for the full intended dedup horizon. Deleting a claim permits sending again; resource deletion never recalls mail.

## Errors and exact cleanup

Script refusals include `400 invalid_window`, `400 invalid_send` (real bool required), `400 invalid_report_id`, `404 report_missing`, `413 report_row_limit`, `413 report_size_limit`, `502 delivery_uncertain`. Strict HTTP can reject input earlier; workflow metadata alone is not type validation. Endpoint key failure differs from management `401/403`. Fix roots/mounts, locked/read-only SQLite, SMTP transport/TLS/auth and resource configuration at their own layer, not by allowing anonymous access or disabling TLS verification. Existing `sending`/`uncertain` with `attempted:false` means **blocked**, not sent.

Stop callers/schedules and settle in-flight attempts, then remove only the owned objects in this exact project:

```sh
viat schedule pause report-daily
viat schedule delete report-daily
viat endpoint unpublish "$ENDPOINT_ID"
viat endpoint delete "$ENDPOINT_ID"
viat apikey revoke case_machine API_KEY_ROW_UUID
viat p-user delete case_worker
viat authorizer delete case_machine
viat workflow delete daily_report
viat script delete notify_report
viat script delete build_report
viat script delete setup
viat resource delete report_mail
viat resource delete report_db
unset CASE_API_KEY
```

Use the actual row UUID from creation stderr or `viat apikey list case_machine`, not the token's short `key_id`. Do not cascade-delete branches, blanket-prune, drop shared tables or delete shared relay mail. After evidence/dependency checks the operator may remove only the exact newly created SQLite file and its sidecars. Revoke separately created relay credentials and clean private local sessions separately. **Project DELETE is unsupported in 1.1.0**; leave the empty project.

## Evidence and unverified boundaries

See [SMTP](../assets/resources/smtp.md), [SQLite](../assets/resources/sqlite.md), [workflows](../assets/workflows/overview.md), [context](../assets/scripts/context.md), [HTTP](../triggers/http.md), [schedules](../triggers/schedules.md), [repo-sync](../projects/repo-sync.md). Targeted source: `crates/viat-runtime/src/python.rs` (SQL transaction/execute and mail helper), `crates/viat-api/src/runner/broker.rs` (SQLite transaction opening), repo-sync serializers. Actual relay connectivity/TLS/provider acceptance, real broker faults, cron timing and published HTTP need separately approved integration checks. Unit tests cannot establish email delivery.
