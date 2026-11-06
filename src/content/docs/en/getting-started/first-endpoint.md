---
title: Publish your first endpoint
description: Complete a runnable path from an existing deployment and platform login to a Python script, public endpoint, publish, HTTP call, logs, and cleanup.
doc_id: getting-started.first-endpoint
verified_release: '1.1.0'
channel: stable
---

# Publish your first endpoint

This tutorial creates an isolated `hello-lab` project, uploads one Python function, publishes `POST /hello`, calls it without credentials, and reads its execution logs. It uses **real CLI 1.1.0 syntax** and a harmless greeting; no external resource, paid provider, production database, or production execution is needed.

The endpoint is deliberately **anonymous**. Do not put private data or real business operations behind it. Run this only on a deployment you are authorized to change, ideally the loopback-only [Compose installation](../installation/docker-compose.md).

## Prerequisites

- An existing, running **server 1.1.0** instance and matching **CLI 1.1.0** on your workstation. The CLI does not install or start the server.
- Its base URL and a platform email/password. The instance must be activated; if it is not, a platform Owner/Admin follows [Activation](../instance/activation.md).
- `uv`/Python support on the **server**. The official image already supplies it. The workstation only needs the CLI, Bash, a text editor, and `curl` for this tutorial.
- Permission to create an isolated project. Its creator becomes project Owner; otherwise an existing project's Owner/Admin must publish for you. Project Developer can edit but cannot publish.
- An unused project slug `hello-lab` and private local directory `viat-first-endpoint`. If these already exist, choose another slug/directory and replace every occurrence consistently rather than overwriting existing assets.

The shell snippets use **Bash**. Run them only against your own authorized non-production instance. The automated acceptance described at the end used an isolated test host, not a customer or production deployment.

## 1. Check the deployment and sign in

For the local Compose installation:

```bash
mkdir viat-first-endpoint
cd viat-first-endpoint
umask 077
export VIAT_SERVER=http://127.0.0.1:8080
curl --fail --silent --show-error "$VIAT_SERVER/healthz"
viat --version
read -r -p 'Platform email: ' VIAT_EMAIL
read -r -s -p 'Platform password: ' VIAT_PASSWORD; printf '\n'
viat auth login --server "$VIAT_SERVER" --email "$VIAT_EMAIL" --password "$VIAT_PASSWORD"
unset VIAT_PASSWORD
viat auth whoami
viat version
```

For a remote instance, replace the `VIAT_SERVER` assignment with its real base URL before running. Include any reverse-proxy mount prefix, but not `/ui/` or `/p/hello-lab`. For this local setup, `/healthz` returns `{"status":"ok"}`. Login prints `logged in as <your-email>`; `whoami` prints the same email. Version output should include `viat 1.1.0 (cli)` and the server's `1.1.0` line when available.

Password login requires both `--email` and `--password`; the CLI does not prompt for omitted values. These Bash prompts keep literal passwords out of shell history, but the resulting password argument is briefly visible to local process inspection. Use a trusted workstation. If enrolled in MFA, follow the CLI's code prompt. If enrollment is required, complete it once in the console and retry. Stop on an authentication error instead of continuing with another saved session.

Your `.viat/config.yaml` contains session credentials. Keep it private and out of version control. See [Platform users](../instance/platform-users.md) for configuration lookup and SSO details.

## 2. Create and select the project

```sh
viat project create hello-lab "Hello Lab"
viat project select hello-lab
viat project member ls --json
```

Expected output includes `created hello-lab` and `selected hello-lab`; your membership row has `role: "owner"`. Creation is a remote operation, not a local scaffold. The project already has a default endpoint tree and built-in `anonymous` authorizer, which this example explicitly selects later.

If `slug already taken` appears, do not keep using that name unless it is genuinely your disposable project. [Create and collaborate](../projects/create-and-collaborate.md) explains slugs and member roles.

## 3. Write and upload the script

Create a UTF-8 file named `hello.py` with exactly:

```python fixture=hello-endpoint/hello.py
def main(name: str = "world") -> dict:
    print("hello endpoint invoked")
    return {"message": f"Hello, {name}!"}
```

