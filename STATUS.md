# Handbook reconstruction checkpoint

GitHub Pages publication has been authorized for this explicitly labeled
candidate, not as a fully accepted release. The repository's Pages workflow
records deployment status. Product-source changes remain in their separate
worktree; domain DNS changes are managed by the operator.

## Readability restructure (2026-11-07, phase 1)

The handbook is being rewritten in a task-first, screenshot-paired style with
implementation tabs (Console/CLI/env), per `AUTHORING.md`. Phase 1 landed:

- Plain-Markdown tabs (`:::tabs` / `::tab 标签`, blank-line separated): the
  website renders a real tab widget (`scripts/lib/tabs-remark.mjs` +
  DocContent script/styles; groups with the same `id` share the visitor's
  choice); the offline mdBook export degrades them to bold labelled sections
  (`scripts/lib/tabs.mjs`), so no content is MDX- or script-dependent.
  `check-content` validates the marker syntax; tests cover the plugin, the
  book conversion and asset-link rules.
- Screenshot/diagram pipeline: assets live in `public/screenshots/<locale>/`
  and `public/diagrams/`; link checks verify existence, the mdBook export
  copies them and rewrites to relative paths. 28 console screenshots (zh-cn +
  en) were regenerated from a local synthetic instance via
  `npm run dev:capture` (Playwright, local fixtures only — no real
  credentials, tokens or customer data; activation shots come from a second,
  deliberately unactivated stack). Concept diagrams are hand-authored SVGs.
- Pilot rewrites in the new style, both locales: `index`, `overview/concepts`,
  `getting-started/first-endpoint`, `installation/docker-compose`,
  `instance/activation`. Commands, expected outputs, fixture snippets and
  failure tables are unchanged facts; prose was restructured, caveats moved
  into GFM alert blocks, acceptance narration folded into a closing note.
- Local regeneration helpers under `scripts/dev/` (instance enablement for
  screenshots, capture, tabs debugging) — operator tooling, not customer
  procedures; vendor key material is read in-process and never printed.

Phase 2 (same day): publishing trio (snapshots/promotion/rollback), testing
trio (endpoint-tests/fixtures/saved-cases) and projects trio
(create-and-collaborate/repo-sync/settings) rewritten in both locales — same
rules: facts/commands/tables frozen, voice restructured, caveats moved into
GFM alerts, trailing evidence paragraphs normalized into the auto-hidden
`## 核验依据` section. Step 3 of create-and-collaborate now uses a
Console/CLI tab group. Subagent spawning is blocked by the session permission
gate, so batches are written serially by the coordinator.

Phase 3 (same day): overview/platform + overview/capabilities, the
**entire triggers section** (13 pages), the **entire configuration
section** (8 pages), the **entire operations section** (11 pages), the
**entire auth section** (7 pages) and every remaining narrative section —
instance (2), installation (2), clients (2), api (1), reference (4) —
rewritten in both locales under the same rules. Trailing evidence
sections normalized to the auto-hidden heading throughout.

Phase 4 (same day, leaf references via generators): the CLI, MCP and
resource reference **generators** now emit the standard auto-hidden
`## 核验依据`/`## Verification basis` heading (resource pages keep a
visible "Related resources" link section, provenance moved under the
hidden heading). Regenerating produced the updated pages mechanically
(`npm run generate:references`); assets/scripts and workflow-step pages
already end in reader content and need no change. mcp/overview.md was
hand-split: a visible "known discrepancies" note (Editor-read rights,
read_script 409/folder behavior) plus the hidden evidence section.

Phase 5 (same day): the eight application pages' mixed endings were
split per page — related-page links and "still unverified" boundaries
stay visible; source-path provenance moved under the auto-hidden
`## 核验依据`/`## Verification basis` heading. With this, **every page in
the handbook now follows the restyle contract**: evidence is hidden from
rendered output, kept in source and raw Markdown.

Remaining: only the post-unslop pass — re-run `npm run dev:capture`
against the restyled console, refresh the 28 screenshots, and review any
console-flow wording that the new UI invalidates.

## Implemented

- 386 bilingual Markdown pages (193 pairs); each locale covers 310/310 required
  topic/contract IDs. These are coverage counts, not proof of every behavior.
- Full 20-resource, 9-language, 7-workflow-step, 144-CLI-leaf and 46-MCP-tool
  references, plus installation, configuration, administration, identities,
  triggers, testing/publication, operations, API/client and validation guides.
- Eight complete application directories with pushable project files, fixtures,
  safe defaults, bilingual instructions and offline validators. Source files
  are downloadable from both website and offline-book output.
- Static site, raw Markdown/LLM indexes, contract imports/digests, source/privacy
  allowlists, translation/link/snippet checks, and same-source mdBook export.
- Product-side exporter, stronger documentation pins, retained-book corrections
  and opt-in real handbook acceptance tests live on the separate product
  documentation branch. The original Widget worktree remains unchanged.

