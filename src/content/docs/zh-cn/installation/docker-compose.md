---
title: 使用 Docker Compose 安装
description: 使用 PostgreSQL、持久卷、必要密钥、初始登录和健康检查部署稳定服务端。
doc_id: installation.docker-compose
verified_release: '1.1.0'
channel: stable
---

# 使用 Docker Compose 安装

本流程用官方 server/CLI **1.1.0** 镜像和 PostgreSQL 建立**新的单节点安装**,
首次配置只绑定主机回环地址。不包含生产 TLS、外部备份或多节点集群。

完成后你会得到:一个监听 `127.0.0.1:8080` 的实例、内置 Web 控制台和一个
引导创建的平台 Owner 账号。

![安装完成后的登录页](/screenshots/zh-cn/login.png)

## 前提

- 能运行已发布 Linux 镜像的主机、Docker Engine 与 Compose 插件。镜像发布面向
  `linux/amd64`;不要推断所有架构都有原生产物。
- 运行 Docker 与创建持久卷的权限、可用本地 `8080` 端口、足够磁盘/内存。
- 能拉取 `registry.cn-hangzhou.aliyuncs.com/viatdev/viat:1.1.0`。仓库凭据属于
  主机侧拉取配置,不是 Viat 资源秘密。
- OpenSSL(生成随机秘密)与初始平台 Owner 的邮箱、密码。
- **与官方镜像匹配的有效激活码**,或取得激活码的条件。没有激活码也能启动、
  登录并进入激活页,但受保护路由保持锁定,见[激活](../instance/activation.md)。

> [!WARNING]
> 不要把产品仓库的 `docker-compose.yml` 当安装器——它启动的是开发/测试依赖。
> 部署示例是 `docker-compose.example.yml`;下面给出固定稳定镜像版本的独立配置。

## 1. 准备私有目录和秘密

在安装主机的新目录执行:

```sh
mkdir viat-deployment
cd viat-deployment
umask 077
openssl rand -hex 32
openssl rand -hex 32
openssl rand -hex 24
openssl rand -hex 24
```

把四次输出依次保存为主密钥、JWT 秘密、PostgreSQL 密码、初始管理员密码,
并创建 `.env`(所有 `REPLACE_WITH_...` 都是占位符,不是可用凭据;数据库密码
用十六进制随机值可避免 URL 转义问题):

```dotenv
VIAT_MASTER_KEY=REPLACE_WITH_FIRST_OUTPUT
VIAT_JWT_SECRET=REPLACE_WITH_SECOND_OUTPUT
POSTGRES_PASSWORD=REPLACE_WITH_THIRD_OUTPUT
VIAT_DEFAULT_ADMIN_PASSWORD=REPLACE_WITH_FOURTH_OUTPUT
VIAT_DEFAULT_ADMIN_EMAIL=admin@example.com
VIAT_LICENSE_CODE=
```

邮箱改为你控制的地址;只在打算登录后再激活时才让激活码留空。然后:

```sh
chmod 600 .env
```

`VIAT_MASTER_KEY` 必须恰好 **64 个十六进制字符**。重启间保持不变并单独备份;
每次启动现编一个新密钥不是安全轮换存量秘密的方法。不要提交 `.env`。

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

要点:

- PostgreSQL 端口不发布到主机;`DATABASE_URL` 用服务名 `postgres` 与内部
  `5432`,不是开发栈的 `localhost:5433`。
- 即使之后创建 `sqlite` 资源,平台数据库仍然是 PostgreSQL。
- 官方镜像内置 Web 控制台、参考手册、CLI、`uv`、`bun`、Bash 与 `jq`;普通
  `1.1.0` 镜像**不能编译 Rust 脚本**——需要编译的节点使用 `1.1.0-build`
  变体并规划产物持久化。

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

`config --quiet` 验证变量插值但不打印秘密。PostgreSQL 先变健康,Viat 随后
启动并应用平台迁移。`/healthz` 返回 `200` 与 `{"status":"ok"}`;`/readyz`
在实例能处理数据库流量时返回 `200`,否则 `503`——它不是激活检查。

打开 `http://127.0.0.1:8080/` 会重定向到 `/ui/`,用初始邮箱密码登录(见本页
顶部截图)。引导账号只创建一次,平台角色为 `owner`;之后改环境变量**不会**
重置已有账号密码。若进入激活页,按[激活](../instance/activation.md)提交
有效激活码。

在 Compose 目录确认镜像内 CLI 版本:

```sh
docker compose exec viat viat --version
```

预期 `viat 1.1.0`。下一步:[第一个端点](../getting-started/first-endpoint.md)。

## 默认值与生产调整

- HTTP 监听 `0.0.0.0:8080`,本例只暴露 `127.0.0.1:8080`;远程浏览器需要隧道
  或明确配置的代理。
- 自助注册默认 `false`;协作者通过邀请加入,不要为造 Owner 开放注册。
- 默认调度时区 `UTC`;创建调度前选好 IANA 时区。
- Python 依赖缓存持久化在 `/home/viat/.cache/uv`,它不是平台数据库备份。
- 工作进程用独立低权限账号(UID `10001`)。脚本写挂载目录时,用
  `VIAT_WORKER_DATA_DIRS` 声明交接权限的绝对路径;不要全目录放开写权限。
- 对公网暴露前配置 HTTPS,并把 `VIAT_PUBLIC_URL` 设为含挂载前缀的真实外部
  URL。仅在你的代理终止全部请求时才开 `VIAT_TRUST_PROXY_HEADERS=true`。
- 按合法负载调整内存与进程限制;失控脚本仍可能耗尽容器预算。

## 故障排查

| 现象 | 处理 |
| --- | --- |
| Compose 提示变量必须设置 | 填对应 `.env` 值;必填项为空会被拒绝 |
| 镜像拉取无权限 / 无匹配 manifest | 检查仓库权限与 `linux/amd64` 兼容性;不要换未知 `latest` |
| 服务因密钥格式错误退出 | 恰好 64 个十六进制字符,值中不要粘入引号 |
| 数据库连接或迁移错误 | 看 `docker compose ps` 与 PostgreSQL 日志;确认 URL 指向正确且数据兼容的库 |
| PostgreSQL 拒绝刚改的密码 | `POSTGRES_PASSWORD` 只初始化新卷;改 `.env` 不改已存密码 |
| `healthz` 健康但产品 API 返回 `403 license_required` | 登录并激活;锁定时探针与激活入口故意开放 |
| Python 依赖构建不能下载包 | 检查服务端网络/代理/包源;主机浏览器能访问不代表容器能 |
| 旧 Docker 无法创建 worker thread | 升级 Docker Engine;不要常规化放宽 seccomp |

## 停止、备份与清理

```sh
docker compose stop
docker compose start
```

以上保留容器和卷。`docker compose down` 删除本栈容器与网络,通常保留命名卷;
**`docker compose down -v` 会销毁命名卷中的数据(含平台数据库)**,不是升级或
修复命令。

升级前:按数据库备份流程备份 PostgreSQL,通过受保护的秘密备份保存
`.env`/主密钥,并备份业务文件与产物挂载;记录镜像版本或摘要。不要假定旧
服务能读取应用了新迁移的数据库——回滚需要经验证的兼容恢复方案。

## 核验依据

契约源码 `03751a67`:`docker-compose.example.yml`、`.env.example`、`Dockerfile`、`scripts/docker-build-push.sh`、`crates/viat-api/src/config.rs`、`crates/viat-api/src/main.rs`、`crates/viat-api/src/handlers/health.rs`。稳定服务端产物:`1.1.0`(`fd340879`)。
