---
title: TLS、反向代理与流式传输
description: 配置可信公共 URL、内置 TLS/nginx 终结、转发头、请求限制和证书续期。
doc_id: operations.tls-proxy
verified_release: '1.1.0'
channel: stable
---

# TLS、反向代理与流式传输

生产 TLS 策略优先使用反向代理/ingress，无代理时可用内置 TLS。以下配置和验证命令**均未执行**。DNS、证书、防火墙和代理变更需要基础设施批准。准备回退；依赖可信代理头时，不得同时直接暴露明文后端。

## 方案 A：内置 TLS

提供服务端可读、项目脚本不可读的 PEM 完整链和匹配私钥，以只读方式挂到稳定路径：

```dotenv
VIAT_BIND=0.0.0.0:8443
VIAT_TLS_CERT=/etc/viat/tls/fullchain.pem
VIAT_TLS_KEY=/etc/viat/tls/privkey.pem
VIAT_PUBLIC_URL=https://api.example.com:8443
VIAT_TRUST_PROXY_HEADERS=false
```

必须同时设置或同时不设；缺一、初始不可读或无效匹配会启动失败，不静默降为 HTTP。TLS 监听要求 IP:port。续期原子替换匹配文件对，每 60 秒检查修改时间；重载失败记录后保留上一对，路径变更须重启。没有内置 ACME 签发器、mTLS 客户端认证配置或完整 nginx 等价 cipher/OCSP 参数面。

镜像健康检查跟随 bind/TLS、探测 healthz，并刻意跳过本地 HTTPS 身份/信任校验，**不证明公网证书有效**。应使用验证信任的外部客户端监控期限/实际身份。

## 方案 B：nginx 终结 TLS

Viat 使用回环/私网监听，设置 `VIAT_PUBLIC_URL=https://api.example.com`；仅当所有流量经过受控代理时设 `VIAT_TRUST_PROXY_HEADERS=true`。此独立模板假设后端在宿主 127.0.0.1:8080；分容器部署须改为批准的私网地址。

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

单边缘代理模板**覆盖**调用方转发 IP，而非保留伪造链。Viat 取 X-Forwarded-For 最后一段，多层可信代理必须按真实链路设置验证。须阻止绕过代理直连后端，否则调用方可伪造头。

为简单起见模板对所有路径关闭响应缓冲，保留 SSE/NDJSON/tail 即时性，验证后可缩小范围。proxy_read_timeout 是**两次读取之间空闲**期限，不是整个执行时长；按合理静默、同步上限及发布构建等待协调。长流/tail 可能需要更长空闲允许。WebSocket 必须有 Upgrade，普通 HTTP 不能被强制升级。流压缩/额外缓冲会延迟输出。

## 子路径部署

外部为 `https://api.example.com/viat` 时，把 VIAT_PUBLIC_URL 设为该值，无需重建镜像或另设前缀变量。把应用 location 从 `/` 改为 `/viat/`，保留 **不带 URI 后缀**的 `proxy_pass http://viat_backend;`，让服务端剥前缀；需要时添加精确 `/viat` 到 `/viat/` 重定向。不要重复添加前缀。IdP 回调、webhook、CLI server 和监控路径都要同步。

前缀不能与保留平台命名空间冲突。验证 `/viat/ui/`、资产、登录回调和夹具 `/viat/p/PROJECT/PATH`。代理也可只剥一次，但混用不一致 rewrite 规则会使资产/认证跳转出错。

## 上传大小与缓冲

默认 2m 匹配普通缓冲执行的 2 MiB，但不足合法大 multipart 或专用 S3 流。只为**批准路径**增设 location，继承相同头/超时，设置较大且有界 client_max_body_size、proxy_request_buffering off，并明确 proxy_pass/响应缓冲。例如 `/p/demo/upload` 可按审批使用 110m 容纳 100 MiB 文件和 multipart 开销；这是策略例子，不是产品默认。S3 路径 `/p/PROJECT/_s3/...` 需独立大小政策。

提高 nginx 限制不会提高 VIAT_STORAGE_MAX_FILE_BYTES、资源上限或 2 MiB 文本缓冲。支持流不表示必须无限上传；应预算临时盘、文件数和并发。Rust 产物有独立 512 MiB 产品上限。

## 验证信任、跳转和续期

未执行模板，使用实际公共域名与批准 CA，不用 -k：

```sh
curl --fail --silent --show-error https://api.example.com/healthz
curl --fail --silent --show-error https://api.example.com/readyz
openssl s_client -connect api.example.com:443 \
  -servername api.example.com -verify_return_error </dev/null
nginx -t
```

私有 CA 要在真实客户端边界安装批准根/中间链：代理、浏览器/OS、CLI、服务端出站和 worker 各自处理。curl `--cacert /path/to/approved-ca.pem` 只验证 curl，不代表所有 Viat 客户端。worker CA 变量需显式[透传](../configuration/integrations.md)，有些替换而非扩展信任。不存在通用 VIAT_CA_BUNDLE 服务端参数。业务 PostgreSQL/MySQL 有[真实 TLS 限制](../configuration/database.md)。

验证批准后通过服务管理器 reload nginx，再验证夹具流逐步输出、WebSocket 升级、OIDC URL 使用正确 HTTPS/前缀和实际新证书。真实 IdP/provider 测试需明确 opt-in。失败时保留/恢复旧证书配置，不以关闭证书检查作为恢复方案。
