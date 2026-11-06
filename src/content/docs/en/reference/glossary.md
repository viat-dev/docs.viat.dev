---
title: Glossary and identifier guide
description: Interpret Viat objects, identity planes, publication terms and identifiers without conflating their scopes.
doc_id: reference.glossary
verified_release: '1.1.0'
channel: stable
---

# Glossary and identifier guide

Use this reference when a command asks for a name, slug, ID or token. Similar-looking values are not interchangeable, and a human label is not proof of identity or permission. See [Concepts](../overview/concepts.md) for the complete operating model.

## Objects and lifecycle

| Term | Meaning | Do not confuse it with |
| --- | --- | --- |
| Instance | A Viat deployment and its platform state; multiple service processes may share a database. | A project or a desktop app's local saved instance entry. |
| Project | Namespace for assets, collaborators and public APIs. | A separate server process or application end-user account. |
| Slug | Project URL identity, such as `hello-lab`. | Display name, UUID or access credential. |
| Platform database | PostgreSQL storing Viat's platform state. | A project's PostgreSQL/SQLite resource containing business data. |
| Resource | Reusable connection/configuration/capability, with public configuration and kind-specific secrets. | A provisioned remote database, running trigger or published endpoint. |
| Script | Named executable source/artifact with a language, metadata and inferred/declared contracts. | An HTTP route automatically available without publication. |
| Workflow | Named orchestration definition of actual supported step variants. | A durable external-job engine, approval queue or endpoint directory. |
| Endpoint tree | A named route hierarchy, with a mount and inherited settings. | A filesystem tree or workflow graph. |
| Endpoint node | Directory or callable node with a path segment, method/target and contract. | The script name or a published snapshot ID. |
| Draft | Current editable state used by applicable test/direct-run paths. | The active published caller contract. |
| Snapshot | Captured endpoint/target state selected for public dispatch. | A backup of all resource credentials, imports or external data. |
| Publish revision | Project publication history grouping changes. | An individual endpoint snapshot or script source version. |
| Build / environment | Preparation of dependencies or compiled artifacts. | Proof of successful publication or business execution. |
| Trigger | An HTTP request or configured scheduler/watch/chat/queue/WS event source invoking a supported target. | An automatically running property of every resource. |
| Async run | A tracked platform execution with a state and run ID. | An external scheduler's job ID or proof of completion on acceptance. |
| Execution record | Request/result metadata, including refusals and cache hits where applicable. | Proof that a worker process ran. |
| Line log | Captured stdout/stderr/structured output associated with an execution. | A permanent audit/backup store. |
| Business audit | Change evidence for configured business data operations. | Every database write by every external tool. |
| Response cache | Stored HTTP responses under the endpoint's key/policy. | A script dependency cache or guaranteed current database state. |
| `uses:` | Python/TypeScript source dependency declaration. | Package installation requirements or resource declaration. |
| `(live)` | Explicit live dependency behavior; an ordinary published script dependency graph can otherwise freeze. | A guarantee that all workflow-step imports freeze; they have a live-resolution exception. |

## Identities and roles

| Term | Scope and purpose |
| --- | --- |
| Platform user | Signs into console/CLI/native management; platform roles govern platform administration. |
| Project collaborator | A platform user's independent membership in one project, with owner/admin/developer/operator role. |
| Editor / publisher | Capability shorthands in documentation: editor normally means project owner/admin/developer; publisher means owner/admin. Individual API exceptions still matter. |
| Project end user (`p-user`) | Business API consumer identity. Creating one does not grant console access. |
| Project role (`viat role`) | Business identity/authorization role, not the collaborator role assigned by `viat project member`. |
| Authorizer | Caller authentication mechanism accepted by an endpoint. The nearest declared list replaces ancestor lists. |
| Authorization gate (`authz_gates`) | Subject-level endpoint gate; ancestors accumulate until an override stops the walk. |
| Authz type/action/rule | Business authorization model vocabulary used by gates and object/row checks. Not an arbitrary replacement for platform membership. |
| Principal | Identity attached to an execution, distinct from whichever operator edited its script. |
| PAT (`vis_pat_`) | Platform personal access credential with its own scope/expiry/revocation rules; not an MFA enrollment ticket. |
| API key (`vsk_`) | Project caller credential used with the appropriate authorizer. A short key ID is not the full one-time secret. |
| Overview token (`vso_`) | Per-login, read-only single-route overview credential; not a general project API token. |
| MFA ticket | Short-lived continuation of login/enrollment. Sensitive, and not a completed login session. |

## Which identifier does a command want?

| Identifier | Obtain and use it |
| --- | --- |
| Folder/name | Asset identity for scripts/resources/workflows. Preserve the folder, e.g. `shared/lookup`; API folder query encoding and CLI qualified names differ. |
| Endpoint node UUID | Returned by endpoint creation/list/show; used for update/publish/unpublish/delete. Not the endpoint path. |
| Request ID | Correlates an execution/request and log lookup. A placeholder UUID is syntactically valid but does not refer to a real execution. |
| Execution log ID | Database/API identity of an execution record, used by surfaces that explicitly request it. Do not silently substitute request ID. |
| Snapshot ID/version | An endpoint's published version identity. Do not pass it where a project publish revision is required. |
| Run ID | Platform asynchronous run identifier; poll/cancel only through its corresponding run API. |
| External job ID | Identifier returned by an upstream cluster/service. Persist and use it with that upstream's status/cancel API. |
| File ID | Managed storage metadata identity. It is not necessarily a filesystem path, object key or download authorization. |

Copy IDs only from the intended instance/project and keep an ownership ledger for disposable examples. Cleanup should target objects you actually created, not a synthetic UUID printed in the documentation.

## Similar words with different guarantees

- **Test** can mean local fixture validation, a real draft execution or a resource connection probe. Check side effects before running it.
- **Success** can mean transport accepted, build accepted, runtime succeeded, provider accepted or device delivered. [Errors and results](errors.md) distinguishes them.
- **Rollback** restores the particular versioned object, not migrations or external side effects.
- **Cancel** requests stopping a Viat execution; it does not automatically cancel an external submitted job.
- **Delete** removes the addressed platform object according to its dependency checks; it does not revoke every external credential or erase previously sent messages.
- **Stable** identifies the targeted released capability; **preview** identifies unpublished capability or incomplete handbook acceptance. Read [Versions](versions.md) before assuming availability.

This glossary makes no network calls and needs no account. Follow the linked feature/CLI references for exact fields, permissions and operation-specific recovery rather than treating a definition as authorization to act.
