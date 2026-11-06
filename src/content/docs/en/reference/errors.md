---
title: Errors and result boundaries
description: Parse Viat's error envelopes, distinguish transport from execution failure, and recover without unsafe retries.
doc_id: reference.errors
verified_release: '1.1.0'
channel: stable
---

# Errors and result boundaries

Check **transport status, response envelope and business/execution result separately**. An HTTP 200, CLI exit 0 or MCP `isError: false` is not a universal promise that a script succeeded, a build became ready, or a notification arrived.

## Standard management errors

Most application handlers return a status and this JSON shape:

```json
{"error":"bad_request","message":"A human-readable explanation"}
```

Match the machine field appropriate to that endpoint. Preserve the message for diagnosis, but do not build general control flow by splitting its English text. Proxy failures, connection failures and malformed framework-level responses may not have this envelope; verify content type and handle a non-JSON body without turning it into a success.

| HTTP / `error` | Meaning | Recovery |
| --- | --- | --- |
| 400 / `bad_request` | Invalid input or incompatible configuration | Correct fields/types/conditions; repeated unchanged requests do not help. |
| 401 / `unauthorized` | Missing/invalid/expired credential for this surface | Use the correct platform or project identity. Refresh/re-login where supported; never substitute a token from another identity plane. |
| 403 / `forbidden` | Authenticated identity lacks access or a policy rejects it | Check project membership, effective role, PAT confinement and the published authz contract. Platform Admin does not bypass every project guard. |
| 403 / `license_required` | Product gate is locked | A platform Owner/Admin must activate/renew the deployment; credentials or restarts are not a workaround. |
| 404 / `not_found` | Addressed object/route is absent or unavailable | Check instance/project, folder/name versus UUID and whether the public route is published. |
| 409 / `conflict` | State or identity conflict | Read the specific message. Duplicate names, dependency references and in-flight idempotent requests are different problems. |
| 429 / `rate_limited` | Credential endpoint throttling | Honor `Retry-After`; do not retry a password or token exchange in a tight loop. |
| 500 / `internal` | Unhandled server-side failure | Keep request context, inspect operator logs and avoid assuming a write was rolled back. Management internal details are logged, not returned verbatim. |

Some handlers intentionally use a more specific top-level refusal code and status, such as file/link errors. The corresponding feature reference owns those codes. Resource DTO identifiers such as `resource.<kind>.*` often appear inside a 400 `message`, **not** as a guaranteed top-level `error`. A generic 409 message mentioning a dependency does not invent a new machine error code.

## Deliberate envelope differences

| Surface | Difference | Required client behavior |
| --- | --- | --- |
| Workflow parse/validation | 400 contains `error: bad_request`, additional `code`, and `message` | Match the workflow-specific `code`; see [workflow error handling](../assets/workflows/error-handling.md). |
| Credential throttles | Standard JSON plus `Retry-After` header | Preserve the header and back off. |
| Project OAuth token endpoint `/p/{slug}/_token` | RFC 6749 `error` and `error_description` | Use an OAuth-aware client, not a parser requiring `message`. |
| Password login requiring MFA | 401 `mfa_required` or `mfa_enrollment_required` with `mfa_ticket` | Continue the required MFA/enrollment flow. This is not an ordinary wrong-password retry. Never log the ticket. |

An illustration of a workflow parse response is:

```json
{"error":"bad_request","code":"workflow.empty_parallel","message":"A workflow validation explanation"}
```

The message here is illustrative, not a pinned exact server sentence.

## Runtime and published HTTP failures

Execution logs classify failures using `error_kind`: `unauthorized`, `forbidden`, `not_found`, `bad_request`, `runtime`, `system`, `user`, `conflict`, or `overload`. This log classification is **not** the same field as a response's `error` string. Runtime/system failures generally map to HTTP 500 and `internal`; a script's explicit user error can supply its own status/code/message and additional data.

Pool queue exhaustion, queue-wait timeout, a broken script, an unready dependency environment or worker spawn failure can surface as **503 `overload`**. Dispatch overload responses carry a retry hint. That classification does not make a permanent dependency install failure transient: inspect the environment's actual error before retrying. Publishing may clear a broken flag without fixing its underlying cause.

For an in-flight idempotency conflict, the early dispatch path supplies `Retry-After: 1`. Do not apply that assumption to every management 409. A timeout or lost response is also not proof that an upstream write did not happen. Use the endpoint's actual idempotency contract or check durable business state before replaying.

Workflow automatic retries are deliberately narrower than “any error”: eligible classes include queue-full/wait-timeout, broken/spawn failures, timeout and transport errors. User/script errors and environment-not-ready are not automatically retryable just because some outer status resembles overload. HTTP error responses from an upstream are not the same as network transport failure. Cancellation bypasses normal recovery. See the [workflow reference](../assets/workflows/error-handling.md) for attempts, catch/continue and bounds.

## Successful transport, unsuccessful operation

| Result | What to inspect |
| --- | --- |
| Resource Test HTTP 200 | Its body can be `ok: false` with an error. Test may already have authenticated, issued a network request, created a file or written a probe. |
| Script draft-test HTTP response | Inspect `ok`, error details and logs. A successful explicit `ViatResponse`/stream can leave `output: null`; verify the published HTTP response separately. |
| Publish accepted / CLI exit 0 | Inspect every build's `ok`, diagnostics and pending state; acceptance can coexist with failed/pending builds under configured policy. |
| Async request accepted | A run was accepted, not completed. Poll the intended run and check its terminal state. |
| Workflow CLI nonzero | CLI 1.1.0 flags any failed attempt row, even after catch/continue/retry recovery. Read final runtime output and attempt records. |
| MCP `isError: false` | Parse the JSON inside `result.content[0].text`, then inspect endpoint status or execution outcome. MCP transport success is not business success. |
| Provider accepted a push/message | Acceptance is not proof of device delivery, display or user reading. |

## A safe diagnosis sequence

1. Confirm the selected instance, project, actor and installed version. Record the route/method, time window and returned request/run identifier where available.
2. Read the HTTP status and complete response shape. Check whether this is a management request, public endpoint, OAuth flow, test result or MCP wrapper.
3. Inspect matching execution/build/environment evidence. A refusal log means the platform observed a request, not necessarily that the script executed.
4. For 401/403, resolve identity/membership/policy; for invalid input, correct the contract; for overload, inspect capacity or environment readiness; for transport, check the **server's** path to the upstream.
5. Before retrying a mutation, determine whether it may already have applied. Do not add acknowledgement flags, remove gates, disable TLS verification or delete unrelated objects just to make the error disappear.
6. Retain a redacted reproduction, not credentials, MFA tickets, cookies, complete resource projections or private user data.

Read-only log examples, after selecting an authorized project:

```sh
viat logs query --limit 10 --json
viat script env hello --json
```

Replace `hello` with the actual script. The plain environment read is not a build or probe; `--probe` has different permissions and spawns a probe process. There is no cleanup needed for these reads, but any exported evidence must be stored and removed according to its sensitivity.

## Verification basis

`crates/viat-api/src/error.rs`, `handlers/dispatch.rs`, runner classification, `crates/viat-core/src/{error.rs,types/log.rs}`, `crates/viat-runtime/src/error.rs`, and the specific CLI/MCP references. The table describes common families, not a closed enumeration of every application-defined user error.
