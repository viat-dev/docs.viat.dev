# Viat documentation

This repository owns the bilingual product handbook for docs.viat.dev. It is not
a mirror of every file under the product repository's docs/ directory.

## Authoring contract

- Every reader-facing page has both `zh-cn` and `en` versions with the same
  `doc_id`, contract references, availability and executable example sources.
- Use plain Markdown. Important content must also work in the offline mdBook
  export; do not require MDX components, external fonts or hosted script services.
- Each reference explains prerequisites, complete fields/defaults/validation,
  permissions, inputs/outputs, side effects, runnable examples, failure handling,
  verification/cleanup and unsupported cases. Do not tell users to read source
  to discover an undocumented required step.
- Field names, enum values, CLI flags, tool names and error codes are literal
  protocol identifiers. Translate explanations, not the wire values.
- Derive facts from the pinned product contract and implementation/tests, not
  archived plans or unverified comments. Schema describes structure, not all
  runtime behavior. Do not invent CLI commands, MCP outputs or integrations.
- Product version and client version are independent. Stable, main and preview
  are not synonyms. APNs widget snapshots in b3c3ae9b are unreleased until a
  corresponding artifact ships; never include them in the stable LLM index.
- Activation documentation requires a valid code matching the official image.
  Do not invent an issuance/purchase URL or present vendor key generation as a
  customer activation procedure.
- Source citations are maintenance evidence, not a substitute for instructions.
  Never publish absolute local paths, private feedback, user screenshots,
  credentials, real device tokens or vendor signing keys.

## Work and validation

- Keep changes scoped; no commits, pushes, DNS changes or deployments without
  authorization. Keep product-source exporter work in its separate worktree.
- No source edits while checks for this repository are running. Authoring agents
  prepare changes and tests, then freeze; the coordinator runs unified checks.
- Use the actual examples as the source of code snippets; avoid divergent copies.
- Real-service calls, paid LLM requests, message sends, device actions and live
  cleanup require explicit opt-in. Default examples/tests use isolated fixtures.
- Never claim full coverage based on a scaffold, empty page, translated heading,
  generated input schema alone, or tests skipped for missing dependencies.
- Full publication requires bilingual, inventory, link/anchor, example,
  contract-drift, privacy and offline-export checks. The site may be built as a
  local preview while coverage is incomplete, but that is not a release.
