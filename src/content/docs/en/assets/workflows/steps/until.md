---
title: 'until step'
description: 'Bounded sequential conditions, counters, result arrays and iteration exhaustion.'
doc_id: workflow.step.until
verified_release: '1.1.0'
channel: stable
---

# until step

A until entry is a bounded **sequential** condition loop, not for_each over an implicit collection. It is not a persistent timer or retry engine.

| Field | Required/default/valid values |
| --- | --- |
| `id` | Required valid globally unique wrapper ID. |
| `until` | Required condition **string**; boolean result, same grammar as if. No default condition. |
| `max_iterations` | Required integer 1–1000; no implicit unlimited/default value. |
| `do` | Required single StepEntry mapping, not a list. Any native variant is allowed. |
| `index_as` | Optional counter alias using `[a-z][a-z0-9_]*`; cannot be reserved inputs/each/each_index/_error or collide with an existing step ID. |

## Context, output and errors

$inputs and earlier outer results remain readable. There is no current `$each` item in while/until; `$each_index` and the named alias expose the counter. Enclosing named iteration aliases remain accessible. Do not use a loop wrapper's output as mutable state inside itself. Output `$id.output` is an array of each body's value in execution order; a parallel body yields null because it has no own aggregate output.

Until executes its body **before** checking the condition, so it runs at least once when admitted. After each successful body it appends the body output, increments the built-in counter, and evaluates the stop condition; true stops. The condition can therefore read that body's output, including on the first iteration. Body outputs persist in loop-local scope across iterations but are not visible outside. If the condition stays false after max_iterations bodies, the next iteration guard fails with `loop_max_iterations_exceeded`; there is no successful truncation.

Counter nuance in 1.1.0: the body sees zero-based `$each_index`; the post-test sees `$each_index` after increment (first post-test is 1), but a named `index_as` alias still holds the just-executed zero-based index (first is 0). Do not assume the two names are identical inside the post-test. Prefer the body result as the stop condition, as the sample does.

Expected body is `{"values":[0,1]}`. A string condition `"true"` still runs once; `"false"` fails after the maximum rather than returning a successful partial array.

A missing path, nonboolean condition, unhandled body failure, iteration exhaustion, timeout or cancellation fails execution. There is no max_concurrency, retry or on_error on this wrapper. Configure script-level recovery if needed; every iteration and retry shares the root deadline. Keep iteration work bounded and idempotent; a failed loop does not roll back earlier effects.

## Complete no-resource fixture

In an isolated project with authoring/run access and Python/uv, create `wf_echo` from `scripts/wf_echo.py`:

```python
def main(value):
    return value
```

Save this definition as `workflows/until_case.yaml`:

```yaml
inputs: {}
steps:
  - id: loop
    until: '$tick.output == 1'
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
viat workflow create case_until --file workflows/until_case.yaml
viat workflow test case_until --input '{}'
viat workflow update case_until --file workflows/until_case.yaml
```

Do not recreate an existing shared fixture. Test executes a live draft, not a published endpoint or offline test; this fixture has no effects. Inspect outputs/logs, then remove disposable endpoint bindings before `viat workflow delete case_until` and delete wf_echo only when unused. No live verification was run here. [Grammar](../overview.md), [expressions](../expressions.md), [error handling](../error-handling.md) and [limits](../limits.md) cover common behavior.
