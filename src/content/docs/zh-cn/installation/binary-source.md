---
title: 二进制与源码构建
description: 区分已发布 CLI 和服务端源码构建，并完整提供源码服务端所需运行配置。
doc_id: installation.binary-source
verified_release: '1.1.0'
channel: stable
---

# 二进制与源码构建

安装稳定服务端最简单的路径是 [Docker Compose](docker-compose.md)。先分清
两个程序名:`viat` 可执行文件是**管理 CLI**,不是一体化服务端安装器;
服务端程序名是 `viat-api`。本页说明如何辨认二进制,以及——在明确自行
维护开发型安装时——如何构建固定版本的源码。

## 选择前先确认

- 你需要:主机软件安装/运行权限、可控的 PostgreSQL 数据库、受保护的
  秘密存储,以及与所选服务端构建中校验公钥**匹配**的有效激活码。源码
  构建**不绕过激活**,"客户生成签名密钥"也不是激活步骤。
- 源码构建还需要:对应发行版的 Rust 工具链
  (`rust-toolchain.toml` 固定 `1.98`)、Cargo、C 链接器与依赖所需的
  平台开发库;构建浏览器控制台需要 Node/npm——用仓库根目录的
  lockfile/workspaces,**不要**在 `web/` 里另装一套;Python 脚本要
  `uv`、TypeScript 要 `bun`、shell 能力要 Bash/`jq`(编译服务端**不会**
  安装这些解释器);构建依赖的网络访问与运行时装包的网络条件。
- 本页**不承诺**可下载的原生服务端安装包,也不承诺已签名的
  Windows/Linux 桌面发行版。Apple 客户端安装与其中的 CLI 见
  [客户端](clients.md);本手册未确立公开产物下载 URL。

## 辨认已有程序

已安装 CLI:

```sh
command -v viat
viat --version
viat version
```

本基线的 `viat --version` 应返回 `viat 1.1.0`。`viat version` 始终报告
本地 CLI,只有配置的会话能读 `/version` 时才补服务端版本——
"Version unavailable" 不一定是二进制问题,也可能是未登录、网络失败或
服务端版本较旧。

官方容器内含 `/usr/local/bin/viat-api` 与 `/usr/local/bin/viat`。
**不要**把 Linux 二进制从镜像拷出后就假定能在 macOS/Windows 运行——
架构与共享库要求仍然存在。

## 有意构建稳定源码

使用经授权源码分发渠道取得的产品工作副本;在根目录编译前确认
server/CLI 发行提交:

```sh
git checkout --detach fd340879
git rev-parse HEAD
```

`fd340879` 是 server/CLI 1.1.0 的发行基线。后续文档契约基线 `03751a67`
还包含 Apple 发布入口工具——但这**不代表**每个后续分支都是新的稳定
服务端版本;不要检出未发布的 Widget/APNs 分支并以稳定版名义交付。

### 容器化源码构建

有 Docker 时,显式指定 target,避免误建最后的可编译变体阶段:

```sh
docker build --target runtime -t viat-local:1.1.0 .
```

- 预期得到包含服务端、CLI、控制台与参考手册的本地镜像。此命令只做
  本地构建:不推镜像、不装运行中服务;需要较多时间/磁盘/依赖下载;
  Dockerfile 用已提交的 SQLx 缓存编译。部署时把
  [Docker Compose](docker-compose.md) 的 `viat.image` 改成
  `viat-local:1.1.0`,**保留全部运行配置与存储要求**。
- 需要在服务节点编译 Rust 脚本时,明确选另一个 target:

```sh
docker build --target runtime-build -t viat-local:1.1.0-build .
```

  build 变体增加编译器与匹配 SDK——但**不会**取消持久化产物存储、
  数据库备份、激活或运行限制的要求。

### 原生开发构建

在固定版本的产品根目录执行:

```sh
SQLX_OFFLINE=true cargo build --release --locked -p viat-api -p viat-cli
npm ci
npm run build:web
```

