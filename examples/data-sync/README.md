# Incremental data synchronization — Viat 1.1.0

[简体中文](README.zh-cn.md) · [Complete English guide](../../src/content/docs/en/applications/data-sync.md)

A deployable workflow, authenticated endpoint and **disabled** hourly schedule. An inert local adapter reads an append-only SQL change log, performs deterministic versioned upserts/tombstones and advances a durable checkpoint only after a whole page succeeds. Source/sink/checkpoint intentionally share one dedicated SQLite resource; this is not a cross-service transaction or a claimed ERP connector.

## Run only local unit validation by default

From this directory:

```sh
python3 -I validate.py
```

The standard-library validator loads **actual deployable** `project/scripts/setup.py` and `sync_batch.py`, running their SQL on temporary SQLite with fake Viat context. It checks failure before checkpoint, rollback/restart, final fixture rows, replay without regression and concurrent callers. It does not execute the YAML engine, scheduler, HTTP or real broker. The coordinator ran it successfully through the offline harness with network and subprocess calls blocked.

`fixtures/input.json` and `fixtures/expected.json` define exact pages and final state. Full schema/seed are in deployable setup, not a duplicated toy model. `case.json` pins server 1.1.0. No additional Python package is required.

## Deployment prerequisites

Follow the guide for matching CLI/server, activated non-production instance, login, **new isolated** project `example-data-sync`, API-key authorizer/user, dedicated server SQLite mount under `VIAT_SQLITE_ROOTS`, and explicit initialization. Change the resource path first. Run from `project/` only after those approved steps:

```sh
viat push --only resources,scripts,workflows,schedules,endpoints
viat script run setup --args '{"confirm":"data-sync-isolated-db"}'
```

Keep `--only`: excluding `meta` preserves the separately provisioned authorizer; trigger/endpoint kinds still mirror within their scopes, so do not reuse an existing project. Endpoint target uses `ref`, schedule target `name`. Push does not publish or execute setup. No schedule is enabled automatically.

## Limits, recovery and cleanup

Batch size is integer 1–100, default 2. Durable cursor and source sequence require append-only **committed-order visibility**; late edits below checkpoint are unsupported. Source/sink share SQLite BEGIN IMMEDIATE, so one failed page rolls back entirely; external adapters need downstream idempotency/outbox/reconciliation rather than fictional distributed atomicity. Compensate with new higher-sequence events, not history edits.

The guide includes expected page/row assertions, opt-in schedule enabling, errors/permissions, quiescence and exact cleanup. Delete only `sync-hourly`, recorded endpoint/key **row UUIDs**, and owned user/authorizer/workflow/scripts/resource in the new project. Resource deletion leaves the file; separately remove only the exact new file/sidecars after retention/dependency checks. Project DELETE is unsupported in 1.1.0. Only coordinator offline unit validation has passed; real HTTP/broker/scheduler acceptance, deployments, services, network calls and cleanup remain unverified.
