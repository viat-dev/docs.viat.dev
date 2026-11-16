---
title: Publish your first endpoint
description: Starting from a running deployment and a platform login, complete a Python script, a public endpoint, publishing, an HTTP call, logs and cleanup.
doc_id: getting-started.first-endpoint
verified_release: '1.1.0'
channel: stable
---

# Publish your first endpoint

At the end of this tutorial you own a live endpoint that anyone can call:

- a dedicated project `hello-lab` containing the Python script `hello`;
- a published `POST /hello` that needs no credentials to call;
- one execution log you can see in the console's runs page.

Everything uses **real CLI 1.1.0 syntax** and needs no external resources,
paid providers or production databases. The endpoint tree screenshot below is
what the console shows when you are done.

![Endpoint tree with the published POST /hello](/screenshots/en/endpoints.png)

The endpoint is deliberately **anonymous**: anyone who can reach the instance
can call it — keep private data out. Work only on a deployment you may modify,
ideally a loopback-only [Compose install](../installation/docker-compose.md).

## Prerequisites

- A running **server 1.1.0** instance and the matching **CLI 1.1.0**; the CLI
  neither installs nor starts a server.
- The instance base URL plus a platform email and password; the instance must
  be activated (platform Owner/Admin handles that via
  [activation](../instance/activation.md)).
- Server-side `uv`/Python support (the official image bundles it). Your
  workstation only needs the CLI, Bash, a text editor and `curl`.
- Permission to create a project (the creator becomes its Owner). Reusing a
  project is fine, but publishing then needs a project Owner/Admin — a
  Developer can only edit.
- An unused project slug `hello-lab` and a local directory
  `viat-first-endpoint`. If either exists, pick new names and replace them
  consistently; never overwrite existing assets.

Shell snippets are **Bash**. The automated acceptance at the end of this page
uses an isolated test host, not a customer deployment.

## 1. Check the deployment and sign in

For a local Compose install:

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

Expect `/healthz` to answer `{"status":"ok"}`; `whoami` prints your email; the
version output includes `viat 1.1.0 (cli)` and, when available, a server
`1.1.0` line. For a remote instance set `VIAT_SERVER` to the real base URL —
including any reverse-proxy mount prefix, but never `/ui/` or `/p/hello-lab`.

> [!NOTE]
> Password sign-in requires both `--email` and `--password`; the CLI does not
> prompt for missing values. `read -s` keeps the password out of shell
> history, but the argument is briefly visible to local processes — use a
> trusted workstation. With MFA enrolled, enter the code when the CLI asks.
> After login, `.viat/config.yaml` holds session credentials: keep it secret
> and out of version control; config lookup and SSO are covered in
> [platform users](../instance/platform-users.md).

## 2. Create and select the project

```sh
viat project create hello-lab "Hello Lab"
viat project select hello-lab
viat project member ls --json
```

Expect `created hello-lab` and `selected hello-lab`, with your member row at
`role: "owner"`. This creates remotely — no local scaffold. A new project
ships with a default endpoint tree and the built-in `anonymous` authorizer
that step 4 selects explicitly.

If you see `slug already taken`, pick another slug unless you are sure the
project is your own throwaway. Slugs and member roles:
[creating projects together](../projects/create-and-collaborate.md).

## 3. Write and upload the script

Create the UTF-8 file `hello.py` with exactly:

```python fixture=hello-endpoint/hello.py
def main(name: str = "world") -> dict:
    print("hello endpoint invoked")
    return {"message": f"Hello, {name}!"}
```

This is the `main(...)` function signature the runtime executes — no invented
positional `ctx`, no resource declarations or dependency block needed. The
annotation and default on `name` describe an optional input; the dict return
value becomes JSON. Upload and inspect the server-side draft:

```sh
viat script create --name hello --language python --file hello.py
viat script show hello --json
```

Expect `created hello (v1)`; the JSON view shows name, language, source,
version and the inferred input structure. `script create` takes
`--name/--language/--file` — `hello.py` is not an implicit positional.

Take the **draft** for a run:

```sh
viat script run hello --args '{"name":"Ada"}'
```

Expected output:

```json
{"message":"Hello, Ada!"}
```

Draft runs can have real side effects (this one only prints a log line). The
argument must be a valid JSON object; for embedded double quotes keep JSON
escaping under a shell single-quote:

```sh
viat script run hello --args '{"name":"Ada \"Lovelace\""}'
```

Expect the JSON form of `Hello, Ada "Lovelace"!`. Never pass Python dict
syntax like `{'name': 'Ada'}` as the argument.

![The hello script in the console editor](/screenshots/en/script-editor.png)

The screenshot shows the same script in the console: editor, inferred input
schema and run history share one page.

## 4. Bind an explicitly public endpoint

```sh
viat endpoint create --segment hello --method POST --script hello --authorizers anonymous
```

Expect two lines:

```text
created POST /hello
id: <server-generated-endpoint-UUID>
```

Angle brackets mark dynamic values. Copy the real `id:` value into:

```bash
read -r -p 'Endpoint UUID from create output: ' ENDPOINT_ID
viat endpoint show "$ENDPOINT_ID" --json
viat publish plan --json
```

Check method `POST`, path `/hello`, script `hello`, authorizers `anonymous`.
Root-level endpoints of a fresh project need no parent/tree arguments; this
example adds no authz gates.

