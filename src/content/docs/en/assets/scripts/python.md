---
title: 'Python scripts'
description: 'Entrypoint, interpreter, arguments, schemas and Python helpers.'
doc_id: script.python
verified_release: '1.1.0'
channel: stable
---

# Python scripts

Use language `python`, not a Python-version string. Execution nodes need `uv` and Python; the platform supplies the `viat` module. Do not install an unrelated PyPI package named viat. Additional packages are declared with `# requirements:`; see [directives](annotations.md) and [dependencies](dependencies.md).

## Complete minimal script

Save as `scripts/hello.py`:

```python
from viat import ctx

def main(name: str = "world") -> dict:
    ctx.logger.info("greet", who=name)
    return {"hello": name}
```

```bash
viat script create --name hello --language python --file scripts/hello.py
viat script run hello --args '{"name":"Ada"}'
viat script update hello --file scripts/hello.py
```

Expected result body: `{"hello":"Ada"}`. Omitted `name` calls Python's default and returns `{"hello":"world"}`. These are authenticated server **draft** operations, not offline tests; the account needs project authoring/execution access. Publication is separate: [Testing](testing.md) provides exact endpoint create/publish and cleanup commands. Do not create a resource for this example.

## Function and binding rules

Define top-level `main`; the worker imports the module and calls `main(**args)`. `async def main(...)` is awaited. An unrecognized argument can therefore raise Python's unexpected-keyword error unless your signature accepts `**kwargs`; missing required arguments fail. Use explicit typed parameters for a useful endpoint schema rather than relying on `**kwargs` as validation. Import-time code runs when a worker loads, not necessarily once per request. Keep request data out of module globals in reused workers.

Annotations drive best-effort input/output schema extraction on save. Standard primitives, supported containers and local structured declarations can be described; unknown/imported advanced types can remain open. Optional annotations and default None accept null while checking non-null values. Missing annotation means no type check for that field, not “string.” Inspect schema warnings and verify endpoint binding rather than assuming every Python type is understood.

## Context, resource calls and errors

`from viat import ctx, ViatError, ViatResponse, ViatStream` provides request/principal, declared resources and responses. Resource helpers are synchronous in Python, including when called inside an async main; writing `await ctx.resources.api.get(...)` does not make them asynchronous. Use `getattr(ctx.resources, "folder/name")` for names unsuitable for attribute syntax. `ctx.tasks` exists; Rust/shell task examples are not interchangeable.

`raise ViatError(status=400, code="invalid_name", message="...")` is an intentional refusal. Plain exceptions are failures with traceback in logs. Return ordinary JSON-compatible values or an explicit response; a generator alone is not the streaming response contract. For a stream return `ViatStream(generator)` and declare `# stream: true`. Full envelopes, cancellation and late-stream errors are in [Runtime](runtime.md); request and helper fields are in [Context](context.md).

## Verification and unsupported cases

Start with the resource-free offline case in [Testing](testing.md), then run a safe draft and publish only after inspecting schema/environment warnings. `uses:` imports only project assets; normal package imports need requirements. File handles from multipart requests expire after the run. The worker is privilege-separated, not a guarantee that arbitrary hostile package build scripts are safe. Timeouts and cancellation are not a database transaction or an automatic retry. Unpublish/delete a disposable endpoint before deleting its script.
