---
title: "Resource reference overview"
description: "Configuration, secret boundaries and SDK use for all 20 Viat 1.1.0 resource kinds."
doc_id: resources.overview
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# Resource reference overview

A resource is a folder-identified project configuration asset, not an endpoint. Creating one does not provision a remote service or automatically start a trigger. This reference covers all 20 kinds in the pinned 1.1.0 contract. Every page includes complete plain/secret and nested fields, runtime rules, configuration, actual language helpers, failure recovery and cleanup. Synthetic/stub examples were not executed and are not test claims.

## Kind inventory

| Wire kind | Purpose and boundary |
| --- | --- |
| [`amqp`](amqp.md) | AMQP 0-9-1/RabbitMQ for publisher-confirmed script publishing and the implemented queue-consumer trigger. Consuming is a queue trigger, not a .consume helper. Kafka/AMQP 1.0/RocketMQ are not this kind. |
| [`cloud_api`](cloud_api.md) | Signed action calls for exactly two protocols: aliyun_rpc_v1 and tencent_tc3. This is not an all-cloud adapter: AWS SigV4, Aliyun ACS3 and arbitrary vendor signing are unsupported here. A resource pins a product endpoint; scripts cannot redirect its credential to another host. |
| [`config`](config.md) | A version-controllable JSON document in plaintext plain.data, optionally validated by a restricted JSON Schema. Use it for non-secret settings; it is not an encrypted generic object. Secret leaves are explicit references to secret resources. |
| [`crypto_key`](crypto_key.md) | Platform-held aes/hmac/rsa/ecdsa_p256/ed25519/sm2/sm4 key operations. Algorithm selects the key type; partner-protocol modes are call arguments. Private material stays out of scripts. Not a CA, key issuer or universal HSM. |
| [`graphql`](graphql.md) | Calls an existing remote GraphQL HTTP endpoint and returns its data object, raising on GraphQL errors even with HTTP 200. This kind is not Viat’s database viat_gql engine; that engine belongs to postgresql/mysql/sqlite resources. |
| [`http_api`](http_api.md) | A fixed upstream base URL plus authentication and headers, used by script HTTP helpers and proxy endpoints. Requests are made by the platform; it is not an arbitrary credentialed URL fetcher. Use graphql for GraphQL error handling and cloud_api for action signing. |
| [`imap`](imap.md) | Read messages, list mailboxes and explicitly mark Seen through platform IMAP. Not SMTP, a general mailbox administrator or a background trigger by itself. |
| [`library`](library.md) | Call exported functions of a frozen Rust/binary script as the original caller. Not Python imports, npm packages or uses modules. Saving the library is its publish; editing source alone does not change its frozen build. |
| [`llm`](llm.md) | Viat’s multi-provider chat contract supports openai, anthropic, azure and custom. It normalizes chat, tool-call replies and text streaming without exposing the API key. This reference describes the shipped adapter, not current model recommendations or a general provider SDK. |
| [`mongodb`](mongodb.md) | Document CRUD, aggregation and counts in one configured MongoDB database: canonical extended JSON input and relaxed extended JSON output preserve BSON identities. Not a full driver, transaction or change-stream surface. |
| [`mysql`](mysql.md) | MySQL/MariaDB application data via raw SQL, brokered transactions, viat_gql and CRUD. It introspects one configured database; it does not inherit PostgreSQL’s multi-schema or audit capabilities. |
| [`postgresql`](postgresql.md) | Connect to a project-owned PostgreSQL database for SQL, transactions, database GraphQL, CRUD and optional business-data auditing. This is not access to Viat’s own platform database. Use a narrowly privileged application role, not a superuser. |
| [`push`](push.md) | JPush, FCM HTTP v1 and APNs token transports, including platform event senders and script .send in stable 1.1.0. Acceptance is not handset delivery. Encrypted APNs widget overview snapshots from the unreleased branch are not stable functionality. |
| [`redis`](redis.md) | A small cache/counter/pub-sub publishing helper on a configured logical database. No brokered SCAN, Lua, arbitrary commands, pipelines or subscribe helper in 1.1.0. |
| [`s3`](s3.md) | Direct access to an existing S3-compatible bucket for object reads/writes and the project S3 authorization surface. Choose storage instead when files need project PostgreSQL metadata, owners, audit evidence and managed download links. |
| [`secret`](secret.md) | One opaque nonempty string kept in the configured secret backend. Use for standalone tokens or as the target of config/header/cloud credential references. Unlike brokered credential kinds, its purpose is to reveal value to a declared script. |
| [`smtp`](smtp.md) | A project-specific outbound mail relay, separate from deployment VIAT_SMTP alert settings. The platform owns the credential and fixes sender identity; scripts choose recipients, subject and content, not From. |
| [`sqlite`](sqlite.md) | A server SQLite file opened by the platform, not Viat’s platform DB or a browser database. SQL/transactions/viat_gql/CRUD work on one node or replicated read-only data, not multi-node shared writes. |
| [`sqlserver`](sqlserver.md) | Microsoft SQL Server over TDS, SQL authentication and pooled SQL/transactions. No Windows/AD/Kerberos/Azure AD auth, viat_gql/database GraphQL/CRUD engine or business audit block in 1.1.0. |
| [`storage`](storage.md) | Managed file bytes on local volume/S3 with metadata in a same-project PostgreSQL resource. IDs/keys, owners, policy and evidence are platform-managed. Unlike raw s3, it cannot use MySQL/SQLite/platform DB metadata. |

