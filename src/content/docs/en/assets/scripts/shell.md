---
title: 'Shell scripts'
description: 'Bash environment, input headers, response and error helpers.'
doc_id: script.shell
verified_release: '1.1.0'
channel: stable
---

# Shell scripts

Use language `shell`. Each run starts Bash (deployment may select the executable) with `set -euo pipefail`; **jq is required** because response/log/error helpers use it. There is no main function and no Python-shaped `ctx`. The platform sources helpers, then executes the script body. A shebang is allowed but does not select arbitrary runtimes.

## Complete minimal script

Save `scripts/shell_echo.sh`:

```bash
#!/bin/bash
# @input name:string
viat_log_info "greet" "who=$VIAT_ARGS_NAME"
viat_response "$(jq -nc --arg name "$VIAT_ARGS_NAME" '{hello:$name}')"
```

```bash
viat script create --name shell_echo --language shell --file scripts/shell_echo.sh
viat script run shell_echo --args '{"name":"Ada"}'
viat script update shell_echo --file scripts/shell_echo.sh
```

Expected **published HTTP response body** is `{"hello":"Ada"}`. In 1.1.0 `viat script run` prints `null` for an explicit response: the draft API does not return its response envelope as output. Verify the public body after deliberately binding/publishing the disposable endpoint. Inside a workflow, this shell result is `{"body":{"hello":"Ada"}}`, so read `$step.output.body`. This uses only platform helpers; no resource/network is needed. Requires project authoring/run access. [Testing](testing.md) supplies endpoint publish and cleanup commands; `viat script test` is not a generic shell test runner.

## Environment contract

`VIAT_ARGS_JSON` is the whole JSON object; `VIAT_ARGS_<NAME>` is the uppercased top-level argument name. String values are bare strings, other values JSON-encoded. Use jq over `VIAT_ARGS_JSON` when distinctions between null/number/string matter; quote variable expansions. `VIAT_REQUEST`, `VIAT_PRINCIPAL`, `VIAT_RESOURCES` are JSON blobs. `VIAT_REQUEST_BODY_FILE` names raw-body bytes only when that endpoint mode is enabled; consume the file during this run, not later.

Declared resource projection also exposes `VIAT_RESOURCE_<NAME>_<FIELD>` fields. Do not use these to extract authentication credentials; use broker-capable Python/TypeScript/Rust if you need resource calls. Shell has no `ctx.tasks` or generic broker wrapper. The environment is cleared and rebuilt with PATH/HOME and operator-approved passthrough; arbitrary server variables are not available.

## Helpers

| Function | Arguments and result |
| --- | --- |
| `viat_log_info`, `viat_log_warn`, `viat_log_error` | `MESSAGE [key=value ...]`; structured log. Values are strings, additional `=` stays in the value. |
| `viat_log_sensitive` | Same fields, all field values replaced by `***`; message itself is not masked. |
| `viat_response` | `BODY [STATUS] [CONTENT_TYPE]`; default 200; body recognized as JSON when jq accepts it, otherwise text. Emits an explicit response; no header option. |
| `viat_error` | `STATUS CODE MESSAGE [key=value ...]`; intentional refusal with extra fields, exits 87. Do not use exit 87 yourself without the helper. |

Example rejection: `viat_error 400 invalid_name "name must not be blank"`. Other nonzero exits are runtime failures with stderr. Without an explicit response the result is null; captured stdout is logging, not a parsed return value. The helper tests JSON with `jq -e .`, so top-level `false` and `null` take its text branch despite being valid JSON. Wrap such values in an object if a JSON contract is required. Echoing a line that resembles a protocol sentinel does not forge a response.

`# @input name:type[=default]` is read only in the comment header, before the first command. Unknown types become string; output schema is always open with warning. Defaults are schema strings, so implement runtime fallback explicitly (`${VIAT_ARGS_NAME:-world}`) if omission is allowed. See [Directive types](annotations.md).

## Limits and verification

Timeout kills the run/process group; background subprocesses do not become managed durable jobs. There is no streaming `ViatStream` support, no package requirements installer and no automatic shell resource RPC. Validate with safe local Bash/jq fixtures separately, then a resource-free draft run. Read stderr when `set -u` rejects a missing variable. Never insert untrusted input into `eval` or shell command strings. Any external command you deliberately run can have real effects and requires its own authorization and idempotency plan.
