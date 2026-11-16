---
title: 网络、TLS 与部署输入
description: 监听、公共 URL、TLS、WebSocket、镜像与部署脚本参数及实际限制。
doc_id: configuration.network
verified_release: '1.1.0'
channel: stable
---

# 网络、TLS 与部署输入

本页覆盖应用监听参数与非应用安装输入。[总览表约定](overview.md)适用;
除条件要求外均可选。所有部署/代理示例未执行。

## 服务端与 WebSocket 参数

| 变量 | 类型;默认值 | 校验、作用域与优先级 |
| --- | --- | --- |
| `VIAT_BIND` | string; `0.0.0.0:8080` | S。监听地址;内置 TLS 要求可解析的 IP:port。反代后选回环/私网地址。Docker/部署脚本可显式设置。 |
| `VIAT_PUBLIC_URL` | URL; 未设置 | S + D。去空白与末尾斜杠;**路径即挂载前缀**。未设时从 Host/X-Forwarded-Proto 推导。没有统一严格校验——请提供可信的绝对 URL。项目不可覆盖。 |
| `VIAT_TRUST_PROXY_HEADERS` | boolean; `false` | F。去空白且忽略大小写的 `true`/`yes`/`1` 启用转发客户端 IP;**仅当所有请求都经过会清理头的可信代理时**才安全。 |
| `VIAT_TLS_CERT` | path; 未设置 | S。PEM 证书/完整链,须配 key;空值视为未设。每 60 秒按修改时间检查并重载文件内容;**换路径须重启**。 |
| `VIAT_TLS_KEY` | path; 未设置 | S。与证书匹配的 PEM 私钥;只设一边或首次加载失败会阻止启动;后续重载失败**保留旧证书**。 |
| `VIAT_WEB_DIR` | path; 未设置 | S。含可读 index.html 的控制台构建目录(Docker 为 /app/web)。目录无效只警告、不提供控制台。 |
| `VIAT_UI_ENABLED` | boolean; `true` | S。去空白后的 `false`/`no`(忽略大小写)或 `0` 禁用控制台;**API 不受此开关影响**。没有目录时开着也没有 UI。 |
| `VIAT_DOCS_DIR` | path; 未设置 | S。含可读 index.html 的已渲染手册目录(Docker 为 /app/docs);用于 `/_docs`,不是远程文档 URL。 |
| `VIAT_DOCS_ENABLED` | boolean; `true` | S。与 UI_ENABLED 同一解析规则,独立关闭内置 `/_docs`。 |
| `VIAT_WS_MAX_CONNECTIONS` | u64 → usize; `10000` 连接 | F。单实例 WebSocket 正上限;0/非法回退。**不是**集群上限。 |
| `VIAT_WS_MAX_MESSAGE_BYTES` | u64 → usize; `65536` 字节 | F。正的入站消息上限(64 KiB)。 |
| `VIAT_WS_QUEUE_DEPTH` | u64 → usize; `32` 条 | F。每连接正的出站队列深度;慢消费者可能被关闭,避免内存无限占用。 |
| `VIAT_WS_REVALIDATE_SECS` | u64; `300` 秒 | F。正的会话/授权复核间隔——不保证凭据即时撤销。 |
| `VIAT_WS_MAX_LIFETIME_SECS` | u64; `86400` 秒 | F。正的连接寿命上限(24 小时);客户端须重连并重新认证。 |

## Compose 与部署脚本控制

| 变量 | 类型;默认值 | 校验、作用域与优先级 |
| --- | --- | --- |
| `VIAT_TAG` | string; `latest` | I,仅 Compose。镜像标签;生产固定 1.1.0 或已批准摘要,不要用易变的 latest。 |
| `VIAT_PORT` | 端口映射; `8080` | I,仅 Compose。宿主发布端口;容器内仍是 8080。 |
| `POSTGRES_USER` | string; `viat` | I。示例 PostgreSQL 镜像初始化及拼接 DATABASE_URL;**已有卷上修改不会**重命名/创建账号。 |
| `POSTGRES_PASSWORD` | string; `viat` | I。示例初始化与 URI 替换;必须换掉不安全默认值;修改**不会**轮换已有账号密码。 |
| `POSTGRES_DB` | string; `viat` | I。示例初始化及 URI;已有卷不重新初始化。 |
| `ENV_FILE` | path; `scripts/.env` | I,部署脚本。加载前选择;文件必须存在且是可执行 shell 语法;仅转发此文件声明的非脚本专用键。 |
| `IMAGE` | 镜像引用; 官方 `:latest` | I,部署脚本。非空时:调用环境 > 文件 > 默认。应固定稳定产物;不保证自动兼容数据库模式。 |
| `IMAGE_TAR` | path; 未设置 | I,部署脚本。非空时导入本地镜像包并跳过登录/拉取;IMAGE 须匹配导入镜像;调用环境优先。 |
| `NAME` | string; `viat-server` | I,部署脚本。容器名;**同名现有容器会被强制删除并重建**;调用环境优先。 |
| `HOST_PORT` | 端口映射; `8080` | I,部署脚本。宿主映射到固定容器端口 8080;反代后可用 `127.0.0.1:8080`;调用环境优先。 |
| `PULL` | switch; `1` | I,部署脚本。无 IMAGE_TAR 时严格 `1` 才拉取;`0` 用本地镜像;调用环境优先。 |
| `UV_CACHE_VOLUME` | mount; `viat-uv-cache` | I,部署脚本。挂载到 /home/viat/.cache/uv;调用环境优先;**不是**应用的 UV_* 包管理设置。 |
| `READY_TIMEOUT` | integer; `60` 秒 | I,部署脚本。shell 循环等待 `http://…/auth/config`,**不是** /readyz 或脚本环境就绪;用正数秒;调用环境优先。 |
| `DOCKER_NETWORK` | string; 未设置 | I,部署脚本。已存在的 Docker 网络;调用环境优先;用于数据库/容器名连通。 |
| `EXTRA_MOUNT` | string; 未设置 | I,部署脚本。逗号分隔的 Docker -v 规格;调用环境优先;尽量只读,**不挂宿主 socket 或根目录**。 |
| `SECURITY_OPT` | string; 未设置 | I,部署脚本。逗号分隔 security-opt;调用环境优先;`seccomp=unconfined` 削弱隔离,不是生产默认。 |
| `PIDS_LIMIT` | Docker limit; `512` | I,部署脚本。容器进程/线程上限(Docker 校验)。实现上"先取调用环境再加载文件",因此**文件可覆盖调用值**。不是应用并发。 |
| `MEMORY_LIMIT` | Docker size; `4g` | I,部署脚本。容器内存上限(Docker 校验);文件可覆盖调用值;只是示例起点,不是容量建议。 |
| `REGISTRY_HOST` | host[:port]; 推导 | I,部署脚本。未显式设置时从 IMAGE 推导;调用环境优先;不注入应用。 |
| `REGISTRY_USERNAME` | string; 未设置 | I,部署脚本。登录且使用密码时需要;调用环境优先;Docker 在部署主机保存登录凭据。 |
| `REGISTRY_PASSWORD` | string; 未设置 | I,部署脚本。配对登录秘密,经 password-stdin 传入,**不进入应用环境**;密码文件(下一项)优先;调用环境优先。 |
| `REGISTRY_PASSWORD_FILE` | path; 未设置 | I,部署脚本。可读密码文件覆盖 REGISTRY_PASSWORD;须限制权限;调用环境优先。 |
| `REGISTRY_LOGIN` | switch; `1` | I,部署脚本。拉取路径严格 `1` 才登录;`0` 跳过,用已有 Docker 凭据/匿名;调用环境优先。 |

