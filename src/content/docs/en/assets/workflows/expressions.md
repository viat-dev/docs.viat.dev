---
title: 'Workflow expressions and scope'
description: 'Whole-value references, condition grammar, aliases and missing-path errors.'
doc_id: workflow.expressions
verified_release: '1.1.0'
channel: stable
---

# Workflow expressions and scope

Workflow values are YAML converted to JSON. In args and outputs, objects/arrays recurse; null, numbers and booleans remain literal. A string **not starting with `$`** stays literal. A string starting with `$` is a whole-value reference, preserving the referenced JSON type; it is not string templating.

```yaml
args:
  value:
    number: $inputs.count
    label: "count=$inputs.count"
    fixed: [1, true, null]
```

With count 7, `number` is numeric 7, `label` is literally `count=$inputs.count`, and fixed is `[1,true,null]`. Quoting `"$inputs.count"` does not escape evaluation; `$` must not be the first character if you mean ordinary literal text. There is no documented `$$` escape, `${...}` syntax, function call, concatenation or arithmetic in value references. Build dynamic strings/calculations in a script.

## Reference grammar

| Reference | Available scope/result |
| --- | --- |
| `$inputs` / `$inputs.name` | Current workflow input object after defaults; nested workflow inputs are its own args, not the parent's whole map. Declare referenced input keys. |
| `$step.output` / `$step.output.rows[0].id` | Previously visible step output. The `.output` prefix is required. Zero-based nonnegative numeric array indices; no wildcard/JSONPath. |
| `$value.output.length` | Terminal array element count or Unicode character count for a string; a real object key `length` wins. |
| `$each`, `$each.field`, `$each_index` | Current for_each item and zero-based index inside its body. Not global input variables. |
| `$item.field`, `$pos` | Optional for_each `as: item` / `index_as: pos` aliases; enclosing aliases survive nesting, innermost alias wins on shadowing. |
| `$each_index`, `$pos` in while/until | Loop iteration counter and optional `index_as`; no current `$each` value. See loop pages for post-test counter timing. |
| `$step._error.code` | Continued script error where recorded; not an always-present status object for successful steps. |
| `$_error.message`, `$owner._error.kind` | Inside a catch branch only. Catch success does not export its local error map as the owner error. |

Missing root/path, out-of-range index, wrong type or missing `.output` causes an expression error; there is no implicit empty string/null/default. Args/output validation checks visible roots and declared inputs, but concrete object paths need runtime values. Condition validation parses syntax; unavailable condition references can still fail when evaluated. Null itself is a valid resolved value; trying to read a field on null is not.

## Condition language (`if`, `while`, `until` only)

Conditions are **strings** parsed separately from value substitution:

```yaml
if: '$inputs.enabled && ($inputs.count >= 2 || $inputs.mode == "force")'
```

Supported literals: `true`, `false`, `null`, numbers, and single/double-quoted strings. Operators: `!`, `==`, `!=`, `<`, `<=`, `>`, `>=`, `&&`, `||`, parentheses. Precedence is unary-not, comparison, and, or. Equality compares JSON values; ordering requires numbers; logic and final result require booleans, with no Python/JavaScript truthiness. `&&` and `||` short-circuit, so `false && $missing.output` does not evaluate the missing side. There is no arithmetic, `in`, regex, method calls, assignment or automatic interpolation. Condition string literals do not implement a general escape language; keep embedded text simple and use YAML quoting correctly.

## Scope boundaries

Sequential entries see previous sibling outputs. If then/else and catch execute on cloned scope: outer values are readable, internal IDs stay local, wrapper returns last-entry output (or null if no selected arm/last parallel). IDs must remain globally unique even across mutually exclusive branches.

Parallel children each see the same pre-block scope, not other concurrent siblings. On success, their new outputs merge and become available afterward. For_each iterations each see pre-loop outer scope plus item/index and aliases; body outputs do not leak individually, only the ordered wrapper array. While/until reuse their own body scope across iterations, so a later condition/body can observe previous iteration outputs; those IDs do not become outer outputs. A while precondition cannot read an uninitialized first-iteration body result.

Nested workflows have isolated step scope; pass values explicitly in args and consume their outputs map under `$call.output`. Principal/request stay inherited through the run context, not through hidden expression roots like `$ctx`. To read request/principal, execute a script. See [step references](overview.md) and [error handling](error-handling.md).

## Standalone expression fixture

This definition needs no scripts or resources and can be saved as `workflows/values.yaml`:

```yaml
inputs:
  count: {type: integer, default: 7}
steps: []
outputs:
  number: $inputs.count
  literal: "count=$inputs.count"
  values: [true, null, 3]
```

```bash
viat workflow create values --file workflows/values.yaml
viat workflow test values --input '{}'
```

Expected body `{"number":7,"literal":"count=$inputs.count","values":[true,null,3]}`. Delete with `viat workflow delete values` in the disposable project. Draft tests do not publish. This fixture is a manual verification case, not a claim that a run was executed here.
