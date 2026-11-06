---
title: 二进制与源码构建
description: 区分已发布 CLI 和服务端源码构建，并完整提供源码服务端所需运行配置。
doc_id: installation.binary-source
verified_release: '1.1.0'
channel: stable
---

# 二进制与源码构建

安装稳定服务端最简单的路径是 [Docker Compose](docker-compose.md)。`viat` 可执行文件是**管理 CLI**，不是一体化服务端安装器；服务端程序名是 `viat-api`。本页说明如何辨认二进制，以及在明确自行维护开发型安装时构建固定版本源码。

## 选择前先确认

你需要主机软件安装和运行权限、可控制的 PostgreSQL 数据库、受保护的秘密存储，以及与所选服务端构建中校验公钥匹配的有效激活码。源码构建不绕过激活，也不意味着客户生成签名密钥是激活步骤。

源码构建还需要：

- 对应发行版的 Rust 工具链（`rust-toolchain.toml` 固定为 `1.98`）、Cargo、C 链接器及依赖需要的平台开发库。
- 若要构建浏览器控制台，需要 Node/npm；使用仓库根目录 lockfile/workspaces，不要在 `web/` 内独立安装一套依赖。
- Python 脚本需要 `uv`，TypeScript 需要 `bun`，所用 shell 能力需要 Bash/`jq`。编译服务端不会安装这些解释器。
- 构建依赖的网络访问，以及需要时安装运行时包的网络条件。

本页不承诺可下载的原生服务端安装包，也不承诺已签名的 Windows/Linux 桌面发行版。Apple 客户端安装及其中的 CLI 见[客户端](clients.md)。本手册未确立公开产物下载 URL。

## 辨认已有程序

对于已安装 CLI：

```sh
command -v viat
viat --version
viat version
```

本基线的 `viat --version` 应返回 `viat 1.1.0`。`viat version` 始终报告本地 CLI，只有配置的会话能读取 `/version` 时才补充服务端版本。“Version unavailable” 不一定说明二进制错误，也可能是未登录、网络失败或服务端版本较旧。

官方容器包含 `/usr/local/bin/viat-api` 和 `/usr/local/bin/viat`。不要从镜像拷出 Linux 二进制后就假定它能在 macOS 或 Windows 运行；架构和共享库要求仍然存在。

## 有意构建稳定源码

使用通过授权源码分发渠道取得的产品工作副本。在根目录编译前确认 server/CLI 发行提交：

```sh
git checkout --detach fd340879
git rev-parse HEAD
```

`fd340879` 是 server/CLI 1.1.0 的发行基线。后续文档契约基线 `03751a67` 还包含 Apple 发布入口工具，但这不代表每个后续分支都是新的稳定服务端版本。不要将未发布 Widget/APNs 分支检出并以稳定版名义交付。

### 容器化源码构建

具备 Docker 时，显式指定 target，避免误构建最后的可编译变体阶段：

```sh
docker build --target runtime -t viat-local:1.1.0 .
```

预期得到包含服务端、CLI、控制台和参考手册的本地镜像。此命令只做本地构建，不推送镜像，也不安装运行中服务。它需要较多时间、磁盘和依赖下载；Dockerfile 使用已提交 SQLx 缓存编译。部署时，将 [Docker Compose](docker-compose.md) 中 `viat.image` 改成 `viat-local:1.1.0`，保留全部运行配置和存储要求。

需要在服务节点编译 Rust 脚本时，明确选择另一 target：

```sh
docker build --target runtime-build -t viat-local:1.1.0-build .
```

build 变体增加编译器和匹配 SDK，但不会取消持久化产物存储、数据库备份、激活或运行限制的要求。

### 原生开发构建

在固定版本的产品根目录执行：

```sh
SQLX_OFFLINE=true cargo build --release --locked -p viat-api -p viat-cli
npm ci
npm run build:web
```

预期程序为 `target/release/viat-api` 和 `target/release/viat`，浏览器产物为 `web/dist`。对于未修改的发行源码，`SQLX_OFFLINE=true` 使用已提交 `.sqlx/` 描述；它不能替代维护修改后 SQL 时重新生成缓存。普通在线 SQLx 编译则在编译时要求实时且迁移匹配的 PostgreSQL。缓存不匹配时应恢复一致的源码/缓存组合，不要盲改查询元数据。