- 预期产物:`target/release/viat-api` 与 `target/release/viat`;浏览器
  产物在 `web/dist`。对未修改的发行源码,`SQLX_OFFLINE=true` 使用已提交
  的 `.sqlx/` 描述——它**不能**替代"修改 SQL 后重新生成缓存"。普通在线
  SQLx 编译在编译时要求实时且迁移匹配的 PostgreSQL。缓存不匹配时,恢复
  一致的源码/缓存组合,**不要**盲改查询元数据。
- 纯管理 API/CLI 的无界面安装可跳过 `npm` 步骤;但没有构建文件和
  `VIAT_WEB_DIR`,原生服务不会凭空带控制台。该序列**不**构建原生应用、
  不跑测试、不建系统服务、不把工具装进 `PATH`。

## 配置源码构建的服务端

- 准备一个**空** PostgreSQL 数据库与专用登录账号;引导阶段该账号需要
  应用平台迁移的权限。**不要**让实验构建连已有生产数据库。
- 在产品根目录的 **Bash** 会话私下输入:

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

- PostgreSQL URL 形如 `postgres://USER:PASSWORD@HOST:5432/DATABASE`,
  填实际值(必要时百分号编码)。主密钥用 `openssl rand -hex 32` 生成
  一次、安全保存并**重复使用**;JWT 秘密另生成强随机值——原生默认
  `dev-secret-change-me` 不适合真实部署。这些提示避免密码进 shell
  历史;环境变量与本地进程访问仍属主机安全问题。
- 服务启动时应用迁移;缺平台数据库或主密钥会启动失败。初始 Owner 只
  引导一次——环境变量**不会**覆盖现有密码。长期服务应改用受保护的
  服务管理器凭据与配置,不依赖交互式 shell。
- 跳过控制台构建时:省略 `VIAT_WEB_DIR`,用 CLI/API 登录;需要控制台时,
  启动前确认 `web/dist` 存在。可私下设 `VIAT_LICENSE_CODE` 做启动激活,
  或登录后按[激活](../instance/activation.md)操作。

## 验证与排错

第二个终端:

```sh
curl --fail --silent --show-error http://127.0.0.1:8080/healthz
curl --fail --silent --show-error http://127.0.0.1:8080/readyz
./target/release/viat --version
```

预期:存活探针 `200`(`{"status":"ok"}`)、数据库可用时就绪探针 `200`、
CLI 为 `viat 1.1.0`。健康进程**仍可能未激活**;真正的发布/调用验证见
[第一个端点](../getting-started/first-endpoint.md)。

| 失败 | 处理 |
| --- | --- |
| `DATABASE_URL must be set` | 导出**平台** PostgreSQL URL,不是资源 SQLite 文件 |
| `VIAT_MASTER_KEY must be set` / 无效十六进制 | 提供保存过的 64 位十六进制主密钥 |
| 构建找不到 SQLx 查询数据 | 用发行版匹配缓存;修改 SQL 后需实时编译库并重生成缓存 |
| `/ui/` 不可用 | 构建 `web/dist` 并设 `VIAT_WEB_DIR`,或明确选择无界面 CLI/API |
| Python/TypeScript 运行时起不来 | 把所选解释器装进服务端 `PATH`;Rust 编译成功 ≠ 装了解释器 |
| Rust 脚本无法编译 | 查匹配的编译器、SDK 与构建能力——不只是"CLI 在不在" |

## 停止与清理

交互式服务用 `Ctrl-C` 等待关闭。需要恢复时**保留数据库与主密钥**;
移除 `target/` 只删本地构建产物,**不会**删平台数据库或服务创建的业务
文件。只通过正常数据库管理流程删除明确可丢弃的数据库;**不要**把未
验证的旧二进制接到已迁移数据库上当回滚方案。

## 核验依据

服务端发行 `fd340879`;契约源码 `03751a67`:`Cargo.toml`、`rust-toolchain.toml`、`Dockerfile`、根 `package.json`、`crates/viat-api/src/{config,main}.rs`、`crates/viat-cli/src/commands/auth.rs`。
