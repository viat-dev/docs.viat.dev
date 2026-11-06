---
title: 'for_each step'
description: 'Array iteration, aliases, bounded fan-out and ordered results.'
doc_id: workflow.step.for_each
verified_release: '1.1.0'
channel: stable
---

# for_each step

For_each resolves one array and runs one body entry for each element. It is concurrent map, not a sequential loop with mutable shared state.

| Field | Required/default/valid values |
| --- | --- |
| `id` | Required unique valid wrapper ID. |
| `for_each` | Required mapping containing the fields below. |
| `over` | Required **string reference** to an input/previous output path resolving to an array, e.g. `$inputs.items` or `$fetch.output.rows`; not an inline array or general condition. Nested iteration aliases with a path can be used. |
| `max_concurrency` | Inside for_each, integer 1–16, default 4. |
| `do` | Required **single StepEntry mapping**, not a sequence. Any native variant allowed. |
| `as` | Optional item alias, valid ID grammar. |
| `index_as` | Optional zero-based index alias, valid ID grammar. |

Aliases cannot be reserved inputs/each/each_index/_error or collide with an existing step ID; inner iterations may shadow an outer alias. `$each` and `$each_index` remain available even with aliases; outer named aliases are how to retain access through nested loops. The over expression resolves before entering the new iteration, so it can read outer aliases. Each body sees a fresh copy of outer scope; no previous iteration output is shared.

Output `$id.output` is an array in **input order**, not completion order. Empty input yields `[]`. Each element is the body's output; a parallel body has no aggregate value and yields null. Inner body IDs do not leak. Missing/wrong-type over is an expression/type error, not empty iteration. One unhandled failure is fail-fast and drops other futures, without undoing effects. Configure recovery/retry on body scripts, not the wrapper. Memory use is not bounded by max_concurrency; limit array size separately.

## Prerequisites and verification

Use an isolated project with authenticated authoring/run access and Python/uv available on the execution node. Create script asset `wf_echo` from `scripts/wf_echo.py` with this complete source (no resources or external effects):

```python
def main(value):
    return value
```

Save the complete YAML below as `workflows/step_case.yaml`. After creating the fixture, use the CLI commands at the end. This is a manual case, not an executed test. Draft test uses live saved definitions; a bound public endpoint uses its published snapshot.

```yaml
inputs:
  values: {type: array, default: [3, 1, 2]}
steps:
  - id: mapped
    for_each:
      over: $inputs.values
      max_concurrency: 2
      as: item
      index_as: pos
      do:
        id: echo_item
        script: wf_echo
        args:
          value:
            item: $item
            index: $pos
outputs:
  values: $mapped.output
```

Expected body `{"values":[{"item":3,"index":0},{"item":1,"index":1},{"item":2,"index":2}]}`. With `{"values":[]}`, output values is empty. `{"values":null}` fails; it is not treated as an empty list. Root `$echo_item.output` is out of scope.

## CLI and cleanup

```bash
viat script create --name wf_echo --language python --file scripts/wf_echo.py
viat workflow create case_for_each --file workflows/step_case.yaml
viat workflow test case_for_each --input '{}'
viat workflow update case_for_each --file workflows/step_case.yaml
```

Do not recreate a shared fixture if it already exists. Inspect the result and execution logs before publishing. In a disposable project, remove bound endpoints first, then `viat workflow delete case_for_each` and `viat script delete wf_echo` only if unused elsewhere. Test is not offline, and deletion does not undo prior side effects. See [full grammar](../overview.md), [expressions](../expressions.md), [errors](../error-handling.md) and [limits](../limits.md).
