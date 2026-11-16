---
title: Verification status and reproducible checks
description: Distinguish completed local documentation and example checks from unverified provider, device and production release acceptance.
doc_id: reference.validation
verified_release: '1.1.0'
channel: stable
---

# Verification status and reproducible checks

This handbook remains a **local reconstruction candidate** — not an
announced production documentation release. Coverage, a passing build,
unit assertions, real server integration and external-provider
acceptance are **different tiers of evidence**. The checks below
describe the current candidate; changing source, contracts or examples
requires rerunning the relevant checks.

## Checks already executed

| Tier | Evidence | Does not prove |
| --- | --- | --- |
| Bilingual structure | Both languages cover the required topic/contract inventory; paired metadata, source links/anchors, JSON blocks and marked shared snippets are checked | Per-sentence semantic completeness or provider policy |
| Online/offline artifacts | Astro static build, raw Markdown, LLM indexes, public-path/privacy-pattern scans, mdBook, plus local links/assets under `/_docs/` and `/viat/_docs/`; both artifacts carry the allowlisted example sources | Browser interaction on every device, production hosting/DNS or a manual privacy review |
| CLI syntax | The real Clap parser accepts 385 deduplicated collected/explicit token fixtures including reviewed redirections; **commands are never dispatched** | Shell redirection, real files/credentials, remote side effects or every inline command fragment |
| Workflow syntax | Six application workflow definitions pass the real runtime's `parse` and `validate` | Named-asset resolution, scheduling or actual run success |
| MCP transport protocol | Real stdio tests cover initialization, the 46-tool inventory, JSON text success and the `isError` failure envelope | Every manual request/expected value or each tool's provider side effects |
| First endpoint | A really built CLI → isolated PostgreSQL/API → Python draft and published HTTP execution → logs → unpublish/delete | Customer activation, MFA/SSO or external resources |
| CMS | Real CLI push, the authorization engine, a separate temporary business PostgreSQL/login role and Python worker; covering anonymous, reader, other-author and forged-field rejection, editor publishing, draft/public isolation, duplicate conflicts and own-object cleanup | Tenant isolation, production recovery/load or arbitrary raw-SQL safety |
| Eight application unit suites | Executing the real deploy functions/shared modules with explicit fake contexts and local temporary data; all eight validators pass with **no network/subprocess calls** | Real brokers, schedulers, providers or device behavior |

Application unit-check boundaries:

- **Paper digest**: feed parsing, citation checks, action toggles and
  local claim state; no paid models, live feeds or real delivery.
- **Home Assistant**: identity, actions, entity allowlists and explicit
  enablement; no real home devices touched and no actual Home Assistant
  state confirmed.
- **WeChat assistant**: direct-chat handler, binding and sender checks
  under synthetic input; no QR login, connector polling, real replies or
  reauthentication executed.
- **CMS**: beyond the pure policy-callback logic, the real-stack
  acceptance in the table above.
- **Lab jobs**: state transitions, duplicate/interleaved handling and
  dry-run traps; real local adapter/workflow/callback integration needs
  separate verification.
- **Webhook ingestion**: exact byte signatures, SQLite ledger/projection
  atomicity and duplicate handling under test doubles; **does not**
  prove real HTTP/raw-body/crypto-broker admission.
- **Data sync**: local cursor/upsert/checkpoint/rollback — not a
  distributed transaction across external systems.
- **Reports**: SQL, windows, claims and fake-relay assertions; no real
  SMTP submission or delivery.

## Reproducing the local checks

In an authorized documentation checkout, with the specified Node/Python
prerequisites:

```sh
npm ci
npm run build
npm run validate:examples
npm run build:book
npm run collect:cli
```

- `validate:examples`' application unit host intercepts unexpected
  network/subprocess calls — but it is **not** a malicious-code sandbox.
  Standalone `acceptance.py` or adapter programs require their own
  explicit enablement flags, isolated prerequisites and an operator
  decision; the default commands start **none** of them.
- The CLI collector writes token arrays and a report into `exports/`;
  review unresolved shell cases — a missing command **never counts** as
  passing. Hand the arrays to the product's developer exporter:

```sh
scripts/export-doc-contracts.sh --output /tmp/handbook-contracts \
  --examples "$DOCS_CHECKOUT/exports/cli-examples.json"
```

  That command runs inside the product checkout with a configured
  compile/test database; it parses arguments only, dispatches no
  commands and reads no operator CLI configuration.
- The product's default-ignored cross-repository acceptance tests
  require explicitly provided `DOC_EXAMPLE_ROOT`, `DOC_EXAMPLE_CLI`, a
  built matching CLI, uv/Python and a dedicated test PostgreSQL
  administrator; the tests use test-license state and need no vendor
  signing material. CMS creates an additionally randomized business
  database/login role, registers ownership and cleans only those
  objects. With acceptance explicitly requested, missing prerequisites
  **fail** rather than silently passing.

## Still required before formal release

- Complete the semantic/security review and fix confirmed issues —
  parser green **never masks** known limits.
- Verify remaining broker/provider/device integrations only on approved
  isolated infrastructure; no default message sending, model costs,
  device operations or real-data cleanup.
- Verify browser search/language switching, complete offline product
  sync, and old-path compatibility of the chosen release artifacts.
- Pin documentation/product to clean reviewed commits and record
  matching evidence and digests; dirty exports remain candidates.
- Repository publication, hosting, Cloudflare/DNS changes and
  production go-live need explicit approval.

Until the release gate passes, `publication_ready` stays false: a
successful preview or a complete checklist **authorizes no** flag
change, and `npm run check:release` must reject incomplete acceptance
records.