## 公共 URL、前缀与反向代理

```dotenv
VIAT_PUBLIC_URL=https://api.example.com/viat
VIAT_TRUST_PROXY_HEADERS=true
```

含义:外部端点为 `https://api.example.com/viat/p/PROJECT/PATH`,控制台在
`/viat/ui/`。要点:

- `VIAT_PUBLIC_URL` 的路径**就是**挂载前缀;没有第二个受支持的前缀变量。
- 代理可以保留前缀让服务端剥离,或由代理剥离一次——**不要重复添加/移除**。
- 改前缀后,更新 IdP 注册回调与外部 webhook URL;避免与内部平台路径冲突
  的前缀。
- 显式公共 URL 固定出站链接的 origin,避免代理漏发
  `X-Forwarded-Proto` 时把 HTTPS 猜成 HTTP。它**不**替代 TLS、不开放
  端口、不验证代理可信度。
- 开启 `VIAT_TRUST_PROXY_HEADERS` 的前提:所有请求都经过受控代理,且代理
  **覆盖**客户端提供的转发头。IP 读取优先取 `X-Forwarded-For` 的最后一
  段,再考虑 `X-Real-IP`;多层代理按实际链路验证,不要盲用第一段。

完整 TLS/流式/WebSocket 代理示例、证书续期与校验:
[TLS 与反代](../operations/tls-proxy.md)。

## 不可忽略的固定限制

- 交给脚本/工作流缓冲的普通请求体上限 **2 MiB**——不是可调高的环境变量。
  multipart 的文本字段合计也受该预算;文件部分走磁盘暂存与文件上限。
- 反代/专用 S3 的流式传输不是同一条缓冲路径:代理应单独配置请求大小与
  磁盘预算,而不是把所有路径无限放大。
- Rust 产物上传上限 **512 MiB**;"可上传"不等于适合穿过任意前置代理,
  还受代理限制与授权约束。
- WebSocket 默认每实例 10,000 连接不是承诺容量——每个队列与消息都耗内存;
  代理须支持 Upgrade,并为流式/SSE 关掉不必要的缓冲。
- 镜像健康检查:每 30 秒探测 `/healthz`,超时 3 秒、启动期 20 秒、失败
  3 次;不校验公网证书身份,也**不等于** `/readyz`。

## 部署脚本的真实副作用

`deploy-server.sh`:

- **依赖已存在的 PostgreSQL**,不创建数据库。
- 读取可信 `.env`,按需登录仓库/导入或拉取镜像,然后**强制删除旧容器**
  并启动新容器——它不是无中断滚动更新器。
- 其检查只等待明文 `http://127.0.0.1:HOST_PORT/auth/config`:内置 TLS、
  特殊绑定或网络映射要另行验证,不能据此判定服务不可用。
- 默认容器端口 8080、缓存卷与资源限额;最终也会传入文件声明的应用变量
  ——避免在脚本模式配置冲突的 `VIAT_BIND`。仅存在于调用者 shell 而未在
  文件声明的非脚本键**不会**自动转发。
- `ENV_FILE` 是 shell source 输入:只加载可信文件,**绝不**运行下载来的
  未知脚本。

镜像构建输入(`DEBIAN_SUITE` 默认 bookworm、`VITE_MONACO_BUNDLE` 默认
true 且 false 已不受支持、`RUSTUP_DIST_SERVER`/`RUSTUP_UPDATE_ROOT` 未设
时走官方工具链下载)均为 **I(构建时)**。`VITE_BASE=./` 是官方镜像资产
相对路径;`VITE_VIAT_API_URL` 是自建前端的构建输入,不是部署后改 API
origin 的服务端开关。详见[客户端与工具链分类](integrations.md)。
