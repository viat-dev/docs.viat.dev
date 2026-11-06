---
title: 'workflow step'
description: 'Nested workflow calls with isolated scope, inherited identity and shared budget.'
doc_id: workflow.step.workflow
verified_release: '1.1.0'
channel: stable
---

# workflow step

A workflow entry calls another project workflow synchronously within this run. It is not a task enqueue, HTTP endpoint call or external-job adapter.

| Field | Required/default/valid values |
| --- | --- |
| `id` | Required valid globally unique parent step ID. |
| `workflow` | Required existing workflow asset reference, bare name or folder/name; relative-first resolution from the calling workflow folder. |
| `args` | Mapping, default `{}`; values recursively resolve in parent scope and become the child's inputs. |

No `type: workflow`, wrapper retry/on_error, per-call timeout, wait-event or checkpoint fields are implemented. The child applies its own missing-input defaults but receives **only** args, not implicit parent inputs. Child step IDs/errors are isolated and may reuse names from the separate parent definition. The wrapper output is the child's **outputs mapping** under `$id.output`; it is not automatically the child's last step.

Caller principal, request, resources and cancellation context are inherited; nesting grants no new rights. The child inherits the parent's remaining timeout and root declared lane budget; its timeout declaration does not grant a fresh budget. Static call cycles are rejected during snapshot baking, runtime depth counter is capped at 4, and missing baked workflow/invalid child definition/args expression or child failure propagates. There is no outer catch on this variant; handle expected failures in child script steps or return an explicit application result.

## Complete no-resource pair

No script/interpreter/resource is needed for this empty-step example. In an isolated project with workflow authoring/execution access, save `workflows/child.yaml`:

```yaml
inputs:
  value: {type: string, default: child-default}
steps: []
outputs:
  value: $inputs.value
```

Save parent as `workflows/parent.yaml`:

```yaml
inputs:
  value: {type: string, default: Ada}
steps:
  - id: child_call
    workflow: child_flow
    args:
      value: $inputs.value
outputs:
  value: $child_call.output.value
```

```bash
viat workflow create child_flow --file workflows/child.yaml
viat workflow create parent_flow --file workflows/parent.yaml
viat workflow test parent_flow --input '{}'
viat workflow test parent_flow --input '{"value":"Grace"}'
viat workflow update child_flow --file workflows/child.yaml
```

Expected bodies `{"value":"Ada"}` and `{"value":"Grace"}`. To use child-default, omit value from **parent call args**; merely omitting the caller's input still uses the parent's Ada default. Missing child outputs key is a runtime expression error rather than automatic null.

## Publication, logs and cleanup

Endpoint publish recursively bakes child definitions and their script main sources. Editing child live rows changes direct parent tests but does not mutate an already-published endpoint; republish it deliberately. Workflow-step uses modules are the 1.1.0 live exception even in nested calls. The child's own published endpoint, if any, is not what this step dispatches through.

Nested logs have call paths such as child_call.inner, and child_call[0].inner inside iteration. Use path/iteration/attempt together, not step_index alone. A child failure is recorded on both its leaf and call wrapper; restarting does not resume at the child boundary. Remove bound disposable endpoints, delete parent_flow, then child_flow only if unused elsewhere. Deleting a workflow does not undo external effects. [Grammar](../overview.md), [scope](../expressions.md) and [limits](../limits.md) explain shared behavior. No online verification was performed here.
