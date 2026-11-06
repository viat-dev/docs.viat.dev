---
title: 'TypeScript scripts'
description: 'Bun entrypoints, object arguments, async helpers and schema limits.'
doc_id: script.typescript
verified_release: '1.1.0'
channel: stable
---

# TypeScript scripts

Use language `typescript`; the execution node needs **Bun**, not merely Node.js. The platform injects the `"viat"` module. `// requirements:` declares extra npm packages; `// uses:` imports project scripts. They are different systems.

## Complete minimal script

Save `scripts/hello_ts.ts`:

```typescript
import { ctx } from "viat";
export async function main(args: { name: string }): Promise<{ hello: string }> {
  ctx.logger.info("greet", { who: args.name });
  return { hello: args.name };
}
```

```bash
viat script create --name hello_ts --language typescript --file scripts/hello_ts.ts
viat script run hello_ts --args '{"name":"Ada"}'
viat script update hello_ts --file scripts/hello_ts.ts
```

Expected body `{"hello":"Ada"}`; schema marks `name` required string. Requires authenticated project execution/authoring access. No resource or provider is needed. For public exposure create an endpoint then publish its ID as shown in [Testing](testing.md); saving/updating does not publish.

## Function shape and schema

Export `function main(args: {...})` (sync or async); its first parameter is **one object**, not one parameter per HTTP input. Runtime calls it with `(args, ctx)` and awaits the result. Runtime also falls back to a default export, but static extraction expects a main function declaration; prefer named exported main to keep runtime and schema aligned.

Use an inline object parameter and explicit return annotation. Optional `name?: string` allows omission, `name: string | null` allows null; these are different. A JavaScript `args.name ?? "world"` fallback is runtime code, not a guarantee that the extractor emits a default. Primitive types, object literals, arrays, Record and some unions are recognized; named/imported/complex types can become open `{}`. This is syntax extraction, not `tsc` type resolution. BigInt values are not ordinary JSON-serializable return values even though a bigint annotation can map to integer schema.

## Async APIs and response shape

```typescript
// @resource api
import { ctx } from "viat";
export async function main() {
  return await ctx.resources.api.get("/health");
}
```

This second example requires an existing authorized `http_api` resource `api` pointing to an isolated service. It returns the decoded upstream body and can make real network calls; do not run it without opting in. Resource helper methods, authz, cache purge and tasks return promises. Await them: an unawaited side effect is not reliable completion. Logger methods and `ctx.progress(50, "halfway")` are synchronous reporting methods.

Import `ViatError`, `ViatResponse`, `ViatStream` from `"viat"`. Constructors use option objects, unlike Python positional bodies. `new ViatError({status:400,code:"invalid_input",message:"..."})`; `new ViatResponse({body:{ok:true},status:201})`. A stream is `new ViatStream({generator: asyncIterable})`; synchronous generators are rejected. Add `// stream: true` for stream-lane admission. [Runtime](runtime.md) has complete stream examples and late-error/cancellation behavior; [Context](context.md) lists fields.

## Environment and verification

Worker modules can persist across requests: never retain the previous principal/arguments in globals. `// requirements:` installs dependencies with Bun; missing Bun, package/build errors or stale environments are separate from application errors. Inspect `viat script env hello_ts --json` and build as needed. [Testing](testing.md) gives Bun offline assertions and cleanup; draft runs use real helpers. `ctx.tasks` is supported here, not in all nine languages. Ordinary return values must serialize to JSON; a TypeScript type annotation cannot make a class instance, circular graph or BigInt a safe response.
