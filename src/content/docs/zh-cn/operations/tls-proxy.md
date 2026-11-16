---
title: TLS、反向代理与流式传输
description: 配置可信公共 URL、内置 TLS/nginx 终结、转发头、请求限制和证书续期。
doc_id: operations.tls-proxy
verified_release: '1.1.0'
channel: stable
---

# TLS、反向代理与流式传输

生产 TLS 首选反向代理/ingress;无代理时可用内置 TLS。以下配置与验证命令
**均未执行**。DNS、证书、防火墙与代理变更需基础设施批准。准备好回退;
依赖可信代理头时,**不得**同时直接暴露明文后端。

## 方案 A:内置 TLS

提供服务端可读、项目脚本不可读的 PEM 完整链与匹配私钥,以只读方式挂到
稳定路径:

```dotenv
VIAT_BIND=0.0.0.0:8443
VIAT_TLS_CERT=/etc/viat/tls/fullchain.pem
VIAT_TLS_KEY=/etc/viat/tls/privkey.pem
VIAT_PUBLIC_URL=https://api.example.com:8443
VIAT_TRUST_PROXY_HEADERS=false
```

要点:

- 证书与 key **必须同时设置或同时不设**;缺一、初始不可读或不匹配会启动
  失败——**不会静默降级为 HTTP**。TLS 监听要求 IP:port。
- 续期 = 原子替换匹配的文件对;每 60 秒按修改时间检查;重载失败记录后
  **保留上一对**;换路径须重启。
- 没有:内置 ACME 签发器、mTLS 客户端认证配置、完整 nginx 等价的
  cipher/OCSP 参数面。
- 镜像健康检查跟随 bind/TLS 探测 healthz,并**刻意跳过**本地 HTTPS
  身份/信任校验——它**不证明公网证书有效**;用验证信任的外部客户端监控
  期限/实际身份。

## 方案 B:nginx 终结 TLS

Viat 监听回环/私网,`VIAT_PUBLIC_URL=https://api.example.com`;仅当**所有**
流量都经受控代理时才 `VIAT_TRUST_PROXY_HEADERS=true`。此独立模板假设后端
在宿主 `127.0.0.1:8080`;分容器部署要改为批准的私网地址。

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

模板语义,四个关键点:

- 单边缘代理模板对调用方转发 IP 是**覆盖**而不是保留伪造链。Viat 取
  `X-Forwarded-For` 的**最后一段**;多层可信代理必须按真实链路设置验证,
  并阻止绕过代理直连后端——否则调用方可伪造头。
- 模板对所有路径关闭响应缓冲以保留 SSE/NDJSON/tail 的即时性——验证后可
  缩小范围。
- `proxy_read_timeout` 是**两次读取之间的空闲**期限,不是整个执行时长:
  按合理静默、同步上限与发布构建等待协调;长流/tail 可能需要更长空闲
  允许。
- WebSocket 必须有 `Upgrade`;普通 HTTP **不能**被强制升级。流压缩/额外
  缓冲会延迟输出。

## 子路径部署

外部地址为 `https://api.example.com/viat` 时:

- 把 `VIAT_PUBLIC_URL` 设为该值——**无需**重建镜像或另设前缀变量。
- 应用 location 从 `/` 改为 `/viat/`,保留**不带 URI 后缀**的
  `proxy_pass http://viat_backend;`(让服务端剥前缀);需要时加精确的
  `/viat` → `/viat/` 重定向。**不要重复添加前缀。**
- IdP 回调、webhook、CLI server 与监控路径同步更新;前缀不能与保留平台
  命名空间冲突。
- 验证:`/viat/ui/`、静态资产、登录回调和夹具 `/viat/p/PROJECT/PATH`。
  代理也可以只剥一次,但混用不一致的 rewrite 会让资产/认证跳转出错。

## 上传大小与缓冲

- 默认 `2m` 匹配普通缓冲执行的 2 MiB,但**不够**合法的大 multipart 或
  专用 S3 流。只为**批准路径**增设 location:继承相同头/超时,设置较大
  且有界的 `client_max_body_size`、`proxy_request_buffering off`,并明确
  proxy_pass/响应缓冲。例如 `/p/demo/upload` 按审批可用 `110m`(容纳
  100 MiB 文件 + multipart 开销)——这是策略示例,**不是产品默认**。
  S3 路径 `/p/PROJECT/_s3/...` 需要独立的大小政策。
- 提高 nginx 限制**不会**提高 `VIAT_STORAGE_MAX_FILE_BYTES`、资源上限或
  2 MiB 文本缓冲。支持流不等于必须无限上传:预算临时盘、文件数与并发。
  Rust 产物有独立的 512 MiB 产品上限。

## 验证信任、跳转与续期

未执行模板;用实际公共域名与批准 CA,**不用 `-k`**:

```sh
curl --fail --silent --show-error https://api.example.com/healthz
curl --fail --silent --show-error https://api.example.com/readyz
openssl s_client -connect api.example.com:443 \
  -servername api.example.com -verify_return_error </dev/null
nginx -t
```

私有 CA 的信任要在**真实客户端边界**安装批准根/中间链:代理、浏览器/OS、
CLI、服务端出站与 worker 各自处理。curl `--cacert` 只验证 curl,不代表
所有 Viat 客户端;worker CA 变量需显式
[透传](../configuration/integrations.md),有些是**替换**而非扩展信任;
不存在通用的 `VIAT_CA_BUNDLE` 服务端参数。业务 PostgreSQL/MySQL 的 TLS
有[真实限制](../configuration/database.md)。

验证批准后:经服务管理器 reload nginx → 验证夹具流逐步输出、WebSocket
升级、OIDC URL 使用正确 HTTPS/前缀与**实际新证书**。真实 IdP/provider
测试需明确 opt-in。失败时保留/恢复旧证书配置——**不要**以关闭证书检查
作为恢复方案。
