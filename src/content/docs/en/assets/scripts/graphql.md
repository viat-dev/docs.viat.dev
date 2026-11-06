---
title: 'GraphQL scripts'
description: 'Call an upstream GraphQL resource with variables and operation selection.'
doc_id: script.graphql
verified_release: '1.1.0'
channel: stable
---

# GraphQL scripts

Language `graphql` sends a GraphQL document to an **upstream GraphQL server**. It is not [viat_gql](viat_gql.md), which queries a database through Viat's engine. Declare exactly one resource of kind `graphql`. Resource configuration owns URL, headers, authentication and TLS/proxy policy; prefer it over embedding HTTP credentials in source. No interpreter, main function or `ctx` is involved.

## Complete minimal document

An isolated fixture service must expose `Query.hello(name: String!): String!` and return `Hello, Ada` for `name: "Ada"`. Configure the resource `upstream` to that service, then save `scripts/gql_hello.graphql`:

```graphql
# @resource upstream
query Hello($name: String!) {
  hello(name: $name)
}
```

```bash
viat script create --name gql_hello --language graphql --file scripts/gql_hello.graphql
viat script run gql_hello --args '{"name":"Ada"}'
viat script update gql_hello --file scripts/gql_hello.graphql
```

Expected result body `{"hello":"Hello, Ada"}`, **not** `{"data":...}`. The service and resource are prerequisites, not built-ins. No real service is called by this page. Requires project authoring/run access and upstream permissions. [Testing](testing.md) covers offline GraphQL cassettes, endpoint publication and cleanup.

## Variables and operation selection

The script body is a standard query/mutation document. Request arguments become variables. `__operation` selects the upstream operation name when there are multiple operations:

```bash
viat script run gql_hello --args '{"name":"Ada","__operation":"Hello"}'
```

Prefer one operation per asset: extraction uses only the first operation and warns on multiple operations, regardless of which one `__operation` selects at runtime. Standard Int/Float/String/ID/Boolean and lists map to input schema; non-null without a default is required, a declared GraphQL default makes it optional. Custom scalars/enums/input objects remain opaque. GraphQL document defaults are applied upstream, not by a templating language. There is no `{{...}}` interpolation or SQL placeholder syntax.

## Output, failures and budgets

The runner returns only the response's `data`. Any non-empty upstream `errors` array fails the run, even when partial data is present; do not treat partial data as success. Non-success HTTP status, malformed JSON, network failure and timeout also fail. Static extracted output describes an envelope with data/errors and is **not** the observed runtime output contract; verify actual results.

`# timeout: N` is subject to deployment ceilings. No native subscription transport, `ViatStream`, task API or resource helper calls exist in this language. Use Python/TypeScript for branching, repeated requests, tool calls or streaming. Mutations have real effects and are not automatically retried safely. Auth configured as caller_token requires an actual caller credential; queued/delayed runs do not retain one.

For verification, assert fixture variables and operationName plus the returned data object. Use an isolated read-only fixture first, inspect errors without logging upstream credentials, then publish deliberately. Unpublish/delete the disposable endpoint before deleting `gql_hello`; removing the script does not delete upstream data.
