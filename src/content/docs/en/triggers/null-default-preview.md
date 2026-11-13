---
title: "Explicit null parameter defaults (preview)"
description: "Preserve an explicit null default across endpoint editing, repository sync, and published dispatch."
doc_id: triggers.null-default-preview
verified_release: 'unreleased'
channel: preview
contract_ids: []
---

This unreleased correction applies to the parameter declarations in the [HTTP endpoint contract](http.md). It does not add a new CRUD default mechanism or claim availability in stable releases.

## Missing and null are different

Previously, deserializing a declaration with `default: null` erased the default. The corrected shared type preserves the distinction:

- No `default` key: no endpoint default is supplied; the target's existing behavior for an omitted argument applies.
- `default: null`: supply JSON null when the bound argument is absent.
- A supplied argument is not replaced by its default. An explicit null input still goes through the existing nullable/type validation.

For a string body field, an explicit null default requires `nullable: true`. Otherwise saving the declaration returns `400 bad_request` with a `default_value_type_mismatch` detail. A `json` field already accepts JSON null. A default satisfies the existing required-argument check; `required` does not force a caller to supply a value when a default exists.

The following is a configuration fragment, not an executed business migration:

```json
{
  "body_fields": {
    "remark": {"type": "string", "nullable": true, "default": null}
  }
}
```

In the console parameter editor, enter `null` as the default text; leave the cell blank for no default. CLI endpoint YAML preserves the same distinction through `viat pull` and `viat push`. To remove a default, omit its key from the replacement declaration; do not use null as a deletion marker.

## CRUD and recovery boundaries

[CRUD](crud.md) receives bound arguments after the HTTP contract. A body default can therefore explicitly provide a nullable writable column's null instead of leaving it omitted. Database constraints still apply. This is distinct from `crud_config.defaults`, whose platform-resolved identity values cannot be overridden by callers and do not allow null. No authorization rule, writable allowlist, unknown-field restriction, or database default is changed by this fix.

A default erased by an earlier save cannot be reconstructed from an absent key. Re-enter the intended configuration, save it, inspect the returned declaration, and publish before testing the public route. There is no automatic data or endpoint migration. On an isolated fixture, compare omitted, null, and explicit-value inputs and check database values before adopting a CRUD replacement.

## Verification boundary

Regression tests cover JSON absence/null round-trips, CLI YAML through the API type, and API save/read/publish followed by real Python dispatch, including invalid scalar null-default rejection. The console regression covers editor round-tripping. These are not evidence of a completed business-endpoint migration or verification against an external production database.
