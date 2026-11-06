---
title: "Paper digest: RSS, durable claims and cited summaries"
description: "A fixture-first project with an opt-in HTTP feed, LLM summary, SQLite deduplication and delivery."
doc_id: applications.paper-digest
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# Paper digest

The complete source is `examples/paper-digest/` in the handbook checkout. It is a usable repo-sync project, not a built-in research connector. It reads RSS 2.0 abstracts, normalizes HTTPS source URLs, summarizes each unique source, attaches citations and optionally POSTs to an approved delivery service. It does not download PDFs, search the web, validate scientific truth or implement Atom.

**Verification status:** the coordinator's offline harness passed all **9 unit tests** against the actual handler with fake resources and local temporary data. This does not verify a running Viat server, real broker, scheduler, live feed, paid model or delivery; those still require manual opt-in checks. See [verification layers](../reference/validation.md).

## Prerequisites and safety boundary

- Activated server and CLI **1.1.0**, platform login, server Python/uv runtime, and permission to create an isolated project. Developer can edit; Owner/Admin must publish. Follow [first endpoint](../getting-started/first-endpoint.md) for login, not an invented deployment command.
- Workstation Python 3 for the standard-library validator. It uses the actual `project/scripts/pd_run.py` with an explicitly fake `viat.ctx`; it is not the real worker, SQL broker, scheduler or provider.
- Before pushing resources, an operator must approve `/var/lib/viat/examples` under `VIAT_SQLITE_ROOTS` and provide that writable directory on persistent server storage, or change `pd_store.yaml` to an approved absolute path. The path is **server-side**, not your checkout. `create_if_missing:true` permits file creation on connection/Test; do not click resource Test casually. Multi-node use requires a storage/placement design; a different local file per node is not shared deduplication.
- The `*.example.test` origins and synthetic model key are inert placeholders, not services or credentials. Destination validation may require environment-specific approved URLs even at resource save. Do not weaken outbound guards.

Default settings: `source_mode:fixture`, `model_mode:fixture`, `network_enabled:false`, `paid_calls_enabled:false`, `durable_enabled:false`, `delivery_enabled:false`. The schedule is disabled; the endpoint denies every authorizer. The default script only reads synthetic config data and returns JSON. Saving resources is remote configuration, not proof they work.

## Files and shared inputs

`project/viat.yaml` selects `paper-digest-example`. `resources/pd_settings.yaml` contains the RSS fixture (including a duplicate URL with a fragment) and canned summary used by both the deployed handler and validator. `fixtures/expected.json` is the exact default script result: one synthetic paper, one source citation, `skipped:0`, `durable:false`, `delivery_enabled:false`. Feed duplicates are removed before durable claims; `skipped` counts pre-existing durable claims, not duplicates inside the feed.

`pd_run.py` declares five resources: config `pd_settings`, HTTP `pd_feed`, LLM `pd_model`, SQLite `pd_store`, HTTP `pd_delivery`. Credentials remain broker-side. The workflow is this entire JSON-compatible YAML file:

```json fixture=paper-digest/project/workflows/pd_daily.yaml
{
  "inputs": {},
  "steps": [{"id":"digest","script":"pd_run","args":{}}],
  "outputs": {"digest":"$digest.output"},
  "timeout": 120,
  "max_concurrent": 1
}
```

JSON is valid YAML; every `.yaml` in this example is deliberately JSON-compatible so the validator needs no YAML package. Endpoint target uses **`ref`**; schedule target uses **`name`**. The endpoint tree `paper-digest` is created at `/paper-digest`, giving `POST /p/paper-digest-example/paper-digest/digest` on a newly created tree. Inspect actual tree paths if you reuse anything.

## Apply the inert project

The commands below are **manual remote operations**, not executed checks. From the handbook root:

