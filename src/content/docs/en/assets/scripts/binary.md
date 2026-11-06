---
title: 'Binary programs'
description: 'Manifest, target artifacts and mandatory worker-protocol behavior.'
doc_id: script.binary
verified_release: '1.1.0'
channel: stable
---

# Binary programs

Language `binary` is for a program built by your toolchain which speaks [worker protocol 1](worker-protocol.md). It is **not arbitrary source upload**, a shell command runner or a server that binds its own HTTP port. Script content is a YAML artifact manifest. The platform never compiles it or extracts its I/O schema.

## Manifest and lifecycle

Create `scripts/echo.binary.yaml`:

```yaml
# timeout: 30
protocol: 1
programs: []
```

This is a valid empty inventory for upload, **not yet runnable**. Each populated entry has `target: <os>/<arch>` and `sha256: <64 lowercase hexadecimal characters>`, one per target, no duplicate targets. Protocol must be the server-supported version 1; unknown protocol, malformed digest/target and `uses:` are rejected. Normal `# @resource`, timeout and queue annotations are available; no requirements/deps installer exists.

```bash
viat script create --name binary_echo --language binary --file scripts/echo.binary.yaml
viat script upload binary_echo --binary out/echo-worker --target linux/x86_64
viat script build binary_echo
viat script run binary_echo --args '{"name":"Ada"}'
```

Prerequisites: `out/echo-worker` is executable **for the declared target**, implements one-shot and `--loop`, and operator enabled artifact upload (`VIAT_RUST_ARTIFACT_UPLOAD=1`). Use the deployment's actual target, not necessarily linux/x86_64. Upload writes the file digest into the manifest. The complete resource-free conforming program in [Worker protocol](worker-protocol.md) returns `{"hello":"Ada"}` for this input. Its Python shebang demonstration requires Python on the node; a native executable needs no Python.

`script build` reports inventory/availability, it does not compile binary content. Subsequent manifest edits use `viat script update binary_echo --file scripts/echo.binary.yaml`; pull the updated manifest before reapplying a local empty inventory or you will erase its target entries. Publish a bound endpoint only after checking the required target exists.

## Artifact validation and errors

The server verifies SHA-256 and executable format/machine against target (ELF/Mach-O; a shebang program is accepted but still needs its interpreter). Artifacts are addressed by protocol/target/digest and may be shared by several scripts/nodes. Pull/push carry the manifest, not executable bytes. A node without its target entry or artifact fails naming that condition; it will not attempt compilation. Publish can warn about missing artifacts; acknowledging the warning does not install one.

The process uses the worker account, a cleared/rebuilt environment, stdin envelopes and fd 3 control frames. It must preserve request_id and write one outcome per request. A program that only reads stdin and prints JSON to stdout does not conform. Resource methods are host RPC operations, not embedded provider clients; credential and intentional-secret behavior follows the declared resource kind.

## Schema, timeouts and verification

Binary programs are not probed with `--viat-schema`, even if they implement it. No input/output schema is extracted; endpoint input stays open, so validate arguments inside the program or configure endpoint bindings explicitly. Warm workers may persist state across callers. Long/queued paths can run one-shot. Do not claim Rust-like typed-schema support or universal cancellation; implement protocol behavior and use runtime-supported lanes. Timeout still bounds execution and is not a rollback of effects.

Verify one-shot and pooled behavior, malformed input handling, structured user refusal and missing-artifact behavior in an isolated project. The protocol page includes a no-resource deterministic program; it avoids live message/model calls. Unpublish/delete test endpoints before deleting scripts. Removing a manifest is not authorization to delete a shared artifact; artifact retention is managed separately.
