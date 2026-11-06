---
title: 'while step'
description: 'Bounded sequential conditions, counters, result arrays and iteration exhaustion.'
doc_id: workflow.step.while
verified_release: '1.1.0'
channel: stable
---

# while step

A while entry is a bounded **sequential** condition loop, not for_each over an implicit collection. It is not a persistent timer or retry engine.

| Field | Required/default/valid values |
| --- | --- |
| `id` | Required valid globally unique wrapper ID. |
| `while` | Required condition **string**; boolean result, same grammar as if. No default condition. |
| `max_iterations` | Required integer 1–1000; no implicit unlimited/default value. |
| `do` | Required single StepEntry mapping, not a list. Any native variant is allowed. |
| `index_as` | Optional counter alias using `[a-z][a-z0-9_]*`; cannot be reserved inputs/each/each_index/_error or collide with an existing step ID. |

## Context, output and errors

$inputs and earlier outer results remain readable. There is no current `$each` item in while/until; `$each_index` and the named alias expose the counter. Enclosing named iteration aliases remain accessible. Do not use a loop wrapper's output as mutable state inside itself. Output `$id.output` is an array of each body's value in execution order; a parallel body yields null because it has no own aggregate output.

While evaluates its condition **before** each iteration. False on the first check returns an empty array without executing the body. The first precondition cannot read a body output that does not exist yet; use inputs/the index or initialize state before the loop. Body outputs remain in the loop-local scope between iterations, so later conditions can inspect them, but they do not leak to the outer workflow. A successful body appends its value, then increments the counter. After max_iterations successful bodies, one more true condition causes `loop_max_iterations_exceeded`; reaching the limit is not successful truncation. A false condition at that boundary exits successfully.

The sample checks index 0 and 1, appends those values, then exits at index 2. Expected body is `{"values":[0,1]}`. If the condition is the string `"false"`, output is an empty array; if it is `"true"`, this sample fails after three bodies rather than returning a successful three-item array.

A missing path, nonboolean condition, unhandled body failure, iteration exhaustion, timeout or cancellation fails execution. There is no max_concurrency, retry or on_error on this wrapper. Configure script-level recovery if needed; every iteration and retry shares the root deadline. Keep iteration work bounded and idempotent; a failed loop does not roll back earlier effects.

## Complete no-resource fixture

In an isolated project with authoring/run access and Python/uv, create `wf_echo` from `scripts/wf_echo.py`:

```python
def main(value):
    return value
```

Save this definition as `workflows/while_case.yaml`:

```yaml
inputs: {}
steps:
  - id: loop
    while: '$each_index < 2'
    max_iterations: 3
    index_as: iteration
    do:
      id: tick
      script: wf_echo
      args: {value: $iteration}
outputs:
  values: $loop.output
```

```bash
viat script create --name wf_echo --language python --file scripts/wf_echo.py
viat workflow create case_while --file workflows/while_case.yaml
viat workflow test case_while --input '{}'
viat workflow update case_while --file workflows/while_case.yaml
```

Do not recreate an existing shared fixture. Test executes a live draft, not a published endpoint or offline test; this fixture has no effects. Inspect outputs/logs, then remove disposable endpoint bindings before `viat workflow delete case_while` and delete wf_echo only when unused. No live verification was run here. [Grammar](../overview.md), [expressions](../expressions.md), [error handling](../error-handling.md) and [limits](../limits.md) cover common behavior.
