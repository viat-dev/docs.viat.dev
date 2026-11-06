---
title: Verification status and reproducible checks
description: Distinguish completed local documentation and example checks from unverified provider, device and production release acceptance.
doc_id: reference.validation
verified_release: '1.1.0'
channel: stable
---

# Verification status and reproducible checks

This handbook is a **local reconstruction candidate**, not an announced production documentation release. Coverage, a successful build, unit assertions, actual server integration and external-provider acceptance are different evidence. The checks below describe the current candidate; changing source, contracts or examples requires rerunning the relevant checks.

## What has been exercised

| Layer | Evidence | What it does not prove |
| --- | --- | --- |
| Bilingual structure | Both locales cover the required topic/contract inventory; paired metadata, source links/anchors, JSON fences and marked shared snippets are checked. | Semantic completeness of every sentence or provider policy. |
| Website/offline output | Astro static build, raw Markdown, LLM indexes, public-path/privacy-pattern checks, mdBook and local links/assets under `/_docs/` and `/viat/_docs/`. Example sources are allowlisted in both outputs. | Browser interactions on every device, production hosting/DNS or manual privacy review. |
| CLI syntax | Actual Clap parser accepted 385 distinct collected/explicit token fixtures, including reviewed redirections. No CLI commands are dispatched by this check. | Actual shell redirection, files, credentials, remote effects or every inline command fragment. |
| Workflow grammar | All six application workflow definitions passed the actual runtime `parse` and `validate` functions. | Named asset resolution, scheduling or successful workflow execution. |
| MCP wire contract | Real stdio tests passed: initialize, all 46 tools, JSON text-block success and `isError` failure envelopes. | Every handbook request/expected value or every tool's provider effects. |
| First endpoint | Real built CLI → isolated PostgreSQL/API → Python draft and published HTTP execution → logs → unpublish/delete. | Customer activation, MFA/SSO or external resources. |
| CMS | Real CLI push, policy engine, separate temporary business PostgreSQL/login and Python worker. Anonymous, reader, other-author and forged-field failures; editor publication; draft/public isolation; duplicate conflict; owned cleanup. | Tenant isolation, production recovery/load or arbitrary SQL security. |
| Eight application unit suites | Executed actual deployable functions/shared modules with explicit fake contexts and local temporary data. All eight validators passed without network/process calls. | Real broker, scheduler, provider or device behavior. |

Application-unit boundaries:

- **Paper digest:** feed parsing, citation checks, gated actions and local claim-state behavior; no paid model, live feed or real delivery.
- **Home Assistant:** identity/action/entity allowlists and opt-in behavior; no actual home-device action or Home Assistant state confirmation.
- **Weixin assistant:** direct-chat handler and binding/sender checks with synthetic input; no QR login, connector polling, provider reply or reauthentication performed.
- **CMS:** pure policy callback logic also has the separate real-stack acceptance above.
- **Lab jobs:** state transitions, duplicates/out-of-order handling and dry-run traps; actual synthetic adapter/workflow/callback integration remains separate.
- **Webhook ingestion:** exact-byte signatures through a test substitute, SQLite ledger/projection atomicity and duplicate cases; actual HTTP/raw-body/crypto-broker admission not established by that unit test.
- **Data sync:** local cursor/upsert/checkpoint/rollback behavior; not a distributed transaction with remote systems.
- **Reports:** SQL/window/claim behavior and fake-relay assertions; no actual SMTP submission or delivery.

## Reproduce local checks

From an authorized documentation checkout with its documented Node/Python prerequisites:

```sh
npm ci
npm run build
npm run validate:examples
npm run build:book
npm run collect:cli
```

`validate:examples` blocks accidental network/process calls in the application-unit harness. That guard is not a sandbox for hostile code. Separate `acceptance.py` or adapter programs require their explicit opt-in flags, isolated prerequisites and deliberate operator action; the default command never starts them.

The CLI collector writes token arrays and a report under `exports/`. Review unresolved shell cases; do not count an omitted command as passed. Supply the arrays to the product's developer-only exporter:

```sh
scripts/export-doc-contracts.sh --output /tmp/handbook-contracts \
  --examples "$DOCS_CHECKOUT/exports/cli-examples.json"
```

Run that command in the product checkout with its compile/test database configured. It parses arguments without dispatching any command or loading an operator's CLI config.

The product's ignored cross-repository acceptance tests require explicit `DOC_EXAMPLE_ROOT` and `DOC_EXAMPLE_CLI`, a built matching CLI, uv/Python, and a dedicated test PostgreSQL administrator. They use test license state rather than vendor signing material. CMS additionally creates a random isolated business database/login, records ownership and cleans only those objects. Missing prerequisites fail an explicitly requested acceptance test; they are not silently turned into success.

## Still required before publication

- Finish semantic/security review and address confirmed findings; retain limitations rather than hiding them behind a green parser result.
- Validate remaining real broker/provider/device integrations only with approved isolated infrastructure. Do not send messages, incur model charges, control devices or perform real cleanup by default.
- Verify browser search/language switching, full offline-product synchronization and legacy paths against the chosen release artifact.
- Fix the documentation/product source to clean reviewed commits and record matching evidence/digests. Dirty contract exports remain candidates.
- Obtain explicit approval for repository publication, hosting, Cloudflare/DNS changes and production rollout.

`publication_ready` remains false until the release gates are satisfied. A successful local preview or complete inventory does not authorize flipping it, and `npm run check:release` is expected to reject an incomplete acceptance record.
