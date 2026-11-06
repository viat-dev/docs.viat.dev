---
title: "CLI: db"
description: "Complete Viat 1.1.0 db grammar, per-command permissions, outputs, effects and recovery."
doc_id: cli.db
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.db.baseline","cli.db.migrate","cli.db.repair","cli.db.status"]
---

# CLI: db

Read the [CLI overview](overview.md) for session/CWD resolution, exit conventions, role boundaries, synthetic IDs and execution authorization. This page documents leaf-specific exceptions; the commands are not a script to run in order.

- [viat db baseline](#viat-db-baseline)
- [viat db migrate](#viat-db-migrate)
- [viat db repair](#viat-db-repair)
- [viat db status](#viat-db-status)

## Synthetic fixtures and execution boundary

These files supply inputs for the examples. Provision an isolated project and explicitly authorize remote creation, script execution, SQL or storage effects before running any command. Documentation generation executes none of them.

```sql
-- migrations/demo_db/0001_demo.sql; isolated PostgreSQL/MySQL/SQLite only
CREATE TABLE cli_demo (id INTEGER PRIMARY KEY);
```

Provision and back up a writable isolated demo_db resource first. Baseline is only for a schema already exactly matching the file; repair is only for an actually failed row you have manually repaired. These four commands are not a sequence to execute blindly. Dropping the demo table requires a separately reviewed and authorized new migration; this page executes no SQL.

## viat db baseline

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin; Developer/Operator cannot publish. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat db baseline --through <THROUGH> <RESOURCE>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `resource`: `<RESOURCE> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `through`: `--through` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["resource","through"],"id":"Baseline","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Marks every local file through required --through ID as already applied without running SQL. For an existing schema that exactly matches those files; not a way to hide drift. Requires writable supported resource DB and matching local files.

**Actual output and exit.** Text reports baselined count/resource; writes ledger and stored checksums, not business DDL. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat db baseline demo_db --through 0001_demo
```

**Failure handling, verification and cleanup.** Missing through file/refused ledger conflict fails. Verify schema separately BEFORE baseline, then db status. Wrong baseline requires deliberate DB ledger recovery with backups; no unbaseline CLI.

## viat db migrate

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin; Developer/Operator cannot publish. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat db migrate [OPTIONS] [RESOURCE]
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `allow_out_of_order`: `--allow-out-of-order` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | help: Apply a pending file even if it sorts before one already applied |
| `dry_run`: `--dry-run` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | help: List what would run, run nothing |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `resource`: `<RESOURCE> (#1)` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default ; runtime: `all discovered migration directories` | — | — |

Clap argument groups (literal metadata): `{"arguments":["allow_out_of_order","dry_run","resource"],"id":"Migrate","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Applies pending SQL files in lexical ID order, stopping on first error. Refuses changed applied files, any failed ledger row, or out-of-order files unless --allow-out-of-order. --dry-run reads/plans only (editor suffices); absent resource means all discovered directories. No directory returns successful no-op before login.

**Actual output and exit.** Text: would apply/up to date/applied with duration/already applied. Actual changes run with held resource credentials. PostgreSQL/SQLite pair each file and ledger transaction; MySQL DDL auto-commits and can leave partial state/failed row. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat db migrate demo_db --dry-run
```

**Failure handling, verification and cleanup.** Use only isolated authorized DBs for examples. Timeout/connection loss may leave SQL running: inspect status before retry. Dry-run ledger reads do not initialize ledger tables. Back up first; rollback is a NEW reviewed migration/manual DB repair, not a CLI down command. Push never runs this for you.

## viat db repair

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin; Developer/Operator cannot publish. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat db repair <RESOURCE> <ID>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `id`: `<ID> (#2)` | `String`, 1, `Set` | yes; no explicit Clap default | — | help: The migration's id (the file's stem) |
| `resource`: `<RESOURCE> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | help: The resource (as under migrations/, e.g. `db` or `lab/db`) |

Clap argument groups (literal metadata): `{"arguments":["id","resource"],"id":"Repair","multiple":true,"required":false}`

**Inputs, behavior and side effects.** After MANUAL repair of a partially applied MySQL file, clears only its failed ledger row so next migrate can rerun the entire file. Never clears an applied row; not an automatic SQL repair.

**Actual output and exit.** Text: cleared the failed row ... or server result; changes ledger state only. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat db repair demo_db 0001_demo
```

**Failure handling, verification and cleanup.** Confirm actual DB state and idempotency before clearing, else re-run can duplicate DDL/data. Missing/nonfailed row may refuse/no-op per response; verify db status, retain diagnostics/backups and apply corrected recovery deliberately.

## viat db status

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat db status [RESOURCE]
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `resource`: `<RESOURCE> (#1)` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default ; runtime: `all discovered migration directories` | — | help: One resource (as under migrations/, e.g. `db` or `lab/db`); all if omitted |

Clap argument groups (literal metadata): `{"arguments":["resource"],"id":"Status","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Discovers CWD migrations/<folder/resource>/*.sql and compares each file’s checksum with the resource DB ledger. Resource omitted means all discovered resources. Supports PostgreSQL/MySQL/SQLite, not platform migrations or SQL Server. No migrations directory is an early successful no-op even without login.

**Actual output and exit.** Text: applied/baseline/pending/CHANGED/FAILED and ledger-only rows. Changed/failed rows are reported, not themselves a nonzero status command result. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat db status demo_db
```

**Failure handling, verification and cleanup.** Needs readable SQL files and reachable existing resource DB. Ledger reads never create the ledger table; a database with no prior migration returns an empty ledger. Restore changed applied files; add a new corrective migration, never edit applied history. No destructive cleanup is automatic.

## Implementation evidence

Grammar comes from the pinned Clap contract and main.rs; behavior/permissions were checked against these files. Paths are relative to the product repository root.

- `crates/viat-cli/src/commands/db.rs`
- `crates/viat-api/src/handlers/db_migrations.rs`
- `crates/viat-runtime/src/db_migrate.rs`
