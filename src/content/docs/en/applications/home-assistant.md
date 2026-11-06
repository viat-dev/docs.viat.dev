---
title: "Home Assistant: guarded generic HTTP adapter"
description: "Separate state reads from strictly allowlisted, explicitly authorized device actions."
doc_id: applications.home-assistant
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# Home Assistant through generic HTTP

`examples/home-assistant/` contains actual repo-sync resources, Python handlers, a read workflow, endpoint bindings, shared synthetic states and a standard-library validator. It is a **generic `http_api` adapter** for Home Assistant's HTTP API, not a native Home Assistant connector, MQTT integration or natural-language device agent. There is no model choosing services, no arbitrary URL proxy and no unattended action schedule.

**Verification status:** the coordinator's offline harness passed all **10 unit tests** against the actual handlers with explicit fake contexts and resources. A running Viat server, real HTTP broker, Home Assistant and physical device behavior remain unverified. Real provider/device verification is necessarily manual and requires consent; see [verification layers](../reference/validation.md).

## Prerequisites and defaults

Use activated Viat server/CLI **1.1.0**, server Python/uv, platform login and a **new isolated project** you may edit and publish (Owner/Admin for publish). Workstation Python 3 runs the offline validator; no third-party Python packages are required. Follow [first endpoint](../getting-started/first-endpoint.md) for instance login. Home Assistant is not required for the default fixture path.

The inert settings have empty user allowlists, fixture-only reads and all actions disabled. This complete resource file is shared by scripts and validation:

```json fixture=home-assistant/project/resources/ha_settings.yaml
{
  "name":"ha_settings","kind":"config",
  "plain":{"data":{
    "http_authorizers":["password"],
    "read_user_ids":[],"execute_user_ids":[],
    "read_mode":"fixture","read_network_enabled":false,"real_actions_enabled":false,
    "fixture_states":{
      "sensor.example_temperature":{"entity_id":"sensor.example_temperature","state":"21.5","attributes":{"unit_of_measurement":"°C"}},
      "light.example_desk":{"entity_id":"light.example_desk","state":"off","attributes":{"brightness":0}}
    }
  }},"secret":{}
}
```

`ha_api` has a synthetic `.example.test` HTTPS base, `auth_type:bearer` and **no token**. Missing bearer auth is not authenticated access. Do not call its Test action: that makes a real GET. Empty secret objects preserve existing secrets on repo PATCH; they do not provision credentials. No schedules or chat triggers are installed for this case, so none can enable actions accidentally.

## Apply only the owned content

From the handbook checkout root, these are manual commands, not executed evidence:

```sh
cd examples/home-assistant
python3 -I validate.py
cd project
viat project create home-assistant-example "Home Assistant example"
viat project select home-assistant-example
viat project diff --only resources,scripts,workflows,endpoints
viat push --only resources,scripts,workflows,endpoints
viat endpoint list --json
viat script run ha_read --args '{}'
```

The last command is an intentional **negative** check: default config must fail with `403 forbidden`, not return a fixture anonymously. Keep the new endpoint IDs and created names in a private ownership record. Use a different unused slug if necessary and update `viat.yaml` and commands together. Push must run from `project/`.

Never use an all-kind push with this minimal metadata: omitted authorizers/roles/scope claims may prune seeded authentication state. `--only` selects whole collections, not a file-prefix filter. Endpoint sync can prune nodes in its visited trees; a new isolated project and reviewed `viat project diff` are mandatory. No blanket prune, migration, publish or server execution is hidden in this example's validator.

## Configure an authenticated fixture reader