## Permissions, identity and save semantics

Management API requires platform authentication and project membership. List/show require membership; create, PUT, PATCH, Test, refresh, copy and delete require an effective project Owner/Admin/Developer role; the lower-privilege operator role cannot write. Management access grants neither upstream privileges nor runtime s3/file/row-policy access. MCP exposes only its actual listed tools; a resource schema is not a full MCP CRUD interface.

- Create: `POST /projects/{slug}/resources`, body `{name,folder?,kind,plain,secret}`. name is 1–64 bytes without /; system is reserved. Omitted/empty folder means root; otherwise [A-Za-z0-9_-]+ segments, at most 8 levels/255 bytes, no leading/trailing/repeated /.
- Identity is project-local `(folder,name)`, not a global bare name. Duplicate names may exist in different folders. Use `/resources/{name}?folder=team` to locate detail routes explicitly; CLI uses `team/name`. Script bare names resolve own folder, root, then globally unique name; qualify cross-folder references, using Python `getattr(ctx.resources, "team/name")` or TypeScript `ctx.resources["team/name"]`, not a property chain.
- PUT fully replaces: resend correct kind, complete plain and all secret values to retain; show masks cannot recover them. PATCH fixes kind; omitted plain preserves it, supplied plain replaces the entire document (not a deep merge); secret overlays only supplied fields, retaining omitted fields. Folder moves recheck references at the new anchor.
- Clear an optional secret by explicit null (only nullable fields) or empty string (only fields allowing empty). Required/conditionally required fields cannot be cleared. To clear optional plain fields, send complete plain without them so defaults/absence take effect. Null is not universal and *** is never an old-secret value.
- `$keep` is a PATCH/repo sentinel only at **top-level plain fields**, retaining an existing server value even for numeric/boolean fields. It cannot initialize a new resource or missing field. Nested `$keep` is not a deep-merge instruction.
- Repo file `resources/<folder>/<name>.yaml` carries folder through its path, with a bare name inside. `viat pull` writes string `$secret` placeholders for secret fields; `viat push` removes them (also accepts legacy !secret tags) and PATCHes existing resources, never using markers as credentials. Safely supply real required secrets before creating a new resource; a placeholder cannot create credentials. Top-level allowed_authorizers is repo access-sync metadata, not something to insert into plain arbitrarily.

The `$secret` placeholder differs from a credential reference: `{"$secret":"name"}` names another secret resource in supported config/cloud positions; HTTP/GraphQL string headers use the entire `"$secret:name"` value. These are not plaintext credentials. Save/read/export retain references; use resolves them. Targets resolve relative to the consuming resource folder and must already exist with kind secret. No substring interpolation.

Public responses contain resource identifiers, kind, folder, plain and a secret summary, never secret values. Summary *** denotes declared fields, not proof every optional credential is populated. Plain is readable/exportable; secret uses the deployment encrypted backend. Published script/dependency code follows snapshot rules: uses is frozen unless (live), not blanket live on every run. Resource projection, broker operations and explicit live secret IO are different boundaries.

## Selection and operation boundaries

SQL/transactions support postgresql/mysql/sqlserver/sqlite. Database viat_gql, graphql helpers and CRUD engines support only PostgreSQL/MySQL/SQLite. Remote graphql is a separate HTTP upstream. amqp has script publishing plus separately configured queue-trigger consumption. storage means local/S3 bytes plus project PostgreSQL metadata. library is frozen Rust/binary exports, not Python imports. cloud_api supports only two signing protocols. push has JPush/FCM/APNs and script send, but unreleased encrypted APNs widget snapshots are not stable 1.1.0.

Python/TypeScript have resource methods, Rust uses verified generic RPC or specific helpers, shell has JSON projection without those methods. Never infer nonexistent CLI/MCP/SDK support from a schema. Test may perform real outbound/auth actions, create SQLite files or write a local-storage probe; saving audit/storage/library can perform DDL/builds. None is universally a dry-run.

## 1.1.0 secret and transport limitations

HTTP/GraphQL/LLM/cloud/mail/storage/crypto/push credentials are applied by platform operations; removed r.secret/r.auth_headers patterns are unsupported. secret.value and hydrated config secrets intentionally reach scripts and are a different boundary. Compatibility projection still exposes credential-bearing postgresql/mysql/redis/mongodb/amqp URLs, sqlserver ADO/account secrets and s3 keys to workers. Even when using broker helpers, trust the whole dependency tree. Never extract/return these values; prefer broker operations and minimal upstream privileges.

PostgreSQL ssl is not applied by 1.1.0 SQL/GraphQL pools or Test, so it does not enforce TLS. MySQL ssl:true uses Preferred and can fall back to plaintext. Enforce strict transport in deployment/database policy and verify independently; a passing Test is not strict TLS proof. RSA parsing actually accepts at least 1024 bits; use at least 2048 for new production keys.

## Management entry points

[Platform users](../../instance/platform-users.md) and [project collaboration](../../projects/create-and-collaborate.md) explain authentication/roles. Actual CLI includes resource list/show/create --file/edit --file/test/refresh/delete/set-secret/set-field. edit is full PUT; set-secret reads one field from stdin and PATCHes. Repo push PATCHes existing resources. Do not invent resource apply or create --kind commands.
