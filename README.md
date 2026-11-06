# Viat product handbook / Viat 产品手册

The bilingual source for **docs.viat.dev** and Viat's release-pinned offline
handbook. This is a documentation repository, not the Viat server.

**Status: reconstruction preview, not a complete documentation release.**
The coverage inventory tracks every required reference; coverage and execution
acceptance are separate gates. A successful preview build does not establish
that every application path or provider integration has been exercised. See `contracts/manifest.json` for provenance
and use the inventory command below to see the remaining coverage.

本仓库维护中英文产品手册。当前仍在重建，预览构建成功不等于全部参考、案例或外部集成
已经验收。未写完的章节由覆盖清单记录，不用空页面冒充完整文档。

## Local preview / 本地预览

Use the Node version in `.node-version` and Python 3 (standard-library-only CLI
lexing tests and example validation), then:

```sh
npm ci
npm run check
npm run build
npm run preview
```

`npm run dev` is for editing. The static output is `dist/`; it contains the
website, per-page raw Markdown, language/task LLM indexes and an allowlisted
copy of the pinned contracts and eight complete example source trees. Building
needs no database, Viat account, production credential or provider API call.

```sh
# Show exactly which required reference IDs are still missing.
node scripts/check-content.mjs --inventory

# This is expected to fail until every release gate has evidence.
npm run check:release
```

Do not edit source files while checks/builds are running. Freeze parallel
content authors before running a unified check.

## Example validation / 示例验证

```sh
npm run validate:examples
npm run collect:cli
```

The first runs the shared greeting and eight offline application validators.
The application runner uses a temporary HOME/minimal environment and blocks
network/process calls as an accidental-side-effect guard, **not a sandbox for
hostile code**. Local assertions are not actual provider or device acceptance.
Separate `acceptance.py`/adapter programs require their explicit opt-in flags
and isolated prerequisites; they are never invoked by the default validator.

The collector writes `exports/cli-examples.json` for the product exporter's
`--examples` option. It never dispatches CLI commands. It records substitutions
and unresolved shell-dependent snippets in `exports/cli-example-report.json`;
reviewed redirections have explicit token fixtures in
`contracts/cli-shell-fixtures.json`. Parser success does not validate shell
redirection permissions, credentials, remote effects or installed artifacts.

完整案例源码同时输出至在线站点和离线书的 `examples/<case>/`。下载入口保留目录结构，
不会执行脚本；实际部署前仍需阅读双语指南、配置隔离资源并显式批准外部动作。

## Content and contract sources / 内容与契约

- `src/content/docs/zh-cn/` and `src/content/docs/en/`: plain Markdown; paired
  paths, document IDs, availability, contract IDs and example semantics.
- `contracts/manifest.json`: Server/CLI artifact version, inspected source,
  independent client version, contract digests and candidate/review status.
- `contracts/coverage.json`: required topics in addition to inventories derived
  from the real product contracts.
- `contracts/1.1.0/`: 20 resource kinds, 9 languages, 144 canonical CLI leaves,
  46 MCP tools. Generated schemas do not prove runtime defaults or permissions.
  Resource schema descriptions copied from Rust comments are deliberately omitted:
  internal incident notes are not public field documentation. Reviewed field
  meanings live in the bilingual references; structural schema constraints remain.
- `scripts/`: validation, deterministic imports, raw Markdown and offline export.
- `examples/`: executable fixtures and application projects as they are accepted;
  syntax-only argv files are not proof of runtime behavior.

The product repository's explicit export command is:

```sh
DATABASE_URL=postgres://viat:viat@localhost:5433/scratch \
  scripts/export-doc-contracts.sh --output /tmp/viat-doc-contracts
```

Run that **in an authorized product checkout** with its documented test
prerequisites, not in this repository. Then, here:

```sh
node scripts/import-contracts.mjs /tmp/viat-doc-contracts
```

Importing resets publication readiness. Review the source SHA, dirty flag,
semantic changes, bilingual prose and examples; do not relabel a dirty export
as a clean released contract. Stable 1.1.0 artifacts and the inspected main
revision are recorded separately. Unreleased APNs widget snapshots must not
appear as a stable feature.

## Offline book / 离线手册

With `mdbook` installed:

```sh
npm run build:book
```

The export uses the **same Markdown**, keeps both language trees, and generates
compatibility indexes for old configuration/scripting/protocol entry points.
It refuses to erase an existing unmarked output directory. Preview output is
marked as such. `exports/mdbook/book/` is generated, not committed.

This command does **not** replace the product repository's `docs/`, disable
its documentation pin tests, or modify a running instance. Product sync,
legacy-link coverage and verification under both `/_docs/` and
`/viat/_docs/` must pass before changing the shipped book. Until then the
existing product book remains the deployed documentation.

## GitHub Pages / GitHub Pages 发布

This static Astro site is deployed by `.github/workflows/docs.yml`. Pull
requests run the same build/unit/content checks and upload a preview artifact;
only trusted `main` pushes or a manual `main` run deploy to GitHub Pages. The
deploy job alone receives `pages: write` and `id-token: write`.

| Setting | Value |
| --- | --- |
| Repository | `viat-dev/docs.viat.dev` |
| Pages source | GitHub Actions |
| Initial Pages URL | `https://viat-dev.github.io/docs.viat.dev/` |
| Planned custom domain | `docs.viat.dev` (not bound by this change) |
| DNS CNAME target | `viat-dev.github.io` (DNS managed by the domain operator) |
| Build | `npm ci`, `npm run build`, offline example validation |
| Build output | `dist` |
| Runtime versions | `.node-version`; Python 3.12 in CI |

The current public deployment is an **explicitly authorized candidate**, not a
claim that final release acceptance passed. Keep `publication_ready: false`,
the visible warning and HTML `noindex` until those gates are satisfied.
`npm run check:release` remains the separate formal acceptance gate. A public
candidate is still public: `noindex` is not access control.

The initial site uses the `/docs.viat.dev` project prefix. The workflow only
reads existing Pages metadata (`enablement: false`); it does not bind a domain.
Local defaults match that github.io address. `DOCS_SITE` and `DOCS_BASE` control
origin/prefix; all page, asset, raw Markdown, LLM and example links share them.

A DNS CNAME alone does not bind a custom domain to this repository. After the
operator separately authorizes/configures `docs.viat.dev` under Pages → Custom
domain, rerun the workflow: it reads the new origin/root prefix automatically.
GitHub can then redirect the github.io project address to that domain. DNS and
certificate provisioning must finish before its HTTPS URL works. When using
Cloudflare for DNS, begin with DNS-only while GitHub validates the domain.

There is no Cloudflare Pages deployment or DNS-editing automation here.
GitHub Pages does not apply Cloudflare's `_headers` file; HTML contains the
candidate robots metadata, but raw downloadable files have no promised
`X-Robots-Tag` response header. No deployment token is stored in this repository.

## Publication gates / 发布门槛

A release requires complete paired topic/contract coverage, valid local links
and anchors, reviewed field/permission semantics, CLI parser validation,
MCP integration, runnable resource and application fixtures, offline book and
product doc-pin compatibility, and public-output privacy review. External
message sends, paid model calls, device actions and provider cleanup are
opt-in; skipped integrations are reported as unverified, not passed.

`contracts/acceptance.json` is reserved for actual acceptance records. Do not
create passing records for checks that were not run. `publication_ready`
remains false until acceptance is complete; preview success alone must not
change it.

See [CLAUDE.md](CLAUDE.md) for the authoring and safety contract. Do not import
private feedback, historical design plans, real credentials/device identifiers
or vendor signing material into public content.
