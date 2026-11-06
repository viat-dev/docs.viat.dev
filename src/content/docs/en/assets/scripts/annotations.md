---
title: 'Script directives'
description: 'Exact comment directives, defaults and language applicability.'
doc_id: script.annotations
verified_release: '1.1.0'
channel: stable
---

# Script directives

A directive is a whole comment line, not an attribute on `main`. Use `#` for `python`, `shell`, `graphql`, `viat_gql`, `llm` and the `binary` YAML manifest; `--` for `sql`; `//` for `typescript` and `rust`. The wrong marker, an inline trailing explanation, or a malformed value can make a directive invisible. The parser scans source lines; keep directives together at the beginning for review.

| Exact spelling after the marker | Type, default and validation | Applies to |
| --- | --- | --- |
| `@resource db` | Repeatable asset reference, default none. One segment is `[A-Za-z_][A-Za-z0-9_-]{0,63}`; `/` joins segments. Duplicate identical refs are removed. | All nine languages. SQL, GraphQL, viat_gql and llm require exactly one resource of the correct kind. |
| `uses: common, shared/util (live)` | Comma-separated script references; each may end in literal `(live)`. Default none. Duplicate refs merge, with live winning. | Execution imports in Python and TypeScript only. Binary rejects uses. |
| `timeout: 120` | First valid positive integer of 1–6 digits; no unit suffix. Missing, zero or malformed means fallback, not unlimited. Deployment ceilings still clamp it. | Parsed for all languages; workflow steps use the workflow budget instead. |
| `build-timeout: 300` | First valid positive integer of 1–6 digits, seconds. Default deployment dependency-build timeout, normally 300 seconds; deployment maximum normally 3600 seconds. | Python/TypeScript dependency-environment builds; not a Rust compile-time setting. |
| `requirements: package==1.2.3` | Inline comma-separated specs, or a contiguous comment block after an empty `requirements:` line. Default no extra packages. | Python pip/uv specs, TypeScript npm specs. |
| `stream: true` | Case-insensitive `true` enables; absent, `false` or malformed is false. | Python/TypeScript streaming-lane declaration, not an instruction to stream an ordinary return value. |
| `max_concurrent: 2` | First valid integer `1..99999`; absent/zero/invalid means no target queue limit. | All languages, eligible background runs only. |
| `concurrency_key: report-builds` | One segment `[A-Za-z_][A-Za-z0-9_-]{0,63}`; absent uses the asset identity. No effect without `max_concurrent`. | All languages; shares a project-local background budget with other scripts/workflows naming that key. |
| `@input id:int` or `@input limit:int=20` | Schema annotation; default text is stored as a **string**. See below. | SQL (`--`) and shell (`#`) only. |
| `deps: chrono = "=0.4.42"` | One Cargo dependency entry per line; default no extra Cargo entries. | Rust only (`//`), separate from `requirements:`. |

Resource names resolve relative to the script folder first, then project root, then a unique bare-name match anywhere. Folder paths are not filesystem paths. Languages supporting identifier binding need valid import/access names. For a resource name containing `-` or `/`, Python uses `getattr(ctx.resources, "folder/name")` because its resource namespace is not subscriptable; TypeScript can use brackets.

## Requirements block boundaries

```python
# requirements:
# httpx==0.28.1
# pydantic==2.12.3
# @resource crm
from viat import ctx

def main():
    return {"ready": True}
```

A blank or non-comment line ends the block. Another recognized directive also ends it, even if its value is malformed; it is not a package spec. Inline lists split at commas, so use the block form for pip constraints containing commas. Specs with spaces, such as `package @ git+https://…`, stay together. Installing dependencies can access registries and run build scripts: pin versions and use reviewed sources. [Dependencies](dependencies.md) covers import snapshots and environment builds.

## `@input` types

SQL and shell map `int/integer/bigint/smallint` to integer; `text/string/varchar/char` to string; `bool/boolean` to boolean; `numeric/decimal/float/double/real` to number; `json/jsonb` to object. Unknown names fall back to string. Names match `[A-Za-z_][A-Za-z0-9_]*`. An annotation without `=DEFAULT` makes the input required in extracted schema. SQL annotations only affect placeholders actually present; shell reads annotations only before the first real command, allowing blank lines and a shebang.

`=20` produces schema default `"20"`, not numeric `20`; it is not a universal runtime default-injection mechanism. Supply arguments explicitly unless you have verified the endpoint binding/default configuration. In shell, implement a runtime fallback yourself if omission is allowed. Schema extraction is best-effort and warnings matter; see [Testing and schemas](testing.md).

## Admission and timeout mistakes

Do not add a trailing comment such as `# max_concurrent: 2 # optional`: the strict regex does not accept it. An invalid queue declaration can mean runs start immediately with no queue; publish reports warnings. The key alone does not establish a limit. A synchronous request, direct Test run or schedule does not become queued merely because a header exists. [Runtime](runtime.md) explains the separate timeout, lane and durable-queue controls.
