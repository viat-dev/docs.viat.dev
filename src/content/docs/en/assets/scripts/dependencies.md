---
title: 'Dependencies and snapshots'
description: 'Package requirements, uses imports and published dependency behavior.'
doc_id: script.dependencies
verified_release: '1.1.0'
channel: stable
---

# Dependencies and snapshots

There are three different dependencies: a resource (`@resource`), an installed package (`requirements:` or Rust `deps:`), and a project script imported as a module (`uses:`). A resource is not a module, and a package declaration does not grant access to a resource.

## Python and TypeScript modules

Create a Python script asset named `common` with this source (it needs no `main`):

```python
def greet(name: str):
    return {"hello": name}
```

The calling asset `hello` is complete:

```python
# uses: common
from common import greet

def main(name: str = "world"):
    return greet(name)
```

With `{"name":"Ada"}`, it returns `{"hello":"Ada"}`. TypeScript uses an exported module and a relative import:

```typescript
// Source of asset common
export function greet(name: string) { return { hello: name }; }
```

```typescript
// Source of asset hello
// uses: common
import { greet } from "./common";
export async function main(args: { name: string }): Promise<{ hello: string }> {
  return greet(args.name);
}
```

Use the asset reference, without `.py`/`.ts`, in `uses:`. Resolution is relative-first, then root, then unique bare name. The resolver walks transitive dependencies; missing modules, incompatible languages, cycles and ambiguous names are errors, not an arbitrary import choice. The runtime creates sibling files under the imported bare names; avoid two distinct dependency paths that need the same import name. Resources declared by dependencies are resolved relative to each dependency’s own folder.

## Exactly what publication freezes

For a **script endpoint**, an ordinary `uses:` graph is frozen with the published source when **no reference anywhere in the graph is `(live)`**. The warm pool can serve that snapshot. Editing the module does not change this endpoint until republish; rollback restores the frozen module graph too. This is not the old blanket rule that all modules are always live.

```python
# uses: common, shared/rules (live)
```

Any explicit `(live)` reference makes the dependency graph resolve from current project scripts on every run and forces a fresh one-shot worker. Direct draft/test/schedule execution has no published frozen graph and resolves live. Legacy snapshots with no frozen dependency metadata also resolve live.

**Workflow-step exception in 1.1.0:** workflow publication bakes each step script's main source and nested workflow definitions, but step `uses:` dependencies, including those in nested workflows, are populated from live scripts before each run. Do not rely on workflow rollback to restore these modules. A workflow with such dependencies can therefore change behavior without republishing even though its main step sources remain frozen.

## Packages and environments

Python needs `uv` and a usable Python interpreter on the execution node; TypeScript needs Bun. Requirements are installed into a cached script environment. Publishing and explicit environment builds prepare it; missing dependencies, an inaccessible package index, native build tools or a failed install can still prevent a run. `build-timeout:` bounds preparation, not execution; `timeout:` bounds execution, not package installation. A cold environment reached during a run keeps the deployment's install deadline rather than acquiring an arbitrarily long script-specific build window.

```bash
viat script env hello --json
viat script env hello --probe --json
viat script build hello --wait
```

The first reports recorded environment state; `--probe` consults the cache. Building changes deployment state and may download packages. Python/TypeScript dependency build failures can become publish warnings; acknowledging a warning is not proof that the runtime is ready. Check environment state and a safe draft run before switching traffic.

Rust uses Cargo dependencies and optionally a project crate, not `uses:`. Pin exact versions or carry a lockfile: artifact caching does not mean “check for a newer compatible dependency on every request.” [Rust](rust.md) describes build and schema probes. Binary content is an artifact manifest, not an environment to install into.

## Verification and cleanup

For a snapshot check, publish `hello`, edit only `common`, then compare a published call with `viat script run hello --args '{"name":"Ada"}'`; they intentionally differ until republish. Repeat with `(live)` only in an isolated project. No live verification is performed by this reference. Remove the test endpoint before deleting its scripts; deleting a shared dependency can break draft, live and legacy callers. Local offline imports do not prove publication or rollback semantics; see [Testing](testing.md).
