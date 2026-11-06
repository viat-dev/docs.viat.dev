# SQL reports and opt-in SMTP — Viat 1.1.0

[简体中文](README.zh-cn.md) · [Complete English guide](../../src/content/docs/en/applications/reports.md)

A full pushable project: SQL aggregate → deterministic text report → **optional** SMTP submission. Workflow/HTTP input and the disabled UTC schedule all default `send:false`. Report persistence is real; default notification is not a send. The SMTP resource describes an operator-approved capture relay but does not start one.

## Local unit validation

From this directory:

```sh
python3 -I validate.py
```

Standard-library validation imports the **actual deployable** setup, builder and notifier, executes their SQL against temporary SQLite and uses fake Viat/SMTP objects. It checks exact aggregate/window bounds, no-send default, invalid inputs/limits, immutable reports, durable claim/dedup, unknown SMTP outcome and failed acknowledgement after fake relay acceptance. **No email is sent.** It does not verify real HTTP, YAML execution, RPC, cron or relay delivery. The coordinator ran this validator successfully through the offline harness with network and subprocess calls blocked.

`fixtures/input.json` is a fixed synthetic date window; `fixtures/expected.json` is the complete workflow result. Schema and seed are in `project/scripts/setup.py`; `case.json` pins server 1.1.0. No third-party Python dependency is needed.

## Approved deployment only

Follow the complete guide for new `example-reports` project, versions/login/permissions, authorizer/user/API key, a dedicated single-node SQLite file under `VIAT_SQLITE_ROOTS`, path configuration, setup, publish and assertions. From `project/` after those steps:

```sh
viat push --only resources,scripts,workflows,schedules,endpoints
viat script run setup --args '{"confirm":"reports-isolated-db"}'
```

Do not omit `--only`: minimal metadata must not prune the separately created authorizer. Kind-level mirroring is not safe against an existing project. Endpoints use `target.ref`; schedules use `target.name`. Push does not publish or execute setup. Never enable the schedule or run SMTP Test/send as part of default validation.

## Limits and recovery

Canonical UTC [start,end) windows are 1–31 days, previous UTC day when both inputs are empty. Limits: 10000 rows, 65536 text bytes, integer cents, separate CNY/USD totals. First build freezes content under its version/window key; late-data corrections need deliberate new report identity. All source timestamps must be canonical fixed-width UTC text.

A committed delivery claim precedes SMTP. Accepted, sending and uncertain states block automatic replay; crash/timeout can require manual relay reconciliation. Acceptance is not inbox delivery, and SMTP+DB are not atomic. The guide provides opt-in capture-relay setup, exact per-report/attempt recovery conditions and owned-object cleanup. Retain evidence and never clear all claims to retry.

Clean only recorded endpoint/key **row UUIDs**, `report-daily` and the new project's exact owned assets; resource deletion leaves SQLite files and cannot recall mail. Project DELETE is unsupported in 1.1.0. Only coordinator offline unit validation has passed; real HTTP/broker/SMTP/scheduler acceptance, services, deployments, SMTP/network calls and cleanup remain unverified.