This is the Python `main(...)` function grammar the runtime executes. It does not accept a fake `ctx` positional parameter. This function needs no resource declaration and no dependency block. The `name` annotation/default describes an optional string input; the dictionary return becomes JSON.

Upload it and inspect the stored draft:

```sh
viat script create --name hello --language python --file hello.py
viat script show hello --json
```

Expected create output: `created hello (v1)`. The JSON view includes `name`, `language`, source content, version, and inferred schema. `script create` uses `--name`, `--language`, and `--file`; `hello.py` is not an implicit positional source argument.

Run the **draft** directly:

```sh
viat script run hello --args '{"name":"Ada"}'
```

Expected JSON output:

```json
{"message":"Hello, Ada!"}
```

Whitespace/pretty-printing can differ. This run executes the server-side draft but creates no public HTTP route. Draft runs can have real side effects in general; this particular function only returns a greeting and emits a log line.

JSON must remain valid after shell parsing. For a name containing quotation marks, preserve JSON escapes inside single shell quotes:

```sh
viat script run hello --args '{"name":"Ada \"Lovelace\""}'
```

Expected JSON string value is `Hello, Ada "Lovelace"!` (serialized quotes appear as `\"` in JSON). Do not write Python dictionary syntax such as `{'name': 'Ada'}` as the JSON argument.

## 4. Bind an explicit public endpoint

```sh
viat endpoint create --segment hello --method POST --script hello --authorizers anonymous
```

Expected output has two lines:

```text
created POST /hello
id: <server-generated-endpoint-UUID>
```

The angle-bracket text describes a dynamic value, not a literal UUID to submit. Copy the actual value after `id:` into the following prompt:

```bash
read -r -p 'Endpoint UUID from create output: ' ENDPOINT_ID
viat endpoint show "$ENDPOINT_ID" --json
viat publish plan --json
```

Verify method `POST`, path `/hello`, script `hello`, and allowed authorizer `anonymous`. No parent/tree flag is needed for this root-level endpoint in the new project's default tree. No authorization gate is added by this example. An anonymous route is publicly callable by anyone who can reach the instance.

The full caller URL is **`$VIAT_SERVER/p/hello-lab/hello`**. It is not the management URL `/projects/hello-lab/...`, and it is not `/ui/...`.

## 5. Publish this endpoint

```sh
viat endpoint publish "$ENDPOINT_ID"
```

For a new endpoint, expect `published POST /hello as v1`, followed by any build result. This deliberately publishes only the selected endpoint, not every unrelated draft in a shared project. `viat publish plan` was a read-only review, not the publication itself.

If warnings or enabled saved regression tests block publication, read and fix them. Do not automatically add `--acknowledge-warnings` or `--acknowledge-test-failures`. Check dependency-build results too: default `VIAT_PUBLISH_BUILD_BLOCK=0` can allow publishing even if a build fails. Default builds are synchronous; an operator can enable background builds, in which case wait for readiness before expecting the first call to work. `viat script env hello --json` shows recorded environment state, and `viat script build hello --wait` explicitly prepares it.

Published dispatch reads a **snapshot**, not the live endpoint/script row. Editing `hello.py` alone changes nothing on the server; `script update` changes the draft, and a later publish changes this public route. Ordinary `uses:` imports are frozen at publish; explicitly `(live)` imports are an exception. See [Core concepts](../overview/concepts.md).

## 6. Call the published API

No platform token or API key is needed because the route explicitly uses `anonymous`:

```sh
curl --silent --show-error --include \
  --request POST "$VIAT_SERVER/p/hello-lab/hello" \
  --header 'Content-Type: application/json' \
  --data '{"name":"Ada"}'
```

Expected HTTP status: **`200`**. Expected JSON body:

```json
{"message":"Hello, Ada!"}
```

This endpoint's normal body mode expects a JSON **object**, not a JSON string, array, or Python literal. Without explicit overrides, object fields pass through as function arguments. This function has no required input; the following uses its Python default:

```sh
curl --silent --show-error \
  --request POST "$VIAT_SERVER/p/hello-lab/hello" \
  --header 'Content-Type: application/json' \
  --data '{}'
```

Expected body: `{"message":"Hello, world!"}`. A JSON object can also be supplied through the CLI with `viat call --method POST /hello --body '{"name":"Ada"}'`; `curl` above is preferred here because it demonstrates an unauthenticated application caller without depending on any configured project token.