```sh
cd examples/paper-digest
python3 -I validate.py
cd project
viat project create paper-digest-example "Paper digest example"
viat project select paper-digest-example
viat project diff --only resources,scripts,workflows,schedules,endpoints
viat push --only resources,scripts,workflows,schedules,endpoints
viat schedule show pd_daily --json
viat endpoint list --json
viat workflow test pd_daily --input '{}'
```

Use an unused slug; if changing it, change `viat.yaml` and every command/path. Never overwrite a project merely because the slug exists. Run push from **`project/`**, not the handbook root. Preserve the new object's returned IDs and names in a private ownership record for cleanup.

Do **not** run all-kind push: this deliberately minimal `viat.yaml` omits authorizers/roles/scope claims; a metadata mirror can prune seeded authorizers. `--only` selects entire kinds, not example-prefixed names. Schedules/endpoints can prune other objects in their mirrored scope: use a new isolated project, review the diff and stop on unexpected deletions. Scripts/workflows/resources upsert without absence pruning. Push does not publish or initialize application tables.

### Assert the fixture result

The local validator should pass units covering real handler branches, a temporary SQLite ledger reopened on a new connection, invalid citations, failed claims, uncertain delivery and exact fake HTTP calls. Its temporary database is not the server database. A validator pass would not prove deployment integration.

The manual workflow test should return `{"digest": ...}` wrapping `fixtures/expected.json`; inspect the actual JSON and step failures. The schedule must show `enabled:false`, and the endpoint must remain unpublished/deny-all. Do not use `viat script test` as an alias for this validator; that command invokes separate language test tools.

## Enable durable ingestion deliberately

1. Keep the schedule paused and delivery disabled. Review `pd_feed.plain.base_url`; the adapter calls only `GET /feed.xml` with a 10-second timeout. Provide a permitted RSS service at that path. The parsed text limit is 256 KiB, at most 20 item elements, title <=300 characters and abstract <=12000; XML declarations of entities/DOCTYPE are refused. The helper buffers the response before the application size check, so bound upstream response sizes operationally too. It never follows article links itself.
2. Set `durable_enabled:true` in `pd_settings.plain.data` only after approving the persistent SQLite file. The first durable run creates **only** its owned `pd_items` table. No SQL migration is implicit in push. Set `source_mode:http`, `network_enabled:true` only for an approved network run.
3. For no paid model, keep fixture mode and supply reviewed `fixture_summaries` keyed by each canonical source URL. A missing fixture fails; it never silently falls back to a paid model. Alternatively choose `model_mode:resource` and `paid_calls_enabled:true`, configure the LLM provider/endpoint/model per [LLM resource](../assets/resources/llm.md), and provision its real secret through the console. Replace the synthetic key server-side, then change the repo secret to `"$secret"` so future pushes preserve it. New resources cannot be created from that placeholder. No model discovery or provider registration is provided.
4. Push reviewed config with `viat push --only resources`; test `pd_daily` once and inspect execution logs. The prompt sends abstract/title/source URL, not a full paper. Model JSON is accepted only with a nonempty summary <=2000 characters and exactly the supplied URL in `citations`; tool calls and invented URLs fail. This is citation provenance checking, **not** entailment/factual verification. Treat source/prompt content as hostile and review summaries before wider delivery.

### Deduplication, failures and recovery

The handler refuses HTTP-feed, resource-model and delivery modes unless `durable_enabled:true`, before any external call. These flags are server-owned configuration, not endpoint arguments.

The durable key is SHA-256 of HTTPS URL with lowercase authority, no fragment, and preserved path/query. Same URL revisions are suppressed forever by this example; different query strings count as different sources. RSS GUID is not used. Adjust identity rules deliberately if that is wrong for your feed.

`INSERT OR IGNORE` on the primary key atomically wins a claim before the model call. A crash after claiming leaves `claimed`; invalid model output records `failed`; success stores the cited result as `ready`. Every existing key, including failed/claimed keys, is skipped on subsequent runs. This prevents automatic duplicate calls but can leave work unfinished. There is **no exactly-once/durable workflow guarantee** and no automatic recovery/retry of held claims.

