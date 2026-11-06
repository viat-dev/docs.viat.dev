---
title: 'if step'
description: 'Boolean conditions, local branches and wrapper output.'
doc_id: workflow.step.if
verified_release: '1.1.0'
channel: stable
---

# if step

An if entry chooses exactly one arm; it is not a script whose language happens to be YAML.

| Field | Required/default/valid values |
| --- | --- |
| `id` | Required valid globally unique step ID. |
| `if` | Required **string** in the condition grammar; final value must be boolean. Quote literal true/false conditions as strings. |
| `then` | Required nonempty sequence of entries. |
| `else` | Optional nonempty sequence when present; absent means no work on false. |

Condition supports references, comparisons, !, &&, || and parentheses, not arithmetic or truthy strings. It evaluates in the surrounding scope, including enclosing iteration/catch aliases. Each arm clones that scope; it can read earlier outer steps, and later entries in the arm can read earlier arm entries. Inner IDs cannot be referenced afterward and must still be unique across both arms.

`$id.output` is the last entry's value in the selected arm. False without else binds null. An arm ending with a parallel block also yields null because parallel has no own value; use an explicit final script to assemble several branch outputs. No wrapper-level retry/on_error or timeout is implemented. An unhandled arm error fails the workflow; put recovery on the script that can fail.

## Prerequisites and verification

Use an isolated project with authenticated authoring/run access and Python/uv available on the execution node. Create script asset `wf_echo` from `scripts/wf_echo.py` with this complete source (no resources or external effects):

```python
def main(value):
    return value
```

Save the complete YAML below as `workflows/step_case.yaml`. After creating the fixture, use the CLI commands at the end. This is a manual case, not an executed test. Draft test uses live saved definitions; a bound public endpoint uses its published snapshot.

```yaml
inputs:
  enabled: {type: boolean, default: true}
steps:
  - id: choose
    if: '$inputs.enabled == true'
    then:
      - id: yes_value
        script: wf_echo
        args: {value: yes-branch}
    else:
      - id: no_value
        script: wf_echo
        args: {value: no-branch}
outputs:
  value: $choose.output
```

Default input returns `{"value":"yes-branch"}`. Input `{"enabled":false}` returns `{"value":"no-branch"}`. Removing else makes false return `{"value":null}`. `$yes_value.output` in root outputs is invalid even when the true branch ran. Conditions with missing concrete paths fail at runtime rather than becoming false.

## CLI and cleanup

```bash
viat script create --name wf_echo --language python --file scripts/wf_echo.py
viat workflow create case_if --file workflows/step_case.yaml
viat workflow test case_if --input '{}'
viat workflow update case_if --file workflows/step_case.yaml
```

Do not recreate a shared fixture if it already exists. Inspect the result and execution logs before publishing. In a disposable project, remove bound endpoints first, then `viat workflow delete case_if` and `viat script delete wf_echo` only if unused elsewhere. Test is not offline, and deletion does not undo prior side effects. See [full grammar](../overview.md), [expressions](../expressions.md), [errors](../error-handling.md) and [limits](../limits.md).
