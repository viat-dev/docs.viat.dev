---
title: 使用 Docker Compose 安装
description: 使用 PostgreSQL、持久卷、必要密钥、初始登录和健康检查部署稳定服务端。
doc_id: installation.docker-compose
verified_release: '1.1.0'
channel: stable
---

# 使用 Docker Compose 安装

本流程使用官方 server/CLI **1.1.0** 镜像和 PostgreSQL 创建**新的单节点安装**，首次配置仅绑定主机回环地址。流程不包含生产 TLS、外部备份或多节点集群配置。

## 前提与权限

- 能运行已发布 Linux 镜像的主机、Docker Engine 与 Compose 插件（`docker compose`）。镜像发布脚本面向 `linux/amd64`，不要推断所有主机架构都有原生产物。
- 运行 Docker、创建持久卷的权限，可用的本地 `8080` 端口、足够磁盘，以及合适的内存和进程预算。
- 能拉取 `registry.cn-hangzhou.aliyuncs.com/viatdev/viat:1.1.0`，或经过授权镜像源中的同一产物。如需仓库凭据，它属于主机侧拉取配置，不是 Viat 资源秘密。
- 用于生成随机秘密的 OpenSSL，以及初始平台 Owner 的邮箱和密码。
- **与官方镜像匹配的有效激活码**，或通过现有分发安排取得激活码的条件。没有激活码也能启动和登录，但受保护路由保持锁定，见[激活](../instance/activation.md)。

不要把产品仓库的 `docker-compose.yml` 当安装器，它启动开发/测试依赖，不包含完整客户服务端。`docker-compose.example.yml` 才是部署示例；下面提供固定稳定镜像版本而非 `latest` 的独立配置。

## 1. 准备私有目录和秘密

在安装主机的新目录执行：

```sh
mkdir viat-deployment
cd viat-deployment
umask 077
openssl rand -hex 32
openssl rand -hex 32
openssl rand -hex 24
openssl rand -hex 24
```

将四次输出分别安全保存为主密钥、JWT 秘密、PostgreSQL 密码和初始管理员密码。用文本编辑器创建 `.env`：

```dotenv
VIAT_MASTER_KEY=REPLACE_WITH_FIRST_OUTPUT
VIAT_JWT_SECRET=REPLACE_WITH_SECOND_OUTPUT
POSTGRES_PASSWORD=REPLACE_WITH_THIRD_OUTPUT
VIAT_DEFAULT_ADMIN_PASSWORD=REPLACE_WITH_FOURTH_OUTPUT
VIAT_DEFAULT_ADMIN_EMAIL=admin@example.com
VIAT_LICENSE_CODE=
```

继续前替换所有 `REPLACE_WITH_...` 值，并改为你控制的邮箱。这些只是占位符，不是可用凭据。数据库密码使用十六进制随机值，可避免下面 `DATABASE_URL` 的 URL 转义问题。只有打算登录后激活时，才把激活码留空。

```sh
chmod 600 .env
```

`VIAT_MASTER_KEY` 必须恰好为 **64 个十六进制字符**。重启时保持不变，并单独备份；每次启动生成新密钥不是安全轮换存量秘密的方法。首次使用前设置强 JWT 秘密。不要提交 `.env`。

## 2. 创建 `compose.yaml`

```yaml
services:
  postgres:
    image: postgres:17.4-alpine
    environment:
      POSTGRES_USER: viat
      POSTGRES_DB: viat
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD}
    volumes:
      - viat-pg:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U viat -d viat"]
      interval: 5s
      timeout: 3s
      retries: 20
    restart: unless-stopped

  viat:
    image: registry.cn-hangzhou.aliyuncs.com/viatdev/viat:1.1.0
    depends_on:
      postgres:
        condition: service_healthy
    ports:
      - "127.0.0.1:8080:8080"
    environment:
      DATABASE_URL: postgres://viat:${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD}@postgres:5432/viat
      VIAT_MASTER_KEY: ${VIAT_MASTER_KEY:?set VIAT_MASTER_KEY}
      VIAT_JWT_SECRET: ${VIAT_JWT_SECRET:?set VIAT_JWT_SECRET}
      VIAT_DEFAULT_ADMIN_EMAIL: ${VIAT_DEFAULT_ADMIN_EMAIL:?set VIAT_DEFAULT_ADMIN_EMAIL}
      VIAT_DEFAULT_ADMIN_PASSWORD: ${VIAT_DEFAULT_ADMIN_PASSWORD:?set VIAT_DEFAULT_ADMIN_PASSWORD}
      VIAT_ALLOW_REGISTRATION: "false"
      VIAT_LICENSE_CODE: ${VIAT_LICENSE_CODE:-}
      VIAT_TRUST_PROXY_HEADERS: "false"
      RUST_LOG: info
    volumes:
      - viat-uv-cache:/home/viat/.cache/uv
    pids_limit: 512
    mem_limit: 4g
    restart: unless-stopped

volumes:
  viat-pg:
  viat-uv-cache:
```

PostgreSQL 端口没有发布到主机。`DATABASE_URL` 使用服务名 `postgres` 和内部 `5432` 端口，不是开发栈的 `localhost:5433`。以后即使创建 `sqlite` 资源，平台数据库仍然是 PostgreSQL。

