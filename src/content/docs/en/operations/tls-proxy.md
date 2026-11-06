---
title: TLS, reverse proxies and streaming
description: Configure trusted public URLs, direct TLS or nginx termination, forwarded headers, request limits and certificate renewal.
doc_id: operations.tls-proxy
verified_release: '1.1.0'
channel: stable
---

# TLS, reverse proxies and streaming

Use a reverse proxy/ingress for production TLS policy, or direct TLS when no proxy is available. This page's configuration and validation commands are **unexecuted**. DNS, certificates, firewall and proxy changes need infrastructure approval. Prepare a working rollback and avoid exposing the plaintext listener directly when relying on proxy trust.

## Option A: direct TLS

Provide a PEM full chain and matching PEM private key readable by the **server**, not project scripts. Mount them read-only at stable paths:

```dotenv
VIAT_BIND=0.0.0.0:8443
VIAT_TLS_CERT=/etc/viat/tls/fullchain.pem
VIAT_TLS_KEY=/etc/viat/tls/privkey.pem
VIAT_PUBLIC_URL=https://api.example.com:8443
VIAT_TRUST_PROXY_HEADERS=false
```

Both TLS paths or neither: one missing path/initially unreadable or invalid pair fails startup instead of silently falling back to HTTP. TLS listener binding requires an IP:port socket address. Renew by atomically replacing a matching pair; the server polls modification times every 60 seconds. Failed reload logs and retains the previous working pair. Path changes require restart. There is no built-in ACME issuer, mTLS client-auth configuration or full nginx-equivalent cipher/OCSP policy surface.

The image healthcheck follows bind/TLS configuration, probes `/healthz`, and deliberately skips local HTTPS identity/trust checks. It does **not** prove the public certificate is valid. Monitor expiry/served identity externally using a trust-validating client.

## Option B: nginx TLS termination

Run Viat on a private/loopback listener, set `VIAT_PUBLIC_URL=https://api.example.com`, and enable `VIAT_TRUST_PROXY_HEADERS=true` **only** when all traffic passes your controlled proxy. This standalone nginx template assumes the backend is host-loopback 8080; in separate containers use an approved private network/address instead.

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

For one edge proxy the template **overwrites** incoming forwarded IPs rather than preserving caller claims. Viat uses the last X-Forwarded-For element; in multiple trusted proxy layers set/validate the chain deliberately. Blocking direct backend ingress is mandatory; otherwise callers can spoof forwarded headers.

The template disables response buffering for all paths for simplicity, preserving SSE/NDJSON/log-tail behavior. You can narrow this after verification. `proxy_read_timeout` is an **idle-between-reads** timeout, not the entire execution budget. Align it with legitimate silence, sync ceiling and publish build waits; long streams/log tail may need a longer idle allowance. WebSocket Upgrade headers are essential; ordinary HTTP must not get forced Upgrade. Compression/extra buffering for streams can delay delivery.

## Prefix deployment

For `https://api.example.com/viat`, set `VIAT_PUBLIC_URL` to exactly that base. No image rebuild or extra server prefix variable is required. Change the proxy's application `location /` to `location /viat/` and keep `proxy_pass http://viat_backend;` **without a URI suffix**, preserving the prefix for the server; add an exact `/viat` redirect to `/viat/` if desired. Do not independently prepend `/viat` twice. Update external IdP callback/webhook registrations, CLI server URLs and monitoring paths to include the prefix.

Use a deployment-specific prefix that does not collide with reserved platform namespaces. Test `/viat/ui/`, an asset, login callback and one fixture `/viat/p/PROJECT/PATH`. A proxy can also strip the prefix once, but combining incompatible stripping/rewrite rules causes asset/auth redirect failures.

## Upload limits and buffering

The default `2m` proxy ceiling matches ordinary buffered execution's 2 MiB limit. It is too small for a legitimate multipart file upload or dedicated S3 streaming path. Add **only approved route-specific locations**, with the same inherited proxy headers/timeouts, larger bounded `client_max_body_size`, `proxy_request_buffering off`, and explicit `proxy_pass`/response-buffering behavior. For example `/p/demo/upload` can have a reviewed 110m proxy limit for a 100 MiB file plus multipart overhead; this is a policy example, not a product default. Dedicated S3 paths match `/p/PROJECT/_s3/...` and require their own reviewed size policy.

Increasing nginx limits does not raise `VIAT_STORAGE_MAX_FILE_BYTES`, resource limits or the 2 MiB buffered text limit. Unlimited proxy uploads are not required just because a stream exists. Budget temporary disk, file count and concurrent uploads. Rust artifact routes have a separate 512 MiB product ceiling.

## Verify trust, redirects and renewal

Unexecuted examples; use the correct public hostname and approved CA bundle, not `-k`:

```sh
curl --fail --silent --show-error https://api.example.com/healthz
curl --fail --silent --show-error https://api.example.com/readyz
openssl s_client -connect api.example.com:443 \
  -servername api.example.com -verify_return_error </dev/null
nginx -t
```

For private CA, install the approved root/intermediate trust at each actual client boundary: proxy, browser/OS, CLI, server outbound client and worker runtime as appropriate. `--cacert /path/to/approved-ca.pem` tests curl trust, not every Viat client. Worker CA environment names require explicit [passthrough](../configuration/integrations.md); some replace rather than append trust. There is no universal `VIAT_CA_BUNDLE` server variable. Business PostgreSQL/MySQL resource TLS has [known limitations](../configuration/database.md).

After validation and approval, reload nginx through your service manager, verify a real fixture stream emits incrementally, a WebSocket upgrades, OIDC redirects use the public HTTPS origin/prefix, and the renewed public certificate is actually served. Do not run a live IdP/provider test without opt-in. If validation fails, keep/reinstate the prior certificate/configuration; do not weaken certificate checks as the recovery plan.
