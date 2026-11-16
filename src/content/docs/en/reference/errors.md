---
title: Errors and result boundaries
description: Parse Viat's error envelopes, distinguish transport from execution failure, and recover without unsafe retries.
doc_id: reference.errors
verified_release: '1.1.0'
channel: stable
---

# Errors and result boundaries

Check **transport status, response envelope and business/execution
result** as three separate layers. An HTTP 200, CLI exit 0 or MCP
`isError: false` is **no universal promise** that a script succeeded, a
build became ready or a notification arrived.

## Standard management errors

Most application handlers answer with a status code and this JSON shape:

```json
{"error":"bad_request","message":"A human-readable explanation"}
```

Match the machine fields the endpoint specifies; keep `message` for
diagnostics — **never** build generic control flow by parsing English
sentences. Proxy failures, connection failures and framework-level
exception responses may lack this envelope: check the content type and
**never** treat a non-JSON response as success.

| HTTP / `error` | Meaning | Recovery |
| --- | --- | --- |
| 400 / `bad_request` | Invalid input or incompatible configuration | Fix fields, types and conditions; repeating the request verbatim helps nothing |
| 401 / `unauthorized` | No valid credentials for this surface, or expired ones | Use the correct platform or project identity; refresh/re-login where supported — **never** swap in a token from another identity plane |
| 403 / `forbidden` | The identified identity lacks rights, or policy refused | Check project membership, effective roles, PAT scopes and the published authz contract; a platform Admin **bypasses no** project check |
| 403 / `license_required` | The activation gate is locked | A platform Owner/Admin activates or renews; swapping credentials or restarting is **not** a bypass |
| 404 / `not_found` | Object/route missing or unavailable | Verify instance, project, folder/name and UUIDs, and whether the public route is published |
| 409 / `conflict` | State or identity conflict | Read the specific message; duplicate names, dependency references and in-flight idempotent requests are **different** problems |
| 429 / `rate_limited` | Credential-endpoint rate limiting | Honor `Retry-After`; never tight-loop password or token-exchange retries |
| 500 / `internal` | Unhandled server failure | Preserve request context and read operations logs; **do not assume writes rolled back**. Management internals are logged, not returned verbatim |

Some handlers use more specific top-level rejection codes and statuses
(file/link errors, for example) documented by their feature references.
Resource DTO identifiers like `resource.<kind>.*` often appear inside a
400's `message` — **not guaranteed** as the top-level `error`; a plain
409 mentioning dependencies implies no same-named machine error code.

## Deliberately different envelopes

| Surface | Difference | Client requirement |
| --- | --- | --- |
| Workflow parse/validation | 400 with `error: bad_request` plus an extra `code` and `message` | Match the workflow-specific `code`; see [workflow error handling](../assets/workflows/error-handling.md) |
| Credential rate limiting | Standard JSON plus a `Retry-After` header | Keep the header and back off |
| Project OAuth token endpoint `/p/{slug}/_token` | RFC 6749 `error`/`error_description` | Use an OAuth client; **never** require `message` |
| Password login requiring MFA | 401 `mfa_required`/`mfa_enrollment_required` with `mfa_ticket` | Follow the MFA/enrollment flow rather than re-submitting passwords; **never** log the ticket |

Example workflow parse response:

```json
{"error":"bad_request","code":"workflow.empty_parallel","message":"A workflow validation explanation"}
```

The message is illustrative, not a fixed server sentence.

## Runtime and published-HTTP failures

- Execution logs classify with `error_kind`: `unauthorized`,
  `forbidden`, `not_found`, `bad_request`, `runtime`, `system`, `user`,
  `conflict`, `overload` — **not the same field** as the response's
  `error` string. runtime/system usually map to HTTP 500 + `internal`;
  an explicit script user error can carry its own status, code, message
  and extra data.
- Worker-pool queue exhaustion, queue wait timeouts, broken scripts,
  not-ready dependency environments and worker spawn failures can all
  surface as **503 `overload`**. The dispatch overload response carries
  a retry hint — but it **never turns** a permanent dependency-install
  failure into a transient one: read the environment's actual error
  first; publishing can clear a broken marker without fixing the cause.
- In-flight idempotent-request conflicts return `Retry-After: 1` on the
  early dispatch path — **never generalize** it to all management 409s.
  A timeout or lost response also **proves no** "upstream write did not
  happen": before replaying, use the endpoint's real idempotency
  contract or inspect durable business state.
- Workflow automatic retries are **deliberately narrower** than "any
  error": queue-full/wait-timeout, broken/spawn failure, timeout and
  transport; user/script errors and environment-not-ready are **not**
  auto-retryable merely for resembling overload; an upstream HTTP error
  response is **not** a network transport failure; cancellation bypasses
  normal recovery. Attempt counts, catch/continue and boundaries:
  [workflow reference](../assets/workflows/error-handling.md).

## Transport success is not operation success

| Outcome | What to check |
| --- | --- |
| Resource Test HTTP 200 | The body can be `ok: false` with an error; the Test may already have authenticated, made network calls, created files or written probes |
| Script draft-test HTTP response | Check `ok`, errors and logs; a successful explicit `ViatResponse`/stream can still show `output: null` — inspect the published HTTP response separately |
| Publish accepted / CLI exit 0 | Check each build's `ok`, diagnostics and pending; under permissive configuration, acceptance can coexist with failed/pending builds |
| Async request accepted | The run was accepted, not completed; poll the correct run and check its terminal state |
| Workflow CLI non-zero | CLI 1.1.0 exits non-zero on **any failed attempt** even when catch/continue/retry recovered; judge with the final run output and attempt records |
| MCP `isError: false` | Parse the JSON inside `result.content[0].text`, then check endpoint status or execution results; tool transport success is not business success |
| Provider accepted a push/message | **Proves nothing** about device delivery, display or a human reading it |

## A safe diagnostic order

1. Verify instance, project, operator and installed versions; record
   method/path, time window and any request/run identifiers.
2. Read the HTTP status and the full response shape, distinguishing
   management requests, public endpoints, OAuth, test results or MCP
   envelopes.
3. Check the matching execution, build and environment evidence; a
   rejection log proves the platform **saw** the request, not that a
   script **ran**.
4. For 401/403 settle identity, membership and policy first; invalid
   input means fixing the contract; overload means capacity/
   environment; transport means the **server-to-upstream** path.
5. Before retrying a mutation, judge whether the previous attempt may
   already have applied. **Never** add acknowledgement flags, remove
   gates, disable TLS verification or delete unrelated objects just to
   make an error disappear.
6. Keep a redacted reproduction; never keep credentials, MFA tickets,
   cookies, full resource projections or private user data.

Read-only log examples with an authorized project selected:

```sh
viat logs query --limit 10 --json
viat script env hello --json
```

Substitute your real script for `hello`. An ordinary environment read is
**not** a build/probe; `--probe` has different permissions and starts a
probe process. Read-only operations need no object cleanup, but exported
evidence should be stored and removed per its sensitivity.

## Verification basis

Contract source `03751a67`: `crates/viat-api/src/error.rs`,
`handlers/dispatch.rs`, the runner classification,
`crates/viat-core/src/{error.rs,types/log.rs}`,
`crates/viat-runtime/src/error.rs` and the CLI/MCP references. The
tables summarize common error families and do not close the enumeration
of application-defined user errors.
