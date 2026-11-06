---
title: "Complete CLI reference"
description: "All 144 Viat 1.1.0 CLI commands: grammar, permissions, outputs, effects and recovery."
doc_id: cli.overview
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# Complete CLI reference

This reference targets stable server/CLI 1.1.0: the pinned Clap contract has 171 nodes and 144 leaf commands. Structure comes from contracts/1.1.0/cli.json; behavior was checked against CLI, repo-sync and API permission implementations (feature source 03751a67, release version commit fd340879), not preview branches or archived plans. CLI and desktop/mobile marketing versions are independent.

## Command groups

- [viat apikey](apikey.md) — 3 leaf commands
- [viat audit](audit.md) — 2 leaf commands
- [viat auth](auth.md) — 6 leaf commands
- [viat authorizer](authorizer.md) — 5 leaf commands
- [viat authz](authz.md) — 2 leaf commands
- [viat db](db.md) — 4 leaf commands
- [viat endpoint](endpoint.md) — 12 leaf commands
- [viat files](files.md) — 4 leaf commands
- [viat license](license.md) — 2 leaf commands
- [viat logs](logs.md) — 4 leaf commands
- [viat p-user](p-user.md) — 11 leaf commands
- [viat project](project.md) — 10 leaf commands
- [viat publish](publish.md) — 5 leaf commands
- [viat resource](resource.md) — 9 leaf commands
- [viat role](role.md) — 5 leaf commands
- [viat schedule](schedule.md) — 8 leaf commands
- [viat script](script.md) — 12 leaf commands
- [viat push / pull / export / import](sync.md) — 4 leaf commands
- [viat testcase](testcase.md) — 8 leaf commands
- [viat tree](tree.md) — 5 leaf commands
- [viat user](user.md) — 14 leaf commands
- [viat version / call / mcp](utilities.md) — 3 leaf commands
- [viat workflow](workflow.md) — 6 leaf commands

## Installation, version and local prerequisites

Use the released 1.1.0 viat binary on PATH. The official macOS app bundles viat, viat-test-host and viat-endpoint-test-host in Viat.app/Contents/MacOS; after installing the app, Resources/install-cli.sh can install sibling links (this reference performs no installation). Local test hosts must match the exact CLI version; language tools such as uv/bun/cargo are not automatically supplied by the CLI. Start with viat --version (local); use viat version for server comparison. --version success does not prove login/server readiness.

## Session, directory and network conventions

Session lookup: VIAT_CONFIG_DIR (the config directory itself) → upward search from CWD for a .viat actually containing config.yaml → CWD/.viat. config.yaml contains server_url, access_token, refresh_token, refresh_expires_at, current_project, project_token and legacy token. access_token takes precedence over token. Protect this credential-bearing file and never commit it. Login/refresh writes configuration; ordinary control-plane requests can refresh once on 401, retry once, and persist rotated tokens. Re-login when refresh is unavailable.

Session discovery does not change CWD: push/pull/project diff/db still use the current directory as repo root. There is no global --server or --json; use only flags declared on each leaf. -h/--help and root -V/--version print and exit 0; invalid syntax usually exits 2 before API work. “No explicit default” in the table describes Clap, not the absence of the runtime/API defaults explained below.

Ordinary CLI HTTP honors HTTP_PROXY/HTTPS_PROXY/ALL_PROXY; for localhost use NO_PROXY=localhost,127.0.0.1 or VIAT_NO_PROXY=1 to bypass every proxy. Plain viat call and MCP always bypass proxies; call --console instead uses the ordinary refreshing client and proxy settings.

## Identity, permission and result boundaries

A platform account’s role is not its project membership role, nor a project p-user/role. Effective project roles are owner/admin/developer/operator: editor means the first three; publisher means only the first two. Exceptions are documented per command: role/authorizer/apikey/p-user/tree/endpoint reads require editor; schedule writes need membership; project publish history needs membership whereas endpoint history needs publisher. Permissions come from actual API guards, not verb names.

Control-plane requests normally use platform login/PAT (auth token management and platform MFA reset require a login session); runtime call uses separately stored project_token, which login does not mint automatically. Unactivated deployments can return 403 license_required; switching project/role does not activate them. Auth/license entry points remain available, but MCP startup/tool listing does not prove its remote calls are usable.

Normal completion exits 0; runtime/file/HTTP failures usually 1. Each leaf below states diff, empty-success, streaming and test-result exceptions. API non-2xx commonly appears as HTTP &lt;status&gt;: &lt;body&gt;, with directed remedies for license_required/rate_limited/forbidden. Output is not uniform: --json exists only where declared; resource set-field --json parses input; push/pull --json may mix stage text; call prints status+body; apikey create prints a one-time secret. Do not automatically map text “FAILED”, output:null or startup success to a particular exit code/HTTP outcome.

## Preparing and cleaning up synthetic examples

These are syntax examples for an isolated instance; documentation scripts do not execute them. Account/password/email values are synthetic, not shipped credentials; you must have an authorized platform account. Substitute your isolated instance/account and run only after explicitly opting into remote mutations.

```sh
viat auth login --server http://127.0.0.1:28080 --email operator@example.invalid --password demo-only-not-a-real-password
viat project create cli-demo "CLI Demo"
viat project select cli-demo
viat project list --json
```

Object IDs come from the server. Example UUID 00000000-0000-4000-8000-000000000001 is a syntactically valid synthetic placeholder; replace it with the actual demo UUID from that project’s list/create response before show/delete/revoke. Do not mix request_id, execution_log_id, endpoint ID, snapshot ID, revision ID, file ID or the API key’s short key_id. Group pages supply local-file and remote-object prerequisites. license activate cannot succeed with a fake code: obtain an official valid customer code.

The single argv source is examples/cli-argv.json (array of token arrays, argv[0]=viat), generated from the same data as the pages. It is for syntax validation only, not an execution loop: delete/rollback/trigger/baseline must not be run in manifest order. Authorize reads, writes, execution and publish separately; real providers, paid calls, message sends, device actions and live cleanup require separate explicit opt-in.

Each section explains verification and cleanup. Keep previous source/config/database backups; remote multi-stage commands are generally not globally transactional. In 1.1.0 there is no project delete CLI or management DELETE route; do not invent a console/API removal entry point. Clean up owned assets, triggers and memberships through supported operations, leaving the empty project. External DBs, buckets, files and sent messages need separate handling. Check paths before deleting generated local fixtures/exports and revoke demo tokens separately.

## Unsupported or nonexistent command spellings

There is no project push, tokens create, push --prune, global --json or retired endpoint --permissions. Use viat push and viat auth token create; --prune belongs to import only. CLI/MCP intentionally do not mirror all console settings/APIs; a schema does not imply a command exists.

## Maintenance evidence

Pinned grammar: `contracts/1.1.0/cli.json`; `crates/viat-cli/src/main.rs`. Common client/config: `crates/viat-cli/src/{client,config,pathref}.rs`. Role definitions: `crates/viat-core/src/types/project.rs:5–24`. Group pages list behavioral evidence; source paths are maintenance evidence, not a substitute for the instructions above.