The full call URL is **`$VIAT_SERVER/p/hello-lab/hello`** — not the
`/projects/hello-lab/...` management URL and not `/ui/...`.

## 5. Publish the endpoint

```sh
viat endpoint publish "$ENDPOINT_ID"
```

Expect `published POST /hello as v1` followed by the build result. This flow
publishes only the selected endpoint, not every unrelated draft in the
project; `viat publish plan` is a read-only preview.

> [!WARNING]
> When warnings or regression cases block publishing, read and fix the cause —
> do not reflexively add `--acknowledge-warnings` or
> `--acknowledge-test-failures`. The default `VIAT_PUBLISH_BUILD_BLOCK=0`
> allows publishing despite a failed build; check `viat script env hello --json`
> for the build state and use `viat script build hello --wait` to wait
> explicitly.

External traffic reads a **snapshot**: editing local `hello.py` alone changes
nothing server-side; `script update` changes the draft and publishing again
updates the public route. Dependency freezing rules:
[core concepts](../overview/concepts.md).

## 6. Call the published API

:::tabs id=first-call

::tab curl (anonymous caller)

```sh
curl --silent --show-error --include \
  --request POST "$VIAT_SERVER/p/hello-lab/hello" \
  --header 'Content-Type: application/json' \
  --data '{"name":"Ada"}'
```

Expect HTTP status **`200`** with body:

```json
{"message":"Hello, Ada!"}
```

`curl` needs no project token, which demonstrates the unauthenticated caller
most directly.

::tab viat call (project token)

```sh
viat call --method POST /hello --body '{"name":"Ada"}'
```

Expect the same JSON body. `viat call` uses the selected project's token and
is handy for debugging; the anonymous route does not need it.

:::

The endpoint requires a JSON **object** body — not a string, array or Python
literal. Without explicit override rules, object fields pass through as
function arguments; the empty object `{}` falls back to the Python default:

```sh
curl --silent --show-error \
  --request POST "$VIAT_SERVER/p/hello-lab/hello" \
  --header 'Content-Type: application/json' \
  --data '{}'
```

Expect `{"message":"Hello, world!"}`.

## 7. Find the execution and captured output

```sh
viat logs query --endpoint "$ENDPOINT_ID" --limit 10 --json
```

Expect an object with `items` and `next_before`; your public call appears
with `method: "POST"`, a success status, timing and a `request_id`. If logs
have not landed yet, retry shortly; do not confuse step 3's draft run with
these endpoint-filtered requests.

```bash
read -r -p 'Request UUID from logs query: ' REQUEST_ID
viat logs show "$REQUEST_ID" --json
```

Inspect the execution detail and the captured line `hello endpoint invoked`.
Timestamps, UUIDs, timing and pagination cursors are dynamic. For live
observation use `viat logs tail` (subscribe first, then call).

![Runs page](/screenshots/en/runs.png)

A successful HTTP response together with matching server logs is what proves
the route works: logs alone are not enough — rejected requests get logged
too. Logs obey backend and retention settings.

## Troubleshooting

| Failure | Check |
| --- | --- |
| `not logged in` / no server configured | Sign in again inside this directory; check `VIAT_CONFIG_DIR` or ancestor configs |
| `403 license_required` | A platform Admin/Owner must activate; HTTP health is not activation |
| Cannot select project | Verify instance, slug, platform email, membership |
| Can edit but publish returns `403` | Needs project Owner/Admin — Developer or platform Admin is not enough |
| Call gets `404` | Check the `/p/<slug>/...` URL and the active publication; drafts do not serve |
| Method rejected | Use `POST`; a browser address bar sends `GET` |
| `400` with body details | Send a valid JSON object; `name` is a string; check escaping and `Content-Type` |
| Python process/dependency errors | Check server `uv`, build state, logs and container permissions |
| Calls still return old code | `viat script update hello --file hello.py`, then publish again |
| "Public" route returns `401`/`403` | Check the published authorizers and gates, not just the draft |
| No matching log | Verify project, endpoint UUID, retention, and that the request reached this instance |

## 8. Clean up the tutorial

Unpublish first, then delete the endpoint and the script:

```sh
viat endpoint unpublish "$ENDPOINT_ID"
viat endpoint delete "$ENDPOINT_ID"
viat script delete hello
viat endpoint list --json
viat script list --json
```

The demo route stops answering; the built-in auth endpoints remain listed —
that is expected. The commands do not delete the project or run history;
there is no `viat project delete` in this CLI. Finish with `viat auth logout`,
which clears the **local** CLI session (revoke server sessions from the
console's session controls); remove the local directory once you are sure,
and never commit or share `.viat/`.

## Verification basis

Contract source `03751a67`: the Clap definitions in
`crates/viat-cli/src/main.rs`; `commands/{auth,project,script,endpoint,logs}.rs`;
`crates/viat-api/tests/it/script_schema.rs`; JSON body binding in
`handlers/dispatch.rs`; snapshot publishing in `handlers/snapshots.rs`. Target
stable artifacts `1.1.0` (`fd340879`).

> [!NOTE]
> This page's `hello.py` is actually executed by the product-side
> `handbook_first_endpoint_real_cli` integration test against an isolated
> PostgreSQL test database (login, create, publish, anonymous call, cleanup).
> The test license and synthetic accounts do not cover installation, real
> activation-code acquisition, MFA/SSO or external providers — those are
> separate prerequisites.