官方镜像包含 Web 控制台、参考手册、CLI、`uv`、`bun`、Bash 和 `jq`。普通 `1.1.0` 镜像**不能编译 Rust 脚本**。需要编译的节点使用匹配的 `1.1.0-build` 变体，并在依赖 Rust 产物前规划持久化产物存储。有 CLI 不等于有 Rust 工具链。

## 3. 启动并检查

```sh
docker compose config --quiet
docker compose pull
docker compose up -d
docker compose ps
docker compose logs --since 10m viat
curl --fail --silent --show-error http://127.0.0.1:8080/healthz
curl --fail --silent --show-error http://127.0.0.1:8080/readyz
```

`config --quiet` 验证 Compose 变量插值，但不打印展开后的秘密值。PostgreSQL 应先变为健康，随后 Viat 启动并应用平台迁移。`/healthz` 返回 HTTP `200` 和 `{"status":"ok"}`。`/readyz` 在实例能处理数据库流量时返回 `200`，不能时返回 `503`；它不是激活检查。分享原始启动日志前，应检查其中是否含私有配置。

打开 `http://127.0.0.1:8080/`，会重定向到 `/ui/`。使用初始邮箱和密码登录。引导账号只创建一次，平台角色为 `owner`；以后改变环境变量**不会**重置已有账号密码。若进入激活页，按[激活](../instance/activation.md)提交有效激活码。

在同一 Compose 目录，可查看镜像中 CLI 的本地版本：

```sh
docker compose exec viat viat --version
```

预期版本为 `viat 1.1.0`。如需从工作站管理，安装匹配 CLI 或使用控制台；下一步可完成[第一个端点](../getting-started/first-endpoint.md)。

## 默认值与生产调整

- 镜像内 HTTP 监听 `0.0.0.0:8080`。本例仅暴露 `127.0.0.1:8080`；远程浏览器需要隧道或明确配置的代理才能访问。
- 镜像自助注册默认为 `false`。通过邀请添加协作者，不要为了建立 Owner 而开放注册。
- 默认调度时区为 `UTC`；创建调度前选好所需 IANA 时区。
- Python 依赖缓存持久化到 `/home/viat/.cache/uv`，它不是平台数据库备份。
- 工作进程使用独立低权限账号（UID `10001`）。脚本写入挂载目录时，用 `VIAT_WORKER_DATA_DIRS` 指定要交接权限的绝对路径，或选择合适的工作进程 UID。不要用所有挂载目录全员可写来解决权限问题。
- 对公网暴露前，配置 HTTPS，并将 `VIAT_PUBLIC_URL` 设为真实外部 URL，包含挂载前缀。仅在你控制的代理终止所有请求时启用 `VIAT_TRUST_PROXY_HEADERS=true`；实现假定一个可信代理。
- 按合法负载调整内存和进程限制。失控脚本仍可能耗尽分配给容器的预算。

## 故障排查

| 现象 | 处理 |
| --- | --- |
| Compose 提示变量必须设置 | 填写对应 `.env` 值；必填项为空会被拒绝 |
| 镜像拉取无权限 / 无匹配 manifest | 检查仓库权限和 `linux/amd64` 兼容性，不要悄悄切换到未知 `latest` |
| 服务因密钥格式错误退出 | 检查恰好 64 个十六进制字符，值中不要粘入引号 |
| 数据库连接或迁移错误 | 查看 `docker compose ps` 和 PostgreSQL 日志；确认 URL 指向正确数据库且已有数据兼容 |
| PostgreSQL 拒绝刚修改的密码 | `POSTGRES_PASSWORD` 只初始化新卷；改 `.env` 不会改变 PostgreSQL 已存密码 |
| `healthz` 健康但产品 API 返回 `403 license_required` | 登录并激活；锁定时探针和激活入口仍故意开放 |
| Python 依赖构建不能下载包 | 检查服务端网络、代理和包源；主机浏览器可访问不代表容器可访问 |
| 旧 Docker 无法创建 worker thread | 升级 Docker Engine，不要把全面放宽 seccomp 当常规安装步骤 |

## 停止、备份与清理

```sh
docker compose stop
docker compose start
```

这些操作保留容器和卷。`docker compose down` 删除本栈容器和网络，通常保留命名卷。**`docker compose down -v` 会销毁命名卷中的数据，包括平台数据库**，不能作为升级或修复命令。

升级前，按数据库备份流程备份 PostgreSQL，通过受保护的秘密备份保存 `.env`/主密钥，并备份新增业务文件和产物挂载。记录镜像版本或摘要。不要假定旧服务能读取应用了新迁移的数据库；回滚需要经过验证、兼容的恢复方案，而不只是改回镜像标签。

## 核验依据

契约源码 `03751a67`：`docker-compose.example.yml`、`.env.example`、`Dockerfile`、`scripts/docker-build-push.sh`、`crates/viat-api/src/config.rs`、`crates/viat-api/src/main.rs`、`crates/viat-api/src/handlers/health.rs`。稳定服务端产物：`1.1.0`（`fd340879`）。
