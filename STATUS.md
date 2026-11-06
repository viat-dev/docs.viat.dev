# Handbook reconstruction checkpoint

GitHub Pages publication has been authorized for this explicitly labeled
candidate, not as a fully accepted release. The repository's Pages workflow
records deployment status. Product-source changes remain in their separate
worktree; domain DNS changes are managed by the operator.

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