1. In the project's Users console create a disposable active project user, set its password securely (>=8 characters; obey the project's MFA policy), and record its returned user UUID. Alternatively `viat p-user create --identity home-reader-example`, then use the console to set a private password. `viat p-user list --json` supplies the actual UUID. A platform collaborator/PAT is **not** that user.
2. Add only that actual UUID to `ha_settings.plain.data.read_user_ids`. Leave `execute_user_ids:[]`, network reads and real actions off. The allowed HTTP authorizer is `password`; if using a different existing project-user authorizer, change both `http_authorizers` and the endpoint lists intentionally. Do not add anonymous or infer access from `is_admin`, role labels, body fields or headers.
3. In `endpoints/home-assistant/home-state.get.yaml` change `allowed_authorizers:[]` to `["password"]`. Keep the action endpoint deny-all. Use `viat push --only resources,endpoints`, inspect `viat publish plan --json`, and publish **only the state leaf's returned ID** with `viat endpoint publish STATE_ENDPOINT_ID`.
4. Log in as that end user using `POST /p/home-assistant-example/auth/login` with `{identity,credential,authorizer:"password"}`; follow any MFA ticket flow. It returns `token`, not a console `access_token`. Hold it privately as `PROJECT_TOKEN`; do not commit passwords/tokens. See [endpoint authentication](../auth/endpoints.md).

For the default newly created tree path, an authorized manual read is:

```sh
curl --fail --silent --show-error \
  "$BASE/p/home-assistant-example/home-assistant/home-state?entity=sensor.example_temperature" \
  -H "Authorization: Bearer $PROJECT_TOKEN"
```

`BASE` is your existing instance base URL. Expected result is `fixtures/expected.json` → `read`: `{"entity_id":"sensor.example_temperature","state":"21.5","fixture":true}`. Tree names are path prefixes for new repo-created trees; confirm actual paths from list output. Verify no token, a different unlisted user and a non-admitted authorizer are refused. Do not “fix” a denial by enabling public access.

## Real read adapter

Only after explicit network approval, set `ha_api.plain.base_url` to the actual Home Assistant **origin** (no `/api` suffix; the script supplies it), provision a least-privilege long-lived access token in **`secret.token` through the console**, and ensure Viat's outbound URL guard permits that destination. Credentials must never go in plaintext headers, scripts, fixtures or base URL. For a private CA install the appropriate trust chain on the API node; do not disable TLS verification. HTTPS, routing/firewall and HA account privileges are deployment prerequisites, not features established by the fixtures.

Set `read_mode:http` and `read_network_enabled:true`, keep real actions off, and push only resources. The read handler permits exactly `sensor.example_temperature` and `light.example_desk`, calls `GET /api/states/<entity>` with a 5-second timeout and returns only `entity_id`, state string and fixture flag. It drops all arbitrary attributes, so coordinates, tokens or upstream metadata are not echoed. Replace sample entity IDs deliberately in **both handlers' code allowlists**, shared states and validation requests if your isolated test entity has another name; review and republish affected endpoints. A 404, timeout or malformed state is not a fixture fallback or proof of a physical reading.

## Strict action contract and opt-in

`ha_execute.py` is separate from `ha_read.py` and is never called by the read workflow. Before **any** POST it checks:

- A platform-resolved non-null `ctx.principal.user_id`, an explicitly admitted `ctx.principal.authorizer`, and that user UUID in the separate `execute_user_ids`. No automatic administrator bypass. Project editor access can edit these trusted policies and is outside this runtime caller boundary.
- Literal code allowlist: `light.turn_on` or `light.turn_off`, **only** entity `light.example_desk`. The domain/service path is derived from that map, never a supplied URL.
- `data` must be an object (null means `{}`). `turn_on` permits only optional `brightness`, an actual integer **1–255**, not Python boolean/string; `turn_off` permits no fields. Unknown fields, `entity_id` overrides, `all`, paths, templates, locks, alarms, scripts, shell commands and automations are denied.
- Server config `real_actions_enabled is True` **and** per-call `confirm is True`. Confirmation is an additional intent gate, not authentication or durable approval.

For an authorized user with a valid allowlisted request, the default disabled response is `{"executed":false,"reason":"actions_disabled_or_unconfirmed"}`. Empty policy instead produces `403 forbidden`. Invalid service/entity/data produces `400 bad_request`. Merely presenting valid JSON or claiming an identity in it grants nothing.

