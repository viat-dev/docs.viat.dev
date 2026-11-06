# Signed webhook ingestion — Viat 1.1.0

[简体中文](README.zh-cn.md) · [Complete English guide](../../src/content/docs/en/applications/webhook-ingestion.md)

A complete pushable project for API-key-authenticated, raw-byte HMAC webhook ingestion. Durable `event_id` uniqueness plus a single SQLite transaction protect the local event ledger and account-total projection. Nothing here sends payments/messages or atomically coordinates an external service.

## Files and local validation

- `project/viat.yaml`, `resources/`, `scripts/`, `endpoints/` are the deployable repository. The full schema lives in `project/scripts/setup.py`; processing lives in `project/scripts/ingest.py`.
- `fixtures/event.json` contains synthetic exact input bytes; `fixtures/expected.json` contains expected success/failure values.
- `sign_fixture.py` signs local files with the **public dummy key only**; it has no real-key option and no networking.
- `case.json` pins server 1.1.0 and `python3 -I validate.py`.

From this directory:

```sh
python3 -I validate.py
```

Standard-library, **unit-only** checks load the real deployable code and its SQL, using fake Viat/crypto context and temporary SQLite. They cover replay/conflict, stale/bad signatures, limits, rollback/restart and concurrent duplicates. They do not prove real HTTP authentication, header exposure, broker RPC or publish readiness. The coordinator ran this validator successfully through the offline harness with network and subprocess calls blocked.

## Approved deployment only

Follow the complete guide for login/version checks, new isolated project creation, explicit API-key authorizer/user, exposed headers, a new single-node server SQLite file under `VIAT_SQLITE_ROOTS`, initialization, publish and assertions. Replace the resource's approved-root placeholder before pushing. Never use the known dummy key for an untrusted public route; provision a real key separately and preserve it with `$secret` only after creation.

From `project/`, after the guide's prerequisites:

```sh
viat push --only resources,scripts,endpoints
viat script run setup --args '{"confirm":"webhook-ingestion-isolated-db"}'
```

Do not use unscoped push: omitted metadata could prune the manually created authorizer. Endpoint `target.ref` is intentional. CLI/platform sessions and endpoint API keys are different credentials. All online commands require explicit approval; default validation makes no network/provider calls.

## Safety, recovery and cleanup

The 300-second timestamp bound complements, not replaces, durable event uniqueness. Same ID/same bytes is duplicate; changed bytes is conflict. DB lock timeout requires safe same-event retry. Do not delete dedup records within the provider retry horizon, and do not promise SQL plus external effects exactly-once. Full errors and limits are in the guide.

Unpublish/delete only the recorded endpoint UUID; revoke only the API-key **row UUID**; remove only the exact owned user/authorizer/scripts/resources in the newly created project. The guide lists these commands. Resource deletion leaves SQLite files; an operator must separately retain evidence and remove only the exact new file/sidecars after quiescence. Project DELETE is unsupported in 1.1.0. Only coordinator offline unit validation has passed; real HTTP/broker acceptance, services, deployment, provider calls and cleanup remain unverified.
