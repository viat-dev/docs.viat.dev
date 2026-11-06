---
title: 'Rust scripts'
description: 'Compile source to a native artifact and derive schemas from typed handlers.'
doc_id: script.rust
verified_release: '1.1.0'
channel: stable
---

# Rust scripts

Language `rust` means the platform compiles source against its `viat` SDK. It is different from [binary](binary.md), where you supply an already-built protocol program. A build-capable node needs Rust/Cargo and the matching SDK; a run-only node fetches an existing artifact and cannot repair a missing build by compiling. Authenticated project authoring rights are required; build dependencies execute code on the build node and need review.

## Complete minimal source

Save `scripts/rust_echo.rs`:

```rust
#[derive(serde::Deserialize, schemars::JsonSchema)]
struct Input { value: i64 }
#[derive(serde::Serialize, schemars::JsonSchema)]
struct Output { value: i64 }
fn main() {
    viat::serve_typed(|_ctx, args: Input| -> viat::Result<Output> {
        Ok(Output { value: args.value })
    });
}
```

```bash
viat script create --name rust_echo --language rust --file scripts/rust_echo.rs
viat script build rust_echo --wait
viat script run rust_echo --args '{"value":7}'
viat script update rust_echo --file scripts/rust_echo.rs
```

Expected body `{"value":7}`. Generated single-file crates already include serde derive, serde_json and schemars. A project-supplied manifest must retain compatible dependencies, notably schemars **0.8** for the SDK bounds. No database/resource is needed. Build output can include diagnostics; a compile failure blocks a build-capable publish, not a working endpoint waiting for a missing executable. See [Testing](testing.md) for endpoint creation/publication and cleanup.

## Entrypoint and context

`fn main()` hands control to `viat::serve` or `serve_typed`. Untyped form is `viat::serve(|ctx: &viat::Ctx, args: serde_json::Value| -> Result<serde_json::Value, viat::Error> { ... })`. Handlers must implement `Fn`, not consume captured values as `FnOnce`, because a warm worker calls them repeatedly. Return JSON/serializable output or a typed SDK error; do not print a body to stdout as a replacement for the SDK result.

Context includes `ctx.project_id`, request `.method()/.path()/.query()/.header(name)/.raw()`, principal `.identity()/.role()/.claims()/.is_admin()`, `ctx.log(message)`, `ctx.get_resource(name)` for intentional secret reads, `ctx.resource(name)` broker calls and `ctx.ws()`. Prefer broker helpers and their policy/audit path; do not extract connection credentials even where a legacy projection exists. `ctx.tasks` is **not available** in the Rust SDK. This SDK is not the Python/TypeScript object API.

## Dependencies, artifacts and schemas

`// deps: package = "=version"` adds one Cargo dependency entry per line. Rust has no `uses:` import graph or pip/npm `requirements:` environment. Shared code lives in the project crate; platform owns its generated bin paths and SDK dependency. Pin exact versions or commit a project Cargo.lock: source-keyed caching is not a dependency updater. Published artifacts include the frozen crate inputs; changing shared crate content marks affected Rust endpoints for republishing rather than mutating the binary already served.

Typed schemas are read from the **compiled executable** by invoking `--viat-schema`. `serve_typed` emits input/output schemas; untyped `serve` has no typed contract. Save clears stale schemas; compile/publish refreshes them. The probe runs main up to the serve call, so never perform effects in that prelude. Handler code is not run during the probe.

Artifacts are content-addressed with SDK/toolchain/host-protocol inputs. An upgrade changing these can require rebuild even when your source is unchanged. Ordinary short runs reuse warm artifact workers; long and queued runs get one-shot workers. Globals persist across callers on warm workers, so cache infrastructure, not principal/request data. `dedicated` does not create a dedicated Rust pool. Rust runs are **not cancellable** in 1.1.0; timeout still bounds them.

## External compilation and verification

```bash
viat script compile rust_echo --push
viat script compile --all --push
```

These are local compilation commands, unlike server `script build`. Match the server OS/architecture and SDK digest; `--sdk-path PATH` can select the SDK. Upload requires operator opt-in to artifact uploads. `--all` prepares published Rust artifacts, not just arbitrary editor drafts. Never use a laptop-native executable on a different target. Test pure functions via `#[cfg(test)]` and `viat script test`; then build and run this resource-free example. Published behavior must be checked separately from drafts. Deleting a script is not an artifact-store garbage-collection command.
