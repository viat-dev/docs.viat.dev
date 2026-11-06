---
title: 'script step'
description: 'Call one project script with resolved args, retries and an error policy.'
doc_id: workflow.step.script
verified_release: '1.1.0'
channel: stable
---

# script step

A script entry invokes an existing project script asset. It does not embed source or choose the script language. Resource declarations, interpreter/build requirements and helper APIs belong to that script; the workflow inherits the run principal/request and passes only the resolved argument map.

| Field | Required/default/valid values |
| --- | --- |
| `id` | Required string `[a-z][a-z0-9_]*`, globally unique in this definition. |
| `script` | Required string asset reference, bare name or folder/name; resolved relative to workflow folder, then root, then unique bare match. Not a file to upload or inline code. |
| `args` | Mapping, default `{}`. Values recursively resolve references against current scope. No automatic forwarding of all workflow inputs. |
| `retry` | Optional mapping; absent one attempt. Required members times 1–10 additional retries, initial_ms 10–60000, factor 1–10, max_ms initial_ms–60000; jitter boolean defaults true. |
| `on_error` | Default fail. Literal `fail`, `continue`, or mapping with exactly one `catch` key holding a nonempty entry sequence. |

These are the script variant fields; do not add `type: script`, per-step timeout, sleep or approval. The script's own timeout does not reset the workflow total budget. Args are evaluated once before attempts. Success binds the returned JSON value to `$id.output`; this can be scalar, array, object or null, not necessarily `{result:...}`. Step responses are values in the workflow, not automatically the final public HTTP response.

Missing snapshot script/resource, kind mismatch, bad args expressions, interpreter/import/build failure, runtime error or timeout can fail. Only classified transient runtime errors retry, not every exception or user ViatError. Continue binds null plus `$id._error`; catch uses a local error scope and returns its last entry. Cancellation cannot be swallowed. Full [error handling](../error-handling.md) includes backoff formula, classifications and catch constraints.

## Prerequisites and verification

Use an isolated project with authenticated authoring/run access and Python/uv available on the execution node. Create script asset `wf_echo` from `scripts/wf_echo.py` with this complete source (no resources or external effects):

```python
def main(value):
    return value
```

Save the complete YAML below as `workflows/step_case.yaml`. After creating the fixture, use the CLI commands at the end. This is a manual case, not an executed test. Draft test uses live saved definitions; a bound public endpoint uses its published snapshot.

```yaml
inputs:
  value: {type: integer, default: 7}
steps:
  - id: echo
    script: wf_echo
    args:
      value: $inputs.value
    retry:
      times: 2
      initial_ms: 100
      factor: 2.0
      max_ms: 1000
      jitter: false
    on_error: fail
outputs:
  value: $echo.output
```

Expected result body `{"value":7}`. The successful fixture never retries; the declaration demonstrates policy syntax without generating network traffic. To exercise recovery use the deterministic ViatError fixture in the error reference, not a real failing paid provider. After publication the step main source is baked, but step uses modules are live in 1.1.0; inspect the snapshot exception before relying on rollback.

## CLI and cleanup

```bash
viat script create --name wf_echo --language python --file scripts/wf_echo.py
viat workflow create case_script --file workflows/step_case.yaml
viat workflow test case_script --input '{}'
viat workflow update case_script --file workflows/step_case.yaml
```

Do not recreate a shared fixture if it already exists. Inspect the result and execution logs before publishing. In a disposable project, remove bound endpoints first, then `viat workflow delete case_script` and `viat script delete wf_echo` only if unused elsewhere. Test is not offline, and deletion does not undo prior side effects. See [full grammar](../overview.md), [expressions](../expressions.md), [errors](../error-handling.md) and [limits](../limits.md).