## Verified locally

- Documentation build and 25 tooling tests passed, including evidence-staleness
  and GitHub Pages project-prefix/root-domain URL regressions.
- 401 offline HTML pages, both `/_docs/` and `/viat/_docs/` mount paths, example
  files, internal links/anchors/assets and no external script/stylesheets passed.
- All eight offline application validators passed. These use fake contexts and
  local temporary data, not real providers/devices.
- Real first-endpoint and CMS CLI/API/PostgreSQL/authz/worker acceptance passed,
  including the CMS permission/publication matrix after review fixes.
- Six workflows passed the actual runtime parser and semantic validator.
- 385 distinct CLI token fixtures passed actual Clap parsing; all 20 collected
  shell-redirection occurrences have reviewed token fixtures. Shell effects and
  inline command fragments are not thereby executed or fully validated.
- Actual MCP stdio initialization/46-tool inventory and success/error framing
  tests passed.
- Latest full source workspace: 3486 passed, 6 ignored, `--workspace -j 8
  --retries 0 --no-fail-fast`. The three handbook ignored tests were separately
  opted into and passed; the other three remain pre-existing ignored tests.

`contracts/acceptance.json` records scoped passed/partial evidence and content
fingerprints. `publication_ready` remains false, source provenance remains dirty
and candidate, and release checks deliberately reject incomplete acceptance.

## Review outcome

`code-review high` on examples returned six findings. Five were fixed with
regressions: cross-origin redirect credential forwarding, Home upstream-error
body disclosure, validator bytecode pollution, unnecessary read locks, and
adapter SQLite connection lifetime. The suggested single authorization check
for the CMS list was not applied: per-row object-aware checks must honor live
object-dependent policy changes. The bounded RPC cost and whole-list refusal
behavior are documented instead of introducing a policy bypass.

## Product-source sync checkpoint (2026-11-11)

Product main moved past the pinned baseline (`inspected_main` 03751a67).
Nothing below is in a released artifact, so no stable page changes with this
entry — it records what the next contract refresh and release cycle must pick
up.

- Widget snapshot push was redesigned **before release**: deployment-level
  APNs profiles keyed by the receiving app's bundle id (Owner-only
  `/admin/widget-push/profiles`, subscription declares `(bundle,
  environment)`, client bakes the environment at build time), replacing the
  per-project `push` resource binding. The `widget.apns-snapshots` preview
  entry in `contracts/manifest.json` still cites the superseded b3c3ae9b
  shape; refresh it at the next contract export rather than documenting the
  old design.
- Bundles can now carry sealed secrets: `viat export --with-secrets` /
  `viat import` (one-time key printed at export, piped on stdin at import;
  Owner-only audited `POST /projects/{slug}/secret-export`), covering
  resource secrets and oauth_oidc/social authorizer secrets. New CLI flags
  `--with-secrets` / `--publish` make `contracts/1.1.0/cli.json`'s flag
  inventory stale until the next refresh.
- The product repository removed its reader-facing `docs/`, the Dockerfile
  mdbook stage, the ci docs-book job and the config.rs doc-pin tests (PR
  viat-dev/viat#25): this handbook is now the only documentation home, and
  the product's `/_docs` endpoint + `VIAT_DOCS_DIR` remain as the mount point
  for this repository's offline mdBook export. Consequently item 4 below
  ("do not replace the product's current book or disable its pins") becomes
  obsolete once that ships — the standing rule is to pin an accepted export
  artifact, never a live website build.

## Remaining before production publication

1. Browser-level search/language-switch/interaction acceptance. The build still
   reports Starlight's default missing custom 404-entry warning; mdBook reports
   a roughly 14 MB search index. Neither is a failed build, but offline search
   size/language behavior deserves browser validation.
2. Remaining real broker/resource/backend and application integrations. Lab
   adapter/workflow, actual webhook admission/crypto RPC, SMTP, model calls,
   Home Assistant actions and Weixin QR/poll/reply remain explicitly unverified.
   External actions require their prerequisites and deliberate authorization.
3. Final semantic/bilingual and public-output review beyond automated scans.
4. Version-pinned product-book synchronization and complete old-link/anchor
   compatibility. Do not replace the product's current book or disable its pins
   merely because the new standalone export builds.
5. Clean reviewed product-source provenance and refreshed contract/evidence
   hashes before a fully accepted release. Candidate documentation publication
   is authorized; this does not authorize a product release or DNS edits.

## Commands

```sh
npm run check
npm run build
npm run validate:examples
npm run build:book
npm run collect:cli
node scripts/check-content.mjs --release  # expected to fail while candidate
```

Use the product repository's documented PostgreSQL/nextest workflow for source
checks. Do not use a developer application database for example acceptance or
execute the CLI token inventory as a shell script.
