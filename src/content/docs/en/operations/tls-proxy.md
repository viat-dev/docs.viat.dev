---
title: TLS, reverse proxies and streaming
description: Configure trusted public URLs, direct TLS or nginx termination, forwarded headers, request limits and certificate renewal.
doc_id: operations.tls-proxy
verified_release: '1.1.0'
channel: stable
---

# TLS, reverse proxies and streaming

Prefer a reverse proxy/ingress for production TLS; direct TLS works when no
proxy exists. All configuration/validation commands here are
**unexecuted**. DNS, certificates, firewall and proxy changes need
infrastructure approval. Prepare a rollback, and when relying on trusted
proxy headers, **never** expose the plaintext listener directly.

## Option A: built-in TLS

Provide a PEM full chain plus matching private key, server-readable but not
script-readable, mounted read-only at a stable path:

```dotenv
VIAT_BIND=0.0.0.0:8443
VIAT_TLS_CERT=/etc/viat/tls/fullchain.pem
VIAT_TLS_KEY=/etc/viat/tls/privkey.pem
VIAT_PUBLIC_URL=https://api.example.com:8443
VIAT_TRUST_PROXY_HEADERS=false
```

Essentials:

- The certificate and key must be set **together or not at all**; one
  missing, initially unreadable or mismatched fails startup — **no silent
  HTTP fallback**. The TLS listener requires an IP:port.
- Renewal = atomically replacing the matching pair; mtime is checked every
  60 seconds; a failed reload logs and **keeps the previous pair**;
  changing paths needs a restart.
- Not included: a built-in ACME issuer, mTLS client-auth configuration, or
  a full nginx-equivalent cipher/OCSP surface.
- The image healthcheck follows bind/TLS probing healthz and **deliberately
  skips** local HTTPS identity/trust validation — it **proves nothing about
  the public certificate**; monitor expiry/actual identity with an external
  trust-validating client.

## Option B: nginx TLS termination

Viat listens on loopback/private networking with
`VIAT_PUBLIC_URL=https://api.example.com`; set
`VIAT_TRUST_PROXY_HEADERS=true` only when **all** traffic traverses the
controlled proxy. This standalone template assumes a backend on host
`127.0.0.1:8080`; split-container deployments substitute the approved
private address.

```nginx
# http context
map $http_upgrade $viat_connection {
    default upgrade;
    ''      '';
}
upstream viat_backend {
    server 127.0.0.1:8080;
    keepalive 32;
}
server {
    listen 80;
    server_name api.example.com;
    return 301 https://api.example.com$request_uri;
}
server {
    listen 443 ssl;
    server_name api.example.com;
    ssl_certificate /etc/nginx/tls/fullchain.pem;
    ssl_certificate_key /etc/nginx/tls/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    client_max_body_size 2m;

    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $viat_connection;
    proxy_read_timeout 310s;
    proxy_send_timeout 310s;

    location / {
        proxy_pass http://viat_backend;
        proxy_buffering off;
        proxy_cache off;
    }
}
```

Four key semantics of the template:

- For caller-forwarded IPs, the single-edge template **overwrites** rather
  than preserving forged chains. Viat takes the **last**
  `X-Forwarded-For` segment; multi-hop trusted proxies must validate per
  the real chain, and bypass paths straight to the backend must be blocked
  — otherwise callers forge headers.
- Response buffering is off for every path to keep SSE/NDJSON/tail instant
  — narrow it after validation.
- `proxy_read_timeout` is the **idle time between reads**, not a total
  execution budget: reconcile with sensible silence, the sync ceiling and
  publish-build waits; long streams/tails may need longer idle allowances.
- WebSocket requires `Upgrade`; plain HTTP must **not** be force-upgraded.
  Stream compression/extra buffering delays output.

## Sub-path deployment

With the external address `https://api.example.com/viat`:

- Set `VIAT_PUBLIC_URL` to that value — **no** image rebuild or extra
  prefix variable.
- Change the application location from `/` to `/viat/`, keeping
  `proxy_pass http://viat_backend;` **without a URI suffix** (the server
  strips the prefix); add an exact `/viat` → `/viat/` redirect when
  needed. **Never add the prefix twice.**
- Update IdP callbacks, webhooks, CLI server and monitoring paths; the
  prefix must not collide with reserved platform namespaces.
- Verify: `/viat/ui/`, static assets, login callbacks and the fixture
  `/viat/p/PROJECT/PATH`. The proxy may strip once itself, but mixed
  inconsistent rewrites break asset/auth redirects.

## Upload sizes and buffering

- The default `2m` matches the ordinary 2 MiB buffered execution but **does
  not** cover legitimate large multipart or dedicated S3 streams. Add
  locations for **approved paths only**: inherit the same headers/timeouts,
  set a larger bounded `client_max_body_size`,
  `proxy_request_buffering off`, and explicit proxy_pass/response
  buffering. For example `/p/demo/upload` may use `110m` per approval
  (a 100 MiB file plus multipart overhead) — a policy example, **not** a
  product default. The S3 paths `/p/PROJECT/_s3/...` need their own size
  policy.
- Raising nginx limits **never** raises
  `VIAT_STORAGE_MAX_FILE_BYTES`, resource caps or the 2 MiB text buffer.
  Supporting streams is not unlimited uploads: budget temp disk, file
  counts and concurrency. Rust artifacts keep their separate 512 MiB
  product cap.

## Verify trust, redirects and renewal

Unexecuted templates; use the real public domain and approved CA,
**without `-k`**:

```sh
curl --fail --silent --show-error https://api.example.com/healthz
curl --fail --silent --show-error https://api.example.com/readyz
openssl s_client -connect api.example.com:443 \
  -servername api.example.com -verify_return_error </dev/null
nginx -t
```

For private CAs, install the approved root/intermediate chain at each
**real client boundary**: proxy, browser/OS, CLI, server egress and
workers separately. curl `--cacert` validates only curl, not every Viat
client; worker CA variables need explicit
[passthrough](../configuration/integrations.md) — some **replace** rather
than extend trust; there is no generic `VIAT_CA_BUNDLE` server parameter.
Business PostgreSQL/MySQL TLS has [real limits](../configuration/database.md).

After validation approval: reload nginx via the service manager → verify a
fixture streaming progressively, WebSocket upgrades, OIDC URLs using the
correct HTTPS/prefix, and the **actual new certificate**. Real
IdP/provider tests need explicit opt-in. On failure, keep/restore the old
certificate configuration — **never** disable certificate checking as a
recovery.
