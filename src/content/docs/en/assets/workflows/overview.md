---
title: 'Workflow YAML reference'
description: 'Complete definition structure, execution model and publication lifecycle.'
doc_id: workflow.overview
verified_release: '1.1.0'
channel: stable
---

# Workflow YAML reference

A workflow is a YAML definition interpreted by Viat, not a script language or durable job engine. Seven native step variants exist: [script](steps/script.md), [if](steps/if.md), [parallel](steps/parallel.md), [for_each](steps/for_each.md), [while](steps/while.md), [until](steps/until.md), [workflow](steps/workflow.md). The variant is identified by the **presence of its key**, not a `type:` discriminator. Each entry must contain exactly one of those variant keys. There is no native approval, wait-event, durable checkpoint or external-job step.

## Root grammar

| Key | Type, required/default and meaning |
| --- | --- |
| `inputs` | Mapping, default `{}`. Keys declare names available under `$inputs`; values may be shorthand metadata (e.g. `string`) or mappings (e.g. `{type: string, default: world}`). |
| `steps` | Required sequence of entries, executed in declaration order except explicit fan-out. Empty sequence is valid; omitted steps is invalid. |
| `outputs` | Mapping, default `{}`. Recursively resolve values after successful execution; this mapping is the workflow return value. Omitting it returns `{}`, not the last step. |
| `timeout` | Optional unsigned seconds. Positive values select the total budget; absent/zero/unusable falls back at admission to project/deployment default; deployment ceilings apply. Not a separate timeout per step. |
| `max_concurrent` | Optional positive u32 background-run limit; no default target limit. Zero/invalid is not “paused.” |
| `concurrency_key` | Optional shared budget name `[A-Za-z_][A-Za-z0-9_-]{0,63}`; meaningful only with max_concurrent; absent uses workflow identity. |

Input metadata is not a full runtime JSON Schema validator in this engine. A mapping's `default` is explicitly applied to **missing** keys before any step; caller-supplied null is not overwritten. `default: null` allows a resolvable null rather than a missing-path error. Declared names and references are checked, but do not rely on `{type: integer}` alone to reject a string. Validate in a script or configure endpoint parameter bindings when strict validation is required. A workflow does not gain a script's extracted main schema automatically.

Every named entry uses `id: [a-z][a-z0-9_]*`, globally unique across the entire definition including branches, catches and loops. Parallel blocks have no own output ID. References can use only inputs and outputs already visible in scope, not future steps. Unknown extra YAML fields are not a safe extension mechanism: an ignored `type`, `timeout` or `retry` on the wrong variant does not implement that feature.

## Complete no-resource example

Create script asset `wf_echo` from `scripts/wf_echo.py`:

```python
def main(value):
    return value
```

Save `workflows/echo.yaml`:

```yaml
inputs:
  value:
    type: string
    default: world
steps:
  - id: echo
    script: wf_echo
    args:
      value: $inputs.value
outputs:
  value: $echo.output
```

```bash
viat script create --name wf_echo --language python --file scripts/wf_echo.py
viat workflow create echo_flow --file workflows/echo.yaml
viat workflow test echo_flow --input '{"value":"Ada"}'
viat workflow test echo_flow --input '{}'
viat workflow update echo_flow --file workflows/echo.yaml
```

Expected result bodies are `{"value":"Ada"}` and `{"value":"world"}`. Test runs the current saved draft, with real runtime/resource effects if your steps have any; this fixture has none. Python execution requires uv/Python. Needs project authoring/execution access; the authenticated test identity is not proof of public caller access.

## Publish and cleanup

```bash
viat endpoint create --segment flow --method POST --workflow echo_flow
viat endpoint publish ENDPOINT_ID
```

Replace ENDPOINT_ID with the creation response's ID. Endpoint authentication/parameter configuration still applies; method/path creation alone is not an auth policy. Publication bakes workflow YAML, step script main sources, nested definitions and endpoint configuration. Later draft edits do not change that endpoint until republish. **Step uses modules remain live in 1.1.0**, including nested steps; see [limits and snapshots](limits.md). Direct test/schedule targets build from live definitions. Resource values are resolved at run time rather than all credentials being embedded in the published YAML.

For a disposable example, unpublish and delete the endpoint, then `viat workflow delete echo_flow` and `viat script delete wf_echo` after confirming no other workflow depends on them. Deletion does not undo prior script side effects. No online run or cleanup was performed here.

## Composition rules

Script/workflow args and final outputs resolve whole-value references recursively; there is no embedded string interpolation. If/catch wrappers return their chosen branch's last entry value; inner IDs do not escape. Parallel makes successful child outputs visible under their child IDs. For_each returns an ordered result array; while/until return sequential result arrays. A parallel body itself has no aggregate output, so a wrapper ending in parallel yields null rather than an invented branch map. [Expressions](expressions.md), [error handling](error-handling.md) and the individual step pages give exact scopes, defaults and examples.
