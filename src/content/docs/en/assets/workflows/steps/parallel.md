---
title: 'parallel step'
description: 'Bounded independent branches, output merging and fail-fast behavior.'
doc_id: workflow.step.parallel
verified_release: '1.1.0'
channel: stable
---

# parallel step

Parallel runs independent child **entries**, not a list of branch objects with invented names. There is no own output ID or synthesized array/map.

| Field | Required/default/valid values |
| --- | --- |
| `parallel` | Required nonempty sequence of StepEntry mappings; each child can be any of seven variants. |
| `max_concurrency` | Optional integer 1–16, **sibling** of parallel; absent permits all declared children concurrently. |

An `id` on the parallel wrapper does not create a referenceable result. Child IDs follow global uniqueness. Every child receives the same pre-block input/output/error scope and enclosing item/index/catch aliases; siblings cannot read each other's outputs while running. After all succeed, their new visible outputs/errors merge into outer scope. Nested child scope boundaries (if/catch/loops) still apply.

This cap counts child entries; a child can itself fan out. It is distinct from root max_concurrent and deployment worker limits. Waiting and work share the workflow deadline. First unhandled child failure drops sibling futures; already-sent side effects may still complete and sibling end logs can be absent. No automatic rollback, wrapper retry, continue, catch or timeout exists; handle script failures individually where appropriate.

## Prerequisites and verification

Use an isolated project with authenticated authoring/run access and Python/uv available on the execution node. Create script asset `wf_echo` from `scripts/wf_echo.py` with this complete source (no resources or external effects):

```python
def main(value):
    return value
```

Save the complete YAML below as `workflows/step_case.yaml`. After creating the fixture, use the CLI commands at the end. This is a manual case, not an executed test. Draft test uses live saved definitions; a bound public endpoint uses its published snapshot.

```yaml
inputs: {}
steps:
  - parallel:
      - id: left
        script: wf_echo
        args: {value: left-value}
      - id: right
        script: wf_echo
        args: {value: right-value}
    max_concurrency: 2
outputs:
  left: $left.output
  right: $right.output
```

Expected body `{"left":"left-value","right":"right-value"}`, independent of completion order. Referencing `$left.output` inside right args is invalid; it is only available after the block. If parallel itself is a for_each body, each iteration's aggregate value is null; to collect an object, call a sub-workflow that uses parallel then defines explicit outputs.

## CLI and cleanup

```bash
viat script create --name wf_echo --language python --file scripts/wf_echo.py
viat workflow create case_parallel --file workflows/step_case.yaml
viat workflow test case_parallel --input '{}'
viat workflow update case_parallel --file workflows/step_case.yaml
```

Do not recreate a shared fixture if it already exists. Inspect the result and execution logs before publishing. In a disposable project, remove bound endpoints first, then `viat workflow delete case_parallel` and `viat script delete wf_echo` only if unused elsewhere. Test is not offline, and deletion does not undo prior side effects. See [full grammar](../overview.md), [expressions](../expressions.md), [errors](../error-handling.md) and [limits](../limits.md).
