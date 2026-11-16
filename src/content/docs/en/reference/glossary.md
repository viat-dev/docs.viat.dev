---
title: Glossary and identifier guide
description: Interpret Viat objects, identity planes, publication terms and identifiers without conflating their scopes.
doc_id: reference.glossary
verified_release: '1.1.0'
channel: stable
---

# Glossary and identifier guide

Use this reference when a command asks for a name, slug, ID or token.
Similar-looking values are **not interchangeable**, and a human label
proves neither identity nor permission. The complete operating model:
[Concepts](../overview/concepts.md).

## Objects and lifecycles

| Term | Meaning | Do not confuse with |
| --- | --- | --- |
| Instance | A Viat deployment and its platform state; several server processes can share the database | A project, or a desktop app's locally saved "instance" entry |
| Project | The namespace of assets, collaborators and the public API | A separate server process or a business end-user account |
| Slug | The project's URL identity, e.g. `hello-lab` | A display name, UUID or access credential |
| Platform database | The PostgreSQL holding Viat's platform state | A project's PostgreSQL/SQLite **resource** holding business data |
| Resource | A reusable connection/configuration/capability with public config and kind-specific secrets | An auto-created remote database, a running trigger or a published endpoint |
| Script | Named source or executable artifact with language, metadata and derived/declared contracts | An HTTP route that opens automatically without publishing |
| Workflow | A named orchestration definition using actually supported step types | A durable external task engine, an approval queue or an endpoint directory |
| Endpoint tree | A named route hierarchy with mounting and inheritance settings | A filesystem directory tree or a workflow graph |
| Endpoint node | A directory or callable node with segment, method/target and contracts | A script name or a published snapshot ID |
| Draft | The current editable state used by applicable test/direct-run paths | The **published** contract in effect for callers |
| Snapshot | The captured endpoint/target state chosen for external serving | A backup of all resource credentials, imports or external data |
| Publish revision | The project publication history recording changes as groups | A single endpoint snapshot or a script source version |
| Build / environment | Preparing dependencies or compiled artifacts | Proof of publish success or business execution success |
| Trigger | An HTTP request or configured schedule/file/chat/queue/WS event source invoking supported targets | A runtime property every resource automatically carries |
| Async run | A platform execution with state and a run ID | An external scheduler job ID, or "accepted means completed" |
| Execution record | Request/result metadata, including rejections and cache hits where applicable | Proof a worker **actually ran** |
| Line log | stdout/stderr/structured output tied to an execution | Permanent audit or backup storage |
| Business audit | Change evidence for configured business-data operations | Every database write by any external tool |
| Response cache | HTTP responses stored per endpoint key/policy | A script dependency cache or necessarily fresh database state |
| `uses:` | A Python/TypeScript source dependency declaration | Package-manager requirements or a resource declaration |
| `(live)` | Explicit live dependency behavior; without the marker, ordinary published script dependency graphs **can** freeze | A guarantee that all workflow step imports freeze — steps keep live-resolution exceptions |

## Identities and roles

| Term | Scope and use |
| --- | --- |
| Platform user | Signs in to the console/CLI/native management app; platform roles govern platform administration |
| Project collaborator | A platform user's independent membership in one project with owner/admin/developer/operator |
| Editor / publisher | **Capability shorthand** in this documentation: editor ≈ project owner/admin/developer, publisher ≈ owner/admin; per-API exceptions still apply individually |
| Project end user (`p-user`) | A business-API consumer identity; creation grants **no** console access |
| Project role (`viat role`) | A business identity/authz role — **not** the collaborator role `viat project member` assigns |
| Authorizer | A caller-authentication method an endpoint accepts; the nearest explicit list **replaces** ancestor lists |
| Authz gates (`authz_gates`) | Subject-level gates on endpoints; **accumulate** along ancestors until an override stops upward traversal |
| Authz type/action/rule | The business authorization model vocabulary used by gates and object/row checks — never a wholesale substitute for platform membership |
| Principal | The identity an execution runs as — **not** the operator who edited the script |
| PAT (`vis_pat_`) | A platform personal access credential with its own scope/expiry/revocation; not an MFA enrollment ticket |
| API key (`vsk_`) | A project caller credential used with a matching authorizer; the short key ID is **not** the one-time full secret |
| Overview token (`vso_`) | A per-login, read-only, single-route overview credential — not a general project API token |
| MFA ticket | A short-lived continuation credential for login/enrollment; a secret that **does not mean** login completed |

## Which identifier does the command want?

| Identifier | Obtaining and using |
| --- | --- |
| Folder/name | The asset identity of scripts/resources/workflows keeping the folder, e.g. `shared/lookup`; the API's folder query encoding **differs** from the CLI qualified name |
| Endpoint node UUID | From create/list/show, used for update/publish/unpublish/delete — **not** the endpoint path |
| Request ID | Correlates executions/requests and log queries; the documentation's placeholder UUIDs parse but point to no real execution |
| Execution log ID | The database/API identity of an execution record, for entrances that explicitly require it — **never** silently substituted for a request ID |
| Snapshot ID/version | The endpoint publication version identity — unusable where a project publish revision is required |
| Run ID | The platform async-run identifier, polled/cancelled only via the matching run API |
| External job ID | Returned by the upstream cluster/service: persist it and use the upstream's **own** status/cancel APIs |
| File ID | Managed-storage metadata identity — not necessarily a filesystem path, object key or download authorization |

Copy IDs only from the **correct instance and project** and keep an
ownership list for temporary examples; cleanup targets what you
**actually created** — never the synthetic UUIDs printed in
documentation.

## Similar words, different guarantees

- **Test**: can be local fixture validation, a real draft execution or a
  resource connectivity probe — check side effects before running.
- **Success**: can mean transport accepted, build accepted, run
  succeeded, provider accepted or device delivered; see
  [errors and results](errors.md).
- **Rollback**: restores a specific versioned object — **not**
  migrations or external side effects.
- **Cancel**: requests stopping Viat execution — it does not
  automatically cancel already-dispatched external tasks.
- **Delete**: removes the target platform object under dependency
  checks — it revokes **no** blanket external credentials and erases no
  sent messages.
- **Stable**: refers to targeted released capability; **preview**: can
  mean an unreleased capability or unfinished manual acceptance. Read
  the [version notes](versions.md) before judging availability.

Reading this glossary needs no account and makes no network requests.
Fields, permissions and operation-specific recovery belong to the
feature/CLI references — **never treat a definition as execution
authorization**.