For diagnosis an operator can query only the owned ledger through the resource query console:

```sql
SELECT item_key, source_url, state, delivery_state, result_json FROM pd_items;
```

Do not remove claims blindly. Reconcile model costs, saved results and downstream effects first. An approved retry may delete **one reviewed key** using a bound `:key` parameter through the database helper/query tooling; never truncate the table to “fix” a retry. Back up the ledger before changes. Retaining it across restarts is the dedup strategy; local Python sets alone are not durable.

## Schedule, endpoint and delivery opt-in

The supplied schedule is daily **08:00 UTC**, overlap `skip`, one attempt, no catch-up. Direct workflow schedules use live drafts and the scheduler principal, not an endpoint snapshot or a personal user's token. After one verified run and explicit authorization for future costs, `viat schedule resume pd_daily` enables it; `viat schedule pause pd_daily` stops future firings after reconciliation, not already running work.

The optional endpoint remains deny-all until you intentionally set `allowed_authorizers` to an existing project-user authorizer (for example `password`) in its file, push only endpoints, inspect `viat publish plan --json`, and publish the returned leaf ID with `viat endpoint publish ENDPOINT_ID`. Use a **project** login token, not a platform PAT, and confirm an unauthenticated call is refused. Its strict contract accepts no query/body arguments; callers cannot override server-side safety flags.

Delivery is a separate opt-in: configure an approved fixed `pd_delivery` base URL and broker-side auth, obtain recipient consent, then set `delivery_enabled:true` with durable mode enabled. It sends one JSON result per paper to `POST /digest`; it is not a native email/chat connector. The durable state becomes `uncertain` **before** POST and `accepted` after a successful return. A timeout or lost response is left uncertain and is not retried automatically; accepted is not recipient delivery. Existing claimed/ready papers are not retroactively delivered by toggling the flag. Manually reconcile or implement a separately reviewed provider-idempotent outbox if you need recovery; no blanket replay is supplied.

## Cleanup only owned objects

Pause `pd_daily`, turn delivery off, unpublish the owned leaf and account for in-flight executions. Then, substituting **only the recorded owned endpoint ID**:

```sh
viat schedule pause pd_daily
viat endpoint unpublish ENDPOINT_ID
viat endpoint delete ENDPOINT_ID
viat schedule delete pd_daily
viat workflow delete pd_daily
viat script delete pd_run
viat resource delete pd_delivery
viat resource delete pd_model
viat resource delete pd_feed
viat resource delete pd_store
viat resource delete pd_settings
```

Skip unpublish if the leaf was never published. Delete the `paper-digest` tree with `viat tree delete paper-digest` only if you created it and it is empty after reviewing its nodes. Resource deletion does not delete the SQLite file or undo deliveries: operator-approved archival/removal of this specific file and upstream credential revocation are separate. Do not delete shared files/tables, use blanket prune, or invent a project DELETE route; none is registered in 1.1.0. The now-empty project may remain.

## Contracts and remaining checks

See [repo sync](../projects/repo-sync.md), [HTTP resources](../assets/resources/http_api.md), [SQLite](../assets/resources/sqlite.md), [workflows](../assets/workflows/overview.md), [schedules](../triggers/schedules.md) and [endpoint auth](../auth/endpoints.md). Maintenance evidence: pinned product `crates/viat-cli/src/repo/{resources,endpoints,schedules}.rs`, `crates/viat-runtime/src/python.rs`, and registered API routes in `crates/viat-api/src/lib.rs`.

Remaining manual checks: approved server paths/destination policy, resource resolution, real RSS encoding/size, SQL-broker semantics under concurrent workers, chosen model JSON/cost/privacy, schedule admission/timing, published auth denial, downstream idempotency and delivery. Local fixtures do not establish any of these.