## 7. Find the execution and its captured output

```sh
viat logs query --endpoint "$ENDPOINT_ID" --limit 10 --json
```

Expected response is an object with `items` and `next_before`. The recent published calls appear with `method: "POST"`, a successful status, latency, and a `request_id`. If ingestion is not yet visible, wait briefly and query again; do not confuse the earlier draft test with this endpoint-filtered request.

Copy one returned request's `request_id`:

```bash
read -r -p 'Request UUID from logs query: ' REQUEST_ID
viat logs show "$REQUEST_ID" --json
```

Inspect the execution and captured line `hello endpoint invoked`. The exact timestamps, UUIDs, latency, and pagination cursor are generated values; this tutorial does not provide fixed expected IDs. For an interactive live stream, `viat logs tail` subscribes until `Ctrl-C`; start it before another call if you want to watch live events.

Successful HTTP output and matching server logs together verify the route. A log record alone is insufficient: refused requests are logged too, even when the target never starts. Logs are subject to backend and retention settings.

## Troubleshooting

| Failure | Check |
| --- | --- |
| `not logged in` / no server configured | Repeat login in this private directory; check `VIAT_CONFIG_DIR` or an ancestor's config |
| `403 license_required` | Platform Admin/Owner must activate; healthy HTTP does not imply activation |
| Cannot select project | Confirm instance, slug, platform email, and membership |
| Edit works but publish returns `403` | Project Owner/Admin is required, not just Developer or platform Admin |
| `404` when calling | Correct `/p/<slug>/...` URL and active publication; a draft is not served |
| Method refusal | Use `POST`, not a browser address-bar `GET` |
| `400` with body/input detail | Send a valid JSON object and a string `name`; check quoting and `Content-Type` |
| Python spawn/dependency error | Check server `uv` availability, environment build state, logs, and container permissions |
| Calling still returns old code | Upload the changed file with `viat script update hello --file hello.py`, then publish again |
| `401`/`403` on a supposedly public route | Inspect the published authorizer/gate configuration, not only the draft |
| No matching log row | Check selected project, exact endpoint UUID, retention/backend delay, and whether the request reached this instance |

The example has no upstream secrets and no external side effects. Do not generalize that safety to scripts using real database, mail, message, or model resources.

## 8. Clean up the tutorial

Unpublish before deleting the endpoint and script:

```sh
viat endpoint unpublish "$ENDPOINT_ID"
viat endpoint delete "$ENDPOINT_ID"
viat script delete hello
viat endpoint list --json
viat script list --json
```

The example route should no longer answer successfully; built-in auth endpoints may remain in the list. These commands do not delete the project or its past execution records. Do not invent a `viat project delete` command; this CLI does not have one. Remove any disposable collaborator memberships separately.

When finished, `viat auth logout` clears the resolved **local** CLI session; it does not revoke a stolen server session in this release. Use console session controls for revocation. Remove the local tutorial file/directory only after confirming you do not need it; keep `.viat/` out of commits and shared archives.

## Executed acceptance and remaining boundaries

The shared `hello.py` passed local function assertions and the product's opt-in `handbook_first_endpoint_real_cli` integration test. That test built the CLI, created an isolated PostgreSQL test database and loopback API, then ran login, project creation/selection, script upload/draft execution, endpoint creation/publication, anonymous HTTP and CLI calls, log inspection, unpublish/delete and local logout. It read this handbook's actual source file rather than a copied greeting.

The host used a deliberately active **test license** and a synthetic account. This verifies the endpoint path, not installation, obtaining/activating a real customer code, MFA/SSO, every failure scenario, or an external provider. Those remain separate prerequisites and acceptance tasks.

## Verification basis

Contract source `03751a67`: Clap definitions in `crates/viat-cli/src/main.rs`; command implementations `commands/{auth,project,script,endpoint,logs}.rs`; Python signature/schema examples in `crates/viat-api/tests/it/script_schema.rs`; JSON body binding in `crates/viat-api/src/handlers/dispatch.rs`; snapshot publication in `handlers/snapshots.rs`. This page targets stable server/CLI artifacts `1.1.0` (`fd340879`).
