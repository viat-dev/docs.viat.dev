---
title: 'Worker protocol 1'
description: 'Process channels, envelopes, frames and a complete conforming program.'
doc_id: script.worker-protocol
verified_release: '1.1.0'
channel: stable
---

# Worker protocol 1

This is the process contract for [binary programs](binary.md) and the shipped language runners, not an HTTP API. A binary must implement it even if written in Go/C++/Python. Protocol version is literal `1` in its manifest.

## Process and channels

The platform starts the program as the worker account with a cleared/rebuilt environment, temp working directory and bounded execution time. **stdin** contains newline JSON request envelopes and RPC replies. **fd 3** is the control pipe: every frame is a UTF-8 sentinel immediately followed by JSON and a newline, flushed after writing. Plain stdout/stderr is logging, never protocol. A one-shot process gets one request and exits 0 after its result. `--loop` means a pooled process: announce READY, serve sequential requests, exit on stdin EOF; it may retain infrastructure state, not previous caller data.

```json
{"request_id":"fixture-1","args":{"name":"Ada"},"ctx":{"project_id":"fixture","request":{},"principal":{},"resources":{}}}
```

`ctx` includes request/principal/resources/project_id, optional function (library export name), ws and trigger metadata. Request fields and credential caveats are in [Context](context.md). Preserve the envelope request_id in every outcome.

## Frames

| Marker | Body and direction |
| --- | --- |
| `___VIAT_READY___` | Bare line, worker→host; **only pooled mode**, before requests. |
| `___VIAT_RESULT___` | `{request_id,ok: JSON}` or `{request_id,response:{body_kind,body,status,headers,content_type}}` or `{request_id,error:{kind,status?,code?,message,extra?}}`. Exactly one outcome. |
| `___VIAT_LOG___` | `{level,msg,fields}`; debug/info/warn/error structured output. |
| `___VIAT_STDOUT___` | Verbatim text after marker, not JSON; pooled output attribution. |
| `___VIAT_PROGRESS___` | `{percent?,message?}`; detached progress. |
| `___VIAT_RPC___` | `{id,op,name?,req?...}` worker→host. |
| `___VIAT_RPC_REPLY___` | `{id,value}` or typed error; host→worker on **stdin**. |
| `___VIAT_STREAM_BEGIN___` | `{request_id,status,headers,content_type}`; pooled stream start instead of RESULT. |
| `___VIAT_CHUNK___` | `{request_id,data: JSON}`; one item. |
| `___VIAT_STREAM_END___` | `{request_id,outcome:{ok:true}}` or `{request_id,outcome:{error:{...}}}`; note the required **outcome wrapper**. |

Response `body_kind` is `json`, `text`, `file` or `bytes`. File body references `{storage,id or key,filename?,disposition?}` and is authorized/streamed by the platform; bytes body is `{base64,filename?,disposition?}` with helper byte limits. Error kind `viat` preserves intentional status/code/message/extra; runtime/contract/import/protocol errors fail as system execution. Streams require the pooled stream driver; one-shot streaming is a contract error. After stream begin a later failure cannot change HTTP status.

Pooled cancellation arrives as `{"request_id":"...","cancel":true}`; do not issue a second result for the cancel envelope. A correct long-running implementation needs a reader that can notice it while work is in flight. Ignoring it is not an honest “cancellable” guarantee.

## Complete resource-free worker

Save as `out/echo-worker`, make it executable on your build machine, and use the upload commands on [Binary](binary.md). This deterministic example uses Python only as a portable demonstration of the process protocol, not the Viat Python SDK. It needs Python 3 on the execution node, supports both one-shot and --loop, and does not perform resource calls. It is sequential and does not claim interruption of an in-flight long handler.

```python
#!/usr/bin/env python3
import json
import os
import sys

control = os.fdopen(3, "w", buffering=1)
loop = "--loop" in sys.argv

def frame(marker, body=None):
    control.write(marker + ("" if body is None else json.dumps(body)) + "\n")
    control.flush()

if loop:
    frame("___VIAT_READY___")
for line in sys.stdin:
    envelope = json.loads(line)
    if envelope.get("cancel"):
        continue
    request_id = envelope["request_id"]
    args = envelope.get("args") or {}
    if not isinstance(args.get("name"), str):
        frame("___VIAT_RESULT___", {"request_id": request_id, "error": {
            "kind": "viat", "status": 400, "code": "invalid_name",
            "message": "name must be a string", "extra": {}}})
    else:
        frame("___VIAT_RESULT___", {"request_id": request_id,
              "ok": {"hello": args["name"]}})
    if not loop:
        break
```