纯管理 API/CLI 的无界面安装可以跳过 `npm` 步骤；但没有构建文件和 `VIAT_WEB_DIR`，原生服务不会凭空包含控制台。该序列不构建原生应用、不运行测试、不创建系统服务，也不会把工具安装到 `PATH`。

## 配置源码构建的服务端

准备一个空 PostgreSQL 数据库和专用登录账号。引导阶段，该账号需要应用平台迁移的权限。不要让实验构建连接已有生产数据库。

在产品根目录的 **Bash** 会话中私下输入：

```bash
read -r -s -p 'PostgreSQL URL: ' DATABASE_URL; printf '\n'
export DATABASE_URL
read -r -s -p 'Master key (64 hex characters): ' VIAT_MASTER_KEY; printf '\n'
export VIAT_MASTER_KEY
read -r -s -p 'JWT secret: ' VIAT_JWT_SECRET; printf '\n'
export VIAT_JWT_SECRET
read -r -p 'Initial owner email: ' VIAT_DEFAULT_ADMIN_EMAIL
export VIAT_DEFAULT_ADMIN_EMAIL
read -r -s -p 'Initial owner password: ' VIAT_DEFAULT_ADMIN_PASSWORD; printf '\n'
export VIAT_DEFAULT_ADMIN_PASSWORD
export VIAT_BIND=127.0.0.1:8080
export VIAT_ALLOW_REGISTRATION=false
export VIAT_WEB_DIR="$PWD/web/dist"
./target/release/viat-api
```

PostgreSQL URL 形如 `postgres://USER:PASSWORD@HOST:5432/DATABASE`，请填实际值，必要时做百分号编码。使用 `openssl rand -hex 32` 生成一次主密钥，安全保存并重复使用；JWT 秘密另行生成强随机值。原生默认 JWT 值 `dev-secret-change-me` 不适合真实部署。这些提示避免将密码字面值写入 shell 历史；环境变量和本地进程访问仍属于主机安全问题。

服务在启动时应用迁移。缺失平台数据库或主密钥会启动失败。初始 Owner 只引导一次，环境变量不会覆盖现有密码。长期服务应改用受保护的服务管理器凭据和配置，不要依赖交互式 shell。

若跳过了控制台构建，省略 `VIAT_WEB_DIR` 并用 CLI/API 登录。需要控制台时，启动前确认 `web/dist` 存在。可私下设置 `VIAT_LICENSE_CODE` 做启动激活，或登录后按[激活](../instance/activation.md)操作。

## 验证与排错

在第二个终端执行：

```sh
curl --fail --silent --show-error http://127.0.0.1:8080/healthz
curl --fail --silent --show-error http://127.0.0.1:8080/readyz
./target/release/viat --version
```

预期存活探针 HTTP `200`（`{"status":"ok"}`）、数据库可用时就绪探针 `200`，CLI 为 `viat 1.1.0`。健康进程仍可能未激活。真正的发布/调用验证见[第一个端点](../getting-started/first-endpoint.md)。

| 失败 | 处理 |
| --- | --- |
| `DATABASE_URL must be set` | 导出平台 PostgreSQL URL，而不是资源 SQLite 文件 |
| `VIAT_MASTER_KEY must be set` / 无效十六进制 | 提供保存的 64 位十六进制主密钥 |
| 构建找不到 SQLx 查询数据 | 使用发行版匹配缓存；修改 SQL 后需实时编译数据库和缓存再生成 |
| `/ui/` 不可用 | 构建 `web/dist` 并设置 `VIAT_WEB_DIR`，或明确选择无界面 CLI/API |
| Python/TypeScript 运行时无法启动 | 把所选解释器安装到服务端 `PATH`；Rust 编译成功不代表安装了解释器 |
| Rust 脚本无法编译 | 检查匹配的编译器、SDK 和构建能力，不只是 CLI 是否存在 |

## 停止与清理

交互式服务使用 `Ctrl-C`，等待关闭。如需恢复，保留数据库和主密钥。移除 `target/` 只删除本地构建产物，**不会**删除平台数据库或服务创建的业务文件。仅通过正常数据库管理流程删除明确可丢弃的数据库；不要把未验证的旧二进制连接到已迁移数据库当成回滚方案。

## 核验依据

服务端发行 `fd340879`；契约源码 `03751a67`：`Cargo.toml`、`rust-toolchain.toml`、`Dockerfile`、根 `package.json`、`crates/viat-api/src/{config,main}.rs`、`crates/viat-cli/src/commands/auth.rs`。
