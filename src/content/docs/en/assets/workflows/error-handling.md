---
title: 'Workflow errors and retries'
description: 'Retry classification, backoff and fail/continue/catch behavior.'
doc_id: workflow.error-handling
verified_release: '1.1.0'
channel: stable
---

# Workflow errors and retries

Only a **script step** owns `retry` and `on_error`. They are not universal fields on if/parallel/loop/workflow wrappers. Do not add `type: retry` or a catch step variant. Without configuration there is one attempt, then failure. Expression failures evaluating args occur before the script attempt loop and are not repaired by retry.

## Retry configuration

```yaml
- id: fetch
  script: read_fixture
  args: {}
  retry:
    times: 3
    initial_ms: 100
    factor: 2.0
    max_ms: 5000
    jitter: false
  on_error: fail
```

This entry needs an existing script asset `read_fixture`; it is not a whole workflow. Complete standalone cases follow below and in the [script step](steps/script.md).

| Field | Required/default/range |
| --- | --- |
| `times` | Required integer 1–10: **additional retries**, so at most times + 1 total attempts. |
| `initial_ms` | Required integer 10–60000. |
| `factor` | Required finite number 1.0–10.0. |
| `max_ms` | Required integer, at least initial_ms and at most 60000. |
| `jitter` | Boolean, default true. |

Before retry n (n=1 after first failure), base delay is `min(initial_ms * factor^(n-1), max_ms)`, floored at initial_ms. Jitter multiplies base by uniform 0.75–1.25 and rounds milliseconds; max_ms caps the **base**, not jittered final delay. Without jitter the example waits 100, 200, 400 ms. Arguments are evaluated once and stay unchanged across attempts. Each attempt is logged separately.

Retryable runtime classes are exactly queue full, queue wait timeout, script broken, pool spawn failure, timeout and transport. User `ViatError`, ordinary script exceptions, annotations, missing resources/kind mismatch, environment-not-ready and workflow orchestration errors are **not** automatic retries. An upstream API refusal represented as script failure is not the same as transport failure. No status-text matching such as “all HTTP 500s retry” is implied. New error variants default to non-retryable.

Retry waits and attempts share the workflow deadline. Another retry is allowed only when a sampled backoff plus 10 ms slack fits the remainder; the actual jitter draw can differ. Never treat times as a guarantee every retry will execute. Side effects from an earlier attempt can persist: make writes idempotent before enabling retry.

## Error policy

| `on_error` value | Behavior after final/nonretryable failure |
| --- | --- |
| absent or `fail` | Fail workflow; a user refusal preserves its status/code, system failure is attributed to the step. |
| `continue` | Bind `$step.output` to null, record `$step._error`, proceed. Workflow can still succeed. |
| `{catch: [entries...]}` | Run a nonempty local recovery branch; success replaces owner output with last-entry output. Catch failure fails workflow. Nested catch anywhere inside a catch branch is forbidden. |

Continue errors have `{code,message,kind,extra?}`. User errors use kind `user` and preserve code/message/extra (not a separate status field). Overload errors use kind `overload`, timeout `timeout`, ordinary failures `runtime`. `$_error` and `$owner._error` expose the caught error **inside catch**. Recovery's internal output/error maps do not leak; successful catch does not make `$owner._error` available outside. A final parallel entry has no own value, so a catch ending with parallel returns null. Cancellation bypasses both continue and catch; a policy cannot overrule the operator's stop.

## Complete deterministic catch fixture

Create `wf_fail`:

```python
from viat import ViatError

def main():
    raise ViatError(status=409, code="fixture_conflict", message="fixture refusal")
```

Create `wf_echo`:

```python
def main(value):
    return value
```

Save `workflows/recover.yaml`:

```yaml
inputs: {}
steps:
  - id: request
    script: wf_fail
    on_error:
      catch:
        - id: recovery
          script: wf_echo
          args:
            value:
              recovered: true
              code: $_error.code
outputs:
  result: $request.output
```

```bash
viat script create --name wf_fail --language python --file scripts/wf_fail.py
viat script create --name wf_echo --language python --file scripts/wf_echo.py
viat workflow create recover --file workflows/recover.yaml
viat workflow test recover --input '{}'
```

Expected **workflow runtime output** is `{"result":{"recovered":true,"code":"fixture_conflict"}}`. CLI caveat in 1.1.0: `workflow test` treats any recorded failed attempt row as failure, even when catch/continue or a later retry recovered. It can print the failed-step summary and exit 1 instead of printing this successful output. Inspect the workflow run's final output/status in the console/API; do not mistake that CLI exit check for the engine's recovery semantics. No retry occurs for this user error even if retry is added. To verify continue, replace policy with `on_error: continue` and outputs with `result: $request.output` plus `code: $request._error.code`; expected result is null and code fixture_conflict. Do not reference recovery outside catch.

Draft execution can make real effects; this fixture intentionally has none. In a disposable project delete the workflow before its script assets, after removing any bound endpoints. A successful recovered workflow can submit tasks created by a failed-but-caught step: deferral is tied to **whole run success**, not a transaction for each step. Use explicit compensation instead of assuming catch rolls work back. [Limits](limits.md) covers fan-out failures, cancellation and restart.