To authorize one real action: obtain the device owner's consent, verify a harmless dedicated test light, add the actual UUID to `execute_user_ids`, configure the real HA credential, set the server flag true, change **only the action leaf** to `["password"]`, push reviewed resources/endpoints and publish its actual ID. This authorizes future calls too: close the flag/route promptly after the approved exercise. The fixture request is:

```json
{"action":"light.turn_on","entity":"light.example_desk","data":{"brightness":64},"confirm":true}
```

It sends exactly `POST /api/services/light/turn_on` with `{"entity_id":"light.example_desk","brightness":64}` and a 5-second timeout. Do not run this against a device without separate permission. Home Assistant must return a list; `executed:true` means the HTTP response was accepted, **not verified physical state**. Check the actual device/state independently. A timeout/malformed response may follow an applied effect: never blindly retry a mutation. This adapter has no durable action ledger or exactly-once guarantee. The platform's optional `Idempotency-Key` is not a replacement for business reconciliation.

When done, set `real_actions_enabled:false`, restore `execute_user_ids:[]` and the action route's deny-all policy, push and republish if it was published. Disabling a draft alone does not replace a published endpoint's auth; the resource flag is live but does not cancel in-flight POSTs.

## Assert locally and manually

`validate.py` imports **the actual two deployed source files**, injects a fake trusted principal and fake HTTP resource, and reads the same config/state fixtures. It checks default deny, no admin bypass, authorized fixture reads, independent action membership, unsafe services/entities/data, boolean brightness rejection, both action gates and exact fake GET/POST arguments. It never installs a Viat SDK, opens sockets or controls a device. Fake `ViatError` verifies handler status/code intent, not real HTTP serialization.

The deploy checks remain manual: strict body/query binding, actual principal resolution, published unauthenticated/unlisted denial, resource secret masking, outbound policy/TLS, HA service permissions, read timing and physical state. `ha_observe` returns `{"state":...}` only for an authenticated allowed principal; a platform draft run/scheduler with no project-user UUID is intentionally denied. There is no scheduled bypass. Runtime refusals and dispatch refusals have separate logs; check both.

## Cleanup only the recorded objects

Close the action flag first, unpublish both owned leaves, account for in-flight requests and record any physical effect. Then use the actual recorded IDs:

```sh
viat endpoint unpublish STATE_ENDPOINT_ID
viat endpoint unpublish ACTION_ENDPOINT_ID
viat endpoint delete STATE_ENDPOINT_ID
viat endpoint delete ACTION_ENDPOINT_ID
viat workflow delete ha_observe
viat script delete ha_execute
viat script delete ha_read
viat resource delete ha_api
viat resource delete ha_settings
```

Skip unpublish for leaves never published. Delete `home-assistant` with `viat tree delete home-assistant` only if it is your newly created, now-empty tree. Revoke **the disposable HA token** in Home Assistant's profile security controls; deleting a resource does not revoke it or restore a lamp. Delete the project user with `viat p-user delete home-reader-example` only if you created it and no other example uses it. Remove private local session artifacts after review. No project DELETE route exists in 1.1.0; leave the isolated project rather than inventing a cleanup call. Never delete unrelated endpoints/resources/users or use a mirror prune as cleanup.

## Reference and remaining requirements

[HTTP resource](../assets/resources/http_api.md), [script context](../assets/scripts/context.md), [endpoint binding](../triggers/http.md), [authentication](../auth/endpoints.md), [repo sync](../projects/repo-sync.md). Maintenance evidence: pinned product `crates/viat-runtime/src/{python,resources_json}.rs`, `crates/viat-cli/src/repo/endpoints.rs` and registered handlers in `crates/viat-api/src/lib.rs`.

Remaining external requirements: an approved HA origin/CA/routing, privately provisioned token, real isolated entity IDs, active project-user UUIDs and login, explicit device approval and manual integration verification. The offline unit validator is deliberately not advertised as connector/device coverage.