Input above yields a RESULT whose `ok` is `{"hello":"Ada"}`; missing/non-string name yields `400 invalid_name`. No resource, paid model or message send is involved. Do not run it as an ordinary script without fd 3: it is designed to be launched by the platform.

## Resource RPC and security

Send `___VIAT_RPC___{"id":1,"op":"http","name":"api","req":{"method":"GET","path":"/health"}}` on fd 3. Read `___VIAT_RPC_REPLY___{"id":1,"value":...}` from stdin. Failure has `error`, optionally `error_code`, `status`, `extra`; preserve typed refusals instead of flattening every reply into a generic 500. Match replies by id; pooled stdin can interleave later envelopes and cancellation, so use one reader and queue non-reply envelopes. A program doing concurrent RPC must demultiplex multiple outstanding ids.

Resource names must be declared with `# @resource`; the broker checks kind, project and operation-specific policy. Prefer broker calls rather than extracting auth fields. Config/secret values can intentionally enter application code; legacy connection-shaped projections differ from broker-only request resources. Never promise that every resource field is credential-free, and never log a projection wholesale.

| Operation | Main request/result contract |
| --- | --- |
| `get`, `set` | Declared secret; get returns string/null, set uses frame `value`, returns null. |
| `http`, `graphql` | HTTP `{method,path,query?,headers?,json? or body_text?/body_b64?}` → `{status,headers,body}`; GraphQL `{query,variables?,operation?}` → data. |
| `sql_query`, `pg_graphql`, `db_tx` | Bound SQL `{sql,params?,execute?}` → rows/affected; GraphQL document/variables for PG/MySQL/SQLite; transaction begin/query/execute/graphql/set_reason/commit/rollback. |
| `llm`, `llm_stream` | Messages/options → chat reply; stream replies share id with `delta` then `done:true`, not one ordinary value. |
| `s3`, `storage` | Object/file operations; S3 uses frame fields including `s3_op`, not the generic req layout. Storage uses tagged req op. |
| `cloud`, `crypto` | Cloud action/params and crypto tagged operations; platform applies credentials/key material. |
| `mail_send`, `imap`, `push_send`, `amqp_publish` | Send/fetch/message operations; acceptance is not final delivery. |
| `redis`, `mongo`, `library_call` | Tagged cache/document operations; library `{function,args}` returns function output under frozen library build and caller principal. |
| `authz_check`, `cache_purge`, `tasks` | `{type,action,attrs}` → `{allowed}`; `{endpoint}` → `{purged}`; tasks action enqueue/get/cancel. Raw tasks RPC is not a Rust/shell SDK API promise. |
| `project_users`, `project_roles`, `project_read_social_identity`, `project_provision_meta` | Admin operations or narrower current-user grants; not caller-selectable arbitrary user capabilities. |
| `ws`, `im`, `platform_call`, `social_app_call` | Socket/chat/platform operations; resource/account and project gates still apply. |

Per-kind payload options live in the [resource references](../resources/index.md); [Context](context.md) gives guest helper inputs/outputs. Unknown operations and wrong resource kinds fail. There is no blanket RPC retry; avoid replaying writes without idempotency.

## Schema, failure and compatibility

Rust compile probes `--viat-schema` for one stdout line `___VIAT_SCHEMA___{"input":...,"output":...}`. **Binary programs are not probed**; do not claim an implemented flag creates an endpoint schema. Exit nonzero, omit a result, malformed frames or invalid result shapes fail the run. Timeout may kill the process without a prior signal; cancellation support is lane-specific. A cancel frame is not durable resume or rollback.

Breaking required framing/envelope changes require a new protocol version; optional fields/operations can be added within version 1. Ignore unknown optional envelope fields while validating required fields. Test both modes on the actual target, then upload/publish deliberately. Keep secrets and provider calls out of conformance fixtures.
